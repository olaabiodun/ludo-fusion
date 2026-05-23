import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const C = {
  bg: '#06130C',
  card: 'rgba(255,255,255,0.04)',
  cardBorder: 'rgba(212,175,55,0.18)',
  gold: '#D4AF37',
  goldSoft: 'rgba(212,175,55,0.10)',
  green: '#42D392',
  greenSoft: 'rgba(66,211,146,0.12)',
  blue: '#5B8FF9',
  blueSoft: 'rgba(91,143,249,0.12)',
  red: '#FF6B6A',
  redSoft: 'rgba(255,107,106,0.12)',
  text: '#F5EFD8',
  textMuted: 'rgba(245,239,216,0.64)',
};

type EarnCoinsPanelProps = {
  onBrowseGames: () => void;
  onOpenAnnouncements: () => void;
  onOpenProfile: () => void;
  onOpenLeaderboard: () => void;
};

type RewardCard = {
  title: string;
  subtitle: string;
  detail: string;
  cta: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  accent: string;
  soft: string;
  onPress: () => void;
};

function ActionCard({ card }: { card: RewardCard }) {
  return (
    <View style={[s.actionCard, { borderColor: card.soft, backgroundColor: card.soft }]}>
      <View style={s.cardTop}>
        <View style={[s.iconWrap, { backgroundColor: card.accent + '20' }]}>
          <MaterialCommunityIcons name={card.icon} size={16} color={card.accent} />
        </View>
        <View style={s.cardTextWrap}>
          <Text style={s.cardTitle}>{card.title}</Text>
          <Text style={s.cardSubtitle} numberOfLines={2}>{card.subtitle}</Text>
        </View>
      </View>
      <View style={s.cardBottom}>
        <Text style={[s.cardDetail, { color: card.accent }]} numberOfLines={1}>{card.detail}</Text>
        <Pressable style={s.cardBtn} onPress={card.onPress}>
          <Text style={s.cardBtnText}>{card.cta}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function EarnCoinsPanel({
  onBrowseGames,
  onOpenAnnouncements,
  onOpenProfile,
  onOpenLeaderboard,
}: EarnCoinsPanelProps) {
  const cards: RewardCard[] = [
    {
      title: 'Daily Bonus',
      subtitle: 'Claim your free login bonus every day.',
      detail: '+10 coins every 24 hours',
      cta: 'Go Home',
      icon: 'gift-outline',
      accent: C.gold,
      soft: C.goldSoft,
      onPress: onBrowseGames,
    },
    {
      title: 'Match Wins',
      subtitle: 'Play multiplayer games and stack up coin rewards.',
      detail: 'Best for steady coin growth',
      cta: 'Browse Games',
      icon: 'trophy-outline',
      accent: C.green,
      soft: C.greenSoft,
      onPress: onBrowseGames,
    },
    {
      title: 'Event Drops',
      subtitle: 'Check announcements for featured rewards and bonus events.',
      detail: 'Limited-time coin boosts',
      cta: 'Open Updates',
      icon: 'bullhorn-outline',
      accent: C.blue,
      soft: C.blueSoft,
      onPress: onOpenAnnouncements,
    },
    {
      title: 'Level Progress',
      subtitle: 'Build your profile, keep your streak, and improve your rank.',
      detail: 'More play, more rewards',
      cta: 'View Profile',
      icon: 'account-star-outline',
      accent: C.red,
      soft: C.redSoft,
      onPress: onOpenProfile,
    },
  ];

  return (
    <View style={s.root}>
      <LinearGradient colors={['rgba(212,175,55,0.16)', 'rgba(212,175,55,0.05)', 'rgba(7,20,12,0.75)']} style={s.hero}>
        <View style={s.heroBadge}>
          <MaterialCommunityIcons name="star-four-points" size={11} color={C.gold} />
          <Text style={s.heroBadgeText}>EARN COINS</Text>
        </View>
        <Text style={s.heroTitle}>Earn Coins</Text>
        <Text style={s.heroSub}>
          Claim your daily bonus, win matches, and follow updates for extra coin drops.
        </Text>
        <View style={s.heroStatsRow}>
          <View style={s.heroStat}>
            <Text style={s.heroStatValue}>+10</Text>
            <Text style={s.heroStatLabel}>daily bonus</Text>
          </View>
          <View style={s.heroDivider} />
          <View style={s.heroStat}>
            <Text style={s.heroStatValue}>Wins</Text>
            <Text style={s.heroStatLabel}>best payout path</Text>
          </View>
          <View style={s.heroDivider} />
          <View style={s.heroStat}>
            <Text style={s.heroStatValue}>Events</Text>
            <Text style={s.heroStatLabel}>bonus chances</Text>
          </View>
        </View>
      </LinearGradient>
      <View style={s.quickBar}>
        <Pressable style={s.quickBtn} onPress={onBrowseGames}>
          <MaterialCommunityIcons name="gamepad-variant-outline" size={14} color={C.gold} />
          <Text style={s.quickBtnText}>Play Games</Text>
        </Pressable>
        <Pressable style={s.quickBtn} onPress={onOpenLeaderboard}>
          <MaterialCommunityIcons name="trophy-outline" size={14} color={C.gold} />
          <Text style={s.quickBtnText}>Leaderboard</Text>
        </Pressable>
      </View>
      <View style={s.grid}>
        {cards.map(card => (
          <ActionCard key={card.title} card={card} />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    padding: 14,
    gap: 12,
  },
  hero: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 16,
    gap: 8,
    overflow: 'hidden',
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: C.goldSoft,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  heroBadgeText: {
    color: C.gold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  heroTitle: {
    color: C.text,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
  },
  heroSub: {
    color: C.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  heroStatsRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroStat: {
    minWidth: 96,
    gap: 2,
  },
  heroStatValue: {
    color: C.text,
    fontSize: 17,
    fontWeight: '900',
  },
  heroStatLabel: {
    color: C.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroDivider: {
    width: 1,
    height: 28,
    backgroundColor: C.cardBorder,
  },
  quickBar: {
    flexDirection: 'row',
    gap: 10,
  },
  quickBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    backgroundColor: 'rgba(255,255,255,0.035)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  quickBtnText: {
    color: C.text,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignContent: 'flex-start',
  },
  actionCard: {
    minHeight: 138,
    width: '48.7%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardTextWrap: {
    flex: 1,
    gap: 3,
  },
  cardBottom: {
    gap: 8,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: C.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  cardDetail: {
    fontSize: 11,
    fontWeight: '800',
  },
  cardBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  cardBtnText: {
    color: C.text,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
