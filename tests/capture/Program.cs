using System.Text.Json;
using Aion2DpsMeter.Core.Combat;
using Aion2DpsMeter.Core.Data;
using Aion2DpsMeter.Core.Protocol;
using DaevaCapture;
using Aion2DpsMeter.Core.Capture;
using K4os.Compression.LZ4;

if(args.Length>=2&&args[0]=="--native-elevation-echo") {
    File.WriteAllText(args[1],JsonSerializer.Serialize(args.Skip(2).ToArray()));return;
}

static void Check(bool ok, string message) { if (!ok) throw new Exception(message); }
Check(GameWindowFocus.IsGameProcessName("AION2") && GameWindowFocus.IsGameProcessName("aion2"), "game process names");
Check(!GameWindowFocus.IsGameProcessName("chrome") && !GameWindowFocus.IsGameProcessName("Lotus Tracker"), "other applications are not the game");
_ = GameWindowFocus.Read(); // Native read must work even when another application is in front.
static byte[] Var(int value) { var b=new List<byte>();do{byte n=(byte)(value&127);value>>=7;b.Add((byte)(n|(value>0?128:0)));}while(value>0);return b.ToArray(); }
static byte[] Frame(byte op, byte[] payload) => [..Var(payload.Length+6),op,0x90,..payload];
static byte[] U(params uint[] values) => values.SelectMany(BitConverter.GetBytes).ToArray();
byte[] state=[..U(0),1,..U(1001,1001,3),1,..U(1002,4)];
var decoded=PetCollection.DecodeState(state);
Check(decoded.Levels[1001]==3 && decoded.Points[1002]==4,"state decoding");
PetCollection.Gain(decoded,1002,1);Check(decoded.Levels[1002]==1 && decoded.Points[1002]==0,"5 souls -> level I");
PetCollection.Gain(decoded,1002,100);Check(decoded.Levels[1002]==3 && decoded.Points[1002]==0,"25 + 75 souls -> III");
try { PetCollection.DecodeState(state[..^1]); throw new Exception("truncated frame accepted"); } catch(FormatException) {}
var messages=new List<JsonElement>();
using var reader=new PetCollection(msg=>messages.Add(JsonSerializer.SerializeToElement(msg)));
var store=new CombatStore(GameData.Empty);
var a=new PacketParser(store,GameData.Empty);var b=new PacketParser(store,GameData.Empty);
string name="Alpha";
void Identity(object flow,ReadOnlySpan<byte> packet,long timestamp) {
    if(packet.Length==3 && packet[1]==99) store.NoteSelfProfile(100,name,JobClass.Sorcerer,45,2401);
}
PacketParser.DaevaPacket+=Identity;
void Send(PacketParser parser,byte[] packet,long timestamp) {parser.CurrentTimestampMs=timestamp;Check(parser.ConsumeStream(packet)==packet.Length,"frame consumed");}
Send(a,Frame(0,state),1000);Check(messages.Count==0,"unidentified state must stay pending");
Send(b,[6,99,99],1100);Check(messages.Count==0,"identity from another flow must not bind pending state");
Send(a,[6,99,99],1200);Check(messages.Count==1 && messages[0].GetProperty("self").GetProperty("name").GetString()=="Alpha","same-flow fresh identity binds state");
Send(a,Frame(13,[1,..U(1002,1)]),1300);Check(messages[^1].GetProperty("levels").GetProperty("1002").GetUInt32()==1,"gain advances level");
name="Beta";Send(a,Frame(0,[..U(0),1,..U(1001,1001,1),0]),2000);
Check(messages.Count==2,"new login state must not inherit old owner");
Send(a,[6,99,99],2100);Check(messages[^1].GetProperty("self").GetProperty("name").GetString()=="Beta","new character gets own state");
Check(messages[^1].GetProperty("levels").GetProperty("1001").GetUInt32()==1,"old complete flag replaced by new character state");
PacketParser.DaevaPacket-=Identity;
// A login collection arrives before the combat signature lock, sometimes compressed
// and across TCP segments. Its continuation must not be discarded by the dispatcher.
PacketParser.DaevaPacket+=Identity;
var dispatcher=new CaptureDispatcher(store,GameData.Empty,Opcodes.Default) {RequireGameProcess=false};
byte[] inner=[..Frame(0,state),6,99,99];
var compressed=new byte[LZ4Codec.MaximumOutputSize(inner.Length)];
int size=LZ4Codec.Encode(inner,compressed);
byte[] bundle=[..Var(size+10),255,255,..U((uint)inner.Length),..compressed[..size]];
int prior=messages.Count;
void Segment(byte[] bytes,uint sequence,long time) => dispatcher.Process(new TcpPayload {Device="test",IsLoopbackDevice=false,SrcIp="127.0.0.2",DstIp="127.0.0.1",SrcPort=7000,DstPort=8000,Sequence=sequence,Data=bytes,TimestampMs=time});
Segment(bundle[..9],100,3000);Segment(bundle[9..],109,3001);
Check(messages.Count==prior+1,"compressed login state before combat lock, across TCP segments");
Segment(bundle,100,3002);Check(messages.Count==prior+1,"TCP retransmission must not apply twice");
PacketParser.DaevaPacket-=Identity;
Console.WriteLine("PASS: decode, truncated payload, soul thresholds, decoded frame hook, gains, flow isolation, character switch.");

