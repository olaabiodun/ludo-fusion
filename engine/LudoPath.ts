export type BC = 'green' | 'yellow' | 'blue' | 'red';

// 52 perimeter cells starting from Green's starting cell at index 0.
export const PERIMETER_PATH = [
  // Green arm (left)
  { c: 1, r: 6 }, { c: 2, r: 6 }, { c: 3, r: 6 }, { c: 4, r: 6 }, { c: 5, r: 6 },
  // Yellow arm (top)
  { c: 6, r: 5 }, { c: 6, r: 4 }, { c: 6, r: 3 }, { c: 6, r: 2 }, { c: 6, r: 1 }, { c: 6, r: 0 },
  // Top horizontal cross
  { c: 7, r: 0 }, { c: 8, r: 0 },
  // Yellow arm (down)
  { c: 8, r: 1 }, { c: 8, r: 2 }, { c: 8, r: 3 }, { c: 8, r: 4 }, { c: 8, r: 5 },
  // Red arm (right)
  { c: 9, r: 6 }, { c: 10, r: 6 }, { c: 11, r: 6 }, { c: 12, r: 6 }, { c: 13, r: 6 }, { c: 14, r: 6 },
  // Right vertical cross
  { c: 14, r: 7 }, { c: 14, r: 8 },
  // Red arm (left)
  { c: 13, r: 8 }, { c: 12, r: 8 }, { c: 11, r: 8 }, { c: 10, r: 8 }, { c: 9, r: 8 },
  // Blue arm (down)
  { c: 8, r: 9 }, { c: 8, r: 10 }, { c: 8, r: 11 }, { c: 8, r: 12 }, { c: 8, r: 13 }, { c: 8, r: 14 },
  // Bottom horizontal cross
  { c: 7, r: 14 }, { c: 6, r: 14 },
  // Blue arm (up)
  { c: 6, r: 13 }, { c: 6, r: 12 }, { c: 6, r: 11 }, { c: 6, r: 10 }, { c: 6, r: 9 },
  // Green arm (left)
  { c: 5, r: 8 }, { c: 4, r: 8 }, { c: 3, r: 8 }, { c: 2, r: 8 }, { c: 1, r: 8 }, { c: 0, r: 8 },
  // Left vertical cross
  { c: 0, r: 7 }, { c: 0, r: 6 }
];

export const HOME_STRETCHES: Record<BC, { c: number; r: number }[]> = {
  green: [{ c: 1, r: 7 }, { c: 2, r: 7 }, { c: 3, r: 7 }, { c: 4, r: 7 }, { c: 5, r: 7 }],
  yellow: [{ c: 7, r: 1 }, { c: 7, r: 2 }, { c: 7, r: 3 }, { c: 7, r: 4 }, { c: 7, r: 5 }],
  red: [{ c: 13, r: 7 }, { c: 12, r: 7 }, { c: 11, r: 7 }, { c: 10, r: 7 }, { c: 9, r: 7 }],
  blue: [{ c: 7, r: 13 }, { c: 7, r: 12 }, { c: 7, r: 11 }, { c: 7, r: 10 }, { c: 7, r: 9 }]
};

export const START_INDICES: Record<BC, number> = {
  green: 0,
  yellow: 13,
  red: 26,
  blue: 39
};

// Safe zones are indices on the perimeter where pawns cannot be captured.
// Comprised of the 8 star cells (8, 21, 34, 47 and their mirrors in other variants)
// Note: Starting cells (0, 13, 26, 39) are NO LONGER safe per user request.
export const SAFE_ZONES = new Set([8, 21, 34, 47]);

/**
 * Maps a pawn's logical state to a visual board position.
 * @param color The color of the pawn
 * @param state 'home' | 'board' | 'finished'
 * @param pathIndex If state is 'board', how many cells the pawn has traveled (0 = start cell, 56 = finished)
 * @param index 0-3, used to offset the pawn when it's at home.
 * 
 * @returns { c, r } board coordinates
 * 
 */
export function getCellPosition(
  color: BC,
  state: 'home' | 'board' | 'finished',
  pathIndex: number,
  index: number
): { c: number; r: number } {
  if (state === 'home') {
    // In home base, spread out in a 2x2 grid.
    // Base anchors: Green(0,0), Yellow(9,0), Blue(0,9), Red(9,9)
    let baseX = 0, baseY = 0;
    if (color === 'yellow') baseX = 9;
    if (color === 'blue') baseY = 9;
    if (color === 'red') { baseX = 9; baseY = 9; }

    const localX = index % 2 === 1 ? 3.777 : 2.223;
    const localY = index >= 2 ? 3.777 : 2.223;
    
    // Subtract 0.5 because the formula adds 0.5 for centering later
    return { c: baseX + localX - 0.5, r: baseY + localY - 0.5 };
  }

  if (state === 'finished' || pathIndex >= 56) {
    // Move to a special "Winner" position near the player's profile chip
    // These coordinates extend beyond the board area (0-14.1) to reach the corners
    let baseX = -3.5, baseY = -3.5;
    if (color === 'yellow') { baseX = 16.5; baseY = -3.5; }
    if (color === 'blue') { baseX = -3.5; baseY = 17.5; }
    if (color === 'red') { baseX = 16.5; baseY = 17.5; }
    
    const offX = (index % 2) * 1.2;
    const offY = Math.floor(index / 2) * 1.2;

    return { c: baseX + offX, r: baseY + offY };
  }

  // Active on the board
  if (pathIndex <= 50) {
    // Perimeter path
    const perimeterIndex = (START_INDICES[color] + pathIndex) % 52;
    return PERIMETER_PATH[perimeterIndex];
  } else {
    // Home stretch (pathIndex 51 to 55)
    const stretchIndex = pathIndex - 51;
    return HOME_STRETCHES[color][stretchIndex];
  }
}

/**
 * Helper to get the absolute perimeter index of a pawn for collision detection.
 * Returns null if the pawn is in the home stretch, at home, or finished.
 */
export function getPerimeterIndex(color: BC, state: string, pathIndex: number): number | null {
  if (state !== 'board' || pathIndex > 50) return null;
  return (START_INDICES[color] + pathIndex) % 52;
}
