import { GameplayScreen } from '@/components/GameplayScreen';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type OfflineGame = 'ludo' | 'whot' | 'snake_ladder';

interface BotTier {
  label: string;
  color: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

interface GameCardData {
  id: OfflineGame;
  title: string;
  subtitle: string;
  accentColor: string;
  accentSoft: string;
  accentGlow: string;
  image: any;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  difficultyColor: string;
  description: string;
  features: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }[];
  bots: BotTier[];
  timeEstimate: string;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const C = {
  gold: '#D4AF37',
  goldLight: '#E7C75A',
  goldDark: '#B8962E',
  goldDeep: '#8A6A00',
  bgDeep: '#05110B',
  textMain: '#F0F0F0',
  textMuted: '#A0B0A8',
  textDim: '#3A4D42',
};

const GAMES: GameCardData[] = [
  {
    id: 'ludo',
    title: 'Ludo Fusion',
    subtitle: 'C
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 3,
    textShadowColor: C.gold + '30',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  headerSub: {
    fontSize: 10,
    fontWeight: '600',
    color: C.textMuted,
    letterSpacing: 0.4,
    marginTop: 3,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 50,
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  badgeRowText: {
    fontSize: 8,
    fontWeight: '900',
    color: C.gold,
    letterSpacing: 1,
  },

  // â”€â”€ Divider â”€â”€
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 60,
  },
  divLine: {
    flex: 1,
    height: 1,
  },
  divDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginHorizontal: 8,
    borderWidth: 1,
  },

  // â”€â”€ Cards row â”€â”€
  cardsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },

  // â”€â”€ Card â”€â”€
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 28,
    borderWidth: 1.5,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.7,
    shadowRadius: 30,
    elevation: 18,
  },
  cardAccent: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 3.5,
    zIndex: 5,
  },
  cardInnerStroke: {
    position: 'absolute',
    top: 5, left: 5, right: 5, bottom: 5,
    borderRadius: 23,
    borderWidth: 1,
    zIndex: 4,
  },
  cardContent: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 6,
    padding: 18,
  },

  // Top row
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  topBadges: {
    gap: 4,
    alignItems: 'flex-end',
  },
  diffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  diffDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  diffText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  playerCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderR
    width: 24,
  },
  vsText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    zIndex: 2,
    backgroundColor: '#0a1812',
    paddingHorizontal: 4,
  },
  vsLine: {
    position: 'absolute',
    left: 0, right: 0,
    height: 1,
    zIndex: 1,
  },
  avatarLineupGrid: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  avatarGridRow: {
    flexDirection: 'row',
    gap: 22,
  },
  selectorCardTextWrap: {
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  selectorCardTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  selectorCardSub: {
    fontSize: 7.5,
    fontWeight: '600',
    color: C.textMuted,
    textAlign: 'center',
  },
  launchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 50,
    marginTop: 14,
    borderBottomWidth: 3.5,
    borderBottomColor: 'rgba(0,0,0,0.3)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.35)',
    zIndex: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  launchBtnText: {
    fontSize: 11,
    fontWeight: '950',
    color: '#000',
    letterSpacing: 2,
  },
  launchBtnIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

