
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Animated,
  Dimensions,
  Share,
  ActivityIndicator,
  DeviceEventEmitter,
  Pressable,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { DodgeKeyboard } from 'react-native-dodge-keyboard';
import { supabase } from '@/lib/supabase';

// ─── Design Tokens (Synced with WalletPanel) ──────────────────────────────────
const C = {
  gold: '#D4AF37',
  goldSoft: 'rgba(212,175,55,0.14)',
  goldMid: 'rgba(212,175,55,0.22)',
  goldBorder: 'rgba(212,175,55,0.28)',
  goldText: '#E7C75A',
  surface: 'rgba(7, 21, 15, 0.88)',
  surfaceStrong: 'rgba(5, 16, 11, 0.94)',
  textPrimary: '#F5EFD8',
  textMuted: 'rgba(245,239,216,0.6)',
  textFaint: 'rgba(245,239,216,0.35)',
  success: '#57D08B',
  successSoft: 'rgba(87,208,139,0.12)',
  successBorder: 'rgba(87,208,139,0.25)',
  bg: '#040d07',
  divider: 'rgba(255,255,255,0.05)',
};

function useFadeSlide(delay = 0, fromY = 14) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(fromY)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 450, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, damping: 16, stiffness: 140, useNativeDriver: true }),
    ]).start();
  }, []);
  return { opacity, transform: [{ translateY }] };
}

