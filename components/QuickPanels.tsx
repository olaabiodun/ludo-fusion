import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
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
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999 }]}>
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
    </View>
  );
}

const ps = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 9999 },
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

function RewardDay({ r, index }: { r: any; index: number }) {
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
  const [rewards, setRewards] = useState<any[]>([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  const fetchRewards = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch reward definitions
      const { data: defs } = await supabase.from('daily_rewards').select('*').order('day_number', { ascending: true });
      // Fetch user claims
      const { data: claims } = await supabase.from('user_daily_claims').select('day_number').eq('user_id', user.id);
      // Fetch user streak
      const { data: profile } = await supabase.from('profiles').select('streak').eq('id', user.id).single();

      if (defs) {
        const claimSet = new Set(claims?.map(c => c.day_number));
        const lastClaimed = Math.max(0, ...Array.from(claimSet));
        const nextToClaim = lastClaimed + 1;

        const mapped = defs.map(d => ({
          day: d.day_number,
          label: d.label,
          icon: d.icon,
          color: d.color,
          claimed: claimSet.has(d.day_number),
          today: d.day_number === nextToClaim
        }));
        setRewards(mapped);
      }
      if (profile) setStreak(profile.streak || 0);
    } catch (err) {
      console.error('Error fetching rewards:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) fetchRewards();
  }, [visible]);

  const handleClaim = async () => {
    const todayReward = rewards.find(r => r.today);
    if (!todayReward || claiming) return;

    setClaiming(true);
    try {
      const { data, error } = await supabase.rpc('claim_daily_reward', { p_day: todayReward.day });
      if (error) throw error;
      
      // Refresh
      await fetchRewards();
      alert(`Success! Claimed ${todayReward.label}`);
    } catch (err: any) {
      alert(err.message || 'Failed to claim reward');
    } finally {
      setClaiming(false);
    }
  };

  const todayReward = rewards.find(r => r.today);

  return (
    <Panel visible={visible} onClose={onClose} title="Daily Rewards" icon="gift-outline">
      <ScrollView style={{ maxHeight: 390 }} contentContainerStyle={gps.body} showsVerticalScrollIndicator={false}>
        <View style={gps.streakRow}>
          <MaterialCommunityIcons name="fire" size={20} color={GOLD} />
          <Text style={gps.streakText}>Login streak — keep it going!</Text>
          <Text style={gps.streakVal}>{streak}🔥</Text>
        </View>
        <View style={gps.grid}>
          {loading ? (
            <Text style={{ color: MUTED, fontSize: 12, textAlign: 'center', width: '100%', marginVertical: 20 }}>Loading rewards...</Text>
          ) : (
            rewards.map((r, i) => <RewardDay key={r.day} r={r} index={i} />)
          )}
        </View>
        {todayReward && (
          <TouchableOpacity 
            style={[gps.claimBtn, claiming && { opacity: 0.6 }]} 
            onPress={handleClaim}
            disabled={claiming}
            activeOpacity={0.8}
          >
            <Text style={gps.claimBtnText}>{claiming ? 'CLAIMING...' : `CLAIM DAY ${todayReward.day} REWARD`}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </Panel>
  );
}


// ── MISSIONS PANEL ────────────────────────────────────────────────────────────

function MissionRow({ m, index, onClaim, claiming }: { m: any; index: number; onClaim: () => void; claiming: boolean }) {
  const pct = Math.min(1, m.progress / m.target);
  const done = m.is_claimed;
  const canClaim = m.progress >= m.target && !m.is_claimed;
  const barWidth = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(op, { toValue: 1, delay: index * 70, duration: 250, useNativeDriver: true }),
      Animated.timing(barWidth, { toValue: pct, delay: index * 70 + 200, duration: 500, useNativeDriver: false }),
    ]).start();
  }, [pct]);

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
        <Text style={mps.progress}>{m.progress}/{m.target} · {m.xp_reward} XP</Text>
      </View>
      <TouchableOpacity 
        onPress={onClaim}
        disabled={!canClaim || claiming}
        style={[
          mps.reward, 
          done && { backgroundColor: 'rgba(87,208,139,0.12)', borderColor: 'rgba(87,208,139,0.3)' },
          canClaim && { backgroundColor: GOLD, borderColor: GOLD }
        ]}
      >
        <Text style={[
          mps.rewardText, 
          done && { color: SUCCESS },
          canClaim && { color: '#000' }
        ]}>
          {claiming ? '...' : (done ? 'DONE' : (canClaim ? 'CLAIM' : `₦${m.reward}`))}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const mps = StyleSheet.create({
  body: { padding: 12, paddingTop: 8, gap: 8, height: '63%' },
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
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const fetchMissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: allMissions } = await supabase.from('missions').select('*');
      const { data: userMissions } = await supabase.from('user_missions').select('*').eq('user_id', user.id);

      if (allMissions) {
        const userMap = new Map(userMissions?.map(um => [um.mission_id, um]));
        const mapped = allMissions.map(m => {
          const um = userMap.get(m.id);
          return {
            ...m,
            progress: um?.progress || 0,
            is_claimed: um?.is_claimed || false,
          };
        });
        setMissions(mapped);
      }
    } catch (err) {
      console.error('Error fetching missions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) fetchMissions();
  }, [visible]);

  const handleClaim = async (missionId: string) => {
    if (claimingId) return;
    setClaimingId(missionId);
    try {
      const { data, error } = await supabase.rpc('claim_mission_reward', { p_mission_id: missionId });
      if (error) throw error;
      await fetchMissions();
      alert(`Claimed reward! +${data.reward} Coins, +${data.xp} XP`);
    } catch (err: any) {
      alert(err.message || 'Failed to claim mission reward');
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <Panel visible={visible} onClose={onClose} title="Missions" icon="clipboard-text-outline" accentColor="#A78BFA">
      <ScrollView style={{ maxHeight: 390 }} contentContainerStyle={mps.body} showsVerticalScrollIndicator={false}>
        <View style={mps.header}>
          <Text style={mps.headerSub}>Daily · resets midnight</Text>
          <TouchableOpacity style={mps.refreshBtn} onPress={fetchMissions} activeOpacity={0.8}>
            <MaterialCommunityIcons name="refresh" size={10} color={GOLD} />
            <Text style={mps.refreshText}>REFRESH</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <Text style={{ color: MUTED, fontSize: 12, textAlign: 'center', marginVertical: 20 }}>Loading missions...</Text>
        ) : (
          missions.map((m, i) => (
            <MissionRow 
              key={m.id} 
              m={m} 
              index={i} 
              onClaim={() => handleClaim(m.id)}
              claiming={claimingId === m.id}
            />
          ))
        )}
      </ScrollView>
    </Panel>
  );
}
