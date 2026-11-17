// Fake OpenDeck host for testing: starts the plugin the way OpenDeck does (node plugin.js,
// cwd = plugin folder, -port/-pluginUUID/-registerEvent/-info), shows three keys, presses them,
// changes settings, asks for a test move and presses Stop in the (fake) notification.
// Desktop tools are stubs in a fake bin folder (kde-inhibit, gdbus) that log what they get.
//   node dev/fake-opendeck.cjs <out dir> [seconds]
// Env: DRYRUN=1 — mover without /dev/uinput (events logged to <out>/moves.log)
//      WS_MODULE — path to the ws package
const { WebSocketServer } = require(process.env.WS_MODULE || "ws");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

// FAKE_PLUGIN_DIR / FAKE_ENTRY: test another build, e.g. the Elgato bundle (build/elgato/…/bin/plugin.js)
const PLUGIN = path.resolve(process.env.FAKE_PLUGIN_DIR || path.join(__dirname, "..", "se.wolfpack.idushamsterwheel.sdPlugin"));
const ENTRY = process.env.FAKE_ENTRY || "plugin.js";
const ID = "se.wolfpack.idushamsterwheel";
const out = path.resolve(process.argv[2] || "out");
const seconds = Number(process.argv[3] || 16);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const port = 28450 + Math.floor(Math.random() * 40);

// ---- stub desktop tools -------------------------------------------------------------------
const bin = path.join(out, "bin");
fs.mkdirSync(bin);
const TRIGGER = path.join(out, "press-stop");
fs.writeFileSync(path.join(bin, "kde-inhibit"), `#!/usr/bin/env bash
echo "$(date +%s.%N) $*" >> "${out}/inhibit.log"
while [[ "$1" == --* ]]; do shift; done
exec "$@"
`, { mode: 0o755 });
fs.writeFileSync(path.join(bin, "gdbus"), `#!/usr/bin/env bash
if [ "$1" = monitor ]; then
  while [ ! -f "${TRIGGER}" ]; do sleep 0.2; done
  echo "/org/freedesktop/Notifications: org.freedesktop.Notifications.ActionInvoked (uint32 7, 'stop')"
  sleep 60; exit 0
fi
printf '%s\\n' "$*" >> "${out}/gdbus.log"
case "$*" in *Notifications.Notify*) echo "(uint32 7,)";; *) echo "()";; esac
`, { mode: 0o755 });

const keys = [
  ["k1", { mode: "nudge", distance: "4", every: "5", offAfter: "15" }],   // 15 "minutes" = 9 s in this test
  ["k2", { show: "on" }],
  ["k3", { animateOff: false }],
];
const latest = {}, log = [], counts = {};
const t0 = Date.now();
const ts = () => ((Date.now() - t0) / 1000).toFixed(1).padStart(5);

