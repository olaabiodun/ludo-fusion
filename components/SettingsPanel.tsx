import { supabase } from '@/lib/supabase';
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

// ─── Profile Banner (Supabase-powered) ───────────────────────────────────────────────

// ProfileBanner removed per user request. Modal moved to main SettingsPanel.

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

  const AVATAR_PRESETS = [
    'https://api.dicebear.com/7.x/avataaars/png?seed=Felix&backgroundColor=b6e3f4',
    'https://api.dicebear.com/7.x/avataaars/png?seed=Aneka&backgroundColor=ffdfbf',
    'https://api.dicebear.com/7.x/avataaars/png?seed=Boo&backgroundColor=c0aede',
    'https://api.dicebear.com/7.x/avataaars/png?seed=Jasper&backgroundColor=d1d4f9',
    'https://api.dicebear.com/7.x/avataaars/png?seed=Luna&backgroundColor=ffd5dc',
    'https://api.dicebear.com/7.x/avataaars/png?seed=Milo&backgroundColor=c1f4c1',
  ];

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
          <View style={[s.editModal, { width: '95%', maxHeight: '80%', padding: 20 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[s.modalTitle, { fontSize: 18 }]}>{activeModal.charAt(0).toUpperCase() + activeModal.slice(1).replace('_', ' ')}</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={s.notifBtn}>
                <MaterialCommunityIcons name="close" size={20} color={C.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ marginTop: 10 }}>
              {activeModal === 'blocked' ? (
                <Text style={{ color: C.textMuted }}>No players currently blocked. You can block players from their profile or during a match.</Text>
              ) : activeModal === 'sessions' ? (
                <View style={{ gap: 10 }}>
                  <View style={[s.settingRow, s.settingDivider]}>
                    <MaterialCommunityIcons name="cellphone" size={24} color={C.success} />
                    <View>
                      <Text style={s.settingLabel}>Current Device</Text>
                      <Text style={s.settingSub}>Active now · Lagos, Nigeria</Text>
                    </View>
                  </View>
                </View>
              ) : activeModal === 'terms' ? (
                <Text style={{ color: C.textMuted, lineHeight: 20 }}>Welcome to Winnerson Plexus. By using our services, you agree to follow the rules of the games and maintain fair play...</Text>
              ) : (
                <Text style={{ color: C.textMuted }}>Details for {activeModal} will appear here soon.</Text>
              )}
            </ScrollView>
          </View>
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
                    <View style={s.avatarGrid}>
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
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  avatarThumbContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
