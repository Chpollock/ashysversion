// Board config for the hand-drawn Sharpie board.
//
// All coordinates are PERCENTAGES relative to the rendered board image:
//   x → % of image width   (left=0, right=100)
//   y → % of image height  (top=0, bottom=100)
//
// points[n] = center of the FIRST (outermost) checker on that point.
//   Subsequent checkers stack inward — direction comes from stackDirection.
//
// TRADITIONAL backgammon orientation: both home boards are on the RIGHT and
// both players bear off to the RIGHT. Ashton's home (pts 0–5) is bottom-right,
// Charlie's home (pts 18–23) is top-right.
//
//  Top:    12  13  14  15  16  17 | BAR | 18  19  20  21  22  23
//  Bottom: 11  10   9   8   7   6 | BAR |  5   4   3   2   1   0
//                                              right edge = home + bear-off ↑
//
//  Ashton (cream): 2 back checkers start top-right (Charlie's home), travel
//    counter-clockwise — left across the top, down the left, right along the
//    bottom — into the bottom-right home (pt 0), then bear off right.
//
// The board art is left-right symmetric, so these are the sharpie triangle
// positions mirrored to the traditional side. Run `npm run dev`, set
// CALIBRATION_MODE = true in BackgammonBoard.jsx to re-measure if needed.

import boardImage from '../../assets/sharpie-board.png';

export const sharpieBoard = {
  id: 'sharpie',
  image: boardImage,

  // ── Point anchors (first/outermost checker center) ──────────────────────────
  points: {
    // Bottom row — RIGHT quadrant (Ashton's home, points 0–5)
    0:  { x: 84.7, y: 82.0 },
    1:  { x: 78.5, y: 82.1 },
    2:  { x: 72.9, y: 82.1 },
    3:  { x: 67.4, y: 82.1 },
    4:  { x: 62.3, y: 82.2 },
    5:  { x: 56.3, y: 82.3 },

    // Bottom row — LEFT quadrant (points 6–11)
    6:  { x: 43.5, y: 81.8 },
    7:  { x: 38.4, y: 82.4 },
    8:  { x: 32.7, y: 82.7 },
    9:  { x: 26.9, y: 82.7 },
    10: { x: 21.0, y: 83.1 },
    11: { x: 15.2, y: 83.0 },

    // Top row — LEFT quadrant (points 12–17)
    12: { x: 16.2, y: 15.8 },
    13: { x: 21.9, y: 15.8 },
    14: { x: 27.6, y: 15.8 },
    15: { x: 32.9, y: 15.6 },
    16: { x: 38.5, y: 15.1 },
    17: { x: 43.8, y: 15.2 },

    // Top row — RIGHT quadrant (Charlie's home, points 18–23)
    18: { x: 56.2, y: 15.2 },
    19: { x: 61.1, y: 15.2 },
    20: { x: 66.2, y: 14.6 },
    21: { x: 72.1, y: 15.1 },
    22: { x: 77.2, y: 14.6 },
    23: { x: 82.7, y: 15.0 },
  },

  // ── Bar ─────────────────────────────────────────────────────────────────────
  bar: {
    ashton:  { x: 49.9, y: 52.9 },
    charlie: { x: 49.8, y: 40.4 },
  },

  // ── Bear-off indicator ───────────────────────────────────────────────────────
  // Both players bear off to the RIGHT edge (their home side).
  bearOff: {
    ashton:  { x: 96.3, y: 63.2 },
    charlie: { x: 96.3, y: 30.0 },
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
