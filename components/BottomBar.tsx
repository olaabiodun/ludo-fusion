import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  DeviceEventEmitter,
} from 'react-native';
import { usePathname } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useFeatureActive } from '@/lib/FeatureContext';
import { RewardModal } from './RewardModal';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  Line,
  LinearGradient,
  Path,
  Polygon,
  Polyline,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  // Golds
  gold: '#D4AF37',
  goldBright: '#F5D060',
  goldDeep: '#A07820',
  goldGlow: 'rgba(212,175,55,0.22)',
  goldBorder: 'rgba(212,175,55,0.28)',
  goldSoft: 'rgba(212,175,55,0.10)',

  // Reds / danger
  red: '#E8403F',
  redBright: '#FF6B6A',
  redGlow: 'rgba(232,64,63,0.20)',
  redBorder: 'rgba(232,64,63,0.35)',

  // Orange / streak
  orange: '#FF8C00',
  orangeBright: '#FFB347',
  orangeGlow: 'rgba(255,140,0,0.20)',

  // Greens / success
  green: '#3DD68C',
  greenGlow: 'rgba(61,214,140,0.18)',
  greenBorder: 'rgba(61,214,140,0.32)',

  // Blues / info
  blue: '#5B8FF9',
  blueGlow: 'rgba(91,143,249,0.18)',

  // Surfaces
  bg: '#050F09',
  surface: 'rgba(255,255,255,0.035)',
  surfaceHover: 'rgba(255,255,255,0.055)',
  glass: 'rgba(255,255,255,0.06)',

  // Text
  textPrimary: '#F0E6C0',
  textMuted: 'rgba(240,230,192,0.50)',
  textFaint: 'rgba(240,230,192,0.28)',

  // Divider
  divider: 'rgba(212,175,55,0.14)',
};

const BAR_HEIGHT = 76;

// ─── Glow dot ─────────────────────────────────────────────────────────────────
function GlowDot({ color, size = 4 }: { color: string; size?: number }) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color, opacity: pulse,
      shadowColor: color, shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1, shadowRadius: 4,
    }} />
  );
}

