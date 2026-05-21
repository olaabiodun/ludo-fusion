import { Dimensions } from 'react-native';

export type Seat = 'TOP' | 'LEFT' | 'RIGHT' | 'DOWN' | 'TL' | 'TR' | 'BL' | 'BR';
export type Color = 'green' | 'yellow' | 'blue' | 'red';

export interface Player {
  id: string;
  name: string;
  color: Color;
  avatar: any;
  cardCount: number;
  cards: Card[];
  active: boolean;
  seat: Seat;
  lives: number;
  isBot: boolean;
}

export interface Card {
  shape: 'circle' | 'triangle' | 'cross' | 'square' | 'star' | 'whot';
  value: number | string;
}

export function responsiveScale(value: number): number {
  'worklet';
  try {
    const { width, height } = Dimensions.get('window');
    const shortDimension = width < height ? width : height;
    // Standard reference width (e.g. 375 for iPhone)
    const guidelineBaseWidth = 375;
    return (shortDimension / guidelineBaseWidth) * value;
  } catch (e) {
    return value;
  }
}

export function rs(value: number): number {
  'worklet';
  return responsiveScale(value);
}

export const C = {
  gold: '#FFD030',
  text: '#FFEBEB',
  muted: 'rgba(255,235,235,0.7)',
  accent: '#FF2D55',
  glass: 'rgba(20,0,0,0.6)',
  glassBorder: 'rgba(255,255,255,0.1)',
  green: '#34C759',
  yellow: '#FFD030',
  blue: '#007AFF',
  red: '#FF3B30',
};

import { BOT_NAMES, getBotName as _getBotName } from '@/lib/botNames';

export { BOT_NAMES };

export function getBotName(color: Color, localColor?: string): string {
  return _getBotName(color, localColor);
}

export const CARD_W = rs(58);
export const CARD_H = rs(78);

export function getSeatScreenPos(seat: Seat): { x: number; y: number } {
  try {
    const d = Dimensions.get('window');
    const widthVal = d.width;
    const heightVal = d.height;
    const chipH = rs(40);
    const chipW = rs(110);

    switch (seat) {
      case 'DOWN': return { x: widthVal / 2, y: heightVal - rs(6) - chipH / 2 };
      case 'TOP': return { x: widthVal / 2, y: rs(14) + chipH / 2 };
      case 'LEFT': return { x: rs(10) + chipW / 2, y: heightVal / 2 };
      case 'RIGHT': return { x: widthVal - rs(10) - chipW / 2, y: heightVal / 2 };
      case 'TL': return { x: rs(100), y: rs(100) };
      case 'TR': return { x: widthVal - rs(100), y: rs(100) };
      case 'BL': return { x: rs(100), y: heightVal - rs(100) };
      case 'BR': return { x: widthVal - rs(100), y: heightVal - rs(100) };
      default: return { x: widthVal / 2, y: heightVal / 2 };
    }
  } catch (err) {
    return { x: 0, y: 0 };
  }
}

export function getSeatRotation(seat: Seat): number {
  switch (seat) {
    case 'DOWN': return 0;
    case 'TOP': return 180;
    case 'LEFT': return 90;
    case 'RIGHT': return -90;
    default: return 0;
  }
}

