// Elgato Marketplace images → docs/elgato-store/: app-icon-288.png, thumbnail.png (1920 × 960) and
// three gallery images (1920 × 960), drawn from the plugin's own key code and the Windows settings
// page. Needs Playwright and a built Elgato edition (node dev/build-elgato.cjs) for the panel shot.
// Run: node dev/make-store.cjs
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const K = require("../se.wolfpack.idushamsterwheel.sdPlugin/lib/keys");
const { textToPaths } = require("./elgato/textpaths.cjs");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "docs", "elgato-store");
const PI = path.join(ROOT, "build", "elgato", "se.wolfpack.idushamsterwheel.sdPlugin", "pi", "wheel.html");
fs.mkdirSync(OUT, { recursive: true });

const svg = (u) => textToPaths(Buffer.from(u.split(",")[1], "base64").toString());
const uri = (s) => "data:image/svg+xml;base64," + Buffer.from(s).toString("base64");
const key = (s, size) => `<img class="key" src="${uri(s)}" width="${size}" height="${size}">`;
const k = {
  off: svg(K.key({ on: false, f: 4, label: "OFF" })),
  on1: svg(K.key({ on: true, f: 2, label: "59:52" })),
  on2: svg(K.key({ on: true, f: 8, label: "1h00" })),
  end: svg(K.key({ on: true, f: 5, label: "0:12" })),
  off2: svg(K.key({ on: false, f: 14, label: "OFF" })),
};
const icon = fs.readFileSync(path.join(ROOT, "idus-hamster-wheel.svg"), "utf8");

const css = `
*{box-sizing:border-box} body{margin:0;background:#16181d;color:#e8eaed;font-family:'IBM Plex Sans',sans-serif}
.page{width:1920px;height:960px;position:relative;overflow:hidden;background:radial-gradient(1200px 700px at 78% 40%, #1e222b 0%, #16181d 70%);padding:84px 96px}
.eyebrow{font:600 22px 'JetBrains Mono';letter-spacing:.12em;color:#9fb4d4;text-transform:uppercase}
h1{font:700 128px/1 Saira;color:#ffd9a0;margin:18px 0 0} h2{font:700 72px/1.05 Saira;color:#ffd9a0;margin:14px 0 0}
.lede{font-size:38px;line-height:1.3;color:#e8eaed;margin:28px 0 0;max-width:780px} .sub{font-size:28px;color:#8a93a3;margin-top:16px;max-width:1300px;line-height:1.4}
.key{border-radius:26px;display:block}
.col{display:grid;gap:18px;justify-items:center;text-align:center}
.cap{font-size:24px;color:#9fb4d4;max-width:250px;line-height:1.3}
.arrow{font:700 64px Saira;color:#ff9a3c;align-self:center;margin-top:-40px}
.row{position:absolute;display:flex;gap:26px;align-items:flex-start}
.list{margin:44px 0 0;padding:0;list-style:none;display:grid;gap:22px;font-size:32px;max-width:1000px}
.list li{display:grid;grid-template-columns:44px 1fr;align-items:baseline}
.list b{color:#ffd9a0;font-weight:600} .ok{color:#46d160}
.panel{border-radius:18px;border:2px solid #2a2f3a;display:block}`;

