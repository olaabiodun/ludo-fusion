const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
globalThis.WebSocket = ws; // Polyfill missing WebSocket in Node.js < 22 for Supabase Realtime
const crypto = require('crypto');
const { io: ioClient } = require('socket.io-client');

const app = express();
app.use(cors());
app.use(express.json());
app.get('/', (_, res) => res.send('ok'));

app.post('/delete-account', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid session token' });
    }

    const userId = user.id;
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('wallet_balance')
      .eq('id', userId)
      .single();

    if (profileError) {
      return res.status(400).json({ error: 'Unable to load account profile' });
    }

    if ((profile?.wallet_balance || 0) > 0) {
      return res.status(400).json({ error: 'Wallet balance must be zero before deleting your account' });
    }

    const cleanupOps = [
      () => supabase.from('blocked_players').delete().eq('blocker_id', userId),
      () => supabase.from('blocked_players').delete().eq('blocked_id', userId),
      () => supabase.from('announcement_reads').delete().eq('user_id', userId),
      () => supabase.from('inbox').delete().eq('user_id', userId),
      () => supabase.from('transactions').delete().eq('player_id', userId),
      () => supabase.from('games').delete().eq('player_id', userId),
      () => supabase.from('user_daily_claims').delete().eq('user_id', userId),
      () => supabase.from('user_missions').delete().eq('player_id', userId),
      () => supabase.from('referrals').delete().eq('referrer_id', userId),
      () => supabase.from('referrals').delete().eq('referred_id', userId),
      () => supabase.from('support_messages').delete().eq('user_id', userId),
      () => supabase.from('profile_stats').delete().eq('player_id', userId),
      () => supabase.from('profiles').delete().eq('id', userId),
    ];

    for (const op of cleanupOps) {
      try {
        await op();
      } catch (err) {
        console.warn('[DELETE ACCOUNT] Cleanup warning:', err?.message || err);
      }
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      return res.status(500).json({ error: deleteError.message || 'Failed to delete auth account' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('[DELETE ACCOUNT] Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // Use service role for admin tasks
  {
    auth: { persistSession: false },
    realtime: {
      WebSocket: ws
    }
  }
);

// --- Platform Configuration ---
let platformPercentage = 10.0;
async function loadPlatformConfig() {
  try {
    const { data, error } = await supabase
      .from('platform_config')
      .select('platform_percentage')
      .eq('id', 1)
      .single();
    if (!error && data && data.platform_percentage !== undefined) {
      platformPercentage = Number(data.platform_percentage);
      console.log(`[CONFIG] Dynamically loaded platform percentage: ${platformPercentage}%`);
    }
  } catch (err) {
    console.error('[CONFIG] Failed to load platform percentage:', err.message);
  }
}
loadPlatformConfig();

// Subscribe to real-time configuration changes from Supabase
supabase
  .channel('platform_config_changes')
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'platform_config', filter: 'id=eq.1' },
    (payload) => {
      if (payload.new && payload.new.platform_percentage !== undefined) {
        platformPercentage = Number(payload.new.platform_percentage);
        console.log(`[CONFIG] Realtime updated platform percentage: ${platformPercentage}%`);
      }
    }
  )
  .subscribe();

// --- In-Memory State ---
const players = new Map(); // socket.id -> { userId, username, avatar, roomId }
const rooms = new Map();    // roomId -> { config, players: [], status }
const queue = [];          // { userId, socketId, gameType, stake, maxPlayers }
const whotDecks = new Map(); // roomId -> { deck, topCard, hands }
const whotTurnTimers = new Map(); // roomId -> timeout id
const botMatchmakerTimers = new Map(); // socket.id -> timeout id

const WHOT_SHAPES = ['circle', 'triangle', 'cross', 'square', 'star'];
const WHOT_VALUES = [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14];

function createWhotDeck() {
  const deck = [];
  WHOT_SHAPES.forEach(shape => {
    WHOT_VALUES.forEach(value => deck.push({ shape, value }));
  });
  // Add Whot cards
  for (let i = 0; i < 4; i++) deck.push({ shape: 'whot', value: 20 });
  return deck.sort(() => Math.random() - 0.5);
}

function drawWhotStartingTopCard(deck) {
  const safeTopCard = card => ![1, 2, 5, 8, 14, 20].includes(card?.value);
  let guard = 0;

  while (deck.length > 0 && guard < 100) {
    const card = deck.shift();
    if (safeTopCard(card)) {
      return card;
    }
    deck.push(card);
    guard += 1;
  }

  return deck.shift() || { shape: 'circle', value: 4 };
}

function getWhotPlayerIndex(game, userId) {
  return game.playerOrder.findIndex(id => id === userId);
}

function getWhotNextTurnIndex(game, step = 1) {
  if (!game.playerOrder.length) return 0;
  let nextIdx = game.turnIndex;
  
  for (let s = 0; s < step; s++) {
    let loops = 0;
    do {
      nextIdx = (nextIdx + 1) % game.playerOrder.length;
      loops++;
      if (loops > game.playerOrder.length) break;
      const uid = game.playerOrder[nextIdx];
      const lives = (game.playerLives && game.playerLives[uid] !== undefined) ? game.playerLives[uid] : 4;
      const cards = game.hands[uid] ? game.hands[uid].length : 0;
      if (lives > 0 && cards > 0) break;
    } while (true);
  }
  return nextIdx;
}

function drawWhotCards(game, count) {
  const drawn = [];

  for (let i = 0; i < count; i++) {
    if (game.deck.length === 0) {
      game.deck = createWhotDeck();
    }

    const card = game.deck.shift();
    if (card) drawn.push(card);
  }

  if (game.deck.length < 5) {
    game.deck = [...game.deck, ...createWhotDeck()].sort(() => Math.random() - 0.5);
  }

  return drawn;
}

function buildWhotState(game) {
  return {
    topCard: game.topCard,
    currentTurn: game.turnIndex,
    currentShape: game.currentShape,
    pendingPicks: game.pendingPicks,
    wasHoldOn: game.wasHoldOn,
    turnStartedAt: game.turnStartedAt,
    gameEndsAt: game.gameEndsAt,
    playerLives: game.playerLives
  };
}

function emitWhotState(roomId, game) {
  io.to(roomId).emit('whot_state', buildWhotState(game));
}

function clearWhotTurnTimer(roomId) {
  const timer = whotTurnTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    whotTurnTimers.delete(roomId);
  }
}

function scheduleWhotTurnTimer(roomId) {
  clearWhotTurnTimer(roomId);

  const game = whotDecks.get(roomId);
  if (!game || !game.playerOrder.length) return;
  game.turnStartedAt = Date.now();

  const timer = setTimeout(() => {
    const freshGame = whotDecks.get(roomId);
    if (!freshGame || !freshGame.playerOrder.length) return;

    const timedOutUserId = freshGame.playerOrder[freshGame.turnIndex];
    const pi = freshGame.turnIndex;

    // Check for Global Game End first
    if (freshGame.gameEndsAt && Date.now() >= freshGame.gameEndsAt) {
      handleWhotGameOver(roomId, freshGame, 'TIME_UP');
      return;
    }

    if (freshGame.topCard?.value === 20 && !freshGame.currentShape) {
      // Auto-choose shape on timeout
      freshGame.currentShape = WHOT_SHAPES[Math.floor(Math.random() * WHOT_SHAPES.length)];
      freshGame.turnIndex = getWhotNextTurnIndex(freshGame, 1);
      freshGame.wasHoldOn = false;

      scheduleWhotTurnTimer(roomId);
      const updatedGame = whotDecks.get(roomId);
      if (!updatedGame) return;

      io.to(roomId).emit('whot_remote_action', { pi, msg: 'TIMEOUT!' });
      emitWhotState(roomId, updatedGame);
      io.to(roomId).emit('whot_shape_chosen', {
        pi,
        shape: updatedGame.currentShape,
        nextTurn: updatedGame.turnIndex,
        turnStartedAt: updatedGame.turnStartedAt
      });
      return;
    }

    // Life reduction on timeout
    const currentLives = (freshGame.playerLives && freshGame.playerLives[timedOutUserId] !== undefined) 
      ? freshGame.playerLives[timedOutUserId] 
      : 4;
    const newLives = Math.max(0, currentLives - 1);

    if (!freshGame.playerLives) freshGame.playerLives = {};
    freshGame.playerLives[timedOutUserId] = newLives;

    if (newLives <= 0) {
      // Find how many players are still active
      const aliveCount = freshGame.playerOrder.filter(uid => {
        const hCount = freshGame.hands[uid] ? freshGame.hands[uid].length : 0;
        const lvs = (freshGame.playerLives && freshGame.playerLives[uid] !== undefined) ? freshGame.playerLives[uid] : 4;
        return hCount > 0 && lvs > 0 && uid !== timedOutUserId; // Exclude the newly eliminated player
      }).length;

      io.to(roomId).emit('whot_remote_action', { pi, msg: 'ELIMINATED!' });

      if (aliveCount <= 1) {
        // Only 1 or 0 players left — end the game
        handleWhotGameOver(roomId, freshGame, 'FORFEIT');
        return;
      }

      // If more than 1 player is still active, just skip their turn permanently
      const drawnElim = drawWhotCards(freshGame, 1);
      freshGame.hands[timedOutUserId] = [...(freshGame.hands[timedOutUserId] || []), ...drawnElim];
      io.to(roomId).emit('whot_remote_pick', {
        pi,
        cards: drawnElim,
        nextTurn: getWhotNextTurnIndex(freshGame, 1),
        specialMsg: 'ELIMINATED!'
      });

      freshGame.pendingPicks = 0;
      freshGame.wasHoldOn = false;
      freshGame.turnIndex = getWhotNextTurnIndex(freshGame, 1);
      
      scheduleWhotTurnTimer(roomId);
      const updatedGame = whotDecks.get(roomId);
      if (!updatedGame) return;
      emitWhotState(roomId, updatedGame);
      return;
    }

    // Still has lives — draw 1 penalty card and skip turn
    const drawn = drawWhotCards(freshGame, 1);
    freshGame.hands[timedOutUserId] = [...(freshGame.hands[timedOutUserId] || []), ...drawn];
    io.to(roomId).emit('whot_remote_pick', {
      pi,
      cards: drawn,
      nextTurn: getWhotNextTurnIndex(freshGame, 1),
      specialMsg: 'TIMEOUT!'
    });

    freshGame.pendingPicks = 0;
    freshGame.wasHoldOn = false;
    freshGame.turnIndex = getWhotNextTurnIndex(freshGame, 1);

    scheduleWhotTurnTimer(roomId);
    const updatedGame = whotDecks.get(roomId);
    if (!updatedGame) return;
    emitWhotState(roomId, updatedGame);
  }, 15000);

  whotTurnTimers.set(roomId, timer);
}

