import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WhotFrontCard, WhotShape } from './WhotFrontCard';
import { rs, C } from './WhotUtils';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface ShapeSelectionOverlayProps {
  visible: boolean;
  onSelect: (shape: WhotShape) => void;
}

export function ShapeSelectionOverlay({ visible, onSelect }: ShapeSelectionOverlayProps) {
  const shapes: WhotShape[] = ['circle', 'triangle', 'cross', 'square', 'star'];

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="auto">
      <View style={styles.box}>
        <Text style={styles.title}>CHOOSE SHAPE</Text>
        <View style={styles.grid}>
          {shapes.map(shape => (
            <TouchableOpacity
              key={shape}
              style={styles.item}
              onPress={() => onSelect(shape)}
            >
              <WhotFrontCard shape={shape} value="" width={rs(32)} height={rs(45)} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
  },
  box: {
    width: rs(310),
    backgroundColor: '#1A1A1A',
    borderRadius: rs(16),
    paddingVertical: rs(10),
    paddingHorizontal: rs(8),
    borderWidth: 1.5,
    borderColor: 'rgba(255,59,48,0.3)', // Red theme border
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 20,
    
  },
  title: {
    color: '#FFD030',
    fontSize: rs(11),
    fontWeight: '900',
    marginBottom: rs(12),
    letterSpacing: 1.5,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: rs(8),
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: rs(6),
    borderRadius: rs(10),
    width: rs(50),
    height: rs(60),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
});
