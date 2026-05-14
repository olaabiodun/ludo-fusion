import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const GOLD = '#D4AF37';
const GOLD_SOFT = 'rgba(212,175,55,0.13)';
const GOLD_BORDER = 'rgba(212,175,55,0.28)';
const SURFACE = 'rgba(7,21,15,0.97)';
const DIVIDER = 'rgba(255,255,255,0.06)';
const TEXT = '#F5EFD8';
const MUTED = 'rgba(245,239,216,0.55)';
const FAINT = 'rgba(245,239,216,0.28)';
const SUCCESS = '#57D08B';
const DANGER = '#F26B6B';
const W = Dimensions.get('window').width;

// ── Shared animated panel shell ──────────────────────────────────────────────

function Panel({
  visible,
  onClose,
  title,
  icon,
  accentColor = GOLD,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  icon: string;
  accentColor?: string;
  children: React.ReactNode;
}) {
  const slideY = useRef(new Animated.Value(-20)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, damping: 18, stiffness: 220, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      slideY.setValue(-20);
      opacity.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <Pressable style={ps.backdrop} onPress={onClose}>
        <Animated.View
          style={[ps.panel, { opacity, transform: [{ translateY: slideY }] }]}
          onStartShouldSetResponder={() => true}
        >
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(4,22,13,0.98)', 'rgba(2,12,7,0.98)']}
            style={StyleSheet.absoluteFill}
          />
          {/* Header */}
          <View style={[ps.header, { borderBottomColor: GOLD_BORDER }]}>
            <View style={[ps.headerIcon, { backgroundColor: GOLD_SOFT, borderColor: GOLD_BORDER }]}>
              <MaterialCommunityIcons name={icon as any} size={14} color={accentColor} />
            </View>
            <Text style={[ps.headerTitle, { color: accentColor }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={ps.closeBtn} activeOpacity={0.7}>
              <MaterialCommunityIcons name="close" size={14} color={MUTED} />
            </TouchableOpacity>
          </View>
          {children}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const ps = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  panel: {
    position: 'absolute',
    top: 52,
    right: 8,
    width: Math.min(W * 0.88, 340),
    maxHeight: 480,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  headerIcon: {
    width: 26, height: 26,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 24, height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ── GIFT / DAILY REWARD PANEL ─────────────────────────────────────────────────

const REWARDS = [
  { day: 1, label: '₦50',    icon: 'cash',          color: SUCCESS,  claimed: true  },
  { day: 2, label: '₦100',   icon: 'cash-multiple',  color: SUCCESS,  claimed: true  },
  { day: 3, label: 'XP ×2',  icon: 'star-shooting',  color: '#A78BFA',claimed: true  },
  { day: 4, label: '₦200',   icon: 'cash',           color: GOLD,     claimed: false, today: true },
  { day: 5, label: '₦300',   icon: 'cash-multiple',  color: GOLD,     claimed: false },
  { day: 6, label: 'XP ×3',  icon: 'star-shooting',  color: '#A78BFA',claimed: false },
  { day: 7, label: '₦1,000', icon: 'trophy',         color: GOLD,     claimed: false },
];

function RewardDay({ r, index }: { r: typeof REWARDS[0]; index: number }) {
  const scale = useRef(new Animated.Value(0.85)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, delay: index * 50, damping: 14, stiffness: 200, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <View style={[
        gps.dayCard,
        r.claimed && gps.dayClaimed,
        r.today && { borderColor: GOLD, borderWidth: 1.5 },
      ]}>
        {r.today && (
          <View style={gps.todayBadge}>
            <Text style={gps.todayText}>TODAY</Text>
          </View>
        )}
        <MaterialCommunityIcons
          name={r.icon as any}
          size={20}
          color={r.claimed ? 'rgba(255,255,255,0.25)' : r.color}
        />
        <Text style={[gps.dayLabel, r.claimed && { color: FAINT }]}>{r.label}</Text>
        <Text style={gps.dayNum}>Day {r.day}</Text>
        {r.claimed && (
          <View style={gps.checkOverlay}>
            <MaterialCommunityIcons name="check-circle" size={16} color={SUCCESS} />
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const gps = StyleSheet.create({
  body: { padding: 12, gap: 12 },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: GOLD_SOFT,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    padding: 10,
  },
  streakText: { flex: 1, color: TEXT, fontSize: 11, fontWeight: '700' },
  streakVal: { color: GOLD, fontSize: 18, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'space-between' },
  dayCard: {
    width: '13%',
    minWidth: 40,
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: DIVIDER,
    alignItems: 'center',
    gap: 3,
    position: 'relative',
  },
  dayClaimed: { backgroundColor: 'rgba(255,255,255,0.02)', opacity: 0.6 },
  dayLabel: { color: TEXT, fontSize: 8, fontWeight: '800', textAlign: 'center' },
  dayNum: { color: FAINT, fontSize: 7, fontWeight: '600' },
  todayBadge: {
    position: 'absolute', top: -7, alignSelf: 'center',
    backgroundColor: GOLD, borderRadius: 4,
    paddingHorizontal: 4, paddingVertical: 1,
  },
  todayText: { color: '#000', fontSize: 6, fontWeight: '900' },
  checkOverlay: {
    position: 'absolute', top: 4, right: 4,
  },
  claimBtn: {
    backgroundColor: GOLD,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  claimBtnText: { color: '#000', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
});

export function GiftPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Panel visible={visible} onClose={onClose} title="Daily Rewards" icon="gift-outline">
      <ScrollView style={{ maxHeight: 390 }} contentContainerStyle={gps.body} showsVerticalScrollIndicator={false}>
        <View style={gps.streakRow}>
          <MaterialCommunityIcons name="fire" size={20} color={GOLD} />
          <Text style={gps.streakText}>Login streak — keep it going!</Text>
          <Text style={gps.streakVal}>3🔥</Text>
        </View>
        <View style={gps.grid}>
          {REWARDS.map((r, i) => <RewardDay key={r.day} r={r} index={i} />)}
        </View>
        <TouchableOpacity style={gps.claimBtn} activeOpacity={0.8}>
          <Text style={gps.claimBtnText}>CLAIM DAY 4 REWARD</Text>
        </TouchableOpacity>
      </ScrollView>
    </Panel>
  );
}

// ── LEADERBOARD PANEL ─────────────────────────────────────────────────────────

const LEADERS = [
  { rank: 1, name: 'AbujaBoss',   earnings: '₦84,200', winRate: '91%', badge: '🥇' },
  { rank: 2, name: 'FujiQueen',   earnings: '₦61,500', winRate: '88%', badge: '🥈' },
  { rank: 3, name: 'DiceSlayer',  earnings: '₦49,800', winRate: '82%', badge: '🥉' },
  { rank: 4, name: 'LagosKing',   earnings: '₦38,100', winRate: '77%', badge: null },
  { rank: 5, name: 'ZikoRoyal',   earnings: '₦27,400', winRate: '73%', badge: null },
  { rank: 6, name: 'CardEze',     earnings: '₦19,900', winRate: '69%', badge: null },
  { rank: 7, name: 'KingObi',     earnings: '₦14,200', winRate: '65%', badge: null },
];

function LeaderRow({ p, index }: { p: typeof LEADERS[0]; index: number }) {
  const x = useRef(new Animated.Value(-20)).current;
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(x, { toValue: 0, delay: index * 60, damping: 16, stiffness: 180, useNativeDriver: true }),
      Animated.timing(op, { toValue: 1, delay: index * 60, duration: 250, useNativeDriver: true }),
    ]).start();
  }, []);

  const isTop3 = p.rank <= 3;
  return (
    <Animated.View style={[lps.row, isTop3 && lps.rowTop, { opacity: op, transform: [{ translateX: x }] }]}>
      <Text style={lps.rankBadge}>{p.badge || `#${p.rank}`}</Text>
      <View style={[lps.avatar, isTop3 && { borderColor: GOLD }]}>
        <Text style={lps.avatarText}>{p.name.substring(0, 2).toUpperCase()}</Text>
      </View>
      <Text style={[lps.name, isTop3 && { color: TEXT }]} numberOfLines={1}>{p.name}</Text>
      <View style={lps.meta}>
        <Text style={[lps.earnings, { color: isTop3 ? GOLD : MUTED }]}>{p.earnings}</Text>
        <Text style={lps.winRate}>{p.winRate} WR</Text>
      </View>
    </Animated.View>
  );
}

const lps = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: 6,
    padding: 12,
    paddingBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: DIVIDER,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
  },
  tabActive: { backgroundColor: GOLD_SOFT, borderColor: GOLD_BORDER },
  tabText: { color: MUTED, fontSize: 10, fontWeight: '700' },
  tabTextActive: { color: GOLD },
  list: { paddingHorizontal: 12, paddingBottom: 12, gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: DIVIDER,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  rowTop: { backgroundColor: GOLD_SOFT, borderColor: GOLD_BORDER },
  rankBadge: { fontSize: 14, width: 24, textAlign: 'center' },
  avatar: {
    width: 28, height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: GOLD, fontSize: 9, fontWeight: '900' },
  name: { flex: 1, color: MUTED, fontSize: 11, fontWeight: '700' },
  meta: { alignItems: 'flex-end', gap: 1 },
  earnings: { fontSize: 11, fontWeight: '800' },
  winRate: { color: FAINT, fontSize: 8, fontWeight: '600' },
  youRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 12,
    marginTop: 0,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(87,208,139,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(87,208,139,0.25)',
  },
  youLabel: { color: SUCCESS, fontSize: 10, fontWeight: '900', flex: 1 },
  youRank: { color: SUCCESS, fontSize: 14, fontWeight: '900' },
});

export function LeaderboardPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [tab, setTab] = React.useState<'weekly' | 'alltime'>('weekly');
  return (
    <Panel visible={visible} onClose={onClose} title="Leaderboard" icon="trophy-outline" accentColor={GOLD}>
      <View style={lps.tabs}>
        {(['weekly', 'alltime'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[lps.tab, tab === t && lps.tabActive]}
            onPress={() => setTab(t)}
            activeOpacity={0.8}
          >
            <Text style={[lps.tabText, tab === t && lps.tabTextActive]}>
              {t === 'weekly' ? '🗓 This Week' : '🏆 All-Time'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={lps.list} showsVerticalScrollIndicator={false}>
        {LEADERS.map((p, i) => <LeaderRow key={p.rank} p={p} index={i} />)}
      </ScrollView>
      <View style={lps.youRow}>
        <MaterialCommunityIcons name="account-circle-outline" size={16} color={SUCCESS} />
        <Text style={lps.youLabel}>Your position</Text>
        <Text style={lps.youRank}>#42</Text>
      </View>
    </Panel>
  );
}

// ── MISSIONS PANEL ────────────────────────────────────────────────────────────

const MISSIONS = [
  { id: 1, title: 'Win 3 Ludo games',      reward: '₦150',  xp: 120, progress: 2, total: 3,  icon: 'dice-5',           color: GOLD    },
  { id: 2, title: 'Play 5 Whot rounds',    reward: '₦100',  xp: 80,  progress: 5, total: 5,  icon: 'cards-playing-outline', color: DANGER },
  { id: 3, title: 'Top the leaderboard',   reward: '₦500',  xp: 300, progress: 0, total: 1,  icon: 'podium',           color: GOLD    },
  { id: 4, title: 'Invite a friend',        reward: '₦200',  xp: 150, progress: 0, total: 1,  icon: 'account-plus',     color: SUCCESS },
  { id: 5, title: 'Win a ₦500 stake game', reward: '₦250',  xp: 200, progress: 1, total: 1,  icon: 'cash',             color: SUCCESS },
];

function MissionRow({ m, index }: { m: typeof MISSIONS[0]; index: number }) {
  const pct = Math.min(1, m.progress / m.total);
  const done = pct >= 1;
  const barWidth = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(op, { toValue: 1, delay: index * 70, duration: 250, useNativeDriver: true }),
      Animated.timing(barWidth, { toValue: pct, delay: index * 70 + 200, duration: 500, useNativeDriver: false }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[mps.row, done && mps.rowDone, { opacity: op }]}>
      <View style={[mps.iconBox, { backgroundColor: `${m.color}18`, borderColor: `${m.color}44` }]}>
        <MaterialCommunityIcons name={m.icon as any} size={16} color={done ? 'rgba(255,255,255,0.3)' : m.color} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[mps.title, done && { color: FAINT }]} numberOfLines={1}>{m.title}</Text>
          {done && <MaterialCommunityIcons name="check-circle" size={12} color={SUCCESS} />}
        </View>
        <View style={mps.barBg}>
          <Animated.View style={[mps.barFill, {
            width: barWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            backgroundColor: done ? SUCCESS : m.color,
          }]} />
        </View>
        <Text style={mps.progress}>{m.progress}/{m.total} · {m.xp} XP</Text>
      </View>
      <View style={[mps.reward, done && { backgroundColor: 'rgba(87,208,139,0.12)', borderColor: 'rgba(87,208,139,0.3)' }]}>
        <Text style={[mps.rewardText, done && { color: SUCCESS }]}>{done ? 'DONE' : m.reward}</Text>
      </View>
    </Animated.View>
  );
}

const mps = StyleSheet.create({
  body: { padding: 12, paddingTop: 8, gap: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerSub: { color: MUTED, fontSize: 10, fontWeight: '600' },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: GOLD_SOFT,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
  },
  refreshText: { color: GOLD, fontSize: 9, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: DIVIDER,
    padding: 10,
  },
  rowDone: { opacity: 0.65 },
  iconBox: {
    width: 34, height: 34,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: TEXT, fontSize: 11, fontWeight: '700', flex: 1 },
  barBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 2 },
  progress: { color: FAINT, fontSize: 8, fontWeight: '600' },
  reward: {
    backgroundColor: GOLD_SOFT,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    paddingHorizontal: 7,
    paddingVertical: 3,
    minWidth: 44,
    alignItems: 'center',
  },
  rewardText: { color: GOLD, fontSize: 9, fontWeight: '900' },
});

export function MissionsPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Panel visible={visible} onClose={onClose} title="Missions" icon="clipboard-text-outline" accentColor="#A78BFA">
      <ScrollView style={{ maxHeight: 390 }} contentContainerStyle={mps.body} showsVerticalScrollIndicator={false}>
        <View style={mps.header}>
          <Text style={mps.headerSub}>Daily · resets midnight</Text>
          <TouchableOpacity style={mps.refreshBtn} activeOpacity={0.8}>
            <MaterialCommunityIcons name="refresh" size={10} color={GOLD} />
            <Text style={mps.refreshText}>REFRESH</Text>
          </TouchableOpacity>
        </View>
        {MISSIONS.map((m, i) => <MissionRow key={m.id} m={m} index={i} />)}
      </ScrollView>
    </Panel>
  );
}
