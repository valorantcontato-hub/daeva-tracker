using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;

namespace DaevaCapture;

public readonly record struct GameFocus(bool Game, string Handle);

/** Read-only foreground-window detection; independent of packets or character identity. */
public static class GameWindowFocus
{
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
    static uint previousPid;
    static long checkedAt;
    static bool game;
    public static bool IsGameProcessName(string name) => string.Equals(name, "AION2", StringComparison.OrdinalIgnoreCase);
    public static GameFocus Read()
    {
        if (!OperatingSystem.IsWindows()) return new(false, "0");
        var window = GetForegroundWindow();
        GetWindowThreadProcessId(window, out uint pid);
        long now = Environment.TickCount64;
        if (pid != previousPid || now - checkedAt > 1000) {
            previousPid = pid; checkedAt = now; game = false;
            try { using var process = Process.GetProcessById((int)pid); game = IsGameProcessName(process.ProcessName); }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException or System.ComponentModel.Win32Exception) { }
        }
        return new(game, window.ToInt64().ToString(CultureInfo.InvariantCulture));
    }
}
