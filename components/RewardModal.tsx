
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: W, height: H } = Dimensions.get('window');

interface RewardModalProps {
  visible: boolean;
  onClose: () => void;
  amount: number;
  prefix?: string;
  unit?: string;
  title?: string;
  subtitle?: string;
  icon?: string;
  color?: string;
}

function Particle({ delay, color, shape }: { delay: number; color: string; shape: 'circle' | 'square' | 'coin' }) {
  const animX = useRef(new Animated.Value(0)).current;
  const animY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 100 + Math.random() * 150;
    const destX = Math.cos(angle) * distance;
    const destY = Math.sin(angle) * distance;

    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(animX, { toValue: destX, duration: 1800, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
        Animated.timing(animY, { toValue: destY, duration: 1800, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
        Animated.timing(scale, { toValue: Math.random() * 1.2 + 0.6, duration: 400, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(rotate, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ]),
      Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, []);

  const rotation = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${Math.random() > 0.5 ? 720 : -720}deg`],
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        shape === 'circle' && { borderRadius: 10 },
        {
          backgroundColor: shape === 'coin' ? '#FFD700' : color,
          opacity,
          transform: [
            { translateX: animX },
            { translateY: animY },
            { scale },
            { rotate: rotation },
          ],
        },
      ]}
    >
      {shape === 'coin' && <MaterialCommunityIcons name="circle-double" size={10} color="#DAA520" />}
    </Animated.View>
  );
}

export function RewardModal({
  visible,
  onClose,
  amount,
  prefix = '₦',
  unit = 'coins',
  title = 'BONUS CLAIMED!',
  subtitle = 'Daily login reward added to wallet',
  icon = 'wallet-giftcard',
  color = '#D4AF37',
}: RewardModalProps) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotation = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (visible) {
      setShowContent(true);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, bounciness: 15, speed: 10, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.loop(
          Animated.timing(rotation, { toValue: 1, duration: 12000, easing: Easing.linear, useNativeDriver: true })
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(tilt, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(tilt, { toValue: -1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ])
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, { toValue: 1.1, duration: 800, useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
          ])
        ),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scale, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => setShowContent(false));
    }
  }, [visible]);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const rotateX = tilt.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-10deg', '10deg'],
  });

  const rotateY = tilt.interpolate({
    inputRange: [-1, 1],
    outputRange: ['10deg', '-10deg'],
  });

  return (
    <View 
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.overlay, 
        { 
          position: 'absolute', 
          bottom: 0, 
          left: 0, 
          width: W, 
          height: H, 
          zIndex: 99999 
        }
      ]}
    >
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      
      <Animated.View style={[styles.container, { opacity, transform: [{ scale }, { perspective: 1000 }, { rotateX }, { rotateY }] }]}>
        {/* Background Rays */}
        <Animated.View style={[styles.raysContainer, { transform: [{ rotate }] }]}>
            {[...Array(12)].map((_, i) => (
              <View key={i} style={[styles.ray, { transform: [{ rotate: `${i * 30}deg` }] }]} />
            ))}
        </Animated.View>

        {/* Particles */}
        <View style={styles.particleField}>
          {[...Array(40)].map((_, i) => (
            <Particle 
              key={i} 
              delay={i * 30} 
              color={i % 3 === 0 ? '#D4AF37' : i % 3 === 1 ? '#F5EFD8' : '#FFD700'} 
              shape={i % 5 === 0 ? 'coin' : i % 2 === 0 ? 'circle' : 'square'}
            />
          ))}
        </View>

        <LinearGradient
          colors={['#0D2A1C', '#050F09']}
          style={styles.card}
        >
          <View style={styles.glow} />
          
          <Animated.View style={[styles.iconCircle, { transform: [{ scale: pulse }] }]}>
            <LinearGradient colors={['#F5D060', '#A07820']} style={styles.iconGrad}>
              <MaterialCommunityIcons name={icon as any} size={40} color="#050F09" />
            </LinearGradient>
          </Animated.View>

          <Animated.Text style={[styles.title, { opacity: pulse.interpolate({ inputRange: [1, 1.1], outputRange: [0.8, 1] }) }]}>{title}</Animated.Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          
          <Animated.View style={[styles.amountWrap, { transform: [{ scale: pulse }] }]}>
            <Text style={styles.amountSign}>{prefix}</Text>
            <Text style={styles.amountText}>{amount}</Text>
          </Animated.View>

          <TouchableOpacity style={styles.btn} onPress={onClose} activeOpacity={0.8}>
            <LinearGradient
              colors={['#D4AF37', '#A07820']}
              style={styles.btnGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.btnText}>AWESOME!</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  container: {
    width: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  raysContainer: {
    position: 'absolute',
    width: 500,
    height: 500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ray: {
    position: 'absolute',
    width: 2,
    height: 600,
    backgroundColor: 'rgba(212,175,55,0.15)',
  },
  particleField: {
    position: 'absolute',
    width: 1,
    height: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  card: {
    width: 280,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.3)',
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  glow: {
    position: 'absolute',
    top: -100,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(212,175,55,0.1)',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    padding: 4,
    backgroundColor: 'rgba(212,175,55,0.2)',
    marginBottom: 20,
  },
  iconGrad: {
    flex: 1,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#D4AF37',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(240,230,192,0.6)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  amountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  amountSign: {
    color: '#F5EFD8',
    fontSize: 24,
    fontWeight: '700',
    marginRight: 4,
  },
  amountText: {
    color: '#F5EFD8',
    fontSize: 48,
    fontWeight: '900',
  },
  btn: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    overflow: 'hidden',
  },
  btnGrad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#050F09',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
