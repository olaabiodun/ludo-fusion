import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, Path, Pattern, Polygon, Rect } from 'react-native-svg';

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const CARD_RED = '#C8000A';
const WHOT_RED = '#FF0000';
const CARD_BLUE = '#C8000A';
const CARD_GREEN = '#C8000A';
const CARD_PURPLE = '#C8000A';
const CARD_ORANGE = '#C8000A';
const CARD_BG = '#ffffffff';
const CARD_BORDER = '#C8000A';
const INNER_FRAME = '#ff9b9bff';

export type WhotShape = 'circle' | 'triangle' | 'cross' | 'square' | 'star' | 'whot';

interface WhotFrontCardProps {
  shape?: WhotShape;
  value?: number | string;
  width?: number;
  height?: number;
  isPlayable?: boolean;
}

const SHAPE_COLORS: Record<WhotShape, string> = {
  circle: CARD_RED,
  triangle: CARD_BLUE,
  cross: CARD_GREEN,
  square: CARD_PURPLE,
  star: CARD_ORANGE,
  whot: WHOT_RED,
};

// ─── Star Path Helper ──────────────────────────────────────────────────────────
// Generates a clean 5-point star at cx,cy with outerR and innerR
function starPoints(cx: number, cy: number, outerR: number, innerR: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

// ─── Mini Shape for Corner Indicators ─────────────────────────────────────────
const MiniShape = ({ shape, size, color }: { shape: WhotShape; size: number; color: string }) => {
  if (shape === 'circle') {
    return (
      <View style={{
        width: size, height: size,
        borderRadius: size / 2,
        backgroundColor: color,
      }} />
    );
  }
  if (shape === 'triangle') {
    return (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Polygon points="50,4 96,88 4,88" fill={color} />
      </Svg>
    );
  }
  if (shape === 'cross') {
    const t = size * 0.32;
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', width: t, height: size, backgroundColor: color, borderRadius: 2 }} />
        <View style={{ position: 'absolute', width: size, height: t, backgroundColor: color, borderRadius: 2 }} />
      </View>
    );
  }
  if (shape === 'square') {
    // Rotated 45° diamond
    return (
      <View style={{
        width: size * 0.82, height: size * 0.82,
        backgroundColor: color,
        transform: [{ rotate: '45deg' }],
        borderRadius: 2,
      }} />
    );
  }
  if (shape === 'star') {
    return (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Polygon points={starPoints(50, 50, 48, 20)} fill={color} />
      </Svg>
    );
  }
  // whot
  return (
    <View style={{
      width: size, height: size,
      borderRadius: size / 2,
      borderWidth: size * 0.12,
      borderColor: color,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Text style={{ color, fontSize: size * 0.22, fontWeight: '900', fontFamily: 'Georgia' }}>W</Text>
    </View>
  );
};

// ─── Large Center Shape ────────────────────────────────────────────────────────
const CenterShape = ({ shape, size, color }: { shape: WhotShape; size: number; color: string }) => {
  if (shape === 'circle') {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <View style={{
          width: size, height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        </View>
      </View>
    );
  }

  if (shape === 'triangle') {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Polygon points="50,4 96,88 4,88" fill={color} />
          {/* Inner highlight */}
          <Polygon points="50,18 82,78 18,78" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
        </Svg>
      </View>
    );
  }

  if (shape === 'cross') {
    const t = size * 0.34;
    const offset = (size - t) / 2;
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {/* Arms */}
        <View style={{ position: 'absolute', width: t, height: size, backgroundColor: color, borderRadius: 6 }} />
        <View style={{ position: 'absolute', width: size, height: t, backgroundColor: color, borderRadius: 6 }} />
        {/* Center highlight */}
        <View style={{ width: t * 0.55, height: t * 0.55, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 4 }} />
      </View>
    );
  }

  if (shape === 'square') {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <View style={{
          width: size, height: size,
          backgroundColor: color,
          borderRadius: 4,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <View style={{
            width: size * 0.68,
            height: size * 0.68,
            borderRadius: 3,
            borderWidth: 3,
            borderColor: 'rgba(255,255,255,0.3)',
          }} />
        </View>
      </View>
    );
  }

  if (shape === 'star') {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          {/* Main star */}
          <Polygon points={starPoints(50, 50, 48, 20)} fill={color} />
          {/* Inner highlight */}
          <Polygon points={starPoints(50, 50, 30, 12)} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" />
        </Svg>
      </View>
    );
  }

  // whot (special wild card design)
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <Pattern id="rays" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
            <Line x1="5" y1="0" x2="5" y2="10" stroke={color} strokeWidth="1" opacity="0.3" />
          </Pattern>
        </Defs>
        {/* Decorative Rays */}
        {[...Array(12)].map((_, i) => (
          <Line
            key={i}
            x1="50" y1="50"
            x2={50 + 45 * Math.cos((i * 30 * Math.PI) / 180)}
            y2={50 + 45 * Math.sin((i * 30 * Math.PI) / 180)}
            stroke={color}
            strokeWidth="3"
            strokeDasharray="4,6"
            opacity="0.4"
          />
        ))}
      </Svg>
      <View style={{ position: 'absolute' }}>
        <Text style={{
          color,
          fontSize: size * 0.38,
          fontFamily: 'Kanit_900Black',
          letterSpacing: 1,
          textAlign: 'center',
        }}>WHOT!</Text>
      </View>
    </View>
  );
};

