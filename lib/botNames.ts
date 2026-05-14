/**
 * Centralized list of professional bot names for the Winnerson Plexus platform.
 * Using a mix of common Nigerian names and global friendly names to maintain a 
 * premium, realistic multiplayer feel.
 */

export const BOT_NAMES = [
  'Amina', 'Tunde', 'Obinna', 'Zainab', 'Chidi', 'Folake', 'Ibrahim', 'Chioma',
  'Emeka', 'Ngozi', 'Yusuf', 'Fatima', 'Bisi', 'Uche', 'Sani', 'Ada',
  'Kelechi', 'Femi', 'Titilayo', 'Musa', 'Nkechi', 'Olawale', 'Amara', 'Jide',
  'Bunmi', 'Dapo', 'Ebele', 'Farooq', 'Gemma', 'Hassan', 'Ifunanya', 'Jumoke',
  'Kojo', 'Lola', 'Mustapha', 'Ndidi', 'Osas', 'Patience', 'Quincy', 'Ranti',
  'Segun', 'Tobi', 'Umar', 'Victor', 'Wale', 'Xander', 'Yejide', 'Zara',
  'Ade', 'Bayo', 'Cynthia', 'Damola', 'Efe', 'Funmi', 'Ganiyu', 'Hope',
  'Ikenna', 'Joy', 'Kayode', 'Linda', 'Modupe', 'Nnamdi', 'Ogechi', 'Peter',
  'Razaq', 'Sade', 'Taiwo', 'Uzo', 'Vivian', 'Wunmi', 'Yinka', 'Zion'
];

/**
 * Returns a consistent name for a bot based on their color or ID.
 * This ensures that a specific bot "slot" always has the same name 
 * during a session or across different game screens.
 */
export function getBotName(color: string, localColor?: string): string {
  // Use a simple hash of the color/seed to pick a random name from the pool
  const seed = color + (localColor || '');
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  
  const index = Math.abs(hash) % BOT_NAMES.length;
  return BOT_NAMES[index];
}

/**
 * Returns a random name from the pool that isn't the user's name.
 */
export function getRandomBotName(excludeNames: string[] = []): string {
  const pool = BOT_NAMES.filter(name => !excludeNames.includes(name));
  return pool[Math.floor(Math.random() * pool.length)];
}
