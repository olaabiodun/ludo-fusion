import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Defs, Path, Stop, LinearGradient as SvgGradient } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GameToken } from './GameToken';
import { BOARD_SIZE, CELL_SIZE, getCellNumber, getCellPos, getCellTopLeft } from './SnakeLadderUtils';

function RollingNumber({ value, color }: { value: number; color: string }) {
  const [displayValue, setDisplayValue] = React.useState(value);

  useEffect(() => {
    if (displayValue !== value) {
      const timer = setInterval(() => {
        setDisplayValue(prev => {
          if (prev < value) return prev + 1;
          if (prev > value) return prev - 1;
          clearInterval(timer);
          return prev;
        });
      }, 150); // Matches the visual hop speed roughly
      return () => clearInterval(timer);
    }
  }, [value]);

  return <Text style={{ color }}>{displayValue}</Text>;
}



const COLORS = {
  grid1: '#FFFFFF',      // White
  grid2: '#A5D6A7',      // Strong Light Green
  border: '#388E3C',     // Dark Green border for high contrast
  numDark: '#002403ff',
  numLight: '#ffffff',
  frameBorder: '#1A3A0A',
  frameInner: '#2E7D32',
  bg: '#1B5E20',
  gold: '#D4A827',
  goldLight: '#FFE57A',
  goldDark: '#7A5500',
  starCell: '#FFF59D',
};

function RankCard({ player, rank, total }: { player: any; rank: number; total: number }) {
  const isFirst = rank === 0;
  const cardHeight = isFirst ? 28 : 22;
  const margin = isFirst ? 8 : 5;
  
  // Calculate vertical position based on rank
  // Rank 0 is at top, but Rank 0 is taller.
  // We'll just use a simple vertical accumulator logic.
  // For simplicity with 4 players: positions are roughly [0, 36, 63, 90]
  const yPos = React.useRef(new Animated.Value(rank * 30)).current;
  const shine = React.useRef(new Animated.Value(0)).current;
  const scale = React.useRef(new Animated.Value(1)).current;
  const prevRank = React.useRef(rank);

  useEffect(() => {
    // Animate to new Y position
    const targetY = rank === 0 ? 0 : 36 + (rank - 1) * 27;
    Animated.spring(yPos, {
      toValue: targetY,
      friction: 7,
      tension: 40,
      useNativeDriver: true,
    }).start();

    // Overtake effect: If rank improved (e.g. 2 -> 1)
    if (rank < prevRank.current) {
      shine.setValue(0);
      scale.setValue(1);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(shine, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.spring(scale, { toValue: 1.12, friction: 3, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(shine, { toValue: 0, duration: 400, useNativeDriver: true }),
          Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
        ]),
      ]).start();
    }
    prevRank.current = rank;
  }, [rank]);

  const ordinals = ['1ST', '2ND', '3RD', '4TH'];
  let rankColors = ['#2b2b2b', '#111111'];
  let strokeColor = '#444';
  let textColor = '#aaa';
  
  if (isFirst) {
    rankColors = ['#FFE57A', '#D4A827', '#7A5500'];
    strokeColor = '#FFF';
    textColor = '#FFF';
  } else if (rank === 1) {
    rankColors = ['#616161', '#424242', '#212121'];
    strokeColor = '#9E9E9E';
    textColor = '#FFF';
  } else if (rank === 2) {
    rankColors = ['#5D4037', '#3E2723', '#1B0000'];
    strokeColor = '#8D6E63';
    textColor = '#FFF';
  }

  return (
    <Animated.View style={[
      s.rankingItem, 
      { 
        position: 'absolute',
        width: '95%',
        height: cardHeight,
        transform: [{ translateY: yPos }, { scale }]
      },
      isFirst && { elevation: 8, shadowColor: COLORS.goldLight, shadowOpacity: 0.9, shadowRadius: 8 }
    ]}>
      <LinearGradient colors={rankColors} style={[StyleSheet.absoluteFill, { borderRadius: 4 }]} start={{x:0, y:0}} end={{x:1, y:1}} />
      <View style={[StyleSheet.absoluteFill, { borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.05)', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }]} />
      <View style={[StyleSheet.absoluteFill, { borderRadius: 4, borderWidth: 1, borderColor: strokeColor, opacity: 0.9 }]} />
      
      {/* Overtake Shine Layer */}
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 4, backgroundColor: '#FFF', opacity: shine.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }) }]} />

      <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6 }}>
        <Text style={[
          s.rankText, 
          { color: textColor, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2, transform: [{ skewX: '6deg' }] },
          isFirst && { fontSize: 11 }
        ]}>
          {ordinals[rank] || `${rank + 1}TH`}
        </Text>
        
        <View style={{ 
          width: isFirst ? 12 : 10, 
          height: isFirst ? 12 : 10, 
          backgroundColor: player.color, 
          borderWidth: 1, 
          borderColor: '#FFF', 
          elevation: 2, 
          transform: [{ skewX: '6deg' }, { rotate: '45deg' }] 
        }} />
        
        <View style={[isFirst && { transform: [{ scale: 1.2 }] }]}>
          <Text style={[
            s.rankPos, 
            { color: textColor, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2, transform: [{ skewX: '6deg' }] }
          ]}>
            <RollingNumber value={player.position} color={textColor} />
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

