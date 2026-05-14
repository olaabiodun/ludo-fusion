import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect } from 'react';
import {
  BackHandler,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  DeviceEventEmitter,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBackground } from '@/components/AppBackground';

import { supabase } from '@/lib/supabase';

type GameRecord = {
  id: string;
  game_type: string;
  table_name: string;
  win_amount: number;
  result: string;
  created_at: string;
};

const ACHIEVEMENTS = [
  { label: 'Hot Streak', icon: 'fire' as const },
  { label: 'Sharp Mind', icon: 'brain' as const },
  { label: 'Elite Table', icon: 'crown-outline' as const },
];

const FAVORITES = [
  { label: 'Favorite Mode', value: 'Ludo Classic' },
  { label: 'Best Finish', value: 'Top 3%' },
  { label: 'Play Style', value: 'Aggressive' },
];

export default function ProfileScreen() {
  const [loading, setLoading] = React.useState(true);
  const [profile, setProfile] = React.useState<any>(null);
  const [recentMatches, setRecentMatches] = React.useState<GameRecord[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch Profile
        const { data: prof } = await supabase
          .from('profiles')
          .select(`
            *,
            profile_stats(total_matches, total_wins, win_rate)
          `)
          .eq('id', user.id)
          .single();
          
        if (prof) {
          const stats = (prof as any).profile_stats;
          setProfile({
            ...prof,
            games_played: stats?.total_matches || 0,
            wins: stats?.total_wins || 0,
            total_earnings: 0,
            win_rate: stats?.win_rate || 0
          });
        }

        // Fetch Recent Matches
        const { data: games } = await supabase
          .from('games')
          .select('*')
          .eq('player_id', user.id)
          .order('created_at', { ascending: false })
          .limit(3);
        setRecentMatches(games || []);

      } catch (err) {
        console.error('Error loading profile data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();

    const sub = DeviceEventEmitter.addListener('game_completed', loadData);
    const walSub = DeviceEventEmitter.addListener('wallet_updated', loadData);

    const backAction = () => {
      router.back();
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => {
      backHandler.remove();
      sub.remove();
      walSub.remove();
    };
  }, []);

  const formatAmount = (amt: number) => {
    if (amt >= 1000) return `₦${(amt / 1000).toFixed(1)}k`;
    return `₦${amt}`;
  };

  const getTimeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return new Date(date).toLocaleDateString();
  };

  const stats = [
    { label: 'Games Played', value: profile?.games_played?.toString() || '0', accent: '#f5c535', icon: 'dice-multiple-outline' as const },
    { label: 'Win Rate', value: profile?.win_rate ? `${profile.win_rate}%` : '0%', accent: '#3DD88A', icon: 'trophy-outline' as const },
    { label: 'Earnings', value: formatAmount(profile?.total_earnings || 0), accent: '#68A5FF', icon: 'cash-multiple' as const },
    { label: 'Streak', value: `${profile?.streak || 0} Wins`, accent: '#FF8A5B', icon: 'fire' as const },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient
        colors={['#0A2318', '#05110B', '#000000']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <AppBackground overlayOpacity={0.8}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.85}>
              <View style={styles.backIconWrap}>
                <MaterialCommunityIcons name="chevron-left" size={20} color="#f5c535" />
              </View>
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.headerAction} activeOpacity={0.85}>
              <MaterialCommunityIcons name="cog-outline" size={19} color="#F7E3A5" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <LinearGradient
              colors={['rgba(26, 59, 45, 0.95)', 'rgba(9, 19, 14, 0.96)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroGlow} />

              <View style={styles.identityRow}>
                <View style={styles.avatarShell}>
                  <View style={styles.avatarCore}>
                    <MaterialCommunityIcons name="account" size={54} color="#f5c535" />
                  </View>
                  <View style={styles.crownBadge}>
                    <MaterialCommunityIcons name="crown" size={18} color="#161105" />
                  </View>
                </View>

                <View style={styles.identityCopy}>
                  <View style={styles.vipChip}>
                    <Text style={styles.vipChipText}>VIP Level 2</Text>
                  </View>
                  <Text style={styles.userName}>{profile?.username || profile?.full_name || 'Player'}</Text>
                  <Text style={styles.userMeta}>Joined {profile?.created_at ? new Date(profile.created_at).getFullYear() : '2024'} | {profile?.location || 'Lagos, Nigeria'}</Text>
                  <Text style={styles.userTagline}>{profile?.bio || 'Classic boards, clean wins, steady climb.'}</Text>
                </View>
              </View>

              <View style={styles.heroFooter}>
                <View style={styles.xpBlock}>
                  <View style={styles.xpRow}>
                    <Text style={styles.xpLabel}>Level {profile?.level || 1}</Text>
                    <Text style={styles.xpValue}>{profile?.xp || 0} / {profile?.xp_next_level || 1000} XP</Text>
                  </View>
                  <View style={styles.xpTrack}>
                    <View style={[styles.xpFill, { width: `${Math.min(100, ((profile?.xp || 0) / (profile?.xp_next_level || 1000)) * 100)}%` }]} />
                  </View>
                </View>

                <TouchableOpacity style={styles.editProfileBtn} activeOpacity={0.85}>
                  <MaterialCommunityIcons name="pencil-outline" size={16} color="#082116" />
                  <Text style={styles.editProfileText}>Edit Profile</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>

            <View style={styles.statsGrid}>
              {stats.map((stat) => (
                <View key={stat.label} style={styles.statCard}>
                  <View style={[styles.statIconWrap, { backgroundColor: `${stat.accent}22` }]}>
                    <MaterialCommunityIcons name={stat.icon} size={18} color={stat.accent} />
                  </View>
                  <Text style={[styles.statValue, { color: stat.accent }]}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionEyebrow}>Activity</Text>
                  <Text style={styles.sectionTitle}>Recent Matches</Text>
                </View>
                <TouchableOpacity activeOpacity={0.8}>
                  <Text style={styles.sectionLink}>View All</Text>
                </TouchableOpacity>
              </View>

               {recentMatches.length > 0 ? recentMatches.map((match, index) => {
                const won = match.result === 'win';
                return (
                  <View
                    key={match.id}
                    style={[
                      styles.matchRow,
                      index !== recentMatches.length - 1 && styles.matchRowBorder,
                    ]}
                  >
                    <View style={styles.matchLeft}>
                      <View
                        style={[
                          styles.matchIconWrap,
                          { backgroundColor: won ? 'rgba(61,216,138,0.16)' : 'rgba(255,138,91,0.14)' },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={won ? 'arrow-top-right' : 'arrow-bottom-right'}
                          size={16}
                          color={won ? '#3DD88A' : '#FF8A5B'}
                        />
                      </View>
                      <View>
                        <Text style={styles.matchTitle}>{match.game_type === 'ludo' ? 'Ludo Royale' : 'Whot Classic'}</Text>
                        <Text style={styles.matchTime}>{getTimeAgo(match.created_at)}</Text>
                      </View>
                    </View>

                    <View style={styles.matchRight}>
                      <Text style={[styles.matchAmount, { color: won ? '#3DD88A' : '#FF8A5B' }]}>
                        {won ? '+' : '-'}{formatAmount(match.win_amount)}
                      </Text>
                      <Text style={styles.matchStatus}>{won ? 'Victory' : 'Defeat'}</Text>
                    </View>
                  </View>
                );
              }) : (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>No matches played yet.</Text>
                </View>
              )}
            </View>

            <View style={styles.splitRow}>
              <View style={[styles.sectionCard, styles.splitCard]}>
                <Text style={styles.sectionEyebrow}>Collection</Text>
                <Text style={styles.sectionTitle}>Achievements</Text>

                <View style={styles.achievementList}>
                  {ACHIEVEMENTS.map((item) => (
                    <View key={item.label} style={styles.achievementPill}>
                      <View style={styles.achievementIcon}>
                        <MaterialCommunityIcons name={item.icon} size={18} color="#f5c535" />
                      </View>
                      <Text style={styles.achievementText}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={[styles.sectionCard, styles.splitCard]}>
                <Text style={styles.sectionEyebrow}>Profile Notes</Text>
                <Text style={styles.sectionTitle}>Player Snapshot</Text>

                <View style={styles.snapshotList}>
                  {FAVORITES.map((item) => (
                    <View key={item.label} style={styles.snapshotRow}>
                      <Text style={styles.snapshotLabel}>{item.label}</Text>
                      <Text style={styles.snapshotValue}>{item.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </ScrollView>
        </AppBackground>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0906',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(245,197,53,0.22)',
  },
  backText: {
    color: '#F7E3A5',
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
  },
  headerAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    gap: 16,
  },
  heroCard: {
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(245,197,53,0.18)',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(245,197,53,0.12)',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarShell: {
    width: 98,
    height: 98,
    borderRadius: 49,
    padding: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5,
    borderColor: '#f5c535',
  },
  avatarCore: {
    flex: 1,
    borderRadius: 46,
    backgroundColor: 'rgba(7, 16, 12, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crownBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f5c535',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#103324',
  },
  identityCopy: {
    flex: 1,
    gap: 5,
  },
  vipChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(247,227,165,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(247,227,165,0.14)',
  },
  vipChipText: {
    color: '#F7E3A5',
    fontSize: 10.5,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: 0.4,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontFamily: 'Poppins_800ExtraBold',
  },
  userMeta: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 11.5,
    fontFamily: 'Poppins_500Medium',
  },
  userTagline: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: 'Poppins_500Medium',
  },
  heroFooter: {
    marginTop: 18,
    gap: 14,
  },
  xpBlock: {
    gap: 8,
  },
  xpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  xpLabel: {
    color: '#f5c535',
    fontSize: 13.5,
    fontFamily: 'Poppins_700Bold',
  },
  xpValue: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
  },
  xpTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
  },
  xpFill: {
    width: '82%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#f5c535',
  },
  editProfileBtn: {
    height: 46,
    borderRadius: 14,
    backgroundColor: '#F7E3A5',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  editProfileText: {
    color: '#082116',
    fontSize: 13,
    fontFamily: 'Poppins_700Bold',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '48%',
    minHeight: 112,
    borderRadius: 20,
    padding: 14,
    backgroundColor: 'rgba(10, 16, 14, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'space-between',
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 20,
    fontFamily: 'Poppins_800ExtraBold',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
  },
  sectionCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: 'rgba(7, 13, 11, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  sectionEyebrow: {
    color: 'rgba(247,227,165,0.7)',
    fontSize: 10.5,
    letterSpacing: 0.6,
    fontFamily: 'Poppins_700Bold',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: 'Poppins_700Bold',
  },
  sectionLink: {
    color: '#f5c535',
    fontSize: 11.5,
    fontFamily: 'Poppins_700Bold',
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 12,
  },
  matchRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  matchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  matchIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontFamily: 'Poppins_600SemiBold',
  },
  matchTime: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 10.5,
    fontFamily: 'Poppins_500Medium',
  },
  matchRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  matchAmount: {
    fontSize: 13.5,
    fontFamily: 'Poppins_800ExtraBold',
  },
  matchStatus: {
    color: 'rgba(255,255,255,0.46)',
    fontSize: 10,
    fontFamily: 'Poppins_600SemiBold',
  },
  splitRow: {
    gap: 16,
  },
  splitCard: {
    gap: 14,
  },
  achievementList: {
    gap: 10,
  },
  achievementPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  achievementIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(245,197,53,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontFamily: 'Poppins_600SemiBold',
  },
  snapshotList: {
    gap: 12,
  },
  snapshotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  snapshotLabel: {
    color: 'rgba(255,255,255,0.54)',
    fontSize: 11.5,
    fontFamily: 'Poppins_500Medium',
  },
  snapshotValue: {
    color: '#F7E3A5',
    fontSize: 12,
    fontFamily: 'Poppins_700Bold',
  },
});
