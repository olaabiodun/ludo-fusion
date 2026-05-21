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
import { useFeatureActive } from '@/lib/FeatureContext';

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
  danger: '#F26B6B',
  bg: '#040d07',
  divider: 'rgba(255,255,255,0.05)',
};

function useFadeSlide(delay = 0, fromY = 14) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(fromY)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 450, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, damping: 16, stiffness: 140, useNativeDriver: true }),
    ]).start();
  }, []);
  return { opacity, transform: [{ translateY }] };
}

function getInitials(name?: string | null) {
  if (!name) return 'PL';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function Sparkle({ delay }: { delay: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.Text style={{ opacity: anim, fontSize: 10, color: C.gold }}>✦</Animated.Text>
  );
}

export function ReferralPanel({ onClose }: { visible?: boolean; onClose: () => void }) {
  const gambling = useFeatureActive();
  const bonusLabel = gambling ? '₦50' : '50 coins';
  const [referralCode, setReferralCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [referrals, setReferrals] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalEarned: 0, totalReferrals: 0 });
  const [userName, setUserName] = useState('Player');
  const [userInitials, setUserInitials] = useState('PL');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasReferrer, setHasReferrer] = useState(false);
  const [copied, setCopied] = useState(false);

  const headerAnim = useFadeSlide(0, -12);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.92, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

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

  useEffect(() => { load(); }, [load]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join Ludo Fusion! 👑 Use my referral code ${referralCode} to get ${bonusLabel} bonus instantly!`,
      });
    } catch (e) { console.error(e); }
  };

  const handleCopy = async () => {
    try {
      const Clipboard = require('expo-clipboard');
      await Clipboard.setStringAsync(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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

      const { data: myProfile } = await supabase.from('profiles').select('wallet_balance').eq('id', user.id).single();
      await supabase.from('profiles').update({ wallet_balance: (myProfile?.wallet_balance || 0) + 50 }).eq('id', user.id);
      await supabase.from('profiles').update({ wallet_balance: (referrer.wallet_balance || 0) + 50 }).eq('id', referrer.id);

      await supabase.from('transactions').insert([
        { player_id: user.id, amount: 50, type: 'bonus', description: 'Referral signup bonus' },
        { player_id: referrer.id, amount: 50, type: 'bonus', description: 'Referral reward' },
      ]);

      setHasReferrer(true);
      DeviceEventEmitter.emit('wallet_updated');
      alert(`Referral claimed! ${bonusLabel} added to your balance.`);
    } catch (e: any) {
      alert(e.message || 'Error processing code');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={s.root}>
      <DodgeKeyboard>
        <ScrollView style={s.scroll} contentContainerStyle={s.contentContainer} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <Animated.View style={[s.topBar, headerAnim]}>
            <View style={s.headerBlock}>
              <Text style={s.eyebrow}>PROMOTIONS</Text>
              <Text style={s.pageTitle}>Refer & Earn</Text>
            </View>
            <View style={s.headerRight}>
              <Pressable style={s.notifBtn} onPress={onClose}>
                <MaterialCommunityIcons name="close" size={18} color={C.textMuted} />
              </Pressable>
              <View style={s.idChip}>
                <View style={s.idAvatar}>
                  <LinearGradient colors={['#1E5A39', '#0A2318']} style={[StyleSheet.absoluteFill, { borderRadius: 10 }]} />
                  <Text style={s.idAvatarText}>{userInitials}</Text>
                </View>
                <View>
                  <Text style={s.idName}>{userName}</Text>
                  <Text style={s.idHandle}>@{userName.toLowerCase().replace(' ', '')}</Text>
                </View>
              </View>
            </View>
          </Animated.View>

          <View style={s.mainGrid}>
            {/* Left Column */}
            <View style={s.leftCol}>
              {/* Hero Banner */}
              <View style={s.heroCard}>
                <LinearGradient
                  colors={['#1a0e00', '#2d1a00', '#4a2a00']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                />
                <View style={[s.heroShine, { top: -40, right: -40 }]} />
                <View style={[s.heroShine, { bottom: -30, left: -30, width: 120, height: 120 }]} />
                <View style={s.heroContent}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialCommunityIcons name="crown" size={16} color={C.gold} />
                    <Text style={s.heroEyebrow}>REFERRAL REWARDS</Text>
                    <View style={{ flexDirection: 'row', gap: 2 }}>
                      <Sparkle delay={0} /><Sparkle delay={200} /><Sparkle delay={400} />
                    </View>
                  </View>
                  <Text style={s.heroTitle}>
                    Earn <Text style={{ color: C.gold }}>{bonusLabel}</Text> per{'\n'}Friend
                  </Text>
                  <Text style={s.heroSub}>No limit — invite everyone you know</Text>
                  <View style={s.heroBadgeRow}>
                    <View style={s.heroBadge}>
                      <MaterialCommunityIcons name="account-plus" size={10} color={C.gold} />
                      <Text style={s.heroBadgeText}>Share code</Text>
                    </View>
                    <View style={s.heroBadge}>
                      <MaterialCommunityIcons name="check-circle" size={10} color={C.success} />
                      <Text style={s.heroBadgeText}>Friend joins</Text>
                    </View>
                    <View style={s.heroBadge}>
                      <MaterialCommunityIcons name="cash" size={10} color={C.gold} />
                      <Text style={s.heroBadgeText}>You both earn</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Referral Code */}
              <View style={s.codeSection}>
                <View style={s.codeLabelRow}>
                  <MaterialCommunityIcons name="qrcode" size={12} color={C.gold} />
                  <Text style={s.codeLabel}>Your Referral Code</Text>
                </View>
                <Animated.View style={[s.codeBoxOuter, { transform: [{ scale: pulseAnim }] }]}>
                  <LinearGradient
                    colors={['rgba(212,175,55,0.15)', 'rgba(212,175,55,0.05)']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  />
                  <View style={s.codeBoxInner}>
                    <Text style={s.codeText}>{referralCode || '......'}</Text>
                  </View>
                  <TouchableOpacity style={s.copyBtn} onPress={handleCopy}>
                    <MaterialCommunityIcons name={copied ? 'check' : 'content-copy'} size={14} color="#000" />
                    <Text style={s.copyBtnText}>{copied ? 'COPIED' : 'COPY'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.shareBtn} onPress={handleShare}>
                    <MaterialCommunityIcons name="share-variant" size={14} color={C.gold} />
                  </TouchableOpacity>
                </Animated.View>
              </View>

              {/* Redeem Code */}
              {!hasReferrer && (
                <View style={s.section}>
                  <View style={s.sectionHeaderRow}>
                    <MaterialCommunityIcons name="ticket-confirmation-outline" size={14} color={C.gold} />
                    <Text style={s.sectionTitle}>Redeem a Code</Text>
                  </View>
                  <Text style={s.sectionCaption}>Enter a friend's referral code to claim {bonusLabel}</Text>
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
                      {submitting ? <ActivityIndicator size="small" color="#000" /> : <MaterialCommunityIcons name="check" size={18} color="#000" />}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* Right Column */}
            <View style={s.rightCol}>
              {/* Stats */}
              <View style={s.statsRow}>
                <LinearGradient colors={['rgba(212,175,55,0.12)', 'rgba(212,175,55,0.02)']} style={s.statCard}>
                  <View style={s.statIconWrap}>
                    <MaterialCommunityIcons name="cash" size={16} color={C.gold} />
                  </View>
                  <Text style={s.statVal}>{gambling ? `₦${stats.totalEarned}` : `${stats.totalEarned} coins`}</Text>
                  <Text style={s.statLabel}>Total Earned</Text>
                </LinearGradient>
                <LinearGradient colors={['rgba(87,208,139,0.12)', 'rgba(87,208,139,0.02)']} style={s.statCard}>
                  <View style={[s.statIconWrap, { backgroundColor: C.successSoft, borderColor: C.successBorder }]}>
                    <MaterialCommunityIcons name="account-group" size={16} color={C.success} />
                  </View>
                  <Text style={s.statVal}>{stats.totalReferrals}</Text>
                  <Text style={s.statLabel}>Referred</Text>
                </LinearGradient>
              </View>

              {/* History */}
              <View style={[s.section, { flex: 1 }]}>
                <View style={s.sectionHeaderRow}>
                  <MaterialCommunityIcons name="history" size={14} color={C.gold} />
                  <Text style={s.sectionTitle}>Recent Referrals</Text>
                  {referrals.length > 0 && <Text style={s.sectionCount}>{referrals.length}</Text>}
                </View>
                <View style={s.historyList}>
                  {loading ? (
                    <ActivityIndicator color={C.gold} style={{ marginTop: 20 }} />
                  ) : referrals.length > 0 ? (
                    referrals.slice(0, 5).map((ref, i) => (
                      <View key={i} style={s.historyRow}>
                        <View style={s.historyAvatar}>
                          <LinearGradient colors={['#1E5A39', '#0A2318']} style={StyleSheet.absoluteFill} />
                          <Text style={s.historyAvatarText}>
                            {getInitials(ref.referred?.full_name || ref.referred?.username)}
                          </Text>
                        </View>
                        <View style={s.historyInfo}>
                          <Text style={s.historyName}>{ref.referred?.full_name || ref.referred?.username || 'Player'}</Text>
                          <Text style={s.historyDate}>{new Date(ref.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                        </View>
                        <View style={s.historyBadge}>
                          <Text style={s.historyAmount}>+{gambling ? `₦${ref.bonus_amount}` : `${ref.bonus_amount} coins`}</Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={s.emptyState}>
                      <MaterialCommunityIcons name="gift-outline" size={28} color={C.textFaint} />
                      <Text style={s.emptyText}>No referrals yet</Text>
                      <Text style={s.emptySub}>Share your code to start earning</Text>
                    </View>
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

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05110B' },
  scroll: { flex: 1 },
  contentContainer: { paddingBottom: 24, paddingHorizontal: 10, paddingVertical: 5 },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 4 },
  headerBlock: { gap: 1 },
  eyebrow: { color: C.gold, fontSize: 9, fontWeight: '800', letterSpacing: 2 },
  pageTitle: { color: C.textPrimary, fontSize: 22, fontWeight: '900' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notifBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  idChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.03)', padding: 4, paddingRight: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  idAvatar: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  idAvatarText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  idName: { color: C.textPrimary, fontSize: 11, fontWeight: '700' },
  idHandle: { color: C.textMuted, fontSize: 9 },

  mainGrid: { flexDirection: 'row', gap: 12, paddingHorizontal: 4 },
  leftCol: { flex: 0.42, gap: 12 },
  rightCol: { flex: 0.58, gap: 12 },

  // Hero Banner
  heroCard: {
    borderRadius: 18, overflow: 'hidden', position: 'relative',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)',
    shadowColor: C.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  heroShine: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(212,175,55,0.06)',
  },
  heroContent: { padding: 16, gap: 6 },
  heroEyebrow: { color: C.gold, fontSize: 9, fontWeight: '800', letterSpacing: 2 },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '900', lineHeight: 30 },
  heroSub: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '600' },
  heroBadgeRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingVertical: 4, paddingHorizontal: 8,
    borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  heroBadgeText: { color: C.textMuted, fontSize: 8, fontWeight: '700' },

  // Code Section
  codeSection: { gap: 6 },
  codeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 2 },
  codeLabel: { color: C.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  codeBoxOuter: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: C.goldBorder,
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 4,
  },
  codeBoxInner: { flex: 1, paddingVertical: 10, paddingHorizontal: 14 },
  codeText: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 4 },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.gold, paddingVertical: 7, paddingHorizontal: 12,
    borderRadius: 8,
  },
  copyBtnText: { color: '#000', fontSize: 9, fontWeight: '900' },
  shareBtn: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: 'rgba(212,175,55,0.1)', borderWidth: 1, borderColor: C.goldBorder,
    alignItems: 'center', justifyContent: 'center', marginLeft: 4,
  },

  // Section
  section: {
    backgroundColor: C.surface, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    padding: 14, gap: 6,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { color: C.textPrimary, fontSize: 13, fontWeight: '800' },
  sectionCaption: { color: C.textMuted, fontSize: 10, fontWeight: '500' },
  sectionCount: {
    marginLeft: 'auto', fontSize: 10, fontWeight: '800', color: C.gold,
    backgroundColor: C.goldSoft, paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 6, overflow: 'hidden',
  },

  inputRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 10, height: 40,
    paddingHorizontal: 14, color: '#fff', fontSize: 13, fontWeight: '700',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    letterSpacing: 2,
  },
  claimBtn: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center',
  },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    gap: 4,
  },
  statIconWrap: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.goldBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  statVal: { color: C.textPrimary, fontSize: 18, fontWeight: '900' },
  statLabel: { color: C.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },

  // History
  historyList: { gap: 0, marginTop: 4 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.divider },
  historyAvatar: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  historyAvatarText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  historyInfo: { flex: 1, gap: 1 },
  historyName: { color: C.textPrimary, fontSize: 12, fontWeight: '700' },
  historyDate: { color: C.textMuted, fontSize: 9 },
  historyBadge: { backgroundColor: C.successSoft, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: C.successBorder },
  historyAmount: { color: C.success, fontSize: 11, fontWeight: '900' },
  emptyState: { alignItems: 'center', gap: 4, paddingVertical: 24 },
  emptyText: { color: C.textMuted, fontSize: 12, fontWeight: '700' },
  emptySub: { color: C.textFaint, fontSize: 10 },
});
