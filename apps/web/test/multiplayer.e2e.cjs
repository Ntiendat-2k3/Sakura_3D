// Kiểm thử đường đi API → guest token → Colyseus với hai client độc lập trên server local.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');
const { Client } = require('colyseus.js');
const { WORLD_ROOM_NAME } = require('@metaverse/game-protocol');

const apiUrl = process.env.E2E_API_URL ?? 'http://localhost:4000';
const worldUrl = process.env.E2E_WORLD_URL ?? 'ws://localhost:2567';

/** Chờ state patch đến cả hai client để tránh kiểm tra trước lần đồng bộ đầu tiên. */
async function waitFor(condition, description, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) return;
    await delay(40);
  }
  throw new Error(`Hết thời gian chờ: ${description}`);
}

/** Tạo guest qua API thật rồi dùng token đó để vào phòng thật. */
async function joinGuest() {
  const response = await fetch(`${apiUrl}/api/v1/auth/guest`, { method: 'POST' });
  assert.equal(response.status, 201, 'Guest API phải tạo phiên mới');
  const { token } = await response.json();
  assert.equal(typeof token, 'string');
  const client = new Client(worldUrl);
  client.auth.token = token;
  return client.joinOrCreate(WORLD_ROOM_NAME, { token });
}

async function moveFor(room, input, durationMs = 600) {
  const deadline = Date.now() + durationMs;
  while (Date.now() < deadline) {
    room.send('move', input);
    await delay(65);
  }
  room.send('move', { x: 0, z: 0 });
}

test('API, xác thực và đồng bộ hai người chơi trong một phòng', { timeout: 30000 }, async () => {
  const health = await fetch(`${apiUrl}/api/v1/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).database, 'connected');

  await assert.rejects(new Client(worldUrl).joinOrCreate(WORLD_ROOM_NAME), 'Phòng phải từ chối token thiếu');

  let a;
  let b;
  try {
    a = await joinGuest();
    b = await joinGuest();
    assert.equal(a.roomId, b.roomId, 'Hai client phải ở cùng phòng');
    assert.notEqual(a.sessionId, b.sessionId);
    await waitFor(() => a.state?.players?.has(a.sessionId) && a.state.players.has(b.sessionId) && b.state?.players?.has(a.sessionId) && b.state.players.has(b.sessionId), 'hai avatar xuất hiện trên cả hai client');
    assert.notEqual(a.state.players.get(a.sessionId).id, b.state.players.get(b.sessionId).id, 'Guest identity phải khác nhau');

    const aStart = a.state.players.get(a.sessionId).z;
    await moveFor(a, { x: 0, z: -1 });
    await waitFor(() => b.state.players.get(a.sessionId).z < aStart - 0.5, 'B nhận di chuyển của A');

    const bStart = b.state.players.get(b.sessionId).z;
    await moveFor(b, { x: 0, z: 1 });
    await waitFor(() => a.state.players.get(b.sessionId).z > bStart + 0.5, 'A nhận di chuyển của B');

    const receivedA = [];
    const receivedB = [];
    a.onMessage('chat', message => receivedA.push(message));
    b.onMessage('chat', message => receivedB.push(message));
    const greetingA = `e2e-a-${Date.now()}`;
    const greetingB = `e2e-b-${Date.now()}`;
    a.send('chat', { text: greetingA });
    await waitFor(() => receivedB.some(message => message.text === greetingA), 'B nhận chat của A');
    b.send('chat', { text: greetingB });
    await waitFor(() => receivedA.some(message => message.text === greetingB), 'A nhận chat của B');

    await delay(300);
    const before = a.state.players.get(a.sessionId);
    const position = { x: before.x, z: before.z };
    a.send('move', { x: 999999, z: 999999, position: { x: 999999, z: 999999 } });
    await delay(250);
    const after = a.state.players.get(a.sessionId);
    assert.deepEqual({ x: after.x, z: after.z }, position, 'Server không được tin tọa độ client tự gửi');

    const bSessionId = b.sessionId;
    await b.leave();
    b = undefined;
    await waitFor(() => !a.state.players.has(bSessionId), 'avatar B biến mất sau khi rời phòng');
  } finally {
    await Promise.allSettled([a?.leave(), b?.leave()].filter(Boolean));
  }
});
