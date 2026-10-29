// Small, guarded hook after TCP reassembly/LZ4 decoding. No second packet sniffer.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
export async function patchEngine(dir) {
  const file = join(dir, 'src/Aion2DpsMeter.Core/Protocol/PacketParser.cs');
  let source = await readFile(file, 'utf8');
  const replace = (before, after) => {
    if (source.split(before).length !== 2) throw new Error('Motor mudou: revise o hook de coleção antes de compilar: ' + before.slice(0, 70));
    source = source.replace(before, after);
  };
  if (!source.includes('// Daeva pet observer v1')) {
  replace('    private const int MaxEntityId', `    // Daeva pet observer v1: only complete frames; one parser instance per TCP flow.
    public delegate void PacketObserver(object flow, ReadOnlySpan<byte> packet, long timestamp);
    public static event PacketObserver? DaevaPacket;
    public static event Action<object, LocalProfile?, bool, long>? DaevaBatch;

    private const int MaxEntityId`);
  replace('        var framing = Framing.Walk(buffer);', '        var daevaBefore = DaevaBatch is null ? null : _store.GetLocalProfile();\n        var framing = Framing.Walk(buffer);');
  replace('        return framing.Consumed;', `        if (DaevaBatch is not null) {
            var profile = _store.GetLocalProfile();
            DaevaBatch.Invoke(this, profile, !ReferenceEquals(daevaBefore, profile), CurrentTimestampMs);
        }
        return framing.Consumed;`);
  replace('        bool damage = ParseDamage(packet,', '        DaevaPacket?.Invoke(this, packet, CurrentTimestampMs);\n        bool damage = ParseDamage(packet,');
  await writeFile(file, source);
  }
  const store = join(dir, 'src/Aion2DpsMeter.Core/Combat/CombatStore.cs');
  let storeSource = await readFile(store, 'utf8');
  if (!storeSource.includes('// Daeva mob code v1')) {
    const anchor = '    public bool IsMob(int id) { lock (_lock) return _mobCode.ContainsKey(id); }';
    if (storeSource.split(anchor).length !== 2) throw new Error('Motor mudou: revise o hook de código de NPC antes de compilar');
    const addition = [
      '    // Daeva mob code v1',
      '    public int? GetMobCode(int id) { lock (_lock) return _mobCode.TryGetValue(id, out var code) ? code : null; }',
    ].join('\n');
    storeSource = storeSource.replace(anchor, () => anchor + '\n' + addition);
    await writeFile(store, storeSource);
  }
  const dispatcher = join(dir, 'src/Aion2DpsMeter.Core/Capture/CaptureDispatcher.cs');
  source = (await readFile(dispatcher, 'utf8')).replace(/\r\n/g, '\n');
  if (!source.includes('// Daeva collection candidates v1')) {
  replace('if (LooksLikeTls(p.Data) || !Opcodes.ContainsAny(p.Data, _opcodes.SignaturesB))', 'if (LooksLikeTls(p.Data) || (!_streams.ContainsKey(p.Device + "|" + p.FlowKey) && !DaevaCollectionCandidate(p.Data) && !Opcodes.ContainsAny(p.Data, _opcodes.SignaturesB)))');
  replace('_signatureHits[key] = (hit.Count + 1, now);', '_signatureHits[key] = (hit.Count + (Opcodes.ContainsAny(p.Data, _opcodes.SignaturesB) ? 1 : 0), now);');
  replace('            _streams[key] = stream = new TcpStream(new PacketParser(_store, _data, _opcodes));', `        {
            if (_streams.Count >= 32) {
                var oldest = _streams.Keys.First();
                _streams.Remove(oldest); _signatureHits.Remove(oldest);
            }
            _streams[key] = stream = new TcpStream(new PacketParser(_store, _data, _opcodes));
        }`);
  replace('    private static bool LooksLikeTls', `    // Daeva collection candidates v1: login can precede the combat lock.
    // Continue every segment of an admitted flow, including split collection frames.
    private static bool DaevaCollectionCandidate(ReadOnlySpan<byte> data) {
        var length = VarInt.Read(data, 0);
        int i = length.Length;
        if (i <= 0 || i + 2 > data.Length || length.Value < 6 || length.Value > 2 * 1024 * 1024) return false;
        return (data[i + 1] == 0x90 && data[i] == 0x00) || (data[i] == 0xff && data[i + 1] == 0xff);
    }

    private static bool LooksLikeTls`);
  await writeFile(dispatcher, source);
  }
  if (!source.includes('// Daeva outbound recording v1')) {
    replace('    private ushort? _lockedPort;', `    // Daeva outbound recording v1: observes only the reverse of the locked game connection.
    public event Action<TcpPayload>? DaevaClientPacket;
    private string? _daevaReverseFlow;

    private ushort? _lockedPort;`);
    replace('                if (p.DstPort == port)\n                    _lastParsedMs = now; // the connection is alive', `                if (p.DstPort == port) {
                    _lastParsedMs = now; // the connection is alive
                    if (p.FlowKey == _daevaReverseFlow) DaevaClientPacket?.Invoke(p);
                }`);
    replace('        _lockedPort = p.SrcPort;', '        _lockedPort = p.SrcPort;\n        _daevaReverseFlow = $"{p.DstIp}:{p.DstPort}>{p.SrcIp}:{p.SrcPort}";');
    replace('        _lockedPort = null;', '        _lockedPort = null;\n        _daevaReverseFlow = null;');
    await writeFile(dispatcher, source);
  }
  if (!source.includes('// Daeva outbound reconnect v1')) {
    replace('        if (parsed)\n            _lastParsedMs = now;', `        if (parsed) {
            _lastParsedMs = now;
            // Daeva outbound reconnect v1: a new game stream after relogin can use another client port.
            if (_lockedPort is not null && Opcodes.ContainsAny(p.Data, _opcodes.SignaturesB))
                _daevaReverseFlow = $"{p.DstIp}:{p.DstPort}>{p.SrcIp}:{p.SrcPort}";
        }`);
    await writeFile(dispatcher, source);
  }
}
if (process.argv[2]) await patchEngine(process.argv[2]);
