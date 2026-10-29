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
