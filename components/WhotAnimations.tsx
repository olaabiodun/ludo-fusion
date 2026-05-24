import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
  runOnJS,
  Easing,
  interpolate,
  Extrapolate,
  cancelAnimation,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { WhotFrontCard } from './WhotFrontCard';
import {
  CARD_H,
  CARD_W,
  Card,
  Seat,
  getCardInFanPos,
  rs,
} from './WhotUtils';
import { playWhotCardSound } from '../lib/sounds';

const BACK_CARD = require('../assets/images/whot/backcard.png');

// ─────────────────────────────────────────────────────────────────────────────
// Types & Helpers
// ─────────────────────────────────────────────────────────────────────────────

export interface MarketPick {
  key: string;
  seat: Seat;
  card: Card;
  delay: number;
  pi: number;
  pickIndex: number;
  totalAtStart: number;
  isPenalty?: boolean;
}

export interface RootLayout { w: number; h: number; }
export interface RootPos { x: number; y: number; }

const getMarketPile = (root: RootLayout) => ({
  x: root.w / 2,
  y: root.h / 2 - 8,
});

const getDiscardPile = (root: RootLayout) => ({
  x: root.w / 2 + (CARD_W + rs(24)),
  y: root.h / 2 - 8,
});

// Catmull-Rom spline interpolation for smoother flight paths
const catmullRom = (t: number, p0: number, p1: number, p2: number, p3: number): number => {
  'worklet';
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t
  );
};

