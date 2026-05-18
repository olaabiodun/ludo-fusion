import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useGamblingEnabled } from '@/lib/GamblingContext';

const CACHE_KEYS = {
  PROFILE: 'ludo_fusion_profile_cache',
  GAMES: 'ludo_fusion_games_cache',
  STATS: 'ludo_fusion_stats_cache',
};

const C = {
  gold: '#D4AF37',
  goldSoft: 'rgba(212,175,55,0.16)',
  goldBorder: 'rgba(212,175,55,0.32)',
  surface: 'rgba(7, 21, 15, 0.86)',
  surfaceStrong: 'rgba(5, 16, 11, 0.92)',
  textPrimary: '#F5EFD8',
  textMuted: 'rgba(245,239,216,0.68)',
  success: '#57D08B',
  danger: '#F26B6B',
};

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  wallet_balance: number;
  level: number;
  xp: number;
  xp_next_level: number;
  streak: number;
  created_at: string;
};

type GameRecord = {
  id: string;
  game_type: string;
  table_name: string;
  win_amount: number;
  result: string;
  created_at: string;
};

type ProfileStats = {
  total_matches: number;
  total_wins: number;
  win_rate: number;
};

// ─── Tier System (scales with level) ────────────────────────────────────────
type TierInfo = {
  name: string;
  label: string;    // displayed as eyebrow title
  icon: IconName;
  color: string;    // primary accent color for this tier
  gradient: [string, string]; // avatar gradient
  minLevel: number;
  maxLevel: number;
  xpPerLevel: number;
};

const TIERS: TierInfo[] = [
  { name: 'newcomer',     label: 'NEWCOMER',        icon: 'star-outline',       color: '#A8A8B3', gradient: ['#2a2a3e', '#1a1a2e'], minLevel: 1,  maxLevel: 4,  xpPerLevel: 1000 },
  { name: 'rising_star',  label: 'RISING STAR',     icon: 'star-shooting',      color: '#4FC3F7', gradient: ['#0d47a1', '#1565c0'], minLevel: 5,  maxLevel: 9,  xpPerLevel: 1500 },
  { name: 'elite',        label: 'ELITE TIER',      icon: 'shield-star',        color: '#D4AF37', gradient: ['#1E5A39', '#0A2318'], minLevel: 10, maxLevel: 14, xpPerLevel: 2000 },
  { name: 'grand_master', label: 'GRAND MASTER',    icon: 'crown',              color: '#FF8C00', gradient: ['#7B1FA2', '#4A148C'], minLevel: 15, maxLevel: 19, xpPerLevel: 3000 },
  { name: 'legendary',    label: 'LEGENDARY',       icon: 'fire',               color: '#F44336', gradient: ['#B71C1C', '#7F0000'], minLevel: 20, maxLevel: 24, xpPerLevel: 4000 },
  { name: 'mythic_legend',label: 'MYTHIC LEGEND',   icon: 'lightning-bolt',     color: '#E040FB', gradient: ['#6A0080', '#38006b'], minLevel: 25, maxLevel: 999,xpPerLevel: 5000 },
];

function getTierInfo(level: number): TierInfo {
  return TIERS.slice().reverse().find(t => level >= t.minLevel) ?? TIERS[0];
}

function getLevelTitle(level: number): string {
  return getTierInfo(level).label;
}

const STATIC_BADGES: { label: string; icon: IconName }[] = [
  { label: 'Top 12%', icon: 'chart-line' },
  { label: 'Verified', icon: 'check-decagram' },
];

const ACHIEVEMENTS: { label: string; icon: IconName }[] = [
  { label: 'Champion', icon: 'crown' },
  { label: 'Sharp Defender', icon: 'shield-check' },
  { label: 'Hot Streak', icon: 'fire' },
  { label: 'Whot Master', icon: 'cards-playing-outline' },
];

const FAVORITE_MODES: { title: string; subtitle: string; icon: IconName }[] = [
  { title: 'Ludo Fusion', subtitle: 'Most played this week', icon: 'dice-multiple' },
  { title: 'Whot Classic', subtitle: 'Best strategic win rate', icon: 'cards-playing-outline' },
  { title: 'Squad Lobby', subtitle: 'Friends play every Friday', icon: 'account-group' },
];

