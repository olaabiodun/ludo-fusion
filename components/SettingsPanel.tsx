import { supabase } from '@/lib/supabase';
import { AVATAR_PRESETS } from '@/lib/avatars';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { DodgeKeyboard } from 'react-native-dodge-keyboard';

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

// ─── Data ─────────────────────────────────────────────────────────────────────

interface ToggleSetting {
  kind: 'toggle';
  id: string;
  icon: IconName;
  iconColor: string;
  iconBg: string;
  iconBorder: string;
  label: string;
  sub: string;
  defaultOn: boolean;
}

interface NavSetting {
  kind: 'nav';
  id: string;
  icon: IconName;
  iconColor: string;
  iconBg: string;
  iconBorder: string;
  label: string;
  sub: string;
  value?: string;
  danger?: boolean;
}

type SettingItem = ToggleSetting | NavSetting;

interface SettingsGroup {
  group: string;
  groupIcon: IconName;
  items: SettingItem[];
}

const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    group: 'Account',
    groupIcon: 'account-circle-outline',
    items: [
      {
        kind: 'nav',
        id: 'profile',
        icon: 'account-edit-outline',
        iconColor: C.gold,
        iconBg: C.goldSoft,
        iconBorder: C.goldBorder,
        label: 'Edit Profile',
        sub: 'Name, avatar, username',
      },
      {
        kind: 'nav',
        id: 'email',
        icon: 'email-outline',
        iconColor: C.info,
        iconBg: C.infoSoft,
        iconBorder: C.infoBorder,
        label: 'Email Address',
        sub: 'Login & notifications',
        value: 'master@play.ng',
      },
    ],
  },
  {
    group: 'Notifications',
    groupIcon: 'bell-ring-outline',
    items: [
      {
        kind: 'toggle',
        id: 'push',
        icon: 'bell-outline',
        iconColor: C.gold,
        iconBg: C.goldSoft,
        iconBorder: C.goldBorder,
        label: 'Push Notifications',
        sub: 'Game invites, match results',
        defaultOn: true,
      },
      // {
      //   kind: 'toggle',
      //   id: 'promo',
      //   icon: 'tag-outline',
      //   iconColor: C.success,
      //   iconBg: C.successSoft,
      //   iconBorder: C.successBorder,
      //   label: 'Promotions & Offers',
      //   sub: 'Bonuses, seasonal rewards',
      //   defaultOn: true,
      // },
      {
        kind: 'toggle',
        id: 'sounds',
        icon: 'volume-high',
        iconColor: C.info,
        iconBg: C.infoSoft,
        iconBorder: C.infoBorder,
        label: 'Sound Effects',
        sub: 'In-game audio cues',
        defaultOn: true,
      },
      {
        kind: 'toggle',
        id: 'vibrate',
        icon: 'vibrate',
        iconColor: C.gold,
        iconBg: C.goldSoft,
        iconBorder: C.goldBorder,
        label: 'Vibration',
        sub: 'Haptic feedback on actions',
        defaultOn: false,
      },
    ],
  },
  {
    group: 'Privacy & Security',
    groupIcon: 'shield-check-outline',
    items: [
      // {
      //   kind: 'toggle',
      //   id: '2fa',
      //   icon: 'two-factor-authentication',
      //   iconColor: C.success,
      //   iconBg: C.successSoft,
      //   iconBorder: C.successBorder,
      //   label: 'Two-Factor Auth',
      //   sub: 'Extra login security via SMS',
      //   defaultOn: true,
      // },
      {
        kind: 'toggle',
        id: 'online',
        icon: 'eye-outline',
        iconColor: C.info,
        iconBg: C.infoSoft,
        iconBorder: C.infoBorder,
        label: 'Show Online Status',
        sub: 'Friends can see when you\'re active',
        defaultOn: true,
      },
      {
        kind: 'nav',
        id: 'blocked',
        icon: 'account-cancel-outline',
        iconColor: C.danger,
        iconBg: C.dangerSoft,
        iconBorder: C.dangerBorder,
        label: 'Blocked Players',
        sub: 'Manage your block list',
        value: '2 players',
      },
      {
        kind: 'nav',
        id: 'sessions',
        icon: 'devices',
        iconColor: C.gold,
        iconBg: C.goldSoft,
        iconBorder: C.goldBorder,
        label: 'Active Sessions',
        sub: 'Manage logged-in devices',
        value: '3 devices',
      },
    ],
  },
  {
    group: 'Game Preferences',
    groupIcon: 'gamepad-variant-outline',
    items: [
      {
        kind: 'nav',
        id: 'language',
        icon: 'translate',
        iconColor: C.gold,
        iconBg: C.goldSoft,
        iconBorder: C.goldBorder,
        label: 'Language',
        sub: 'More coming soon',
        value: 'English',
      },
      {
        kind: 'toggle',
        id: 'autoaccept',
        icon: 'account-check-outline',
        iconColor: C.success,
        iconBg: C.successSoft,
        iconBorder: C.successBorder,
        label: 'Auto-Accept Rematch',
        sub: 'Skip the lobby confirmation step',
        defaultOn: false,
      },
      {
        kind: 'nav',
        id: 'tableTheme',
        icon: 'palette-outline',
        iconColor: C.info,
        iconBg: C.infoSoft,
        iconBorder: C.infoBorder,
        label: 'Board Theme',
        sub: 'Visual style for game tables',
        value: 'Royal Dark',
      },
    ],
  },
  {
    group: 'Support & Legal',
    groupIcon: 'lifebuoy',
    items: [
      {
        kind: 'nav',
        id: 'help',
        icon: 'help-circle-outline',
        iconColor: C.gold,
        iconBg: C.goldSoft,
        iconBorder: C.goldBorder,
        label: 'Help & FAQ',
        sub: 'Browse common questions',
      },
      {
        kind: 'nav',
        id: 'chat',
        icon: 'chat-processing-outline',
        iconColor: C.success,
        iconBg: C.successSoft,
        iconBorder: C.successBorder,
        label: 'Live Support',
        sub: 'Chat with our team',
      },
      {
        kind: 'nav',
        id: 'terms',
        icon: 'file-document-outline',
        iconColor: C.textMuted,
        iconBg: 'rgba(255,255,255,0.05)',
        iconBorder: 'rgba(255,255,255,0.08)',
        label: 'Terms & Conditions',
        sub: 'User agreement',
      },
      {
        kind: 'nav',
        id: 'privacy',
        icon: 'shield-account-outline',
        iconColor: C.textMuted,
        iconBg: 'rgba(255,255,255,0.05)',
        iconBorder: 'rgba(255,255,255,0.08)',
        label: 'Privacy Policy',
        sub: 'How we handle your data',
      },
      {
        kind: 'nav',
        id: 'logout',
        icon: 'logout-variant',
        iconColor: C.danger,
        iconBg: C.dangerSoft,
        iconBorder: C.dangerBorder,
        label: 'Log Out',
        sub: 'Sign out of your account',
        danger: true,
      },
    ],
  },
];

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

// ─── Toggle Row ───────────────────────────────────────────────────────────────

