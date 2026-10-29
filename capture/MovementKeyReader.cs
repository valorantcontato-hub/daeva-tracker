// Read-only port of the validated RC4-state locator in aion2-protocol-research.
// Copyright (c) 2026 Aion 2 Protocol Research contributors (MIT; licenses/).
using System.Buffers.Binary;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace DaevaCapture;

public sealed class MovementKeyReader : IDisposable
{
    [StructLayout(LayoutKind.Sequential)] struct Region { public ulong Base,Allocation;public uint AllocationProtect;public ushort Partition;public nuint Size;public uint State,Protect,Type; }
    [DllImport("kernel32",SetLastError=true)] static extern nint OpenProcess(uint access,bool inherit,int pid);
    [DllImport("kernel32")] static extern bool CloseHandle(nint handle);
    [DllImport("kernel32")] static extern nuint VirtualQueryEx(nint process,nint address,out Region region,nuint length);
    [DllImport("kernel32")] static extern bool ReadProcessMemory(nint process,nint address,byte[] bytes,nuint size,out nuint read);
    [DllImport("iphlpapi")] static extern uint GetExtendedTcpTable(nint table,ref int size,bool order,int family,int tableClass,uint reserved);
    nint handle;
    int pid;
    ulong vtable;
    readonly List<ulong> states=new();
    readonly CancellationToken token;
    public MovementKeyReader(CancellationToken token) {this.token=token;}
    public void Dispose(){if(handle!=0)CloseHandle(handle);handle=0;}
    byte[]? Read(ulong address,int count) {
        var bytes=new byte[count];return ReadProcessMemory(handle,(nint)address,bytes,(nuint)count,out var read)&&read==(nuint)count?bytes:null;
    }
    IEnumerable<Region> Regions(ulong start=0,ulong end=0x7fff_ffff_ffff) {
        ulong at=start;while(at<end&&!token.IsCancellationRequested&&VirtualQueryEx(handle,(nint)at,out var r,(nuint)Marshal.SizeOf<Region>())!=0) {
            ulong next=r.Base+(ulong)r.Size;if(next<=at)yield break;at=next;
            if(r.State==0x1000&&(r.Protect&0x101)==0)yield return r;
        }
    }
    static int WorldPid(int port) {
        int size=0;GetExtendedTcpTable(0,ref size,false,2,5,0);if(size<=0)return 0;
        nint table=Marshal.AllocHGlobal(size);
        try {
            if(GetExtendedTcpTable(table,ref size,false,2,5,0)!=0)return 0;
            int count=Marshal.ReadInt32(table);var matches=new HashSet<int>();
            for(int i=0;i<count;i++) {
                nint row=table+4+i*24;int remote=((Marshal.ReadByte(row,16)<<8)|Marshal.ReadByte(row,17));
                if(Marshal.ReadInt32(row)!=5||remote!=port)continue;
                int p=Marshal.ReadInt32(row,20);try {using var process=Process.GetProcessById(p);if(process.ProcessName.Equals("AION2",StringComparison.OrdinalIgnoreCase))matches.Add(p);}catch{}
            }
            return matches.Count==1?matches.First():0;
        } finally {Marshal.FreeHGlobal(table);}
    }
    byte[]? Validate(ulong address) {
        var raw=Read(address,0x124);if(raw is null||BinaryPrimitives.ReadUInt64LittleEndian(raw)!=vtable)return null;
        if(BinaryPrimitives.ReadUInt32LittleEndian(raw.AsSpan(0x18))!=214||BinaryPrimitives.ReadUInt32LittleEndian(raw.AsSpan(0x1c))>255||BinaryPrimitives.ReadUInt32LittleEndian(raw.AsSpan(0x20))>255)return null;
        Span<bool> seen=stackalloc bool[256];seen.Clear();foreach(byte b in raw.AsSpan(0x24,256)){if(seen[b])return null;seen[b]=true;}
        return Read(BinaryPrimitives.ReadUInt64LittleEndian(raw.AsSpan(0x10)),214);
    }
    static readonly int[] Pattern="B9 38 01 00 00 E8 ?? ?? ?? ?? 48 8B D8 48 85 C0 0F 84 ?? ?? ?? ?? 48 89 6C 24 30 48 8D 0D ?? ?? ?? ?? 48 89 74 24 38 33 D2 BE 01 00 00 00 41 B8 00 01 00 00 89 70 08 89 70 0C 48 8D 05 ?? ?? ?? ?? 48 89 03".Split(' ').Select(s=>s=="??"?-1:Convert.ToInt32(s,16)).ToArray();
    IEnumerable<(ulong Address,byte[] Data)> Chunks(IEnumerable<Region> regions) {
        foreach(var region in regions) for(ulong at=region.Base;at<region.Base+(ulong)region.Size&&!token.IsCancellationRequested;) {
            int size=(int)Math.Min(2*1024*1024,region.Base+(ulong)region.Size-at);
            var data=Read(at,size);if(data is not null)yield return(at,data);
            if(size<=96)break;at+=(ulong)(size-96);
        }
    }
    public byte[]? CurrentKey(int port) {
        int current=WorldPid(port);if(current==0)return null;
        if(current!=pid||handle==0) {Dispose();pid=current;handle=OpenProcess(0x410,false,pid);states.Clear();vtable=0;if(handle==0)throw new InvalidOperationException("A leitura de direção exige iniciar a captura como administrador.");}
        if(states.Count==2) {
            var a=Validate(states[0]);var b=Validate(states[1]);if(a is not null&&b is not null&&a.AsSpan().SequenceEqual(b))return a;
            states.Clear();
        }
        using var process=Process.GetProcessById(pid);var module=process.MainModule;if(module is null)return null;
        ulong begin=(ulong)module.BaseAddress,end=begin+(ulong)module.ModuleMemorySize;
        if(vtable==0) {
            var hits=new HashSet<ulong>();
            foreach(var (address,data) in Chunks(Regions(begin,end).Where(r=>(r.Protect&0xf0)!=0))) {
                for(int i=0;i<=data.Length-Pattern.Length;i++) {
                    if(data[i]!=0xb9)continue;bool match=true;for(int k=1;k<Pattern.Length;k++)if(Pattern[k]>=0&&data[i+k]!=Pattern[k]){match=false;break;}
                    if(!match)continue;ulong candidate=unchecked((ulong)((long)address+i+34+BinaryPrimitives.ReadInt32LittleEndian(data.AsSpan(i+30))));
                    var pointer=Read(candidate,8);if(pointer is not null){ulong method=BinaryPrimitives.ReadUInt64LittleEndian(pointer);if(method>=begin&&method<end)hits.Add(candidate);}
                }
            }
            if(hits.Count!=1)return null;vtable=hits.First();
        }
        var candidates=Regions().Where(r=>r.Type==0x20000&&(r.Protect&0xcc)!=0&&(ulong)r.Size<=512UL*1024*1024).OrderBy(r=>r.Size==65536?0:1).ToList();
        var groups=new Dictionary<string,List<ulong>>();var seenAddresses=new HashSet<ulong>();var pointerBytes=BitConverter.GetBytes(vtable);
        foreach(var (address,data) in Chunks(candidates)) {
            int offset=0;while(offset<=data.Length-8) {
                int found=data.AsSpan(offset).IndexOf(pointerBytes);if(found<0)break;offset+=found;
                ulong candidate=address+(ulong)offset;offset++;
                if(!seenAddresses.Add(candidate))continue;var key=Validate(candidate);if(key is null)continue;
                string group=Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(key));
                if(!groups.TryGetValue(group,out var others))groups[group]=others=new();
                if(others.Count>0){states.Add(others[0]);states.Add(candidate);return key;}
                if(others.Count<8)others.Add(candidate);
            }
        }
        return null;
    }
}
