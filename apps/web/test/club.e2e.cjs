// Kiểm tra chuyển phòng thật: chống vào từ xa, hai người cùng club, chat tách phòng và ra phố.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');
const { Client } = require('colyseus.js');
const { WORLD_ROOM_NAME, CLUB_ROOM_NAME, CLUB_SEATS, DEFAULT_CLUB_SHOW } = require('@metaverse/game-protocol');

async function waitFor(predicate, title) {
  for (let i = 0; i < 150; i++) { if (predicate()) return; await delay(40); }
  throw new Error(title);
}
async function guest() {
  const response = await fetch('http://localhost:4000/api/v1/auth/guest', { method: 'POST' });
  assert.equal(response.status, 201);
  const { token } = await response.json();
  const client = new Client('ws://localhost:2567'); client.auth.token = token;
  const room = await client.joinOrCreate(WORLD_ROOM_NAME, { token });
  await waitFor(() => room.state?.players?.has(room.sessionId), 'initial street state');
  return { token, client, room };
}
async function moveTo(room, x, z) {
  const deadline = Date.now() + 6500;
  while (Date.now() < deadline) {
    const player = room.state.players.get(room.sessionId);
    const dx = x - player.x, dz = z - player.z, distance = Math.hypot(dx, dz);
    if (distance < .3) { room.send('move', { x: 0, z: 0 }); await delay(200); return; }
    room.send('move', { x: dx / distance, z: dz / distance });
    await delay(65);
  }
  throw new Error('Không đến được cửa');
}

