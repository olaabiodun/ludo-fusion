import { supabase } from '@/lib/supabase';
import { socket } from '@/lib/socket';
import React from 'react';
import { Card, Seat, getCardInFanPos } from './WhotUtils';
import { MarketPick } from './WhotAnimations';
import { WhotShape } from './WhotFrontCard';
import {
  playWhotCardSound,
  playWhotSuspendedSound,
  playWhotDefendedSound,
  playWhotHoldOnSound,
  playWhotPick2Sound,
  playWhotPick3Sound,
  playWhotGeneralMarketSound,
  playWhotGMSound,
  playWhotContinueSound,
  playWhotLastCardSound,
  playWhotCheckupSound,
} from '../lib/sounds';

// Re-export so existing imports of `socket` from this module keep working.
export { socket };

interface MultiplayerProps {
  gameId?: string;
  players: any[];
  visiblePlayers: any[];
  setPlayers: React.Dispatch<React.SetStateAction<any[]>>;
  setTopCard: (card: Card) => void;
  setTurnIndex: React.Dispatch<React.SetStateAction<number>>;
  setTurnStartedAt: (v: number | null) => void;
  setCurrentShape: (shape: WhotShape | null) => void;
  setShapeAskerSeat: React.Dispatch<React.SetStateAction<Seat | null>>;
  setShowShapePicker: (v: boolean) => void;
  setGameStarted: (v: boolean) => void;
  setDealing: (v: boolean) => void;
  setPing: (v: number) => void;
  setActionMessage: (v: { msg: string; seat: Seat } | null) => void;
  setMarketCount: React.Dispatch<React.SetStateAction<number>>;
  setActivePlay: (v: any) => void;
  setActiveMarketPicks: React.Dispatch<React.SetStateAction<MarketPick[]>>;
  setWasHoldOn: (v: boolean) => void;
  setPendingPicks: (v: number | ((prev: number) => number)) => void;
  setShowScoring: (v: boolean) => void;
  setGameEndsAt: (v: number | null) => void;
  setPrize: (v: number) => void;
  setPlayerLives: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  onWinner?: (color: string, scores?: Record<string, number>) => void;
  pendingHandsRef: React.MutableRefObject<Record<string, Card[]>>;
  hasJoinedRoom: React.MutableRefObject<boolean>;
  /** Ref the parent keeps pointing at the current activePlay value so we can
   *  check inside socket callbacks whether an animation is still in-flight. */
  activePlayRef: React.MutableRefObject<any>;
  setSavedWinnerInfo: (v: { color: string; scores: Record<string, number> } | null) => void;
}