// Wobble easing for landing impact
const wobbleEasing = (t: number): number => {
  'worklet';
  if (t < 0.7) return Easing.out(Easing.cubic)(t / 0.7);
  // Gentle overshoot and settle
  const p = (t - 0.7) / 0.3;
  return 1 + Math.sin(p * Math.PI * 2) * 0.06 * (1 - p);
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. FlyingCard (Used for Distribution)
//    IMPROVED: Bezier control points, staggered spin, dynamic arc based on seat
// ─────────────────────────────────────────────────────────────────────────────

interface FlyingCardProps {
  targetX: number;
  targetY: number;
  targetRot: number;
  delay: number;
  onLand: () => void;
  rootLayout: RootLayout;
  reveal?: boolean;
  cardIndex?: number; // which card in deal order (for stagger)
}

export const FlyingCard = React.memo(({
  targetX, targetY, targetRot, delay, onLand, rootLayout, reveal = false, cardIndex = 0,
}: FlyingCardProps) => {
  const progress = useSharedValue(0);
  const landBounce = useSharedValue(1);
  const origin = getMarketPile(rootLayout);

  // Compute a Bezier control point for a more organic curve
  const midX = (origin.x + targetX) / 2 + (Math.random() - 0.5) * rs(30);
  const midY = Math.min(origin.y, targetY) - rs(60) - Math.abs(targetY - origin.y) * 0.3;

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, {
        duration: 480 + Math.random() * 60, // slight per-card variation
        easing: Easing.inOut(Easing.ease),
      }, (finished) => {
        if (finished) {
          // Landing micro-bounce
          landBounce.value = withSequence(
            withTiming(0.93, { duration: 60, easing: Easing.out(Easing.quad) }),
            withSpring(1, { damping: 10, stiffness: 260, mass: 0.6 })
          );
          runOnJS(onLand)();
        }
      })
    );

    const timer = setTimeout(() => {
      playWhotCardSound();
    }, delay);

    return () => {
      cancelAnimation(progress);
      clearTimeout(timer);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;

    // Quadratic Bezier for position
    const oneMinusP = 1 - p;
    const translateX = oneMinusP * oneMinusP * origin.x + 2 * oneMinusP * p * midX + p * p * targetX - CARD_W / 2;
    const translateY = oneMinusP * oneMinusP * origin.y + 2 * oneMinusP * p * midY + p * p * targetY - CARD_H / 2;

    // Card spin during flight — flips once halfway
    const spinAmount = reveal ? 0 : (cardIndex % 2 === 0 ? 1 : -1) * 10;
    const rotate = `${p * targetRot + Math.sin(p * Math.PI) * spinAmount}deg`;

    // Scale: pops up then settles with landing bounce
    const scaleBase = interpolate(p, [0, 0.5, 1], [1.1, 1.9, 1.0], Extrapolate.CLAMP);
    const scale = scaleBase * (p >= 1 ? landBounce.value : 1);

    // Elevation shadow effect
    const shadowProgress = Math.sin(p * Math.PI); // peaks mid-flight

    return {
      transform: [
        { translateX },
        { translateY },
        { scale },
        { rotate },
      ],
      opacity: interpolate(p, [0, 0.05, 0.95, 1], [0, 1, 1, 1], Extrapolate.CLAMP),
      // Dynamic shadows removed for low-end device animation performance (prevents rasterization thrashing)
    };
  });

  const frontOpacity = useAnimatedStyle(() => ({
    opacity: reveal && progress.value >= 0.5 ? 1 : 0,
  }));

  const backOpacity = useAnimatedStyle(() => ({
    opacity: reveal ? (progress.value < 0.5 ? 1 : 0) : 1,
  }));

  return (
    <Animated.View 
      style={[styles.cardBase, { overflow: 'visible' }, animatedStyle]}
      renderToHardwareTextureAndroid={true}
      shouldRasterizeIOS={true}
    >
      <Animated.View style={[StyleSheet.absoluteFill, backOpacity]}>
        <Image source={BACK_CARD} style={styles.fullImage} contentFit="contain" />
      </Animated.View>
      {reveal && (
        <Animated.View style={[StyleSheet.absoluteFill, frontOpacity]}>
          <Image source={BACK_CARD} style={styles.fullImage} contentFit="contain" />
        </Animated.View>
      )}
    </Animated.View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. CardDistributionOverlay
//    IMPROVED: Round-robin stagger, ripple burst on completion
// ─────────────────────────────────────────────────────────────────────────────

export const CardDistributionOverlay = React.memo(({
  players, rootLayout, rootPos, onCardLand, onComplete
}: {
  players: { seat: Seat, isLocal: boolean }[],
  rootLayout: RootLayout,
  rootPos: RootPos,
  onCardLand: (pi: number) => void,
  onComplete: () => void
}) => {
  const landedCount = React.useRef(0);
  const totalJobs = React.useRef(0);

  const jobs = useMemo(() => {
    const list: Array<{
      key: string; pi: number;
      tx: number; ty: number;
      rot: number; delay: number;
      reveal?: boolean; cardIndex: number;
    }> = [];

    // Round-robin dealing (like a real dealer): card 1 to each player, then card 2, etc.
    for (let r = 0; r < 5; r++) {
      players.forEach((p, pi) => {
        const pos = getCardInFanPos(p.seat, r, 5, p.isLocal);
        const dealOrder = r * players.length + pi;
        list.push({
          key: `dist-${pi}-${r}`,
          pi,
          tx: pos.x - rootPos.x,
          ty: pos.y - rootPos.y,
          rot: pos.rot,
          delay: dealOrder * 90, // tighter, snappier stagger
          cardIndex: dealOrder,
        });
      });
    }

    // Starting discard card — reveals after all hands dealt
    const discard = getDiscardPile(rootLayout);
    list.push({
      key: 'start-card',
      pi: -1,
      tx: discard.x,
      ty: discard.y,
      rot: 0,
      delay: (5 * players.length) * 90 + 400,
      reveal: true,
      cardIndex: 5 * players.length,
    });

    totalJobs.current = list.length;
    return list;
  }, [players, rootLayout, rootPos]);

  const handleLand = React.useCallback((pi: number) => {
    onCardLand(pi);
    landedCount.current++;
    if (landedCount.current >= totalJobs.current) {
      setTimeout(onComplete, 450);
    }
  }, [onCardLand, onComplete]);

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999, overflow: 'visible' }]} pointerEvents="none">
      {jobs.map(j => (
        <FlyingCard
          key={j.key}
          targetX={j.tx}
          targetY={j.ty}
          targetRot={j.rot}
          delay={j.delay}
          onLand={() => handleLand(j.pi)}
          rootLayout={rootLayout}
          reveal={j.reveal}
          cardIndex={j.cardIndex}
        />
      ))}
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. PlayCardAnim
//    IMPROVED: Spiral lift-off, ease-into-pile, snap + scatter burst on land
// ─────────────────────────────────────────────────────────────────────────────

