# Idus Hamster Wheel - Windows helper (read me: it is all here, in plain text).
#
# Started by the plugin while the wheel runs (or for "Test the mouse") and ended by the plugin.
# It also ends by itself as soon as the plugin closes its input, so it never outlives it.
#   - keeps the computer awake: SetThreadExecutionState, the same Windows call PowerToys Awake uses;
#     released automatically when this process ends
#   - moves the mouse a little: SendInput with small relative moves (at most 50 px per step)
#   - shows a hamster in the system tray while it runs, with "Stop Hamster Wheel" in its menu
# Needs no admin rights, changes no settings, writes no files, opens no network connection,
# reads no keyboard or mouse input.
#
# Commands, one per line on standard input:
#   seq DX,DY,MS DX,DY,MS ...   move, then wait MS milliseconds - step by step
#   awake on | awake off        tray on | tray off        tip <tooltip text>
#   balloon <title>|<text>      quit
# Replies on standard output: ready, done (after each seq), stop (Stop chosen in the tray menu),
# error <kind> <text>

$ErrorActionPreference = "Stop"
$icon = Join-Path $PSScriptRoot "..\imgs\tray.ico"

try {
    Add-Type -ReferencedAssemblies System.Windows.Forms, System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace IdusHamsterWheel {
    public static class Helper {
        [DllImport("kernel32.dll")]
        static extern uint SetThreadExecutionState(uint flags);

        [DllImport("user32.dll", SetLastError = true)]
        static extern uint SendInput(uint count, INPUT[] inputs, int size);

        [StructLayout(LayoutKind.Sequential)]
        struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }

        [StructLayout(LayoutKind.Sequential)]
        struct INPUT { public uint type; public MOUSEINPUT mi; }

        const uint ES_CONTINUOUS = 0x80000000;
        const uint ES_SYSTEM_REQUIRED = 0x00000001;
        const uint ES_DISPLAY_REQUIRED = 0x00000002;
        const uint INPUT_MOUSE = 0;
        const uint MOUSEEVENTF_MOVE = 0x0001;

        static NotifyIcon tray;
        static Control ui;
        static readonly object outLock = new object();

        static void Say(string line) {
            lock (outLock) { Console.Out.WriteLine(line); Console.Out.Flush(); }
        }

        static int Clamp(int v, int lo, int hi) { return v < lo ? lo : (v > hi ? hi : v); }

        static void Move(int dx, int dy) {
            INPUT[] input = new INPUT[1];
            input[0].type = INPUT_MOUSE;
            input[0].mi.dx = dx;
            input[0].mi.dy = dy;
            input[0].mi.dwFlags = MOUSEEVENTF_MOVE;
            SendInput(1, input, Marshal.SizeOf(typeof(INPUT)));
        }

        static void OnUi(MethodInvoker fn) {
            try { ui.BeginInvoke(fn); } catch (Exception) { }
        }

        public static void Run(string iconPath) {
            ui = new Control();
            IntPtr handle = ui.Handle; // creates the window handle on this (UI) thread
            tray = new NotifyIcon();
            try { tray.Icon = File.Exists(iconPath) ? new Icon(iconPath) : SystemIcons.Application; }
            catch (Exception) { tray.Icon = SystemIcons.Application; }
            tray.Text = "Idus Hamster Wheel";
            ContextMenuStrip menu = new ContextMenuStrip();
            menu.Items.Add("Stop Hamster Wheel", null, delegate { Say("stop"); });
            tray.ContextMenuStrip = menu;

            Thread reader = new Thread(ReadLoop);
            reader.IsBackground = true;
            reader.Start();
            Say("ready");
            Application.Run();

            tray.Visible = false;
            tray.Dispose();
            SetThreadExecutionState(ES_CONTINUOUS); // let the computer sleep again
        }

        static void ReadLoop() {
            StreamReader input = new StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false));
            string line;
            while ((line = input.ReadLine()) != null) {
                line = line.Trim();
                if (line.Length == 0) continue;
                if (line == "quit") break;
                try { Handle(line); }
                catch (Exception e) { Say("error other " + e.Message.Replace('\r', ' ').Replace('\n', ' ')); }
            }
            OnUi(delegate { Application.ExitThread(); });
        }

        static void Handle(string line) {
            int sp = line.IndexOf(' ');
            string cmd = sp < 0 ? line : line.Substring(0, sp);
            string arg = sp < 0 ? "" : line.Substring(sp + 1);
            if (cmd == "seq") {
                foreach (string step in arg.Split(new char[] { ' ' }, StringSplitOptions.RemoveEmptyEntries)) {
                    string[] p = step.Split(',');
                    int dx, dy, ms;
                    if (p.Length != 3 || !int.TryParse(p[0], out dx) || !int.TryParse(p[1], out dy) || !int.TryParse(p[2], out ms)) continue;
                    Move(Clamp(dx, -50, 50), Clamp(dy, -50, 50));
                    if (ms > 0) Thread.Sleep(Clamp(ms, 0, 2000));
                }
                Say("done");
            } else if (cmd == "awake") {
                bool on = arg == "on";
                OnUi(delegate { SetThreadExecutionState(on ? (ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED) : ES_CONTINUOUS); });
            } else if (cmd == "tray") {
                bool show = arg == "on";
                OnUi(delegate { tray.Visible = show; });
            } else if (cmd == "tip") {
                string tip = arg.Length > 63 ? arg.Substring(0, 63) : arg;
                OnUi(delegate { tray.Text = tip.Length > 0 ? tip : "Idus Hamster Wheel"; });
            } else if (cmd == "balloon") {
                int bar = arg.IndexOf('|');
                string title = bar < 0 ? arg : arg.Substring(0, bar);
                string text = bar < 0 ? "" : arg.Substring(bar + 1);
                if (text.Trim().Length == 0) text = " ";
                OnUi(delegate { if (tray.Visible) tray.ShowBalloonTip(6000, title, text, ToolTipIcon.None); });
            }
        }
    }
}
'@
} catch {
    [Console]::Out.WriteLine("error other " + ($_.Exception.Message -split "`n")[0])
    exit 2
}

[IdusHamsterWheel.Helper]::Run($icon)
