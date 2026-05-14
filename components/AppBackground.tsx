import React from 'react';
import { ImageBackground, StyleSheet, View, ViewStyle } from 'react-native';

interface AppBackgroundProps {
  children: React.ReactNode;
  overlayOpacity?: number;
  style?: ViewStyle;
}

export const AppBackground = ({ 
  children, 
  overlayOpacity = 0.6, 
  style 
}: AppBackgroundProps) => {
  return (
    <ImageBackground
      source={require('../assets/images/landing_bg.png')}
      style={[styles.bg, style]}
      resizeMode="cover"
    >
      <View style={[styles.overlay, { backgroundColor: `rgba(0,0,0,${overlayOpacity})` }]} />
      {children}
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
});
