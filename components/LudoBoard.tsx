import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  Polygon,
  RadialGradient,
  Stop,
  LinearGradient as SvgGrad,
} from 'react-native-svg';
import { BC, getCellPosition, getPerimeterIndex } from '../engine/LudoPath';
import { PawnState, useLudoEngine } from '../engine/useLudoEngine';
import { playDiceRollSound, playMoveSound, playTokenFinishSound, playLudoCaptureSound } from '../lib/sounds';
import { ActionPopup } from './ActionPopup';
import Dice3D from './Dice3D';
import { getSeatForColor } from './LudoGameUI';
import { Seat } from './WhotUtils';

// ─── Responsive sizing ────────────────────────────────────────────────────────
//
// Strategy: measure the *available* vertical space after subtracting all
// chrome, then fit the board into the smaller of that or the screen width.
//
// UI chrome heights (approximate, platform-adjusted):
//   Top bar (glassPill row)    ≈ 48 dp
//   Player chip top row        ≈ 72 dp  (chip height ~60 + 12 gap)
//   Player chip bottom row     ≈ 72 dp
//   Bottom action row          ≈ 50 dp
//   Safe-area top/bottom       dynamic (via useSafeAreaInsets)
//   Vertical breathing room    ≈ 24 dp  (12 above + 12 below board)
//
// Total fixed chrome (excluding safe area): 48 + 72 + 72 + 50 + 24 = 266 dp
//
// We compute this once at module level using Dimensions (safe areas are 0
// here, they get applied again at render time via the hook). The hook result
// is used to clamp the final value; this avoids re-running heavy layout on
// every render.

const FIXED_CHROME_HEIGHT = 148; // dp — reduced further to maximize board size
const { width: SW, height: SH } = Dimensions.get('window');

// Minimum tap-target: 44 dp per Apple HIG / Material guidelines.
// Each cell = U dp. We want U ≥ 20 dp so a cluster of 2 pawns is still
// tappable. At 15 cells across (0–14), U_min ≈ 20 gives BOARD_SIZE_MIN ≈ 284.
const BOARD_SIZE_MIN = 338;
const BOARD_SIZE_MAX = 1200; // Signifantly increased to support tablets and large displays

/**
 * Compute the board pixel size given the available window dimensions and
 * (optionally) safe-area insets. Pass 0 for insets when calling at module
 * level; pass real values inside a component for the final clamped size.
 */
export function computeBoardSize(
  windowWidth: number,
  windowHeight: number,
  safeTop = 0,
  safeBottom = 0,
): number {
  const availableHeight = windowHeight - FIXED_CHROME_HEIGHT - safeTop - safeBottom;
  // Use the smaller of available height and available width so the board
  // never overflows horizontally either.
  const raw = Math.min(availableHeight, windowWidth); // 0 margin to maximize size
  return Math.round(Math.min(Math.max(raw, BOARD_SIZE_MIN), BOARD_SIZE_MAX));
}

// Module-level fallback (no safe area). Components should call
// computeBoardSize() again with real insets.
const BOARD_SIZE_FALLBACK = computeBoardSize(SW, SH);

// ─── Scale helper ─────────────────────────────────────────────────────────────
// Instead of a fixed 400 base, scale against the actual board size so strokes,
// icon sizes, and border radii grow/shrink proportionally on every device.
function makeSc(boardSize: number) {
  return (v: number) => Math.round((boardSize / 452) * v);
}

// ─── colours ─────────────────────────────────────────────────────────────────
const C = {
  emerald: '#00C853',
  emeraldMid: '#009624',
  emeraldDark: '#004D18',
  emeraldDeep: '#002E0D',

  amber: '#FFD600',
  amberMid: '#F9A800',
  amberDark: '#B36A00',
  amberDeep: '#6B3F00',

  sapphire: '#1565C0',
  sapphireMid: '#0D47A1',
  sapphireDark: '#072D6B',
  sapphireDeep: '#021540',

  ruby: '#C62828',
  rubyMid: '#B71C1C',
  rubyDark: '#7B0D0D',
  rubyDeep: '#3E0505',

  ivory: '#FFFDF0',
  ivoryMid: '#F0E6C8',
  ivoryDark: '#D8C898',

  gold: '#D4A827',
  goldLight: '#FFE57A',
  goldDark: '#7A5500',
  mahogany: '#3B1007',
  mahoganyMid: '#5C1A0A',
  onyx: '#0A0A0A',

  line: 'rgba(0,0,0,0.55)',
  starGold: '#000000ff',
};

// ─── palette map ─────────────────────────────────────────────────────────────
type Dir = 'up' | 'right' | 'down' | 'left';

const pal: Record<BC, [string, string, string, string, string]> = {
  green: [C.emerald, C.emeraldMid, C.emeraldDark, C.emeraldDeep, '#a1ddbaff'],
  yellow: [C.amber, C.amberMid, C.amberDark, C.amberDeep, '#e2d06aff'],
  blue: [C.sapphire, C.sapphireMid, C.sapphireDark, C.sapphireDeep, '#7fb2e7ff'],
  red: [C.ruby, C.rubyMid, C.rubyDark, C.rubyDeep, '#f07b7bff'],
};