test('club: hai người, kiểm tra cửa, đồng bộ và cô lập phòng', { timeout: 60000 }, async () => {
  const rooms = new Set();
  try {
    const a = await guest(), b = await guest(); rooms.add(a.room); rooms.add(b.room);
    await assert.rejects(a.client.joinOrCreate(CLUB_ROOM_NAME, { token: a.token }), 'Thiếu room nguồn');
    await assert.rejects(a.client.joinOrCreate(CLUB_ROOM_NAME, { token: a.token, fromRoomId: a.room.roomId, x: 4.2, z: 1 }), 'Không được giả tọa độ cửa');
    await moveTo(a.room, 4.2, 1);
    const clubA = await a.client.joinOrCreate(CLUB_ROOM_NAME, { token: a.token, fromRoomId: a.room.roomId }); rooms.add(clubA);
    await waitFor(() => clubA.state?.players?.has(clubA.sessionId), 'club A state');
    assert.equal(clubA.state.zone, 'club');
    if (clubA.state.players.size === 1) {
      assert.equal(clubA.state.showBpm, DEFAULT_CLUB_SHOW.bpm);
      assert.ok(Math.abs(clubA.state.showOffset - DEFAULT_CLUB_SHOW.offset) < 1e-5);
      assert.equal(clubA.state.showCue, 'auto');
    }
    await a.room.leave(); rooms.delete(a.room);
    await waitFor(() => !b.room.state.players.has(a.room.sessionId), 'A biến mất khỏi phố');
    const streetChat = [], clubChat = [];
    b.room.onMessage('chat', value => streetChat.push(value));
    clubA.onMessage('chat', value => clubChat.push(value));
    const text = 'club-only-' + Date.now(); clubA.send('chat', { text });
    await waitFor(() => clubChat.some(m => m.text === text), 'club chat');
    assert.equal(streetChat.some(m => m.text === text), false);
    await moveTo(b.room, 4.2, 1);
    const clubB = await b.client.joinOrCreate(CLUB_ROOM_NAME, { token: b.token, fromRoomId: b.room.roomId }); rooms.add(clubB);
    await waitFor(() => clubB.state?.players?.has(clubA.sessionId), 'B thấy A trong club');
    await b.room.leave(); rooms.delete(b.room);
    assert.equal(clubA.roomId, clubB.roomId);
    assert.equal(clubA.state.danceEpoch, clubB.state.danceEpoch);
    assert.equal(clubA.state.showBpm, clubB.state.showBpm);
    assert.equal(clubA.state.showCue, clubB.state.showCue);
    const showEpoch = clubA.state.danceEpoch;
    clubB.send('club-show', { bpm: 150, offset: 0, cue: 'peak' });
    await delay(250);
    assert.equal(clubA.state.danceEpoch, showEpoch, 'Khách không giữ bàn DJ không được đổi show');
    clubA.send('club-show', { bpm: 99999, offset: 0, cue: 'peak' });
    await delay(250);
    assert.equal(clubA.state.danceEpoch, showEpoch, 'Không nhận metadata không hợp lệ');
    const rejectedA = [], rejectedB = [];
    const seat = CLUB_SEATS.find(candidate => !Array.from(clubA.state.players.values()).some(player => player.seatId === candidate.id));
    assert.ok(seat, 'Cần ít nhất một ghế trống cho fixture kiểm thử');
    clubA.onMessage('interaction-error', value => rejectedA.push(value));
    clubB.onMessage('interaction-error', value => rejectedB.push(value));
    clubA.send('seat', { seatId: seat.id, x: seat.x, z: seat.z });
    await waitFor(() => rejectedA.length > 0, 'Chặn ngồi ghế từ xa/giả tọa độ');
    assert.equal(clubA.state.players.get(clubA.sessionId).seatId, '');
    await moveTo(clubA, seat.standX + .4, seat.standZ);
    clubA.send('seat', { seatId: seat.id });
    await waitFor(() => clubB.state.players.get(clubA.sessionId).seatId === seat.id, 'B thấy A ngồi');
    const sitting = clubA.state.players.get(clubA.sessionId);
    const sittingPosition = { x: sitting.x, z: sitting.z };
    clubA.send('move', { x: -1, z: 1 }); await delay(350);
    assert.deepEqual({ x: sitting.x, z: sitting.z }, sittingPosition, 'Ngồi không được chạy');
    await moveTo(clubB, seat.standX + .4, seat.standZ);
    clubB.send('seat', { seatId: seat.id });
    await waitFor(() => rejectedB.length > 0, 'Không chiếm ghế đang có người');
    assert.equal(clubB.state.players.get(clubB.sessionId).seatId, '');
    clubA.send('seat', { seatId: '' });
    await waitFor(() => !clubB.state.players.get(clubA.sessionId).seatId, 'A đứng dậy đồng bộ');
    assert.ok(Math.abs(clubA.state.players.get(clubA.sessionId).x - seat.standX) < 1e-5);
    clubB.send('seat', { seatId: seat.id });
    await waitFor(() => clubA.state.players.get(clubB.sessionId).seatId === seat.id, 'Ghế được nhả sau khi đứng');
    await moveTo(clubA, 0, -3);
    await waitFor(() => clubB.state.players.get(clubA.sessionId).z < -2.5, 'B nhận chuyển động A');
    await assert.rejects(a.client.joinOrCreate(WORLD_ROOM_NAME, { token: a.token, fromRoomId: clubA.roomId }), 'Không ra phố từ xa cửa EXIT');
    await assert.rejects(a.client.joinOrCreate(WORLD_ROOM_NAME, { token: a.token }), 'Không được bỏ room nguồn để vượt qua EXIT');
    await moveTo(clubA, 0, 6.4);
    const street = await a.client.joinOrCreate(WORLD_ROOM_NAME, { token: a.token, fromRoomId: clubA.roomId }); rooms.add(street);
    await waitFor(() => street.state?.players?.has(street.sessionId), 'return street state');
    await clubA.leave(); rooms.delete(clubA);
    await waitFor(() => !clubB.state.players.has(clubA.sessionId), 'A biến mất khỏi club');
    assert.equal(street.state.zone, 'street');
    assert.ok(Math.abs(street.state.players.get(street.sessionId).x - 4.2) < .01);
    const back = await a.client.joinOrCreate(CLUB_ROOM_NAME, { token: a.token, fromRoomId: street.roomId }); rooms.add(back);
    await waitFor(() => back.state?.players?.has(clubB.sessionId), 'A quay lại thấy B ngồi');
    await street.leave(); rooms.delete(street);
    await clubB.leave(); rooms.delete(clubB);
    await waitFor(() => !back.state.players.has(clubB.sessionId), 'Disconnect nhả ghế cùng player');
    await moveTo(back, seat.standX + .4, seat.standZ);
    back.send('seat', { seatId: seat.id });
    await waitFor(() => back.state.players.get(back.sessionId).seatId === seat.id, 'Ngồi ghế sau khi chủ cũ disconnect');
  } finally { await Promise.allSettled([...rooms].map(room => room.leave())); }
});
