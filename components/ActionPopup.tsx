import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
    StyleSheet,
    Text,
    View
} from 'react-native';
import { animated, easings, useSpring } from '@react-spring/native';
import { Seat, getSeatScreenPos, rs } from './WhotUtils';

// ─── Per-action theming ───────────────────────────────────────────────────────
interface ActionConfig {
  emoji: string;
  colors: [string, string, string];
  border: string;
  text: string;
  glow: string;
  label?: string;
}

const CONFIGS: Record<string, ActionConfig> = {
  'pick2':          { emoji: '✌️', colors: ['#FF3B30','#D70015','#8E0000'], border: '#FF3B30', text: '#FFEBEB', glow: '#FF3B30' },
  'pick3':          { emoji: '🃏', colors: ['#FF3B30','#D70015','#8E0000'], border: '#FF3B30', text: '#FFEBEB', glow: '#FF3B30' },
  'pick4':          { emoji: '💀', colors: ['#FF3B30','#D70015','#8E0000'], border: '#FF3B30', text: '#FFEBEB', glow: '#FF3B30' },
  'general-market': { emoji: '🌊', colors: ['#FF3B30','#D70015','#8E0000'], border: '#FF3B30', text: '#FFEBEB', glow: '#FF3B30', label: 'GENERAL MARKET' },
  'suspension':     { emoji: '🚫', colors: ['#FF3B30','#D70015','#8E0000'], border: '#FF3B30', text: '#FFEBEB', glow: '#FF3B30', label: 'SUSPENDED!' },
  'whot':           { emoji: '👑', colors: ['#FF3B30','#D70015','#8E0000'], border: '#FF3B30', text: '#FFEBEB', glow: '#FF3B30', label: 'WHOT!' },
  'hold-on':        { emoji: '✋', colors: ['#FF3B30','#D70015','#8E0000'], border: '#FF3B30', text: '#FFEBEB', glow: '#FF3B30', label: 'HOLD ON!' },
  'change-color':   { emoji: '🎨', colors: ['#FF3B30','#D70015','#8E0000'], border: '#FF3B30', text: '#FFEBEB', glow: '#FF3B30', label: 'CHANGE COLOR' },
  'normal':         { emoji: '🃏', colors: ['#FF3B30','#330000','#110000'], border: 'rgba(255,255,255,0.25)', text: '#F9FAFB', glow: 'rgba(255,255,255,0.2)' },
  'not-your-turn':  { emoji: '⏳', colors: ['#FF3B30','#330000','#110000'], border: 'rgba(255,255,255,0.25)', text: '#F9FAFB', glow: 'rgba(255,255,255,0.2)', label: "NOT YOUR TURN!" },
  'already-rolled': { emoji: '🎲', colors: ['#FF3B30','#330000','#110000'], border: 'rgba(255,255,255,0.25)', text: '#F9FAFB', glow: 'rgba(255,255,255,0.2)', label: "MOVE A TOKEN!" },
  'timeout':        { emoji: '⏰', colors: ['#FF3B30','#D70015','#8E0000'], border: '#FF3B30', text: '#FFF', glow: '#FF3B30', label: "TIME OUT!" },
  'time-warning':   { emoji: '⏳', colors: ['#FFD030','#FF9500','#8E5C00'], border: '#FFD030', text: '#1A1100', glow: '#FFD030', label: "30 SECONDS LEFT!" },
  'six':            { emoji: '🎲', colors: ['#FF3B30','#D70015','#8E0000'], border: '#FF3B30', text: '#FFEBEB', glow: '#FF3B30', label: "SIX! ROLL AGAIN" },
  'capture':        { emoji: '⚔️', colors: ['#FF3B30','#D70015','#8E0000'], border: '#FF3B30', text: '#FFEBEB', glow: '#FF3B30', label: "CAPTURED! ROLL AGAIN" },
  'home':           { emoji: '🏠', colors: ['#FF3B30','#D70015','#8E0000'], border: '#FF3B30', text: '#FFEBEB', glow: '#FF3B30', label: "HOME! ROLL AGAIN" },
  'defence':        { emoji: '🛡️', colors: ['#007AFF','#0A84FF','#0040DD'], border: '#007AFF', text: '#EBF5FF', glow: '#007AFF', label: "DEFENCE!" },
  'continue':       { emoji: '🔄', colors: ['#34C759','#30D158','#248A3D'], border: '#34C759', text: '#EBFBEE', glow: '#34C759', label: "CONTINUE!" },
  'winner':         { emoji: '🏆', colors: ['#FF3B30','#D70015','#8E0000'], border: '#FF3B30', text: '#FFEBEB', glow: '#FF3B30', label: "WINNER!" },
  'last-card':      { emoji: '⚠️', colors: ['#FFCC00','#FF9500','#8E5C00'], border: '#FFCC00', text: '#332200', glow: '#FFCC00', label: 'LAST CARD!' },
};

