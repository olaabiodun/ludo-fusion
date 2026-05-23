import { useFeatureActive } from '@/lib/FeatureContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { EMOJI_PACK } from '../lib/emojis';
import { isSoundEnabled, loadSounds, playDiceRollSound, setSoundEnabled } from '../lib/sounds';
import Dice3D from './Dice3D';
import { GameQuitModal } from './GameQuitModal';
import { PlayerProfileModal } from './PlayerProfileModal';
import { getBotName, Seat } from './WhotUtils';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  position: number;
  avatar: ImageSourcePropType | null;
}

const colorHex: Record<Color, string> = {
  green: C.green,
  yellow: C.yellow,
  blue: C.blue,
  red: C.red,
};

const SEAT_POS: Record<string, object> = {
  TL: { top: 52, left: 8 },
  TR: { top: 52, right: 8 },
  BL: { bottom: 12, left: 8 },
  BR: { bottom: 12, right: 8 },
};

function BubblingEmoji({ img, onPress, index }: { img: any; onPress: () => void; index: number }) {
  const scale = React.useRef(new Animated.Value(0)).current;
  const float = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      delay: index * 25,
      friction: 4,
      useNativeDriver: true,
    }).start();

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
    <TouchableOpacity onPress={onPress} activeOpacity={0.6}>
      <Animated.View 
        renderToHardwareTextureAndroid={true}
        style={[st.emojiItem, { 
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
  stake: number;
  winner: string | null;
  onTimeout: (color: Color, turnId: number) => void;
  onPressProfile: () => void;
  activeEmoji?: any;
}) {
  const p = player;
  const col = colorHex[p.color];
  const isRight = p.seat === 'TR' || p.seat === 'BR';

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
    if (active && !winner) {
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: 15000,
        easing: Easing.linear,
        useNativeDriver: false, // SVG props (strokeDashoffset) don't support native driver well on all Android versions
      }).start(({ finished }) => {
        if (finished) {
          onTimeout(p.color, turnId);
        }
      });
    } else {
      progress.stopAnimation();
    }
  }, [active, turnId]);

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

  const ringPulse = React.useRef(new Animated.Value(0.4)).current;
  React.useEffect(() => {
    if (active && !winner) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(ringPulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(ringPulse, { toValue: 0.4, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ).start();
    } else {
      ringPulse.setValue(0.4);
    }
  }, [active, winner]);

  return (
    <TouchableOpacity
      style={[st.chip, SEAT_POS[p.seat], isRight && st.chipFlip]}
      activeOpacity={0.8}
      onPress={onPressProfile}
    >
      {active && (
        <Animated.View 
          renderToHardwareTextureAndroid={true}
          style={[StyleSheet.absoluteFillObject, st.activeRing, { borderColor: col, opacity: ringPulse }]} 
        />
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

        {active && (
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

      </View>

      <View style={[st.chipInfo, isRight && { alignItems: 'flex-end' }]}>
        <Text style={[st.chipName, { color: active ? col : C.text }]} numberOfLines={1}>
          {p.name}
        </Text>
        <View style={[st.chipRow, isRight && { flexDirection: 'row-reverse' }]}>
          <MaterialCommunityIcons name="wallet-outline" size={11} color={C.gold} />
          <Text style={[st.chipCoins, { color: C.gold, fontWeight: '800' }]}>
            {p.coins?.toLocaleString() || '0'}
          </Text>
        </View>
        <View style={[st.pipRow, isRight && { flexDirection: 'row-reverse' }]}>
          {[0, 1, 2, 3].map(i => (
            <View
              key={i}
              style={[st.pip, {
                backgroundColor: i < (p as any).lives ? C.red : 'transparent',
                borderColor: C.red,
                opacity: i < (p as any).lives ? 1 : 0.4,
              }]}
            />
          ))}
        </View>
      </View>

      {/* Emoji Bubble */}
      {activeEmoji && (
        <Animated.View style={[
          st.emojiBubble, 
          isRight ? { right: 120 } : { left: 120 },
          { alignSelf: 'center' },
          {
            opacity: bubbleAnim,
            transform: [{ scale: bubbleAnim }]
          }
        ]}>
          <Image source={activeEmoji} style={st.emojiBubbleImg} />
        </Animated.View>
      )}
    </TouchableOpacity>
  );
}



export function SnakeLadderGameUI({
  playerCount,
  onExit,
  engine,
  localColor,
  realPlayers,
  stake,
  isAiEnabled,
  networkPing,
  externalEmojis,
  onSendEmoji,
  isCountdownActive = false,
}: {
  playerCount: PlayerCount;
  onExit?: () => void;
  engine: any;
  localColor?: string;
  realPlayers?: any[];
  stake?: number;
  isAiEnabled?: boolean;
  networkPing?: number | null;
  externalEmojis?: Record<string, any>;
  onSendEmoji?: (emoji: any) => void;
  isCountdownActive?: boolean;
}) {
  const [showQuitModal, setShowQuitModal] = React.useState(false);
  const [profileModalVisible, setProfileModalVisible] = React.useState(false);
  const [selectedProfileId, setSelectedProfileId] = React.useState<string | null>(null);
  const [soundEnabled, setSoundEnabledState] = React.useState(true);

  React.useEffect(() => {
    loadSounds();
    isSoundEnabled().then(setSoundEnabledState).catch(() => {});
  }, []);

  const [showQuickSettings, setShowQuickSettings] = React.useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
  const [showReportMenu, setShowReportMenu] = React.useState(false);
  const [reportSent, setReportSent] = React.useState<string | null>(null);
  const [actionPopup, setActionPopup] = React.useState<{ message: string, seat: Seat } | null>(null);
  const [activeEmojis, setActiveEmojis] = React.useState<Record<string, any>>({});
  const gamblingEnabled = useFeatureActive();
  
  const activeColor = engine.players?.[engine.turnIndex]?.color;
  
  const emojiAnim = React.useRef(new Animated.Value(0)).current;
  const quickSettingsAnim = React.useRef(new Animated.Value(0)).current;
  const reportMenuAnim = React.useRef(new Animated.Value(0)).current;

  const handleReport = (name: string) => {
    setReportSent(`Report sent for ${name}`);
    setShowReportMenu(false);
    setTimeout(() => setReportSent(null), 3000);
  };

  const handleToggleSound = async () => {
    const next = !soundEnabled;
    setSoundEnabledState(next);
    await setSoundEnabled(next);
  };

  const sendEmoji = (emoji: any) => {
    if (onSendEmoji) {
      onSendEmoji(emoji);
    } else {
      const color = localColor || 'green';
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
    if (showEmojiPicker) {
      Animated.spring(emojiAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }).start();
    } else {
      emojiAnim.setValue(0);
    }
  }, [showEmojiPicker]);

  React.useEffect(() => {
    if (showQuickSettings) {
      Animated.spring(quickSettingsAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }).start();
    } else {
      quickSettingsAnim.setValue(0);
    }
  }, [showQuickSettings]);

  React.useEffect(() => {
    if (showReportMenu) {
      Animated.spring(reportMenuAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }).start();
    } else {
      reportMenuAnim.setValue(0);
    }
  }, [showReportMenu]);


  const handleProfilePress = (player: any) => {
    if (player.id) {
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

  const handleBackPress = () => {
    setShowQuitModal(true);
  };

  const visiblePlayers = React.useMemo(() => {
    const lCol = localColor || 'green';
    const allowedColors = playerCount === 2 ? ['green', 'red'] : ['green', 'yellow', 'red', 'blue'];

    return (engine?.players ?? [])
      .map((p: any) => {
        const realP = realPlayers?.find(rp => rp.color === p.color);
        const seat = getSeatForColor(p.color, lCol);
        const isBot = isAiEnabled ? p.color !== lCol : p.isBot;
        const name = realP?.username || (isBot ? getBotName(p.color, lCol) : (p.color === lCol ? 'You' : `Player ${p.color}`));
        return { ...p, ...realP, isBot, name, seat };
      })
      .filter(p => allowedColors.includes(p.color));
  }, [engine?.players, localColor, playerCount, realPlayers, isAiEnabled]);

  return (
    <View style={st.root}>
      {/* Top bar */}
      <View style={st.topRow} pointerEvents="box-none">
        <TouchableOpacity onPress={handleBackPress} style={st.glassPill} activeOpacity={0.8}>
          <MaterialCommunityIcons name="chevron-left" size={20} color={C.gold} />
        </TouchableOpacity>
        <View style={st.glassPill}>
          <Text style={st.topLabel}>SNAKE & LADDER</Text>
          <Text style={st.topSub}> · {playerCount}P</Text>
        </View>
        {networkPing !== undefined && networkPing !== null && !isAiEnabled && (
          <View style={[st.glassPill, { marginLeft: 4 }]}>
            <MaterialCommunityIcons
              name={(networkPing / 2) < 100 ? "wifi" : (networkPing / 2) < 200 ? "wifi-strength-2" : "wifi-strength-1"}
              size={12}
              color={(networkPing / 2) < 100 ? '#57D08B' : (networkPing / 2) < 200 ? '#FFD030' : '#FF4A42'}
            />
            <Text style={[st.topSub, { marginLeft: 4, color: (networkPing / 2) < 100 ? '#57D08B' : (networkPing / 2) < 200 ? '#FFD030' : '#FF4A42' }]}>
              {Math.max(12, Math.floor(networkPing / 2))}ms
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        <View style={st.glassPill}>
          <MaterialCommunityIcons name="trophy-outline" size={12} color={C.gold} />
          <Text style={st.topSub}> PRIZE </Text>
          <Text style={st.topLabel}>{gamblingEnabled ? `₦${((stake || 0) * playerCount).toLocaleString()}` : `${((stake || 0) * playerCount).toLocaleString()} coins`}</Text>
        </View>
        <View style={[st.glassPill, { marginLeft: 2 }]}>
          <MaterialCommunityIcons name="wallet-outline" size={12} color={C.gold} />
          <Text style={st.topLabel}>
            {` ${(visiblePlayers.find(p => p.color === localColor)?.coins || 0).toLocaleString()}`}
          </Text>
        </View>
        <TouchableOpacity 
          style={[st.glassPill, { marginLeft: 2, paddingHorizontal: 8 }]}
          onPress={() => setShowEmojiPicker(!showEmojiPicker)}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="emoticon-outline" size={16} color={C.muted} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={[st.glassPill, { marginLeft: 2, paddingHorizontal: 8 }]}
          onPress={() => setShowQuickSettings(!showQuickSettings)}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="tune-vertical" size={16} color={C.muted} />
        </TouchableOpacity>
      </View>

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <Animated.View style={[st.emojiPicker, {
          opacity: emojiAnim,
          transform: [
            { translateY: emojiAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
            { scale: emojiAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
          ]
        }]}>
          <View style={st.emojiScrollWrapper}>
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
          </View>
        </Animated.View>
      )}

      {/* Quick Settings Popup */}
      {showQuickSettings && (
        <Animated.View style={[st.quickSettingsPopup, {
          opacity: quickSettingsAnim,
          transform: [
            { translateY: quickSettingsAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
            { scale: quickSettingsAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
          ]
        }]}>
          <View style={st.qHeader}>
            <Text style={st.qTitle}>SETTINGS</Text>
          </View>
          <TouchableOpacity style={st.quickSettingsItem} activeOpacity={0.7} onPress={handleToggleSound}>
            <View style={[st.qIconBg, { backgroundColor: 'rgba(74, 230, 92, 0.15)' }]}>
              <MaterialCommunityIcons name={soundEnabled ? "volume-high" : "volume-off"} size={16} color={soundEnabled ? C.green : '#FF4A42'} />
            </View>
            <Text style={st.quickSettingsText}>SFX</Text>
            <View style={[st.toggle, { backgroundColor: soundEnabled ? C.green : 'rgba(255,255,255,0.15)' }]}>
              <View style={[st.toggleDot, { alignSelf: soundEnabled ? 'flex-end' : 'flex-start' }]} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={st.quickSettingsItem} activeOpacity={0.7} onPress={handleToggleSound}>
            <View style={[st.qIconBg, { backgroundColor: 'rgba(45, 168, 255, 0.15)' }]}>
              <MaterialCommunityIcons name={soundEnabled ? "music" : "music-off"} size={16} color={soundEnabled ? C.blue : '#FF4A42'} />
            </View>
            <Text style={st.quickSettingsText}>Music</Text>
            <View style={[st.toggle, { backgroundColor: soundEnabled ? C.green : 'rgba(255,255,255,0.15)' }]}>
              <View style={[st.toggleDot, { alignSelf: soundEnabled ? 'flex-end' : 'flex-start' }]} />
            </View>
          </TouchableOpacity>
          <View style={st.qDivider} />
          <TouchableOpacity 
            style={st.quickSettingsItem}
            onPress={() => { setShowQuickSettings(false); setShowQuitModal(true); }}
            activeOpacity={0.7}
          >
            <View style={[st.qIconBg, { backgroundColor: 'rgba(255, 74, 66, 0.15)' }]}>
              <MaterialCommunityIcons name="logout" size={16} color="#FF4A42" />
            </View>
            <Text style={[st.quickSettingsText, { color: '#FF4A42' }]}>Leave Game</Text>
          </TouchableOpacity>
        </Animated.View>
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
          {visiblePlayers.filter((p: Player) => p.color !== localColor).map((p: Player) => (
            <View key={p.id} style={st.reportItem}>
              <View style={st.pSmallAvatar}>
                {p.avatar ? (
                  <Image source={p.avatar} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <MaterialCommunityIcons name="account" size={18} color="#D4AF37" />
                )}
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
        </Animated.View>
      )}

      {visiblePlayers.map((p: Player) => (
        <PlayerChip
          key={p.id}
          player={p as any}
          active={p.color === activeColor && !isCountdownActive}
          lives={(p as any).lives}
          turnId={engine.turnIndex}
          stake={stake || 0}
          winner={engine.winner}
          onTimeout={(color) => engine.handleTimeout(color)}
          onPressProfile={() => handleProfilePress(p)}
          activeEmoji={externalEmojis?.[p.color] || activeEmojis[p.color]}
        />
      ))}

      {/* Bottom row: report button */}
      <View style={st.bottomRow} pointerEvents="box-none">
        <View style={st.bottomSide}>
          <View />
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

      {/* 3D Dice - Glides to active player */}
      <DiceWrapper
        activeSeat={visiblePlayers.find((p: any) => p.color === activeColor)?.seat || 'TL'}
        diceValue={engine.diceValue || 1}
        onRoll={() => engine.rollDice()}
        disabled={engine.hasRolled || !!engine.winner || engine.isMoving || activeColor !== localColor}
        isRolling={engine.isRollingVisual}
        onPressDisabled={() => {
          if (activeColor !== localColor && !engine.winner) {
            const mySeat = visiblePlayers.find((p: any) => p.color === localColor)?.seat || 'BL';
            setActionPopup({ message: 'not-your-turn', seat: mySeat });
          } else if (engine.hasRolled && activeColor === localColor) {
             const mySeat = visiblePlayers.find((p: any) => p.color === localColor)?.seat || 'BL';
             setActionPopup({ message: 'already-rolled', seat: mySeat });
          }
        }}
      />

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
        
      


function DiceWrapper({ activeSeat, diceValue, onRoll, disabled, isRolling, onPressDisabled }: { activeSeat: Seat, diceValue: number, onRoll: () => void, disabled?: boolean, isRolling?: boolean, onPressDisabled?: () => void }) {
  const transX = React.useRef(new Animated.Value(24)).current;
  const transY = React.useRef(new Animated.Value(120)).current;

  React.useEffect(() => {
    if (isRolling) {
      playDiceRollSound();
    }
  }, [isRolling]);

  React.useEffect(() => {
    const isLeft = activeSeat === 'TL' || activeSeat === 'BL';
    const isTop = activeSeat === 'TL' || activeSeat === 'TR';

    const targetX = isLeft ? 24 : SCREEN_WIDTH - 84;
    const targetY = isTop ? 120 : SCREEN_HEIGHT - 150;

    Animated.parallel([
      Animated.timing(transX, {
        toValue: targetX,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(transY, {
        toValue: targetY,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    ]).start();
  }, [activeSeat]);

  return (
    <Animated.View style={[st.diceFloating, { 
      transform: [
        { translateX: transX }, 
        { translateY: transY }
      ] 
    }]}>
      <Dice3D
        ref={null}
        onRollStart={() => { onRoll(); }}
        value={diceValue || 1}
        size={55}
        disabled={disabled}
        controlled={true}
        rollDuration={850}
        isRolling={isRolling}
        onPressDisabled={onPressDisabled}
      />
    </Animated.View>
  );
}

const st = StyleSheet.create({
  root: {
    flex: 1,
  },
  glassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
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
  topRow: {
    position: 'absolute',
    top: 8, left: 8, right: 8,
    flexDirection: 'row',
    alignItems: 'center',
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
    paddingHorizontal: 10,
    paddingVertical: 7,
    zIndex: 20,
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
  chipInfo: { gap: 2, minWidth: 48, maxWidth: 70 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  chipName: {
    fontSize: 13,
    fontWeight: '800',
  },
  chipCoins: {
    color: C.gold,
    fontSize: 11,
    fontWeight: '700',
  },
  pipRow: { flexDirection: 'row', gap: 2, marginTop: 4 },
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
  emojiItem: {
    width: 44, height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiImg: {
    width: 40, height: 40,
    resizeMode: 'contain',
  },
  emojiPicker: {
    position: 'absolute',
    top: 54,
    left: 8,
    width: 280,
    height: 240,
    backgroundColor: 'rgba(12, 12, 12, 0.95)',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    padding: 10,
    zIndex: 100,
  },
  emojiScrollWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  emojiBubble: {
    position: 'absolute',
    borderRadius: 12,
    zIndex: 200,
  },
  emojiBubbleImg: {
    width: 64, height: 64,
    resizeMode: 'contain',
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
  },
  toastText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
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
    width: 24, height: 24,
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
    width: 28, height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 2,
    justifyContent: 'center',
  },
  toggleDot: {
    width: 12, height: 12,
    borderRadius: 6,
    backgroundColor: '#FFF',
  },
  qDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 10,
    marginVertical: 2,
  },
  reportPopup: {
    position: 'absolute',
    top: 54,
    right: 8,
    width: 180,
    backgroundColor: 'rgba(15,15,15,0.95)',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 4,
    zIndex: 150,
  },
  reportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 10,
  },
  reportBtn: {
    width: 28, height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 74, 66, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pSmallAvatar: {
    width: 28, height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: '#000',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pStatus: {
    position: 'absolute',
    bottom: 0, right: 0,
    width: 8, height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#000',
  },
  bottomCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  diceWrap: {
    width: 60, height: 60,
  },
  rollBtn: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  rollText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  diceFloating: {
    position: 'absolute',
    zIndex: 50,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    left: 0, // Now positioned via transform
    top: 0,
  },
});
