import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path, Polyline, Rect } from 'react-native-svg';
import { playButtonSound } from '../lib/sounds';
import { useGamblingEnabled } from '@/lib/GamblingContext';

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

const WalletIcon = ({ active }: { active?: boolean }) => (
  <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
    <Rect x={2} y={4} width={14} height={10} rx={2} stroke={active ? C.gold : "rgba(255,255,255,0.7)"} strokeWidth={1.5} />
    <Path d="M6 9H12M9 6V12" stroke={active ? C.gold : "rgba(255,255,255,0.7)"} strokeWidth={1.3} strokeLinecap="round" />
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

export const NAV_ITEMS = [
  { label: 'HOME', Icon: HomeIcon },
  { label: 'PROFILE', Icon: ProfileIcon },
  { label: 'LEADERBOARD', Icon: LeaderboardIcon },
  { label: 'FRIENDS', Icon: FriendsIcon },
  { label: 'WALLET', Icon: WalletIcon },
  { label: 'HISTORY', Icon: HistoryIcon },
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
        <Text style={[s.navText, active && s.navTextActive]}>{label}</Text>
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
  const gamblingEnabled = useGamblingEnabled();
  const items = gamblingEnabled ? NAV_ITEMS : NAV_ITEMS.filter(i => i.label !== 'WALLET');
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
