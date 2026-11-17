import assert from 'node:assert/strict';
import test from 'node:test';
import { STREET_SEATS, STREET_SOCIAL_MESSAGES, STREET_SOCIAL_TIMING, isWalkable } from '@metaverse/game-protocol';
import { createStreetSocial } from '../src/systems/streetSocial';

const body = (x: number, z: number, seatId = '') => ({ x, z, yaw: 0, seatId, dancing: true, danceStyle: 'hiphop' });

function setup(players: Record<string, ReturnType<typeof body>>) {
  const sent: { type: string; payload: unknown }[] = [];
  const timers: (() => void)[] = [];
  const social = createStreetSocial({
    players: () => Object.entries(players),
    broadcast: (type, payload) => sent.push({ type, payload }),
    schedule: (_ms, run) => timers.push(run),
    walkable: isWalkable,
  });
  return { social, sent, flush: () => timers.splice(0).forEach(run => run()) };
}

test('hôn: chỉ khi ngồi cùng ghế đá với người khác, có giới hạn tần suất', () => {
  const [a, b, other] = [STREET_SEATS[0], STREET_SEATS[1], STREET_SEATS[2]];
  const players = { p1: body(a.x, a.z, a.id), p2: body(b.x, b.z, b.id), p3: body(other.x, other.z, other.id), p4: body(0, 0) };
  const { social, sent } = setup(players);
  assert.match(social.kiss('p4', 0) ?? '', /ngồi lên ghế đá/);
  assert.match(social.kiss('p3', 0) ?? '', /Chưa có ai ngồi cạnh/, 'ghế khác thì không tính là ngồi cạnh');
  assert.equal(social.kiss('p1', 1000), null);
  assert.deepEqual(sent, [{ type: STREET_SOCIAL_MESSAGES.kissFx, payload: { a: 'p1', b: 'p2' } }]);
  assert.equal(social.kiss('p2', 1500), null, 'đang hôn thì bỏ qua lặng lẽ');
  assert.equal(sent.length, 1);
  assert.equal(social.kiss('p2', 1000 + STREET_SOCIAL_TIMING.kissMs + 1), null);
  assert.equal(sent.length, 2, 'người kia được hôn lại sau khi xong');
});

test('đấm: server chọn người gần nhất, quay mặt đối thủ, trúng thì đẩy lùi và ngắt điệu nhảy', () => {
  const players = { a: body(0, 0), b: body(0, 1.0), c: body(0, -3) };
  const { social, sent, flush } = setup(players);
  assert.equal(social.punch('a', 0), null);
  assert.deepEqual(sent[0], { type: STREET_SOCIAL_MESSAGES.punchFx, payload: { attacker: 'a', target: 'b' } });
  assert.ok(Math.abs(players.a.yaw - 0) < 1e-9, 'quay mặt về phía b (+z)');
  assert.equal(players.b.z, 1.0, 'chưa trúng thì chưa bị đẩy');
  flush();
  assert.ok(Math.abs(players.b.z - (1 + STREET_SOCIAL_TIMING.knockback)) < 1e-9);
  assert.equal(players.b.dancing, false);
  assert.ok(Math.abs(Math.abs(players.b.yaw) - Math.PI) < 1e-9, 'người trúng quay lại nhìn người đấm');
  assert.equal(social.punch('a', 100), null);
  assert.equal(sent.length, 1, 'giới hạn tần suất');
  assert.match(social.punch('c', 5000) ?? '', /Không có ai/);
});

test('đấm: không đấm được người đang ngồi, người ngồi xuống giữa chừng không bị đẩy', () => {
  const seat = STREET_SEATS[0];
  const players = { a: body(seat.standX, seat.standZ), b: body(seat.x, seat.z, seat.id) };
  const { social } = setup(players);
  assert.match(social.punch('a', 0) ?? '', /Không có ai/);
  const late = { a: body(0, 0), b: body(0, 1) };
  const run = setup(late);
  run.social.punch('a', 0);
  late.b.seatId = 'street-bench-1-a';
  run.flush();
  assert.equal(late.b.z, 1);
});
