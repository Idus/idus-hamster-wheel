// Builds the Elgato Stream Deck (Windows) edition from the same code as the OpenDeck plugin:
//   build/elgato/se.wolfpack.idushamsterwheel.sdPlugin/          the plugin folder
//   build/elgato/se.wolfpack.idushamsterwheel.streamDeckPlugin    double-click to install, or upload to Maker Console
// Differences: Elgato's SDK instead of lib/sdk.js (dev/elgato/sdk-elgato.cjs), key text drawn as
// outlines (dev/elgato/glyphs.json), white action-list icons, the Windows helper
// (lib/hamster-win.ps1 + imgs/tray.ico), the settings page with data-target="elgato".
// Once: cd dev && npm install.  Then: node dev/build-elgato.cjs
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const ID = "se.wolfpack.idushamsterwheel";
const SRC = path.join(ROOT, `${ID}.sdPlugin`);
const OUTDIR = path.join(ROOT, "build", "elgato");
const PLUG = path.join(OUTDIR, `${ID}.sdPlugin`);
const glyph = require("./icon-glyph.cjs");

const src = JSON.parse(fs.readFileSync(path.join(SRC, "manifest.json"), "utf8"));
// 1.1 -> 1.1.0.<build>; ELGATO_BUILD=n bumps the last part so a test build installs over the previous one
const VERSION = `${src.Version}.0.0`.split(".").slice(0, 3).concat(String(Number(process.env.ELGATO_BUILD || 0))).join(".");

const manifest = {
  $schema: "https://schemas.elgato.com/streamdeck/plugins/manifest.json",
  Name: src.Name,
  UUID: ID,
  Version: VERSION,
  Author: src.Author,
  Description: "Keeps your computer awake from one key: press it and a hamster runs, the screen does not lock and the mouse gets a tiny nudge on a timer (Zen, Nudge, Circle or Random — or stay awake without moving it). Always turns itself off after the time you choose (15 min – 4 h), shows a hamster in the system tray with a Stop item, and sleeps on the key when it is off. Made by Idus with AI assistance (Claude).",
  URL: "https://github.com/Idus/idus-hamster-wheel",
  SupportURL: "https://github.com/Idus/idus-hamster-wheel/issues",
  Icon: "imgs/plugin",
  Category: src.Category,
  CategoryIcon: "imgs/category",
  CodePath: "bin/plugin.js",
  Nodejs: { Version: "24", Debug: "disabled" },
  SDKVersion: 3,
  Software: { MinimumVersion: "7.1" },
  OS: [{ Platform: "windows", MinimumVersion: "10" }],
  Actions: [{
    Name: "BRB · Hamster Wheel",
    UUID: `${ID}.wheel`,
    Icon: "imgs/actions/wheel",
    Tooltip: "Press to keep the computer awake while you are away — the hamster runs, the mouse gets a tiny nudge on a timer and it turns itself off after the time you choose. Press again to stop.",
    Controllers: ["Keypad"], SupportedInMultiActions: false, DisableAutomaticStates: true, UserTitleEnabled: false,
    PropertyInspectorPath: "pi/wheel.html",
    States: [{ Image: "imgs/key", ShowTitle: false }],
  }],
};

// Elgato's guideline: monochrome white action and category icons on a transparent background
const whiteIcon = (size, scale) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
  `<g transform="translate(20 20) scale(${scale}) translate(-20 -20)" stroke="#ffffff" stroke-width="2.75">${glyph("#ffffff")}</g></svg>`;

(async () => {
  fs.rmSync(OUTDIR, { recursive: true, force: true });
  for (const d of ["imgs/actions", "pi", "bin"]) fs.mkdirSync(path.join(PLUG, d), { recursive: true });
  fs.writeFileSync(path.join(PLUG, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  // one bundled bin/plugin.js; lib/sdk.js is swapped for the Elgato adapter
  const esbuild = require("esbuild");
  await esbuild.build({
    entryPoints: [path.join(SRC, "plugin.js")],
    outfile: path.join(PLUG, "bin", "plugin.js"),
    bundle: true, platform: "node", target: "node24", format: "cjs", legalComments: "eof", logLevel: "warning",
    define: { __IDUS_ACTIONS__: JSON.stringify(manifest.Actions.map((a) => a.UUID)) },
    plugins: [{
      name: "elgato-sdk",
      setup(b) { b.onResolve({ filter: /^\.\/lib\/sdk(\.js)?$/ }, () => ({ path: path.join(__dirname, "elgato", "sdk-elgato.cjs") })); },
    }],
  });
  // the Windows helper sits next to the bundle (desktop-win.js looks for it in its own folder)
  fs.copyFileSync(path.join(SRC, "lib", "hamster-win.ps1"), path.join(PLUG, "bin", "hamster-win.ps1"));

  for (const f of ["plugin.png", "plugin@2x.png", "key.png", "key@2x.png", "tray.ico"]) fs.copyFileSync(path.join(SRC, "imgs", f), path.join(PLUG, "imgs", f));
  fs.writeFileSync(path.join(PLUG, "imgs", "actions", "wheel.svg"), whiteIcon(20, 0.8));
  fs.writeFileSync(path.join(PLUG, "imgs", "category.svg"), whiteIcon(28, 1));

  fs.writeFileSync(path.join(PLUG, "pi", "wheel.html"),
    fs.readFileSync(path.join(SRC, "pi", "wheel.html"), "utf8").replace('data-target="opendeck"', 'data-target="elgato"'));
  for (const f of ["pi.css", "pi.js"]) fs.copyFileSync(path.join(SRC, "pi", f), path.join(PLUG, "pi", f));
  fs.copyFileSync(path.join(SRC, "LICENSE"), path.join(PLUG, "LICENSE"));
  fs.writeFileSync(path.join(PLUG, "THIRD_PARTY_NOTICES.md"), "# Third-party notices\n\n" +
    "## Fonts\n\nThe key text is drawn from glyph outlines of Saira, IBM Plex Sans and JetBrains Mono — SIL Open Font\n" +
    "License 1.1 (https://openfontlicense.org), from Google Fonts. The settings page uses the fonts if installed.\n\n" +
    "## Elgato Stream Deck SDK\n\n@elgato/streamdeck — MIT License, Corsair Memory Inc. (bundled in bin/plugin.js).\n");

  // validate + pack with Elgato's CLI (run its script directly: also works after npm install --no-bin-links)
  const cli = path.join(__dirname, "node_modules", "@elgato", "cli", "bin", "streamdeck.mjs");
  execFileSync(process.execPath, [cli, "pack", PLUG, "-o", OUTDIR, "-f", "--no-update-check", "--no-file-list"], { stdio: "inherit" });
  console.log(`\n✓ ${path.relative(ROOT, OUTDIR)}/${ID}.streamDeckPlugin  (v${VERSION})`);
})().catch((e) => { console.error(e); process.exit(1); });
