import { calculateXpGained, LevelUpdate, updatePlayerLevel } from '@/lib/leveling';
import { playPlayerFoundSound } from '@/lib/sounds';
import { socket as sharedSocket } from '@/lib/socket';
import { supabase } from '@/lib/supabase';
import React from 'react';
import {
  Animated,
  Easing,
  Platform,
  StatusBar,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView
} from 'react-native';

import { Image } from 'expo-image';
import { BC } from '../engine/LudoPath';
import { useLudoEngine } from '../engine/useLudoEngine';
import { useSnakeLadderEngine } from '../engine/useSnakeLadderEngine';
import { GameResultScreen, ResultPlayer } from './GameResultScreen';
import { LudoBoard } from './LudoBoard';
import { LudoGameUI } from './LudoGameUI';
import { SnakeLadderBoard } from './SnakeLadderBoard';
import { SnakeLadderGameUI } from './SnakeLadderGameUI';
import { WhotGameUI } from './WhotGameUI';
import { getBotName } from './WhotUtils';


const AVATARS: Record<string, { uri: string }> = {
  green: { uri: 'https://api.dicebear.com/7.x/avataaars/png?seed=Felix&backgroundColor=c1f4c1' },
  yellow: { uri: 'https://api.dicebear.com/7.x/avataaars/png?seed=Aneka&backgroundColor=ffdfbf' },
  blue: { uri: 'https://api.dicebear.com/7.x/avataaars/png?seed=Jasper&backgroundColor=b6e3f4' },
  red: { uri: 'https://api.dicebear.com/7.x/avataaars/png?seed=Zara&backgroundColor=ffd5dc' },
};
const NAMES: Record<string, string> = { green: 'Ayo', yellow: 'Amina', blue: 'Obinna', red: 'Tunde' };
const PRIZES: Record<number, number[]> = {
  4: [12500, 6250, 0, 0],
  2: [25000, 0],
};

export type GameMode = 'ludo' | 'whot' | 'ludo_t' | 'whot_t' | 'snake_ladder';
export type PlayerCount = 2 | 4;

interface GameplayScreenProps {
  mode: GameMode;
  playerCount: PlayerCount;
  isAiEnabled: boolean;
  roomId: string | null;
  onExit: () => void;
  socket?: any;
  stake?: number;
}