function formatCurrency(amount: number, showNgn: boolean): string {
  if (showNgn) {
    if (Math.abs(amount) >= 1_000_000) return `NGN ${(amount / 1_000_000).toFixed(1)}M`;
    if (Math.abs(amount) >= 1_000) return `NGN ${(amount / 1_000).toFixed(1)}k`;
    return `NGN ${amount.toLocaleString()}`;
  }
  return `${Math.abs(amount).toLocaleString()} coins`;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function timeAgo(isoString: string): string {
  const now = Date.now();
  const diff = now - new Date(isoString).getTime();
  const hours = Math.floor(diff / 36e5);
  const days = Math.floor(diff / 864e5);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function getInitials(fullName: string | null, username: string | null): string {
  const name = fullName || username || 'Player';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}


export function ProfilePanel() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const gamblingEnabled = useGamblingEnabled();
  const [games, setGames] = useState<GameRecord[]>([]);
  const [stats, setStats] = useState<ProfileStats>({ total_matches: 0, total_wins: 0, win_rate: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // 1. Try loading from cache first
      try {
        const [cachedProfile, cachedGames, cachedStats] = await Promise.all([
          AsyncStorage.getItem(CACHE_KEYS.PROFILE),
          AsyncStorage.getItem(CACHE_KEYS.GAMES),
          AsyncStorage.getItem(CACHE_KEYS.STATS),
        ]);

        if (cachedProfile) setProfile(JSON.parse(cachedProfile));
        if (cachedGames) setGames(JSON.parse(cachedGames));
        if (cachedStats) setStats(JSON.parse(cachedStats));
        
        // If we have any cached data, we can stop showing the primary loading spinner
        if (cachedProfile) setLoading(false);
      } catch (e) {
        console.warn('Cache load error:', e);
      }

      // 2. Fetch fresh data from Supabase
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [pRes, gRes, sRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).single(),
          supabase.from('games').select('*').eq('player_id', user.id).order('created_at', { ascending: false }).limit(5),
          supabase.from('profile_stats').select('*').eq('player_id', user.id).single(),
        ]);

        if (pRes.data) {
          setProfile(pRes.data as Profile);
          AsyncStorage.setItem(CACHE_KEYS.PROFILE, JSON.stringify(pRes.data));
        }
        if (gRes.data) {
          setGames(gRes.data as GameRecord[]);
          AsyncStorage.setItem(CACHE_KEYS.GAMES, JSON.stringify(gRes.data));
        }
        if (sRes.data) {
          const statsObj = {
            total_matches: sRes.data.total_matches ?? 0,
            total_wins: sRes.data.total_wins ?? 0,
            win_rate: sRes.data.win_rate ?? 0,
          };
          setStats(statsObj);
          AsyncStorage.setItem(CACHE_KEYS.STATS, JSON.stringify(statsObj));
        }
      } catch (e) {
        console.error('ProfilePanel fresh load error:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading && !profile) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={C.gold} />
      </View>
    );
  }

  const initials = getInitials(profile?.full_name ?? null, profile?.username ?? null);
  const displayName = profile?.full_name || profile?.username || 'Player';
  const username = profile?.username || 'player';
  const joinDate = profile?.created_at ? formatDate(profile.created_at) : 'Unknown';
  const walletBalance = profile?.wallet_balance ?? 0;
  const level = profile?.level ?? 1;
  const xp = profile?.xp ?? 0;
  const xpNext = profile?.xp_next_level ?? 3000;
  const streak = profile?.streak ?? 0;
  const xpPercent = Math.min(100, Math.round((xp / xpNext) * 100));
  const tier = getTierInfo(level);
  const levelTitle = tier.label;

  const metrics = [
    { label: 'Total Matches', value: stats.total_matches.toString(), icon: 'dice-5' as IconName },
    { label: 'Win Rate', value: `${stats.win_rate}%`, icon: 'trophy' as IconName },
    { label: 'Current Streak', value: streak.toString().padStart(2, '0'), icon: 'lightning-bolt' as IconName },
    { label: gamblingEnabled ? 'Wallet Balance' : 'Balance', value: formatCurrency(walletBalance, gamblingEnabled), icon: 'wallet' as IconName },
  ];

  return (
    <View style={{ flex: 1, paddingHorizontal: 10, paddingTop: 8 }}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.contentContainer}
        showsVerticalScrollIndicator={false}
      >
      <Animated.View
        entering={FadeInDown.duration(600).springify().damping(15)}
        style={s.heroShell}
      >
        <ImageBackground
          source={require('@/assets/images/landing_bg.png')}
          style={s.heroBackground}
          imageStyle={s.heroImage}
        >
          <LinearGradient
            colors={['rgba(3,10,6,0.08)', 'rgba(4,12,8,0.82)', 'rgba(4,12,8,0.96)']}
            style={s.heroOverlay}
          >
            <View style={s.heroMain}>
              <View style={s.identityBlock}>
                <View style={s.avatarShell}>
                  {profile?.avatar_url ? (
                    <View style={s.avatarCore}>
                      <Image source={{ uri: profile.avatar_url }} style={{ width: 76, height: 76, borderRadius: 38 }} />
                    </View>
                  ) : (
                    <LinearGradient colors={tier.gradient as [string,string]} style={s.avatarCore}>
                      <Text style={s.avatarText}>{initials}</Text>
                    </LinearGradient>
                  )}
                  <View style={[s.crownChip, { borderColor: tier.color + '55', backgroundColor: 'rgba(6,17,11,0.94)' }]}>
                    <MaterialCommunityIcons name={tier.icon} size={16} color={tier.color} />
                  </View>
                </View>

                <View style={s.identityCopy}>
                  <Text style={[s.eyebrow, { color: tier.color }]}>{levelTitle} MEMBER</Text>
                  <Text style={s.playerName}>{displayName}</Text>
                  <Text style={s.playerMeta}>@{username}  |  Joined {joinDate}</Text>

                  <Animated.View entering={FadeInRight.delay(200).duration(600)} style={s.badgeRow}>
                    {/* Dynamic Tier Badge */}
                    <Animated.View
                      entering={FadeInRight.delay(300)}
                      style={[s.badgePill, { borderColor: tier.color + '55', backgroundColor: tier.color + '22' }]}
                    >
                      <MaterialCommunityIcons name={tier.icon} size={14} color={tier.color} />
                      <Text style={[s.badgeText, { color: tier.color }]}>{levelTitle}</Text>
                    </Animated.View>
                    {/* Static Badges */}
                    {STATIC_BADGES.map((badge, idx) => (
                      <Animated.View
                        key={badge.label}
                        entering={FadeInRight.delay(400 + idx * 100)}
                        style={s.badgePill}
                      >
                        <MaterialCommunityIcons name={badge.icon} size={14} color={C.gold} />
                        <Text style={s.badgeText}>{badge.label}</Text>
                      </Animated.View>
                    ))}
                  </Animated.View>
                </View>
              </View>

              <Animated.View
                entering={FadeInDown.delay(400).duration(600).springify()}
                style={s.progressPanel}
              >
                <Text style={s.progressLabel}>Season Progress</Text>
                <Text style={s.progressValue}>Level {level}</Text>
                <Text style={s.progressMeta}>{xp.toLocaleString()} / {xpNext.toLocaleString()} XP to {getLevelTitle(level + 5)}</Text>

                <View style={s.progressTrack}>
                  <LinearGradient
                    colors={['#E7C75A', '#D4AF37']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={[s.progressFill, { width: `${xpPercent}%` as any }]}
                  />
                </View>

                <View style={s.progressFooter}>
                  <Text style={s.progressFooterText}>Weekly bonus ready</Text>
                  <View style={s.dot} />
                  <Text style={s.progressFooterText}>{streak}-match streak</Text>
                </View>
              </Animated.View>
            </View>

            <View style={s.metricRow}>
              {metrics.map((metric, idx) => (
                <Animated.View
                  key={metric.label}
                  entering={FadeInDown.delay(600 + idx * 100).duration(500).springify()}
                  style={s.metricCard}
                >
                  <MaterialCommunityIcons name={metric.icon} size={20} color={C.gold} />
                  <Text style={s.metricValue}>{metric.value}</Text>
                  <Text style={s.metricLabel}>{metric.label}</Text>
                </Animated.View>
              ))}
            </View>
          </LinearGradient>
        </ImageBackground>
      </Animated.View>

      <View style={s.grid}>
        <View style={s.primaryColumn}>
          <Animated.View entering={FadeInDown.delay(800).duration(600)} style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Recent Matches</Text>
              <Text style={s.sectionCaption}>Latest form and winnings</Text>
            </View>

            {games.length === 0 ? (
              <Text style={s.emptyText}>No matches played yet. Get out there!</Text>
            ) : (
              games.map((game, index) => {
                const isWin = game.result === 'win';
                const amount = game.win_amount;
                const amountStr = amount >= 0 ? `+${formatCurrency(amount, gamblingEnabled)}` : formatCurrency(amount, gamblingEnabled);

                return (
                  <Animated.View
                    key={game.id}
                    entering={FadeInDown.delay(1000 + index * 100)}
                    style={[s.matchRow, index !== games.length - 1 && s.matchDivider]}
                  >
                    <View style={s.matchInfo}>
                      <Text style={s.matchTitle}>{game.game_type === 'ludo' ? 'Ludo Fusion' : 'Whot Clash'}</Text>
                      <Text style={s.matchMeta}>{game.table_name}  |  {timeAgo(game.created_at)}</Text>
                    </View>
                    <View style={s.matchResult}>
                      <Text style={[s.matchAmount, isWin ? s.positiveText : s.negativeText]}>
                        {amountStr}
                      </Text>
                      <Text style={s.matchStatus}>{isWin ? 'Victory' : 'Defeat'}</Text>
                    </View>
                  </Animated.View>
                );
              })
            )}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(1200).duration(600)} style={s.showcase}>
            <ImageBackground
              source={require('@/assets/images/lobby_bg.png')}
              style={s.showcase}
              imageStyle={s.showcaseImage}
            >
              <LinearGradient
                colors={['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.68)', 'rgba(0,0,0,0.84)']}
                style={s.showcaseOverlay}
              >
                <Text style={s.showcaseEyebrow}>SIGNATURE TABLE</Text>
                <Text style={s.showcaseTitle}>Classic Lounge</Text>
                <Text style={s.showcaseText}>
                  Refined boards, warm lighting, and fast competitive rooms for players who like the old-school feel.
                </Text>
              </LinearGradient>
            </ImageBackground>
          </Animated.View>
        </View>

        <View style={s.sideColumn}>
          <Animated.View entering={FadeInRight.delay(800).duration(600)} style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Achievements</Text>
              <Text style={s.sectionCaption}>Badges unlocked this season</Text>
            </View>
            <View style={s.achievementWrap}>
              {ACHIEVEMENTS.map((achievement, idx) => (
                <Animated.View
                  key={achievement.label}
                  entering={FadeInRight.delay(1000 + idx * 100)}
                  style={s.achievementItem}
                >
                  <View style={s.achievementIcon}>
                    <MaterialCommunityIcons name={achievement.icon} size={20} color={C.gold} />
                  </View>
                  <Text style={s.achievementText}>{achievement.label}</Text>
                </Animated.View>
              ))}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInRight.delay(1200).duration(600)} style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Favorite Modes</Text>
              <Text style={s.sectionCaption}>Where this player shines most</Text>
            </View>
            {FAVORITE_MODES.map((mode, index) => (
              <Animated.View
                key={mode.title}
                entering={FadeInRight.delay(1400 + index * 100)}
                style={[s.modeRow, index !== FAVORITE_MODES.length - 1 && s.matchDivider]}
              >
                <View style={s.modeIconWrap}>
                  <MaterialCommunityIcons name={mode.icon} size={18} color={C.gold} />
                </View>
                <View style={s.modeCopy}>
                  <Text style={s.modeTitle}>{mode.title}</Text>
                  <Text style={s.modeSubtitle}>{mode.subtitle}</Text>
                </View>
              </Animated.View>
            ))}
          </Animated.View>
        </View>
      </View>
    </ScrollView>
  </View>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  contentContainer: { paddingBottom: 14, gap: 12 },
  emptyText: { color: C.textMuted, fontSize: 12, fontStyle: 'italic', paddingVertical: 10 },
  heroShell: {
    borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: C.goldBorder, backgroundColor: C.surfaceStrong,
  },
  heroBackground: { minHeight: 20 },
  heroImage: { resizeMode: 'cover' },
  heroOverlay: { flex: 1, padding: 13, gap: 10 },
  heroMain: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between' },
  identityBlock: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, flex: 1, minWidth: 240 },
  avatarShell: {
    width: 84, height: 84, borderRadius: 42,
    borderWidth: 2, borderColor: C.goldBorder,
    padding: 4, backgroundColor: 'rgba(4,12,8,0.6)',
  },
  avatarCore: { flex: 1, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.textPrimary, fontSize: 24, fontWeight: '800', letterSpacing: 1 },
  crownChip: {
    position: 'absolute', top: -6, right: -2,
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(6,17,11,0.94)',
    borderWidth: 1, borderColor: C.goldBorder,
  },
  identityCopy: { flex: 1, minWidth: 200, gap: 4 },
  eyebrow: { color: C.gold, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  playerName: { color: C.textPrimary, fontSize: 26, fontWeight: '800', letterSpacing: 0.4 },
  playerMeta: { color: C.textMuted, fontSize: 12, fontWeight: '500' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  badgePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999,
    backgroundColor: 'rgba(6,17,11,0.78)', borderWidth: 1, borderColor: C.goldSoft,
  },
  badgeText: { color: C.textPrimary, fontSize: 11, fontWeight: '700' },
  progressPanel: {
    width: 260, minWidth: 230, padding: 13, borderRadius: 18,
    backgroundColor: 'rgba(6,17,11,0.82)',
    borderWidth: 1, borderColor: C.goldSoft, gap: 8,
  },
  progressLabel: { color: C.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  progressValue: { color: C.textPrimary, fontSize: 22, fontWeight: '800' },
  progressMeta: { color: C.textMuted, fontSize: 11 },
  progressTrack: {
    height: 7, borderRadius: 999, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 4,
  },
  progressFill: { height: '100%', borderRadius: 999 },
  progressFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  progressFooterText: { color: C.textPrimary, fontSize: 11, fontWeight: '600' },
  dot: { width: 5, height: 5, borderRadius: 999, backgroundColor: C.gold },
  metricRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  metricCard: {
    flexGrow: 1, minWidth: 130, padding: 14, borderRadius: 16,
    backgroundColor: 'rgba(6,17,11,0.8)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: 4,
  },
  metricValue: { color: C.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 2 },
  metricLabel: { color: C.textMuted, fontSize: 11, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  primaryColumn: { flex: 1.4, minWidth: 320, gap: 12 },
  sideColumn: { flex: 1, minWidth: 280, gap: 12 },
  section: {
    borderRadius: 18, backgroundColor: C.surface,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    padding: 15, gap: 6,
  },
  sectionHeader: { marginBottom: 6, gap: 3 },
  sectionTitle: { color: C.textPrimary, fontSize: 17, fontWeight: '800' },
  sectionCaption: { color: C.textMuted, fontSize: 11 },
  matchRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 10, paddingVertical: 10,
  },
  matchDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  matchInfo: { flex: 1, gap: 2 },
  matchTitle: { color: C.textPrimary, fontSize: 13, fontWeight: '700' },
  matchMeta: { color: C.textMuted, fontSize: 11 },
  matchResult: { alignItems: 'flex-end', gap: 2 },
  matchAmount: { fontSize: 13, fontWeight: '800' },
  positiveText: { color: C.success },
  negativeText: { color: C.danger },
  matchStatus: { color: C.textMuted, fontSize: 10, fontWeight: '600' },
  showcase: { minHeight: 180, borderRadius: 18, overflow: 'hidden' },
  showcaseImage: { resizeMode: 'cover' },
  showcaseOverlay: { flex: 1, padding: 15, justifyContent: 'flex-end', gap: 4 },
  showcaseEyebrow: { color: C.gold, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  showcaseTitle: { color: C.textPrimary, fontSize: 20, fontWeight: '800' },
  showcaseText: { color: C.textMuted, fontSize: 12, lineHeight: 18, maxWidth: 430 },
  achievementWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  achievementItem: {
    minWidth: 112, flexGrow: 1, padding: 12, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: 8,
  },
  achievementIcon: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', backgroundColor: C.goldSoft,
  },
  achievementText: { color: C.textPrimary, fontSize: 12, fontWeight: '700' },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  modeIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', backgroundColor: C.goldSoft,
  },
  modeCopy: { flex: 1, gap: 2 },
  modeTitle: { color: C.textPrimary, fontSize: 13, fontWeight: '700' },
  modeSubtitle: { color: C.textMuted, fontSize: 11 },
});