// Regressão da gravação de 29/10: o 2a38 abaixo era de outro jogador, não do personagem local.
using var positions = new PositionTracker();
Send(a,Convert.FromHexString("2F2A38916401116B12270000881300000000000000EA2F87A101000091640100A00E8CC778E48BC700040E46"),4000);
Check(positions.Get(12817,10000) is not null,"mounted entity position decoded");
Check(PositionTracker.VerifiedLocalId(null) is null,"mounted entity must not become self");
Check(PositionTracker.VerifiedLocalId(new(12817,"Player_12817",JobClass.Unknown,null,2401)) is null,"placeholder must not become self");
Check(PositionTracker.VerifiedLocalId(new(777,"Alpha",JobClass.Sorcerer,45,0)) is null,"serverless guess must not become verified self");
Check(PositionTracker.VerifiedLocalId(new(777,"Alpha",JobClass.Sorcerer,45,2401)) == 777,"named local profile authorizes own entity");

// O observador do cliente aceita apenas a tupla reversa da conexão travada e nunca passa os comandos ao parser.
var clientStore = new CombatStore(GameData.Empty);
var clientDispatcher = new CaptureDispatcher(clientStore,GameData.Empty,Opcodes.Default) { RequireGameProcess=false };
var segments = new List<TcpPayload>();
clientDispatcher.DaevaClientPacket += segments.Add;
byte[] heartbeat = Convert.FromHexString("0E0036A2D52E87A1010000");
for(int n=0;n<12;n++) clientDispatcher.Process(new TcpPayload { Device="test",IsLoopbackDevice=true,SrcIp="127.0.0.2",DstIp="127.0.0.1",SrcPort=7000,DstPort=8000,Sequence=(uint)(100+n*heartbeat.Length),Data=heartbeat,TimestampMs=5000+n*100 });
Check(clientDispatcher.Status.State == CaptureState.Locked,"game connection locked for client recording test");
TcpPayload Outgoing(string source="127.0.0.1",string device="test",byte[]? bytes=null) => new() { Device=device,IsLoopbackDevice=true,SrcIp=source,DstIp="127.0.0.2",SrcPort=8000,DstPort=7000,Sequence=900,Data=bytes ?? [1,2,3],TimestampMs=6500 };
clientDispatcher.Process(Outgoing("127.0.0.3"));
clientDispatcher.Process(Outgoing(device:"other"));
Check(segments.Count==0,"other connection or device not observed");
var recordingDir=System.IO.Path.Combine(System.IO.Path.GetTempPath(),"lotus-capture-test-"+Guid.NewGuid().ToString("N"));
string recordingFile;
using(var packetRecorder = new DaevaCapture.PacketRecorder(clientDispatcher)) {
  clientDispatcher.Process(Outgoing());
  recordingFile=packetRecorder.Start(recordingDir,120);
  clientDispatcher.Process(Outgoing(bytes:Enumerable.Repeat((byte)0xab,5000).ToArray()));
  packetRecorder.Stop();
  clientDispatcher.Process(Outgoing());
}
var recorded=File.ReadLines(recordingFile).Select(l=>JsonSerializer.Deserialize<JsonElement>(l)).ToList();
var clientRows=recorded.Where(r=>r.TryGetProperty("type",out var t)&&t.GetString()=="client-segment").ToList();
Check(clientRows.Count==1,"client segments recorded only while requested recording active");
Check(clientRows[0].GetProperty("seq").GetUInt32()==900 && clientRows[0].GetProperty("len").GetInt32()==5000,"client TCP metadata retained");
Check(clientRows[0].GetProperty("truncated").GetBoolean() && clientRows[0].GetProperty("hex").GetString()!.Length==8192,"bounded sample explicitly marks truncation");
// Uma conexão nova, confirmada por pacotes do jogo, substitui a porta antiga após relogin.
clientDispatcher.Process(new TcpPayload { Device="test",IsLoopbackDevice=true,SrcIp="127.0.0.2",DstIp="127.0.0.1",SrcPort=7000,DstPort=8100,Sequence=1000,Data=heartbeat,TimestampMs=6600 });
int beforeReconnect=segments.Count;
clientDispatcher.Process(Outgoing());
Check(segments.Count==beforeReconnect,"old client flow ignored after reconnect");
clientDispatcher.Process(new TcpPayload { Device="test",IsLoopbackDevice=true,SrcIp="127.0.0.1",DstIp="127.0.0.2",SrcPort=8100,DstPort=7000,Sequence=2000,Data=[4,5,6],TimestampMs=6700 });
Check(segments.Count==beforeReconnect+1,"new reverse game flow observed after reconnect");
clientDispatcher.ResetLock();
int observed=segments.Count;clientDispatcher.Process(Outgoing());
Check(segments.Count==observed,"reset removes client connection observation");
File.Delete(recordingFile);Directory.Delete(recordingDir);
Console.WriteLine("PASS: another player's mounted position is not self; exact reverse game flow; recording lifecycle, sequence and truncation.");

