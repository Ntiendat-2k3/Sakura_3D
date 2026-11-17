import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlayerState } from '../src/state/city.state';
import { applyMovement } from '../src/simulation/movement';
import { COLLIDERS, isWalkable, canUsePortal, isClubWalkable, isLoungeWalkable, isHotelWalkable, getLoungeSurfaceY, nearestClubSeat, nearestLoungeSeat, nearestHotelSeat, nearestStreetPortal, LOUNGE_NPC_SLOTS } from '@metaverse/game-protocol';

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
  assert.equal(isClubWalkable(-5.6, 0), false, 'ghế bar Denmu');
  assert.equal(isClubWalkable(6.2, 5.8), false, 'booth tròn VIP');
  assert.equal(isClubWalkable(-6.3, 4.6), false, 'bàn cocktail đứng');
  assert.equal(isClubWalkable(0, 5), true, 'thảm đỏ lối vào');
  assert.equal(isClubWalkable(5.3, 0), true, 'điểm đứng dậy sofa VIP');
  const player = new PlayerState(); player.x = 0; player.z = -3.45;
  applyMovement(player, { x: 0, z: -1 }, .05, 'club');
  assert.equal(player.z, -3.45);
});

test('chuyển phòng chỉ hợp lệ trong bán kính cửa tương ứng', () => {
  assert.equal(canUsePortal('street', 0, 5), false);
  assert.equal(canUsePortal('street', 4.2, 1), true);
  assert.equal(canUsePortal('street', 4.2, 1, 'club'), true);
  assert.equal(canUsePortal('street', 4.2, 1, 'lounge'), false);
  assert.equal(canUsePortal('street', -4.2, -7), true);
  assert.equal(canUsePortal('street', -4.2, -7, 'lounge'), true);
  assert.equal(canUsePortal('street', -4.2, -7, 'club'), false);
  assert.equal(nearestStreetPortal(4.2, 1)?.destination, 'club');
  assert.equal(nearestStreetPortal(-4.2, -7)?.destination, 'lounge');
  assert.equal(nearestStreetPortal(-4.2, -9.6)?.destination, 'hotel');
  assert.equal(canUsePortal('street', -4.2, -9.6, 'hotel'), true);
  assert.equal(canUsePortal('street', -4.2, -9.6, 'club'), false);
  assert.equal(canUsePortal('lounge', 5.3, 5.6, 'hotel'), true);
  assert.equal(canUsePortal('lounge', 5.3, 5.6, 'street'), false);
  assert.equal(canUsePortal('club', 0, 6.4), true);
  assert.equal(canUsePortal('club', 0, 0), false);
  assert.equal(canUsePortal('lounge', 0, 5.8), true);
  assert.equal(canUsePortal('lounge', 0, 0), false);
  assert.equal(canUsePortal('hotel', 0, 4.8), true);
  assert.equal(canUsePortal('hotel', 0, 0), false);
  assert.equal(canUsePortal('club', NaN, 0), false);
});

test('Cyber Love Hotel chặn bục giường King-size, bồn tắm Jacuzzi, Minibar và hỗ trợ chỗ ngồi đôi', () => {
  assert.equal(isHotelWalkable(0, 0), true);
  assert.equal(isHotelWalkable(0, -3.8), false);
  assert.equal(isHotelWalkable(-4.4, -0.8), false);
  assert.equal(isHotelWalkable(4.6, -1.8), false);
  assert.equal(nearestHotelSeat(-0.75, -1.2)?.id, 'hotel-bed-1');
  assert.equal(nearestHotelSeat(-1.9, -0.8)?.id, 'hotel-jacuzzi-1');
  assert.equal(nearestHotelSeat(3.1, 1.55)?.id, 'hotel-sofa-1');
  const player = new PlayerState(); player.x = 0; player.z = -2.15;
  applyMovement(player, { x: 0, z: -1 }, .05, 'hotel');
  assert.equal(player.z, -2.15);
});

