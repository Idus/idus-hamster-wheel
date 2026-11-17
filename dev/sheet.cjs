// Renders SVG key images side by side into one PNG (for checking test runs).
//   node dev/sheet.cjs <out.png> <a.svg> <b.svg> ...
const fs = require("node:fs");
const { chromium } = require("playwright");
(async () => {
  const [out, ...files] = process.argv.slice(2);
  const cells = files.map((f) => `<figure>${fs.readFileSync(f, "utf8")}<figcaption>${f.split("/").pop().replace(".svg", "")}</figcaption></figure>`).join("");
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 170 * files.length, height: 190 }, deviceScaleFactor: 1 });
  await p.setContent(`<html><body style="margin:0;background:#0f1115;display:flex;font:12px monospace;color:#8a93a3">
    <style>figure{margin:8px;text-align:center}</style>${cells}</body></html>`);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: out });
  await b.close();
})();
