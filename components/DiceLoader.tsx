import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

interface DiceLoaderProps {
  size?: number;
  color?: string;
}

export const DiceLoader = ({ size = 44, color = '#FFD700' }: DiceLoaderProps) => {
  const rollAnim = useRef(new Animated.Value(0)).current;
  const [face, setFace] = useState<any>('dice-6');

  const faces = ['dice-1', 'dice-2', 'dice-3', 'dice-4', 'dice-5', 'dice-6'];

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(rollAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      })
    );
    animation.start();

    // Listen to animation to change dice face
    const listenerId = rollAnim.addListener(({ value }) => {
      const index = Math.floor(value * 6) % 6;
      setFace(faces[index]);
    });

    return () => {
      animation.stop();
      rollAnim.removeListener(listenerId);
    };
  }, []);

  const rotateX = rollAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const rotateY = rollAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.loaderOverlay} pointerEvents="none">
      <Animated.View
        style={[
          styles.diceContainer,
          {
            transform: [
              { perspective: 400 },
              {
                rotateX: rollAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: ['0deg', '180deg', '360deg'],
                }),
              },
              {
                rotateY: rollAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: ['0deg', '90deg', '360deg'],
                }),
              },
              {
                scale: rollAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.9, 1.1, 0.9],
                }),
              },
            ],
          },
        ]}
      >
        <MaterialCommunityIcons name={face} size={size} color={color} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  diceContainer: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f5c535',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
});

export default DiceLoader;