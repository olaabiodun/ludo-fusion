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
  DeviceEventEmitter,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import { supabase } from '@/lib/supabase';
import { useFeatureActive } from '@/lib/FeatureContext';

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
  const R = 36, CIRC = 2 * Math.PI * R;
  return (
    <View style={{ width: 86, height: 86, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={86} height={86} viewBox="0 0 86 86">
        <Defs>
          <SvgGrad id="xpg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#F5D060" />
            <Stop offset="100%" stopColor="#A07820" />
          </SvgGrad>
        </Defs>
        <Circle cx={43} cy={43} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
        <Circle
          cx={43} cy={43} r={R} fill="none"
          stroke="url(#xpg)" strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${CIRC * pct} ${CIRC}`}
          rotation="-90" origin="43,43"
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ color: C.gold, fontSize: 22, fontWeight: '900', lineHeight: 24 }}>{level}</Text>
        <Text style={{ color: C.textFaint, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 }}>LEVEL</Text>
      </View>
    </View>
  );
}

// ── Benefit Bullet Row ────────────────────────────────────────────────────────
function BenefitBullet({ icon, title, detail }: { icon: string; title: string; detail: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
      <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.goldBorder, alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name={icon as any} size={14} color={C.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.textPrimary, fontSize: 11, fontWeight: '800' }}>{title}</Text>
        <Text style={{ color: C.textMuted, fontSize: 9, fontWeight: '600' }}>{detail}</Text>
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
        <MaterialCommunityIcons name={icon as any} size={10} color={color} />
      </View>
      <Text style={ms.statVal}>{value}</Text>
      <Text style={ms.statLabel}>{label}</Text>
    </Animated.View>
  );
}

// ── Perk Row ─────────────────────────────────────────────────────────────────
const getPerks = (gamblingEnabled: boolean) => [
  { icon: 'ticket-percent',   label: 'Reduced fees',        detail: '5% instead of 10%',       active: true  },
  { icon: 'shield-star',      label: 'Priority matchmaking', detail: 'Skip the queue',           active: true  },
  { icon: 'gift',             label: 'Monthly bonus',        detail: gamblingEnabled ? '₦500 credited monthly' : '500 coins credited monthly',    active: true  },
  { icon: 'trophy-award',     label: 'Tournament access',    detail: 'Members-only brackets',     active: false },
  { icon: 'star-circle',      label: 'Double XP weekends',   detail: 'Every Saturday & Sunday',  active: false },
];

function PerkRow({ perk, index, isPreview }: { perk: any; index: number; isPreview?: boolean }) {
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
        <MaterialCommunityIcons name={perk.icon as any} size={12} color={perk.active || isPreview ? C.gold : C.textFaint} />
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
          size={12}
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
  const gamblingEnabled = useFeatureActive();

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
      if (!user) {
        alert('Please log in to purchase a membership.');
        setJoining(false);
        return;
      }

      // 1. Fetch fresh real-time wallet balance and membership state from Supabase to prevent stale UI races
      const { data: latestProfile, error: fetchErr } = await supabase
        .from('profiles')
        .select('wallet_balance, membership_expires, member_since')
        .eq('id', user.id)
        .single();

      if (fetchErr || !latestProfile) {
        alert('Failed to verify balance. Please check your network connection.');
        setJoining(false);
        return;
      }

      const FEE = gamblingEnabled ? 5000 : 500;
      if ((latestProfile.wallet_balance || 0) < FEE) {
        alert(gamblingEnabled 
          ? 'Insufficient balance. Please deposit funds to your wallet to join Royale Club.'
          : 'Insufficient coins. Please play matches or earn more coins to purchase Royale Pass.'
        );
        setJoining(false);
        return;
      }

      // 2. Calculate dynamic expiry (extend existing date if they are already active!)
      const now = new Date();
      let expiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      if (latestProfile.membership_expires) {
        const currentExpiry = new Date(latestProfile.membership_expires);
        if (currentExpiry > now) {
          expiry = new Date(currentExpiry.getTime() + 30 * 24 * 60 * 60 * 1000);
        }
      }

      // 3. Perform balance deduction and tier update in Supabase
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          wallet_balance: (latestProfile.wallet_balance || 0) - FEE,
          membership_tier: 'royale',
          membership_expires: expiry.toISOString(),
          member_since: latestProfile.member_since || now.toISOString()
        })
        .eq('id', user.id);

      if (updateErr) throw updateErr;

      // 4. Log premium transaction record
      await supabase.from('transactions').insert({
        player_id: user.id,
        amount: -FEE,
        type: 'membership',
        status: 'completed',
        description: 'Royale Pass Subscription'
      });

      // 5. Update local state and trigger global app broadcasts
      await fetchProfile();
      DeviceEventEmitter.emit('wallet_updated');
      alert('Welcome to Royale Club! Your VIP membership is now fully active.');
    } catch (err) {
      console.error('Join Error:', err);
      alert('Failed to process your subscription. Please try again.');
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
            <MaterialCommunityIcons name="crown" size={14} color={C.gold} />
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
              size={11}
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
          <MaterialCommunityIcons name="close" size={16} color={C.textPrimary} />
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
            /* JOIN HERO SCREEN (VIP PASS VISUAL REDESIGN) */
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ms.joinHeroBody}>
              <LinearGradient colors={['rgba(212,175,55,0.15)', 'transparent']} style={ms.joinHeroBg} />
              
              {/* STUNNING VIP GLOWING CARD GRAPHIC */}
              <LinearGradient 
                colors={['#181D14', '#0F120B']} 
                style={{ 
                  width: '100%', 
                  height: 120, 
                  borderRadius: 14, 
                  borderWidth: 1.5, 
                  borderColor: '#D4AF37', 
                  padding: 12, 
                  position: 'relative', 
                  overflow: 'hidden', 
                  elevation: 10,
                  shadowColor: '#D4AF37',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  justifyContent: 'space-between',
                  marginVertical: 4
                }}
              >
                {/* Shiny diagonal glare highlight */}
                <LinearGradient 
                  colors={['transparent', 'rgba(212,175,55,0.15)', 'transparent']} 
                  start={{ x: 0, y: 0 }} 
                  end={{ x: 1, y: 1 }} 
                  style={{ ...StyleSheet.absoluteFillObject }} 
                />

                {/* Top Row: VIP Brand Badge & Chip */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialCommunityIcons name="crown" size={20} color="#D4AF37" />
                    <Text style={{ color: '#D4AF37', fontSize: 13, fontWeight: '900', letterSpacing: 1 }}>ROYALE CLUB</Text>
                  </View>
                  <View style={{ backgroundColor: 'rgba(212,175,55,0.2)', borderWidth: 1, borderColor: '#D4AF37', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ color: '#D4AF37', fontSize: 8, fontWeight: '900' }}>PREMIUM</Text>
                  </View>
                </View>

                {/* Middle Row: Graphic Chip & Card Number */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', opacity: 0.8 }}>
                  <MaterialCommunityIcons name="integrated-circuit-chip" size={24} color="#D4AF37" style={{ opacity: 0.9 }} />
                  <Text style={{ color: C.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 2 }}>•••• •••• •••• 8888</Text>
                </View>

                {/* Bottom Row: Holder Name & Expiry */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ gap: 1 }}>
                    <Text style={{ color: C.textFaint, fontSize: 7, fontWeight: '700', letterSpacing: 0.5 }}>CARD HOLDER</Text>
                    <Text style={{ color: C.textPrimary, fontSize: 10, fontWeight: '800' }}>
                      {profile?.full_name || profile?.username || 'ROYALE MEMBER'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 1 }}>
                    <Text style={{ color: C.textFaint, fontSize: 7, fontWeight: '700', letterSpacing: 0.5 }}>STATUS</Text>
                    <Text style={{ color: C.success, fontSize: 9, fontWeight: '900' }}>ACTIVE MATCHING</Text>
                  </View>
                </View>
              </LinearGradient>

              {/* Title & Tagline Pitch */}
              <View style={{ width: '100%', gap: 4, alignItems: 'center', marginVertical: 6, paddingHorizontal: 4 }}>
                <Text style={{ color: C.gold, fontSize: 15, fontWeight: '900', textAlign: 'center', letterSpacing: 0.5 }}>
                  Unlock the Ultimate Gaming Circle
                </Text>
                <Text style={{ color: C.textMuted, fontSize: 10, textAlign: 'center', lineHeight: 14 }}>
                  Become a Royale Pass member today. Step into the elite player network, pocket maximum wins with reduced match commissions, and receive monthly cash deposits.
                </Text>
              </View>
              
              {/* Gold glassmorphic checkout card */}
              <View style={ms.joinPriceCard}>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={ms.joinPriceLabel}>SUBSCRIPTION FEE</Text>
                    {gamblingEnabled && (
                      <View style={ms.saveBadge}>
                        <Text style={ms.saveBadgeText}>SAVE 40%</Text>
                      </View>
                    )}
                  </View>
                  <Text style={ms.joinPriceVal}>
                    {gamblingEnabled ? '₦5,000' : '500'}
                    <Text style={{ fontSize: 10, color: C.textMuted }}>{gamblingEnabled ? '/mo' : ' coins/mo'}</Text>
                  </Text>
                  <View style={ms.walletCheck}>
                    <MaterialCommunityIcons name="wallet-outline" size={10} color={C.textMuted} />
                    <Text style={ms.walletCheckText}>
                      {gamblingEnabled ? `Bal: ₦${profile?.wallet_balance?.toLocaleString() || '0'}` : `Coins: ${profile?.wallet_balance?.toLocaleString() || '0'}`}
                    </Text>
                  </View>
                </View>

                {/* Direct payment call to action button inside checkout card! */}
                <TouchableOpacity 
                  style={[ms.joinBigBtn, { width: 110, height: 36, marginTop: 0 }]} 
                  onPress={handleJoinRoyale}
                  disabled={joining}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={['#F5D060', '#A07820']} style={ms.joinBigBtnGrad}>
                    {joining ? (
                      <ActivityIndicator color="#000" size="small" />
                    ) : (
                      <>
                        <Text style={[ms.joinBigBtnText, { fontSize: 11 }]}>JOIN NOW</Text>
                        <MaterialCommunityIcons name="arrow-right" size={12} color="#000" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              <Text style={ms.secureNotice}>
                <MaterialCommunityIcons name="shield-check" size={8} /> Instant activation · Secure
              </Text>
            </ScrollView>
          ) : (
            /* MEMBER PROFILE SCREEN (REDESIGNED) */
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, padding: 10 }}>

              {/* Profile hero - sleek & spacious */}
              <LinearGradient
                colors={['rgba(212,175,55,0.12)', 'rgba(212,175,55,0.04)', 'transparent']}
                style={ms.profileHero}
              >
                <XpRing pct={xpPct} level={profile?.level || 1} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[ms.profileName, { fontSize: 15 }]} numberOfLines={1}>
                    {profile?.full_name || profile?.username || 'Player'}
                  </Text>
                  <Text style={[ms.profileSub, { fontSize: 10 }]}>@{profile?.username || '—'}</Text>
                  <View style={[ms.xpBar, { height: 4 }]}>
                    <View style={[ms.xpFill, { width: `${Math.round(xpPct * 100)}%` }]} />
                  </View>
                  <Text style={[ms.xpText, { fontSize: 9 }]}>
                    {(profile?.xp || 0).toLocaleString()} / {(profile?.xp_next_level || 1000).toLocaleString()} XP
                  </Text>
                </View>
              </LinearGradient>

              {/* Stat cards */}
              <View style={ms.statsGrid}>
                <StatCard icon="gamepad-variant"   label="Games"     value={String(profile?.games_played ?? '—')} color={C.gold} />
                <StatCard icon="trophy-outline"    label="Win Rate"  value={`${winRate}%`}                         color={C.success} />
                <StatCard 
                  icon={gamblingEnabled ? "cash-multiple" : "star-circle"}     
                  label="Earnings"  
                  value={gamblingEnabled ? `₦${((profile?.total_earnings || 0) as number).toLocaleString('en-NG', { maximumFractionDigits: 0 })}` : `${(profile?.total_earnings || 0).toLocaleString()} coins`} 
                  color={C.gold} 
                />
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
                    <MaterialCommunityIcons name={row.icon as any} size={11} color={(row as any).danger ? C.danger : C.gold} />
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
                        <MaterialCommunityIcons name="crown" size={12} color="#000" />
                        <Text style={ms.renewText}>EXTEND MEMBERSHIP ({gamblingEnabled ? '₦5k' : '500'})</Text>
                        <MaterialCommunityIcons name="arrow-right" size={12} color="#000" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <View style={ms.activeBadge}>
                  <MaterialCommunityIcons name="check-circle" size={11} color={C.success} />
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
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 8 }}>
            {getPerks(gamblingEnabled).map((p, i) => <PerkRow key={p.label} perk={p} index={i} isPreview={!isMember} />)}

            {isMember && (
              <>
              {/* Upgrade prompt */}
              <View style={ms.upgradeCard}>
                <MaterialCommunityIcons name="lock-outline" size={15} color={C.purple} />
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
                  { label: gamblingEnabled ? 'Monthly ₦500' : 'Monthly 500 coins',     time: '4d ago',  icon: 'gift'           },
                  { label: gamblingEnabled ? 'Reduced fee saved ₦45' : 'Reduced fee saved 45 coins', time: '1d ago', icon: 'ticket-percent' },
                ].map(h => (
                  <View key={h.label} style={ms.historyRow}>
                    <View style={ms.historyIcon}>
                      <MaterialCommunityIcons name={h.icon as any} size={10} color={C.gold} />
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
  container: { flex: 1, gap: 6, paddingHorizontal: 6, paddingVertical: 6 },

  // Top Bar
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 12, backgroundColor: C.surface,
    borderRadius: 14, borderWidth: 1, borderColor: C.goldBorder, gap: 8,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  crownBadge: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.goldBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow:  { color: C.gold, fontSize: 8, fontWeight: '700', letterSpacing: 1.5 },
  title:    { color: C.textPrimary, fontSize: 16, fontWeight: '900' },
  expiryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: C.goldSoft, borderRadius: 14, borderWidth: 1, borderColor: C.goldBorder,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  expiryPillDanger: { backgroundColor: C.dangerSoft, borderColor: C.dangerBorder },
  expiryText: { color: C.gold, fontSize: 9, fontWeight: '800' },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Grid
  mainGrid: { flex: 1, flexDirection: 'row', gap: 6 },
  leftCol: {
    flex: 1, backgroundColor: C.surface,
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', overflow: 'hidden',
  },
  rightCol: {
    flex: 1.2, backgroundColor: C.surfaceStrong,
    borderRadius: 16, borderWidth: 1, borderColor: C.goldBorder, overflow: 'hidden',
  },

  // Profile hero
  profileHero: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1, borderColor: C.goldBorder, padding: 8,
  },
  profileName: { color: C.textPrimary, fontSize: 13, fontWeight: '900' },
  profileSub:  { color: C.textMuted, fontSize: 9 },
  xpBar: {
    height: 3, backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 1.5, overflow: 'hidden', marginTop: 2,
  },
  xpFill: { height: '100%', backgroundColor: C.gold, borderRadius: 1.5 },
  xpText: { color: C.textFaint, fontSize: 8, fontWeight: '600' },

  // Stat cards
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statCard: {
    width: '48%', backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10, borderWidth: 1, borderColor: C.divider,
    paddingHorizontal: 8, paddingVertical: 6, gap: 2, alignItems: 'flex-start',
  },
  statIcon: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginBottom: 1,
  },
  statVal:   { color: C.textPrimary, fontSize: 11, fontWeight: '900' },
  statLabel: { color: C.textMuted,   fontSize: 8,  fontWeight: '600' },

  // Info card
  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.025)', borderRadius: 10,
    borderWidth: 1, borderColor: C.divider, paddingHorizontal: 8, paddingVertical: 6, gap: 4,
  },
  infoCardTitle: { color: C.gold, fontSize: 8, fontWeight: '800', letterSpacing: 1, marginBottom: 1 },
  infoRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoLabel: { flex: 1, color: C.textMuted, fontSize: 9, fontWeight: '600' },
  infoVal:   { color: C.textPrimary, fontSize: 9, fontWeight: '800' },

  // Renew
  renewBtn: { borderRadius: 10, overflow: 'hidden' },
  renewGrad: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 12,
  },
  renewText: { color: '#000', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  // Active badge
  activeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.successSoft, borderRadius: 10,
    borderWidth: 1, borderColor: C.successBorder, padding: 8, justifyContent: 'center',
  },
  activeBadgeText: { color: C.success, fontSize: 9, fontWeight: '700' },

  // Perks
  perksHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingTop: 10, paddingBottom: 6,
  },
  perksTitle: { color: C.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  divider: { height: 1, backgroundColor: C.divider, marginHorizontal: 10 },
  perkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.025)', borderRadius: 10,
    borderWidth: 1, borderColor: C.divider, paddingHorizontal: 8, paddingVertical: 6,
  },
  perkActive: { backgroundColor: 'rgba(212,175,55,0.07)', borderColor: 'rgba(212,175,55,0.22)' },
  perkIcon: {
    width: 26, height: 26, borderRadius: 6, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  perkLabel:  { color: C.textPrimary, fontSize: 10, fontWeight: '700' },
  perkDetail: { color: C.textFaint,   fontSize: 8, fontWeight: '600', marginTop: 1 },
  previewBadge: {
    backgroundColor: C.gold, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1.5,
  },
  previewBadgeText: { color: '#000', fontSize: 7, fontWeight: '900' },

  // Upgrade card
  upgradeCard: {
    backgroundColor: C.purpleSoft, borderRadius: 10,
    borderWidth: 1, borderColor: C.purpleBorder,
    padding: 8, gap: 4, alignItems: 'center',
  },
  upgradeTitle: { color: C.textPrimary, fontSize: 11, fontWeight: '900' },
  upgradeSub:   { color: C.textMuted, fontSize: 9, textAlign: 'center', lineHeight: 13 },
  upgradeBtn: {
    backgroundColor: C.purple, borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 4, marginTop: 2,
  },
  upgradeBtnText: { color: '#fff', fontSize: 9, fontWeight: '900' },

  // History
  historyCard: {
    backgroundColor: 'rgba(255,255,255,0.025)', borderRadius: 10,
    borderWidth: 1, borderColor: C.divider, paddingHorizontal: 8, paddingVertical: 6, gap: 4,
  },
  historyTitle: { color: C.textMuted, fontSize: 8, fontWeight: '800', letterSpacing: 0.5, marginBottom: 1 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  historyIcon: {
    width: 18, height: 18, borderRadius: 4,
    backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.goldBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  historyLabel: { flex: 1, color: C.textPrimary, fontSize: 9, fontWeight: '600' },
  historyTime:  { color: C.textFaint, fontSize: 8, fontWeight: '700' },

  // Join Hero
  joinHeroBody: { padding: 10, gap: 10 },
  joinHeroBg: { ...StyleSheet.absoluteFillObject, opacity: 0.12 },
  joinHeroIcon: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.goldBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  joinHeroTitle: { color: C.textPrimary, fontSize: 18, fontWeight: '900' },
  joinHeroSub: { color: C.textMuted, fontSize: 10, lineHeight: 14 },

  // Feature comparison tiles (kept for consistency/safety, but bullet row is active)
  comparisonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, width: '100%' },
  compTile: {
    width: '48%', backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10, borderWidth: 1, borderColor: C.divider,
    padding: 6, gap: 2, alignItems: 'center',
  },
  compTileIcon: {
    width: 22, height: 22, borderRadius: 5,
    backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.goldBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  compTileLabel: { color: C.textPrimary, fontSize: 9, fontWeight: '700', textAlign: 'center' },
  compTileDetail: { color: C.textFaint, fontSize: 7, fontWeight: '600', textAlign: 'center' },

  joinPriceCard: {
    flexDirection: 'row', width: '100%', backgroundColor: 'rgba(212,175,55,0.05)',
    borderRadius: 12, borderWidth: 1, borderColor: C.goldBorder,
    padding: 10, alignItems: 'center', gap: 10,
  },
  joinPriceLabel: { color: C.gold, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  saveBadge: { backgroundColor: C.successSoft, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1.5, borderWidth: 1, borderColor: C.successBorder },
  saveBadgeText: { color: C.success, fontSize: 7, fontWeight: '800' },
  joinPriceVal: { color: C.textPrimary, fontSize: 20, fontWeight: '900' },
  joinPriceDivider: { width: '100%', height: 1, backgroundColor: C.divider },
  walletCheck: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  walletCheckText: { color: C.textMuted, fontSize: 9, fontWeight: '600' },
  joinBigBtn: { borderRadius: 18, overflow: 'hidden' },
  joinBigBtnGrad: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  joinBigBtnText: { color: '#000', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  secureNotice: { color: C.textFaint, fontSize: 8, fontWeight: '600', marginTop: 2, textAlign: 'center', width: '100%' },
  joinBadge: { backgroundColor: C.gold, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  joinBadgeText: { color: '#000', fontSize: 8, fontWeight: '900' },
});