// --- Matchmaking Logic ---
function findMatches(params) {
  console.log('Searching match for:', params);
  console.log('Current Queue Size:', queue.length);
  
  const matches = [];
  for (const q of queue) {
    if (q.gameType === params.gameType && 
        q.stake === params.stake && 
        q.maxPlayers === params.maxPlayers &&
        q.userId !== params.userId) {
      matches.push(q);
      if (matches.length === params.maxPlayers - 1) {
        console.log('MATCH FOUND!', matches.map(m => m.username).join(', '));
        return matches;
      }
    }
  }
  return null;
}

async function broadcastQueue() {
  try {
    const configs = new Set(queue.map(q => `${q.gameType}_${q.stake}`));
    
    for (const config of configs) {
      const [gameType, stake] = config.split('_');
      const searchers = queue.filter(q => q.gameType === gameType && q.stake === Number(stake));
      if (searchers.length === 0) continue;
      
      const ids = searchers.map(s => s.userId);
      let profileMap = new Map();
      let statsMap = new Map();

      try {
        const { data: profiles } = await supabase
          .from('profiles').select('id, username, avatar_url, level, xp').in('id', ids);
        if (profiles) profileMap = new Map(profiles.map(p => [p.id, p]));
      } catch (_) {}

      try {
        const { data: stats } = await supabase
          .from('profile_stats').select('*').in('player_id', ids);
        if (stats) statsMap = new Map(stats.map(s => [s.player_id, s]));
      } catch (_) {}

      const enriched = searchers.map(sq => {
        const sp = profileMap.get(sq.userId) || {};
        const ss = statsMap.get(sq.userId) || {};
        const name = sp.username || sq.username || '';
        let avatarUrl = sp.avatar_url || sq.avatar || '';
        if (!avatarUrl && name) {
          const bgColors = ['b6e3f4','ffdfbf','c0aede','d1d4f9','ffd5dc','c1f4c1','f0d5c1','c1d4f0','d4f0c1','f0c1d4','c1f0e0','e0c1f0'];
          const h = Math.abs(name.split('').reduce((a,c)=>((a<<5)-a)+c.charCodeAt(0)|0,0));
          avatarUrl = `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(name)}&backgroundColor=${bgColors[h%bgColors.length]}`;
        }
        return {
          id: sq.userId,
          username: name,
          avatar_url: avatarUrl,
          level: sp.level || 1,
          xp: sp.xp || 0,
          games_played: ss.total_matches || 0,
          wins: ss.total_wins || 0,
          win_rate: ss.win_rate || 0,
        };
      });

      for (const q of searchers) {
        io.to(q.socketId).emit('queue_update', { searchers: enriched });
      }
    }
  } catch (e) {
    console.error('broadcastQueue error:', e.message);
  }
}

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  socket.on('join_matchmaking', async (data) => {
    const { userId, username, avatar, gameType, stake, maxPlayers } = data;
    console.log(`Player ${username} joined matchmaking with stake ₦${stake}...`);

    try {
      // 1. Check & Lock Balance
      const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('wallet_balance, avatar_url')
        .eq('id', userId)
        .single();

      if (pErr || !profile) throw new Error('Could not verify balance');
      // Use secure RPC to check balance, deduct, and log transaction atomically
      const gameLabel = gameType === 'snake_ladder' ? 'Snake & Ladder' : gameType.charAt(0).toUpperCase() + gameType.slice(1);
      const { data: rpcData, error: rpcErr } = await supabase.rpc('matchmaking_deduct', {
        p_user_id: userId,
        p_amount: stake,
        p_game_label: gameLabel,
        p_max_players: maxPlayers
      });

      if (rpcErr || !rpcData || !rpcData.success) {
        console.error("RPC Error or deduction failed:", { rpcErr, rpcData, userId, stake, gameLabel, maxPlayers });
        socket.emit('matchmaking_error', { message: rpcData?.message || 'Insufficient funds or deduction failed' });
        return;
      }

      // Use avatar from profile if not sent by client (bots send empty)
      const resolvedAvatar = avatar || profile.avatar_url || '';

      players.set(socket.id, { userId, username, avatar });

      const existingIdx = queue.findIndex(q => q.userId === userId);
      if (existingIdx !== -1) queue.splice(existingIdx, 1);

      const matches = findMatches({ userId, gameType, stake, maxPlayers });

      if (matches) {
        console.log(`Matching ${username} with ${matches.map(m => m.username).join(', ')}`);
        
        try {
          console.log('Attempting to create room in Supabase...');
          const colors = maxPlayers === 2 ? ['green', 'red'] : ['green', 'yellow', 'red', 'blue'];
          const allUserIds = [userId, ...matches.map(m => m.userId)];
          const { data: allProfiles } = await supabase
            .from('profiles')
            .select('id, username, avatar_url, level')
            .in('id', allUserIds);
          const profileMap = new Map((allProfiles || []).map(p => [p.id, p]));

          const { data: allStats } = await supabase
            .from('profile_stats')
            .select('player_id, total_matches, total_wins, win_rate')
            .in('player_id', allUserIds);
          const statsMap = new Map((allStats || []).map(s => [s.player_id, s]));

          const playersList = [
            ...matches.map((m, i) => {
              const prof = profileMap.get(m.userId) || {};
              const stat = statsMap.get(m.userId) || {};
              const name = prof.username || m.username || '';
              let avatarUrl = prof.avatar_url || m.avatar || '';
              if (!avatarUrl && name) {
                const bgColors = ['b6e3f4','ffdfbf','c0aede','d1d4f9','ffd5dc','c1f4c1','f0d5c1','c1d4f0','d4f0c1','f0c1d4','c1f0e0','e0c1f0'];
                const h = Math.abs(name.split('').reduce((a,c)=>((a<<5)-a)+c.charCodeAt(0)|0,0));
                avatarUrl = `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(name)}&backgroundColor=${bgColors[h%bgColors.length]}`;
              }
              return {
                id: m.userId,
                username: name,
                avatar_url: avatarUrl,
                level: prof.level || 1,
                games_played: stat.total_matches || 0,
                wins: stat.total_wins || 0,
                win_rate: stat.win_rate || 0,
                color: colors[i],
                ready: true
              };
            }),
            {
              id: userId,
              username: (profileMap.get(userId) || {}).username || username,
              avatar_url: (profileMap.get(userId) || {}).avatar_url || avatar || '',
              level: (profileMap.get(userId) || {}).level || 1,
              games_played: (statsMap.get(userId) || {}).total_matches || 0,
              wins: (statsMap.get(userId) || {}).total_wins || 0,
              win_rate: (statsMap.get(userId) || {}).win_rate || 0,
              color: colors[matches.length],
              ready: true
            }
          ];

          const { data: newRoom, error: roomError } = await supabase
            .from('game_rooms')
            .insert({
              game_type: gameType,
              stake: stake,
              max_players: maxPlayers,
              status: 'waiting',
              players: playersList
            })
            .select()
            .single();

          if (roomError) throw roomError;

          const roomId = newRoom.id;
          for (const match of matches) {
            players.get(match.socketId).roomId = roomId;
          }
          players.get(socket.id).roomId = roomId;

          const startingRoom = { ...newRoom, status: 'waiting' };
          for (const match of matches) {
            io.to(match.socketId).emit('match_found', { roomId, room: startingRoom });
            io.to(match.socketId).emit('room_sync', startingRoom);
          }
          socket.emit('match_found', { roomId, room: startingRoom });
          socket.emit('room_sync', startingRoom);

          setTimeout(async () => {
            const startingRoomUpdate = { ...newRoom, status: 'starting' };
            await supabase.from('game_rooms').update({ status: 'starting' }).eq('id', roomId);
            io.to(roomId).emit('room_sync', startingRoomUpdate);

            if (gameType === 'whot') {
              const deck = createWhotDeck();
              const hands = {};
              playersList.forEach(p => {
                hands[p.id] = deck.splice(0, 5);
              });
              const topCard = drawWhotStartingTopCard(deck);
              console.log(`[WHOT] Room ${roomId} initialized with top card:`, topCard.shape, topCard.value);
               const playerLives = {};
              playersList.forEach(p => playerLives[p.id] = 4);

              whotDecks.set(roomId, {
                deck,
                topCard,
                hands,
                playerOrder: playersList.map(p => p.id),
                turnIndex: 0,
                pendingPicks: 0,
                currentShape: null,
                wasHoldOn: false,
                turnStartedAt: Date.now(),
                gameEndsAt: null, // Start on first play
                playerLives,
                stake: newRoom.stake || 0
              });
              io.to(roomId).emit('whot_init', { 
                hands, 
                topCard, 
                playerOrder: playersList.map(p => p.id),
                currentTurn: 0, 
                currentShape: null, 
                pendingPicks: 0, 
                wasHoldOn: false, 
                turnStartedAt: Date.now(), 
                gameEndsAt: null,
                playerLives,
                prize: (newRoom.stake || 0) * playersList.length * 0.9 // 10% fee
              });
              console.log(`[WHOT] Emitted whot_init to room ${roomId}`);
            }

            setTimeout(async () => {
              await supabase.from('game_rooms').update({ status: 'playing' }).eq('id', roomId);
              const playingRoom = { ...newRoom, status: 'playing' };
              io.to(roomId).emit('room_sync', playingRoom);
              if (gameType === 'whot') {
                scheduleWhotTurnTimer(roomId);
                const whotGame = whotDecks.get(roomId);
                if (whotGame) {
                  emitWhotState(roomId, whotGame);
                  io.to(roomId).emit('whot_turn_update', { nextTurn: whotGame.turnIndex, turnStartedAt: whotGame.turnStartedAt });
                }
              }
            }, 5000);
          }, 200);

        } catch (err) {
          console.error("Failed to create room:", err.message);
          socket.emit('matchmaking_error', { message: 'Failed to create game room' });
        }

        for (const match of matches) {
          const timer = botMatchmakerTimers.get(match.socketId);
          if (timer) {
            clearTimeout(timer);
            botMatchmakerTimers.delete(match.socketId);
          }
          const idx = queue.findIndex(q => q.userId === match.userId);
          if (idx !== -1) queue.splice(idx, 1);
        }
        
        // Also clear the timer for the socket that triggered the match
        const myTimer = botMatchmakerTimers.get(socket.id);
        if (myTimer) {
          clearTimeout(myTimer);
          botMatchmakerTimers.delete(socket.id);
        }
        
        await broadcastQueue();
      } else {
        queue.push({ userId, socketId: socket.id, username, avatar: resolvedAvatar, gameType, stake, maxPlayers });
        socket.emit('queue_joined', { status: 'waiting' });
        await broadcastQueue();

        // Only spawn bots for real human players (bots send avatar='' explicitly)
        if (avatar !== '') {
          // Wait 15 seconds to allow other real players to join before falling back to bots
          const timerId = setTimeout(() => {
            const playerIdx = queue.findIndex(q => q.socketId === socket.id);
            if (playerIdx === -1) return; // Player left queue or already matched
            
            // Count how many players are waiting in this exact queue
            const waitingPlayers = queue.filter(q => q.gameType === gameType && q.stake === stake && q.maxPlayers === maxPlayers).length;
            const needed = maxPlayers - waitingPlayers;
            
            if (needed > 0) {
              console.log(`[BOT MATCHMAKER] Spawning ${needed} bots to fill the room after timeout...`);
              for (let i = 0; i < needed; i++) {
                const delay = i === 0 ? 0 : Math.floor(Math.random() * 800) + 400;
                setTimeout(() => spawnEmbeddedBotForPlayer(gameType, stake, maxPlayers), delay);
              }
            }
          }, 15000); // 15 second delay
          botMatchmakerTimers.set(socket.id, timerId);
        }
      }
    } catch (e) {
      console.error('Matchmaking join error:', e.message);
      socket.emit('matchmaking_error', { message: e.message });
    }
  });

  socket.on('request_roll', (data) => {
    console.log(`Roll requested by ${socket.id}`);
    const player = players.get(socket.id);
    if (!player) {
      console.error(`Roll failed: Player not found for socket ${socket.id}`);
      return;
    }
    if (!player.roomId) {
      console.error(`Roll failed: Player ${player.username} has no roomId!`);
      // Try to use the roomId from the client data if provided
      if (data && data.roomId) {
        player.roomId = data.roomId;
        socket.join(data.roomId);
        console.log(`Assigned roomId ${data.roomId} to player ${player.username} from request data`);
      } else {
        return;
      }
    }

    // 1. Tell everyone the dice are starting to spin
    console.log(`Broadcasting dice_rolling to room ${player.roomId}`);
    io.to(player.roomId).emit('dice_rolling', { userId: player.userId });

    // 2. After a short delay (for animation), send the authoritative result
    const isBot = player.username.toLowerCase().includes('bot') || player.avatar === '';
    const delayTime = isBot ? 0 : 150; // Instant roll for bots
    setTimeout(() => {
      // Support developer-forced values for testing corner cases
      const diceValue = (data && data.forcedValue) ? Number(data.forcedValue) : crypto.randomInt(1, 7); // 1-6 inclusive
      console.log(`Dice result for room ${player.roomId}: ${diceValue} (forced=${!!data?.forcedValue})`);
      
      io.to(player.roomId).emit('dice_rolled', { 
        userId: player.userId,
        value: diceValue 
      });
    }, delayTime);
  });


  // Relay pawn moves to all other players in the room via socket
  socket.on('pawn_moved', (data) => {
    const player = players.get(socket.id);
    if (!player || !player.roomId) return;
    socket.to(player.roomId).emit('pawn_moved', {
      color: data.color,
      pawnId: data.pawnId,
      diceValue: data.diceValue,
    });
  });

  // Relay turn timeouts to all other players in the room via socket
  socket.on('player_timeout', (data) => {
    const player = players.get(socket.id);
    if (!player || !player.roomId) return;
    socket.to(player.roomId).emit('player_timeout', {
      targetColor: data.targetColor,
      turnId: data.turnId,
    });
  });

  // Relay turn-pass (no valid moves) to all other players in the room
  socket.on('turn_passed', (data) => {
    const player = players.get(socket.id);
    if (!player || !player.roomId) return;
    socket.to(player.roomId).emit('turn_passed', {
      color: data.color,
      diceValue: data.diceValue,
    });
  });


  socket.on('whot_play', (data) => {
    const player = players.get(socket.id);
    if (!player || !player.roomId) return;
    const game = whotDecks.get(player.roomId);
    if (!game) return;

    const { card, cardIdx } = data;
    // Use a mutable outgoing message variable (do NOT mutate incoming data)
    let outSpecialMsg = data.specialMsg || '';

    const pi = getWhotPlayerIndex(game, player.userId);
    if (pi === -1 || pi !== game.turnIndex) return;
    const expectedCard = game.hands[player.userId]?.[cardIdx];
    if (!expectedCard || expectedCard.shape !== card.shape || expectedCard.value !== card.value) return;

    // Server-side validation
    if (game.pendingPicks > 0) {
      if (![2, 5].includes(card.value) || card.value !== game.topCard.value) return;
    } else {
      if (card.value !== 20) {
        if (game.topCard.value === 20 && game.currentShape) {
          if (card.shape !== game.currentShape) return;
        } else {
          if (card.shape !== game.topCard.shape && card.value !== game.topCard.value) return;
        }
      }
    }

    // Trigger 10-minute timer on first play
    if (!game.gameEndsAt) {
      game.gameEndsAt = Date.now() + (10 * 60 * 1000);
      io.to(player.roomId).emit('whot_timer_started', { gameEndsAt: game.gameEndsAt });
    }

    game.topCard = card;
    if (card.value !== 20) {
      game.currentShape = null;
    }
    if (game.hands[player.userId]) {
      game.hands[player.userId].splice(cardIdx, 1);
    }

    let nextTurn = getWhotNextTurnIndex(game, 1);
    let wantShape = null;

    // Set special messages that match ActionPopup CONFIGS keys exactly
    if (card.value === 1)  outSpecialMsg = 'Hold On!';
    if (card.value === 8)  outSpecialMsg = 'Suspension!';
    if (card.value === 2)  outSpecialMsg = 'Pick 2!';
    if (card.value === 5)  outSpecialMsg = 'Pick 3!';
    if (card.value === 14) outSpecialMsg = 'General Market!';
    if (card.value === 20) outSpecialMsg = 'Whot!';

    if (card.value === 1) {
      game.wasHoldOn = true;
      nextTurn = pi;
    } else {
      game.wasHoldOn = false;

      if (card.value === 8) {
        nextTurn = getWhotNextTurnIndex(game, 2);
      } else if (card.value === 14) {
        // General Market: everyone else picks 1, then turn STAYS on the player who played it
        nextTurn = pi;

        game.playerOrder.forEach((userId, otherPi) => {
          if (otherPi === pi) return;

          const drawn = drawWhotCards(game, 1);
          game.hands[userId] = [...(game.hands[userId] || []), ...drawn];

          io.to(player.roomId).emit('whot_remote_pick', {
            pi: otherPi,
            cards: drawn,
            nextTurn,
            specialMsg: 'General Market!'
          });
        });
      } else if (card.value === 20) {
        game.currentShape = null;
        nextTurn = pi;
      }

      if (card.value === 2) {
        if (game.pendingPicks > 0) {
          game.pendingPicks = 0;
          outSpecialMsg = 'DEFENDED!';
        } else {
          game.pendingPicks += 2;
        }
      } else if (card.value === 5) {
        if (game.pendingPicks > 0) {
          game.pendingPicks = 0;
          outSpecialMsg = 'DEFENDED!';
        } else {
          game.pendingPicks += 3;
        }
      } else {
        // Any other card (including 20) clears the penalty stack
        if (card.value !== 1) game.pendingPicks = 0;
      }
    }

    game.turnIndex = nextTurn;

    socket.to(player.roomId).emit('whot_remote_play', {
      pi,
      card,
      cardIdx,
      nextTurn,
      specialMsg: outSpecialMsg,
      wantShape,
      pendingPicks: game.pendingPicks
    });

    // --- WIN DETECTION ---
    const currentHand = game.hands[player.userId] || [];
    if (currentHand.length === 0) {
      console.log(`[WHOT] Player ${player.username} WON by playing last card!`);
      handleWhotGameOver(player.roomId, game, 'WIN');
      return;
    }

    scheduleWhotTurnTimer(player.roomId);
    const updatedGame = whotDecks.get(player.roomId);
    if (!updatedGame) return;
    emitWhotState(player.roomId, updatedGame);
    io.to(player.roomId).emit('whot_turn_update', { nextTurn, turnStartedAt: updatedGame.turnStartedAt });
  });

  socket.on('whot_pick', (data) => {
    const player = players.get(socket.id);
    if (!player || !player.roomId) return;
    const game = whotDecks.get(player.roomId);
    if (!game) return;

    const pi = getWhotPlayerIndex(game, player.userId);
    if (pi === -1 || pi !== game.turnIndex) return;
    if (game.topCard?.value === 20 && !game.currentShape) return;

    const count = data.count || (game.pendingPicks > 0 ? game.pendingPicks : 1);
    const pickMsg = game.wasHoldOn ? 'Continue!' : (count > 1 ? `Pick ${count}!` : '');
    const drawn = drawWhotCards(game, count);
    game.hands[player.userId] = [...(game.hands[player.userId] || []), ...drawn];
    game.pendingPicks = 0;
    game.wasHoldOn = false;
    // Do NOT clear currentShape here — the called shape must persist until
    // a card matching it is actually played. Clearing it here was the bug
    // that made the caller's own matching cards fail the canPlayCard check.
    game.turnIndex = getWhotNextTurnIndex(game, 1);

    io.to(player.roomId).emit('whot_remote_pick', {
      pi,
      cards: drawn,
      nextTurn: game.turnIndex,
      specialMsg: data.specialMsg || pickMsg
    });
    scheduleWhotTurnTimer(player.roomId);
    const updatedGame = whotDecks.get(player.roomId);
    if (!updatedGame) return;
    emitWhotState(player.roomId, updatedGame);
    io.to(player.roomId).emit('whot_turn_update', { nextTurn: updatedGame.turnIndex, turnStartedAt: updatedGame.turnStartedAt });
  });

  socket.on('whot_choose_shape', (data) => {
    const player = players.get(socket.id);
    if (!player || !player.roomId) return;
    const game = whotDecks.get(player.roomId);
    if (!game) return;

    const pi = getWhotPlayerIndex(game, player.userId);
    if (pi === -1 || pi !== game.turnIndex) return;

    const shape = data.shape;
    if (!WHOT_SHAPES.includes(shape)) return;

    game.currentShape = shape;
    game.turnIndex = getWhotNextTurnIndex(game, 1);
    scheduleWhotTurnTimer(player.roomId);
    const updatedGame = whotDecks.get(player.roomId);
    if (!updatedGame) return;
    emitWhotState(player.roomId, updatedGame);
    io.to(player.roomId).emit('whot_shape_chosen', {
      pi,
      shape,
      nextTurn: updatedGame.turnIndex,
      turnStartedAt: updatedGame.turnStartedAt
    });
    io.to(player.roomId).emit('whot_turn_update', { nextTurn: updatedGame.turnIndex, turnStartedAt: updatedGame.turnStartedAt });
  });

  socket.on('whot_action', (data) => {
    const player = players.get(socket.id);
    if (!player || !player.roomId) return;
    io.to(player.roomId).emit('whot_remote_action', data);
  });

  socket.on('send_emoji', (data) => {
    const player = players.get(socket.id);
    if (!player || !player.roomId) return;
    io.to(player.roomId).emit('emoji_sent', {
      userId: player.userId,
      emoji: data.emoji,
      color: data.color
    });
  });

  socket.on('register', (data) => {
    const { userId, username, avatar } = data;
    players.set(socket.id, { userId, username, avatar });
    console.log(`Registered ${username} (${userId}) on socket ${socket.id}`);
  });

  socket.on('join_room', (data) => {
    const roomId = typeof data === 'string' ? data : data.roomId;
    console.log(`[SOCKET] Socket ${socket.id} joining room: ${roomId}`);
    socket.join(roomId);
    
    // If data contains profile, register it too
    if (typeof data === 'object' && data.userId) {
      players.set(socket.id, { 
        userId: data.userId, 
        username: data.username, 
        avatar: data.avatar,
        roomId 
      });
    }

    const player = players.get(socket.id);
    if (player) {
      player.roomId = roomId;
      console.log(`Associated player ${player.username} with room ${roomId}`);
      
      // SYNC WHOT STATE IF ALREADY INITIALIZED
      const whotGame = whotDecks.get(roomId);
      if (whotGame) {
        console.log(`Syncing existing Whot game state to ${player.username}`);
        socket.emit('whot_init', { 
          hands: whotGame.hands, 
          topCard: whotGame.topCard,
          playerOrder: whotGame.playerOrder,
          currentShape: whotGame.currentShape,
          currentTurn: whotGame.turnIndex,
          pendingPicks: whotGame.pendingPicks,
          wasHoldOn: whotGame.wasHoldOn,
          turnStartedAt: whotGame.turnStartedAt,
          isSync: true 
        });
      }
    } else {
      console.warn(`Socket ${socket.id} joined room ${roomId} but has no player profile in memory!`);
    }
  });

  socket.on('leave_matchmaking', async () => {
    const timer = botMatchmakerTimers.get(socket.id);
    if (timer) {
      clearTimeout(timer);
      botMatchmakerTimers.delete(socket.id);
    }

    const idx = queue.findIndex(q => q.socketId === socket.id);
    if (idx !== -1) {
      const q = queue[idx];
      console.log(`Refunding ₦${q.stake} to ${q.username}...`);
      
      try {
        const gameLabel = q.gameType === 'snake_ladder' ? 'Snake & Ladder' : q.gameType.charAt(0).toUpperCase() + q.gameType.slice(1);
        await supabase.rpc('matchmaking_refund', {
          p_user_id: q.userId,
          p_amount: q.stake,
          p_game_label: gameLabel,
          p_max_players: q.maxPlayers
        });
      } catch (e) {
        console.error('Refund failed:', e.message);
      }

      queue.splice(idx, 1);
      await broadcastQueue();
    }
  });

  socket.on('client_ping', (timestamp) => {
    socket.emit('client_pong', timestamp);
  });

  socket.on('disconnect', async () => {
    const timer = botMatchmakerTimers.get(socket.id);
    if (timer) {
      clearTimeout(timer);
      botMatchmakerTimers.delete(socket.id);
    }

    const idx = queue.findIndex(q => q.socketId === socket.id);
    if (idx !== -1) {
      const q = queue[idx];
      console.log(`Disconnect: Refunding ₦${q.stake} to ${q.username}...`);
      
      try {
        const gameLabel = q.gameType === 'snake_ladder' ? 'Snake & Ladder' : q.gameType.charAt(0).toUpperCase() + q.gameType.slice(1);
        await supabase.rpc('matchmaking_refund', {
          p_user_id: q.userId,
          p_amount: q.stake,
          p_game_label: gameLabel,
          p_max_players: q.maxPlayers
        });
      } catch (e) {
        console.error('Disconnect refund failed:', e.message);
      }

      queue.splice(idx, 1);
      await broadcastQueue();
    }

    const player = players.get(socket.id);
    if (player?.roomId) {
      socket.to(player.roomId).emit('player_disconnected', { userId: player.userId });
    }
    players.delete(socket.id);
  });
});

