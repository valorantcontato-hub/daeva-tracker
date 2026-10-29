// Ticket, membership, mission and stock layouts adapted from SkeeveAN/Aion-DPS-Meter (MIT).
// Copyright (c) 2026 SkeeveTV; see licenses/aion-dps-meter-MIT.txt.
using System.Buffers.Binary;
using Aion2DpsMeter.Core.Combat;
using Aion2DpsMeter.Core.Protocol;

namespace DaevaCapture;

public readonly record struct ResourceTicket(uint Id, uint Count, uint Bonus, ulong Time);

public static class AccountFrames
{
    public const uint OdyleId = 60000001;
    public static uint U32(ReadOnlySpan<byte> p, ref int i) { if(i+4>p.Length)throw new FormatException();uint n=BinaryPrimitives.ReadUInt32LittleEndian(p[i..]);i+=4;return n; }
    public static ulong U64(ReadOnlySpan<byte> p, ref int i) { if(i+8>p.Length)throw new FormatException();ulong n=BinaryPrimitives.ReadUInt64LittleEndian(p[i..]);i+=8;return n; }
    public static uint Var(ReadOnlySpan<byte> p, ref int i) {
        uint n=0;for(int shift=0;shift<=28;shift+=7){if(i>=p.Length)throw new FormatException();byte b=p[i++];if(shift==28&&(b&0xf0)!=0)throw new FormatException();n|=(uint)(b&127)<<shift;if(b<128)return n;}throw new FormatException();
    }
    static ResourceTicket Entry(ReadOnlySpan<byte> p, ref int i) {
        if(i>=p.Length)throw new FormatException();byte mask=p[i++];if(mask>15)throw new FormatException();
        uint id=U32(p,ref i);ulong time=(mask&1)!=0?U64(p,ref i):0;if((mask&2)!=0)U64(p,ref i);
        uint count=(mask&4)!=0?Var(p,ref i):0,bonus=(mask&8)!=0?Var(p,ref i):0;
        if(count>10_000_000||bonus>10_000_000)throw new FormatException();return new(id,count,bonus,time);
    }
    public static List<ResourceTicket> Tickets(ReadOnlySpan<byte> p) {
        if(p.Length<3)throw new FormatException();int i=3;var entries=new List<ResourceTicket>();
        for(int n=0;n<p[2];n++)entries.Add(Entry(p,ref i));if(i!=p.Length)throw new FormatException();return entries;
    }
    public static (ResourceTicket Ticket, byte Reason) TicketChange(ReadOnlySpan<byte> p) {
        if(p.Length<4)throw new FormatException();int i=3;var ticket=Entry(p,ref i);if(i>=p.Length)throw new FormatException();byte reason=p[i++];
        if((p[2]&1)!=0)U32(p,ref i);if(i!=p.Length)throw new FormatException();return(ticket,reason);
    }
    public static long? Membership(ReadOnlySpan<byte> p) {
        if(p.Length<3||p.Length!=3+21*p[2])throw new FormatException();long until=0;
        bool known=p[2]==0;
        for(int i=0;i<p[2];i++){var entry=p.Slice(3+21*i,21);ulong end=BinaryPrimitives.ReadUInt64LittleEndian(entry[13..]);if(entry[0] is >=34 and <=42){known=true;if(end is >1_500_000_000_000 and <4_000_000_000_000)until=Math.Max(until,(long)end);}}
        return known?until:null;
    }
    public static uint Missions(ReadOnlySpan<byte> p) {
        if(p.Length<14)throw new FormatException();int i=2;uint taken=U32(p,ref i),done=U32(p,ref i);if(taken>20||done>5)throw new FormatException();return done;
    }
    public static Dictionary<uint,ulong> Currencies(ReadOnlySpan<byte> p) {
        var result=new Dictionary<uint,ulong>();var body=p[2..];
        for(int i=10;i+14<=body.Length;i++) {
            uint id=BinaryPrimitives.ReadUInt32LittleEndian(body[i..]);
            if(id is not (930100001 or 930100030 or 930100031)||body[i-10]>2||body[i+12]!=1||body[i+9]!=0||body[i+10]!=0||body[i+11]!=0)continue;
            ulong quantity=BinaryPrimitives.ReadUInt64LittleEndian(body[(i+4)..]);if(quantity>9_007_199_254_740_991)throw new FormatException();
            if(!result.TryAdd(id,body[i-10]==2?0:quantity))throw new FormatException();i+=13;
        }
        return result;
    }
    public static Dictionary<uint,uint> Conversions(ReadOnlySpan<byte> p) {
        // Protocol facts verified by A2Tools: sections of recipe/count pairs after a zero header.
        if(p.Length<7||!p.Slice(2,4).SequenceEqual(new byte[4]))throw new FormatException();int i=6;
        var result=new Dictionary<uint,uint>();
        while(i<p.Length){int count=p[i++];if(count==0)throw new FormatException();for(int n=0;n<count;n++){uint id=U32(p,ref i),used=U32(p,ref i);if(id is 0 or >99_999_999||used>10000||result.Count>=512||!result.TryAdd(id,used))throw new FormatException();}}
        return result;
    }
    public static (uint Recipe,uint Used) ConversionDone(ReadOnlySpan<byte> p) {
        var b=p[2..];if(b.Length!=41||b[0]!=0||b[1]!=0||b[2]!=1)throw new FormatException();
        int i=3;uint recipe=U32(b,ref i);i=9;if(U32(b,ref i)!=recipe)throw new FormatException();i=33;ulong total=(ulong)U32(b,ref i)+U32(b,ref i);
        if(recipe is 0 or >99_999_999||total>10000)throw new FormatException();return(recipe,(uint)total);
    }
    public static long NextReset(long timestamp,bool weekly) {
        var now=DateTimeOffset.FromUnixTimeMilliseconds(timestamp);var next=new DateTimeOffset(now.Year,now.Month,now.Day,7,0,0,TimeSpan.Zero);
        if(weekly)next=next.AddDays(((int)DayOfWeek.Wednesday-(int)now.DayOfWeek+7)%7);
        if(next<=now)next=next.AddDays(weekly?7:1);return next.ToUnixTimeMilliseconds();
    }
}

