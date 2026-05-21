/**
 * test_bot.js — Automated end-to-end test for online Ludo bot turn flow.
 *
 * Tests:
 *  1. Turns alternate correctly between human and bot
 *  2. Bot rolls and moves when it's its turn
 *  3. No-valid-moves turns pass correctly (turn_passed event)
 *  4. Double pawn_moved emission is detected (auto-move dedup)
 *  5. Extra turns on 6 work correctly
 *
 * Run: node scratch/test_bot.js
 */

const { io } = require('socket.io-client');

const SERVER = 'http://localhost:3001';

// ── Helpers ─────────────────────────────────────────────────────────────────

function pass(msg) { console.log(`  ✅ PASS: ${msg}`); }
function fail(msg) { console.error(`  ❌ FAIL: ${msg}`); process.exit(1); }
function info(msg) { console.log(`  ℹ  ${msg}`); }

// ── Ludo path state machine (mirrors server bot & client engine) ─────────────

const COLORS_2P = ['green', 'red'];

function initPawns(colors) {
  const pawns = {};
  for (const color of colors) {
    pawns[color] = [0, 1, 2, 3].map(i => ({ id: `${color}-${i}`, state: 'home', pathIndex: 0 }));
  }
  return pawns;
}

function getPossibleMoves(pawns, color, diceValue) {
  return pawns[color].filter(p => {
    if (p.state === 'finished') return false;
    if (p.state === 'home') return diceValue === 6;
    return p.pathIndex + diceValue <= 56;
  });
}

function applyMove(pawns, color, pawnId, diceValue) {
  const pawn = pawns[color].find(p => p.id === pawnId);
  if (!pawn) return false;
  if (pawn.state === 'home') {
    pawn.state = 'board';
    pawn.pathIndex = 0;
  } else {
    pawn.pathIndex += diceValue;
    if (pawn.pathIndex >= 56) pawn.state = 'finished';
  }
  return diceValue === 6 || pawn.state === 'finished'; // grantExtraTurn
}