const arrowCol: Record<Dir, string> = {
  right: C.emerald,
  left: C.ruby,
  down: C.amberDark,
  up: C.sapphire,
};

// ─── cell spec ───────────────────────────────────────────────────────────────
type CellSpec = { col: number; row: number; color?: BC; star?: boolean; arrow?: Dir };

function range(a: number, b: number) {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}
function cell(col: number, row: number, color?: BC, star = false, arrow?: Dir): CellSpec {
  return { col, row, color, star, arrow };
}

const CELLS: CellSpec[] = [
  ...range(0, 5).flatMap(col => [
    cell(col, 6, col === 1 ? 'green' : undefined),
    cell(col, 7, col === 0 ? undefined : 'green', false, col === 0 ? 'right' : undefined),
    cell(col, 8, undefined, col === 2),
  ]),
  ...range(9, 14).flatMap(col => [
    cell(col, 6, undefined, col === 12),
    cell(col, 7, col === 14 ? undefined : 'red', false, col === 14 ? 'left' : undefined),
    cell(col, 8, col === 13 ? 'red' : undefined),
  ]),
  ...range(0, 5).flatMap(row => [
    cell(6, row, undefined, row === 2),
    cell(7, row, row === 0 ? undefined : 'yellow', false, row === 0 ? 'down' : undefined),
    cell(8, row, row === 1 ? 'yellow' : undefined),
  ]),
  ...range(9, 14).flatMap(row => [
    cell(6, row, row === 13 ? 'blue' : undefined),
    cell(7, row, row === 14 ? undefined : 'blue', false, row === 14 ? 'up' : undefined),
    cell(8, row, undefined, row === 12),
  ]),
];

// ─── 3-D Pawn ────────────────────────────────────────────────────────────────
function Pawn({ color, isKicked }: { color: BC; isKicked?: boolean }) {
  const tokenImages = {
    green: require('../assets/images/tokeng.png'),
    yellow: require('../assets/images/tokeny.png'),
    blue: require('../assets/images/tokenb.png'),
    red: require('../assets/images/tokenr.png'),
  };
  return (
    <View style={pawnSt.pawn}>
      <Image source={tokenImages[color]} style={[pawnSt.image, isKicked && { opacity: 0.3, tintColor: '#888' }]} contentFit="contain" />
    </View>
  );
}
const pawnSt = StyleSheet.create({
  pawn: { width: '115%', height: '115%', alignItems: 'center', justifyContent: 'center' },
  image: { width: '95%', height: '95%' },
});

