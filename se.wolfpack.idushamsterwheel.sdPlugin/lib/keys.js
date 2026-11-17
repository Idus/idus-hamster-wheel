// Key images for Idus Hamster Wheel, in the Idus look: the same card, orange tab and status lamp
// as the Idus SC Deck keys. 144 × 144 SVG; the plugin animates by sending a new frame.
//   ON  — an orange hamster runs, the wheel turns clockwise (it runs right, so the bottom moves left)
//   OFF — the wheel stands still, the hamster sleeps and breathes, three z's rise and fade
"use strict";

const C = {
  bg: "#16181d", surface: "#1e222b", deep: "#0f1115", line: "#2a2f3a", fg: "#e8eaed",
  muted: "#8a93a3", soft: "#9fb4d4", dim: "#5a6270", title: "#ffd9a0", accent: "#ff9a3c",
  ok: "#46d160", warn: "#ffb13c", error: "#e0525b",
};
const RUN_FRAMES = 12;    // one loop turns the wheel 90° (4 spokes, 8 rungs) → seamless
const LOOP_DEG = 90;
const SLEEP_FRAMES = 24;
const RUN_MS = 100;       // frame time while running (10 fps)
const SLEEP_MS = 150;     // frame time while asleep (calmer)
const CX = 72, CY = 76, R = 40;
const MONO = "JetBrains Mono, DejaVu Sans Mono, monospace";
const DISPLAY = "Saira, IBM Plex Sans, sans-serif";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const n = (x) => Number(x.toFixed(1));

function wheel(rot, on) {
  const rim = on ? C.soft : C.dim;
  let s = `<line x1="${CX}" y1="${CY}" x2="${CX - 24}" y2="134" stroke="${C.line}" stroke-width="5" stroke-linecap="round"/>` +
    `<line x1="${CX}" y1="${CY}" x2="${CX + 24}" y2="134" stroke="${C.line}" stroke-width="5" stroke-linecap="round"/>` +
    `<line x1="${CX - 34}" y1="135" x2="${CX + 34}" y2="135" stroke="${C.line}" stroke-width="4" stroke-linecap="round"/>` +
    `<circle cx="${CX}" cy="${CY}" r="${R}" fill="${C.surface}" stroke="${rim}" stroke-width="3"/>` +
    `<g transform="rotate(${n(rot)} ${CX} ${CY})">`;
  for (let i = 0; i < 4; i++) { // spokes
    const a = ((i * 90 + 45) * Math.PI) / 180;
    s += `<line x1="${CX}" y1="${CY}" x2="${n(CX + Math.cos(a) * (R - 2))}" y2="${n(CY + Math.sin(a) * (R - 2))}" stroke="${on ? "#3c4453" : C.line}" stroke-width="3" stroke-linecap="round"/>`;
  }
  for (let i = 0; i < 8; i++) { // rungs on the running surface: few and thick, so the turning shows
    const a = (i * 45 * Math.PI) / 180, c = Math.cos(a), si = Math.sin(a);
    s += `<line x1="${n(CX + c * (R - 12))}" y1="${n(CY + si * (R - 12))}" x2="${n(CX + c * (R - 4))}" y2="${n(CY + si * (R - 4))}" stroke="${rim}" stroke-width="4.5" stroke-linecap="round"/>`;
  }
  return s + `</g><circle cx="${CX}" cy="${CY}" r="4" fill="${C.muted}"/>`;
}

function runner(f) {
  const ph = (f / RUN_FRAMES) * Math.PI * 4; // two strides per loop
  const y = 100 + Math.sin(ph * 2) * 1.2;
  const leg = (x, p) => `<line x1="${x}" y1="${n(y + 5)}" x2="${n(x + Math.sin(ph + p) * 5)}" y2="111" stroke="${C.accent}" stroke-width="2.4" stroke-linecap="round"/>`;
  const tw = Math.sin(ph) * 4;
  return leg(64, 0) + leg(68, Math.PI) + leg(79, Math.PI) + leg(83, 0) +
    `<path d="M58 ${n(y + 1)} Q 48 ${n(y - 4 + tw)} 42 ${n(y - 10 - tw)}" fill="none" stroke="${C.accent}" stroke-width="2" stroke-linecap="round"/>` +
    `<ellipse cx="71" cy="${n(y)}" rx="14" ry="8" fill="${C.accent}"/>` +
    `<circle cx="85" cy="${n(y - 3)}" r="6.5" fill="${C.accent}"/>` +
    `<circle cx="82.5" cy="${n(y - 10)}" r="3.8" fill="${C.title}"/>` +
    `<circle cx="88" cy="${n(y - 4.5)}" r="1.3" fill="${C.bg}"/>` +
    `<circle cx="91.6" cy="${n(y - 2)}" r="1.4" fill="${C.title}"/>`;
}

