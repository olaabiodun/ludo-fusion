import { Dimensions } from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');

// Board fits nicely on screen
export const BOARD_SIZE = Math.min(SW - 1, SH * 0.9, 720);
export const CELL_SIZE = BOARD_SIZE / 10;

/**
 * Returns the cell number (1–100) for a given row (0=top) and col (0=left).
 */
export function getCellNumber(row: number, col: number): number {
  const boardRow = 9 - row; // 0 at bottom, 9 at top
  const baseNum = boardRow * 10 + 1;
  if (boardRow % 2 === 0) {
    return baseNum + col;
  } else {
    return baseNum + (9 - col);
  }
}

/**
 * Helper to get XY coordinates for a cell number (1-100)
 * Returns TOP-LEFT of the cell for easy absolute positioning
 */
export function getCellTopLeft(num: number, color?: string) {
  // Handle start position (off-board golden container)
  if (num === undefined || num === null || num < 1) {
    // Return a single center point for the gold plate.
    // The Board component's CELL_SHARE_OFFSETS will handle the 2x2 grid arrangement.
    return {
      x: -CELL_SIZE * 1.65,
      y: BOARD_SIZE - CELL_SIZE * 1.1
    };
  }

  if (num > 100) num = 100;
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      if (getCellNumber(row, col) === num) {
        return {
          x: col * CELL_SIZE,
          y: row * CELL_SIZE
        };
      }
    }
  }
  return { x: 0, y: 0 };
}

export function getCellPos(num: number, color?: string) {
  const tl = getCellTopLeft(num, color);
  return {
    x: tl.x + CELL_SIZE / 2,
    y: tl.y + CELL_SIZE / 2
  };
}