function getInitials(name?: string | null) {
  if (!name) return 'PL';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function ReferralPanel({ onClose }: { visible?: boolean; onClose: () => void }) {
  const [referralCode, setReferralCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [referrals, setReferrals] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalEarned: 0, totalReferrals: 0 });
  const [userName, setUserName] = useState('Player');
  const [userInitials, setUserInitials] = useState('PL');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasReferrer, setHasReferrer] = useState(false);

  const headerAnim = useFadeSlide(0, -12);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (profile) {
        setReferralCode(profile.referral_code);
        setHasReferrer(!!profile.referred_by);
        const name = profile.full_name || profile.username || 'Player';
        setUserName(name);
        setUserInitials(getInitials(profile.full_name));
      }

      const { data: refList } = await supabase
        .from('referrals')
        .select('*, referred:profiles!referred_id(username, full_name)')
        .eq('referrer_id', user.id);

      if (refList) {
        setReferrals(refList);
        const earned = refList.reduce((acc, curr) => acc + (curr.bonus_amount || 0), 0);
        setStats({ totalEarned: earned, totalReferrals: refList.length });
      }
    } catch (e) {
      console.error('Referral load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join Ludo Royale! 👑 Use my referral code ${referralCode} to get ₦50 bonus instantly!`,
      });
    } catch (e) { console.error(e); }
  };

  const handleSubmitCode = async () => {
    if (!inputCode || submitting) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: referrer } = await supabase
        .from('profiles')
        .select('id, wallet_balance')
        .eq('referral_code', inputCode.toUpperCase())
        .single();

      if (!referrer) throw new Error('Invalid referral code');
      if (referrer.id === user.id) throw new Error('You cannot refer yourself');

      await supabase.from('profiles').update({ referred_by: referrer.id }).eq('id', user.id);
      await supabase.from('referrals').insert({ referrer_id: referrer.id, referred_id: user.id, bonus_amount: 50 });

      // Update balances (simplified)
      const { data: myProfile } = await supabase.from('profiles').select('wallet_balance').eq('id', user.id).single();
      await supabase.from('profiles').update({ wallet_balance: (myProfile?.wallet_balance || 0) + 50 }).eq('id', user.id);
      await supabase.from('profiles').update({ wallet_balance: (referrer.wallet_balance || 0) + 50 }).eq('id', referrer.id);

      await supabase.from('transactions').insert([
        { player_id: user.id, amount: 50, type: 'bonus', description: 'Referral signup bonus' },
        { player_id: referrer.id, amount: 50, type: 'bonus', description: 'Referral reward' },
      ]);

      setHasReferrer(true);
      DeviceEventEmitter.emit('wallet_updated');
      alert('Referral claimed! ₦50 added to your balance.');
    } catch (e: any) {
      alert(e.message || 'Error processing code');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={s.root}>
      <DodgeKeyboard>
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header bar (Standard UI) ── */}
          <Animated.View style={[s.topBar, headerAnim]}>
            <View style={s.headerBlock}>
              <Text style={s.eyebrow}>PROMOTIONS & REWARDS</Text>
              <Text style={s.pageTitle}>Refer & Earn</Text>
            </View>

            <View style={s.headerRight}>
              <Pressable style={s.notifBtn} onPress={onClose}>
                <MaterialCommunityIcons name="close" size={20} color={C.textMuted} />
              </Pressable>
              <View style={s.idChip}>
                <View style={s.idAvatar}>
                  <LinearGradient colors={['#1E5A39', '#0A2318']} style={[StyleSheet.absoluteFill, { borderRadius: 12 }]} />
                  <Text style={s.idAvatarText}>{userInitials}</Text>
                </View>
                <View>
                  <Text style={s.idName}>{userName}</Text>
                  <Text style={s.idHandle}>@{userName.toLowerCase().replace(' ', '')}</Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* ── Main Landscape Grid ── */}
          <View style={s.mainGrid}>
            <View style={s.leftCol}>
              {/* Promo Banner */}
              <View style={s.section}>
                <LinearGradient colors={['#D4AF37', '#8A6E1E']} style={s.promoBanner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <View>
                    <Text style={s.promoTitle}>Earn ₦50</Text>
                    <Text style={s.promoSub}>Per Referred Friend</Text>
                  </View>
                  <MaterialCommunityIcons name="gift-outline" size={50} color="rgba(0,0,0,0.15)" />
                </LinearGradient>
              </View>

              {/* Your Code Section */}
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <View>
                    <Text style={s.sectionTitle}>Your Referral Code</Text>
                    <Text style={s.sectionCaption}>Share this code to earn rewards</Text>
                  </View>
                </View>
                <View style={s.codeBox}>
                  <Text style={s.codeText}>{referralCode || '......'}</Text>
                  <TouchableOpacity style={s.shareBtn} onPress={handleShare}>
                    <LinearGradient colors={[C.gold, '#A07820']} style={s.shareGrad}>
                      <MaterialCommunityIcons name="share-variant" size={16} color="#000" />
                      <Text style={s.shareText}>SHARE</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Redeem Section */}
              {!hasReferrer && (
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <View>
                      <Text style={s.sectionTitle}>Redeem Code</Text>
                      <Text style={s.sectionCaption}>Enter a friend's referral code</Text>
                    </View>
                  </View>
                  <View style={s.inputRow}>
                    <TextInput
                      style={s.input}
                      placeholder="ENTER CODE"
                      placeholderTextColor={C.textFaint}
                      autoCapitalize="characters"
                      value={inputCode}
                      onChangeText={setInputCode}
                    />
                    <TouchableOpacity style={s.claimBtn} onPress={handleSubmitCode} disabled={submitting}>
                      {submitting ? <ActivityIndicator size="small" color="#000" /> : <Text style={s.claimBtnText}>CLAIM</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Steps */}
              <View style={s.stepsRow}>
                <Step icon="link-variant" label="Share" />
                <Step icon="account-plus-outline" label="Join" />
                <Step icon="cash-check" label="Earn" />
              </View>
            </View>

            <View style={s.rightCol}>
              {/* Stats Cards */}
              <View style={s.statsRow}>
                <View style={s.statCard}>
                  <Text style={s.statVal}>₦{stats.totalEarned}</Text>
                  <Text style={s.statLabel}>TOTAL EARNED</Text>
                </View>
                <View style={s.statCard}>
                  <Text style={s.statVal}>{stats.totalReferrals}</Text>
                  <Text style={s.statLabel}>FRIENDS REFERRED</Text>
                </View>
              </View>

              {/* History Section */}
              <View style={[s.section, { flex: 1, marginBottom: 0 }]}>
                <View style={s.sectionHeader}>
                  <View>
                    <Text style={s.sectionTitle}>Referral History</Text>
                    <Text style={s.sectionCaption}>Recent successful referrals</Text>
                  </View>
                  <Text style={s.sectionAction}>VIEW ALL</Text>
                </View>

                <View style={s.historyList}>
                  {loading ? (
                    <ActivityIndicator color={C.gold} style={{ marginTop: 20 }} />
                  ) : referrals.length > 0 ? (
                    referrals.map((ref, i) => (
                      <View key={i} style={s.historyRow}>
                        <View style={s.historyInfo}>
                          <Text style={s.historyName}>{ref.referred?.full_name || ref.referred?.username || 'Player'}</Text>
                          <Text style={s.historyDate}>{new Date(ref.created_at).toLocaleDateString()}</Text>
                        </View>
                        <View style={s.historyBadge}>
                          <Text style={s.historyAmount}>+₦{ref.bonus_amount}</Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={s.emptyText}>No history yet.</Text>
                  )}
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </DodgeKeyboard>
    </View>
  );
}

function Step({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={s.stepItem}>
      <View style={s.stepIcon}>
        <MaterialCommunityIcons name={icon} size={18} color={C.gold} />
      </View>
      <Text style={s.stepLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05110B' },
  scroll: { flex: 1 },
  contentContainer: { paddingBottom: 24, paddingHorizontal: 10, paddingVertical: 5, },

  // ── Header bar ──
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 4 },
  headerBlock: { gap: 2 },
  eyebrow: { color: C.gold, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  pageTitle: { color: C.textPrimary, fontSize: 24, fontWeight: '900' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  notifBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  idChip: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.04)', padding: 6, paddingRight: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  idAvatar: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  idAvatarText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  idName: { color: C.textPrimary, fontSize: 12, fontWeight: '700' },
  idHandle: { color: C.textMuted, fontSize: 10 },

  // ── Main Grid ──
  mainGrid: { flexDirection: 'row', gap: 14, paddingHorizontal: 4 },
  leftCol: { flex: 0.42, gap: 12 },
  rightCol: { flex: 0.58, gap: 12 },

  promoBanner: { borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  promoTitle: { color: '#000', fontSize: 22, fontWeight: '900' },
  promoSub: { color: 'rgba(0,0,0,0.6)', fontSize: 12, fontWeight: '700' },

  section: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 14, gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 2 },
  sectionTitle: { color: C.textPrimary, fontSize: 14, fontWeight: '800' },
  sectionCaption: { color: C.textMuted, fontSize: 10, marginTop: 1 },
  sectionAction: { color: C.gold, fontSize: 11, fontWeight: '700', marginTop: 2 },

  codeBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 6, paddingLeft: 16, borderWidth: 1, borderColor: C.goldBorder },
  codeText: { flex: 1, color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 3 },
  shareBtn: { borderRadius: 8, overflow: 'hidden' },
  shareGrad: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  shareText: { color: '#000', fontSize: 11, fontWeight: '900' },

  inputRow: { flexDirection: 'row', gap: 10 },
  input: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10, height: 44, paddingHorizontal: 16, color: '#fff', fontSize: 14, fontWeight: '700', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  claimBtn: { backgroundColor: C.gold, borderRadius: 10, paddingHorizontal: 20, height: 44, alignItems: 'center', justifyContent: 'center' },
  claimBtnText: { color: '#000', fontSize: 13, fontWeight: '900' },

  stepsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8, marginTop: 4 },
  stepItem: { alignItems: 'center', gap: 6 },
  stepIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.goldSoft, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { color: C.textMuted, fontSize: 10, fontWeight: '700' },

  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, backgroundColor: C.surface, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  statVal: { color: C.textPrimary, fontSize: 20, fontWeight: '900' },
  statLabel: { color: C.textMuted, fontSize: 8, fontWeight: '800', letterSpacing: 0.5, marginTop: 2 },

  historyList: { gap: 0 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.divider },
  historyInfo: { flex: 1, gap: 2 },
  historyName: { color: C.textPrimary, fontSize: 13, fontWeight: '700' },
  historyDate: { color: C.textMuted, fontSize: 10 },
  historyBadge: { backgroundColor: C.successSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: C.successBorder },
  historyAmount: { color: C.success, fontSize: 12, fontWeight: '900' },
  emptyText: { color: C.textMuted, fontSize: 12, textAlign: 'center', marginTop: 20, fontStyle: 'italic' },
});
