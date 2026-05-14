
import { supabase } from './supabase';

export interface LevelUpdate {
  oldLevel: number;
  newLevel: number;
  oldXp: number;
  newXp: number;
  xpGained: number;
  xpNextLevel: number;
  progress: number; // 0 to 1
  leveledUp: boolean;
  streak: number;
  streakBonus: boolean;
}

/**
 * Calculates XP gained based on game performance
 */
export function calculateXpGained(rank: number, durationSecs: number, captures: number, mode: '2P' | '4P'): number {
  let xp = 0;

  // 1. Rank bonus
  if (rank === 1) xp += 150;
  else if (rank === 2) xp += 80;
  else if (rank === 3) xp += 40;
  else xp += 10;

  // 2. Capture bonus
  xp += captures * 15;

  // 3. Duration bonus (1 XP per 10 seconds, max 100)
  xp += Math.min(100, Math.floor(durationSecs / 10));

  // 4. Mode multiplier
  if (mode === '4P') xp = Math.floor(xp * 1.2);

  return xp;
}

/**
 * Updates player XP and handles leveling up in Supabase.
 * Also handles winning streak logic.
 */
export async function updatePlayerLevel(userId: string, xpGained: number, isWin: boolean): Promise<LevelUpdate | null> {
  try {
    // 1. Fetch current profile
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('level, xp, xp_next_level, streak')
      .eq('id', userId)
      .single();

    if (fetchError || !profile) {
      console.error('Error fetching profile for level update:', fetchError);
      return null;
    }

    let { level, xp, xp_next_level, streak } = profile;
    const oldLevel = level;
    const oldXp = xp;

    // 2. Handle Winning Streak
    let streakBonus = false;
    if (isWin) {
      streak = (streak || 0) + 1;
      if (streak === 3) {
        xpGained += 500; // Big bonus for 3 wins in a row!
        streakBonus = true;
      }
    } else {
      streak = 0; // Reset streak on loss
    }

    // 3. Add gained XP
    xp += xpGained;

    // 3. Check for level up
    let leveledUp = false;
    while (xp >= xp_next_level) {
      xp -= xp_next_level;
      level += 1;
      leveledUp = true;
      // Scale next level XP (e.g., increase by 20% each level)
      xp_next_level = Math.floor(xp_next_level * 1.2);
    }

    // 4. Update Supabase
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        level,
        xp,
        xp_next_level,
        streak
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating profile level:', updateError);
      return null;
    }

    return {
      oldLevel,
      newLevel: level,
      oldXp,
      newXp: xp,
      xpGained,
      xpNextLevel: xp_next_level,
      progress: xp / xp_next_level,
      leveledUp,
      streak,
      streakBonus
    };
  } catch (err) {
    console.error('Unexpected error in updatePlayerLevel:', err);
    return null;
  }
}
