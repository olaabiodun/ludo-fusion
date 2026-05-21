require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const USERNAMES = [
  'AdebayoKing', 'NgoziStar', 'Oluwaseun', 'Temitope22', 'KelechiWin',
  'FunkeLudo', 'ChidiAce', 'Yetunde99', 'IkennaPro', 'BolanlePlay',
  'ObinnaX', 'Simisola', 'KayodeBoss', 'AmakaDice', 'GbengaRoll',
  'NnennaGold', 'FemiMove', 'Chiamaka', 'TundeKing', 'ZainabLudo',
  'ChisomStar', 'AdeolaPro', 'Ifeanyi22', 'LolaPlay', 'ObiomaX',
  'SeyiRoll', 'Kolawole', 'MoyoAce', 'Uchenna', 'AyodejiWin',
];

async function main() {
  const start = 11;
  for (let i = 0; i < 30; i++) {
    const idx = start + i;
    const email = `bot_${idx}@ludofusion.app`;
    const username = USERNAMES[i];
    const password = 'botpass123';

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username },
    });

    if (error?.message?.includes('already exists')) {
      console.log(`SKIP ${email} — already exists`);
      // still try to fix username
      const { data: users } = await supabase.auth.admin.listUsers();
      const user = users?.users?.find(u => u.email === email);
      if (user) {
        await supabase.from('profiles').update({ username }).eq('id', user.id);
        console.log(`  -> username fixed to ${username}`);
      }
      continue;
    }

    if (error) {
      console.error(`FAIL ${email}: ${error.message}`);
      continue;
    }

    const userId = data.user.id;
    const { error: profErr } = await supabase.from('profiles').upsert({
      id: userId,
      username,
      wallet_balance: 50000,
      level: 1, xp: 0, xp_next_level: 3000,
    });

    if (profErr) {
      console.error(`  Profile FAIL for ${email}: ${profErr.message}`);
    } else {
      console.log(`CREATED ${email} -> ${username} (₦50,000)`);
    }
  }

  console.log('\nDone. Add these to BOT_ACCOUNTS arrays:');
  for (let i = 11; i <= 40; i++) {
    console.log(`  { email: 'bot_${i}@ludofusion.app', password: 'botpass123' },`);
  }
}

main().catch(console.error);
