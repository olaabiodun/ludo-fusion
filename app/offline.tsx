import { GameplayScreen } from '@/components/GameplayScreen';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { playButtonSound } from '@/lib/sounds';
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

interface GameConfig {
  id: OfflineGame;
  title: string;
  label: string;
  accent: string;
  glow: string;
  image: any;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tagline: string;
}

const GAMES: GameConfig[] = [
  {
    id: 'ludo',
    title: 'Ludo Fusion',
    label: 'BOARD',
    accent: '#D4AF37',
    glow: '#7A5C00',
    image: require('@/assets/images/ludo.png'),
    icon: 'dice-5',
    tagline: 'Race your tokens. Outsmart the bots.',
  },
  {
    id: 'whot',
    title: 'Whot Clash',
    label: 'CARDS',
    accent: '#E05555',
    glow: '#7A1C1C',
    image: require('@/assets/images/whot.png'),
    icon: 'cards-playing-outline',
    tagline: 'Deploy your hand. Crush the algorithm.',
  },
  {
    id: 'snake_ladder',
    title: 'Snake & Ladder',
    label: 'CHANCE',
    accent: '#3CCF6A',
    glow: '#0D5C29',
    image: require('@/assets/images/snake.png'),
    icon: 'stairs',
    tagline: 'Roll the dice. Defy your fate.',
  },
];

