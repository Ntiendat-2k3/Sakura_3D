import assert from 'node:assert/strict';
import test from 'node:test';
import { KOHAKU_JUMP_SPOTS, KOHAKU_JUMP_TIMING, findKohakuJumpSpot, getKohakuJumpSpot, isKohakuWalkable, kohakuJumpAirSeconds, kohakuJumpDuration, sampleKohakuJump } from '../src';

test('mọi điểm nhảy đứng được trên ban công và tiếp đất trên sàn tầng 1 đi được', () => {
  for (const spot of KOHAKU_JUMP_SPOTS) {
    assert.equal(isKohakuWalkable(spot.from.x, spot.from.z, spot.from.y), true, `${spot.id}: điểm đứng`);
    assert.equal(isKohakuWalkable(spot.to.x, spot.to.z, 0), true, `${spot.id}: điểm tiếp đất`);
    assert.equal(findKohakuJumpSpot(spot.from.x, spot.from.y, spot.from.z)?.id, spot.id);
    assert.equal(getKohakuJumpSpot(spot.id), spot);
  }
});

test('không nhảy được khi ở sai tầng hoặc quá xa lan can', () => {
  const spot = KOHAKU_JUMP_SPOTS[0];
  assert.equal(findKohakuJumpSpot(spot.from.x, 0, spot.from.z), undefined, 'đứng tầng 1 ngay bên dưới');
  assert.equal(findKohakuJumpSpot(spot.from.x, spot.from.y, spot.from.z - 1.5), undefined);
  assert.equal(findKohakuJumpSpot(NaN, 3.6, -4.8), undefined);
  assert.equal(getKohakuJumpSpot(''), undefined);
});

test('quỹ đạo: đứng yên lúc lấy đà, chân vượt lan can 0.95 m, tiếp đất đúng điểm', () => {
  for (const spot of KOHAKU_JUMP_SPOTS) {
    const air = kohakuJumpAirSeconds(spot), prep = KOHAKU_JUMP_TIMING.prepSeconds;
    assert.deepEqual(sampleKohakuJump(spot, 0.1), { ...spot.from, yaw: sampleKohakuJump(spot, 0).yaw, phase: 'prep' });
    // Lan can nằm cách điểm đứng 0.35 m theo hướng nhảy; quét dày quỹ đạo tìm lúc đi ngang qua nó.
    const total = Math.hypot(spot.to.x - spot.from.x, spot.to.z - spot.from.z);
    for (let t = prep; t < prep + air; t += 0.005) {
      const p = sampleKohakuJump(spot, t);
      const travelled = Math.hypot(p.x - spot.from.x, p.z - spot.from.z);
      if (travelled >= 0.35 && travelled <= 0.45) assert.ok(p.y >= spot.from.y + 0.95, `${spot.id}: chân ${p.y.toFixed(2)} m chạm lan can`);
      assert.ok(travelled <= total + 1e-9);
    }
    const land = sampleKohakuJump(spot, prep + air + 0.01);
    assert.equal(land.phase, 'land');
    assert.deepEqual([land.x, land.y, land.z], [spot.to.x, 0, spot.to.z]);
    assert.equal(sampleKohakuJump(spot, kohakuJumpDuration(spot) + 0.01).phase, 'done');
  }
});

test('nhảy nhanh hơn hẳn đi cầu thang: tầng 2 dưới 2.6 s, tầng 3 dưới 3 s', () => {
  assert.ok(kohakuJumpDuration(KOHAKU_JUMP_SPOTS[0]) < 2.6);
  assert.ok(kohakuJumpDuration(KOHAKU_JUMP_SPOTS[2]) < 3);
});
