import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POKER_SEATS, createEmptyPokerTable } from '@metaverse/game-protocol';
import { GekkaRoom } from '../src/rooms/gekka.room';
import { PlayerState, PokerTableSchema } from '../src/state/city.state';
import { syncPokerSchema } from '../src/systems/syncPokerSchema';

test('schema Poker giữ sáu ghế và chỉ thay mảng khi nội dung đổi', () => {
  const view = createEmptyPokerTable();
  view.board = ['As', 'Kd', 'Qh'];
  view.showdown = [{ seatId: POKER_SEATS[0], cards: ['As', 'Ad'], label: 'Một đôi', won: 40 }];
  view.seats[0].chips = 1040;
  const schema = new PokerTableSchema();
  syncPokerSchema(schema, view);
  assert.deepEqual(Array.from(schema.board), view.board);
  assert.equal(schema.seats.length, 6);
  assert.equal(schema.seats[0].chips, 1040);
  assert.equal(schema.showdown[0].cards[1], 'Ad');
  const seat = schema.seats[0];
  let boardClears = 0;
  let showdownClears = 0;
  const clearBoard = schema.board.clear.bind(schema.board);
  const clearShowdown = schema.showdown.clear.bind(schema.showdown);
  schema.board.clear = () => { boardClears++; clearBoard(); };
  schema.showdown.clear = () => { showdownClears++; clearShowdown(); };
  syncPokerSchema(schema, view);
  assert.equal(boardClears, 0);
  assert.equal(showdownClears, 0);
  assert.equal(schema.seats[0], seat);
  view.board = [];
  view.showdown = [];
  syncPokerSchema(schema, view);
  assert.equal(boardClears, 1);
  assert.equal(showdownClears, 1);
});

test('người bị trói không thể đứng dậy hoặc đổi ghế bằng gói seat', () => {
  const room = new GekkaRoom();
  const messages = new Map<string, (client: { sessionId: string; send: (type: string, value: unknown) => void }, payload: unknown) => void>();
  (room as unknown as { onMessage: (type: string, handler: (client: { sessionId: string; send: (type: string, value: unknown) => void }, payload: unknown) => void) => void }).onMessage =
    (type, handler) => { messages.set(type, handler); };
  room.onCreate();
  const player = new PlayerState();
  player.id = 'player-a'; player.seatId = 'gekka-post'; player.y = -3.2;
  room.state.players.set('a', player);
  (room as unknown as { poker: { isCaptive: (id: string) => boolean } }).poker = { isCaptive: () => true };
  const sent: { type: string; value: unknown }[] = [];
  const client = { sessionId: 'a', send: (type: string, value: unknown) => { sent.push({ type, value }); } };
  messages.get('seat')!(client, { seatId: '' });
  assert.equal(player.seatId, 'gekka-post');
  assert.equal(player.y, -3.2);
  assert.equal(sent.at(-1)?.type, 'interaction-error');
  messages.get('seat')!(client, { seatId: POKER_SEATS[1] });
  assert.equal(player.seatId, 'gekka-post');
  assert.equal(room.canTransfer('player-a', 'street'), false);
  // Room không được matchMaker quản lý nên phải tự dừng các interval, nếu không tiến trình test treo mãi.
  room.setSimulationInterval(undefined);
  room.setPatchRate(null);
  room.clock.clear();
  room.clock.stop();
});

test('người đang bị đao phủ lôi đi: rời ghế, đi theo tư thế server, gói move và seat bị bỏ qua', () => {
  type Handler = (client: { sessionId: string; send: (type: string, value: unknown) => void }, payload: unknown) => void;
  const room = new GekkaRoom();
  const messages = new Map<string, Handler>();
  (room as unknown as { onMessage: (type: string, handler: Handler) => void }).onMessage = (type, handler) => { messages.set(type, handler); };
  room.onCreate();
  try {
    const player = new PlayerState();
    player.id = 'player-a'; player.seatId = POKER_SEATS[0];
    room.state.players.set('a', player);
    (room as unknown as { poker: { isCaptive: (id: string) => boolean } }).poker = { isCaptive: () => true };
    const internals = room as unknown as {
      applyEscortPose: (id: string, pose: { x: number; y: number; z: number; yaw: number }) => void;
      inputs: Map<string, unknown>;
    };
    internals.applyEscortPose('a', { x: 5.9, y: -1.6, z: 1, yaw: Math.PI });
    assert.equal(player.seatId, '');
    assert.deepEqual([player.x, player.y, player.z], [5.9, -1.6, 1]);
    const client = { sessionId: 'a', send: () => {} };
    messages.get('move')!(client, { x: 1, z: 0 });
    assert.equal(internals.inputs.has('a'), false);
    messages.get('seat')!(client, { seatId: POKER_SEATS[1] });
    assert.equal(player.seatId, '');
    assert.equal(room.canTransfer('player-a', 'street'), false);
  } finally {
    room.setSimulationInterval(undefined);
    room.setPatchRate(null);
    room.clock.clear();
    room.clock.stop();
  }
});
