// Writes manifest.json. Run: node dev/make-manifest.cjs
const fs = require("node:fs");
const path = require("node:path");
const ID = "se.wolfpack.idushamsterwheel";
const VERSION = "1.0.1";

const manifest = {
  Name: "Idus Hamster Wheel",
  UUID: ID,
  Version: VERSION,
  Author: "Idus",
  Description: "Keeps your computer awake from one key: press it and a hamster runs, the screen does not lock and the mouse gets a tiny nudge on a timer (Zen, Nudge, Circle or Random — or stay awake without moving it). Turns itself off after the time you choose, shows a notification with a Stop button, and the hamster sleeps when it is off. Linux (Wayland and X11). Made by Idus with AI assistance (Claude).",
  URL: "https://github.com/Idus/idus-hamster-wheel",
  Icon: "imgs/plugin",
  Category: "Idus Hamster Wheel",
  CategoryIcon: "imgs/category",
  SDKVersion: 2,
  CodePath: "plugin.js",
  CodePathLin: "plugin.js",
  Software: { MinimumVersion: "6.5" },
  OS: [{ Platform: "linux", MinimumVersion: "0" }],
  Actions: [{
    Name: "BRB · Hamster Wheel",
    UUID: `${ID}.wheel`,
    Icon: "imgs/actions/wheel",
    Tooltip: "Press to keep the computer awake while you are away — the hamster runs, the mouse gets a tiny nudge on a timer and it turns itself off after the time you choose. Press again to stop.",
    Controllers: ["Keypad"],
    SupportedInMultiActions: false,
    DisableAutomaticStates: true,
    PropertyInspectorPath: "pi/wheel.html",
    States: [{ Image: "imgs/key", ShowTitle: false }],
  }],
};
fs.writeFileSync(path.join(__dirname, "..", `${ID}.sdPlugin`, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log("manifest", VERSION);
