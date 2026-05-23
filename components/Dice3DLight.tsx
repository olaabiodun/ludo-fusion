import { Canvas, useFrame } from '@react-three/fiber/native';
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as THREE from 'three';

const FACE_ROTATIONS: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  2: [0, -Math.PI / 2, 0],
  3: [-Math.PI / 2, 0, 0],
  4: [Math.PI / 2, 0, 0],
  5: [0, Math.PI / 2, 0],
  6: [Math.PI, 0, 0],
};

const FACE_ORDER = [2, 5, 4, 3, 1, 6];

function makeNumberTexture(
  num: number,
  diceR: number, diceG: number, diceB: number,
  pipR: number, pipG: number, pipB: number,
): THREE.DataTexture {
  const SIZE = 64;
  const data = new Uint8Array(SIZE * SIZE * 4);

  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const idx = (py * SIZE + px) * 4;
      const cx = SIZE / 2, cy = SIZE / 2;
      const dx = px - cx, dy = py - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxR = SIZE * 0.35;

      if (dist < maxR) {
        const angle = Math.atan2(dy, dx);
        const spoke = 7;
        const match = Math.abs(Math.cos(angle * spoke / 2)) < 0.15;
        const ring = Math.abs(dist - maxR * 0.5) < 4;
        const isPip = match && (dist > maxR * 0.3);

        if (isPip && num > 0) {
          data[idx] = pipR; data[idx + 1] = pipG; data[idx + 2] = pipB; data[idx + 3] = 255;
        } else {
          data[idx] = diceR; data[idx + 1] = diceG; data[idx + 2] = diceB; data[idx + 3] = 255;
        }
      } else {
        data[idx] = diceR; data[idx + 1] = diceG; data[idx + 2] = diceB; data[idx + 3] = 255;
      }
    }
  }

  // Draw the number
  const center = SIZE / 2;
  const digitPixels: [number, number][] = [];
  const steps = num === 1 ? 1 : num === 2 ? 2 : num === 3 ? 3 : num === 4 ? 4 : num === 5 ? 5 : 6;

  for (let s = 0; s < steps; s++) {
    const t = s / steps;
    const nx = center + (Math.random() - 0.5) * 0;
    const ny = center + (Math.random() - 0.5) * 0;
    digitPixels.push([nx, ny]);
  }

  // Simple pip pattern
  const pipPositions: [number, number][] = [];
  if (num === 1) pipPositions.push([0.5, 0.5]);
  else if (num === 2) pipPositions.push([0.25, 0.25], [0.75, 0.75]);
  else if (num === 3) pipPositions.push([0.25, 0.25], [0.5, 0.5], [0.75, 0.75]);
  else if (num === 4) pipPositions.push([0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]);
  else if (num === 5) pipPositions.push([0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]);
  else if (num === 6) pipPositions.push([0.25, 0.2], [0.75, 0.2], [0.25, 0.5], [0.75, 0.5], [0.25, 0.8], [0.75, 0.8]);

  for (const [u, v] of pipPositions) {
    const cx = u * SIZE, cy = v * SIZE;
    for (let py = Math.max(0, Math.floor(cy - 5)); py < Math.min(SIZE, Math.ceil(cy + 5)); py++) {
      for (let px = Math.max(0, Math.floor(cx - 5)); px < Math.min(SIZE, Math.ceil(cx + 5)); px++) {
        const ddx = px - cx, ddy = py - cy;
        if (ddx * ddx + ddy * ddy < 16) {
          const idx = (py * SIZE + px) * 4;
          data[idx] = pipR; data[idx + 1] = pipG; data[idx + 2] = pipB; data[idx + 3] = 255;
        }
      }
    }
  }

  const tex = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

// ─── DiceMeshLight ────────────────────────────────────────────────────────────
interface DiceMeshLightProps {
  value: number;
  rolling: boolean;
  diceColor: string;
  pipColor: string;
}