export default function OfflineScreen() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [playerCount, setPlayerCount] = useState<2 | 4>(2);
  const [isPlaying, setIsPlaying] = useState(false);

  // Hero transition — cross-fade between game images
  const heroOpacity = useRef(new Animated.Value(1)).current;
  // Entrance fade
  const screenFade = useRef(new Animated.Value(0)).current;
  // Bottom bar slide up
  const barSlide = useRef(new Animated.Value(80)).current;
  // Play button pulse
  const pulse = useRef(new Animated.Value(1)).current;
  // Header slide down
  const headerSlide = useRef(new Animated.Value(-40)).current;

  const prevIdx = useRef(0);
  const [displayIdx, setDisplayIdx] = useState(0);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(screenFade, {
        toValue: 1, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true,
      }),
      Animated.spring(barSlide, {
        toValue: 0, tension: 50, friction: 9, delay: 200, useNativeDriver: true,
      }),
      Animated.spring(headerSlide, {
        toValue: 0, tension: 50, friction: 9, delay: 100, useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const switchGame = (idx: number) => {
    if (idx === activeIdx) return;
    try { playButtonSound(); } catch (_) {}

    // Cross-fade hero image
    Animated.timing(heroOpacity, {
      toValue: 0, duration: 200, useNativeDriver: true,
    }).start(() => {
      setActiveIdx(idx);
      setDisplayIdx(idx);
      Animated.timing(heroOpacity, {
        toValue: 1, duration: 300, useNativeDriver: true,
      }).start();
    });
  };

  const handlePlay = () => {
    try { playButtonSound(); } catch (_) {}
    setIsPlaying(true);
  };

  const togglePlayers = (n: 2 | 4) => {
    if (n === playerCount) return;
    try { playButtonSound(); } catch (_) {}
    setPlayerCount(n);
  };

  if (isPlaying) {
    const game = GAMES[activeIdx];
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <StatusBar hidden />
        <GameplayScreen
          mode={game.id}
          playerCount={playerCount}
          isAiEnabled={true}
          roomId={null}
          socket={undefined}
          onExit={() => setIsPlaying(false)}
        />
      </View>
    );
  }

  const game = GAMES[displayIdx];
  const { width: W, height: H } = Dimensions.get('window');

  return (
    <Animated.View style={[styles.root, { opacity: screenFade }]}>
      <StatusBar hidden />

      {/* ── FULL-SCREEN HERO BACKGROUND ── */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: heroOpacity }]}>
        <Image
          source={game.image}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        {/* Deep darkening gradient so text is always readable */}
        <LinearGradient
          colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.88)', '#000']}
          locations={[0, 0.3, 0.7, 1]}
          style={StyleSheet.absoluteFill}
        />
        {/* Colored tint from game theme at bottom */}
        <LinearGradient
          colors={['transparent', `${game.glow}88`]}
          locations={[0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* ── HEADER BAR ── */}
      <Animated.View style={[styles.header, { transform: [{ translateY: headerSlide }] }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={16} color="#fff" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerLabel}>OFFLINE ARENA</Text>
        </View>

        <View style={[styles.aiChip, { borderColor: `${game.accent}55` }]}>
          <View style={[styles.aiDot, { backgroundColor: game.accent }]} />
          <Text style={[styles.aiText, { color: game.accent }]}>AI READY</Text>
        </View>
      </Animated.View>

      {/* ── GAME SELECTOR TABS (horizontal pill row) ── */}
      <View style={styles.tabRow}>
        {GAMES.map((g, i) => {
          const isActive = i === activeIdx;
          return (
            <TouchableOpacity
              key={g.id}
              activeOpacity={0.8}
              onPress={() => switchGame(i)}
              style={[
                styles.tab,
                isActive && { backgroundColor: g.accent, borderColor: g.accent },
              ]}
            >
              <MaterialCommunityIcons
                name={g.icon}
                size={14}
                color={isActive ? '#000' : 'rgba(255,255,255,0.5)'}
              />
              <Text style={[styles.tabText, isActive && { color: '#000' }]}>{g.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── HERO TITLE BLOCK ── */}
      <View style={styles.heroBlock}>
        <Text style={[styles.heroTitle, { color: game.accent }]}>{game.title}</Text>
        <Text style={styles.heroTagline}>{game.tagline}</Text>
      </View>

      {/* ── BOTTOM CONTROL BAR ── */}
      <Animated.View style={[styles.bottomBar, { transform: [{ translateY: barSlide }] }]}>
        {/* Glass background */}
        <LinearGradient
          colors={['rgba(10,12,11,0.0)', 'rgba(10,12,11,0.97)']}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.barInner}>
          {/* Player count toggle */}
          <View style={styles.countBlock}>
            <Text style={styles.countLabel}>PLAYERS</Text>
            <View style={[styles.countPills, { borderColor: `${game.accent}33` }]}>
              {([2, 4] as const).map((n) => (
                <TouchableOpacity
                  key={n}
                  activeOpacity={0.8}
                  onPress={() => togglePlayers(n)}
                  style={[
                    styles.countPill,
                    playerCount === n && { backgroundColor: game.accent },
                  ]}
                >
                  <Text style={[styles.countPillText, playerCount === n && { color: '#000' }]}>
                    {n}P
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Divider */}
          <View style={styles.barDivider} />

          {/* Game info */}
          <View style={styles.barInfo}>
            <View style={[styles.barIconBox, { borderColor: `${game.accent}66` }]}>
              <MaterialCommunityIcons name={game.icon} size={18} color={game.accent} />
            </View>
            <View>
              <Text style={styles.barGameName}>{game.title}</Text>
              <Text style={styles.barGameSub}>{playerCount === 2 ? '1v1 • You vs AI' : '4-Way • You vs 3 AI'}</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.barDivider} />

          {/* PLAY button */}
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handlePlay}
              style={[styles.playBtn, { shadowColor: game.accent }]}
            >
              <LinearGradient
                colors={[game.accent, game.glow === '#7A5C00' ? '#FFE885' : game.glow === '#7A1C1C' ? '#FF9999' : '#9AFFA9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.playGrad}
              >
                <Ionicons name="play" size={18} color="#000" />
                <Text style={styles.playText}>PLAY</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },

  /* HEADER */
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 50,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  backText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '800',
    letterSpacing: 2,
  },
  aiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 50,
    borderWidth: 1,
  },
  aiDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  aiText: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 1,
  },

  /* GAME SELECTOR TABS */
  tabRow: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    zIndex: 40,
    paddingHorizontal: 20,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tabText: {
    fontSize: 9,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
  },

  /* HERO TITLE */
  heroBlock: {
    position: 'absolute',
    bottom: 110,
    left: 0,
    right: 0,
    paddingHorizontal: 32,
    zIndex: 30,
  },
  heroTitle: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    lineHeight: 44,
  },
  heroTagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '500',
    marginTop: 4,
    letterSpacing: 0.3,
  },

  /* BOTTOM BAR */
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    zIndex: 50,
    overflow: 'hidden',
  },
  barInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  countBlock: {
    alignItems: 'center',
    gap: 4,
  },
  countLabel: {
    fontSize: 7.5,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '900',
    letterSpacing: 1,
  },
  countPills: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  countPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPillText: {
    fontSize: 11,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.5,
  },
  barDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  barInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
  },
  barGameName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
  barGameSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '500',
    marginTop: 1,
  },
  playBtn: {
    width: 110,
    height: 48,
    borderRadius: 14,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 14,
    shadowOpacity: 0.5,
    elevation: 10,
  },
  playGrad: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  playText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },
});
