import assert from 'node:assert/strict';
import test from 'node:test';
import { STREET_DECOR, STREET_SEATS, STREET_SOCIAL_TIMING, findPunchTarget, getZoneSeats, isWalkable, knockbackPosition, nearestZoneSeat, streetBenchPartnerSeat } from '../src';

test('mỗi ghế đá công viên có 2 chỗ, đứng dậy ra lối đi được, mặt quay ra lối sỏi', () => {
  assert.equal(STREET_SEATS.length, STREET_DECOR.stoneBenches.length * 2);
  assert.equal(getZoneSeats('street'), STREET_SEATS);
  for (const seat of STREET_SEATS) {
    assert.equal(isWalkable(seat.x, seat.z), false, `${seat.id}: chỗ ngồi nằm trong khối ghế`);
    assert.equal(isWalkable(seat.standX, seat.standZ), true, `${seat.id}: điểm đứng dậy`);
    assert.equal(nearestZoneSeat('street', seat.standX, seat.standZ)?.id, seat.id);
    // Hướng nhìn trỏ về phía lối sỏi (x = ±17.4).
    assert.ok(Math.sign(Math.sin(seat.yaw)) === Math.sign(seat.x));
    const partner = streetBenchPartnerSeat(seat.id)!;
    assert.equal(partner.bench, seat.bench);
    assert.notEqual(partner.id, seat.id);
    assert.ok(Math.abs(Math.hypot(partner.x - seat.x, partner.z - seat.z) - 0.76) < 1e-9);
  }
  assert.equal(streetBenchPartnerSeat('club-1'), undefined);
  assert.equal(nearestZoneSeat('street', 0, 0), undefined, 'giữa phố không có ghế');
});

test('đấm: chọn người đứng gần nhất trong tầm, bỏ qua người đang ngồi và chính mình', () => {
  const me = { id: 'a', x: 0, z: 0 };
  const others = [me, { id: 'far', x: 2, z: 0 }, { id: 'seated', x: .5, z: 0, seatId: 'street-bench-1-a' }, { id: 'near', x: 0, z: 1.2 }, { id: 'nearer', x: -.9, z: 0 }];
  assert.equal(findPunchTarget(me, others)?.id, 'nearer');
  assert.equal(findPunchTarget(me, [me, { id: 'out', x: STREET_SOCIAL_TIMING.punchReach + .01, z: 0 }]), undefined);
  assert.equal(findPunchTarget({ ...me, seatId: 'street-bench-1-a' }, others), undefined, 'đang ngồi thì không đấm');
});

test('đẩy lùi theo hướng cú đấm và dừng trước vật cản', () => {
  const pushed = knockbackPosition({ x: 0, z: 0 }, { x: 0, z: 1 }, () => true);
  assert.ok(Math.abs(pushed.z - (1 + STREET_SOCIAL_TIMING.knockback)) < 1e-9 && pushed.x === 0);
  const blocked = knockbackPosition({ x: 0, z: 0 }, { x: 0, z: 1 }, (_, z) => z < 1.25);
  assert.ok(blocked.z < 1.25 && blocked.z > 1);
  // Áp sát tường nhà: không bị hất xuyên vào khối nhà.
  const wall = knockbackPosition({ x: 4, z: 1 }, { x: 5.2, z: 1 }, isWalkable);
  assert.ok(isWalkable(wall.x, wall.z));
});