// ─── Corner Indicator ──────────────────────────────────────────────────────────
const CornerIndicator = ({
  value, shape, color, scale,
}: {
  value: number | string;
  shape: WhotShape;
  color: string;
  scale: number;
}) => {
  const numSize = 72 * scale;
  const miniSize = 38 * scale;

  return (
    <View style={{ alignItems: 'flex-start', gap: 0, width: 140 * scale, padding: 5 }}>
      <Text
        numberOfLines={1}
        style={{
          color,
          fontSize: numSize,
          fontFamily: 'Kanit_900Black',
          lineHeight: numSize * 1,
          includeFontPadding: false,
          textAlignVertical: 'top',
          textAlign: 'left',
          marginTop: -5 * scale,
          letterSpacing: -1 * scale,
          
        }}>
        {value}
      </Text>
      <View style={{ marginTop: 2 * scale }}>
        <MiniShape shape={shape} size={miniSize} color={color} />
      </View>
    </View>
  );
};

// ─── Decorative Corner Ornament (SVG) ─────────────────────────────────────────
const CornerOrnament = ({ size, color, flip }: { size: number; color: string; flip?: boolean }) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    style={flip ? { transform: [{ rotate: '180deg' }] } : undefined}
  >
    {/* L-bracket lines */}
    <Path d="M4,36 L4,4 L36,4" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    {/* Corner dot */}
    {/* Small tick marks */}
    <Line x1="4" y1="12" x2="8" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <Line x1="4" y1="20" x2="8" y2="20" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <Line x1="12" y1="4" x2="12" y2="8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <Line x1="20" y1="4" x2="20" y2="8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </Svg>
);

// ─── Background Texture Pattern ────────────────────────────────────────────────
const CardBackground = ({ width, height }: { width: number; height: number }) => (
  <Svg
    width={width}
    height={height}
    style={StyleSheet.absoluteFillObject}
  >
    <Defs>
      <Pattern id="dots" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
        <Circle cx="8" cy="8" r="1" fill={CARD_BORDER} opacity="0.5" />
      </Pattern>
    </Defs>
    <Rect width={width} height={height} fill="url(#dots)" />
  </Svg>
);

// ─── Main Component ────────────────────────────────────────────────────────────
export function WhotFrontCard({
  shape = 'circle',
  value = 13,
  width = 280,
  height = 392,
  isPlayable = false,
}: WhotFrontCardProps) {
  const color = SHAPE_COLORS[shape];
  const scale = width / 280;

  const radius = 20 * scale;

  const padding = 6 * scale;
  const frameInset = 6 * scale;
  const frameRadius = 14 * scale;
  const centerSize = 185 * scale;
  const ornamentSize = 32 * scale;

  const pulse = useSharedValue(0.4);
  React.useEffect(() => {
    if (isPlayable) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800 }),
          withTiming(0.4, { duration: 800 })
        ),
        -1,
        true
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = 0.4;
    }
  }, [isPlayable]);

  const animatedPlayableStyle = useAnimatedStyle(() => ({
    opacity: isPlayable ? pulse.value : 0,
    borderWidth: 2.5 + (pulse.value * 1),
  }));

  return (
    <View style={[styles.card, { width, height, borderRadius: radius }]}>
      {isPlayable && (
        <Animated.View style={[
          StyleSheet.absoluteFillObject,
          styles.playableCard,
          { borderRadius: radius },
          animatedPlayableStyle
        ]} />
      )}

      {/* Dot-grid background texture */}

      {/* Inner decorative frame */}
      <View style={[
        styles.innerFrame,
        {
          top: frameInset,
          left: frameInset,
          right: frameInset,
          bottom: frameInset,
          borderRadius: frameRadius,
          borderColor: INNER_FRAME,
          overflow: 'hidden',
        },
      ]} />

      {/* TOP-LEFT: ornament + indicator */}
      <View style={[styles.cornerTL, { top: padding, left: padding }]}>
        <CornerOrnament size={ornamentSize} color={INNER_FRAME} />
        <View style={{ position: 'absolute', top: -8 * scale, left: -8 * scale }}>
          <CornerIndicator value={value} shape={shape} color={color} scale={scale} />
        </View>
      </View>

      {/* BOTTOM-RIGHT: ornament + indicator (rotated 180°) */}
      <View style={[
        styles.cornerBR,
        {
          bottom: padding,
          right: padding,
          transform: [{ rotate: '180deg' }],
        },
      ]}>
        <CornerOrnament size={ornamentSize} color={INNER_FRAME} />
        <View style={{ position: 'absolute', top: -6 * scale, left: -6 * scale }}>
          <CornerIndicator value={value} shape={shape} color={color} scale={scale} />
        </View>
      </View>

      {/* Center shape */}
      <View style={styles.center}>
        <CenterShape shape={shape} size={centerSize} color={color} />
      </View>

    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'visible',
  },
  innerFrame: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerTL: {
    position: 'absolute',
  },
  cornerBR: {
    position: 'absolute',
  },
  playableCard: {
    borderColor: '#34C759',
    borderStyle: 'dashed',
    zIndex: 10,
  },
});

export default WhotFrontCard;