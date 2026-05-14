import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ─── Landscape dimensions ─────────────────────────────────────────────────────
const { width: SW, height: SH } = Dimensions.get('window');
const W = Math.max(SW, SH);
const H = Math.min(SW, SH);

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: '#05080F',
  bgRaised: '#080D18',
  gold: '#D4AF37',
  goldLight: '#F0CC5A',
  goldDim: '#9A7E20',
  goldBorder: 'rgba(212,175,55,0.25)',
  goldSoft: 'rgba(212,175,55,0.08)',
  text: '#EEE8D5',
  muted: 'rgba(238,232,213,0.5)',
  faint: 'rgba(238,232,213,0.25)',
  veryFaint: 'rgba(238,232,213,0.1)',
  divider: 'rgba(255,255,255,0.06)',
  glass: 'rgba(255,255,255,0.035)',
  glassBorder: 'rgba(255,255,255,0.08)',
  glassBorderHover: 'rgba(255,255,255,0.14)',
  green: '#4AE65C',
  yellow: '#FFD030',
  blue: '#2DA8FF',
  red: '#FF4A42',
  win: '#52C97E',
  winSoft: 'rgba(82,201,126,0.1)',
  winBorder: 'rgba(82,201,126,0.28)',
  lose: '#E8606A',
  loseSoft: 'rgba(232,96,106,0.09)',
  loseBorder: 'rgba(232,96,106,0.25)',
};

const CONFETTI_COLS = [C.gold, C.win, C.goldLight, '#fff', '#4AE65C', '#FFD700', '#FF8C00', '#00E87A'];

const colorHex: Record<string, string> = {
  green: '#4AE65C',
  yellow: '#FFD030',
  blue: '#2DA8FF',
  red: '#FF4A42',
};

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ResultPlayer {
  name: string;
  color: string;
  avatar: ImageSourcePropType;
  rank: number;
  prize: number;
  isLocal: boolean;
  lives: number;
  tokensHome: number;
  captures: number;
  score?: number; // Whot score
  isBot?: boolean;
}

export interface GameResultScreenProps {
  players: ResultPlayer[];
  totalPrize: number;
  durationSecs: number;
  mode: '2P' | '4P';
  level?: number;
  xpProgress?: number;
  xpGained?: number;
  isBotGame?: boolean;
  isWhot?: boolean;
  isSnake?: boolean;
  onPlayAgain: () => void;
  onExit: () => void;
  onShare?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

const RANK_LABEL: Record<number, string> = { 1: '1ST', 2: '2ND', 3: '3RD', 4: '4TH' };
const RANK_ICON: Record<number, string> = { 1: 'crown', 2: 'medal', 3: 'medal-outline', 4: 'account-outline' };
const RANK_COLOR: Record<number, string> = {
  1: '#D4AF37',
  2: '#B0B8C8',
  3: '#A0724A',
  4: 'rgba(238,232,213,0.25)',
};

// ─── Animated Number (with unmount guard) ─────────────────────────────────────
function AnimatedNumber({
  value,
  suffix = '',
  duration = 1200,
  divisor = 1,
  style,
}: {
  value: number;
  suffix?: string;
  duration?: number;
  divisor?: number;
  style?: any;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    anim.stopAnimation();
    anim.setValue(0);
    const listener = anim.addListener(({ value: v }) => {
      if (mounted.current) setDisplayValue(v);
    });

    Animated.timing(anim, {
      toValue: value / divisor,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    return () => {
      mounted.current = false;
      anim.removeListener(listener);
      anim.stopAnimation();
    };
  }, [value, divisor, duration]);

  const formatted = divisor > 1 ? displayValue.toFixed(1) : Math.floor(displayValue);
  return <Text style={style}>{formatted}{suffix}</Text>;
}

// ─── Confetti Particle (stable random values) ────────────────────────────────
function Particle({ delay, x, col }: { delay: number; x: number; col: string }) {
  const trX = useRef(new Animated.Value(x)).current;
  const trY = useRef(new Animated.Value(H * 0.95)).current;
  const opa = useRef(new Animated.Value(0)).current;
  const sc = useRef(new Animated.Value(0.4)).current;
  const rot = useRef(new Animated.Value(0)).current;

  // Stable random values via refs
  const isCircle = useRef(Math.random() > 0.5).current;
  const width = useRef(Math.random() > 0.6 ? 10 : 6).current;
  const height = useRef(Math.random() > 0.6 ? 10 : 6).current;
  const endRotate = useRef(Math.random() > 0.5 ? 540 : -540).current;
  const endScale = useRef(Math.random() * 1.2 + 0.7).current;

  useEffect(() => {
    const endX = x + (Math.random() - 0.5) * W * 0.9;
    const endY = Math.random() * H * 0.7 - H * 0.05;

    const seq = Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(trY, {
          toValue: endY,
          duration: 2400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(trX, {
          toValue: endX,
          duration: 2400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(opa, { toValue: 0.9, duration: 120, useNativeDriver: true }),
          Animated.timing(opa, { toValue: 0, duration: 1800, delay: 400, useNativeDriver: true }),
        ]),
        Animated.timing(sc, {
          toValue: endScale,
          duration: 700,
          easing: Easing.out(Easing.back(2)),
          useNativeDriver: true,
        }),
        Animated.timing(rot, { toValue: 1, duration: 2400, useNativeDriver: true }),
      ]),
    ]);

    seq.start();
    return () => seq.stop();
  }, []);

