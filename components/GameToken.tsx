import { Image } from 'expo-image';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { getCellPos } from './SnakeLadderUtils';
import { playMoveSound, playTokenFinishSound, playSnakeDropSound } from '../lib/sounds';

/**
 * GameToken — v3
 *
 * All stutter / snap-back bugs fixed (see v2 comments).
 * New in this version:
 *
 *  A. initialCoords wrapped in useRef.current so getCellPos is NOT called on
 *     every render — prevents silent coordinate drift on hot reloads.
 *
 *  B. Walk path built from `end` backwards so it is never affected by a stale
 *     `start` value after an interrupted animation:
 *       path = [end-diff+1, end-diff+2, …, end]
 *
 *  C. Each walk hop uses a real arc (rise → fall) so the token visually jumps
 *     over the board rather than skating along it.
 *
 *  D. Ladder uses getCellPos waypoints along an arc so the token curves upward
 *     instead of teleporting in a straight diagonal line.
 *
 *  E. Squash-on-land (scaleX wide, scaleY short → spring back) after every hop
 *     and at the end of snake/ladder, giving physical weight.
 *
 *  F. Board-entry pop-in: first time isOnBoard turns true the token springs in
 *     from scale 0 with a slight overshoot.
 *
 *  G. bounce ref replaced with separate scaleX / scaleY animated values so
 *     proper 2-axis squash-and-stretch is possible.
 *
 *  H. offset moved to a plain View wrapper (no driver conflict).
 *
 *  I. scaleX/scaleY reset to 1.0 before each new move so interrupted
 *     animations never bleed their scale into the next sequence.
 */

// ─────────────────────────────────────────────────────────────────────────────

export const GLOW_COLORS: Record<string, string> = {
  green:  '#4AE65C',
  yellow: '#FFD030',
  blue:   '#2DA8FF',
  red:    '#FF4A42',
};

const TOKEN_IMAGES: any = {
  green:  require('../assets/images/tokeng.png'),
  yellow: require('../assets/images/tokeny.png'),
  blue:   require('../assets/images/tokenb.png'),
  red:    require('../assets/images/tokenr.png'),
};

