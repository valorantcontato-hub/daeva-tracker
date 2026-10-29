// RC4 and movement layouts confirmed against a local controlled capture.
// Protocol research: lunixxx37/aion2-protocol-research (MIT; see licenses/).
using System.Buffers.Binary;

namespace DaevaCapture;

public sealed class Rc4
{
    readonly byte[] s = Enumerable.Range(0,256).Select(i=>(byte)i).ToArray();
    int i,j;
    public Rc4(ReadOnlySpan<byte> key) {
        if(key.Length==0) throw new ArgumentException("Empty key");
        for(int n=0,k=0;n<256;n++) { k=(k+s[n]+key[n%key.Length])&255; (s[n],s[k])=(s[k],s[n]); }
    }
    public byte Next() { i=(i+1)&255;j=(j+s[i])&255;(s[i],s[j])=(s[j],s[i]);return s[(s[i]+s[j])&255]; }
}

public readonly record struct ClientMovement(float X,float Y,float Z,float Heading,long Timestamp);

public sealed class MovementCrypto
{
    const int SearchBytes=16*1024*1024;
    byte[] stream;
    Rc4 rc4;
    int offset=-1, confirmations;
    readonly List<byte> pending=new();
    uint? nextSequence;
    readonly Dictionary<uint,(byte[] Data,long Time)> held=new();
    readonly Action<ClientMovement> emit;
    long firstHeld;
    public bool Aligned => confirmations>=3;
    public MovementCrypto(byte[] key,Action<ClientMovement> emit) {
        this.emit=emit;rc4=new Rc4(key);stream=new byte[SearchBytes+65536];
        for(int n=0;n<stream.Length;n++)stream[n]=rc4.Next();
    }
    public void Reset() { pending.Clear();held.Clear();nextSequence=null;offset=-1;confirmations=0; }
    public void Feed(uint sequence,ReadOnlySpan<byte> data,long timestamp) {
        if(nextSequence is uint next) {
            int diff=unchecked((int)(sequence-next));
            if(diff>0) {
                if(held.Count==0)firstHeld=timestamp;
                held[sequence]=(data.ToArray(),timestamp);
                if(held.Count<32&&timestamp-firstHeld<500)return;
                Reset();
            } else if(diff<0) { int skip=-diff;if(skip>=data.Length)return;data=data[skip..];sequence=next; }
        }
        Append(sequence,data,timestamp);
        while(nextSequence is uint wanted&&held.Remove(wanted,out var segment))Append(wanted,segment.Data,segment.Time);
    }
    void Append(uint sequence,ReadOnlySpan<byte> data,long timestamp) {
        nextSequence=unchecked(sequence+(uint)data.Length);pending.AddRange(data.ToArray());
        if(pending.Count>65536) {pending.Clear();offset=-1;confirmations=0;return;}
        int used=0;
        while(pending.Count-used>=3) {
            if(offset<0) {
                if(pending[used]!=14) {used++;continue;}
                if(pending.Count-used<11)break;
                var cipher=pending.GetRange(used+1,10).ToArray();int match=-1;
                var time=new byte[8];
                for(int n=0;n<SearchBytes;n++) {
                    if((cipher[0]^stream[n])!=1||(cipher[1]^stream[n+1])!=0x36)continue;
                    for(int k=0;k<8;k++)time[k]=(byte)(cipher[k+2]^stream[n+k+2]);
                    long clock=BinaryPrimitives.ReadInt64LittleEndian(time);
                    if(clock>=timestamp-60000&&clock<=timestamp+60000) {if(match>=0){match=-1;break;}match=n;}
                }
                if(match<0){used++;continue;}offset=match;confirmations=0;
            }
            int header=0,length=0,shift=0;bool complete=false;
            while(header<4&&used+header<pending.Count) {
                byte b=pending[used+header++];length|=(b&127)<<shift;shift+=7;if(b<128){complete=true;break;}
            }
            if(!complete)break;
            int size=length-4;
            if(size<2||size>32768) {offset=-1;confirmations=0;used++;continue;}
            if(pending.Count-used<header+size)break;
            var plain=new byte[size];
            for(int k=0;k<size;k++) {
                if(offset==stream.Length) {int old=stream.Length;Array.Resize(ref stream,old+65536);for(int n=old;n<stream.Length;n++)stream[n]=rc4.Next();}
                byte key=stream[offset];
                plain[k]=(byte)(pending[used+header+k]^key);offset++;
            }
            used+=header+size;
            if(size==10&&plain[0]==1&&plain[1]==0x36) {
                long clock=BinaryPrimitives.ReadInt64LittleEndian(plain.AsSpan(2));
                if(clock<timestamp-60000||clock>timestamp+60000){offset=-1;confirmations=0;continue;}
                confirmations++;
            }
            if(Aligned&&TryMovement(plain,timestamp,out var movement))emit(movement);
        }
        if(used>0)pending.RemoveRange(0,used);
    }
    public static bool TryMovement(ReadOnlySpan<byte> p,long timestamp,out ClientMovement movement) {
        movement=default;
        if(p.Length is not (29 or 30)||p[1]!=0x37||p[0]>1||p[2] is not (0 or 2))return false;
        float x=BinaryPrimitives.ReadSingleLittleEndian(p[3..]),y=BinaryPrimitives.ReadSingleLittleEndian(p[7..]),z=BinaryPrimitives.ReadSingleLittleEndian(p[11..]);
        float facing=BinaryPrimitives.ReadSingleLittleEndian(p[17..]);
        long clock=BinaryPrimitives.ReadInt64LittleEndian(p[^8..]);
        if(!float.IsFinite(x)||!float.IsFinite(y)||!float.IsFinite(z)||!float.IsFinite(facing)
            ||MathF.Abs(x)>2_000_000||MathF.Abs(y)>2_000_000||MathF.Abs(z)>2_000_000||MathF.Abs(facing)>360
            ||clock<timestamp-60000||clock>timestamp+60000)return false;
        movement=new(x,y,z,((90-facing)%360+360)%360,timestamp);return true;
    }
}
