import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path, Polyline, Rect } from 'react-native-svg';
import { playButtonSound } from '../lib/sounds';
import { useFeatureActive } from '@/lib/FeatureContext';

const C = {
  gold: '#D4AF37',
  goldBorder: 'rgba(212,175,55,0.5)',
};

const HomeIcon = ({ active }: { active?: boolean }) => (
  <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
    <Path
      d="M2 9L9 2L16 9V16H12V12H6V16H2V9Z"
      stroke={active ? C.gold : 'rgba(255,255,255,0.7)'}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  </Svg>
);

const ProfileIcon = ({ active }: { active?: boolean }) => (
  <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
    <Circle cx={9} cy={6} r={3.5} stroke={active ? C.gold : "rgba(255,255,255,0.7)"} strokeWidth={1.5} />
    <Path
      d="M2 16C2 13 5 11 9 11C13 11 16 13 16 16"
      stroke={active ? C.gold : "rgba(255,255,255,0.7)"}
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </Svg>
);

const LeaderboardIcon = ({ active }: { active?: boolean }) => (
  <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
    <Path
      d="M9 2L10.5 7H16L11.5 10L13 15L9 12L5 15L6.5 10L2 7H7.5L9 2Z"
      stroke={active ? C.gold : "rgba(255,255,255,0.7)"}
      strokeWidth={1.3}
      strokeLinejoin="round"
    />
  </Svg>
);


const FriendsIcon = ({ active }: { active?: boolean }) => (
  <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
    <Circle cx={6} cy={7} r={3} stroke={active ? C.gold : "rgba(255,255,255,0.7)"} strokeWidth={1.5} />
    <Circle cx={13} cy={7} r={3} stroke={active ? C.gold : "rgba(255,255,255,0.7)"} strokeWidth={1.5} />
    <Path
      d="M1 16C1 13.5 3.2 12 6 12"
      stroke={active ? C.gold : "rgba(255,255,255,0.7)"}
      strokeWidth={1.5}
      strokeLinecap="round"
    />
    <Path
      d="M10 16C10 13.5 12.2 12 15 12"
      stroke={active ? C.gold : "rgba(255,255,255,0.7)"}
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </Svg>
);

const VaultIcon = ({ active }: { active?: boolean }) => (
  <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
    <Rect x={2} y={2} width={14} height={14} rx={2} stroke={active ? C.gold : "rgba(255,255,255,0.7)"} strokeWidth={1.5} />
    <Circle cx={9} cy={9} r={3.5} stroke={active ? C.gold : "rgba(255,255,255,0.7)"} strokeWidth={1.3} />
    <Circle cx={9} cy={9} r={1} fill={active ? C.gold : "rgba(255,255,255,0.7)"} />
    <Path d="M9 5.5V7M9 11V12.5M5.5 9H7M11 9H12.5" stroke={active ? C.gold : "rgba(255,255,255,0.7)"} strokeWidth={1.2} />
  </Svg>
);

