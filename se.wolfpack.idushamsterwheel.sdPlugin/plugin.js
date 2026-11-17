// Idus Hamster Wheel · v1.1 · build 2026-11-17
// A key that keeps the computer awake while you are away: press it and a hamster runs, the screen
// does not lock and the mouse gets a tiny nudge on a timer. Turns itself off after 15 min – 4 h
// (never later, on purpose). Press again to stop. OpenDeck on Linux (lib/desktop-linux.js, mouse
// via lib/mover.py) and Elgato Stream Deck on Windows (lib/desktop-win.js + lib/hamster-win.ps1).
// Zero npm dependencies.
"use strict";

const APP_VERSION = "1.1";
const BUILD = "2026-11-17.5"; // shown in the settings panel and the OpenDeck log — tells which copy runs
const fs = require("node:fs");
const sdk = require("./lib/sdk");
const K = require("./lib/keys");
const { inhibit, Mover, notify, checks, REASONS } = require("./lib/desktop");

const ACTION = "se.wolfpack.idushamsterwheel.wheel";
const MINUTE = Number(process.env.IDUS_HW_MINUTE_MS) || 60000; // shorter only in tests
const DEFAULTS = {
  mode: "zen", distance: "4", every: "30", random: false, randMin: "20", randMax: "45",
  offAfter: "60", show: "left", notify: true, animateOff: true,
};
const MODES = { awake: "Stay awake only", zen: "Zen", nudge: "Nudge", circle: "Circle", random: "Random" };

const keys = new Map();       // context → { settings }
const inspected = new Set();  // contexts whose settings panel is open
const mover = new Mover();
const W = {                   // the one wheel all keys show
  on: false, owner: null, cfg: null, startedAt: 0, offAt: 0, nextAt: 0, moves: 0,
  warn: "", failMsg: "", failUntil: 0, test: null,
};

// ---- settings --------------------------------------------------------------------------------
const int = (v, d) => { const x = parseInt(v, 10); return Number.isFinite(x) ? x : d; };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function cfgOf(settings) {
  const s = { ...DEFAULTS, ...(settings || {}) };
  let lo = clamp(int(s.randMin, 20), 5, 3600), hi = clamp(int(s.randMax, 45), 5, 3600);
  if (lo > hi) [lo, hi] = [hi, lo];
  return {
    mode: MODES[s.mode] ? s.mode : "zen",
    distance: clamp(int(s.distance, 4), 1, 20),
    every: clamp(int(s.every, 30), 5, 3600),
    random: s.random === true || s.random === "true",
    randMin: lo, randMax: hi,
    // Always turns itself off — at most after 4 hours, so a computer is never left awake for good
    offAfter: int(s.offAfter, 60) <= 0 ? 240 : clamp(int(s.offAfter, 60), 15, 240),
    show: ["left", "on", "next"].includes(s.show) ? s.show : "left",
    notify: s.notify !== false && s.notify !== "false",
    animateOff: s.animateOff !== false && s.animateOff !== "false",
  };
}
const interval = (c) => 1000 * (c.random ? c.randMin + Math.random() * (c.randMax - c.randMin) : c.every);

// ---- movement patterns: [dx, dy, wait ms] steps that always end where they started ------------
function pattern(mode, d) {
  if (mode === "zen") return [[1, 0, 30], [-1, 0, 0]];                 // 1 px and back: invisible
  if (mode === "nudge") return [[d, 0, 120], [-d, 0, 0]];
  if (mode === "circle") {                                              // 16 equal steps round a circle
    const steps = []; let px = 0, py = 0;
    for (let i = 1; i <= 16; i++) {
      const a = (i / 16) * 2 * Math.PI;
      const x = Math.round(d * Math.sin(a)), y = Math.round(d * (1 - Math.cos(a)));
      steps.push([x - px, y - py, 15]); px = x; py = y;
    }
    return steps;
  }
  if (mode === "random") {                                              // three out-and-back jiggles
    const steps = [];
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * 2 * Math.PI, r = 1 + Math.random() * (d - 1);
      let dx = Math.round(r * Math.cos(a)), dy = Math.round(r * Math.sin(a));
      if (!dx && !dy) dx = 1;
      steps.push([dx, dy, 90], [-dx, -dy, 60]);
    }
    return steps;
  }
  return [];
}

