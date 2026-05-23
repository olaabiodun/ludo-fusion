require('dotenv').config();
const { io } = require('socket.io-client');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const GAME_TYPE = process.env.GAME_TYPE || 'ludo';
const STAKE = parseInt(process.env.STAKE || '100');
const MAX_PLAYERS = parseInt(process.env.MAX_PLAYERS || '2');

const NIGERIAN_NAMES = [
  'Chioma', 'Emeka', 'Folake', 'Chinedu', 'Adebayo', 'Ngozi', 'Oluwaseun',
  'Temitope', 'Kelechi', 'Funke', 'Chidi', 'Yetunde', 'Ikenna', 'Bolanle',
  'Obinna', 'Simisola', 'Kayode', 'Amaka', 'Gbenga', 'Nnenna', 'Femi',
  'Chiamaka', 'Tunde', 'Zainab', 'Chisom', 'Adeola', 'Ifeanyi', 'Lola',
  'Obioma', 'Seyi', 'Kolawole', 'Moyo', 'Uchenna', 'Ayodeji',
  'Damilola', 'Nkechi', 'Remi', 'Babatunde', 'Chinwe', 'Yemi', 'Adanna',
  'Eberechi', 'Ogechi', 'Solomon', 'Rebecca', 'Blessing', 'Alexander',
  'Precious', 'Emmanuel', 'Esther', 'Samuel', 'Mercy', 'David', 'Favour',
  'Victor', 'Deborah', 'Justice', 'Daniel', 'Patience', 'Grace', 'Michael',
  'Ruth', 'Peter', 'Sarah', 'Andrew', 'Mary', 'John', 'Peace'
];

const BOT_ACCOUNTS = Array.from({ length: 40 }, (_, i) => ({
  email: `bot_${i + 1}@ludofusion.app`,
  password: 'botpass123',
}));

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

class Bot {
  constructor(account) {
    this.email = account.email;
    this.password = account.password;
    this.displayName = account.displayName || null;
    this.userId = null;
    this.username = null;
    this.socket = null;
    this.supabase = null;
    this.color = null;
    this.roomId = null;
    this.gameOver = false;
    this.logPrefix = '[Bot]';
  }

  log(msg) {
    console.log(`${this.logPrefix} ${msg}`);
  }

  async login() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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
      this.socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });
      this.socket.on('connect', () => {
        this.log('Connected to game server');
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
        gameType: GAME_TYPE, stake: STAKE, maxPlayers: MAX_PLAYERS,
      });
      this.log(`Queued: ${GAME_TYPE} ₦${STAKE}`);
      const timeout = setTimeout(() => {
        this.socket.emit('leave_matchmaking');
        reject(new Error('Timeout'));
      }, 180000);
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

    this.socket.on('room_sync', (room) => {
      if (['finished', 'cancelled'].includes(room.status) && !this.gameOver) {
        this.gameOver = true;
        const result = room.winner_id === this.userId ? 'WON' : 'LOST';
        this.log(`Game ${result} in ${moves} moves`);
      }
    });

    while (!this.gameOver && moves < 300) {
      await sleep(1000);

      this.socket.emit('request_roll', { roomId: this.roomId });
      const dice = await new Promise(r => {
        this.socket.once('dice_rolled', (d) => {
          if (d.userId === this.userId) r(d.value);
        });
        setTimeout(() => r(null), 8000);
      });
      if (dice === null) continue;
      moves++;
      this.log(`Rolled ${dice} (move ${moves})`);

      await sleep(1000);

      const pawns = Array.from({ length: 4 }, (_, i) => `${this.color}-${i}`);
      const channel = this.supabase.channel(`room_${this.roomId}`);
      await channel.subscribe();
      channel.send({
        type: 'broadcast',
        event: 'move',
        payload: { color: this.color, pawnId: pick(pawns), diceValue: dice },
      });
      setTimeout(() => this.supabase.removeChannel(channel), 1000);
    }
  }

  async run() {
    if (!(await this.login())) return;
    await this.connect();
    while (true) {
      try {
        await this.joinQueue();
        await sleep(5000);
        await this.playLudo();
      } catch (err) {
        this.log(`Error: ${err.message}`);
      }
      await sleep(5000);
    }
  }
}

async function main() {
  for (const v of ['SUPABASE_URL', 'SUPABASE_ANON_KEY']) {
    if (!process.env[v]) {
      console.error(`Missing: ${v}`);
      process.exit(1);
    }
  }

  const bots = BOT_ACCOUNTS.map(acc => {
    const name = pick(NIGERIAN_NAMES);
    return new Bot({ ...acc, displayName: name });
  });
  console.log(`Starting ${bots.length} bots...`);
  await Promise.all(bots.map(bot => bot.run()));
}

main().catch(console.error);
