import { config } from 'dotenv';
import path from 'node:path';
import { createServer } from 'node:http';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { WORLD_ROOM_NAME, CLUB_ROOM_NAME } from '@metaverse/game-protocol';
import { SakuraRoom } from './rooms/sakura.room';
import { ClubRoom } from './rooms/club.room';
config({ path: path.resolve(process.cwd(), '../../.env') });
async function main() {
  if (!process.env.DEMO_JWT_SECRET || process.env.DEMO_JWT_SECRET.length < 32) throw new Error('Set DEMO_JWT_SECRET >= 32 chars');
  const port = Number(process.env.WORLD_PORT ?? 2567);
  const httpServer = createServer(); // Colyseus quản lý HTTP matchmaking và WebSocket.
  const server = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
  server.define(WORLD_ROOM_NAME, SakuraRoom);
  server.define(CLUB_ROOM_NAME, ClubRoom);
  await server.listen(port, '127.0.0.1');
  console.log(`World server http://localhost:${port}`);
  const shutdown = async () => { await server.gracefullyShutdown(); process.exit(0); };
  process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
}
main().catch(err => { console.error(err); process.exitCode = 1; });
