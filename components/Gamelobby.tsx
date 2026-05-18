import { socket } from '@/lib/socket';
import { supabase } from '@/lib/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  DeviceEventEmitter,
  Dimensions,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { DodgeKeyboard } from 'react-native-dodge-keyboard';
import { GameplayScreen } from './GameplayScreen';
import { getBotName } from '@/lib/botNames';
import { startProgressLoop, stopProgressLoop, playPlayerFoundSound } from '@/lib/sounds';
import { useGamblingEnabled } from '@/lib/GamblingContext';
import { preloadGameAssets, AssetPreloader } from '@/lib/preloader';
import Dice3D from './Dice3D';


// ─── Design Tokens ────────────────────────────────────────────────────────────

const C = {
  gold: '#D4AF37',
  goldLight: '#E7C75A',
  goldSoft: 'rgba(212,175,55,0.13)',
  goldMid: 'rgba(212,175,55,0.22)',
  goldBorder: 'rgba(212,175,55,0.30)',
  goldStrong: 'rgba(212,175,55,0.45)',
  surface: 'rgba(7, 21, 15, 0.90)',
  surfaceStrong: 'rgba(5, 16, 11, 0.95)',
  surfaceHover: 'rgba(255,255,255,0.03)',
  glass: 'rgba(255,255,255,0.04)',
  textPrimary: '#F5EFD8',
  textMuted: 'rgba(245,239,216,0.58)',
  textFaint: 'rgba(245,239,216,0.32)',
  success: '#57D08B',
  successSoft: 'rgba(87,208,139,0.13)',
  successBorder: 'rgba(87,208,139,0.28)',
  danger: '#F26B6B',
  dangerSoft: 'rgba(242,107,107,0.13)',
  dangerBorder: 'rgba(242,107,107,0.28)',
  warn: '#F0A832',
  warnSoft: 'rgba(240,168,50,0.13)',
  warnBorder: 'rgba(240,168,50,0.28)',
  bg: '#040d07',
  divider: 'rgba(255,255,255,0.055)',
};

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// ─── Responsive helpers ───────────────────────────────────────────────────────

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// More aggressive scaling for premium feel on all devices
const baseWidth = 840; // Reference width (S21 size)
const SF = Math.min(Math.max(SCREEN_W / baseWidth, 0.85), 1.25);

function s(value: number) {
  return Math.round(value * SF);
}

// Left column width: stay proportional but with better bounds
const LEFT_COL_W = Math.max(s(280), SCREEN_W * 0.34);

// ─── Types ────────────────────────────────────────────────────────────────────

type GameMode = 'ludo' | 'whot' | 'ludo_t' | 'whot_t' | 'snake_ladder';
type PlayerCount = 2 | 4;

interface GameConfig {
  mode: GameMode;
  title: string;
  subtitle: string;
  accentColor: string;
  accentSoft: string;
  accentBorder: string;
  image: ReturnType<typeof require>;
  isTournament: boolean;
  maxPlayers: 2 | 4;
  icon: IconName;
  description: string;
}

interface StakeOption {
  label: string;
  amount: number;
  tag?: string;
  tagColor?: string;
  tagBg?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const GAME_CONFIGS: Record<GameMode, GameConfig> = {
  snake_ladder: {
    mode: 'snake_ladder',
    title: 'Snake & Ladder',
    subtitle: 'Climb high, watch the snakes!',
    accentColor: '#39C65B',
    accentSoft: 'rgba(57, 198, 91, 0.13)',
    accentBorder: 'rgba(57, 198, 91, 0.30)',
    image: require('@/assets/images/snake.png'),
    isTournament: false,
    maxPlayers: 4,
    icon: 'stairs',
    description: 'Roll the dice and climb the ladders. Watch out for the snakes that will bring you down!',
  },
  ludo: {
    mode: 'ludo',
    title: 'Ludo Fusion',
    subtitle: 'Classic multiplayer board game',
    accentColor: C.gold,
    accentSoft: C.goldSoft,
    accentBorder: C.goldBorder,
    image: require('@/assets/images/ludo.png'),
    isTournament: false,
    maxPlayers: 4,
    icon: 'dice-5',
    description: 'Race your pieces to the finish. First player to get all pieces home wins the pot.',
  },
  whot: {
    mode: 'whot',
    title: 'Whot Clash',
    subtitle: 'Nigerian card battle game',
    accentColor: '#E05555',
    accentSoft: 'rgba(224,85,85,0.13)',
    accentBorder: 'rgba(224,85,85,0.30)',
    image: require('@/assets/images/whot.png'),
    isTournament: false,
    maxPlayers: 4,
    icon: 'cards-playing-outline',
    description: 'Match cards by number or suit. Use special cards to outsmart your opponents.',
  },
  ludo_t: {
    mode: 'ludo_t',
    title: 'Ludo Tournament',
    subtitle: 'Compete. Win big.',
    accentColor: '#5A7FF0',
    accentSoft: 'rgba(90,127,240,0.13)',
    accentBorder: 'rgba(90,127,240,0.30)',
    image: require('@/assets/images/card2.png'),
    isTournament: true,
    maxPlayers: 4,
    icon: 'trophy',
    description: 'Multi-round bracket tournament. Survive each round to claim the prize pool.',
  },
  whot_t: {
    mode: 'whot_t',
    title: 'Whot Tournament',
    subtitle: 'Compete. Win big.',
    accentColor: '#A855D8',
    accentSoft: 'rgba(168,85,216,0.13)',
    accentBorder: 'rgba(168,85,216,0.30)',
    image: require('@/assets/images/card3.png'),
    isTournament: true,
    maxPlayers: 4,
    icon: 'trophy',
    description: 'Multi-round Whot elimination. Outlast the field to take home the pot.',
  },
};

const STAKE_OPTIONS: StakeOption[] = [
  { label: '100', amount: 100 },
  { label: '200', amount: 200, tag: 'Popular', tagColor: C.success, tagBg: C.successSoft },
  { label: '500', amount: 500, tag: 'Hot', tagColor: C.warn, tagBg: C.warnSoft },
  { label: '1,000', amount: 1000 },
  { label: '2,500', amount: 2500, tag: 'High Roll', tagColor: C.gold, tagBg: C.goldSoft },
  { label: '5,000', amount: 5000 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useFadeSlide(delay = 0, fromY = 16) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(fromY)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 480, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, damping: 16, stiffness: 130, useNativeDriver: true }),
    ]).start();
  }, []);
  return { opacity, transform: [{ translateY }] };
}

function useFadeSlideX(delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-18)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.spring(translateX, { toValue: 0, delay, damping: 16, stiffness: 130, useNativeDriver: true }),
    ]).start();
  }, []);
  return { opacity, transform: [{ translateX }] };
}

function PulseDot({ color = C.gold }: { color?: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.4, duration: 900, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[sl.pulseDot, { backgroundColor: color, transform: [{ scale }] }]} />;
}

// ─── Hero Banner ──────────────────────────────────────────────────────────────
const HeroBanner = React.memo(({ config, onBack }: { config: GameConfig; onBack: () => void }) => {
  const anim = useFadeSlide(0, -10);
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const shimmerOpacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.06] });

  return (
    <Animated.View style={[sl.heroBanner, { borderColor: config.accentBorder }, anim]}>
      <ImageBackground
        source={config.image}
        style={sl.heroImage}
        imageStyle={sl.heroImageStyle}
      >
        <LinearGradient
          colors={['rgba(4,13,7,0.18)', 'rgba(4,13,7,0.72)', 'rgba(4,13,7,0.96)']}
          style={sl.heroGrad}
        >
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: '#fff', opacity: shimmerOpacity }]}
          />

          <TouchableOpacity
            onPress={onBack}
            style={sl.backBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="arrow-left" size={s(13)} color={C.textPrimary} />
            <Text style={sl.backText}>Back</Text>
          </TouchableOpacity>

          <View style={sl.heroBody}>
            <View style={[sl.gameIconWrap, { backgroundColor: config.accentSoft, borderColor: config.accentBorder }]}>
              <MaterialCommunityIcons name={config.icon} size={s(16)} color={config.accentColor} />
            </View>
            <View style={sl.heroText}>
              {config.isTournament && (
                <View style={sl.tourneyBadge}>
                  <MaterialCommunityIcons name="trophy" size={s(8)} color={C.gold} />
                  <Text style={sl.tourneyBadgeText}>TOURNAMENT</Text>
                </View>
              )}
              <Text style={sl.heroTitle}>{config.title}</Text>
              <Text style={sl.heroSub} numberOfLines={2}>{config.description}</Text>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </Animated.View>
  );
});

