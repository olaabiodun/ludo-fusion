import {
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { Kanit_900Black } from '@expo-google-fonts/kanit';
import { FeatureProvider, useFeatureActive } from '@/lib/FeatureContext';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Image, StyleSheet, View, Animated, Easing } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { usePresence } from '@/lib/usePresence';

function PremiumLoader() {
  const spinValue = useRef(new Animated.Value(0)).current;
  const rollValueX = useRef(new Animated.Value(0)).current;
  const rollValueY = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
    // 1. Sleek, slow clockwise orbit spin
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // 2. High-fidelity fluid X-axis tumble
    Animated.loop(
      Animated.timing(rollValueX, {
        toValue: 1,
        duration: 2200,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    ).start();

    // 3. High-fidelity fluid Y-axis tumble (offset to create expensive organic rotation)
    Animated.loop(
      Animated.timing(rollValueY, {
        toValue: 1,
        duration: 1800,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    ).start();

    // 4. Subtle, high-contrast breathing pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1.06,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 0.94,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const rollX = rollValueX.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const rollY = rollValueY.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={loaderStyles.container}>
      {/* Sleek, ultra-fine dashed gold orbital track */}
      <Animated.View style={[loaderStyles.outerTrack, { transform: [{ rotate: spin }] }]} />

      {/* Elegant, high-contrast 3D-rolling golden dice */}
      <Animated.View
        style={[
          loaderStyles.dice,
          {
            transform: [
              { scale: pulseValue },
              { rotateX: rollX },
              { rotateY: rollY },
            ],
          },
        ]}
      >
        {/* Bright gold pip layout (Classic '5' dots) */}
        <View style={loaderStyles.diceRow}>
          <View style={loaderStyles.pip} />
          <View style={loaderStyles.pip} />
        </View>
        <View style={loaderStyles.diceCenterRow}>
          <View style={loaderStyles.pip} />
        </View>
        <View style={loaderStyles.diceRow}>
          <View style={loaderStyles.pip} />
          <View style={loaderStyles.pip} />
        </View>
      </Animated.View>

      {/* Subtle background glow */}
      <View style={loaderStyles.glowUnderlay} />
    </View>
  );
}

function CustomSplash() {
  return (
    <View style={splashStyles.container}>
      <Image
        source={require('@/assets/images/splashui.png')}
        style={splashStyles.image}
        resizeMode="contain"
      />
      <PremiumLoader />
    </View>
  );
}

function AppStack() {
  const gamblingEnabled = useFeatureActive();

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false, statusBarHidden: true }} />
      <Stack.Screen name="offline" options={{ headerShown: false, statusBarHidden: true, animation: 'slide_from_right' }} />
      <Stack.Screen name="home" options={{ headerShown: false, statusBarHidden: true, contentStyle: { backgroundColor: '#08111b' } }} />
      <Stack.Screen name="profile" options={{ headerShown: false, statusBarHidden: true, animation: 'slide_from_right' }} />
      <Stack.Screen name="leaderboard" options={{ headerShown: false, statusBarHidden: true, animation: 'slide_from_right' }} />
      <Stack.Screen name="friends" options={{ headerShown: false, statusBarHidden: true, animation: 'slide_from_right' }} />
      {gamblingEnabled && (
        <Stack.Screen name="wallet" options={{ headerShown: false, statusBarHidden: true, animation: 'slide_from_right' }} />
      )}
      <Stack.Screen name="history" options={{ headerShown: false, statusBarHidden: true, animation: 'slide_from_right' }} />
      <Stack.Screen name="settings" options={{ headerShown: false, statusBarHidden: true, animation: 'slide_from_right' }} />
      <Stack.Screen name="placeholder" options={{ headerShown: false, statusBarHidden: true, animation: 'fade' }} />
    </Stack>
  );
}

const loaderStyles = StyleSheet.create({
  container: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    position: 'relative',
  },
  outerTrack: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.2,
    borderColor: 'transparent',
    borderTopColor: 'rgba(212, 175, 55, 0.8)',
    borderRightColor: 'rgba(212, 175, 55, 0.8)',
    borderBottomColor: 'rgba(212, 175, 55, 0.15)',
    borderLeftColor: 'rgba(212, 175, 55, 0.15)',
    borderStyle: 'dashed',
  },
  dice: {
    position: 'absolute',
    width: 17,
    height: 17,
    borderRadius: 3.5,
    borderWidth: 1.2,
    borderColor: '#D4AF37',
    backgroundColor: '#0A140F', // deep dark green/black for solid high contrast
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: 2.2,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  diceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  diceCenterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  pip: {
    width: 2.4,
    height: 2.4,
    borderRadius: 1.2,
    backgroundColor: '#FFF3AA', // bright ivory gold for absolute clarity at small size
  },
  glowUnderlay: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(212, 175, 55, 0.02)',
    zIndex: -1,
  },
});

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 520,
    height: 180,
  },
});

export const unstable_settings = {
  anchor: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Kanit_900Black,
  });

  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), 2000);

    async function checkAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setHasSession(!!session);
      } catch (e) {
        console.error('Splash auth check error:', e);
      } finally {
        setIsAuthReady(true);
      }
    }
    checkAuth();

    return () => clearTimeout(timer);
  }, []);

  usePresence();

  useEffect(() => {
    if (isAuthReady && minTimeElapsed && fontsLoaded) {
      if (hasSession) {
        router.replace('/home');
        setTimeout(() => setIsReady(true), 800);
      } else {
        setIsReady(true);
      }
    }
  }, [isAuthReady, minTimeElapsed, fontsLoaded, hasSession]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <FeatureProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <View style={{ flex: 1 }}>
          <AppStack />

          {!isReady && (
            <View style={[StyleSheet.absoluteFill, { zIndex: 99999 }]}>
              <CustomSplash />
            </View>
          )}
        </View>
        <StatusBar hidden={true} />
      </ThemeProvider>
      </FeatureProvider>
    </GestureHandlerRootView>
  );
}
