require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const BOT_USERNAMES = [
  'ChiomaPulse','EmekaAce','FolakeX','KingZikoro','LadyNneka',
  'OlaBoss','KelechiPro','AmaraLudo','YemiDice','TundePlay',
  'AdebayoKing','NgoziStar','Oluwaseun','Temitope22','KelechiWin',
  'FunkeLudo','ChidiAce','Yetunde99','IkennaPro','BolanlePlay',
  'ObinnaX','Simisola','KayodeBoss','AmakaDice','GbengaRoll',
  'NnennaGold','FemiMove','Chiamaka','TundeKing','ZainabLudo',
  'ChisomStar','AdeolaPro','Ifeanyi22','LolaPlay','ObiomaX',
  'SeyiRoll','Kolawole','MoyoAce','Uchenna','AyodejiWin',
];

function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h) + seed.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h % 1000) / 1000;
}

async function main() {
  for (const username of BOT_USERNAMES) {
    const r = seededRandom(username);
    const level = Math.floor(r * 15) + 2;
    const xp = Math.floor(r * 5000) + 100;
    const { data: profile } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
    if (!profile) {
      console.log(`SKIP ${username} — no profile`);
      continue;
    }
    const { error } = await supabase.from('profiles').update({ level, xp }).eq('id', profile.id);
    if (error) {
      console.error(`FAIL ${username}: ${error.message}`);
    } else {
      console.log(`OK ${username} -> Level ${level}, ${xp} XP`);
    }
  }
  console.log('\nDone!');
}

main().catch(console.error);
