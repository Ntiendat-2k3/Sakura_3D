import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Group, Quaternion, Vector3 } from 'three';
import { isClubWalkable } from '@metaverse/game-protocol';
import { createTwoBoneIK, sampleHostFoot, sampleHostPath, sampleHostPatrol, type PatrolSample } from '../game/systems/hostLocomotion';

const sample = (): PatrolSample => ({ x: 0, z: 0, yaw: 0, distance: 0, speed: 0 });
test('lễ tân đi trên sàn trống, giữ đệm với sân khấu/bar/sofa và liên tục ở góc bo', () => {
  const a = sample(), b = sample();
  for (let d = 0; d <= 60; d += .02) {
    sampleHostPath(d, a); sampleHostPath(d + .0001, b);
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < .00011);
    for (const dx of [-.65, 0, .65]) for (const dz of [-.65, 0, .65]) assert.ok(isClubWalkable(a.x + dx, a.z + dz));
  }
});
test('tăng/giảm tốc và dừng khi cả hai chân ở pha chống', () => {
  const a = sample(), scratch = sample(), foot = { position: new Vector3(), yaw: 0, planted: false };
  let previous = 0, stopped = 0;
  for (let t = 0; t < 70; t += .02) {
    sampleHostPatrol(t, a); assert.ok(a.distance >= previous - 1e-8); previous = a.distance;
    assert.ok(a.speed >= 0 && a.speed <= .550001);
    if (t > 1 && a.speed === 0) {
      stopped++;
      for (const offset of [0, .5]) { sampleHostFoot(a.distance, offset, .08, .1, foot, scratch); assert.ok(foot.planted || Math.abs(foot.position.y - .1) < 1e-8); }
    }
  }
  assert.ok(stopped > 0);
});
test('bàn chân chống neo world; bàn chân vung có độ nâng', () => {
  const a = { position: new Vector3(), yaw: 0, planted: false }, b = { position: new Vector3(), yaw: 0, planted: false }, scratch = sample();
  sampleHostFoot(.05, 0, .08, .1, a, scratch); sampleHostFoot(.2, 0, .08, .1, b, scratch);
  assert.ok(a.planted && b.planted); assert.ok(a.position.distanceTo(b.position) < 1e-8);
  sampleHostFoot(.64 * .8, 0, .08, .1, b, scratch); assert.ok(!b.planted); assert.ok(b.position.y > .16);
});
test('IK chạm mục tiêu, giữ chiều dài xương và hướng bàn chân', () => {
  const root = new Group(), upper = new Group(), lower = new Group(), foot = new Group();
  upper.position.y = 1; lower.position.y = -.45; foot.position.y = -.45;
  root.add(upper); upper.add(lower); lower.add(foot); root.updateMatrixWorld(true);
  const solve = createTwoBoneIK(upper, lower, foot), target = new Vector3(.03, .15, .18);
  solve(target, new Vector3(0, 0, 1), new Quaternion());
  assert.ok(foot.getWorldPosition(new Vector3()).distanceTo(target) < 1e-6);
  assert.ok(Math.abs(upper.getWorldPosition(new Vector3()).distanceTo(lower.getWorldPosition(new Vector3())) - .45) < 1e-8);
  assert.ok(foot.getWorldQuaternion(new Quaternion()).angleTo(new Quaternion()) < 1e-6);
});
