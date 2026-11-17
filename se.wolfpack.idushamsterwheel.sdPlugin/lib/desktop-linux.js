// The desktop side of the wheel on Linux: keep the computer awake, move the mouse, show a
// notification. Everything is a child process that ends with the plugin — nothing is left running
// or changed. Windows: desktop-win.js (same interface).
"use strict";

const { spawn, execFile, execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const APP = "Idus Hamster Wheel";
const MOVER = path.join(__dirname, "mover.py");
const ICON = path.join(__dirname, "..", "imgs", "plugin@2x.png");

function which(cmd) {
  for (const dir of (process.env.PATH || "/usr/local/bin:/usr/bin:/bin").split(":")) {
    const p = path.join(dir, cmd);
    try { fs.accessSync(p, fs.constants.X_OK); return p; } catch { /* next */ }
  }
  return null;
}

// ---- Stay awake ------------------------------------------------------------------------------
// KDE: kde-inhibit blocks power management and the screen saver; elsewhere systemd-inhibit blocks
// idle and sleep. The command they hold is `tail --pid=<plugin>`, so the block ends with the plugin
// even if it is killed.
const inhibit = {
  proc: null,
  tool: "",
  get active() { return !!this.proc; },
  available() { return which("kde-inhibit") ? "kde-inhibit" : which("systemd-inhibit") ? "systemd-inhibit" : ""; },
  start() {
    if (this.proc) return this.tool;
    const hold = ["tail", `--pid=${process.pid}`, "-f", "/dev/null"];
    const tool = this.available();
    if (!tool) { this.tool = ""; return ""; }
    const args = tool === "kde-inhibit"
      ? ["--power", "--screenSaver", ...hold]
      : ["--what=idle:sleep", `--who=${APP}`, "--why=Keeping the computer awake (BRB)", "--mode=block", ...hold];
    try {
      this.proc = spawn(tool, args, { stdio: "ignore", detached: true });
    } catch { this.proc = null; this.tool = ""; return ""; }
    this.tool = tool;
    const p = this.proc;
    p.on("error", () => { if (this.proc === p) { this.proc = null; this.tool = ""; } });
    p.on("exit", () => { if (this.proc === p) this.proc = null; });
    return tool;
  },
  stop() {
    const p = this.proc;
    this.proc = null;
    if (!p) return;
    try { process.kill(-p.pid, "SIGTERM"); } catch { try { p.kill("SIGTERM"); } catch { /* gone */ } }
  },
};

// ---- Mouse mover (lib/mover.py through python3) ---------------------------------------------
// start(onState): onState("ready") or onState("error", kind, text); kind: access | missing | python | other
class Mover {
  constructor() { this.proc = null; this.ready = false; this.pending = null; this.onState = null; this.onDone = null; }
  get running() { return !!this.proc; }
  start(onState) {
    this.onState = onState;
    if (this.proc) { if (this.ready) onState("ready"); return; }
    this.ready = false;
    let p;
    try { p = spawn("python3", ["-I", MOVER], { stdio: ["pipe", "pipe", "pipe"], env: process.env }); }
    catch (e) { onState("error", "python", "python3 is missing"); return; }
    this.proc = p;
    let buf = "", said = false;
    p.stdout.on("data", (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (line === "ready") {
          said = true; this.ready = true; this.onState && this.onState("ready");
          if (this.pending) { const s = this.pending; this.pending = null; this.send(s); }
        } else if (line === "done") {
          const fn = this.onDone; this.onDone = null; fn && fn();
        } else if (line.startsWith("error ")) {
          said = true;
          const [, kind, ...rest] = line.split(" ");
          this.onState && this.onState("error", kind, rest.join(" "));
        }
      }
    });
    p.stderr.on("data", () => {});
    p.stdin.on("error", () => {});
    p.on("error", (e) => {
      if (this.proc === p) { this.proc = null; this.ready = false; }
      if (!said) { said = true; this.onState && this.onState("error", e.code === "ENOENT" ? "python" : "other", e.code === "ENOENT" ? "python3 is missing" : String(e.message)); }
    });
    p.on("exit", (code) => {
      if (this.proc === p) { this.proc = null; this.ready = false; }
      if (!said && code) { said = true; this.onState && this.onState("error", "other", `mover stopped (${code})`); }
    });
  }
  // steps: [[dx, dy, waitMs], ...]
  send(steps, onDone) {
    if (!this.proc) return false;
    if (onDone) this.onDone = onDone;
    if (!this.ready) { this.pending = steps; return true; }
    try { this.proc.stdin.write("seq " + steps.map((s) => s.map((v) => Math.round(v)).join(",")).join(" ") + "\n"); } catch { return false; }
    return true;
  }
  stop() {
    const p = this.proc;
    this.proc = null; this.ready = false; this.pending = null; this.onState = null;
    if (!p) return;
    try { p.stdin.write("quit\n"); p.stdin.end(); } catch { /* closed */ }
    setTimeout(() => { try { p.kill("SIGTERM"); } catch { /* gone */ } }, 1500).unref();
  }
}

