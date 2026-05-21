require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const BG_COLORS = [
  'b6e3f4','ffdfbf','c0aede','d1d4f9','ffd5dc','c1f4c1',
  'f0d5c1','c1d4f0','d4f0c1','f0c1d4','c1f0e0','e0c1f0',
  'f5e6cc','ccf5e6','e6ccf5','f5cce6','cce6f5','e6f5cc',
  'd4c4f0','f0d4c4','c4f0d4','d4f0c4','c4d4f0','f0c4d4',
];

const USERNAMES = [
  'ChiomaPulse','EmekaAce','FolakeX','KingZikoro','LadyNneka',
  'OlaBoss','KelechiPro','AmaraLudo','YemiDice','TundePlay',
  'AdebayoKing','NgoziStar','Oluwaseun','Temitope22','KelechiWin',
  'FunkeLudo','ChidiAce','Yetunde99','IkennaPro','BolanlePlay',
  'ObinnaX','Simisola','KayodeBoss','AmakaDice','GbengaRoll',
  'NnennaGold','FemiMove','Chiamaka','TundeKing','ZainabLudo',
  'ChisomStar','AdeolaPro','Ifeanyi22','LolaPlay','ObiomaX',
  'SeyiRoll','Kolawole','MoyoAce','Uchenna','AyodejiWin',
];

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash);
}

async function main() {
  for (const username of USERNAMES) {
    const { data: profiles } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
    if (!profiles) {
      console.log(`SKIP ${username} — no profile found`);
      continue;
    }
    const bgIdx = hashCode(username) % BG_COLORS.length;
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(username)}&backgroundColor=${BG_COLORS[bgIdx]}`;
    const { error } = await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', profiles.id);
    if (error) {
      console.error(`FAIL ${username}: ${error.message}`);
    } else {
      console.log(`OK ${username} -> avatar set`);
    }
  }
  console.log('\nAll bot avatars assigned!');
}

main().catch(console.error);
