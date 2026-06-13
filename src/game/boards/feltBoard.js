// Placeholder second board: "Ashton's handmade anniversary board".
// Art TBD — until the image exists this reuses the sharpie image so the board
// still renders, and the coordinates are copied from sharpie as a starting point.
// TODO: drop in the real felt image and re-calibrate every coordinate below
// (use CALIBRATION_MODE in BackgammonBoard.jsx).

import placeholderImage from '../../assets/sharpie-board.png'; // TODO: replace with felt-board.png

export const feltBoard = {
  id: 'felt',
  name: 'Anniversary Felt',
  image: placeholderImage,

  // TODO: calibrate — copied from sharpie (traditional orientation) and will
  // not line up with the real felt art.
  points: {
    0:  { x: 84.7, y: 82.0 }, 1:  { x: 78.5, y: 82.1 }, 2:  { x: 72.9, y: 82.1 },
    3:  { x: 67.4, y: 82.1 }, 4:  { x: 62.3, y: 82.2 }, 5:  { x: 56.3, y: 82.3 },
    6:  { x: 43.5, y: 81.8 }, 7:  { x: 38.4, y: 82.4 }, 8:  { x: 32.7, y: 82.7 },
    9:  { x: 26.9, y: 82.7 }, 10: { x: 21.0, y: 83.1 }, 11: { x: 15.2, y: 83.0 },
    12: { x: 16.2, y: 15.8 }, 13: { x: 21.9, y: 15.8 }, 14: { x: 27.6, y: 15.8 },
    15: { x: 32.9, y: 15.6 }, 16: { x: 38.5, y: 15.1 }, 17: { x: 43.8, y: 15.2 },
    18: { x: 56.2, y: 15.2 }, 19: { x: 61.1, y: 15.2 }, 20: { x: 66.2, y: 14.6 },
    21: { x: 72.1, y: 15.1 }, 22: { x: 77.2, y: 14.6 }, 23: { x: 82.7, y: 15.0 },
  },
  bar: {
    ashton:  { x: 49.9, y: 52.9 },
    charlie: { x: 49.8, y: 40.4 },
  },
  bearOff: {
    ashton:  { x: 96.3, y: 63.2 },
    charlie: { x: 96.3, y: 30.0 },
  },
  stackDirection: { bottom: 'up', top: 'down', barAshton: 'up', barCharlie: 'down' },
  checkerSize: 6.8,
  stackStep: 7.0,
};