function getCfg(msg: string): ActionConfig {
  // Normalize: lowercase, strip trailing punctuation (!?.), replace spaces with dash
  // e.g. 'Pick 2!' -> 'pick-2', 'General Market!' -> 'general-market', 'Defence!' -> 'defence'
  const k = msg.toLowerCase().replace(/[!?.]+$/, '').trim().replace(/\s+/g, '-');
  return CONFIGS[k] ?? CONFIGS['normal'];
}

// ─── Particle ─────────────────────────────────────────────────────────────────
function Particle({ color, delay, seed }: { color: string; delay: number; seed: number }) {
  const angle = (seed * 137.508) % 360 * (Math.PI / 180);
  const dist  = rs(24) + (seed % 5) * rs(10);
  const size  = rs(2.5) + (seed % 3) * rs(1);

  const { p } = useSpring({
    from: { p: 0 },
    to: { p: 1 },
    delay,
    config: { duration: 600 + (seed % 4) * 100, easing: easings.easeOutQuad },
  });

  return (
    <animated.View 
      pointerEvents="none" 
      style={{
        position: 'absolute',
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: color,
        opacity: p.to([0, 0.2, 1], [0, 1, 0]),
        transform: [
          { translateX: p.to(v => v * Math.cos(angle) * dist) },
          { translateY: p.to(v => v * Math.sin(angle) * dist) },
          { scale: p.to(v => v < 0.4 ? v / 0.4 : 1 - (v - 0.4) / 0.6) },
        ] as any
      }} 
    />
  );
}

// ─── Shimmer ──────────────────────────────────────────────────────────────────
function Shimmer() {
  const { x } = useSpring({
    from: { x: 0 },
    to: { x: 1 },
    loop: true,
    config: { duration: 1800, easing: easings.linear },
  });

  const startX = -rs(100);
  const endX   = rs(200);

  return (
    <animated.View 
      pointerEvents="none" 
      style={{
        position: 'absolute', top: 0, bottom: 0, width: rs(40),
        backgroundColor: 'rgba(255,255,255,0.22)',
        transform: [
          { translateX: x.to(v => startX + v * (endX - startX)) },
          { skewX: '-20deg' },
        ] as any
      }} 
    />
  );
}

