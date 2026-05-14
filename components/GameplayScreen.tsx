import { calculateXpGained, LevelUpdate, updatePlayerLevel } from '@/lib/leveling';
import { socket as sharedSocket } from '@/lib/socket';
import { supabase } from '@/lib/supabase';
import React from 'react';
import {
  Platform,
  StatusBar,
  StyleSheet,
  View
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
  green: { uri: 'https://i.pravatar.cc/80?img=12' },
  yellow: { uri: 'https://i.pravatar.cc/80?img=47' },
  blue: { uri: 'https://i.pravatar.cc/80?img=32' },
  red: { uri: 'https://i.pravatar.cc/80?img=13' },
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
}


export function GameplayScreen({ mode, playerCount, isAiEnabled, roomId, onExit, socket }: GameplayScreenProps) {
  const isLudo = mode.includes('ludo');
  const isWhot = mode.includes('whot');
  const isSnake = mode.includes('snake');
  const engine = useLudoEngine(playerCount);
  const snakeEngine = useSnakeLadderEngine(playerCount);
  const [localUser, setLocalUser] = React.useState<any>(null);
  const [roomPlayers, setRoomPlayers] = React.useState<any[]>([]);
  const [stake, setStake] = React.useState(0);
  const [showTestResult, setShowTestResult] = React.useState(false);
  const [levelUpdate, setLevelUpdate] = React.useState<LevelUpdate | null>(null);
  const [ping, setPing] = React.useState<number | null>(null);
  const [activeEmojis, setActiveEmojis] = React.useState<Record<string, any>>({});

  // Derive initial localColor from position in real players or fallback
  const [localColor, setLocalColor] = React.useState<BC>('green');
  const [synced, setSynced] = React.useState(false);
  const [isDiceRolling, setIsDiceRolling] = React.useState(false);
  const [whotWinner, setWhotWinner] = React.useState<BC | null>(null);
  const [whotScores, setWhotScores] = React.useState<Record<string, number>>({});

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
                coins: prof?.coins || 0
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
        if (isSnake) {
          snakeEngine.setIsRollingVisual(false);
          snakeEngine.movePlayerByUserId(payload.userId, payload.value);
        } else {
          engine.setIsDiceRolling(false);
          engine.rollDice(payload.value);
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

    // Supabase Sync for Pawns (for now)
    const channel = supabase.channel(`room_${roomId}`, {
      config: { broadcast: { self: true } }
    });

    channel
      .on('broadcast', { event: 'move' }, ({ payload }) => {
        if (payload.color !== localColor) {
          engine.movePawn(payload.pawnId);
        }
      })
      .on('broadcast', { event: 'timeout' }, ({ payload }) => {
        if (payload.senderColor !== localColor) {
          engine.handleTimeout(payload.targetColor, payload.turnId);
        }
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

  const wrappedMove = (pawnId: string) => {
    if (isSnake) {
      // Snake engine handles movement automatically after roll, no manual move piece action needed yet.
    } else {
      engine.movePawn(pawnId);
      
      if (!isAiEnabled && roomId) {
        supabase.channel(`room_${roomId}`).send({
          type: 'broadcast',
          event: 'move',
          payload: { color: localColor, pawnId }
        });
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
      supabase.channel(`room_${roomId}`).send({
        type: 'broadcast',
        event: 'timeout',
        payload: { senderColor: localColor, targetColor: color, turnId }
      });
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

  const [payoutProcessed, setPayoutProcessed] = React.useState(false);
  
  React.useEffect(() => {
    if (winner && !payoutProcessed && !showTestResult) {
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

              // Log transaction for win
              if (myRank === 1 && myPrize > 0) {
                await supabase.from('transactions').insert({
                  player_id: user.id,
                  amount: myPrize,
                  type: 'deposit',
                  status: 'completed',
                  description: `${playerCount}P ${gameType.toUpperCase()} Match - Rank ${myRank}`
                });
                
                const { DeviceEventEmitter } = require('react-native');
                DeviceEventEmitter.emit('wallet_updated');
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
  }, [winner, payoutProcessed, showTestResult, localColor, lives, playerCount, stake]);

  const elapsedRef = React.useRef(0);
  React.useEffect(() => {
    const id = setInterval(() => { 
      if (!winner && !showTestResult) {
        elapsedRef.current += 1; 
      }
    }, 1000);
    return () => clearInterval(id);
  }, [winner, showTestResult]);

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
    
    // Pot is stake * playerCount, winner gets 80%? Or whatever the prizes map says. 
    const pot = stake * playerCount;
    const prizeList = playerCount === 4 ? [pot * 0.8, pot * 0.2, 0, 0] : [pot, 0];

    return ranked.map((color, idx) => {
      const colorPawns = pawns.filter(p => p.color === color);
      const tokensHome = colorPawns.filter(p => p.state === 'home').length;
      
      const realPlayer = roomPlayers.find(p => p.color === color);
      const isLocal = color === localColor;
      const name = realPlayer?.username || (isLocal ? 'You' : getBotName(color as any, localColor));
      const avatar = realPlayer?.avatar_url ? { uri: realPlayer.avatar_url } : AVATARS[color];

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
            hidePopups={!!winner || showTestResult}
          />
        </View>
      )}

      {/* Floating HUD (no background of its own) */}
      {(isLudo && (synced || isAiEnabled)) ? (
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
        />
      ) : (isWhot && (synced || isAiEnabled)) ? (
        <WhotGameUI 
          gameId={roomId || undefined}
          playerCount={playerCount}
          realPlayers={roomPlayers}
          localColor={localColor}
          localUserId={localUser?.id}
          onExit={onExit} 
          onWinner={(c, scores) => {
            setWhotWinner(c as BC);
            if (scores) setWhotScores(scores);
          }}
          externalEmojis={activeEmojis}
          onSendEmoji={wrappedSendEmoji}
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
          />
        </>
      ) : (
        <View style={StyleSheet.absoluteFill} />
      )}

      {/* ── Results overlay ── */}
      {(!!winner || showTestResult) && (
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
              // Bot game: Reset engine and keep playing
              setPayoutProcessed(false);
              setShowTestResult(false);
              if (isSnake) snakeEngine.resetGame();
              else if (isLudo) engine.resetGame();
              // For Whot, since it's currently handled in its own UI, we'd need to handle it there too
              // but for now, we'll just close the test result
            } else {
              // Real match: Back to lobby and auto-search
              (onExit as any)({ autoSearch: true });
            }
          }}
          onExit={onExit}
          isBotGame={isAiEnabled}
          isWhot={isWhot}
          isSnake={isSnake}
        />
      )}

    </View>
  );
}

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
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
  devBtn: {
    position: 'absolute',
    bottom: 18,
    right: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(244,190,59,0.35)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 50,
  },
});
