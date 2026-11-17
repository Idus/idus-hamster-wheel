// Loads the settings panel in Chromium with a fake host: checks that settings load, that a change
// is saved on the key's context, that conditional fields show and hide, that plugin info and the
// test result appear, and screenshots it at OpenDeck's size (full width, ≤ 384 px high).
//   node dev/test-pi.cjs <out dir>
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { WebSocketServer } = require(process.env.WS_MODULE || "ws");

const PI = path.join(__dirname, "..", "se.wolfpack.idushamsterwheel.sdPlugin", "pi", "wheel.html");
const out = path.resolve(process.argv[2] || "pi-shots");
fs.mkdirSync(out, { recursive: true });

const base = { type: "info", app: "Idus Hamster Wheel", version: "1.0", awake: "kde-inhibit", python: true, notify: true, moves: 0, warn: "", failMsg: "" };
const cases = {
  running: { settings: {}, info: { ...base, on: true, elapsed: 312000, left: 3288000, moves: 10, awakeActive: true, uinput: "ok",
    test: { ok: true, msg: "The pointer drew a small circle — the mouse can move.", at: 1 } } },
  random: { settings: { mode: "circle", distance: "8", random: true, show: "next" }, info: { ...base, on: false, uinput: "ok" } },
  noaccess: { settings: { mode: "nudge" }, info: { ...base, on: false, uinput: "access" } },
};

(async () => {
  const browser = await chromium.launch();
  let port = 28600;
  for (const [name, c] of Object.entries(cases)) {
    for (const [W, H] of [[1100, 384], [560, 900]]) {
      port++;
      const got = [];
      const wss = new WebSocketServer({ port });
      wss.on("connection", (ws) => ws.on("message", (b) => {
        const m = JSON.parse(String(b)); got.push(m);
        if (m.event === "sendToPlugin" && m.payload.cmd === "info") ws.send(JSON.stringify({ event: "sendToPropertyInspector", context: "ctx", payload: c.info }));
      }));
      const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(() => { window.__opened = []; window.open = (u, t) => { window.__opened.push(u); }; });
      await page.goto("file://" + PI);
      await page.evaluate(([port, settings]) => window.connectSocket(port, "ctx", "registerPropertyInspector", "{}",
        JSON.stringify({ action: "se.wolfpack.idushamsterwheel.wheel", context: "ctx", payload: { settings } })), [port, c.settings]);
      await page.waitForTimeout(500);
      const visible = await page.evaluate(() => [...document.querySelectorAll("[data-when]")].filter((e) => !e.hidden).map((e) => e.dataset.when));
      let saved = "";
      if (W === 1100) {
        await page.selectOption('select[data-setting="offAfter"]', "120");
        await page.waitForTimeout(150);
        const set = got.filter((m) => m.event === "setSettings").pop();
        saved = set ? `${set.context} offAfter=${set.payload.offAfter} mode=${set.payload.mode} every=${set.payload.every}` : "NOT SAVED";
      }
      await page.evaluate(() => document.fonts.ready);
      const scroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
      await page.screenshot({ path: path.join(out, `${name}-${W}.png`), fullPage: true });
      await page.click("footer a[href*='github']");
      const opened = await page.evaluate(() => window.__opened);
      console.log(JSON.stringify({ name, W, scroll, visible, saved, opened, pill: await page.textContent("#state"), fix: await page.isVisible("#fix"), errors }));
      await page.close(); wss.close();
    }
  }
  await browser.close();
})();