test('Reika Hostess Lounge thông thoáng chân thang, cho phép leo thang bộ lên tầng 2 và chặn lan can', () => {
  assert.equal(isLoungeWalkable(0, 0), true);
  assert.equal(isLoungeWalkable(-3.2, 3.8), false);
  assert.equal(isLoungeWalkable(-5.8, -1.2), false);
  assert.equal(isLoungeWalkable(0, -5.5), false);
  // Khoảng đệm trước chân thang (z=2.0) và lối lên bậc thang (z=2.5 đến 4.4) hoàn toàn thông thoáng
  assert.equal(isLoungeWalkable(5.3, 2.0), true);
  assert.equal(isLoungeWalkable(5.3, 2.5), true);
  assert.equal(isLoungeWalkable(5.3, 3.5), true);
  // Chiếu nghỉ tầng 2 trước cửa phòng 201
  assert.equal(isLoungeWalkable(5.3, 5.6), true);
  // Lan can sườn trái thang bộ chặn không cho nhảy/xuyên qua sảnh tầng 1
  assert.equal(isLoungeWalkable(4.0, 3.5), false);
  assert.equal(isLoungeWalkable(4.0, 5.5), false);
  // Độ cao sàn và dốc thang bộ
  assert.equal(getLoungeSurfaceY(0, 0), 0);
  assert.equal(getLoungeSurfaceY(5.3, 2.0), 0);
  assert.ok(getLoungeSurfaceY(5.3, 3.425) > 1.0 && getLoungeSurfaceY(5.3, 3.425) < 1.3);
  assert.equal(getLoungeSurfaceY(5.3, 4.4), 2.32);
  assert.equal(getLoungeSurfaceY(5.3, 5.8), 2.32);
  // Ghế sofa 1 và sofa 2 (đã dời về z=0.4)
  assert.equal(nearestLoungeSeat(4.5, -2.1)?.id, 'lounge-sofa-1');
  assert.equal(nearestLoungeSeat(4.5, 0.4)?.id, 'lounge-sofa-2');
  assert.equal(nearestLoungeSeat(-0.8, -4.3)?.id, 'lounge-vip-1');
  assert.equal(LOUNGE_NPC_SLOTS.length, 3);
  const player = new PlayerState(); player.x = 0; player.z = -4.45;
  applyMovement(player, { x: 0, z: -1 }, .05, 'lounge');
  assert.equal(player.z, -4.45);
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

test('Kohaku Club server simulation: di chuyển từ tầng 1 leo cầu thang lên tầng 2 và tầng 3 mượt mà', () => {
  const player = new PlayerState();
  player.x = 5.9;
  player.y = 0;
  player.z = -1.4;

  // Đi thẳng về -Z để leo cầu thang 1->2 (mỗi tick 50ms) vào sâu chiếu nghỉ Tầng 2 (z < -6.22, vòng qua sau trụ góc cua)
  for (let i = 0; i < 22; i++) {
    applyMovement(player, { x: 0, z: -1 }, 0.05, 'kohaku');
  }
  // Lúc này đã qua z = -6.22 vào khoảng mở chiếu nghỉ Tầng 2 (y = 3.6)
  assert.ok(player.z < -6.22, `đã leo qua đỉnh cầu thang 1->2 vào chiếu nghỉ (z=${player.z})`);
  assert.equal(player.y, 3.6, 'độ cao đạt đúng sàn Tầng 2');

  // Kiểm tra hành lang Tầng 2 bị chặn không cho đi xuyên rào góc cua sang cầu thang 1->2
  const railGuard = new PlayerState();
  railGuard.x = 4.1; railGuard.y = 3.6; railGuard.z = -5.2;
  for (let i = 0; i < 6; i++) {
    applyMovement(railGuard, { x: 1, z: 0 }, 0.05, 'kohaku');
  }
  assert.ok(railGuard.x <= 4.30, `không cho đi xuyên lan can kính góc cua trên Tầng 2 (x=${railGuard.x})`);

  // Đi sang trái qua khoảng mở sau trụ góc cua (z < -6.22), vòng ra giữa thảm hành lang (z ~ -5.7) tránh bàn trà tới Cánh Trái
  for (let i = 0; i < 10; i++) {
    applyMovement(player, { x: -1, z: 0 }, 0.05, 'kohaku');
  }
  for (let i = 0; i < 4; i++) {
    applyMovement(player, { x: 0, z: 1 }, 0.05, 'kohaku');
  }
  for (let i = 0; i < 48; i++) {
    applyMovement(player, { x: -1, z: 0 }, 0.05, 'kohaku');
  }
  assert.ok(player.x < -5.0, `đã đi sang cánh trái Tầng 2 (x=${player.x})`);
  assert.equal(player.y, 3.6);

  // Tiến về +Z để đi qua cầu thang 2->3 lên Tầng 3 (y = 7.2)
  for (let i = 0; i < 42; i++) {
    applyMovement(player, { x: 0, z: 1 }, 0.05, 'kohaku');
  }
  assert.ok(player.z >= 2.8, `đã leo tới Sảnh Trước Tầng 3 (z=${player.z})`);
  assert.equal(player.y, 7.2, 'độ cao đạt đúng sàn Penthouse Tầng 3');
});

test('Gekka server simulation: xuống hầm theo cầu thang và giữ đúng độ cao', () => {
  const player = new PlayerState();
  player.x = 5.9; player.y = 0; player.z = 3.6;
  for (let i = 0; i < 25; i++) applyMovement(player, { x: 0, z: -1 }, 0.05, 'gekka');
  assert.ok(player.z < -1.5);
  assert.equal(player.y, -3.2);
  const previousZ = player.z;
  applyMovement(player, { x: 0, z: -1 }, 0.05, 'gekka');
  assert.ok(player.z < previousZ);
  assert.equal(player.y, -3.2);
});
