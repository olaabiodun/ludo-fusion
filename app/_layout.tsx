import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import {
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import React, { useEffect, useState } from 'react';

function CustomSplash() {
  return (
    <View style={splashStyles.container}>
      <Image 
        source={require('@/assets/images/splashui.png')} 
        style={splashStyles.image}
        resizeMode="contain"
      />
    </View>
  );
}

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
  }
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
  });

  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    // 2s minimum splash
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

  useEffect(() => {
    if (isAuthReady && minTimeElapsed && fontsLoaded) {
      if (hasSession) {
        // Now that the Stack is mounted, we can safely replace
        router.replace('/home');
        setTimeout(() => setIsReady(true), 800);
      } else {
        setIsReady(true);
      }
    }
  }, [isAuthReady, minTimeElapsed, fontsLoaded, hasSession]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <View style={{ flex: 1 }}>
          <Stack>
            <Stack.Screen name="index"       options={{ headerShown: false, statusBarHidden: true }} />
            <Stack.Screen name="home"        options={{ headerShown: false, statusBarHidden: true, contentStyle: { backgroundColor: '#08111b' } }} />
            <Stack.Screen name="profile"     options={{ headerShown: false, statusBarHidden: true, animation: 'slide_from_right' }} />
            <Stack.Screen name="leaderboard" options={{ headerShown: false, statusBarHidden: true, animation: 'slide_from_right' }} />
            <Stack.Screen name="friends"     options={{ headerShown: false, statusBarHidden: true, animation: 'slide_from_right' }} />
            <Stack.Screen name="wallet"      options={{ headerShown: false, statusBarHidden: true, animation: 'slide_from_right' }} />
            <Stack.Screen name="history"     options={{ headerShown: false, statusBarHidden: true, animation: 'slide_from_right' }} />
            <Stack.Screen name="settings"    options={{ headerShown: false, statusBarHidden: true, animation: 'slide_from_right' }} />
            <Stack.Screen name="placeholder" options={{ headerShown: false, statusBarHidden: true, animation: 'fade' }} />
          </Stack>
          
          {!isReady && (
            <View style={[StyleSheet.absoluteFill, { zIndex: 99999 }]}>
              <CustomSplash />
            </View>
          )}
        </View>
        <StatusBar hidden={true} />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
