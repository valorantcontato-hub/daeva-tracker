using System.Text.Json;
using Aion2DpsMeter.Core.Combat;
using Aion2DpsMeter.Core.Data;
using Aion2DpsMeter.Core.Protocol;
using DaevaCapture;
using Aion2DpsMeter.Core.Capture;
using K4os.Compression.LZ4;

static void Check(bool ok, string message) { if (!ok) throw new Exception(message); }
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
clientDispatcher.ResetLock();
int observed=segments.Count;clientDispatcher.Process(Outgoing());
Check(segments.Count==observed,"reset removes client connection observation");
File.Delete(recordingFile);Directory.Delete(recordingDir);
Console.WriteLine("PASS: another player's mounted position is not self; exact reverse game flow; recording lifecycle, sequence and truncation.");
