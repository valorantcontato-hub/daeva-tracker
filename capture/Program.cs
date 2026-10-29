// daeva-capture: lê o tráfego do AION 2 de forma passiva (Npcap) usando o motor do
// Aion2DpsMeter e envia a luta ao vivo para o Lotus Tracker (POST /api/live).
//
//   daeva-capture [--url http://localhost:47173] [--all-damage] [--replay arquivo.pcap] [--record segundos]
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
using var recorder = new DaevaCapture.PacketRecorder();
using var tracker = new DaevaCapture.PositionTracker();
long lastPositions = 0;
string lastIdentity = "";
var recordDir = Path.Combine(configDir, "recordings");
var recordTrigger = Path.Combine(configDir, "record.start");
var recordStatus = Path.Combine(configDir, "record.status");
void StartRecording(int seconds)
{
    var file = recorder.Start(recordDir, seconds);
    Console.WriteLine($"Gravando pacotes por {seconds}s em {file}");
    try { File.WriteAllText(recordStatus, JsonSerializer.Serialize(new { state = "recording", file, seconds, endsAt = DateTime.UtcNow.AddSeconds(seconds).ToString("o") })); } catch { }
}
string lastSelfNote = "";
void NoteSelf()
{
    if (!recorder.Active) { lastSelfNote = ""; return; }
    var prof = engine.Store.GetLocalProfile();
    var line = JsonSerializer.Serialize(new { type = "self", at = DateTime.Now.ToString("o"), entityId = prof?.EntityId, name = prof?.Name, serverId = (int)(prof?.ServerId ?? 0), level = prof?.Level });
    if (line == lastSelfNote) return;
    lastSelfNote = line;
    recorder.Note(line);
}
void PollRecording()
{
    NoteSelf();
    try
    {
        if (!recorder.Active && File.Exists(recordTrigger))
        {
            int.TryParse(File.ReadAllText(recordTrigger).Trim(), out var secs);
            File.Delete(recordTrigger);
            StartRecording(Math.Clamp(secs == 0 ? 300 : secs, 10, 900));
        }
        if (recorder.Tick())
        {
            Console.WriteLine("Gravação concluída.");
            File.WriteAllText(recordStatus, JsonSerializer.Serialize(new { state = "done", file = recorder.Path }));
        }
    }
    catch (Exception ex) { Console.Error.WriteLine("Gravação: " + ex.Message); }
}
if (int.TryParse(Arg("--record", ""), out var recordSeconds)) StartRecording(Math.Clamp(recordSeconds, 10, 900));

engine.Store.EncounterEnded += r => outbox.Enqueue(Dto(r, "end"));
// O jogo só diz o nome do seu personagem em certos momentos (teleporte, entrada em DG). Lembramos o
// último nome para identificar você já na primeira luta; o nome que o jogo informar depois o substitui.
var nameFile = Path.Combine(configDir, "local-name.txt");
try { if (File.Exists(nameFile)) engine.Store.RememberedLocalName = File.ReadAllText(nameFile).Trim(); } catch { }
engine.Store.LocalIdentityChanged += (id, name, source) =>
{
    Console.WriteLine($"Personagem local: {name} ({source})");
    if (!string.IsNullOrWhiteSpace(name) && !name.StartsWith("Player_", StringComparison.OrdinalIgnoreCase))
    {
        try { File.WriteAllText(nameFile, name); } catch { }
    }
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
    PollRecording();
    AnnounceIdentity();
    SendPositions();
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

// Avisa o app quando o jogo informa o personagem (teleporte/relogin), já com servidor, classe e nível:
// sem o servidor o nome é ambíguo (existe em vários servidores) e o app não consegue vincular.
void AnnounceIdentity()
{
    var prof = engine.Store.GetLocalProfile();
    var name = prof?.Name;
    if (prof is not { ServerId: > 0 } || string.IsNullOrWhiteSpace(name) || name.StartsWith("Player_", StringComparison.OrdinalIgnoreCase)) return;
    var cls = prof.Job != JobClass.Unknown ? ClassKey(prof.Job) : "";
    var key = $"{prof.ServerId}|{name}|{cls}|{prof.Level}";
    if (key == lastIdentity) return;
    lastIdentity = key;
    outbox.Enqueue(new { type = "identity", capturedAt = DateTime.UtcNow.ToString("o"), self = new { name, serverId = (int)prof.ServerId, @class = cls, level = prof.Level } });
}

// Posições (a cada ~1 s): a sua e a dos monstros à vista, para o widget de mini mapa.
void SendPositions()
{
    long now = Environment.TickCount64;
    if (now - lastPositions < 1000) return;
    lastPositions = now;
    var seen = tracker.Snapshot(8000);
    if (seen.Count == 0) return;
    int? meId = engine.Store.GetLocalProfile()?.EntityId;
    object? self = null;
    var mobs = new List<object>();
    foreach (var (id, pos) in seen)
    {
        if (id == meId) { self = new { x = pos.X, y = pos.Y, z = pos.Z }; continue; }
        if (engine.Store.GetMobCode(id) is not int code) continue;
        mobs.Add(new { id, npcCode = code, name = data.Npc(code)?.Name ?? "", x = pos.X, y = pos.Y, z = pos.Z });
    }
    outbox.Enqueue(new { type = "positions", capturedAt = DateTime.UtcNow.ToString("o"), selfId = meId, self, entities = seen.Count, mobs = mobs.Take(400) });
}

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
            Console.Error.WriteLine($"Lotus Tracker offline ({ex.Message}). Abra o app.");
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
