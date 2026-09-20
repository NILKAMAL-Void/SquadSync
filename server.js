// SquadSync — real-time squad availability server
// Express serves the static front-end; Socket.io broadcasts room/roster state.
// In-memory only — state resets on server restart (fine for a prototype).

const path = require('path');
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

app.get('/healthz', (req, res) => res.status(200).send('ok'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/**
 * rooms: Map<roomId, Map<clientId, {
 *   name: string,
 *   status: 'in' | 'late' | 'out',
 *   statusMeta: { etaMinutes: number } | null,
 *   updatedAt: number,
 *   online: boolean,
 *   socketId: string
 * }>>
 */
const rooms = new Map();

const VALID_STATUSES = new Set(['in', 'late', 'out']);
const MAX_NAME_LEN = 20;

function sanitizeName(raw) {
  if (typeof raw !== 'string') return 'Someone';
  const trimmed = raw.trim().slice(0, MAX_NAME_LEN);
  return trimmed.length ? trimmed : 'Someone';
}

function getRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Map());
  return rooms.get(roomId);
}

function broadcastRoster(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  const roster = Array.from(room.entries()).map(([clientId, m]) => ({
    clientId,
    name: m.name,
    status: m.status,
    statusMeta: m.statusMeta,
    updatedAt: m.updatedAt,
    online: m.online
  }));
  io.to(roomId).emit('roster', roster);
}

io.on('connection', (socket) => {
  socket.on('join', ({ roomId, clientId, name }) => {
    if (typeof roomId !== 'string' || typeof clientId !== 'string' || !roomId || !clientId) return;

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.clientId = clientId;

    const room = getRoom(roomId);
    const existing = room.get(clientId);

    room.set(clientId, {
      name: sanitizeName(name),
      status: existing && VALID_STATUSES.has(existing.status) ? existing.status : 'in',
      statusMeta: existing ? existing.statusMeta : null,
      updatedAt: existing ? existing.updatedAt : Date.now(),
      online: true,
      socketId: socket.id
    });

    broadcastRoster(roomId);
  });

  socket.on('status-update', ({ roomId, clientId, status, statusMeta }) => {
    if (!roomId || !clientId || !VALID_STATUSES.has(status)) return;
    const room = rooms.get(roomId);
    if (!room) return;
    const member = room.get(clientId);
    if (!member) return;

    member.status = status;
    member.statusMeta =
      statusMeta && Number.isFinite(statusMeta.etaMinutes)
        ? { etaMinutes: statusMeta.etaMinutes }
        : null;
    member.updatedAt = Date.now();

    broadcastRoster(roomId);
  });

  socket.on('disconnect', () => {
    const { roomId, clientId } = socket.data || {};
    if (!roomId || !clientId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    const member = room.get(clientId);
    // Only mark offline if this socket is still the member's current connection
    // (avoids a stale disconnect clobbering a fresher reconnect).
    if (member && member.socketId === socket.id) {
      member.online = false;
      broadcastRoster(roomId);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`SquadSync running at http://localhost:${PORT}`);
});