export const PlayCardAnim = React.memo(({
  startX, startY, startRot, card, onLand, rootLayout
}: {
  startX: number; startY: number; startRot: number;
  card: Card; onLand: () => void; rootLayout: RootLayout;
}) => {
  const progress = useSharedValue(0);
  const landPop = useSharedValue(1);
  const target = getDiscardPile(rootLayout);

  // Bezier control for elegant curve
  const ctrl1X = startX + (target.x - startX) * 0.25 + rs(20);
  const ctrl1Y = startY - rs(80); // lift high
  const ctrl2X = startX + (target.x - startX) * 0.75 - rs(20);
  const ctrl2Y = target.y - rs(50);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: 420,
      easing: Easing.inOut(Easing.ease),
    }, (finished) => {
      if (finished) {
        // Snap & settle
        landPop.value = withSequence(
          withTiming(1.12, { duration: 70 }),
          withSpring(1, { damping: 12, stiffness: 320 })
        );
        runOnJS(onLand)();
      }
    });
    return () => cancelAnimation(progress);
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;

    // Cubic Bezier evaluation
    const b0 = (1 - p) ** 3;
    const b1 = 3 * (1 - p) ** 2 * p;
    const b2 = 3 * (1 - p) * p ** 2;
    const b3 = p ** 3;

    const translateX = b0 * startX + b1 * ctrl1X + b2 * ctrl2X + b3 * target.x - CARD_W / 2;
    const translateY = b0 * startY + b1 * ctrl1Y + b2 * ctrl2Y + b3 * target.y - CARD_H / 2;

    // Rotate smoothly to 0 with a playful overshoot
    const rotProgress = Easing.out(Easing.back(1.5))(p);
    const rotate = `${startRot * (1 - rotProgress)}deg`;

    // Scale: slight lift then land pop
    const scaleBase = interpolate(p, [0, 0.3, 0.85, 1], [1.0, 1.18, 1.05, 1.0], Extrapolate.CLAMP);
    const scale = scaleBase * (p >= 1 ? landPop.value : 1);

    // Tilt during flight (removed rotateX/rotateZ — they clip card edges on iOS)
    const elev = Math.sin(p * Math.PI);

    return {
      transform: [
        { translateX },
        { translateY },
        { scale },
        { rotate },
      ],
      // Dynamic shadows removed for low-end device animation performance (prevents rasterization thrashing)
    };
  });

  return (
    <Animated.View 
      style={[styles.cardBase, { zIndex: 5000 }, animatedStyle]}
      renderToHardwareTextureAndroid={true}
      shouldRasterizeIOS={true}
    >
      <WhotFrontCard shape={card.shape} value={card.value} width={CARD_W} height={CARD_H} />
    </Animated.View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. MarketPickAnim
//    IMPROVED: Smoother 3-phase, better flip, per-seat arc customization,
//              glow pulse at reveal point
// ─────────────────────────────────────────────────────────────────────────────

export const MarketPickAnim = React.memo(({
  seat, card, isLocal, delay, pickIndex, totalAtStart, onLand, fanCenters, rootPos, rootLayout
}: any) => {
  const v = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const market = getMarketPile(rootLayout);

  // Phase durations (seconds): 0→1 slide out, 1→2 flip, 2→3 go to hand
  const PHASE1_DUR = 350;
  const PHASE2_DUR = 280;
  const PHASE3_DUR = 400;
  const TOTAL_DUR = PHASE1_DUR + PHASE2_DUR + PHASE3_DUR;

  // Reveal position — seat-aware staging area
  const seatReveal: Record<string, { x: number; y: number }> = {
    DOWN:  { x: rootLayout.w / 2, y: rootLayout.h / 2 + rs(120) },
    TOP:   { x: rootLayout.w / 2, y: rootLayout.h / 2 - rs(120) },
    LEFT:  { x: rootLayout.w / 2 - rs(120), y: rootLayout.h / 2 },
    RIGHT: { x: rootLayout.w / 2 + rs(120), y: rootLayout.h / 2 },
    TL:    { x: rootLayout.w / 2 - rs(80), y: rootLayout.h / 2 - rs(80) },
    TR:    { x: rootLayout.w / 2 + rs(80), y: rootLayout.h / 2 - rs(80) },
    BL:    { x: rootLayout.w / 2 - rs(80), y: rootLayout.h / 2 + rs(80) },
    BR:    { x: rootLayout.w / 2 + rs(80), y: rootLayout.h / 2 + rs(80) },
  };
  const revealPos = seatReveal[seat] ?? seatReveal.DOWN;

  // Target the right-most side of the hand for the local player
  const newTotal = totalAtStart + pickIndex + 1;
  const newIdx = newTotal - 1; // Always the last index (right side)
  const targetPos = getCardInFanPos(seat, newIdx, newTotal, isLocal);
  const targetX = targetPos.x - rootPos.x;
  const targetY = targetPos.y - rootPos.y;
  const targetRot = targetPos.rot;

  // Arc control point for phase 1 (pile → reveal)
  const arc1CtrlX = (market.x + revealPos.x) / 2;
  const arc1CtrlY = Math.min(market.y, revealPos.y) - rs(50);

  // Arc control point for phase 3 (reveal → hand)
  const arc3CtrlX = (revealPos.x + targetX) / 2;
  const arc3CtrlY = (revealPos.y + targetY) / 2 - rs(40);

  useEffect(() => {
    v.value = withDelay(delay, withTiming(3, {
      duration: TOTAL_DUR,
      easing: Easing.linear, // we manage each phase internally
    }, (finished) => {
      if (finished) runOnJS(onLand)();
    }));

    const timer = setTimeout(() => {
      playWhotCardSound();
    }, delay);

    return () => {
      cancelAnimation(v);
      clearTimeout(timer);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const val = v.value;
    let tx: number, ty: number, rotZ: number, rotY: number, scale: number;

    if (val <= 1) {
      // Phase 1: Pile → Reveal (smooth cubic)
      const p = Easing.out(Easing.cubic)(val);
      const oneMinusP = 1 - p;
      tx = oneMinusP * oneMinusP * market.x + 2 * oneMinusP * p * arc1CtrlX + p * p * revealPos.x;
      ty = oneMinusP * oneMinusP * market.y + 2 * oneMinusP * p * arc1CtrlY + p * p * revealPos.y;
      rotZ = 0;
      rotY = 0;
      scale = interpolate(p, [0, 0.5, 1], [1.0, 1.25, 1.4], Extrapolate.CLAMP);
    } else if (val <= 2) {
      // Phase 2: Flip in place (fast, snappy flip)
      const p = val - 1;
      const eased = Easing.inOut(Easing.ease)(p);
      tx = revealPos.x;
      ty = revealPos.y;
      rotZ = 0;
      // Flip: 0→90 (front disappears), 90→180 is just back; we use backface logic
      rotY = eased * 180;
      scale = 1.4 + Math.sin(eased * Math.PI) * 0.08; // slight bulge at 90°
    } else {
      // Phase 3: Reveal → Hand (smooth bezier + decelerate into fan position)
      const p = Easing.out(Easing.cubic)(val - 2);
      const oneMinusP = 1 - p;
      tx = oneMinusP * oneMinusP * revealPos.x + 2 * oneMinusP * p * arc3CtrlX + p * p * targetX;
      ty = oneMinusP * oneMinusP * revealPos.y + 2 * oneMinusP * p * arc3CtrlY + p * p * targetY;
      rotZ = interpolate(p, [0, 0.8, 1], [0, targetRot + 6, targetRot], Extrapolate.CLAMP);
      rotY = 180; // card stays "flipped" showing front/back depending on local
      scale = interpolate(p, [0, 0.7, 1], [1.4, 1.1, 1.0], Extrapolate.CLAMP);
    }

    // Shadow elevation: high in phases 1 and 3, low at rest
    const elevPhase = val <= 1 ? val : val <= 2 ? (2 - val) : (1 - (val - 2));
    const elev = Math.max(0, Math.min(1, elevPhase));

    return {
      transform: [
        { translateX: tx - CARD_W / 2 },
        { translateY: ty - CARD_H / 2 },
        { scale },
        { rotateZ: `${rotZ}deg` },
      ],
      zIndex: 3500,
      // Dynamic shadows removed for low-end device animation performance (prevents rasterization thrashing)
    };
  });

  // Back of card (visible before flip midpoint, and for non-local always)
  const backStyle = useAnimatedStyle(() => ({
    opacity: (v.value < 1.5 || !isLocal) ? 1 : 0,
  }));

  // Front of card (visible after flip midpoint, local player only)
  const frontStyle = useAnimatedStyle(() => ({
    opacity: (v.value >= 1.5 && isLocal) ? 1 : 0,
  }));

  return (
    <Animated.View 
      style={[styles.cardBase, animatedStyle]}
      renderToHardwareTextureAndroid={true}
      shouldRasterizeIOS={true}
    >
      <Animated.View style={[StyleSheet.absoluteFill, backStyle]}>
        <Image source={BACK_CARD} style={styles.fullImage} contentFit="contain" />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, frontStyle]}>
        <WhotFrontCard shape={card.shape} value={card.value} width={CARD_W} height={CARD_H} />
      </Animated.View>
    </Animated.View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. ReshuffleAnim
//    IMPROVED: Cards spiral FROM discard in a radial burst, then converge into
//              market pile with a physics-style settle. Two-phase: scatter then gather.
// ─────────────────────────────────────────────────────────────────────────────

const RESHUFFLE_COUNT = 16;

export const ReshuffleAnim = React.memo(({ onComplete, rootLayout }: any) => {
  const origin = getDiscardPile(rootLayout);
  const target = getMarketPile(rootLayout);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: 1400,
      easing: Easing.inOut(Easing.ease),
    }, (f) => {
      if (f) runOnJS(onComplete)();
    });
    return () => cancelAnimation(progress);
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {[...Array(RESHUFFLE_COUNT)].map((_, i) => (
        <ReshuffleCard
          key={i}
          index={i}
          total={RESHUFFLE_COUNT}
          progress={progress}
          origin={origin}
          target={target}
        />
      ))}
    </View>
  );
});

