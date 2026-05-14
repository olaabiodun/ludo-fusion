import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useLudoEngine } from '../engine/useLudoEngine';
import { EMOJI_PACK } from '../lib/emojis';
import { GameQuitModal } from './GameQuitModal';
import { PlayerProfileModal } from './PlayerProfileModal';
import { Seat } from './WhotUtils';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type PlayerCount = 2 | 4;

const C = {
  gold: '#F4BE3B',
  text: '#FFF8E8',
  muted: 'rgba(255,248,232,0.7)',
  green: '#4AE65C',
  yellow: '#FFD030',
  blue: '#2DA8FF',
  red: '#FF4A42',
};

type Color = 'green' | 'yellow' | 'blue' | 'red';

interface Player {
  id?: string;
  name: string;
  color: Color;
  seat: Seat;
  coins: number;
  active?: boolean;
  tokensHome: number;
  avatar: ImageSourcePropType | null;
}

const colorHex: Record<Color, string> = {
  green: C.green,
  yellow: C.yellow,
  blue: C.blue,
  red: C.red,
};

const pal: Record<Color, string[]> = {
  green: ['#4AE65C', '#2DBE41', '#1A8F28'],
  yellow: ['#FFD030', '#F4BE3B', '#D99E1F'],
  blue: ['#2DA8FF', '#1A8CFF', '#0066CC'],
  red: ['#FF4A42', '#E63932', '#B3241F'],
};

const PLAYERS: Player[] = [
  { name: 'Folake', color: 'green', seat: 'TL', coins: 3250, active: true, tokensHome: 2, avatar: { uri: 'https://i.pravatar.cc/80?img=12' } },
  { name: 'Amina', color: 'yellow', seat: 'TR', coins: 4120, active: false, tokensHome: 3, avatar: { uri: 'https://i.pravatar.cc/80?img=47' } },
  { name: 'Obinna', color: 'blue', seat: 'BL', coins: 2800, active: false, tokensHome: 4, avatar: { uri: 'https://i.pravatar.cc/80?img=32' } },
  { name: 'Tunde', color: 'red', seat: 'BR', coins: 5500, active: false, tokensHome: 1, avatar: { uri: 'https://i.pravatar.cc/80?img=13' } },
];

const SEAT_POS: Record<Seat, object> = {
  TL: { top: 52, left: 8 },
  TR: { top: 52, right: 8 },
  BL: { bottom: 68, left: 8 },
  BR: { bottom: 68, right: 8 },
};

export function getSeatForColor(color: Color, localColor: Color): Seat {
  const colors: Color[] = ['green', 'yellow', 'red', 'blue'];
  const seats: Seat[] = ['TL', 'TR', 'BR', 'BL'];

  const localIdx = colors.indexOf(localColor);
  const colorIdx = colors.indexOf(color);

  // Shift the seats so localColor is always at index 3 (BL)
  // localIdx = 3 (blue) -> shift = 0
  // localIdx = 0 (green) -> shift = 3
  const shift = (3 - localIdx + 4) % 4;
  const targetIdx = (colorIdx + shift) % 4;

  return seats[targetIdx];
}

const tokenImages: Record<Color, any> = {
  green: require('../assets/images/tokeng.png'),
  yellow: require('../assets/images/tokeny.png'),
  blue: require('../assets/images/tokenb.png'),
  red: require('../assets/images/tokenr.png'),
};

function BubblingEmoji({ img, onPress, index }: { img: any; onPress: () => void; index: number }) {
  const scale = React.useRef(new Animated.Value(0)).current;
  const float = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    // Entrance animation
    Animated.spring(scale, {
      toValue: 1,
      delay: index * 25,
      friction: 4,
      useNativeDriver: true,
    }).start();

    // Bubbling / Floating loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 1200 + Math.random() * 800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1200 + Math.random() * 800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <TouchableOpacity 
      onPress={onPress}
      activeOpacity={0.6}
    >
      <Animated.View style={[st.emojiItem, { 
        transform: [
          { scale },
          { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }
        ] 
      }]}>
        <Image source={img} style={st.emojiImg} />
      </Animated.View>
    </TouchableOpacity>
  );
}

