import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Dice3D from './Dice3D';

// ─── Constants ──────────────────────────────────────────────────────────────

const DICE_SIZE = 54;

type PLAYER_PIECE = { pos: number; travelCount: number };

interface DiceProps {
  color: string;
  rotate?: boolean;
  player: number;
  data?: PLAYER_PIECE[];
  value?: number;
  onRoll?: () => void;
}

// ─── Main Component ──────────────────────────────────────────────────────────

const Dice: React.FC<DiceProps> = ({ color, rotate, player, value, onRoll }) => {
  const [localDiceNo, setLocalDiceNo] = useState(value || 1);
  const arrowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (value !== undefined) {
      setLocalDiceNo(value);
    }
  }, [value]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(arrowAnim, { toValue: 6, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(arrowAnim, { toValue: -6, duration: 800, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={[st.wrapper, { transform: [{ rotateY: rotate ? '180deg' : '0deg' }] }]}>
      
      {/* Visual Identity Block (Left) */}
      <View style={st.identityBlock}>
        <LinearGradient
          colors={['#1a1a1a', '#0a0a0a']}
          style={st.idGrad}
        >
          <MaterialCommunityIcons name="account" size={18} color="#D4AF37" />
          <Text style={st.idText}>P{player}</Text>
        </LinearGradient>
      </View>

      {/* True Three.js 3D Dice Container */}
      <View style={st.diceContainer}>
        <Dice3D 
          value={localDiceNo} 
          color={color}
          onRoll={onRoll} 
        />
      </View>

      {/* Turn Indicator */}
      <Animated.View style={[st.arrow, { transform: [{ translateX: arrowAnim }] }]}>
        <MaterialCommunityIcons name="menu-right" size={28} color="#FFD700" />
      </Animated.View>
    </View>
  );
};

export default memo(Dice);

const st = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  identityBlock: {
    height: DICE_SIZE * 1.1,
    width: 32,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#D4AF37',
    borderRightWidth: 0,
  },
  idGrad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  idText: {
    color: '#D4AF37',
    fontSize: 9,
    fontWeight: '900',
  },
  diceContainer: {
    width: 84,
    height: 84,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D4AF37',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  arrow: {
    marginLeft: -4,
  },
});
