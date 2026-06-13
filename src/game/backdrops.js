// Swappable game backdrops — the surface the backgammon board sits on.
// Data-driven: each entry is identity + a purely-CSS visual (a base gradient
// plus an optional faint texture). Add more here and they're available
// everywhere (game screen, shop). The board image + pieces always render on
// top, unchanged — a backdrop should recede and complement, never compete.
//
//   id, name, description, cost
//   gradient — the base CSS background (a gradient that reads as a lit surface)
//   texture  — optional CSS background-image layered ON TOP of the gradient,
//              its low opacity baked into the rgba so it's barely perceptible

export const BACKDROPS = [
  {
    id: 'default',
    name: 'Moving Day Cream',
    description: 'The warm cream we started on.',
    cost: 0,
    gradient: 'linear-gradient(160deg, #f5e8c8 0%, #eedcaa 50%, #e5cc90 100%)',
    texture: null,
  },
  {
    id: 'pink',
    name: 'Pink, as requested',
    description: 'She asked. Obviously.',
    cost: 200,
    // Dusty rose, lit from the top — lighter center-top, deepening to the edges
    gradient: 'radial-gradient(125% 105% at 50% 14%, #ddb3b0 0%, #d4a5a5 46%, #c8918f 100%)',
    // Faint linen weave (a soft cross-hatch), opacity baked low into the rgba
    texture:
      'repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 6px), ' +
      'repeating-linear-gradient(-45deg, rgba(150,95,95,0.05) 0 1px, transparent 1px 6px)',
  },
];

export const BACKDROP_BY_ID = Object.fromEntries(BACKDROPS.map(b => [b.id, b]));

// Full CSS `background` value for a backdrop (texture layered over the gradient).
// Used both full-screen (game) and as a small swatch (shop). Falls back to the
// default backdrop for unknown ids.
export function backdropBackground(id) {
  const b = BACKDROP_BY_ID[id] ?? BACKDROP_BY_ID.default;
  return [b.texture, b.gradient].filter(Boolean).join(', ');
}