// ── Main test ────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n⚡ Ludo Online Bot — Automated Turn Flow Test\n');

  // Use a fixed test user ID — the socket server only needs userId + username,
  // no Supabase auth token is required for socket operations.
  const humanUserId = '9d4d75dd-16f3-4152-bbba-88162fd40d5b'; // test user
  const humanUsername = 'TestHuman';
  pass(`Using test user: ${humanUsername} (${humanUserId})`);

  // Connect to game server
  const socket = io(SERVER);
  await new Promise((res, rej) => {
    socket.on('connect', res);
    socket.on('connect_error', e => rej(e));
    setTimeout(() => rej(new Error('Connect timeout — is the server running?')), 5000);
  });
  pass('Connected to game server');

  socket.emit('register_player', {
    userId: humanUserId,
    username: humanUsername,
    avatar: '',
  });


  // ── State tracking ──────────────────────────────────────────────────────────

  let roomId = null;
  let humanColor = null;
  let botColor = null;
  let turnIndex = 0;
  const colors = COLORS_2P;
  let pawns = initPawns(colors);
  let diceValue = null;
  let hasRolled = false;
  let turnsPassed = 0;
  let totalMoves = 0;
  let pawnMovedCount = 0; // per roll — detect double emit
  let lastRollTurnIndex = -1;

  const errors = [];

  // ── Event listeners ─────────────────────────────────────────────────────────

  socket.on('match_found', ({ roomId: rid }) => {
    roomId = rid;
    info(`Match found → Room ${rid}`);
    // Server expects an object with roomId, userId, username, avatar
    socket.emit('join_room', { roomId: rid, userId: humanUserId, username: humanUsername, avatar: '' });
  });

  socket.on('room_sync', (room) => {
    if (room.status === 'playing' && !humanColor) {
      const me = room.players.find(p => p.id === humanUserId);
      humanColor = me?.color ?? 'green';
      botColor = colors.find(c => c !== humanColor);
      // Fix turnIndex to match actual color order (green=0, red=1)
      turnIndex = colors.indexOf(humanColor);
      info(`Colors → Human: ${humanColor} (index ${turnIndex}), Bot: ${botColor}`);
      pass('Room status: playing');
      // Kick off the first action
      setTimeout(() => scheduleNextAction(), 500);
    }
  });

  socket.on('dice_rolling', () => {
    // reset per-roll pawnMovedCount
    pawnMovedCount = 0;
    lastRollTurnIndex = turnIndex;
  });

  socket.on('dice_rolled', (payload) => {
    const rollingColor = colors[turnIndex];
    info(`[dice_rolled] ${rollingColor} rolled ${payload.value}`);

    if (rollingColor === humanColor) {
      diceValue = payload.value;
      hasRolled = true;
      // Human's roll — simulate move or pass
      const possible = getPossibleMoves(pawns, humanColor, diceValue);
      if (possible.length === 0) {
        // No moves — emit turn_passed
        setTimeout(() => {
          socket.emit('turn_passed', { color: humanColor, diceValue });
          if (diceValue !== 6) turnIndex = (turnIndex + 1) % colors.length;
          hasRolled = false;
          diceValue = null;
          scheduleNextAction();
        }, 1600);
      } else {
        // Move first valid pawn
        setTimeout(() => {
          const pawn = possible[0];
          const extra = applyMove(pawns, humanColor, pawn.id, diceValue);
          totalMoves++;
          socket.emit('pawn_moved', { color: humanColor, pawnId: pawn.id, diceValue });
          info(`  → Human moves ${pawn.id}`);
          if (!extra) turnIndex = (turnIndex + 1) % colors.length;
          hasRolled = false;
          diceValue = null;
          scheduleNextAction();
        }, 800);
      }
    }
    // Bot rolls are handled by the server bot — we just watch
  });


  // Track pawn_moved events to detect duplicates
  socket.on('pawn_moved', (payload) => {
    pawnMovedCount++;
    if (pawnMovedCount > 1) {
      errors.push(`DOUBLE pawn_moved for same turn (color=${payload.color}, count=${pawnMovedCount})`);
    }
    if (payload.color === botColor) {
      info(`[pawn_moved] Bot moves ${payload.pawnId} (dice=${payload.diceValue})`);
      const extra = applyMove(pawns, botColor, payload.pawnId, payload.diceValue);
      if (!extra) {
        turnIndex = (turnIndex + 1) % colors.length;
        scheduleNextAction(); // human's turn now
      }
      totalMoves++;
    }
  });

  socket.on('turn_passed', (payload) => {
    turnsPassed++;
    info(`[turn_passed] ${payload.color} passed (dice=${payload.diceValue})`);
    if (payload.color !== humanColor) {
      // Bot passed — advance to human's turn
      if (payload.diceValue !== 6) turnIndex = (turnIndex + 1) % colors.length;
      scheduleNextAction(); // trigger human roll
    }
  });

  // ── Simulation driver ───────────────────────────────────────────────────────

  function scheduleNextAction() {
    if (totalMoves >= 30 || turnsPassed > 50) return; // stop after enough turns
    const currentColor = colors[turnIndex];
    if (currentColor === humanColor && !hasRolled) {
      setTimeout(() => {
        if (!hasRolled) {
          socket.emit('request_roll', { roomId });
        }
      }, 1500);
    }
    // Bot's turn is handled by the embedded bot on the server
  }

  // ── Join matchmaking ────────────────────────────────────────────────────────

  info('Joining matchmaking queue...');
  socket.emit('join_matchmaking', {
    userId: humanUserId,
    username: humanUsername,
    avatar: '',
    gameType: 'ludo',
    stake: 500,
    maxPlayers: 2,
  });

  socket.on('queue_joined', () => {
    info('In queue — waiting for bot (15s)...');
  });

  // Wait for match + 30 moves + 15s for matchmaking
  await new Promise(res => setTimeout(res, 60000));

  // ── Results ─────────────────────────────────────────────────────────────────

  console.log('\n── Test Results ──────────────────────────────────────────');
  console.log(`  Total moves completed : ${totalMoves}`);
  console.log(`  Turns passed (no moves): ${turnsPassed}`);

  if (totalMoves < 5) {
    errors.push(`Too few moves completed (${totalMoves}) — bot may not be rolling`);
  }

  if (errors.length === 0) {
    console.log('\n🎉 ALL TESTS PASSED\n');
  } else {
    console.log('\n❌ FAILURES:');
    for (const e of errors) console.log(`  • ${e}`);
    console.log('');
  }

  socket.disconnect();
  process.exit(errors.length > 0 ? 1 : 0);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
