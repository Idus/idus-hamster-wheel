// The desktop side of the wheel on Windows (Elgato Stream Deck) — the same interface as
// desktop-linux.js. One small helper process (hamster-win.ps1: Windows PowerShell + a few lines of
// C#) does all three jobs: keeps the computer awake (SetThreadExecutionState, like PowerToys
// Awake), moves the mouse (SendInput) and shows a hamster in the system tray with a Stop item.
// It runs only while something needs it and ends with the plugin. No admin rights, no settings
// changed, no network.
"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const SCRIPT = path.join(__dirname, "hamster-win.ps1");
const PS = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
const firstLine = (s) => String(s || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0] || "";

// ---- the helper: started on first use, stopped when nobody needs it ---------------------------
const H = {
  proc: null, ready: false, queue: [], users: new Set(), listeners: new Set(),
  listen(fn) { this.listeners.add(fn); },
  unlisten(fn) { this.listeners.delete(fn); },
  emit(...a) { for (const fn of [...this.listeners]) { try { fn(...a); } catch { /* listener */ } } },
  use(who) { this.users.add(who); this.ensure(); },
  free(who) { this.users.delete(who); if (!this.users.size) this.quit(); },
  ensure() {
    if (this.proc) return;
    this.ready = false; this.queue = [];
    let p;
    try {
      p = spawn(fs.existsSync(PS) ? PS : "powershell.exe",
        ["-NoLogo", "-NoProfile", "-NonInteractive", "-Sta", "-ExecutionPolicy", "Bypass", "-File", SCRIPT],
        { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    } catch (e) { this.emit("error", "powershell", "Windows PowerShell could not start"); return; }
    this.proc = p;
    let buf = "", err = "", said = false;
    const timer = setTimeout(() => {
      if (this.proc === p && !this.ready) { said = true; this.emit("error", "other", "no answer from PowerShell"); this.quit(); }
    }, 20000);
    p.stdout.on("data", (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (line === "ready") {
          said = true; clearTimeout(timer);
          if (this.proc !== p) continue;
          this.ready = true;
          const q = this.queue; this.queue = [];
          for (const l of q) this.write(l);
          this.emit("ready");
        } else if (line === "done" || line === "stop") this.emit(line);
        else if (line.startsWith("error ")) { said = true; const [, kind, ...rest] = line.split(" "); this.emit("error", kind, rest.join(" ")); }
      }
    });
    p.stderr.on("data", (d) => { err += d; });
    p.stdin.on("error", () => {});
    p.on("error", (e) => {
      clearTimeout(timer);
      if (this.proc === p) { this.proc = null; this.ready = false; }
      if (!said) { said = true; this.emit("error", e.code === "ENOENT" ? "powershell" : "other", e.code === "ENOENT" ? "Windows PowerShell is missing" : String(e.message)); }
    });
    p.on("exit", (code) => {
      clearTimeout(timer);
      const mine = this.proc === p;
      if (mine) { this.proc = null; this.ready = false; }
      if (mine && !said) { said = true; this.emit("error", "other", firstLine(err) || `the helper stopped (${code})`); }
    });
  },
  write(line) { try { this.proc.stdin.write(line + "\n"); return true; } catch { return false; } },
  send(line) {
    if (!this.proc) return false;
    if (!this.ready) { this.queue.push(line); return true; }
    return this.write(line);
  },
  quit() {
    const p = this.proc;
    this.proc = null; this.ready = false; this.queue = [];
    if (!p) return;
    try { p.stdin.write("quit\n"); p.stdin.end(); } catch { /* closed */ }
    setTimeout(() => { try { p.kill(); } catch { /* gone */ } }, 3000).unref();
  },
};

// ---- stay awake ------------------------------------------------------------------------------
const inhibit = {
  tool: "",
  active: false,
  available() { return "Windows"; },
  start() {
    if (this.active) return this.tool;
    this.active = true; this.tool = "Windows";
    H.use("awake"); H.send("awake on");
    return this.tool;
  },
  stop() {
    if (!this.active) return;
    this.active = false;
    H.send("awake off"); H.free("awake");
  },
};

// ---- mouse -------------------------------------------------------------------------------------
let seq = 0;
class Mover {
  constructor() { this.id = `mover${++seq}`; this.on = false; this.onState = null; this.onDone = null; this.fn = null; }
  get running() { return this.on; }
  get ready() { return this.on && H.ready; }
  start(onState) {
    this.onState = onState;
    if (this.on) { if (H.ready) onState("ready"); return; }
    this.on = true;
    this.fn = (evt, a, b) => {
      if (!this.on) return;
      if (evt === "ready" && this.onState) this.onState("ready");
      else if (evt === "error" && this.onState) this.onState("error", a, b);
      else if (evt === "done" && this.onDone) { const f = this.onDone; this.onDone = null; f(); }
    };
    H.listen(this.fn);
    H.use(this.id);
    if (H.ready) onState("ready");
  }
  // steps: [[dx, dy, waitMs], ...]
  send(steps, onDone) {
    if (!this.on) return false;
    if (onDone) this.onDone = onDone;
    return H.send("seq " + steps.map((s) => s.map((v) => Math.round(v)).join(",")).join(" "));
  }
  stop() {
    if (!this.on) return;
    this.on = false; this.onState = null; this.onDone = null;
    H.unlisten(this.fn);
    H.free(this.id);
  }
}

// ---- on screen: a hamster in the system tray (tooltip, a balloon at start and stop, Stop item) -
const clean = (s) => String(s).replace(/[\r\n|]/g, " ").trim();
const notify = {
  onStop: null,
  shown: false,
  timer: null,
  available() { return true; },
  show(summary, body, { timeout = 0 } = {}, done) {
    const first = !this.shown;
    clearTimeout(this.timer); this.timer = null;
    if (first) { this.shown = true; H.use("tray"); H.send("tray on"); }
    H.send("tip " + clean(`Hamster Wheel · ${body}`).slice(0, 63));
    if (first || timeout) H.send(`balloon ${clean(summary)}|${clean(body) || " "}`);
    if (timeout) this.timer = setTimeout(() => this.close(), timeout); // a goodbye, then leave the tray
    done && done(true);
  },
  close() {
    clearTimeout(this.timer); this.timer = null;
    if (!this.shown) return;
    this.shown = false;
    H.send("tray off"); H.free("tray");
  },
};
H.listen((evt) => { if (evt === "stop" && notify.onStop) notify.onStop(); });

function which() { return null; }
function checks() {
  return { platform: "win32", mouse: fs.existsSync(PS) ? "ok" : "powershell", awake: "Windows", notify: "tray" };
}

const REASONS = { powershell: "Windows PowerShell is missing" };

module.exports = { which, inhibit, Mover, notify, checks, REASONS };
