// Registry of all board skins.
// Add a new board here and it becomes available throughout the app.

import { sharpieBoard } from './sharpieBoard.js';

const boards = {
  [sharpieBoard.id]: sharpieBoard,
  // darkWood: darkWoodBoard,
  // parchment: parchmentBoard,
};

export default boards;

export { sharpieBoard };