var vector=new Rc4(System.Text.Encoding.ASCII.GetBytes("Key"));
Check(Convert.ToHexString(System.Text.Encoding.ASCII.GetBytes("Plaintext").Select(b=>(byte)(b^vector.Next())).ToArray())=="BBF316E8D940AF0AD3","published RC4 known-answer vector");
long clock=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
byte[] MovementBody(int length=30,float facing=45) {
    var p=new byte[length];p[0]=1;p[1]=0x37;p[2]=(byte)(length==30?2:0);
    BitConverter.GetBytes(1000f).CopyTo(p,3);BitConverter.GetBytes(2000f).CopyTo(p,7);BitConverter.GetBytes(3000f).CopyTo(p,11);
    BitConverter.GetBytes(facing).CopyTo(p,17);BitConverter.GetBytes(clock).CopyTo(p,length-8);return p;
}
Check(MovementCrypto.TryMovement(MovementBody(),clock,out var direct)&&direct.Heading==45&&direct.X==1000,"independent character-facing field decoded");
Check(MovementCrypto.TryMovement(MovementBody(29,-90),clock,out direct)&&direct.Heading==180,"stop form keeps explicit facing");
foreach(var (facing,expected) in new(float,float)[]{(0,90),(90,0),(-90,180),(180,270)})
    Check(MovementCrypto.TryMovement(MovementBody(30,facing),clock,out direct)&&direct.Heading==expected,"facing converts world X/Y to radar north");
Check(!MovementCrypto.TryMovement(MovementBody(30,float.NaN),clock,out _),"invalid facing rejected");
Check(!MovementCrypto.TryMovement(MovementBody(),clock+1000000,out _),"stale or wrong-stream movement rejected");
var testKey=Enumerable.Range(0,214).Select(i=>(byte)i).ToArray();var cipher=new Rc4(testKey);
for(int n=0;n<517;n++)cipher.Next();
byte[] CryptFrame(byte[] plain) => [..Var(plain.Length+4),..plain.Select(b=>(byte)(b^cipher.Next()))];
byte[] timeBody=[1,0x36,..BitConverter.GetBytes(clock)];
byte[] wire=[..CryptFrame(timeBody),..CryptFrame(timeBody),..CryptFrame(timeBody),..CryptFrame(MovementBody())];
var moves=new List<ClientMovement>();var movementDecoder=new MovementCrypto(testKey,moves.Add);
movementDecoder.Feed(100,wire.AsSpan(0,5),clock);
movementDecoder.Feed(115,wire.AsSpan(15),clock+1);
movementDecoder.Feed(105,wire.AsSpan(5,10),clock+2);
movementDecoder.Feed(100,wire.AsSpan(0,5),clock+3);
Check(moves.Count==1&&moves[0].Heading==45,"midstream cipher alignment, split/out-of-order TCP and retransmission");
Console.WriteLine("PASS: RC4 vector, facing/stop layouts, invalid inputs and continuous midstream movement across TCP segments.");