  const rotate = rot.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${endRotate}deg`],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        borderRadius: isCircle ? 5 : 1,
        backgroundColor: col,
        opacity: opa,
        transform: [{ translateX: trX }, { translateY: trY }, { scale: sc }, { rotate }],
      }}
    />
  );
}

// ─── Outcome Flash Overlay ────────────────────────────────────────────────────
function OutcomeFlash({ isWin }: { isWin: boolean }) {
  const sc = useRef(new Animated.Value(0.3)).current;
  const opa = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const seq = Animated.sequence([
      Animated.timing(sc, {
        toValue: 1.15,
        duration: 550,
        easing: Easing.out(Easing.elastic(1.1)),
        useNativeDriver: true,
      }),
      Animated.delay(900),
      Animated.parallel([
        Animated.timing(sc, { toValue: 1.8, duration: 350, useNativeDriver: true }),
        Animated.timing(opa, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
    ]);
    seq.start();
    return () => seq.stop();
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { alignItems: 'center', justifyContent: 'center', zIndex: 200, opacity: opa },
      ]}
    >
      <Animated.View style={{ transform: [{ scale: sc }], alignItems: 'center' }}>
        <Text style={{ fontSize: 64 }}>{isWin ? '🏆' : '💔'}</Text>
        <Text style={[st.flashTitle, { color: isWin ? C.goldLight : C.lose }]}>
          {isWin ? 'VICTORY' : 'DEFEATED'}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Player Row (with cleanup) ─────────────────────────────────────────────────
function PlayerRow({
  p,
  delay,
  isWin,
  isBotGame,
  isWhot,
  isSnake,
}: {
  p: ResultPlayer;
  delay: number;
  isWin: boolean;
  isBotGame: boolean;
  isWhot?: boolean;
  isSnake?: boolean;
}) {
  const slideX = useRef(new Animated.Value(-40)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  const col = colorHex[p.color] ?? C.text;
  const tokensOut = 4 - p.tokensHome;
  const rankCol = RANK_COLOR[p.rank] ?? C.faint;
  const isFirst = p.rank === 1;

  useEffect(() => {
    const intro = Animated.parallel([
      Animated.timing(slideX, {
        toValue: 0,
        duration: 420,
        delay,
        easing: Easing.out(Easing.back(1.3)),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, { toValue: 1, duration: 380, delay, useNativeDriver: true }),
    ]);
    intro.start();

    let shimmerAnim: Animated.CompositeAnimation | null = null;
    if (isFirst) {
      shimmerAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmer, {
            toValue: 1,
            duration: 1600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(shimmer, {
            toValue: 0,
            duration: 1600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      shimmerAnim.start();
    }

    return () => {
      intro.stop();
      shimmerAnim?.stop();
    };
  }, []);

  const rowBg = isFirst
    ? 'rgba(212,175,55,0.1)'
    : p.isLocal
    ? `${col}14`
    : C.glass;

  const rowBorderCol = isFirst
    ? 'rgba(212,175,55,0.35)'
    : p.isLocal
    ? `${col}44`
    : C.glassBorder;

  return (
    <Animated.View
      style={[
        st.row,
        {
          backgroundColor: rowBg,
          borderColor: rowBorderCol,
          opacity,
          transform: [{ translateX: slideX }],
        },
      ]}
    >
      {isFirst && (
        <Animated.View
          style={[
            st.rankAccentBar,
            {
              opacity: shimmer.interpolate({
                inputRange: [0, 1],
                outputRange: [0.5, 1],
              }),
            },
          ]}
        />
      )}

      {/* Rank badge */}
      <View style={[st.rankBadge, { backgroundColor: `${rankCol}18`, borderColor: `${rankCol}44` }]}>
        <MaterialCommunityIcons name={RANK_ICON[p.rank] as any ?? 'account'} size={9} color={rankCol} />
        <Text style={[st.rankLabel, { color: rankCol }]}>{RANK_LABEL[p.rank] ?? `${p.rank}`}</Text>
      </View>

      {/* Avatar */}
      <View style={[st.avatarRing, { borderColor: p.isLocal ? col : 'rgba(255,255,255,0.18)' }]}>
        <Image source={p.avatar} style={st.avatar} />
        {isFirst && (
          <View style={st.crownBadge}>
            <MaterialCommunityIcons name="crown" size={6} color="#000" />
          </View>
        )}
      </View>

      {/* Name + color tag */}
      <View style={st.nameCol}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={[st.rowName, p.isLocal && { color: col }]} numberOfLines={1}>
            {p.name}
          </Text>
          {p.isLocal && (
            <View style={[st.youTag, { borderColor: `${col}55`, backgroundColor: `${col}18` }]}>
              <Text style={[st.youTagTxt, { color: col }]}>YOU</Text>
            </View>
          )}
          {p.isBot && (
            <View
              style={[
                st.youTag,
                {
                  borderColor: `rgba(255,255,255,0.3)`,
                  backgroundColor: `rgba(255,255,255,0.08)`,
                },
              ]}
            >
              <Text style={[st.youTagTxt, { color: 'rgba(255,255,255,0.5)' }]}>AI</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 }}>
          <View style={[st.colorDot, { backgroundColor: col }]} />
          <Text style={st.rowSub}>{p.color}</Text>
        </View>
      </View>

      {/* Token progress or Whot Score */}
      {!isSnake && (
        <View style={st.statCell}>
          {isWhot ? (
            <>
              <Text style={[st.statVal, { color: p.score === 0 ? C.win : C.text }]}>{p.score ?? 0}</Text>
              <Text style={st.rowSub}>score</Text>
            </>
          ) : (
            <>
              <View style={st.tokenBar}>
                {[0, 1, 2, 3].map(i => (
                  <View
                    key={i}
                    style={[
                      st.tokenSeg,
                      { backgroundColor: i < tokensOut ? `${col}CC` : 'rgba(255,255,255,0.08)' },
                    ]}
                  />
                ))}
              </View>
              <Text style={st.rowSub}>{tokensOut}/4</Text>
            </>
          )}
        </View>
      )}

      {/* Lives */}
      <View style={st.statCell}>
        <View style={{ flexDirection: 'row', gap: 2.5 }}>
          {[0, 1, 2, 3].map(i => (
            <View
              key={i}
              style={[
                st.pip,
                {
                  backgroundColor: i < p.lives ? col : 'transparent',
                  borderColor: i < p.lives ? col : 'rgba(255,255,255,0.14)',
                  opacity: i < p.lives ? 0.9 : 0.4,
                },
              ]}
            />
          ))}
        </View>
        <Text style={st.rowSub}>{p.lives} ♥</Text>
      </View>

      {/* Captures / Status */}
      {!isSnake && (
        <View style={[st.statCell, { alignItems: 'center' }]}>
          <Text style={st.statVal}>{isWhot ? (p.score === 0 ? 'WIN' : 'OUT') : p.captures}</Text>
          <Text style={st.rowSub}>{isWhot ? 'status' : 'cap.'}</Text>
        </View>
      )}

      {/* Prize */}
      <View style={[st.statCell, { alignItems: 'flex-end' }]}>
        {p.prize > 0 && !isBotGame ? (
          <>
            <Text style={st.prizeVal}>+₦{(p.prize / 1000).toFixed(1)}k</Text>
            <Text style={st.rowSub}>prize</Text>
          </>
        ) : (
          <Text style={st.prizeDash}>—</Text>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Stat Cell (with cleanup) ─────────────────────────────────────────────────
function StatCell({
  label,
  value,
  accent,
  icon,
  delay = 0,
}: {
  label: string;
  value: string;
  accent?: string;
  icon?: string;
  delay?: number;
}) {
  const opa = useRef(new Animated.Value(0)).current;
  const sc = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(opa, { toValue: 1, duration: 350, delay, useNativeDriver: true }),
      Animated.timing(sc, {
        toValue: 1,
        duration: 480,
        delay,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View style={[st.statGridCell, { opacity: opa, transform: [{ scale: sc }] }]}>
      {icon && (
        <MaterialCommunityIcons
          name={icon as any}
          size={11}
          color={accent ?? C.faint}
          style={{ marginBottom: 2 }}
        />
      )}
      <Text style={[st.statGridVal, accent && { color: accent }]}>{value}</Text>
      <Text style={st.statGridLbl}>{label}</Text>
    </Animated.View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function GameResultScreen({
  players,
  totalPrize,
  durationSecs,
  mode,
  onPlayAgain,
  onExit,
  level = 1,
  xpProgress = 0.5,
  xpGained = 150,
  isBotGame = false,
  isWhot = false,
  isSnake = false,
  onShare,
}: GameResultScreenProps) {
  const sorted = useMemo(() => [...players].sort((a, b) => a.rank - b.rank), [players]);
  const local = sorted.find(p => p.isLocal);
  const isWin = local?.rank === 1;
  const winner = sorted[0];

  const hCol = isWin ? C.win : C.lose;
  const hSoft = isWin ? C.winSoft : C.loseSoft;
  const hBorder = isWin ? C.winBorder : C.loseBorder;

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(24)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const bgRot = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const intro = Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(slideY, {
        toValue: 0,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    intro.start();

    const bgRotation = Animated.loop(
      Animated.timing(bgRot, {
        toValue: 1,
        duration: 22000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    bgRotation.start();

    const pulsing = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    );
    pulsing.start();

    return () => {
      intro.stop();
      bgRotation.stop();
      pulsing.stop();
    };
  }, []);

  const particles = useMemo(() => {
    if (!isWin) return [];
    return Array.from({ length: 36 }, (_, i) => ({
      x: Math.round(W * 0.04 + Math.random() * W * 0.92),
      col: CONFETTI_COLS[i % CONFETTI_COLS.length],
      delay: i * 45 + Math.random() * 280,
    }));
  }, [isWin]);

  const totalCaptures = useMemo(() => players.reduce((s, p) => s + p.captures, 0), [players]);

  const pulseBorder = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [hBorder, isWin ? 'rgba(82,201,126,0.75)' : 'rgba(232,96,106,0.7)'],
  });
  const bgRotDeg = bgRot.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const localColor = local ? colorHex[local.color] ?? hCol : hCol;
  const localPrize = local?.prize ?? 0;
  const localLives = local?.lives ?? 0;
  const localCaptures = local?.captures ?? 0;
  const localTokensOut = local ? 4 - (local.tokensHome ?? 4) : 0;
  const localScore = local?.score ?? 0;

  return (
    <Animated.View style={[st.screen, { opacity: fadeIn }]}>
      {/* Base gradient */}
      <LinearGradient colors={[C.bgRaised, C.bg, C.bg]} style={StyleSheet.absoluteFill} />

      {/* Ambient rotating orb */}
      <Animated.View style={[st.ambientWrap, { transform: [{ rotate: bgRotDeg }] }]}>
        <LinearGradient
          colors={[hSoft, 'transparent', 'transparent', hSoft]}
          style={st.ambient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* Confetti */}
      {particles.map((pt, i) => (
        <Particle key={i} delay={pt.delay} x={pt.x} col={pt.col} />
      ))}

      {/* Victory/Defeat flash */}
      <OutcomeFlash isWin={isWin} />

      {/* ═══ HEADER ══════════════════════════════════════════════════════════ */}
      <Animated.View style={[st.header, { transform: [{ translateY: slideY }] }]}>
        <LinearGradient
          colors={[hSoft, 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.5, y: 0 }}
          pointerEvents="none"
        />

        {/* Outcome badge */}
        <Animated.View
          style={[
            st.outcomeBadge,
            {
              borderColor: pulseBorder,
              backgroundColor: hSoft,
              transform: [
                {
                  scale: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.04],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={{ fontSize: 16 }}>{isWin ? '🏆' : '💔'}</Text>
          <Text style={[st.outcomeTxt, { color: hCol }]}>{isWin ? 'VICTORY' : 'DEFEATED'}</Text>
        </Animated.View>

        <View style={st.hDivider} />

        {/* Meta pills row */}
        <View style={st.metaRow}>
          <MetaPill icon="timer-outline" value={fmtTime(durationSecs)} />
          {!isBotGame && (
            <MetaPill
              icon="trophy-outline"
              value={`₦${(totalPrize / 1000).toFixed(0)}k`}
              accent={C.gold}
              animated
              value2={totalPrize}
              divisor={1000}
              suffix="k"
              prefix="₦"
              duration={1800}
            />
          )}
          <MetaPill icon="account-group-outline" value={mode} />
          {!isWhot && !isSnake && <MetaPill icon="sword-cross" value={`${totalCaptures} cap.`} />}
          {!isBotGame && (
            <View style={[st.metaPill, { paddingHorizontal: 8, gap: 6 }]}>
              <View style={st.lvlTag}>
                <Text style={st.lvlTagTxt}>L{level}</Text>
              </View>
              <View style={st.xpBarBg}>
                <View style={[st.xpBarFill, { width: `${xpProgress * 100}%` }]} />
              </View>
              <Text style={[st.metaPillTxt, { color: C.win, fontSize: 9 }]}>+{xpGained}xp</Text>
            </View>
          )}
        </View>

        <View style={{ flex: 1 }} />

        <TouchableOpacity onPress={onExit} style={st.closeBtn} activeOpacity={0.7}>
          <MaterialCommunityIcons name="close" size={15} color={C.muted} />
        </TouchableOpacity>

        <LinearGradient
          colors={[hBorder, 'transparent']}
          style={st.headerBottomLine}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          pointerEvents="none"
        />
      </Animated.View>

      {/* ═══ BODY ════════════════════════════════════════════════════════════ */}
      <View style={st.body}>
        {/* LEFT — Leaderboard */}
        <View style={st.leftCol}>
          <Text style={st.sectionLabel}>LEADERBOARD</Text>
          <View style={st.leaderboard}>
            {sorted.map((p, i) => (
              <PlayerRow
                key={p.color}
                p={p}
                delay={280 + i * 90}
                isWin={isWin}
                isBotGame={isBotGame}
                isWhot={isWhot}
                isSnake={isSnake}
              />
            ))}
          </View>
        </View>

        <View style={st.bodyDivider} />

        {/* RIGHT — Player card + stats + actions */}
        <View style={st.rightCol}>
          {/* Your result card */}
          <Animated.View
            style={[
              st.yourCard,
              {
                borderColor: pulseBorder,
                backgroundColor: hSoft,
                transform: [
                  {
                    scale: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.015],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text
              style={[
                st.rankWatermark,
                { color: isWin ? 'rgba(212,175,55,0.06)' : 'rgba(232,96,106,0.06)' },
              ]}
            >
              #{local?.rank ?? '?'}
            </Text>

            <View style={[st.yourAvatarRing, { borderColor: localColor }]}>
              {local && <Image source={local.avatar} style={st.yourAvatar} />}
              {isWin && (
                <View style={st.yourCrown}>
                  <MaterialCommunityIcons name="crown" size={8} color="#000" />
                </View>
              )}
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[st.yourRank, { color: hCol }]}>
                {isWin ? '🏆 1st Place' : `#${local?.rank ?? '?'} Place`}
              </Text>
              <Text style={st.yourName}>{local?.name ?? '—'}</Text>
              {!isBotGame && (
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 1, marginTop: 2 }}>
                  <Text style={[st.yourPrizeCur, { color: isWin ? C.win : C.faint }]}>₦</Text>
                  <AnimatedNumber
                    value={localPrize}
                    duration={2200}
                    divisor={1000}
                    suffix="k"
                    style={[st.yourPrize, { color: isWin ? C.win : C.faint }]}
                  />
                </View>
              )}
              {isWin && !isBotGame && <Text style={st.earnedLabel}>earned this round</Text>}
            </View>
          </Animated.View>

          {/* Stats grid */}
          <View style={st.statsGrid}>
            <View style={st.statsRow}>
              <StatCell icon="crown-outline" label="Winner" value={winner?.name ?? '—'} accent={C.gold} delay={750} />
              <View style={st.statCellDiv} />
              <StatCell icon="heart-outline" label="Lives" value={`${localLives}/4`} delay={840} />
              {!isSnake && (
                <>
                  <View style={st.statCellDiv} />
                  <StatCell
                    icon={isWhot ? 'cards-outline' : 'chess-pawn'}
                    label={isWhot ? 'Score' : 'Tokens'}
                    value={isWhot ? `${localScore}` : `${localTokensOut}/4`}
                    delay={930}
                  />
                </>
              )}
            </View>
            <View style={st.statsHDiv} />
            <View style={st.statsRow}>
              {!isSnake && (
                <>
                  <StatCell icon="sword-cross" label="Captures" value={`${localCaptures}`} delay={1020} />
                  <View style={st.statCellDiv} />
                </>
              )}
              <StatCell icon="timer-outline" label="Time" value={fmtTime(durationSecs)} delay={1110} />
              <View style={st.statCellDiv} />
              <StatCell
                icon="trophy-variant-outline"
                label={isBotGame ? 'Match' : 'Pot'}
                value={isBotGame ? 'Practice' : `₦${(totalPrize / 1000).toFixed(0)}k`}
                accent={isBotGame ? C.faint : C.gold}
                delay={1200}
              />
            </View>
          </View>

          {/* Actions */}
          <View style={st.actions}>
            <TouchableOpacity onPress={onExit} style={st.ghostBtn} activeOpacity={0.75}>
              <MaterialCommunityIcons name="home-outline" size={13} color={C.muted} />
              <Text style={st.ghostBtnTxt}>Lobby</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onPlayAgain} style={st.primaryBtn} activeOpacity={0.82}>
              <LinearGradient
                colors={[C.goldLight, C.gold, '#8C6A10']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={st.primaryGrad}
              >
                <MaterialCommunityIcons name="refresh" size={13} color="#000" />
                <Text style={st.primaryBtnTxt}>Rematch</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => (onShare ? onShare() : onExit())}
              style={st.ghostBtn}
              activeOpacity={0.75}
            >
              <MaterialCommunityIcons name="share-variant-outline" size={13} color={C.muted} />
              <Text style={st.ghostBtnTxt}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Meta pill helper ─────────────────────────────────────────────────────────
