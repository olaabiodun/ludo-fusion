import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { DodgeKeyboard } from 'react-native-dodge-keyboard';
import { supabase } from '@/lib/supabase';
import { PlayerProfileModal } from '@/components/PlayerProfileModal';

// ─── Design Tokens ───────────────────────────────────────────────────────────

const C = {
  gold: '#D4AF37',
  goldSoft: 'rgba(212,175,55,0.14)',
  goldBorder: 'rgba(212,175,55,0.28)',
  goldStrong: 'rgba(212,175,55,0.22)',
  surface: 'rgba(7, 21, 15, 0.88)',
  surfaceStrong: 'rgba(5, 16, 11, 0.94)',
  surfaceHover: 'rgba(255,255,255,0.025)',
  textPrimary: '#F5EFD8',
  textMuted: 'rgba(245,239,216,0.6)',
  success: '#57D08B',
  danger: '#F26B6B',
  bg: '#040d07',
  divider: 'rgba(255,255,255,0.05)',
  silver: '#9BA5A0',
  bronze: '#9A6D3E',
};

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const TABS = ['All Time', 'This Week', 'Friends', 'History'] as const;

type LeaderboardPlayer = {
  id?: string;
  rank: number;
  initials: string;
  name: string;
  mode: string;
  score: string;
  delta: number;
  badge?: string;
  badgeIcon?: IconName;
  rankColor?: string;
};

// Map ranks to podium color
const getRankColor = (rank: number) => {
  if (rank === 1) return C.gold;
  if (rank === 2) return C.silver;
  if (rank === 3) return C.bronze;
  return 'transparent';
};

// ─── Animated Row ─────────────────────────────────────────────────────────────

