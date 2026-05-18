import { playButtonSound } from '@/lib/sounds';
import { supabase } from '@/lib/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  DeviceEventEmitter,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert
} from 'react-native';
import { DodgeKeyboard } from 'react-native-dodge-keyboard';
import { PaystackWebView } from '@/lib/paystackWrapper';
import { useGamblingEnabled } from '@/lib/GamblingContext';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  gold: '#D4AF37',
  goldSoft: 'rgba(212,175,55,0.14)',
  goldMid: 'rgba(212,175,55,0.22)',
  goldBorder: 'rgba(212,175,55,0.28)',
  goldText: '#E7C75A',
  surface: 'rgba(7, 21, 15, 0.88)',
  surfaceStrong: 'rgba(5, 16, 11, 0.94)',
  surfaceHover: 'rgba(255,255,255,0.025)',
  textPrimary: '#F5EFD8',
  textMuted: 'rgba(245,239,216,0.6)',
  textFaint: 'rgba(245,239,216,0.35)',
  success: '#57D08B',
  successSoft: 'rgba(87,208,139,0.12)',
  successBorder: 'rgba(87,208,139,0.25)',
  danger: '#F26B6B',
  dangerSoft: 'rgba(242,107,107,0.12)',
  dangerBorder: 'rgba(242,107,107,0.25)',
  info: '#5AAFF0',
  infoSoft: 'rgba(90,175,240,0.12)',
  infoBorder: 'rgba(90,175,240,0.25)',
  bg: '#040d07',
  divider: 'rgba(255,255,255,0.05)',
};

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const TX_TABS = ['All', 'Deposits', 'Withdrawals', 'Winnings'] as const;

const QUICK_ACTIONS: { label: string; icon: IconName; color: string; bg: string; border: string }[] = [
  { label: 'Add Money', icon: 'plus-circle-outline', color: C.success, bg: C.successSoft, border: C.successBorder },
  { label: 'Withdraw', icon: 'arrow-up-circle-outline', color: C.danger, bg: C.dangerSoft, border: C.dangerBorder },
  { label: 'Transfer', icon: 'swap-horizontal-circle-outline', color: C.info, bg: C.infoSoft, border: C.infoBorder },
  { label: 'History', icon: 'history', color: C.gold, bg: C.goldSoft, border: C.goldBorder },
];

// ─── Types ────────────────────────────────────────────────────────────────────
type TxItem = {
  id: string;
  label: string;
  sub: string;
  amountRaw: number;
  positive: boolean;
  icon: IconName;
  time: string;
  status: 'completed' | 'pending' | 'failed';
  type: 'deposit' | 'withdrawal' | 'winning' | 'transfer';
  created_at?: string;
  extra?: string;
};

