import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const C = { darkGreen: '#0A2318', gold: '#D4AF37', goldBorder: 'rgba(212,175,55,0.5)' };

export default function PlaceholderScreen({ title = 'Coming Soon', icon = '🚧' }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, bounciness: 8 }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -10, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={s.screen}>
      <LinearGradient colors={[C.darkGreen, '#05110B', '#000']} style={StyleSheet.absoluteFill} />
      <Animated.View style={[s.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <Animated.Text style={[s.icon, { transform: [{ translateY: floatAnim }] }]}>{icon}</Animated.Text>
        <Text style={s.title}>{title}</Text>
        <Text style={s.sub}>This section is under construction.{'\n'}Check back soon!</Text>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>← BACK TO HOME</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center', paddingHorizontal: 32 },
  icon: { fontSize: 72, marginBottom: 24 },
  title: { color: '#D4AF37', fontSize: 22, fontWeight: '900', letterSpacing: 2, textAlign: 'center' },
  sub: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 12, textAlign: 'center', lineHeight: 20 },
  backBtn: {
    marginTop: 32,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)',
    borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12,
  },
  backText: { color: '#D4AF37', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
});
