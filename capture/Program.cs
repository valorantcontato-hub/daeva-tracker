// daeva-capture: lê o tráfego do AION 2 de forma passiva (Npcap) usando o motor do
// Aion2DpsMeter e envia a luta ao vivo para o Daeva Tracker (POST /api/live).
//
//   daeva-capture [--url http://localhost:47173] [--all-damage] [--replay arquivo.pcap]
using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Text.Json;
using Aion2DpsMeter.Core;
using Aion2DpsMeter.Core.Combat;
using Aion2DpsMeter.Core.Data;
using Aion2DpsMeter.Core.History;
using Aion2DpsMeter.Core.Protocol;

string Arg(string name, string fallback)
{
    int i = Array.IndexOf(args, name);
    return i >= 0 && i + 1 < args.Length ? args[i + 1] : fallback;
}

var url = Arg("--url", "http://localhost:47173").TrimEnd('/');
var replay = Arg("--replay", "");
var configDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "DaevaTracker");
Directory.CreateDirectory(configDir);

var data = GameData.Load(Path.Combine(AppContext.BaseDirectory, "Data"));
// opcodes.json opcional: permite corrigir opcodes após um patch do jogo sem recompilar.
var opcodesFile = Path.Combine(configDir, "opcodes.json");
var opcodes = File.Exists(opcodesFile) ? Opcodes.Load(opcodesFile) : Opcodes.Default;
var combat = new CombatOptions
{
    // Em luta de chefe, conta só o dano no chefe (adds ignorados). Lutas de mobs comuns continuam
    // registradas normalmente (contagem do bestiário). --all-damage conta tudo.
    BossDamageOnly = !args.Contains("--all-damage"),
};

using var engine = new MeterEngine(data, opcodes, new HistoryRepository(Path.Combine(configDir, "capture-history.db")), combat, new HistoryOptions());
var http = new HttpClient { BaseAddress = new Uri(url), Timeout = TimeSpan.FromSeconds(3) };
var outbox = new ConcurrentQueue<object>();
var json = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
using var petCollection = new DaevaCapture.PetCollection(outbox.Enqueue);

engine.Store.EncounterEnded += r => outbox.Enqueue(Dto(r, "end"));
// O jogo só diz o nome do seu personagem em certos momentos (teleporte, entrada em DG). Lembramos o
// último nome para identificar você já na primeira luta; o nome que o jogo informar depois o substitui.
var nameFile = Path.Combine(configDir, "local-name.txt");
try { if (File.Exists(nameFile)) engine.Store.RememberedLocalName = File.ReadAllText(nameFile).Trim(); } catch { }
engine.Store.LocalIdentityChanged += (id, name, source) =>
{
    Console.WriteLine($"Personagem local: {name} ({source})");
    if (!string.IsNullOrWhiteSpace(name) && !name.StartsWith("Player_", StringComparison.OrdinalIgnoreCase))
        try { File.WriteAllText(nameFile, name); } catch { }
};
engine.Error += ex => Console.Error.WriteLine("Erro no parser: " + ex.Message);

if (replay != "")
{
    Console.WriteLine($"Reproduzindo {replay}…");
    int n = engine.Replay(replay);
    Console.WriteLine($"{n} pacotes lidos.");
    await Flush();
    return 0;
}

if (!engine.StartLive(out var error))
{
    Console.Error.WriteLine(error);
    return 1;
}
Console.WriteLine($"Capturando. Enviando para {url}/api/live — Ctrl+C para sair.");

using var cts = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) => { e.Cancel = true; cts.Cancel(); };
long lastDamage = -1;
Guid lastId = Guid.Empty;
while (!cts.IsCancellationRequested)
{
    engine.Tick();
    var r = engine.Store.GetDisplayRecord();
    if (r is { InProgress: true } && (r.Id != lastId || r.TotalDamage != lastDamage))
    {
        outbox.Enqueue(Dto(r, "snapshot"));
        lastId = r.Id;
        lastDamage = r.TotalDamage;
    }
    await Flush();
    try { await Task.Delay(500, cts.Token); } catch (TaskCanceledException) { }
}
return 0;

async Task Flush()
{
    while (outbox.TryDequeue(out var msg))
    {
        try
        {
            using var response = await http.PostAsJsonAsync("/api/live", msg, json);
            response.EnsureSuccessStatusCode();
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Daeva Tracker offline ({ex.Message}). Abra o app.");
            break;
        }
    }
}

object Dto(EncounterRecord r, string type)
{
    var profile = engine.Store.GetLocalProfile();
    var local = r.Players.FirstOrDefault(p => p.IsLocal);
    var selfName = profile?.Name ?? local?.Name;
    if (selfName is not null && selfName.StartsWith("Player_", StringComparison.OrdinalIgnoreCase)) selfName = null;
    // Classe: do perfil do jogo ou, se faltar, deduzida das skills que você usou.
    var selfJob = profile is { Job: not JobClass.Unknown } ? profile.Job : local?.Job ?? JobClass.Unknown;
    object? self = selfName is null ? null : new { name = selfName, serverId = (int)(profile?.ServerId ?? 0), @class = ClassKey(selfJob), level = profile?.Level };
    return new
    {
        type,
        capturedAt = DateTime.UtcNow.ToString("o"),
        id = r.Id.ToString("N"),
        boss = r.Name,
        npcCode = r.NpcCode,
        isBoss = r.IsBoss,
        isDummy = r.IsTrainingDummy,
        dungeon = r.DungeonName,
        dungeonId = r.DungeonId,
        startedAt = r.StartedAt.ToString("o"),
        duration = r.DurationSeconds,
        result = r.Killed ? "kill" : "wipe",
        bossHp = new { max = r.BossMaxHp, current = r.BossCurrentHp },
        self,
        players = r.Players.Select(p => new
        {
            name = p.Name,
            @class = ClassKey(p.Job),
            isLocal = p.IsLocal,
            heal = p.Heal,
            skills = p.Skills.Select(s => new { id = s.Code, name = s.Name, hits = s.Hits, crits = s.Crits, damage = s.Damage, max = s.Max, back = s.Back, perfect = s.Perfect, @double = s.Double, parry = s.Parry, dot = s.IsDot, summon = s.IsSummon }),
        }),
        targets = r.Targets.Select(t => new { npcCode = t.NpcCode, name = t.Name, isBoss = t.IsBoss, killed = t.Killed, damage = t.DamageTaken, maxHp = t.MaxHp }),
    };
}

static string ClassKey(JobClass job) => job switch
{
    JobClass.Gladiator => "gladiator",
    JobClass.Templar => "templar",
    JobClass.Ranger => "ranger",
    JobClass.Assassin => "assassin",
    JobClass.Sorcerer => "sorcerer",
    JobClass.Cleric => "cleric",
    JobClass.Elementalist => "spiritmaster",
    JobClass.Chanter => "chanter",
    _ => "",
};
