require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const NEW_ACCOUNTS = [];
for (let i = 4; i <= 10; i++) {
  NEW_ACCOUNTS.push({
    email: `bot_${i}@ludofusion.app`,
    password: 'botpass123',
    username: `bot_${i}`,
  });
}

async function main() {
  for (const acc of NEW_ACCOUNTS) {
    const { data: userData, error } = await supabase.auth.admin.createUser({
      email: acc.email,
      password: acc.password,
      email_confirm: true,
      user_metadata: { username: acc.username },
    });

    if (error?.message?.includes('already exists')) {
      console.log(`SKIP ${acc.email} — already exists`);
      continue;
    }

    if (error) {
      console.error(`FAIL ${acc.email}: ${error.message}`);
      continue;
    }

    const userId = userData.user.id;
    console.log(`CREATED ${acc.email} (id: ${userId})`);

    // Upsert profile with wallet balance
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      username: acc.username,
      wallet_balance: 50000,
      level: 1,
      xp: 0,
      xp_next_level: 3000,
    });

    if (profileError) {
      console.error(`  Profile insert FAILED for ${acc.email}: ${profileError.message}`);
    } else {
      console.log(`  Profile + ₦50,000 wallet created`);
    }
  }

  console.log('\nDone. Add these to BOT_ACCOUNTS arrays:');
  for (const acc of NEW_ACCOUNTS) {
    console.log(`  { email: '${acc.email}', password: '${acc.password}' },`);
  }
}

main().catch(console.error);
