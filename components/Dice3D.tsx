import { Canvas, useFrame } from '@react-three/fiber/native';
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as THREE from 'three';

// ─── Pip positions per face (0..1 UV space) ──────────────────────────────────
const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
  6: [[0.28, 0.22], [0.72, 0.22], [0.28, 0.5], [0.72, 0.5], [0.28, 0.78], [0.72, 0.78]],
};

// Standard die face order for Three.js box: +x,-x,+y,-y,+z,-z
// maps to faces: 2, 5, 4, 3, 1, 6
const FACE_ORDER = [2, 5, 4, 3, 1, 6];

// Target rotation so face N points toward the camera (+z)
const FACE_ROTATIONS: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  2: [0, -Math.PI / 2, 0],
  3: [-Math.PI / 2, 0, 0],
  4: [Math.PI / 2, 0, 0],
  5: [0, Math.PI / 2, 0],
  6: [Math.PI, 0, 0],
};

// Materials are managed via useMemo within components to avoid WebGL context sharing issues between different Canvas instances.

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ─── Build DataTexture pip face (no DOM/canvas needed) ───────────────────────
function makePipTexture(
  pips: [number, number][],
  diceR: number, diceG: number, diceB: number,
  pipR: number, pipG: number, pipB: number,
): THREE.DataTexture {
  const SIZE = 128; // Reduced from 256 for much faster generation on low-end phones
  const PIP_RADIUS = 10; // Scaled down for 128x128
  const data = new Uint8Array(SIZE * SIZE * 4);

  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const idx = (py * SIZE + px) * 4;
      let alpha = 0;

      for (const [u, v] of pips) {
        const cx = u * SIZE;
        const cy = v * SIZE;
        const dx = px - cx;
        const dy = py - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // High-quality anti-aliasing for the pips
        const softEdge = 1.2;
        if (dist < PIP_RADIUS + softEdge) {
          const currentAlpha = 1 - Math.max(0, Math.min(1, (dist - (PIP_RADIUS - softEdge)) / (softEdge * 2)));
          alpha = Math.max(alpha, currentAlpha);
        }
      }

      data[idx] = THREE.MathUtils.lerp(diceR, pipR, alpha);
      data[idx + 1] = THREE.MathUtils.lerp(diceG, pipG, alpha);
      data[idx + 2] = THREE.MathUtils.lerp(diceB, pipB, alpha);
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  tex.anisotropy = 4;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

// ─── Rounded box geometry ───────────────────────────────────────────────────
function createRoundedBoxGeometry(
  width: number,
  height: number,
  depth: number,
  radius: number,
  segments: number,
): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(width, height, depth, segments, segments, segments);
  const pos = geometry.attributes.position;
  const hw = width / 2 - radius;
  const hh = height / 2 - radius;
  const hd = depth / 2 - radius;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const cx = Math.max(-hw, Math.min(hw, x));
    const cy = Math.max(-hh, Math.min(hh, y));
    const cz = Math.max(-hd, Math.min(hd, z));

    const dx = x - cx;
    const dy = y - cy;
    const dz = z - cz;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (len > 0) {
      pos.setXYZ(i, cx + (dx / len) * radius, cy + (dy / len) * radius, cz + (dz / len) * radius);
    }
  }

  geometry.computeVertexNormals();
  return geometry;
}

// ─── DiceMesh ────────────────────────────────────────────────────────────────
interface DiceMeshProps {
  value: number;
  rolling: boolean;
  isSpinningRef: React.RefObject<boolean>;
  diceColor: string;
  pipColor: string;
}

function DiceMesh({ value, rolling, isSpinningRef, diceColor, pipColor }: DiceMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null!);

  const materials = useMemo(() => {
    const [dr, dg, db] = hexToRgb(diceColor);
    const [pr, pg, pb] = hexToRgb(pipColor);
    
    // Each material gets its own unique DataTexture
    return FACE_ORDER.map(face =>
      new THREE.MeshStandardMaterial({
        map: makePipTexture(PIP_LAYOUTS[face], dr, dg, db, pr, pg, pb),
        roughness: 0.2,
        metalness: 0.15,
      })
    );
  }, [diceColor, pipColor]);

  const geometry = useMemo(
    () => createRoundedBoxGeometry(1, 1, 1, 0.16, 8), // Further reduced segments for faster load
    [],
  );

  const targetQuaternion = useMemo(() => {
    const rot = FACE_ROTATIONS[value] ?? FACE_ROTATIONS[1];
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]));
  }, [value]);
  const spinAxis = useRef(new THREE.Vector3(1, 1, 0.5).normalize());

  useEffect(() => {
    if (rolling) {
      spinAxis.current = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5,
      ).normalize();
    }
  }, [rolling]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const isCurrentlyRolling = rolling || !!isSpinningRef?.current;
    if (isCurrentlyRolling) {
      // High-speed tumble around a fixed random-looking axis (cheaper than calculating new axis every frame)
      meshRef.current.rotateOnAxis(spinAxis.current, delta * 18);
    } else {
      // Perfect straight-path spherical linear interpolation (SLERP) in 3D space
      meshRef.current.quaternion.slerp(targetQuaternion, 0.15);
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} material={materials} scale={1.9} />
  );
}

