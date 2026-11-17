// Chạy World Server thật trên cổng tạm với JWT test; không mở browser hoặc phụ thuộc API/database.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createHmac, randomBytes, randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { createServer } = require('node:net');
const path = require('node:path');
const { test } = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');
const { Client } = require('colyseus.js');
const { CLUB_ROOM_NAME, WORLD_ROOM_NAME, CLUB_SEATS, MOVE_SPEED, PLAYER_CHARACTERS, DEFAULT_CLUB_TRACK } = require('@metaverse/game-protocol');

async function waitFor(predicate, title, timeout = 6000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (predicate()) return; await delay(40); }
  throw new Error(title);
}

async function moveTo(room, x, z) {
  const deadline = Date.now() + 6500;
  while (Date.now() < deadline) {
    const player = room.state.players.get(room.sessionId);
    const dx = x - player.x, dz = z - player.z, distance = Math.hypot(dx, dz);
    if (distance < .25) {
      room.send('move', { x: 0, z: 0 }); await delay(250);
      const settled = room.state.players.get(room.sessionId);
      if (Math.hypot(x - settled.x, z - settled.z) < .25) return;
      continue;
    }
    // Giảm ga gần đích để patch 10 Hz không khiến fixture chạy qua lại quanh điểm cần đến.
    const throttle = Math.min(1, distance / .8);
    room.send('move', { x: dx / distance * throttle, z: dz / distance * throttle }); await delay(65);
  }
  throw new Error('Không đến được điểm test');
}

function token(secret, name) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const data = encode({ alg: 'HS256', typ: 'JWT' }) + '.' + encode({ sub: randomUUID(), name, iss: 'neon-sakura-api', aud: 'neon-sakura-world', exp: Math.floor(Date.now() / 1000) + 120 });
  return data + '.' + createHmac('sha256', secret).update(data).digest('base64url');
}

