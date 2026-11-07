/** Đệm snapshot mạng để gói đến lệch nhịp không làm avatar/camera khựng sau từng đoạn 100 ms. */
import { MathUtils, Vector3, type Group } from 'three';
import { GAME_PATCH_MS, GAME_TICK_MS, MOVE_SPEED, type PositionSnapshot } from '@metaverse/game-protocol';

type Sample = { x: number; z: number; yaw: number; time: number };
// Chừa một patch, một tick lệch pha và khoảng đệm nhận gói/commit; không ngoại suy qua collider.
const interpolationDelay = GAME_PATCH_MS * 1.5 + GAME_TICK_MS;

export function createPlayerPresentation(initial: PositionSnapshot, now: number) {
  const initialTime = initial.sampleTime ?? now;
  const samples: Sample[] = [{ x: initial.x, z: initial.z, yaw: initial.yaw, time: initialTime }];
  const previous = new Vector3(initial.x, 0, initial.z);
  let speed = 0, snap = true;
  let clockOffset = now - initialTime, targetOffset = clockOffset;
  return {
    push(player: PositionSnapshot, receivedAt: number) {
      const latest = samples[samples.length - 1];
      const time = player.sampleTime ?? receivedAt;
      if (time < latest.time) return;
      targetOffset = Math.min(targetOffset, receivedAt - time);
      if (Math.hypot(player.x - latest.x, player.z - latest.z) > MOVE_SPEED) { samples.length = 0; snap = true; }
      const sample = { x: player.x, z: player.z, yaw: player.yaw, time };
      if (samples.length && time === latest.time) samples[samples.length - 1] = sample;
      else samples.push(sample);
      if (samples.length > 8) samples.shift();
    },
    /** Chỉ nội suy dữ liệu server đã nhận, không dự đoán đi xuyên collider hoặc sửa state mạng. */
    update(root: Group, delta: number, time: number) {
      const dt = MathUtils.clamp(delta, 0, .1);
      // Hiệu chỉnh lệch đồng hồ từ từ, không nhảy vị trí khi có gói đến nhanh hơn trước.
      clockOffset = MathUtils.damp(clockOffset, targetOffset, .5, dt);
      const renderTime = time - clockOffset - interpolationDelay;
      while (samples.length > 2 && samples[1].time <= renderTime) samples.shift();
      const from = samples[0], to = samples[1] ?? from;
      const alpha = to.time === from.time ? 1 : MathUtils.clamp((renderTime - from.time) / (to.time - from.time), 0, 1);
      if (snap) {
        root.position.set(from.x, 0, from.z); root.rotation.y = from.yaw;
        previous.copy(root.position); speed = 0; snap = false;
      } else {
        root.position.set(MathUtils.lerp(from.x, to.x, alpha), 0, MathUtils.lerp(from.z, to.z, alpha));
        const difference = Math.atan2(Math.sin(to.yaw - from.yaw), Math.cos(to.yaw - from.yaw));
        const targetYaw = from.yaw + difference * alpha;
        const turn = Math.atan2(Math.sin(targetYaw - root.rotation.y), Math.cos(targetYaw - root.rotation.y));
        root.rotation.y += turn * (1 - Math.exp(-18 * dt));
        const actualSpeed = dt > 0 ? root.position.distanceTo(previous) / dt : 0;
        speed = MathUtils.damp(speed, Math.min(actualSpeed, MOVE_SPEED * 1.5), 18, dt);
        previous.copy(root.position);
      }
      return speed;
    },
  };
}