// ---- Notification (freedesktop, through gdbus — part of glib2, on every desktop) ------------
// A notification that stays while the wheel runs, with a Stop button.
const DBUS = ["--session", "--dest", "org.freedesktop.Notifications", "--object-path", "/org/freedesktop/Notifications"];
const gv = (s) => "'" + String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
const notify = {
  id: 0,
  mon: null,
  onStop: null,
  available() { return !!which("gdbus"); },
  // timeout 0 = stays until closed; replaces the previous one of ours
  show(summary, body, { timeout = 0, stopButton = true } = {}, done) {
    if (!this.available()) { done && done(false); return; }
    if (!stopButton && this.mon) { try { this.mon.kill("SIGTERM"); } catch { /* gone */ } this.mon = null; }
    const args = ["call", ...DBUS, "--method", "org.freedesktop.Notifications.Notify",
      gv(APP), String(this.id || 0), gv(fs.existsSync(ICON) ? ICON : ""), gv(summary), gv(body),
      stopButton ? "['stop', 'Stop']" : "@as []", "{'urgency': <byte 1>}", String(timeout)];
    execFile("gdbus", args, { timeout: 5000 }, (err, out) => {
      const m = !err && /uint32 (\d+)/.exec(String(out));
      if (m) {
        this.id = timeout === 0 ? Number(m[1]) : 0;
        if (stopButton) this.watch();
      }
      done && done(!!m);
    });
  },
  // ActionInvoked (uint32 <id>, 'stop') → onStop()
  watch() {
    if (this.mon) return;
    let p;
    try { p = spawn("gdbus", ["monitor", "--session", "--dest", "org.freedesktop.Notifications"], { stdio: ["ignore", "pipe", "ignore"] }); }
    catch { return; }
    this.mon = p;
    let buf = "";
    p.stdout.on("data", (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        const m = /ActionInvoked \(uint32 (\d+), '([^']*)'\)/.exec(line);
        if (m && this.id && Number(m[1]) === this.id && m[2] === "stop" && this.onStop) this.onStop();
      }
    });
    p.on("error", () => { if (this.mon === p) this.mon = null; });
    p.on("exit", () => { if (this.mon === p) this.mon = null; });
  },
  close(sync = false) {
    const id = this.id;
    this.id = 0;
    if (this.mon) { try { this.mon.kill("SIGTERM"); } catch { /* gone */ } this.mon = null; }
    if (!id || !this.available()) return;
    const args = ["call", ...DBUS, "--method", "org.freedesktop.Notifications.CloseNotification", String(id)];
    if (sync) { try { execFileSync("gdbus", args, { timeout: 2000, stdio: "ignore" }); } catch { /* ignore */ } }
    else execFile("gdbus", args, { timeout: 5000 }, () => {});
  },
};

// What this computer supports, for the settings panel
function checks() {
  let mouse = "ok";
  try { fs.accessSync("/dev/uinput", fs.constants.W_OK); }
  catch (e) { mouse = e.code === "ENOENT" ? "missing" : "access"; }
  if (mouse === "ok" && !which("python3")) mouse = "python";
  return { platform: "linux", mouse, awake: inhibit.available(), notify: notify.available() ? "gdbus" : "" };
}

const REASONS = {
  access: "no access to /dev/uinput",
  missing: "no /dev/uinput",
  python: "python3 is missing",
};

module.exports = { which, inhibit, Mover, notify, checks, REASONS };
