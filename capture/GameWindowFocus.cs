using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;

namespace DaevaCapture;

public readonly record struct GameFocus(bool Game, string Handle, int X = 0, int Y = 0, int W = 0, int H = 0);

/** Read-only foreground-window detection; independent of packets or character identity. */
public static class GameWindowFocus
{
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
    [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr window, out Rect rect);
    [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr window, ref Point point);
    struct Rect { public int Left, Top, Right, Bottom; }
    struct Point { public int X, Y; }
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
        string handle = window.ToInt64().ToString(CultureInfo.InvariantCulture);
        // Área do jogo na tela (em pixels): os marcadores da loja se alinham a ela.
        if (game && GetClientRect(window, out var rect) && rect.Right > 0) { var origin = new Point(); if (ClientToScreen(window, ref origin)) return new(true, handle, origin.X, origin.Y, rect.Right, rect.Bottom); }
        return new(game, handle);
    }
}