var elevation=NativeElevation.StartInfo("C:\\Lotus Tracker\\capture.exe",["--launch-elevated","--read-movement","--stop-file","C:\\Meu Perfil\\arquivo 'teste'.stop"]);
Check(elevation.FileName=="C:\\Lotus Tracker\\capture.exe"&&elevation.UseShellExecute&&elevation.Verb=="runas","native Windows elevation");
Check(elevation.ArgumentList.SequenceEqual(new[]{"--read-movement","--stop-file","C:\\Meu Perfil\\arquivo 'teste'.stop"}),"native launcher preserves arguments with spaces and drops recursive launch flag");
Console.WriteLine("PASS: native elevation preserves exact arguments without a script shell.");

byte[] resourceList=[0x0b,0x61,1,12,..U(AccountFrames.OdyleId),..Var(435),..Var(125)];
Check(AccountFrames.Tickets(resourceList).Single() is {Count:435,Bonus:125},"resource ticket base and charged energy");
try{AccountFrames.Tickets(resourceList[..^1]);throw new Exception("truncated resource list accepted");}catch(FormatException){}
byte[] currency=[0x1b,0x56,..new byte[10],..U(930100031),..BitConverter.GetBytes(36000UL),1,7];
Check(AccountFrames.Currencies(currency)[930100031]==36000,"Kinah stock anchor reads exact balance");
Check(AccountFrames.Missions([0x1c,0x8d,..U(0,0,0)])==0,"zero duty missions is known, not missing");
long resourceTime=1_800_000_000_000;
byte[] membership=[0x3b,0xe3,1,34,..new byte[12],..BitConverter.GetBytes((ulong)(resourceTime+86_400_000))];
Check(AccountFrames.Membership(membership)==resourceTime+86_400_000,"premium end read from membership effect");
byte[] lootMembership=[..membership];lootMembership[3]=44;
Check(AccountFrames.Membership(lootMembership) is null,"auto-loot-only update does not cancel premium capacity");
var accountMessages=new List<JsonElement>();
using var resourceReader=new AccountResources(msg=>accountMessages.Add(JsonSerializer.SerializeToElement(msg)));
var resourceStore=new CombatStore(GameData.Empty);var resourceA=new PacketParser(resourceStore,GameData.Empty);var resourceB=new PacketParser(resourceStore,GameData.Empty);
string resourceName="ResourceAlpha";
void ResourceIdentity(object flow,ReadOnlySpan<byte> p,long timestamp){if(p.Length==3&&p[1]==99&&p[2]==98)resourceStore.NoteSelfProfile(100,resourceName,JobClass.Sorcerer,45,2401);}
byte[] ResourcePacket(byte[] p)=>[..Var(p.Length+4),..p];
PacketParser.DaevaPacket+=ResourceIdentity;
Send(resourceA,ResourcePacket(resourceList),resourceTime);
Send(resourceB,[6,99,98],resourceTime+100);
Check(accountMessages.Count==0,"resource identity on another flow cannot bind account values");
Send(resourceA,[6,99,98],resourceTime+200);
Check(accountMessages.Count==1&&accountMessages[^1].GetProperty("odEnergy").GetProperty("current").GetInt32()==435,"same-flow self identity binds resource state");
Send(resourceA,ResourcePacket(membership),resourceTime+300);
Check(accountMessages[^1].GetProperty("odEnergy").GetProperty("max").GetInt32()==840,"premium capacity follows current character");
Send(resourceA,ResourcePacket([0x1c,0x8d,..U(0,0,0)]),resourceTime+400);
Check(accountMessages[^1].GetProperty("dutyMissions").GetProperty("completed").GetInt32()==0,"known zero missions is emitted");
byte[] fullInventory=[..currency,..new byte[5000-currency.Length]];fullInventory[0]=0x11;
Send(resourceA,ResourcePacket(fullInventory),resourceTime+500);
Check(accountMessages[^1].GetProperty("kinah").GetUInt64()==36000,"full own inventory binds the current Kinah balance");
byte[] conversionWindow=[0x8f,0x8d,0,0,0,0,1,..U(32070001,3),1,..U(32070002,1)];
Check(AccountFrames.Conversions(conversionWindow).Count==2,"conversion list handles multiple sections");
Send(resourceA,ResourcePacket(conversionWindow),resourceTime+600);
Check(accountMessages[^1].GetProperty("craftOdyleEnergy").GetProperty("crafted").GetInt32()==4,"weekly craft sums 3/16 server plus 1/4 character");
byte[] craftBody=new byte[41];craftBody[2]=1;BitConverter.GetBytes(32070002u).CopyTo(craftBody,3);BitConverter.GetBytes(32070002u).CopyTo(craftBody,9);BitConverter.GetBytes(2u).CopyTo(craftBody,37);
Send(resourceA,ResourcePacket([0x8b,0x8d,..craftBody]),resourceTime+700);
Check(accountMessages[^1].GetProperty("craftOdyleEnergy").GetProperty("crafted").GetInt32()==5,"craft success replaces current recipe counter rather than adding its total");
resourceName="ResourceBeta";
Send(resourceA,ResourcePacket([0x0b,0x61,1,4,..U(AccountFrames.OdyleId),..Var(50)]),resourceTime+20000);
int beforeResourceIdentity=accountMessages.Count;
Send(resourceA,[6,99,98],resourceTime+20100);
Check(accountMessages.Count==beforeResourceIdentity+1&&accountMessages[^1].GetProperty("self").GetProperty("name").GetString()==resourceName,"new character receives only its own pending resources");
Check(accountMessages[^1].GetProperty("dutyMissions").ValueKind==JsonValueKind.Null,"missions from old character are not inherited");
Send(resourceA,ResourcePacket([0x3b,0xe3,0]),resourceTime+20200);
Check(accountMessages[^1].GetProperty("odEnergy").GetProperty("max").GetInt32()==560,"non-premium capacity follows new character");
PacketParser.DaevaPacket-=ResourceIdentity;
Console.WriteLine("PASS: account energy/bonus, premium capacity, Kinah anchors, zero missions, truncation and character/flow isolation.");

