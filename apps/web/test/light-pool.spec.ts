import assert from 'node:assert/strict';
import { test } from 'node:test';
import presets from '../game/scenes/kohaku-lights.json';
import { KOHAKU_LIGHT_POOL_SIZE, LIGHT_SWAP_MARGIN, assignSlots, pickNearestLights, selectLights, weightedDistance, type LightPreset } from '../game/systems/lightPool';

const lights = presets as LightPreset[];
const at = (x: number, y: number, z: number) => ({ x, y, z });
const indexOf = (position: number[]) => lights.findIndex(l => l.position.every((v, i) => v === position[i]));

test('tầng 1: chọn đèn chùm + đèn bàn, không chọn đèn tầng 3', () => {
  const picked = pickNearestLights(lights, at(0, 0, 0), KOHAKU_LIGHT_POOL_SIZE);
  assert.ok(picked.includes(indexOf([0, 3.1, 0])));
  assert.ok(picked.includes(indexOf([0, 1.3, 0])));
  assert.ok(picked.every(i => lights[i].position[1] < 9.4));
});

test('tầng 3: chọn đủ 3 đèn tầng 3', () => {
  const picked = pickNearestLights(lights, at(0, 7.2, 0), KOHAKU_LIGHT_POOL_SIZE);
  for (const p of [[0, 9.6, 5.2], [5.8, 9.4, -1.0], [0, 10.2, 0]]) assert.ok(picked.includes(indexOf(p)));
});

test('luôn trả đúng min(count, số preset) phần tử, thứ tự ổn định khi bằng khoảng cách', () => {
  assert.equal(pickNearestLights(lights, at(1, 2, 3), 6).length, 6);
  assert.equal(pickNearestLights(lights.slice(0, 3), at(0, 0, 0), 6).length, 3);
  const twin: LightPreset[] = [1, 2, 3].map(() => ({ position: [1, 1, 1], intensity: 1, distance: 1, color: '#fff' }));
  assert.deepEqual(pickNearestLights(twin, at(0, 0, 0), 2), [0, 1]);
});

test('assignSlots giữ preset còn được chọn ở slot cũ, điền preset mới vào slot trống', () => {
  assert.deepEqual(assignSlots([3, 5, 7], [5, 9, 3]), [3, 5, 9]);
});

test('tầng 2: đứng ở y=3.6 giữa phòng vẫn lấy đèn chùm tầng 1 (y nặng x2), đứng cạnh đèn 2F thì lấy đèn 2F', () => {
  const mid = pickNearestLights(lights, at(0, 3.6, 0), KOHAKU_LIGHT_POOL_SIZE);
  assert.deepEqual(mid.map(i => lights[i].position), [[0, 3.1, 0], [0, 1.3, 0], [0, 2.6, 5.2], [4.5, 2.4, 3.6], [-5.8, 2.5, -0.9], [-6.3, 2.8, -0.9]]);
  assert.ok(mid.every(i => lights[i].position[1] < 4));
  const near = pickNearestLights(lights, at(0, 5.6, -5.4), KOHAKU_LIGHT_POOL_SIZE);
  assert.ok(near.includes(indexOf([0, 5.8, -5.8])));
  assert.ok(near.includes(indexOf([-5.8, 5.8, -3.2])));
});

test('selectLights: hysteresis giữ preset cũ khi preset mới chỉ hơn dưới LIGHT_SWAP_MARGIN, đổi khi hơn hẳn', () => {
  const mk = (x: number): LightPreset => ({ position: [x, 0, 0], intensity: 1, distance: 1, color: '#fff' });
  const from = at(0, 0, 0);
  const close = [mk(1), mk(5), mk(5 + LIGHT_SWAP_MARGIN * 0.6)];
  assert.ok(weightedDistance(close[2], from) - weightedDistance(close[1], from) < LIGHT_SWAP_MARGIN);
  assert.deepEqual(pickNearestLights(close, from, 2), [0, 1]);
  assert.deepEqual(selectLights(close, from, [0, 2]), [0, 2]);
  const far = [mk(1), mk(3), mk(5.3)];
  assert.deepEqual(selectLights(far, from, [0, 2]), [0, 1]);
  assert.deepEqual(selectLights(far, from, [0, 1]), [0, 1]);
});

test('selectLights: giữ nguyên chỉ số slot và không trùng preset', () => {
  const next = selectLights(lights, at(0, 7.2, 0), pickNearestLights(lights, at(0, 0, 0), KOHAKU_LIGHT_POOL_SIZE));
  assert.equal(next.length, KOHAKU_LIGHT_POOL_SIZE);
  assert.equal(new Set(next).size, KOHAKU_LIGHT_POOL_SIZE);
  for (const p of [[0, 9.6, 5.2], [5.8, 9.4, -1.0], [0, 10.2, 0]]) assert.ok(next.includes(indexOf(p)));
});