function zzz(f, still) {
  if (still) {
    return `<text x="96" y="94" font-family="${DISPLAY}" font-weight="700" font-size="11" fill="${C.soft}">z</text>` +
      `<text x="103" y="85" font-family="${DISPLAY}" font-weight="700" font-size="14" fill="${C.soft}">z</text>`;
  }
  let s = "";
  for (let k = 0; k < 3; k++) { // three z's a third of a loop apart, rising up-right and fading
    const t = ((f / SLEEP_FRAMES) + k / 3) % 1;
    const op = t < 0.15 ? t / 0.15 : t > 0.7 ? (1 - t) / 0.3 : 1;
    s += `<text x="${n(94 + t * 16)}" y="${n(98 - t * 34)}" font-family="${DISPLAY}" font-weight="700" font-size="${n(8 + t * 9)}" fill="${C.soft}" opacity="${op.toFixed(2)}">z</text>`;
  }
  return s;
}

function sleeper(f, still) {
  const br = still ? 0 : Math.sin((f / SLEEP_FRAMES) * Math.PI * 2) * 0.6; // breathing
  return `<path d="M57 104 Q 50 110 60 111" fill="none" stroke="${C.dim}" stroke-width="2" stroke-linecap="round"/>` +
    `<ellipse cx="72" cy="${n(104 - br / 2)}" rx="15" ry="${n(7.5 + br)}" fill="${C.dim}"/>` +
    `<circle cx="85" cy="105" r="6" fill="${C.dim}"/>` +
    `<circle cx="83" cy="99" r="3.5" fill="${C.muted}"/>` +
    `<path d="M85.5 105 q 2 1.6 4 0" fill="none" stroke="${C.bg}" stroke-width="1.2" stroke-linecap="round"/>` +
    zzz(f, still);
}

// Card, orange "BRB" tab, a label beside it and the status lamp — as on the Idus SC Deck keys
function head(label, labelColor, lamp) {
  const w = 3 * 7.3 + 14;
  const lamps = {
    ok: `<circle cx="128" cy="25.5" r="8.5" fill="${C.ok}" opacity="0.18"/><circle cx="128" cy="25.5" r="5" fill="${C.ok}"/>`,
    warn: `<circle cx="128" cy="25.5" r="8.5" fill="${C.warn}" opacity="0.18"/><circle cx="128" cy="25.5" r="5" fill="${C.warn}"/>`,
    error: `<circle cx="128" cy="25.5" r="5" fill="${C.error}"/>`,
    idle: `<circle cx="128" cy="25.5" r="5" fill="${C.dim}"/>`,
  };
  return `<rect width="144" height="144" fill="${C.bg}"/>` +
    `<rect x="4.5" y="4.5" width="135" height="135" rx="16" fill="${C.deep}" stroke="${lamp === "error" ? C.error : C.line}" stroke-width="${lamp === "error" ? 2.5 : 1.5}"/>` +
    `<rect x="13" y="15" width="${w}" height="21" rx="6" fill="${C.surface}" stroke="${C.accent}" stroke-width="1.3"/>` +
    `<text x="${n(13 + w / 2)}" y="29.5" text-anchor="middle" font-family="${MONO}" font-weight="700" font-size="11" letter-spacing="0.8" fill="${C.accent}">BRB</text>` +
    `<text x="${n(13 + w + 6)}" y="33" font-family="${MONO}" font-weight="700" font-size="20" fill="${labelColor}">${esc(label)}</text>` +
    (lamps[lamp] || lamps.idle);
}

const url = (body) => "data:image/svg+xml;base64," +
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">${body}</svg>`).toString("base64");

// on: running? f: frame number · label: text beside the tab · lamp: ok | warn | idle · still: no animation
function key({ on, f = 0, label, lamp, still = false }) {
  const rot = on ? (f % RUN_FRAMES) * (LOOP_DEG / RUN_FRAMES) : 0;
  return url(head(label, on ? C.title : C.muted, lamp || (on ? "ok" : "idle")) +
    `<g transform="translate(72 43) scale(0.86) translate(-72 -34.5)">` +
    wheel(rot, on) + (on ? runner(f % RUN_FRAMES) : sleeper(f % SLEEP_FRAMES, still)) + `</g>`);
}

// A problem, shown for a few seconds: big title, the reason (wrapped) and a muted sub line
function problem({ title, reason, sub }) {
  const words = String(reason || "").split(" "), lines = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && (last + " " + w).length <= 17) lines[lines.length - 1] = last + " " + w;
    else lines.push(w);
  }
  const body = lines.slice(0, 3).map((l, i) =>
    `<text x="72" y="${92 + i * 15}" text-anchor="middle" font-family="${MONO}" font-weight="500" font-size="11.5" fill="${C.fg}">${esc(l)}</text>`).join("");
  return url(head("ERR", C.error, "error") +
    `<text x="72" y="70" text-anchor="middle" font-family="${DISPLAY}" font-weight="700" font-size="21" letter-spacing="1" fill="${C.error}">${esc(title)}</text>` +
    body + (sub ? `<text x="72" y="130" text-anchor="middle" font-family="${MONO}" font-weight="500" font-size="10.5" fill="${C.muted}">${esc(sub)}</text>` : ""));
}

// The wheel and hamster alone (key coordinates, 144 wide) — for the plugin icon
const art = (on, f = 0) => wheel(on ? (f % RUN_FRAMES) * (LOOP_DEG / RUN_FRAMES) : 0, on) + (on ? runner(f % RUN_FRAMES) : sleeper(f % SLEEP_FRAMES, true));

module.exports = { key, problem, art, C, RUN_FRAMES, SLEEP_FRAMES, RUN_MS, SLEEP_MS };
