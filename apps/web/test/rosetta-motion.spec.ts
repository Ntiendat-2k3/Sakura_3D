import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isWalkable } from '@metaverse/game-protocol';
import definitions from '../game/entities/club-npcs.json';
import { canTalkToRosetta, getRosettaPoseWeight } from '../game/systems/rosettaMotion';

test('Rosetta đổi vẫy/tạo dáng mỗi khoảng 3 giây, nội suy liên tục qua vòng', () => {
  assert.equal(getRosettaPoseWeight(1), 0); assert.equal(getRosettaPoseWeight(4), 1);
  for (const t of [2.3, 3, 5.3, 6, 9]) assert.ok(Math.abs(getRosettaPoseWeight(t - .0001) - getRosettaPoseWeight(t + .0001)) < .001);
});

test('Rosetta lớn hơn vẫn chừa khoảng đệm 0.8 m khỏi công trình và cột bên mặt tiền', () => {
  const [x, , z] = definitions.rosetta.position;
  for (const dx of [-.8, 0, .8]) for (const dz of [-.8, 0, .8]) assert.ok(isWalkable(x + dx, z + dz));
  assert.ok(x + .8 < 5.45 - .5, 'Chạm cụm cột đèn ở x=5.45');
});

test('tương tác chỉ trong 2 m quanh vị trí thật của NPC; loại thiếu player/NaN', () => {
  const npc = { x: 3.5, z: 3.2 };
  assert.equal(canTalkToRosetta({ x: 3.5, z: 5.2 }, npc), true);
  assert.equal(canTalkToRosetta({ x: 3.5, z: 5.21 }, npc), false);
  assert.equal(canTalkToRosetta({ x: Number.NaN, z: 3.2 }, npc), false);
  assert.equal(canTalkToRosetta(undefined, npc), false);
});