function calculateWhotHandScore(cards) {
  return cards.reduce((sum, card) => {
    if (card.shape === 'whot') return sum + 20;
    const val = typeof card.value === 'number' ? card.value : parseInt(card.value) || 0;
    if (card.shape === 'star') return sum + (val * 2);
    return sum + val;
  }, 0);
}

async function handleWhotGameOver(roomId, game, reason) {
  const scores = game.playerOrder.map(userId => {
    const hand = game.hands[userId] || [];
    return {
      userId,
      score: calculateWhotHandScore(hand),
      handCount: hand.length
    };
  });

  // Sort lowest to highest (Whot scoring)
  scores.sort((a, b) => a.score - b.score);
  const winnerId = scores[0].userId;

  console.log(`[WHOT] Game Over in ${roomId}. Reason: ${reason}. Winner: ${winnerId}`);

  try {
    // 1. Mark Room as Finished - Triggers public.payout_game_winner() SQL trigger
    // NOTE: Only update columns that exist in the schema (no 'metadata' column).
    const { error: roomErr } = await supabase.from('game_rooms').update({ 
      status: 'finished', 
      winner_id: winnerId,
      game_state: { scores, reason, finishedAt: Date.now() } // store in existing game_state JSONB
    }).eq('id', roomId);

    if (roomErr) {
      console.error(`[WHOT] Failed to update game_rooms for ${roomId}:`, roomErr.message);
      // Fallback: manually insert the winning transaction if trigger couldn't fire
      // Formula: winner gets own stake back + opponents' stakes minus platform fee
      const numPlayers = game.playerOrder.length;
      const factor = 1.0 - (platformPercentage / 100.0);
      const prize = Math.floor(game.stake + game.stake * (numPlayers - 1) * factor);
      const { error: txErr } = await supabase.from('transactions').insert({
        player_id: winnerId,
        amount: prize,
        type: 'deposit',
        status: 'completed',
        description: `${game.playerOrder.length}P Whot Match - Won`
      });
      if (txErr) console.error(`[WHOT] Fallback transaction also failed:`, txErr.message);
    } else {
      console.log(`[WHOT] Room ${roomId} marked finished. Winner ${winnerId} should receive payout via SQL trigger.`);
    }

    // 2. Insert Match History for every player (updates profile_stats VIEW)
    const factor = 1.0 - (platformPercentage / 100.0);
    const gameHistoryEntries = game.playerOrder.map(userId => ({
      player_id: userId,
      game_type: 'whot',
      table_name: `${game.playerOrder.length}P Match`,
      stake: game.stake,
      result: userId === winnerId ? 'win' : 'loss',
      win_amount: userId === winnerId ? Math.floor(game.stake * game.playerOrder.length * factor) : 0
    }));

    const { error: histErr } = await supabase.from('games').insert(gameHistoryEntries);
    if (histErr) console.error(`[WHOT] Failed to insert game history:`, histErr.message);

  } catch (err) {
    console.error(`[WHOT] Error archiving game ${roomId}:`, err.message);
  }

  io.to(roomId).emit('whot_game_over', { 
    reason, 
    scores, 
    winner: winnerId 
  });
  
  whotDecks.delete(roomId);
  clearWhotTurnTimer(roomId);
}

