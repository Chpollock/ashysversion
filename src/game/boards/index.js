// Registry of all board skins.
// Add a new board here and it becomes available throughout the app.

import { sharpieBoard } from './sharpieBoard.js';
import { feltBoard } from './feltBoard.js';

const boards = {
  [sharpieBoard.id]: sharpieBoard,
  [feltBoard.id]: feltBoard,
};

export default boards;

export { sharpieBoard, feltBoard };
