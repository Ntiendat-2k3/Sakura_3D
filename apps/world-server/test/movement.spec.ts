import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlayerState } from '../src/state/city.state';
import { applyMovement } from '../src/simulation/movement';
import { COLLIDERS, isWalkable, canUsePortal, isClubWalkable, nearestClubSeat } from '@metaverse/game-protocol';

test('server moves a player from input without trusting client positions', () => {
  const player = new PlayerState();
  applyMovement(player, { x: 1, z: 0 }, 0.05);
  assert.ok(player.x > 0 && player.x < 0.3);
  assert.equal(player.z, 5);
});

test('server blocks movement into a building collider', () => {
  const player = new PlayerState();
  const block = COLLIDERS.find(b => b.xMin > 0)!;
  const start = block.xMin - 0.05;
  player.x = start; player.z = (block.zMin + block.zMax) / 2;
  applyMovement(player, { x: 1, z: 0 }, 0.05);
  assert.equal(player.x, start);
});

test('server rejects a diagonal step into a building corner', () => {
  const player = new PlayerState();
  const block = COLLIDERS.find(b => b.xMin > 0)!;
  const startZ = block.zMin - 0.1;
  player.x = block.xMin - 0.1; player.z = startZ;
  applyMovement(player, { x: 1, z: 1 }, 0.05);
  assert.equal(isWalkable(player.x, player.z), true);
  assert.equal(player.z, startZ);
});

test('club chặn sân khấu, quầy bar và biên phòng nhưng mở sàn nhảy', () => {
  assert.equal(isClubWalkable(0, 0), true);
  assert.equal(isClubWalkable(0, -5), false);
  assert.equal(isClubWalkable(-7, 0), false);
  assert.equal(isClubWalkable(8, 0), false);
  const player = new PlayerState(); player.x = 0; player.z = -3.45;
  applyMovement(player, { x: 0, z: -1 }, .05, 'club');
  assert.equal(player.z, -3.45);
});

test('chuyển phòng chỉ hợp lệ trong bán kính cửa tương ứng', () => {
  assert.equal(canUsePortal('street', 0, 5), false);
  assert.equal(canUsePortal('street', 4.2, 1), true);
  assert.equal(canUsePortal('club', 0, 6.4), true);
  assert.equal(canUsePortal('club', 0, 0), false);
  assert.equal(canUsePortal('club', NaN, 0), false);
});

test('ghế có giới hạn khoảng cách và người đang ngồi không được di chuyển', () => {
  assert.equal(nearestClubSeat(0, 0), undefined);
  assert.equal(nearestClubSeat(5.7, 0)?.id, 'sofa-2');
  const player = new PlayerState(); player.seatId = 'sofa-2'; player.x = 6.8; player.z = 0;
  applyMovement(player, { x: -1, z: 0 }, .1, 'club');
  assert.equal(player.x, 6.8);
});

test('input nghỉ giữ nhảy; input di chuyển hủy nhảy kể cả khi bị collider chặn', () => {
  const player = new PlayerState(); player.dancing = true; player.danceStyle = 'guitar'; player.x = 0; player.z = -3.45;
  applyMovement(player, { x: 0, z: 0 }, .05, 'club');
  assert.equal(player.dancing, true);
  applyMovement(player, { x: 0, z: -1 }, .05, 'club');
  assert.equal(player.dancing, false);
  assert.equal(player.danceStyle, 'normal');
  assert.equal(player.z, -3.45);
});
