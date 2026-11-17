import assert from 'node:assert/strict';
import test from 'node:test';
import { KOHAKU_JUMP_SPOTS, kohakuJumpDuration } from '@metaverse/game-protocol';
import { createKohakuJumps } from '../src/systems/kohakuJump';

const makePlayer = (x: number, y: number, z: number) => ({ x, y, z, yaw: 0, seatId: '', dancing: true, jumpSpot: '' });

test('server tự chọn điểm nhảy từ vị trí, khóa người chơi đến khi tiếp đất tầng 1', () => {
  const spot = KOHAKU_JUMP_SPOTS[2];
  const player = makePlayer(spot.from.x + 0.3, spot.from.y, spot.from.z);
  const jumps = createKohakuJumps(() => player);
  assert.equal(jumps.start('a', 1000), null);
  assert.equal(jumps.isJumping('a'), true);
  assert.equal(player.jumpSpot, spot.id);
  assert.equal(player.dancing, false);
  assert.equal(player.x, spot.from.x, 'đặt chính xác vào điểm đứng');
  assert.equal(jumps.start('a', 1050), null, 'bấm lại khi đang bay bị bỏ qua');

  jumps.tick(1000 + 900);
  assert.ok(player.y > 0 && player.y < spot.from.y + 1.2, 'đang bay giữa không trung');

  const end = 1000 + kohakuJumpDuration(spot) * 1000;
  jumps.tick(end - 50);
  assert.deepEqual([player.x, player.y, player.z], [spot.to.x, 0, spot.to.z], 'đã chạm đất, còn khuỵu gối');
  assert.equal(jumps.isJumping('a'), true);
  jumps.tick(end);
  assert.equal(jumps.isJumping('a'), false);
  assert.equal(player.jumpSpot, '');
});

test('từ chối khi đứng tầng 1, xa lan can hoặc đang ngồi', () => {
  const spot = KOHAKU_JUMP_SPOTS[0];
  const floor = makePlayer(spot.from.x, 0, spot.from.z);
  assert.match(createKohakuJumps(() => floor).start('a', 0) ?? '', /lan can/);
  const far = makePlayer(0, 3.6, -6.5);
  assert.match(createKohakuJumps(() => far).start('a', 0) ?? '', /lan can/);
  const seated = { ...makePlayer(spot.from.x, spot.from.y, spot.from.z), seatId: 'kohaku-player-1' };
  assert.match(createKohakuJumps(() => seated).start('a', 0) ?? '', /đứng dậy/);
  assert.equal(seated.jumpSpot, '');
});

test('người rời phòng giữa chừng không còn bị cập nhật', () => {
  const spot = KOHAKU_JUMP_SPOTS[0];
  const players = new Map([['a', makePlayer(spot.from.x, spot.from.y, spot.from.z)]]);
  const jumps = createKohakuJumps(id => players.get(id));
  jumps.start('a', 0);
  players.delete('a');
  jumps.tick(500);
  assert.equal(jumps.isJumping('a'), false);
});
