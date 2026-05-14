import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SW, height: SH } = Dimensions.get('window');
const IS_LANDSCAPE = SW > SH;

interface GameQuitModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  stake?: number;
}

export function GameQuitModal({
  visible,
  onCancel,
  onConfirm,
  title = ' ALERT',
  message,
  stake = 0,
}: GameQuitModalProps) {
  const displayMessage = message || (stake > 0 
    ? 'Forfeiting now results in total loss of your stake.'
    : 'Leaving will end the current match.');

  const anim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      anim.setValue(0);
      contentAnim.setValue(0);
      
      Animated.sequence([
        Animated.spring(anim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 60,
          friction: 7,
        }),
        Animated.timing(contentAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [visible]);

  const triggerShake = () => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 6,  duration: 40, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -6, duration: 40, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 4,  duration: 40, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0,  duration: 40, useNativeDriver: true }),
    ]).start();
  };

  const handleCancel = () => {
    triggerShake();
    setTimeout(onCancel, 200);
  };

  if (!visible) return null;

  const cardScale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1.1, 1],
  });

  const cardSkew = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-6deg'],
  });

  return (
    <View style={st.overlay}>
      <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill} />
      
      {/* Backdrop tap = cancel */}
      <TouchableOpacity
        activeOpacity={1}
        style={StyleSheet.absoluteFill}
        onPress={handleCancel}
      />

      <Animated.View
        style={[
          st.card,
          {
            opacity: anim,
            transform: [
              { scale: cardScale },
              { skewX: cardSkew },
              { translateX: shake },
            ],
          },
        ]}
      >
        {/* Glossy Metallic Base */}
        <LinearGradient 
          colors={['rgba(25, 20, 10, 0.98)', 'rgba(10, 5, 0, 0.99)']} 
          style={StyleSheet.absoluteFill} 
        />
        
        {/* Tactical Border */}
        <View style={[StyleSheet.absoluteFill, { borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(212, 168, 39, 0.4)' }]} />
        <View style={[StyleSheet.absoluteFill, { borderRadius: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', margin: 1 }]} />

        {/* Content Area */}
        <Animated.View style={{ opacity: contentAnim, padding: 16 }}>
          
          {/* Tactical Header */}
          <View style={st.headerRow}>
            <View style={st.warningBadge}>
              <MaterialCommunityIcons name="shield-alert" size={14} color="#000" />
              <Text style={st.warningText}>{title}</Text>
            </View>
        
          </View>

          <View style={st.mainBody}>
             <View style={st.iconContainer}>
                <MaterialCommunityIcons name="sword-cross" size={28} color="rgba(212, 168, 39, 0.8)" />
             </View>
             <View style={{ flex: 1 }}>
                <Text style={st.bodyTitle}>CONFIRM RETREAT?</Text>
                <Text style={st.bodyMsg}>{displayMessage}</Text>
             </View>
          </View>

          {stake > 0 && (
            <View style={st.stakeBox}>
               <LinearGradient 
                colors={['rgba(212, 168, 39, 0.15)', 'transparent']} 
                style={StyleSheet.absoluteFill} 
                start={{x:0,y:0.5}} end={{x:1,y:0.5}}
               />
               <Text style={st.stakeLabel}>STAKE AT RISK</Text>
               <Text style={st.stakeVal}>₦{stake.toLocaleString()}</Text>
            </View>
          )}

          {/* Actions */}
          <View style={st.actions}>
            <TouchableOpacity
              style={st.btnCancel}
              onPress={handleCancel}
              activeOpacity={0.7}
            >
              <Text style={st.btnTextCancel}>CANCEL</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={st.btnQuit}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <LinearGradient 
                colors={['#FFE57A', '#D4A827', '#7A5500']} 
                style={StyleSheet.absoluteFill} 
                start={{x:0,y:0}} end={{x:1,y:1}}
              />
              <Text style={st.btnTextQuit}>FORFEIT MATCH</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>

        {/* Tactical Corner Detail */}
        <View style={st.cornerDot} />
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 2000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 380,
    borderRadius: 12,
    backgroundColor: '#000',
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#D4A827',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D4A827',
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 4,
    borderRadius: 2,
  },
  warningText: {
    fontFamily: 'Kanit_900Black',
    fontSize: 9,
    color: '#000',
    letterSpacing: 1,
  },
  idCode: {
    opacity: 0.4,
  },
  idCodeText: {
    fontSize: 8,
    color: '#FFF',
    fontFamily: 'monospace',
  },
  mainBody: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(212, 168, 39, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212, 168, 39, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyTitle: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Kanit_900Bold',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  bodyMsg: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    lineHeight: 14,
    fontFamily: 'System',
  },
  stakeBox: {
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 168, 39, 0.2)',
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  stakeLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Kanit_700Bold',
  },
  stakeVal: {
    fontSize: 14,
    color: '#FFE57A',
    fontFamily: 'Kanit_900Black',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  btnCancel: {
    flex: 1,
    height: 34,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  btnQuit: {
    flex: 1.5,
    height: 34,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  btnTextCancel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontFamily: 'Kanit_700Bold',
    letterSpacing: 1,
  },
  btnTextQuit: {
    color: '#000',
    fontSize: 10,
    fontFamily: 'Kanit_900Black',
    letterSpacing: 0.5,
  },
  cornerDot: {
    position: 'absolute',
    bottom: -10,
    right: -10,
    width: 20,
    height: 20,
    backgroundColor: 'rgba(212, 168, 39, 0.3)',
    transform: [{ rotate: '45deg' }],
  }
});