export function getCardInFanPos(seat: Seat, index: number, total: number, isLocal: boolean = false, isMultiplayer: boolean = false): { x: number; y: number; rot: number } {
  const base = getSeatScreenPos(seat);
  const chipH = rs(40);
  const chipW = rs(110);
  const cardW = CARD_W;
  const cardH = CARD_H;

  let fx = base.x;
  let fy = base.y;

  if (seat === 'DOWN') {
    // marginBottom in UI is rs(isLocal ? (isMultiplayer ? 75 : 45) : 8)
    const margin = isLocal ? (isMultiplayer ? 75 : 45) : 8;
    fy -= (chipH / 2 + rs(margin) + cardH / 2);
  } else if (seat === 'TOP') {
    fy += (chipH / 2 + rs(-16) + cardH / 2);
  } else if (seat === 'LEFT') {
    fx += (chipW / 2 + rs(-11.2) + cardW / 2);
  } else if (seat === 'RIGHT') {
    fx -= (chipW / 2 + rs(-11.2) + cardW / 2);
  }

  const n = Math.min(total, 12); // Sync with FAN_MAX
  const isVertical = seat === 'LEFT' || seat === 'RIGHT';
  const maxAngle = seat === 'DOWN' ? Math.min(n * 7, 45) : Math.min(n * 9, 68);
  const arcStart = -maxAngle / 2;
  const arcStep = n <= 1 ? 0 : maxAngle / (n - 1);
  const arcR = seat === 'DOWN' ? rs(190) : rs(100);

  const angle = arcStart + arcStep * index;
  const rad = (angle * Math.PI) / 180;

  let tx = 0, ty = 0, rot = 0;
  if (isVertical) {
    ty = Math.sin(rad) * arcR;
    tx = seat === 'RIGHT' ? (1 - Math.cos(rad)) * arcR : -(1 - Math.cos(rad)) * arcR;
    rot = seat === 'RIGHT' ? 90 - angle : -90 + angle;
  } else {
    tx = Math.sin(rad) * arcR;
    ty = seat === 'DOWN' ? (1 - Math.cos(rad)) * arcR : -(1 - Math.cos(rad)) * arcR;
    rot = seat === 'DOWN' ? angle : -angle;
  }

  return { x: fx + tx, y: fy + ty, rot };
}

export const getRandomCard = (): Card => {
  const shapes: Card['shape'][] = ['circle', 'triangle', 'cross', 'square', 'star'];
  if (Math.random() < 0.1) return { shape: 'whot', value: 20 };
  const shape = shapes[Math.floor(Math.random() * shapes.length)];
  const values = [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14];
  const value = values[Math.floor(Math.random() * values.length)];
  return { shape, value };
};

export const calculateScore = (cards: Card[]): number => {
  return cards.reduce((sum, card) => {
    if (card.shape === 'whot') return sum + 20;
    const val = typeof card.value === 'number' ? card.value : parseInt(card.value as string) || 0;
    return sum + val;
  }, 0);
};

export const SW = Dimensions.get('window').width;
export const SH = Dimensions.get('window').height;

// ─── Centralized Logic ───────────────────────────────────────────────────────

/**
 * Pure function to check if a card can be played.
 * Prevents stale closures in UI components.
 */
export const canPlayCard = (
  card: Card,
  topCard: Card | null,
  currentShape: Card['shape'] | null,
  pendingPicks: number,
  handLength: number
): boolean => {
  // [House Rule] No Special Card Checkouts
  // Prohibit winning with 1, 2, 5, 8, 14, 20
  if (handLength === 1) {
    if ([1, 2, 5, 8, 14, 20].includes(card.value as number)) return false;
  }

  // Handle pending picks (2 or 5)
  if (pendingPicks > 0) {
    // Only same value can defend (2 on 2, 5 on 5)
    // Note: Whot (20) cannot defend a pick-two/three
    return [2, 5].includes(card.value as number) && card.value === topCard?.value;
  }

  // Whot (20) is always playable unless there is a pending pick
  if (card.value === 20) return true;

  // After a Whot, must match the chosen shape
  if (topCard?.value === 20 && currentShape) {
    return card.shape === currentShape;
  }

  // Normal play: match shape or value
  return card.shape === topCard?.shape || card.value === topCard?.value;
};

/**
 * Pure function to find the next active player.
 * Safely skips players with no cards or lives.
 */
export const findNextActivePlayer = (
  current: number,
  step: number,
  players: Player[]
): number => {
  if (players.length === 0) return 0;
  
  // If step is 0 (Hold On), the same player continues
  if (step === 0) return current;

  let next = (current + step) % players.length;
  
  // Search for the next player who is still in the game
  for (let i = 0; i < players.length; i++) {
    const p = players[next];
    if (p && p.lives > 0 && p.cardCount > 0) {
      return next;
    }
    next = (next + 1) % players.length;
  }

  return current;
};

