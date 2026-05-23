import { useCallback, useState } from 'react';
import { BC, getPerimeterIndex, SAFE_ZONES, START_INDICES } from './LudoPath';

export type PawnState = {
  id: string;
  color: BC;
  index: number;
  state: 'home' | 'board' | 'finished';
  pathIndex: number; // 0 to 56
  captureCell?: number; // Tracks where a capture happened for animation
};

export type GameState = {
  activeColors: BC[];
  turnIndex: number;
  turnId: number;
  diceValue: number | null;
  hasRolled: boolean;
  pawns: PawnState[];
  lives: Record<BC, number>;
  captures: Record<BC, number>;
  messages: string[];
  action: { msg: string; color: BC; key: number; capturedPawnId?: string } | null;
  winner: BC | null;
};

export function useLudoEngine(playerCount: 2 | 4 = 4, randomStart?: boolean) {
  // Setup 2-player vs 4-player colors
  const activeColors: BC[] = playerCount === 2 ? ['green', 'red'] : ['green', 'yellow', 'red', 'blue'];

  const [state, setState] = useState<GameState>(() => {
    const pawns: PawnState[] = [];
    for (const color of activeColors) {
      for (let i = 0; i < 4; i++) {
        pawns.push({
          id: `${color}-${i}`,
          color,
          index: i,
          state: 'home',
          pathIndex: 0
        });
      }
    }
    const initialLives: Record<string, number> = {};
    const initialCaptures: Record<string, number> = {};
    for (const c of activeColors) {
      initialLives[c] = 4;
      initialCaptures[c] = 0;
    }

    return {
      activeColors,
      turnIndex: randomStart ? Math.floor(Math.random() * activeColors.length) : 0,
      turnId: 1,
      diceValue: null,
      hasRolled: false,
      pawns,
      lives: initialLives as Record<BC, number>,
      captures: initialCaptures as Record<BC, number>,
      messages: ['Game started!'],
      action: null,
      winner: null,
    };
  });

  const [isDiceRolling, setIsDiceRolling] = useState(false);

  const nextTurn = useCallback((expectedTurnId?: number) => {
    setState(s => {
      if (expectedTurnId !== undefined && s.turnId !== expectedTurnId) return s;
      if (s.activeColors.length === 0 || s.winner) return s;

      let nextIdx = s.turnIndex;
      let iterations = 0;

      let foundValid = false;
      // Find next player who still has tokens to play
      while (iterations < s.activeColors.length) {
        nextIdx = (nextIdx + 1) % s.activeColors.length;
        iterations++;

        const nextColor = s.activeColors[nextIdx];
        const colorPawns = s.pawns.filter(p => p.color === nextColor);
        const allFinished = colorPawns.every(p => p.state === 'finished');
        const isKicked = s.lives[nextColor] <= 0;

        if (!allFinished && !isKicked) {
          foundValid = true;
          break;
        }
      }

      if (!foundValid) {
        // No one can move anymore! The game is over.
        return { ...s, diceValue: null, hasRolled: true }; // Block further rolls
      }

      return {
        ...s,
        turnIndex: nextIdx,
        turnId: s.turnId + 1,
        diceValue: null,
        hasRolled: false,
        action: null,
      };
    });
  }, []);

  const handleTimeout = useCallback((color: BC, expectedTurnId: number) => {
    setState(s => {
      // Ignore if game over or turn advanced
      if (s.winner || s.turnId !== expectedTurnId || s.activeColors[s.turnIndex] !== color) return s;

      const newLives = { ...s.lives, [color]: s.lives[color] - 1 };
      let newActiveColors = s.activeColors;
      let msgs = [`${color} timed out!`, ...s.messages];

      if (newLives[color] <= 0) {
        msgs = [`${color} was ELIMINATED!`, ...msgs];
        newActiveColors = s.activeColors.filter(c => c !== color);
        // Remove their pawns from the board to avoid confusion
        const updatedPawns = s.pawns.map(p =>
          p.color === color ? { ...p, state: 'home' as const, pathIndex: 0 } : p
        );

        // Adjust turnIndex if the removed player was before or at current turn
        let newTurnIdx = s.turnIndex;
        if (newTurnIdx >= newActiveColors.length) newTurnIdx = 0;

        return {
          ...s,
          activeColors: newActiveColors,
          pawns: updatedPawns,
          turnIndex: newTurnIdx,
          turnId: s.turnId + 1,
          diceValue: null,
          hasRolled: false,
          lives: newLives,
          messages: msgs.slice(0, 5),
        };
      }

      if (newActiveColors.length <= 1) {
        if (newActiveColors.length === 1) msgs = [`${newActiveColors[0]} wins!`, ...msgs];
        return { ...s, activeColors: newActiveColors, lives: newLives, messages: msgs.slice(0, 5) };
      }

      // Pass to next player relative to new active array
      let nextColor = s.activeColors[(s.turnIndex + 1) % s.activeColors.length];
      let nextIdx = newActiveColors.indexOf(nextColor);
      if (nextIdx === -1) nextIdx = 0;

      // Check if the next player should be skipped (all finished)
      let iterations = 0;
      while (iterations < newActiveColors.length) {
        const checkColor = newActiveColors[nextIdx];
        const allFinished = s.pawns.filter(p => p.color === checkColor).every(p => p.state === 'finished');
        if (!allFinished) break;

        nextIdx = (nextIdx + 1) % newActiveColors.length;
        iterations++;
      }

      return {
        ...s,
        activeColors: newActiveColors,
        turnIndex: nextIdx,
        turnId: s.turnId + 1,
        diceValue: null,
        hasRolled: false,
        lives: newLives,
        messages: msgs.slice(0, 5),
        action: { msg: 'timeout', color, key: Date.now() },
      };
    });
  }, []);

  const isPathBlocked = useCallback((pawn: PawnState, steps: number, currentPawns: PawnState[]) => {
    const effectiveSteps = pawn.state === 'home' ? 0 : steps;
    const startI = pawn.state === 'home' ? 0 : 1;

    for (let i = startI; i <= effectiveSteps; i++) {
      const pathIdx = pawn.pathIndex + i;
      if (pathIdx > 50) continue;

      const perimeterIdx = (START_INDICES[pawn.color] + pathIdx) % 52;
      const isDestination = i === effectiveSteps;

      const opponentsAtCell = currentPawns.filter(p =>
        p.color !== pawn.color &&
        p.state === 'board' &&
        getPerimeterIndex(p.color, p.state, p.pathIndex) === perimeterIdx
      );

      const colorCounts: Record<string, number> = {};
      for (const op of opponentsAtCell) {
        colorCounts[op.color] = (colorCounts[op.color] || 0) + 1;
        if (colorCounts[op.color] >= 2) {
          const isVictimStart = perimeterIdx === START_INDICES[op.color as BC];
          if (isVictimStart) {
            continue;
          }
          return true;
        }
      }
    }
    return false;
  }, []);

  const rollDice = useCallback((value: number, force: boolean = false) => {
    setIsDiceRolling(false);
    setState(s => {
      if (!force && (s.hasRolled || s.winner)) return s;

      const turnColor = s.activeColors[s.turnIndex];
      const myPawns = s.pawns.filter(p => p.color === turnColor);

      // Check if any moves are physically possible
      let hasValidMove = false;
      for (const p of myPawns) {
        if (p.state === 'home' && value === 6) {
          // Can only exit home if the start cell isn't blocked by an opponent's blockade
          if (!isPathBlocked(p, 0, s.pawns)) hasValidMove = true;
        }
        if (p.state === 'board' && p.pathIndex + value <= 56) {
          if (!isPathBlocked(p, value, s.pawns)) hasValidMove = true;
        }
      }

      if (!hasValidMove) {
        // If we rolled a 6, we still get an extra turn even if no moves possible
        if (value === 6) {
          setTimeout(() => {
            setState(prev => ({ ...prev, hasRolled: false, diceValue: null, turnId: prev.turnId + 1 }));
          }, 1500);
          return {
            ...s,
            diceValue: value,
            hasRolled: true,
            messages: [`${turnColor} rolled a 6! Extra roll!`, ...s.messages]
          };
        }

        // Otherwise pass the turn
        const rollTurnId = s.turnId;
        setTimeout(() => {
          nextTurn(rollTurnId);
        }, 1500);
        return {
          ...s,
          diceValue: value,
          hasRolled: true,
          messages: [`${turnColor} rolled ${value}. No valid moves!`, ...s.messages]
        };
      }

      return {
        ...s,
        diceValue: value,
        hasRolled: true,
        messages: [`${turnColor} rolled a ${value}!`, ...s.messages],
        action: value === 6 ? { msg: 'six', color: turnColor, key: Date.now() } : null
      };
    });
  }, [nextTurn, isPathBlocked]);

  const movePawn = useCallback((pawnId: string) => {
    setState(s => {
      // Must have rolled a dice to move, and no winner yet
      if (!s.hasRolled || s.diceValue === null || s.winner) return s;

      const pawnIndex = s.pawns.findIndex(p => p.id === pawnId);
      if (pawnIndex === -1) return s;

      const pawn = s.pawns[pawnIndex];
      const turnColor = s.activeColors[s.turnIndex];

      // Can only move your own color
      if (pawn.color !== turnColor) return s;

      // Check for blockades along the path
      const blockCheckSteps = pawn.state === 'home' ? 0 : s.diceValue;
      if (isPathBlocked(pawn, blockCheckSteps, s.pawns)) {
        return s; // Movement blocked!
      }

      let nextState = pawn.state;
      let nextPathIndex = pawn.pathIndex;
      let grantExtraTurn = s.diceValue === 6; // Rolling a 6 grants an extra turn

      if (pawn.state === 'home') {
        if (s.diceValue !== 6) return s; // Must roll 6 to leave home
        nextState = 'board';
        nextPathIndex = 0;
      } else if (pawn.state === 'board') {
        if (pawn.pathIndex + s.diceValue > 56) return s; // Overshoots finish, invalid move
        nextPathIndex += s.diceValue;
        if (nextPathIndex === 56) {
          nextState = 'finished';
          grantExtraTurn = true; // Reaching home gives extra turn
        }
      } else {
        return s; // Finished pawns cannot move
      }

      const newPawns = [...s.pawns];
      newPawns[pawnIndex] = { ...pawn, state: nextState, pathIndex: nextPathIndex };

      // Handle Capturing & Blockades
      let msgs = s.messages;
      let capturedSomeone = false;
      let capturedPawnId: string | undefined;
      const myNewPerimeterIdx = getPerimeterIndex(pawn.color, nextState, nextPathIndex);

      if (myNewPerimeterIdx !== null && !SAFE_ZONES.has(myNewPerimeterIdx)) {
        // Identify opponents on the exact same perimeter index
        const pawnsOnCell = newPawns.filter(p =>
          p.color !== pawn.color && getPerimeterIndex(p.color, p.state, p.pathIndex) === myNewPerimeterIdx
        );

        if (pawnsOnCell.length > 0) {
          // Count pawns per color to detect blockades
          const colorCounts: Record<string, number> = {};
          for (const p of pawnsOnCell) {
            colorCounts[p.color] = (colorCounts[p.color] || 0) + 1;
          }

          // Evaluate captures
          const capturedColorsAtStart = new Set<string>();
          for (const p of pawnsOnCell) {
            const isStartingCellOfVictim = myNewPerimeterIdx === START_INDICES[p.color];

            if (colorCounts[p.color] >= 2 && !isStartingCellOfVictim) {
              // Blockade! 2+ tokens of the same color form a safe zone. No capture.
              continue;
            } else {
              // Rule: If capturing from a blockade on their own starting cell, only take ONE of that color
              if (isStartingCellOfVictim && colorCounts[p.color] >= 2 && capturedColorsAtStart.has(p.color)) {
                continue;
              }

              // Rule: A pawn coming out of home cannot capture an opponent on the starting cell 
              // UNLESS they have another token on the board to play the extra roll with.
              if (pawn.state === 'home' && nextState === 'board') {
                const otherMovingTokens = newPawns.filter(
                  tp => tp.color === pawn.color && tp.id !== pawn.id && tp.state === 'board'
                );
                if (otherMovingTokens.length === 0) {
                  continue;
                }
              }

              // Vulnerable token. Capture it!
              const captureIdx = newPawns.findIndex(x => x.id === p.id);
              // Delayed home-return — keep pawn visible at its position until animation completes
              capturedPawnId = p.id;
              capturedSomeone = true;
              if (isStartingCellOfVictim) capturedColorsAtStart.add(p.color);
              msgs = [`${turnColor} captured ${p.color}!`, ...msgs];
            }
          }
        }
      }

      const nextCaptures = { ...s.captures };
      if (capturedSomeone) {
        nextCaptures[turnColor] = (nextCaptures[turnColor] || 0) + 1;
        // House Rule: Capturing a token sends the attacker straight to the finish line!
        // Ensure pathIndex is also set to 56 for consistency
        newPawns[pawnIndex] = { ...newPawns[pawnIndex], state: 'finished', pathIndex: 56, captureCell: nextPathIndex };
        grantExtraTurn = true;
      }

      // Check if they just won
      const myPawnsFinished = newPawns.filter(p => p.color === turnColor && p.state === 'finished').length;
      let finalWinner: BC | null = s.winner;
      if (myPawnsFinished === 4) {
        grantExtraTurn = false;
        finalWinner = turnColor;
        msgs = [`${turnColor.toUpperCase()} HAS WON!`, ...msgs];
      }

      // Determine whose turn is next
      let nextTurnIdx = s.turnIndex;
      if (!grantExtraTurn) {
        nextTurnIdx = (s.turnIndex + 1) % s.activeColors.length;
        let iterations = 0;
        while (iterations < s.activeColors.length) {
          const checkColor = s.activeColors[nextTurnIdx];
          const allFinished = newPawns.filter(p => p.color === checkColor).every(p => p.state === 'finished');
          if (!allFinished) break;

          nextTurnIdx = (nextTurnIdx + 1) % s.activeColors.length;
          iterations++;
        }
      }

      return {
        ...s,
        pawns: newPawns,
        turnIndex: nextTurnIdx,
        turnId: s.turnId + 1, // ALWAYS increment turnId so the 20s timer resets for the extra roll or next player
        diceValue: null,
        hasRolled: false,
        captures: nextCaptures,
        messages: msgs.slice(0, 5),
        winner: finalWinner,
        action: capturedSomeone ? { msg: 'capture', color: turnColor, key: Date.now(), capturedPawnId }
          : nextState === 'finished' ? { msg: myPawnsFinished === 4 ? 'winner' : 'home', color: turnColor, key: Date.now() }
            : null
      };
    });
  }, [nextTurn, isPathBlocked]);

  const getPossibleMoves = useCallback((diceValue: number) => {
    const turnColor = state.activeColors[state.turnIndex];
    const myPawns = state.pawns.filter(p => p.color === turnColor);

    return myPawns.filter(p => {
      if (p.state === 'finished') return false;
      if (p.state === 'home') {
        return diceValue === 6 && !isPathBlocked(p, 0, state.pawns);
      }
      if (p.state === 'board') {
        return p.pathIndex + diceValue <= 56 && !isPathBlocked(p, diceValue, state.pawns);
      }
      return false;
    });
  }, [state, isPathBlocked]);

  const getBestMove = useCallback((diceValue: number) => {
    const possibleMoves = getPossibleMoves(diceValue);

    if (possibleMoves.length === 0) return null;

    let bestPawnId = possibleMoves[0].id;
    let maxScore = -Infinity;

    for (const p of possibleMoves) {
      let score = 0;
      const nextPathIdx = p.state === 'home' ? 0 : p.pathIndex + diceValue;
      const nextState = nextPathIdx === 56 ? 'finished' : 'board';
      const myPerimIdx = getPerimeterIndex(p.color, nextState, nextPathIdx);

      // 1. CAPTURE (Highest Priority: +5000)
      if (myPerimIdx !== null && !SAFE_ZONES.has(myPerimIdx)) {
        const opponents = state.pawns.filter(op =>
          op.color !== p.color &&
          getPerimeterIndex(op.color, op.state, op.pathIndex) === myPerimIdx
        );
        // Only count as capture if it's not a blockade (unless it's their starting cell)
        for (const op of opponents) {
          const isVictimStart = myPerimIdx === START_INDICES[op.color];
          const opCount = state.pawns.filter(x => x.color === op.color && getPerimeterIndex(x.color, x.state, x.pathIndex) === myPerimIdx).length;
          if (opCount < 2 || isVictimStart) {
            score += 5000;
            break;
          }
        }
      }

      // 2. FINISHING (+2000)
      if (nextState === 'finished') score += 2000;

      // 3. EXIT HOME Base (+500)
      if (p.state === 'home') score += 500;

      // 4. MOVE TO SAFE ZONE (+300)
      if (myPerimIdx !== null && SAFE_ZONES.has(myPerimIdx)) score += 300;

      // 5. FORM BLOCKADE (+250)
      const myOtherPawns = state.pawns.filter(x => x.id !== p.id && x.color === p.color && getPerimeterIndex(x.color, x.state, x.pathIndex) === myPerimIdx);
      if (myOtherPawns.length > 0) score += 250;

      // 6. PROGRESS (1 pt per step)
      score += nextPathIdx;

      // 7. DANGER AVOIDANCE (-150 if ending turn in vulnerable spot)
      if (myPerimIdx !== null && !SAFE_ZONES.has(myPerimIdx)) {
        // Penalty for being near ANY opponent on the board
        const nearOpponents = state.pawns.filter(op => op.color !== p.color && op.state === 'board');
        for (const op of nearOpponents) {
          const opPerim = getPerimeterIndex(op.color, op.state, op.pathIndex);
          if (opPerim !== null) {
            const dist = (myPerimIdx - opPerim + 52) % 52;
            if (dist > 0 && dist <= 6) score -= 150;
          }
        }

        // 8. START-CELL DANGER (-400 penalty for opponent's starting cell)
        // Landing here is extremely risky because a roll of 6 by that opponent captures you instantly.
        for (const [color, startIdx] of Object.entries(START_INDICES)) {
          if (color !== p.color && myPerimIdx === startIdx) {
            score -= 400;
          }
        }
      }

      if (score > maxScore) {
        maxScore = score;
        bestPawnId = p.id;
      }
    }

    return bestPawnId;
  }, [state, isPathBlocked]);

  const resetGame = useCallback(() => {
    const initialPawns: PawnState[] = [];
    for (const color of activeColors) {
      for (let i = 0; i < 4; i++) {
        initialPawns.push({
          id: `${color}-${i}`,
          color,
          index: i,
          state: 'home',
          pathIndex: 0
        });
      }
    }
    const initialLives: Record<string, number> = {};
    const initialCaptures: Record<string, number> = {};
    for (const c of activeColors) {
      initialLives[c] = 4;
      initialCaptures[c] = 0;
    }

    setState({
      activeColors,
      turnIndex: randomStart ? Math.floor(Math.random() * activeColors.length) : 0,
      turnId: 1,
      diceValue: null,
      hasRolled: false,
      pawns: initialPawns,
      lives: initialLives as Record<BC, number>,
      captures: initialCaptures as Record<BC, number>,
      messages: ['Game restarted!'],
      action: null,
      winner: null,
    });
  }, [activeColors]);

  const resolveCaptures = useCallback((capturedPawnIds: string[]) => {
    setState(prev => {
      const newPawns = prev.pawns.map(p => {
        if (capturedPawnIds.includes(p.id) && p.state !== 'home') {
          return { ...p, state: 'home' as const, pathIndex: 0 };
        }
        return p;
      });
      return { ...prev, pawns: newPawns };
    });
  }, []);

  return {
    state,
    rollDice,
    movePawn,
    nextTurn,
    handleTimeout,
    getPossibleMoves,
    getBestMove,
    setState,
    isDiceRolling,
    setIsDiceRolling,
    resetGame,
    resolveCaptures,
  };
}