// ---- time formats ----------------------------------------------------------------------------
function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function fmtLong(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1) return "less than a minute";
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`;
}
const clock = (t) => new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
const everyText = (c) => c.random ? `${c.randMin}–${c.randMax} s` : c.every % 60 === 0 ? `${c.every / 60} min` : `${c.every} s`;

// ---- the wheel ---------------------------------------------------------------------------------
function startMover() {
  mover.start((state, kind, text) => {
    if (state === "ready") { W.warn = ""; return; }
    W.warn = kind;
    W.failMsg = REASONS[kind] || text || "the mouse could not move";
    W.failUntil = Date.now() + 8000;
    sdk.log(`Hamster Wheel: mouse mover failed — ${W.failMsg}`);
    mover.stop();
  });
}

function showRunning() {
  const c = W.cfg;
  const what = c.mode === "awake" ? "Stay awake only" : `${MODES[c.mode]} every ${everyText(c)}`;
  notify.show("🐹 Hamster Wheel is running", `${what} · off at ${clock(W.offAt)}`);
}

function start(ctx) {
  const k = keys.get(ctx);
  const cfg = cfgOf(k && k.settings);
  const now = Date.now();
  Object.assign(W, {
    on: true, owner: ctx, cfg, startedAt: now, offAt: now + cfg.offAfter * MINUTE,
    nextAt: now + interval(cfg), moves: 0, warn: "", failMsg: "", failUntil: 0,
  });
  inhibit.start();
  if (cfg.mode !== "awake") startMover();
  if (cfg.notify) showRunning();
  sdk.log(`Hamster Wheel on: ${cfg.mode}, every ${everyText(cfg)}, off after ${cfg.offAfter} min, stay awake via ${inhibit.tool || "nothing"}`);
}

function stop(reason) {
  if (!W.on) return;
  const ran = Date.now() - W.startedAt;
  W.on = false;
  mover.stop();
  inhibit.stop();
  if (reason === "auto" && W.cfg.notify) {
    notify.show("🐹 Hamster Wheel stopped", `Turned itself off after ${fmtLong(ran)}`, { timeout: 8000, stopButton: false });
  } else notify.close();
  sdk.log(`Hamster Wheel off (${reason}) after ${fmtLong(ran)}, ${W.moves} moves`);
}
notify.onStop = () => stop("notification");

// New settings for the key that runs the wheel take effect at once
function apply(cfg) {
  const old = W.cfg;
  W.cfg = cfg;
  W.offAt = W.startedAt + cfg.offAfter * MINUTE;
  if (cfg.mode === "awake") mover.stop();
  else if (!mover.running && (old.mode === "awake" || !W.warn)) startMover();
  W.nextAt = Math.min(W.nextAt, Date.now() + interval(cfg));
  if (cfg.notify) showRunning(); else notify.close();
}

function moveNow() {
  if (W.cfg.mode === "awake" || !mover.running) return;
  if (mover.send(pattern(W.cfg.mode, W.cfg.distance))) W.moves++;
}

// Test button: a small visible circle, through the running mover or a short-lived one
function test(ctx) {
  const reply = (ok, msg) => { W.test = { ok, msg, at: Date.now() }; sendInfo(ctx); };
  const steps = pattern("circle", 12);
  if (mover.running && mover.ready) { mover.send(steps); reply(true, "The pointer drew a small circle — the mouse can move."); return; }
  const t = new Mover();
  const timer = setTimeout(() => { t.stop(); reply(false, "No answer from the mouse mover."); }, 25000);
  t.start((state, kind, text) => {
    if (state === "ready") {
      t.send(steps, () => { clearTimeout(timer); t.stop(); reply(true, "The pointer drew a small circle — the mouse can move."); });
    } else { clearTimeout(timer); t.stop(); reply(false, `Could not move the mouse: ${REASONS[kind] || text}.`); }
  });
}

// ---- drawing ------------------------------------------------------------------------------------
function label(show, now) {
  if (show === "next" && W.cfg.mode !== "awake" && mover.running) return fmt(W.nextAt - now);
  if (show === "on" || !W.offAt) return fmt(now - W.startedAt);
  return fmt(W.offAt - now);
}

function draw(ctx, k, now) {
  const s = cfgOf(k.settings);
  let img;
  if (W.on && W.failUntil > now) {
    img = K.problem({ title: "NO MOUSE", reason: W.failMsg, sub: inhibit.active ? "still keeps awake" : "" });
  } else if (W.on) {
    img = K.key({ on: true, f: Math.floor(now / K.RUN_MS), label: label(s.show, now), lamp: W.warn ? "warn" : "ok" });
  } else {
    const still = !s.animateOff;
    img = K.key({ on: false, f: still ? 0 : Math.floor(now / K.SLEEP_MS), label: "OFF", still });
  }
  sdk.setImage(ctx, img);
}

function info() {
  const now = Date.now();
  return {
    type: "info", app: "Idus Hamster Wheel", version: APP_VERSION, build: BUILD,
    on: W.on, mode: W.on ? W.cfg.mode : "", elapsed: W.on ? now - W.startedAt : 0,
    left: W.on && W.offAt ? W.offAt - now : 0, offAt: W.on && W.offAt ? clock(W.offAt) : "",
    nextIn: W.on && mover.running ? Math.max(0, W.nextAt - now) : 0, moves: W.moves,
    warn: W.warn, failMsg: W.failMsg, ...checks(), awakeActive: inhibit.active,
    test: W.test && now - W.test.at < 15000 ? W.test : null,
  };
}
function sendInfo(ctx) { sdk.toInspector(ctx, ACTION, info()); }

// One loop for everything: timers, auto-off and animation. Only frames that changed are sent.
let loopTimer = null, lastInfo = 0;
function loop() {
  const now = Date.now();
  if (W.on) {
    if (W.offAt && now >= W.offAt) stop("auto");
    else if (now >= W.nextAt) { moveNow(); W.nextAt = now + interval(W.cfg); }
  }
  for (const [ctx, k] of keys) draw(ctx, k, now);
  if (now - lastInfo >= 1000) { lastInfo = now; for (const ctx of inspected) sendInfo(ctx); }
  if (!W.on && keys.size === 0) { clearInterval(loopTimer); loopTimer = null; }
}
const ensureLoop = () => { if (!loopTimer) loopTimer = setInterval(loop, 50); };

// ---- OpenDeck events --------------------------------------------------------------------------
sdk.on("willAppear", (m) => {
  keys.set(m.context, { settings: (m.payload && m.payload.settings) || {} });
  ensureLoop();
  // OpenDeck can show a new key after the first image arrived: send it again a little later
  for (const t of [400, 1500]) setTimeout(() => sdk.forget(m.context), t);
});
sdk.on("willDisappear", (m) => { keys.delete(m.context); inspected.delete(m.context); sdk.forget(m.context); });
sdk.on("didReceiveSettings", (m) => {
  const settings = (m.payload && m.payload.settings) || {};
  const k = keys.get(m.context);
  if (k) k.settings = settings;
  if (W.on && W.owner === m.context) apply(cfgOf(settings));
});
sdk.on("keyUp", (m) => {
  const k = keys.get(m.context);
  if (k && m.payload && m.payload.settings) k.settings = m.payload.settings;
  if (!k) keys.set(m.context, { settings: (m.payload && m.payload.settings) || {} });
  if (W.on) stop("key"); else start(m.context);
  ensureLoop();
});
sdk.on("sendToPlugin", (m) => {
  const p = m.payload || {};
  if (p.cmd === "info") { inspected.add(m.context); sendInfo(m.context); }
  if (p.cmd === "test") test(m.context);
});
sdk.on("propertyInspectorDidDisappear", (m) => inspected.delete(m.context));

// Nothing outlives the plugin: stop the mouse, the stay-awake block and the notification
function cleanup() { try { mover.stop(); inhibit.stop(); notify.close(true); } catch { /* exiting */ } }
process.on("exit", cleanup);
for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"]) process.on(sig, () => process.exit(0));

module.exports = { pattern, cfgOf, fmt }; // for tests
if (require.main === module) {
  sdk.connect();
  setTimeout(() => sdk.log(`Idus Hamster Wheel v${APP_VERSION} (build ${BUILD}) running from ${__dirname}`), 1000);
}