function PlayerCountOptionCard({
  opt,
  i,
  selected,
  onChange,
  accentColor,
  accentSoft,
  accentBorder,
}: {
  opt: any;
  i: number;
  selected: PlayerCount;
  onChange: (v: PlayerCount) => void;
  accentColor: string;
  accentSoft: string;
  accentBorder: string;
}) {
  const active = selected === opt.count;
  const anim = useFadeSlideX(180 + i * 80);
  return (
    <Animated.View style={[{ flex: 1 }, anim]}>
      <Pressable
        onPress={() => onChange(opt.count)}
        style={[
          sl.countCard,
          active && { borderColor: accentBorder, backgroundColor: accentSoft },
        ]}
      >
        <View style={[sl.countIconWrap, active && { backgroundColor: accentSoft, borderColor: accentBorder }]}>
          <MaterialCommunityIcons
            name={opt.icon}
            size={s(16)}
            color={active ? accentColor : C.textMuted}
          />
        </View>
        <View style={sl.countText}>
          <Text style={[sl.countLabel, active && { color: accentColor }]}>{opt.label}</Text>
          <Text style={sl.countSub}>{opt.sub}</Text>
        </View>
        {active && (
          <View style={[sl.countCheck, { backgroundColor: accentSoft, borderColor: accentBorder }]}>
            <MaterialCommunityIcons name="check" size={s(10)} color={accentColor} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

function PlayerCountSelector({
  selected,
  onChange,
  accentColor,
  accentSoft,
  accentBorder,
}: {
  selected: PlayerCount;
  onChange: (v: PlayerCount) => void;
  accentColor: string;
  accentSoft: string;
  accentBorder: string;
}) {
  const options: { count: PlayerCount; label: string; sub: string; icon: IconName }[] = [
    { count: 2, label: '1 v 1', sub: 'Head to head', icon: 'sword-cross' },
    { count: 4, label: '4 Players', sub: 'Full board', icon: 'account-group' },
  ];

  return (
    <View style={sl.countRow}>
      {options.map((opt, i) => (
        <PlayerCountOptionCard
          key={opt.count}
          opt={opt}
          i={i}
          selected={selected}
          onChange={onChange}
          accentColor={accentColor}
          accentSoft={accentSoft}
          accentBorder={accentBorder}
        />
      ))}
    </View>
  );
}

function StakeOptionCard({
  opt,
  i,
  selected,
  onChange,
  accentColor,
  accentSoft,
  accentBorder,
  playerCount,
}: {
  opt: StakeOption;
  i: number;
  selected: number;
  onChange: (v: number) => void;
  accentColor: string;
  accentSoft: string;
  accentBorder: string;
  playerCount: number;
}) {
  const active = selected === opt.amount;
  const gamblingEnabled = useGamblingEnabled();
  const prefix = gamblingEnabled ? '₦' : '';
  const anim = useFadeSlide(300 + i * 40);
  return (
    <Animated.View style={anim}>
      <Pressable
        onPress={() => onChange(opt.amount)}
        style={[
          sl.stakeCard,
          active && { borderColor: accentBorder, backgroundColor: accentSoft },
        ]}
      >
        {opt.tag && (
          <View style={[sl.stakeTag, { backgroundColor: opt.tagBg, borderColor: opt.tagColor + '44' }]}>
            <Text style={[sl.stakeTagText, { color: opt.tagColor }]}>{opt.tag}</Text>
          </View>
        )}
        <Text style={[sl.stakeAmount, active && { color: accentColor }]}>{prefix}{opt.label}</Text>
        <Text style={sl.stakeWin}>{gamblingEnabled ? `Win ₦${(opt.amount * playerCount * 0.9).toLocaleString('en-NG', { maximumFractionDigits: 0 })}` : `${Math.floor(opt.amount * playerCount * 0.9).toLocaleString()} coins`}</Text>
      </Pressable>
    </Animated.View>
  );
}

function StakeSelector({
  selected,
  onChange,
  accentColor,
  accentSoft,
  accentBorder,
  playerCount,
}: {
  selected: number;
  onChange: (v: number) => void;
  accentColor: string;
  accentSoft: string;
  accentBorder: string;
  playerCount: PlayerCount;
}) {
  const totalPot = selected * playerCount;
  const mainAnim = useFadeSlide(220);
  const gamblingEnabled = useGamblingEnabled();

  return (
    <Animated.View style={[sl.stakeSection, mainAnim]}>
      <View style={sl.stakeHeader}>
        <View>
          <Text style={sl.stakeTitle}>Stake Amount</Text>
          <Text style={sl.stakeSub}>Each player pays to join</Text>
        </View>
        <View style={sl.potPill}>
          <MaterialCommunityIcons name="cash-multiple" size={s(11)} color={C.gold} />
          <Text style={sl.potLabel}>Pot:</Text>
          <Text style={sl.potValue}>{gamblingEnabled ? `₦${totalPot.toLocaleString('en-NG')}` : `${totalPot.toLocaleString()} coins`}</Text>
        </View>
      </View>

      <View style={sl.stakeGrid}>
        {STAKE_OPTIONS.map((opt, i) => (
          <StakeOptionCard
            key={opt.amount}
            opt={opt}
            i={i}
            selected={selected}
            onChange={onChange}
            accentColor={accentColor}
            accentSoft={accentSoft}
            accentBorder={accentBorder}
            playerCount={playerCount}
          />
        ))}
      </View>

      <View style={sl.feeNote}>
        <MaterialCommunityIcons name="information-outline" size={s(10)} color={C.textFaint} />
        <Text style={sl.feeNoteText}>10% platform fee deducted from winnings</Text>
      </View>
    </Animated.View>
  );
}

// ─── Player Slots ─────────────────────────────────────────────────────────────

type SlotStatus = 'you' | 'waiting' | 'ready' | 'bot';

interface PlayerSlot {
  id: number;
  status: SlotStatus;
  name?: string;
  initials?: string;
  rank?: string;
  winRate?: string;
}

function buildSlots(
  count: PlayerCount,
  readyCount: number,
  realPlayers?: any[],
  searchingPlayers?: any[],
  currentUser?: any,
  isAiEnabled?: boolean
): PlayerSlot[] {
  // Use centralized bot names for consistency
  const getInitials = (n: string) => n.substring(0, 2).toUpperCase();

  // REAL MULTIPLAYER (has room)
  if (realPlayers && realPlayers.length > 0) {
    // Sort players so "You" is always first in the UI
    const sortedPlayers = [...realPlayers].sort((a, b) => {
      if (currentUser && a.id === currentUser.id) return -1;
      if (currentUser && b.id === currentUser.id) return 1;
      return 0;
    });

    const slots: PlayerSlot[] = sortedPlayers.map((p, i) => {
      const isMe = currentUser && p.id === currentUser.id;
      const myRank = currentUser?.global_rank ? `#${currentUser.global_rank}` : `#${Math.floor(Math.random() * 50) + 20}`;
      const myWinRate = currentUser?.games_played ? `${Math.round(((currentUser.wins || 0) / currentUser.games_played) * 100)}%` : '55%';

      const name = p.username || 'Player';
      return {
        id: i + 1,
        status: isMe ? 'you' : (p.ready ? 'ready' : 'ready'),
        name: name,
        initials: getInitials(name),
        color: p.color,
        rank: isMe ? myRank : `#${Math.floor(Math.random() * 100) + 10}`,
        winRate: isMe ? myWinRate : `${50 + Math.floor(Math.random() * 40)}%`
      };
    });

    // Pad with searching players if available
    let searchIdx = 0;
    while (slots.length < count) {
      const sp = searchingPlayers && searchIdx < searchingPlayers.length ? searchingPlayers[searchIdx] : null;
      const name = sp ? sp.username : undefined;
      slots.push({
        id: slots.length + 1,
        status: 'waiting',
        name: name,
        initials: name ? getInitials(name) : undefined,
      });
      searchIdx++;
    }
    return slots;
  }

  // REAL MULTIPLAYER (searching, room not yet assigned)
  if (!isAiEnabled) {
    const myName = currentUser?.username || 'You';
    const slots: PlayerSlot[] = [
      {
        id: 1,
        status: 'you',
        name: myName,
        initials: getInitials(myName),
        rank: currentUser?.global_rank ? `#${currentUser.global_rank}` : '#--',
        winRate: currentUser?.games_played ? `${Math.round(((currentUser.wins || 0) / currentUser.games_played) * 100)}%` : '0%'
      }
    ];
    let searchIdx = 0;
    while (slots.length < count) {
      const sp = searchingPlayers && searchIdx < searchingPlayers.length ? searchingPlayers[searchIdx] : null;
      const name = sp ? sp.username : undefined;
      const spWinRate = sp?.games_played ? `${Math.round(((sp.wins || 0) / sp.games_played) * 100)}%` : '0%';
      const spRank = sp?.global_rank ? `#${sp.global_rank}` : `#${Math.floor(Math.random() * 50) + 10}`;

      slots.push({
        id: slots.length + 1,
        status: 'waiting',
        name: name,
        initials: name ? getInitials(name) : undefined,
        rank: name ? spRank : undefined,
        winRate: name ? spWinRate : undefined,
      });
      searchIdx++;
    }
    return slots;
  }

  // AI SIMULATION FALLBACK (Practice Mode)
  // We'll use getBotName with 'green' as the assumed local color for practice mode
  const lCol = 'green';
  const NAMES = ['You', getBotName('yellow', lCol), getBotName('red', lCol), getBotName('blue', lCol)];
  
  const myRank = currentUser?.global_rank ? `#${currentUser.global_rank}` : '#--';
  const myWinRate = currentUser?.games_played ? `${Math.round(((currentUser.wins || 0) / currentUser.games_played) * 100)}%` : '0%';

  const base: PlayerSlot[] = [
    { id: 1, status: 'you', name: NAMES[0], initials: getInitials(currentUser?.username || 'You'), rank: myRank, winRate: myWinRate },
    {
      id: 2,
      status: readyCount >= 2 ? 'ready' : 'waiting',
      name: readyCount >= 2 ? NAMES[1] : undefined,
      initials: readyCount >= 2 ? getInitials(NAMES[1]) : undefined,
      rank: readyCount >= 2 ? '#42' : undefined,
      winRate: readyCount >= 2 ? '68%' : undefined,
    },
    {
      id: 3,
      status: count === 4 ? (readyCount >= 3 ? 'ready' : 'waiting') : 'waiting',
      name: count === 4 && readyCount >= 3 ? NAMES[2] : undefined,
      initials: count === 4 && readyCount >= 3 ? getInitials(NAMES[2]) : undefined,
      rank: count === 4 && readyCount >= 3 ? '#15' : undefined,
      winRate: count === 4 && readyCount >= 3 ? '82%' : undefined,
    },
    {
      id: 4,
      status: count === 4 ? (readyCount >= 4 ? 'ready' : 'waiting') : 'waiting',
      name: count === 4 && readyCount >= 4 ? NAMES[3] : undefined,
      initials: count === 4 && readyCount >= 4 ? getInitials(NAMES[3]) : undefined,
      rank: count === 4 && readyCount >= 4 ? '#89' : undefined,
      winRate: count === 4 && readyCount >= 4 ? '54%' : undefined,
    },
  ];
  return count === 2 ? base.slice(0, 2) : base;
}

function PlayerSlotCard({
  slot,
  delay,
  accentColor,
  accentSoft,
  accentBorder,
}: {
  slot: PlayerSlot;
  delay: number;
  accentColor: string;
  accentSoft: string;
  accentBorder: string;
}) {
  const anim = useFadeSlide(delay);

  const isYou = slot.status === 'you';
  const isWaiting = slot.status === 'waiting';
  const isBot = slot.status === 'bot';
  const isReady = slot.status === 'ready';

  const waitOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isWaiting) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(waitOpacity, { toValue: 0.35, duration: 950, useNativeDriver: true }),
        Animated.timing(waitOpacity, { toValue: 1, duration: 950, useNativeDriver: true }),
      ])
    ).start();
  }, [isWaiting]);

  return (
    <Animated.View style={[sl.slotCard, isYou && { borderColor: accentBorder, backgroundColor: accentSoft }, anim]}>
      {isYou || isReady ? (
        <>
          <View style={sl.slotAvatarWrap}>
            <LinearGradient
              colors={isYou ? ['#1E5A39', '#0A2318'] : ['#163D27', '#071510']}
              style={[sl.slotAvatar, isYou && { borderColor: accentColor, borderWidth: 1.5 }]}
            >
              <Text style={sl.slotAvatarText}>{slot.initials ?? '??'}</Text>
            </LinearGradient>
            {isYou && (
              <View style={[sl.youBadge, { backgroundColor: accentSoft, borderColor: accentBorder }]}>
                <Text style={[sl.youBadgeText, { color: accentColor }]}>YOU</Text>
              </View>
            )}
          </View>
          <Text style={[sl.slotName, isYou && { color: C.textPrimary }]} numberOfLines={1}>
            {slot.name}
          </Text>
          <View style={sl.slotMeta}>
            {slot.rank && (
              <View style={sl.slotMetaPill}>
                <MaterialCommunityIcons name="podium" size={s(8)} color={C.gold} />
                <Text style={sl.slotMetaText}>{slot.rank}</Text>
              </View>
            )}
            {slot.winRate && (
              <View style={[sl.slotMetaPill, { backgroundColor: C.successSoft, borderColor: C.successBorder }]}>
                <MaterialCommunityIcons name="trophy-outline" size={s(8)} color={C.success} />
                <Text style={[sl.slotMetaText, { color: C.success }]}>{slot.winRate}</Text>
              </View>
            )}
          </View>
        </>
      ) : isWaiting ? (
        <Animated.View style={[sl.waitingSlot, { opacity: waitOpacity }]}>
          {slot.name ? (
            <>
              <View style={sl.slotAvatarWrap}>
                <View style={[sl.slotAvatar, { borderColor: accentBorder, backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                  <Text style={sl.slotAvatarText}>{slot.initials ?? '??'}</Text>
                </View>
              </View>
              <Text style={sl.slotName} numberOfLines={1}>{slot.name}</Text>
              <View style={sl.slotMeta}>
                {slot.rank && (
                  <View style={sl.slotMetaPill}>
                    <MaterialCommunityIcons name="podium" size={s(8)} color={C.gold} />
                    <Text style={sl.slotMetaText}>{slot.rank}</Text>
                  </View>
                )}
                {slot.winRate && (
                  <View style={[sl.slotMetaPill, { backgroundColor: C.successSoft, borderColor: C.successBorder }]}>
                    <MaterialCommunityIcons name="trophy-outline" size={s(8)} color={C.success} />
                    <Text style={[sl.slotMetaText, { color: C.success }]}>{slot.winRate}</Text>
                  </View>
                )}
              </View>
              <Text style={[sl.waitingSub, { color: accentColor, marginTop: s(2) }]}>Searching...</Text>
            </>
          ) : (
            <>
              <View style={sl.waitingDots}>
                <View style={[sl.waitDot, { backgroundColor: accentColor }]} />
                <View style={[sl.waitDot, { backgroundColor: accentColor, opacity: 0.6 }]} />
                <View style={[sl.waitDot, { backgroundColor: accentColor, opacity: 0.3 }]} />
              </View>
              <Text style={[sl.waitingText, { color: accentColor }]}>Waiting...</Text>
              <Text style={sl.waitingSub}>Searching</Text>
            </>
          )}
        </Animated.View>
      ) : (
        <View style={sl.botSlot}>
          <View style={sl.botIcon}>
            <MaterialCommunityIcons name="lock-outline" size={s(14)} color={C.textFaint} />
          </View>
          <Text style={sl.botText}>Locked</Text>
        </View>
      )}
    </Animated.View>
  );
}

function PlayerSlots({
  playerCount,
  readyCount,
  accentColor,
  accentSoft,
  accentBorder,
  roomId,
  gameMode,
  stake,
  currentUser,
  isAiEnabled,
  serverSearchingPlayers,
}: {
  playerCount: PlayerCount;
  readyCount: number;
  accentColor: string;
  accentSoft: string;
  accentBorder: string;
  roomId?: string | null;
  gameMode?: string;
  stake?: number;
  currentUser?: any;
  isAiEnabled?: boolean;
  serverSearchingPlayers?: any[];
}) {
  const [realPlayers, setRealPlayers] = useState<any[]>([]);
  const searchingPlayers = serverSearchingPlayers || [];
  const prevPlayersCount = useRef(0);
  const prevSearchersCount = useRef(0);

  useEffect(() => {
    if (realPlayers.length > prevPlayersCount.current && realPlayers.length > 1) {
      playPlayerFoundSound();
    }
    prevPlayersCount.current = realPlayers.length;
  }, [realPlayers.length]);

  useEffect(() => {
    if (searchingPlayers.length > prevSearchersCount.current) {
      playPlayerFoundSound();
    }
    prevSearchersCount.current = searchingPlayers.length;
  }, [searchingPlayers.length]);

  useEffect(() => {
    if (!roomId) {
      setRealPlayers([]);
      return;
    }
    const fetchRoom = async () => {
      const { data } = await supabase.from('game_rooms').select('players').eq('id', roomId).single();
      if (data?.players) setRealPlayers(data.players);
    };
    fetchRoom();

    const channel = supabase.channel(`room_slots_${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.new.players) setRealPlayers(payload.new.players);
        })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [roomId]);

  const slots = buildSlots(playerCount, readyCount, realPlayers, searchingPlayers, currentUser, isAiEnabled);
  const anim = useFadeSlide(160);

  return (
    <Animated.View style={[sl.slotsSection, anim]}>
      <View style={sl.slotsSectionHeader}>
        <Text style={sl.slotsSectionTitle}>Players</Text>
        <View style={[sl.slotsReadyPill, readyCount === playerCount && { backgroundColor: C.successSoft, borderColor: C.successBorder }]}>
          <PulseDot color={readyCount === playerCount ? C.success : C.warn} />
          <Text style={[sl.slotsReadyText, readyCount === playerCount && { color: C.success }]}>{readyCount} / {playerCount}</Text>
        </View>
      </View>
      <View style={sl.slotsRow}>
        {slots.map((slot, i) => (
          <PlayerSlotCard
            key={slot.id}
            slot={slot}
            delay={300 + i * 80}
            accentColor={accentColor}
            accentSoft={accentSoft}
            accentBorder={accentBorder}
          />
        ))}
      </View>
    </Animated.View>
  );
}

// ─── Room Options ─────────────────────────────────────────────────────────────

const RoomOptions = React.memo(({
  isPrivate,
  onToggle,
  isAiEnabled,
  onToggleAi,
  accentColor,
  accentSoft,
  accentBorder,
  roomCode,
  onJoinPrivateRoom,
}: {
  isPrivate: boolean;
  onToggle: () => void;
  isAiEnabled: boolean;
  onToggleAi: () => void;
  accentColor: string;
  accentSoft: string;
  accentBorder: string;
  roomCode?: string;
  onJoinPrivateRoom?: (code: string) => void;
}) => {
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const anim = useFadeSlide(260);
  const knob = useRef(new Animated.Value(isPrivate ? 1 : 0)).current;
  const aiKnob = useRef(new Animated.Value(isAiEnabled ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(knob, { toValue: isPrivate ? 1 : 0, damping: 14, stiffness: 160, useNativeDriver: true }).start();
  }, [isPrivate]);

  useEffect(() => {
    Animated.spring(aiKnob, { toValue: isAiEnabled ? 1 : 0, damping: 14, stiffness: 160, useNativeDriver: true }).start();
  }, [isAiEnabled]);

  // Close join panel when private mode is toggled off
  useEffect(() => {
    if (!isPrivate) setShowJoinInput(false);
  }, [isPrivate]);

  const knobX = knob.interpolate({ inputRange: [0, 1], outputRange: [2, 17] });
  const aiKnobX = aiKnob.interpolate({ inputRange: [0, 1], outputRange: [2, 17] });

  const handleJoin = () => {
    const trimmed = joinCode.trim().toUpperCase();
    if (!trimmed) {
      Alert.alert('Enter Code', 'Please enter a room code to join.');
      return;
    }
    onJoinPrivateRoom?.(trimmed);
    setJoinCode('');
    setShowJoinInput(false);
  };

  return (
    <Animated.View style={[sl.roomOptions, anim]}>
      {/* ── Private Room Toggle ── */}
      <Pressable onPress={onToggle} style={sl.roomToggleRow}>
        <View style={sl.roomToggleInfo}>
          <MaterialCommunityIcons
            name={isPrivate ? 'lock' : 'earth'}
            size={s(13)}
            color={isPrivate ? accentColor : C.textMuted}
          />
          <View>
            <Text style={[sl.roomToggleLabel, isPrivate && { color: accentColor }]}>
              {isPrivate ? 'Private Room' : 'Public Room'}
            </Text>
            <Text style={sl.roomToggleSub}>
              {isPrivate ? 'Invite with a code' : 'Open to all players'}
            </Text>
          </View>
        </View>
        <View style={[
          sl.toggle,
          isPrivate && { backgroundColor: accentSoft, borderColor: accentBorder },
        ]}>
          <Animated.View style={[sl.toggleKnob, { transform: [{ translateX: knobX }], backgroundColor: isPrivate ? accentColor : C.textFaint }]} />
        </View>
      </Pressable>

      {/* ── Room Code (shown immediately below toggle when private is ON) ── */}
      {isPrivate && roomCode ? (
        <View style={{ marginTop: s(8) }}>
          <RoomCodeRow code={roomCode} accentColor={accentColor} accentBorder={accentBorder} accentSoft={accentSoft} />
        </View>
      ) : null}

      <View style={{ height: 1, backgroundColor: C.divider, marginVertical: s(10) }} />

      {/* ── Practice with AI Toggle ── */}
      <Pressable onPress={onToggleAi} style={sl.roomToggleRow}>
        <View style={sl.roomToggleInfo}>
          <MaterialCommunityIcons
            name="robot"
            size={s(13)}
            color={isAiEnabled ? accentColor : C.textMuted}
          />
          <View>
            <Text style={[sl.roomToggleLabel, isAiEnabled && { color: accentColor }]}>
              Practice with AI
            </Text>
            <Text style={sl.roomToggleSub}>
              Enable skillful bots
            </Text>
          </View>
        </View>
        <View style={[
          sl.toggle,
          isAiEnabled && { backgroundColor: accentSoft, borderColor: accentBorder },
        ]}>
          <Animated.View style={[sl.toggleKnob, { transform: [{ translateX: aiKnobX }], backgroundColor: isAiEnabled ? accentColor : C.textFaint }]} />
        </View>
      </Pressable>

      {/* ── Join Existing Room ── */}
      <View style={{ marginTop: s(10) }}>
        <Pressable
          onPress={() => setShowJoinInput(!showJoinInput)}
          style={[sl.joinToggleBtn, showJoinInput && { borderColor: accentColor, backgroundColor: accentSoft }]}
        >
          <MaterialCommunityIcons name="login-variant" size={s(12)} color={showJoinInput ? accentColor : C.textMuted} />
          <Text style={[sl.joinToggleBtnText, showJoinInput && { color: accentColor }]}>Join Existing Room</Text>
          <MaterialCommunityIcons name={showJoinInput ? "chevron-up" : "chevron-down"} size={s(12)} color={C.textFaint} />
        </Pressable>

        {showJoinInput && (
          <Animated.View style={[sl.joinInputBox, { borderColor: accentBorder }]}>
            {isPrivate ? (
              /* Private mode: code-only join, goes straight to player section */
              <View>
                <Text style={[sl.joinPrivateHint, { color: accentColor }]}>
                  Enter the private room code shared with you
                </Text>
                <View style={sl.joinInputWrapper}>
                  <TextInput
                    style={sl.joinInput}
                    placeholder="e.g. LDR-4829"
                    placeholderTextColor={C.textFaint}
                    value={joinCode}
                    onChangeText={setJoinCode}
                    autoCapitalize="characters"
                    maxLength={12}
                  />
                  <TouchableOpacity
                    style={[sl.joinActionBtn, { backgroundColor: accentColor }]}
                    onPress={handleJoin}
                    activeOpacity={0.8}
                  >
                    <Text style={sl.joinActionBtnText}>JOIN</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* Public mode: also just a code input (fast path) */
              <View style={sl.joinInputWrapper}>
                <TextInput
                  style={sl.joinInput}
                  placeholder="Enter Code (e.g. LDR-0000)"
                  placeholderTextColor={C.textFaint}
                  value={joinCode}
                  onChangeText={setJoinCode}
                  autoCapitalize="characters"
                  maxLength={12}
                />
                <TouchableOpacity
                  style={[sl.joinActionBtn, { backgroundColor: accentColor }]}
                  onPress={handleJoin}
                  activeOpacity={0.8}
                >
                  <Text style={sl.joinActionBtnText}>JOIN</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
});

function RoomCodeRow({
  code,
  accentColor,
  accentBorder,
  accentSoft,
}: {
  code: string;
  accentColor?: string;
  accentBorder?: string;
  accentSoft?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const anim = useFadeSlide(0, 6);

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(code);
    } catch (_) { }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Animated.View style={[sl.roomCode, { borderColor: accentBorder || C.goldBorder, backgroundColor: accentSoft || C.goldSoft }, anim]}>
      <View style={sl.roomCodeLeft}>
        <MaterialCommunityIcons name="key-variant" size={s(11)} color={accentColor || C.gold} />
        <Text style={sl.roomCodeLabel}>Room Code</Text>
      </View>
      <Text style={[sl.roomCodeValue, { color: accentColor || C.gold, letterSpacing: 2 }]}>{code}</Text>
      <TouchableOpacity onPress={handleCopy} style={sl.roomCodeCopy} activeOpacity={0.7}>
        <MaterialCommunityIcons
          name={copied ? 'check' : 'content-copy'}
          size={s(11)}
          color={copied ? C.success : C.textMuted}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── CTA Footer ───────────────────────────────────────────────────────────────

function CtaFooter({
  stake,
  playerCount,
  config,
  searching,
  gameState,
  onFindMatch,
}: {
  stake: number;
  playerCount: PlayerCount;
  config: GameConfig;
  searching: boolean;
  gameState: 'lobby' | 'starting' | 'playing';
  onFindMatch: () => void;
}) {
  const anim = useFadeSlide(400);
  const pressAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () => Animated.spring(pressAnim, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () => Animated.spring(pressAnim, { toValue: 1, useNativeDriver: true, speed: 20 }).start();

  const pot = stake * playerCount;
  const win = Math.floor(pot * 0.9);

  // Searching spinner dots
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (!searching) return;
    const pulse = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(dot, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    pulse(dot1, 0);
    pulse(dot2, 150);
    pulse(dot3, 300);
  }, [searching]);

  const stakeAnim = useFadeSlide(400);

  // ── Balance ────────────────────────────────────────────────────────────────
  const [balance, setBalance] = useState<number>(0);
  const gamblingEnabled = useGamblingEnabled();
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('wallet_balance').eq('id', user.id).single().then(({ data }) => {
        setBalance((data?.wallet_balance || 0) as number);
      });
    });
  }, []);

  return (
    <Animated.View style={[sl.ctaFooter, searching && { borderColor: C.warnBorder }, anim]}>
      <View style={sl.ctaSummary}>
        <View style={sl.ctaSummaryItem}>
          <Text style={sl.ctaSummaryLabel}>Stake</Text>
          <Text style={sl.ctaSummaryValue}>{gamblingEnabled ? `₦${stake.toLocaleString('en-NG')}` : `${stake.toLocaleString()} coins`}</Text>
        </View>
        <View style={sl.ctaSummaryDiv} />
        <View style={sl.ctaSummaryItem}>
          <Text style={sl.ctaSummaryLabel}>Pot</Text>
          <Text style={sl.ctaSummaryValue}>{gamblingEnabled ? `₦${pot.toLocaleString('en-NG')}` : `${pot.toLocaleString()} coins`}</Text>
        </View>
        <View style={sl.ctaSummaryDiv} />
        <View style={sl.ctaSummaryItem}>
          <Text style={sl.ctaSummaryLabel}>Win</Text>
          <Text style={[sl.ctaSummaryValue, { color: C.success }]}>{gamblingEnabled ? `₦${win.toLocaleString('en-NG')}` : `${win.toLocaleString()} coins`}</Text>
        </View>
        <View style={sl.ctaSummaryDiv} />
        <View style={sl.ctaSummaryItem}>
          <Text style={sl.ctaSummaryLabel}>Balance</Text>
          <Text style={sl.ctaSummaryValue}>{gamblingEnabled ? `₦${balance.toLocaleString('en-NG')}` : `${balance.toLocaleString()} coins`}</Text>
        </View>
      </View>

      <Animated.View style={{ transform: [{ scale: pressAnim }] }}>
        <Pressable
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onPress={onFindMatch}
          style={[sl.findBtn, gameState === 'starting' && { opacity: 0.6 }]}
          disabled={gameState === 'starting'}
        >
          <LinearGradient
            colors={searching
              ? ['rgba(60,20,20,0.9)', 'rgba(30,8,8,0.95)']
              : ['rgba(30,90,57,0.9)', 'rgba(10,35,24,0.95)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={sl.findBtnGrad}
          >
            <View style={[sl.findBtnInner, { borderColor: searching ? C.dangerBorder : config.accentBorder }]}>
              {searching ? (
                <>
                  {/* Animated dots while searching */}
                  <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                    {[dot1, dot2, dot3].map((d, i) => (
                      <Animated.View key={i} style={{ width: s(5), height: s(5), borderRadius: s(3), backgroundColor: C.warn, opacity: d }} />
                    ))}
                  </View>
                  <Text style={[sl.findBtnText, { color: C.warn }]}>{gameState === 'starting' ? 'Preparing...' : 'Searching...'}</Text>
                  {gameState !== 'starting' && (
                    <View style={[sl.findBtnArrow, { backgroundColor: C.dangerSoft, borderColor: C.dangerBorder }]}>
                      <MaterialCommunityIcons name="close" size={s(12)} color={C.danger} />
                    </View>
                  )}
                </>
              ) : (
                <>
                  <MaterialCommunityIcons name="magnify" size={s(15)} color={config.accentColor} />
                  <Text style={[sl.findBtnText, { color: config.accentColor }]}>Find Match</Text>
                  <View style={[sl.findBtnArrow, { backgroundColor: config.accentSoft, borderColor: config.accentBorder }]}>
                    <MaterialCommunityIcons name="arrow-right" size={s(12)} color={config.accentColor} />
                  </View>
                </>
              )}
            </View>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Recent Activity ──────────────────────────────────────────────────────────

const RECENT_RESULTS = [
  { name: 'AbujaBoss vs KingObi', amount: '900', winner: 'AbujaBoss', time: '3m ago' },
  { name: 'FujiQueen vs DiceSlayer', amount: '450', winner: 'FujiQueen', time: '11m ago' },
  { name: 'CardEze vs LagosKing', amount: '1,800', winner: 'CardEze', time: '18m ago' },
  { name: '4-player Ludo', amount: '3,600', winner: 'ZikoRoyal', time: '25m ago' },
];

const RecentActivity = React.memo(({ accentColor, accentSoft, accentBorder }: { accentColor: string; accentSoft: string; accentBorder: string }) => {
  const anim = useFadeSlide(180);
  return (
    <Animated.View style={[sl.section, anim]}>
      <View style={sl.sectionHeader}>
        <Text style={sl.sectionTitle}>Recent Matches</Text>
        <View style={sl.livePill}>
          <PulseDot color={C.success} />
          <Text style={sl.livePillText}>Live</Text>
        </View>
      </View>
      {RECENT_RESULTS.map((r, i) => (
        <RecentActivityRow key={i} r={r} i={i} accentColor={accentColor} accentSoft={accentSoft} accentBorder={accentBorder} />
      ))}
    </Animated.View>
  );
});

function RecentActivityRow({ r, i, accentColor, accentSoft, accentBorder }: any) {
  const anim = useFadeSlideX(300 + i * 70);
  return (
    <Animated.View style={[sl.recentRow, i < RECENT_RESULTS.length - 1 && sl.recentDivider, anim]}>
      <View style={[sl.recentDot, { backgroundColor: accentSoft, borderColor: accentBorder }]}>
        <MaterialCommunityIcons name="dice-5" size={s(10)} color={accentColor} />
      </View>
      <View style={sl.recentInfo}>
        <Text style={sl.recentMatch}>{r.name}</Text>
        <Text style={sl.recentWinner}>🏆 {r.winner} · {r.time}</Text>
      </View>
      <Text style={[sl.recentAmount, { color: accentColor }]}>{r.amount}</Text>
    </Animated.View>
  );
}

// ─── Game Rules ───────────────────────────────────────────────────────────────

const GameRules = React.memo(({ config }: { config: GameConfig }) => {
  const anim = useFadeSlide(240);
  const rules =
    config.mode === 'ludo' || config.mode === 'ludo_t'
      ? [
        'Each player rolls dice and moves pieces around the board.',
        'Knock opponents off the board to send them back to start.',
        'First player to get all 4 pieces home wins the pot.',
        'Games are timed — longest progress wins if time runs out.',
      ]
      : [
        'Match cards by number or suit to clear your hand.',
        'Special cards — Hold On, Pick Two, Change Direction — change the game.',
        'First player to play all cards wins the pot.',
        'Market card forces you to draw until you get a match.',
      ];

  return (
    <Animated.View style={[sl.section, anim]}>
      <View style={sl.sectionHeader}>
        <Text style={sl.sectionTitle}>How to Win</Text>
        <MaterialCommunityIcons name="book-open-variant" size={s(12)} color={C.textMuted} />
      </View>
      {rules.map((rule, i) => (
        <GameRuleRow key={i} rule={rule} i={i} />
      ))}
    </Animated.View>
  );
});

function GameRuleRow({ rule, i }: any) {
  const anim = useFadeSlideX(360 + i * 60);
  return (
    <Animated.View style={[sl.ruleRow, anim]}>
      <View style={sl.ruleNum}>
        <Text style={sl.ruleNumText}>{i + 1}</Text>
      </View>
      <Text style={sl.ruleText}>{rule}</Text>
    </Animated.View>
  );
}
// ─── Main Screen ──────────────────────────────────────────────────────────────

interface GameLobbyScreenProps {
  gameMode: 'ludo' | 'whot' | 'ludo_t';
  onBack: () => void;
  searching: boolean;
  onSearchingChange: (s: boolean, params?: any) => void;
}

export function GameLobbyScreen({
  gameMode,
  onBack,
  searching: globalSearching,
  onSearchingChange
}: GameLobbyScreenProps) {
  const config = GAME_CONFIGS[gameMode];

  const [playerCount, setPlayerCount] = useState<PlayerCount>(2);
  const [stake, setStake] = useState(200);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isAiEnabled, setIsAiEnabled] = useState(true);
  const searching = globalSearching;
  const setSearching = (s: boolean) => onSearchingChange(s, { stake, playerCount });
  const [readyCount, setReadyCount] = useState(1);
  const [gameState, setGameState] = useState<'lobby' | 'starting' | 'playing'>('lobby');
  const [countdown, setCountdown] = useState(5);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [searchingPlayers, setSearchingPlayers] = useState<any[]>([]);
  const gamblingEnabled = useGamblingEnabled();

  // Generate a stable private room code for this session
  const [privateRoomCode] = useState<string>(() => {
    const prefix = gameMode.startsWith('whot') ? 'WHT' : 'LDR';
    const num = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${num}`;
  });

  useEffect(() => {
    // ── Preload background assets for faster game start ──
    preloadGameAssets();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        // Fetch profile with stats
        supabase.from('profiles').select(`
          *,
          profile_stats(total_matches, total_wins, win_rate)
        `).eq('id', user.id).maybeSingle().then(async ({ data: profile, error }) => {
          if (error) {
            console.error('Lobby profile fetch error:', error);
          }

          if (profile) {
            // Flatten stats safely
            const stats = (profile as any).profile_stats;
            const flattened = {
              ...profile,
              games_played: stats?.total_matches || 0,
              wins: stats?.total_wins || 0,
              win_rate: stats?.win_rate || 0
            };

            // Also fetch global rank
            supabase
              .from('profiles')
              .select('id', { count: 'exact', head: true })
              .gt('xp', profile.xp || 0)
              .then(({ count: rankCount }) => {
                setCurrentUser({
                  id: user.id,
                  ...flattened,
                  global_rank: (rankCount || 0) + 1
                });
              });
          } else {
            // If no profile record exists yet, create one or use auth data
            console.log('No profile record found, using auth fallback');
            setCurrentUser({
              id: user.id,
              username: user.email?.split('@')[0] || 'Player',
              wallet_balance: 0,
              level: 1,
              xp: 0
            });
          }
        });
      }
    });
  }, []);

  // ── Matchmaking Logic ──────────────────────────────────────────────────────
  // ── Node.js Matchmaking ──
  useEffect(() => {
    socket.on('match_found', (data) => {
      console.log('Server match found:', data);
      setRoomId(data.roomId);
      // Join the socket room with full player profile so the server can map
      // this socket.id → player and route authoritative Whot events correctly.
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        supabase.from('profiles').select('username, avatar_url').eq('id', user.id).single().then(({ data: prof }) => {
          socket.emit('join_room', {
            roomId: data.roomId,
            userId: user.id,
            username: prof?.username || currentUser?.username || 'Player',
            avatar: prof?.avatar_url || currentUser?.avatar_url,
          });
        });
      });
      setSearchingPlayers([]); // Clear queue list
    });

    socket.on('queue_joined', (data) => {
      console.log('Joined server queue');
    });

    socket.on('queue_update', (data) => {
      console.log('Queue update:', data);
      // Filter out ourselves from the searchers list for the UI
      supabase.auth.getUser().then(({ data: { user } }) => {
        const others = data.searchers.filter((s: any) => s.id !== user?.id);
        setSearchingPlayers(others);
      });
    });

    socket.on('room_sync', (room) => {
      if (room.status === 'starting') setGameState('starting');
      if (room.status === 'playing') {
        setSearching(false);
        setGameState('playing');
      }
    });

    return () => {
      socket.off('match_found');
      socket.off('queue_joined');
      socket.off('queue_update');
      socket.off('room_sync');
    };
  }, []);

  async function startMatchmaking() {
    if (isAiEnabled) {
      setSearching(true);
      return;
    }

    if (!currentUser) {
      Alert.alert('Loading...', 'Your profile is still loading. Please wait a moment.');
      return;
    }

    setSearching(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Error', 'Authentication required');
      setSearching(false);
      return;
    }

    // Client-side balance check (server does it too for security)
    if (currentUser && currentUser.wallet_balance < stake) {
      Alert.alert('Insufficient Balance', `You need ${gamblingEnabled ? '₦' : ''}${stake} to join this match. Please top up your wallet.`);
      setSearching(false);
      return;
    }

    socket.emit('join_matchmaking', {
      userId: user.id,
      username: currentUser.username,
      avatar: currentUser.avatar_url,
      gameType: gameMode,
      stake: stake,
      maxPlayers: playerCount
    });

    // Notify other components that we are searching and balance changed
    DeviceEventEmitter.emit('wallet_updated');
  }

  async function cancelMatchmaking() {
    setSearching(false);
    socket.emit('leave_matchmaking');
    // Refund is automatic on server, emit update to refresh balance
    setTimeout(() => DeviceEventEmitter.emit('wallet_updated'), 500);
  }

  // Simulation: Find players when searching is active (Only for AI mode)
  useEffect(() => {
    let timer: any;
    if (isAiEnabled && searching && readyCount < playerCount) {
      timer = setTimeout(() => {
        setReadyCount(prev => prev + 1);
        playPlayerFoundSound();
      }, 1500 + Math.random() * 1500);
    } else if (isAiEnabled && searching && readyCount === playerCount) {
      if (gameState === 'lobby') {
        setGameState('starting');
        setCountdown(5);
      }
    }
    return () => clearTimeout(timer);
  }, [searching, readyCount, playerCount, gameState, isAiEnabled]);

  // Handle Matchmaking Sound Loop
  useEffect(() => {
    if (searching && gameState === 'lobby') {
      startProgressLoop();
    } else {
      stopProgressLoop();
    }
    // Cleanup on unmount
    return () => stopProgressLoop();
  }, [searching, gameState]);

  // Handle countdown
  useEffect(() => {
    let timer: any;
    if (gameState === 'starting') {
      if (countdown > 0) {
        playPlayerFoundSound();
        timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      } else {
        // Transition to playing
        setSearching(false);
        setGameState('playing');
      }
    }
    return () => clearTimeout(timer);
  }, [gameState, countdown]);

  // ── Real-time Room Sync ───────────────────────────────────────────────────
  useEffect(() => {
    if (isAiEnabled || !roomId) return;

    const channel = supabase
      .channel(`room_sync_${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomId}` },
        (payload: any) => {
          const room = payload.new;
          if (room.players) {
            setReadyCount(room.players.length);
          }
          if (room.status === 'starting' && gameState !== 'starting') {
            setGameState('starting');
            // Sync countdown if needed, but local is fine for now
          }
          if (room.status === 'playing' && gameState !== 'playing') {
            setSearching(false);
            setGameState('playing');
          }
        }
      )
      .subscribe();

    // Initial fetch for the room state
    supabase.from('game_rooms').select('*').eq('id', roomId).single().then(({ data: room }) => {
      if (room && room.players) {
        setReadyCount(room.players.length);
        if (room.status === 'starting') setGameState('starting');
        if (room.status === 'playing') {
          setSearching(false);
          setGameState('playing');
        }
      }
    });

    return () => { channel.unsubscribe(); };
  }, [roomId, isAiEnabled]);

  // Reset simulation only when search is EXPLICITLY off and not in a game flow
  useEffect(() => {
    if (!searching && gameState === 'lobby') {
      setReadyCount(1);
      setCountdown(5);
      setRoomId(null);
    }
  }, [searching, gameState]);

  // Heartbeat to keep room active
  useEffect(() => {
    if (!roomId || !searching || gameState !== 'lobby') return;

    const beat = async () => {
      // Just updating ANY field triggers the updated_at trigger
      await supabase.from('game_rooms').update({ status: 'waiting' }).eq('id', roomId);
    };

    const interval = setInterval(beat, 20000); // every 20s
    return () => clearInterval(interval);
  }, [roomId, searching, gameState]);

  return (
    <View style={{ flex: 1, backgroundColor: '#05110B' }}>
      <DodgeKeyboard>
        <ScrollView
          style={sl.scroll}
          contentContainerStyle={sl.container}
          showsVerticalScrollIndicator={false}
        >
          <View style={sl.grid}>
            {/* ── LEFT column ── */}
            <View style={sl.leftCol}>
              <View style={{ marginBottom: s(8) }}>
                <HeroBanner config={config} onBack={onBack} />
              </View>

              <CtaFooter
                stake={stake}
                playerCount={playerCount}
                config={config}
                searching={searching}
                gameState={gameState}
                onFindMatch={() => {
                  if (searching) cancelMatchmaking();
                  else startMatchmaking();
                }}
              />

              <View style={{ marginTop: s(8) }}>
                <RoomOptions
                  isPrivate={isPrivate}
                  onToggle={() => setIsPrivate(p => !p)}
                  isAiEnabled={isAiEnabled}
                  onToggleAi={() => setIsAiEnabled(a => !a)}
                  accentColor={config.accentColor}
                  accentSoft={config.accentSoft}
                  accentBorder={config.accentBorder}
                  roomCode={isPrivate ? privateRoomCode : undefined}
                  onJoinPrivateRoom={async (code) => {
                    // Look up the room by its private code
                    const { data: room, error } = await supabase
                      .from('game_rooms')
                      .select('id, players, status, game_type, stake')
                      .eq('private_code', code)
                      .single();

                    if (error || !room) {
                      Alert.alert('Room Not Found', 'No private room found with that code. Double-check and try again.');
                      return;
                    }

                    // Join the socket room immediately
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) return;

                    socket.emit('join_room', {
                      roomId: room.id,
                      userId: user.id,
                      username: currentUser?.username || 'Player',
                      avatar: currentUser?.avatar_url,
                    });
                    // Set roomId so the PlayerSlots section renders
                    setRoomId(room.id);
                    setIsPrivate(true);
                    setIsAiEnabled(false); // Disable AI for multiplayer
                    setSearching(true); // Show the players panel
                  }}
                />
              </View>

              <View style={{ marginTop: s(8) }}>
                <GameRules config={config} />
              </View>
            </View>

            {/* ── RIGHT column ── */}
            <View style={sl.rightCol}>
              <View style={sl.stabilizedRight}>
                {!searching ? (
                  <ModeSelectorSection
                    playerCount={playerCount}
                    setPlayerCount={setPlayerCount}
                    config={config}
                  />
                ) : (
                  <>
                    <PlayerSlots
                      playerCount={playerCount}
                      readyCount={readyCount}
                      accentColor={config.accentColor}
                      accentSoft={config.accentSoft}
                      accentBorder={config.accentBorder}
                      roomId={roomId}
                      gameMode={gameMode}
                      stake={stake}
                      currentUser={currentUser}
                      isAiEnabled={isAiEnabled}
                      serverSearchingPlayers={searchingPlayers}
                    />
                    {gameState === 'starting' && (
                      <View style={{ marginTop: s(8) }}>
                        <StartingOverlay accentColor={config.accentColor} count={countdown} />
                      </View>
                    )}
                  </>
                )}

                {!searching && (
                  <StakeSelector
                    selected={stake}
                    onChange={setStake}
                    accentColor={config.accentColor}
                    accentSoft={config.accentSoft}
                    accentBorder={config.accentBorder}
                    playerCount={playerCount}
                  />
                )}

                {/* Move RecentActivity inside the container so it's directly under the players */}
                <RecentActivity
                  accentColor={config.accentColor}
                  accentSoft={config.accentSoft}
                  accentBorder={config.accentBorder}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </DodgeKeyboard>

      {/* Gameplay Modal renders ON TOP of the lobby */}
      {gameState === 'playing' && (
        <Modal
          visible={true}
          animationType="fade"
          statusBarTranslucent
          supportedOrientations={['landscape']}
        >
          <GameplayScreen
            mode={gameMode}
            playerCount={playerCount}
            isAiEnabled={isAiEnabled}
            roomId={roomId}
            socket={socket}
            onExit={(params?: { autoSearch?: boolean }) => {
              setGameState('lobby');
              if (params?.autoSearch) {
                startMatchmaking();
              } else {
                setSearching(false);
              }
            }}
          />
        </Modal>
      )}

      {/* Hidden preloader to warm up Three.js context and textures - Only active in Lobby to save resources */}
      {gameState === 'lobby' && (
        <View style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none', left: -500 }}>
          <Dice3D value={1} controlled isRolling={false} size={1} />
          <AssetPreloader />
        </View>
      )}
    </View>
  );
}

