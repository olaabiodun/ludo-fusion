import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  DeviceEventEmitter
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, G, Text as SvgText } from 'react-native-svg';
import { playButtonSound } from '@/lib/sounds';

const { width } = Dimensions.get('window');

const C = {
  bg: '#05110B',
  cardGreen: '#0D2A1C',
  gold: '#D4AF37',
  goldBorder: 'rgba(212,175,55,0.4)',
  success: '#27AE60',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.7)',
  textMuted: 'rgba(255,255,255,0.4)',
};

const PRIZES = [
  { value: '10 Coins', color: '#1E5A39', type: 'coins' },
  { value: '50 Gems', color: '#0F301F', type: 'gems' },
  { value: 'Double XP', color: '#D4AF37', type: 'xp' },
  { value: '100 Coins', color: '#1E5A39', type: 'coins' },
  { value: 'Lucky Star', color: '#0F301F', type: 'star' },
  { value: '500 Gems', color: '#D4AF37', type: 'gems' },
  { value: 'Free Spin', color: '#1E5A39', type: 'spin' },
  { value: '250 Coins', color: '#0F301F', type: 'coins' },
];

export function LuckySpinPanel() {
  const [spinning, setSpinning] = useState(false);
  const [prize, setPrize] = useState<typeof PRIZES[number] | null>(null);
  const [showRewardModal, setShowRewardModal] = useState(false);
  
  const spinAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Starting rotation tracking
  const currentRotation = useRef(0);

  const startSpin = () => {
    if (spinning) return;
    setSpinning(true);
    setPrize(null);
    playButtonSound();

    // Generate random loops (5 to 8 full spins) and target slice
    const spins = 5 + Math.floor(Math.random() * 4);
    const targetSlice = Math.floor(Math.random() * PRIZES.length);
    const sliceAngle = 360 / PRIZES.length;
    // Calculate precise target rotation
    const targetDegrees = currentRotation.current + (spins * 360) + (targetSlice * sliceAngle);

    Animated.sequence([
      // Micro press scaling effect on start
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1.05, duration: 150, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: 1, duration: 2500, useNativeDriver: true }),
        Animated.timing(spinAnim, {
          toValue: targetDegrees,
          duration: 4000,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    ]).start(() => {
      currentRotation.current = targetDegrees % 360;
      // Index of landing segment relative to indicator pointing straight down (offset by 180 degrees)
      const winningIndex = (PRIZES.length - 1 - targetSlice) % PRIZES.length;
      const wonPrize = PRIZES[targetSlice];
      setPrize(wonPrize);
      setSpinning(false);
      setShowRewardModal(true);
      
      // Pulse animation for award modal
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 200, useNativeDriver: true }),
        Animated.spring(pulseAnim, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]).start();

      // Trigger standard in-game event for score updating
      if (wonPrize.type === 'coins' || wonPrize.type === 'gems') {
        DeviceEventEmitter.emit('wallet_updated');
      }
    });
  };

  const spinAngle = spinAnim.interpolate({
    inputRange: [0, 36000],
    outputRange: ['0deg', '36000deg'],
  });

  return (
    <View style={s.container}>
      {/* Page Header */}
      <View style={s.header}>
        <Text style={s.eyebrow}>LUCKY WHEEL</Text>
        <Text style={s.pageTitle}>Spin & Win</Text>
        <Text style={s.subtitle}>Spin the daily fortune wheel to claim free tokens, gems, and exclusive boosts!</Text>
      </View>

      {/* Main Wheel Container */}
      <View style={s.wheelCenterWrap}>
        {/* Glow behind wheel */}
        <View style={s.outerGlow} />

        <Animated.View style={[s.wheelHolder, { transform: [{ rotate: spinAngle }, { scale: scaleAnim }] }]}>
          <Svg width={300} height={300} viewBox="0 0 300 300">
            {/* Draw Slices */}
            {PRIZES.map((slice, i) => {
              const startAngle = (i * 360) / PRIZES.length;
              const endAngle = ((i + 1) * 360) / PRIZES.length;
              
              // Conver angles to coordinates
              const radStart = (Math.PI * (startAngle - 90)) / 180;
              const radEnd = (Math.PI * (endAngle - 90)) / 180;
              const x1 = 150 + 135 * Math.cos(radStart);
              const y1 = 150 + 135 * Math.sin(radStart);
              const x2 = 150 + 135 * Math.cos(radEnd);
              const y2 = 150 + 135 * Math.sin(radEnd);

              const pathData = `M 150 150 L ${x1} ${y1} A 135 135 0 0 1 ${x2} ${y2} Z`;

              // Angle for text placement
              const textAngle = startAngle + (360 / PRIZES.length) / 2;
              const radText = (Math.PI * (textAngle - 90)) / 180;
              const tx = 150 + 82 * Math.cos(radText);
              const ty = 150 + 82 * Math.sin(radText);

              return (
                <G key={i}>
                  <Path
                    d={pathData}
                    fill={slice.color}
                    stroke={C.bg}
                    strokeWidth={2}
                  />
                  <SvgText
                    x={tx}
                    y={ty}
                    fill={C.textPrimary}
                    fontSize={10}
                    fontWeight="800"
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    transform={`rotate(${textAngle}, ${tx}, ${ty})`}
                  >
                    {slice.value}
                  </SvgText>
                </G>
              );
            })}
            {/* Inner Border Ring */}
            <Circle cx={150} cy={150} r={135} stroke={C.gold} strokeWidth={2} fill="none" />
            <Circle cx={150} cy={150} r={140} stroke="rgba(212,175,55,0.2)" strokeWidth={4} fill="none" />
          </Svg>

          {/* Golden Outer Nodes */}
          {PRIZES.map((_, i) => {
            const angle = (i * 360) / PRIZES.length;
            const rad = (Math.PI * (angle - 90)) / 180;
            const nodeX = 150 + 140 * Math.cos(rad);
            const nodeY = 150 + 140 * Math.sin(rad);
            return (
              <View
                key={i}
                style={[
                  s.wheelNode,
                  { left: nodeX - 4, top: nodeY - 4 }
                ]}
              />
            );
          })}
        </Animated.View>

        {/* Center Spinner Core */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={[s.spinButton, spinning && s.spinButtonDisabled]}
          onPress={startSpin}
          disabled={spinning}
        >
          <LinearGradient
            colors={['#FFDF00', '#D4AF37', '#996515']}
            style={s.spinButtonInner}
          >
            <Text style={s.spinButtonText}>{spinning ? 'SPINNING' : 'SPIN'}</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Pointer Needle pointing straight down to segment */}
        <View style={s.pointerNeedle}>
          <Svg width={18} height={24} viewBox="0 0 18 24" fill="none">
            <Path d="M9 24L18 6H0L9 24Z" fill={C.gold} />
          </Svg>
        </View>
      </View>

      {/* Daily Stats Grid */}
      <View style={s.statsGrid}>
        <View style={s.statCard}>
          <MaterialCommunityIcons name="ticket-percent-outline" size={20} color={C.gold} />
          <Text style={s.statVal}>1 / 1</Text>
          <Text style={s.statLabel}>Free Spins Today</Text>
        </View>
        <View style={s.statCard}>
          <MaterialCommunityIcons name="star-circle-outline" size={20} color={C.success} />
          <Text style={s.statVal}>XP Bonus</Text>
          <Text style={s.statLabel}>Available</Text>
        </View>
      </View>

      {/* Glowing Reward Popup Modal */}
      {showRewardModal && prize && (
        <View style={StyleSheet.absoluteFillObject}>
          <BlurOverlay />
          <View style={s.rewardModalContainer}>
            <Animated.View style={[s.rewardCard, { transform: [{ scale: pulseAnim }] }]}>
              <LinearGradient
                colors={['rgba(26,77,46,0.95)', 'rgba(5,17,11,0.98)']}
                style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
              />
              <View style={s.rewardGlow} />

              <MaterialCommunityIcons
                name={
                  prize.type === 'coins' ? 'database' :
                  prize.type === 'gems' ? 'diamond-stone' :
                  prize.type === 'xp' ? 'star-shooting-outline' :
                  'gift-outline'
                }
                size={54}
                color={C.gold}
                style={{ alignSelf: 'center', marginBottom: 12 }}
              />

              <Text style={s.rewardTitle}>CONGRATULATIONS!</Text>
              <Text style={s.rewardDesc}>You successfully unlocked:</Text>
              <Text style={s.rewardVal}>{prize.value}</Text>

              <TouchableOpacity
                style={s.claimButton}
                activeOpacity={0.8}
                onPress={() => {
                  playButtonSound();
                  setShowRewardModal(false);
                }}
              >
                <Text style={s.claimText}>CLAIM NOW</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      )}
    </View>
  );
}

