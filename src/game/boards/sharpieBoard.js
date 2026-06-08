// Board config for the hand-drawn Sharpie board.
//
// All coordinates are PERCENTAGES relative to the rendered board image:
//   x → % of image width   (left=0, right=100)
//   y → % of image height  (top=0, bottom=100)
//
// points[n] = center of the FIRST (outermost) checker on that point.
//   Subsequent checkers stack inward — direction comes from stackDirection.
//
// Layout (Ashton moves 23→0, Charlie moves 0→23):
//
//  Top:    23  22  21  20  19  18 | BAR | 17  16  15  14  13  12
//  Bottom:  0   1   2   3   4   5 | BAR |  6   7   8   9  10  11
//           ↑ left edge                ↑ bar          ↑ right edge
//
//  Ashton (cream): starts top-left (pt 23), moves right across top,
//    turns at top-right, comes back left along bottom, ends bottom-left (pt 0).
//  Charlie (brown): mirror path.
//
// Run `npm run dev`, set CALIBRATION_MODE = true in BackgammonBoard.jsx,
// tap each triangle tip in point order (0→23 then bar, then bear-off),
// read the console, paste the values here, set CALIBRATION_MODE back to false.

import boardImage from '../../assets/sharpie-board.png';

export const sharpieBoard = {
  id: 'sharpie',
  image: boardImage,

  // ── Point anchors (first/outermost checker center) ──────────────────────────
  // TODO: calibrate — these are mirrored placeholders, not yet measured
  points: {
    // Bottom row — LEFT quadrant (Ashton's home, points 0–5)
    0:  { x: 15.2, y: 83.0 },
    1:  { x: 21.0, y: 83.1 },
    2:  { x: 26.9, y: 82.7 },
    3:  { x: 32.7, y: 82.7 },
    4:  { x: 38.4, y: 82.4 },
    5:  { x: 43.5, y: 81.8 },

    // Bottom row — RIGHT quadrant (points 6–11)
    6:  { x: 56.3, y: 82.3 },
    7:  { x: 62.3, y: 82.2 },
    8:  { x: 67.4, y: 82.1 },
    9:  { x: 72.9, y: 82.1 },
    10: { x: 78.5, y: 82.1 },
    11: { x: 84.7, y: 82.0 },

    // Top row — RIGHT quadrant (points 12–17)
    12: { x: 82.7, y: 15.0 },
    13: { x: 77.2, y: 14.6 },
    14: { x: 72.1, y: 15.1 },
    15: { x: 66.2, y: 14.6 },
    16: { x: 61.1, y: 15.2 },
    17: { x: 56.2, y: 15.2 },

    // Top row — LEFT quadrant (Charlie's home, points 18–23)
    18: { x: 43.8, y: 15.2 },
    19: { x: 38.5, y: 15.1 },
    20: { x: 32.9, y: 15.6 },
    21: { x: 27.6, y: 15.8 },
    22: { x: 21.9, y: 15.8 },
    23: { x: 16.2, y: 15.8 },
  },

  // ── Bar ─────────────────────────────────────────────────────────────────────
  bar: {
    ashton:  { x: 50.1, y: 52.9 },
    charlie: { x: 50.2, y: 40.4 },
  },

  // ── Bear-off indicator ───────────────────────────────────────────────────────
  // Both players bear off to the left edge of the board.
  // charlie's y is estimated as the mirror of ashton's around the bar midpoint (~46.6%).
  bearOff: {
    ashton:  { x: 3.7, y: 63.2 },
    charlie: { x: 3.7, y: 30.0 },
  },

  // ── Stacking ─────────────────────────────────────────────────────────────────
  stackDirection: {
    bottom: 'up',       // bottom-row points stack toward board center (y decreases)
    top:    'down',     // top-row points stack toward board center (y increases)
    barAshton:  'up',   // Ashton's bar pieces stack upward
    barCharlie: 'down', // Charlie's bar pieces stack downward
  },

  checkerSize: 6.8,   // checker diameter as % of board width
  stackStep:   7.0,   // vertical gap between stacked checkers as % of board height
                      // (< checkerSize×(W/H) so pieces overlap slightly, like real checkers)
};