function StartingOverlay({ accentColor, count }: { accentColor: string; count: number }) {
  const anim = useFadeSlide(0, 10);
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    // Intense pop animation on every count change
    scaleAnim.setValue(2);

    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 150,
      useNativeDriver: true,
    }).start();
  }, [count]);

  return (
    <Animated.View style={[sl.startingOverlay, anim]}>
      <Text style={sl.startingText}>GET READY</Text>

      <View style={sl.countContainer}>
        <Animated.Text
          style={[
            sl.startingCount,
            {
              color: accentColor,
              transform: [{ scale: scaleAnim }],
              textShadowColor: accentColor,
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 15,
            }
          ]}
        >
          {count}
        </Animated.Text>
      </View>

      <Text style={[sl.startingText, { fontSize: s(8), color: 'rgba(255,255,255,0.4)' }]}>
        MATCH STARTING SOON
      </Text>
    </Animated.View>
  );
}

const ModeSelectorSection = React.memo(({ playerCount, setPlayerCount, config }: any) => {
  const anim = useFadeSlide(100);
  return (
    <Animated.View style={[sl.section, anim]}>
      <View style={sl.sectionHeader}>
        <Text style={sl.sectionTitle}>Game Mode</Text>
        <Text style={sl.sectionSub}>Number of players</Text>
      </View>
      <PlayerCountSelector
        selected={playerCount}
        onChange={setPlayerCount}
        accentColor={config.accentColor}
        accentSoft={config.accentSoft}
        accentBorder={config.accentBorder}
      />
    </Animated.View>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const SUCCESS_SOFT = 'rgba(87,208,139,0.13)';
const SUCCESS_BORDER = 'rgba(87,208,139,0.28)';

const sl = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    paddingBottom: s(16),
    paddingHorizontal: 10,
    paddingTop: 4,
  },
  grid: {
    flexDirection: 'row',
    gap: s(8),
    padding: 0,
    paddingTop: 4,
    alignItems: 'flex-start',
  },
  leftCol: {
    width: LEFT_COL_W,
    gap: 0,
  },
  leftColChild: {
    marginBottom: s(8),
  },
  rightCol: {
    flex: 1,
    gap: s(8),
  },
  stabilizedRight: {
    minHeight: s(180),
    position: 'relative',
    gap: s(8),
  },

  // ── Hero ──
  heroBanner: {
    borderRadius: s(16),
    overflow: 'hidden',
    borderWidth: 1.5,
    height: s(120), // Fixed height to prevent "low down" jump
  },
  heroImage: {
    height: s(120),
  },
  heroImageStyle: {
    resizeMode: 'cover',
  },
  heroGrad: {
    flex: 1,
    minHeight: s(110),
    padding: s(10),
    gap: s(6),
    justifyContent: 'space-between',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: s(8),
    paddingVertical: s(4),
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  backText: {
    color: C.textPrimary,
    fontSize: s(10),
    fontWeight: '600',
  },
  heroBody: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: s(8),
  },
  gameIconWrap: {
    width: s(34),
    height: s(34),
    borderRadius: s(10),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  heroText: {
    flex: 1,
    gap: s(2),
  },
  tourneyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: s(6),
    paddingVertical: s(2),
    borderRadius: 999,
    backgroundColor: C.goldSoft,
    borderWidth: 1,
    borderColor: C.goldBorder,
    alignSelf: 'flex-start',
  },
  tourneyBadgeText: {
    color: C.gold,
    fontSize: s(7),
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: C.textPrimary,
    fontSize: s(17),
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  heroSub: {
    color: C.textMuted,
    fontSize: s(9),
    lineHeight: s(13),
  },

  // ── Player Count ──
  countRow: {
    flexDirection: 'row',
    gap: s(6),
  },
  countCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(7),
    padding: s(9),
    borderRadius: s(12),
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.divider,
  },
  countIconWrap: {
    width: s(30),
    height: s(30),
    borderRadius: s(9),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.divider,
  },
  countText: {
    flex: 1,
    gap: 1,
  },
  countLabel: {
    color: C.textMuted,
    fontSize: s(11),
    fontWeight: '800',
  },
  countSub: {
    color: C.textFaint,
    fontSize: s(9),
  },
  countCheck: {
    width: s(18),
    height: s(18),
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  // ── Stakes ──
  stakeSection: {
    backgroundColor: C.surface,
    borderRadius: s(15),
    borderWidth: 1,
    borderColor: C.divider,
    padding: s(11),
    gap: s(8),
    marginTop: s(2),
  },
  stakeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  stakeTitle: {
    color: C.textPrimary,
    fontSize: s(12),
    fontWeight: '800',
  },
  stakeSub: {
    color: C.textMuted,
    fontSize: s(9),
    marginTop: 1,
  },
  potPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: s(7),
    paddingVertical: s(4),
    borderRadius: 999,
    backgroundColor: C.goldSoft,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  potLabel: {
    color: C.textMuted,
    fontSize: s(9),
    fontWeight: '600',
  },
  potValue: {
    color: C.gold,
    fontSize: s(10),
    fontWeight: '800',
  },
  stakeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(5),
  },
  stakeCard: {
    // flex so cards share space evenly in 3-column wrap
    minWidth: s(74),
    flex: 1,
    paddingHorizontal: s(8),
    paddingVertical: s(8),
    borderRadius: s(10),
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.divider,
    alignItems: 'center',
    gap: 2,
    position: 'relative',
  },
  stakeTag: {
    position: 'absolute',
    top: s(-6),
    paddingHorizontal: s(5),
    paddingVertical: s(1),
    borderRadius: 999,
    borderWidth: 1,
  },
  stakeTagText: {
    fontSize: s(6),
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  stakeAmount: {
    color: C.textPrimary,
    fontSize: s(11),
    fontWeight: '800',
    marginTop: s(3),
  },
  stakeWin: {
    color: C.textFaint,
    fontSize: s(8),
    fontWeight: '600',
  },
  feeNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  feeNoteText: {
    color: C.textFaint,
    fontSize: s(8),
  },

  // ── Player Slots ──
  slotsSection: {
    backgroundColor: C.surface,
    borderRadius: s(15),
    borderWidth: 1,
    borderColor: C.divider,
    padding: s(11),
    gap: s(8),
  },
  slotsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slotsSectionTitle: {
    color: C.textPrimary,
    fontSize: s(12),
    fontWeight: '800',
  },
  slotsReadyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: s(6),
    paddingVertical: s(3),
    borderRadius: 999,
    backgroundColor: C.warnSoft,
    borderWidth: 1,
    borderColor: C.warnBorder,
  },
  slotsReadyText: {
    color: C.warn,
    fontSize: s(9),
    fontWeight: '700',
  },
  slotsRow: {
    flexDirection: 'row',
    gap: s(5),
  },
  slotCard: {
    flex: 1,
    minHeight: s(80),
    borderRadius: s(12),
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.divider,
    padding: s(7),
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(4),
  },
  slotAvatarWrap: {
    position: 'relative',
  },
  slotAvatar: {
    width: s(32),
    height: s(32),
    borderRadius: s(16),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  slotAvatarText: {
    color: C.textPrimary,
    fontSize: s(10),
    fontWeight: '800',
  },
  youBadge: {
    position: 'absolute',
    bottom: s(-4),
    left: '50%',
    marginLeft: -11,
    paddingHorizontal: s(4),
    paddingVertical: s(1),
    borderRadius: 999,
    borderWidth: 1,
  },
  youBadgeText: {
    fontSize: s(6),
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  slotName: {
    color: C.textMuted,
    fontSize: s(8),
    fontWeight: '700',
    textAlign: 'center',
    marginTop: s(4),
  },
  slotMeta: {
    flexDirection: 'row',
    gap: 3,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  slotMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: s(4),
    paddingVertical: s(1),
    borderRadius: 999,
    backgroundColor: C.goldSoft,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  slotMetaText: {
    color: C.gold,
    fontSize: s(7),
    fontWeight: '700',
  },
  waitingSlot: {
    alignItems: 'center',
    gap: s(4),
  },
  waitingDots: {
    flexDirection: 'row',
    gap: 3,
  },
  waitDot: {
    width: s(5),
    height: s(5),
    borderRadius: s(3),
  },
  waitingText: {
    fontSize: s(9),
    fontWeight: '700',
  },
  waitingSub: {
    color: C.textFaint,
    fontSize: s(8),
    textAlign: 'center',
  },
  botSlot: {
    alignItems: 'center',
    gap: s(3),
  },
  botIcon: {
    width: s(28),
    height: s(28),
    borderRadius: s(14),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: C.divider,
  },
  botText: {
    color: C.textFaint,
    fontSize: s(8),
    fontWeight: '600',
  },

  // ── Room Options ──
  roomOptions: {
    backgroundColor: C.surface,
    borderRadius: s(15),
    borderWidth: 1,
    borderColor: C.divider,
    padding: s(11),
    gap: 0,
  },
  roomToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: s(8),
  },
  roomToggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(7),
    flex: 1,
  },
  roomToggleLabel: {
    color: C.textMuted,
    fontSize: s(11),
    fontWeight: '700',
  },
  roomToggleSub: {
    color: C.textFaint,
    fontSize: s(9),
    marginTop: 1,
  },
  toggle: {
    width: s(36),
    height: s(20),
    borderRadius: s(10),
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: C.divider,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleKnob: {
    width: s(15),
    height: s(15),
    borderRadius: s(8),
  },
  roomCode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    paddingVertical: s(7),
    paddingHorizontal: s(10),
    borderRadius: s(8),
    borderWidth: 1,
    borderColor: C.goldBorder,
    backgroundColor: C.goldSoft,
  },
  roomCodeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  roomCodeLabel: {
    color: C.textMuted,
    fontSize: s(10),
    fontWeight: '600',
  },
  roomCodeValue: {
    color: C.gold,
    fontSize: s(13),
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  roomCodeCopy: {
    width: s(24),
    height: s(24),
    borderRadius: s(7),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.divider,
  },

  // ── CTA Footer ──
  ctaFooter: {
    backgroundColor: C.surfaceStrong,
    borderRadius: s(15),
    borderWidth: 1,
    borderColor: C.goldBorder,
    padding: s(11),
    gap: s(10),
  },
  ctaSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ctaSummaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
  },
  ctaSummaryLabel: {
    color: C.textMuted,
    fontSize: s(8),
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  ctaSummaryValue: {
    color: C.textPrimary,
    fontSize: s(10),
    fontWeight: '800',
  },
  ctaSummaryDiv: {
    width: 1,
    height: s(22),
    backgroundColor: C.divider,
  },
  findBtn: {
    borderRadius: s(12),
    overflow: 'hidden',
  },
  findBtnGrad: {
    borderRadius: s(12),
    padding: 2,
  },
  findBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(8),
    paddingVertical: s(10),
    paddingHorizontal: s(14),
    borderRadius: s(10),
    borderWidth: 1,
  },
  findBtnText: {
    fontSize: s(13),
    fontWeight: '900',
    letterSpacing: 0.4,
    flex: 1,
    textAlign: 'center',
  },
  findBtnArrow: {
    width: s(22),
    height: s(22),
    borderRadius: s(6),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  // ── Section ──
  section: {
    backgroundColor: C.surface,
    borderRadius: s(15),
    borderWidth: 1,
    borderColor: C.divider,
    padding: s(11),
    gap: s(6),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 1,
  },
  sectionTitle: {
    color: C.textPrimary,
    fontSize: s(11),
    fontWeight: '800',
  },
  sectionSub: {
    color: C.textMuted,
    fontSize: s(9),
  },

  // ── Recent Activity ──
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: s(6),
    paddingVertical: s(3),
    borderRadius: 999,
    backgroundColor: SUCCESS_SOFT,
    borderWidth: 1,
    borderColor: SUCCESS_BORDER,
  },
  livePillText: {
    color: C.success,
    fontSize: s(8),
    fontWeight: '700',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(7),
    paddingVertical: s(5),
  },
  recentDivider: {
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
  },
  recentDot: {
    width: s(22),
    height: s(22),
    borderRadius: s(6),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  recentInfo: {
    flex: 1,
    gap: 1,
  },
  recentMatch: {
    color: C.textPrimary,
    fontSize: s(9),
    fontWeight: '700',
  },
  recentWinner: {
    color: C.textMuted,
    fontSize: s(8),
  },
  recentAmount: {
    fontSize: s(10),
    fontWeight: '800',
  },

  // ── Rules ──
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s(8),
    paddingVertical: s(3),
  },
  ruleNum: {
    width: s(16),
    height: s(16),
    borderRadius: s(5),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.goldSoft,
    borderWidth: 1,
    borderColor: C.goldBorder,
    flexShrink: 0,
    marginTop: 1,
  },
  ruleNumText: {
    color: C.gold,
    fontSize: s(8),
    fontWeight: '800',
  },
  ruleText: {
    color: C.textMuted,
    fontSize: s(9),
    lineHeight: s(14),
    flex: 1,
  },

  // ── Shared ──
  pulseDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },

  // ── Starting Overlay ──
  startingOverlay: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: s(15),
    padding: s(12),
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(4),
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  startingText: {
    color: C.textMuted,
    fontSize: s(12),
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: s(4),
  },
  countContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: s(4),
    width: s(80),
    height: s(54),
  },
  countRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
  },
  startingCount: {
    fontSize: s(46),
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },

  // ── Join Room ──
  joinDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    marginVertical: s(10),
    opacity: 0.5,
  },
  joinDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.divider,
  },
  joinDividerText: {
    color: C.textFaint,
    fontSize: s(8),
    fontWeight: '800',
  },
  joinToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    paddingVertical: s(8),
    paddingHorizontal: s(10),
    borderRadius: s(8),
    borderWidth: 1,
    borderColor: C.divider,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  joinToggleBtnText: {
    flex: 1,
    color: C.textMuted,
    fontSize: s(10),
    fontWeight: '700',
  },
  joinInputBox: {
    marginTop: s(8),
    padding: s(8),
    borderRadius: s(10),
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
  },
  joinInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
  },
  joinInput: {
    flex: 1,
    height: s(32),
    color: C.textPrimary,
    fontSize: s(11),
    fontWeight: '600',
    paddingHorizontal: s(10),
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: s(6),
  },
  joinActionBtn: {
    height: s(32),
    paddingHorizontal: s(14),
    borderRadius: s(6),
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinActionBtnText: {
    color: '#000',
    fontSize: s(9),
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  joinPrivateHint: {
    fontSize: s(9),
    fontWeight: '600',
    marginBottom: s(6),
    opacity: 0.85,
  },
});