// Wire layout adapted from MartinLVila/aion2-pet-overlay (MIT).
// Copyright notices and permission: licenses/pet-overlay-MIT.txt.
using System.Buffers.Binary;
using Aion2DpsMeter.Core.Combat;
using Aion2DpsMeter.Core.Protocol;

namespace DaevaCapture;

public sealed class PetCollection : IDisposable
{
    public sealed record Progress(Dictionary<uint, uint> Levels, Dictionary<uint, uint> Points);
    sealed class Flow {
        public string Id = Guid.NewGuid().ToString("N");
        public string? Owner;
        public Progress? Pending, State;
        public LocalProfile? Profile;
        public long Revision, Timestamp;
        public bool Dirty;
        public bool HasFullState;
        public long IdentityAt;
    }
    readonly Dictionary<object, Flow> flows = new();
    readonly Action<object> emit;
    static readonly int[] Requirements = [5, 25, 75];
    public PetCollection(Action<object> emit) {
        this.emit = emit;
        PacketParser.DaevaPacket += Packet;
        PacketParser.DaevaBatch += Batch;
    }
    public void Dispose() {
        PacketParser.DaevaPacket -= Packet;
        PacketParser.DaevaBatch -= Batch;
    }
    static uint U32(ReadOnlySpan<byte> p, ref int i) {
        if (i < 0 || i + 4 > p.Length) throw new FormatException();
        uint n = BinaryPrimitives.ReadUInt32LittleEndian(p[i..]); i += 4; return n;
    }
    static uint Var(ReadOnlySpan<byte> p, ref int i) {
        uint n = 0;
        for (int shift = 0; shift <= 28; shift += 7) {
            if (i >= p.Length) throw new FormatException();
            byte b = p[i++]; n |= (uint)(b & 127) << shift;
            if (b < 128) return n;
        }
        throw new FormatException();
    }
    public static Progress DecodeState(ReadOnlySpan<byte> p) {
        int i = 4; // Unknown header: never treated as character identity.
        var levels = new Dictionary<uint,uint>(); var points = new Dictionary<uint,uint>();
        uint count = Var(p, ref i);
        if (count > 1024) throw new FormatException();
        for (int n = 0; n < count; n++) {
            uint id = U32(p, ref i), duplicate = U32(p, ref i), level = U32(p, ref i);
            if (id != duplicate || id == 0 || level > 10 || !levels.TryAdd(id, level)) throw new FormatException();
        }
        count = Var(p, ref i);
        if (count > 1024) throw new FormatException();
        for (int n = 0; n < count; n++) {
            uint id = U32(p, ref i), amount = U32(p, ref i);
            if (id == 0 || amount > 1_000_000 || !points.TryAdd(id, amount)) throw new FormatException();
        }
        return new(levels, points);
    }
    public static void Gain(Progress state, uint id, uint amount) {
        uint level = Math.Min(3, state.Levels.GetValueOrDefault(id));
        uint points = state.Points.GetValueOrDefault(id);
        points = Math.Min(1_000_000, points + Math.Min(amount, 1_000_000));
        while (level < 3 && points >= Requirements[level]) { points -= (uint)Requirements[level]; level++; }
        state.Levels[id] = level; state.Points[id] = level == 3 ? 0 : points;
    }
    void Packet(object key, ReadOnlySpan<byte> packet, long timestamp) {
        try {
            int i = 0; Var(packet, ref i);
            if (i + 2 > packet.Length || packet[i + 1] != 0x90 || (packet[i] != 0 && packet[i] != 13)) return;
            if (!flows.TryGetValue(key, out var flow)) {
                if (flows.Count >= 16) flows.Clear();
                flows[key] = flow = new();
            }
            var payload = packet[(i+2)..];
            if (packet[i] == 0) {
                var state = DecodeState(payload);
                // On a new flow the self record may precede the collection by one TCP batch.
                bool initialIdentity = !flow.HasFullState && flow.Profile is not null && timestamp - flow.IdentityAt is >= 0 and <= 2000;
                flow.HasFullState = true;
                flow.Pending = initialIdentity ? null : state; flow.State = initialIdentity ? state : null;
                if (!initialIdentity) { flow.Owner = null; flow.Profile = null; }
                flow.Timestamp = timestamp; flow.Dirty = false;
                if (initialIdentity) flow.Dirty = true;
            } else if (payload.Length >= 9) {
                int j = 1; uint id = U32(payload, ref j), amount = U32(payload, ref j);
                var state = flow.Pending ?? flow.State;
                if (state is null || id == 0 || amount == 0 || amount > 10000) return;
                Gain(state, id, amount); flow.Dirty = true; flow.Timestamp = timestamp;
            }
        } catch (FormatException) { /* A patch or incomplete/invalid payload cannot replace valid progress. */ }
    }
    void Batch(object key, LocalProfile? profile, bool freshIdentity, long timestamp) {
        if (!flows.TryGetValue(key, out var flow)) {
            if (!freshIdentity || profile is not { ServerId: > 0 }) return;
            if (flows.Count >= 16) flows.Clear();
            flows[key] = flow = new();
        }
        if (freshIdentity && profile is { ServerId: > 0, Name: not null } && !profile.Name.StartsWith("Player_")) {
            string owner = profile.ServerId + ":" + profile.Name.Trim().ToLowerInvariant();
            if (flow.Owner is not null && flow.Owner != owner) { flow.State = null; flow.Dirty = false; }
            flow.Owner = owner; flow.Profile = profile;
            flow.IdentityAt = timestamp;
            // A full collection is bound only by a fresh self record in the SAME TCP flow,
            // in this batch or afterwards. A remembered name is deliberately insufficient.
            if (flow.Pending is not null && timestamp - flow.Timestamp is >= 0 and <= 10000) { flow.State = flow.Pending; flow.Pending = null; flow.Dirty = true; }
        }
        if (!flow.Dirty || flow.State is null || flow.Profile is null) return;
        flow.Dirty = false;
        emit(new { type = "pet-state", flowId = flow.Id, revision = ++flow.Revision,
            capturedAt = DateTime.UtcNow.ToString("o"), complete = true,
            self = new { name = flow.Profile.Name, serverId = (int)flow.Profile.ServerId },
            levels = new Dictionary<uint,uint>(flow.State.Levels), points = new Dictionary<uint,uint>(flow.State.Points) });
    }
}
