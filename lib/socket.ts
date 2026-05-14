import { io } from 'socket.io-client';

// ─── Shared socket singleton ──────────────────────────────────────────────────
// A single persistent connection for the whole app. Both the lobby (Gamelobby)
// and the game engine (WhotMultiplayer, GameplayScreen) share this one socket so
// all events arrive on — and are emitted from — the same connection.
// ─────────────────────────────────────────────────────────────────────────────

const SOCKET_URL = 'http://192.168.1.103:3001';

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});
