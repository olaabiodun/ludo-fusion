require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
globalThis.WebSocket = ws; // Polyfill for Node.js < 22 WebSocket support

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const fakeUsers = [
  { email: 'masterplay@ludo.local', password: 'password123', username: 'MasterPlay', full_name: 'Master Play', xp: 24750, level: 20 },
  { email: 'kingobi@ludo.local', password: 'password123', username: 'KingObi', full_name: 'King Obi', xp: 18440, level: 16 },
  { email: 'zikoroyal@ludo.local', password: 'password123', username: 'ZikoRoyal', full_name: 'Ziko Royal', xp: 15200, level: 14 },
  { email: 'abujaboss@ludo.local', password: 'password123', username: 'AbujaBoss', full_name: 'Abuja Boss', xp: 14880, level: 13 },
  { email: 'fujiqueen@ludo.local', password: 'password123', username: 'FujiQueen', full_name: 'Fuji Queen', xp: 13310, level: 12 },
  { email: 'nightgambler@ludo.local', password: 'password123', username: 'NightGambler', full_name: 'Night Gambler', xp: 12540, level: 11 },
  { email: 'diceslayer@ludo.local', password: 'password123', username: 'DiceSlayer', full_name: 'Dice Slayer', xp: 11980, level: 10 },
];

async function seed() {
  console.log('Starting seed...');
  for (const u of fakeUsers) {
    console.log(`Creating user ${u.email}...`);
    // 1. Create auth user
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.full_name }
    });

    if (authErr) {
      console.log(`Error creating ${u.email}:`, authErr.message);
      continue;
    }

    const userId = authData.user.id;
    console.log(`Created auth user ${userId}. Updating profile...`);

    // 2. Update profile (since trigger already created it)
    const { error: profErr } = await supabase.from('profiles').update({
      username: u.username,
      full_name: u.full_name,
      xp: u.xp,
      level: u.level,
      wallet_balance: Math.floor(Math.random() * 100000)
    }).eq('id', userId);

    if (profErr) {
      console.log(`Error updating profile for ${u.username}:`, profErr.message);
    } else {
      console.log(`Successfully seeded ${u.username}.`);
    }
  }
  console.log('Seed complete!');
}

seed();
