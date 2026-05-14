import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, {
  Path,
  Ellipse,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Pattern,
  Rect,
  G,
} from 'react-native-svg';

const { width: SW, height: SH } = Dimensions.get('window');
const BOARD_SIZE = Math.min(SW - 1, SH * 0.9, 720);
const CELL_SIZE = BOARD_SIZE / 10;

// ─── helpers (keep in sync with your board file) ───────────────────────────
function getCellNumber(row: number, col: number): number {
  const boardRow = 9 - row;
  const baseNum = boardRow * 10 + 1;
  return boardRow % 2 === 0 ? baseNum + col : baseNum + (9 - col);
}

function getCellPos(num: number) {
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      if (getCellNumber(row, col) === num) {
        return {
          x: col * CELL_SIZE + CELL_SIZE / 2,
          y: row * CELL_SIZE + CELL_SIZE / 2,
        };
      }
    }
  }
  return { x: 0, y: 0 };
}

// ─── SnakeSVG ──────────────────────────────────────────────────────────────
interface SnakeSVGProps {
  start: number; // head (higher number)
  end: number;   // tail (lower number)
}

export const SnakeSVG: React.FC<SnakeSVGProps> = ({ start, end }) => {
  const head = getCellPos(start);
  const tail = getCellPos(end);

  const dx = tail.x - head.x;
  const dy = tail.y - head.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  const midX = (head.x + tail.x) / 2;
  const midY = (head.y + tail.y) / 2;

  const snakeW = CELL_SIZE * 1.5;
  const snakeH = distance;

  // Internal canvas – head at TOP, tail at BOTTOM
  const VW = 120;
  const VH = 420;
  const cx = VW / 2;

  // Smooth S‑curve backbone (used for clipping or as a guide)
  const backbone = `
    M ${cx} 28
    C ${cx + 36} 80, ${cx + 48} 140, ${cx + 22} 190
    C ${cx - 8} 230, ${cx - 48} 275, ${cx - 26} 325
    C ${cx - 6} 355, ${cx + 32} 378, ${cx + 12} 408
  `;

  // Thick body outline – a filled S‑shape with slight variation
  const bodyPath = `
    M ${cx} 28
    C ${cx + 36} 60, ${cx + 48} 120, ${cx + 22} 182
    C ${cx - 8}  222, ${cx - 48} 265, ${cx - 26} 315
    C ${cx - 6}  345, ${cx + 32} 368, ${cx + 12} 395
    C ${cx + 2}  408, ${cx - 20} 408, ${cx - 18} 396
    C ${cx + 6}  370, ${cx - 26} 344, ${cx - 46} 312
    C ${cx - 68} 262, ${cx - 26} 212, ${cx - 4}  178
    C ${cx + 24} 132, ${cx + 16} 66, ${cx - 20} 38
    Z
  `;

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      <View
        style={{
          position: 'absolute',
          left: midX - snakeW / 2,
          top: midY - snakeH / 2,
          width: snakeW,
          height: snakeH,
          transform: [{ rotate: `${angle - 90}deg` }],
        }}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${VW} ${VH}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <Defs>
            {/* Base body gradient – olive / golden with a 3D feel */}
            <LinearGradient id="bodyGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%"   stopColor="#7A5C00" />
              <Stop offset="20%"  stopColor="#D4A017" />
              <Stop offset="45%"  stopColor="#F5D061" />
              <Stop offset="70%"  stopColor="#D4A017" />
              <Stop offset="100%" stopColor="#7A5C00" />
            </LinearGradient>

            {/* Scale pattern – tiny overlapping diamonds */}
            <Pattern
              id="scalePattern"
              patternUnits="userSpaceOnUse"
              width="20"
              height="14"
              patternTransform="rotate(15)"
            >
              <Rect width="20" height="14" fill="none" />
              <Path
                d="M10 0 L13 7 L10 14 L7 7 Z"
                fill="#E6C031"
                opacity="0.4"
                stroke="#9A7D0A"
                strokeWidth="0.3"
              />
              <Path
                d="M5 0 L8 7 L5 14 L2 7 Z"
                fill="#DBAF20"
                opacity="0.3"
                stroke="#9A7D0A"
                strokeWidth="0.3"
              />
            </Pattern>

            {/* Red marking gradient */}
            <LinearGradient id="redGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%"   stopColor="#990000" />
              <Stop offset="50%"  stopColor="#DD1010" />
              <Stop offset="100%" stopColor="#990000" />
            </LinearGradient>

            {/* Head gradient – lighter / warmer */}
            <LinearGradient id="headGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%"   stopColor="#EFD75A" />
              <Stop offset="100%" stopColor="#C0A800" />
            </LinearGradient>

            {/* Drop shadow filter (optional – remove if performance is a concern) */}
            {/* <Filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
              <FeDropShadow dx="2" dy="4" stdDeviation="3" floodColor="#000000" floodOpacity="0.35"/>
            </Filter> */}
          </Defs>

          {/* Shadow (drawn as a blurred offset path) */}
          <Path
            d={bodyPath}
            fill="#00000022"
            transform="translate(1, 3)"
            // If you use the filter above, remove the transform and fill and set filter="url(#shadow)"
          />

          {/* 1 – Solid body with scale pattern overlay */}
          <G>
            <Path d={bodyPath} fill="url(#bodyGrad)" stroke="#5C4900" strokeWidth="1.0" />
            <Path d={bodyPath} fill="url(#scalePattern)" />
          </G>

          {/* 2 – Red diamond patches (turned into elegant elliptical marks) */}
          {[
            { cx: cx + 18, cy: 78,  rx: 9, ry: 15 },
            { cx: cx + 28, cy: 124, rx: 10, ry: 17 },
            { cx: cx + 14, cy: 170, rx: 8, ry: 13 },
            { cx: cx - 3,  cy: 215, rx: 8, ry: 13 },
            { cx: cx - 24, cy: 258, rx: 9, ry: 15 },
            { cx: cx - 30, cy: 300, rx: 9, ry: 13 },
            { cx: cx - 14, cy: 338, rx: 7, ry: 11 },
            { cx: cx + 3,  cy: 372, rx: 6, ry: 10 },
          ].map((p, i) => (
            <Ellipse
              key={i}
              cx={p.cx}
              cy={p.cy}
              rx={p.rx}
              ry={p.ry}
              fill="url(#redGrad)"
              opacity={0.88}
              stroke="#7A0000"
              strokeWidth="0.4"
            />
          ))}

          {/* 3 – Belly highlight (soft, central) */}
          <Path
            d={`
              M ${cx}     50
              C ${cx + 6} 85, ${cx + 8}  135, ${cx + 2}  178
              C ${cx - 7} 218, ${cx - 9}  262, ${cx - 2}  308
              C ${cx + 3} 338, ${cx + 8}  362, ${cx + 2}  388
            `}
            stroke="#FFF8C0"
            strokeWidth="3.2"
            fill="none"
            strokeLinecap="round"
            opacity={0.35}
          />

          {/* 4 – Spine highlight (slightly off‑center dorsal line) */}
          <Path
            d={backbone}
            stroke="#F7E570"
            strokeWidth="1.2"
            fill="none"
            strokeLinecap="round"
            opacity={0.28}
          />

          {/* 5 – Head (more defined, slightly triangular) */}
          <G>
            {/* Head base */}
            <Ellipse
              cx={cx}
              cy={30}
              rx={16}
              ry={22}
              fill="url(#headGrad)"
              stroke="#5C4900"
              strokeWidth="1.0"
            />
            {/* Snout – forward bulge */}
            <Ellipse
              cx={cx + 12}
              cy={20}
              rx={10}
              ry={7}
              fill="#EDD85A"
              stroke="#5C4900"
              strokeWidth="0.7"
            />
            {/* Eye ring */}
            <Circle cx={cx + 8} cy={24} r={5.5} fill="#222" />
            <Circle cx={cx + 8} cy={24} r={5.5} fill="none" stroke="#D4A017" strokeWidth="0.8" />
            {/* Pupil with highlight */}
            <Circle cx={cx + 8.5} cy={23.5} r={2.0} fill="#111" />
            <Circle cx={cx + 9.2} cy={22.8} r={1.0} fill="#FFF" opacity={0.7} />
            {/* Nostril */}
            <Circle cx={cx + 17} cy={19} r={1.4} fill="#4A3800" opacity={0.7} />
            {/* Mouth line (with slight smirk) */}
            <Path
              d={`M ${cx - 8} 37 Q ${cx + 4} 43 ${cx + 16} 33`}
              stroke="#5C4900"
              strokeWidth="1.2"
              fill="none"
              strokeLinecap="round"
            />
            {/* Forked tongue */}
            <Path
              d={`M ${cx + 19} 17 L ${cx + 28} 11 M ${cx + 28} 11 L ${cx + 31} 7 M ${cx + 28} 11 L ${cx + 32} 9`}
              stroke="#CC0000"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </G>
        </Svg>
      </View>
    </View>
  );
};

export default SnakeSVG; 