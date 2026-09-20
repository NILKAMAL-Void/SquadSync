# SquadSync

A zero-friction, real-time squad availability tracker. No accounts, no passwords —
your name lives in `localStorage`, and status syncs live over Socket.io.

## Files

- `index.html` — the whole front end (markup, CSS, vanilla JS). Served by `server.js`.
- `server.js` — Express + Socket.io server. Holds room/roster state in memory.
- `package.json` — dependencies (`express`, `socket.io`).

## Run it locally

```bash
npm install
npm start
```

Open **http://localhost:3000**. On first load you'll set a display name and land in a
fresh lobby at a URL like `http://localhost:3000/#lobby-neon-otter-91a`.

To test real-time sync, open that same URL in a second tab (or a private window, or
another device on your network) — status changes should appear in both within a
fraction of a second.

## How a lobby works

- The room ID lives in the URL hash (`#lobby-<id>`), so sharing the link is enough —
  no server-side lookup needed to find the room.
- Each browser gets a random client ID stored in `localStorage`, so refreshing the
  page keeps you as "you" in the roster instead of creating a duplicate.
- Room state is in-memory on the server only. Restarting the server clears all rooms —
  swap in Redis or a database if you need it to survive restarts.

## Deploying

### Replit (easiest for this stack)
1. Create a new Repl → **Import from GitHub** (or upload these three files).
2. Replit detects `package.json` and runs `npm install` automatically. If it doesn't,
   open the Shell and run `npm install` yourself.
3. Make sure the run command is `node server.js` (or `npm start`) — Replit usually
   picks this up from the `start` script automatically.
4. Click **Run**. Replit gives you a public HTTPS URL — share that as your lobby link.

### Render / Railway / Fly.io (recommended for production)
Any host that runs a persistent Node process works well here since Socket.io needs a
long-lived connection, not a request/response cycle:
1. Push these files to a GitHub repo.
2. Create a new **Web Service** (Render) or equivalent, point it at the repo.
3. Build command: `npm install`. Start command: `npm start` (or `node server.js`).
4. The platform sets `process.env.PORT` for you — `server.js` already reads it.

### Vercel
Vercel's serverless functions aren't built for persistent WebSocket connections, so a
plain Socket.io server like this one won't stay connected there the way it does on
Render/Railway/Fly/Replit. Two options if you want to stay on Vercel:
- Deploy the front end (`index.html`) to Vercel as a static file, and run `server.js`
  on one of the platforms above — point the client's `io()` call at that server's URL
  instead of same-origin.
- Or swap Socket.io for a serverless-friendly realtime provider (Pusher, Ably, or
  Supabase Realtime) and adapt the small amount of client/server code that talks to
  it — the UI and local-storage logic in `index.html` stay the same either way.

## Extending it

- Rename mid-session: add a small "edit name" affordance that emits an updated
  `join` with the same `clientId`.
- Push notifications when someone flips to "In": listen for the `roster` event
  server-side (or client-side with the Notifications API).
- Persistence across restarts: replace the in-memory `rooms` Map in `server.js`
  with Redis (`ioredis`) keyed by room ID.
