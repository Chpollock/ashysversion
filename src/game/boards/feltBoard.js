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

  // TODO: calibrate — these are copied from sharpie and will not line up
  // with the real felt art.
  points: {
    0:  { x: 15.2, y: 83.0 }, 1:  { x: 21.0, y: 83.1 }, 2:  { x: 26.9, y: 82.7 },
    3:  { x: 32.7, y: 82.7 }, 4:  { x: 38.4, y: 82.4 }, 5:  { x: 43.5, y: 81.8 },
    6:  { x: 56.3, y: 82.3 }, 7:  { x: 62.3, y: 82.2 }, 8:  { x: 67.4, y: 82.1 },
    9:  { x: 72.9, y: 82.1 }, 10: { x: 78.5, y: 82.1 }, 11: { x: 84.7, y: 82.0 },
    12: { x: 82.7, y: 15.0 }, 13: { x: 77.2, y: 14.6 }, 14: { x: 72.1, y: 15.1 },
    15: { x: 66.2, y: 14.6 }, 16: { x: 61.1, y: 15.2 }, 17: { x: 56.2, y: 15.2 },
    18: { x: 43.8, y: 15.2 }, 19: { x: 38.5, y: 15.1 }, 20: { x: 32.9, y: 15.6 },
    21: { x: 27.6, y: 15.8 }, 22: { x: 21.9, y: 15.8 }, 23: { x: 16.2, y: 15.8 },
  },
  bar: {
    ashton:  { x: 50.1, y: 52.9 },
    charlie: { x: 50.2, y: 40.4 },
  },
  bearOff: {
    ashton:  { x: 3.7, y: 63.2 },
    charlie: { x: 3.7, y: 30.0 },
  },
  stackDirection: { bottom: 'up', top: 'down', barAshton: 'up', barCharlie: 'down' },
  checkerSize: 6.8,
  stackStep: 7.0,
};
