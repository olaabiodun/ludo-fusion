import { useCallback, useState, useEffect } from 'react';

export type SnakeLadderPlayer = {
  id: string;
  color: 'green' | 'yellow' | 'blue' | 'red';
  position: number; // 0 to 100
  isBot: boolean;
  lives: number;
};

import { BOARD_LADDERS, BOARD_SNAKES } from '../components/SnakeLadderBoard';

const SNAKES: Record<number, number> = {};
BOARD_SNAKES.forEach(s => { SNAKES[s.start] = s.end; });

const LADDERS: Record<number, number> = {};
BOARD_LADDERS.forEach(l => { LADDERS[l.start] = l.end; });

export function useSnakeLadderEngine(playerCount: number, initialPlayers?: SnakeLadderPlayer[]) {
  // Order: green(BL) → yellow(TL) → red(TR) → blue(BR) = clockwise round
  const [players, setPlayers] = useState<SnakeLadderPlayer[]>(() => {
    if (initialPlayers && initialPlayers.length > 0) {
      return initialPlayers;
    }
    if (playerCount === 2) {
      return [
        { id: '1', color: 'green', position: 0, isBot: false, lives: 4 },
        { id: '2', color: 'red', position: 0, isBot: true, lives: 4 },
      ];
    }
    return [
      { id: '1', color: 'green', position: 0, isBot: false, lives: 4 },
      { id: '2', color: 'yellow', position: 0, isBot: true, lives: 4 },
      { id: '3', color: 'red', position: 0, isBot: true, lives: 4 },
      { id: '4', color: 'blue', position: 0, isBot: true, lives: 4 },
    ];
  });

  // Start with the first player (authoritative turn should come from server in future, but 0 is deterministic)
  const [turnIndex, setTurnIndex] = useState(0);
  const [diceValue, setDiceValue] = useState<number | null>(null);
  const [hasRolled, setHasRolled] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  // Visual-only: controls the 3D dice spin animation separately from movement
  const [isRollingVisual, setIsRollingVisual] = useState(false);

  const nextTurn = useCallback(() => {
    setTurnIndex(prev => {
      let nextIdx = (prev + 1) % players.length;
      let loops = 0;
      while (players[nextIdx].lives <= 0 && loops < players.length) {
        nextIdx = (nextIdx + 1) % players.length;
        loops++;
      }
      return nextIdx;
    });
    setHasRolled(false);
    setIsMoving(false);
  }, [players]);

  
  useEffect(() => {
    if (winner) return;
    const alivePlayers = players.filter(p => p.lives > 0);
    if (alivePlayers.length === 1 && players.length > 1) {
      setWinner(alivePlayers[0].id);
    }
  }, [players, winner]);

  const movePlayer = useCallback((val: number, force = false) => {
    if (!force && (winner || isMoving)) return;
    setIsMoving(true);
    setDiceValue(val);

    // Capture current turn index for the asynchronous movement logic
    const movingPlayerIndex = turnIndex;

    // 1. Move to the intermediate landing cell first (matching dice)
    setPlayers(prev => {
      const nextPlayers = [...prev];
      if (!nextPlayers[movingPlayerIndex]) return prev;
      const p = nextPlayers[movingPlayerIndex];
      let newPos = p.position + val;
      if (newPos > 100) newPos = p.position;
      nextPlayers[movingPlayerIndex] = { ...p, position: newPos };
      return nextPlayers;
    });

    // 2. Wait for walking animation, then check for teleport (ladder/snake)
    const walkTime = (val * 200) + 600;
    setTimeout(() => {
      let fPos = 0;
      let isTele = false;

      setPlayers(prev => {
        const nextPlayers = [...prev];
        if (!nextPlayers[movingPlayerIndex]) return prev;
        const p = nextPlayers[movingPlayerIndex];
        const finalPos = SNAKES[p.position] || LADDERS[p.position] || p.position;
        const isTeleport = finalPos !== p.position;
        fPos = finalPos;
        isTele = isTeleport;

        if (isTeleport) {
          nextPlayers[movingPlayerIndex] = { ...p, position: finalPos };
        }

        if (finalPos === 100) {
          setTimeout(() => setWinner(p.id), 1500);
        }
        return nextPlayers;
      });

      // Switch turn after animations
      setTimeout(() => {
        setIsMoving(false);
        if (fPos < 100) {
          nextTurn();
        }
      }, isTele ? 1000 : 200);
    }, walkTime);
  }, [turnIndex, winner, isMoving, nextTurn, players.length]);

  const rollDice = useCallback((forcedVal?: number, isRemote = false) => {
    if (!isRemote && (hasRolled || winner || isMoving)) return;
    setHasRolled(true);
    setIsRollingVisual(true);

    const val = forcedVal || Math.floor(Math.random() * 6) + 1;
    setDiceValue(val);

    // Step 1: stop dice spin at 1200ms
    setTimeout(() => {
      setIsRollingVisual(false);

      // Step 2: Add a 500ms safety buffer
      setTimeout(() => {
        movePlayer(val, isRemote);
      }, 500);
    }, 1200);
  }, [hasRolled, winner, isMoving, movePlayer]);

  const handleTimeout = useCallback((color: string) => {
    if (winner || isMoving) return;

    setPlayers(prev => {
      const nextPlayers = [...prev];
      const pIdx = nextPlayers.findIndex(p => p.color === color);
      if (pIdx !== -1) {
        const p = nextPlayers[pIdx];
        nextPlayers[pIdx] = { ...p, lives: Math.max(0, p.lives - 1) };
      }
      return nextPlayers;
    });

    nextTurn();
  }, [winner, isMoving, nextTurn]);

  const resetGame = useCallback(() => {
    setPlayers(() => {
      if (playerCount === 2) {
        return [
          { id: '1', color: 'green', position: 0, isBot: false, lives: 4 },
          { id: '2', color: 'red', position: 0, isBot: true, lives: 4 },
        ];
      }
      return [
        { id: '1', color: 'green', position: 0, isBot: false, lives: 4 },
        { id: '2', color: 'yellow', position: 0, isBot: true, lives: 4 },
        { id: '3', color: 'red', position: 0, isBot: true, lives: 4 },
        { id: '4', color: 'blue', position: 0, isBot: true, lives: 4 },
      ];
    });
    setTurnIndex(Math.floor(Math.random() * playerCount));
    setDiceValue(null);
    setHasRolled(false);
    setWinner(null);
    setIsMoving(false);
  }, [playerCount]);

  const movePlayerByUserId = useCallback((userId: string, val: number) => {
    const playerIdx = players.findIndex(p => p.id === userId);
    if (playerIdx === -1) return;

    setIsMoving(true);
    setIsRollingVisual(false);
    setDiceValue(val);

    const movingPlayerIndex = playerIdx;

    // 1. Move to the intermediate landing cell first (matching dice)
    setPlayers(prev => {
      const nextPlayers = [...prev];
      if (!nextPlayers[movingPlayerIndex]) return prev;
      const p = nextPlayers[movingPlayerIndex];
      let newPos = p.position + val;
      if (newPos > 100) newPos = p.position;
      nextPlayers[movingPlayerIndex] = { ...p, position: newPos };
      return nextPlayers;
    });

    // 2. Wait for walking animation, then check for teleport (ladder/snake)
    const walkTime = (val * 200) + 600;
    setTimeout(() => {
      let fPos = 0;
      let isTele = false;

      setPlayers(prev => {
        const nextPlayers = [...prev];
        if (!nextPlayers[movingPlayerIndex]) return prev;
        const p = nextPlayers[movingPlayerIndex];
        const finalPos = SNAKES[p.position] || LADDERS[p.position] || p.position;
        const isTeleport = finalPos !== p.position;
        fPos = finalPos;
        isTele = isTeleport;

        if (isTeleport) {
          nextPlayers[movingPlayerIndex] = { ...p, position: finalPos };
        }

        if (finalPos === 100) {
          setTimeout(() => setWinner(p.id), 1500);
        }
        return nextPlayers;
      });

      // Switch turn after animations
      setTimeout(() => {
        setIsMoving(false);
        if (fPos < 100) {
          nextTurn();
        }
      }, isTele ? 1000 : 200);
    }, walkTime);
  }, [players, nextTurn]);

  return {
    players,
    turnIndex,
    diceValue,
    hasRolled,
    winner,
    isMoving,
    isRollingVisual,
    setIsRollingVisual,
    rollDice,
    movePlayerByUserId,
    handleTimeout,
    resetGame,
    setPlayers,
    setDiceValue,
  };
}
