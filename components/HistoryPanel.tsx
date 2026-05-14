import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  DeviceEventEmitter,
  Share,
  Alert,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInRight,
  FadeInUp,
  Layout,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const C = {
  gold: '#D4AF37',
  goldSoft: 'rgba(212,175,55,0.08)',
  goldBorder: 'rgba(212,175,55,0.2)',
  surface: 'rgba(7, 21, 15, 0.85)',
  textPrimary: '#F5EFD8',
  textMuted: 'rgba(245,239,216,0.5)',
  success: '#57D08B',
  danger: '#F26B6B',
  divider: 'rgba(255,255,255,0.04)',
};

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type GameRecord = {
  id: string;
  game_type: string;
  table_name: string;
  stake: number;
  win_amount: number;
  result: string;
  created_at: string;
};

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

function formatAmount(amount: number, isWin: boolean): string {
  const abs = Math.abs(amount);
  const formatted = abs >= 1000 ? `₦${(abs / 1000).toFixed(1)}k` : `₦${abs}`;
  return isWin ? `+${formatted}` : `-${formatted}`;
}

function getTierLabel(winRate: number): string {
  if (winRate >= 80) return 'MYTHIC';
  if (winRate >= 70) return 'LEGENDARY';
  if (winRate >= 60) return 'ELITE';
  if (winRate >= 50) return 'RISING STAR';
  return 'NEWCOMER';
}

// ─── Circular Win-Rate Progress ───────────────────────────────────────────────
function CompactProgress({ progress }: { progress: number }) {
  const size = 50;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={C.gold} strokeWidth={strokeWidth} fill="none" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      </Svg>
      <Text style={{ color: C.gold, fontSize: 11, fontWeight: '900', position: 'absolute' }}>{progress}%</Text>
    </View>
  );
}