export function useWhotMultiplayer({
  gameId,
  players,
  visiblePlayers,
  setPlayers,
  setTopCard,
  setTurnIndex,
  setTurnStartedAt,
  setCurrentShape,
  setShapeAskerSeat,
  setShowShapePicker,
  setGameStarted,
  setDealing,
  setPing,
  setActionMessage,
  setMarketCount,
  setActivePlay,
  setActiveMarketPicks,
  setWasHoldOn,
  setPendingPicks,
  setShowScoring,
  setGameEndsAt,
  setPrize,
  setPlayerLives,
  onWinner,
  pendingHandsRef,
  hasJoinedRoom,
  activePlayRef,
  setSavedWinnerInfo,
}: MultiplayerProps) {

  /**
   * When a card play animation is in flight we receive whot_state / whot_turn_update
   * BEFORE the animation finishes. Storing the pending turn here lets us apply it
   * once the animation's onLand callback fires.
   */
  const pendingTurnRef = React.useRef<{ turn: number; startedAt: number | null } | null>(null);
  const activePicksCountRef = React.useRef<number>(0);

  // ─── Remote Play ──────────────────────────────────────────────────────────────
  const handleRemotePlay = React.useCallback((
    pi: number,
    cardIdx: number,
    card: Card,
    nextTurn: number,
    _specialMsg?: string,
    _wantShape?: WhotShape | null,
    _pendingPicks?: number
  ) => {
    const p = players[pi];
    if (!p) return;
    
    // Defer the turn index update until onLand of the played card
    pendingTurnRef.current = { turn: nextTurn, startedAt: null };

    playWhotCardSound();

    if (_specialMsg) {
      setActionMessage({ msg: _specialMsg, seat: p.seat as Seat });
      if (_specialMsg === "Hold On!") playWhotHoldOnSound();
      else if (_specialMsg === "Suspension!") playWhotSuspendedSound();
      else if (_specialMsg === "General Market!") playWhotGeneralMarketSound();
      else if (_specialMsg === "Pick 2!") playWhotPick2Sound();
      else if (_specialMsg === "Pick 3!") playWhotPick3Sound();
      else if (_specialMsg === "DEFENDED!") playWhotDefendedSound();
      else if (_specialMsg === "CONTINUE") playWhotContinueSound();
    }

    // Snapshot the card count BEFORE splicing so winner detection is accurate.
    const cardCountBefore = p.cards.length;

    // Splice the card from the opponent's hand IMMEDIATELY so the fan updates 
    // before the animation ends (matches local/bot logic for better accuracy).
    setPlayers(prev => {
      const next = [...prev];
      if (next[pi]) {
        const newCards = [...next[pi].cards];
        newCards.splice(cardIdx, 1);
        next[pi] = {
          ...next[pi],
          cardCount: Math.max(0, next[pi].cardCount - 1),
          cards: newCards,
        };
      }
      return next;
    });

    // Trigger the fly-to-center animation.
    setActivePlay({
      start: getCardInFanPos(p.seat as Seat, cardIdx, p.cardCount, false, true),
      card,
      key: Date.now().toString(),
      onLand: () => {
        // Update the top card visible in the center pile
        setTopCard(card);
        const remainingAfterPlay = cardCountBefore - 1;
        if (card.value !== 20 || remainingAfterPlay <= 0) {
          setCurrentShape(null);
        } else if (_wantShape) {
          // If the server already sent the shape choice along with the play event
          setCurrentShape(_wantShape);
          setShapeAskerSeat(p.seat as Seat);
          playWhotGMSound(_wantShape);
          setActionMessage({ msg: `I want ${_wantShape.toUpperCase()}!`, seat: p.seat as Seat });
        }
        // else: wait for whot_shape_chosen / whot_state to set the real shape

        setActivePlay(null);

        if (_pendingPicks !== undefined) setPendingPicks(_pendingPicks);

        // remainingAfterPlay already defined above
        if (remainingAfterPlay <= 0) {
          setActionMessage({ msg: 'winner', seat: p.seat as Seat });
        } else if (remainingAfterPlay === 1 && card.value !== 20) {
          // Only show 'last card' for normal cards.
          // When playing Whot (20), the shape picker will appear — don't overlay it.
          setActionMessage({ msg: 'last card', seat: p.seat as Seat });
        }

        // Apply any deferred turn advancement that arrived while animating
        if (pendingTurnRef.current !== null && remainingAfterPlay > 0) {
          const { turn, startedAt } = pendingTurnRef.current;
          pendingTurnRef.current = null;
          setTurnIndex(turn);
          setTurnStartedAt(startedAt);
        }

        // Apply authoritative hands map once play animation completes
        if (pendingHandsRef.current) {
          setPlayers(prev => prev.map(pl => {
            if (pl.id === p.id && remainingAfterPlay <= 0) {
              return {
                ...pl,
                cards: [],
                cardCount: 0
              };
            }
            const myHand = pendingHandsRef.current[pl.id] || pl.cards;
            return {
              ...pl,
              cards: myHand,
              cardCount: myHand.length
            };
          }));
        }
      },
    });
  }, [
    players,
    setActionMessage,
    setActivePlay,
    setPlayers,
    setTopCard,
    setCurrentShape,
    setTurnIndex,
    setTurnStartedAt,
    setPendingPicks,
    onWinner,
    setShowScoring,
  ]);

  // ─── Remote Pick ─────────────────────────────────────────────────────────────
  const handleRemotePick = React.useCallback((
    pi: number,
    cards: Card[],
    nextTurn: number,
    specialMsg?: string,
  ) => {
    const p = players[pi];
    if (!p) return;

    if (specialMsg) setActionMessage({ msg: specialMsg, seat: p.seat as Seat });
    setWasHoldOn(false);
    setPendingPicks(0); // Always clear pending picks when someone actually picks

    // Increment active picks animation count
    activePicksCountRef.current += cards.length;

    // Defer the turn index update until all picked cards land in player's hand
    pendingTurnRef.current = { turn: nextTurn, startedAt: null };

    const newPicks = cards.map((card, i) => ({
      key: `${Math.random()}-${i}`,
      seat: p.seat as Seat,
      card,
      delay: i * 600, // Match AI animation timing (600ms between each card)
      pi,
      pickIndex: i,
      totalAtStart: p.cardCount,
    }));

    setActiveMarketPicks(prev => [...prev, ...newPicks]);
    setMarketCount(prev => Math.max(0, prev - cards.length));
  }, [
    players,
    setActionMessage,
    setWasHoldOn,
    setPendingPicks,
    setActiveMarketPicks,
    setMarketCount,
  ]);

  // ─── Ping ─────────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    const interval = setInterval(() => {
      const start = Date.now();
      socket.emit('client_ping', start);
    }, 3000);

    const handlePong = (start: number) => setPing(Date.now() - start);
    socket.on('client_pong', handlePong);

    return () => {
      clearInterval(interval);
      socket.off('client_pong', handlePong);
    };
  }, [setPing]);

  // ─── Room & Game Events ───────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!gameId) return;

    if (!hasJoinedRoom.current) {
      const initSocket = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', user?.id)
          .single();

        console.log('[WhotMultiplayer] Emitting join_room');
        socket.emit('join_room', {
          roomId: gameId,
          userId: user?.id,
          username: profile?.username || 'Player',
          avatar: profile?.avatar_url,
        });
        hasJoinedRoom.current = true;
      };
      initSocket();
    }

    // ── whot_init: server deals cards and sets the starting state ──────────────
    const onWhotInit = ({ hands, topCard, currentTurn, currentShape, pendingPicks, wasHoldOn, turnStartedAt, gameEndsAt, playerLives, prize }: { hands: any; topCard: Card; currentTurn?: number; currentShape?: WhotShape | null; pendingPicks?: number; wasHoldOn?: boolean; turnStartedAt?: number | null; gameEndsAt?: number | null; playerLives?: any; prize?: number }) => {
      console.log('[WhotMultiplayer] Received whot_init');
      if (prize !== undefined) setPrize(prize);
      if (playerLives !== undefined) setPlayerLives(playerLives);

      setTopCard(topCard);
      setCurrentShape(currentShape ?? null);
      setPendingPicks(pendingPicks ?? 0);
      setWasHoldOn(!!wasHoldOn);
      setShowShapePicker(false);
      setTurnStartedAt(turnStartedAt ?? null);
      setGameEndsAt(gameEndsAt ?? null);
      pendingHandsRef.current = hands;
      // Only keep players who actually received a hand from the server.
      // This prevents phantom 3rd/4th player slots from appearing in 2P games.
      const realPlayerIds = Object.keys(hands);
      const activePlayers = visiblePlayers.filter(p => realPlayerIds.includes(p.id));
      setPlayers(() =>
        activePlayers.map(p => ({ 
          ...p, 
          cards: [], 
          cardCount: 0,
          lives: (playerLives && playerLives[p.id] !== undefined) ? playerLives[p.id] : 4
        }))
      );
      setGameStarted(true);
      setDealing(true);
      setTurnIndex(currentTurn ?? 0);
    };

    // ── whot_remote_play: an opponent played a card ────────────────────────────
    const onWhotRemotePlay = (data: {
      pi: number;
      cardIdx: number;
      card: Card;
      nextTurn: number;
      specialMsg?: string;
      wantShape?: WhotShape | null;
      pendingPicks?: number;
    }) => {
      // We do NOT update topCard here anymore.
      // It is safely deferred until the card animation reaches the center in handleRemotePlay's onLand callback!
      handleRemotePlay(
        data.pi,
        data.cardIdx,
        data.card,
        data.nextTurn,
        data.specialMsg,
        data.wantShape,
        data.pendingPicks
      );
    };

    // ── whot_remote_pick: an opponent picked from market ───────────────────────
    const onWhotRemotePick = (data: {
      pi: number;
      cards: Card[];
      nextTurn: number;
      specialMsg?: string;
    }) => {
      handleRemotePick(data.pi, data.cards, data.nextTurn, data.specialMsg);
    };

    // ── whot_state: server authoritative state sync ────────────────────────────
    const onWhotState = ({
      topCard,
      currentTurn,
      currentShape,
      pendingPicks,
      wasHoldOn,
      turnStartedAt,
      gameEndsAt,
      playerLives,
      prize,
      hands, // Authoritative hands map!
    }: {
      topCard?: Card;
      currentTurn?: number;
      currentShape?: WhotShape | null;
      pendingPicks?: number;
      wasHoldOn?: boolean;
      turnStartedAt?: number | null;
      gameEndsAt?: number | null;
      playerLives?: Record<string, number>;
      prize?: number;
      hands?: Record<string, Card[]>; // Authoritative hands type!
    }) => {
      // Do not sync topCard visually if an animation is currently flying to the center
      if (topCard && !activePlayRef.current) setTopCard(topCard);
      if (prize !== undefined) setPrize(prize);

      if (currentShape !== undefined) {
        setCurrentShape(currentShape ?? null);
        if (currentShape !== null) {
          setShowShapePicker(false);
        }
      }

      if (pendingPicks !== undefined) setPendingPicks(pendingPicks);
      if (wasHoldOn !== undefined) setWasHoldOn(!!wasHoldOn);
      if (gameEndsAt !== undefined) setGameEndsAt(gameEndsAt ?? null);

      if (playerLives !== undefined) {
        setPlayerLives(playerLives);
        setPlayers(prev => prev.map(p => ({
          ...p,
          lives: playerLives[p.id] ?? p.lives
        })));
      }

      if (hands !== undefined) {
        pendingHandsRef.current = hands; // Keep ref updated with latest authoritative hands
        
        const isAnimating = !!activePlayRef.current || (activePicksCountRef && activePicksCountRef.current > 0);
        setPlayers(prev => prev.map(p => {
          const myHand = hands[p.id] || [];
          const isDrawing = myHand.length > p.cards.length;
          
          if (isAnimating || isDrawing) {
            return p; // Defer and wait for animation to complete and land
          }
          
          return {
            ...p,
            cards: myHand,
            cardCount: myHand.length
          };
        }));
      }

      if (currentTurn !== undefined) {
        if (activePlayRef.current || activePicksCountRef.current > 0) {
          pendingTurnRef.current = { turn: currentTurn, startedAt: turnStartedAt ?? null };
        } else {
          setTurnIndex(currentTurn);
          if (turnStartedAt !== undefined) setTurnStartedAt(turnStartedAt ?? null);
        }
      }
    };

    // ── whot_turn_update: lightweight turn-only sync ───────────────────────────
    const onWhotTurnUpdate = ({ nextTurn, turnStartedAt }: { nextTurn: number; turnStartedAt?: number | null }) => {
      if (activePlayRef.current || activePicksCountRef.current > 0) {
        pendingTurnRef.current = { turn: nextTurn, startedAt: turnStartedAt ?? null };
      } else {
        setTurnIndex(nextTurn);
        if (turnStartedAt !== undefined) setTurnStartedAt(turnStartedAt ?? null);
      }
    };

    const onWhotShapeChosen = ({ pi, shape, nextTurn, turnStartedAt }: { pi: number; shape: WhotShape; nextTurn: number; turnStartedAt?: number | null }) => {
      const seat = players[pi]?.seat as Seat;
      setShowShapePicker(false);
      setCurrentShape(shape);
      playWhotGMSound(shape);
      if (seat) {
        setShapeAskerSeat(seat);
        setActionMessage({ msg: `I want ${shape.toUpperCase()}!`, seat });
      }
      
      if (activePlayRef.current || activePicksCountRef.current > 0) {
        pendingTurnRef.current = { turn: nextTurn, startedAt: turnStartedAt ?? null };
      } else {
        setTurnIndex(nextTurn);
        if (turnStartedAt !== undefined) {
          setTurnStartedAt(turnStartedAt ?? null);
        }
      }
    };

    const onWhotRemoteAction = (data: { pi: number; msg: string }) => {
      const seat = players[data.pi]?.seat as Seat;
      if (seat) setActionMessage({ msg: data.msg, seat });
    };

    const onWhotReshuffle = ({ newCount }: { newCount: number }) => {
      setMarketCount(newCount);
    };

    const onWhotGameOver = (data: { winner: string, scores: any, reason?: string }) => {
      // Server sends scores as [{userId, score, handCount}] — convert to Record<userId, score>
      // so nothing tries to render a raw object as a React child.
      let normalizedScores: Record<string, number> = {};
      if (Array.isArray(data.scores)) {
        data.scores.forEach((s: any) => {
          if (s.userId != null) normalizedScores[s.userId] = s.score ?? 0;
        });
      } else if (data.scores && typeof data.scores === 'object') {
        normalizedScores = data.scores; // Already keyed
      }
 
      // data.winner is a userId — find the corresponding player color for onWinner
      const winnerPlayer = players.find(p => p.id === data.winner);
      const winnerColor = winnerPlayer?.color ?? data.winner;
 
      if (data.reason === 'WIN') {
        playWhotCheckupSound();
        // Delay showing result screen and unmounting WhotGameUI by 3 seconds
        // so the user can see the winning card play animation and final board state!
        setTimeout(() => {
          onWinner?.(winnerColor, normalizedScores);
        }, 3000);
      } else if (data.reason === 'TIME_UP') {
        playWhotCheckupSound();
        // Save these for when WhotScoringSystem closes
        setSavedWinnerInfo({ color: winnerColor, scores: normalizedScores });
        setShowScoring(true);
      } else {
        // For FORFEIT, etc. - go straight to result screen
        onWinner?.(winnerColor, normalizedScores);
      }
    };

    const onWhotTimerStarted = ({ gameEndsAt }: { gameEndsAt: number }) => {
      setGameEndsAt(gameEndsAt);
    };

    const onWhotLastCardAnnounced = ({ pi }: { pi: number }) => {
      const p = players[pi];
      if (p) {
        setActionMessage({ msg: "LAST CARD!", seat: p.seat as Seat });
        playWhotLastCardSound();
      }
    };

    socket.on('whot_init', onWhotInit);
    socket.on('whot_remote_play', onWhotRemotePlay);
    socket.on('whot_remote_pick', onWhotRemotePick);
    socket.on('whot_state', onWhotState);
    socket.on('whot_turn_update', onWhotTurnUpdate);
    socket.on('whot_shape_chosen', onWhotShapeChosen);
    socket.on('whot_remote_action', onWhotRemoteAction);
    socket.on('whot_market_reshuffle', onWhotReshuffle);
    socket.on('whot_game_over', onWhotGameOver);
    socket.on('whot_timer_started', onWhotTimerStarted);
    socket.on('whot_last_card_announced', onWhotLastCardAnnounced);

    return () => {
      socket.off('whot_init', onWhotInit);
      socket.off('whot_remote_play', onWhotRemotePlay);
      socket.off('whot_remote_pick', onWhotRemotePick);
      socket.off('whot_state', onWhotState);
      socket.off('whot_turn_update', onWhotTurnUpdate);
      socket.off('whot_shape_chosen', onWhotShapeChosen);
      socket.off('whot_remote_action', onWhotRemoteAction);
      socket.off('whot_market_reshuffle', onWhotReshuffle);
      socket.off('whot_game_over', onWhotGameOver);
      socket.off('whot_timer_started', onWhotTimerStarted);
      socket.off('whot_last_card_announced', onWhotLastCardAnnounced);
    };
  }, [
    gameId,
    visiblePlayers,
    players,
    handleRemotePlay,
    handleRemotePick,
    setPlayers,
    setTopCard,
    setTurnIndex,
    setTurnStartedAt,
    setGameStarted,
    setDealing,
    setActionMessage,
    setMarketCount,
    setCurrentShape,
    setShowShapePicker,
    setPendingPicks,
    setWasHoldOn,
    pendingHandsRef,
    hasJoinedRoom,
    activePlayRef,
  ]);

  return { handleRemotePlay, handleRemotePick, pendingTurnRef, activePicksCountRef };
}