export const BOARD_LADDERS = [
  { start: 1, end: 38, zIndex: 20 },
  { start: 4, end: 14 },
  { start: 9, end: 31 },
  { start: 21, end: 42, zIndex: 20 },
  { start: 28, end: 84 },
  { start: 51, end: 67 },
  { start: 80, end: 99 },
  { start: 72, end: 91 },
];

export const BOARD_SNAKES = [
  { start: 87, end: 36, image: require('../assets/images/sk2.png'), rotate: -116 },
  { start: 62, end: 18, image: require('../assets/images/sk2.png'), flipped: true, rotate: -66 },
  { start: 17, end: 7, image: require('../assets/images/sk4.png'), rotate: -10, widthMultiplier: 4.3, offsetY: -7 },
  { start: 95, end: 75, image: require('../assets/images/sk5.png'), rotate: -120, widthMultiplier: 5.3, offsetY: -7, offsetX: -9, },
  { start: 98, end: 79, image: require('../assets/images/sk1.png'), rotate: -150, widthMultiplier: 3.3, offsetY: -7, offsetX: 1, },
  { start: 64, end: 60, image: require('../assets/images/sk4.png'), rotate: 15, widthMultiplier: 4.3, offsetY: -7, flippedY: true, zIndex: 5 },
  { start: 93, end: 73, image: require('../assets/images/sk6.png'), widthMultiplier: 1.8, lengthExtra: 40, rotate: -90 },
  { start: 54, end: 34, image: require('../assets/images/sk6.png'), widthMultiplier: 1.8, lengthExtra: 40, rotate: -90 }
];

const SnakeImage = ({ start, end, image, flipped, flippedY, rotate, widthMultiplier, offsetX, offsetY, zIndex, lengthExtra }: any) => {
  const p1 = getCellPos(start);
  const p2 = getCellPos(end);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  const snakeWidth = CELL_SIZE * (widthMultiplier ?? 15);
  const snakeLength = distance + (lengthExtra ?? 20);

  return (
    <View style={{
      position: 'absolute',
      left: midX - snakeWidth / 2 + (offsetX ?? 0),
      top: midY - snakeLength / 2 + (offsetY ?? 0),
      width: snakeWidth,
      height: snakeLength,
      transform: [
        { rotate: `${angle + (rotate ?? -116)}deg` },
        ...(flipped ? [{ scaleX: -1 }] : []),
        ...(flippedY ? [{ scaleY: -1 }] : []),
      ],
      zIndex: zIndex ?? 10,
      pointerEvents: 'none',
    }}>
      <Image source={image} style={{ width: '100%', height: '100%' }} contentFit="contain" />
    </View>
  );
};

function getCellBg(row: number, col: number, num: number): string {
  if (num === 100) return COLORS.starCell;
  const colors = [COLORS.grid1, COLORS.grid2]; 
  return colors[(row + col) % colors.length];
}

const BoardGrid = React.memo(() => (
  <View style={StyleSheet.absoluteFill}>
    {Array.from({ length: 10 }, (_, row) => (
      <View key={row} style={s.row}>
        {Array.from({ length: 10 }, (_, col) => {
          const num = getCellNumber(row, col);
          const isHundred = num === 100;
          return (
            <View key={col} style={[s.cell, { width: CELL_SIZE, height: CELL_SIZE, backgroundColor: getCellBg(row, col, num), borderRightWidth: col < 9 ? 1 : 0, borderBottomWidth: row < 9 ? 1 : 0 }]}>
              {isHundred ? (
                <View style={s.starCell}>
                  <Text style={s.starEmoji}>🏆</Text>
                  <Text style={[s.cellNum, { color: COLORS.numDark, fontSize: CELL_SIZE * 0.28 }]}>100</Text>
                </View>
              ) : (
                <Text style={[s.cellNum, { color: COLORS.numDark, fontSize: num >= 100 ? CELL_SIZE * 0.35 : CELL_SIZE * 0.32 }]} numberOfLines={1} adjustsFontSizeToFit>{num}</Text>
              )}
            </View>
          );
        })}
      </View>
    ))}
  </View>
));