function PlayerChip({
  player,
  active,
  lives,
  turnId,
  finishedCount,
  stake,
  winner,
  onTimeout,
  onPressProfile,
  activeEmoji
}: {
  player: Player;
  active: boolean;
  lives: number;
  turnId: number;
  finishedCount: number;
  stake: number;
  winner: string | null;
  onTimeout: (color: Color, turnId: number) => void;
  onPressProfile: () => void;
  activeEmoji?: any;
}) {
  const p = player;
  const col = colorHex[p.color];
  const isRight = p.seat === 'TR' || p.seat === 'BR';
  const isKicked = lives <= 0;

  const progress = React.useRef(new Animated.Value(0)).current;
  const bubbleAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (activeEmoji) {
      bubbleAnim.setValue(0);
      Animated.spring(bubbleAnim, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }
  }, [activeEmoji]);

  React.useEffect(() => {
    if (active && !isKicked && !winner) {
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: 20000,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          onTimeout(p.color, turnId);
        }
      });
    } else {
      progress.stopAnimation();
    }
  }, [active, turnId, isKicked]);

  const size = 48;
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, circumference]
  });

  const timerColor = progress.interpolate({
    inputRange: [0, 0.65, 0.7, 0.85, 0.9, 1],
    outputRange: [col, col, '#FFD030', '#FFD030', '#FF4A42', '#FF4A42']
  });

  return (
    <TouchableOpacity
      style={[st.chip, SEAT_POS[p.seat], isRight && st.chipFlip, isKicked && { opacity: 0.4 }]}
      activeOpacity={0.8}
      onPress={onPressProfile}
    >
      {/* Visual Finished Token Row */}
      {finishedCount > 0 && (
        <View style={[
          st.finishedRow,
          { bottom: -38 } // Increased vertical space
        ]}>
          {Array.from({ length: finishedCount }).map((_, i) => (
              <View
                key={i}
                style={[
                  st.finishedToken,
                  { marginLeft: i === 0 ? 0 : -25, zIndex: i }
                ]}
              >
                <Image
                  source={tokenImages[p.color]}
                  style={{ width: 32, height: 32 }}
                  resizeMode="contain"
                />
              </View>
          ))}
        </View>
      )}

      {active && (
        <View style={[StyleSheet.absoluteFillObject, st.activeRing, { borderColor: col }]} />
      )}

      {active && (
        <View style={[
          st.turnBadge,
          { backgroundColor: col },
          isRight ? { right: 8 } : { left: 8 }
        ]}>
          <Text style={st.turnBadgeText}>
            {p.name === 'You' ? 'YOUR TURN' : `${p.name.toUpperCase()}'S TURN`}
          </Text>
        </View>
      )}

      <View style={{
        width: size,
        height: size,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <View style={[st.avatarWrap, {
          width: size - 4,
          height: size - 4,
          borderRadius: (size - 4) / 2,
          borderWidth: 1.5,
          borderColor: '#D4AF37',
          backgroundColor: 'rgba(0,0,0,0.5)',
          overflow: 'hidden',
          position: 'absolute'
        }]}>
          {p.avatar ? (
            <Image source={p.avatar} style={st.avatar} />
          ) : (
            <View style={st.avatarPlaceholder}>
              <MaterialCommunityIcons name="account" size={size * 0.6} color="#D4AF37" />
            </View>
          )}
        </View>

        {active && !isKicked && (
          <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
            <AnimatedCircle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={timerColor as any}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </Svg>
        )}
        <View style={[st.onlineDot, { backgroundColor: active ? col : 'rgba(255,255,255,0.3)' }]} />
      </View>

      <View style={[st.chipInfo, isRight && { alignItems: 'flex-end' }]}>
        <Text style={[st.chipName, { color: active ? col : C.text }]} numberOfLines={1}>
          {p.name}
        </Text>
        <View style={[st.chipRow, isRight && { flexDirection: 'row-reverse' }]}>
          <MaterialCommunityIcons name="wallet-outline" size={11} color={C.gold} />
          <Text style={[st.chipCoins, { color: C.gold, fontWeight: '800' }]}>
            {(p as any).isOffline ? 'Offline' : (p.coins?.toLocaleString() || '0')}
          </Text>
        </View>
        <View style={[st.pipRow, isRight && { flexDirection: 'row-reverse' }]}>
          {[0, 1, 2, 3].map(i => (
            <View
              key={i}
              style={[st.pip, {
                backgroundColor: i < lives ? C.red : 'transparent',
                borderColor: C.red,
                opacity: i < lives ? 1 : 0.4,
              }]}
            />
          ))}
        </View>
      </View>

      {/* Emoji Bubble */}
      {activeEmoji && (
        <Animated.View style={[
          st.emojiBubble,
          isRight ? { right: '115%' } : { left: '115%' },
          {
            opacity: bubbleAnim,
            transform: [
              { scale: bubbleAnim },
            ]
          }
        ]}>
          <Image source={activeEmoji} style={st.emojiBubbleImg} />
        </Animated.View>
      )}
    </TouchableOpacity>
  );
}

function MatchTimer({ gameEndsAt, onExpire }: { gameEndsAt: number | null; onExpire?: () => void }) {
  const [timeStr, setTimeStr] = React.useState('--:--');
  React.useEffect(() => {
    if (!gameEndsAt) {
      setTimeStr('10:00');
      return;
    }
    const iv = setInterval(() => {
      const diff = gameEndsAt - Date.now();
      if (diff <= 0) {
        setTimeStr('00:00');
        clearInterval(iv);
        onExpire?.();
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeStr(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(iv);
  }, [gameEndsAt]);

  return (
    <View style={[st.glassPill, { width: 62, justifyContent: 'center', marginLeft: 2 }]}>
      <MaterialCommunityIcons name="clock-outline" size={12} color="#FFD030" />
      <Text style={{ color: "#FFD030", fontSize: 11, fontWeight: '900', marginLeft: 4 }}>{timeStr}</Text>
    </View>
  );
}

export function LudoGameUI({
  playerCount,
  onExit,
  engine,
  localColor,
  diceReady,
  isDiceRolling,
  realPlayers,
  stake,
  isAiEnabled,
  networkPing,
  externalEmojis,
  onSendEmoji,
}: {
  playerCount: PlayerCount;
  onExit?: () => void;
  engine: ReturnType<typeof useLudoEngine>;
  localColor?: string;
  diceReady: boolean;
  isDiceRolling?: boolean;
  realPlayers?: any[];
  stake?: number;
  isAiEnabled?: boolean;
  networkPing?: number | null;
  externalEmojis?: Record<string, any>;
  onSendEmoji?: (emoji: any) => void;
}) {
  const [showQuitModal, setShowQuitModal] = React.useState(false);
  const [profileModalVisible, setProfileModalVisible] = React.useState(false);
  const [selectedProfileId, setSelectedProfileId] = React.useState<string | null>(null);
  const [gameEndsAt, setGameEndsAt] = React.useState<number | null>(null);
  const [showQuickSettings, setShowQuickSettings] = React.useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
  const [showReportMenu, setShowReportMenu] = React.useState(false);
  const [reportSent, setReportSent] = React.useState<string | null>(null);
  const [activeEmojis, setActiveEmojis] = React.useState<Record<string, any>>({});
  const emojiAnim = React.useRef(new Animated.Value(0)).current;
  const quickSettingsAnim = React.useRef(new Animated.Value(0)).current;
  const reportMenuAnim = React.useRef(new Animated.Value(0)).current;

  const handleReport = (name: string) => {
    setReportSent(`Report sent for ${name}`);
    setShowReportMenu(false);
    setTimeout(() => {
      setReportSent(null);
    }, 3000);
  };

  React.useEffect(() => {
    if (showReportMenu) {
      Animated.spring(reportMenuAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      reportMenuAnim.setValue(0);
    }
  }, [showReportMenu]);

  React.useEffect(() => {
    if (showQuickSettings) {
      Animated.spring(quickSettingsAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      quickSettingsAnim.setValue(0);
    }
  }, [showQuickSettings]);

  React.useEffect(() => {
    if (showEmojiPicker) {
      Animated.spring(emojiAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 8,
      }).start();
    } else {
      emojiAnim.setValue(0);
    }
  }, [showEmojiPicker]);

  const sendEmoji = (emoji: any) => {
    if (onSendEmoji) {
      onSendEmoji(emoji);
    } else {
      const color = localColor || 'blue';
      setActiveEmojis(prev => ({ ...prev, [color]: emoji }));
      setTimeout(() => {
        setActiveEmojis(prev => {
          const next = { ...prev };
          delete next[color];
          return next;
        });
      }, 3000);
    }
  };

  React.useEffect(() => {
    if (isAiEnabled) {
      // For Bot matches, start a 10 min timer
      setGameEndsAt(Date.now() + 600000);
    }
    // For multiplayer, this should ideally come from room data/socket
  }, [isAiEnabled]);

  const handleGameTimeout = () => {
    console.log('[LudoGameUI] Match timer expired!');
    // Determine winner based on finished tokens, then path progress
    const playersProgress = visiblePlayers.map(p => {
      const pPawns = engine.state.pawns.filter(pw => pw.color === p.color);
      const finished = pPawns.filter(pw => pw.state === 'finished').length;
      const totalDist = pPawns.reduce((acc, pw) => acc + (pw.state === 'board' ? pw.pathIndex : pw.state === 'finished' ? 56 : 0), 0);
      return { color: p.color, finished, totalDist };
    });

    playersProgress.sort((a, b) => {
      if (b.finished !== a.finished) return b.finished - a.finished;
      return b.totalDist - a.totalDist;
    });

    const winnerColor = playersProgress[0].color;
    // We could trigger a winner event here. Since LudoGameUI doesn't have an onWinner prop directly 
    // like Whot, we can manipulate engine state to show the winner.
    engine.setState(s => {
      const msgs = [`TIME'S UP! ${winnerColor.toUpperCase()} WINS!`, ...s.messages];
      return {
        ...s,
        activeColors: [winnerColor as any], // Force only winner to be active to end game
        messages: msgs.slice(0, 5),
        action: { msg: 'winner', color: winnerColor as any, key: Date.now() }
      };
    });
  };

  const handleProfilePress = (player: Player) => {
    if (!(player as any).isOffline && player.id) {
      setSelectedProfileId(player.id);
      setProfileModalVisible(true);
    }
  };

  const getSeatForColor = (color: string, lColor: string) => {
    const clockColors = ['blue', 'green', 'yellow', 'red'];
    const clockSeats: Seat[] = ['BL', 'TL', 'TR', 'BR'];
    const lIdx = clockColors.indexOf(lColor);
    const pIdx = clockColors.indexOf(color);
    if (lIdx === -1 || pIdx === -1) return 'BL';
    const relativeIdx = (pIdx - lIdx + 4) % 4;
    return clockSeats[relativeIdx];
  };

  const handleTimeoutWrapper = (color: Color, turnId: number) => {
    engine.handleTimeout(color, turnId);
  };

  const handleBackPress = () => {
    setShowQuitModal(true);
  };

  const visiblePlayers = React.useMemo(() => {
    const lCol = localColor || 'blue';
    let sourceList: any[] = [];

    if (isAiEnabled) {
      // In AI mode, use the mock PLAYERS, but mark them as offline
      sourceList = PLAYERS.map(p => ({ ...p, isOffline: true }));
      // If we have the real local user profile, inject it and mark as online!
      if (realPlayers && realPlayers.length > 0) {
        const me = realPlayers[0];
        const idx = sourceList.findIndex(p => p.color === me.color);
        if (idx !== -1) {
          sourceList[idx] = { ...sourceList[idx], ...me, isOffline: false };
        }
      }
    } else {
      sourceList = (realPlayers && realPlayers.length > 0) ? realPlayers : [];
      // In multiplayer, you could also check if they disconnected to set isOffline
    }

    const allowedColors = playerCount === 2 ? ['green', 'red'] : ['green', 'yellow', 'red', 'blue'];

    return sourceList
      .filter(p => allowedColors.includes(p.color))
      .map(p => {
        const seat = getSeatForColor(p.color, lCol as any);
        return {
          ...p,
          name: p.username || (p.color === lCol ? 'You' : p.name),
          avatar: p.avatar_url ? { uri: p.avatar_url } : (p.avatar || null),
          coins: p.coins || 0,
          seat: seat as Seat
        };
      });
  }, [playerCount, localColor, realPlayers, isAiEnabled]);

  const activeColor = engine.state.activeColors[engine.state.turnIndex];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={st.topRow} pointerEvents="box-none">
        <TouchableOpacity onPress={handleBackPress} style={st.glassPill} activeOpacity={0.8}>
          <MaterialCommunityIcons name="chevron-left" size={20} color={C.gold} />
        </TouchableOpacity>
        <View style={st.glassPill}>
          <Text style={st.topLabel}>LUDO</Text>
          <Text style={st.topSub}> · {playerCount}P</Text>
        </View>
        <MatchTimer gameEndsAt={gameEndsAt} onExpire={handleGameTimeout} />
        <View style={{ flex: 1 }} />
        {networkPing !== undefined && networkPing !== null && !isAiEnabled && (
          <View style={[st.glassPill, { marginRight: 2 }]}>
            <MaterialCommunityIcons
              name={networkPing < 100 ? "wifi" : networkPing < 200 ? "wifi-strength-2" : "wifi-strength-1"}
              size={12}
              color={networkPing < 100 ? '#57D08B' : networkPing < 200 ? '#FFD030' : '#FF4A42'}
            />
            <Text style={[st.topSub, { marginLeft: 4, color: networkPing < 100 ? '#57D08B' : networkPing < 200 ? '#FFD030' : '#FF4A42' }]}>
              {networkPing}ms
            </Text>
          </View>
        )}
        <View style={st.glassPill}>
          <MaterialCommunityIcons name="trophy-outline" size={12} color={C.gold} />
          <Text style={st.topSub}> PRIZE </Text>
          <Text style={st.topLabel}>₦{(stake || 0) * playerCount}</Text>
        </View>
        <View style={[st.glassPill, { marginLeft: 2 }]}>
          <MaterialCommunityIcons name="wallet-outline" size={12} color={C.gold} />
          <Text style={st.topLabel}>
            {` ${(visiblePlayers.find(p => p.color === localColor)?.coins || 0).toLocaleString()}`}
          </Text>
        </View>
        <TouchableOpacity 
          style={[st.glassPill, { marginLeft: 2, paddingHorizontal: 8 }]}
          onPress={() => setShowQuickSettings(!showQuickSettings)}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="tune-vertical" size={16} color={C.muted} />
        </TouchableOpacity>
      </View>

      {/* Quick Settings Popup */}
      {showQuickSettings && (
        <Animated.View style={[st.quickSettingsPopup, {
          opacity: quickSettingsAnim,
          transform: [
            { translateY: quickSettingsAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) },
            { scale: quickSettingsAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
          ]
        }]}>
          <View style={st.qHeader}>
            <Text style={st.qTitle}>SETTINGS</Text>
          </View>

          <TouchableOpacity 
            style={st.quickSettingsItem} 
            activeOpacity={0.7}
          >
            <View style={[st.qIconBg, { backgroundColor: 'rgba(74, 230, 92, 0.15)' }]}>
              <MaterialCommunityIcons name="volume-high" size={16} color={C.green} />
            </View>
            <Text style={st.quickSettingsText}>SFX</Text>
            <View style={[st.toggle, { backgroundColor: C.green }]}>
              <View style={[st.toggleDot, { alignSelf: 'flex-end' }]} />
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={st.quickSettingsItem}
            activeOpacity={0.7}
          >
            <View style={[st.qIconBg, { backgroundColor: 'rgba(45, 168, 255, 0.15)' }]}>
              <MaterialCommunityIcons name="music" size={16} color={C.blue} />
            </View>
            <Text style={st.quickSettingsText}>Music</Text>
            <View style={st.toggle}>
              <View style={st.toggleDot} />
            </View>
          </TouchableOpacity>

          <View style={st.qDivider} />

          <TouchableOpacity 
            style={st.quickSettingsItem}
            onPress={() => { setShowQuickSettings(false); handleBackPress(); }}
            activeOpacity={0.7}
          >
            <View style={[st.qIconBg, { backgroundColor: 'rgba(255, 74, 66, 0.15)' }]}>
              <MaterialCommunityIcons name="logout" size={16} color="#FF4A42" />
            </View>
            <Text style={[st.quickSettingsText, { color: '#FF4A42' }]}>Leave Game</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {visiblePlayers.map(p => (
        <PlayerChip
          key={p.id || p.name}
          player={p as any}
          active={p.color === activeColor && diceReady}
          lives={(engine.state.lives as any)?.[p.color] ?? 4}
          turnId={engine.state.turnId ?? 1}
          finishedCount={engine.state.pawns.filter(pw => pw.color === p.color && pw.state === 'finished').length}
          stake={stake || 0}
          winner={engine.state.winner}
          onTimeout={handleTimeoutWrapper}
          onPressProfile={() => handleProfilePress(p as Player)}
          activeEmoji={externalEmojis?.[p.color] || activeEmojis[p.color]}
        />
      ))}

      {/* Report Success Toast */}
      {reportSent && (
        <View style={st.toastContainer}>
          <MaterialCommunityIcons name="check-circle" size={16} color={C.green} />
          <Text style={st.toastText}>{reportSent}</Text>
        </View>
      )}

      {/* Report Menu Popup */}
      {showReportMenu && (
        <Animated.View style={[st.reportPopup, {
          opacity: reportMenuAnim,
          transform: [
            { translateY: reportMenuAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
            { scale: reportMenuAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
          ]
        }]}>
          <View style={st.qHeader}>
            <Text style={st.qTitle}>REPORT PLAYER</Text>
          </View>
          {visiblePlayers.filter(p => p.color !== localColor).map(p => (
            <View key={p.id || p.name} style={st.reportItem}>
              <View style={st.pSmallAvatar}>
                <Image source={p.avatar} style={st.avatar} />
                <View style={[st.pStatus, { backgroundColor: colorHex[p.color as Color] }]} />
              </View>
              <Text style={st.quickSettingsText} numberOfLines={1}>{p.name}</Text>
              <TouchableOpacity 
                style={st.reportBtn} 
                onPress={() => handleReport(p.name)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="flag" size={14} color="#FF4A42" />
              </TouchableOpacity>
            </View>
          ))}
          {visiblePlayers.filter(p => p.color !== localColor).length === 0 && (
            <Text style={st.emptyText}>No other players</Text>
          )}
        </Animated.View>
      )}

      <View style={st.bottomRow} pointerEvents="box-none">
        <View style={st.bottomSide}>
          <TouchableOpacity 
            style={st.glassIcon} 
            activeOpacity={0.8}
            onPress={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            <MaterialCommunityIcons name="emoticon-outline" size={18} color={C.muted} />
          </TouchableOpacity>

          {/* Emoji Picker Popup */}
          {showEmojiPicker && (
            <Animated.View style={[st.emojiPicker, {
              opacity: emojiAnim,
              transform: [
                { translateY: emojiAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
                { scale: emojiAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
              ]
            }]}>
              <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={st.emojiScroll}
              >
                {EMOJI_PACK.map((img, i) => (
                  <BubblingEmoji 
                    key={i} 
                    img={img} 
                    index={i}
                    onPress={() => {
                      sendEmoji(img);
                      setShowEmojiPicker(false);
                    }}
                  />
                ))}
              </ScrollView>
            </Animated.View>
          )}
        </View>

        <View style={st.bottomCenter} />
        
        <View style={[st.bottomSide, { justifyContent: 'flex-end' }]}>
          <TouchableOpacity 
            style={st.glassIcon} 
            activeOpacity={0.8} 
            onPress={() => setShowReportMenu(!showReportMenu)}
          >
            <MaterialCommunityIcons name="flag-outline" size={18} color="#FF4A42" />
          </TouchableOpacity>
        </View>
      </View>

      <GameQuitModal 
        visible={showQuitModal} 
        onCancel={() => setShowQuitModal(false)} 
        onConfirm={() => onExit?.()} 
        stake={stake}
      />

      <PlayerProfileModal
        visible={profileModalVisible}
        playerId={selectedProfileId}
        onClose={() => setProfileModalVisible(false)}
      />
    </View>
  );
}

const st = StyleSheet.create({
  glassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  glassIcon: {
    width: 34, height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topLabel: {
    color: C.text,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  topSub: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '500',
  },
  addBtn: {
    width: 16, height: 16,
    borderRadius: 8,
    backgroundColor: '#FF4A42',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  topRow: {
    position: 'absolute',
    top: 8, left: 8, right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    zIndex: 30,
  },
  chip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 30,
    paddingHorizontal: Platform.OS === 'ios' ? 12 : 7,
    paddingVertical: Platform.OS === 'ios' ? 9 : 6,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  chipFlip: { flexDirection: 'row-reverse' },
  activeRing: {
    borderRadius: 30,
    borderWidth: 1.5,
  },
  turnBadge: {
    position: 'absolute',
    top: -10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.6,
    shadowRadius: 3,
    elevation: 5,
    zIndex: 10,
  },
  turnBadgeText: {
    color: '#000',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  avatarWrap: {
    width: 34, height: 34,
    borderRadius: 17,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0, right: 0,
    width: 9, height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  finishedRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 40,
  },
  finishedToken: {
    width: 38,
    height: 42,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
  },
  chipInfo: { gap: 2, minWidth: 48, maxWidth: 70 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  chipName: {
    fontSize: Platform.OS === 'ios' ? 14 : 11,
    fontWeight: '800',
  },
  chipCoins: {
    color: C.gold,
    fontSize: Platform.OS === 'ios' ? 12 : 10,
    fontWeight: '700',
  },
  pipRow: { flexDirection: 'row', gap: 2 },
  pip: {
    width: 5, height: 5,
    borderRadius: 3,
    borderWidth: 1,
  },
  bottomRow: {
    position: 'absolute',
    bottom: 8, left: 8, right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 30,
  },
  bottomSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bottomCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerList: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
  },
  pSmallAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: '#000',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  pStatus: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#000',
  },
  vDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 6,
  },
  reportPopup: {
    position: 'absolute',
    bottom: 50,
    right: 8,
    width: 180,
    backgroundColor: 'rgba(15,15,15,0.95)',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 4,
    zIndex: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 20,
  },
  reportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 10,
  },
  reportBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 74, 66, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: C.muted,
    fontSize: 10,
    textAlign: 'center',
    paddingVertical: 20,
    fontWeight: '700',
  },
  toastContainer: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    zIndex: 1000,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  toastText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  // Quick Settings
  quickSettingsPopup: {
    position: 'absolute',
    top: 54,
    right: 8,
    width: 145,
    backgroundColor: 'rgba(15,15,15,0.92)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 4,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 20,
  },
  qHeader: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    marginBottom: 2,
  },
  qTitle: {
    color: C.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  quickSettingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 10,
  },
  qIconBg: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickSettingsText: {
    flex: 1,
    color: C.text,
    fontSize: 11,
    fontWeight: '700',
  },
  toggle: {
    width: 28,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 2,
    justifyContent: 'center',
  },
  toggleDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFF',
  },
  qDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 10,
    marginVertical: 2,
  },

  // Emojis
  emojiPicker: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    width: 280,
    height: 240,
    backgroundColor: 'rgba(12, 12, 12, 0.95)',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    padding: 10,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 20,
    overflow: 'hidden',
  },
  emojiScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  emojiItem: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiImg: {
    width: 44,
    height: 44,
    resizeMode: 'contain',
  },
  emojiBubble: {
    position: 'absolute',
    borderRadius: 12,
    zIndex: 200,
  },
  emojiBubbleImg: {
    width: 64,
    height: 64,
    resizeMode: 'contain',
  },
});
