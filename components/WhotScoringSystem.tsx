import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
  Pressable,
} from 'react-native';
import { animated, useSpring, config } from '@react-spring/native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { WhotFrontCard } from './WhotFrontCard';
import { rs, calculateScore } from './WhotUtils';

interface Card {
  shape: 'circle' | 'triangle' | 'cross' | 'square' | 'star' | 'whot';
  value: number | string;
}

interface Player {
  name: string;
  color: string;
  avatar: any;
  cards: Card[];
}

interface ScoringSystemProps {
  visible: boolean;
  players: Player[];
  onRestart: () => void;
  onNext: () => void;
}

const calculateCardValue = (card: Card): number => {
  if (!card || !card.shape) return 0;
  if (card.shape === 'whot') return 20;
  const v = card.value;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    return isNaN(n) ? 0 : n;
  }
  return 0;
};

const RANK_META = [
  { icon: 'crown' as const,        color: '#FFD030', bg: 'rgba(255,208,48,0.18)' },
  { icon: 'medal' as const,        color: '#C8C8D4', bg: 'rgba(200,200,212,0.12)' },
  { icon: 'medal-outline' as const,color: '#CD8C4A', bg: 'rgba(205,140,74,0.12)' },
  { icon: 'account' as const,      color: '#555566', bg: 'rgba(255,255,255,0.06)' },
];

const PlayerRow = ({
  player, score, rank, delay, isSelected, onPress,
}: {
  player: Player; score: number; rank: number; delay: number;
  isSelected: boolean; onPress: () => void;
}) => {
  const meta = RANK_META[rank] ?? RANK_META[3];

  const enter = useSpring({
    from: { opacity: 0, translateX: -rs(20) },
    to:   { opacity: 1, translateX: 0 },
    delay,
    config: config.gentle,
  });

  return (
    <animated.View style={[{ marginBottom: rs(5) }, enter]}>
      <Pressable onPress={onPress}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: rs(6),
            paddingHorizontal: rs(8),
            borderRadius: rs(10),
            borderWidth: 1,
            borderColor: isSelected ? meta.color : 'rgba(255,255,255,0.07)',
            backgroundColor: isSelected ? meta.bg : 'rgba(255,255,255,0.03)',
          }}
        >
          <View style={{
            width: rs(17), height: rs(17), borderRadius: rs(8.5),
            backgroundColor: `${meta.color}22`,
            alignItems: 'center', justifyContent: 'center', marginRight: rs(6),
          }}>
            <MaterialCommunityIcons name={meta.icon} size={rs(9)} color={meta.color} />
          </View>

          <Image source={player.avatar} style={{
            width: rs(22), height: rs(22), borderRadius: rs(11),
            borderWidth: 1.5,
            borderColor: isSelected ? meta.color : 'rgba(255,255,255,0.15)',
            marginRight: rs(7),
          }} />

          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{
              color: isSelected ? '#FFF' : 'rgba(255,255,255,0.6)',
              fontSize: rs(9), fontWeight: '700', letterSpacing: 0.3,
            }}>
              {player.name}
            </Text>
            {player.cards.length === 0 && (
              <Text style={{ color: '#30D158', fontSize: rs(6.5), fontWeight: '900', letterSpacing: 0.5 }}>
                WINNER
              </Text>
            )}
          </View>

          <Text style={{ color: meta.color, fontSize: rs(13), fontWeight: '900' }}>
            {score}
          </Text>
        </View>
      </Pressable>
    </animated.View>
  );
};

const CardChip = ({ card, isVisible }: { card: Card, isVisible: boolean }) => {
  const pop = useSpring({
    scale: isVisible ? 1 : 0.4,
    opacity: isVisible ? 1 : 0,
    config: { tension: 350, friction: 12 },
  });

  return (
    <animated.View style={{ 
      margin: rs(2), 
      borderRadius: rs(4), 
      overflow: 'hidden',
      transform: [{ scale: pop.scale }],
      opacity: pop.opacity
    }}>
      <WhotFrontCard shape={card.shape} value={card.value} width={rs(38)} height={rs(54)} />
    </animated.View>
  );
};

