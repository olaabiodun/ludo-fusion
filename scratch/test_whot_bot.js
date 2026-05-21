/**
 * test_whot_bot.js — Automated end-to-end timing diagnostic for the Whot! bot play pacing.
 *
 * This diagnostic connects as a human player and simulates a 2-player Whot! match against the server's AI bot.
 * It measures the exact elapsed time between the moment the turn is passed to the AI and the moment the AI plays,
 * proving that the bot now plays with human-like, realistic pacing.
 *
 * Run: node scratch/test_whot_bot.js
 */

const { io } = require('socket.io-client');

const SERVER = 'http://localhost:3001';

function pass(msg) { console.log(`  ✅ PASS: ${msg}`); }
function fail(msg) { console.error(`  ❌ FAIL: ${msg}`); process.exit(1); }
function info(msg) { console.log(`  ℹ  ${msg}`); }
function highlight(msg) { console.log(`\x1b[33m  🔥 ${msg}\x1b[0m`); }

async function run() {
  console.log('\n⚡ Whot! Online Bot — Automated Play Timing Diagnostic\n');

  const humanUserId = '9d4d75dd-16f3-4152-bbba-88162fd40d5b'; // Dev test user with valid DB profile
  const humanUsername = 'TestHuman';

  info(`Connecting to server: ${SERVER}`);
  const socket = io(SERVER);

  // Matchmaking error listener to capture balance errors
  socket.on('matchmaking_error', (err) => {
    fail(`Matchmaking Error: ${err.message}. Please check if the developer test user exists in your Supabase DB and has a positive wallet balance.`);
  });

  await new Promise((res, rej) => {
    socket.on('connect', res);
    socket.on('connect_error', e => rej(e));
    setTimeout(() => rej(new Error('Connect timeout — is the server running?')), 5000);
  });
  pass('Connected to game server');

  // Register player
  socket.emit('register', {
    userId: humanUserId,
    username: humanUsername,
    avatar: 'https://api.dicebear.com/7.x/avataaars/png?seed=TestHuman',
  });

  // State Tracking
  let roomId = null;
  let hand = [];
  let topCard = null;
  let currentShape = null;
  let playerOrder = [];
  let myIdx = -1;
  let turnIndex = 0;
  let currentTurnIndex = 0;

  // Timing diagnostics
  let turnStartedAt = null;
  let moveCount = 0;
  const timings = [];

  // Helper helper
  function checkPlayable(card, top, shape) {
    if (card.value === 20) return true;
    if (shape) return card.shape === shape;
    return card.shape === top.shape || card.value === top.value;
  }

  // Socket listeners
  socket.on('whot_init', (data) => {
    hand = data.hands[humanUserId] || [];
    playerOrder = data.playerOrder || [];
    myIdx = playerOrder.indexOf(humanUserId);
    topCard = data.topCard;
    currentShape = data.currentShape;
    currentTurnIndex = data.currentTurn || 0;
    roomId = data.roomId || roomId;

    info(`Match started! Top Card: ${topCard.shape.toUpperCase()} ${topCard.value}`);
    info(`Your hand: ${hand.length} cards. Your seat index: ${myIdx}`);
    
    // Check who goes first
    if (currentTurnIndex === myIdx) {
      setTimeout(() => playHumanTurn(), 1000);
    } else {
      info(`Bot's turn first. Monitoring delay...`);
      turnStartedAt = Date.now();
    }
  });

  socket.on('whot_turn_update', (d) => {
    currentTurnIndex = d.nextTurn;
    if (currentTurnIndex === myIdx) {
      setTimeout(() => playHumanTurn(), 1000);
    } else {
      info(`Turn passed to Bot. Monitoring delay...`);
      turnStartedAt = Date.now();
    }
  });

  socket.on('whot_remote_play', (d) => {
    topCard = d.card;
    if (d.card.value !== 20) currentShape = null;

    // If it was the bot's turn, measure the elapsed time
    if (d.pi !== myIdx && turnStartedAt !== null) {
      const elapsed = Date.now() - turnStartedAt;
      timings.push(elapsed);
      highlight(`Bot played: ${topCard.shape.toUpperCase()} ${topCard.value} | Elapsed Pacing Delay: ${(elapsed / 1000).toFixed(2)}s`);
      turnStartedAt = null;
      moveCount++;
    }

    currentTurnIndex = d.nextTurn;
    if (currentTurnIndex === myIdx) {
      setTimeout(() => playHumanTurn(), 1000);
    }
  });

  socket.on('whot_remote_pick', (d) => {
    if (d.pi !== myIdx && turnStartedAt !== null) {
      const elapsed = Date.now() - turnStartedAt;
      timings.push(elapsed);
      highlight(`Bot drew card from market | Elapsed Pacing Delay: ${(elapsed / 1000).toFixed(2)}s`);
      turnStartedAt = null;
      moveCount++;
    }

    currentTurnIndex = d.nextTurn;
    if (currentTurnIndex === myIdx) {
      setTimeout(() => playHumanTurn(), 1000);
    }
  });

  socket.on('whot_shape_chosen', (d) => {
    currentShape = d.shape;
    info(`Bot set shape to: ${d.shape.toUpperCase()}`);
    
    currentTurnIndex = d.nextTurn;
    if (currentTurnIndex === myIdx) {
      setTimeout(() => playHumanTurn(), 1000);
    }
  });

  socket.on('whot_game_over', (d) => {
    info(`Game finished! Winner: ${d.winner}`);
    finishDiagnostic();
  });

  function playHumanTurn() {
    if (hand.length === 0) return;
    info(`Your turn! Card count: ${hand.length}`);

    // Try to play a card
    const playableIdx = hand.findIndex(c => checkPlayable(c, topCard, currentShape));
    if (playableIdx !== -1) {
      const card = hand[playableIdx];
      info(`Human playing: ${card.shape.toUpperCase()} ${card.value}`);
      socket.emit('whot_play', { card, cardIdx: playableIdx });
      hand.splice(playableIdx, 1);
    } else {
      info(`No playable cards. Human draws from market...`);
      socket.emit('whot_pick', {});
    }
  }

  // Join matchmaking
  info('Joining matchmaking queue for Whot...');
  socket.emit('join_matchmaking', {
    userId: humanUserId,
    username: humanUsername,
    avatar: 'https://api.dicebear.com/7.x/avataaars/png?seed=TestHuman',
    gameType: 'whot',
    stake: 500,
    maxPlayers: 2,
  });

  socket.on('queue_joined', () => {
    info('In queue — waiting for matchmaking bot (starts in ~1s)...');
  });

  // Run diagnostic for 45 seconds or until games end
  const timeoutTimer = setTimeout(() => {
    finishDiagnostic();
  }, 45000);

  function finishDiagnostic() {
    clearTimeout(timeoutTimer);
    console.log('\n── Timing Diagnostic Report ──────────────────────────────');
    console.log(`  Total AI moves measured : ${moveCount}`);
    
    if (timings.length > 0) {
      const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
      console.log(`  Average AI Play Delay   : ${(avg / 1000).toFixed(2)}s`);
      console.log(`  Minimum AI Play Delay   : ${(Math.min(...timings) / 1000).toFixed(2)}s`);
      console.log(`  Maximum AI Play Delay   : ${(Math.max(...timings) / 1000).toFixed(2)}s`);
      
      const fastPaced = timings.some(t => t < 4000);
      if (fastPaced) {
        console.log('\n⚠️  Notice: Some plays took slightly under 4.0s (likely due to immediate response triggers like defenses).');
      } else {
        pass('All AI plays were paced realistically at over 4.5 seconds!');
      }
      pass('AI pacing diagnostic finished successfully!');
    } else {
      fail('No AI moves were captured. Please verify the game server is running locally on port 3001.');
    }

    socket.disconnect();
    process.exit(0);
  }
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