if(args.Length==2&&args[0]=="--verify-native-elevation") {
    string echo=System.IO.Path.Combine(System.IO.Path.GetTempPath(),"lotus-native-launch-"+Guid.NewGuid().ToString("N")+".json");
    string[] expected=["C:\\Meu Perfil\\arquivo 'teste'.stop","direção e posição"];
    var start=NativeElevation.StartInfo(args[1],[System.Reflection.Assembly.GetExecutingAssembly().Location,"--launch-elevated","--native-elevation-echo",echo,..expected]);
    using var child=System.Diagnostics.Process.Start(start);
    Check(child is not null&&child.WaitForExit(30000)&&child.ExitCode==0,"native launcher must start and finish through Windows runas");
    Check(JsonSerializer.Deserialize<string[]>(File.ReadAllText(echo))!.SequenceEqual(expected),"real elevated process receives exact Unicode and spaced arguments");
    File.Delete(echo);Console.WriteLine("PASS: Windows native elevation executed successfully with exact arguments.");
}

// Optional local investigation: neither captures nor keys are embedded in the repository or CI.
if(args.Length==3&&args[0]=="--local-replay") {
    var key=File.ReadAllBytes(args[2]);var replayMoves=new List<ClientMovement>();var replayDecoder=new MovementCrypto(key,replayMoves.Add);
    foreach(var line in File.ReadLines(args[1])) {
        var row=JsonSerializer.Deserialize<JsonElement>(line);
        if(!row.TryGetProperty("type",out var type)||type.GetString()!="client-segment")continue;
        Check(!row.GetProperty("truncated").GetBoolean(),"local recording truncated");
        replayDecoder.Feed(row.GetProperty("seq").GetUInt32(),Convert.FromHexString(row.GetProperty("hex").GetString()!),row.GetProperty("t").GetInt64());
    }
    Check(replayMoves.Count==753,"local independent decoder agrees on all 753 real updates");
    Console.WriteLine("PASS: 753 real movement updates independently decoded by C#.");
}
if(args.Length==2&&args[0]=="--probe-live-key") {
    using var sourceReader=new MovementKeyReader(CancellationToken.None);var liveKey=sourceReader.CurrentKey(13328);
    Console.WriteLine("Native locator found a pair: "+(liveKey is not null));
    Check(liveKey is not null&&liveKey.AsSpan().SequenceEqual(File.ReadAllBytes(args[1])),"native locator must match independently validated local session key");
    Console.WriteLine("PASS: native read-only locator matches independent local key.");
}
