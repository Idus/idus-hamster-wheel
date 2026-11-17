// Builds the icons: action-list glyph and category icon (orange on the Idus blue-grey, like
// Idus SC Deck), the default key image, the plugin icon and the 512 px app icon in the repo root
// (used by README and Idus GitHub Updater). PNGs via Playwright. Run: node dev/make-icons.cjs
const fs = require("node:fs");
const path = require("node:path");
const K = require("../se.wolfpack.idushamsterwheel.sdPlugin/lib/keys");

const P = path.join(__dirname, "..", "se.wolfpack.idushamsterwheel.sdPlugin");
const ROOT = path.join(__dirname, "..");

// Hamster wheel glyph on a 40 × 40 grid: wheel with three spokes, stand, hamster at the bottom
const glyph = `<circle cx="20" cy="17" r="12"/><path d="M20 17 V5 M20 17 L9.6 11 M20 17 L30.4 11"/>` +
  `<path d="M14.5 27.5 L11 35 M25.5 27.5 L29 35 M8 35 H32"/>` +
  `<g fill="#ff9a3c" stroke="none"><ellipse cx="18.6" cy="24.4" rx="5" ry="2.9"/><circle cx="24" cy="23.2" r="2.4"/></g>`;
const listIcon = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
  `<rect width="40" height="40" fill="#262b36"/>` +
  `<g transform="translate(20 20) scale(${scale}) translate(-20 -20)" stroke="#ff9a3c" stroke-width="2.75">${glyph}</g></svg>`;
fs.mkdirSync(path.join(P, "imgs/actions"), { recursive: true });
fs.writeFileSync(path.join(P, "imgs/actions/wheel.svg"), listIcon(0.8));
fs.writeFileSync(path.join(P, "imgs/category.svg"), listIcon(1));

// Default key image (shown for a moment before the plugin draws): the sleeping hamster
const keySvg = Buffer.from(K.key({ on: false, label: "OFF", still: true }).split(",")[1], "base64").toString();
fs.writeFileSync(path.join(P, "imgs/key.svg"), keySvg);

// Plugin / app icon: IDUS · the running hamster · HAMSTER WHEEL
const big = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<rect x="16" y="16" width="480" height="480" rx="96" fill="#0f1115" stroke="#2a2f3a" stroke-width="6"/>
<text x="256" y="124" text-anchor="middle" font-family="Saira" font-weight="700" font-size="92" letter-spacing="4" fill="#ff9a3c">IDUS</text>
<g transform="translate(256 286) scale(2.45) translate(-72 -86)">${K.art(true, 2)}</g>
<text x="256" y="462" text-anchor="middle" font-family="Saira" font-weight="700" font-size="43" letter-spacing="2" fill="#ff9a3c">HAMSTER WHEEL</text></svg>`;
fs.writeFileSync(path.join(ROOT, "idus-hamster-wheel.svg"), big);

(async () => {
  const { chromium } = require("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  const shot = async (svg, size, out) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`)}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  };
  await shot(big, 512, path.join(ROOT, "idus-hamster-wheel.png"));
  await shot(big, 256, path.join(P, "imgs/plugin.png"));
  await shot(big, 512, path.join(P, "imgs/plugin@2x.png"));
  await shot(keySvg, 72, path.join(P, "imgs/key.png"));
  await shot(keySvg, 144, path.join(P, "imgs/key@2x.png"));
  await browser.close();
  console.log("icons done");
})();