(async () => {
  const b = await chromium.launch();
  // the Windows settings page, running, for gallery 2
  let panel = "";
  if (fs.existsSync(PI)) {
    const p = await b.newPage({ viewport: { width: 1100, height: 384 }, deviceScaleFactor: 2 });
    await p.goto("file://" + PI);
    await p.evaluate(() => {
      window.connectSocket(1, "pi", "registerPropertyInspector", "{}", JSON.stringify({ action: "x", context: "ctx", payload: { settings: {} } }));
    });
    await p.waitForTimeout(300);
    await p.evaluate(() => {
      document.getElementById("state").className = "pill ok";
      document.getElementById("state").textContent = "● Running · 52:08 left · 15 moves";
      document.getElementById("eyebrow").textContent = "Idus Hamster Wheel · v1.1";
      document.getElementById("checks").innerHTML = [["Mouse", "ready (SendInput)"], ["Stay awake", "active · Windows, like PowerToys Awake"], ["On screen", "hamster in the system tray"]]
        .map(([k, t]) => `<div class="checkrow"><span class="dot ok">●</span><span class="ck">${k}</span><span class="cv">${t}</span></div>`).join("");
    });
    await p.evaluate(() => document.fonts.ready);
    panel = "data:image/png;base64," + (await p.screenshot({ fullPage: true })).toString("base64");
    await p.close();
  } else console.log("(no Elgato build — gallery 2 without the settings panel; run node dev/build-elgato.cjs first)");

  const pages = {
    "thumbnail": `<div class="page">
      <div class="eyebrow">Stream Deck plugin · Windows</div>
      <h1>Hamster Wheel</h1>
      <p class="lede">Keeps your computer awake while you are away — press the key and the hamster runs. It always turns itself off.</p>
      <div class="row" style="right:110px;top:190px;gap:40px">${key(k.on1, 300)}${key(k.off, 300)}</div>
      <div class="row" style="right:110px;top:560px;font:500 26px 'IBM Plex Sans';color:#8a93a3;gap:0"><span style="width:300px;text-align:center">Running</span><span style="width:40px"></span><span style="width:300px;text-align:center">Asleep</span></div>
    </div>`,
    "gallery-1-one-press": `<div class="page">
      <div class="eyebrow">BRB · one key</div>
      <h2>Press, walk away, come back</h2>
      <p class="sub">The screen does not lock and the mouse gets a tiny nudge on a timer. The key counts down and turns itself off when the time is up.</p>
      <div class="row" style="left:96px;top:420px">
        <div class="col">${key(k.off, 230)}<div class="cap">Asleep — press it</div></div><div class="arrow">→</div>
        <div class="col">${key(k.on2, 230)}<div class="cap">Runs, time left beside BRB</div></div><div class="arrow">→</div>
        <div class="col">${key(k.end, 230)}<div class="cap">Almost done</div></div><div class="arrow">→</div>
        <div class="col">${key(k.off2, 230)}<div class="cap">Turns itself off</div></div>
      </div></div>`,
    "gallery-2-settings": `<div class="page">
      <div class="eyebrow">Settings</div>
      <h2>Your pace, your timer</h2>
      <p class="sub">Zen (invisible), Nudge, Circle or Random — or stay awake without moving the mouse. Every 15 s – 10 min or at random, off after 15 min – 4 h. Test the mouse with one click.</p>
      ${panel ? `<img class="panel" src="${panel}" style="position:absolute;left:96px;top:420px;width:1728px">` : ""}
    </div>`,
    "gallery-3-safe": `<div class="page">
      <div class="eyebrow">Safe by design</div>
      <h2>Does its job, then gets out of the way</h2>
      <ul class="list">
        <li><span class="ok">✓</span><span><b>Always turns itself off</b> — after 4 hours at the most, so a computer is never left awake for good.</span></li>
        <li><span class="ok">✓</span><span><b>You can see it is on</b> — the running hamster on the key and in the system tray, with a Stop item.</span></li>
        <li><span class="ok">✓</span><span><b>No admin rights, no settings changed</b> — Windows' own stay-awake call, like PowerToys Awake, and tiny mouse moves that end where they started.</span></li>
        <li><span class="ok">✓</span><span><b>Nothing left behind</b> — no autostart, no service, no network. It stops with the Stream Deck app.</span></li>
      </ul>
      <div style="position:absolute;right:120px;top:300px;width:420px;height:420px">${icon.replace(/width="512" height="512"/, 'width="420" height="420"')}</div>
    </div>`,
  };

  const page = await b.newPage({ viewport: { width: 1920, height: 960 } });
  for (const [name, html] of Object.entries(pages)) {
    await page.setContent(`<html><head><style>${css}</style></head><body>${html}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  }
  const ic = await b.newPage({ viewport: { width: 288, height: 288 } });
  await ic.setContent(`<html><body style="margin:0;background:transparent">${icon.replace(/width="512" height="512"/, 'width="288" height="288"')}</body></html>`);
  await ic.evaluate(() => document.fonts.ready);
  await ic.screenshot({ path: path.join(OUT, "app-icon-288.png"), omitBackground: true, clip: { x: 0, y: 0, width: 288, height: 288 } });
  await b.close();
  console.log("store images → docs/elgato-store/");
})();