function ToggleRow({ item, value, onToggle, isLast }: { item: ToggleSetting; value: boolean; onToggle: (val: boolean) => void; isLast: boolean }) {
  return (
    <Pressable
      style={[s.settingRow, !isLast && s.settingDivider]}
      onPress={() => onToggle(!value)}
    >
      <View style={[s.settingIcon, { backgroundColor: item.iconBg, borderColor: item.iconBorder }]}>
        <MaterialCommunityIcons name={item.icon} size={17} color={item.iconColor} />
      </View>
      <View style={s.settingInfo}>
        <Text style={s.settingLabel}>{item.label}</Text>
        <Text style={s.settingSub}>{item.sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: 'rgba(255,255,255,0.08)', true: C.goldMid }}
        thumbColor={value ? C.gold : 'rgba(245,239,216,0.35)'}
        ios_backgroundColor="rgba(255,255,255,0.08)"
      />
    </Pressable>
  );
}

// ─── Nav Row ──────────────────────────────────────────────────────────────────

function NavRow({ item, isLast, onPress }: { item: NavSetting; isLast: boolean; onPress?: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [
        s.settingRow,
        !isLast && s.settingDivider,
        pressed && s.settingRowPressed,
      ]}
      onPress={onPress}
    >
      <View style={[s.settingIcon, { backgroundColor: item.iconBg, borderColor: item.iconBorder }]}>
        <MaterialCommunityIcons name={item.icon} size={17} color={item.iconColor} />
      </View>
      <View style={s.settingInfo}>
        <Text style={[s.settingLabel, item.danger && { color: C.danger }]}>{item.label}</Text>
        <Text style={s.settingSub}>{item.sub}</Text>
      </View>
      <View style={s.settingNavRight}>
        {item.value && (
          <Text style={s.settingValue}>{item.value}</Text>
        )}
        <MaterialCommunityIcons
          name="chevron-right"
          size={15}
          color={item.danger ? C.danger : C.textFaint}
        />
      </View>
    </Pressable>
  );
}

function SettingsSection({ group, settings, onToggle, onNav, delay }: {
  group: SettingsGroup;
  settings: any;
  onToggle: (id: string, val: boolean) => void;
  onNav: (id: string) => void;
  delay: number;
}) {
  const anim = useFadeSlide(delay);

  return (
    <Animated.View style={[s.section, anim]}>
      <View style={s.sectionHeader}>
        <View style={s.sectionTitleRow}>
          <MaterialCommunityIcons name={group.groupIcon} size={14} color={C.gold} />
          <Text style={s.sectionTitle}>{group.group}</Text>
        </View>
      </View>

      <View style={s.sectionBody}>
        {group.items.map((item, i) => {
          const isLast = i === group.items.length - 1;
          if (item.kind === 'toggle') {
            return (
              <ToggleRow
                key={item.id}
                item={item}
                value={settings[item.id] ?? false}
                onToggle={(val) => onToggle(item.id, val)}
                isLast={isLast}
              />
            );
          }
          return (
            <NavRow
              key={item.id}
              item={item}
              isLast={isLast}
              onPress={() => onNav(item.id)}
            />
          );
        })}
      </View>
    </Animated.View>
  );
}

// ─── Help & FAQ Data ─────────────────────────────────────────────────────────────

interface FAQCat {
  category: string;
  icon: IconName;
  items: { q: string; a: string }[];
}

const FAQ_DATA: FAQCat[] = [
  {
    category: 'Getting Started',
    icon: 'rocket-launch-outline',
    items: [
      { q: 'How do I create an account?', a: 'Enter your email address on the login screen, tap SIGN IN, check your inbox for a 6-digit verification code, enter it, then pick a username and full name to claim your signup bonus.' },
      { q: 'How do I play a game?', a: 'From the home screen, tap any game card — Ludo, Whot, Snake & Ladder, or Tournaments. In the lobby, choose Quick Match to find an opponent or create a Private Room to invite friends via a code.' },
      { q: 'What games are available?', a: 'Ludo (classic board game), Whot (Nigerian card game), Snake & Ladder (board game with snakes & ladders), and Tournaments — competitive events across all games with prize pools.' },
      { q: 'Is the app free to play?', a: 'Yes, you can play free games. Some modes and tournaments require an entry fee from your wallet balance. Free practice rooms are available for every game.' },
    ],
  },
  {
    category: 'Deposits & Withdrawals',
    icon: 'wallet-outline',
    items: [
      { q: 'How do I deposit funds?', a: 'Go to Wallet from the sidebar, tap DEPOSIT, enter the amount (minimum ₦100), choose your payment method, and complete the Paystack-secured transaction. Funds appear instantly.' },
      { q: 'How do I withdraw my winnings?', a: 'Go to Wallet, tap WITHDRAW, enter the amount (minimum ₦1,000), and confirm. Withdrawals are processed within 24 hours and sent to the bank account linked to your profile.' },
      { q: 'What payment methods are supported?', a: 'We support card payments (Visa, Mastercard), bank transfers, and USSD via Paystack. More options are added regularly.' },
      { q: 'Are there withdrawal fees?', a: 'Withdrawals are free for amounts above ₦2,000. A small processing fee of ₦50 applies to withdrawals under ₦2,000.' },
      { q: 'How long do withdrawals take?', a: 'Most withdrawals are processed within 2–4 hours during business hours. In rare cases, it may take up to 24 hours for security verification.' },
    ],
  },
  {
    category: 'Game Rules',
    icon: 'book-open-variant-outline',
    items: [
      { q: 'How is Ludo played?', a: 'Each player has 4 tokens. Roll a 6 to move a token from home to the board. Move clockwise around the path. Landing on an opponent sends them home. First to get all 4 tokens to the center wins.' },
      { q: 'What are the rules of Whot?', a: 'Players take turns matching the discard pile by suit, number, or special card. Special cards (Star, Circle, Cross, Triangle, Square, Whot!) force opponents to draw or skip. Last player holding cards loses.' },
      { q: 'How does Snake & Ladder work?', a: 'Roll the dice to move your piece from 1 to 100. Ladders boost you up. Snakes send you back down. First to reach exactly 100 wins. Landing on a ladder or snake triggers an automatic move.' },
      { q: 'What happens if I disconnect mid-game?', a: 'You have 30 seconds to reconnect before the game forfeits. If you rejoin in time, play resumes from where you left off. Your opponent is notified of the disconnect.' },
      { q: 'How does scoring work in tournaments?', a: 'Tournaments use a points system. Wins earn 3 points, draws earn 1 point, losses earn 0. Top players advance to the next round. Prizes are distributed based on final rank.' },
    ],
  },
  {
    category: 'Account & Security',
    icon: 'shield-account-outline',
    items: [
      { q: 'How do I change my username?', a: 'Open Settings, tap Edit Profile. You can change your username here. Choose wisely — changes are limited to once every 30 days. Your full name cannot be changed after verification.' },
      { q: 'How do I protect my account?', a: 'Use a strong email account password. Never share your OTP codes. Enable "Show Online Status" controls in Settings > Privacy & Security. Report suspicious activity immediately.' },
      { q: 'Can I delete my account?', a: 'Contact live support via Settings > Live Support to request account deletion. Your wallet balance must be zero. Deletion is permanent and cannot be reversed.' },
      { q: 'How do I block a player?', a: 'Go to Settings > Privacy & Security > Blocked Players, or tap the player\'s profile during a match and select Block. Blocked players cannot send you invites or messages.' },
    ],
  },
  {
    category: 'Troubleshooting',
    icon: 'wrench-outline',
    items: [
      { q: 'The app is loading slowly or stuck.', a: 'Check your internet connection. Force close the app and reopen. If the issue persists, clear the app cache in your device settings or reinstall the app.' },
      { q: 'My deposit hasn\'t arrived yet.', a: 'Most deposits are instant. If you haven\'t received funds after 10 minutes, check your bank statement to confirm the charge. If charged, contact support with the transaction reference.' },
      { q: 'I\'m having trouble with OTP login.', a: 'Ensure you\'re using the correct email address. Check your spam folder for the OTP. Request a new code after 60 seconds. If problems persist, try using a different email.' },
      { q: 'Game is lagging or crashing.', a: 'Close background apps, reduce device brightness, ensure you\'re on a stable connection (WiFi recommended). Update the app to the latest version from your app store.' },
      { q: 'How do I report a bug or issue?', a: 'Use the Live Support chat in Settings > Live Support, or email support@ludofusion.app with a screenshot and description. Our team typically responds within 2 hours.' },
    ],
  },
];

