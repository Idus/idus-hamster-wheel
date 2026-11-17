// The hamster wheel glyph on a 40 × 40 grid (wheel, three spokes, stand, hamster at the bottom).
// color: stroke and hamster colour. Used by make-icons.cjs (orange) and build-elgato.cjs (white).
module.exports = (color) => `<circle cx="20" cy="17" r="12"/><path d="M20 17 V5 M20 17 L9.6 11 M20 17 L30.4 11"/>` +
  `<path d="M14.5 27.5 L11 35 M25.5 27.5 L29 35 M8 35 H32"/>` +
  `<g fill="${color}" stroke="none"><ellipse cx="18.6" cy="24.4" rx="5" ry="2.9"/><circle cx="24" cy="23.2" r="2.4"/></g>`;
