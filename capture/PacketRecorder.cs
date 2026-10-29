// Gravador de pacotes para estudo do protocolo (posição do personagem e dos monstros).
// Só roda quando o usuário pede (arquivo "record.start" ou --record). Grava, por pacote, o horário,
// o opcode, o tamanho e os primeiros bytes — nunca em segredo e sempre em arquivo local.
using System.Buffers.Binary;
using System.Text;
using Aion2DpsMeter.Core.Protocol;

namespace DaevaCapture;

public sealed class PacketRecorder : IDisposable
{
    const int SampleBytes = 160;
    const long MaxFileBytes = 150L * 1024 * 1024;
    readonly object gate = new();
    StreamWriter? file;
    DateTime endsAt;
    long bytes, packets;
    readonly Dictionary<string, (long Count, int Min, int Max)> stats = new();
    public string? Path { get; private set; }
    public bool Active => file is not null;

    public PacketRecorder() { PacketParser.DaevaPacket += OnPacket; }

    public void Dispose() { Stop(); PacketParser.DaevaPacket -= OnPacket; }

    public string Start(string dir, int seconds)
    {
        lock (gate)
        {
            if (file is not null) return Path!;
            Directory.CreateDirectory(dir);
            Path = System.IO.Path.Combine(dir, $"recording-{DateTime.Now:yyyyMMdd-HHmmss}.jsonl");
            file = new StreamWriter(Path, false, new UTF8Encoding(false)) { AutoFlush = false };
            endsAt = DateTime.UtcNow.AddSeconds(seconds);
            bytes = packets = 0;
            stats.Clear();
            file.WriteLine($"{{\"type\":\"start\",\"at\":\"{DateTime.Now:o}\",\"seconds\":{seconds}}}");
            return Path;
        }
    }

    /// <summary>Chamado a cada ciclo do laço principal: encerra a gravação quando o tempo acaba.</summary>
    public bool Tick()
    {
        lock (gate)
        {
            if (file is null) return false;
            if (DateTime.UtcNow < endsAt && bytes < MaxFileBytes) return false;
        }
        Stop();
        return true;
    }

    public void Stop()
    {
        lock (gate)
        {
            if (file is null) return;
            foreach (var (op, s) in stats.OrderByDescending(x => x.Value.Count))
                file.WriteLine($"{{\"type\":\"opcode\",\"op\":\"{op}\",\"count\":{s.Count},\"min\":{s.Min},\"max\":{s.Max}}}");
            file.WriteLine($"{{\"type\":\"end\",\"at\":\"{DateTime.Now:o}\",\"packets\":{packets}}}");
            file.Dispose();
            file = null;
        }
    }

    static int Varint(ReadOnlySpan<byte> p, out int next)
    {
        int n = 0, i = 0;
        for (int shift = 0; shift <= 28 && i < p.Length; shift += 7)
        {
            byte b = p[i++];
            n |= (b & 127) << shift;
            if (b < 128) { next = i; return n; }
        }
        next = i;
        return -1;
    }

    void OnPacket(object flow, ReadOnlySpan<byte> packet, long timestamp)
    {
        lock (gate)
        {
            if (file is null) return;
            Varint(packet, out int i);
            string op = i + 2 <= packet.Length ? $"{packet[i]:x2}{packet[i + 1]:x2}" : "----";
            var s = stats.GetValueOrDefault(op, (0L, int.MaxValue, 0));
            stats[op] = (s.Item1 + 1, Math.Min(s.Item2, packet.Length), Math.Max(s.Item3, packet.Length));
            int take = Math.Min(SampleBytes, packet.Length);
            var line = $"{{\"t\":{timestamp},\"f\":{flow.GetHashCode() & 0xffff},\"op\":\"{op}\",\"len\":{packet.Length},\"hex\":\"{Convert.ToHexString(packet[..take])}\"}}";
            file.WriteLine(line);
            bytes += line.Length;
            packets++;
        }
    }
}