function PlayerRow({
  player,
  delay,
  onPress,
}: {
  player: LeaderboardPlayer;
  delay: number;
  onPress: () => void;
}) {
  const slideX = useRef(new Animated.Value(-16)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideX, { toValue: 0, duration: 380, delay, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 320, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  const isTop = player.rank <= 5;
  const deltaColor =
    player.delta > 0 ? C.success : player.delta < 0 ? C.danger : C.textMuted;
  const deltaLabel =
    player.delta > 0
      ? `▲ ${player.delta}`
      : player.delta < 0
      ? `▼ ${Math.abs(player.delta)}`
      : '— 0';

  return (
    <Animated.View style={{ transform: [{ translateX: slideX }], opacity }}>
      <Pressable style={({ pressed }) => [s.row, pressed && s.rowPressed]} onPress={onPress}>
        <Text style={[s.rowRank, isTop && s.rowRankTop]}>{player.rank}</Text>

        <LinearGradient colors={['#163D27', '#071510']} style={s.rowAvatar}>
          <Text style={s.rowAvatarText}>{player.initials}</Text>
        </LinearGradient>

        <View style={s.rowInfo}>
          <Text style={s.rowName}>{player.name}</Text>
          <View style={s.rowTagRow}>
            <Text style={s.rowMode}>{player.mode}</Text>
            {player.badge && player.badgeIcon && (
              <View style={s.badgePill}>
                <MaterialCommunityIcons name={player.badgeIcon} size={9} color={C.gold} />
                <Text style={s.badgePillText}>{player.badge}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={s.rowRight}>
          <Text style={s.rowScore}>{player.score}</Text>
          <Text style={[s.rowDelta, { color: deltaColor }]}>{deltaLabel}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Podium Slot ──────────────────────────────────────────────────────────────

function PodiumSlot({
  player,
  delay,
  onPress,
}: {
  player: LeaderboardPlayer;
  delay: number;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(0.3)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const blockHeight = useRef(new Animated.Value(0)).current;

  const targetHeight = player.rank === 1 ? 48 : player.rank === 2 ? 34 : 24;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        delay,
        damping: 13,
        stiffness: 160,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, { toValue: 1, duration: 280, delay, useNativeDriver: true }),
      Animated.timing(blockHeight, {
        toValue: targetHeight,
        duration: 480,
        delay: delay + 80,
        useNativeDriver: false,
      }),
    ]).start();
  }, []);

  const isFirst = player.rank === 1;
  const avatarSize = isFirst ? 60 : player.rank === 2 ? 50 : 44;
  const borderColor = isFirst ? C.gold : 'rgba(255,255,255,0.12)';

  return (
    <Pressable style={s.podiumSlot} onPress={onPress}>
      <Animated.View style={{ transform: [{ scale }], opacity, alignItems: 'center' }}>
        {isFirst && (
          <Text style={s.crownEmoji}>👑</Text>
        )}
        <View
          style={[
            s.podiumAvatar,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
              borderColor,
              borderWidth: isFirst ? 2.5 : 1.5,
            },
          ]}
        >
          <LinearGradient
            colors={isFirst ? ['#1E5A39', '#0A2318'] : ['#163D27', '#071510']}
            style={StyleSheet.absoluteFill}
            borderRadius={avatarSize / 2}
          />
          <Text style={[s.podiumAvatarText, { fontSize: isFirst ? 18 : 14 }]}>
            {player.initials}
          </Text>
          <View style={[s.rankBadge, { backgroundColor: player.rankColor }]}>
            <Text style={s.rankBadgeText}>{player.rank}</Text>
          </View>
        </View>
        <Text style={s.podiumName} numberOfLines={1}>{player.name}</Text>
        <Text style={s.podiumScore}>{player.score}</Text>
      </Animated.View>

      <Animated.View
        style={[
          s.podiumBlock,
          {
            height: blockHeight,
            backgroundColor: isFirst ? C.goldSoft : 'rgba(255,255,255,0.03)',
            borderColor: isFirst ? C.goldBorder : 'rgba(255,255,255,0.06)',
          },
        ]}
      />
    </Pressable>
  );
}

// ─── XP Bar ───────────────────────────────────────────────────────────────────

function XpBar() {
  const width = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: 72,
      duration: 1200,
      delay: 900,
      useNativeDriver: false,
    }).start();
  }, []);

  return (
    <View style={s.xpTrack}>
      <Animated.View
        style={[
          s.xpFill,
          {
            width: width.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </View>
  );
}

// ─── PulseDot ─────────────────────────────────────────────────────────────────

function PulseDot() {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.5, duration: 900, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[s.pulseDot, { transform: [{ scale }] }]} />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LeaderboardPanel() {
  const [activeTab, setActiveTab] = useState(0);
  const [season, setSeason] = useState(4);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [myRankData, setMyRankData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Profile Modal State
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const openProfile = (id: string | undefined) => {
    if (!id) return;
    setSelectedPlayerId(id);
    setModalVisible(true);
  };

  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchLeaderboard();
  }, [activeTab, season, searchQuery]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (activeTab === 3) {
        // History tab
        if (user) {
          const { data: games } = await supabase.from('games').select('*').eq('player_id', user.id).order('created_at', { ascending: false }).limit(20);
          setHistory(games || []);
        }
        setPlayers([]);
      } else {
        // Leaderboard logic
        let query = supabase.from('profiles').select('id, username, full_name, xp').order('xp', { ascending: false });
        
        if (activeTab === 2 && searchQuery.length > 0) {
          query = query.ilike('username', `%${searchQuery}%`);
        }

        const { data } = await query.limit(20);
        if (data) {
          const mapped: LeaderboardPlayer[] = data.map((p, i) => {
            // fake variation based on season
            const seasonModifier = (season * 100) + (i * 10);
            return {
              id: p.id,
              rank: i + 1,
              initials: p.username ? p.username.substring(0, 2).toUpperCase() : 'PL',
              name: p.username || 'Player',
              mode: 'Ludo Royale',
              score: `${(p.xp || 0) + seasonModifier} XP`,
              delta: Math.floor(Math.random() * 5) - 2,
              rankColor: getRankColor(i + 1),
            };
          });
          setPlayers(mapped);

          if (user) {
            const me = mapped.find(p => p.id === user.id);
            if (me) setMyRankData(me);
            else {
              const { data: myProf } = await supabase.from('profiles').select('username, xp').eq('id', user.id).single();
              if (myProf) {
                setMyRankData({
                  rank: '100+',
                  initials: myProf.username ? myProf.username.substring(0, 2).toUpperCase() : 'PL',
                  name: myProf.username || 'You',
                  score: `${myProf.xp || 0} XP`,
                  delta: 0
                });
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn(e);
    }
    setLoading(false);
  };

  const cycleSeason = () => {
    setSeason(s => s === 1 ? 4 : s - 1);
  };

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const headerStyle = {
    opacity: headerAnim,
    transform: [
      {
        translateY: headerAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-14, 0],
        }),
      },
    ],
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#05110B', paddingHorizontal: 14, paddingTop: 14 }}>
      <DodgeKeyboard>
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.contentContainer}
          showsVerticalScrollIndicator={false}
        >
        {/* ── Top bar: Header + Tabs ── */}
        <Animated.View style={[s.topBar, headerStyle]}>
        <View style={s.headerBlock}>
          <Text style={s.eyebrow}>GLOBAL RANKINGS</Text>
          <Text style={s.pageTitle}>Leaderboard</Text>
        </View>

        <View style={s.tabsBlock}>
          {TABS.map((tab, i) => (
            <Pressable
              key={tab}
              style={[s.tab, activeTab === i && s.tabActive]}
              onPress={() => {
                setActiveTab(i);
                if (i !== 2) setSearchQuery(''); // Clear search when not in Friends tab
              }}
            >
              <Text style={[s.tabText, activeTab === i && s.tabTextActive]}>
                {tab}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={s.seasonChip} onPress={cycleSeason}>
          <PulseDot />
          <Text style={s.seasonChipText}>Season {season}</Text>
        </Pressable>
      </Animated.View>

      {/* ── Search Bar for Friends ── */}
      {activeTab === 2 && (
        <View style={s.searchWrap}>
          <MaterialCommunityIcons name="magnify" size={16} color={C.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search friends by username..."
            placeholderTextColor={C.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      )}

      {/* ── Main grid: Podium | List ── */}
      {activeTab === 3 ? (
        <View style={s.listPanel}>
          <Text style={s.listTitle}>Match History</Text>
          <ScrollView style={{ flex: 1 }}>
            {history.length > 0 ? history.map((game, i) => (
              <View key={game.id} style={[s.row, { paddingHorizontal: 10 }]}>
                <MaterialCommunityIcons name="gamepad-variant" size={24} color={game.result === 'win' ? C.success : C.textMuted} />
                <View style={s.rowInfo}>
                  <Text style={s.rowName}>{game.table_name || game.game_type}</Text>
                  <Text style={s.rowMode}>{new Date(game.created_at).toLocaleDateString()}</Text>
                </View>
                <View style={s.rowRight}>
                  <Text style={[s.rowScore, { color: game.result === 'win' ? C.success : C.danger }]}>
                    {game.result === 'win' ? '+' : ''}{game.win_amount || 0}
                  </Text>
                  <Text style={s.rowDelta}>{game.result?.toUpperCase()}</Text>
                </View>
              </View>
            )) : <Text style={{ color: C.textMuted, padding: 20, textAlign: 'center' }}>No history found.</Text>}
          </ScrollView>
        </View>
      ) : (
      <View style={s.mainGrid}>
        {/* Left: Podium */}
        <View style={s.podiumPanel}>
          <LinearGradient
            colors={['rgba(3,10,6,0.0)', 'rgba(212,175,55,0.06)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={s.podiumRow}>
            {/* Render order: 2nd, 1st, 3rd */}
            {players[1] && <PodiumSlot player={players[1]} delay={400} onPress={() => openProfile(players[1].id)} />}
            {players[0] && <PodiumSlot player={players[0]} delay={250} onPress={() => openProfile(players[0].id)} />}
            {players[2] && <PodiumSlot player={players[2]} delay={550} onPress={() => openProfile(players[2].id)} />}
          </View>

          {/* ── My Rank strip ── */}
          {myRankData && (
          <View style={s.myRankStrip}>
            <View style={s.myRankStripLeft}>
              <Text style={s.myRankStripLabel}>YOU</Text>
              <Text style={s.myRankStripNum}>#{myRankData.rank}</Text>
            </View>

            <LinearGradient colors={['#1E5A39', '#0A2318']} style={s.myStripAvatar}>
              <Text style={s.myStripAvatarText}>{myRankData.initials}</Text>
            </LinearGradient>

            <View style={s.myRankStripInfo}>
              <View style={s.myRankStripNameRow}>
                <Text style={s.myRankStripName}>{myRankData.name}</Text>
                <View style={s.myRankStripBadge}>
                  <MaterialCommunityIcons name="arrow-up-bold" size={9} color={C.success} />
                  <Text style={s.myRankStripDelta}>+4 this week</Text>
                </View>
              </View>
              <View style={s.myRankStripXpRow}>
                <XpBar />
                <Text style={s.myRankStripXpLabel}>{myRankData.score}</Text>
              </View>
            </View>
          </View>
          )}
        </View>

        {/* Right: Player list */}
        <View style={s.listPanel}>
          <View style={s.listHeader}>
            <Text style={s.listTitle}>Rankings</Text>
            <Text style={s.listCaption}>Positions 4+</Text>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            style={{ flex: 1 }}
          >
            {players.slice(3).map((player, i) => (
              <PlayerRow key={player.id || player.rank} player={player} delay={500 + i * 80} onPress={() => openProfile(player.id)} />
            ))}
          </ScrollView>
        </View>
      </View>
      )}

      <PlayerProfileModal 
        visible={modalVisible} 
        playerId={selectedPlayerId} 
        onClose={() => setModalVisible(false)} 
      />

        </ScrollView>
      </DodgeKeyboard>
  </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  contentContainer: {
    padding: 0,
    paddingVertical: 0,
    gap: 5,
  },

  // ── Top Bar ──
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  headerBlock: {
    gap: 1,
    marginRight: 4,
  },
  eyebrow: {
    color: C.gold,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
  },
  pageTitle: {
    color: C.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  tabsBlock: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 7,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: {
    backgroundColor: C.goldSoft,
    borderColor: C.goldBorder,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.textMuted,
  },
  tabTextActive: {
    color: C.textPrimary,
  },
  seasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: C.goldSoft,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.gold,
  },
  seasonChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.gold,
  },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: C.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  // ── Main Grid ──
  mainGrid: {
    flexDirection: 'row',
    gap: 10,
    minHeight: 220,
  },

  // ── Podium Panel ──
  podiumPanel: {
    width: 260,
    borderRadius: 18,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.goldBorder,
    overflow: 'hidden',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    padding: 7,
    gap: 0,
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
  },
  podiumSlot: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  crownEmoji: {
    fontSize: 18,
    marginBottom: 2,
  },
  podiumAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  podiumAvatarText: {
    color: C.textPrimary,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rankBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 17,
    height: 17,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: C.bg,
  },
  rankBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#0a1205',
  },
  podiumName: {
    color: C.textPrimary,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: 72,
  },
  podiumScore: {
    color: C.gold,
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  podiumBlock: {
    width: '100%',
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 2,
  },

  // ── List Panel ──
  listPanel: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 12,
    gap: 6,
    overflow: 'hidden',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  listTitle: {
    color: C.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  listCaption: {
    color: C.textMuted,
    fontSize: 10,
  },

  // ── Row ──
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  rowPressed: {
    backgroundColor: C.surfaceHover,
  },
  rowRank: {
    width: 18,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    color: C.textMuted,
  },
  rowRankTop: {
    color: C.gold,
  },
  rowAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  rowAvatarText: {
    color: C.textPrimary,
    fontSize: 10,
    fontWeight: '800',
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    color: C.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  rowTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  rowMode: {
    color: C.textMuted,
    fontSize: 9,
    fontWeight: '500',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: C.goldSoft,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  badgePillText: {
    color: C.gold,
    fontSize: 8,
    fontWeight: '700',
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 1,
  },
  rowScore: {
    color: C.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  rowDelta: {
    fontSize: 9,
    fontWeight: '700',
  },

  // ── My Rank Strip (inside podium panel) ──
  myRankStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 5,
    paddingTop: 5,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: C.goldBorder,
  },
  myRankStripLeft: {
    alignItems: 'center',
    gap: 0,
    minWidth: 26,
  },
  myRankStripLabel: {
    color: C.gold,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  myRankStripNum: {
    color: C.gold,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  myStripAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.gold,
  },
  myStripAvatarText: {
    color: C.textPrimary,
    fontSize: 11,
    fontWeight: '800',
  },
  myRankStripInfo: {
    flex: 1,
    gap: 4,
  },
  myRankStripNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  myRankStripName: {
    color: C.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  myRankStripBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(87,208,139,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(87,208,139,0.25)',
  },
  myRankStripDelta: {
    color: C.success,
    fontSize: 8,
    fontWeight: '700',
  },
  myRankStripXpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  myRankStripXpLabel: {
    color: C.textMuted,
    fontSize: 9,
    fontWeight: '600',
    minWidth: 44,
    textAlign: 'right',
  },
  // ── XP Bar (shared) ──
  xpTrack: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: C.gold,
  },
});