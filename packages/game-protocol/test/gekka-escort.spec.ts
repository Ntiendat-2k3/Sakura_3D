import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GEKKA_BASEMENT_Y, GEKKA_ESCORT, GEKKA_ESCORT_SPECTATOR_SPOTS, GEKKA_EXECUTIONER_RETURN, GEKKA_EXECUTIONER_RETURN_MS,
  POKER_SEATS, gekkaPolylineAt, isGekkaWalkable, makeGekkaPolyline, nearestOnGekkaPolyline, planGekkaEscort,
  resolveGekkaStep, sampleGekkaEscort, type GekkaPolyline,
} from '../src/index';

/** Đi từng bước 10 cm dọc lộ trình bằng đúng luật bước của server: người xem đi theo phải đi được thật. */
function assertWalkable(line: GekkaPolyline, label: string) {
  let at = gekkaPolylineAt(line, 0);
  for (let s = 0.1; s <= line.length + 1e-9; s += 0.1) {
    const next = gekkaPolylineAt(line, s);
    const step = resolveGekkaStep(at.x, at.y, at.z, next.x, next.z);
    assert.ok(step.allowed, `${label}: kẹt tại s=${s.toFixed(1)} (${next.x.toFixed(2)}, ${next.y.toFixed(2)}, ${next.z.toFixed(2)})`);
    assert.ok(Math.abs(step.y - next.y) < 0.2, `${label}: lệch tầng tại s=${s.toFixed(1)}`);
    at = { ...next, y: step.y };
  }
}

test('lộ trình lôi người từ mọi ghế đi được trọn vẹn tới trước khung chữ A', () => {
  for (const seatId of POKER_SEATS) {
    const plan = planGekkaEscort([seatId]);
    // Đoạn đầu (từ chỗ canh vào vòng bàn) là của đao phủ NPC; người đi theo nhập vào từ vòng bàn.
    assertWalkable(makeGekkaPolyline(plan.points.slice(1)), seatId);
    const end = plan.points[plan.points.length - 1];
    assert.equal(end.y, GEKKA_BASEMENT_Y);
    assert.deepEqual([end.x, end.z], [GEKKA_ESCORT.rack.x, GEKKA_ESCORT.rack.z]);
    assert.ok(plan.duration > 8 && plan.duration < 40, `${seatId}: ${plan.duration.toFixed(1)} s`);
  }
});

test('đao phủ túm người theo vòng bàn, người bị lôi đi sau đao phủ và chưa bị túm thì vẫn ngồi', () => {
  const plan = planGekkaEscort(['gekka-player-1', 'gekka-player-6', 'gekka-player-3']);
  assert.deepEqual(plan.stops.map(stop => stop.seatId), ['gekka-player-6', 'gekka-player-3', 'gekka-player-1']);
  const [first, second] = plan.stops;
  const beforeGrab = sampleGekkaEscort(plan, first.releasedAt - 0.5);
  assert.equal(beforeGrab.executioner.grabbing, 'gekka-player-6');
  assert.equal(beforeGrab.prisoners.get('gekka-player-6'), null);

  const dragging = sampleGekkaEscort(plan, (first.releasedAt + second.releasedAt) / 2);
  const firstPose = dragging.prisoners.get('gekka-player-6')!;
  assert.ok(firstPose, 'người đầu đã bị túm');
  assert.equal(dragging.prisoners.get('gekka-player-3'), null);
  const gap = Math.hypot(firstPose.x - dragging.executioner.x, firstPose.z - dragging.executioner.z);
  assert.ok(gap <= GEKKA_ESCORT.prisonerGap + 0.01, `cách đao phủ ${gap.toFixed(2)} m`);

  const end = sampleGekkaEscort(plan, plan.duration);
  assert.equal(end.done, true);
  assert.equal(end.executioner.walking, false);
  for (const pose of end.prisoners.values()) assert.ok(pose && pose.y === GEKKA_BASEMENT_Y, 'cả đoàn đã xuống hầm');
});

test('đường đao phủ quay về chỗ canh đi được và server chờ đủ thời gian đó', () => {
  assertWalkable(makeGekkaPolyline(GEKKA_EXECUTIONER_RETURN.points.slice(0, -1)), 'quay về');
  assert.equal(GEKKA_EXECUTIONER_RETURN_MS, Math.ceil(GEKKA_EXECUTIONER_RETURN.length / GEKKA_ESCORT.returnSpeed * 1000));
});

test('chỗ người xem đứng trong hầm đi được, và người ở salon nhập vào lộ trình từ điểm gần nhất phía trên', () => {
  for (const spot of GEKKA_ESCORT_SPECTATOR_SPOTS) assert.ok(isGekkaWalkable(spot.x, spot.z, spot.y), `${spot.x},${spot.z}`);
  const plan = planGekkaEscort(['gekka-player-2']);
  const s = nearestOnGekkaPolyline(plan, -3.5, 0, 2.5);
  assert.equal(gekkaPolylineAt(plan, s).y, 0);
  assert.ok(nearestOnGekkaPolyline(plan, -3.5, 0, 2.5, 1) <= 1);
});
