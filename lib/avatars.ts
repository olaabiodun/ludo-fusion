const SEEDS = [
  'Felix', 'Aneka', 'Boo', 'Jasper', 'Luna', 'Milo',
  'Simon', 'Zara', 'Oscar', 'Nala', 'Kai', 'Remy',
  'Ivy', 'Leo', 'Maya', 'Theo', 'Eden', 'Finn',
  'Nova', 'Cole', 'Skye', 'Blake', 'Jade', 'Reese',
  'Avery', 'Quinn', 'Rowan', 'Sage', 'Wren', 'Drew',
];

const BG_COLORS = [
  'b6e3f4', 'ffdfbf', 'c0aede', 'd1d4f9', 'ffd5dc', 'c1f4c1',
  'f0d5c1', 'c1d4f0', 'd4f0c1', 'f0c1d4', 'c1f0e0', 'e0c1f0',
  'f5e6cc', 'ccf5e6', 'e6ccf5', 'f5cce6', 'cce6f5', 'e6f5cc',
  'd4c4f0', 'f0d4c4', 'c4f0d4', 'd4f0c4', 'c4d4f0', 'f0c4d4',
];

const DICEBEAR_BASE = 'https://api.dicebear.com/7.x/avataaars/png';

export const AVATAR_PRESETS: string[] = SEEDS.map((seed, i) =>
  `${DICEBEAR_BASE}?seed=${seed}&backgroundColor=${BG_COLORS[i % BG_COLORS.length]}`
);

export function getRandomAvatar(): string {
  return AVATAR_PRESETS[Math.floor(Math.random() * AVATAR_PRESETS.length)];
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getPlayerAvatar(p: { avatar_url?: string | null; avatar?: { uri: string } | null; name?: string; color?: string }): { uri: string } | null {
  if (p.avatar_url) return { uri: p.avatar_url };
  if (p.avatar) return p.avatar;
  const seed = p.name || p.color || 'player';
  const bgIdx = hashCode(seed) % BG_COLORS.length;
  return { uri: `${DICEBEAR_BASE}?seed=${encodeURIComponent(seed)}&backgroundColor=${BG_COLORS[bgIdx]}` };
}