type WalletStats = {
  totalIn: number;
  totalOut: number;
  totalWinnings: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

function useFadeSlideX(delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-14)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 380, delay, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 380, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return { opacity, transform: [{ translateX }] };
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const hours = Math.floor(diff / 36e5);
  const days = Math.floor(diff / 864e5);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function formatCurrency(amount: number, showNgn: boolean): string {
  return showNgn ? `₦ ${Math.abs(amount).toLocaleString('en-NG')}` : `${Math.abs(amount).toLocaleString()} coins`;
}

function getInitials(name: string | null): string {
  if (!name) return 'PL';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ─── PulseDot ─────────────────────────────────────────────────────────────────
function PulseDot({ color = C.gold }: { color?: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.45, duration: 850, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 850, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[s.pulseDot, { backgroundColor: color, transform: [{ scale }] }]} />;
}

// ─── Balance Card ─────────────────────────────────────────────────────────────
function BalanceCard({ balance, stats }: { balance: number; stats: WalletStats }) {
  const anim = useFadeSlide(80);
  const gamblingEnabled = useGamblingEnabled();
  const countVal = useRef(new Animated.Value(0)).current;
  const [displayVal, setDisplayVal] = useState('0');

  useEffect(() => {
    Animated.timing(countVal, {
      toValue: balance,
      duration: 1400,
      delay: 400,
      useNativeDriver: false,
    }).start();
    countVal.addListener(({ value }) => {
      setDisplayVal(Math.floor(value).toLocaleString('en-NG'));
    });
    return () => countVal.removeAllListeners();
  }, [balance]);

  return (
    <Animated.View style={[s.balanceCard, anim]}>
      <LinearGradient
        colors={['rgba(30,90,57,0.55)', 'rgba(4,12,8,0.85)']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
      />
      <View style={s.balanceArc} pointerEvents="none" />
      <View style={s.balanceTop}>
        <View>
          <Text style={s.balanceEyebrow}>TOTAL BALANCE</Text>
          <View style={s.balanceAmountRow}>
            <Text style={s.balanceCurrency}>{gamblingEnabled ? '₦' : ''}</Text>
            <Text style={s.balanceAmount}>{displayVal}</Text>
          </View>
          <Text style={s.balanceSub}>{gamblingEnabled ? '≈ Available to play or withdraw' : 'Available to play'}</Text>
        </View>

        <View style={s.balanceChips}>
          <View style={s.balanceChip}>
            <MaterialCommunityIcons name="lock-outline" size={11} color={C.gold} />
            <Text style={s.balanceChipText}>{gamblingEnabled ? '₦ 0 locked' : '0 locked'}</Text>
          </View>
          <View style={[s.balanceChip, { borderColor: C.successBorder, backgroundColor: C.successSoft }]}>
            <PulseDot color={C.success} />
            <Text style={[s.balanceChipText, { color: C.success }]}>Live</Text>
          </View>
        </View>
      </View>

      <View style={s.balanceStats}>
        <View style={s.balanceStat}>
          <MaterialCommunityIcons name="arrow-down-circle-outline" size={14} color={C.success} />
          <View>
            <Text style={s.balanceStatVal}>{formatCurrency(stats.totalIn, gamblingEnabled)}</Text>
            <Text style={s.balanceStatLabel}>Total In</Text>
          </View>
        </View>
        <View style={s.balanceStatDiv} />
        <View style={s.balanceStat}>
          <MaterialCommunityIcons name="arrow-up-circle-outline" size={14} color={C.danger} />
          <View>
            <Text style={s.balanceStatVal}>{formatCurrency(stats.totalOut, gamblingEnabled)}</Text>
            <Text style={s.balanceStatLabel}>Total Out</Text>
          </View>
        </View>
        <View style={s.balanceStatDiv} />
        <View style={s.balanceStat}>
          <MaterialCommunityIcons name="trophy-outline" size={14} color={C.gold} />
          <View>
            <Text style={s.balanceStatVal}>{formatCurrency(stats.totalWinnings, gamblingEnabled)}</Text>
            <Text style={s.balanceStatLabel}>Winnings</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Quick Actions ────────────────────────────────────────────────────────────
function QuickActionBtn({ action, delay, onPress }: { action: typeof QUICK_ACTIONS[number]; delay: number; onPress: () => void }) {
  const anim = useFadeSlide(delay);
  return (
    <Animated.View style={anim}>
      <Pressable
        style={({ pressed }) => [s.quickBtn, pressed && { opacity: 0.75 }]}
        onPress={() => {
          playButtonSound();
          onPress();
        }}
      >
        <View style={[s.quickIconWrap, { backgroundColor: action.bg, borderColor: action.border }]}>
          <MaterialCommunityIcons name={action.icon} size={22} color={action.color} />
        </View>
        <Text style={s.quickLabel}>{action.label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function QuickActions({ onAction }: { onAction: (label: string) => void }) {
  const rowAnim = useFadeSlide(200);
  const gamblingEnabled = useGamblingEnabled();
  const actions = gamblingEnabled
    ? QUICK_ACTIONS
    : QUICK_ACTIONS.filter(a => a.label === 'History');
  return (
    <Animated.View style={[s.quickRow, rowAnim]}>
      {actions.map((action, i) => (
        <QuickActionBtn key={action.label} action={action} delay={280 + i * 60} onPress={() => onAction(action.label)} />
      ))}
    </Animated.View>
  );
}

// ─── Transaction Row ──────────────────────────────────────────────────────────
function TxRow({ tx, delay }: { tx: TxItem; delay: number }) {
  const anim = useFadeSlideX(delay);
  const gamblingEnabled = useGamblingEnabled();
  const statusColor = tx.status === 'completed' ? C.success : tx.status === 'pending' ? C.gold : C.danger;
  const statusBg = tx.status === 'completed' ? C.successSoft : tx.status === 'pending' ? C.goldSoft : C.dangerSoft;
  const statusBorder = tx.status === 'completed' ? C.successBorder : tx.status === 'pending' ? C.goldBorder : C.dangerBorder;

  const amountStr = (tx.positive ? '+' : '-') + formatCurrency(tx.amountRaw, gamblingEnabled);

  return (
    <Animated.View style={anim}>
      <Pressable style={({ pressed }) => [s.txRow, pressed && s.txRowPressed]}>
        <View style={[s.txIconWrap, {
          backgroundColor: tx.positive ? C.successSoft : C.dangerSoft,
          borderColor: tx.positive ? C.successBorder : C.dangerBorder,
        }]}>
          <MaterialCommunityIcons name={tx.icon} size={16} color={tx.positive ? C.success : C.danger} />
        </View>

        <View style={s.txInfo}>
          <Text style={s.txLabel}>{tx.label}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={s.txSub}>{tx.sub}  ·  {tx.time}</Text>
          </View>
          {tx.extra && (
            <Text style={[s.txSub, { color: tx.type === 'winning' ? C.gold : C.textFaint, fontSize: 9, marginTop: 1 }]}>
              {tx.extra}
            </Text>
          )}
        </View>

        <View style={s.txRight}>
          <Text style={[s.txAmount, { color: tx.positive ? C.success : C.danger }]}>{amountStr}</Text>
          {tx.status !== 'completed' && (
            <View style={[s.txStatusPill, { backgroundColor: statusBg, borderColor: statusBorder }]}>
              <Text style={[s.txStatusText, { color: statusColor }]}>{tx.status}</Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Transactions Section ─────────────────────────────────────────────────────
function TransactionsSection({ activeTab, setActiveTab, filteredTx }: {
  activeTab: number;
  setActiveTab: (i: number) => void;
  filteredTx: TxItem[];
}) {
  const anim = useFadeSlide(160);
  const gamblingEnabled = useGamblingEnabled();
  const tabs = gamblingEnabled
    ? ['All', 'Deposits', 'Withdrawals', 'Winnings']
    : ['All', 'Earnings', 'Spending', 'Winnings'];
  return (
    <Animated.View style={[s.section, anim]}>
      <View style={s.sectionHeader}>
        <View>
          <Text style={s.sectionTitle}>Transactions</Text>
          <Text style={s.sectionCaption}>Recent activity</Text>
        </View>
        <Pressable>
          <Text style={s.sectionAction}>See All</Text>
        </Pressable>
      </View>

      <View style={s.txTabsWrap}>
        {tabs.map((tab, i) => (
          <Pressable
            key={tab}
            style={[s.txTab, activeTab === i && s.txTabActive]}
            onPress={() => setActiveTab(i)}
          >
            <Text style={[s.txTabText, activeTab === i && s.txTabTextActive]}>{tab}</Text>
          </Pressable>
        ))}
      </View>

      <View style={s.txList}>
        {filteredTx.length > 0 ? (
          filteredTx.map((tx, i) => <TxRow key={tx.id} tx={tx} delay={400 + i * 60} />)
        ) : (
          <Text style={s.emptyText}>No transactions in this category yet.</Text>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Custom Numpad ────────────────────────────────────────────────────────────
function CustomNumpad({ onInput, onClear, onDelete, visible }: {
  onInput: (val: string) => void;
  onClear: () => void;
  onDelete: () => void;
  visible: boolean;
}) {
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 300,
      tension: 140,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

  return (
    <Animated.View style={[s.numpadContainer, { transform: [{ translateY: slideAnim }] }]}>
      <View style={s.numpadGrid}>
        {keys.map((key) => (
          <TouchableOpacity
            key={key}
            style={[
              s.numpadKey,
              (key === 'C' || key === '⌫') && { backgroundColor: 'rgba(255,255,255,0.05)' }
            ]}
            onPress={() => {
              playButtonSound();
              if (key === 'C') onClear();
              else if (key === '⌫') onDelete();
              else onInput(key);
            }}
            activeOpacity={0.7}
          >
            {key === '⌫' ? (
              <MaterialCommunityIcons name="backspace-outline" size={24} color={C.textPrimary} />
            ) : (
              <Text style={[
                s.numpadKeyText,
                key === 'C' && { color: C.danger },
                key === '⌫' && { color: C.textMuted }
              ]}>{key}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
}

// ─── Transaction Modal ───────────────────────────────────────────────────────
function TransactionModal({
  visible, type, onClose, onRefresh, userEmail, onDepositConfirm,
}: {
  visible: boolean; type: 'deposit' | 'withdrawal' | 'transfer' | null; onClose: () => void; onRefresh: () => void; userEmail: string;
  onDepositConfirm?: (amount: number, email: string) => void;
}) {
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<{ id: string, username: string } | null>(null);
  const [activeInput, setActiveInput] = useState<'amount' | 'recipient'>('amount');

  useEffect(() => {
    if (type !== 'transfer' || recipient.length < 3) { setSearchResult(null); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('id, username').ilike('username', recipient).limit(1).single();
      setSearchResult(data);
    }, 500);
    return () => clearTimeout(t);
  }, [recipient]);

  async function handleAction() {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return;

    if (type === 'deposit') {
      onClose();
      onDepositConfirm?.(amt, userEmail || 'user@example.com');
      setAmount('');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const txData: any = {
        player_id: user.id,
        amount: amt,
        type: type,
        status: 'completed',
        description: type === 'transfer' ? `Transfer to ${searchResult?.username}` : `${type} transaction`,
      };
      if (type === 'transfer') txData.recipient_id = searchResult?.id;

      const { error } = await supabase.from('transactions').insert(txData);
      if (error) throw error;

      // Notify TopBar to update immediately
      DeviceEventEmitter.emit('wallet_updated');

      onRefresh();
      onClose();
      setAmount('');
      setRecipient('');
    } catch (e) {
      console.error('Tx error:', e);
    } finally {
      setLoading(false);
    }
  }

  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 150, friction: 12, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  const config = {
    deposit: { title: 'Deposit Funds', icon: 'plus-circle', color: C.success },
    withdrawal: { title: 'Withdraw Funds', icon: 'arrow-up-circle', color: C.danger },
    transfer: { title: 'Transfer Funds', icon: 'swap-horizontal', color: C.info },
  }[type || 'deposit'];

  return (
    <Animated.View style={[s.modalOverlay, { opacity: opacityAnim }]}>
      <Animated.View style={[s.modalContent, { transform: [{ scale: scaleAnim }], maxWidth: 520, padding: 16, gap: 12 }]}>
        <View style={s.modalHeader}>
          <View style={[s.modalIconWrap, { backgroundColor: config.color + '15', width: 44, height: 44, borderRadius: 12 }]}>
            <MaterialCommunityIcons name={config.icon as any} size={22} color={config.color} />
          </View>
          <View>
            <Text style={[s.modalTitle, { fontSize: 18 }]}>{config.title}</Text>
            <Text style={s.modalSubtitle}>Enter details to proceed</Text>
          </View>
        </View>

        <View style={s.modalMainRow}>
          <View style={s.modalLeftCol}>
            <View style={s.modalBody}>
              <Pressable
                style={s.inputGroup}
                onPress={() => setActiveInput('amount')}
              >
                <Text style={s.modalLabel}>Amount to {type}</Text>
                <View style={[
                  s.inputWrapper,
                  activeInput === 'amount' && { borderColor: config.color, backgroundColor: config.color + '05' }
                ]}>
                  <Text style={s.inputCurrency}>₦</Text>
                  <TextInput
                    style={[s.modalInput, { height: 48, fontSize: 16 }]}
                    placeholderTextColor={C.textFaint}
                    value={amount}
                    showSoftInputOnFocus={false}
                    onFocus={() => setActiveInput('amount')}
                    caretHidden={false}
                    keyboardType="numeric"
                    placeholder={type === 'deposit' ? 'MIN ₦100' : type === 'withdrawal' ? ' MIN ₦50' : 'MIN ₦50'}
                  />
                  {amount.length > 0 && (
                    <TouchableOpacity onPress={() => setAmount('')} style={{ marginRight: 12 }}>
                      <MaterialCommunityIcons name="close-circle" size={18} color={C.textFaint} />
                    </TouchableOpacity>
                  )}
                </View>
              </Pressable>

              {type === 'transfer' && (
                <View style={s.inputGroup}>
                  <Text style={s.modalLabel}>Recipient Username</Text>
                  <View style={[
                    s.inputWrapper,
                    activeInput === 'recipient' && { borderColor: C.info, backgroundColor: C.info + '05' }
                  ]}>
                    <MaterialCommunityIcons name="at" size={18} color={C.textMuted} style={{ marginLeft: 12 }} />
                    <TextInput
                      style={[s.modalInput, { paddingLeft: 8, height: 48, fontSize: 16 }]}
                      placeholder="username"
                      placeholderTextColor={C.textFaint}
                      autoCapitalize="none"
                      value={recipient}
                      onChangeText={setRecipient}
                      onFocus={() => setActiveInput('recipient')}
                    />
                  </View>
                  {searchResult && (
                    <View style={s.foundBadge}>
                      <MaterialCommunityIcons name="check-circle" size={12} color={C.success} />
                      <Text style={s.foundText}>Recipient: {searchResult.username}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            <View style={[s.modalActions, { gap: 8 }]}>
              <TouchableOpacity
                style={[s.modalConfirm, { backgroundColor: config.color, height: 48 }]}
                onPress={handleAction}
                activeOpacity={0.8}
                disabled={loading || (type === 'transfer' && !searchResult)}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <Text style={s.modalConfirmText}>CONFIRM {type?.toUpperCase()}</Text>
                    <MaterialCommunityIcons name="chevron-right" size={18} color="#000" />
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalCancel, { height: 48 }]} onPress={onClose} activeOpacity={0.7}>
                <Text style={s.modalCancelText}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.modalRightCol}>
            <CustomNumpad
              visible={activeInput === 'amount'}
              onInput={(val) => {
                if (amount.length >= 10) return;
                setAmount(prev => prev + val);
              }}
              onDelete={() => setAmount(prev => prev.slice(0, -1))}
              onClear={() => setAmount('')}
            />
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Payment Success Modal ───────────────────────────────────────────────────
function PaymentSuccessModal({ visible, data, onClose }: { visible: boolean; data: { amount: number; ref: string } | null; onClose: () => void }) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(0);
      opacity.setValue(0);
    }
  }, [visible]);

  if (!visible || !data) return null;

  return (
    <Animated.View style={[s.modalOverlay, { opacity, zIndex: 2000 }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      <Animated.View style={[s.modalContent, { transform: [{ scale }], width: '85%', maxWidth: 600, padding: 20 }]}>
        <TouchableOpacity
          style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, padding: 4 }}
          onPress={onClose}
        >
          <MaterialCommunityIcons name="close" size={20} color={C.textFaint} />
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24 }}>
          {/* Left Side: Icon */}
          <View style={[s.modalIconWrap, { backgroundColor: C.successSoft, width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: C.successBorder }]}>
            <MaterialCommunityIcons name="check-bold" size={50} color={C.success} />
          </View>

          {/* Right Side: Content */}
          <View style={{ flex: 1, gap: 12 }}>
            <View>
              <Text style={[s.modalTitle, { fontSize: 24 }]}>Payment Successful!</Text>
              <Text style={[s.modalSubtitle, { fontSize: 14, marginTop: 2 }]}>
                ₦{data.amount.toLocaleString()} has been added to your balance.
              </Text>
            </View>

            <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.divider }}>
              <Text style={{ color: C.textFaint, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>Reference</Text>
              <Text style={{ color: C.textPrimary, fontSize: 11, fontWeight: '600', marginTop: 2 }}>{data.ref}</Text>
            </View>

            <TouchableOpacity
              style={[s.modalConfirm, { backgroundColor: C.gold, height: 48, marginTop: 4 }]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={s.modalConfirmText}>BACK TO WALLET</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

export function WalletPanelContent({ initialAction }: { initialAction?: 'deposit' | 'withdrawal' }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<{ amount: number; ref: string } | null>(null);
  const [modalType, setModalType] = useState<'deposit' | 'withdrawal' | 'transfer' | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<TxItem[]>([]);
  const [stats, setStats] = useState<WalletStats>({ totalIn: 0, totalOut: 0, totalWinnings: 0 });
  const [userName, setUserName] = useState('Player');
  const [userEmail, setUserEmail] = useState('');
  const [userInitials, setUserInitials] = useState('PL');
  const [loading, setLoading] = useState(true);
  const [paystackVisible, setPaystackVisible] = useState(false);
  const [paystackAmount, setPaystackAmount] = useState(0);
  const gamblingEnabled = useGamblingEnabled();

  const headerAnim = useFadeSlide(0, -12);

  const WALLET_CACHE_KEY = 'ludo_fusion_wallet_cache_v2';

  const load = React.useCallback(async () => {
    // 1. Try Cache
    try {
      const cached = await AsyncStorage.getItem(WALLET_CACHE_KEY);
      if (cached) {
        const c = JSON.parse(cached);
        setBalance(c.balance);
        setTransactions(c.transactions);
        setStats(c.stats);
        setUserName(c.userName);
        setUserInitials(c.userInitials);
        setLoading(false);
      }
    } catch (e) { console.warn('Wallet cache err:', e); }

    // 2. Fetch Fresh
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email || '');

      // 1. Parallel fetch for speed
      const [pRes, gRes, tRes, sRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('games').select('*').eq('player_id', user.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('transactions').select('*').eq('player_id', user.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('profile_stats').select('*').eq('player_id', user.id).single(),
      ]);

      if (pRes.data) {
        const name = pRes.data.full_name || pRes.data.username || 'Player';
        setUserName(name);
        setUserInitials(getInitials(pRes.data.full_name));
        setBalance(Number(pRes.data.wallet_balance ?? 0));
      }

      // Merge games and transactions into one list
      const gameTx: TxItem[] = (gRes.data || []).map(g => {
        const isWin = g.result === 'win';
        const gameName = g.game_type === 'ludo' ? 'Ludo' : g.game_type === 'snake' ? 'Snake & Ladder' : 'Whot';
        const gameIcon: any = g.game_type === 'ludo' ? 'dice-multiple' : g.game_type === 'whot' ? 'cards-playing' : 'snake';

        return {
          id: g.id,
          label: isWin ? `${gameName} Victory` : `${gameName} Match`,
          sub: g.table_name || 'Global Arena',
          extra: isWin ? `Won ${gamblingEnabled ? '₦' : ''}${Math.abs(g.win_amount).toLocaleString()}${gamblingEnabled ? ' from prize pool' : ' coins'}` : `Match participation fee`,
          amountRaw: Math.abs(Number(g.win_amount ?? 0)),
          positive: isWin,
          icon: gameIcon,
          time: timeAgo(g.created_at),
          created_at: g.created_at,
          status: 'completed',
          type: isWin ? 'winning' : 'withdrawal',
        };
      });

      const manualTx: TxItem[] = (tRes.data || []).map(t => {
        let label = t.type === 'deposit'
          ? (gamblingEnabled ? 'Wallet Deposit' : 'Coins Earned')
          : t.type === 'withdrawal'
            ? (gamblingEnabled ? 'Wallet Withdrawal' : 'Coins Spent')
            : (gamblingEnabled ? 'Fund Transfer' : 'Transfer');
        let icon: any = t.type === 'deposit' ? 'plus-circle' : t.type === 'withdrawal' ? 'minus-circle' : 'swap-horizontal';

        const desc = (t.description || '').toLowerCase();
        const wordMatch = (word: string) => new RegExp('\\b' + word + '\\b', 'i').test(desc);
        if (wordMatch('ludo')) {
          label = 'Ludo Match';
          icon = 'dice-multiple';
        } else if (wordMatch('whot')) {
          label = 'Whot Match';
          icon = 'cards-playing';
        } else if (wordMatch('snake')) {
          label = 'Snake & Ladder';
          icon = 'snake';
        } else if (desc.includes('referral')) {
          label = 'Referral Bonus';
          icon = 'gift-outline';
        }

        return {
          id: t.id,
          label,
          sub: t.description || 'Transaction',
          amountRaw: Number(t.amount),
          positive: t.type === 'deposit' || t.type === 'winning',
          icon,
          time: timeAgo(t.created_at),
          created_at: t.created_at,
          status: (t.status || 'completed') as any,
          type: t.type as any,
        };
      });

      const merged = [...gameTx, ...manualTx].sort((a, b) =>
        new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
      ).slice(0, 20);

      setTransactions(merged);

      if (sRes.data) {
        setStats({
          totalIn: Number(sRes.data.total_wins * 100), // Approximate for now
          totalOut: Number((sRes.data.total_matches - sRes.data.total_wins) * 100),
          totalWinnings: Number(sRes.data.total_wins * 100),
        });
      }

      // Save to Cache
      AsyncStorage.setItem(WALLET_CACHE_KEY, JSON.stringify({
        balance: pRes.data?.wallet_balance ?? 0,
        transactions: merged,
        stats: { totalIn: 0, totalOut: 0, totalWinnings: 0 }, // Placeholder for now
        userName: pRes.data?.full_name || pRes.data?.username || 'Player',
        userInitials: getInitials(pRes.data?.full_name),
      }));

    } catch (e) {
      console.error('Wallet refresh error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (initialAction) {
      setModalType(initialAction);
      setModalVisible(true);
    }
  }, [initialAction]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('wallet_updated', load);
    return () => sub.remove();
  }, [load]);

  const filteredTx =
    activeTab === 0 ? transactions :
      activeTab === 1 ? transactions.filter(t => t.type === 'deposit') :
        activeTab === 2 ? transactions.filter(t => t.type === 'withdrawal') :
          transactions.filter(t => t.type === 'winning');

  if (loading && balance === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#05110B' }}>
        <ActivityIndicator size="large" color={C.gold} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 8, backgroundColor: '#05110B' }}>
        <DodgeKeyboard>
          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* ── Header bar ── */}
            <Animated.View style={[s.topBar, headerAnim]}>
              <View style={s.headerBlock}>
                <Text style={s.eyebrow}>PLAYER WALLET</Text>
                <Text style={s.pageTitle}>Wallet</Text>
              </View>

              <View style={s.headerRight}>
                <Pressable
                  style={s.notifBtn}
                  onPress={() => playButtonSound()}
                >
                  <MaterialCommunityIcons name="bell-outline" size={18} color={C.textMuted} />
                  <View style={s.notifDot} />
                </Pressable>
                <View style={s.idChip}>
                  <View style={s.idAvatar}>
                    <LinearGradient
                      colors={['#1E5A39', '#0A2318']}
                      style={[StyleSheet.absoluteFill, { borderRadius: 12 }]}
                    />
                    <Text style={s.idAvatarText}>{userInitials}</Text>
                  </View>
                  <View>
                    <Text style={s.idName}>{userName}</Text>
                    <Text style={s.idHandle}>@{userName.toLowerCase().replace(' ', '')}</Text>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* ── Landscape grid ── */}
            <View style={s.mainGrid}>
              <View style={s.leftCol}>
                <BalanceCard balance={balance} stats={stats} />
                <QuickActions onAction={(label) => {
                  if (label === 'Add Money') { setModalType('deposit'); setModalVisible(true); }
                  if (label === 'Withdraw') { setModalType('withdrawal'); setModalVisible(true); }
                  if (label === 'Transfer') { setModalType('transfer'); setModalVisible(true); }
                  if (label === 'History') { setActiveTab(0); }
                }} />
              </View>

              <View style={s.rightCol}>
                <TransactionsSection
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  filteredTx={filteredTx}
                />
              </View>
            </View>

          </ScrollView>
        </DodgeKeyboard>

        {gamblingEnabled && (
          <>
            <TransactionModal
              visible={modalVisible}
              type={modalType}
              onClose={() => setModalVisible(false)}
              onRefresh={Object.assign(load, {
                showSuccess: (data: any) => {
                  setSuccessData(data);
                  setShowSuccessModal(true);
                }
              })}
              userEmail={userEmail}
              onDepositConfirm={(amt, email) => {
                setPaystackAmount(amt);
                setPaystackVisible(true);
              }}
            />

            <PaystackWebView
              visible={paystackVisible}
              email={userEmail || 'user@example.com'}
              amount={paystackAmount}
              onClose={() => setPaystackVisible(false)}
              onSuccess={async ({ reference }) => {
                setPaystackVisible(false);
                try {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) throw new Error('No authenticated user');
                  const { error: insertError } = await supabase.from('transactions').insert({
                    player_id: user.id,
                    amount: paystackAmount,
                    type: 'deposit',
                    status: 'completed',
                    description: `Paystack: ₦${paystackAmount} Deposit (${reference})`,
                  });
                  if (insertError) throw insertError;
                  DeviceEventEmitter.emit('wallet_updated');
                  await load();
                  setSuccessData({ amount: paystackAmount, ref: reference });
                  setShowSuccessModal(true);
                } catch (e: any) {
                  console.error('Deposit callback error:', e);
                  Alert.alert(
                    'Deposit Issue',
                    `Payment was successful but we couldn't save the record. Don't worry — your money is safe with Paystack. Contact support with ref: ${reference}. Error: ${e?.message}`
                  );
                }
              }}
            />

            <PaymentSuccessModal
              visible={showSuccessModal}
              data={successData}
              onClose={() => setShowSuccessModal(false)}
            />
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

export function WalletPanel(props: any) {
  return (
    <WalletPanelContent {...props} />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  scroll: { flex: 1 },
  contentContainer: { padding: 0, gap: 5, paddingBottom: 20 },
  emptyText: { color: C.textFaint, fontSize: 12, fontStyle: 'italic', paddingVertical: 16, textAlign: 'center' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: C.surface, borderRadius: 18,
    borderWidth: 1, borderColor: C.goldBorder,
  },
  headerBlock: { gap: 1 },
  eyebrow: { color: C.gold, fontSize: 9, fontWeight: '700', letterSpacing: 2 },
  pageTitle: { color: C.textPrimary, fontSize: 20, fontWeight: '800', letterSpacing: 0.3 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notifBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  notifDot: {
    position: 'absolute', top: 7, right: 7,
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: C.danger, borderWidth: 1.5, borderColor: C.bg,
  },
  idChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
    backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.goldBorder,
  },
  idAvatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  idAvatarText: { color: C.textPrimary, fontSize: 9, fontWeight: '800' },
  idName: { color: C.textPrimary, fontSize: 11, fontWeight: '700', lineHeight: 13 },
  idHandle: { color: C.textMuted, fontSize: 9, fontWeight: '500' },

  mainGrid: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  leftCol: { width: 290, gap: 10 },
  rightCol: { flex: 1, gap: 10 },

  balanceCard: {
    borderRadius: 20, borderWidth: 1, borderColor: C.goldBorder,
    overflow: 'hidden', padding: 14, gap: 12, backgroundColor: C.surfaceStrong,
  },
  balanceArc: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.1)', right: -60, top: -80,
  },
  balanceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 },
  balanceEyebrow: { color: C.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 1.8, marginBottom: 4 },
  balanceAmountRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  balanceCurrency: { color: C.gold, fontSize: 18, fontWeight: '700', lineHeight: 36 },
  balanceAmount: { color: C.textPrimary, fontSize: 36, fontWeight: '800', letterSpacing: -0.5, lineHeight: 40 },
  balanceSub: { color: C.textMuted, fontSize: 10, fontWeight: '500', marginTop: 3 },
  balanceChips: { gap: 6, alignItems: 'flex-end' },
  balanceChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999,
    backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.goldBorder,
  },
  balanceChipText: { color: C.gold, fontSize: 10, fontWeight: '700' },
  balanceStats: { flexDirection: 'row', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', gap: 0 },
  balanceStat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  balanceStatDiv: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.07)', marginHorizontal: 10 },
  balanceStatVal: { color: C.textPrimary, fontSize: 11, fontWeight: '800' },
  balanceStatLabel: { color: C.textMuted, fontSize: 9, fontWeight: '500' },

  quickRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  quickBtn: { alignItems: 'center', gap: 6 },
  quickIconWrap: { width: 48, height: 48, borderRadius: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  quickLabel: { color: C.textMuted, fontSize: 9, fontWeight: '600', textAlign: 'center' },

  section: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 14, gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 2 },
  sectionTitle: { color: C.textPrimary, fontSize: 14, fontWeight: '800' },
  sectionCaption: { color: C.textMuted, fontSize: 10, marginTop: 1 },
  sectionAction: { color: C.gold, fontSize: 11, fontWeight: '700', marginTop: 2 },

  txTabsWrap: { flexDirection: 'row', gap: 5, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: 4 },
  txTab: { flex: 1, paddingVertical: 6, borderRadius: 7, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  txTabActive: { backgroundColor: C.goldSoft, borderColor: C.goldBorder },
  txTabText: { fontSize: 10, fontWeight: '600', color: C.textMuted },
  txTabTextActive: { color: C.textPrimary },

  txList: { gap: 0 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.divider },
  txRowPressed: { backgroundColor: C.surfaceHover },
  txIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, flexShrink: 0 },
  txInfo: { flex: 1, gap: 2, minWidth: 0 },
  txLabel: { color: C.textPrimary, fontSize: 12, fontWeight: '700' },
  txSub: { color: C.textMuted, fontSize: 10, numberOfLines: 1 } as any,
  txRight: { alignItems: 'flex-end', gap: 3 },
  txAmount: { fontSize: 12, fontWeight: '800' },
  txStatusPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  txStatusText: { fontSize: 9, fontWeight: '700', textTransform: 'capitalize' },

  pulseDot: { width: 6, height: 6, borderRadius: 3 },

  // ── Modal Styles ──
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: C.surfaceStrong,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: C.goldBorder,
    padding: 24,
    gap: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 4,
  },
  modalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  modalTitle: {
    color: C.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  modalSubtitle: {
    color: C.textMuted,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  modalBody: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  modalLabel: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  inputCurrency: {
    color: C.gold,
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 16,
  },
  modalInput: {
    flex: 1,
    height: 56,
    color: C.textPrimary,
    paddingHorizontal: 12,
    fontSize: 18,
    fontWeight: '700',
  },
  foundBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.successSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  foundText: {
    color: C.success,
    fontSize: 11,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 8,

  },
  modalCancel: {
    width: '100%',
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalCancelText: {
    color: C.textMuted,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modalConfirm: {
    width: '100%',
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalConfirmText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // ── Custom Numpad Styles ──
  modalMainRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  modalLeftCol: {
    flex: 1.2,
    gap: 12,
  },
  modalRightCol: {
    flex: 1,
  },
  numpadContainer: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 16,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  numpadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  numpadKey: {
    width: '31%',
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  numpadKeyText: {
    color: C.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
});