require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('username, avatar_url, level, xp')
    .in('username', ['bot_1', 'bot_2', 'bot_3', 'bot_4', 'ChiomaPulse', 'EmekaAce']);

  if (error) {
    console.error('Query error:', error.message);
    return;
  }

  console.log('Found profiles:');
  for (const p of profiles || []) {
    console.log(`  ${p.username} | avatar: ${p.avatar_url ? '✓' : '✗'} | Lv.${p.level} | ${p.xp}XP`);
  }

  // Also check if the old bot_N names still exist
  const { data: oldBots } = await supabase
    .from('profiles')
    .select('username')
    .ilike('username', 'bot\\_%');

  if (oldBots?.length) {
    console.log(`\n⚠️  ${oldBots.length} profiles still have "bot_N" names:`);
    oldBots.forEach(b => console.log(`  ${b.username}`));
  } else {
    console.log('\n✓ No "bot_N" name profiles found');
  }
}

main().catch(console.error);