const ReshuffleCard = ({ index, total, progress, origin, target }: any) => {
  // Each card fans out radially then collapses
  const angle = (index / total) * Math.PI * 2; // full circle spread
  const radius = rs(70) + (index % 3) * rs(20); // varied scatter radius
  const scatterX = origin.x + Math.cos(angle) * radius;
  const scatterY = origin.y + Math.sin(angle) * radius;

  // Stagger: each card starts 60ms apart
  const staggerStart = (index / total) * 0.35;
  const staggerEnd = staggerStart + 0.65;

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;

    // Each card: phase1 = scatter (0 → staggerEnd * 0.5), phase2 = gather (staggerEnd * 0.5 → 1)
    const localP = interpolate(p, [staggerStart, 1], [0, 1], Extrapolate.CLAMP);

    if (localP <= 0) return { opacity: 0 };

    const scatterP = interpolate(localP, [0, 0.5], [0, 1], Extrapolate.CLAMP);
    const gatherP = interpolate(localP, [0.45, 1], [0, 1], Extrapolate.CLAMP);

    // Scatter phase: fly from pile outward
    const scatterEased = Easing.out(Easing.cubic)(scatterP);
    // Gather phase: fly inward to market pile
    const gatherEased = Easing.in(Easing.cubic)(gatherP);

    const tx = scatterP < 1
      ? origin.x + scatterEased * (scatterX - origin.x)
      : scatterX + gatherEased * (target.x - scatterX);

    const ty = scatterP < 1
      ? origin.y + scatterEased * (scatterY - origin.y)
      : scatterY + gatherEased * (target.y - scatterY);

    // Spin 720° total
    const spin = localP * 720 + angle * (180 / Math.PI);

    // Scale: pop out, shrink as gathers into pile
    const scale = interpolate(localP, [0, 0.5, 1], [0.6, 1.15, 0.85], Extrapolate.CLAMP);

    // Opacity: fade in, stay, fade near end
    const opacity = interpolate(localP, [0, 0.08, 0.85, 1], [0, 1, 1, 0], Extrapolate.CLAMP);

    return {
      transform: [
        { translateX: tx - CARD_W / 2 },
        { translateY: ty - CARD_H / 2 },
        { rotate: `${spin}deg` },
        { scale },
      ],
      opacity,
    };
  });

  return (
    <Animated.View 
      style={[styles.cardBase, animatedStyle]}
      renderToHardwareTextureAndroid={true}
      shouldRasterizeIOS={true}
    >
      <Image source={BACK_CARD} style={styles.fullImage} contentFit="contain" />
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. WinnerCardBurst — bonus: plays when a player wins (exported for use in GameUI)
//    Cascade of cards fan out from winner's seat and rain down
// ─────────────────────────────────────────────────────────────────────────────

export const WinnerBurstAnim = React.memo(({ seat, rootLayout }: {
  seat: Seat; rootLayout: RootLayout;
}) => {
  const BURST_CARDS = 12;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {[...Array(BURST_CARDS)].map((_, i) => (
        <BurstCard key={i} index={i} total={BURST_CARDS} seat={seat} rootLayout={rootLayout} />
      ))}
    </View>
  );
});

