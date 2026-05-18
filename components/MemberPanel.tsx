import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import { supabase } from '@/lib/supabase';
import { useGamblingEnabled } from '@/lib/GamblingContext';

const SW = Dimensions.get('window').width;

const C = {
  gold: '#D4AF37',
  goldBright: '#F5D060',
  goldSoft: 'rgba(212,175,55,0.14)',
  goldBorder: 'rgba(212,175,55,0.28)',
  surface: 'rgba(7, 21, 15, 0.88)',
  surfaceStrong: 'rgba(5, 16, 11, 0.94)',
  textPrimary: '#F5EFD8',
  textMuted: 'rgba(245,239,216,0.6)',
  textFaint: 'rgba(245,239,216,0.28)',
  success: '#57D08B',
  successSoft: 'rgba(87,208,139,0.12)',
  successBorder: 'rgba(87,208,139,0.28)',
  danger: '#F26B6B',
  dangerSoft: 'rgba(242,107,107,0.12)',
  dangerBorder: 'rgba(242,107,107,0.28)',
  divider: 'rgba(255,255,255,0.05)',
  purple: '#A78BFA',
  purpleSoft: 'rgba(167,139,250,0.12)',
  purpleBorder: 'rgba(167,139,250,0.28)',
};

// ── XP Ring ──────────────────────────────────────────────────────────────────
function XpRing({ pct, level }: { pct: number; level: number }) {
  const R = 52, CIRC = 2 * Math.PI * R;
  return (
    <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={120} height={120} viewBox="0 0 120 120">
        <Defs>
          <SvgGrad id="xpg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#F5D060" />
            <Stop offset="100%" stopColor="#A07820" />
          </SvgGrad>
        </Defs>
        <Circle cx={60} cy={60} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={9} />
        <Circle
          cx={60} cy={60} r={R} fill="none"
          stroke="url(#xpg)" strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={`${CIRC * pct} ${CIRC}`}
          rotation="-90" origin="60,60"
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ color: C.gold, fontSize: 28, fontWeight: '900', lineHeight: 30 }}>{level}</Text>
        <Text style={{ color: C.textFaint, fontSize: 9, fontWeight: '800', letterSpacing: 1 }}>LEVEL</Text>
      </View>
    </View>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  const op = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(op, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(y, { toValue: 0, damping: 14, stiffness: 160, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[ms.statCard, { opacity: op, transform: [{ translateY: y }] }]}>
      <View style={[ms.statIcon, { backgroundColor: `${color}18`, borderColor: `${color}44` }]}>
        <MaterialCommunityIcons name={icon as any} size={14} color={color} />
      </View>
      <Text style={ms.statVal}>{value}</Text>
      <Text style={ms.statLabel}>{label}</Text>
    </Animated.View>
  );
}

// ── Perk Row ─────────────────────────────────────────────────────────────────
const PERKS = [
  { icon: 'ticket-percent',   label: 'Reduced fees',        detail: '5% instead of 10%',       active: true  },
  { icon: 'shield-star',      label: 'Priority matchmaking', detail: 'Skip the queue',           active: true  },
  { icon: 'gift',             label: 'Monthly bonus',        detail: '₦500 credited monthly',    active: true  },
  { icon: 'trophy-award',     label: 'Tournament access',    detail: 'Members-only brackets',     active: false },
  { icon: 'star-circle',      label: 'Double XP weekends',   detail: 'Every Saturday & Sunday',  active: false },
];