// ─── Individual History Row ───────────────────────────────────────────────────
function HistoryRow({ item, delay }: { item: GameRecord; delay: number }) {
  const isWin = item.result === 'win';
  
  const getGameMeta = () => {
    switch (item.game_type) {
      case 'ludo':
        return { icon: 'dice-multiple' as IconName, label: 'Ludo Royale' };
      case 'whot':
        return { icon: 'cards-playing-outline' as IconName, label: 'Whot Classic' };
      case 'snake_ladder':
        return { icon: 'snake' as IconName, label: 'Snake & Ladder' };
      default:
        return { icon: 'controller-classic-outline' as IconName, label: 'Match' };
    }
  };

  const { icon, label } = getGameMeta();

  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} layout={Layout.springify()} style={s.row}>
      <View style={[s.rowIcon, { backgroundColor: isWin ? 'rgba(87,208,139,0.1)' : 'rgba(242,107,107,0.1)' }]}>
        <MaterialCommunityIcons name={icon} size={16} color={isWin ? C.success : C.danger} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>{label}</Text>
        <Text style={s.rowDate}>{item.table_name}  ·  {formatDate(item.created_at)}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[s.rowAmount, { color: isWin ? C.success : C.danger }]}>
          {formatAmount(isWin ? item.win_amount : item.stake, isWin)}
        </Text>
        <Text style={s.rowStatus}>{isWin ? 'VICTORY' : 'DEFEAT'}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function HistoryPanel() {
  const [tab, setTab] = useState(0);
  const [allGames, setAllGames] = useState<GameRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Career stats computed from data
  const totalWins     = allGames.filter(g => g.result === 'win').length;
  const totalMatches  = allGames.length;
  const winRate       = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;
  const totalEarnings = allGames.reduce((sum, g) => g.result === 'win' ? sum + Number(g.win_amount) : sum - Number(g.stake), 0);
  const tierLabel     = getTierLabel(winRate);

  // Compute current streak (consecutive wins from most recent)
  const streak = (() => {
    let count = 0;
    for (const g of allGames) {
      if (g.result === 'win') count++;
      else break;
    }
    return count;
  })();

  const filteredGames =
    tab === 0 ? allGames :
    tab === 1 ? allGames.filter(g => g.result === 'win') :
    allGames.filter(g => g.result !== 'win');

  const HISTORY_CACHE_KEY = 'ludo_fusion_history_cache';

  useEffect(() => {
    async function load() {
      // 1. Load from cache
      try {
        const cached = await AsyncStorage.getItem(HISTORY_CACHE_KEY);
        if (cached) {
          setAllGames(JSON.parse(cached));
          setLoading(false);
        }
      } catch (e) {
        console.warn('History cache load error:', e);
      }

      // 2. Fetch fresh
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from('games')
          .select('*')
          .eq('player_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (data) {
          setAllGames(data as GameRecord[]);
          AsyncStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(data));
        }
      } catch (e) {
        console.error('HistoryPanel refresh error:', e);
      } finally {
        setLoading(false);
      }
    }
    load();

    const sub = DeviceEventEmitter.addListener('wallet_updated', load);
    const gameSub = DeviceEventEmitter.addListener('game_completed', load);
    return () => {
      sub.remove();
      gameSub.remove();
    };
  }, []);
  const handleExport = async () => {
    if (allGames.length === 0) {
      Alert.alert("No Data", "There is no history to export yet.");
      return;
    }
    
    let report = "DUFUHS GAME HISTORY REPORT\n";
    report += "--------------------------\n";
    report += `Total Matches: ${totalMatches}\n`;
    report += `Win Rate: ${winRate}%\n`;
    report += `Net Earnings: ₦${totalEarnings}\n\n`;
    report += "DATE | GAME | MODE | RESULT | STAKE | WINNINGS\n";
    
    allGames.forEach(g => {
      const date = new Date(g.created_at).toLocaleDateString();
      const game = g.game_type === 'ludo' ? 'Ludo' : g.game_type === 'whot' ? 'Whot' : 'Snake';
      report += `${date} | ${game} | ${g.table_name} | ${g.result.toUpperCase()} | ₦${g.stake} | ₦${g.win_amount}\n`;
    });

    try {
      await Share.share({
        message: report,
        title: 'My Game History'
      });
    } catch (error) {
      Alert.alert("Error", "Failed to export history.");
    }
  };

  if (loading && allGames.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={C.gold} />
      </View>
    );
  }

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.layout}>

        {/* ── Left: History List ── */}
        <View style={s.historyCol}>
          <Animated.View entering={FadeInUp.springify()} style={s.header}>
            <View>
              <Text style={s.eyebrow}>ACTIVITY</Text>
              <Text style={s.title}>History</Text>
            </View>
            <View style={s.tabs}>
              {['All', 'Wins', 'Losses'].map((t, i) => (
                <TouchableOpacity key={t} onPress={() => setTab(i)} style={[s.tab, tab === i && s.tabActive]}>
                  <Text style={[s.tabText, tab === i && s.tabTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          <View style={s.list}>
            {filteredGames.length > 0 ? (
              filteredGames.map((r, i) => <HistoryRow key={r.id} item={r} delay={200 + i * 50} />)
            ) : (
              <View style={s.emptyState}>
                <MaterialCommunityIcons name="history" size={32} color={C.gold} style={{ opacity: 0.4 }} />
                <Text style={s.emptyText}>
                  {tab === 0 ? "No matches played yet.\nGet out there and compete!" :
                   tab === 1 ? "No wins recorded yet.\nYour first victory is coming!" :
                   "No losses recorded.\nKeep up the clean run!"}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Right: Stats Panel ── */}
        <View style={s.statsCol}>
          <Animated.View entering={FadeInRight.delay(300).springify()} style={s.statsPanel}>
            <Text style={s.panelTitle}>CAREER STATS</Text>

            <View style={s.hero}>
              <CompactProgress progress={winRate} />
              <View>
                <Text style={s.rankLabel}>
                  Rank: <Text style={{ color: C.gold }}>{tierLabel}</Text>
                </Text>
                <Text style={s.subLabel}>{totalWins} wins / {totalMatches} matches</Text>
              </View>
            </View>

            <View style={s.divider} />

            <View style={s.grid}>
              <View style={s.gridItem}>
                <Text style={s.gridLabel}>WINS</Text>
                <Text style={s.gridValue}>{totalWins}</Text>
              </View>
              <View style={s.gridItem}>
                <Text style={s.gridLabel}>EARNINGS</Text>
                <Text style={s.gridValue}>
                  {totalEarnings >= 1000 ? `₦${(totalEarnings / 1000).toFixed(1)}k` : `₦${totalEarnings}`}
                </Text>
              </View>
              <View style={s.gridItem}>
                <Text style={s.gridLabel}>STREAK</Text>
                <Text style={s.gridValue}>{streak}</Text>
              </View>
              <View style={s.gridItem}>
                <Text style={s.gridLabel}>TOTAL</Text>
                <Text style={s.gridValue}>{totalMatches}</Text>
              </View>
            </View>

            <TouchableOpacity style={s.exportBtn} onPress={handleExport}>
              <MaterialCommunityIcons name="download" size={14} color={C.gold} />
              <Text style={s.exportText}>EXPORT REPORT</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, paddingTop: 5 },
  content: { paddingBottom: 20, paddingHorizontal: 12, paddingTop: 8 },
  layout: { flexDirection: 'row', gap: 10 },
  historyCol: { flex: 1.6 },
  statsCol: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 12, backgroundColor: C.surface, borderRadius: 16,
    borderWidth: 1, borderColor: C.goldBorder, marginBottom: 8,
  },
  eyebrow: { color: C.gold, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#fff', fontSize: 18, fontWeight: '900' },
  tabs: { flexDirection: 'row', gap: 4, backgroundColor: 'rgba(0,0,0,0.3)', padding: 3, borderRadius: 10 },
  tab: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7 },
  tabActive: { backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.goldBorder },
  tabText: { color: C.textMuted, fontSize: 10, fontWeight: '700' },
  tabTextActive: { color: '#fff' },

  list: { gap: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 14,
    backgroundColor: C.surface, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', gap: 10,
  },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: '#fff', fontSize: 13, fontWeight: '700' },
  rowDate: { color: C.textMuted, fontSize: 10 },
  rowAmount: { fontSize: 13, fontWeight: '900' },
  rowStatus: { color: 'rgba(255,255,255,0.2)', fontSize: 8, fontWeight: '900' },

  emptyState: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  emptyText: { color: C.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18 },

  statsPanel: {
    backgroundColor: C.surface, borderRadius: 18,
    borderWidth: 1, borderColor: C.goldBorder,
    padding: 16, gap: 12,
  },
  panelTitle: { color: C.gold, fontSize: 9, fontWeight: '900', opacity: 0.5, letterSpacing: 1 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rankLabel: { color: '#fff', fontSize: 14, fontWeight: '800' },
  subLabel: { color: C.success, fontSize: 10, fontWeight: '600' },
  divider: { height: 1, backgroundColor: C.divider },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridItem: { width: '47%', paddingVertical: 4 },
  gridLabel: { color: C.textMuted, fontSize: 8, fontWeight: '800' },
  gridValue: { color: '#fff', fontSize: 16, fontWeight: '900' },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: C.goldBorder,
  },
  exportText: { color: C.gold, fontSize: 10, fontWeight: '900' },
});