const BurstCard = ({ index, total, seat, rootLayout }: any) => {
  const progress = useSharedValue(0);
  const delay = (index / total) * 400;

  // Origin near seat
  const seatOrigins: Record<string, { x: number; y: number }> = {
    DOWN:  { x: rootLayout.w / 2, y: rootLayout.h - rs(100) },
    TOP:   { x: rootLayout.w / 2, y: rs(100) },
    LEFT:  { x: rs(80), y: rootLayout.h / 2 },
    RIGHT: { x: rootLayout.w - rs(80), y: rootLayout.h / 2 },
  };
  const orig = seatOrigins[seat] ?? seatOrigins.DOWN;
  const spreadAngle = -Math.PI / 2 + ((index / (total - 1)) - 0.5) * Math.PI * 1.2;
  const landX = orig.x + Math.cos(spreadAngle) * (rs(60) + Math.random() * rs(80));
  const landY = orig.y + Math.sin(spreadAngle) * (rs(60) + Math.random() * rs(80));

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
    return () => cancelAnimation(progress);
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      transform: [
        { translateX: orig.x + p * (landX - orig.x) - CARD_W / 2 },
        { translateY: orig.y + p * (landY - orig.y) + p * p * rs(100) - CARD_H / 2 }, // gravity arc
        { rotate: `${p * (index % 2 === 0 ? 360 : -360)}deg` },
        { scale: interpolate(p, [0, 0.3, 1], [0.5, 1.2, 0.9], Extrapolate.CLAMP) },
      ],
      opacity: interpolate(p, [0, 0.1, 0.7, 1], [0, 1, 1, 0], Extrapolate.CLAMP),
    };
  });

  return (
    <Animated.View 
      style={[styles.cardBase, { zIndex: 9000 }, animatedStyle]}
      renderToHardwareTextureAndroid={true}
      shouldRasterizeIOS={true}
    >
      <Image source={BACK_CARD} style={styles.fullImage} contentFit="contain" />
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. HandViewerOverlay
//    IMPROVED: Slide-up entrance, staggered card pop-in, press feedback
// ─────────────────────────────────────────────────────────────────────────────

interface HandViewerOverlayProps {
  cards: Card[];
  onClose: () => void;
  onCardPress: (idx: number) => void;
  canPlayCard?: (card: Card, handLength: number) => boolean;
}

export const HandViewerOverlay = ({
  cards, onClose, onCardPress, canPlayCard
}: HandViewerOverlayProps) => {
  const slideIn = useSharedValue(120);
  const bgOpacity = useSharedValue(0);

  const cols = 4;
  const cardW = rs(62);
  const cardH = Math.round(cardW * 1.4);
  const gap = rs(8);

  useEffect(() => {
    bgOpacity.value = withTiming(1, { duration: 220 });
    slideIn.value = withSpring(0, { damping: 18, stiffness: 200 });
    return () => {
      cancelAnimation(slideIn);
      cancelAnimation(bgOpacity);
    };
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: bgOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideIn.value }],
  }));

  return (
    <Animated.View style={[{
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.88)',
      zIndex: 8000,
      alignItems: 'center',
      justifyContent: 'center',
      padding: rs(16),
    }, overlayStyle]}>
      <TouchableOpacity
        activeOpacity={1}
        style={StyleSheet.absoluteFill}
        onPress={onClose}
      />

      <Animated.View style={[{ alignItems: 'center' }, sheetStyle]}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: rs(16),
          gap: rs(8),
        }}>
          <View style={{
            width: rs(28), height: rs(3),
            borderRadius: rs(2),
            backgroundColor: 'rgba(255,255,255,0.2)',
          }} />
          <Text style={{
            color: 'rgba(255,255,255,0.45)',
            fontSize: rs(10),
            fontWeight: '700',
            letterSpacing: 2,
          }}>YOUR HAND</Text>
          <View style={{
            width: rs(28), height: rs(3),
            borderRadius: rs(2),
            backgroundColor: 'rgba(255,255,255,0.2)',
          }} />
        </View>

        {/* Cards grid with staggered pop-in - NOW SCROLLABLE */}
        <View style={{ 
          maxHeight: rs(320), // Constraint for small screens
          width: '100%',
        }}>
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap,
              justifyContent: 'center',
              paddingVertical: rs(10),
            }}
          >
            {cards.map((card, idx) => (
              <HandCard
                key={idx}
                card={card}
                idx={idx}
                cardW={cardW}
                cardH={cardH}
                isPlayable={canPlayCard?.(card, cards.length)}
                onPress={() => { onCardPress(idx); onClose(); }}
              />
            ))}
          </ScrollView>
        </View>

        {/* Close button */}
        <TouchableOpacity
          onPress={onClose}
          style={{
            marginTop: rs(20),
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderRadius: rs(14),
            paddingHorizontal: rs(28),
            paddingVertical: rs(11),
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.15)',
          }}
        >
          <Text style={{
            color: '#FFD030',
            fontSize: rs(12),
            fontWeight: '900',
            letterSpacing: 1.5,
          }}>CLOSE</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

// Individual card in HandViewer with staggered entrance + press scale
const HandCard = React.memo(({ card, idx, cardW, cardH, onPress, isPlayable }: any) => {
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    const stagger = idx * 35;
    opacity.value = withDelay(stagger, withTiming(1, { duration: 180 }));
    scale.value = withDelay(stagger, withSpring(1, { damping: 14, stiffness: 260 }));
    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * pressScale.value }],
    opacity: opacity.value,
  }));

  const onPressIn = () => {
    pressScale.value = withTiming(0.92, { duration: 80 });
  };
  const onPressOut = () => {
    pressScale.value = withSpring(1, { damping: 12, stiffness: 300 });
  };

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        <WhotFrontCard shape={card.shape} value={card.value} width={cardW} height={cardH} isPlayable={isPlayable} />
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  cardBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CARD_W,
    height: CARD_H,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: rs(4) },
    shadowOpacity: 0.3,
    shadowRadius: rs(8),
    elevation: 8,
    overflow: 'visible',
  },
  fullImage: {
    width: '100%',
    height: '100%',
    borderRadius: rs(5),
  },
});