export function GameplayScreen({ mode, playerCount, isAiEnabled, roomId, onExit, socket, stake: stakeProp = 0 }: GameplayScreenProps) {
  const isLudo = mode.includes('ludo');
  const isWhot = mode.includes('whot');
  const isSnake = mode.includes('snake');
  const engine = useLudoEngine(playerCount);
  const snakeEngine = useSnakeLadderEngine(playerCount);
  const [localUser, setLocalUser] = React.useState<any>(null);
  const [roomPlayers, setRoomPlayers] = React.useState<any[]>([]);
  const [stake, setStake] = React.useState(stakeProp);
  const [rematchKey, setRematchKey] = React.useState(0);
  const [levelUpdate, setLevelUpdate] = React.useState<LevelUpdate | null>(null);
  const [ping, setPing] = React.useState<number | null>(null);
  const [activeEmojis, setActiveEmojis] = React.useState<Record<string, any>>({});

  // Derive initial localColor from position in real players or fallback
  const [localColor, setLocalColor] = React.useState<BC>('green');
  const [synced, setSynced] = React.useState(false);
  const [isDiceRolling, setIsDiceRolling] = React.useState(false);
  const channelRef = React.useRef<any>(null);
  // Dedup guard: tracks the roll counter for the last emitted pawn_moved.
  // Increments on every dice_rolled so extra turns (rolling 6) get a fresh slot.
  const moveEmittedForRollRef = React.useRef<number>(-1);
  const rollCountRef = React.useRef<number>(0);
  const [whotWinner, setWhotWinner] = React.useState<BC | null>(null);
  const [whotScores, setWhotScores] = React.useState<Record<string, number>>({});
  const [platformFeePercent, setPlatformFeePercent] = React.useState<number>(10);

  // Fetch dynamic platform percentage configuration from database
  React.useEffect(() => {
    supabase
      .from('platform_config')
      .select('platform_percentage')
      .eq('id', 1)
      .single()
      .then(({ data, error }) => {
        if (!error && data && data.platform_percentage !== undefined) {
          setPlatformFeePercent(data.platform_percentage);
        }
      })
      .catch(err => console.warn('Failed to load platform percentage config in GameplayScreen:', err));
  }, []);

  // 1. Fetch User & Sync Room
  React.useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      setLocalUser(user);

      if (!isAiEnabled && roomId) {
        const { data: room } = await supabase.from('game_rooms').select('*').eq('id', roomId).single();
        if (room && room.players) {
          setStake(room.stake || 0);
          const myEntry = room.players.find((p: any) => p.id === user?.id);
          if (myEntry && myEntry.color) setLocalColor(myEntry.color);

          // Fetch full profiles for all players to get real balances/avatars
          const playerIds = room.players.map((p: any) => p.id);
          const { data: profiles } = await supabase.from('profiles').select('*').in('id', playerIds);
          
          if (profiles) {
            const mapped = room.players.map((rp: any) => {
              const prof = profiles.find(p => p.id === rp.id);
              return {
                ...rp,
                username: prof?.username || rp.username || 'Player',
                avatar_url: prof?.avatar_url || rp.avatar_url,
                coins: prof?.wallet_balance || prof?.coins || 0
              };
            });
            setRoomPlayers(mapped);
            if (isSnake) {
              const enginePlayers = mapped.map((p: any) => ({
                id: p.id,
                color: p.color,
                position: 0,
                isBot: !!p.isBot,
                lives: 4
              }));
              snakeEngine.setPlayers(enginePlayers);
            }
          } else {
            setRoomPlayers(room.players);
            if (isSnake) {
              const enginePlayers = room.players.map((p: any) => ({
                id: p.id,
                color: p.color,
                position: 0,
                isBot: !!p.isBot,
                lives: 4
              }));
              snakeEngine.setPlayers(enginePlayers);
            }
          }
        }
      } else {
        // AI / Practice Mode Setup
        const gameColors = isSnake 
          ? (playerCount === 2 ? ['green', 'red'] : ['green', 'yellow', 'red', 'blue'])
          : (isWhot ? ['green', 'yellow', 'red', 'blue'].slice(0, playerCount) : engine.state.activeColors);
        
        const randomColor = gameColors[Math.floor(Math.random() * gameColors.length)];
        setLocalColor(randomColor as any);
        
        const { data: profile } = user ? await supabase.from('profiles').select('*').eq('id', user.id).single() : { data: null };
        
        // Build players list including bots
        const allPlayers = gameColors.map((color) => {
          if (color === randomColor) {
            return {
              id: user?.id || 'local-user',
              color: color,
              username: profile?.username || 'You',
              avatar_url: profile?.avatar_url,
              coins: profile?.wallet_balance || profile?.coins || 0,
              isBot: false
            };
          } else {
            return {
              id: `bot-${color}`,
              color: color,
              username: getBotName(color as any, randomColor as any),
              avatar_url: AVATARS[color as any]?.uri,
              coins: 5000,
              isBot: true
            };
          }
        });

        setRoomPlayers(allPlayers);
        
        if (isSnake) {
          const enginePlayers = allPlayers.map(p => ({
            id: p.id,
            color: p.color as any,
            position: 0,
            isBot: p.isBot,
            lives: 4
          }));
          snakeEngine.setPlayers(enginePlayers);
        }
      }
      setSynced(true);
    }
    init();
  }, [roomId, isAiEnabled]);

  // 2. Real-time Sync
  React.useEffect(() => {
    if (isAiEnabled || !roomId || !synced) return;

    // Node.js Socket Sync for Dice
    if (roomId) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        const u = session?.user;
        if (!u) return;
        supabase.from('profiles').select('username, avatar_url').eq('id', u.id).single().then(({ data: prof }) => {
          sharedSocket.emit('join_room', {
            roomId,
            userId: u.id,
            username: prof?.username || 'Player',
            avatar: prof?.avatar_url
          });
        });
      });
      
      sharedSocket.on('dice_rolling', () => {
        if (isSnake) snakeEngine.setIsRollingVisual(true);
        if (isLudo) engine.setIsDiceRolling(true);
        setIsDiceRolling(true);
      });

      sharedSocket.on('dice_rolled', (payload: { userId: string, value: number }) => {
        setIsDiceRolling(false);
        rollCountRef.current += 1;
        if (isSnake) {
          // Play rolling animation for exactly 1200ms, then wait 500ms before token moves
          snakeEngine.setDiceValue(payload.value);
          snakeEngine.setIsRollingVisual(true);
          setTimeout(() => {
            snakeEngine.setIsRollingVisual(false);
            setTimeout(() => {
              snakeEngine.movePlayerByUserId(payload.userId, payload.value);
            }, 500);
          }, 1200);
        } else {
          engine.setIsDiceRolling(false);
          if (isLudo && payload.value != null) {
            if (localUser?.id && payload.userId === localUser.id) {
              // Local roll: full engine processing (valid-move checks, auto-advance, etc.)
              engine.rollDice(payload.value);
            } else {
              // Remote roll: set visual dice value only — NO valid-move logic (server decides)
              engine.setState(prev => ({ ...prev, diceValue: payload.value, hasRolled: true }));
            }
          }
        }
      });

      // Opponent moved a pawn: just move — dice value already set from dice_rolled
      sharedSocket.on('pawn_moved', (payload: { color: string, pawnId: string, diceValue: number }) => {
        if (isLudo && payload.color !== localColor) {
          // Ensure display state is set (in case dice_rolled was missed)
          engine.setState(prev => ({ ...prev, diceValue: payload.diceValue, hasRolled: true }));
          engine.movePawn(payload.pawnId);
        }
      });

      // Opponent had no valid moves — set dice value, then advance after brief display
      sharedSocket.on('turn_passed', (payload: { color: string, diceValue: number }) => {
        if (isLudo && payload.color !== localColor) {
          engine.setState(prev => ({
            ...prev,
            diceValue: payload.diceValue,
            hasRolled: true,
            messages: [`${payload.color} rolled ${payload.diceValue}. No valid moves!`, ...prev.messages],
          }));
          setTimeout(() => {
            if (payload.diceValue === 6) {
              // 6 with no moves → extra turn: keep turnIndex, just reset roll
              engine.setState(prev => ({
                ...prev, hasRolled: false, diceValue: null, turnId: prev.turnId + 1, action: null,
              }));
            } else {
              engine.nextTurn();
            }
          }, 1500);
        }
      });

      // Opponent timed out
      sharedSocket.on('player_timeout', (payload: { targetColor: string, turnId: number }) => {
        if (isLudo && payload.targetColor !== localColor) {
          engine.handleTimeout(payload.targetColor as BC, payload.turnId);
        }
      });

      sharedSocket.on('emoji_sent', (payload: { userId: string, emoji: any, color: string }) => {
        setActiveEmojis(prev => ({ ...prev, [payload.color]: payload.emoji }));
        setTimeout(() => {
          setActiveEmojis(prev => {
            const next = { ...prev };
            delete next[payload.color];
            return next;
          });
        }, 3000);
      });
    }

    // Supabase channel kept only for emoji sync (not for game moves)
    const channel = supabase.channel(`room_${roomId}`);
    channelRef.current = channel;
    channel
      .on('broadcast', { event: 'timeout' }, ({ payload }) => {
        // timeout broadcast kept for legacy compatibility; socket handles it now too
      })
      .subscribe();

    // Ping Logic
    let pingInterval: any;
    {
      sharedSocket.on('client_pong', (timestamp: number) => {
        setPing(Date.now() - timestamp);
      });
      pingInterval = setInterval(() => {
        sharedSocket.emit('client_ping', Date.now());
      }, 2000);
    }

    return () => { 
      sharedSocket.off('dice_rolled');
      sharedSocket.off('dice_rolling');
      sharedSocket.off('pawn_moved');
      sharedSocket.off('player_timeout');
      sharedSocket.off('turn_passed');
      sharedSocket.off('client_pong');
      clearInterval(pingInterval);
      channel.unsubscribe(); 
    };
  }, [roomId, isAiEnabled, synced, localColor]);

  // Wrap engine actions to broadcast
  const wrappedRoll = (val?: number) => {
    if (!isAiEnabled && (val === 0 || val === undefined)) {
      // Ask server for a new roll (authoritative)
      sharedSocket.emit('request_roll', { roomId });
    } else {
      // Apply the result (from server, AI, or if val > 0)
      if (isSnake) {
        snakeEngine.rollDice(val);
      } else {
        engine.rollDice(val as number);
      }
    }
  };

  // When the human's own roll results in no valid moves, tell the bot to advance its turn.
  // The engine auto-calls nextTurn after 1500ms; we emit turn_passed at the same time.
  React.useEffect(() => {
    if (isAiEnabled || !roomId || !engine.state.hasRolled || engine.state.winner) return;
    const turnColor = engine.state.activeColors[engine.state.turnIndex];
    if (turnColor !== localColor) return;
    // Check if any moves are possible for the human
    const hasAnyMove = engine.state.pawns.some(p => {
      if (p.color !== localColor || p.state === 'finished') return false;
      if (p.state === 'home') return engine.state.diceValue === 6;
      return p.pathIndex + (engine.state.diceValue ?? 0) <= 56;
    });
    if (!hasAnyMove && engine.state.diceValue != null) {
      sharedSocket.emit('turn_passed', { color: localColor, diceValue: engine.state.diceValue });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.state.hasRolled, engine.state.turnIndex]);


  const wrappedMove = (pawnId: string) => {
    if (isSnake) {
      // Snake engine handles movement automatically after roll
    } else {
      const diceAtMove = engine.state.diceValue;
      engine.movePawn(pawnId);
      if (!isAiEnabled && roomId) {
        const currentRoll = rollCountRef.current;
        // Guard: only emit once per dice roll (auto-move + manual tap can both fire).
        // rollCountRef increments on every dice_rolled, so extra turns after 6 are
        // treated as a fresh roll and can emit correctly.
        if (moveEmittedForRollRef.current !== currentRoll) {
          moveEmittedForRollRef.current = currentRoll;
          sharedSocket.emit('pawn_moved', { color: localColor, pawnId, diceValue: diceAtMove });
        }
      }
    }
  };

  const wrappedTimeout = (color: BC, turnId: number) => {
    if (isSnake) {
      snakeEngine.handleTimeout(color);
    } else {
      engine.handleTimeout(color, turnId);
    }
    
    if (!isAiEnabled && roomId) {
      sharedSocket.emit('player_timeout', { senderColor: localColor, targetColor: color, turnId });
    }
  };

  const wrappedSendEmoji = (emoji: any) => {
    // 1. Show locally immediately
    setActiveEmojis(prev => ({ ...prev, [localColor]: emoji }));
    setTimeout(() => {
      setActiveEmojis(prev => {
        const next = { ...prev };
        delete next[localColor];
        return next;
      });
    }, 3000);

    // 2. Broadcast if multiplayer
    if (!isAiEnabled && roomId) {
      sharedSocket.emit('send_emoji', { roomId, emoji, color: localColor });
    }
  };

  // Derive a winner: only 1 player with lives left OR a player has all 4 pawns finished
  const { activeColors, pawns, lives } = engine.state;
  const ludoSurvivors = activeColors.filter(c => lives[c] > 0);
  const finishedPlayerColor = activeColors.find(c => {
    const cPawns = pawns.filter(p => p.color === c);
    return cPawns.length === 4 && cPawns.every(p => p.state === 'finished');
  });
  const ludoWinner = finishedPlayerColor || (ludoSurvivors.length === 1 ? ludoSurvivors[0] : null);

  const snakeSurvivors = snakeEngine.players.filter(p => p.lives > 0);
  const snakeWinnerColor = snakeEngine.winner ? snakeEngine.players.find(p => p.id === snakeEngine.winner)?.color 
    : (snakeSurvivors.length === 1 ? snakeSurvivors[0].color : null);

  const winner = isLudo ? ludoWinner : isWhot ? whotWinner : snakeWinnerColor;

  // Delay showing result screen to let capture/move animations play out
  const [showResult, setShowResult] = React.useState(false);
  React.useEffect(() => {
    if (winner) {
      const t = setTimeout(() => setShowResult(true), 1200);
      return () => clearTimeout(t);
    }
    setShowResult(false);
  }, [winner]);

  const [payoutProcessed, setPayoutProcessed] = React.useState(false);
  
  React.useEffect(() => {
    if (winner && !payoutProcessed) {
      setPayoutProcessed(true);

      const processPayout = async () => {
        if (isAiEnabled) return; // Skip DB updates for practice mode
        
        const results = buildResults();
        const localPlayer = results.find(p => p.isLocal);
        if (!localPlayer) return;

        const myRank = localPlayer.rank;
        const myPrize = localPlayer.prize;
        const gameType = isLudo ? 'ludo' : isWhot ? 'whot' : 'snake_ladder';
        
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            // 1. Log the game & Transaction (ONLY for modes NOT handled by the server yet)
            // The server now handles ALL Whot results and payouts automatically.
            if (gameType !== 'whot') {
              const { error: gameErr } = await supabase.from('games').insert({
                player_id: user.id,
                game_type: gameType,
                table_name: `${playerCount}P Match`,
                stake: stake,
                result: myRank === 1 ? 'win' : 'loss',
                win_amount: myPrize
              });
              if (gameErr) console.error('Error logging game:', gameErr);
              // Log transaction for win securely via RPC
              if (myRank === 1 && myPrize > 0 && roomId) {
                const { error: rpcErr } = await supabase.rpc('claim_game_win', {
                  p_room_id: roomId
                });
                if (rpcErr) console.error('Error claiming win:', rpcErr);
                else {
                  const { DeviceEventEmitter } = require('react-native');
                  DeviceEventEmitter.emit('wallet_updated');
                }
              }
            }
            
            const { DeviceEventEmitter } = require('react-native');
            DeviceEventEmitter.emit('game_completed');

            // 3. Update XP and Level (Handled by client for all modes)
            const myResults = buildResults().find(p => p.isLocal);
            const captures = myResults?.captures || 0;
            const xpEarnedReal = calculateXpGained(myRank, elapsedRef.current, captures, playerCount === 2 ? '2P' : '4P');
            
            const update = await updatePlayerLevel(user.id, xpEarnedReal, myRank === 1);
            if (update) {
              setLevelUpdate(update);
            }
          }
        } catch (e) {
          console.error('Error processing payout/XP:', e);
        }
      };
      
      processPayout();
    }
  }, [winner, payoutProcessed, localColor, lives, playerCount, stake]);

  const elapsedRef = React.useRef(0);
  React.useEffect(() => {
    const id = setInterval(() => { 
      if (!winner) {
        elapsedRef.current += 1; 
      }
    }, 1000);
    return () => clearInterval(id);
  }, [winner]);

  const buildResults = (): ResultPlayer[] => {
    let ranked: BC[] = [];
    
    if (isWhot) {
      // Whot sorting: Explicit winner first, then others by score (lowest first)
      const order: BC[] = [];
      if (winner) order.push(winner as BC);
      
      const others = Object.entries(whotScores)
        .filter(([c]) => c !== winner)
        .sort(([, a], [, b]) => a - b)
        .map(([c]) => c as BC);
        
      order.push(...others);
      
      // Ensure all active colors are included
      const allColors = playerCount === 2 ? ['green', 'red'] : ['green', 'yellow', 'red', 'blue'];
      allColors.forEach(c => {
        if (!order.includes(c as BC)) order.push(c as BC);
      });
      ranked = order;
    } else {
      // Ludo/Snake sorting: winner first, then survivors, then kicked players in reverse order of elimination
      const currentLives = isLudo ? lives : snakeEngine.players.reduce((acc, p) => ({ ...acc, [p.color]: p.lives }), {} as Record<string, number>);
      
      const kicked = Object.entries(currentLives)
        .filter(([, v]) => v <= 0)
        .map(([c]) => c as BC);
        
      const survivors = (isLudo ? activeColors : snakeEngine.players.map(p => p.color))
        .filter(c => currentLives[c as BC] > 0 && c !== winner);

      const order = winner ? [winner, ...survivors, ...kicked.reverse()] : [];
      
      // Safety fallback
      const allColors = playerCount === 2 ? ['green', 'red'] : ['green', 'yellow', 'red', 'blue'];
      allColors.forEach(c => {
        if (!order.includes(c as BC)) order.push(c as BC);
      });
      ranked = order as BC[];
    }
    
    // Winner gets their own stake back + net winnings (opponents' combined stake with dynamic database fee deducted)
    const platformPercentage = platformFeePercent;
    const netWinnings = stake * (playerCount - 1) * (1.0 - (platformPercentage / 100.0));
    const netPayout = stake + netWinnings;
    const prizeList = playerCount === 4 ? [netPayout, 0, 0, 0] : [netPayout, 0];

    return ranked.map((color, idx) => {
      const colorPawns = pawns.filter(p => p.color === color);
      const tokensHome = colorPawns.filter(p => p.state === 'home').length;
      
      const realPlayer = roomPlayers.find(p => p.color === color);
      const isLocal = color === localColor;
      const name = realPlayer?.username || (isLocal ? 'You' : getBotName(color as any, localColor));
      const isBot = realPlayer?.isBot || (isAiEnabled && color !== localColor);
      const avatar = (isBot || !realPlayer?.avatar_url) ? AVATARS[color as BC] : { uri: realPlayer.avatar_url };

      // Whot results use card score; Ludo uses token/lives state
      const whotScore = isWhot ? (whotScores[color] ?? 0) : 0;
      const captures = isLudo ? (engine.state.captures[color as BC] || 0) : 0;

      return {
        name,
        color,
        avatar,
        rank: idx + 1,
        prize: prizeList[idx] ?? 0,
        isLocal: color === localColor,
        lives: lives[color as BC] ?? 0,
        tokensHome,
        captures,
        score: whotScore,
        isBot: realPlayer?.isBot || (isAiEnabled && color !== localColor)
      };
    });
  };


  React.useEffect(() => {
    try {
      const NB = require('expo-navigation-bar');
      if (Platform.OS === 'android') {
        NB.setVisibilityAsync('hidden').catch(() => { });
      }
      return () => {
        if (Platform.OS === 'android') {
          NB.setVisibilityAsync('visible').catch(() => { });
        }
      };
    } catch { return undefined; }
  }, []);
  const [diceReady, setDiceReady] = React.useState(false);

  // ── In-game 5-second starting countdown ──────────────────────────────────
  const [boardCountdown, setBoardCountdown] = React.useState<number>(5);
  const countdownActive = boardCountdown > 0;

  // Count 5 → 0, play a beep each tick, then clear
  React.useEffect(() => {
    if (boardCountdown <= 0) return;
    playPlayerFoundSound();
    const t = setTimeout(() => setBoardCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [boardCountdown]);

  // Animated scale for the big countdown number (pops in on every change)
  const cdScale = React.useRef(new Animated.Value(2)).current;
  React.useEffect(() => {
    if (boardCountdown <= 0) return;
    cdScale.setValue(2.2);
    Animated.spring(cdScale, {
      toValue: 1,
      friction: 4,
      tension: 160,
      useNativeDriver: true,
    }).start();
  }, [boardCountdown]);

  // Fade out the whole overlay when countdown reaches 0
  const cdOpacity = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    if (boardCountdown === 0) {
      Animated.timing(cdOpacity, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [boardCountdown]);

  return (
    <View style={st.root}>
      <StatusBar hidden translucent backgroundColor="transparent" />

      {/* Full-bleed background — NO overlays blocking it */}
      <Image
        source={isLudo
          ? require('@/assets/images/ludo.png')
          : isSnake 
            ? require('@/assets/images/snake.png')
            : require('@/assets/images/whot.png')}
        style={{ width: '100%', height: '100%', position: 'absolute' }}
        contentFit="fill"
      />
      {/* Dimmer overlay to reduce brightness */}
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.15)' }]}
        pointerEvents="none"
      />

      {/* Ludo board — centred with enough room for the floating HUD */}
      {isLudo && (
        <View style={st.boardArea} pointerEvents="box-none">
          <LudoBoard 
            engine={{ ...engine, rollDice: wrappedRoll, movePawn: wrappedMove }} 
            localColor={localColor} 
            isAiEnabled={isAiEnabled && !roomId} 
            onDiceReady={() => setDiceReady(true)} 
            isDiceRolling={isDiceRolling}
            hidePopups={!!winner}
            isCountdownActive={countdownActive}
          />
        </View>
      )}

      {/* Floating HUD (no background of its own) */}
      {!winner && (isLudo && (synced || isAiEnabled)) ? (
        <LudoGameUI 
          playerCount={playerCount} 
          onExit={onExit} 
          engine={{ ...engine, rollDice: wrappedRoll, movePawn: wrappedMove, handleTimeout: wrappedTimeout }} 
          localColor={localColor} 
          diceReady={diceReady}
          isDiceRolling={engine.isDiceRolling}
          realPlayers={roomPlayers}
          stake={stake}
          isAiEnabled={isAiEnabled}
          networkPing={ping}
          externalEmojis={activeEmojis}
          onSendEmoji={wrappedSendEmoji}
          isCountdownActive={countdownActive}
        />
      ) : (isWhot && (synced || isAiEnabled)) ? (
        <WhotGameUI 
          key={rematchKey}
          gameId={roomId || undefined}
          playerCount={playerCount}
          stake={stake}
          realPlayers={roomPlayers}
          localColor={localColor}
          localUserId={localUser?.id}
          onExit={onExit} 
          onWinner={(c, scores) => {
            setWhotWinner(c as BC);
            if (scores) {
              // Normalize score keys from userId → color name so buildResults() works correctly
              const colorScores: Record<string, number> = {};
              Object.entries(scores).forEach(([key, val]) => {
                const p = roomPlayers.find(rp => rp.id === key || rp.color === key);
                colorScores[p?.color || key] = val as number;
              });
              setWhotScores(colorScores);
            }
          }}
          externalEmojis={activeEmojis}
          onSendEmoji={wrappedSendEmoji}
          isCountdownActive={countdownActive}
        />
      ) : isSnake ? (
        <>
          <View style={st.boardArea}>
            <SnakeLadderBoard 
                engine={snakeEngine}
                isAiEnabled={isAiEnabled}
            />
          </View>
          <SnakeLadderGameUI 
            playerCount={playerCount}
            onExit={onExit}
            engine={{ ...snakeEngine, rollDice: wrappedRoll, handleTimeout: wrappedTimeout } as any}
            localColor={localColor}
            realPlayers={roomPlayers}
            stake={stake}
            isAiEnabled={isAiEnabled}
            networkPing={ping}
            externalEmojis={activeEmojis}
            onSendEmoji={wrappedSendEmoji}
            isCountdownActive={countdownActive}
          />
        </>
      ) : (
        <View style={StyleSheet.absoluteFill} />
      )}

      {/* ── Results overlay ── */}
      {showResult && (
        <GameResultScreen
          players={buildResults()}
          totalPrize={stake * playerCount}
          durationSecs={elapsedRef.current}
          mode={playerCount === 2 ? '2P' : '4P'}
          level={levelUpdate?.newLevel}
          xpProgress={levelUpdate?.progress}
          xpGained={levelUpdate?.xpGained}
          onPlayAgain={() => {
            if (isAiEnabled) {
              setPayoutProcessed(false);
              if (isSnake) snakeEngine.resetGame();
              else if (isLudo) engine.resetGame();
              if (isWhot) {
                setWhotWinner(null);
                setWhotScores({});
                setRematchKey(k => k + 1);
              }
            } else {
              // Real match: Back to lobby and auto-search
              (onExit as any)({ autoSearch: true });
            }
          }}
          onExit={onExit}
          isBotGame={isAiEnabled}
          isWhot={isWhot}
          isSnake={isSnake}
          platformFeePercent={platformFeePercent}
        />
      )}




      {/* ── In-game starting countdown overlay ── */}
      {boardCountdown >= 0 && !winner && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            st.cdBackdrop,
            { opacity: cdOpacity },
          ]}
          pointerEvents={countdownActive ? 'auto' : 'none'}
        >
          <Text style={st.cdGetReady}>GET READY</Text>
          <Animated.Text
            style={[
              st.cdNumber,
              { transform: [{ scale: cdScale }] },
            ]}
          >
            {boardCountdown > 0 ? boardCountdown : '🏁'}
          </Animated.Text>
          <Text style={st.cdSub}>Game starting soon…</Text>
        </Animated.View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  // ── Countdown overlay ──────────────────────────────────────────────────────
  cdBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    gap: 6,
  },
  cdGetReady: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  cdNumber: {
    fontSize: 96,
    fontWeight: '900',
    color: '#FFFFFF',
    textShadowColor: 'rgba(255,255,255,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
    fontVariant: ['tabular-nums'],
    lineHeight: 110,
  },
  cdSub: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  boardArea: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 65,
    paddingBottom: 66,
    paddingHorizontal: 0,
  },
  floatBack: {
    position: 'absolute',
    top: 16, left: 16,
    width: 36, height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