// ─── Help & FAQ Component ─────────────────────────────────────────────────────

function HelpContent({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, damping: 18, stiffness: 140, useNativeDriver: true }),
    ]).start();
  }, []);

  const toggleItem = (key: string) => {
    setExpanded(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const filtered = FAQ_DATA.map(cat => ({
    ...cat,
    items: cat.items.filter(item =>
      item.q.toLowerCase().includes(search.toLowerCase()) ||
      item.a.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => cat.items.length > 0);

  const helpStyles = StyleSheet.create({
    container: {
      flex: 1,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      paddingHorizontal: 12,
      height: 40,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      color: C.textPrimary,
      fontSize: 13,
      fontWeight: '600',
      padding: 0,
    },
    categoryBlock: {
      marginBottom: 4,
    },
    categoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 4,
    },
    categoryTitle: {
      color: C.gold,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    categoryLine: {
      flex: 1,
      height: 1,
      backgroundColor: 'rgba(212,175,55,0.15)',
    },
    faqItem: {
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.02)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.05)',
      marginBottom: 6,
      overflow: 'hidden',
    },
    faqHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 12,
    },
    faqQuestion: {
      flex: 1,
      color: C.textPrimary,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 17,
    },
    expandIcon: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    answerBody: {
      paddingHorizontal: 12,
      paddingBottom: 14,
      paddingTop: 2,
    },
    answerText: {
      color: C.textMuted,
      fontSize: 11,
      lineHeight: 18,
      fontWeight: '500',
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
      gap: 8,
    },
    emptyText: {
      color: C.textFaint,
      fontSize: 12,
      fontWeight: '600',
    },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      marginTop: 8,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.05)',
    },
    contactChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    contactChipText: {
      color: C.textMuted,
      fontSize: 10,
      fontWeight: '700',
    },
    resultsCount: {
      color: C.textFaint,
      fontSize: 10,
      fontWeight: '600',
      textAlign: 'right',
      paddingRight: 4,
      marginBottom: 4,
    },
  });

  const totalResults = filtered.reduce((sum, cat) => sum + cat.items.length, 0);

  return (
    <Animated.View style={[helpStyles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[s.settingIcon, { backgroundColor: C.goldSoft, borderColor: C.goldBorder }]}>
            <MaterialCommunityIcons name="help-circle-outline" size={18} color={C.gold} />
          </View>
          <View>
            <Text style={{ color: C.textPrimary, fontSize: 16, fontWeight: '900' }}>Help & FAQ</Text>
            <Text style={{ color: C.textMuted, fontSize: 9, fontWeight: '500' }}>Find answers fast</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} style={s.notifBtn}>
          <MaterialCommunityIcons name="close" size={18} color={C.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={helpStyles.searchRow}>
        <MaterialCommunityIcons name="magnify" size={16} color={C.textFaint} />
        <TextInput
          style={helpStyles.searchInput}
          placeholder="Search questions..."
          placeholderTextColor={C.textFaint}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <MaterialCommunityIcons name="close-circle" size={16} color={C.textFaint} />
          </TouchableOpacity>
        )}
      </View>

      {search.length > 0 && (
        <Text style={helpStyles.resultsCount}>{totalResults} result{totalResults !== 1 ? 's' : ''}</Text>
      )}

      {/* FAQ List */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
        {filtered.length === 0 ? (
          <View style={helpStyles.emptyState}>
            <MaterialCommunityIcons name="search-off" size={32} color={C.textFaint} />
            <Text style={helpStyles.emptyText}>No results found for "{search}"</Text>
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ color: C.gold, fontSize: 11, fontWeight: '700' }}>Clear search</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filtered.map((cat, ci) => (
            <View key={cat.category} style={helpStyles.categoryBlock}>
              <View style={helpStyles.categoryHeader}>
                <MaterialCommunityIcons name={cat.icon} size={14} color={C.gold} />
                <Text style={helpStyles.categoryTitle}>{cat.category}</Text>
                <View style={helpStyles.categoryLine} />
              </View>
              {cat.items.map((item, ii) => {
                const key = `${ci}-${ii}`;
                const isExpanded = expanded.includes(key);
                return (
                  <View key={key} style={helpStyles.faqItem}>
                    <TouchableOpacity
                      style={helpStyles.faqHeader}
                      onPress={() => toggleItem(key)}
                      activeOpacity={0.7}
                    >
                      <View style={{ width: 2, height: 16, borderRadius: 1, backgroundColor: isExpanded ? C.gold : 'rgba(255,255,255,0.1)' }} />
                      <Text style={helpStyles.faqQuestion}>{item.q}</Text>
                      <View style={helpStyles.expandIcon}>
                        <MaterialCommunityIcons
                          name={isExpanded ? 'minus' : 'plus'}
                          size={10}
                          color={isExpanded ? C.gold : C.textFaint}
                        />
                      </View>
                    </TouchableOpacity>
                    {isExpanded && (
                      <View style={helpStyles.answerBody}>
                        <Text style={helpStyles.answerText}>{item.a}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))
        )}

        {/* Contact footer */}
        <View style={helpStyles.contactRow}>
          <View style={helpStyles.contactChip}>
            <MaterialCommunityIcons name="email-outline" size={13} color={C.gold} />
            <Text style={helpStyles.contactChipText}>support@ludofusion.app</Text>
          </View>
          <View style={helpStyles.contactChip}>
            <MaterialCommunityIcons name="chat-processing-outline" size={13} color={C.success} />
            <Text style={helpStyles.contactChipText}>Live Chat</Text>
          </View>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

// ─── Live Support Component ────────────────────────────────────────────────────

type QuickIssue = {
  id: string;
  label: string;
  icon: IconName;
  color: string;
  bg: string;
  border: string;
};

const QUICK_ISSUES: QuickIssue[] = [
  { id: 'deposit', label: 'Deposit Issue', icon: 'bank-transfer', color: C.gold, bg: C.goldSoft, border: C.goldBorder },
  { id: 'withdrawal', label: 'Withdrawal', icon: 'cash-remove', color: C.danger, bg: C.dangerSoft, border: C.dangerBorder },
  { id: 'game_bug', label: 'Game Bug', icon: 'gamepad-variant-outline', color: C.info, bg: C.infoSoft, border: C.infoBorder },
  { id: 'account', label: 'Account Issue', icon: 'account-alert-outline', color: C.gold, bg: C.successSoft + '333', border: C.successBorder },
  { id: 'fairness', label: 'Fair Play', icon: 'shield-check-outline', color: C.success, bg: C.successSoft, border: C.successBorder },
  { id: 'other', label: 'Other', icon: 'forum-outline', color: C.textMuted, bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)' },
];

const AUTO_REPLIES: Record<string, { title: string; message: string }> = {
  deposit: {
    title: 'Deposit Issue',
    message: "I'm sorry you're having trouble with your deposit. Most deposits are credited instantly. If you've been charged but didn't receive funds, please wait 10 minutes and refresh your wallet. If the issue persists, share your transaction reference and our team will investigate within 2 hours.",
  },
  withdrawal: {
    title: 'Withdrawal Help',
    message: "Need help with a withdrawal? Ensure your bank details are correct in Settings. Withdrawals under ₦2,000 incur a ₦50 fee. Most requests process within 2–4 hours. If yours is taking longer, drop your transaction ID and we'll look into it right away.",
  },
  game_bug: {
    title: 'Game Bug Report',
    message: "Thanks for reporting this! Please describe what happened — which game, what you were doing, and any error message you saw. Screenshots are very helpful. Our engineering team typically fixes reported bugs within 24–48 hours.",
  },
  account: {
    title: 'Account Issue',
    message: "Let's get your account sorted. Common issues include login problems, username changes, and account verification. Please describe what's happening so I can help. For security, never share your password or OTP codes.",
  },
  fairness: {
    title: 'Fair Play Inquiry',
    message: "We take fair play seriously. All our games use verified random number generation and are audited regularly. If you suspect unfair play, please provide match details and we'll investigate thoroughly.",
  },
  other: {
    title: 'General Inquiry',
    message: "Hi there! How can I help you today? Please describe your issue or question and our support team will get back to you as soon as possible. You can also reach us directly at support@ludofusion.app.",
  },
};

function LiveSupportContent({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<{ role: 'bot' | 'user' | 'support'; text: string; time: string; showTag?: boolean }[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, damping: 18, stiffness: 140, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  // Load existing support messages
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase.rpc('get_my_support_messages');
        if (error) throw error;

        const msgs = data?.messages || [];
        const formatted = msgs.map(m => ({
          role: m.sender === 'User' ? 'user' : 'support' as 'user' | 'support',
          text: m.content,
          time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }));

        if (formatted.length === 0) {
          formatted.unshift({
            role: 'bot' as const,
            text: "👋 Hi! I'm the Ludo Fusion assistant. Select a topic below for instant help, or type your question to message our support team.",
            time: 'Just now',
          });
        }

        setMessages(formatted);
      } catch (e) {
        console.error('Failed to load support messages:', e);
      }
    })();
  }, []);

  // Realtime subscription for new support replies
  useEffect(() => {
    const sub = supabase
      .channel('support_messages')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inbox', filter: `type=eq.support` },
        async (payload) => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          const msg = payload.new as any;
          if (msg.user_id !== user.id) return;

          const { data } = await supabase.rpc('get_my_support_messages');
          const msgs = data?.messages || [];
          const formatted = msgs.map(m => ({
            role: m.sender === 'User' ? 'user' as const : 'support' as const,
            text: m.content,
            time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }));
          setMessages(formatted);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  const addBotMessage = (text: string) => {
    const now = new Date();
    setMessages(prev => [...prev, {
      role: 'bot' as const,
      text,
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);
  };

  const persistMessage = async (text: string) => {
    try {
      await supabase.rpc('send_support_message', { p_content: text });
    } catch (e) {
      console.error('Failed to persist support message:', e);
    }
  };

  const handleQuickIssue = async (issueId: string) => {
    const reply = AUTO_REPLIES[issueId];
    if (!reply) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages(prev => [...prev,
      { role: 'user', text: `I need help with: ${reply.title}`, time: timeStr },
      { role: 'bot', text: reply.message, time: timeStr },
    ]);

    // Persist the issue to support team in background
    persistMessage(`Issue: ${reply.title} — user was shown FAQ answer`);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Optimistically show user message
    setMessages(prev => [...prev, { role: 'user', text, time: timeStr }]);

    const success = await supabase.rpc('send_support_message', { p_content: text })
      .then(({ error }) => !error)
      .catch(() => false);

    setSending(false);

    if (success) {
      addBotMessage("Thanks for reaching out! Our support team has been notified and will get back to you within 24 hours. If it's urgent, email support@ludofusion.app directly.");
    } else {
      addBotMessage("Failed to send your message. Please try again or email support@ludofusion.app.");
    }
  };

  const ls = StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    agentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    agentDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: C.success,
    },
    agentName: {
      color: C.textPrimary,
      fontSize: 13,
      fontWeight: '900',
    },
    agentStatus: {
      color: C.success,
      fontSize: 8,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    quickRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
      marginBottom: 6,
    },
    quickChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: 1,
    },
    quickChipText: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    chatArea: {
      flex: 1,
      marginBottom: 6,
    },
    msgRow: {
      marginBottom: 6,
      flexDirection: 'row',
    },
    msgRowBot: {
      justifyContent: 'flex-start',
    },
    msgRowUser: {
      justifyContent: 'flex-end',
    },
    msgBubble: {
      maxWidth: '85%',
      borderRadius: 12,
      padding: 10,
    },
    msgBubbleBot: {
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)',
      borderBottomLeftRadius: 4,
    },
    msgBubbleUser: {
      backgroundColor: C.goldSoft,
      borderWidth: 1,
      borderColor: C.goldBorder,
      borderBottomRightRadius: 4,
    },
    msgText: {
      color: C.textPrimary,
      fontSize: 11.5,
      lineHeight: 18,
      fontWeight: '500',
    },
    msgTextUser: {
      color: C.textPrimary,
    },
    msgTime: {
      color: C.textFaint,
      fontSize: 8,
      fontWeight: '600',
      marginTop: 4,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.07)',
      paddingLeft: 10,
    },
    textInput: {
      flex: 1,
      color: C.textPrimary,
      fontSize: 12,
      fontWeight: '600',
      paddingVertical: 8,
    },
    sendBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: C.gold,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 2,
    },
    channelsRow: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 4,
    },
    channelCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 5,
      paddingHorizontal: 8,
      borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.02)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)',
    },
    channelText: {
      color: C.textMuted,
      fontSize: 8,
      fontWeight: '600',
    },
    emptyChat: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 30,
    },
  });

  return (
    <Animated.View style={[ls.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {/* Header */}
      <View style={ls.header}>
        <View style={ls.agentRow}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(87,208,139,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(87,208,139,0.3)' }}>
            <MaterialCommunityIcons name="headset" size={16} color={C.success} />
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={ls.agentName}>Help & Support</Text>
            </View>
            <Text style={ls.agentStatus}>Select a topic for instant help, or send a message to our team</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} style={s.notifBtn}>
          <MaterialCommunityIcons name="close" size={18} color={C.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Quick Issue Buttons */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10, marginLeft: -2 }}>
        <View style={ls.quickRow}>
          {QUICK_ISSUES.map(issue => (
            <TouchableOpacity
              key={issue.id}
              style={[ls.quickChip, { backgroundColor: issue.bg, borderColor: issue.border }]}
              onPress={() => handleQuickIssue(issue.id)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name={issue.icon} size={12} color={issue.color} />
              <Text style={[ls.quickChipText, { color: issue.color }]}>{issue.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Chat Messages */}
      <ScrollView ref={scrollRef} style={ls.chatArea} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 6 }}>
        {messages.map((msg, i) => (
          <View key={i} style={[ls.msgRow, msg.role === 'user' ? ls.msgRowUser : ls.msgRowBot]}>
            <View style={[ls.msgBubble, msg.role === 'user' ? ls.msgBubbleUser : ls.msgBubbleBot]}>
              <Text style={[ls.msgText, msg.role === 'user' && ls.msgTextUser]}>{msg.text}</Text>
              <Text style={[ls.msgTime, { textAlign: msg.role === 'user' ? 'right' : 'left' }]}>{msg.time}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Input */}
      <View style={ls.inputRow}>
        <TextInput
          style={ls.textInput}
          placeholder="Type your message..."
          placeholderTextColor={C.textFaint}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity style={ls.sendBtn} onPress={handleSend} activeOpacity={0.7}>
          <MaterialCommunityIcons name="send" size={14} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Other channels */}
      <View style={ls.channelsRow}>
        <View style={ls.channelCard}>
          <MaterialCommunityIcons name="email-outline" size={13} color={C.gold} />
          <Text style={ls.channelText}>support@ludofusion.app</Text>
        </View>
        <View style={ls.channelCard}>
          <MaterialCommunityIcons name="clock-outline" size={13} color={C.textFaint} />
          <Text style={ls.channelText}>24/7 Support</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
interface UserSettings {
  push: boolean;
  sounds: boolean;
  vibrate: boolean;
  online: boolean;
  autoaccept: boolean;
  [key: string]: boolean; // Allow string indexing for the toggle handler
}

export function SettingsPanel() {
  const headerAnim = useFadeSlide(0, -12);
  const [profile, setProfile] = useState<{ full_name: string; username: string; email: string; tier: string; avatar_url?: string } | null>(null);
  const [settings, setSettings] = useState<UserSettings>({
    push: true,
    sounds: true,
    vibrate: false,
    online: true,
    autoaccept: false,
  });
  const [stats, setStats] = useState({ blockedCount: 0, sessionCount: 1 });
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (prof) {
      setProfile({
        full_name: prof.full_name ?? '',
        username: prof.username ?? '',
        email: user.email ?? '',
        tier: prof.tier ?? 'newcomer',
        avatar_url: prof.avatar_url,
      });
      setEditUsername(prof.username ?? '');
      setEditAvatar(prof.avatar_url ?? null);
      setSettings({
        push: prof.push_notifications,
        sounds: prof.sound_effects,
        vibrate: prof.vibration,
        online: prof.show_online_status,
        autoaccept: prof.auto_accept_rematch,
      });
    }

    const { count: blockedCount } = await supabase.from('blocked_players').select('*', { count: 'exact', head: true }).eq('blocker_id', user.id);
    setStats({ blockedCount: blockedCount || 0, sessionCount: 1 });
  }

  useEffect(() => { loadData(); }, []);

  const handleToggle = async (id: string, val: boolean) => {
    setSettings(prev => ({ ...prev, [id]: val }));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const columnMap: any = {
      push: 'push_notifications',
      sounds: 'sound_effects',
      vibrate: 'vibration',
      online: 'show_online_status',
      autoaccept: 'auto_accept_rematch',
    };

    await supabase.from('profiles').update({ [columnMap[id]]: val }).eq('id', user.id);
  };

  const handleNav = (id: string) => {
    if (id === 'profile') {
      setEditOpen(true);
      return;
    }
    if (id === 'logout') {
      Alert.alert('Log Out', 'Are you sure you want to log out?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out', style: 'destructive', onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/');
          }
        },
      ]);
      return;
    }
    if (['terms', 'privacy', 'help', 'chat', 'blocked', 'sessions'].includes(id)) {
      setActiveModal(id);
    }
  };

  const liveGroups: SettingsGroup[] = SETTINGS_GROUPS.map(group => ({
    ...group,
    items: group.items.map(item => {
      if (item.id === 'email') return { ...item, value: profile?.email || '...' };
      if (item.id === 'blocked') return { ...item, value: `${stats.blockedCount} players` };
      if (item.id === 'sessions') return { ...item, value: `${stats.sessionCount} active` };
      return item;
    }),
  }));

  async function saveProfile() {
    if (!editUsername.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('profiles').update({
      username: editUsername.trim().toLowerCase(),
      avatar_url: editAvatar,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);

    if (error) {
      Alert.alert('Error', 'Username might be taken or invalid');
    } else {
      setEditOpen(false);
      loadData();
    }
    setSaving(false);
  }

  const leftGroups = liveGroups.filter((_, i) => i % 2 === 0);
  const rightGroups = liveGroups.filter((_, i) => i % 2 !== 0);

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : (profile?.username ?? 'PL').slice(0, 2).toUpperCase();

  return (
    <View style={{ flex: 1 }}>
      <DodgeKeyboard>
        <ScrollView style={s.scroll} contentContainerStyle={s.contentContainer} showsVerticalScrollIndicator={false}>
          {/* ── Header bar ── */}
          <Animated.View style={[s.topBar, headerAnim]}>
          <View style={s.headerBlock}>
            <Text style={s.eyebrow}>PREFERENCES</Text>
            <Text style={s.pageTitle}>Settings</Text>
          </View>
          <View style={s.headerRight}>
            <Pressable style={s.notifBtn}>
              <MaterialCommunityIcons name="bell-outline" size={18} color={C.textMuted} />
              <View style={s.notifDot} />
            </Pressable>
            <View style={s.idChip}>
              <View style={s.idAvatar}>
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={StyleSheet.absoluteFill} />
                ) : (
                  <>
                    <LinearGradient colors={['#1E5A39', '#0A2318']} style={[StyleSheet.absoluteFill, { borderRadius: 12 }]} />
                    <Text style={s.idAvatarText}>{initials}</Text>
                  </>
                )}
              </View>
              <View>
                <Text style={s.idName}>{profile?.full_name || profile?.username || 'Player'}</Text>
                <Text style={s.idHandle}>@{profile?.username ?? '...'}</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ── Two-column settings grid ── */}
        <View style={s.mainGrid}>
          <View style={s.col}>
            {leftGroups.map((group, i) => (
              <SettingsSection
                key={group.group}
                group={group}
                settings={settings}
                onToggle={handleToggle}
                onNav={handleNav}
                delay={200 + i * 100}
              />
            ))}
          </View>
          <View style={s.col}>
            {rightGroups.map((group, i) => (
              <SettingsSection
                key={group.group}
                group={group}
                settings={settings}
                onToggle={handleToggle}
                onNav={handleNav}
                delay={260 + i * 100}
              />
            ))}
          </View>
        </View>

        </ScrollView>
      </DodgeKeyboard>

      {/* Generic Modal Overlay (Non-Native) */}
      {activeModal && (
        <View style={s.modalOverlay}>
          {activeModal === 'help' ? (
            <View style={[s.editModal, { width: '95%', maxWidth: 640, height: '85%', padding: 16 }]}>
              <HelpContent onClose={() => setActiveModal(null)} />
            </View>
          ) : activeModal === 'chat' ? (
            <View style={[s.editModal, { width: '92%', maxWidth: 480, height: '85%', padding: 14 }]}>
              <LiveSupportContent onClose={() => setActiveModal(null)} />
            </View>
          ) : (
          <View style={[s.editModal, { width: '92%', maxWidth: 500, maxHeight: '80%', padding: 16 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[s.modalTitle, { fontSize: 16 }]}>{activeModal.charAt(0).toUpperCase() + activeModal.slice(1).replace('_', ' ')}</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={s.notifBtn}>
                <MaterialCommunityIcons name="close" size={18} color={C.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ marginTop: 8 }}>
              {activeModal === 'blocked' ? (
                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 10, height: 36 }}>
                    <MaterialCommunityIcons name="magnify" size={14} color={C.textFaint} />
                    <TextInput
                      placeholder="Search blocked players..."
                      placeholderTextColor={C.textFaint}
                      style={{ flex: 1, color: C.textPrimary, fontSize: 11, fontWeight: '600', padding: 0 }}
                    />
                  </View>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 14, alignItems: 'center', gap: 8 }}>
                    <MaterialCommunityIcons name="account-cancel-outline" size={28} color={C.textFaint} />
                    <Text style={{ color: C.textMuted, fontSize: 11, fontWeight: '600', textAlign: 'center' }}>No players currently blocked</Text>
                    <Text style={{ color: C.textFaint, fontSize: 9, fontWeight: '500', textAlign: 'center' }}>You can block players from their profile or during a match.</Text>
                  </View>
                </View>
              ) : activeModal === 'sessions' ? (
                <View style={{ gap: 10 }}>
                  <View style={{ backgroundColor: 'rgba(87,208,139,0.06)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(87,208,139,0.2)', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(87,208,139,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(87,208,139,0.25)' }}>
                      <MaterialCommunityIcons name="cellphone" size={16} color={C.success} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ color: C.textPrimary, fontSize: 12, fontWeight: '800' }}>Current Device</Text>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.success }} />
                        <Text style={{ color: C.success, fontSize: 8, fontWeight: '700' }}>ACTIVE</Text>
                      </View>
                      <Text style={{ color: C.textMuted, fontSize: 9, fontWeight: '500', marginTop: 2 }}>Windows · Chrome 125 · Lagos, Nigeria</Text>
                    </View>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}>
                      <Text style={{ color: C.textFaint, fontSize: 8, fontWeight: '700' }}>NOW</Text>
                    </View>
                  </View>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(242,107,107,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(242,107,107,0.15)' }}>
                        <MaterialCommunityIcons name="tablet" size={16} color={C.danger} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.textPrimary, fontSize: 12, fontWeight: '800' }}>Android Tablet</Text>
                        <Text style={{ color: C.textMuted, fontSize: 9, fontWeight: '500', marginTop: 2 }}>Samsung Galaxy Tab S9 · Lagos, Nigeria</Text>
                      </View>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(242,107,107,0.08)', borderWidth: 1, borderColor: 'rgba(242,107,107,0.15)' }}>
                        <Text style={{ color: C.danger, fontSize: 8, fontWeight: '700' }}>3h AGO</Text>
                      </View>
                    </View>
                    <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 10 }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(242,107,107,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(242,107,107,0.15)' }}>
                        <MaterialCommunityIcons name="cellphone-iphone" size={16} color={C.danger} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.textPrimary, fontSize: 12, fontWeight: '800' }}>iPhone 15 Pro</Text>
                        <Text style={{ color: C.textMuted, fontSize: 9, fontWeight: '500', marginTop: 2 }}>iOS 18.4 · Abuja, Nigeria</Text>
                      </View>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(242,107,107,0.08)', borderWidth: 1, borderColor: 'rgba(242,107,107,0.15)' }}>
                        <Text style={{ color: C.danger, fontSize: 8, fontWeight: '700' }}>2d AGO</Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity style={{ paddingVertical: 10, alignItems: 'center', backgroundColor: 'rgba(242,107,107,0.08)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(242,107,107,0.15)' }} activeOpacity={0.7}>
                    <Text style={{ color: C.danger, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>REVOKE ALL OTHER SESSIONS</Text>
                  </TouchableOpacity>
                </View>
              ) : activeModal === 'terms' ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: C.textFaint, fontSize: 9, fontWeight: '600', textAlign: 'right' }}>Last updated: May 2026</Text>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 14, maxWidth: 680 }}>
                    <Text style={{ color: C.textMuted, fontSize: 11, lineHeight: 20, fontWeight: '500' }}>
                      <Text style={{ color: C.textPrimary, fontWeight: '800' }}>1. Acceptance of Terms</Text>{'\n'}
                      By accessing or using Ludo Fusion ("the App"), you agree to be bound by these Terms & Conditions. If you do not agree, do not use the App. We reserve the right to update these terms at any time.
                      {'\n\n'}
                      <Text style={{ color: C.textPrimary, fontWeight: '800' }}>2. Eligibility</Text>{'\n'}
                      You must be 18 years or older to use the App. By using the App, you confirm that you are of legal age in your jurisdiction. The App is intended for users in Nigeria and jurisdictions where permitted by law.
                      {'\n\n'}
                      <Text style={{ color: C.textPrimary, fontWeight: '800' }}>3. Account Registration</Text>{'\n'}
                      You are responsible for maintaining the confidentiality of your account credentials. You agree to provide accurate and complete information during registration. Each user may maintain only one account. Duplicate accounts may be suspended or terminated.
                      {'\n\n'}
                      <Text style={{ color: C.textPrimary, fontWeight: '800' }}>4. Virtual Currency & Wallet</Text>{'\n'}
                      The App uses a virtual currency system for gameplay. Virtual currency has no real-world value and cannot be exchanged for real money, goods, or services outside the App. All purchases of virtual currency are final and non-refundable. We reserve the right to modify, suspend, or terminate the virtual currency system at any time.
                      {'\n\n'}
                      <Text style={{ color: C.textPrimary, fontWeight: '800' }}>5. Game Rules & Fair Play</Text>{'\n'}
                      All games are governed by their respective rules as displayed within the App. We employ anti-cheat measures to detect bots, collusion, and other unfair practices. Violations may result in forfeiture of winnings, suspension, or permanent account ban.
                      {'\n\n'}
                      <Text style={{ color: C.textPrimary, fontWeight: '800' }}>6. Prohibited Conduct</Text>{'\n'}
                      You agree not to: (a) exploit bugs or glitches; (b) use automated scripts or bots; (c) harass other players; (d) create multiple accounts; (e) engage in money laundering; (f) reverse-engineer the App; or (g) use the App for any illegal purpose.
                      {'\n\n'}
                      <Text style={{ color: C.textPrimary, fontWeight: '800' }}>7. Intellectual Property</Text>{'\n'}
                      All content, trademarks, logos, and software within the App are the property of Ludo Fusion or its licensors. You may not copy, modify, distribute, or create derivative works without express written permission.
                      {'\n\n'}
                      <Text style={{ color: C.textPrimary, fontWeight: '800' }}>8. Limitation of Liability</Text>{'\n'}
                      The App is provided "as is" without warranties of any kind. To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, or consequential damages arising from your use of the App.
                      {'\n\n'}
                      <Text style={{ color: C.textPrimary, fontWeight: '800' }}>9. Termination</Text>{'\n'}
                      We reserve the right to suspend or terminate your account at any time, with or without cause, including for violation of these terms. Upon termination, your right to use the App ceases immediately.
                      {'\n\n'}
                      <Text style={{ color: C.textPrimary, fontWeight: '800' }}>10. Governing Law</Text>{'\n'}
                      These terms are governed by the laws of the Federal Republic of Nigeria. Any disputes shall be resolved through binding arbitration in Lagos, Nigeria.
                      {'\n\n'}
                      <Text style={{ color: C.textPrimary, fontWeight: '800' }}>11. Contact</Text>{'\n'}
                      For questions about these terms, contact us at support@ludofusion.app.
                    </Text>
                  </View>
                </View>
              ) : activeModal === 'privacy' ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: C.textFaint, fontSize: 9, fontWeight: '600', textAlign: 'right' }}>Last updated: May 2026</Text>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 14, maxWidth: 680 }}>
                    <Text style={{ color: C.textMuted, fontSize: 11, lineHeight: 20, fontWeight: '500' }}>
                      <Text style={{ color: C.textPrimary, fontWeight: '800' }}>1. Information We Collect</Text>{'\n'}
                      We collect information you provide directly: name, email address, username, profile photo, and communications with support. We also collect usage data: game activity, device information, IP address, and session duration.
                      {'\n\n'}
                      <Text style={{ color: C.textPrimary, fontWeight: '800' }}>2. How We Use Your Information</Text>{'\n'}
                      We use your information to operate the App, process transactions, provide customer support, improve our services, send important updates, and detect fraudulent or unauthorized activity.
                      {'\n\n'}
                      <Text style={{ color: C.textPrimary, fontWeight: '800' }}>3. Payment Information</Text>{'\n'}
                      All payment processing is handled securely by Paystack. We do not store full credit card numbers, CVV codes, or bank account details on our servers. Paystack is PCI-DSS compliant.
                      {'\n\n'}
                      <Text style={{ color: C.textPrimary, fontWeight: '800' }}>4. Data Sharing</Text>{'\n'}
                      We do not sell your personal information. We may share data with service providers who help us operate (e.g., Paystack, Supabase, hosting providers) under strict confidentiality agreements. We may disclose data if required by law.
                      {'\n\n'}
                      <Text style={{ color: C.textPrimary, fontWeight: '800' }}>5. Data Retention</Text>{'\n'}
                      We retain your account data for as long as your account is active. Upon account deletion, we delete or anonymize your data within 30 days. Transaction records are retained for 6 years for legal compliance.
                      {'\n\n'}
                      <Text style={{ color: C.textPrimary, fontWeight: '800' }}>6. Your Rights</Text>{'\n'}
                      You may access, update, or delete your personal data at any time via Settings. You may request a copy of your data by contacting support. You may opt out of marketing communications at any time.
                      {'\n\n'}
                      <Text style={{ color: C.textPrimary, fontWeight: '800' }}>7. Security</Text>{'\n'}
                      We implement industry-standard encryption (SSL/TLS) for data transmission. Account access is protected by email OTP verification. We regularly audit our systems for vulnerabilities.
                      {'\n\n'}
                      <Text style={{ color: C.textPrimary, fontWeight: '800' }}>8. Cookies</Text>{'\n'}
                      We use essential cookies for authentication and session management. We do not use third-party tracking cookies. You may disable cookies in your device settings, but this may affect App functionality.
                      {'\n\n'}
                      <Text style={{ color: C.textPrimary, fontWeight: '800' }}>9. Children's Privacy</Text>{'\n'}
                      The App is not intended for users under 18. We do not knowingly collect data from minors. If we discover a minor's data has been collected, we will delete it immediately.
                      {'\n\n'}
                      <Text style={{ color: C.textPrimary, fontWeight: '800' }}>10. Changes to This Policy</Text>{'\n'}
                      We may update this policy from time to time. Material changes will be notified via email or in-app notice. Continued use after changes constitutes acceptance.
                      {'\n\n'}
                      <Text style={{ color: C.textPrimary, fontWeight: '800' }}>11. Contact</Text>{'\n'}
                      For privacy-related inquiries, contact our Data Protection Officer at privacy@ludofusion.app.
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={{ color: C.textMuted }}>Details for {activeModal} will appear here soon.</Text>
              )}
            </ScrollView>
          </View>
          )}
        </View>
      )}

      {/* ── Edit Profile Overlay (Non-Native) ── */}
      {editOpen && (
        <View style={s.modalOverlay}>
          <Animated.View style={[s.editModal, { width: '85%', maxWidth: 440, padding: 14, gap: 10 }]}>
            <View style={s.modalHeader}>
              <View style={[s.modalIconWrap, { backgroundColor: C.gold + '15', width: 40, height: 40, borderRadius: 10 }]}>
                <MaterialCommunityIcons name="account-edit-outline" size={20} color={C.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.modalTitle, { fontSize: 16 }]}>Edit Profile</Text>
                <Text style={s.modalSubtitle}>Update your identity</Text>
              </View>
              <TouchableOpacity onPress={() => setEditOpen(false)} style={s.notifBtn}>
                <MaterialCommunityIcons name="close" size={20} color={C.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={s.modalMainRow}>
              {/* Left Column: Avatar Management */}
              <View style={s.modalLeftCol}>
                <View style={s.avatarSelectionSection}>
                  <TouchableOpacity 
                    style={s.mainAvatarCore}
                    onPress={() => setShowAvatarPicker(!showAvatarPicker)}
                    activeOpacity={0.8}
                  >
                    <View style={s.avatarBigCircle}>
                      {editAvatar ? (
                        <Image source={{ uri: editAvatar }} style={s.fullImg} />
                      ) : (
                        <Text style={s.avatarBigText}>{initials}</Text>
                      )}
                      <View style={s.avatarEditBadge}>
                        <MaterialCommunityIcons name="camera" size={14} color="#000" />
                      </View>
                    </View>
                  </TouchableOpacity>

                  <View style={s.avatarPickerLabelRow}>
                    <Text style={s.avatarPickerLabel}>Appearance</Text>
                    <TouchableOpacity onPress={() => setShowAvatarPicker(!showAvatarPicker)}>
                      <Text style={s.avatarPickerAction}>{showAvatarPicker ? 'Hide' : 'Change'}</Text>
                    </TouchableOpacity>
                  </View>

                  {showAvatarPicker && (
                    <View>
                      <ScrollView
                        showsVerticalScrollIndicator={true}
                        style={{ maxHeight: 114 }}
                        contentContainerStyle={s.avatarGrid}
                      >
                        {AVATAR_PRESETS.map((url, i) => (
                          <TouchableOpacity 
                            key={i} 
                            onPress={() => {
                              setEditAvatar(url);
                              setShowAvatarPicker(false);
                            }}
                            style={[s.avatarThumbContainer, editAvatar === url && s.avatarThumbActive]}
                          >
                            <Image source={{ uri: url }} style={s.fullImg} />
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>

              {/* Right Column: Profile Form */}
              <View style={s.modalRightCol}>
                <View style={s.modalBody}>
                  <View style={s.avatarInputGroup}>
                    <TextInput
                      style={[s.modalInput, { height: 42, fontSize: 15 }]}
                      value={editUsername}
                      onChangeText={setEditUsername}
                      placeholder="username"
                      placeholderTextColor={C.textFaint}
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={s.lockedDataSection}>
                    <View style={s.lockedDataItem}>
                      <MaterialCommunityIcons name="account-lock" size={13} color={C.textFaint} />
                      <Text style={s.lockedDataText}>{profile?.full_name}</Text>
                    </View>
                    <View style={s.lockedDataItem}>
                      <MaterialCommunityIcons name="email-lock" size={13} color={C.textFaint} />
                      <Text style={s.lockedDataText}>{profile?.email}</Text>
                    </View>
                  </View>
                </View>

                <View style={[s.modalActions, { gap: 6, marginTop: 10 }]}>
                  <TouchableOpacity 
                    style={[s.modalConfirm, { backgroundColor: C.gold, height: 44 }]} 
                    onPress={saveProfile}
                    disabled={saving}
                    activeOpacity={0.8}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <>
                        <Text style={s.modalConfirmText}>SAVE PROFILE</Text>
                        <MaterialCommunityIcons name="check" size={16} color="#000" />
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.modalCancel, { height: 44 }]} onPress={() => setEditOpen(false)} activeOpacity={0.7}>
                    <Text style={s.modalCancelText}>CANCEL</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: { flex: 1 },
  contentContainer: {
    padding: 8,
    gap: 10,
    paddingBottom: 24,
  },

  // ── Top Bar ──
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  headerBlock: { gap: 1 },
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notifBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  notifDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.danger,
    borderWidth: 1.5,
    borderColor: C.bg,
  },
  idChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: C.goldSoft,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  idAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  idAvatarText: {
    color: C.textPrimary,
    fontSize: 9,
    fontWeight: '800',
  },
  idName: {
    color: C.textPrimary,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
  },
  idHandle: {
    color: C.textMuted,
    fontSize: 9,
    fontWeight: '500',
  },

  // ── Profile Banner ──
  profileBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.goldBorder,
    backgroundColor: C.surfaceStrong,
    overflow: 'hidden',
  },
  bannerArc: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.08)',
    right: -60,
    top: -90,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    borderWidth: 2,
    borderColor: C.goldBorder,
  },
  profileAvatarText: {
    color: C.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
  },
  crownBadge: {
    position: 'absolute',
    top: -6,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6,17,11,0.94)',
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  profileInfo: {
    flex: 1,
    gap: 3,
  },
  profileEyebrow: {
    color: C.gold,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
  },
  profileName: {
    color: C.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  profileHandle: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  profileBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: C.goldSoft,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  profileBadgeText: {
    color: C.textPrimary,
    fontSize: 10,
    fontWeight: '700',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: C.goldSoft,
    borderWidth: 1,
    borderColor: C.goldBorder,
    alignSelf: 'flex-start',
  },
  editBtnText: {
    color: C.gold,
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Grid ──
  mainGrid: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  col: {
    flex: 1,
    gap: 10,
  },

  // ── Section ──
  section: {
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  sectionHeader: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionTitle: {
    color: C.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sectionBody: {
    paddingHorizontal: 14,
  },

  // ── Setting Row ──
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
  },
  settingDivider: {
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
  },
  settingRowPressed: {
    backgroundColor: C.surfaceHover,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  settingInfo: {
    flex: 1,
    gap: 2,
  },
  settingLabel: {
    color: C.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  settingSub: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '500',
  },
  settingNavRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  settingValue: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },

  // ── Version Footer ──
  versionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 8,
  },
  versionText: {
    color: C.textFaint,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  editModal: {
    backgroundColor: C.surfaceStrong,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.goldBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  modalIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  modalTitle: {
    color: C.textPrimary,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  modalSubtitle: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '500',
    marginTop: 0,
  },
  modalMainRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  modalLeftCol: {
    flex: 0.8,
    gap: 8,
  },
  modalRightCol: {
    flex: 1.2,
  },
  modalBody: {
    gap: 8,
  },
  inputGroup: {
    gap: 4,
  },
  modalLabel: {
    color: C.textMuted,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginLeft: 2,
  },
  avatarInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    paddingHorizontal: 8,
  },
  modalInput: {
    flex: 1,
    color: C.textPrimary,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'column',
    gap: 6,
  },
  modalConfirm: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    gap: 6,
  },
  modalConfirmText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  modalCancel: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalCancelText: {
    color: C.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },

  // ── Avatar Specific Styles ──
  avatarSelectionSection: {
    alignItems: 'center',
    gap: 8,
  },
  mainAvatarCore: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBigCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5,
    borderColor: C.goldBorder,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBigText: {
    color: C.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: C.surfaceStrong,
  },
  avatarPickerLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 2,
  },
  avatarPickerLabel: {
    color: C.textMuted,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  avatarPickerAction: {
    color: C.gold,
    fontSize: 9,
    fontWeight: '700',
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 6,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  avatarThumbContainer: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  avatarThumbActive: {
    borderColor: C.gold,
    borderWidth: 1.5,
  },
  fullImg: {
    width: '100%',
    height: '100%',
  },
  lockedDataSection: {
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  lockedDataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lockedDataText: {
    color: C.textFaint,
    fontSize: 10,
    fontWeight: '600',
  },
});