test('nhảy và DJ: xác thực thật, hai client đồng bộ, di chuyển/ngồi/chọn nhạc/chuyển phòng', { timeout: 80000 }, async () => {
  const reservation = createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  const secret = randomBytes(48).toString('hex');
  const server = spawn(process.execPath, ['dist/main.js'], {
    cwd: path.resolve(__dirname, '../../world-server'),
    env: { ...process.env, WORLD_PORT: String(port), DEMO_JWT_SECRET: secret }, windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '', processError;
  server.stdout.on('data', chunk => { output = (output + chunk).slice(-6000); });
  server.stderr.on('data', chunk => { output = (output + chunk).slice(-6000); });
  server.on('error', error => { processError = error; });
  const rooms = new Set();
  try {
    await waitFor(() => {
      if (processError) throw processError;
      if (server.exitCode !== null) throw new Error(output);
      return output.includes(`World server http://localhost:${port}`);
    }, 'World Server không khởi động: ' + output, 10000);
    const a = new Client(`ws://127.0.0.1:${port}`), b = new Client(`ws://127.0.0.1:${port}`);
    const tokenA = token(secret, 'Player-A'), tokenB = token(secret, 'Player-B');
    a.auth.token = tokenA; b.auth.token = tokenB;
    await assert.rejects(new Client(`ws://127.0.0.1:${port}`).joinOrCreate(WORLD_ROOM_NAME));
    await assert.rejects(a.joinOrCreate(WORLD_ROOM_NAME, { token: tokenA, characterId: '__proto__' }), 'Phải từ chối mẫu ngoài catalog');
    const streetA = await a.joinOrCreate(WORLD_ROOM_NAME, { token: tokenA, characterId: 'ryo' }); rooms.add(streetA);
    const streetB = await b.joinOrCreate(WORLD_ROOM_NAME, { token: tokenB, characterId: 'ubel' }); rooms.add(streetB);
    await waitFor(() => streetB.state?.players?.has(streetA.sessionId) && streetA.state?.players?.has(streetB.sessionId), 'Hai client chưa nhận đủ nhân vật ở phố');
    assert.equal(streetB.state.players.get(streetA.sessionId).characterId, 'ryo');
    assert.equal(streetA.state.players.get(streetB.sessionId).characterId, 'ubel');
    const idleTime = streetA.state.simulationTime;
    const idleX = streetA.state.players.get(streetA.sessionId).x;
    let idlePatches = 0;
    const countIdlePatch = () => { idlePatches++; };
    streetA.onStateChange(countIdlePatch);
    await delay(450);
    streetA.onStateChange.remove(countIdlePatch);
    assert.ok(idlePatches >= 2, 'Phòng đứng yên vẫn phải gửi patch để nội suy lúc đi lại');
    assert.ok(streetA.state.simulationTime > idleTime + 200, 'Patch phải có mốc mô phỏng tăng đều');
    assert.equal(streetA.state.players.get(streetA.sessionId).x, idleX);
    const movementSamples = [];
    const recordMovement = state => movementSamples.push({ time: state.simulationTime, x: state.players.get(streetA.sessionId).x });
    streetA.onStateChange(recordMovement);
    const movementTimer = setInterval(() => streetA.send('move', { x: 1, z: 0 }), 50);
    try { await delay(650); }
    finally { clearInterval(movementTimer); streetA.send('move', { x: 0, z: 0 }); }
    streetA.onStateChange.remove(recordMovement);
    assert.ok(movementSamples.length >= 4, 'Phải nhận được chuỗi patch khi giữ di chuyển');
    for (let i = 2; i < movementSamples.length; i++) {
      const from = movementSamples[i - 1], to = movementSamples[i];
      const speed = (to.x - from.x) / ((to.time - from.time) / 1000);
      assert.ok(Math.abs(speed - MOVE_SPEED) < .01, `Vị trí và mốc server không khớp: ${speed} m/s`);
    }
    for (const characterId of Object.keys(PLAYER_CHARACTERS)) {
      const picker = new Client(`ws://127.0.0.1:${port}`), pickerToken = token(secret, `Choice-${characterId}`);
      picker.auth.token = pickerToken;
      const picked = await picker.joinOrCreate(WORLD_ROOM_NAME, { token: pickerToken, characterId }); rooms.add(picked);
      await waitFor(() => streetA.state.players.get(picked.sessionId)?.characterId === characterId, `Không đồng bộ mẫu ${characterId}`);
      await picked.leave(); rooms.delete(picked);
    }
    streetA.send('dance', { dancing: true }); await delay(250);
    assert.equal(streetB.state.players.get(streetA.sessionId).dancing, false, 'Không được nhảy ngoài club');
    await moveTo(streetA, 4.2, 1);
    const clubA = await a.joinOrCreate(CLUB_ROOM_NAME, { token: tokenA, fromRoomId: streetA.roomId, characterId: 'ryo' }); rooms.add(clubA);
    await waitFor(() => clubA.state?.players?.has(clubA.sessionId), 'Chưa có state A');
    await streetA.leave(); rooms.delete(streetA);
    for (const payload of [null, {}, { dancing: 'true' }, { dancing: 1 }, { dancing: true, style: 'invalid' }, { dancing: true, style: 2 }]) clubA.send('dance', payload);
    await delay(250);
    assert.equal(clubA.state.players.get(clubA.sessionId).dancing, false, 'Phải kiểm tra kiểu dữ liệu');
    clubA.send('dance', { dancing: true, style: 'guitar' });
    await waitFor(() => clubA.state.players.get(clubA.sessionId).dancing, 'A không nhảy');
    const initial = clubA.state.players.get(clubA.sessionId);
    const position = { x: initial.x, z: initial.z };
    clubA.send('move', { x: 0, z: 0 }); await delay(350);
    assert.equal(initial.dancing, true, 'Input nghỉ không được hủy nhảy');
    assert.deepEqual({ x: initial.x, z: initial.z }, position);
    await moveTo(streetB, 4.2, 1);
    const clubB = await b.joinOrCreate(CLUB_ROOM_NAME, { token: tokenB, fromRoomId: streetB.roomId, characterId: 'ubel' }); rooms.add(clubB);
    await waitFor(() => clubB.state?.players?.get(clubA.sessionId)?.dancing, 'Client vào muộn phải thấy A đang nhảy');
    assert.equal(clubB.state.players.get(clubA.sessionId).danceStyle, 'guitar', 'Vào muộn phải thấy đúng kiểu cầm đàn');
    assert.equal(clubB.state.players.get(clubA.sessionId).characterId, 'ryo');
    clubB.send('dance', { dancing: true, style: 'guitar' }); await delay(250);
    assert.equal(clubB.state.players.get(clubB.sessionId).dancing, false, 'Mẫu không có đàn không được dùng kiểu đàn');
    clubB.send('dance', { dancing: true, style: 'flair' });
    await waitFor(() => clubA.state.players.get(clubB.sessionId)?.danceStyle === 'flair', 'Mẫu không có đàn vẫn phải nhảy Flair và đồng bộ sang A');
    clubB.send('dance', { dancing: false, style: 'flair' });
    await waitFor(() => !clubA.state.players.get(clubB.sessionId)?.dancing, 'Không dừng được Flair');
    clubB.send('dance', { dancing: true, style: 'hiphop' });
    await waitFor(() => clubA.state.players.get(clubB.sessionId)?.danceStyle === 'hiphop' && clubA.state.players.get(clubB.sessionId)?.dancing, 'Hip Hop phải đồng bộ sang A cho cả mẫu không có đàn');
    clubB.send('dance', { dancing: false, style: 'hiphop' });
    await waitFor(() => !clubA.state.players.get(clubB.sessionId)?.dancing, 'Không dừng được Hip Hop');
    assert.equal(clubA.state.players.get(clubB.sessionId).danceStyle, 'normal');
    for (const style of ['maraschino', 'swing', 'snakehiphop']) {
      clubB.send('dance', { dancing: true, style });
      await waitFor(() => clubA.state.players.get(clubB.sessionId)?.danceStyle === style && clubA.state.players.get(clubB.sessionId)?.dancing, `Không đồng bộ điệu ${style} sang A`);
      clubB.send('dance', { dancing: false, style });
      await waitFor(() => !clubA.state.players.get(clubB.sessionId)?.dancing, `Không dừng được ${style}`);
      assert.equal(clubA.state.players.get(clubB.sessionId).danceStyle, 'normal');
    }
    await streetB.leave(); rooms.delete(streetB);
    clubA.send('dance', { dancing: true, style: 'normal' });
    await waitFor(() => clubB.state.players.get(clubA.sessionId).danceStyle === 'normal', 'B thấy A chuyển từ đàn sang nhảy thường');
    assert.equal(clubB.state.players.get(clubA.sessionId).dancing, true);
    clubA.send('dance', { dancing: false });
    await waitFor(() => !clubB.state.players.get(clubA.sessionId).dancing, 'B không thấy A dừng nhảy');
    clubA.send('dance', { dancing: true });
    await waitFor(() => clubB.state.players.get(clubA.sessionId).dancing, 'B không thấy A nhảy lại');
    clubA.send('move', { x: 1, z: 0 });
    await waitFor(() => !clubB.state.players.get(clubA.sessionId).dancing, 'Di chuyển phải hủy nhảy');
    assert.equal(clubB.state.players.get(clubA.sessionId).danceStyle, 'normal');
    const seat = CLUB_SEATS[1];
    await moveTo(clubA, seat.standX, seat.standZ);
    clubA.send('dance', { dancing: true, style: 'guitar' });
    await waitFor(() => clubB.state.players.get(clubA.sessionId).dancing, 'A nhảy trước ghế');
    clubA.send('seat', { seatId: seat.id });
    await waitFor(() => clubB.state.players.get(clubA.sessionId).seatId === seat.id, 'Không đồng bộ ngồi');
    assert.equal(clubB.state.players.get(clubA.sessionId).dancing, false, 'Ngồi phải hủy nhảy');
    assert.equal(clubB.state.players.get(clubA.sessionId).danceStyle, 'normal', 'Ngồi phải cất đàn');
    clubA.send('dance', { dancing: true }); await delay(250);
    assert.equal(clubB.state.players.get(clubA.sessionId).dancing, false, 'Không nhảy khi đang ngồi');
    clubA.send('seat', { seatId: '' });
    await waitFor(() => !clubB.state.players.get(clubA.sessionId).seatId, 'Không đứng dậy');
    clubA.send('dj-hold', true); await delay(200);
    assert.equal(clubA.state.dj.phase, 'idle', 'Không gọi DJ từ xa');
    await moveTo(clubA, 0, -2);
    clubA.send('dj-hold', true);
    await waitFor(() => clubB.state.dj.phase === 'holding', 'B không thấy A giữ O');
    clubA.send('dj-hold', false);
    await waitFor(() => clubB.state.dj.phase === 'idle', 'Nhả sớm phải hủy gọi');
    clubA.send('dj-hold', true);
    await waitFor(() => clubB.state.dj.phase === 'approaching', 'DJ không đi ra sau khi giữ đủ O');
    assert.equal(clubB.state.dj.requesterId, clubA.sessionId);
    const oldEpoch = clubA.state.danceEpoch;
    clubB.onMessage('interaction-error', () => {});
    clubA.onMessage('interaction-error', () => {});
    clubB.send('dj-track', DEFAULT_CLUB_TRACK.id); clubB.send('dj-cancel');
    clubA.send('dj-track', '/arbitrary.mp3'); await delay(200);
    assert.equal(clubB.state.dj.phase, 'approaching'); assert.equal(clubB.state.danceEpoch, oldEpoch);
    await waitFor(() => clubB.state.dj.phase === 'ready', 'Chưa mở danh sách khi DJ đến', 18000);
    clubB.send('dj-track', DEFAULT_CLUB_TRACK.id); await delay(180);
    assert.equal(clubB.state.dj.phase, 'ready', 'Khách khác không được chọn thay');
    clubA.send('dj-track', DEFAULT_CLUB_TRACK.id);
    await waitFor(() => clubB.state.dj.phase === 'returning', 'DJ chưa quay lại bàn sau khi nhận order');
    assert.equal(clubB.state.danceEpoch, oldEpoch, 'Bài cũ phải tiếp tục trong lúc DJ quay lại bàn');
    await waitFor(() => clubB.state.dj.phase === 'idle' && clubB.state.danceEpoch > oldEpoch, 'Bài chưa phát khi DJ về bàn', 18000);
    assert.equal(clubB.state.activeTrackId, DEFAULT_CLUB_TRACK.id);
    assert.equal(clubB.state.showBpm, DEFAULT_CLUB_TRACK.bpm);
    await moveTo(clubA, 0, 6.4);
    clubA.send('dance', { dancing: true });
    await waitFor(() => clubB.state.players.get(clubA.sessionId).dancing, 'A nhảy gần cửa');
    const back = await a.joinOrCreate(WORLD_ROOM_NAME, { token: tokenA, fromRoomId: clubA.roomId, characterId: 'ryo' }); rooms.add(back);
    await waitFor(() => back.state?.players?.has(back.sessionId), 'Không về được phố');
    assert.equal(back.state.players.get(back.sessionId).dancing, false, 'Chuyển phòng phải reset nhảy');
    assert.equal(back.state.players.get(back.sessionId).danceStyle, 'normal');
    assert.equal(back.state.players.get(back.sessionId).characterId, 'ryo', 'Giữ lựa chọn khi đổi phòng');
    await clubA.leave(); rooms.delete(clubA);
    await waitFor(() => !clubB.state.players.has(clubA.sessionId), 'Không xóa avatar sau chuyển phòng');
    await waitFor(() => clubB.state.dj.phase === 'idle', 'DJ chưa về bàn sau khi khách rời phòng', 18000);
  } finally {
    await Promise.allSettled([...rooms].map(room => room.leave()));
    if (server.exitCode === null) { const exited = once(server, 'exit'); server.kill(); await exited; }
  }
});