// ─── Claim Button ─────────────────────────────────────────────────────────────
function ClaimButton({ countdown }: { countdown: number }) {
  const shimmer = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (countdown > 0) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.05, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [countdown]);

  const shimmerX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-30, 60] });

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h}h ${m}m ${s}s`;
  };

  if (countdown > 0) {
    return (
      <View style={[styles.claimBtn, styles.claimBtnDisabled]}>
        <Text style={styles.claimTextDisabled}>{formatTime(countdown)}</Text>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.claimBtn, { transform: [{ scale }] }]}>
      {/* shimmer sweep */}
      <Animated.View style={{
        position: 'absolute', top: 0, bottom: 0, width: 20,
        backgroundColor: 'rgba(255,255,255,0.35)',
        transform: [{ translateX: shimmerX }, { skewX: '-20deg' }],
      }} />
      <Text style={styles.claimText}>CLAIM</Text>
    </Animated.View>
  );
}

function Spark({ delay }: { delay: number }) {
  const move = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const run = () => {
      move.setValue(0);
      drift.setValue(0);
      opacity.setValue(0);
      
      Animated.sequence([
        Animated.delay(delay + Math.random() * 1000),
        Animated.parallel([
          Animated.timing(move, { toValue: -50 - Math.random() * 30, duration: 1500 + Math.random() * 1000, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(drift, { toValue: (Math.random() - 0.5) * 30, duration: 1500 + Math.random() * 1000, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 1000, useNativeDriver: true }),
          ])
        ])
      ]).start(() => run());
    };
    run();
  }, []);

  return (
    <Animated.View style={{
      position: 'absolute', bottom: 12, width: 1.5, height: 1.5, borderRadius: 1,
      backgroundColor: '#FFEB3B', opacity,
      transform: [{ translateY: move }, { translateX: drift }]
    }} />
  );
}

function FlameLayer({ color, scale, delay, rotateRange = '8deg' }: { color: string, scale: number, delay: number, rotateRange?: string }) {
  const sway = useRef(new Animated.Value(0)).current;
  const flicker = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: 700 + delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sway, { toValue: -1, duration: 700 + delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(flicker, { toValue: 0.82, duration: 100 + Math.random() * 100, useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 1, duration: 100 + Math.random() * 100, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const rotate = sway.interpolate({ inputRange: [-1, 1], outputRange: [`-${rotateRange}`, rotateRange] });

  return (
    <Animated.View style={{ position: 'absolute', transform: [{ rotate }, { scaleY: flicker }, { scale }] }}>
      <Svg width={30} height={40} viewBox="0 0 28 36">
        <Path d="M14 2 C14 2 22 10 18.5 17 C16.5 21 20 22.5 20 22.5 C20 22.5 9 25 9 31 C9 33.5 11.2 35 14 35 C16.8 35 19 33.5 19 31 C19 29 17 27.5 17 27.5 C22 24.5 24 19.5 22 14.5 C26 18.5 25 26.5 20 31" fill={color} />
      </Svg>
    </Animated.View>
  );
}

function FlameIcon() {
  return (
    <View style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
      {/* Rising Chaotic Sparks */}
      {[...Array(6)].map((_, i) => <Spark key={i} delay={i * 300} />)}

      {/* Layered Dancing Flame */}
      <FlameLayer color="#B71C1C" scale={1.15} delay={150} rotateRange="12deg" />
      <FlameLayer color="#E65100" scale={1.05} delay={50} rotateRange="8deg" />
      <FlameLayer color="#FFB300" scale={0.85} delay={0} rotateRange="5deg" />
      <FlameLayer color="#FFFDE7" scale={0.5} delay={-50} rotateRange="3deg" />
    </View>
  );
}

// ─── Member Crown Icon ────────────────────────────────────────────────────────
function CrownIcon() {
  const glow = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.5, duration: 1600, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{ opacity: glow }}>
      <Svg width={32} height={32} viewBox="0 0 32 32">
        <Defs>
          <LinearGradient id="crown" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#F5D060" />
            <Stop offset="100%" stopColor="#A07820" />
          </LinearGradient>
          <RadialGradient id="cglow" cx="50%" cy="100%" r="60%">
            <Stop offset="0%" stopColor="#F5D060" stopOpacity={0.5} />
            <Stop offset="100%" stopColor="#F5D060" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {/* Glow base */}
        <Ellipse cx={16} cy={26} rx={10} ry={3} fill="url(#cglow)" />
        {/* Crown body */}
        <Path d="M5 22 L7 11 L12 17 L16 8 L20 17 L25 11 L27 22 Z" fill="url(#crown)" stroke="#7A5510" strokeWidth={0.8} strokeLinejoin="round" />
        {/* Band */}
        <Rect x={5} y={21} width={22} height={4} rx={1.5} fill="#A07820" />
        <Rect x={5} y={21} width={22} height={2} rx={1} fill="#F5D060" opacity={0.5} />
        {/* Gems */}
        <Circle cx={10} cy={23} r={1.5} fill={C.red} opacity={0.9} />
        <Circle cx={16} cy={23} r={1.5} fill={C.blue} opacity={0.9} />
        <Circle cx={22} cy={23} r={1.5} fill={C.green} opacity={0.9} />
        {/* Top dots */}
        <Circle cx={7} cy={11} r={1.8} fill="#F5D060" />
        <Circle cx={16} cy={8} r={2} fill="#F5D060" />
        <Circle cx={25} cy={11} r={1.8} fill="#F5D060" />
      </Svg>
    </Animated.View>
  );
}

// ─── Gift Icon ────────────────────────────────────────────────────────────────
function GiftIcon() {
  const bounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: -2, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 500, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.delay(1200),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{ transform: [{ translateY: bounce }] }}>
      <Svg width={32} height={32} viewBox="0 0 32 32">
        <Defs>
          <LinearGradient id="gift" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#F5D060" />
            <Stop offset="100%" stopColor="#A07820" />
          </LinearGradient>
        </Defs>
        {/* Box */}
        <Rect x={5} y={15} width={22} height={14} rx={2} fill={C.goldSoft} stroke="url(#gift)" strokeWidth={1.4} />
        {/* Lid */}
        <Rect x={4} y={12} width={24} height={5} rx={1.5} fill="none" stroke="url(#gift)" strokeWidth={1.4} />
        {/* Ribbon vertical */}
        <Rect x={14.5} y={12} width={3} height={17} fill={C.gold} opacity={0.35} />
        {/* Ribbon horizontal */}
        <Rect x={4} y={13.5} width={24} height={2} fill={C.gold} opacity={0.35} />
        {/* Bow left */}
        <Path d="M16 12 C16 12 11 8 9 10 C7 12 12 13.5 16 12" fill={C.goldGlow} stroke="url(#gift)" strokeWidth={1.2} />
        {/* Bow right */}
        <Path d="M16 12 C16 12 21 8 23 10 C25 12 20 13.5 16 12" fill={C.goldGlow} stroke="url(#gift)" strokeWidth={1.2} />
        {/* Bow knot */}
        <Circle cx={16} cy={12} r={2} fill={C.gold} />
        {/* Stars */}
        <Circle cx={9} cy={22} r={1} fill={C.gold} opacity={0.5} />
        <Circle cx={23} cy={19} r={0.8} fill={C.gold} opacity={0.4} />
      </Svg>
    </Animated.View>
  );
}

// ─── Refer Icon ───────────────────────────────────────────────────────────────
function ReferIcon() {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(spin, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(1000),
      ])
    ).start();
  }, []);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Svg width={32} height={32} viewBox="0 0 32 32">
        <Defs>
          <RadialGradient id="rglow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={C.red} stopOpacity={0.25} />
            <Stop offset="100%" stopColor={C.red} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={16} cy={16} r={13} fill="url(#rglow)" />
        {/* People */}
        <Circle cx={8} cy={12} r={3} fill="none" stroke={C.redBright} strokeWidth={1.4} />
        <Path d="M3 22 Q3 17 8 17 Q13 17 13 22" fill="none" stroke={C.redBright} strokeWidth={1.4} strokeLinecap="round" />
        <Circle cx={24} cy={12} r={3} fill="none" stroke={C.redBright} strokeWidth={1.4} />
        <Path d="M19 22 Q19 17 24 17 Q29 17 29 22" fill="none" stroke={C.redBright} strokeWidth={1.4} strokeLinecap="round" />
        {/* Arrow connecting */}
        <Path d="M13 14 L19 14" stroke={C.redBright} strokeWidth={1.2} strokeLinecap="round" strokeDasharray="1.5,1.5" />
        <Polygon points="19,12.5 21.5,14 19,15.5" fill={C.redBright} />
      </Svg>
    </Animated.View>
  );
}

// ─── Megaphone Icon ───────────────────────────────────────────────────────────
function MegaphoneIcon() {
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const shakeSeq = Animated.sequence([
      Animated.timing(shake, { toValue: 2, duration: 80, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -2, duration: 80, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1.5, duration: 80, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]);
    Animated.loop(
      Animated.sequence([shakeSeq, Animated.delay(2500)])
    ).start();
  }, []);
  return (
    <Animated.View style={{ transform: [{ translateX: shake }] }}>
      <Svg width={32} height={32} viewBox="0 0 34 34">
        <Defs>
          <LinearGradient id="mega" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor={C.goldBright} />
            <Stop offset="100%" stopColor={C.goldDeep} />
          </LinearGradient>
        </Defs>
        <Path d="M7 13 L7 23 L11 23 L11 13 Z" fill={C.goldSoft} stroke="url(#mega)" strokeWidth={1.4} strokeLinejoin="round" />
        <Path d="M11 13 Q22 8.5 26 8.5 L26 27.5 Q22 27.5 11 23 Z" fill={C.goldSoft} stroke="url(#mega)" strokeWidth={1.4} strokeLinejoin="round" />
        <Path d="M11 23 L11 28.5 Q11 29.5 12 29.5 L15 29.5 Q16 29.5 16 28.5 L16 23" fill="none" stroke="url(#mega)" strokeWidth={1.4} strokeLinecap="round" />
        {/* Sound waves */}
        <Path d="M28.5 13 Q30.5 17 28.5 21" stroke={C.goldBright} strokeWidth={1.4} fill="none" strokeLinecap="round" />
        <Path d="M30.5 11 Q33.5 17 30.5 23" stroke={C.gold} strokeWidth={1.1} fill="none" strokeLinecap="round" opacity={0.5} />
      </Svg>
    </Animated.View>
  );
}

// ─── Notification Badge ───────────────────────────────────────────────────────
function Badge({ count }: { count: number }) {
  const pop = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 240, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.2, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.delay(2000),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[styles.badge, { transform: [{ scale: Animated.multiply(pop, pulse) }] }]}>
      <Text style={styles.badgeText}>{count}</Text>
    </Animated.View>
  );
}

// ─── Streak Segments ──────────────────────────────────────────────────────────
function StreakBar({ filled, total }: { filled: number; total: number }) {
  return (
    <View style={styles.streakRow}>
      {Array.from({ length: total }).map((_, i) => {
        const isFilled = i < filled;
        return (
          <View key={i} style={[styles.streakSeg, i < total - 1 && { marginRight: 3 }]}>
            {isFilled ? (
              <View style={styles.streakFilled}>
                <View style={styles.streakShine} />
              </View>
            ) : (
              <View style={styles.streakEmpty} />
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── BarItem ──────────────────────────────────────────────────────────────────
function BarItem({
  children,
  accentColor = C.gold,
  isLast = false,
  highlight = false,
  onPress,
}: {
  children: React.ReactNode;
  accentColor?: string;
  isLast?: boolean;
  highlight?: boolean;
  onPress?: () => void;
}) {
  const pressed = useRef(new Animated.Value(1)).current;
  const bgAnim  = useRef(new Animated.Value(highlight ? 1 : 0)).current;

  const onIn  = () => Animated.timing(pressed, { toValue: 0.96, duration: 70, useNativeDriver: true }).start();
  const onOut = () => Animated.timing(pressed, { toValue: 1, duration: 100, useNativeDriver: true }).start();

  const bgColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.00)', 'rgba(212,175,55,0.055)'],
  });

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={onIn}
      onPressOut={onOut}
      style={[styles.item, !isLast && { borderRightWidth: 1, borderRightColor: C.divider }]}
    >
      <Animated.View style={[styles.itemInner, { backgroundColor: bgColor, transform: [{ scale: pressed }] }]}>
        {/* top accent bar */}
        <View style={[styles.topAccent, { backgroundColor: accentColor }]} />
        {/* accent glow */}
        <View style={[styles.topGlow, { backgroundColor: accentColor }]} />
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── BottomBar ────────────────────────────────────────────────────────────────
export function BottomBar({ forceHome = false, searching = false }: { forceHome?: boolean; searching?: boolean }) {
  const pathname = usePathname();
  const isHome = forceHome !== undefined ? forceHome : (pathname === '/home' || pathname === '/');
  const [showReward, setShowReward] = React.useState(false);
  const [countdown, setCountdown] = React.useState(0);
  const [streak, setStreak] = React.useState(0);
  const [showStreakReward, setShowStreakReward] = React.useState(false);
  const [claimedXp, setClaimedXp] = React.useState(0);
  const [searchAnim] = React.useState(new Animated.Value(0));
  const [announceUnread, setAnnounceUnread] = React.useState(0);
  const gamblingEnabled = useFeatureActive();
  const [membershipTier, setMembershipTier] = React.useState<string | null>(null);
  const [membershipExpires, setMembershipExpires] = React.useState<string | null>(null);

  const isMemberActive = membershipTier === 'royale' && 
    (!membershipExpires || new Date(membershipExpires).getTime() > Date.now());

  const getExpiryString = () => {
    if (!isMemberActive) return 'JOIN NOW';
    if (!membershipExpires) return 'Active';
    const expiresDate = new Date(membershipExpires);
    return 'Expires ' + expiresDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const expiryString = getExpiryString();

  useEffect(() => {
    if (searching) {
      Animated.spring(searchAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }).start();
    } else {
      Animated.spring(searchAnim, { toValue: 0, useNativeDriver: true }).start();
    }
  }, [searching]);

  useEffect(() => {
    let interval: any;
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let { data: profile, error } = await supabase
        .from('profiles')
        .select('last_daily_claim, streak, membership_tier, membership_expires')
        .eq('id', user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            username: user.email?.split('@')[0] || 'player',
            full_name: 'Player',
            wallet_balance: 1000,
            streak: 0,
            level: 1,
            xp: 0,
            xp_next_level: 1000
          })
          .select('last_daily_claim, streak, membership_tier, membership_expires')
          .single();
        if (!insertError && newProfile) {
          profile = newProfile;
        }
      }

      if (profile) {
        setMembershipTier(profile.membership_tier || null);
        setMembershipExpires(profile.membership_expires || null);
        setStreak(profile.streak || 0);

        if (isHome && profile.last_daily_claim) {
          const lastClaim = new Date(profile.last_daily_claim).getTime();
          const now = new Date().getTime();
          const diff = Math.floor((now - lastClaim) / 1000);
          const cooldown = 24 * 60 * 60; // 24 hours in seconds

          if (diff < cooldown) {
            setCountdown(cooldown - diff);
            clearInterval(interval);
            interval = setInterval(() => {
              setCountdown(prev => {
                if (prev <= 1) {
                  clearInterval(interval);
                  return 0;
                }
                return prev - 1;
              });
            }, 1000);
          }
        }
      }

      if (isHome) {
        // Fetch unread announcements
        const { data: announcements } = await supabase.from('inbox').select('id').is('user_id', null);
        const { data: readAnnouncements } = await supabase.from('announcement_reads').select('announcement_id').eq('user_id', user.id);
        setAnnounceUnread((announcements?.length || 0) - (readAnnouncements?.length || 0));
      }
    };

    fetchData();

    // Listen for real-time updates (XP/Streak changes)
    const sub = DeviceEventEmitter.addListener('wallet_updated', fetchData);

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [isHome]);

  const handleClaimDaily = async () => {
    if (countdown > 0) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Update wallet balance and last claim time in Supabase
      const { data: profile } = await supabase.from('profiles').select('wallet_balance').eq('id', user.id).single();
      const currentBalance = profile?.wallet_balance || 0;
      const newBalance = currentBalance + 10;

      const { error } = await supabase
        .from('profiles')
        .update({ 
          wallet_balance: newBalance,
          last_daily_claim: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      // 2. Log transaction
      await supabase.from('transactions').insert({
        player_id: user.id,
        amount: 10,
        type: 'bonus',
        status: 'completed',
        description: 'Daily login bonus'
      });

      // 3. Show animation & Notify UI
      setShowReward(true);
      setCountdown(24 * 60 * 60); // Start 24h countdown
      DeviceEventEmitter.emit('wallet_updated');
    } catch (err) {
      console.error('Error claiming daily bonus:', err);
    }
  };

  const handleClaimStreak = async () => {
    if (streak < 3) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const xpReward = streak * 100;
      const newStreak = Math.max(0, streak - 3);

      const { data: profile } = await supabase.from('profiles').select('xp, xp_next_level').eq('id', user.id).single();
      if (!profile) return;

      const newXp = (profile.xp || 0) + xpReward;

      await supabase.from('profiles').update({ xp: newXp, streak: newStreak }).eq('id', user.id);

      setClaimedXp(xpReward);
      setStreak(newStreak);
      setShowStreakReward(true);
      DeviceEventEmitter.emit('wallet_updated');
    } catch (err) {
      console.error('Error claiming streak XP:', err);
    }
  };

  return (
    <View style={[styles.root, !isHome && { width: 168 }]}>
      {/* Top border with glow */}
      <View style={styles.topBorder} />
      <View style={styles.topBorderGlow} />

      <View style={styles.bar}>

        {/* ── MEMBER ── */}
        <BarItem accentColor={C.gold} highlight isLast={!isHome} onPress={() => DeviceEventEmitter.emit('open_member')}>
          <View style={styles.iconWrap}>
            <CrownIcon />
          </View>
          <View style={styles.textBlock}>
            <View style={styles.labelRow}>
              <GlowDot color={C.gold} size={5} />
              <Text style={[styles.label, { color: C.goldBright }]}>MEMBER</Text>
            </View>
            <Text style={styles.sub}>Ludo Fusion Hub</Text>
            <View style={[styles.pill, { borderColor: C.goldBorder, backgroundColor: C.goldSoft }]}>
              <Text style={[styles.pillText, { color: C.gold }]}>{expiryString}</Text>
            </View>
          </View>
          <Svg width={6} height={10} viewBox="0 0 6 10">
            <Polyline points="1,1.5 4.5,5 1,8.5" stroke={C.gold} strokeWidth={1.4} strokeLinecap="round" fill="none" />
          </Svg>
        </BarItem>

        {isHome && (
          <>

        {/* ── DAILY BONUS ── */}
        <BarItem accentColor={C.gold} onPress={handleClaimDaily}>
          <View style={styles.iconWrap}>
            <GiftIcon />
          </View>
          <View style={styles.textBlock}>
            <View style={styles.labelRow}>
              <GlowDot color={C.goldBright} size={5} />
              <Text style={styles.label}>DAILY BONUS</Text>
            </View>
            <Text style={styles.sub}>Your reward awaits</Text>
            <ClaimButton countdown={countdown} />
          </View>
        </BarItem>

        {/* ── REFER & EARN ── */}
        <BarItem accentColor={C.red} onPress={() => DeviceEventEmitter.emit('open_referral')}>
          <View style={styles.iconWrap}>
            <ReferIcon />
          </View>
          <View style={styles.textBlock}>
            <View style={styles.labelRow}>
              <GlowDot color={C.redBright} size={5} />
              <Text style={[styles.label, { color: C.redBright }]}>REFER &amp; EARN</Text>
            </View>
            <Text style={styles.sub}>Invite &amp; earn rewards</Text>
            <View style={[styles.pill, { borderColor: C.redBorder, backgroundColor: C.redGlow }]}>
              <Text style={[styles.pillText, { color: C.redBright }]}>INVITE NOW</Text>
            </View>
          </View>
        </BarItem>

        {/* ── WIN STREAK ── */}
        <BarItem accentColor={streak >= 3 ? C.gold : C.orange} onPress={streak >= 3 ? handleClaimStreak : undefined}>
          <View style={[styles.iconWrap, { marginBottom: 1 }]}>
            <FlameIcon />
          </View>
          <View style={styles.textBlock}>
            <View style={styles.labelRow}>
              <GlowDot color={streak >= 3 ? C.gold : C.orangeBright} size={5} />
              <Text style={[styles.label, { color: streak >= 3 ? C.gold : C.orangeBright }]}>{streak >= 3 ? 'CLAIM XP' : 'WIN STREAK'}</Text>
            </View>
            <Text style={styles.sub}>{streak >= 3 ? `${streak * 100} XP ready!` : '3 wins → bonus'}</Text>
            <StreakBar filled={streak % 3 || (streak > 0 && streak % 3 === 0 ? 3 : 0)} total={3} />
            <View style={styles.streakCount}>
              <Text style={[styles.pillText, { color: streak >= 3 ? C.gold : C.orange }]}>{streak % 3 || (streak > 0 && streak % 3 === 0 ? 3 : 0)} / 3</Text>
            </View>
          </View>
        </BarItem>

        {/* ── ANNOUNCEMENT ── */}
        <BarItem accentColor={C.blue} isLast onPress={() => DeviceEventEmitter.emit('open_inbox', { tab: 'announcement' })}>
          <View style={styles.iconWrap}>
            <View style={{ position: 'relative' }}>
              <MegaphoneIcon />
              {announceUnread > 0 && <Badge count={announceUnread} />}
            </View>
          </View>
          <View style={styles.textBlock}>
            <View style={styles.labelRow}>
              <GlowDot color={C.blue} size={5} />
              <Text style={[styles.label, { color: '#8AB4FF' }]}>ANNOUNCE</Text>
            </View>
            <Text style={styles.sub}>New tournament{'\n'}is live! Join now.</Text>
          </View>
          </BarItem>
          </>
        )}
      </View>

      {/* Global Searching Indicator */}
      <Animated.View 
        pointerEvents="none"
        style={[
          styles.searchingIndicator,
          { 
            transform: [{ translateY: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }], 
            opacity: searchAnim 
          }
        ]}
      >
        <LinearGradient
          colors={['#0A2318', '#050F09']}
          style={styles.searchingBadge}
        >
          <GlowDot color={C.green} size={6} />
          <Text style={styles.searchingText}>SEARCHING MATCH...</Text>
        </LinearGradient>
      </Animated.View>

      {showReward && (
        <RewardModal
          visible={showReward}
          onClose={() => setShowReward(false)}
          amount={10}
          prefix={gamblingEnabled ? '₦' : ''}
          subtitle={gamblingEnabled ? 'Daily login reward added to wallet' : 'Daily login bonus claimed'}
        />
      )}
      {showStreakReward && (
        <RewardModal
          visible={showStreakReward}
          onClose={() => setShowStreakReward(false)}
          amount={claimedXp}
          prefix="+"
          unit="XP"
          title="STREAK BONUS!"
          subtitle="Win streak reward claimed"
          icon="fire"
          color="#FF8C00"
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    marginTop: 2,
  },

  topBorder: {
    height: 1,
    backgroundColor: C.gold,
    opacity: 0.30,
  },
  topBorderGlow: {
    height: 3,
    backgroundColor: C.gold,
    opacity: 0.06,
    marginBottom: -3,
  },

  bar: {
    height: BAR_HEIGHT,
    backgroundColor: C.bg,
    flexDirection: 'row',
  },

  // ── Item ──
  item: {
    flex: 1,
  },
  itemInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingBottom: 3,
    paddingTop: 2,
    gap: 7,
    overflow: 'hidden',
  },
  topAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.75,
  },
  topGlow: {
    position: 'absolute',
    top: 2,
    left: 0,
    right: 0,
    height: 10,
    opacity: 0.05,
  },

  // ── Icon ──
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // ── Text ──
  textBlock: {
    flex: 1,
    paddingTop: 1,
    gap: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    color: C.gold,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.7,
    lineHeight: 12,
  },
  sub: {
    color: C.textMuted,
    fontSize: 8,
    lineHeight: 11,
  },

  // ── Pill ──
  pill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    marginTop: 3,
  },
  pillText: {
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  // ── Claim btn ──
  claimBtn: {
    alignSelf: 'flex-start',
    backgroundColor: C.gold,
    borderRadius: 4,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginTop: 3,
    overflow: 'hidden',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
    elevation: 4,
  },
  claimText: {
    color: '#1A0800',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  claimBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.1)',
  },
  claimTextDisabled: {
    color: 'rgba(212,175,55,0.4)',
    fontSize: 7.5,
    fontWeight: '800',
  },

  // ── Streak ──
  streakRow: {
    flexDirection: 'row',
    marginTop: 4,
    alignItems: 'center',
  },
  streakSeg: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  streakFilled: {
    flex: 1,
    backgroundColor: C.orange,
    borderRadius: 3,
    shadowColor: C.orange,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  streakShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderRadius: 2,
  },
  streakEmpty: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  streakCount: {
    marginTop: 2,
  },

  // ── Badge ──
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: C.red,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: C.bg,
    shadowColor: C.red,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 5,
    elevation: 5,
    paddingHorizontal: 2,
  },
  badgeText: {
    color: '#000',
    fontSize: 7,
    fontWeight: '900',
    lineHeight: 10,
  },

  // ── Searching Indicator ──
  searchingIndicator: {
    position: 'absolute',
    top: -24,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  searchingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(61,214,140,0.3)',
    gap: 10,
    shadowColor: '#3DD68C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 10,
  },
  searchingText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#3DD68C',
    letterSpacing: 1.5,
  },
});