function PerkRow({ perk, index, isPreview }: { perk: typeof PERKS[0]; index: number; isPreview?: boolean }) {
  const op = useRef(new Animated.Value(0)).current;
  const x  = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(op, { toValue: 1, delay: index * 60, duration: 300, useNativeDriver: true }),
      Animated.spring(x,  { toValue: 0, delay: index * 60, damping: 16, stiffness: 180, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[ms.perkRow, (perk.active || isPreview) && ms.perkActive, { opacity: op, transform: [{ translateX: x }] }]}>
      <View style={[ms.perkIcon, { backgroundColor: perk.active || isPreview ? C.goldSoft : 'rgba(255,255,255,0.03)', borderColor: perk.active || isPreview ? C.goldBorder : C.divider }]}>
        <MaterialCommunityIcons name={perk.icon as any} size={16} color={perk.active || isPreview ? C.gold : C.textFaint} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[ms.perkLabel, (!perk.active && !isPreview) && { color: C.textFaint }]}>{perk.label}</Text>
        <Text style={ms.perkDetail}>{perk.detail}</Text>
      </View>
      {isPreview ? (
        <View style={ms.previewBadge}>
          <Text style={ms.previewBadgeText}>PREMIUM</Text>
        </View>
      ) : (
        <MaterialCommunityIcons
          name={perk.active ? 'check-circle' : 'lock-outline'}
          size={16}
          color={perk.active ? C.success : C.textFaint}
        />
      )}
    </Animated.View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export function MemberPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SW * 0.08)).current;

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const gamblingEnabled = useGamblingEnabled();

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select(`
        username, full_name, wallet_balance, level, xp, xp_next_level, 
        member_since, membership_expires, membership_tier, global_rank,
        profile_stats(total_matches, total_wins, win_rate)
      `)
      .eq('id', user.id)
      .single();
      
    if (data) {
      const stats = (data as any).profile_stats;
      const flattened = {
        ...data,
        games_played: stats?.total_matches || 0,
        wins: stats?.total_wins || 0,
        total_earnings: 0, // Should be sum of games.win_amount if needed
      };
      setProfile(flattened);
    }
  };

  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 420, easing: Easing.out(Easing.back(1)), useNativeDriver: true }),
    ]).start();

    (async () => {
      setLoading(true);
      await fetchProfile();
      setLoading(false);
    })();
  }, [visible]);

  const handleJoinRoyale = async () => {
    try {
      setJoining(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !profile) return;

      const FEE = gamblingEnabled ? 5000 : 500;
      if (profile.wallet_balance < FEE) {
        alert('Insufficient balance. Please add funds to your wallet.');
        setJoining(false);
        return;
      }

      // 1. Calculate expiry (30 days from now)
      const now = new Date();
      const expiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // 2. Perform Transaction
      const { error } = await supabase
        .from('profiles')
        .update({
          wallet_balance: profile.wallet_balance - FEE,
          membership_tier: 'royale',
          membership_expires: expiry.toISOString(),
          member_since: profile.member_since || now.toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      // 3. Log transaction
      await supabase.from('transactions').insert({
        player_id: user.id,
        amount: -FEE,
        type: 'membership',
        status: 'completed',
        description: 'Royale Membership Join'
      });

      await fetchProfile();
      DeviceEventEmitter.emit('wallet_updated');
      alert('Welcome to Royale! Your membership is now active.');
    } catch (err) {
      console.error('Join Error:', err);
      alert('Failed to join. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 20, duration: 280, useNativeDriver: true }),
    ]).start(() => {
      fadeAnim.setValue(0);
      slideAnim.setValue(SW * 0.08);
      onClose();
    });
  };

  if (!visible) return null;

  const xpPct      = profile ? Math.min(1, (profile.xp || 0) / Math.max(1, profile.xp_next_level || 1000)) : 0;
  const winRate    = profile?.games_played ? Math.round(((profile.wins || 0) / profile.games_played) * 100) : 0;
  const expiresDate = profile?.membership_expires ? new Date(profile.membership_expires) : null;
  const daysLeft   = expiresDate ? Math.max(0, Math.ceil((expiresDate.getTime() - Date.now()) / 86_400_000)) : null;
  const isMember   = profile?.membership_tier === 'royale' && (daysLeft === null || daysLeft > 0);
  
  const memberSince = profile?.member_since
    ? new Date(profile.member_since).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
  const tier = profile?.membership_tier ? profile.membership_tier.toUpperCase() : 'FREE';

  return (
    <Animated.View style={[ms.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

      {/* ── Top Bar ── */}
      <View style={ms.topBar}>
        <View style={ms.topBarLeft}>
          <View style={ms.crownBadge}>
            <MaterialCommunityIcons name="crown" size={18} color={C.gold} />
          </View>
          <View>
            <Text style={ms.eyebrow}>COMMUNITY</Text>
            <Text style={ms.title}>{isMember ? `${tier} Member` : 'Join Royale'}</Text>
          </View>
        </View>

        {/* Expiry pill or Join pill */}
        {isMember ? (
          <View style={[ms.expiryPill, (daysLeft !== null && daysLeft <= 7) && ms.expiryPillDanger]}>
            <MaterialCommunityIcons
              name="calendar-clock"
              size={12}
              color={(daysLeft !== null && daysLeft <= 7) ? C.danger : C.gold}
            />
            <Text style={[ms.expiryText, (daysLeft !== null && daysLeft <= 7) && { color: C.danger }]}>
              {daysLeft !== null ? (daysLeft > 0 ? `${daysLeft}d left` : 'Expired') : 'Lifetime'}
            </Text>
          </View>
        ) : (
          <View style={ms.joinBadge}>
            <Text style={ms.joinBadgeText}>GO PRO</Text>
          </View>
        )}

        <TouchableOpacity onPress={handleClose} style={ms.closeBtn}>
          <MaterialCommunityIcons name="close" size={20} color={C.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* ── Main Grid ── */}
      <View style={ms.mainGrid}>

        {/* ── LEFT: Profile or Join Hero ── */}
        <View style={ms.leftCol}>
          {loading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={C.gold} size="large" />
            </View>
          ) : !isMember ? (
            /* JOIN HERO SCREEN */
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ms.joinHeroBody}>
              <LinearGradient colors={['rgba(212,175,55,0.15)', 'transparent']} style={ms.joinHeroBg} />
              
              <Animated.View style={ms.joinHeroIcon}>
                <MaterialCommunityIcons name="crown-outline" size={64} color={C.gold} />
              </Animated.View>
              
              <Text style={ms.joinHeroTitle}>Unlock Royale Benefits</Text>
              <Text style={ms.joinHeroSub}>Join thousands of premium players and dominate the leaderboard with exclusive perks.</Text>

              {/* Feature comparison tiles */}
              <View style={ms.comparisonGrid}>
                {[
                  { icon: 'ticket-percent', label: 'Reduced fees', detail: '5% fee on wins' },
                  { icon: 'shield-star', label: 'Priority queue', detail: 'Skip the line' },
                  { icon: 'gift', label: 'Monthly ₦500', detail: 'Free coins every month' },
                  { icon: 'trophy-award', label: 'Tournaments', detail: 'Members-only brackets' },
                ].map((feat, i) => (
                  <View key={feat.label} style={ms.compTile}>
                    <View style={ms.compTileIcon}>
                      <MaterialCommunityIcons name={feat.icon as any} size={16} color={C.gold} />
                    </View>
                    <Text style={ms.compTileLabel}>{feat.label}</Text>
                    <Text style={ms.compTileDetail}>{feat.detail}</Text>
                  </View>
                ))}
              </View>
              
              <View style={ms.joinPriceCard}>
                <View style={ms.priceRow}>
                  <Text style={ms.joinPriceLabel}>MEMBERSHIP FEE</Text>
                  <View style={ms.saveBadge}>
                    {gamblingEnabled && <Text style={ms.saveBadgeText}>SAVE 40%</Text>}
                  </View>
                </View>
                <Text style={ms.joinPriceVal}>{gamblingEnabled ? '₦5,000' : '500'}<Text style={{fontSize: 14, color: C.textMuted}}>{gamblingEnabled ? '/month' : ' coins/mo'}</Text></Text>
                <View style={ms.joinPriceDivider} />
                <View style={ms.walletCheck}>
                  <MaterialCommunityIcons name="wallet-outline" size={14} color={C.textMuted} />
                  <Text style={ms.walletCheckText}>{gamblingEnabled ? `Balance: ₦${profile?.wallet_balance?.toLocaleString() || '0'}` : `Coins: ${profile?.wallet_balance?.toLocaleString() || '0'}`}</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={ms.joinBigBtn} 
                onPress={handleJoinRoyale}
                disabled={joining}
                activeOpacity={0.8}
              >
                <LinearGradient colors={['#F5D060', '#A07820']} style={ms.joinBigBtnGrad}>
                  {joining ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <>
                      <Text style={ms.joinBigBtnText}>JOIN ROYALE NOW</Text>
                      <MaterialCommunityIcons name="arrow-right" size={18} color="#000" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
              
              <Text style={ms.secureNotice}>
                <MaterialCommunityIcons name="shield-check" size={10} /> Instant activation · Secure transaction
              </Text>
            </ScrollView>
          ) : (
            /* MEMBER PROFILE SCREEN */
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, padding: 14 }}>

              {/* Profile hero */}
              <LinearGradient
                colors={['rgba(212,175,55,0.12)', 'rgba(212,175,55,0.04)', 'transparent']}
                style={ms.profileHero}
              >
                <XpRing pct={xpPct} level={profile?.level || 1} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={ms.profileName} numberOfLines={1}>
                    {profile?.full_name || profile?.username || 'Player'}
                  </Text>
                  <Text style={ms.profileSub}>@{profile?.username || '—'}</Text>
                  <View style={ms.xpBar}>
                    <View style={[ms.xpFill, { width: `${Math.round(xpPct * 100)}%` }]} />
                  </View>
                  <Text style={ms.xpText}>
                    {(profile?.xp || 0).toLocaleString()} / {(profile?.xp_next_level || 1000).toLocaleString()} XP
                  </Text>
                </View>
              </LinearGradient>

              {/* Stat cards */}
              <View style={ms.statsGrid}>
                <StatCard icon="gamepad-variant"   label="Games"     value={String(profile?.games_played ?? '—')} color={C.gold} />
                <StatCard icon="trophy-outline"    label="Win Rate"  value={`${winRate}%`}                         color={C.success} />
                <StatCard icon="cash-multiple"     label="Earnings"  value={`₦${((profile?.total_earnings || 0) as number).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`} color={C.gold} />
                <StatCard icon="podium"            label="Rank"      value={profile?.global_rank ? `#${profile.global_rank}` : '—'} color={C.purple} />
              </View>

              {/* Membership dates */}
              <View style={ms.infoCard}>
                <Text style={ms.infoCardTitle}>MEMBERSHIP DETAILS</Text>
                {[
                  { icon: 'crown',          label: 'Tier',         value: tier },
                  { icon: 'calendar-check', label: 'Member since', value: memberSince },
                  { icon: 'calendar-clock', label: 'Expires',      value: expiresDate
                      ? `${expiresDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                      : '—',
                    danger: daysLeft !== null && daysLeft <= 7 },
                ].map(row => (
                  <View key={row.label} style={ms.infoRow}>
                    <MaterialCommunityIcons name={row.icon as any} size={13} color={(row as any).danger ? C.danger : C.gold} />
                    <Text style={ms.infoLabel}>{row.label}</Text>
                    <Text style={[ms.infoVal, (row as any).danger && { color: C.danger }]}>{row.value}</Text>
                  </View>
                ))}
              </View>

              {/* Renew / Active badge */}
              {daysLeft !== null && daysLeft <= 30 ? (
                <TouchableOpacity activeOpacity={0.85} style={ms.renewBtn} onPress={handleJoinRoyale} disabled={joining}>
                  <LinearGradient colors={['#C9A227', '#7A5510']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={ms.renewGrad}>
                    {joining ? <ActivityIndicator color="#000" /> : (
                      <>
                        <MaterialCommunityIcons name="crown" size={16} color="#000" />
                        <Text style={ms.renewText}>EXTEND MEMBERSHIP ({gamblingEnabled ? '₦5k' : '500'})</Text>
                        <MaterialCommunityIcons name="arrow-right" size={16} color="#000" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <View style={ms.activeBadge}>
                  <MaterialCommunityIcons name="check-circle" size={14} color={C.success} />
                  <Text style={ms.activeBadgeText}>Membership Active · {daysLeft ?? '—'}d remaining</Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>

        {/* ── RIGHT: Perks ── */}
        <View style={ms.rightCol}>
          <LinearGradient colors={['rgba(255,255,255,0.025)', 'transparent']} style={StyleSheet.absoluteFill} />
          <View style={ms.perksHeader}>
            <MaterialCommunityIcons name="star-four-points" size={14} color={C.gold} />
            <Text style={ms.perksTitle}>YOUR PERKS</Text>
          </View>
          <View style={ms.divider} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 14 }}>
            {PERKS.map((p, i) => <PerkRow key={p.label} perk={p} index={i} isPreview={!isMember} />)}

            {isMember && (
              <>
              {/* Upgrade prompt */}
              <View style={ms.upgradeCard}>
                <MaterialCommunityIcons name="lock-outline" size={20} color={C.purple} />
                <Text style={ms.upgradeTitle}>Unlock All Perks</Text>
                <Text style={ms.upgradeSub}>Upgrade to Royale+ to unlock Double XP weekends and exclusive tournament access.</Text>
                <Pressable style={ms.upgradeBtn}>
                  <Text style={ms.upgradeBtnText}>UPGRADE →</Text>
                </Pressable>
              </View>

              {/* History teaser */}
              <View style={ms.historyCard}>
                <Text style={ms.historyTitle}>Recent Benefits Used</Text>
                {[
                  { label: 'Priority match',   time: '2h ago',  icon: 'shield-star'    },
                  { label: 'Monthly ₦500',     time: '4d ago',  icon: 'gift'           },
                  { label: 'Reduced fee saved ₦45', time: '1d ago', icon: 'ticket-percent' },
                ].map(h => (
                  <View key={h.label} style={ms.historyRow}>
                    <View style={ms.historyIcon}>
                      <MaterialCommunityIcons name={h.icon as any} size={12} color={C.gold} />
                    </View>
                    <Text style={ms.historyLabel}>{h.label}</Text>
                    <Text style={ms.historyTime}>{h.time}</Text>
                  </View>
                ))}
              </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Animated.View>
  );
}

const ms = StyleSheet.create({
  container: { flex: 1, gap: 8, paddingHorizontal: 10, paddingVertical: 10 },

  // Top Bar
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, backgroundColor: C.surface,
    borderRadius: 18, borderWidth: 1, borderColor: C.goldBorder, gap: 12,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  crownBadge: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.goldBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow:  { color: C.gold, fontSize: 9, fontWeight: '700', letterSpacing: 2 },
  title:    { color: C.textPrimary, fontSize: 20, fontWeight: '900' },
  expiryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.goldSoft, borderRadius: 20, borderWidth: 1, borderColor: C.goldBorder,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  expiryPillDanger: { backgroundColor: C.dangerSoft, borderColor: C.dangerBorder },
  expiryText: { color: C.gold, fontSize: 10, fontWeight: '800' },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Grid
  mainGrid: { flex: 1, flexDirection: 'row', gap: 8 },
  leftCol: {
    flex: 1, backgroundColor: C.surface,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', overflow: 'hidden',
  },
  rightCol: {
    flex: 1.3, backgroundColor: C.surfaceStrong,
    borderRadius: 20, borderWidth: 1, borderColor: C.goldBorder, overflow: 'hidden',
  },

  // Profile hero
  profileHero: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, borderWidth: 1, borderColor: C.goldBorder, padding: 14,
  },
  profileName: { color: C.textPrimary, fontSize: 16, fontWeight: '900' },
  profileSub:  { color: C.textMuted, fontSize: 11 },
  xpBar: {
    height: 4, backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 2, overflow: 'hidden', marginTop: 4,
  },
  xpFill: { height: '100%', backgroundColor: C.gold, borderRadius: 2 },
  xpText: { color: C.textFaint, fontSize: 9, fontWeight: '600' },

  // Stat cards
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: {
    width: '47%', backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12, borderWidth: 1, borderColor: C.divider,
    padding: 10, gap: 4, alignItems: 'flex-start',
  },
  statIcon: {
    width: 28, height: 28, borderRadius: 8, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  statVal:   { color: C.textPrimary, fontSize: 14, fontWeight: '900' },
  statLabel: { color: C.textMuted,   fontSize: 9,  fontWeight: '600' },

  // Info card
  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.025)', borderRadius: 14,
    borderWidth: 1, borderColor: C.divider, padding: 12, gap: 8,
  },
  infoCardTitle: { color: C.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 2 },
  infoRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { flex: 1, color: C.textMuted, fontSize: 11, fontWeight: '600' },
  infoVal:   { color: C.textPrimary, fontSize: 11, fontWeight: '800' },

  // Renew
  renewBtn: { borderRadius: 14, overflow: 'hidden' },
  renewGrad: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 10,
    paddingVertical: 14, paddingHorizontal: 20,
  },
  renewText: { color: '#000', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },

  // Active badge
  activeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.successSoft, borderRadius: 12,
    borderWidth: 1, borderColor: C.successBorder, padding: 12, justifyContent: 'center',
  },
  activeBadgeText: { color: C.success, fontSize: 11, fontWeight: '700' },

  // Perks
  perksHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8,
  },
  perksTitle: { color: C.gold, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  divider: { height: 1, backgroundColor: C.divider, marginHorizontal: 14 },
  perkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.025)', borderRadius: 12,
    borderWidth: 1, borderColor: C.divider, padding: 12,
  },
  perkActive: { backgroundColor: 'rgba(212,175,55,0.07)', borderColor: 'rgba(212,175,55,0.22)' },
  perkIcon: {
    width: 36, height: 36, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  perkLabel:  { color: C.textPrimary, fontSize: 12, fontWeight: '700' },
  perkDetail: { color: C.textFaint,   fontSize: 10, fontWeight: '600', marginTop: 1 },
  previewBadge: {
    backgroundColor: C.gold, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  previewBadgeText: { color: '#000', fontSize: 8, fontWeight: '900' },

  // Upgrade card
  upgradeCard: {
    backgroundColor: C.purpleSoft, borderRadius: 14,
    borderWidth: 1, borderColor: C.purpleBorder,
    padding: 14, gap: 6, alignItems: 'center',
  },
  upgradeTitle: { color: C.textPrimary, fontSize: 13, fontWeight: '900' },
  upgradeSub:   { color: C.textMuted, fontSize: 11, textAlign: 'center', lineHeight: 16 },
  upgradeBtn: {
    backgroundColor: C.purple, borderRadius: 8,
    paddingHorizontal: 18, paddingVertical: 8, marginTop: 4,
  },
  upgradeBtnText: { color: '#fff', fontSize: 11, fontWeight: '900' },

  // History
  historyCard: {
    backgroundColor: 'rgba(255,255,255,0.025)', borderRadius: 14,
    borderWidth: 1, borderColor: C.divider, padding: 12, gap: 8,
  },
  historyTitle: { color: C.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 2 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyIcon: {
    width: 24, height: 24, borderRadius: 6,
    backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.goldBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  historyLabel: { flex: 1, color: C.textPrimary, fontSize: 11, fontWeight: '600' },
  historyTime:  { color: C.textFaint, fontSize: 9, fontWeight: '700' },

  // Join Hero
  joinHeroBody: { padding: 24, alignItems: 'center', gap: 20 },
  joinHeroBg: { ...StyleSheet.absoluteFillObject, opacity: 0.2 },
  joinHeroIcon: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.goldBorder,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.gold, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3, shadowRadius: 20,
  },
  joinHeroTitle: { color: C.textPrimary, fontSize: 28, fontWeight: '900', textAlign: 'center' },
  joinHeroSub: { color: C.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 22, paddingHorizontal: 20 },

  // Feature comparison tiles
  comparisonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%' },
  compTile: {
    width: '47%', backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14, borderWidth: 1, borderColor: C.divider,
    padding: 12, gap: 4, alignItems: 'center',
  },
  compTileIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.goldBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  compTileLabel: { color: C.textPrimary, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  compTileDetail: { color: C.textFaint, fontSize: 9, fontWeight: '600', textAlign: 'center' },

  joinPriceCard: {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20, borderWidth: 1, borderColor: C.goldBorder,
    padding: 20, alignItems: 'center', gap: 10,
  },
  joinPriceLabel: { color: C.gold, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  saveBadge: { backgroundColor: C.successSoft, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: C.successBorder },
  saveBadgeText: { color: C.success, fontSize: 9, fontWeight: '800' },
  joinPriceVal: { color: C.textPrimary, fontSize: 36, fontWeight: '900' },
  joinPriceDivider: { width: '100%', height: 1, backgroundColor: C.divider },
  walletCheck: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  walletCheckText: { color: C.textMuted, fontSize: 12, fontWeight: '600' },
  joinBigBtn: { width: '100%', height: 60, borderRadius: 30, overflow: 'hidden', marginTop: 10 },
  joinBigBtnGrad: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  joinBigBtnText: { color: '#000', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  secureNotice: { color: C.textFaint, fontSize: 10, fontWeight: '600', marginTop: 10 },
  joinBadge: { backgroundColor: C.gold, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  joinBadgeText: { color: '#000', fontSize: 10, fontWeight: '900' },
});
