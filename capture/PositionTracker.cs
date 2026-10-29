// Posições das entidades (você e os monstros) lidas dos pacotes de movimento do jogo.
// Formato observado em gravações: [tamanho][opcode 2 bytes: 1a37 | 1b37 | 1c37][id da entidade em varint]
// [2 bytes (1a) ou 1 byte (1b, 1c)] e três floats little-endian X, Y, Z. Outros opcodes de movimento
// (ex.: 1d37, só deltas) são ignorados. Se um patch mudar o formato, valores fora de faixa são descartados.
using System.Buffers.Binary;
using Aion2DpsMeter.Core.Protocol;

namespace DaevaCapture;

public sealed class PositionTracker : IDisposable
{
    public readonly record struct Pos(float X, float Y, float Z, long At);
    const float Limit = 2_000_000f;
    readonly object gate = new();
    readonly Dictionary<int, Pos> positions = new();

    public PositionTracker() { PacketParser.DaevaPacket += OnPacket; }
    public void Dispose() { PacketParser.DaevaPacket -= OnPacket; }

    static bool Var(ReadOnlySpan<byte> p, ref int i, out int value)
    {
        value = 0;
        for (int shift = 0; shift <= 28; shift += 7)
        {
            if (i >= p.Length) return false;
            byte b = p[i++];
            value |= (b & 127) << shift;
            if (b < 128) return true;
        }
        return false;
    }

    static bool Plausible(float v) => float.IsFinite(v) && MathF.Abs(v) < Limit;

    void OnPacket(object flow, ReadOnlySpan<byte> packet, long timestamp)
    {
        int i = 0;
        if (!Var(packet, ref i, out _) || i + 2 > packet.Length) return;
        byte op = packet[i], kind = packet[i + 1];
        if (kind != 0x37 || op < 0x1a || op > 0x1c) return;
        i += 2;
        if (!Var(packet, ref i, out int id) || id <= 0) return;
        i += op == 0x1a ? 2 : 1;
        if (i + 12 > packet.Length) return;
        float x = BinaryPrimitives.ReadSingleLittleEndian(packet[i..]);
        float y = BinaryPrimitives.ReadSingleLittleEndian(packet[(i + 4)..]);
        float z = BinaryPrimitives.ReadSingleLittleEndian(packet[(i + 8)..]);
        if (!Plausible(x) || !Plausible(y) || !Plausible(z)) return;
        if (x == 0f && y == 0f) return; // entidade removida/inválida: (0, 0, 0) não é posição
        lock (gate) positions[id] = new Pos(x, y, z, Environment.TickCount64);
    }

    /// <summary>Entidades vistas nos últimos <paramref name="maxAgeMs"/> ms; as mais antigas são descartadas.</summary>
    public List<KeyValuePair<int, Pos>> Snapshot(long maxAgeMs)
    {
        long now = Environment.TickCount64;
        lock (gate)
        {
            foreach (var id in positions.Where(p => now - p.Value.At > 60_000).Select(p => p.Key).ToList()) positions.Remove(id);
            return positions.Where(p => now - p.Value.At <= maxAgeMs).ToList();
        }
    }
}
