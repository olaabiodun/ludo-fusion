import { supabase } from '@/lib/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { playButtonSound } from '@/lib/sounds';
import React from 'react';
import {
  Animated,
  DeviceEventEmitter,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { GiftPanel, MissionsPanel } from './QuickPanels';
import { useFeatureActive } from '@/lib/FeatureContext';
const { useEffect, useRef, useState } = React;

const PulseBadge = ({ count }: { count: string }) => {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.badge, { transform: [{ scale }] }]}>
      <Text style={styles.badgeText}>{count}</Text>
    </Animated.View>
  );
};

export function TopBar({
  onSettingsPress, onInboxPress, onAddFundsPress, onWithdrawPress,
}: {
  onSettingsPress?: () => void;
  onInboxPress?: () => void;
  onAddFundsPress?: () => void;
  onWithdrawPress?: () => void;
}) {
  const [userName, setUserName] = useState('Player');
  const [balance, setBalance] = useState('0');
  const [level, setLevel] = useState(1);
  const [xpProgress, setXpProgress] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<'gift' | 'missions' | null>(null);
  const gamblingEnabled = useFeatureActive();
  const togglePanel = (p: 'gift' | 'missions') =>
    setActivePanel(prev => (prev === p ? null : p));

  const formatBalance = (num: number) => {
    if (num >= 1e12) return (num / 1e12).toFixed(1) + 't';
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'b';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'm';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'k';
    return num.toString();
  };

  useEffect(() => {
    let channel: any;

    async function setupSubscription() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUserName('Guest Player');
        setBalance('1,000');
        setLevel(1);
        setXpProgress(15);
        return;
      }

      // 1. Initial fetch
      const { data: profile } = await supabase.from('profiles').select('full_name, username, wallet_balance, level, xp, xp_next_level, avatar_url').eq('id', user.id).single();
      if (profile) {
        setUserName(profile.full_name || profile.username || 'Player');
        setBalance(formatBalance(Number(profile.wallet_balance ?? 0)));
        setLevel(profile.level ?? 1);
        setAvatarUrl(profile.avatar_url);
        const xp = profile.xp ?? 0;
        const next = profile.xp_next_level ?? 1000;
        setXpProgress(Math.min(100, Math.floor((xp / next) * 100)));
      }

      // 1.1 Fetch unread count
      const { count: privateUnread } = await supabase.from('inbox').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false);
      const { data: announcements } = await supabase.from('inbox').select('id').is('user_id', null);
      const { data: readAnnouncements } = await supabase.from('announcement_reads').select('announcement_id').eq('user_id', user.id);

      const unreadAnnouncements = (announcements?.length || 0) - (readAnnouncements?.length || 0);
      setUnreadCount((privateUnread || 0) + Math.max(0, unreadAnnouncements));

      // 2. Real-time subscription
      channel = supabase
        .channel(`profile_updates_${user.id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
          (payload) => {
            if (payload.new) {
              if (payload.new.wallet_balance !== undefined) {
                setBalance(formatBalance(Number(payload.new.wallet_balance)));
              }
              if (payload.new.level !== undefined) {
                setLevel(payload.new.level);
              }
              if (payload.new.avatar_url !== undefined) {
                setAvatarUrl(payload.new.avatar_url);
              }
              if (payload.new.xp !== undefined && payload.new.xp_next_level !== undefined) {
                setXpProgress(Math.min(100, Math.floor((payload.new.xp / payload.new.xp_next_level) * 100)));
              }
            }
          }
        )
        .subscribe();
    }

    setupSubscription();

    // 3. Fallback Event Listener for immediate local updates
    const walletSub = DeviceEventEmitter.addListener('wallet_updated', async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('wallet_balance, level, xp, xp_next_level').eq('id', user.id).single();
      if (profile) {
        setBalance(formatBalance(Number(profile.wallet_balance ?? 0)));
        setLevel(profile.level ?? 1);
        const xp = profile.xp ?? 0;
        const next = profile.xp_next_level ?? 1000;
        setXpProgress(Math.min(100, Math.floor((xp / next) * 100)));
      }

      const { count: privateUnread } = await supabase.from('inbox').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false);
      const { data: announcements } = await supabase.from('inbox').select('id').is('user_id', null);
      const { data: readAnnouncements } = await supabase.from('announcement_reads').select('announcement_id').eq('user_id', user.id);
      const unreadAnnouncements = (announcements?.length || 0) - (readAnnouncements?.length || 0);
      setUnreadCount((privateUnread || 0) + Math.max(0, unreadAnnouncements));
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
      walletSub.remove();
    };
  }, []);

  return (
    <View style={styles.container}>
      <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.topBar}>
        {/* User Profile Section */}
        <TouchableOpacity
          style={styles.profileSection}
          activeOpacity={0.7}
          onPress={() => {
            playButtonSound();
            DeviceEventEmitter.emit('open_profile');
          }}
        >
          <View style={styles.avatarContainer}>
            <View style={styles.avatarInner}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={{ width: 28, height: 28, borderRadius: 14 }} />
              ) : (
                <MaterialCommunityIcons name="account" size={20} color="#D4AF37" />
              )}
            </View>
            <View style={styles.vipCrown}>
              <MaterialCommunityIcons name="crown" size={10} color="#D4AF37" />
            </View>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{userName}</Text>
            <View style={styles.levelRow}>
              <View style={styles.levelBadge}>
                <Text style={styles.levelText}>Lv. {level}</Text>
              </View>
              <View style={styles.expBar}>
                <View style={[styles.expFill, { width: `${xpProgress}%` }]} />
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Brand Logo */}
        <Image
          key={gamblingEnabled ? 'gambling-logo' : 'masked-logo'}
          source={gamblingEnabled ? require('@/assets/images/logoui.png') : require('@/assets/images/logoui1.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.spacer} />

        {/* Quick Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={[styles.actionBtn, activePanel === 'gift' && styles.actionBtnActive]} 
            onPress={() => { playButtonSound(); togglePanel('gift'); }}
          >
            <MaterialCommunityIcons name="gift-outline" size={18} color="#D4AF37" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionBtn, activePanel === 'missions' && styles.actionBtnActive]} 
            onPress={() => { playButtonSound(); togglePanel('missions'); }}
          >
            <MaterialCommunityIcons name="clipboard-text-outline" size={18} color="#D4AF37" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionBtn} 
            onPress={() => { playButtonSound(); onInboxPress?.(); }}
          >
            <MaterialCommunityIcons name="email-outline" size={18} color="#D4AF37" />
            {unreadCount > 0 && <PulseBadge count={unreadCount > 9 ? '9+' : unreadCount.toString()} />}
          </TouchableOpacity>
        </View>

        {/* Balance Section */}
        <View style={styles.statsContainer}>
          {/* Coins */}
          <View style={styles.statSlot}>
            <MaterialCommunityIcons name="database" size={12} color="#D4AF37" />
            <Text style={styles.statValue}>{gamblingEnabled ? `₦${balance}` : `${balance} coins`}</Text>
            {gamblingEnabled && (
            <TouchableOpacity 
              style={styles.plusButton} 
              onPress={() => { playButtonSound(); onAddFundsPress?.(); }}
            >
              <MaterialCommunityIcons name="plus" size={10} color="#fff" />
            </TouchableOpacity>
            )}
          </View>

          {/* Withdraw */}
          {gamblingEnabled && (
          <TouchableOpacity 
            style={styles.withdrawBtn} 
            onPress={() => { playButtonSound(); onWithdrawPress?.(); }}
          >
            <MaterialCommunityIcons name="bank-transfer-out" size={14} color="#D4AF37" />
            <Text style={styles.withdrawText}>WITHDRAW</Text>
          </TouchableOpacity>
          )}
        </View>

        {/* Settings Button */}
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => { playButtonSound(); onSettingsPress?.(); }}
        >
          <MaterialCommunityIcons name="cog-outline" size={18} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>
      </View>

      <GiftPanel visible={activePanel === 'gift'} onClose={() => setActivePanel(null)} />
      <MissionsPanel visible={activePanel === 'missions'} onClose={() => setActivePanel(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 52,
    backgroundColor: 'rgba(10, 35, 24, 0.7)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.2)',
    zIndex: 50,
  },
  topBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  logo: {
    width: 220,
    height: 220,
    resizeMode: 'contain',
    marginLeft: -10,
    marginTop: 42,
    position: 'absolute',
    left: 200, // Positioned near the user info as requested "after"
    top: -120, // Center it vertically relative to the bar
    zIndex: 101,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 1.5,
    borderWidth: 1.5,
    borderColor: '#D4AF37',
    position: 'relative',
  },
  vipCrown: {
    position: 'absolute',
    top: -6,
    right: -4,
    transform: [{ rotate: '15deg' }],
  },
  avatarInner: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    gap: 5,
  },
  userName: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Kanit_900Black',
    fontWeight: 'bold',
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: -1,
  },
  levelBadge: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 4,
    paddingVertical: 0,
    borderRadius: 3,
  },
  levelText: {
    color: '#000',
    fontSize: 8,
    fontWeight: '900',
  },
  expBar: {
    width: 30,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  expFill: {
    width: '65%',
    height: '100%',
    backgroundColor: '#D4AF37',
  },
  spacer: {
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginRight: 16,
  },
  actionBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 6,
  },
  actionBtnActive: {
    backgroundColor: 'rgba(212,175,55,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginRight: 8,
  },
  statSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    paddingLeft: 6,
    paddingRight: 0.3,
    height: 26,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
  },
  statValue: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    marginHorizontal: 4,
    minWidth: 30,
  },
  plusButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#27AE60',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
    marginStart: 0,
    marginBottom: 1,
  },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderRadius: 15,
    paddingHorizontal: 10,
    height: 26,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    gap: 4,
  },
  withdrawText: {
    color: '#D4AF37',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  settingsBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#E24B4A',
    borderRadius: 8,
    minWidth: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
    borderWidth: 1,
    borderColor: '#0A2318',
  },
  badgeText: {
    color: '#fff',
    fontSize: 7,
    fontWeight: '900',
  },
});

