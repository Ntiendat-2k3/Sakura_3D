import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_CLUB_TRACK, DEFAULT_DJ_VISIT, DJ_HOLD_MS, DJ_WAIT_MS, createDjRoute, getDjTravelDuration, sampleDjTravel, type DjVisit } from '@metaverse/game-protocol';
import { createClubDj } from '../src/systems/clubDj';

function setup() {
  const visit: DjVisit = { ...DEFAULT_DJ_VISIT }, a = { x: 0, z: -2, seatId: '', dancing: true }, b = { ...a };
  const players = new Map([['a', a], ['b', b]]), played: string[] = [];
  const controller = createClubDj(visit, players, track => played.push(track.id));
  const arrive = () => { controller.hold('a', true, 100); controller.tick(100 + DJ_HOLD_MS); const end = visit.startedAt + getDjTravelDuration(createDjRoute(visit.targetX, visit.targetZ).length) * 1000; controller.tick(end + 1); return end + 1; };
  return { visit, a, b, players, played, controller, arrive };
}

test('giữ O đủ thời gian, độc quyền một lượt, chỉ đúng khách được chọn ID sau khi DJ đến', () => {
  const { controller: dj, visit, played } = setup();
  dj.hold('a', true, 100); assert.equal(visit.phase, 'holding');
  dj.hold('b', true, 200); dj.cancel('b', 200); assert.equal(visit.requesterId, 'a');
  dj.hold('a', false, 300); assert.equal(visit.phase, 'idle');
  dj.hold('a', true, 1000); dj.tick(1000 + DJ_HOLD_MS - 1); assert.equal(visit.phase, 'holding');
  dj.tick(1000 + DJ_HOLD_MS); assert.equal(visit.phase, 'approaching');
  dj.hold('a', false, 2300); assert.equal(visit.phase, 'approaching');
  assert.equal(dj.select('a', DEFAULT_CLUB_TRACK.id, 2500), false);
  const ready = visit.startedAt + getDjTravelDuration(createDjRoute(visit.targetX, visit.targetZ).length) * 1000 + 1;
  dj.tick(ready); assert.equal(visit.phase, 'ready');
  assert.equal(dj.select('b', DEFAULT_CLUB_TRACK.id, ready), false);
  for (const value of ['__proto__', '/evil.mp3', null, {}, 1]) assert.equal(dj.select('a', value, ready), false);
  assert.equal(dj.select('a', DEFAULT_CLUB_TRACK.id, ready), true); assert.deepEqual(played, [DEFAULT_CLUB_TRACK.id]); assert.equal(visit.phase, 'returning');
  dj.tick(ready + getDjTravelDuration(visit.returnDistance) * 1000 + 1); assert.equal(visit.phase, 'idle');
});

test('từ chối người xa/ngồi; đi xa, ngắt kết nối hoặc hết thời gian phải trả DJ về', () => {
  const s = setup(); s.a.z = 5; s.controller.hold('a', true, 0); assert.equal(s.visit.phase, 'idle');
  s.a.z = -2; s.a.seatId = 'sofa-1'; s.controller.hold('a', true, 0); assert.equal(s.visit.phase, 'idle'); s.a.seatId = '';
  s.controller.hold('a', true, 100); s.a.x = 1; s.controller.tick(200); assert.equal(s.visit.phase, 'idle');
  s.a.x = 0; const now = s.arrive(); s.controller.tick(now + DJ_WAIT_MS); assert.equal(s.visit.phase, 'returning');
  const left = setup(); left.arrive(); left.players.delete('a'); left.controller.tick(50000); assert.equal(left.visit.phase, 'returning');
});

test('hủy giữa đường quay về từ đúng vị trí; hành trình ngắn vẫn liên tục và không vượt quãng đường', () => {
  const { controller: dj, visit } = setup(); dj.hold('a', true, 100); dj.tick(1300);
  dj.cancel('a', 1400); assert.equal(visit.phase, 'returning');
  assert.ok(visit.returnDistance > 0 && visit.returnDistance < .01);
  for (const distance of [.001, .1, 1, 12]) {
    let previous = 0;
    const duration = getDjTravelDuration(distance);
    for (let i = 0; i <= 100; i++) { const sample = sampleDjTravel(duration * i / 100, distance); assert.ok(sample.distance >= previous - 1e-8 && sample.distance <= distance + 1e-8); previous = sample.distance; }
    assert.ok(Math.abs(previous - distance) < 1e-8); assert.equal(sampleDjTravel(duration, distance).speed, 0);
  }
});
