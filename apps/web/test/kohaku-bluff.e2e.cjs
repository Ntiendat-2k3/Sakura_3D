// Kiểm tra Kohaku Bluff thật: hai người ngồi bàn, chia bài riêng, úp bài, tố, bóp cò; người thứ ba bị khóa ghế.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');
const { Client } = require('colyseus.js');
const { WORLD_ROOM_NAME, KOHAKU_ROOM_NAME, KOHAKU_PORTAL, KOHAKU_SEATS, BLUFF_HAND_SIZE } = require('@metaverse/game-protocol');

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
async function moveTo(room, x, z, timeoutMs = 6500) {
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
/** Ra cổng Kohaku và sang phòng Kohaku; gắn sẵn listener nhận bài và lỗi. */
async function enterKohaku(user, rooms) {
  await moveTo(user.room, KOHAKU_PORTAL.x, KOHAKU_PORTAL.z + 0.5, 15000); // no-op nếu đã ở cổng
  const room = await user.client.joinOrCreate(KOHAKU_ROOM_NAME, { token: user.token, fromRoomId: user.room.roomId });
  rooms.add(room);
  const view = { room, hands: [], errors: [] };
  room.onMessage('bluff-hand', hand => view.hands.push(hand));
  room.onMessage('interaction-error', value => view.errors.push(value));
  await waitFor(() => room.state?.players?.has(room.sessionId), 'kohaku state');
  return view;
}
async function sit(view, seatId) {
  const seat = KOHAKU_SEATS.find(s => s.id === seatId);
  await moveTo(view.room, seat.standX, seat.standZ);
  view.room.send('seat', { seatId });
  await waitFor(() => view.room.state.players.get(view.room.sessionId).seatId === seatId, 'ngồi ' + seatId);
}

test('kohaku bluff: hai người chơi trọn một lần tố, người thứ ba bị khóa ghế', { timeout: 90000 }, async () => {
  const rooms = new Set();
  let poll;
  try {
    const a = await guest(rooms), b = await guest(rooms), c = await guest(rooms);
    // C chờ sẵn ở cổng trên phố để không tốn thời gian đi bộ trong cửa sổ 30 giây của lượt đầu.
    await moveTo(c.room, KOHAKU_PORTAL.x, KOHAKU_PORTAL.z + 0.5, 15000);
    const kA = await enterKohaku(a, rooms), kB = await enterKohaku(b, rooms);
    assert.equal(kA.room.roomId, kB.room.roomId);
    await sit(kA, 'kohaku-player-1'); await sit(kB, 'kohaku-player-2');
    assert.equal(kA.room.state.bluff.phase, 'lobby');

    kA.room.send('bluff-ready', true); kB.room.send('bluff-ready', true);
    await waitFor(() => kA.hands.length > 0 && kB.hands.length > 0, 'nhận bluff-hand');
    await waitFor(() => kA.room.state.bluff.phase === 'turn' && kB.room.state.bluff.phase === 'turn', 'phase turn');
    const handA = kA.hands.at(-1), handB = kB.hands.at(-1);
    assert.equal(handA.length, BLUFF_HAND_SIZE); assert.equal(handB.length, BLUFF_HAND_SIZE);
    const idsA = new Set(handA.map(card => card.id));
    assert.ok(handB.every(card => !idsA.has(card.id)), 'Hai tay bài không trùng lá');
    // Bài trên tay không được xuất hiện trong state mà client nhìn thấy.
    for (const view of [kA, kB]) {
      const leaked = [];
      JSON.stringify(view.room.state.toJSON(), (key, value) => { if (typeof value === 'string') leaked.push(value); return value; });
      for (const card of [...handA, ...handB]) assert.equal(leaked.includes(card.id), false, 'Lá bài lộ trong state');
      for (const seat of view.room.state.bluff.seats) assert.ok(seat.cardCount === 0 || seat.cardCount === BLUFF_HAND_SIZE);
    }

    const bluff = kA.room.state.bluff;
    const players = { 'kohaku-player-1': { view: kA, hand: handA }, 'kohaku-player-2': { view: kB, hand: handB } };
    const turnSeat = bluff.turnSeat;
    assert.ok(players[turnSeat], 'Lượt thuộc một trong hai người ngồi');
    const accuserSeat = turnSeat === 'kohaku-player-1' ? 'kohaku-player-2' : 'kohaku-player-1';
    const player = players[turnSeat], accuser = players[accuserSeat];

    // Người thứ ba vào phòng giữa ván rồi thử ngồi ghế trống.
    const kC = await enterKohaku(c, rooms);
    await waitFor(() => kC.room.state.bluff.phase === 'turn', 'người vào sau thấy đúng pha');
    assert.equal(kC.room.state.bluff.tableRank, bluff.tableRank);
    await moveTo(kC.room, KOHAKU_SEATS.find(s => s.id === 'kohaku-player-3').standX, KOHAKU_SEATS.find(s => s.id === 'kohaku-player-3').standZ);
    kC.room.send('seat', { seatId: 'kohaku-player-3' });
    await waitFor(() => kC.errors.length > 0, 'interaction-error khi ngồi ghế trống giữa ván');
    assert.match(kC.errors[0].text, /Ván đang diễn ra/);
    assert.equal(kC.room.state.players.get(kC.room.sessionId).seatId, '');

    // Ghi lại các pha thấy được ở client người úp bài.
    const phases = []; let shotDuringShooting = null;
    poll = setInterval(() => {
      const state = accuser.view.room.state.bluff;
      if (phases.at(-1) !== state.phase) phases.push(state.phase);
      if (state.phase === 'shooting' && shotDuringShooting === null) shotDuringShooting = state.shotResult;
    }, 20);

    const card = player.hand[0];
    player.view.room.send('bluff-play', { cardIds: [card.id] });
    await waitFor(() => accuser.view.room.state.bluff.lastPlayCount === 1, 'thấy lần úp bài');
    assert.equal(accuser.view.room.state.bluff.lastPlaySeat, turnSeat);
    assert.equal(accuser.view.room.state.bluff.revealed.length, 0, 'Chưa lật bài');
    accuser.view.room.send('bluff-liar');
    await waitFor(() => phases.includes('reveal'), 'phase reveal');
    await waitFor(() => phases.includes('shooting'), 'phase shooting', 6000);
    await waitFor(() => phases.includes('result'), 'phase result', 6000);
    assert.equal(shotDuringShooting, '', 'shotResult phải rỗng khi đang shooting');
    assert.ok(phases.indexOf('reveal') < phases.indexOf('shooting'));
    assert.ok(phases.indexOf('shooting') < phases.indexOf('result'), 'result sau shooting: ' + phases.join('>'));
  } finally { clearInterval(poll); await Promise.allSettled([...rooms].map(room => room.leave())); }
});

test('kohaku bluff: cà khịa broadcast cho cả phòng, kể cả lúc đang tới lượt mình; spam trong 3s bị chặn', { timeout: 90000 }, async () => {
  const rooms = new Set();
  try {
    const a = await guest(rooms), b = await guest(rooms), c = await guest(rooms);
    const kA = await enterKohaku(a, rooms), kB = await enterKohaku(b, rooms), kC = await enterKohaku(c, rooms);
    const fx = new Map([[kA, []], [kB, []], [kC, []]]);
    for (const [view, list] of fx) view.room.onMessage('bluff-taunt-fx', value => list.push(value));
    await sit(kA, 'kohaku-player-1'); await sit(kB, 'kohaku-player-2');
    // Chưa vào ván thì không cà khịa được.
    kA.room.send('bluff-taunt', { kind: 'flip', targetSeat: 'kohaku-player-2' });
    kA.room.send('bluff-ready', true); kB.room.send('bluff-ready', true);
    await waitFor(() => kA.room.state.bluff.phase === 'turn', 'phase turn');
    await delay(300);
    assert.equal(fx.get(kC).length, 0, 'lobby không được cà khịa');

    const turnSeat = kA.room.state.bluff.turnSeat;
    const [mine, other] = turnSeat === 'kohaku-player-1' ? [kA, kB] : [kB, kA];
    const otherSeat = turnSeat === 'kohaku-player-1' ? 'kohaku-player-2' : 'kohaku-player-1';
    mine.room.send('bluff-taunt', { kind: 'flip', targetSeat: otherSeat }); // đang tới lượt mình vẫn được
    await waitFor(() => [...fx.values()].every(list => list.length === 1), 'cả 3 client nhận tauntFx');
    assert.deepEqual({ ...fx.get(kC)[0] }, { seatId: turnSeat, kind: 'flip', targetSeat: otherSeat });
    assert.equal(kC.room.state.bluff.phase, 'turn', 'cà khịa không đổi pha');

    mine.room.send('bluff-taunt', { kind: 'laugh', targetSeat: otherSeat }); // trong cooldown
    other.room.send('bluff-taunt', { kind: 'point', targetSeat: turnSeat });
    await waitFor(() => fx.get(kC).length === 2, 'người kia vẫn cà khịa được');
    await delay(500);
    assert.deepEqual(fx.get(kC).map(item => item.kind), ['flip', 'point'], 'cà khịa trong 3s bị chặn');
  } finally { await Promise.allSettled([...rooms].map(room => room.leave())); }
});
