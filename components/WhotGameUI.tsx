import { supabase } from '@/lib/supabase';
import { Kanit_900Black, useFonts } from '@expo-google-fonts/kanit';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import {
  Easing,
  Animated as RNAnimated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Svg from 'react-native-svg';
import { EMOJI_PACK } from '../lib/emojis';
import {
  loadSounds,
  playButtonSound,
  playWhotCardSound,
  playWhotContinueSound,
  playWhotGeneralMarketSound,
  playWhotHoldOnSound,
  playWhotLastCardSound,
  playWhotPick2Sound,
  playWhotPick3Sound,
  playWhotReshuffleSound,
  playWhotSuspendedSound,
  playWhotDefendedSound,
  playWhotGMSound,
} from '../lib/sounds';
import { ActionPopup } from './ActionPopup';
import { GameQuitModal } from './GameQuitModal';
import { ShapeSelectionOverlay } from './ShapeSelectionOverlay';
import { createPracticePlayers, getBotDecision } from './WhotBotEngine';
import { WhotFrontCard, WhotShape } from './WhotFrontCard';
import { socket, useWhotMultiplayer } from './WhotMultiplayer';
import { WhotScoringSystem } from './WhotScoringSystem';
import { C, CARD_H, CARD_W, Card, Color, Player, SH, SW, Seat, calculateScore, canPlayCard as checkPlayable, findNextActivePlayer as getNextPlayer, getCardInFanPos, getRandomCard, rs } from './WhotUtils';
import { runWhotTests } from './WhotTestEngine';

import Animated, { Easing as ReanimatedEasing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { Circle as SvgCircle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(SvgCircle);

import {
  CardDistributionOverlay,
  HandViewerOverlay,
  MarketPick,
  MarketPickAnim,
  PlayCardAnim,
  ReshuffleAnim
} from './WhotAnimations';

const colorHex: Record<Color, string> = {
  green: C.green,
  yellow: C.yellow,
  blue: C.blue,
  red: C.red,
};

// ─── Sizes ────────────────────────────────────────────────────────────────────
const CHIP_H: number = rs(40);
const AVATAR: number = rs(32);
const FAN_MAX: number = 12;

// ─── Seat positions (Relative for UI) ─────────────────────────────────────────
const SEAT_POS: Record<Seat, any> = {
  TOP: { top: rs(14), alignSelf: 'center' },
  LEFT: { top: '50%', left: rs(10), transform: [{ translateY: -(CHIP_H / 2) }] },
  RIGHT: { top: '50%', right: rs(10), transform: [{ translateY: -(CHIP_H / 2) }] },
  DOWN: { bottom: rs(2), alignSelf: 'center' },
  TL: { top: rs(60), left: rs(10) },
  TR: { top: rs(60), right: rs(10) },
  BL: { bottom: rs(60), left: rs(10) },
  BR: { bottom: rs(60), right: rs(10) },
};

function BubblingEmoji({ img, onPress, index }: { img: any; onPress: () => void; index: number }) {
  const scale = React.useRef(new RNAnimated.Value(0)).current;
  const float = React.useRef(new RNAnimated.Value(0)).current;

  React.useEffect(() => {
    // Entrance animation
    RNAnimated.spring(scale, {
      toValue: 1,
      delay: index * 25,
      friction: 4,
      useNativeDriver: true,
    }).start();

    // Bubbling / Floating loop
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(float, {
          toValue: 1,
          duration: 1200 + Math.random() * 800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        RNAnimated.timing(float, {
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
      <RNAnimated.View style={[st.emojiItem, {
        transform: [
          { scale },
          { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -rs(6)] }) }
        ]
      }]}>
        <Image source={img} style={st.emojiImg} />
      </RNAnimated.View>
    </TouchableOpacity>
  );
}

const CardFan = React.memo(({ cards, seat, onCardPress, fanCenters, onExpandPress, canPlayCard }: { cards: Card[]; seat: Seat; onCardPress?: (idx: number) => void; fanCenters: any; onExpandPress?: () => void; canPlayCard?: (card: Card) => boolean }) => {
  const n = Math.min(cards.length, FAN_MAX);
  // Ensure we render at least an empty container so it can be measured 
  // for the distribution animation targets.
  const hasOverflow = seat === 'DOWN' && cards.length > FAN_MAX;
  const isVertical = seat === 'LEFT' || seat === 'RIGHT';
  const maxAngle = seat === 'DOWN' ? Math.min(n * 7, 45) : Math.min(n * 9, 68);
  const arcStart = -maxAngle / 2;
  const arcStep = n <= 1 ? 0 : maxAngle / (n - 1);
  const arcR = seat === 'DOWN' ? rs(190) : rs(100);
  const cW = isVertical ? CARD_W + rs(12) : CARD_W + rs(16) * Math.max(0, n - 1) + rs(12);
  const cH = isVertical ? CARD_H + rs(10) * Math.max(0, n - 1) + rs(12) : CARD_H + rs(12);
  const containerRef = React.useRef<any>(null);

  if (n === 0 && seat !== 'DOWN' && seat !== 'TOP' && seat !== 'LEFT' && seat !== 'RIGHT') return null;


  return (
    <View
      ref={containerRef}
      onLayout={() => {
        containerRef.current?.measureInWindow((x: number, y: number, w: number, h: number) => {
          fanCenters[seat] = { x: x + w / 2, y: y + h / 2 };
        });
      }}
      style={{ width: cW, height: cH, alignItems: 'center', justifyContent: 'center' }}
    >
      {[...Array(n)].map((_, i) => {
        let tx = 0, ty = 0, rot = 0;
        const angle = arcStart + arcStep * i;
        const rad = (angle * Math.PI) / 180;
        if (isVertical) {
          ty = Math.sin(rad) * arcR;
          tx = seat === 'RIGHT' ? (1 - Math.cos(rad)) * arcR : -(1 - Math.cos(rad)) * arcR;
          rot = seat === 'RIGHT' ? 90 - angle : -90 + angle;
        } else {
          tx = Math.sin(rad) * arcR;
          ty = seat === 'DOWN' ? (1 - Math.cos(rad)) * arcR : -(1 - Math.cos(rad)) * arcR;
          rot = seat === 'DOWN' ? angle : -angle;
        }
        return (
          <TouchableOpacity key={i} activeOpacity={seat === 'DOWN' ? 0.8 : 1} disabled={seat !== 'DOWN'} onPress={() => onCardPress?.(i)} style={{
            position: 'absolute', zIndex: i + 1, transform: [{ translateX: tx }, { translateY: ty }, { rotate: `${rot}deg` }],
          }}>
            {seat === 'DOWN' ? (
              <WhotFrontCard shape={cards[i].shape} value={cards[i].value} width={CARD_W} height={CARD_H} isPlayable={canPlayCard?.(cards[i])} />
            ) : (
              <Image
                source={require('../assets/images/whot/backcard.png')}
                style={{ width: CARD_W, height: CARD_H }}
                contentFit="contain"
              />
            )}
          </TouchableOpacity>
        );
      })}
      {hasOverflow && (
        <TouchableOpacity
          onPress={onExpandPress}
          style={{
            position: 'absolute', right: -rs(28), bottom: rs(8), zIndex: 200,
            backgroundColor: 'rgba(255,180,0,0.92)', borderRadius: rs(14),
            paddingHorizontal: rs(7), paddingVertical: rs(5),
            alignItems: 'center', borderWidth: 1.5, borderColor: '#FFD030',
            shadowColor: '#FFD030', shadowOpacity: 0.6, shadowRadius: rs(6),
          }}
        >
          <MaterialCommunityIcons name="cards" size={rs(14)} color="#000" />
          <Text style={{ color: '#000', fontSize: rs(8), fontWeight: '900', marginTop: rs(1) }}>+{cards.length - FAN_MAX}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

const PlayerChip = React.memo(({ player, onPlayCard, fanCenters, onShowHand, activeSince, isDealing, activeEmoji, isMultiplayer, canPlayCard }: { player: Player; onPlayCard?: (idx: number) => void; fanCenters: any; onShowHand?: () => void; activeSince?: number | null; isDealing?: boolean; activeEmoji?: any; isMultiplayer?: boolean; canPlayCard?: (card: Card) => boolean }) => {
  const { name, color, avatar, cardCount, active, seat = 'DOWN' } = player;
  const col = colorHex[color];
  const isRight = seat === 'RIGHT';
  const isLocal = name === 'You';

  const progress = useSharedValue(0);
  const bubbleAnim = React.useRef(new RNAnimated.Value(0)).current;
  const [displayTime, setDisplayTime] = React.useState(15);

  React.useEffect(() => {
    if (activeEmoji) {
      bubbleAnim.setValue(0);
      RNAnimated.spring(bubbleAnim, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }
  }, [activeEmoji]);

  React.useEffect(() => {
    if (!active || !activeSince) {
      progress.value = 0;
      setDisplayTime(15);
      return;
    }
    const elapsed = Math.max(0, Date.now() - activeSince);
    const remaining = Math.max(0, 15000 - elapsed);
    progress.value = elapsed / 15000;
    progress.value = withTiming(1, { duration: remaining, easing: ReanimatedEasing.linear });
    const iv = setInterval(() => {
      const nowElapsed = Date.now() - activeSince;
      setDisplayTime(Math.max(0, Math.ceil(15 - nowElapsed / 1000)));
    }, 500);
    return () => clearInterval(iv);
  }, [active, activeSince]);

  const avatarSize = isLocal ? rs(28) : AVATAR;
  const radius = avatarSize / 2 + rs(0.5);
  const circumference = 2 * Math.PI * radius;
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * progress.value }));

  const fanOffset: any = (() => {
    if (seat === 'DOWN') {
      const margin = isLocal ? (isMultiplayer ? 4 : 4) : 8;
      return { bottom: '100%', marginBottom: rs(margin) };
    }
    if (seat === 'TOP') return { top: '100%', marginTop: rs(-20) };
    if (seat === 'LEFT') return { left: '100%', marginLeft: rs(-10) };
    if (seat === 'RIGHT') return { right: '100%', marginRight: rs(-14) };
    return {};
  })();

  const fanOpacity = React.useRef(new RNAnimated.Value(0)).current;

  React.useEffect(() => {
    if (!isDealing) {
      RNAnimated.timing(fanOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      fanOpacity.setValue(0);
    }
  }, [isDealing]);

  return (
    <View style={[{ position: 'absolute', zIndex: 50 }, SEAT_POS[seat]]}>
      {/* 1. Player Badge (Always Visible) */}
      <View style={{ 
        zIndex: 10,
        flexDirection: isRight ? 'row-reverse' : 'row', 
        alignItems: 'center', 
        gap: rs(isLocal ? 4 : 5), 
        backgroundColor: isLocal ? 'rgba(255,255,255,0.06)' : C.glass, 
        borderWidth: isLocal ? 1.5 : 1, 
        borderColor: active ? col : (isLocal ? 'rgba(255,255,255,0.25)' : C.glassBorder), 
        borderRadius: rs(24), 
        paddingHorizontal: rs(isLocal ? 5 : 6), 
        paddingVertical: rs(isLocal ? 2 : 3) 
      }}>
        {active && (
          <View style={{ position: 'absolute', top: -rs(isLocal ? 7 : 9), [isRight ? 'right' : 'left']: rs(isLocal ? 6 : 8), backgroundColor: col, paddingHorizontal: rs(4), paddingVertical: rs(0.5), borderRadius: rs(4), zIndex: 10 }}>
            <Text style={{ color: '#000', fontSize: rs(isLocal ? 6 : 7), fontWeight: '900', letterSpacing: 0.4 }}>{displayTime}s · {isLocal ? 'YOUR TURN' : `${name.toUpperCase()}'S`}</Text>
          </View>
        )}
        <View style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, overflow: 'hidden', backgroundColor: '#111', borderWidth: active ? 0 : rs(1.2), borderColor: 'rgba(255,255,255,0.2)' }}>
            <Image source={avatar} style={{ width: '100%', height: '100%' }} />
          </View>
          {active && (
            <View style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
              <Svg width={avatarSize + rs(4)} height={avatarSize + rs(4)}>
                <AnimatedCircle cx={(avatarSize + rs(4)) / 2} cy={(avatarSize + rs(4)) / 2} r={radius} stroke={col} strokeWidth={rs(2.5)} fill="none" strokeDasharray={circumference} animatedProps={animatedProps} strokeLinecap="round" />
              </Svg>
            </View>
          )}
        </View>
        <View style={{ gap: 0, minWidth: rs(isLocal ? 34 : 40), maxWidth: rs(72), alignItems: isRight ? 'flex-end' : 'flex-start' }}>
          <Text style={{ color: active ? col : C.text, fontSize: rs(isLocal ? 9 : 10), fontWeight: '800' }} numberOfLines={1}>{name}</Text>
          <View style={{ flexDirection: isRight ? 'row-reverse' : 'row', alignItems: 'center', gap: rs(2), marginTop: rs(1) }}>
            {[...Array(4)].map((_, i) => (
              <View key={i} style={{ width: rs(4.5), height: rs(4.5), borderRadius: rs(2.25), backgroundColor: i < player.lives ? '#FF4A42' : 'rgba(255,255,255,0.15)' }} />
            ))}
          </View>
          <View style={{ flexDirection: isRight ? 'row-reverse' : 'row', alignItems: 'center', gap: rs(2), marginTop: rs(1) }}>
            <MaterialCommunityIcons name="cards-outline" size={rs(isLocal ? 8 : 9)} color="#FFD030" />
            <Text style={{ color: "#FFD030", fontSize: rs(isLocal ? 8 : 9), fontWeight: '700' }}>{cardCount}</Text>
          </View>
        </View>
      </View>

      {/* 2. Card Fan (Fades in after dealing) */}
      <View style={[StyleSheet.absoluteFillObject, { zIndex: 1, alignItems: 'center', justifyContent: 'center' }]} pointerEvents="box-none">
        <RNAnimated.View style={{ flex: 1, width: '100%', opacity: fanOpacity, alignItems: 'center', justifyContent: 'center' }} pointerEvents="box-none">
          <View style={[fanOffset, { position: 'absolute' }]}>
            <CardFan
              cards={player.cards}
              seat={seat}
              onCardPress={onPlayCard}
              fanCenters={fanCenters}
              onExpandPress={isLocal ? onShowHand : undefined}
              canPlayCard={isLocal && active ? canPlayCard : undefined}
            />
          </View>
        </RNAnimated.View>
      </View>

      {/* Emoji Bubble */}
      {activeEmoji && (
        <RNAnimated.View style={[st.emojiBubble,
        seat === 'LEFT' ? { left: rs(120) } : seat === 'RIGHT' ? { right: rs(120) } : { alignSelf: 'center', top: seat === 'DOWN' ? -rs(90) : rs(90) },
        {
          opacity: bubbleAnim,
          transform: [
            { scale: bubbleAnim },
          ]
        }
        ]}>
          <Image source={activeEmoji} style={st.emojiBubbleImg} />
        </RNAnimated.View>
      )}
    </View>
  );
});

const CentralPiles = React.memo(({ count, topCard, onPick }: { count: number; topCard: Card | null; onPick?: () => void }) => {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: rs(32), paddingBottom: rs(16) }}>
      <TouchableOpacity activeOpacity={0.8} onPress={onPick} style={{ width: CARD_W, height: CARD_H, alignItems: 'center', justifyContent: 'center' }}>
        {[...Array(5)].map((_, i) => (
          <Image key={i} source={require('../assets/images/whot/backcard.png')} style={{ position: 'absolute', width: CARD_W, height: CARD_H, borderRadius: rs(6), bottom: i * rs(2), right: i * rs(1), zIndex: 10 - i }} />
        ))}
        <View style={{ position: 'absolute', bottom: -rs(13), backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: rs(7), paddingVertical: rs(2), borderRadius: rs(8), borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', zIndex: 20 }}>
          <Text style={{ color: '#FFD030', fontSize: rs(11), fontWeight: '900' }}>{count}</Text>
        </View>
      </TouchableOpacity>
      <View style={{ width: CARD_W, height: CARD_H }}>
        {topCard && <WhotFrontCard shape={topCard?.shape} value={topCard?.value} width={CARD_W} height={CARD_H} />}
      </View>
    </View>
  );
});



const MatchTimer = React.memo(({ gameEndsAt }: { gameEndsAt: number | null }) => {
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
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeStr(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(iv);
  }, [gameEndsAt]);

  return (
    <View style={[pill, { width: rs(59), justifyContent: 'center' }]}>
      <MaterialCommunityIcons name="clock-outline" size={rs(12)} color="#FFD030" />
      <Text style={{ color: "#FFD030", fontSize: rs(11), fontWeight: '900', marginLeft: rs(4) }}>{timeStr}</Text>
    </View>
  );
});

export function WhotGameUI({
  onExit,
  playerCount = 4,
  localColor = 'green',
  localUserId,
  onWinner,
  onShowResult,
  gameId,
  realPlayers,
  externalEmojis,
  onSendEmoji,
}: {
  onExit: () => void;
  playerCount?: number;
  localColor?: Color;
  localUserId?: string;
  onWinner?: (winnerColor: string, scores?: Record<string, number>) => void;
  onShowResult?: () => void;
  gameId?: string;
  realPlayers?: any[];
  externalEmojis?: Record<string, any>;
  onSendEmoji?: (emoji: any) => void;
}) {
  const rootRef = React.useRef<View>(null);

  const [fanCenters] = React.useState<Record<string, { x: number; y: number }>>({});
  const [rootPos, setRootPos] = React.useState({ x: 0, y: 0 });
  const [rootLayout, setRootLayout] = React.useState({ w: SW, h: SH });
  // Ref that always points at the latest activePlay so socket callbacks can
  // detect whether an animation is in-flight without stale closures.
  const activePlayRef = React.useRef<any>(null);

  const [fontsLoaded] = useFonts({
    Kanit_900Black,
  });

  const [players, setPlayers] = React.useState<Player[]>([]);

  React.useEffect(() => {
    loadSounds();
  }, []);

  const [gameStarted, setGameStarted] = React.useState(false);
  const [marketCount, setMarketCount] = React.useState(54);
  const [activePlay, setActivePlay] = React.useState<{ start: { x: number, y: number, rot: number }; card: Card; key: string; onLand?: () => void } | null>(null);
  // Keep activePlayRef in sync so the multiplayer hook can peek at it
  const setActivePlayWithRef = React.useCallback((v: any) => {
    activePlayRef.current = typeof v === 'function' ? v(activePlayRef.current) : v;
    setActivePlay(v);
  }, []);
  const [activeMarketPicks, setActiveMarketPicks] = React.useState<MarketPick[]>([]);
  const [actionMessage, setActionMessage] = React.useState<{ msg: string, seat: Seat } | null>(null);
  const [reshuffling, setReshuffling] = React.useState(false);
  const [turnIndex, setTurnIndex] = React.useState(0);
  const [dealing, setDealing] = React.useState(false);
  const [topCard, setTopCard] = React.useState<Card | null>(getRandomCard());
  const [rawPendingPicks, setRawPendingPicks] = React.useState(0);
  const pendingPicksRef = React.useRef(0);
  const pendingHandsRef = React.useRef<Record<string, Card[]>>({});
  const channelRef = React.useRef<any>(null);
  const hasJoinedRoom = React.useRef(false);

  const setPendingPicks = React.useCallback((v: number | ((prev: number) => number)) => {
    setRawPendingPicks(prev => {
      const next = typeof v === 'function' ? v(prev) : v;
      pendingPicksRef.current = next;
      return next;
    });
  }, []);
  const pendingPicks = rawPendingPicks;

  const [currentShape, setCurrentShape] = React.useState<WhotShape | null>(null);
  const [showShapePicker, setShowShapePicker] = React.useState(false);
  const [showHandViewer, setShowHandViewer] = React.useState(false);
  const [showScoring, setShowScoring] = React.useState(false);
  const [savedWinnerInfo, setSavedWinnerInfo] = React.useState<{ color: string; scores: Record<string, number> } | null>(null);
  const [wasHoldOn, setWasHoldOn] = React.useState(false);
  const [realBalance, setRealBalance] = React.useState('0');
  const [isBotGame, setIsBotGame] = React.useState(!gameId);
  const [gameStartedAt, setGameStartedAt] = React.useState<number | null>(null);
  const [ping, setPing] = React.useState(0);
  const [showQuitModal, setShowQuitModal] = React.useState(false);
  const [turnStartedAt, setTurnStartedAt] = React.useState<number | null>(null);
  const [gameEndsAt, setGameEndsAt] = React.useState<number | null>(null);
  const [playerLives, setPlayerLives] = React.useState<Record<string, number>>({});
  const [prize, setPrize] = React.useState(0);
  const [showQuickSettings, setShowQuickSettings] = React.useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
  const [showReportMenu, setShowReportMenu] = React.useState(false);
  const [reportSent, setReportSent] = React.useState<string | null>(null);
  const [activeEmojis, setActiveEmojis] = React.useState<Record<string, any>>({});
  const [announcedLastCard, setAnnouncedLastCard] = React.useState<Record<string, boolean>>({});
  const playersRef = React.useRef(players);
  React.useEffect(() => { playersRef.current = players; }, [players]);

  const emojiAnim = React.useRef(new RNAnimated.Value(0)).current;
  const quickSettingsAnim = React.useRef(new RNAnimated.Value(0)).current;
  const reportMenuAnim = React.useRef(new RNAnimated.Value(0)).current;

  const handleReport = (name: string) => {
    setReportSent(`Report sent for ${name}`);
    setShowReportMenu(false);
    setTimeout(() => {
      setReportSent(null);
    }, 3000);
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
      RNAnimated.spring(emojiAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 8,
      }).start();
    } else {
      emojiAnim.setValue(0);
    }
  }, [showEmojiPicker]);

  React.useEffect(() => {
    if (showQuickSettings) {
      RNAnimated.spring(quickSettingsAnim, {
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
    if (showReportMenu) {
      RNAnimated.spring(reportMenuAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      reportMenuAnim.setValue(0);
    }
  }, [showReportMenu]);

  const visiblePlayers = React.useMemo(() => {
    if (!gameId) {
      // PRACTICE MODE: Use our new BotEngine creator
      return createPracticePlayers(localUserId || 'local', playerCount);
    }

    // MULTIPLAYER MODE: Current room mapping
    const lc = localColor || 'green';
    let clockSeats: Seat[] = ['DOWN', 'TOP'];
    if (playerCount === 3) clockSeats = ['DOWN', 'LEFT', 'TOP'];
    if (playerCount === 4) clockSeats = ['DOWN', 'LEFT', 'TOP', 'RIGHT'];

    const mock = createPracticePlayers('filler', playerCount);
    let combined = (realPlayers && realPlayers.length > 0)
      ? [...realPlayers].slice(0, playerCount)
      : [{ id: localUserId || 'local', color: lc, username: 'You' }];

    const localIdx = combined.findIndex(p => localUserId ? p.id === localUserId : p.color === lc);
    const resolvedLocalIdx = localIdx !== -1 ? localIdx : 0;
    const localSeatIndex = resolvedLocalIdx;

    return combined.map((p, i) => ({
      id: p.id,
      color: p.color as Color,
      name: p.username || (p.id === localUserId ? 'You' : (p.name || 'Player')),
      avatar: p.avatar_url ? { uri: p.avatar_url } : null,
      seat: clockSeats[((i - localSeatIndex) + clockSeats.length) % clockSeats.length] as Seat,
      cardCount: 0,
      cards: [],
      lives: 4,
      isBot: false,
      active: i === localSeatIndex,
    }));
  }, [playerCount, localColor, localUserId, gameId, realPlayers]);

  const localPlayerIndex = React.useMemo(() => {
    if (gameId) {
      return players.findIndex(p => localUserId ? p.id === localUserId : p.name === 'You');
    }

    return players.findIndex(p => p.name === 'You');
  }, [gameId, localUserId, players]);

  // ─── Multiplayer Hook ───
  const { handleRemotePlay, handleRemotePick, pendingTurnRef } = useWhotMultiplayer({
    gameId,
    players,
    visiblePlayers,
    setPlayers,
    setTopCard,
    setTurnIndex,
    setTurnStartedAt,
    setCurrentShape,
    setShowShapePicker,
    setGameStarted,
    setDealing,
    setPing,
    setActionMessage,
    setMarketCount,
    setActivePlay: setActivePlayWithRef,
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
  });

  const [gameDuration, setGameDuration] = React.useState<number | null>(null);

  React.useEffect(() => {
    // CRITICAL: We only sync if the game hasn't started yet. 
    // Once gameStarted is true, we lock the player list to prevent resets/flickering.
    if (gameStarted) return;

    if (!gameId) {
      setPlayers(visiblePlayers);
      // Auto-deal for practice mode
      const timer = setTimeout(() => {
        setTopCard(null);
        setDealing(true);
        setGameStarted(true);
        setGameEndsAt(Date.now() + 600000); // 10 minutes timeout
      }, 800);
      return () => clearTimeout(timer);
    } else if (realPlayers && realPlayers.length > 0) {
      setPlayers(visiblePlayers);
    }
  }, [visiblePlayers, gameId, realPlayers, gameStarted]);

  const freezeTimer = React.useCallback(() => {
    if (gameDuration === null && gameStartedAt) {
      setGameDuration(Math.floor((Date.now() - gameStartedAt) / 1000));
    }
  }, [gameDuration, gameStartedAt]);

  const getFinalScores = React.useCallback(() => {
    const scores: Record<string, number> = {};
    players.forEach(p => {
      scores[p.color] = calculateScore(p.cards);
    });
    return scores;
  }, [players]);

  // Handle Game Timeout (Safety trigger for bot and multiplayer)
  React.useEffect(() => {
    if (!gameEndsAt || !gameStarted || showScoring) return;

    const checkTimer = setInterval(() => {
      if (gameEndsAt && Date.now() >= gameEndsAt) {
        console.log('[WhotGameUI] Game timer expired. Ending game...');
        clearInterval(checkTimer);

        // Find winner based on score (lowest score wins)
        let winnerIdx = 0;
        let minScore = Infinity;

        players.forEach((p, i) => {
          const score = calculateScore(p.cards);
          if (score < minScore) {
            minScore = score;
            winnerIdx = i;
          }
        });

        const winner = players[winnerIdx];
        if (winner) {
          freezeTimer();
          setActionMessage({ msg: "TIME'S UP!", seat: 'TOP' });
          if (onWinner) onWinner(winner.color, getFinalScores());
          setTimeout(() => setShowScoring(true), 2500);
        }
      }
    }, 2000);

    return () => clearInterval(checkTimer);
  }, [gameEndsAt, gameStarted, players, showScoring]);

  React.useEffect(() => {
    // Ensure topCard isn't a penalty card at start (2, 5, or 20)
    if ([2, 5, 20].includes(topCard?.value as any)) {
      setTopCard(getRandomCard());
    }
  }, []);



  React.useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('wallet_balance').eq('id', user.id).single();
      if (data) {
        const bal = data.wallet_balance || 0;
        if (bal >= 1e6) setRealBalance((bal / 1e6).toFixed(1) + 'm');
        else if (bal >= 1e3) setRealBalance((bal / 1e3).toFixed(1) + 'k');
        else setRealBalance(bal.toString());
      }
    }
    fetchUser();
  }, []);

  React.useEffect(() => {
    // Cleanup if needed
  }, []);

  const findNextActivePlayer = React.useCallback((current: number, step: number = 1): number => {
    return getNextPlayer(current, step, playersRef.current);
  }, []);

  const canPlayCard = React.useCallback((card: Card, handLength: number = 0) => {
    return checkPlayable(card, topCard, currentShape, pendingPicks, handLength);
  }, [topCard, currentShape, pendingPicks]);

  React.useEffect(() => {
    return () => { /* cleanup if needed */ };
  }, []);

  // In multiplayer, shape picker is shown explicitly in onLand (to avoid racing
  // with the server's whot_state broadcast). This effect is only for practice mode.
  React.useEffect(() => {
    if (gameId) return;

    const shouldShowShapePicker =
      !dealing &&
      !activePlay &&
      turnIndex === localPlayerIndex &&
      localPlayerIndex !== -1 &&
      topCard?.value === 20 &&
      currentShape === null &&
      (players[localPlayerIndex]?.cards.length ?? 0) > 0;

    setShowShapePicker(shouldShowShapePicker);
  }, [gameId, dealing, activePlay, turnIndex, localPlayerIndex, topCard?.value, currentShape, players]);

  const handleCardLand = React.useCallback((pi: number) => {
    // Optimization: Do nothing on land during distribution to avoid 
    // triggering 20+ heavy re-renders of the entire UI.
    // The final hands will be assigned atomically in handleDone.
  }, []);

  const handleDone = React.useCallback(() => {
    // Assign final cards to all players at once (Atomic Update)
    setPlayers(prev => {
      return prev.map(p => {
        const realHand = pendingHandsRef.current[p.id] || [];
        // If we don't have a real hand (practice mode), generate 5 random cards
        const finalCards = realHand.length > 0 ? realHand : Array(5).fill(0).map(() => getRandomCard());
        return {
          ...p,
          cards: finalCards,
          cardCount: finalCards.length,
        };
      });
    });

    setMarketCount(54 - players.length * 5);

    // In practice mode, reveal the first card from the deck
    if (!gameId) {
      setTopCard(getRandomCard());
    }

    // Keep dealing=true for 150ms more so CardFans have time to render at opacity 1
    // and replace the animation perfectly.
    // Keep dealing=true for a tiny bit longer to overlap with the fade-in start
    setTimeout(() => {
      setDealing(false);
    }, 50);
  }, [players.length]);

  // Trigger Reshuffle when market is low
  React.useEffect(() => {
    if (marketCount <= 2 && !reshuffling && !dealing) {
      setReshuffling(true);
      playWhotReshuffleSound();
    }
  }, [marketCount, reshuffling, dealing]);

  const triggerNextTurn = React.useCallback(() => {
    setTurnIndex(prev => (prev + 1) % visiblePlayers.length);
    setTurnStartedAt(Date.now());
  }, [visiblePlayers.length]);

  // Ensure timer starts when distribution is done and whenever turnIndex changes
  React.useEffect(() => {
    if (!dealing && gameStarted) {
      setTurnStartedAt(Date.now());
      if (!gameStartedAt) setGameStartedAt(Date.now());
    }
  }, [turnIndex, dealing, gameStarted]);

  const handlePlayCard = React.useCallback((pi: number, cardIdx: number) => {
    if (pi !== turnIndex) return;
    const p = players[pi];
    if (activePlay || !p || p.cardCount <= 0) return;

    playWhotCardSound();
    const card = p.cards[cardIdx];
    if (!card) return;

    if (!canPlayCard(card, p.cards.length)) {
      setActionMessage({ msg: p.cards.length === 1 ? "Can't win with this!" : "Can't play that!", seat: p.seat as Seat });
      return;
    }

    // Snapshot card count BEFORE splice so winner detection is accurate
    const cardCountBefore = p.cards.length;

    // [House Rule] Last Card Penalty removed as per user request (now automatic)

    // Apply special effects messages
    let message = "";
    if (card.value === 1) message = "Hold On!";
    else if (card.value === 8) message = "Suspension!";
    else if (card.value === 2) message = pendingPicks > 0 ? "DEFENDED!" : "Pick 2!";
    else if (card.value === 5) message = pendingPicks > 0 ? "DEFENDED!" : "Pick 3!";
    else if (card.value === 14) message = "General Market!";
    else if (card.value === 20) message = "Whot!";

    if (message) {
      setActionMessage({ msg: message, seat: p.seat as Seat });
      if (card.value === 1) playWhotHoldOnSound();
      else if (card.value === 2 || card.value === 5) {
        if (message === "DEFENDED!") playWhotDefendedSound();
        else card.value === 2 ? playWhotPick2Sound() : playWhotPick3Sound();
      }
      else if (card.value === 8) playWhotSuspendedSound();
      else if (card.value === 14) playWhotGeneralMarketSound();
    } else if (wasHoldOn) {
      setActionMessage({ msg: "CONTINUE", seat: p.seat as Seat });
      playWhotContinueSound();
    }

    // Broadcast if multiplayer (via Socket.io)
    if (gameId) {
      socket.emit('whot_play', { pi, cardIdx, card, specialMsg: message || (wasHoldOn ? "CONTINUE" : "") });
    }

    // Splice the card immediately so the fan updates before the animation ends
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

    setActivePlayWithRef({
      start: getCardInFanPos(p.seat as Seat, cardIdx, p.cardCount, pi === localPlayerIndex, !!gameId),
      card,
      key: Date.now().toString(),
      onLand: gameId ? () => {
        setTopCard(card);
        // ── Winner detection (multiplayer) ──────────────────────────────────
        // cardCountBefore is captured before the splice; after playing one card
        // the remaining count is cardCountBefore - 1.
        const remainingAfterPlay = cardCountBefore - 1;

        if (card.value !== 20) {
          setCurrentShape(null);
        } else if (remainingAfterPlay > 0) {
          setCurrentShape(null);
          if (pi === localPlayerIndex) {
            console.log(`[WhotGameUI] Showing shape picker in multiplayer for local player`);
            setShowShapePicker(true);
          }
        } else {
          setCurrentShape(null);
        }
        setActivePlayWithRef(null);

        if (remainingAfterPlay <= 0) {
          freezeTimer();
          setActionMessage({ msg: 'winner', seat: p.seat as Seat });
          if (onWinner) onWinner(p.color, getFinalScores());
          setTimeout(() => setShowScoring(true), 2500);
        } else if (remainingAfterPlay === 1 && card.value !== 20) {
          // Only show 'last card' for normal cards.
          // When playing Whot (20), the shape picker already appears — don't overlay it.
          setActionMessage({ msg: 'last card', seat: p.seat as Seat });
          playWhotLastCardSound();
        }

        // Apply any deferred turn advancement from whot_state / whot_turn_update
        if (pendingTurnRef.current !== null) {
          const { turn, startedAt } = pendingTurnRef.current;
          pendingTurnRef.current = null;
          // Only advance turn if we're NOT waiting for shape selection
          if (card.value !== 20) {
            setTurnIndex(turn);
            setTurnStartedAt(startedAt);
          }
        }
      } : () => handlePlayLand(cardCountBefore - 1)
    });
  }, [players, turnIndex, activePlay, canPlayCard, gameId, localPlayerIndex, wasHoldOn, onWinner, setActivePlayWithRef, pendingTurnRef]);

  const handlePlayLocal = React.useCallback((cardIdx: number) => {
    if (localPlayerIndex === turnIndex && localPlayerIndex !== -1) {
      handlePlayCard(localPlayerIndex, cardIdx);
    } else {
      setActionMessage({ msg: "Not your turn!", seat: 'DOWN' });
    }
  }, [localPlayerIndex, turnIndex, handlePlayCard]);

  const forceAutoPick = React.useCallback(() => {
    if (reshuffling || dealing) return;
    const p = players[turnIndex];
    if (!p || marketCount <= 0) return;

    const newCard = getRandomCard();
    setActiveMarketPicks(prev => [...prev, {
      key: Math.random().toString(),
      seat: p.seat as Seat,
      card: newCard,
      delay: 0,
      pi: turnIndex,
      pickIndex: 0,
      totalAtStart: p.cardCount,
      isPenalty: false,
    }]);
    setMarketCount(prev => prev - 1);
  }, [marketCount, reshuffling, dealing, players, turnIndex]);

   const handlePickAction = React.useCallback((pi: number, overrideCount?: number, isPenalty: boolean = false) => {
    if (reshuffling || dealing) return;
    const p = players[pi];
    if (!p) return;

    if (topCard?.value === 20 && currentShape === null && pi === turnIndex && (players[pi]?.cards.length ?? 0) > 0 && !isPenalty) {
      setShowShapePicker(true);
      return;
    }

    if (marketCount <= 0) {
      setReshuffling(true);
      return;
    }

    const count = overrideCount ?? (pendingPicksRef.current > 0 ? pendingPicksRef.current : 1);

    // In multiplayer, we do NOT mutate state here. We just broadcast our intent.
    // The server will update its state and broadcast whot_state and whot_remote_pick.
    if (gameId) {
      if (wasHoldOn && pi === turnIndex) {
        setActionMessage({ msg: "CONTINUE", seat: p.seat as Seat });
      }
      socket.emit('whot_pick', { pi, count, specialMsg: wasHoldOn ? "CONTINUE" : "" });
      return;
    }

    // Reset Last Card announcement if drawing
    setAnnouncedLastCard(prev => {
      const next = { ...prev };
      delete next[p.id];
      return next;
    });

    // Local single-player state updates
    if (!overrideCount && pendingPicksRef.current > 0) setPendingPicks(0);

    if (wasHoldOn && pi === turnIndex) {
      setActionMessage({ msg: "CONTINUE", seat: p.seat as Seat });
    }



    setWasHoldOn(false);

    const cardsToDraw = [];
    for (let i = 0; i < count; i++) cardsToDraw.push(getRandomCard());

    const newPicks: MarketPick[] = [];
    for (let i = 0; i < count; i++) {
      newPicks.push({
        key: `${Math.random()}-${i}`,
        seat: p.seat as Seat,
        card: cardsToDraw[i],
        delay: i * 600,
        pi,
        pickIndex: i,
        totalAtStart: p.cardCount,
        isPenalty,
      });
    }

    setActiveMarketPicks(prev => [...prev, ...newPicks]);
    setMarketCount(prev => Math.max(0, prev - count));
  }, [marketCount, reshuffling, dealing, players, turnIndex, topCard?.value, currentShape]);

  const handlePickActionRef = React.useRef(handlePickAction);
  React.useEffect(() => { handlePickActionRef.current = handlePickAction; });

  // AI Turn Logic - ONLY for bots in practice mode
  React.useEffect(() => {
    if (gameId) return; // Disable local AI in multiplayer
    const hasWinner = players.some(p => p.cardCount === 0);
    if (dealing || reshuffling || activePlay || showShapePicker || activeMarketPicks.length > 0 || showScoring || hasWinner) return;

    const currentPlayer = players[turnIndex];
    if (currentPlayer && currentPlayer.lives > 0 && currentPlayer.isBot) {
      const timer = setTimeout(() => {
        const decision = getBotDecision(currentPlayer.cards, canPlayCard);

        if (decision.type === 'PLAY') {
          handlePlayCard(turnIndex, decision.cardIndex!);
        } else {
          handlePickActionRef.current(turnIndex);
        }
      }, 1500 + Math.random() * 1000);
      return () => clearTimeout(timer);
    }
  }, [gameId, turnIndex, dealing, reshuffling, players, activePlay, canPlayCard, showShapePicker, handlePlayCard]);


  React.useEffect(() => {
    if (gameId) return; // Disable local timeout in multiplayer
    if (dealing || reshuffling || activePlay || activeMarketPicks.length > 0 || showScoring) return;

    const timer = setTimeout(() => {
      console.log(`[WhotGameUI] Turn timeout for player ${turnIndex}`);
      // Deduct a life
      setPlayers(prev => {
        const next = [...prev];
        if (next[turnIndex]) {
          next[turnIndex] = { ...next[turnIndex], lives: Math.max(0, next[turnIndex].lives - 1) };
        }
        return next;
      });
      const currentP = playersRef.current[turnIndex];
      setActionMessage({ msg: 'TIMEOUT!', seat: currentP?.seat as Seat || 'DOWN' });
      // Clean skip: clear any pending picks and advance turn WITHOUT drawing a card
      setPendingPicks(0);
      setWasHoldOn(false);
      setTurnIndex(prev => findNextActivePlayer(prev, 1));
      setTurnStartedAt(Date.now());
    }, 15000);

    return () => clearTimeout(timer);
  }, [gameId, turnIndex, dealing, reshuffling, activePlay, findNextActivePlayer, activeMarketPicks.length]);

  const handlePickLocal = React.useCallback(() => {
    if (turnIndex !== localPlayerIndex || activeMarketPicks.length > 0) {
      if (turnIndex !== localPlayerIndex) setActionMessage({ msg: "Not your turn!", seat: 'DOWN' });
      return;
    }
    handlePickAction(turnIndex);
  }, [localPlayerIndex, turnIndex, activeMarketPicks.length, handlePickAction]);

  const handleReshuffleDone = React.useCallback(() => {
    setReshuffling(false);
    setMarketCount(42);
    // After reshuffle, the turn that was stuck should continue
  }, []);

  const lastLandedWasPenalty = React.useRef(false);

  const handleMarketPickLand = React.useCallback((key: string, card: Card, pi: number, isPenalty: boolean = false) => {
    lastLandedPi.current = pi;
    lastLandedWasPenalty.current = isPenalty;
    setPlayers(prev => {
      const next = [...prev];
      if (next[pi]) {
        next[pi] = {
          ...next[pi],
          cardCount: next[pi].cardCount + 1,
          cards: [...next[pi].cards, card],
        };
      }
      return next;
    });
    setActiveMarketPicks(prev => prev.filter(p => p.key !== key));
  }, []);

  // Advance turn after all picks have landed
  React.useEffect(() => {
    const active = activeMarketPicks;
    if (active.length === 0 && lastLandedPi.current !== null) {
      const pi = lastLandedPi.current;
      const wasPenalty = lastLandedWasPenalty.current;
      lastLandedPi.current = null;
      lastLandedWasPenalty.current = false;

      // Only advance turn if it wasn't a penalty draw and it's the current player's turn
      if (!gameId && pi === turnIndex && !wasPenalty) {
        setTurnIndex(v => getNextPlayer(v, 1, playersRef.current));
      }
    }
  }, [activeMarketPicks.length, gameId, turnIndex]);

  // handlePlayLand: fallback onLand for the PlayCardAnim when no custom onLand
  // is set. In multiplayer the custom onLand on activePlay is always set, so
  // this function only executes in practice / bot mode.
  const announceLastCard = React.useCallback(() => {
    if (localPlayerIndex === -1) return;
    const p = players[localPlayerIndex];
    if (p.cardCount !== 2) return;

    setAnnouncedLastCard(prev => ({ ...prev, [p.id]: true }));
    setActionMessage({ msg: "LAST CARD!", seat: p.seat as Seat });
    playWhotLastCardSound();

    if (gameId) {
      socket.emit('whot_last_card_announced', { pi: localPlayerIndex });
    }
  }, [localPlayerIndex, players, gameId]);

  // handlePlayLand: fallback onLand for the PlayCardAnim when no custom onLand
  // is set. In multiplayer the custom onLand on activePlay is always set, so
  // this function only executes in practice / bot mode.
  const handlePlayLand = React.useCallback((capturedRemaining?: number) => {
    if (!activePlayRef.current || gameId) return; // multiplayer handled via custom onLand
    const card = activePlayRef.current.card;
    setTopCard(card);
    setActivePlayWithRef(null);

    const remaining = capturedRemaining ?? players[turnIndex].cards.length;
    if (card.value !== 20 || remaining === 0) {
      setCurrentShape(null);
    }

    let nextStep = 1;
    if (card.value === 1) {
      nextStep = 0;
      setWasHoldOn(true);
    } else {
      setWasHoldOn(false);
      if (card.value === 8) {
        nextStep = 2;
      } else if (card.value === 14) {
        nextStep = 0;
        players.forEach((p, i) => {
          if (i !== turnIndex) handlePickAction(i, 1);
        });
      } else if (card.value === 2) {
        if (pendingPicksRef.current > 0) {
          setActionMessage({ msg: "DEFENDED!", seat: players[turnIndex].seat as Seat });
          setPendingPicks(0);
        } else {
          setPendingPicks(prev => prev + 2);
        }
      } else if (card.value === 5) {
        if (pendingPicksRef.current > 0) {
          setActionMessage({ msg: "DEFENDED!", seat: players[turnIndex].seat as Seat });
          setPendingPicks(0);
        } else {
          setPendingPicks(prev => prev + 3);
        }
      } else if (card.value === 20) {
        // remaining already defined
        if (turnIndex === localPlayerIndex) {
          if (remaining > 0) {
            console.log(`[WhotGameUI] Showing shape picker for local player ${turnIndex}`);
            setCurrentShape(null);
            setShowShapePicker(true);
            return; // turn advances after shape is chosen
          }
        } else if (remaining > 0) {
          const shapes: WhotShape[] = ['circle', 'triangle', 'cross', 'square', 'star'];
          const hand = players[turnIndex].cards;
          // Strategy: pick the shape AI has most of
          const counts: any = {};
          hand.forEach(c => { if (c.shape !== 'whot') counts[c.shape] = (counts[c.shape] || 0) + 1; });

          let chosen: WhotShape = shapes[Math.floor(Math.random() * shapes.length)];
          let max = 0;
          Object.keys(counts).forEach(s => {
            if (counts[s] > max) { max = counts[s]; chosen = s as WhotShape; }
          });

          setCurrentShape(chosen);
          playWhotGMSound(chosen);
          setActionMessage({ msg: `I want ${chosen.toUpperCase()}!`, seat: players[turnIndex].seat as Seat });
        }
      }
    }

    // Show 'last card' only for regular cards. When card is Whot (20), the
    // shape message 'I want TRIANGLE!' is already shown — don't override it.
    if (remaining === 1 && card.value !== 20) {
      setActionMessage({ msg: "last card", seat: players[turnIndex].seat as Seat });
      playWhotLastCardSound();
    }
    if (remaining === 0) {
      freezeTimer();
      const winnerColor = players[turnIndex].color;
      const finalScores = getFinalScores();
      setActionMessage({ msg: "winner", seat: players[turnIndex].seat as Seat });

      if (playerCount === 2) {
        // For 2 players, skip scoring and go straight to result screen after the "winner" bubble
        setTimeout(() => {
          if (onWinner) onWinner(winnerColor, finalScores);
        }, 2200);
      } else {
        // For 4 players, wait for the bubble, then show the internal scoring (counting) screen
        // Note: we'll call onWinner ONLY after they finish the scoring screen to avoid overlapping
        setTimeout(() => {
          setShowScoring(true);
        }, 2500);

        // Save these for when onNext is called
        setSavedWinnerInfo({ color: winnerColor, scores: finalScores });
      }

      setTurnIndex(prev => findNextActivePlayer(prev, nextStep));
      return;
    }

    setTurnIndex(prev => findNextActivePlayer(prev, nextStep));
  }, [activePlay, gameId, turnIndex, localPlayerIndex, players, handlePickAction, findNextActivePlayer, onWinner, setActivePlayWithRef]);
  const handleShapeSelect = React.useCallback((shape: WhotShape) => {
    setShowShapePicker(false);
    playWhotGMSound(shape);

    if (!gameId) {
      setCurrentShape(shape);
      // Show clean shape message — 'last card' will show when they play their final card
      setActionMessage({ msg: `I want ${shape.toUpperCase()}!`, seat: 'DOWN' });
      setTurnIndex(prev => getNextPlayer(prev, 1, playersRef.current));
      setTurnStartedAt(Date.now());
      return;
    }

    // In multiplayer, the server is fully authoritative.
    // We emit our choice and wait for the server to broadcast it back
    // via whot_shape_chosen or whot_state.
    socket.emit('whot_choose_shape', { shape });
  }, [gameId, players, localPlayerIndex]);

  if (!fontsLoaded) return null;

  return (
    <View
      ref={rootRef}
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setRootLayout({ w: width, h: height });
        rootRef.current?.measureInWindow((x: number, y: number) => setRootPos({ x, y }));
      }}
    >
      <ShapeSelectionOverlay visible={showShapePicker} onSelect={handleShapeSelect} />
      {/* Preload back-card image */}
      <View style={{ opacity: 0, position: 'absolute', width: 1, height: 1 }}>
        <Image source={require('../assets/images/whot/backcard.png')} />
      </View>
      <View
        style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center', zIndex: 1, opacity: showScoring ? 0 : 1 }]}
        pointerEvents={showScoring ? 'none' : "box-none"}
      >
        <CentralPiles count={marketCount} topCard={topCard} onPick={handlePickLocal} />
      </View>
      {/* Report Success Toast */}
      {reportSent && (
        <View style={st.toastContainer}>
          <MaterialCommunityIcons name="check-circle" size={rs(16)} color={C.green} />
          <Text style={st.toastText}>{reportSent}</Text>
        </View>
      )}

      {/* Quick Settings Popup */}
      {showQuickSettings && (
        <RNAnimated.View style={[st.quickSettingsPopup, {
          opacity: quickSettingsAnim,
          transform: [
            { translateY: quickSettingsAnim.interpolate({ inputRange: [0, 1], outputRange: [rs(20), 0] }) },
            { scale: quickSettingsAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
          ]
        }]}>
          <View style={st.qHeader}>
            <Text style={st.qTitle}>SETTINGS</Text>
          </View>
          <TouchableOpacity style={st.quickSettingsItem} activeOpacity={0.7}>
            <View style={[st.qIconBg, { backgroundColor: 'rgba(74, 230, 92, 0.15)' }]}>
              <MaterialCommunityIcons name="volume-high" size={rs(16)} color={C.green} />
            </View>
            <Text style={st.quickSettingsText}>SFX</Text>
            <View style={[st.toggle, { backgroundColor: C.green }]}>
              <View style={[st.toggleDot, { alignSelf: 'flex-end' }]} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={st.quickSettingsItem} activeOpacity={0.7}>
            <View style={[st.qIconBg, { backgroundColor: 'rgba(45, 168, 255, 0.15)' }]}>
              <MaterialCommunityIcons name="music" size={rs(16)} color={C.blue} />
            </View>
            <Text style={st.quickSettingsText}>Music</Text>
            <View style={st.toggle}>
              <View style={st.toggleDot} />
            </View>
          </TouchableOpacity>
          <View style={st.qDivider} />
          <TouchableOpacity
            style={st.quickSettingsItem}
            activeOpacity={0.7}
            onPress={() => {
              setShowQuickSettings(false);
              setShowQuitModal(true);
            }}
          >
            <View style={[st.qIconBg, { backgroundColor: 'rgba(255,59,48,0.1)' }]}>
              <MaterialCommunityIcons name="logout" size={rs(14)} color={C.red} />
            </View>
            <Text style={[st.quickSettingsText, { color: C.red }]}>Quit Game</Text>
          </TouchableOpacity>

          <View style={st.qDivider} />

          <TouchableOpacity
            style={st.quickSettingsItem}
            activeOpacity={0.7}
            onPress={() => {
              runWhotTests();
              setActionMessage({ msg: "AUDIT COMPLETE (Check Console)", seat: 'DOWN' });
              setShowQuickSettings(false);
            }}
          >
            <View style={[st.qIconBg, { backgroundColor: 'rgba(52,199,89,0.1)' }]}>
              <MaterialCommunityIcons name="shield-check-outline" size={rs(14)} color={C.green} />
            </View>
            <Text style={[st.quickSettingsText, { color: C.green }]}>Run Logic Audit</Text>
          </TouchableOpacity>
        </RNAnimated.View>
      )}

      {/* Report Menu Popup */}
      {showReportMenu && (
        <RNAnimated.View style={[st.reportPopup, {
          opacity: reportMenuAnim,
          transform: [
            { translateY: reportMenuAnim.interpolate({ inputRange: [0, 1], outputRange: [rs(20), 0] }) },
            { scale: reportMenuAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
          ]
        }]}>
          <View style={st.qHeader}>
            <Text style={st.qTitle}>REPORT PLAYER</Text>
          </View>
          {visiblePlayers.filter(p => p.id !== localUserId).map(p => (
            <View key={p.id || p.name} style={st.reportItem}>
              <View style={st.pSmallAvatar}>
                <Image source={p.avatar} style={{ width: '100%', height: '100%' }} />
                <View style={[st.pStatus, { backgroundColor: colorHex[p.color as Color] }]} />
              </View>
              <Text style={st.quickSettingsText} numberOfLines={1}>{p.name}</Text>
              <TouchableOpacity
                style={st.reportBtn}
                onPress={() => handleReport(p.name)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="flag" size={rs(14)} color="#FF4A42" />
              </TouchableOpacity>
            </View>
          ))}
        </RNAnimated.View>
      )}

      {players.map((p, i) => (
        <PlayerChip
          key={p.id || p.name}
          player={{ ...p, active: i === turnIndex } as any}
          onPlayCard={i === localPlayerIndex ? handlePlayLocal : undefined}
          fanCenters={fanCenters}
          onShowHand={() => setShowHandViewer(true)}
          activeSince={i === turnIndex ? turnStartedAt : null}
          isDealing={dealing}
          activeEmoji={externalEmojis?.[p.color] || activeEmojis[p.color]}
          isMultiplayer={!!gameId}
          canPlayCard={canPlayCard}
        />
      ))}
      {/* Animation Layer — native thread (Reanimated) */}
      {dealing && (
        <CardDistributionOverlay
          key="whot-dist-overlay"
          players={visiblePlayers.map(p => ({ seat: p.seat as Seat, isLocal: p.name === 'You' || p.id === localUserId }))}
          onCardLand={handleCardLand}
          onComplete={handleDone}
          rootLayout={rootLayout}
          rootPos={rootPos}
        />
      )}
      {activeMarketPicks.map(p => (
        <MarketPickAnim
          key={p.key}
          seat={p.seat}
          card={p.card}
          pi={p.pi}
          isLocal={p.seat === 'DOWN'}
          delay={p.delay}
          pickIndex={p.pickIndex}
          totalAtStart={p.totalAtStart}
          onLand={() => handleMarketPickLand(p.key, p.card, p.pi, p.isPenalty)}
          fanCenters={fanCenters}
          rootPos={rootPos}
          rootLayout={rootLayout}
        />
      ))}
      {reshuffling && (
        <ReshuffleAnim
          onComplete={() => { setMarketCount(42); setReshuffling(false); }}
          rootLayout={rootLayout}
        />
      )}
      {activePlay && (
        <PlayCardAnim
          startX={activePlay.start.x - rootPos.x}
          startY={activePlay.start.y - rootPos.y}
          startRot={activePlay.start.rot}
          card={activePlay.card}
          onLand={activePlay.onLand || handlePlayLand}
          rootLayout={rootLayout}
        />
      )}

      <View style={{ position: 'absolute', top: rs(12), left: rs(14), right: rs(14), flexDirection: 'row', alignItems: 'center', zIndex: 100 }}>
        <TouchableOpacity onPress={() => { playButtonSound(); setShowQuitModal(true); }} style={pill}>
          <MaterialCommunityIcons name="chevron-left" size={rs(18)} color="#FFD030" />
        </TouchableOpacity>

        <View style={pill}>
          <Text style={{ color: C.text, fontSize: rs(13), fontWeight: '900', letterSpacing: 1 }}>WHOT!</Text>
          <Text style={{ color: C.muted, fontSize: rs(11), fontWeight: '600' }}> · {playerCount}P</Text>
        </View>

        <MatchTimer gameEndsAt={gameEndsAt} />

        <View style={[pill, { gap: rs(4) }]}>
          <View style={{ width: rs(6), height: rs(6), borderRadius: rs(3), backgroundColor: isBotGame ? '#C8C8D4' : (ping < 100 ? '#30D158' : ping < 250 ? '#FFD030' : '#FF453A') }} />
          <Text style={{ color: C.muted, fontSize: rs(10), fontWeight: '800' }}>{isBotGame ? 'BOT MATCH' : `${ping}ms`}</Text>
        </View>

        <View style={{ flex: 1 }} />

        {/* Prize Pill */}
        <View style={[pill, { backgroundColor: 'rgba(212,175,55,0.1)', borderColor: 'rgba(212,175,55,0.2)' }]}>
          <MaterialCommunityIcons name="trophy-outline" size={rs(11)} color="#FFD030" />
          <Text style={{ color: '#FFD030', fontSize: rs(10), fontWeight: '900', marginLeft: rs(4) }}>
            ₦{prize.toLocaleString()}
          </Text>
        </View>

        {/* Balance Pill */}
        {!isBotGame && (
          <View style={[pill, { marginLeft: rs(4) }]}>
            <MaterialCommunityIcons name="wallet-outline" size={rs(11)} color="#FFD030" />
            <Text style={{ color: '#FFF', fontSize: rs(10), fontWeight: '900', marginLeft: rs(4) }}>
              {realBalance}
            </Text>
          </View>
        )}

        {/* Settings Button (Icon Only) */}
        <TouchableOpacity
          onPress={() => { playButtonSound(); setShowQuickSettings(!showQuickSettings); }}
          activeOpacity={0.8}
          style={[pill, { marginLeft: rs(4), paddingHorizontal: rs(8), marginRight: 0 }]}
        >
          <MaterialCommunityIcons name="tune-vertical" size={rs(14)} color={C.muted} />
        </TouchableOpacity>
      </View>

      <View style={{ position: 'absolute', bottom: rs(12), left: rs(14), right: rs(14), flexDirection: 'row', alignItems: 'center', zIndex: 100 }}>
        <TouchableOpacity
          style={iconBtn}
          activeOpacity={0.8}
          onPress={() => { playButtonSound(); setShowEmojiPicker(!showEmojiPicker); }}
        >
          <MaterialCommunityIcons name="emoticon-outline" size={rs(18)} color={C.muted} />
        </TouchableOpacity>

        {/* Emoji Picker Popup */}
        {showEmojiPicker && (
          <RNAnimated.View style={[st.emojiPicker, {
            opacity: emojiAnim,
            transform: [
              { translateY: emojiAnim.interpolate({ inputRange: [0, 1], outputRange: [rs(40), 0] }) },
              { scale: emojiAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
            ]
          }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.emojiScroll}>
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
          </RNAnimated.View>
        )}

        {localPlayerIndex !== -1 && players[localPlayerIndex]?.cardCount === 2 && (
          <TouchableOpacity
            style={[pill, { backgroundColor: announcedLastCard[players[localPlayerIndex].id] ? '#4CAF50' : '#FF9800', paddingHorizontal: rs(12) }]}
            onPress={announceLastCard}
          >
            <Text style={{ color: '#FFF', fontSize: rs(10), fontWeight: '900' }}>
              {announcedLastCard[players[localPlayerIndex].id] ? "WARNING SENT" : "LAST CARD!"}
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          style={iconBtn}
          activeOpacity={0.8}
          onPress={() => setShowReportMenu(!showReportMenu)}
        >
          <MaterialCommunityIcons name="flag-outline" size={rs(18)} color="#FF4A42" />
        </TouchableOpacity>
      </View>
      {showHandViewer && localPlayerIndex !== -1 && players[localPlayerIndex] && (
        <HandViewerOverlay
          cards={players[localPlayerIndex].cards}
          onClose={() => setShowHandViewer(false)}
          onCardPress={(idx) => handlePlayCard(localPlayerIndex, idx)}
          canPlayCard={canPlayCard}
        />
      )}
      {showScoring && (
        <WhotScoringSystem
          visible={showScoring}
          players={players}
          onRestart={() => {
            setShowScoring(false);
            setSavedWinnerInfo(null);
            onExit();
          }}
          onNext={() => {
            setShowScoring(false);
            if (savedWinnerInfo && onWinner) {
              onWinner(savedWinnerInfo.color, savedWinnerInfo.scores);
              setSavedWinnerInfo(null);
            }
          }}
        />
      )}
      {actionMessage && !showScoring && <ActionPopup message={actionMessage.msg} seat={actionMessage.seat} onComplete={() => setActionMessage(null)} />}

      {/* Quit Confirmation Modal */}
      <GameQuitModal
        visible={showQuitModal}
        onCancel={() => setShowQuitModal(false)}
        onConfirm={onExit}
        stake={isBotGame ? 0 : (prize / playerCount)}
      />
    </View>
  );
}



const pill: any = { flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder, borderRadius: rs(18), paddingHorizontal: rs(10), paddingVertical: rs(6), marginRight: rs(6) };
const iconBtn: any = { width: rs(35), height: rs(35), borderRadius: rs(12), backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder, alignItems: 'center', justifyContent: 'center' };
const st = StyleSheet.create({
  emojiPicker: {
    position: 'absolute',
    bottom: rs(36),
    left: 0,
    width: rs(280),
    height: rs(240),
    backgroundColor: 'rgba(12, 12, 12, 0.95)',
    borderRadius: rs(24),
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    padding: rs(10),
    zIndex: 100,
  },
  emojiScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rs(8),
    justifyContent: 'center',
    paddingVertical: rs(8),
  },
  emojiItem: {
    width: rs(44),
    height: rs(44),
    borderRadius: rs(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiImg: {
    width: rs(44),
    height: rs(44),
    resizeMode: 'contain',
  },
  emojiBubble: {
    position: 'absolute',
    borderRadius: rs(12),
    zIndex: 200,
  },
  emojiBubbleImg: {
    width: rs(64),
    height: rs(64),
    resizeMode: 'contain',
  },
  toastContainer: {
    position: 'absolute',
    top: rs(60),
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: rs(16),
    paddingVertical: rs(10),
    borderRadius: rs(20),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    zIndex: 1000,
    gap: rs(8),
  },
  toastText: {
    color: '#FFF',
    fontSize: rs(12),
    fontWeight: '700',
  },
  quickSettingsPopup: {
    position: 'absolute',
    top: rs(54),
    right: rs(14),
    width: rs(145),
    backgroundColor: 'rgba(15,15,15,0.92)',
    borderRadius: rs(20),
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: rs(4),
    zIndex: 100,
  },
  qHeader: {
    paddingVertical: rs(6),
    paddingHorizontal: rs(10),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    marginBottom: rs(2),
  },
  qTitle: {
    color: C.muted,
    fontSize: rs(9),
    fontWeight: '900',
    letterSpacing: 1,
  },
  quickSettingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: rs(8),
    gap: rs(10),
  },
  qIconBg: {
    width: rs(24),
    height: rs(24),
    borderRadius: rs(6),
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickSettingsText: {
    flex: 1,
    color: C.text,
    fontSize: rs(11),
    fontWeight: '700',
  },
  toggle: {
    width: rs(28),
    height: rs(16),
    borderRadius: rs(8),
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: rs(2),
    justifyContent: 'center',
  },
  toggleDot: {
    width: rs(12),
    height: rs(12),
    borderRadius: rs(6),
    backgroundColor: '#FFF',
  },
  qDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: rs(10),
    marginVertical: rs(2),
  },
  reportPopup: {
    position: 'absolute',
    bottom: rs(54),
    right: rs(14),
    width: rs(180),
    backgroundColor: 'rgba(15,15,15,0.95)',
    borderRadius: rs(22),
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: rs(4),
    zIndex: 150,
  },
  reportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: rs(8),
    gap: rs(10),
  },
  reportBtn: {
    width: rs(28),
    height: rs(28),
    borderRadius: rs(8),
    backgroundColor: 'rgba(255, 74, 66, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pSmallAvatar: {
    width: rs(28),
    height: rs(28),
    borderRadius: rs(14),
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  pStatus: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: rs(8),
    height: rs(8),
    borderRadius: rs(4),
    borderWidth: 1,
    borderColor: '#000',
  },
});