function MetaPill({
  icon,
  value,
  accent,
  animated: isAnimated,
  value2,
  divisor,
  suffix,
  prefix,
  duration,
}: {
  icon: string;
  value: string;
  accent?: string;
  animated?: boolean;
  value2?: number;
  divisor?: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
}) {
  return (
    <View style={st.metaPill}>
      <MaterialCommunityIcons name={icon as any} size={10} color={accent ?? C.faint} />
      {isAnimated && value2 != null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {prefix && <Text style={[st.metaPillTxt, accent && { color: accent }]}>{prefix}</Text>}
          <AnimatedNumber
            value={value2}
            duration={duration ?? 1200}
            divisor={divisor ?? 1}
            suffix={suffix ?? ''}
            style={[st.metaPillTxt, accent && { color: accent }]}
          />
        </View>
      ) : (
        <Text style={[st.metaPillTxt, accent && { color: accent }]}>{value}</Text>
      )}
    </View>
  );
}

// ─── Layout constants ─────────────────────────────────────────────────────────
const HEADER_H = Math.round(H * 0.155);
const BODY_H = H - HEADER_H;
const LEFT_W = Math.round(W * 0.55);
const RIGHT_W = W - LEFT_W - 1;

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    backgroundColor: C.bg,
  },
  ambientWrap: {
    position: 'absolute',
    top: -H * 0.5,
    left: -W * 0.5,
    width: W * 2,
    height: H * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ambient: { width: '100%', height: '100%', opacity: 0.18 },

  flashTitle: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 5,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 12,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    height: HEADER_H,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  outcomeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1.5,
  },
  outcomeTxt: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  hDivider: {
    width: 1,
    height: 26,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  metaPillTxt: { fontSize: 9.5, color: C.muted, fontWeight: '700' },
  lvlTag: {
    backgroundColor: C.gold,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  lvlTagTxt: { fontSize: 7, fontWeight: '900', color: '#000' },
  xpBarBg: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: C.gold,
    borderRadius: 2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBottomLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1.5,
  },

  // ── Body ─────────────────────────────────────────────────────────────────────
  body: {
    height: BODY_H,
    flexDirection: 'row',
  },
  bodyDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  // ── Left col ─────────────────────────────────────────────────────────────────
  leftCol: {
    width: LEFT_W,
    paddingHorizontal: 11,
    paddingTop: 10,
    paddingBottom: 8,
  },
  sectionLabel: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 1.8,
    color: C.faint,
    marginBottom: 7,
    paddingLeft: 2,
  },
  leaderboard: { gap: 5 },

  // ── Player row ───────────────────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 9,
    borderWidth: 1.5,
    paddingHorizontal: 9,
    paddingVertical: 7,
    overflow: 'hidden',
  },
  rankAccentBar: {
    position: 'absolute',
    left: 0,
    top: 7,
    bottom: 7,
    width: 3,
    borderRadius: 1.5,
    backgroundColor: C.gold,
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  rankLabel: { fontSize: 7.5, fontWeight: '900', letterSpacing: 0.5 },
  avatarRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%' },
  crownBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameCol: { flex: 1.2 },
  rowName: { fontSize: 10.5, fontWeight: '800', color: C.text },
  rowSub: { fontSize: 8.5, color: C.faint, marginTop: 1 },
  colorDot: { width: 5, height: 5, borderRadius: 2.5 },
  youTag: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 3.5,
    paddingVertical: 1,
  },
  youTagTxt: { fontSize: 6.5, fontWeight: '900', letterSpacing: 0.7 },
  statCell: { alignItems: 'flex-start', minWidth: 40 },
  tokenBar: { flexDirection: 'row', gap: 2 },
  tokenSeg: { width: 7.5, height: 4.5, borderRadius: 2 },
  pip: { width: 5.5, height: 5.5, borderRadius: 2.75, borderWidth: 1 },
  statVal: { fontSize: 11, fontWeight: '800', color: C.text },
  prizeVal: { fontSize: 10.5, fontWeight: '900', color: C.win },
  prizeDash: { fontSize: 13, color: C.faint },

  // ── Right col ────────────────────────────────────────────────────────────────
  rightCol: {
    width: RIGHT_W,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 6,
    gap: 7,
    justifyContent: 'center',
  },

  yourCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  rankWatermark: {
    position: 'absolute',
    right: 8,
    bottom: -4,
    fontSize: 56,
    fontWeight: '900',
  },
  yourAvatarRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
  },
  yourAvatar: { width: '100%', height: '100%' },
  yourCrown: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yourRank: { fontSize: 13, fontWeight: '900', letterSpacing: 0.3 },
  yourName: { fontSize: 10.5, fontWeight: '700', color: C.text },
  yourPrizeCur: { fontSize: 11, fontWeight: '900' },
  yourPrize: { fontSize: 20, fontWeight: '900', letterSpacing: 0.3 },
  earnedLabel: { fontSize: 8.5, color: C.muted, fontStyle: 'italic', letterSpacing: 0.3 },

  // ── Stats grid ───────────────────────────────────────────────────────────────
  statsGrid: {
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.glassBorder,
    backgroundColor: C.glass,
    overflow: 'hidden',
  },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statGridCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    gap: 1,
  },
  statGridVal: { fontSize: 11.5, fontWeight: '900', color: C.text },
  statGridLbl: { fontSize: 7.5, color: C.faint, letterSpacing: 0.8, fontWeight: '700' },
  statCellDiv: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: C.divider,
  },
  statsHDiv: { width: '100%', height: 1, backgroundColor: C.divider },

  // ── Actions ──────────────────────────────────────────────────────────────────
  actions: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
  },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: C.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  ghostBtnTxt: { fontSize: 10.5, color: C.muted, fontWeight: '800' },
  primaryBtn: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  primaryGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
  },
  primaryBtnTxt: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});