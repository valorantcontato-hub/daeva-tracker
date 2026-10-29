using System.Buffers.Binary;
using Aion2DpsMeter.Core.Protocol;

namespace DaevaCapture;

/// <summary>
/// Ofertas do Black Cloud Merchant. O servidor manda uma lista por aba (Special, Pets, Skins) com o id do item,
/// o preço original e o preço com desconto (pacote 91 56). O formato foi lido de gravações; ofertas inválidas são descartadas.
/// </summary>
public sealed class ShopTracker : IDisposable
{
    readonly Action<object> emit;
    readonly Dictionary<int, string> last = new();
    public ShopTracker(Action<object> emit) { this.emit = emit; PacketParser.DaevaPacket += Packet; }
    public void Dispose() => PacketParser.DaevaPacket -= Packet;

    static string TabName(byte tab) => tab switch { 0x65 => "special", 0x67 => "skins", 0x68 => "pets", _ => "tab-" + tab.ToString("x2") };

    void Packet(object key, ReadOnlySpan<byte> packet, long timestamp)
    {
        try
        {
            int i = 0;
            for (int shift = 0; shift <= 28; shift += 7) { if (i >= packet.Length) return; if (packet[i++] < 128) break; }
            if (i + 8 > packet.Length || packet[i] != 0x91 || packet[i + 1] != 0x56) return;
            byte tab = packet[i + 2];
            var offers = new List<object>();
            // Cada oferta: id do item (4) + quantidade (8) + nível de desconto (1) + 0x5d + preço original (8) + preço final (8) + código (4).
            for (int p = i + 2 + 13; p + 17 <= packet.Length; p++)
            {
                if (packet[p] != 0x5d) continue;
                long original = BinaryPrimitives.ReadInt64LittleEndian(packet[(p + 1)..]);
                long price = BinaryPrimitives.ReadInt64LittleEndian(packet[(p + 9)..]);
                if (original <= 0 || price <= 0 || price > original || original > 100_000_000) continue;
                uint item = BinaryPrimitives.ReadUInt32LittleEndian(packet[(p - 13)..]);
                if (item < 100_000_000) continue;
                offers.Add(new { item, original, price, tier = packet[p - 1] });
                p += 16;
            }
            if (offers.Count == 0) return;
            string fingerprint = string.Join(",", offers.Select(o => o.ToString()));
            if (last.TryGetValue(tab, out var before) && before == fingerprint) return;
            last[tab] = fingerprint;
            emit(new { type = "shop", capturedAt = DateTime.UtcNow.ToString("o"), tab = TabName(tab), offers });
        }
        catch (Exception) { /* pacote incompleto ou de outra versão: ignora */ }
    }
}