export function ActionPopup({ 
  message, 
  seat, 
  onComplete 
}: { 
  message: string; 
  seat: Seat; 
  onComplete: () => void 
}) {

  const cfg   = getCfg(message);
  const target = getSeatScreenPos(seat);
  const label  = cfg.label ?? message.toUpperCase();

  const W = rs(135);
  const H = rs(43);

  const isRightSide  = seat === 'RIGHT' || seat === 'TR' || seat === 'BR';
  const isLeftSide   = seat === 'LEFT'  || seat === 'TL' || seat === 'BL';

  let offsetY = seat === 'DOWN' ? -rs(65) : (seat === 'TOP' ? rs(65) : 0);
  let offsetX = seat === 'DOWN' ? -rs(180) : (isLeftSide ? rs(100) : (isRightSide ? -rs(100) : 0));
  
  // Refine offsets for Ludo corners specifically
  if (['TL', 'TR'].includes(seat)) {
    offsetY = rs(85); // Move down below top chips
  } else if (['BL', 'BR'].includes(seat)) {
    offsetY = -rs(85); // Move up above bottom chips
  }

  if (['TL', 'BL'].includes(seat)) {
    offsetX = -rs(140); // Move far enough right to be in front of left chips
  } else if (['TR', 'BR'].includes(seat)) {
    offsetX = -rs(260); // Move far enough left to be in front of right chips (NEGATIVE)
  }

  const { entrance } = useSpring({
    from: { entrance: 0 },
    to: async (next) => {
      await next({ entrance: 1, config: { duration: 200, easing: easings.easeOutBack } });
      await new Promise(r => setTimeout(r, 500));
      await next({ entrance: 0, config: { duration: 200, easing: easings.easeInQuad } });
      onComplete();
    },
  });

  const { float } = useSpring({
    from: { float: 0 },
    to: { float: 1 },
    loop: { reverse: true },
    config: { duration: 800, easing: easings.easeInOutQuad },
  });

  const { glowVal } = useSpring({
    from: { glowVal: 0 },
    to: { glowVal: 1 },
    loop: { reverse: true },
    config: { duration: 600, easing: easings.easeInOutQuad },
  });

  const floatDist = -rs(6);

  const pColors = [cfg.colors[0], cfg.colors[1], '#fff', cfg.text];

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]} pointerEvents="none">
      <animated.View 
        shouldRasterizeIOS={true}
        style={{
        position: 'absolute',
        left: target.x + offsetX - W / 2,
        top:  target.y + offsetY - H / 2,
        width: W, height: H,
        opacity: entrance,
        transform: [
          { scale: entrance.to(v => 0.5 + v * 0.5) },
          { rotate: entrance.to(v => `${-15 + v * 15}deg`) },
          { translateY: float.to([0, 1], [0, floatDist]) as any }
        ] as any
      }}>

        {/* Glow Halo */}
        <animated.View style={{
          position: 'absolute',
          top: -rs(10), left: -rs(10), right: -rs(10), bottom: -rs(10),
          borderRadius: rs(24),
          backgroundColor: cfg.glow,
          shadowColor: cfg.glow,
          shadowOpacity: 0.8,
          shadowRadius: rs(20),
          shadowOffset: { width: 0, height: 0 },
          opacity: glowVal.to([0, 1], [0.4, 0.9]),
          transform: [{ scale: glowVal.to([0, 1], [1, 1.1]) }] as any
        }} />

        {/* Particles */}
        <View style={{ position: 'absolute', left: W / 2, top: H / 2 }}>
          {Array.from({ length: 14 }).map((_, i) => (
            <Particle key={i} color={pColors[i % pColors.length]} delay={i * 20} seed={i + 1} />
          ))}
        </View>

        {/* Main Card UI */}
        <View style={{
          flex: 1, borderRadius: rs(12), overflow: 'hidden',
          borderWidth: rs(1), borderColor: cfg.border,
          shadowColor: '#000', shadowOpacity: 0.3,
          shadowRadius: rs(8), shadowOffset: { width: 0, height: rs(4) },
          elevation: 10,
        }}>
          <LinearGradient colors={cfg.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.15)' }} />
          <Shimmer />

          {/* Highlight Edge */}
          <View style={{ position: 'absolute', top: 0, left: rs(10), right: rs(10), height: rs(1), backgroundColor: 'rgba(255,255,255,0.4)' }} />

          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: rs(10), gap: rs(10) }}>
            <View style={{
              width: rs(22), height: rs(22), borderRadius: rs(6),
              backgroundColor: 'rgba(0,0,0,0.3)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: rs(12) }}>{cfg.emoji}</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: rs(6), fontWeight: '900', letterSpacing: rs(1.2) }}>
                ACTION
              </Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{
                color: cfg.text, fontSize: rs(10), fontWeight: '900', fontStyle: 'italic',
              }}>
                {label}
              </Text>
            </View>
          </View>
        </View>
      </animated.View>
    </View>
  );
}