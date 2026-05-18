import { supabase } from '@/lib/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { DodgeKeyboard } from 'react-native-dodge-keyboard';

const C = {
  gold: '#D4AF37',
  goldSoft: 'rgba(212,175,55,0.14)',
  goldBorder: 'rgba(212,175,55,0.28)',
  surface: 'rgba(7, 21, 15, 0.88)',
  surfaceStrong: 'rgba(5, 16, 11, 0.94)',
  textPrimary: '#F5EFD8',
  textMuted: 'rgba(245,239,216,0.6)',
  textDim: 'rgba(245,239,216,0.35)',
  success: '#57D08B',
  successSoft: 'rgba(87,208,139,0.12)',
  successBorder: 'rgba(87,208,139,0.25)',
  info: '#5AAFF0',
  danger: '#F26B6B',
  dangerSoft: 'rgba(242,107,107,0.1)',
  divider: 'rgba(255,255,255,0.05)',
};

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type Profile = {
  id: string;
  username: string;
  full_name: string | null;
  level: number;
  tier: string;
  avatar_url?: string;
};

type FriendRow = {
  id: string;       // friendship id
  friend: Profile;
  status: 'accepted' | 'pending_sent' | 'pending_received';
};

function getInitials(name: string | null, username: string): string {
  const n = name || username || 'PL';
  return n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getTierColor(tier: string): string {
  switch (tier) {
    case 'mythic_legend': return '#E040FB';
    case 'legendary':     return '#F44336';
    case 'grand_master':  return '#FF8C00';
    case 'elite':         return '#D4AF37';
    case 'rising_star':   return '#4FC3F7';
    default:              return '#A8A8B3';
  }
}

// ─── Animated Friend Row ──────────────────────────────────────────────────────
function FriendItem({
  item, delay, onAccept, onDecline, onRemove,
}: {
  item: FriendRow;
  delay: number;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  onRemove?: (id: string) => void;
}) {
  const slideX = useRef(new Animated.Value(-20)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const tierColor = getTierColor(item.friend.tier ?? 'newcomer');

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideX, { toValue: 0, duration: 400, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 350, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  const initials = getInitials(item.friend.full_name, item.friend.username);

  return (
    <Animated.View style={{ transform: [{ translateX: slideX }], opacity }}>
      <View style={s.friendRow}>
        <View style={s.avatarContainer}>
          {item.friend.avatar_url ? (
            <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
              <Image source={{ uri: item.friend.avatar_url }} style={{ width: '100%', height: '100%' }} />
            </View>
          ) : (
            <LinearGradient colors={['#1E5A39', '#0A2318']} style={s.avatar}>
              <Text style={s.avatarText}>{initials}</Text>
            </LinearGradient>
          )}
          {item.status === 'accepted' && (
            <View style={[s.statusDot, { backgroundColor: C.success }]} />
          )}
          {item.status === 'pending_received' && (
            <View style={[s.statusDot, { backgroundColor: C.gold }]} />
          )}
          {item.status === 'pending_sent' && (
            <View style={[s.statusDot, { backgroundColor: C.textDim }]} />
          )}
        </View>

        <View style={s.friendInfo}>
          <View style={s.friendNameRow}>
            <Text style={s.friendName}>{item.friend.full_name || item.friend.username}</Text>
            <View style={[s.tierPill, { borderColor: tierColor + '44', backgroundColor: tierColor + '18' }]}>
              <Text style={[s.tierText, { color: tierColor }]}>
                {(item.friend.tier ?? 'newcomer').replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={s.friendMeta}>
            @{item.friend.username}  ·  Lv. {item.friend.level ?? 1}
            {item.status === 'pending_sent'     && '  ·  Request Sent'}
            {item.status === 'pending_received' && '  ·  Wants to be friends'}
          </Text>
        </View>

        <View style={s.friendActions}>
          {item.status === 'accepted' && (
            <>
              <TouchableOpacity style={s.actionBtnSmall}>
                <MaterialCommunityIcons name="chat-outline" size={16} color={C.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtnSmall, { backgroundColor: C.goldSoft, borderColor: C.goldBorder }]}>
                <MaterialCommunityIcons name="sword-cross" size={16} color={C.gold} />
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtnSmall, { backgroundColor: C.dangerSoft }]} onPress={() => onRemove?.(item.id)}>
                <MaterialCommunityIcons name="account-remove-outline" size={15} color={C.danger} />
              </TouchableOpacity>
            </>
          )}
          {item.status === 'pending_received' && (
            <>
              <TouchableOpacity style={[s.actionBtnSmall, { backgroundColor: C.successSoft, borderColor: C.successBorder }]} onPress={() => onAccept?.(item.id)}>
                <MaterialCommunityIcons name="check" size={16} color={C.success} />
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtnSmall, { backgroundColor: C.dangerSoft }]} onPress={() => onDecline?.(item.id)}>
                <MaterialCommunityIcons name="close" size={15} color={C.danger} />
              </TouchableOpacity>
            </>
          )}
          {item.status === 'pending_sent' && (
            <TouchableOpacity style={[s.actionBtnSmall, { backgroundColor: C.dangerSoft }]} onPress={() => onDecline?.(item.id)}>
              <MaterialCommunityIcons name="clock-remove-outline" size={15} color={C.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function FriendsPanel() {
  const [myId, setMyId] = useState<string | null>(null);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'friends' | 'pending'>('friends');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 500, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
    ]).start();

    loadFriends();
  }, []);

  async function loadFriends() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMyId(user.id);

      const { data } = await supabase
        .from('friendships')
        .select(`
          id,
          status,
          requester_id,
          addressee_id,
          requester:profiles!friendships_requester_id_fkey(id, username, full_name, level, tier, avatar_url),
          addressee:profiles!friendships_addressee_id_fkey(id, username, full_name, level, tier, avatar_url)
        `)
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

      if (!data) return;

      const rows: FriendRow[] = data.map((f: any) => {
        const isSender = f.requester_id === user.id;
        const friend: Profile = isSender ? f.addressee : f.requester;
        const status =
          f.status === 'accepted'
            ? 'accepted'
            : isSender
            ? 'pending_sent'
            : 'pending_received';
        return { id: f.id, friend, status };
      });

      setFriends(rows);
    } catch (e) {
      console.error('Friends load error:', e);
    } finally {
      setLoading(false);
    }
  }

  // Live search
  useEffect(() => {
    if (searchQuery.trim().length < 2) { setSearchResults([]); return; }

    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, username, full_name, level, tier, avatar_url')
        .ilike('username', `%${searchQuery}%`)
        .neq('id', myId ?? '')
        .limit(6);
      setSearchResults((data ?? []) as Profile[]);
      setSearching(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function sendRequest(addresseeId: string) {
    if (!myId) return;
    await supabase.from('friendships').insert({ requester_id: myId, addressee_id: addresseeId, status: 'pending' });
    setSearchQuery('');
    setSearchResults([]);
    loadFriends();
  }

  async function acceptRequest(friendshipId: string) {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    loadFriends();
  }

  async function declineOrRemove(friendshipId: string) {
    await supabase.from('friendships').delete().eq('id', friendshipId);
    loadFriends();
  }

  const acceptedFriends   = friends.filter(f => f.status === 'accepted');
  const pendingReceived   = friends.filter(f => f.status === 'pending_received');
  const pendingSent       = friends.filter(f => f.status === 'pending_sent');
  const pendingAll        = [...pendingReceived, ...pendingSent];
  const displayList       = activeTab === 'friends' ? acceptedFriends : pendingAll;

  // Already friends or requested this user?
  function getRelation(profileId: string) {
    const rel = friends.find(f => f.friend.id === profileId);
    return rel?.status ?? null;
  }

  return (
    <DodgeKeyboard>
      <ScrollView style={s.container} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      {/* ── Header ── */}
      <Animated.View style={[s.header, { opacity: fadeAnim, transform: [{ translateY }] }]}>
        <View>
          <Text style={s.eyebrow}>SOCIAL HUB</Text>
          <Text style={s.title}>Friends</Text>
        </View>

        {/* Search Bar */}
        <View style={s.searchBar}>
          <MaterialCommunityIcons name="magnify" size={18} color={C.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search players by username..."
            placeholderTextColor={C.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searching && <ActivityIndicator size="small" color={C.gold} />}
          {searchQuery.length > 0 && !searching && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
              <MaterialCommunityIcons name="close-circle" size={16} color={C.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={s.statChips}>
          <View style={[s.chip, { backgroundColor: C.successSoft, borderColor: C.successBorder }]}>
            <View style={s.statusDotInline} />
            <Text style={[s.chipText, { color: C.success }]}>{acceptedFriends.length} Friends</Text>
          </View>
          {pendingReceived.length > 0 && (
            <View style={[s.chip, { backgroundColor: C.goldSoft, borderColor: C.goldBorder }]}>
              <Text style={[s.chipText, { color: C.gold }]}>{pendingReceived.length} Requests</Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/* ── Search Results Dropdown ── */}
      {searchResults.length > 0 && (
        <View style={s.searchResults}>
          <Text style={s.searchResultsTitle}>PLAYERS FOUND</Text>
          {searchResults.map(p => {
            const relation = getRelation(p.id);
            const tierColor = getTierColor(p.tier ?? 'newcomer');
            return (
              <View key={p.id} style={s.searchResultRow}>
                <View style={[s.avatarSmall, { backgroundColor: C.goldSoft }]}>
                  <Text style={s.avatarTextSmall}>{getInitials(p.full_name, p.username)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.suggestedName}>{p.full_name || p.username}</Text>
                  <Text style={[s.suggestedMeta, { color: tierColor }]}>
                    @{p.username}  ·  Lv. {p.level ?? 1}
                  </Text>
                </View>
                {relation === null ? (
                  <TouchableOpacity style={s.addFriendBtn} onPress={() => sendRequest(p.id)}>
                    <MaterialCommunityIcons name="account-plus" size={13} color="#000" />
                    <Text style={s.addFriendBtnText}>ADD</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[s.chip, { backgroundColor: C.goldSoft, borderColor: C.goldBorder }]}>
                    <Text style={[s.chipText, { color: C.gold }]}>
                      {relation === 'accepted' ? 'Friends' : 'Pending'}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      <View style={s.mainGrid}>
        {/* ── Left Column: Friends / Pending Tabs ── */}
        <View style={s.listCol}>
          <View style={s.section}>
            {/* Tabs */}
            <View style={s.tabs}>
              <Pressable style={[s.tab, activeTab === 'friends' && s.tabActive]} onPress={() => setActiveTab('friends')}>
                <Text style={[s.tabText, activeTab === 'friends' && s.tabTextActive]}>
                  Friends ({acceptedFriends.length})
                </Text>
              </Pressable>
              <Pressable style={[s.tab, activeTab === 'pending' && s.tabActive]} onPress={() => setActiveTab('pending')}>
                <Text style={[s.tabText, activeTab === 'pending' && s.tabTextActive]}>
                  Pending {pendingAll.length > 0 ? `(${pendingAll.length})` : ''}
                </Text>
              </Pressable>
            </View>

            {loading ? (
              <ActivityIndicator color={C.gold} style={{ paddingVertical: 20 }} />
            ) : displayList.length === 0 ? (
              <View style={s.emptyBox}>
                <MaterialCommunityIcons
                  name={activeTab === 'friends' ? 'account-group-outline' : 'account-clock-outline'}
                  size={32}
                  color={C.divider}
                />
                <Text style={s.emptyText}>
                  {activeTab === 'friends'
                    ? 'No friends yet.\nSearch for players to connect!'
                    : 'No pending requests.'}
                </Text>
              </View>
            ) : (
              <View style={s.friendsList}>
                {displayList.map((f, i) => (
                  <FriendItem
                    key={f.id}
                    item={f}
                    delay={200 + i * 80}
                    onAccept={acceptRequest}
                    onDecline={declineOrRemove}
                    onRemove={declineOrRemove}
                  />
                ))}
              </View>
            )}
          </View>
        </View>

        {/* ── Right Column: Stats ── */}
        <View style={s.sideCol}>
          <View style={s.section}>
            <Text style={s.sectionTitleSmall}>Your Network</Text>
            <View style={s.networkGrid}>
              <View style={s.networkStat}>
                <Text style={s.networkVal}>{acceptedFriends.length}</Text>
                <Text style={s.networkLabel}>Friends</Text>
              </View>
              <View style={s.networkDivider} />
              <View style={s.networkStat}>
                <Text style={s.networkVal}>{pendingReceived.length}</Text>
                <Text style={s.networkLabel}>Requests</Text>
              </View>
              <View style={s.networkDivider} />
              <View style={s.networkStat}>
                <Text style={s.networkVal}>{pendingSent.length}</Text>
                <Text style={s.networkLabel}>Sent</Text>
              </View>
            </View>
          </View>

          <View style={[s.section, { marginTop: 10 }]}>
            <Text style={s.sectionTitleSmall}>How to Add Friends</Text>
            {[
              { icon: 'magnify' as IconName,       tip: 'Search by exact username' },
              { icon: 'account-plus' as IconName,   tip: 'Tap ADD to send a request' },
              { icon: 'check-circle-outline' as IconName, tip: 'Accept incoming requests' },
              { icon: 'sword-cross' as IconName,    tip: 'Challenge friends to a game' },
            ].map(({ icon, tip }) => (
              <View key={tip} style={s.tipRow}>
                <View style={s.tipIcon}>
                  <MaterialCommunityIcons name={icon} size={14} color={C.gold} />
                </View>
                <Text style={s.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      </ScrollView>
    </DodgeKeyboard>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: 10, paddingBottom: 20, paddingHorizontal: 12, paddingTop: 8 },

  header: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    padding: 14, backgroundColor: C.surface, borderRadius: 18,
    borderWidth: 1, borderColor: C.goldBorder, gap: 12,
  },
  eyebrow: { color: C.gold, fontSize: 9, fontWeight: '700', letterSpacing: 2 },
  title: { color: C.textPrimary, fontSize: 20, fontWeight: '800' },

  searchBar: {
    flex: 1, minWidth: 180, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 50,
    paddingHorizontal: 12, paddingVertical: 4, gap: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  searchInput: { flex: 1, color: C.textPrimary, fontSize: 13 },

  statChips: { flexDirection: 'row', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 99, borderWidth: 1,
  },
  chipText: { fontSize: 10, fontWeight: '700' },
  statusDotInline: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.success },

  searchResults: {
    backgroundColor: C.surface, borderRadius: 16, borderWidth: 1,
    borderColor: C.goldBorder, padding: 12, gap: 4,
  },
  searchResultsTitle: { color: C.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 6 },
  searchResultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.divider },
  addFriendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.gold, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
  },
  addFriendBtnText: { fontSize: 10, fontWeight: '900', color: '#000' },

  mainGrid: { flexDirection: 'row', gap: 10 },
  listCol: { flex: 1.6 },
  sideCol: { flex: 1 },

  section: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 15 },
  sectionTitleSmall: { color: C.textPrimary, fontSize: 14, fontWeight: '800', marginBottom: 12 },

  tabs: { flexDirection: 'row', gap: 6, marginBottom: 14, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: 4 },
  tab: { flex: 1, paddingVertical: 7, borderRadius: 7, alignItems: 'center' },
  tabActive: { backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.goldBorder },
  tabText: { color: C.textMuted, fontSize: 11, fontWeight: '700' },
  tabTextActive: { color: C.textPrimary },

  friendsList: { gap: 2 },
  friendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.divider, gap: 12 },
  avatarContainer: { position: 'relative' },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  avatarText: { color: C.textPrimary, fontSize: 14, fontWeight: '800' },
  statusDot: { position: 'absolute', bottom: 2, right: 2, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#0A2318' },
  tierPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  tierText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  friendInfo: { flex: 1, gap: 2 },
  friendNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  friendName: { color: C.textPrimary, fontSize: 14, fontWeight: '700' },
  friendMeta: { color: C.textMuted, fontSize: 11 },
  friendActions: { flexDirection: 'row', gap: 6 },
  actionBtnSmall: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },

  avatarSmall: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avatarTextSmall: { color: C.textPrimary, fontSize: 10, fontWeight: '800' },
  suggestedName: { color: C.textPrimary, fontSize: 13, fontWeight: '600' },
  suggestedMeta: { fontSize: 10, fontWeight: '600' },

  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { color: C.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18 },

  networkGrid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 6 },
  networkStat: { alignItems: 'center', gap: 2 },
  networkVal: { color: C.textPrimary, fontSize: 22, fontWeight: '900' },
  networkLabel: { color: C.textMuted, fontSize: 10, fontWeight: '600' },
  networkDivider: { width: 1, height: 30, backgroundColor: C.divider },

  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  tipIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: C.goldSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.goldBorder },
  tipText: { color: C.textMuted, fontSize: 11, flex: 1 },
});
