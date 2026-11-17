import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GEKKA_BASEMENT_Y, MOVE_SPEED, planGekkaEscort, resolveGekkaStep, sampleGekkaEscort } from '@metaverse/game-protocol';
import { followPilotStep, followRoute, followSlot } from '../game/systems/gekkaFollow';
import { createExecutionerDirector } from '../game/systems/gekkaExecutioner';

/** Bản sao luật di chuyển Gekkarō của server (applyMovement): đi chéo bị chặn thì trượt theo trục. */
function step(p: { x: number; y: number; z: number }, input: { x: number; z: number }, dt: number) {
  const dx = input.x * MOVE_SPEED * dt, dz = input.z * MOVE_SPEED * dt;
  const diag = resolveGekkaStep(p.x, p.y, p.z, p.x + dx, p.z + dz);
  if (diag.allowed) return { x: p.x + dx, y: diag.y, z: p.z + dz };
  const next = { ...p };
  const sx = resolveGekkaStep(next.x, next.y, next.z, next.x + dx, next.z);
  if (sx.allowed) { next.x += dx; next.y = sx.y; }
  const sz = resolveGekkaStep(next.x, next.y, next.z, next.x, next.z + dz);
  if (sz.allowed) { next.z += dz; next.y = sz.y; }
  return next;
}

test('người xem bấm Đi theo từ nhiều chỗ trong salon đều xuống tới chỗ xem trong hầm, luôn đi sau đoàn', () => {
  for (const routeSeats of [['gekka-player-2'], ['gekka-player-6', 'gekka-player-3'], ['gekka-player-1', 'gekka-player-5']]) {
  const plan = planGekkaEscort(routeSeats);
  for (const [index, start] of [[-3.5, 2.5], [2.0, 5.0], [-4.5, -4.5], [4.4, -5.5], [-1.2, 4.6]].entries()) {
    const slot = index % 6;
    const route = followRoute(plan, slot);
    let p = { x: start[0], y: 0, z: start[1] }, arrived = false, t = 0;
    const dt = 0.05;
    for (; t < plan.duration + 20 && !arrived; t += dt) {
      const escortSeconds = t < plan.duration ? t : null;
      const result = followPilotStep({ plan, route, escortSeconds, slot, position: p });
      arrived = result.arrived;
      p = step(p, result.move, dt);
      // Chỉ xét lúc người xem tự đi: đứng chờ mà đoàn đi ngang qua sát bên là chuyện bình thường.
      if (escortSeconds !== null && (result.move.x !== 0 || result.move.z !== 0)) {
        const frame = sampleGekkaEscort(plan, escortSeconds);
        for (const prisoner of frame.prisoners.values()) {
          if (!prisoner || Math.abs(prisoner.y - p.y) >= 0.5) continue;
          assert.ok(Math.hypot(prisoner.x - p.x, prisoner.z - p.z) > 0.6, `${routeSeats} slot ${slot}: chen vào người bị lôi lúc ${t.toFixed(1)} s`);
        }
      }
    }
    assert.ok(arrived, `${routeSeats}: xuất phát (${start}) chưa tới chỗ xem, đang ở (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`);
    assert.equal(p.y, GEKKA_BASEMENT_Y);
    assert.ok(Math.hypot(p.x - route.spot.x, p.z - route.spot.z) < 0.3);
  }
  }
});

test('slot người xem cố định theo sessionId', () => {
  assert.equal(followSlot('abc'), followSlot('abc'));
  assert.ok(followSlot('xyz') >= 0 && followSlot('xyz') < 6);
});

test('đao phủ: canh ở salon → lôi người → đứng khung → đi bộ về chỗ canh', () => {
  const director = createExecutionerDirector();
  const idle = { phase: 'idle' as const, seatId: '', punchesTotal: 0, punchesDone: 0, deadline: 0, canBorrow: false };
  assert.equal(director.update(0, { dungeon: idle, escort: { route: [], startedAt: 0 } }).mode, 'guard');
  const escort = { route: ['gekka-player-4'], startedAt: 1000 };
  const plan = planGekkaEscort(escort.route);
  const grab = director.update(1000 + (plan.stops[0].releasedAt - 0.2) * 1000, { dungeon: idle, escort });
  assert.equal(grab.mode, 'escort');
  assert.ok(grab.reach && grab.reach.weight > 0.9, 'đang vươn tay túm');
  const drag = director.update(1000 + (plan.stops[0].releasedAt + 4) * 1000, { dungeon: idle, escort });
  assert.ok(drag.walking && drag.reach, 'vừa đi vừa túm người phía sau');
  const rack = director.update(60000, { dungeon: { ...idle, phase: 'punching' }, escort: { route: [], startedAt: 0 } });
  assert.equal(rack.mode, 'rack');
  const back = director.update(70000, { dungeon: idle, escort: { route: [], startedAt: 0 } });
  assert.equal(back.mode, 'return');
  assert.equal(director.update(70000 + 60000, { dungeon: idle, escort: { route: [], startedAt: 0 } }).mode, 'guard');
});