// ============================================================================
// ─── EMBEDDED MATCHMAKING BOTS ──────────────────────────────────────────────
// ============================================================================
class EmbeddedBot {
  constructor(account, gameType, stake, maxPlayers) {
    this.email = account.email;
    this.password = account.password;
    this.displayName = account.displayName || null;
    this.gameType = gameType;
    this.stake = stake;
    this.maxPlayers = maxPlayers;
    this.userId = null;
    this.username = null;
    this.socket = null;
    this.supabase = null;
    this.color = null;
    this.roomId = null;
    this.gameOver = false;
    this._whotTurnPending = false;
    this._whotTurnTimer = null;
    this.logPrefix = `[EmbeddedBot]`;
  }

  log(msg) {
    console.log(`${this.logPrefix} ${msg}`);
  }

  async login() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false },
        realtime: {
          WebSocket: ws
        }
      }
    );
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: this.email,
      password: this.password,
    });
    if (error) {
      this.log(`Login failed: ${error.message}`);
      return false;
    }
    this.userId = data.user.id;
    this.username = this.displayName || data.user.email?.split('@')[0] || `bot_${this.userId.slice(0, 6)}`;
    this.log(`Logged in as ${this.username}`);
    return true;
  }

  connect() {
    return new Promise((resolve) => {
      const targetPort = process.env.PORT || 3001;
      this.socket = ioClient(`http://localhost:${targetPort}`, { transports: ['websocket'] });
      this.socket.on('connect', () => {
        this.log('Connected to local game server');
        this.socket.emit('register', { userId: this.userId, username: this.username, avatar: '' });
        resolve();
      });
      this.socket.on('connect_error', (err) => this.log(`Connection error: ${err.message}`));
      this.socket.on('disconnect', () => this.log('Disconnected'));
    });
  }

  joinQueue() {
    return new Promise((resolve, reject) => {
      this.socket.emit('join_matchmaking', {
        userId: this.userId, username: this.username, avatar: '',
        gameType: this.gameType, stake: this.stake, maxPlayers: this.maxPlayers,
      });
      this.log(`Queued: ${this.gameType} ₦${this.stake}`);
      const timeout = setTimeout(() => {
        this.socket.emit('leave_matchmaking');
        reject(new Error('Timeout'));
      }, 60000);
      this.socket.once('match_found', (data) => {
        clearTimeout(timeout);
        this.roomId = data.roomId;
        this.color = data.room.players.find(p => p.id === this.userId)?.color;
        this.log(`Matched! Room: ${this.roomId}, Color: ${this.color}`);
        this.socket.emit('join_room', data.roomId);
        resolve();
      });
      this.socket.once('matchmaking_error', (d) => {
        clearTimeout(timeout);
        reject(new Error(d.message));
      });
    });
  }

  async playLudo() {
    this.gameOver = false;
    let moves = 0;
    
    // Retrieve player ordering and colors
    const { data: roomInfo } = await this.supabase
      .from('game_rooms')
      .select('players')
      .eq('id', this.roomId)
      .single();
      
    if (!roomInfo || !roomInfo.players) {
      this.log('Failed to fetch room players for state tracking.');
      return;
    }

    this.playersList = roomInfo.players;
    this.activeColors = roomInfo.players.map(p => p.color);
    this.turnIndex = 0;
    this.diceValue = null;
    this.hasRolled = false;

    // Initialize pawn state locally to mirror Ludo rules
    this.pawns = [];
    for (const color of this.activeColors) {
      for (let i = 0; i < 4; i++) {
        this.pawns.push({
          id: `${color}-${i}`,
          color,
          state: 'home',
          pathIndex: 0
        });
      }
    }

    this.socket.on('room_sync', (room) => {
      if (['finished', 'cancelled'].includes(room.status) && !this.gameOver) {
        this.gameOver = true;
        const result = room.winner_id === this.userId ? 'WON' : 'LOST';
        this.log(`Game ${result} in ${moves} moves`);
      }
    });

    // Human moved a pawn — apply it locally and advance the bot's turn
    this.socket.on('pawn_moved', (d) => {
      if (this.gameOver) return;
      // Guard: skip if turn already advanced (race condition with dice_rolled handler)
      if (d.color && this.activeColors[this.turnIndex] !== d.color) {
        this.log(`Human moved pawn: ${d.pawnId} (turn already advanced, ignoring move)`);
        return;
      }
      this.log(`Human moved pawn: ${d.pawnId} (dice=${d.diceValue})`);
      const steps = d.diceValue ?? this.diceValue;
      if (steps != null) {
        this.applyPawnMove(d.pawnId, steps);
      }
    });

    // Human timed out — advance to bot's turn
    this.socket.on('player_timeout', (d) => {
      if (this.gameOver) return;
      if (d.targetColor && d.targetColor !== this.color) {
        this.log(`Human timed out (${d.targetColor})`);
        this.turnIndex = (this.turnIndex + 1) % this.activeColors.length;
        this.triggerTurnAction();
      }
    });

    // Human rolled but had no valid moves — advance to bot's turn
    this.socket.on('turn_passed', (d) => {
      if (this.gameOver) return;
      if (d.color && d.color !== this.color) {
        // Guard: only advance if turn hasn't already advanced
        // (dice_rolled handler may have fast-tracked this)
        if (this.activeColors[this.turnIndex] !== d.color) {
          this.log(`Human passed (turn already advanced, skipping)`);
          return;
        }
        this.log(`Human passed (rolled ${d.diceValue}, no moves)`);
        if (d.diceValue !== 6) {
          this.turnIndex = (this.turnIndex + 1) % this.activeColors.length;
        }
        this.log(`→ Bot's turn now (index ${this.turnIndex})`);
        this.triggerTurnAction();
      }
    });

    // Dice handler — handle ALL rolls (own + human) for fast turn advancement.
    this.socket.on('dice_rolled', (d) => {
      if (this.gameOver) return;

      if (d.userId !== this.userId) {
        // ── Human (or other player) rolled ──
        this.log(`Human rolled ${d.value}`);

        // Fast-track: if human has NO valid moves, immediately advance turn
        // instead of waiting ~2s for client animation + turn_passed relay.
        const rollingPlayer = this.playersList.find(p => p.id === d.userId);
        const rollingColor = rollingPlayer?.color;
        const currentColor = this.activeColors[this.turnIndex];

        if (rollingColor && rollingColor === currentColor) {
          const validPawns = this.getPossibleMoves(rollingColor, d.value);
          if (validPawns.length === 0 && d.value !== 6) {
            this.turnIndex = (this.turnIndex + 1) % this.activeColors.length;
            this.log(`Human no moves → advancing turn to ${this.activeColors[this.turnIndex]}`);
            setTimeout(() => this.triggerTurnAction(), 80);
          }
        }
        return;
      }

      // ── Bot's own roll ──
      this.diceValue = d.value;
      this.hasRolled = true;
      this.log(`Bot rolled ${d.value}`);

      const validPawns = this.getPossibleMoves(this.color, d.value);

      if (validPawns.length === 0) {
        this.hasRolled = false;
        this.diceValue = null;
        if (d.value !== 6) {
          this.turnIndex = (this.turnIndex + 1) % this.activeColors.length;
        }
        this.log(`Bot: no moves → turn is now ${this.activeColors[this.turnIndex]}`);
        this.socket.emit('turn_passed', { color: this.color, diceValue: d.value });
        this.triggerTurnAction();
        return;
      }

      // Valid moves exist — pick the best pawn
      moves++;
      const bestPawnId = this.getBestMove(this.color, d.value);
      if (bestPawnId) {
        this.log(`Bot moves pawn: ${bestPawnId}`);
        this.socket.emit('pawn_moved', { color: this.color, pawnId: bestPawnId, diceValue: d.value });
        this.applyPawnMove(bestPawnId, d.value);
      }
    });

    // Trigger first turn check
    this.triggerTurnAction();

    // Keep bot alive until game ends
    while (!this.gameOver) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  getPerimeterIndex(color, state, pathIndex) {
    if (state !== 'board' || pathIndex > 50) return null;
    const START_INDICES = { green: 0, yellow: 13, red: 26, blue: 39 };
    return (START_INDICES[color] + pathIndex) % 52;
  }

  isPathBlocked(pawn, steps) {
    const START_INDICES = { green: 0, yellow: 13, red: 26, blue: 39 };
    const effectiveSteps = pawn.state === 'home' ? 0 : steps;
    const startI = pawn.state === 'home' ? 0 : 1;

    for (let i = startI; i <= effectiveSteps; i++) {
      const pathIdx = pawn.pathIndex + i;
      if (pathIdx > 50) continue;

      const perimeterIdx = (START_INDICES[pawn.color] + pathIdx) % 52;

      const opponentsAtCell = this.pawns.filter(p =>
        p.color !== pawn.color &&
        p.state === 'board' &&
        this.getPerimeterIndex(p.color, p.state, p.pathIndex) === perimeterIdx
      );

      const colorCounts = {};
      for (const op of opponentsAtCell) {
        colorCounts[op.color] = (colorCounts[op.color] || 0) + 1;
        if (colorCounts[op.color] >= 2) {
          const isVictimStart = perimeterIdx === START_INDICES[op.color];
          if (isVictimStart) {
            continue;
          }
          return true;
        }
      }
    }
    return false;
  }

  sanitizePawns() {
    for (const p of this.pawns) {
      if (p.state === 'board' && (isNaN(p.pathIndex) || p.pathIndex < 0 || p.pathIndex > 56)) {
        this.log(`WARN: sanitized pawn ${p.id} (NaN/invalid pathIndex → home)`);
        p.state = 'home';
        p.pathIndex = 0;
      }
    }
  }

  getPossibleMoves(color, diceValue) {
    this.sanitizePawns();
    const myPawns = this.pawns.filter(p => p.color === color);
    return myPawns.filter(p => {
      if (p.state === 'finished') return false;
      if (isNaN(p.pathIndex)) {
        this.log(`WARN: pawn ${p.id} had NaN pathIndex, resetting to home`);
        p.state = 'home';
        p.pathIndex = 0;
        return false;
      }
      if (p.state === 'home') {
        return diceValue === 6 && !this.isPathBlocked(p, 0);
      }
      if (p.state === 'board') {
        return p.pathIndex + diceValue <= 56 && !this.isPathBlocked(p, diceValue);
      }
      return false;
    });
  }

  getBestMove(color, diceValue) {
    const possibleMoves = this.getPossibleMoves(color, diceValue);
    if (possibleMoves.length === 0) return null;

    const SAFE_ZONES = new Set([8, 21, 34, 47]);
    const START_INDICES = { green: 0, yellow: 13, red: 26, blue: 39 };

    let bestPawnId = possibleMoves[0].id;
    let maxScore = -Infinity;

    for (const p of possibleMoves) {
      let score = 0;
      const nextPathIdx = p.state === 'home' ? 0 : p.pathIndex + diceValue;
      const nextState = nextPathIdx === 56 ? 'finished' : 'board';
      const myPerimIdx = this.getPerimeterIndex(p.color, nextState, nextPathIdx);

      // 1. CAPTURE (Highest Priority: +5000)
      if (myPerimIdx !== null && !SAFE_ZONES.has(myPerimIdx)) {
        const opponents = this.pawns.filter(op =>
          op.color !== p.color &&
          this.getPerimeterIndex(op.color, op.state, op.pathIndex) === myPerimIdx
        );
        for (const op of opponents) {
          const isVictimStart = myPerimIdx === START_INDICES[op.color];
          const opCount = this.pawns.filter(x => x.color === op.color && this.getPerimeterIndex(x.color, x.state, x.pathIndex) === myPerimIdx).length;
          if (opCount < 2 || isVictimStart) {
            score += 5000;
            break;
          }
        }
      }

      // 2. FINISHING (+2000)
      if (nextState === 'finished') score += 2000;

      // 3. EXIT HOME Base (+500)
      if (p.state === 'home') score += 500;

      // 4. MOVE TO SAFE ZONE (+300)
      if (myPerimIdx !== null && SAFE_ZONES.has(myPerimIdx)) score += 300;

      // 5. FORM BLOCKADE (+250)
      const myOtherPawns = this.pawns.filter(x => x.id !== p.id && x.color === p.color && this.getPerimeterIndex(x.color, x.state, x.pathIndex) === myPerimIdx);
      if (myOtherPawns.length > 0) score += 250;

      // 6. PROGRESS (1 pt per step)
      score += nextPathIdx;

      // 7. DANGER AVOIDANCE (-150 if ending turn in vulnerable spot)
      if (myPerimIdx !== null && !SAFE_ZONES.has(myPerimIdx)) {
        const nearOpponents = this.pawns.filter(op => op.color !== p.color && op.state === 'board');
        for (const op of nearOpponents) {
          const opPerim = this.getPerimeterIndex(op.color, op.state, op.pathIndex);
          if (opPerim !== null) {
            const dist = (myPerimIdx - opPerim + 52) % 52;
            if (dist > 0 && dist <= 6) score -= 150;
          }
        }

        // 8. START-CELL DANGER (-400 penalty for opponent's starting cell)
        for (const [col, startIdx] of Object.entries(START_INDICES)) {
          if (col !== p.color && myPerimIdx === startIdx) {
            score -= 400;
          }
        }
      }

      if (score > maxScore) {
        maxScore = score;
        bestPawnId = p.id;
      }
    }

    return bestPawnId;
  }

  applyPawnMove(pawnId, steps) {
    if (steps == null || isNaN(steps)) {
      this.log(`WARN: applyPawnMove called with invalid steps=${steps} for ${pawnId}, skipping`);
      return;
    }
    const pawn = this.pawns.find(p => p.id === pawnId);
    if (!pawn) return;

    if (pawn.state === 'board' && isNaN(pawn.pathIndex)) {
      this.log(`WARN: pawn ${pawnId} had NaN pathIndex on board, resetting to home`);
      pawn.state = 'home';
      pawn.pathIndex = 0;
      return;
    }

    let nextState = pawn.state;
    let nextPathIndex = pawn.pathIndex;
    let grantExtraTurn = steps === 6;

    if (pawn.state === 'home') {
      nextState = 'board';
      nextPathIndex = 0;
    } else if (pawn.state === 'board') {
      nextPathIndex += steps;
      if (nextPathIndex === 56) {
        nextState = 'finished';
        grantExtraTurn = true;
      }
    }

    pawn.state = nextState;
    pawn.pathIndex = nextPathIndex;

    // Check for capturing
    const myNewPerim = this.getPerimeterIndex(pawn.color, nextState, nextPathIndex);
    const SAFE_ZONES = new Set([8, 21, 34, 47]);
    const START_INDICES = { green: 0, yellow: 13, red: 26, blue: 39 };

    let capturedSomeone = false;
    if (myNewPerim !== null && !SAFE_ZONES.has(myNewPerim)) {
      const opponentsOnCell = this.pawns.filter(p =>
        p.color !== pawn.color && this.getPerimeterIndex(p.color, p.state, p.pathIndex) === myNewPerim
      );

      if (opponentsOnCell.length > 0) {
        const colorCounts = {};
        for (const op of opponentsOnCell) {
          colorCounts[op.color] = (colorCounts[op.color] || 0) + 1;
        }

        for (const op of opponentsOnCell) {
          const isStartingCellOfVictim = myNewPerim === START_INDICES[op.color];
          if (colorCounts[op.color] >= 2 && !isStartingCellOfVictim) {
            continue; // Blockade
          }

          // Capture!
          op.state = 'home';
          op.pathIndex = 0;
          capturedSomeone = true;
          this.log(`Captured opponent pawn ${op.id} on cell ${myNewPerim}`);
        }
      }
    }

    if (capturedSomeone) {
      pawn.state = 'finished';
      pawn.pathIndex = 56;
      grantExtraTurn = true;
      this.log(`Attacking pawn ${pawn.id} sent straight to finish line!`);
    }

    this.hasRolled = false;
    this.diceValue = null;

    if (grantExtraTurn) {
      this.log(`Player color ${pawn.color} granted extra turn!`);
    } else {
      this.turnIndex = (this.turnIndex + 1) % this.activeColors.length;
    }

    this.log(`Turn is now: ${this.activeColors[this.turnIndex]}`);
    this.triggerTurnAction();
  }

  triggerTurnAction() {
    if (this.gameOver) return;

    const activeColor = this.activeColors[this.turnIndex];
    if (activeColor === this.color) {
      this.log(`Bot turn: Requesting roll...`);
      this.socket.emit('request_roll', { roomId: this.roomId });
    }
  }

  // ─── WHOT BOT ──────────────────────────────────────────────────────────────
  getPlayableCards(hand, topCard, currentShape, pendingPicks) {
    if (hand.length === 1) {
      return hand.filter(c => ![1, 2, 5, 8, 14].includes(c.value));
    }
    
    if (pendingPicks > 0) {
      // Must defend Pick 2 with Pick 2, and Pick 3 with Pick 3
      return hand.filter(c => (c.value === 2 || c.value === 5) && c.value === topCard.value);
    }
    
    return hand.filter(c => {
      if (c.value === 20) return true; // Whot card always playable
      if (currentShape) return c.shape === currentShape; // After Whot: must match called shape
      return c.shape === topCard.shape || c.value === topCard.value;
    });
  }

  whotCardScore(card, hand, topCard, pendingPicks) {
    let score = 0;
    const opponentHandSizes = this.whotState?.opponentHandSizes || {};
    const opponentSizes = Object.values(opponentHandSizes);
    const minOpponentHand = opponentSizes.length > 0 ? Math.min(...opponentSizes) : 5;
    const isOpponentCloseToWin = minOpponentHand <= 2;

    // 1. Critical Defense (Must match penalty picks if pending)
    if (pendingPicks > 0 && (card.value === 2 || card.value === 5) && card.value === topCard.value) {
      return 10000; // Absolute priority
    }

    // 2. Base value (thin hand of normal cards first, keep Whot for later)
    if (card.value === 20) {
      if (hand.length === 2) {
        score += 800; // Perfect winning set up
      } else if (hand.length === 1) {
        score += 1000; // Play to win!
      } else if (hand.length > 4) {
        score += 50; // Save it: early game preference is common cards
      } else {
        score += 150;
      }
    } else {
      score += 100;
    }

    // 3. Shape Matching Heuristics (Card flow synergy)
    // Count how many cards in hand match this card's shape
    const shapeCount = hand.filter(c => c.shape === card.shape).length;
    score += shapeCount * 40; // The more cards of this shape we have, the more we want to play it!

    // Prefer high-value cards to reduce potential score if game ends on timer
    score += (card.value || 0) * 2;

    // 4. Special Cards Strategy
    if (card.value === 1) { // Hold On
      score += 250; // High value — thins hand and keeps turn
      const canFollowUp = hand.some(c => c !== card && (c.shape === card.shape || c.value === 20));
      if (canFollowUp) score += 150;
    }

    if (card.value === 8) { // Suspension
      score += 200;
      if (this.whotState?.playerOrder?.length === 2) {
        score += 150;
      }
    }

    if (card.value === 14) { // General Market
      score += 180;
    }

    // Attack cards
    if (card.value === 2) score += 220;
    if (card.value === 5) score += 240;

    // 5. Threat Response (If opponent is about to win)
    if (isOpponentCloseToWin) {
      if (card.value === 2 || card.value === 5 || card.value === 14) {
        score += 600; // Disrupt their win!
      }
      if (card.value === 8) {
        score += 400; // Skip their turn!
      }
      if (card.value === 1) {
        score += 300; // Retain turn!
      }
    }

    // 6. Prefer changing shape if top card is not matching our hand's dominant shape
    if (card.shape !== topCard.shape) {
      score += 30;
    }

    return score;
  }

  async playWhot() {
    this.gameOver = false;
    this.whotState = null;

    await new Promise((resolve, reject) => {
      this.socket.on('whot_init', async (data) => {
        const hand = data.hands[this.userId] || [];
        let playerOrder = data.playerOrder || [];
        let myIdx = playerOrder.indexOf(this.userId);
        
        if (myIdx === -1) {
          try {
            const { data: room } = await this.supabase
              .from('game_rooms')
              .select('players')
              .eq('id', this.roomId)
              .single();
            if (room?.players) {
              playerOrder = room.players.map(p => p.id);
              myIdx = playerOrder.indexOf(this.userId);
            }
          } catch (_) {}
        }
        if (myIdx === -1) {
          playerOrder = Object.keys(data.hands);
          myIdx = playerOrder.indexOf(this.userId);
        }

        const opponentHandSizes = {};
        if (data.hands) {
          Object.entries(data.hands).forEach(([uid, h]) => {
            if (uid !== this.userId) {
              opponentHandSizes[uid] = h.length;
            }
          });
        }

        this.whotState = {
          hand,
          topCard: data.topCard,
          currentShape: data.currentShape,
          pendingPicks: data.pendingPicks || 0,
          wasHoldOn: data.wasHoldOn || false,
          turnStartedAt: data.turnStartedAt,
          gameEndsAt: data.gameEndsAt,
          playerLives: data.playerLives,
          playerOrder,
          turnIndex: data.currentTurn || 0,
          myIdx,
          opponentHandSizes,
        };
        this.log(`Whot init — hand: ${hand.length} cards, myIdx: ${myIdx}, top: ${data.topCard.shape} ${data.topCard.value}`);
        resolve();
      });

      this.socket.on('whot_turn_update', (d) => {
        if (this.gameOver || !this.whotState) return;
        if (d.nextTurn === undefined) return;
        this.log(`Whot turn update: index ${d.nextTurn}`);
        this.whotState.turnIndex = d.nextTurn;
        if (d.turnStartedAt) this.whotState.turnStartedAt = d.turnStartedAt;
        this.triggerWhotTurn();
      });

      this.socket.on('whot_remote_play', (d) => {
        if (this.gameOver || !this.whotState) return;
        this.whotState.topCard = d.card;
        if (d.card.value !== 20) this.whotState.currentShape = null;
        if (d.specialMsg === 'Pick 2!') this.whotState.pendingPicks += 2;
        if (d.specialMsg === 'Pick 3!') this.whotState.pendingPicks += 3;
        if (d.specialMsg === 'Defence!') this.whotState.pendingPicks = 0;
        if (this.whotState.pendingPicks > 0 && (d.card.value === 2 || d.card.value === 5)) {
          this.whotState.pendingPicks = 0;
        }

        // Update opponent hand size
        const opponentId = this.whotState.playerOrder[d.pi];
        if (opponentId && opponentId !== this.userId) {
          if (!this.whotState.opponentHandSizes) this.whotState.opponentHandSizes = {};
          this.whotState.opponentHandSizes[opponentId] = Math.max(0, (this.whotState.opponentHandSizes[opponentId] || 5) - 1);
        }

        this.whotState.turnIndex = d.nextTurn;
        this.triggerWhotTurn();
      });

      this.socket.on('whot_remote_pick', (d) => {
        if (this.gameOver || !this.whotState) return;
        
        const opponentId = this.whotState.playerOrder[d.pi];
        if (opponentId) {
          const pickedCount = d.cards ? d.cards.length : 1;
          if (opponentId === this.userId) {
            if (d.cards?.length) {
              this.whotState.hand.push(...d.cards);
              this.log(`Bot picked cards: added ${d.cards.length} cards to hand. New total: ${this.whotState.hand.length}`);
            }
          } else {
            if (!this.whotState.opponentHandSizes) this.whotState.opponentHandSizes = {};
            this.whotState.opponentHandSizes[opponentId] = (this.whotState.opponentHandSizes[opponentId] || 5) + pickedCount;
          }
        }

        this.whotState.turnIndex = d.nextTurn;
        if (d.pendingPicks !== undefined) this.whotState.pendingPicks = d.pendingPicks;
        this.triggerWhotTurn();
      });

      this.socket.on('whot_shape_chosen', (d) => {
        if (this.gameOver || !this.whotState) return;
        this.whotState.currentShape = d.shape;
        this.whotState.turnIndex = d.nextTurn;
        if (d.turnStartedAt) this.whotState.turnStartedAt = d.turnStartedAt;
        this.triggerWhotTurn();
      });

      this.socket.on('whot_state', (d) => {
        if (this.gameOver || !this.whotState) return;
        this.log(`Whot state sync: turnIndex=${d.currentTurn}, pendingPicks=${d.pendingPicks}, shape=${d.currentShape}`);
        
        if (d.topCard) this.whotState.topCard = d.topCard;
        if (d.currentTurn !== undefined) this.whotState.turnIndex = d.currentTurn;
        if (d.currentShape !== undefined) this.whotState.currentShape = d.currentShape;
        if (d.pendingPicks !== undefined) this.whotState.pendingPicks = d.pendingPicks;
        if (d.wasHoldOn !== undefined) this.whotState.wasHoldOn = d.wasHoldOn;
        if (d.playerLives !== undefined) this.whotState.playerLives = d.playerLives;
        
        this.triggerWhotTurn();
      });

      this.socket.on('room_sync', (room) => {
        if (['finished', 'cancelled'].includes(room.status) && !this.gameOver) {
          this.gameOver = true;
          this._whotTurnPending = false;
          if (this._whotTurnTimer) { clearTimeout(this._whotTurnTimer); this._whotTurnTimer = null; }
          const result = room.winner_id === this.userId ? 'WON' : 'LOST';
          this.log(`Whot game ${result}`);
        }
      });

      this.socket.on('whot_game_over', (d) => {
        this.gameOver = true;
        this._whotTurnPending = false;
        if (this._whotTurnTimer) {
          clearTimeout(this._whotTurnTimer);
          this._whotTurnTimer = null;
        }
        this.log(`Whot game over received — winner: ${d.winner}`);
      });

      // Timeout after 30s if no whot_init received
      setTimeout(() => {
        if (!this.whotState) {
          this.log('Whot init timeout — game may not be Whot');
          resolve();
        }
      }, 30000);
    });

    while (!this.gameOver) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  triggerWhotTurn() {
    if (this.gameOver || !this.whotState) return;
    const { turnIndex, myIdx } = this.whotState;
    if (myIdx === -1 || myIdx !== turnIndex) {
      if (this._whotTurnTimer) {
        clearTimeout(this._whotTurnTimer);
        this._whotTurnTimer = null;
      }
      this._whotTurnPending = false;
      return;
    }

    if (this._whotTurnPending) return; // prevent duplicate triggers for same turn
    this._whotTurnPending = true;
    if (this._whotTurnTimer) clearTimeout(this._whotTurnTimer);
    this._whotTurnTimer = setTimeout(() => {
      this._whotTurnPending = false;
      this._whotTurnTimer = null;
      if (this.gameOver) return;

      this.log(`Bot Whot turn! Hand: ${this.whotState.hand.length} cards, pending picks: ${this.whotState.pendingPicks}`);

      // Handle pending picks
      if (this.whotState.pendingPicks > 0) {
        const defenseCard = this.whotState.hand.find(c => c.value === 2 || c.value === 5);
        if (defenseCard) {
          const idx = this.whotState.hand.indexOf(defenseCard);
          this.log(`Whot defense! Playing ${defenseCard.shape} ${defenseCard.value}`);
          this.socket.emit('whot_play', { card: defenseCard, cardIdx: idx });
          this.whotState.hand.splice(idx, 1);
          this.whotState.pendingPicks = 0;
          return;
        }
        // No defense — must pick
        this.log(`Whot: picking ${this.whotState.pendingPicks} cards (no defense)`);
        this.socket.emit('whot_pick', {});
        return;
      }

      // Check if need to choose shape after Whot card
      if (this.whotState.topCard.value === 20 && !this.whotState.currentShape) {
        const bestShape = this.mostCardsInHand()[0] || 'circle';
        this.log(`Whot: choosing shape ${bestShape}`);
        this.socket.emit('whot_choose_shape', { shape: bestShape });
        return;
      }

      // Find valid cards
      const valid = this.getPlayableCards(this.whotState.hand, this.whotState.topCard, this.whotState.currentShape, this.whotState.pendingPicks);
      if (valid.length === 0) {
        this.log(`Whot: no valid cards, picking 1`);
        this.socket.emit('whot_pick', {});
        return;
      }

      // Score and pick best card
      const scored = valid.map(c => ({
        card: c,
        score: this.whotCardScore(c, this.whotState.hand, this.whotState.topCard, this.whotState.pendingPicks),
      }));
      scored.sort((a, b) => b.score - a.score);
      const best = scored[0];
      const idx = this.whotState.hand.indexOf(best.card);
      this.log(`Whot playing ${best.card.shape} ${best.card.value} (score: ${best.score})`);
      this.socket.emit('whot_play', { card: best.card, cardIdx: idx });
      this.whotState.hand.splice(idx, 1);
    }, 1500 + Math.random() * 1500);
  }

  mostCardsInHand() {
    const counts = {};
    for (const c of this.whotState?.hand || []) {
      counts[c.shape] = (counts[c.shape] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(e => e[0]);
  }

  async playSnakeLadder() {
    this.gameOver = false;
    let moves = 0;

    // Retrieve player ordering and colors
    const { data: roomInfo } = await this.supabase
      .from('game_rooms')
      .select('players')
      .eq('id', this.roomId)
      .single();

    if (!roomInfo || !roomInfo.players) {
      this.log('Failed to fetch room players for state tracking.');
      return;
    }

    this.playersList = roomInfo.players;
    this.activeColors = roomInfo.players.map(p => p.color);
    this.turnIndex = 0;
    this.diceValue = null;
    this.hasRolled = false;

    this.socket.on('room_sync', (room) => {
      if (['finished', 'cancelled'].includes(room.status) && !this.gameOver) {
        this.gameOver = true;
        const result = room.winner_id === this.userId ? 'WON' : 'LOST';
        this.log(`Game ${result} in ${moves} moves`);
      }
    });

    // When anyone rolls dice:
    this.socket.on('dice_rolled', (d) => {
      if (this.gameOver) return;
      this.log(`Dice rolled: Player ${d.userId} rolled ${d.value}`);
      
      // Match the client-side baseline timeline before the next turn becomes
      // visually available:
      // 1200ms dice spin + 500ms buffer + walk animation + ~200ms settle.
      // This avoids bots starting their next roll before the UI has shown the
      // previous player's move finishing and the turn actually passing to them.
      const walkTime = 1200 + 500 + Math.max(800, d.value * 200) + 100 + 200;
      
      this.hasRolled = false;
      this.diceValue = null;

      // Advance turn locally after animation finishes
      setTimeout(() => {
        if (this.gameOver) return;
        this.turnIndex = (this.turnIndex + 1) % this.activeColors.length;
        this.log(`→ Turn advanced to: ${this.activeColors[this.turnIndex]} (index ${this.turnIndex})`);
        this.triggerSnakeTurnAction();
      }, walkTime);
    });

    // When anyone times out:
    this.socket.on('player_timeout', (d) => {
      if (this.gameOver) return;
      this.log(`Player timed out: ${d.targetColor}`);
      this.turnIndex = (this.turnIndex + 1) % this.activeColors.length;
      this.triggerSnakeTurnAction();
    });

    // Trigger initial turn action
    this.triggerSnakeTurnAction();

    // Keep bot alive until game ends
    while (!this.gameOver) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  triggerSnakeTurnAction() {
    if (this.gameOver) return;

    const activeColor = this.activeColors[this.turnIndex];
    if (activeColor === this.color) {
      this.log(`Bot Snake turn! Reacting...`);
      // Snappy and responsive roll initiation (0.6 to 1.2 seconds)
      const delay = 600 + Math.random() * 600;
      setTimeout(() => {
        if (this.activeColors[this.turnIndex] === this.color && !this.gameOver) {
          this.log(`Bot Snake turn: Requesting roll...`);
          this.socket.emit('request_roll', { roomId: this.roomId });
        }
      }, delay);
    }
  }

  async run() {
    if (!(await this.login())) return;
    await this.connect();
    try {
      await this.joinQueue();
      if (this.gameType === 'whot') {
        await this.playWhot();
      } else if (this.gameType === 'snake_ladder') {
        await this.playSnakeLadder();
      } else {
        await this.playLudo();
      }
    } catch (err) {
      this.log(`Error: ${err.message}`);
    } finally {
      if (this.socket) this.socket.disconnect();
    }
  }
}

const NIGERIAN_NAMES = [
  'Chioma', 'Emeka', 'Folake', 'Chinedu', 'Adebayo', 'Ngozi', 'Oluwaseun',
  'Temitope', 'Kelechi', 'Funke', 'Chidi', 'Yetunde', 'Ikenna', 'Bolanle',
  'Obinna', 'Simisola', 'Kayode', 'Amaka', 'Gbenga', 'Nnenna', 'Femi',
  'Chiamaka', 'Tunde', 'Zainab', 'Chisom', 'Adeola', 'Ifeanyi', 'Lola',
  'Obioma', 'Seyi', 'Kolawole', 'Moyo', 'Uchenna', 'Ayodeji',
  'Damilola', 'Nkechi', 'Remi', 'Babatunde', 'Chinwe', 'Yemi', 'Adanna',
  'Eberechi', 'Ogechi', 'Solomon', 'Rebecca', 'Blessing', 'Alexander',
  'Precious', 'Emmanuel', 'Esther', 'Samuel', 'Mercy', 'David', 'Favour',
  'Victor', 'Deborah', 'Justice', 'Daniel', 'Patience'
];

function spawnEmbeddedBotForPlayer(gameType, stake, maxPlayers) {
  const BOT_ACCOUNTS = Array.from({ length: 40 }, (_, i) => ({
    email: `bot_${i + 1}@ludofusion.app`,
    password: 'botpass123',
  }));
  const account = BOT_ACCOUNTS[Math.floor(Math.random() * BOT_ACCOUNTS.length)];
  const name = NIGERIAN_NAMES[Math.floor(Math.random() * NIGERIAN_NAMES.length)];
  console.log(`[BOT MATCHMAKER] Spawning bot "${name}" (${account.email}) for queue matching...`);
  const bot = new EmbeddedBot({ ...account, displayName: name }, gameType, stake, maxPlayers);
  bot.run();
}

const PORT = process.env.PORT || 3002;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Ludo Authority Server running on port ${PORT}`);
});