const EarnIcon = ({ active }: { active?: boolean }) => (
  <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
    <Circle cx={9} cy={9} r={6.8} stroke={active ? C.gold : "rgba(255,255,255,0.7)"} strokeWidth={1.5} />
    <Path
      d="M9 4.5V13.5M6.2 7.3C6.2 6.2 7.3 5.4 9 5.4C10.6 5.4 11.8 6.1 11.8 7.2C11.8 8.2 10.9 8.6 9 9C7.1 9.4 6.2 9.8 6.2 10.9C6.2 12 7.4 12.6 9 12.6C10.7 12.6 11.8 11.8 11.8 10.8"
      stroke={active ? C.gold : "rgba(255,255,255,0.7)"}
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const HistoryIcon = ({ active }: { active?: boolean }) => (
  <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
    <Circle cx={9} cy={9} r={7} stroke={active ? C.gold : "rgba(255,255,255,0.7)"} strokeWidth={1.5} />
    <Polyline
      points="9,5 9,9 12,11"
      stroke={active ? C.gold : "rgba(255,255,255,0.7)"}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const SettingsIcon = ({ active }: { active?: boolean }) => (
  <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
    <Circle cx={9} cy={9} r={3} stroke={active ? C.gold : "rgba(255,255,255,0.7)"} strokeWidth={1.5} />
    <Path
      d="M9 1V3M9 15V17M1 9H3M15 9H17M3.2 3.2L4.6 4.6M13.4 13.4L14.8 14.8M14.8 3.2L13.4 4.6M4.6 13.4L3.2 14.8"
      stroke={active ? C.gold : "rgba(255,255,255,0.7)"}
      strokeWidth={1.3}
      strokeLinecap="round"
    />
  </Svg>
);

const SpinIcon = ({ active }: { active?: boolean }) => (
  <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
    <Circle cx={9} cy={9} r={7} stroke={active ? C.gold : "rgba(255,255,255,0.7)"} strokeWidth={1.5} />
    <Path d="M9 2V16M2 9H16M4.05 4.05L13.95 13.95M4.05 13.95L13.95 4.05" stroke={active ? C.gold : "rgba(255,255,255,0.7)"} strokeWidth={1} />
    <Circle cx={9} cy={9} r={1.8} fill={active ? C.gold : "rgba(255,255,255,0.7)"} />
  </Svg>
);

export const NAV_ITEMS = [
  { label: 'HOME', Icon: HomeIcon },
  { label: 'PROFILE', Icon: ProfileIcon },
  { label: 'LEADERBOARD', Icon: LeaderboardIcon },
  { label: 'FRIENDS', Icon: FriendsIcon },
  { label: 'VAULT', Icon: VaultIcon },
  { label: 'LUCKY_SPIN', Icon: SpinIcon },
  { label: 'HISTORY', Icon: HistoryIcon },
  { label: 'EARN', Icon: EarnIcon },
  { label: 'SETTINGS', Icon: SettingsIcon },
] as const;

export type SidebarNav = (typeof NAV_ITEMS)[number]['label'] | 'INBOX';

type AnimatedNavItemProps = {
  label: SidebarNav;
  Icon: React.ComponentType<{ active?: boolean }>;
  active: boolean;
  index: number;
  onPress: () => void;
};

function AnimatedNavItem({ label, Icon, active, index, onPress }: AnimatedNavItemProps) {
  const slideAnim = useRef(new Animated.Value(-30)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        delay: index * 60,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, index, slideAnim]);

  const handlePressIn = () => {
    Animated.timing(pressScale, {
      toValue: 0.97,
      duration: 60,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 24,
      bounciness: 6,
    }).start();
  };

  return (
    <Animated.View
      style={{
        transform: [{ translateX: slideAnim }, { scale: pressScale }],
        opacity: fadeAnim,
      }}
    >
      <TouchableOpacity
        style={[s.navItem, active && s.navItemActive]}
        onPress={() => {
          playButtonSound();
          onPress();
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <Icon active={active} />
        <Text style={[s.navText, active && s.navTextActive]}>{label === 'EARN' ? 'EARN COINS' : label.replace('_', ' ')}</Text>
        {active && <View style={s.navActiveDot} />}
      </TouchableOpacity>
    </Animated.View>
  );
}

type SidebarProps = {
  activeNav: SidebarNav;
  onNavChange: (label: SidebarNav) => void;
};

export function Sidebar({ activeNav, onNavChange }: SidebarProps) {
  const featureActive = useFeatureActive();
  const items = featureActive
    ? NAV_ITEMS.filter(i => i.label !== 'EARN' && i.label !== 'LUCKY_SPIN')
    : NAV_ITEMS.filter(i => i.label !== 'VAULT' && i.label !== 'LUCKY_SPIN');
  return (
    <View style={s.sidebar}>
      {items.map(({ label, Icon }, index) => (
        <AnimatedNavItem
          key={label}
          label={label}
          Icon={Icon}
          active={activeNav === label}
          index={index}
          onPress={() => onNavChange(label)}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  sidebar: {
    width: 168,
    flex: 1,
    backgroundColor: 'rgba(10, 35, 24, 0.45)',
    borderRightWidth: 1,
    borderRightColor: C.goldBorder,
    paddingVertical: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  navItemActive: {
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderRightWidth: 3,
    borderRightColor: C.gold,
  },
  navText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    fontFamily: 'Kanit_900Black'
  },
  navTextActive: {
    color: C.gold,
  },
  navActiveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.gold,
    position: 'absolute',
    right: 10,
  },
});