// ─── Public Component ────────────────────────────────────────────────────────
interface Dice3DProps {
  value: number;
  diceColor?: string;
  pipColor?: string;
  size?: number;
  rollDuration?: number;
  disabled?: boolean;
  needsSixBoost?: boolean;
  onRoll?: (result: number) => void;
  onRollStart?: () => void;
  onPressDisabled?: () => void;
  isRolling?: boolean; // Controlled rolling state
  controlled?: boolean; // If true, ignore internal press logic for result
}

const Dice3D = React.forwardRef(({
  value,
  diceColor = '#FFFFFF',
  pipColor = '#1A1A1A',
  size = 75,
  rollDuration = 900,
  disabled = false,
  needsSixBoost = false,
  onRoll,
  onRollStart,
  onPressDisabled,
  onReady,
  isRolling: externalRolling,
  controlled = false,
}: Dice3DProps & { onReady?: () => void }, ref) => {
  const [displayValue, setDisplayValue] = useState(value || 1);
  const [internalRolling, setInternalRolling] = useState(false);
  const [lastResult, setLastResult] = useState<number | null>(null);

  const rolling = controlled ? (!!externalRolling || internalRolling) : internalRolling;
  const isSpinningRef = useRef(false);
  isSpinningRef.current = rolling;

  React.useImperativeHandle(ref, () => ({
    roll: () => handlePress(true),
    startSpinning: () => {
      isSpinningRef.current = true;
      setInternalRolling(true);
    },
    stopSpinning: () => {
      isSpinningRef.current = false;
      setInternalRolling(false);
    },
  }));

  useEffect(() => {
    onReady?.();
  }, []);



  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  // Sync internal display value with rapid randoms if rolling
  useEffect(() => {
    if (controlled) return;

    if (rolling) {
      setLastResult(null);
    } else {
      setDisplayValue(lastResult || value);
    }
  }, [rolling, lastResult, controlled, value]);

  const handlePress = (force = false) => {
    if (typeof force !== 'boolean') force = false;
    if (disabled && !force) {
      onPressDisabled?.();
      return;
    }
    if (rolling) return;

    if (controlled) {
      // Just notify parent to start the server-side process
      onRollStart?.();
      return;
    }

    isSpinningRef.current = true;
    setInternalRolling(true);
    onRollStart?.();

    const dynamicDuration = 300 + Math.random() * 200;
    setTimeout(() => {
      let result = Math.floor(Math.random() * 6) + 1;
      if (needsSixBoost && result !== 6 && Math.random() < 0.30) {
        result = 6;
      }
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
            shadows="percentage"
            gl={{ antialias: true, shadowMapType: THREE.PCFShadowMap }}
            onCreated={({ gl }) => {
              gl.shadowMap.enabled = true;
              gl.shadowMap.type = THREE.PCFShadowMap;
            }}
          >
            <ambientLight intensity={1.8} />
            <directionalLight position={[5, 8, 5]} intensity={1.6} castShadow shadow-mapSize={[512, 512]} />
            <directionalLight position={[-5, -4, -3]} intensity={0.4} />
            <pointLight position={[0, 4, 4]} intensity={0.8} color="#FFF8F0" />
            <DiceMesh value={controlled ? value : displayValue} rolling={rolling} isSpinningRef={isSpinningRef} diceColor={diceColor} pipColor={pipColor} />
          </Canvas>
        </Suspense>
      </View>

      <TouchableOpacity
        onPress={() => handlePress(false)}
        activeOpacity={0.7}
        style={StyleSheet.absoluteFill}
        accessibilityLabel={`Dice showing ${controlled ? value : displayValue}. Tap to roll.`}
        accessibilityRole="button"
      />
    </View>
  );
});

export default Dice3D;

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