function BlurOverlay() {
  return (
    <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 100 }} />
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: C.bg,
  },
  header: {
    marginBottom: 20,
  },
  eyebrow: {
    color: C.gold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  pageTitle: {
    color: C.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    fontFamily: 'Kanit_900Black',
    marginVertical: 4,
  },
  subtitle: {
    color: C.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  wheelCenterWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 24,
    height: 320,
    position: 'relative',
  },
  outerGlow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(212,175,55,0.06)',
    borderColor: 'rgba(212,175,55,0.1)',
    borderWidth: 1,
  },
  wheelHolder: {
    width: 300,
    height: 300,
    borderRadius: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelNode: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: C.gold,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
  },
  pointerNeedle: {
    position: 'absolute',
    top: -2,
    alignItems: 'center',
    zIndex: 10,
  },
  spinButton: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    padding: 3,
    backgroundColor: C.bg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 6,
    zIndex: 15,
  },
  spinButtonDisabled: {
    opacity: 0.9,
  },
  spinButtonInner: {
    flex: 1,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  spinButtonText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.cardGreen,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  statVal: {
    color: C.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  statLabel: {
    color: C.textMuted,
    fontSize: 9,
    fontWeight: '600',
  },
  rewardModalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 101,
  },
  rewardCard: {
    width: width * 0.8,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.goldBorder,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  rewardGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(212,175,55,0.08)',
    top: -50,
  },
  rewardTitle: {
    color: C.gold,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  rewardDesc: {
    color: C.textSecondary,
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  rewardVal: {
    color: C.textPrimary,
    fontSize: 26,
    fontWeight: '900',
    marginVertical: 14,
    textAlign: 'center',
    textShadowColor: 'rgba(255,255,255,0.2)',
    textShadowRadius: 6,
  },
  claimButton: {
    backgroundColor: C.gold,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginTop: 8,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  claimText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
