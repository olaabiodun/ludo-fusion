require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
globalThis.WebSocket = ws; // Polyfill for Node.js < 22 WebSocket support
const { io } = require('socket.io-client');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runTest() {
  console.log("=== STARTING FULL LIFECYCLE TEST ===");
  
  const { data: auth1 } = await supabase.auth.signInWithPassword({ email: 'masterplay@ludo.local', password: 'password123' });
  const { data: auth2 } = await supabase.auth.signInWithPassword({ email: 'kingobi@ludo.local', password: 'password123' });
  
  if (!auth1.session || !auth2.session) {
    console.error("Auth failed! Seed users masterplay/kingobi not found.");
    process.exit(1);
  }
  
  const player1 = auth1.user;
  const player2 = auth2.user;

  console.log(`Test users: ${player1.email} (ID: ${player1.id}) vs ${player2.email} (ID: ${player2.id})`);
  
  // 2. Deposit simulated funds (Reset balances to 10000 for clean test)
  console.log("Simulating deposits (Resetting balances to 10000 NGN)...");
  await supabase.from('profiles').update({ wallet_balance: 10000 }).in('id', [player1.id, player2.id]);
  
  const { data: p1pre } = await supabase.from('profiles').select('wallet_balance').eq('id', player1.id).single();
  const { data: p2pre } = await supabase.from('profiles').select('wallet_balance').eq('id', player2.id).single();
  const p1Start = p1pre?.wallet_balance || 0;
  const p2Start = p2pre?.wallet_balance || 0;
  console.log(`Starting balances: P1=${p1Start}, P2=${p2Start}`);
  
  if (!auth1.session || !auth2.session) {
    console.error("Auth failed! Are test users seeded with password123?");
    process.exit(1);
  }
  
  console.log("Authentication successful.");
  
  // 3. Connect Sockets
  const socket1 = io('http://localhost:3001', {
    auth: { token: auth1.session.access_token }
  });
  
  const socket2 = io('http://localhost:3001', {
    auth: { token: auth2.session.access_token }
  });
  
  let p1Connected = false, p2Connected = false;
  let roomId = null;
  const stake = 500;
  
  await new Promise(resolve => {
    socket1.on('connect', () => { p1Connected = true; if(p2Connected) resolve(); });
    socket2.on('connect', () => { p2Connected = true; if(p1Connected) resolve(); });
  });
  console.log("Sockets connected.");
  
  socket1.onAny((event, ...args) => {
    console.log(`[Socket1 received]: ${event}`, args);
  });
  
  // 4. Join Matchmaking
  console.log(`Joining Ludo room with stake ${stake}...`);
  socket1.emit('join_matchmaking', { userId: player1.id, username: 'MasterPlay', gameType: 'ludo', stake, maxPlayers: 2 });
  setTimeout(() => {
    socket2.emit('join_matchmaking', { userId: player2.id, username: 'KingObi', gameType: 'ludo', stake, maxPlayers: 2 });
  }, 500);
  
  await new Promise((resolve, reject) => {
    socket1.on('match_found', (state) => {
      if (!roomId) {
        roomId = state.roomId;
        console.log(`Match found! Room ID: ${roomId}`);
        resolve();
      }
    });
    
    socket1.on('matchmaking_error', (err) => {
      console.error("P1 Matchmaking Error:", err);
      reject(err);
    });
    
    socket2.on('matchmaking_error', (err) => {
      console.error("P2 Matchmaking Error:", err);
      reject(err);
    });
  });
  
  // 5. Verify Deductions
  const { data: p1AfterJoin } = await supabase.from('profiles').select('wallet_balance').eq('id', player1.id).single();
  const { data: p2AfterJoin } = await supabase.from('profiles').select('wallet_balance').eq('id', player2.id).single();
  
  console.log(`Balances after deduction: ${player1.email}: ${p1AfterJoin.wallet_balance}, ${player2.email}: ${p2AfterJoin.wallet_balance}`);
  
  const expectedP1After = p1Start - stake;
  const expectedP2After = p2Start - stake;
  
  if (p1AfterJoin.wallet_balance !== expectedP1After || p2AfterJoin.wallet_balance !== expectedP2After) {
    console.error(`Deduction logic failed! Expected P1=${expectedP1After}, P2=${expectedP2After}`);
  } else {
    console.log(`Deduction logic SUCCESS (P1: ${p1Start} - ${stake} = ${expectedP1After}, P2: ${p2Start} - ${stake} = ${expectedP2After}).`);
  }
  
  // 6. Simulate Gameplay & Win
  console.log("Simulating gameplay... P1 claims win directly in Supabase.");
  const { error: winErr } = await supabase.from('game_rooms').update({
    status: 'finished',
    winner_id: player1.id,
    game_state: { finishedAt: Date.now(), reason: 'WIN' }
  }).eq('id', roomId);
  
  if (winErr) {
    console.error("Failed to mark game finished:", winErr.message);
  } else {
    console.log("Game room marked finished successfully.");
  }
  
  // 7. Verify Payout (Triggered by SQL when room marked finished)
  // Wait a few seconds for the DB trigger to fire and process
  console.log("Waiting 3 seconds for SQL payout triggers...");
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const { data: p1Final } = await supabase.from('profiles').select('wallet_balance').eq('id', player1.id).single();
  const { data: p2Final } = await supabase.from('profiles').select('wallet_balance').eq('id', player2.id).single();
  
  console.log(`Final Balances: ${player1.email}: ${p1Final.wallet_balance}, ${player2.email}: ${p2Final.wallet_balance}`);
  
  const expectedP1Final = expectedP1After + stake + (stake * (2 - 1) * 0.85); // 15% fee on opponent's stake
  const expectedP2Final = expectedP2After;
  
  if (p1Final.wallet_balance === expectedP1Final && p2Final.wallet_balance === expectedP2Final) {
    console.log("✅ FULL LIFECYCLE TEST PASSED! Money successfully deposited, deducted, played, and won.");
  } else {
    console.error(`❌ PAYOUT FAILED! Expected P1=${expectedP1Final}, P2=${expectedP2Final}`);
  }
  
  socket1.disconnect();
  socket2.disconnect();
  process.exit(0);
}

runTest().catch(err => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
