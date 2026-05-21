require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const BOTS = [
  { email: 'bot_1@ludofusion.app', username: 'ChiomaPulse' },
  { email: 'bot_2@ludofusion.app', username: 'EmekaAce' },
  { email: 'bot_3@ludofusion.app', username: 'FolakeX' },
  { email: 'bot_4@ludofusion.app', username: 'KingZikoro' },
  { email: 'bot_5@ludofusion.app', username: 'LadyNneka' },
  { email: 'bot_6@ludofusion.app', username: 'OlaBoss' },
  { email: 'bot_7@ludofusion.app', username: 'KelechiPro' },
  { email: 'bot_8@ludofusion.app', username: 'AmaraLudo' },
  { email: 'bot_9@ludofusion.app', username: 'YemiDice' },
  { email: 'bot_10@ludofusion.app', username: 'TundePlay' },
];

async function main() {
  for (const bot of BOTS) {
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users?.users?.find(u => u.email === bot.email);
    if (!user) {
      console.log(`SKIP ${bot.email} — not found in auth`);
      continue;
    }
    const { error } = await supabase.from('profiles').update({ username: bot.username }).eq('id', user.id);
    if (error) {
      console.error(`FAIL ${bot.email}: ${error.message}`);
    } else {
      console.log(`UPDATED ${bot.email} -> username: ${bot.username}`);
    }
  }
}

main().catch(console.error);