public sealed class AccountResources : IDisposable
{
    sealed class State {
        public ResourceTicket? Energy;
        public long? PremiumUntil;
        public uint? Missions;
        public long MissionReset;
        public Dictionary<uint,ulong> Currencies=new();
        public bool InventoryKnown;
        public Dictionary<uint,uint>? Conversions;
        public long ConversionReset;
        public long? NextRefill;
    }
    sealed class Flow {
        public string Id=Guid.NewGuid().ToString("N");
        public State State=new();
        public LocalProfile? Profile;
        public long IdentityAt,UpdatedAt,Revision,LoginAt;
        public bool Dirty,Bound;
    }
    readonly Dictionary<object,Flow> flows=new();
    readonly Action<object> emit;
    public AccountResources(Action<object> emit) {this.emit=emit;PacketParser.DaevaPacket+=Packet;PacketParser.DaevaBatch+=Batch;}
    public void Dispose(){PacketParser.DaevaPacket-=Packet;PacketParser.DaevaBatch-=Batch;}
    Flow Get(object key){if(!flows.TryGetValue(key,out var f)){if(flows.Count>=16)flows.Clear();flows[key]=f=new();}return f;}
    static void NewLogin(Flow f,long timestamp){f.State=new();f.Profile=null;f.Bound=false;f.Dirty=false;f.Id=Guid.NewGuid().ToString("N");f.Revision=0;f.LoginAt=timestamp;}
    void Packet(object key,ReadOnlySpan<byte> packet,long timestamp) {
        try {
            int start=0;AccountFrames.Var(packet,ref start);if(start+2>packet.Length)return;var p=packet[start..];int opcode=p[0]*256+p[1];
            if(opcode==0x2036){NewLogin(Get(key),timestamp);return;}
            if(opcode is not(0x0b61 or 0x0c61 or 0x3be3 or 0x1c8d or 0x1156 or 0x1b56 or 0x8f8d or 0x8b8d))return;
            var f=Get(key);Action<State> apply;
            if(opcode==0x0b61){var tickets=AccountFrames.Tickets(p);apply=s=>s.Energy=tickets.Where(t=>t.Id==AccountFrames.OdyleId).Select(t=>(ResourceTicket?)t).FirstOrDefault();}
            else if(opcode==0x0c61){var change=AccountFrames.TicketChange(p);if(change.Ticket.Id!=AccountFrames.OdyleId)return;apply=s=>{s.Energy=change.Ticket;if(change.Reason==2)s.NextRefill=timestamp+3*60*60*1000;};}
            else if(opcode==0x3be3){long? until=AccountFrames.Membership(p);if(until is null)return;apply=s=>s.PremiumUntil=until;}
            else if(opcode==0x1c8d){uint missions=AccountFrames.Missions(p);apply=s=>{s.Missions=missions;s.MissionReset=AccountFrames.NextReset(timestamp,false);};}
            else if(opcode==0x8f8d){var values=AccountFrames.Conversions(p);apply=s=>{s.Conversions=values;s.ConversionReset=AccountFrames.NextReset(timestamp,true);};}
            else if(opcode==0x8b8d){var value=AccountFrames.ConversionDone(p);apply=s=>{if(s.ConversionReset<=timestamp){s.Conversions=new();s.ConversionReset=AccountFrames.NextReset(timestamp,true);}s.Conversions??=new();s.Conversions[value.Recipe]=value.Used;};}
            else {if(opcode==0x1156&&p.Length<5000)return;var values=AccountFrames.Currencies(p);if(values.Count==0)return;apply=s=>{if(opcode==0x1156){s.Currencies.Clear();s.InventoryKnown=true;}foreach(var pair in values)s.Currencies[pair.Key]=pair.Value;};}
            // Login snapshots may precede the NEW character identity while the store still remembers the old one.
            if(opcode is 0x0b61 or 0x1156 && f.Profile is not null && timestamp-f.IdentityAt>2000 && timestamp-f.LoginAt>10000)NewLogin(f,timestamp);
            if(opcode==0x0b61)f.LoginAt=timestamp;
            apply(f.State);f.UpdatedAt=timestamp;f.Dirty=true;
        } catch(FormatException) { /* An incomplete or changed layout cannot replace account data. */ }
    }
    void Batch(object key,LocalProfile? profile,bool freshIdentity,long timestamp) {
        if(!flows.TryGetValue(key,out var f)){if(!freshIdentity)return;f=Get(key);}
        if(freshIdentity&&profile is {ServerId:>0,Name:not null}&&!profile.Name.StartsWith("Player_")) {
            bool changed=f.Profile is not null&&(f.Profile.ServerId!=profile.ServerId||f.Profile.Name!=profile.Name);
            if(changed || (!f.Bound&&f.UpdatedAt>0&&timestamp-f.UpdatedAt>10000)) {f.State=new();f.Dirty=false;}
            f.Profile=profile;f.IdentityAt=timestamp;f.Bound=true;
        }
        if(!f.Dirty||!f.Bound||f.Profile is null)return;f.Dirty=false;
        var s=f.State;int? max=s.PremiumUntil.HasValue?(s.PremiumUntil>timestamp?840:560):null;
        ulong? kinah=s.Currencies.TryGetValue(930100030u,out var all)?all:s.InventoryKnown?s.Currencies.GetValueOrDefault(930100001u)+s.Currencies.GetValueOrDefault(930100031u):null;
        // Separate server-wide (16) and character (4) recipes, never a shop purchase counter.
        uint? crafted=s.Conversions is not null&&s.ConversionReset>timestamp&&s.Conversions.TryGetValue(32070001,out uint server)&&server<=16&&s.Conversions.TryGetValue(32070002,out uint personal)&&personal<=4?server+personal:null;
        emit(new {type="account-state",flowId=f.Id,revision=++f.Revision,capturedAt=DateTimeOffset.FromUnixTimeMilliseconds(timestamp).ToString("o"),
            self=new{name=f.Profile.Name,serverId=(int)f.Profile.ServerId},kinah,
            odEnergy=s.Energy is ResourceTicket e?new {current=e.Count,bonus=e.Bonus,max,nextRefillAt=s.NextRefill is long next?DateTimeOffset.FromUnixTimeMilliseconds(next).ToString("o"):null,refillSeconds=10800}:null,
            dutyMissions=s.Missions is uint missions&&s.MissionReset>timestamp?new{completed=missions,max=5,resetAt=DateTimeOffset.FromUnixTimeMilliseconds(s.MissionReset).ToString("o")}:null,
            craftOdyleEnergy=crafted is uint used?new{crafted=used,max=20,resetAt=DateTimeOffset.FromUnixTimeMilliseconds(s.ConversionReset).ToString("o")}:null});
    }
}