const ScoreTag = ({ card, isVisible }: { card: Card, isVisible: boolean }) => {
  const val = calculateCardValue(card);
  const label = card.shape === 'whot'
    ? 'WHOT'
    : `${card.shape[0].toUpperCase()}${card.value}`;
    
  const slide = useSpring({
    opacity: isVisible ? 1 : 0,
    translateY: isVisible ? 0 : rs(8),
    config: config.stiff,
  });

  return (
    <animated.View style={{
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderRadius: rs(5), paddingHorizontal: rs(5), paddingVertical: rs(2), margin: rs(2),
      opacity: slide.opacity,
      transform: [{ translateY: slide.translateY }]
    }}>
      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: rs(7), fontWeight: '600' }}>
        {label}
      </Text>
      <Text style={{ color: '#FFD030', fontSize: rs(7), fontWeight: '900', marginLeft: rs(3) }}>
        +{val}
      </Text>
    </animated.View>
  );
};

export const WhotScoringSystem = React.memo(
  ({ visible, players, onRestart, onNext }: ScoringSystemProps) => {
    
    const [selectedIdx, setSelectedIdx] = React.useState(0);
    const [btnPressed,  setBtnPressed]  = React.useState(false);
    const cardIntervalRef = React.useRef<any>(null);
    const isCountingRef = React.useRef(false);

    const [progressMap, setProgressMap] = React.useState<number[]>([]);
    const [countingFinished, setCountingFinished] = React.useState(false);
    const [runningScores, setRunningScores] = React.useState<number[]>([]);

    const overlay = useSpring({
      opacity: visible ? 1 : 0,
      scale:   visible ? 1 : 0.96,
      config: { duration: 340 },
    });

    const header = useSpring({
      from: { opacity: 0, translateY: -rs(14) },
      to:   { opacity: visible ? 1 : 0, translateY: visible ? 0 : -rs(14) },
      config: config.gentle,
    });

    const btnScale = useSpring({
      scale: btnPressed ? 0.93 : 1,
      config: { tension: 430, friction: 14 },
    });

    // Rank order indices: winner (score 0 / 0 cards) first, then ascending score
    const sortedIndices = React.useMemo(() =>
      players
        .map((_, i) => i)
        .sort((a, b) => {
          const aCards = players[a].cards.length;
          const bCards = players[b].cards.length;
          if (aCards === 0 && bCards > 0) return -1;
          if (bCards === 0 && aCards > 0) return 1;
          const aScore = calculateScore(players[a].cards);
          const bScore = calculateScore(players[b].cards);
          return aScore - bScore;
        }),
      [players]
    );

    React.useEffect(() => {
      if (!visible || countingFinished) return;

      const timeoutRef: { current: any } = { current: null };
      const order = sortedIndices;
      let step = 0;

      const startCountingPlayer = () => {
        if (step >= order.length) {
          setCountingFinished(true);
          isCountingRef.current = false;
          return;
        }

        const pIdx = order[step];
        setSelectedIdx(pIdx);
        const p = players[pIdx];

        if (!p || p.cards.length === 0) {
          setRunningScores(prev => {
            const next = [...prev];
            next[pIdx] = 0;
            return next;
          });
          step += 1;
          timeoutRef.current = setTimeout(() => startCountingPlayer(), 400);
          return;
        }

        let cardIdx = 0;
        let score = 0;

        cardIntervalRef.current = setInterval(() => {
          if (cardIdx < p.cards.length) {
            const val = calculateCardValue(p.cards[cardIdx]);
            score += val;
            cardIdx += 1;

            setProgressMap(prev => {
              const next = [...prev];
              next[pIdx] = cardIdx;
              return next;
            });

            setRunningScores(prev => {
              const next = [...prev];
              next[pIdx] = score;
              return next;
            });
          } else {
            if (cardIntervalRef.current) clearInterval(cardIntervalRef.current);
            step += 1;
            timeoutRef.current = setTimeout(() => startCountingPlayer(), 600);
          }
        }, 220);
      };

      if (!isCountingRef.current) {
        isCountingRef.current = true;
        startCountingPlayer();
      }

      return () => {
        if (cardIntervalRef.current) clearInterval(cardIntervalRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }, [visible, countingFinished, players, sortedIndices]);

    React.useEffect(() => {
      if (countingFinished && visible) {
        const timer = setTimeout(() => {
          if (onNext) onNext();
        }, 3000); 
        return () => clearTimeout(timer);
      }
    }, [countingFinished, visible, onNext]);

    React.useEffect(() => {
      if (visible) {
        setCountingFinished(false);
        isCountingRef.current = false;
        setProgressMap(new Array(players.length).fill(0));
        setRunningScores(new Array(players.length).fill(0));
        setSelectedIdx(0);
      }
    }, [visible, players.length]);

    if (!visible) return null;

    const winner = players.find(p => p.cards.length === 0);
    const titleText = winner ? "WINNER FOUND! COUNTING OTHERS..." : "TIMEOUT! COUNTING ALL...";

    const sorted = React.useMemo(() =>
      players
        .map((p, i) => ({
          player: p,
          score: p.cards.length === 0 ? 0 : calculateScore(p.cards),
          originalIdx: i,
        }))
        .sort((a, b) => a.score - b.score),
      [players]
    );

    const active = players[selectedIdx];
    const activeCounted = progressMap[selectedIdx] || 0;
    
    return (
      <animated.View style={[
        StyleSheet.absoluteFill,
        { zIndex: 20000, opacity: overlay.opacity, transform: [{ scale: overlay.scale }] },
      ]}>
        <ImageBackground
          source={require('../assets/images/whot.png')}
          style={{ flex: 1 }}
          resizeMode="cover"
        >
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,4,14,0.85)' }]} pointerEvents="none" />

          <View style={{ flex: 1, paddingHorizontal: rs(14), paddingTop: rs(16), paddingBottom: rs(14) }}>

            <animated.View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              marginBottom: rs(11),
              opacity: header.opacity,
              transform: [{ translateY: header.translateY }],
            }}>
              <MaterialCommunityIcons name="flag-checkered" size={rs(12)} color="#FFD030" style={{ marginRight: rs(6) }} />
              <Text style={{
                color: '#FFD030', fontSize: rs(11), fontWeight: '900',
                letterSpacing: 2,
                textShadowColor: 'rgba(255,208,48,0.35)', textShadowRadius: 6,
              }}>
                {titleText}
              </Text>
              <MaterialCommunityIcons name="flag-checkered" size={rs(12)} color="#FFD030" style={{ marginLeft: rs(6) }} />
            </animated.View>

            <View style={{ flex: 1, flexDirection: 'row', gap: rs(10) }}>

              <View style={{
                width: rs(136),
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderRadius: rs(13),
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.07)',
                padding: rs(9),
              }}>
                <Text style={{
                  color: 'rgba(255,255,255,0.25)', fontSize: rs(7), fontWeight: '800',
                  letterSpacing: 2, marginBottom: rs(7),
                }}>
                  LEADERBOARD
                </Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {sorted.map(({ player, originalIdx, score }, rank) => (
                    <PlayerRow
                      key={player.name}
                      player={player} 
                      score={runningScores[originalIdx] !== undefined ? runningScores[originalIdx] : score}
                      rank={rank}
                      delay={rank * 65}
                      isSelected={selectedIdx === originalIdx}
                      onPress={() => setSelectedIdx(originalIdx)}
                    />
                  ))}
                </ScrollView>
              </View>

              <View style={{ flex: 1, gap: rs(8) }}>

                <ScrollView
                  horizontal showsHorizontalScrollIndicator={false}
                  style={{ flexGrow: 0 }}
                  contentContainerStyle={{ gap: rs(5), paddingRight: rs(2) }}
                >
                  {players.map((p, i) => {
                    const sel = i === selectedIdx;
                    return (
                      <TouchableOpacity
                        key={p.name} onPress={() => setSelectedIdx(i)} activeOpacity={0.7}
                        style={{
                          flexDirection: 'row', alignItems: 'center',
                          paddingHorizontal: rs(9), paddingVertical: rs(4),
                          borderRadius: rs(18),
                          backgroundColor: sel ? 'rgba(255,208,48,0.14)' : 'rgba(255,255,255,0.05)',
                          borderWidth: 1,
                          borderColor: sel ? '#FFD030' : 'rgba(255,255,255,0.08)',
                        }}
                      >
                        <Image source={p.avatar} style={{
                          width: rs(14), height: rs(14), borderRadius: rs(7), marginRight: rs(4),
                        }} />
                        <Text numberOfLines={1} style={{
                          color: sel ? '#FFD030' : 'rgba(255,255,255,0.4)',
                          fontSize: rs(8.5), fontWeight: '800',
                        }}>
                          {p.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={{
                  flex: 1,
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderRadius: rs(13),
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.07)',
                  padding: rs(10),
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: rs(8) }}>
                    <Image source={active.avatar} style={{
                      width: rs(28), height: rs(28), borderRadius: rs(14),
                      borderWidth: 2, borderColor: '#FFD030', marginRight: rs(8),
                    }} />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{
                        color: '#FFF', fontSize: rs(10), fontWeight: '900', letterSpacing: 0.4,
                      }}>
                        {active.name.toUpperCase()}
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: rs(7.5), fontWeight: '600' }}>
                        {active.cards.length === 0
                          ? 'Cleared all cards'
                          : `Counting ${active.cards.length} cards...`}
                      </Text>
                    </View>
                    <View style={{
                      backgroundColor: 'rgba(255,208,48,0.11)',
                      borderRadius: rs(9), paddingHorizontal: rs(9), paddingVertical: rs(3),
                      alignItems: 'center',
                    }}>
                      <Text style={{ color: '#FFD030', fontSize: rs(18), fontWeight: '900', lineHeight: rs(20) }}>
                        {runningScores[selectedIdx] ?? 0}
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.22)', fontSize: rs(6), fontWeight: '700', letterSpacing: 1.2 }}>
                        PTS
                      </Text>
                    </View>
                  </View>

                  <View style={{ height: 1, backgroundColor: 'rgba(255,208,48,0.1)', marginBottom: rs(8) }} />

                  {active.cards.length === 0 ? (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialCommunityIcons name="trophy" size={rs(30)} color="#FFD030" />
                      <Text style={{ color: '#30D158', fontSize: rs(11), fontWeight: '900', marginTop: rs(6), letterSpacing: 1 }}>
                        WINNER!
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.22)', fontSize: rs(7.5), marginTop: rs(2) }}>
                        Cleared all cards
                      </Text>
                    </View>
                  ) : (
                    <ScrollView showsVerticalScrollIndicator={false}>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: rs(6) }}>
                        {active.cards.map((card, i) => (
                          <CardChip key={i} card={card} isVisible={i < activeCounted} />
                        ))}
                      </View>
                      <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: rs(5) }} />
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                        {active.cards.map((card, i) => (
                          <ScoreTag key={i} card={card} isVisible={i < activeCounted} />
                        ))}
                      </View>
                    </ScrollView>
                  )}
                </View>
              </View>
            </View>

            <View style={{ alignItems: 'center', marginTop: rs(12) }}>
              <animated.View style={{ transform: [{ scale: btnScale.scale }] }}>
                <TouchableOpacity
                  activeOpacity={1}
                  onPressIn={() => setBtnPressed(true)}
                  onPressOut={() => setBtnPressed(false)}
                  onPress={countingFinished ? onNext : onRestart}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: rs(6),
                    backgroundColor: '#FFD030',
                    paddingHorizontal: rs(26),
                    paddingVertical: rs(9),
                    borderRadius: rs(50),
                    shadowColor: '#FFD030',
                    shadowOpacity: 0.28,
                    shadowRadius: rs(10),
                    shadowOffset: { width: 0, height: rs(3) },
                  }}
                >
                  <MaterialCommunityIcons name={countingFinished ? "chevron-right" : "reload"} size={rs(12)} color="#0A0A0A" />
                  <Text style={{
                    color: '#0A0A0A',
                    fontSize: rs(11.5),
                    fontWeight: '900',
                    letterSpacing: 1.8,
                  }}>
                    {countingFinished ? "CONTINUE" : "PLAY AGAIN"}
                  </Text>
                </TouchableOpacity>
              </animated.View>
            </View>

          </View>
        </ImageBackground>
      </animated.View>
    );
  }
);