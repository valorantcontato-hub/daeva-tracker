using System.ComponentModel;
using System.Diagnostics;

namespace DaevaCapture;

public static class NativeElevation
{
    public static ProcessStartInfo StartInfo(string executable,IEnumerable<string> args) {
        var start=new ProcessStartInfo(executable) { UseShellExecute=true,Verb="runas",WindowStyle=ProcessWindowStyle.Hidden };
        foreach(string argument in args)if(argument!="--launch-elevated")start.ArgumentList.Add(argument);
        return start;
    }
    public static int Run(string[] args) {
        try {
            using var child=Process.Start(StartInfo(Environment.ProcessPath??throw new InvalidOperationException("Executável da captura não encontrado."),args));
            if(child is null)return 1;
            child.WaitForExit();return child.ExitCode;
        } catch(Win32Exception error) when(error.NativeErrorCode==1223) { return 1223; }
        catch(Exception error) { Console.Error.WriteLine("Não foi possível ativar o movimento: "+error.Message);return 1; }
    }
}
