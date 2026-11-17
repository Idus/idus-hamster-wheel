// Builds the icons: action-list glyph and category icon (orange on the Idus blue-grey, like
// Idus SC Deck), the default key image, the plugin icon and the 512 px app icon in the repo root
// (used by README and Idus GitHub Updater). PNGs via Playwright. Run: node dev/make-icons.cjs
const fs = require("node:fs");
const path = require("node:path");
const K = require("../se.wolfpack.idushamsterwheel.sdPlugin/lib/keys");

const P = path.join(__dirname, "..", "se.wolfpack.idushamsterwheel.sdPlugin");
const ROOT = path.join(__dirname, "..");

const glyph = require("./icon-glyph.cjs")("#ff9a3c");
const listIcon = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
  `<rect width="40" height="40" fill="#262b36"/>` +
  `<g transform="translate(20 20) scale(${scale}) translate(-20 -20)" stroke="#ff9a3c" stroke-width="2.75">${glyph}</g></svg>`;
fs.mkdirSync(path.join(P, "imgs/actions"), { recursive: true });
fs.writeFileSync(path.join(P, "imgs/actions/wheel.svg"), listIcon(0.8));
fs.writeFileSync(path.join(P, "imgs/category.svg"), listIcon(1));

// Default key image (shown for a moment before the plugin draws): the sleeping hamster
const keySvg = Buffer.from(K.key({ on: false, label: "OFF", still: true }).split(",")[1], "base64").toString();
fs.writeFileSync(path.join(P, "imgs/key.svg"), keySvg);

// Plugin / app icon in the style of the other Idus app icons (GitHub Updater, SC Toolbox, Elgato
// Light): glossy rounded frame, dark teal glow, faint reticle and code lines, a teal haze at the
// bottom, orange IDUS on top and the name below — here with the running hamster in the middle.
const CODE_L = ["hamster.run()", "if (away) brb();", "nudge(1, 0)", "  wheel.turn(90)", "zzz.rise()"];
const CODE_R = ["// back in 5", "awake = true;", "  moves++;", "offAt(1h)", "{ BRB }"];
const big = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<defs>
  <clipPath id="sq"><rect x="14" y="14" width="484" height="484" rx="118"/></clipPath>
  <radialGradient id="bg" cx="0.5" cy="0.54" r="0.62"><stop offset="0" stop-color="#134846"/><stop offset="0.42" stop-color="#0b2427"/><stop offset="1" stop-color="#04080a"/></radialGradient>
  <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#2ad1b2" stop-opacity="0.32"/><stop offset="1" stop-color="#2ad1b2" stop-opacity="0"/></radialGradient>
  <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6f9"/><stop offset="0.55" stop-color="#c3c9d1"/><stop offset="1" stop-color="#7d8590"/></linearGradient>
  <filter id="haze" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="26"/></filter>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.2"/></filter>
  <filter id="txt" x="-20%" y="-40%" width="140%" height="180%"><feDropShadow dx="0" dy="0" stdDeviation="7" flood-color="#ff9a3c" flood-opacity="0.35"/></filter>
</defs>
<g clip-path="url(#sq)">
  <rect width="512" height="512" fill="url(#bg)"/>
  <ellipse cx="256" cy="540" rx="300" ry="120" fill="#27c2a8" opacity="0.5" filter="url(#haze)"/>
  <ellipse cx="256" cy="508" rx="190" ry="10" fill="#7ff0dc" opacity="0.35" filter="url(#haze)"/>
  <g stroke="#57d6c4" fill="none" stroke-width="1.4">
    <circle cx="256" cy="286" r="172" opacity="0.16"/><circle cx="256" cy="286" r="128" opacity="0.1" stroke-dasharray="3 7"/>
    <path d="M28 286 H484 M256 150 V430" opacity="0.14"/>
    <path d="M84 286 v-8 M428 286 v-8 M256 114 h8 M256 458 h8" opacity="0.3"/>
    <path d="M40 200 h44 l18 18 h30 M472 200 h-44 l-18 18 h-30 M40 372 h52 l14 -14 h26 M472 372 h-52 l-14 -14 h-26" opacity="0.2"/>
  </g>
  <g fill="#57d6c4"><rect x="62" y="282" width="8" height="8" opacity="0.45"/><rect x="442" y="282" width="8" height="8" opacity="0.45"/>
    <circle cx="132" cy="218" r="3" opacity="0.4"/><circle cx="380" cy="218" r="3" opacity="0.4"/><circle cx="132" cy="358" r="3" opacity="0.4"/><circle cx="380" cy="358" r="3" opacity="0.4"/></g>
  <g font-family="JetBrains Mono" font-size="12.5" fill="#7fe0d0" opacity="0.2" filter="url(#soft)">
    ${CODE_L.map((t, i) => `<text x="38" y="${158 + i * 18}">${t}</text>`).join("")}
    ${CODE_R.map((t, i) => `<text x="474" y="${392 + i * 18}" text-anchor="end">${t}</text>`).join("")}
  </g>
  <circle cx="256" cy="282" r="170" fill="url(#glow)"/>
  <g transform="translate(256 284) scale(2.3) translate(-72 -86)">${K.art(true, 2)}</g>
  <text x="256" y="120" text-anchor="middle" font-family="Saira" font-weight="700" font-size="96" letter-spacing="3" fill="#ff9a3c" filter="url(#txt)">IDUS</text>
  <text x="256" y="458" text-anchor="middle" font-family="IBM Plex Sans" font-weight="700" font-size="54" fill="#ff9a3c" filter="url(#txt)">Hamster wheel</text>
</g>
<rect x="18.5" y="18.5" width="475" height="475" rx="114" fill="none" stroke="#0a1012" stroke-width="3"/>
<rect x="14" y="14" width="484" height="484" rx="118" fill="none" stroke="url(#rim)" stroke-width="9"/>
</svg>`;
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
  // Windows tray icon (Elgato edition): the glyph on a dark rounded square, 16–64 px in one .ico
  const tray = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 40 40" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    `<rect x="0.5" y="0.5" width="39" height="39" rx="8" fill="#16181d"/><g stroke="#ff9a3c" stroke-width="3.2">${glyph}</g></svg>`;
  const tmp = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "hw-ico-"));
  const sizes = [16, 24, 32, 48, 64];
  for (const n of sizes) await shot(tray, n, path.join(tmp, `${n}.png`));
  require("node:child_process").execFileSync("convert", [...sizes.map((n) => path.join(tmp, `${n}.png`)), path.join(P, "imgs/tray.ico")]);
  fs.rmSync(tmp, { recursive: true, force: true });
  await browser.close();
  console.log("icons done");
})();