function DiceMeshLight({ value, rolling, diceColor, pipColor }: DiceMeshLightProps) {
  const meshRef = useRef<THREE.Mesh>(null!);

  const [dr, dg, db] = hexToRgb(diceColor);
  const [pr, pg, pb] = hexToRgb(pipColor);

  const materials = useMemo(
    () => FACE_ORDER.map(face => {
      const tex = makeNumberTexture(face, dr, dg, db, pr, pg, pb);
      return new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.3,
        metalness: 0.1,
      });
    }),
    [diceColor, pipColor],
  );

  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  const spinAxis = useRef(new THREE.Vector3(1, 1, 0.5).normalize());
  const targetRef = useRef<[number, number, number]>(FACE_ROTATIONS[value] ?? FACE_ROTATIONS[1]);

  useEffect(() => {
    if (rolling) {
      spinAxis.current = new THREE.Vector3(
        Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5,
      ).normalize();
    } else {
      targetRef.current = FACE_ROTATIONS[value] ?? FACE_ROTATIONS[1];
    }
  }, [value, rolling]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    if (rolling) {
      meshRef.current.rotateOnAxis(spinAxis.current, delta * 15);
    } else {
      const [tx, ty, tz] = targetRef.current;
      meshRef.current.rotation.x += (tx - meshRef.current.rotation.x) * 0.12;
      meshRef.current.rotation.y += (ty - meshRef.current.rotation.y) * 0.12;
      meshRef.current.rotation.z += (tz - meshRef.current.rotation.z) * 0.12;
    }
  });

  return <mesh ref={meshRef} geometry={geometry} material={materials} scale={1.9} />;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ─── Public Component ─────────────────────────────────────────────────────────
interface Dice3DLightProps {
  value: number;
  diceColor?: string;
  pipColor?: string;
  size?: number;
  disabled?: boolean;
  needsSixBoost?: boolean;
  onRoll?: (result: number) => void;
  onRollStart?: () => void;
  onPressDisabled?: () => void;
  isRolling?: boolean;
  controlled?: boolean;
}

const Dice3DLight = React.forwardRef(({
  value,
  diceColor = '#FFFFFF',
  pipColor = '#1A1A1A',
  size = 75,
  disabled = false,
  needsSixBoost = false,
  onRoll,
  onRollStart,
  onPressDisabled,
  isRolling: externalRolling,
  controlled = false,
}: Dice3DLightProps & { onReady?: () => void }, ref) => {
  const [displayValue, setDisplayValue] = useState(value || 1);
  const [internalRolling, setInternalRolling] = useState(false);
  const [lastResult, setLastResult] = useState<number | null>(null);

  const rolling = controlled ? !!externalRolling : internalRolling;

  React.useImperativeHandle(ref, () => ({
    roll: () => handlePress(true),
  }));

  const rollStartRef = useRef<number>(0);
  const minDurationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  useEffect(() => {
    if (rolling) {
      rollStartRef.current = Date.now();
      if (!controlled) setLastResult(null);
    } else {
      if (controlled) {
        const elapsed = Date.now() - rollStartRef.current;
        const remaining = Math.max(500 - elapsed, 0);
        if (remaining > 0) {
          minDurationTimer.current = setTimeout(() => {
            setDisplayValue(valueRef.current);
          }, remaining);
        } else {
          setDisplayValue(valueRef.current);
        }
      }
      if (!controlled) {
        setDisplayValue(lastResult || value);
      }
    }
    return () => {
      if (minDurationTimer.current) clearTimeout(minDurationTimer.current);
    };
  }, [rolling, lastResult, controlled]);

  const handlePress = (force = false) => {
    if (typeof force !== 'boolean') force = false;
    if (disabled && !force) { onPressDisabled?.(); return; }
    if (rolling) return;

    if (controlled) { onRollStart?.(); return; }

    setInternalRolling(true);
    onRollStart?.();

    const dynamicDuration = 300 + Math.random() * 200;
    setTimeout(() => {
      let result = Math.floor(Math.random() * 6) + 1;
      if (needsSixBoost && result !== 6 && Math.random() < 0.30) result = 6;
      setLastResult(result);
      setInternalRolling(false);
      onRoll?.(result);
    }, dynamicDuration);
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View style={styles.canvasWrap} pointerEvents="none">
        <Suspense fallback={<ActivityIndicator color="#888" />}>
          <Canvas
            camera={{ position: [0, 0, 5], fov: 40 }}
            gl={{ antialias: false, powerPreference: 'low-power' }}
          >
            <ambientLight intensity={2.2} />
            <directionalLight position={[3, 5, 4]} intensity={1.2} />
            <DiceMeshLight value={displayValue} rolling={rolling} diceColor={diceColor} pipColor={pipColor} />
          </Canvas>
        </Suspense>
      </View>
      <TouchableOpacity
        onPress={() => handlePress(false)}
        activeOpacity={0.7}
        style={StyleSheet.absoluteFill}
        accessibilityLabel={`Dice showing ${displayValue}. Tap to roll.`}
        accessibilityRole="button"
      />
    </View>
  );
});

export default Dice3DLight;

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  canvasWrap: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
