using Aion2DpsMeter.Core.Capture;
using Aion2DpsMeter.Core.Combat;
using System.Security.Cryptography;

namespace DaevaCapture;

public sealed class LiveMovement : IDisposable
{
    readonly CaptureDispatcher dispatcher;
    readonly Func<LocalProfile?> profile;
    readonly Action<object> emit;
    string? reported;
    readonly CancellationTokenSource cancel=new();
    readonly object gate=new();
    readonly Task worker;
    MovementCrypto? decoder;
    string? flow;
    ClientMovement? position;
    int? owner;
    ushort server;
    string? name;
    long received;
    public LiveMovement(CaptureDispatcher dispatcher,Func<LocalProfile?> profile,Action<object> emit) {
        this.dispatcher=dispatcher;this.profile=profile;this.emit=emit;
        dispatcher.DaevaClientPacket+=Packet;
        worker=Task.Run(Monitor);
    }
    void Report(string state,string message) {
        if(Interlocked.Exchange(ref reported,state)==state)return;
        emit(new {type="movement-status",state,message});
    }
    async Task Monitor() {
        using var reader=new MovementKeyReader(cancel.Token);
        byte[]? current=null;int misses=0;string? lastError=null;
        while(!cancel.IsCancellationRequested) {
            try {
                int port=dispatcher.Status.Port??0;
                if(port>0) {
                    var key=reader.CurrentKey(port);
                    if(key is not null) {
                        misses=0;
                        if(current is null||!current.AsSpan().SequenceEqual(key)) {
                            var next=new MovementCrypto(key,Accept);
                            lock(gate){decoder=next;flow=null;position=null;}
                            if(current is not null)CryptographicOperations.ZeroMemory(current);
                            current=key;
                            Console.WriteLine("Direção: leitura local pronta; aguardando movimento confirmado.");
                            Report("ready","Aguardando movimento do personagem.");
                        } else CryptographicOperations.ZeroMemory(key);
                    } else {misses++;Report("waiting","Aguardando dados de movimento compatíveis com esta versão do jogo.");}
                }
            } catch(Exception e) {
                misses++;
                if(lastError!=e.Message){Console.Error.WriteLine("Direção: "+e.Message);lastError=e.Message;}
                Report("error","Não foi possível ler a direção. Desative e tente ativar como administrador.");
            }
            try{await Task.Delay(misses>0?Math.Min(60000,misses*15000):1000,cancel.Token);}catch(OperationCanceledException){}
        }
        if(current is not null)CryptographicOperations.ZeroMemory(current);
    }
    void Packet(TcpPayload packet) {
        lock(gate) {
            if(decoder is null)return;
            string incoming=packet.Device+"|"+packet.FlowKey;
            if(flow!=incoming){decoder.Reset();flow=incoming;position=null;}
            decoder.Feed(packet.Sequence,packet.Data,packet.TimestampMs);
        }
    }
    void Accept(ClientMovement movement) {
        var me=profile();var id=PositionTracker.VerifiedLocalId(me);
        if(id is null){Report("identity","Entre novamente no personagem para confirmar sua identidade.");return;}
        position=movement;owner=id;server=me!.ServerId;name=me.Name;received=Environment.TickCount64;
        Report("live","Posição e direção do personagem em tempo real.");
    }
    public (ClientMovement Position,long Age)? Get(LocalProfile? me) {
        lock(gate) {
            long age=Environment.TickCount64-received;
            if(position is not ClientMovement p||owner!=PositionTracker.VerifiedLocalId(me)||server!=me?.ServerId||name!=me?.Name||age>300000)return null;
            return(p,age);
        }
    }
    public void Dispose() {
        dispatcher.DaevaClientPacket-=Packet;cancel.Cancel();
        // Nunca interrompe nem escreve no processo observado.
        try{worker.Wait(2000);}catch{}
    }
}
