// Kiểm tra Gekkarō thật trên server đang chạy: hai người all-in, người thua sạch bị đao phủ lôi đi theo lộ trình,
// không tự đi được, xuống tới hầm rồi bị trói vào khung chữ A.
// GEKKA_E2E_HOLD_MS: giữ phòng mở thêm để người xem trong trình duyệt theo dõi tiếp (mặc định 0).
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');
const { Client } = require('colyseus.js');
const { WORLD_ROOM_NAME, GEKKA_ROOM_NAME, GEKKA_PORTAL, GEKKA_SEATS, GEKKA_BASEMENT_Y } = require('@metaverse/game-protocol');

async function waitFor(predicate, title, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) { if (predicate()) return; await delay(40); }
  throw new Error('Quá thời gian chờ: ' + title);
}
async function guest(rooms) {
  const response = await fetch('http://localhost:4000/api/v1/auth/guest', { method: 'POST' });
  assert.equal(response.status, 201);
  const { token } = await response.json();
  const client = new Client('ws://localhost:2567'); client.auth.token = token;
  const room = await client.joinOrCreate(WORLD_ROOM_NAME, { token });
  rooms.add(room);
  await waitFor(() => room.state?.players?.has(room.sessionId), 'initial street state');
  return { token, client, room };
}
async function moveTo(room, x, z, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const player = room.state.players.get(room.sessionId);
    const dx = x - player.x, dz = z - player.z, distance = Math.hypot(dx, dz);
    if (distance < .3) { room.send('move', { x: 0, z: 0 }); await delay(200); return; }
    room.send('move', { x: dx / distance, z: dz / distance });
    await delay(65);
  }
  throw new Error(`Không đến được (${x}, ${z})`);
}
/** Theo làn giữa phố tới cổng 月華楼 rồi sang phòng Gekkarō. */
async function enterGekka(user, rooms) {
  await moveTo(user.room, 1.5, 2, 15000);
  await moveTo(user.room, 1.5, GEKKA_PORTAL.z, 15000);
  await moveTo(user.room, GEKKA_PORTAL.x - 0.4, GEKKA_PORTAL.z, 8000);
  const room = await user.client.joinOrCreate(GEKKA_ROOM_NAME, { token: user.token, fromRoomId: user.room.roomId });
  rooms.add(room);
  room.onMessage('poker-hole', () => {});
  room.onMessage('poker-taunt-fx', () => {});
  await waitFor(() => room.state?.players?.has(room.sessionId), 'gekka state');
  return room;
}
async function sit(room, seatId) {
  const seat = GEKKA_SEATS.find(s => s.id === seatId);
  await moveTo(room, seat.standX, seat.standZ);
  room.send('seat', { seatId });
  await waitFor(() => room.state.players.get(room.sessionId).seatId === seatId, 'ngồi ' + seatId);
}
const seatOf = (room, seatId) => Array.from(room.state.poker.seats).find(seat => seat.seatId === seatId);

test('gekka: người thua sạch bị đao phủ lôi xuống hầm theo lộ trình rồi trói vào khung', { timeout: 180000 }, async () => {
  const rooms = new Set();
  try {
    const a = await guest(rooms), b = await guest(rooms);
    const [gA, gB] = await Promise.all([enterGekka(a, rooms), enterGekka(b, rooms)]);
    assert.equal(gA.roomId, gB.roomId);
    await sit(gA, 'gekka-player-3');
    await sit(gB, 'gekka-player-4');
    gA.send('poker-ready', true); gB.send('poker-ready', true);
    await waitFor(() => gA.state.poker.phase === 'betting', 'bắt đầu ván', 8000);

    // Người tới lượt all-in, người kia theo: chắc chắn có một người hết chip (trừ khi hòa).
    const bySeat = { 'gekka-player-3': gA, 'gekka-player-4': gB };
    for (let step = 0; step < 4 && gA.state.poker.phase === 'betting'; step++) {
      const turn = gA.state.poker.turnSeat;
      const room = bySeat[turn];
      const seat = seatOf(gA, turn);
      room.send('poker-act', { action: seat.bet < gA.state.poker.currentBet && step > 0 ? 'call' : 'allin' });
      await waitFor(() => gA.state.poker.turnSeat !== turn || gA.state.poker.phase !== 'betting', 'đổi lượt');
    }
    await waitFor(() => gA.state.poker.phase === 'showdown' || gA.state.poker.phase === 'waiting', 'showdown', 8000);
    const busted = ['gekka-player-3', 'gekka-player-4'].find(id => seatOf(gA, id).chips === 0);
    if (!busted) { test.skip?.('hòa pot, không có ai thua sạch'); return; }
    const prisoner = bySeat[busted];
    await waitFor(() => gA.state.poker.escort.startedAt > 0, 'đao phủ bắt đầu lôi người', 9000);
    assert.deepEqual(Array.from(gA.state.poker.escort.route), [busted]);

    // Theo dõi người bị lôi: rời ghế, y giảm dần qua cầu thang, gửi move cũng không tự đi được.
    const track = [];
    let pushedMove = false;
    while (gA.state.poker.escort.startedAt > 0) {
      const me = gA.state.players.get(prisoner.sessionId);
      track.push({ x: me.x, y: me.y, z: me.z, seatId: me.seatId });
      if (!pushedMove && me.seatId === '') { prisoner.send('move', { x: 1, z: 0 }); pushedMove = true; }
      await delay(200);
      if (track.length > 250) throw new Error('đoàn lôi người không kết thúc');
    }
    const walking = track.filter(point => point.seatId === '');
    assert.ok(walking.length > 10, `bị dắt đi trong ${walking.length} mẫu`);
    assert.ok(walking.some(point => point.y > -0.1) && walking.some(point => point.y < GEKKA_BASEMENT_Y + 0.1), 'đi từ salon xuống hầm');
    for (let i = 1; i < walking.length; i++) {
      const jump = Math.hypot(walking[i].x - walking[i - 1].x, walking[i].z - walking[i - 1].z);
      assert.ok(jump < 1.0, `không dịch chuyển tức thời: ${jump.toFixed(2)} m`);
    }
    await waitFor(() => gA.state.players.get(prisoner.sessionId).seatId === 'gekka-post', 'trói vào khung');
    assert.equal(gA.state.poker.dungeon.phase, 'capture');

    const hold = Number(process.env.GEKKA_E2E_HOLD_MS ?? 0);
    if (hold > 0) await delay(hold);
  } finally {
    // leave() treo nếu server đã khởi động lại (tsx watch) nên chỉ chờ tối đa 2 giây mỗi phòng.
    for (const room of rooms) await Promise.race([room.leave().catch(() => {}), delay(2000)]);
  }
});