const CombinedLadders = React.memo(() => (
  <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none', zIndex: 5 }]}>
    <Svg width={BOARD_SIZE} height={BOARD_SIZE} viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`}>
      <Defs>
        <SvgGradient id="ladderGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#5D4037" /><Stop offset="50%" stopColor="#8D6E63" /><Stop offset="100%" stopColor="#5D4037" />
        </SvgGradient>
      </Defs>
      {BOARD_LADDERS.map((l, i) => {
        const p1 = getCellPos(l.start);
        const p2 = getCellPos(l.end);
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.floor(distance / 20);
        const railOffset = 8;
        const angle = Math.atan2(dy, dx);
        const ox = Math.sin(angle) * railOffset;
        const oy = -Math.cos(angle) * railOffset;

        return (
          <React.Fragment key={`l-${i}`}>
            <Path d={`M ${p1.x - ox} ${p1.y - oy} L ${p2.x - ox} ${p2.y - oy}`} stroke="url(#ladderGrad)" strokeWidth="4" strokeLinecap="round" />
            <Path d={`M ${p1.x + ox} ${p1.y + oy} L ${p2.x + ox} ${p2.y + oy}`} stroke="url(#ladderGrad)" strokeWidth="4" strokeLinecap="round" />
            {Array.from({ length: steps - 1 }).map((_, stepIdx) => {
              const t = (stepIdx + 1) / steps;
              const rx = p1.x + dx * t;
              const ry = p1.y + dy * t;
              return <Path key={stepIdx} d={`M ${rx - ox} ${ry - oy} L ${rx + ox} ${ry + oy}`} stroke="#5D4037" strokeWidth="3" strokeLinecap="round" />;
            })}
          </React.Fragment>
        );
      })}
    </Svg>
  </View>
));



// Offsets for when multiple tokens share a cell (2x2 mini-grid)
const CELL_SHARE_OFFSETS: Record<number, { dx: number; dy: number }[]> = {
  1: [{ dx: 0, dy: 0 }],
  2: [
    { dx: -CELL_SIZE * 0.22, dy: 0 },
    { dx: CELL_SIZE * 0.22, dy: 0 },
  ],
  3: [
    { dx: -CELL_SIZE * 0.26, dy: -CELL_SIZE * 0.14 },
    { dx: CELL_SIZE * 0.22, dy: -CELL_SIZE * 0.14 },
    { dx: 0, dy: CELL_SIZE * 0.18 },
  ],
  4: [
    { dx: -CELL_SIZE * 0.22, dy: -CELL_SIZE * 0.18 },
    { dx: CELL_SIZE * 0.22, dy: -CELL_SIZE * 0.18 },
    { dx: -CELL_SIZE * 0.22, dy: CELL_SIZE * 0.18 },
    { dx: CELL_SIZE * 0.22, dy: CELL_SIZE * 0.18 },
  ],
};

export function SnakeLadderBoard({ engine }: { engine?: any }) {
  const players = engine?.players ?? [];
  const turnIndex = engine?.turnIndex ?? -1;
  const diceValue: number = engine?.diceValue ?? 0;

  // ── Top-2-row Illumination Animations ──
  const glowPulse = useRef(new Animated.Value(0.55)).current;
  const shimmerX = useRef(new Animated.Value(-BOARD_SIZE)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Breathing glow for top zone
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 0.92, duration: 1100, easing: Easing.out(Easing.sin), useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0.45, duration: 1300, easing: Easing.in(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    // Light sweep
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerX, { toValue: BOARD_SIZE * 1.2, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(800),
        Animated.timing(shimmerX, { toValue: -BOARD_SIZE, duration: 0, useNativeDriver: true }),
      ])
    ).start();

    // Floating animation for ranking container
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -6, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);



  return (
    <View style={s.root}>
      <View style={[s.goldFrame, { width: BOARD_SIZE + 28, height: BOARD_SIZE + 28 }]}>
        <LinearGradient colors={[COLORS.goldLight, COLORS.gold, COLORS.goldDark, COLORS.gold]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={[s.outerFrame, { width: BOARD_SIZE + 16, height: BOARD_SIZE + 16 }]}>
          <View style={[s.board, { width: BOARD_SIZE, height: BOARD_SIZE }]}>

            {/* 1. Grid Background (Memoized) */}
            <BoardGrid />

            {/* 2. Ladders (Combined into one SVG for performance) */}
            <CombinedLadders />

            {/* 2b. Snakes Layer */}
            {BOARD_SNAKES.map((snake, i) => (
              <SnakeImage key={`s-${i}`} {...snake} />
            ))}

             {/* 3. Golden Start Container */}
            <View style={[s.startContainer, { 
              left: -CELL_SIZE * 2, 
              top: BOARD_SIZE - CELL_SIZE * 1.45,
              width: CELL_SIZE * 1.7,
              height: CELL_SIZE * 1.7
            }]}>
              <LinearGradient colors={[COLORS.goldLight, COLORS.gold, COLORS.goldDark]} style={StyleSheet.absoluteFill} />
              <View style={s.startContainerInner}>
              </View>
            </View>

            {/* 3b. Golden Rankings Container (Live Leaderboard) */}
            {/* 3b. Ultra-Premium Rankings Container (Live Leaderboard) */}
            <Animated.View style={[s.rankingsContainer, {
              right: -CELL_SIZE * 2.55,
              top: CELL_SIZE * 1.4,
              width: CELL_SIZE * 1.8,
              height: BOARD_SIZE - CELL_SIZE * 3.0,
              transform: [{ translateY: floatAnim }, { skewX: '-6deg' }]
            }]}>
              {/* Aggressive but Golden Glass Base */}
              <LinearGradient colors={['rgba(35, 25, 5, 0.85)', 'rgba(10, 5, 0, 0.95)']} style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFill, { borderRadius: 8, borderWidth: 1.5, borderColor: 'rgba(212, 168, 39, 0.6)' }]} />
              <View style={[StyleSheet.absoluteFill, { borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', margin: 1 }]} />

              {/* Combat Header - Gold */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 8, gap: 4 }}>
                <MaterialCommunityIcons name="sword-cross" size={12} color={COLORS.goldLight} />
                <Text style={{ fontSize: 9, fontFamily: 'Kanit_900Black', color: COLORS.goldLight, textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2, letterSpacing: 1.2 }}>RANKS</Text>
              </View>

              <View style={{ width: '100%', flex: 1, marginTop: 4 }}>
                {(() => {
                  const sorted = [...players].sort((a, b) => b.position - a.position);
                  const rankMap = sorted.reduce((acc, p, i) => { acc[p.id] = i; return acc; }, {} as Record<string, number>);
                  return players.map((p: any) => (
                    <RankCard key={p.id} player={p} rank={rankMap[p.id]} total={players.length} />
                  ));
                })()}
              </View>
            </Animated.View>

            {/* 4. Players Layer (Animated) */}
            <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]} pointerEvents="none">
              {(() => {
                // Group players by current position to calculate share offsets
                const posGroups: Record<number, string[]> = {};
                players.forEach((p: any) => {
                  const pos = p.position;
                  if (!posGroups[pos]) posGroups[pos] = [];
                  posGroups[pos].push(p.id);
                });

                return players.map((p: any, i: number) => {
                  const isActive = turnIndex === i;
                  const isOnBoard = p.position > 0;

                  // Calculate same-cell offset
                  const cellMates = posGroups[p.position] || [p.id];
                  const myIndex = cellMates.indexOf(p.id);
                  const count = Math.min(cellMates.length, 4) as 1 | 2 | 3 | 4;
                  const offsets = CELL_SHARE_OFFSETS[count] || CELL_SHARE_OFFSETS[4];
                  const offset = offsets[myIndex] || { dx: 0, dy: 0 };

                  return (
                    <View
                      key={p.id}
                      style={{
                        position: 'absolute',
                        width: CELL_SIZE,
                        height: CELL_SIZE,
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: isActive ? 110 + i : 100 + i,
                        pointerEvents: 'none',
                      }}
                    >
                      <GameToken 
                        id={p.id}
                        color={p.color} 
                        isActive={isActive} 
                        isOnBoard={isOnBoard} 
                        cellSize={CELL_SIZE} 
                        position={p.position}
                        offset={offset}
                      />
                    </View>
                  );
                });
              })()}
            </View>

          </View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldFrame: {
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20,
  },
  outerFrame: {
    backgroundColor: COLORS.frameBorder,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 12,
  },
  board: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    flexDirection: 'column',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: COLORS.border,
    position: 'relative',
    overflow: 'hidden',
  },
  cellNum: {
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
    fontFamily: 'Kanit_900Black',
  },
  starCell: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  starEmoji: {
    fontSize: CELL_SIZE * 0.48,
    lineHeight: CELL_SIZE * 0.52,
  },
  startContainer: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.frameBorder,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  startContainerInner: {
    width: '90%',
    height: '90%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#3E2723',
    letterSpacing: 0.5,
    opacity: 0.8,
  },
  rankingsContainer: {
    position: 'absolute',
    borderRadius: 8,
    overflow: 'hidden',
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
    elevation: 8,
  },
  rankingItem: {
    width: '95%',
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  rankText: {
    fontSize: 9,
    fontFamily: 'Kanit_900Black',
    letterSpacing: 0.5,
  },
  rankPos: {
    fontSize: 10,
    fontFamily: 'Kanit_900Black',
  },
});