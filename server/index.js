require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for admin tasks
);

// --- In-Memory State ---
const players = new Map(); // socket.id -> { userId, username, avatar, roomId }
const rooms = new Map();    // roomId -> { config, players: [], status }
const queue = [];          // { userId, socketId, gameType, stake, maxPlayers }
const whotDecks = new Map(); // roomId -> { deck, topCard, hands }
const whotTurnTimers = new Map(); // roomId -> timeout id

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
  return (game.turnIndex + step) % game.playerOrder.length;
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
      // All lives gone — this player forfeits. End the game.
      io.to(roomId).emit('whot_remote_action', { pi, msg: 'ELIMINATED!' });
      handleWhotGameOver(roomId, freshGame, 'FORFEIT');
      return;
    }

    // Still has lives — show timeout, skip turn (no card drawn)
    io.to(roomId).emit('whot_remote_action', { pi, msg: 'TIMEOUT!' });
    freshGame.pendingPicks = 0;
    freshGame.wasHoldOn = false;
    freshGame.turnIndex = getWhotNextTurnIndex(freshGame, 1);

    scheduleWhotTurnTimer(roomId);
    const updatedGame = whotDecks.get(roomId);
    if (!updatedGame) return;
    emitWhotState(roomId, updatedGame);
    io.to(roomId).emit('whot_turn_update', { nextTurn: updatedGame.turnIndex, turnStartedAt: updatedGame.turnStartedAt });
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

function broadcastQueue() {
  // Group by game config for efficiency
  const configs = new Set(queue.map(q => `${q.gameType}_${q.stake}`));
  
  for (const config of configs) {
    const [gameType, stake] = config.split('_');
    const searchers = queue.filter(q => q.gameType === gameType && q.stake === Number(stake));
    
    // Send to all sockets in this specific queue
    for (const q of searchers) {
      io.to(q.socketId).emit('queue_update', { 
        searchers: searchers.map(s => ({ id: s.userId, username: s.username })) 
      });
    }
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
        .select('wallet_balance')
        .eq('id', userId)
        .single();
      
      if (pErr || !profile) throw new Error('Could not verify balance');
      if (profile.wallet_balance < stake) {
        socket.emit('matchmaking_error', { message: 'Insufficient funds for this stake' });
        return;
      }

      // Deduct balance immediately (lock)
      const newBalance = profile.wallet_balance - stake;
      await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('id', userId);
      await supabase.from('transactions').insert({
        player_id: userId,
        amount: -stake,
        type: 'matchmaking_stake',
        status: 'completed',
        description: `Staked for ${gameType} (${maxPlayers}P)`
      });

      players.set(socket.id, { userId, username, avatar });

      const existingIdx = queue.findIndex(q => q.userId === userId);
      if (existingIdx !== -1) queue.splice(existingIdx, 1);

      const matches = findMatches({ userId, gameType, stake, maxPlayers });

      if (matches) {
        console.log(`Matching ${username} with ${matches.map(m => m.username).join(', ')}`);
        
        try {
          console.log('Attempting to create room in Supabase...');
          const colors = maxPlayers === 2 ? ['green', 'red'] : ['green', 'yellow', 'red', 'blue'];
          const playersList = [
            ...matches.map((m, i) => ({ id: m.userId, username: m.username || 'Opponent', color: colors[i], ready: true })),
            { id: userId, username, color: colors[matches.length], ready: true }
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
          }, 5000);

        } catch (err) {
          console.error("Failed to create room:", err.message);
          socket.emit('matchmaking_error', { message: 'Failed to create game room' });
        }

        for (const match of matches) {
          const idx = queue.findIndex(q => q.userId === match.userId);
          if (idx !== -1) queue.splice(idx, 1);
        }
        broadcastQueue();
      } else {
        queue.push({ userId, socketId: socket.id, username, gameType, stake, maxPlayers });
        socket.emit('queue_joined', { status: 'waiting' });
        broadcastQueue();
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
    setTimeout(() => {
      const diceValue = crypto.randomInt(1, 7); // 1-6 inclusive
      console.log(`Dice result for room ${player.roomId}: ${diceValue}`);
      
      io.to(player.roomId).emit('dice_rolled', { 
        userId: player.userId,
        value: diceValue 
      });
    }, 600); // 600ms of "spinning" time
  });

  // --- Whot! Handlers ---
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
          outSpecialMsg = 'Defence!';
        } else {
          game.pendingPicks += 2;
        }
      } else if (card.value === 5) {
        if (game.pendingPicks > 0) {
          game.pendingPicks = 0;
          outSpecialMsg = 'Defence!';
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
      wantShape
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
    const idx = queue.findIndex(q => q.socketId === socket.id);
    if (idx !== -1) {
      const q = queue[idx];
      console.log(`Refunding ₦${q.stake} to ${q.username}...`);
      
      try {
        // Refund logic
        const { data: profile } = await supabase.from('profiles').select('wallet_balance').eq('id', q.userId).single();
        if (profile) {
          await supabase.from('profiles').update({ wallet_balance: profile.wallet_balance + q.stake }).eq('id', q.userId);
          await supabase.from('transactions').insert({
            player_id: q.userId,
            amount: q.stake,
            type: 'matchmaking_refund',
            status: 'completed',
            description: 'Matchmaking search cancelled'
          });
        }
      } catch (e) {
        console.error('Refund failed:', e.message);
      }

      queue.splice(idx, 1);
      broadcastQueue();
    }
  });

  socket.on('client_ping', (timestamp) => {
    socket.emit('client_pong', timestamp);
  });

  socket.on('disconnect', async () => {
    const idx = queue.findIndex(q => q.socketId === socket.id);
    if (idx !== -1) {
      const q = queue[idx];
      console.log(`Disconnect: Refunding ₦${q.stake} to ${q.username}...`);
      
      try {
        const { data: profile } = await supabase.from('profiles').select('wallet_balance').eq('id', q.userId).single();
        if (profile) {
          await supabase.from('profiles').update({ wallet_balance: profile.wallet_balance + q.stake }).eq('id', q.userId);
        }
      } catch (e) {
        console.error('Disconnect refund failed:', e.message);
      }

      queue.splice(idx, 1);
      broadcastQueue();
    }

    const player = players.get(socket.id);
    if (player?.roomId) {
      clearWhotTurnTimer(player.roomId);
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
      // Formula: winner gets own stake back + opponents' stakes minus 10% platform fee
      const numPlayers = game.playerOrder.length;
      const prize = Math.floor(game.stake + game.stake * (numPlayers - 1) * 0.8);
      const { error: txErr } = await supabase.from('transactions').insert({
        player_id: winnerId,
        amount: prize,
        type: 'deposit',
        status: 'completed',
        description: `Whot win — ${game.playerOrder.length}P match`
      });
      if (txErr) console.error(`[WHOT] Fallback transaction also failed:`, txErr.message);
    } else {
      console.log(`[WHOT] Room ${roomId} marked finished. Winner ${winnerId} should receive payout via SQL trigger.`);
    }

    // 2. Insert Match History for every player (updates profile_stats VIEW)
    const gameHistoryEntries = game.playerOrder.map(userId => ({
      player_id: userId,
      game_type: 'whot',
      table_name: `${game.playerOrder.length}P Match`,
      stake: game.stake,
      result: userId === winnerId ? 'win' : 'loss',
      win_amount: userId === winnerId ? Math.floor(game.stake * game.playerOrder.length * 0.9) : 0
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

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Ludo Authority Server running on port ${PORT}`);
});