// ─── Engine Pawn ─────────────────────────────────────────────────────────────
function EnginePawn({
  pawn,
  onPress,
  isActiveTurn,
  hasRolled,
  pawnRotation,
  localColor,
  offsetX = 0,
  offsetY = 0,
  clusterCount = 0,
  clusterIdx = 0,
  U,
  TOTAL,
  diceValue,
  action,
  isKicked,
  onCaptureComplete,
}: {
  pawn: PawnState;
  onPress: (id: string) => void;
  isActiveTurn: boolean;
  hasRolled: boolean;
  pawnRotation: string;
  localColor: BC;
  offsetX?: number;
  offsetY?: number;
  clusterCount?: number;
  clusterIdx?: number;
  U: number;
  TOTAL: number;
  diceValue: number | null;
  action: any;
  isKicked?: boolean;
  onCaptureComplete?: (capturedPawnId: string) => void;
}) {
  const getAbsoluteCoords = (pos: { c: number; r: number }) => ({
    x: pos.c * U + offsetX,
    y: pos.r * U + offsetY,
  });

  const initialPos = getAbsoluteCoords(
    getCellPosition(pawn.color, pawn.state, pawn.pathIndex, pawn.index),
  );
  const pan = useRef(new Animated.ValueXY(initialPos)).current;
  const scale = useRef(
    new Animated.Value(
      pawn.state === 'finished' ? 0.1
        : (clusterCount || 0) >= 2 ? 0.9
          : pawn.state === 'home' ? 1.6
            : 1.2,
    ),
  ).current;
  const opacity = useRef(new Animated.Value(pawn.state === 'finished' ? 0 : 1)).current;
  const onCaptureCompleteRef = useRef<((id: string) => void) | undefined>(undefined);
  onCaptureCompleteRef.current = onCaptureComplete;
  const prevPawnRef = useRef(pawn);

  // Position & scale on cluster/offset changes
  useEffect(() => {
    // Skip spring for transitions where effect 2 starts immediately (no long delay).
    // Home→board has a 1200ms delay in effect 2, so spring right away for responsiveness.
    if (prevPawnRef.current.state !== pawn.state) {
      if (!(prevPawnRef.current.state === 'home' && pawn.state === 'board')) return;
    }
    const targetPos = getAbsoluteCoords(
      getCellPosition(pawn.color, pawn.state, pawn.pathIndex, pawn.index),
    );
    Animated.parallel([
      Animated.spring(pan, { toValue: targetPos, damping: 18, stiffness: 120, useNativeDriver: true }),
      Animated.spring(scale, {
        toValue: pawn.state === 'finished' ? 0.2
          : (clusterCount || 0) >= 2 ? 0.9
            : pawn.state === 'home' ? 1.6
              : 1.15,
        damping: 15,
        useNativeDriver: true,
      }),
    ]).start();
  }, [offsetX, offsetY, clusterCount, pawn.state, pawn.pathIndex]);

  // State-transition animations
  useEffect(() => {
    const prev = prevPawnRef.current;

    const sMult = (clusterCount || 0) >= 2 ? 0.76 : 1;

    const capturingPawnId = (pawn.state === 'finished' && pawn.captureCell !== undefined && action?.msg === 'capture')
      ? action.capturedPawnId
      : undefined;

    if (pawn.pathIndex !== prev.pathIndex && pawn.state === 'board' && prev.state === 'board') {
      const path: { x: number; y: number }[] = [];
      for (let i = prev.pathIndex + 1; i <= pawn.pathIndex; i++) {
        path.push(getAbsoluteCoords(getCellPosition(pawn.color, 'board', i, pawn.index)));
      }

      const animateStep = (idx: number) => {
        if (idx >= path.length) {
          Animated.spring(scale, { toValue: (clusterCount || 0) >= 2 ? 0.9 : 1.15, damping: 15, useNativeDriver: true }).start();
          return;
        }
        playMoveSound();
        const isLast = idx === path.length - 1;
        const dur = isLast ? 140 : 70;
        Animated.parallel([
          Animated.timing(pan, { toValue: path[idx], duration: dur, easing: Easing.linear, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(scale, { toValue: (isLast ? 1.6 : 1.3) * sMult, duration: dur / 2, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(scale, { toValue: (isLast ? 1.4 : 1.1) * sMult, duration: dur / 2, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          ]),
        ]).start(() => animateStep(idx + 1));
      };
      animateStep(0);
    } else if (pawn.state === 'board' && prev.state === 'home') {
      const path: { x: number; y: number }[] = [];
      for (let i = 0; i <= pawn.pathIndex; i++) {
        path.push(getAbsoluteCoords(getCellPosition(pawn.color, 'board', i, pawn.index)));
      }

      const animateStep = (idx: number) => {
        if (idx >= path.length) {
          Animated.spring(scale, { toValue: (clusterCount || 0) >= 2 ? 0.9 : 1.15, damping: 15, useNativeDriver: true }).start();
          return;
        }
        playMoveSound();
        const isLast = idx === path.length - 1;
        const dur = isLast ? 140 : 70;
        Animated.parallel([
          Animated.timing(pan, { toValue: path[idx], duration: dur, easing: Easing.linear, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(scale, { toValue: (isLast ? 1.6 : 1.3) * sMult, duration: dur / 2, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(scale, { toValue: (isLast ? 1.4 : 1.1) * sMult, duration: dur / 2, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          ]),
        ]).start(() => animateStep(idx + 1));
      };
      animateStep(0);
    } else if (pawn.state === 'finished' && prev.state !== 'finished') {
      const path: { x: number; y: number }[] = [];
      const targetPathIndex = pawn.captureCell !== undefined ? pawn.captureCell : 56;

      if (prev.state === 'home') {
        for (let i = 0; i <= targetPathIndex; i++) {
          path.push(getAbsoluteCoords(getCellPosition(pawn.color, 'board', i, pawn.index)));
        }
      } else {
        for (let i = prev.pathIndex + 1; i <= targetPathIndex; i++) {
          path.push(getAbsoluteCoords(getCellPosition(pawn.color, 'board', i, pawn.index)));
        }
      }

      const flightTarget = {
        green: { x: -U * 3.5, y: -U * 3.5 },
        yellow: { x: TOTAL + U * 1.5, y: -U * 3.5 },
        blue: { x: -U * 3.5, y: TOTAL + U * 2.5 },
        red: { x: TOTAL + U * 1.5, y: TOTAL + U * 2.5 },
      }[pawn.color as BC] ?? { x: TOTAL / 2, y: TOTAL / 2 };

      const victoryJump = Animated.parallel([
        Animated.timing(pan, {
          toValue: flightTarget,
          duration: 1000,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(scale, { toValue: 5, duration: 450, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(scale, { toValue: 0.1, duration: 550, easing: Easing.in(Easing.quad), useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 550, useNativeDriver: true }),
          ]),
        ]),
      ]);

      const animateStep = (idx: number) => {
        if (idx >= path.length) {
          playTokenFinishSound();
          if (capturingPawnId) {
            playLudoCaptureSound();
          }
          const capturedId = capturingPawnId;
          if (capturedId && onCaptureCompleteRef.current) {
            onCaptureCompleteRef.current(capturedId);
          }
          victoryJump.start();
          return;
        }
        playMoveSound();
        const isLast = idx === path.length - 1;
        const dur = isLast ? 140 : 70;
        Animated.parallel([
          Animated.timing(pan, { toValue: path[idx], duration: dur, easing: Easing.linear, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(scale, { toValue: 1.25 * sMult, duration: dur / 2, useNativeDriver: true }),
            Animated.timing(scale, { toValue: 1.05 * sMult, duration: dur / 2, useNativeDriver: true }),
          ]),
        ]).start(() => animateStep(idx + 1));
      };
      animateStep(0);
    } else if (pawn.state === 'home' && prev.state === 'board') {
      const path: { x: number; y: number }[] = [];
      for (let i = prev.pathIndex; i >= 0; i--) {
        path.push(getAbsoluteCoords(getCellPosition(pawn.color, 'board', i, pawn.index)));
      }
      path.push(getAbsoluteCoords(getCellPosition(pawn.color, 'home', 0, pawn.index)));

      const animateStep = (idx: number) => {
          if (idx >= path.length) {
            Animated.spring(scale, { toValue: 1.6, damping: 15, useNativeDriver: true }).start();
            return;
          }
          const isLast = idx === path.length - 1;
          const dur = isLast ? 150 : 70;
          Animated.timing(pan, { toValue: path[idx], duration: dur, easing: Easing.linear, useNativeDriver: true })
            .start(() => animateStep(idx + 1));
        };
        animateStep(0);
    } else if (pawn.state === 'finished' || prev.state === 'finished' || pawn.state !== prev.state) {
      // Catch-all: snap to correct position for unhandled transitions
      // (e.g. finished→home on rematch, board→home via skip, etc.)
      const target = getAbsoluteCoords(
        getCellPosition(pawn.color, pawn.state, pawn.pathIndex, pawn.index),
      );
      pan.setValue({ x: target.x, y: target.y });
      scale.setValue(
        pawn.state === 'finished' ? 0.2
          : (clusterCount || 0) >= 2 ? 0.9
            : pawn.state === 'home' ? 1.6
              : 1.15,
      );
    }

    prevPawnRef.current = pawn;
  }, [pawn.state, pawn.pathIndex]);

  const isClickable = isActiveTurn && hasRolled && pawn.color === localColor;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: U,
        height: U,
        transform: [...pan.getTranslateTransform(), { scale }],
        zIndex: pawn.state === 'finished' ? 50 : 20 + (clusterIdx ?? 0),
        opacity,
      }}
    >
      <TouchableOpacity
        activeOpacity={isClickable ? 0.7 : 1}
        onPress={() => isClickable && onPress(pawn.id)}
        style={{
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate: pawnRotation }],
        }}
      >
        <Pawn color={pawn.color} isKicked={isKicked} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Base quadrant ───────────────────────────────────────────────────────────
function Base({
  color, col, row, BASE, sc,
}: {
  color: BC; col: number; row: number; BASE: number; sc: (v: number) => number;
}) {
  const [hi, mid, dark, deep] = pal[color];
  return (
    <View
      style={[baseSt.base, {
        left: col, top: row, width: BASE, height: BASE,
        borderRadius: sc(10),
      }]}
      pointerEvents="none"
    >
      <LinearGradient colors={[hi, mid, dark, deep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={baseSt.sweep} />
      <View style={[baseSt.cornerDeco, { borderColor: `${hi}55`, borderRadius: sc(12) }]} />
      <View style={[baseSt.whiteRing, { borderRadius: sc(14) }]}>
        <LinearGradient colors={[C.ivory, C.ivoryMid]} style={[StyleSheet.absoluteFill, { borderRadius: sc(14) }]} />
        <View style={[baseSt.pad, { borderColor: dark, backgroundColor: pal[color][4], borderRadius: sc(10), borderWidth: sc(1.5) }]}>
          <View style={[baseSt.padShine, { borderRadius: sc(10) }]} />
        </View>
      </View>
      <Text style={[baseSt.label, { color: `${hi}AA`, fontSize: sc(11) }]}>
        {color === 'green' ? 'G' : color === 'yellow' ? 'Y' : color === 'blue' ? 'B' : 'R'}
      </Text>
    </View>
  );
}
const baseSt = StyleSheet.create({
  base: { position: 'absolute', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.6)', zIndex: 3 },
  sweep: { position: 'absolute', left: '-35%', top: '-40%', width: '80%', height: '180%', borderRadius: 999, backgroundColor: 'rgba(248,248,248,0.07)', transform: [{ rotate: '-20deg' }] },
  cornerDeco: { position: 'absolute', top: '6%', left: '6%', right: '6%', bottom: '6%', borderWidth: 1 },
  whiteRing: { position: 'absolute', left: '13%', right: '13%', top: '13%', bottom: '13%', overflow: 'visible', padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 6, elevation: 10 },
  pad: { flex: 1, overflow: 'visible' },
  padShine: { ...StyleSheet.absoluteFillObject, borderTopWidth: 2, borderLeftWidth: 2, borderTopColor: 'rgba(255,255,255,0.2)', borderLeftColor: 'rgba(255,255,255,0.12)' },
  label: { position: 'absolute', bottom: 3, right: 5, fontWeight: '900', letterSpacing: 0.5, opacity: 0.5 },
});

// ─── Path cell ───────────────────────────────────────────────────────────────
function BoardCell({ spec, U, sc }: { spec: CellSpec; U: number; sc: (v: number) => number }) {
  const colors = spec.color ? pal[spec.color] : null;
  return (
    <View style={[cellSt.cell, { left: spec.col * U, top: spec.row * U, width: U, height: U }]}>
      {colors
        ? <LinearGradient colors={[colors[0], colors[1], colors[2]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        : <LinearGradient colors={[C.ivory, '#FFFEF5', C.ivoryMid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      }
      <View style={cellSt.gloss} />
      {spec.star && (
        <MaterialCommunityIcons name="star-four-points" size={sc(20)} color={C.starGold} style={[cellSt.icon, { opacity: 0.3 }]} />
      )}
      {spec.arrow && !spec.star && (
        <MaterialCommunityIcons
          name={`arrow-${spec.arrow}-bold` as any}
          size={sc(17)}
          color={spec.color ? '#fff' : arrowCol[spec.arrow]}
          style={cellSt.icon}
        />
      )}
    </View>
  );
}
const cellSt = StyleSheet.create({
  cell: { position: 'absolute', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.35)', zIndex: 2 },
  gloss: { ...StyleSheet.absoluteFillObject, borderTopWidth: 1, borderLeftWidth: 1, borderTopColor: 'rgba(255,255,255,0.6)', borderLeftColor: 'rgba(255,255,255,0.3)' },
  icon: { textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
});

// ─── Centre star ─────────────────────────────────────────────────────────────
function Center({ U, sc }: { U: number; sc: (v: number) => number }) {
  const CTR = U * 3;
  return (
    <View style={[ctrSt.center, { left: U * 6, top: U * 6, width: CTR, height: CTR, borderRadius: sc(12) }]} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Defs>
          <SvgGrad id="g" x1="0" y1="0" x2="0.7" y2="0.7"><Stop offset="0" stopColor={C.emerald} /><Stop offset="1" stopColor={C.emeraldDark} /></SvgGrad>
          <SvgGrad id="y" x1="0" y1="0" x2="0.7" y2="0.7"><Stop offset="0" stopColor={C.amber} /><Stop offset="1" stopColor={C.amberDark} /></SvgGrad>
          <SvgGrad id="r" x1="0" y1="0" x2="0.7" y2="0.7"><Stop offset="0" stopColor={C.ruby} /><Stop offset="1" stopColor={C.rubyDark} /></SvgGrad>
          <SvgGrad id="b" x1="0" y1="0" x2="0.7" y2="0.7"><Stop offset="0" stopColor={C.sapphire} /><Stop offset="1" stopColor={C.sapphireDark} /></SvgGrad>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFD700" stopOpacity="0.9" />
            <Stop offset="60%" stopColor="#D4A827" stopOpacity="0.5" />
            <Stop offset="100%" stopColor="#000" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Polygon points="0,0 50,50 0,100" fill="url(#g)" />
        <Polygon points="0,0 50,50 100,0" fill="url(#y)" />
        <Polygon points="100,0 50,50 100,100" fill="url(#r)" />
        <Polygon points="0,100 50,50 100,100" fill="url(#b)" />
        <Polygon points="0,0 50,50 0,100" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="0.6" />
        <Polygon points="0,0 50,50 100,0" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="0.6" />
        <Polygon points="100,0 50,50 100,100" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="0.6" />
        <Polygon points="0,100 50,50 100,100" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="0.6" />
        <Circle cx="50" cy="50" r="22" fill="url(#glow)" />
        <Circle cx="50" cy="50" r="15" fill="none" stroke={C.gold} strokeWidth="2" opacity="0.85" />
        <Circle cx="50" cy="50" r="6" fill={C.goldLight} opacity="0.9" />
      </Svg>
    </View>
  );
}
const ctrSt = StyleSheet.create({
  center: { position: 'absolute', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.5)', zIndex: 5 },
});

// ─── Board ───────────────────────────────────────────────────────────────────
export function LudoBoard({
  engine,
  localColor = 'green',
  isAiEnabled = true,
  onDiceReady,
  isDiceRolling,
  hidePopups,
  isCountdownActive = false,
}: {
  engine: ReturnType<typeof useLudoEngine>;
  localColor?: BC;
  isAiEnabled?: boolean;
  onDiceReady?: () => void;
  isDiceRolling?: boolean;
  hidePopups?: boolean;
  isCountdownActive?: boolean;
}) {
  // ── Responsive sizes ───────────────────────────────────────────────────────
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = Dimensions.get('window');
  const BOARD_SIZE = computeBoardSize(winW, winH, insets.top, insets.bottom);

  // All derived values recalculated from BOARD_SIZE so they're always in sync
  const U = BOARD_SIZE / 14.2;   // 1 cell unit
  const BASE = U * 6;              // corner quadrant size
  const CTR = U * 3;             // centre diamond size
  const sc = makeSc(BOARD_SIZE);  // proportional scale helper

  // Frame thicknesses — slightly thinner on small boards, slightly thicker on big
  const FRAME = sc(7);
  const TOTAL = BOARD_SIZE + FRAME * 8;

  // ── Engine ─────────────────────────────────────────────────────────────────
  const { state, rollDice, movePawn, getPossibleMoves, getBestMove, setState: setEngineState, nextTurn, resolveCaptures } = engine;
  const dicePan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const diceScale = useRef(new Animated.Value(1)).current;
  const diceRef = useRef<any>(null);
  const [actionMessage, setActionMessage] = React.useState<{ msg: string; seat: Seat; key: number } | null>(null);
  const [lastResult, setLastResult] = React.useState(1);
  const turnIdRef = useRef(state.turnId);
  const hasRolledRef = useRef(state.hasRolled);
  const getBestMoveRef = useRef(getBestMove);
  const movePawnRef = useRef(movePawn);
  const nextTurnRef = useRef(nextTurn);
  const stateRef = useRef(state);
  const resolveCapturesRef = useRef(resolveCaptures);
  const rollStartedRef = useRef(false);
  const diceAnimatedTurnRef = useRef(0); // tracks which turnId we already animated for

  useEffect(() => {
    turnIdRef.current = state.turnId;
    hasRolledRef.current = state.hasRolled;
    getBestMoveRef.current = getBestMove;
    movePawnRef.current = movePawn;
    nextTurnRef.current = nextTurn;
    stateRef.current = state;
    resolveCapturesRef.current = resolveCaptures;
  }, [state, getBestMove, movePawn, nextTurn, resolveCaptures]);

  // Remember last result for display
  useEffect(() => {
    if (state.diceValue) {
      setLastResult(state.diceValue);
    }
  }, [state.diceValue]);

  // Sync animations with server-side rolling state
  useEffect(() => {
    if (isAiEnabled) return; // Dice3D handles its own local animation in AI mode

    if (isDiceRolling) {
      if (!rollStartedRef.current) {
        rollStartedRef.current = true;
        handleRollStart();
      }
    } else if (!isDiceRolling && state.diceValue && diceAnimatedTurnRef.current !== state.turnId) {
      // Only animate back to center once per turn (prevents double animation
      // when pawn_moved/turn_passed arrives later and sets diceValue again)
      diceAnimatedTurnRef.current = state.turnId;
      rollStartedRef.current = false;
      Animated.timing(dicePan, {
        toValue: { x: 0, y: 0 },
        duration: 450,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [isDiceRolling, state.diceValue, state.turnId, isAiEnabled]);

  const handleDiceTapDisabled = () => {
    const activeColor = state.activeColors[state.turnIndex];
    if (activeColor !== localColor) {
      setActionMessage({ msg: 'not-your-turn', seat: 'BL', key: Date.now() });
    } else if (state.hasRolled) {
      setActionMessage({ msg: 'already-rolled', seat: 'BL', key: Date.now() });
    }
  };

  // ── AI turn automation (stale-closure-safe) ────────────────────────────────
  useEffect(() => {
    if (!isAiEnabled || state.winner || isCountdownActive) return;

    const currentTurnId = state.turnId;
    const currentTurnIndex = state.turnIndex;
    const activeColor = state.activeColors[currentTurnIndex];
    const isBot = activeColor !== localColor;

    if (isBot && !state.hasRolled && !state.diceValue) {
      const t = setTimeout(() => {
        const s = stateRef.current;
        if (s.turnId === currentTurnId && s.turnIndex === currentTurnIndex) {
          diceRef.current?.roll();
        }
      }, 1200);
      return () => clearTimeout(t);
    }

    if (isBot && state.hasRolled && state.diceValue) {
      const t = setTimeout(() => {
        const s = stateRef.current;
        const gbm = getBestMoveRef.current;
        const mp = movePawnRef.current;
        const nt = nextTurnRef.current;
        if (s.turnId !== currentTurnId || s.turnIndex !== currentTurnIndex) return;

        const bestPawnId = gbm(s.diceValue!);
        if (bestPawnId) {
          const turnIdBefore = s.turnId;
          mp(bestPawnId);
          setTimeout(() => {
            if (turnIdRef.current === turnIdBefore && hasRolledRef.current) {
              nextTurnRef.current(turnIdBefore);
            }
          }, 600);
        } else if (s.diceValue !== 6) {
          // Non-6 with no valid moves → pass the turn.
          // If it's a 6, the engine auto-resets for an extra roll (line 232-241).
          nt(currentTurnId);
        }
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [state.turnIndex, state.turnId, state.hasRolled, state.diceValue, localColor, isAiEnabled]);

  // ── Auto-move for local player ────────────────────────────────────────────
  useEffect(() => {
    if (state.winner || !state.hasRolled || state.diceValue === null) return;
    
    const currentTurnColor = state.activeColors[state.turnIndex];
    if (currentTurnColor !== localColor) return; // Only for local player
    
    const possibleMoves = getPossibleMoves(state.diceValue);
    const activePawnsCount = state.pawns.filter(p => p.color === localColor && p.state === 'board').length;
    
    // Auto-move only if exactly one valid move exists AND we don't have multiple pieces in play.
    // This gives the player more control when they have multiple tokens moving, 
    // preventing the game from "choosing" for them even if only one move is currently legal.
    if (possibleMoves.length === 1 && activePawnsCount <= 1) {
      const pawn = possibleMoves[0];
      
      const t = setTimeout(() => {
        // Verify it's still our turn and we still have the same roll
        if (state.activeColors[state.turnIndex] === localColor && state.hasRolled) {
          movePawn(pawn.id);
        }
      }, 700);
      return () => clearTimeout(t);
    }
  }, [state.turnIndex, state.turnId, state.hasRolled, state.diceValue, localColor]);

  // ── Board rotation ─────────────────────────────────────────────────────────
  const boardRotation = { blue: '0deg', green: '-90deg', red: '90deg', yellow: '180deg' }[localColor] as string;
  const pawnRotation = { blue: '0deg', green: '90deg', red: '-90deg', yellow: '-180deg' }[localColor] as string;

  const activeColor = state.activeColors[state.turnIndex];
  const needsSixBoost = !state.pawns.filter(p => p.color === activeColor).some(p => p.state === 'board');

  useEffect(() => {
    if (state.action) {
      const currentAction = state.action;
      const currentDice = state.diceValue;
      const seat = getSeatForColor(currentAction.color as any, localColor);
      const isCapture = currentAction.msg === 'capture';
      
      // Delay the popup so it shows after the movement/capture happens
      const popupDelay = isCapture ? ((currentDice || 1) * 120 + 400) : 0;
      
      const t = setTimeout(() => {
        setActionMessage({ msg: currentAction.msg, seat, key: currentAction.key });
      }, popupDelay);
      
      return () => clearTimeout(t);
    }
  }, [state.action]);

  // ── Dice throw animation ───────────────────────────────────────────────────
  const handleRollStart = () => {
    playDiceRollSound();
    const maxOffset = U * 3.0;
    const randomX = (Math.random() - 0.5) * maxOffset * 2;
    const randomY = (Math.random() - 0.5) * maxOffset * 2;
    
    // Reset positions
    dicePan.setValue({ x: 0, y: 0 });
    diceScale.setValue(1);

    Animated.parallel([
      Animated.timing(dicePan, {
        toValue: { x: randomX, y: randomY },
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(diceScale, { toValue: 1.3, duration: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(diceScale, { toValue: 1.0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();
  };

  const handleRollEnd = (result: number) => {
    Animated.timing(dicePan, {
      toValue: { x: 0, y: 0 },
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    rollDice(result);
  };

  const handleDiceTap = () => {
    if (!isAiEnabled) {
      // Guard: only allow tap if it's the local player's turn
      if (state.activeColors[state.turnIndex] !== localColor) return;
      rollStartedRef.current = true;
      handleRollStart(); // Start animation immediately for instant feedback
      rollDice(0); // Then send the request to server
    } else {
      handleRollStart(); // Locally if AI
    }
  };

  // ── Styles built from computed sizes ──────────────────────────────────────
  // These depend on TOTAL/FRAME which change per device, so we build them
  // inline rather than in a static StyleSheet.create call.
  const dynSt = {
    stage: {
      width: TOTAL, height: TOTAL,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderRadius: sc(24),
      overflow: 'visible' as const,
      padding: sc(4),
    },
    dropShadow: {
      position: 'absolute' as const,
      width: TOTAL - sc(20), height: TOTAL - sc(20),
      borderRadius: sc(32),
      backgroundColor: 'transparent',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: sc(18) },
      shadowOpacity: 0.7,
      shadowRadius: sc(22),
      elevation: 30,
    },
    mahoganyOuter: {
      width: TOTAL, height: TOTAL,
      borderRadius: sc(28),
      overflow: 'hidden' as const,
      padding: sc(5),
    },
    goldInlay: {
      flex: 1, borderRadius: sc(24),
      overflow: 'hidden' as const,
      padding: sc(4),
    },
    onyxGap: {
      flex: 1, borderRadius: sc(20),
      overflow: 'visible' as const,
      backgroundColor: C.onyx,
      padding: sc(4),
    },
    goldInnerLine: {
      flex: 1,
      borderRadius: sc(50),
      overflow: 'visible' as const,
      padding: sc(3),
    },
    board: {
      flex: 1, borderRadius: sc(12),
      overflow: 'visible' as const,
      position: 'relative' as const,
    },
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={dynSt.stage}>
      <View style={dynSt.dropShadow} />

      <View style={[dynSt.mahoganyOuter, { transform: [{ rotate: boardRotation }] }]}>
        <LinearGradient colors={[C.mahoganyMid, C.mahogany, '#1A0400', C.mahogany]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

        <View style={dynSt.goldInlay}>
          <LinearGradient colors={[C.goldLight, C.gold, C.goldDark, C.gold, C.goldLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

          <View style={dynSt.onyxGap}>
            <View style={dynSt.goldInnerLine}>
              <LinearGradient colors={[C.gold, C.goldLight, C.gold]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: sc(16) }]} />

              <View style={dynSt.board} pointerEvents="box-none">
                <LinearGradient colors={['#FFFDF4', C.ivoryMid]} style={[StyleSheet.absoluteFill, { borderRadius: sc(16) }]} />
                <View style={StyleSheet.absoluteFill} pointerEvents="none" />

                <Base color="green" col={0} row={0} BASE={BASE} sc={sc} />
                <Base color="yellow" col={U * 9} row={0} BASE={BASE} sc={sc} />
                <Base color="blue" col={0} row={U * 9} BASE={BASE} sc={sc} />
                <Base color="red" col={U * 9} row={U * 9} BASE={BASE} sc={sc} />

                {CELLS.map(spec => (
                  <BoardCell key={`${spec.col}-${spec.row}`} spec={spec} U={U} sc={sc} />
                ))}

                {(() => {
                  const pawnsByPos: Record<string, string[]> = {};
                  state.pawns.forEach(p => {
                    const pIdx = getPerimeterIndex(p.color, p.state, p.pathIndex);
                    const posKey = p.state === 'home' ? `h-${p.color}-${p.index}`
                      : p.state === 'finished' ? `f-${p.color}-${p.index}`
                        : pIdx !== null ? `p-${pIdx}`
                          : `s-${p.color}-${p.pathIndex}`;
                    if (!pawnsByPos[posKey]) pawnsByPos[posKey] = [];
                    pawnsByPos[posKey].push(p.id);
                  });

                  return state.pawns.map(pawn => {
                    const pIdx = getPerimeterIndex(pawn.color, pawn.state, pawn.pathIndex);
                    const posKey = pawn.state === 'home' ? `h-${pawn.color}-${pawn.index}`
                      : pawn.state === 'finished' ? `f-${pawn.color}-${pawn.index}`
                        : pIdx !== null ? `p-${pIdx}`
                          : `s-${pawn.color}-${pawn.pathIndex}`;

                    const cluster = pawnsByPos[posKey];
                    const clusterIdx = cluster.indexOf(pawn.id);
                    const clusterCount = cluster.length;

                    let offsetX = 0, offsetY = 0;
                    if (clusterCount > 1 && pawn.state !== 'home') {
                      const gap = U * 0.18;
                      if (clusterCount === 2) {
                        offsetX = clusterIdx === 0 ? -gap : gap;
                        offsetY = 0;
                      } else if (clusterCount === 3) {
                        if (clusterIdx === 0) { offsetX = 0; offsetY = -gap; }
                        else if (clusterIdx === 1) { offsetX = -gap; offsetY = gap; }
                        else { offsetX = gap; offsetY = gap; }
                      } else {
                        if (clusterIdx === 0) { offsetX = -gap; offsetY = -gap; }
                        else if (clusterIdx === 1) { offsetX = gap; offsetY = -gap; }
                        else if (clusterIdx === 2) { offsetX = -gap; offsetY = gap; }
                        else { offsetX = gap; offsetY = gap; }
                      }
                    }

                    return (
                      <EnginePawn
                        key={pawn.id}
                        pawn={pawn}
                        onPress={movePawn}
                        isActiveTurn={state.activeColors[state.turnIndex] === pawn.color}
                        hasRolled={state.hasRolled}
                        isKicked={state.lives[pawn.color] <= 0}
                        pawnRotation={pawnRotation}
                        localColor={localColor}
                        offsetX={offsetX}
                        offsetY={offsetY}
                        clusterCount={clusterCount}
                        clusterIdx={clusterIdx}
                        U={U}
                        TOTAL={TOTAL}
                        diceValue={state.diceValue}
                        action={state.action}
                        onCaptureComplete={(capturedPawnId) => resolveCaptures([capturedPawnId])}
                      />
                    );
                  });
                })()}

                <Center U={U} sc={sc} />
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* 3D Dice */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: CTR * 0.8,
            height: CTR * 0.8,
            left: (TOTAL - CTR * 0.8) / 2,
            top: (TOTAL - CTR * 0.8) / 2,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            transform: [
              { translateX: dicePan.x },
              { translateY: dicePan.y },
              { scale: diceScale },
            ],
          },
        ]}
        pointerEvents="box-none"
      >
        <Dice3D
          ref={diceRef}
          value={lastResult}
          size={CTR * 0.8}
          disabled={state.hasRolled || state.activeColors[state.turnIndex] !== localColor}
          needsSixBoost={needsSixBoost}
          onRollStart={handleDiceTap}
          onRoll={handleRollEnd}
          onPressDisabled={handleDiceTapDisabled}
          onReady={onDiceReady}
          isRolling={isDiceRolling}
          controlled={!isAiEnabled}
        />
      </Animated.View>

      {actionMessage && !hidePopups && (
        <ActionPopup
          key={actionMessage.key}
          message={actionMessage.msg}
          seat={actionMessage.seat}
          onComplete={() => setActionMessage(null)}
        />
      )}
    </View>
  );
}

export { Pawn };