const wss = new WebSocketServer({ port });
wss.on("connection", (ws) => {
  const send = (o) => ws.send(JSON.stringify(o));
  const at = (ms, what, fn) => setTimeout(() => { log.push(`${ts()} ${what}`); fn(); }, ms);
  const press = (name) => {
    const p = { settings: keys.find((k) => k[0] === name)[1], coordinates: { column: 0, row: 0 }, isInMultiAction: false };
    send({ event: "keyDown", action: `${ID}.wheel`, context: name, device: "dev", payload: p });
    send({ event: "keyUp", action: `${ID}.wheel`, context: name, device: "dev", payload: p });
  };
  const snap = (tag) => { for (const [k, svg] of Object.entries(latest)) fs.writeFileSync(path.join(out, `${tag}-${k}.svg`), svg); };
  ws.on("message", (buf) => {
    const m = JSON.parse(String(buf));
    if (m.event === "registerPlugin") {
      for (const [name, settings] of keys) send({ event: "willAppear", action: `${ID}.wheel`, context: name, device: "dev",
        payload: { controller: "Keypad", settings, coordinates: { column: 0, row: 0 }, isInMultiAction: false } });
      at(600, "snapshot off", () => snap("t0-off"));
      at(800, "PI open on k3 → info", () => send({ event: "sendToPlugin", action: `${ID}.wheel`, context: "k3", payload: { cmd: "info" } }));
      at(1000, "PRESS k1 (nudge every 5 s, off after 9 s)", () => press("k1"));
      at(2500, "snapshot running", () => snap("t1-on"));
      at(4000, "PI test on k3", () => send({ event: "sendToPlugin", action: `${ID}.wheel`, context: "k3", payload: { cmd: "test" } }));
      at(6000, "k1 settings → circle, 8 px", () => {
        keys[0][1] = { ...keys[0][1], mode: "circle", distance: "8" };
        send({ event: "didReceiveSettings", action: `${ID}.wheel`, context: "k1", payload: { settings: keys[0][1] } });
      });
      at(10600, "snapshot after auto-off", () => snap("t2-autooff"));
      at(11000, "PRESS k2 (defaults)", () => press("k2"));
      at(12500, "snapshot k2 running", () => snap("t3-on2"));
      at(13000, "notification Stop pressed", () => fs.writeFileSync(TRIGGER, "1"));
      at(14000, "snapshot after Stop", () => snap("t4-stopped"));
      return;
    }
    counts[m.event] = (counts[m.event] || 0) + 1;
    if (m.event === "setImage") {
      latest[m.context] = Buffer.from(m.payload.image.split(",")[1], "base64").toString();
      counts[`img:${m.context}`] = (counts[`img:${m.context}`] || 0) + 1;
    } else if (m.event === "sendToPropertyInspector") {
      const p = m.payload;
      if (p.test || counts[m.event] <= 1 || counts[m.event] % 4 === 0) log.push(`${ts()} → PI ${m.context}: on=${p.on} left=${p.left} moves=${p.moves} uinput=${p.uinput} awake=${p.awake}/${p.awakeActive} warn=${p.warn}${p.test ? " TEST " + JSON.stringify(p.test) : ""}`);
    } else {
      log.push(`${ts()} ${m.event} ${m.context || ""} ${m.payload ? JSON.stringify(m.payload).slice(0, 160) : ""}`);
    }
  });
});

const info = { application: { font: "", language: "en", platform: "linux", platformVersion: "Rolling", version: "2.14.2" },
  plugin: { uuid: ID, version: "1.0" }, devicePixelRatio: 2, colors: {},
  devices: [{ id: "dev", name: "Stream Deck XL", size: { columns: 8, rows: 4 }, type: 2 }] };
const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, IDUS_HW_MINUTE_MS: "600" };
if (process.env.DRYRUN === "1") Object.assign(env, { IDUS_HW_DRYRUN: "1", IDUS_HW_DRYLOG: path.join(out, "moves.log") });
const child = spawn(process.execPath, [ENTRY, "-port", String(port), "-pluginUUID", ID, "-registerEvent", "registerPlugin",
  "-info", JSON.stringify(info)], { cwd: PLUGIN, env });
let errs = "";
child.stderr.on("data", (d) => { errs += d; });
child.stdout.on("data", (d) => { errs += d; });
setTimeout(() => {
  child.kill("SIGTERM");
  setTimeout(() => {
    const ps = require("node:child_process").execSync("ps -eo pid,args | grep -E 'tail --pid|mover.py|gdbus monitor' | grep -v grep || true").toString();
    log.push(`${ts()} leftover processes after SIGTERM: ${ps.trim() || "none"}`);
    const report = log.join("\n") + "\n\nCOUNTS " + JSON.stringify(counts) + "\n\nSTDERR\n" + errs;
    fs.writeFileSync(path.join(out, "log.txt"), report);
    console.log(report);
    wss.close(); process.exit(0);
  }, 1500);
}, seconds * 1000);