interface GameTokenProps {
  color: string;
  isActive: boolean;
  isOnBoard: boolean;
  cellSize: number;
  position: number;
  id: string;
  offset: { dx: number; dy: number };
  isKicked?: boolean;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Parabolic arc between two points, returning N evenly-spaced waypoints. */
function arcPath(
  x0: number, y0: number,
  x1: number, y1: number,
  steps: number,
  lift: number,             // negative lifts upward (screen Y is down)
): Array<{ x: number; y: number }> {
  return Array.from({ length: steps }, (_, i) => {
    const t = (i + 1) / steps;
    return {
      x: lerp(x0, x1, t),
      y: lerp(y0, y1, t) + lift * 4 * t * (1 - t),
    };
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export const GameToken = React.memo(function GameToken({
  color, isActive, isOnBoard, cellSize, position, id, offset, isKicked = false,
}: GameTokenProps) {

  // ── Glow pulses ──────────────────────────────────────────────────────────
  const pulse     = useRef(new Animated.Value(0)).current;
  const fastPulse = useRef(new Animated.Value(0)).current;

  // ── Position: seeded once with real coords so there is NO initial flash ──
  const initialPos  = useRef(getCellPos(position, color)).current;
  const anim        = useRef(new Animated.ValueXY(initialPos)).current;

  // ── Squash-and-stretch (replaces the old single `bounce` value) ───────────
  const scaleX = useRef(new Animated.Value(1)).current;
  const scaleY = useRef(new Animated.Value(1)).current;

  // ── Bookkeeping refs ─────────────────────────────────────────────────────
  const prevPos      = useRef(position);
  const liveCoords   = useRef(initialPos);          // JS-side live snapshot
  const movementAnim = useRef<Animated.CompositeAnimation | null>(null);
  const glowStarted  = useRef(false);
  const wasOnBoard   = useRef(false);

  // Keep liveCoords current so interruptions always start from visual pos
  useEffect(() => {
    const lid = anim.addListener(({ x, y }) => { liveCoords.current = { x, y }; });
    return () => anim.removeListener(lid);
  }, []);

  // ── Glow loops (run once) ─────────────────────────────────────────────────
  useEffect(() => {
    if (glowStarted.current) return;
    glowStarted.current = true;

    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();

    Animated.loop(Animated.sequence([
      Animated.timing(fastPulse, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(fastPulse, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ])).start();
  }, []);

  // ── Board-entry pop-in ────────────────────────────────────────────────────
  useEffect(() => {
    if (isOnBoard && !wasOnBoard.current) {
      wasOnBoard.current = true;
      scaleX.setValue(0);
      scaleY.setValue(0);
      Animated.parallel([
        Animated.spring(scaleX, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
        Animated.spring(scaleY, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [isOnBoard]);

  // ── Movement engine ───────────────────────────────────────────────────────
  useEffect(() => {
    if (position === prevPos.current) return;

    const end  = position;
    const diff = end - prevPos.current;

    // Cancel in-flight anim WITHOUT snapping the Animated value
    if (movementAnim.current) {
      movementAnim.current.stop();
      movementAnim.current = null;
    }

    // Anchor anim to the exact visual position before starting next sequence
    const fromX = liveCoords.current.x;
    const fromY = liveCoords.current.y;
    anim.setValue({ x: fromX, y: fromY });

    // Hard-reset scale so no bleed from interrupted animation
    scaleX.setValue(1);
    scaleY.setValue(1);

    // Update eagerly so rapid prop changes chain correctly
    prevPos.current = end;

    // ── reusable micro-animations ────────────────────────────────────────

    /** Wide-short squash on landing, then spring to normal */
    const squashLand = (intensity = 1, dur = 35) =>
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleX, { toValue: 1 + 0.35 * intensity, duration: dur, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(scaleY, { toValue: 1 - 0.35 * intensity, duration: dur, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.spring(scaleX, { toValue: 1, friction: 6, tension: 250, useNativeDriver: true }),
          Animated.spring(scaleY, { toValue: 1, friction: 6, tension: 250, useNativeDriver: true }),
        ]),
      ]);

    /** Tall-narrow stretch on take-off */
    const hopUp = (dur = 45) =>
      Animated.parallel([
        Animated.timing(scaleX, { toValue: 0.8, duration: dur, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(scaleY, { toValue: 1.25, duration: dur, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]);

    /** Restore scale to 1 */
    const resetScale = (dur = 45) =>
      Animated.parallel([
        Animated.timing(scaleX, { toValue: 1, duration: dur, useNativeDriver: true }),
        Animated.timing(scaleY, { toValue: 1, duration: dur, useNativeDriver: true }),
      ]);

    // ── 🐍 SNAKE ─────────────────────────────────────────────────────────
    let sequence: Animated.CompositeAnimation;

    if (diff < 0) {
      const endTarget = getCellPos(end, color);

      // Vibrate left/right (Faster)
      const vibrateSteps = Array.from({ length: 7 }, (_, i) =>
        Animated.timing(anim, {
          toValue:        { x: fromX + (i % 2 === 0 ? 4 : -4), y: fromY },
          duration:       25,
          easing:         Easing.linear,
          useNativeDriver: true,
        })
      );
      vibrateSteps.push(
        Animated.timing(anim, { toValue: { x: fromX, y: fromY }, duration: 25, useNativeDriver: true })
      );

      // Panic squeeze
      const panicSqueeze = Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleX, { toValue: 1.3,  duration: 50, useNativeDriver: true }),
          Animated.timing(scaleY, { toValue: 0.7,  duration: 50, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scaleX, { toValue: 0.85, duration: 40, useNativeDriver: true }),
          Animated.timing(scaleY, { toValue: 1.2,  duration: 40, useNativeDriver: true }),
        ]),
      ]);

      // Fast slide ripple
      const slideRipple = Animated.sequence(
        Array(3).fill(0).flatMap(() => [
          Animated.parallel([
            Animated.timing(scaleX, { toValue: 1.1, duration: 100, useNativeDriver: true }),
            Animated.timing(scaleY, { toValue: 0.9, duration: 100, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(scaleX, { toValue: 0.9, duration: 100, useNativeDriver: true }),
            Animated.timing(scaleY, { toValue: 1.1, duration: 100, useNativeDriver: true }),
          ]),
        ])
      );

      sequence = Animated.sequence([
        Animated.parallel([
          Animated.sequence(vibrateSteps),
          panicSqueeze,
        ]),
        Animated.parallel([
          Animated.timing(anim, {
            toValue:         endTarget,
            duration:        650, // Much faster slide
            easing:          Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          slideRipple,
        ]),
        squashLand(0.8),
      ]);
      
      // Play sound after a short delay to sync with the slide start
      setTimeout(() => { playSnakeDropSound(); }, 100);

    // ── 🚶 WALK (1–6 cells) ───────────────────────────────────────────────
    } else if (diff <= 6) {
      const targets = Array.from({ length: diff }, (_, i) =>
        getCellPos(end - diff + 1 + i, color)
      );

      const animateHop = (idx: number) => {
        if (idx >= targets.length) return;
        
        const target = targets[idx];
        const prevTarget = idx === 0 ? { x: fromX, y: fromY } : targets[idx - 1];
        const isFinal = idx === targets.length - 1;
        const peakX = lerp(prevTarget.x, target.x, 0.5);
        const peakY = lerp(prevTarget.y, target.y, 0.5) - cellSize * 0.38;

        playMoveSound();

        const hopAnim = Animated.sequence([
          Animated.parallel([
            hopUp(100),
            Animated.timing(anim, { toValue: { x: peakX, y: peakY }, duration: 100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          ]),
          Animated.parallel([
            resetScale(100),
            Animated.timing(anim, { toValue: target, duration: 100, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          ]),
          ...(isFinal ? [squashLand(0.9, 30)] : []),
        ]);

        movementAnim.current = hopAnim;
        hopAnim.start(() => animateHop(idx + 1));
      };

      animateHop(0);
      return; // Handled by recursive animateHop

    // ── 🪜 LADDER ────────────────────────────────────────────────────────
    } else {
      const endTarget = getCellPos(end, color);

      const anticipate = Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleX, { toValue: 1.3,  duration: 60, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.timing(scaleY, { toValue: 0.7,  duration: 60, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scaleX, { toValue: 0.7,  duration: 50,  easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(scaleY, { toValue: 1.45, duration: 50,  easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
      ]);

      const arcWaypoints = arcPath(
        fromX, fromY,
        endTarget.x, endTarget.y,
        6, // Fewer waypoints = faster execution
        -cellSize * 1.6,
      );

      const animateClimb = (idx: number) => {
        if (idx >= arcWaypoints.length) {
          playTokenFinishSound();
          squashLand(1.0, 40).start();
          return;
        }
        
        if (idx % 2 === 0) playMoveSound();

        const climbStep = Animated.timing(anim, {
          toValue: arcWaypoints[idx],
          duration: idx === arcWaypoints.length - 1 ? 100 : 60,
          easing: Easing.linear,
          useNativeDriver: true,
        });

        movementAnim.current = climbStep;
        climbStep.start(() => animateClimb(idx + 1));
      };

      const climbScale = Animated.sequence([
        ...Array(3).fill(0).flatMap(() => [
          Animated.parallel([
            Animated.timing(scaleX, { toValue: 0.88, duration: 80, useNativeDriver: true }),
            Animated.timing(scaleY, { toValue: 1.15, duration: 80, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(scaleX, { toValue: 1.12, duration: 80, useNativeDriver: true }),
            Animated.timing(scaleY, { toValue: 0.88, duration: 80, useNativeDriver: true }),
          ]),
        ]),
        Animated.parallel([
          Animated.spring(scaleX, { toValue: 1, friction: 4, tension: 250, useNativeDriver: true }),
          Animated.spring(scaleY, { toValue: 1, friction: 4, tension: 250, useNativeDriver: true }),
        ]),
      ]);

      sequence = Animated.sequence([
        anticipate,
        Animated.parallel([
          climbScale,
          Animated.delay(0), // Dummy to allow parallel start
        ]),
      ]);

      // Start the position animation separately since it's recursive
      setTimeout(() => { animateClimb(0); }, 300); // Wait for anticipation
    }

    movementAnim.current = sequence;
    sequence.start(({ finished }) => {
      if (finished) movementAnim.current = null;
    });

  }, [position]);

  // ── Render ────────────────────────────────────────────────────────────────
  const tokenGlow = GLOW_COLORS[color] || '#FFF';
  const isYellow  = color === 'yellow';
  const tokenSize = cellSize * (isYellow ? 0.85 : 0.95);

  return (
    /*
     * offsetWrapper is given full token size with negative margins to center it
     * on the coordinate. This completely eliminates the 1x1 Android clipping bug.
     */
    <View style={[st.offsetWrapper, { 
      left: offset.dx, 
      top: offset.dy, 
      width: tokenSize, 
      height: tokenSize, 
      marginLeft: -tokenSize / 2, 
      marginTop: -tokenSize / 2 
    }]}>
      <Animated.View 
        style={[st.movementContainer, { 
          width: tokenSize, 
          height: tokenSize, 
          transform: anim.getTranslateTransform() 
        }]}
      >
        <View style={[st.container, { width: tokenSize, height: tokenSize }]}>

          {/* Layer 1 — far outer ring, slow inverse pulse */}
          {isActive && isOnBoard && (
            <Animated.View style={[st.outerRing, {
              width:        tokenSize + 28,
              height:       tokenSize + 28,
              borderRadius: (tokenSize + 28) / 2,
              borderColor:  tokenGlow,
              opacity:      pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.15] }),
              shadowColor:  tokenGlow,
              shadowRadius: 10,
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }]
            }]} />
          )}

          {/* Layer 2 — gold active spotlight ring */}
          {isActive && isOnBoard && (
            <Animated.View style={[st.activeSpotlight, {
              width:        tokenSize + 14,
              height:       tokenSize + 14,
              borderRadius: (tokenSize + 14) / 2,
              shadowRadius: 12,
              opacity:      fastPulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
              transform: [{ scale: fastPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }]
            }]} />
          )}

          {/* Layer 3 — color halo, wide diffuse bloom */}
          {isOnBoard && (
            <Animated.View style={[st.haloOuter, {
              width:           tokenSize + (isActive ? 18 : 10),
              height:          tokenSize + (isActive ? 18 : 10),
              borderRadius:    (tokenSize + 18) / 2,
              backgroundColor: tokenGlow,
              opacity:         pulse.interpolate({
                 inputRange:  [0, 1],
                 outputRange: isActive ? [0.22, 0.42] : [0.10, 0.22],
              }),
              shadowColor:  tokenGlow,
              shadowRadius: isActive ? 18 : 9,
              // elevation removed from animation to keep on native thread
            }]} />
          )}

          {/* Layer 4 — color halo, tight bright core */}
          {isOnBoard && (
            <Animated.View style={[st.haloInner, {
              width:           tokenSize + (isActive ? 6 : 2),
              height:          tokenSize + (isActive ? 6 : 2),
              borderRadius:    (tokenSize + 6) / 2,
              backgroundColor: tokenGlow,
              opacity:         fastPulse.interpolate({
                 inputRange:  [0, 1],
                 outputRange: isActive ? [0.45, 0.75] : [0.20, 0.35],
              }),
              shadowColor:  tokenGlow,
              shadowRadius: isActive ? 10 : 4,
              // elevation removed from animation
            }]} />
          )}

          {/* Layer 5 — pawn with 2-axis squash-and-stretch */}
          <Animated.View style={[st.pawnWrap, {
            shadowColor:   isActive ? '#FFD700' : tokenGlow,
            shadowOffset:  { width: 0, height: isActive ? 5 : 2 },
            shadowOpacity: isActive ? 1.0 : 0.55,
            shadowRadius:  isActive ? 8 : 4,
            elevation:     isActive ? 20 : 7,
            width:         tokenSize,
            height:        tokenSize,
            transform:     [{ scaleX }, { scaleY }],
          }]}>
            <Image
              source={TOKEN_IMAGES[color] || TOKEN_IMAGES.green}
              style={[st.image, isKicked && { opacity: 0.3, tintColor: '#888' }]}
              contentFit="contain"
            />
          </Animated.View>

        </View>
      </Animated.View>
    </View>
  );
}, (prev, next) => (
  prev.position === next.position &&
  prev.isActive === next.isActive &&
  prev.isOnBoard === next.isOnBoard &&
  prev.isKicked === next.isKicked &&
  prev.offset.dx === next.offset.dx &&
  prev.offset.dy === next.offset.dy
));

const st = StyleSheet.create({
  offsetWrapper: {
    position: 'absolute',
  },
  movementContainer: {
    position:       'absolute',
    left:           0,
    top:            0,
    alignItems:     'center',
    justifyContent: 'center',
  },
  container: {
    position:       'absolute',
    alignItems:     'center',
    justifyContent: 'center',
  },
  outerRing: {
    position:      'absolute',
    borderWidth:   1.5,
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 1,
  },
  activeSpotlight: {
    position:      'absolute',
    borderWidth:   2.5,
    borderColor:   '#FFD700',
    shadowColor:   '#FFD700',
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 1,
    elevation:     22,
  },
  haloOuter: {
    position:      'absolute',
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 1,
  },
  haloInner: {
    position:      'absolute',
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 1,
  },
  pawnWrap: {
    position:       'absolute',
    alignItems:     'center',
    justifyContent: 'center',
  },
  image: {
    width:  '100%',
    height: '100%',
  },
});