// Renders the README animations from the plugin's own key code: docs/hamster-on.gif (running)
// and docs/hamster-off.gif (asleep), 288 px. Needs Playwright and ImageMagick (convert).
// Run: node dev/make-gifs.cjs
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const K = require("../se.wolfpack.idushamsterwheel.sdPlugin/lib/keys");

const DOCS = path.join(__dirname, "..", "docs");
fs.mkdirSync(DOCS, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hw-gif-"));
const svg = (dataUrl) => Buffer.from(dataUrl.split(",")[1], "base64").toString();

(async () => {
  const { chromium } = require("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 144, height: 144 }, deviceScaleFactor: 2 });
  const shot = async (s, file) => {
    await page.setContent(`<html><body style="margin:0;background:#16181d">${s}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 144, height: 144 } });
  };
  const sets = [
    ["on", K.RUN_FRAMES, (f) => K.key({ on: true, f, label: "59:52" }), Math.round(K.RUN_MS / 10)],
    ["off", K.SLEEP_FRAMES, (f) => K.key({ on: false, f, label: "OFF" }), Math.round(K.SLEEP_MS / 10)],
  ];
  for (const [name, frames, make, delay] of sets) {
    const files = [];
    for (let f = 0; f < frames; f++) {
      const file = path.join(tmp, `${name}-${String(f).padStart(2, "0")}.png`);
      await shot(svg(make(f)), file);
      files.push(file);
    }
    execFileSync("convert", ["-delay", String(delay), "-loop", "0", ...files, "-layers", "Optimize", path.join(DOCS, `hamster-${name}.gif`)]);
  }
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("gifs → docs/");
})();
