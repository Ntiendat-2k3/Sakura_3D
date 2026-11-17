import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PositionSnapshot } from '@metaverse/game-protocol';
import { keepIfEqual, reusePlayers } from '../game/networking/stableState';

const snap = (id: string, x: number, sampleTime = 1): PositionSnapshot => ({ id, name: id, x, y: 0, z: 0, yaw: 0, sampleTime, seatId: '', dancing: false, danceStyle: 'normal', characterId: 'yui' } as PositionSnapshot);

test('keepIfEqual giữ tham chiếu cũ khi object lồng nhau bằng nhau', () => {
  const previous = { a: 1, b: [1, 2] };
  assert.equal(keepIfEqual(previous, { a: 1, b: [1, 2] }), previous);
});

test('keepIfEqual trả next khi một lá khác', () => {
  const previous = { a: 1, b: [1, 2] }, next = { a: 1, b: [1, 3] };
  assert.equal(keepIfEqual(previous, next), next);
});

test('reusePlayers giữ object người không đổi, đổi object người có thay đổi', () => {
  const prev = { p1: snap('p1', 1), p2: snap('p2', 2) };
  const result = reusePlayers(prev, { p1: snap('p1', 1), p2: snap('p2', 3) });
  assert.equal(result.p1, prev.p1);
  assert.notEqual(result.p2, prev.p2);
  assert.equal(result.p2.x, 3);
});

test('reusePlayers trả previous khi không ai đổi', () => {
  const prev = { p1: snap('p1', 1), p2: snap('p2', 2) };
  assert.equal(reusePlayers(prev, { p1: snap('p1', 1), p2: snap('p2', 2) }), prev);
});

test('reusePlayers trả object mới khi có người rời hoặc vào', () => {
  const prev = { p1: snap('p1', 1), p2: snap('p2', 2) };
  const left = reusePlayers(prev, { p1: snap('p1', 1) });
  assert.notEqual(left, prev);
  assert.deepEqual(Object.keys(left), ['p1']);
  assert.equal(left.p1, prev.p1);
  assert.notEqual(reusePlayers(prev, { ...prev, p3: snap('p3', 0) }), prev);
});

test('reusePlayers không giữ identity khi chỉ sampleTime đổi (đúng với traffic thật)', () => {
  const prev = { p1: snap('p1', 1, 1) };
  const result = reusePlayers(prev, { p1: snap('p1', 1, 2) });
  assert.notEqual(result, prev);
  assert.notEqual(result.p1, prev.p1);
});
