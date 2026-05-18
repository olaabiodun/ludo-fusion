import { supabase } from '@/lib/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');

const C = {
  gold: '#D4AF37',
  goldSoft: 'rgba(212,175,55,0.14)',
  goldBorder: 'rgba(212,175,55,0.28)',
  surface: 'rgba(7, 21, 15, 0.92)',
  surfaceStrong: 'rgba(5, 16, 11, 0.98)',
  textPrimary: '#F5EFD8',
  textMuted: 'rgba(245,239,216,0.6)',
  success: '#57D08B',
  danger: '#F26B6B',
  divider: 'rgba(255,255,255,0.06)',
};

type PlayerProfile = {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  level: number;
  xp: number;
  tier: string;
  streak: number;
  created_at: string;
  stats?: {
    total_matches: number;
    total_wins: number;
    win_rate: number;
  };
  friendship?: 'none' | 'pending_sent' | 'pending_received' | 'friends';
};

export function PlayerProfileModal({
  playerId,
  visible,
  onClose,
}: {
  playerId: string | null;
  visible: boolean;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [localUserId, setLocalUserId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (visible && playerId) {
      loadProfile();
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, damping: 16, stiffness: 200, useNativeDriver: true }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.92);
      setProfile(null);
    }
  }, [visible, playerId]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const lUid = user?.id || null;
      setLocalUserId(lUid);

      const { data: pData } = await supabase.from('profiles').select('*').eq('id', playerId).single();
      if (!pData) { setLoading(false); return; }

      const { data: sData } = await supabase.from('profile_stats').select('*').eq('player_id', playerId).single();

      let friendship: PlayerProfile['friendship'] = 'none';
      if (lUid && lUid !== playerId) {
        const { data: fData } = await supabase
          .from('friendships')
          .select('*')
          .or(`and(requester_id.eq.${lUid},addressee_id.eq.${playerId}),and(requester_id.eq.${playerId},addressee_id.eq.${lUid})`)
          .single();

        if (fData) {
          if (fData.status === 'accepted') friendship = 'friends';
          else if (fData.requester_id === lUid) friendship = 'pending_sent';
          else friendship = 'pending_received';
        }
      }

      setProfile({
        ...pData,
        stats: sData || { total_matches: 0, total_wins: 0, win_rate: 0 },
        friendship
      });
    } catch (e) {
      console.warn('Failed to load profile', e);
    }
    setLoading(false);
  };

  const handleAction = async () => {
    if (!profile || !localUserId || localUserId === playerId) return;
    setActionLoading(true);
    try {
      if (profile.friendship === 'none') {
        await supabase.from('friendships').insert({ requester_id: localUserId, addressee_id: playerId });
        setProfile({ ...profile, friendship: 'pending_sent' });
      } else if (profile.friendship === 'pending_received') {
        await supabase.from('friendships').update({ status: 'accepted' })
          .match({ requester_id: playerId, addressee_id: localUserId });
        setProfile({ ...profile, friendship: 'friends' });
      } else if (profile.friendship === 'friends' || profile.friendship === 'pending_sent') {
        await supabase.from('friendships').delete()
          .or(`and(requester_id.eq.${localUserId},addressee_id.eq.${playerId}),and(requester_id.eq.${playerId},addressee_id.eq.${localUserId})`);
        setProfile({ ...profile, friendship: 'none' });
      }
    } catch (e) {
      console.error(e);
    }
    setActionLoading(false);
  };

  const formatTier = (t: string) => {
    if (!t) return 'Newcomer';
    return t.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const initials = profile?.username ? profile.username.substring(0, 2).toUpperCase() : 'PL';

  if (!visible) return null;

  return (
    <View style={s.wrapper}>
      <Pressable style={s.backdrop} onPress={onClose} />

      <Animated.View style={[s.card, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <LinearGradient
          colors={['rgba(3,10,6,0.95)', 'rgba(5,16,11,1)']}
          style={StyleSheet.absoluteFill}
          borderRadius={24}
        />
        <View style={s.borderRing} pointerEvents="none" />

        <TouchableOpacity style={s.closeBtn} onPress={onClose}>
          <MaterialCommunityIcons name="close" size={20} color={C.textMuted} />
        </TouchableOpacity>

        {loading || !profile ? (
          <View style={{ height: 200, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator color={C.gold} size="large" />
          </View>
        ) : (
          <View style={s.content}>
            <View style={s.leftCol}>
              <View style={s.avatarWrap}>
                <LinearGradient colors={['#1E5A39', '#0A2318']} style={StyleSheet.absoluteFill} />
                {profile.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={s.avatar} />
                ) : (
                  <Text style={s.avatarText}>{initials}</Text>
                )}
                <View style={s.levelBadge}>
                  <Text style={s.levelBadgeText}>{profile.level}</Text>
                </View>
              </View>
              <Text style={s.name}>{profile.full_name || profile.username}</Text>
              <Text style={s.username}>@{profile.username}</Text>

              <View style={s.tierPill}>
                <MaterialCommunityIcons name="shield-star" size={12} color={C.gold} />
                <Text style={s.tierText}>{formatTier(profile.tier)}</Text>
              </View>
            </View>

            <View style={s.divider} />

            <View style={s.rightCol}>
              <View style={s.statsGrid}>
                <View style={s.statBox}>
                  <Text style={s.statValue}>{profile.stats?.total_matches || 0}</Text>
                  <Text style={s.statLabel}>Matches</Text>
                </View>
                <View style={s.statDiv} />
                <View style={s.statBox}>
                  <Text style={[s.statValue, { color: C.success }]}>{profile.stats?.win_rate || 0}%</Text>
                  <Text style={s.statLabel}>Win Rate</Text>
                </View>
                <View style={s.statDiv} />
                <View style={s.statBox}>
                  <Text style={[s.statValue, { color: C.gold }]}>{profile.streak || 0}</Text>
                  <Text style={s.statLabel}>Streak</Text>
                </View>
              </View>

              <View style={s.detailsBlock}>
                <View style={s.detailsRow}>
                  <MaterialCommunityIcons name="star-shooting-outline" size={16} color={C.textMuted} />
                  <Text style={s.detailsText}>Total XP:</Text>
                  <View style={{ flex: 1 }} />
                  <Text style={s.detailsValue}>{profile.xp?.toLocaleString() || 0} XP</Text>
                </View>

                <View style={s.detailsRow}>
                  <MaterialCommunityIcons name="calendar-month-outline" size={16} color={C.textMuted} />
                  <Text style={s.detailsText}>Joined:</Text>
                  <View style={{ flex: 1 }} />
                  <Text style={s.detailsValue}>{new Date(profile.created_at).toLocaleDateString()}</Text>
                </View>
              </View>

              {localUserId && localUserId !== profile.id && (
                <TouchableOpacity
                  style={[
                    s.actionBtn,
                    profile.friendship === 'friends' && s.actionBtnFriends,
                    (profile.friendship === 'pending_sent' || profile.friendship === 'pending_received') && s.actionBtnPending
                  ]}
                  onPress={handleAction}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <>
                      <MaterialCommunityIcons
                        name={
                          profile.friendship === 'friends' ? 'account-check' :
                            profile.friendship === 'pending_sent' ? 'account-clock' :
                              profile.friendship === 'pending_received' ? 'account-arrow-left' :
                                'account-plus'
                        }
                        size={18}
                        color={profile.friendship === 'friends' || profile.friendship === 'pending_sent' ? C.textPrimary : '#000'}
                      />
                      <Text style={[
                        s.actionBtnText,
                        (profile.friendship === 'friends' || profile.friendship === 'pending_sent') && { color: C.textPrimary }
                      ]}>
                        {profile.friendship === 'friends' ? 'Unfriend' :
                          profile.friendship === 'pending_sent' ? 'Request Sent' :
                            profile.friendship === 'pending_received' ? 'Accept Request' :
                              'Add Friend'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  card: {
    width: Math.min(480, SW * 0.92),
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
  },
  borderRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 20,
  },
  leftCol: {
    width: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: 1,
    backgroundColor: C.divider,
    marginVertical: 10,
  },
  rightCol: {
    flex: 1,
    justifyContent: 'center',
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: C.gold,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: C.textPrimary,
    fontSize: 24,
    fontWeight: '900',
  },
  levelBadge: {
    position: 'absolute',
    bottom: -2,
    backgroundColor: C.gold,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: C.surfaceStrong,
  },
  levelBadgeText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '900',
  },
  name: {
    color: C.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
    textAlign: 'center',
  },
  username: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'center',
  },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.goldSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  tierText: {
    color: C.gold,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 14,
    padding: 10,
    width: '100%',
    borderWidth: 1,
    borderColor: C.divider,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    color: C.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  statLabel: {
    color: C.textMuted,
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statDiv: {
    width: 1,
    height: 24,
    backgroundColor: C.divider,
  },
  detailsBlock: {
    marginBottom: 16,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
    gap: 8,
  },
  detailsText: {
    color: C.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  detailsValue: {
    color: C.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    height: 40,
    backgroundColor: C.gold,
    borderRadius: 10,
  },
  actionBtnFriends: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: C.danger,
  },
  actionBtnPending: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  actionBtnText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
