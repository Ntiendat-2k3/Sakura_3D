/** Dàn cảnh nụ hôn Hinata ↔ người chơi: chỗ đứng, hướng mặt và thời gian bước tới để hai clip Kiss chạy khớp nhau. */
import { MOVE_SPEED } from '@metaverse/game-protocol';

/**
 * Khoảng cách gốc avatar ↔ gốc Hinata (m) khi hôn. Đo trên model thật (gốc ngang bị khóa khi retarget): ở đỉnh cú hôn
 * (~2.1 s, hai clip trùng nhịp) khớp đầu Hinata + khớp đầu người chơi tiến tổng ~0.16 m trước gốc (yui ~0.09 m);
 * môi chạm nhau khi hai khớp đầu còn cách ~0.17 m (mặt ở trước khớp đầu ~9 cm, đầu nghiêng tránh mũi).
 */
export const HINATA_KISS_DISTANCE = 0.33;
/** Dừng chân một nhịp trước khi hai người cùng bắt đầu clip. */
export const HINATA_KISS_SETTLE_MS = 150;
/** Bằng độ dài clip Kiss / Kiss_player (3.73 s, trừ đoạn nối vòng). */
export const HINATA_KISS_DURATION_MS = 3500;

/** Lệnh cho avatar local: bước tới (x, z), quay mặt `yaw`, chạy clip từ startAt tới endAt (performance.now(), ms). */
export type PlayerKissCue = { key: number; startAt: number; endAt: number; x: number; z: number; yaw: number };

/** Chỗ đứng nằm trên đường Hinata → người chơi, nên Hinata (đang nhìn người chơi) không cần quay thêm. */
export function planHinataKiss(
  player: { x: number; z: number },
  hinata: { x: number; z: number; yaw: number },
  now: number,
  key: number,
): { cue: PlayerKissCue; approachMs: number } {
  let dx = player.x - hinata.x, dz = player.z - hinata.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 1e-3) { dx = Math.sin(hinata.yaw); dz = Math.cos(hinata.yaw); } else { dx /= dist; dz /= dist; }
  const x = hinata.x + dx * HINATA_KISS_DISTANCE, z = hinata.z + dz * HINATA_KISS_DISTANCE;
  const walk = Math.hypot(player.x - x, player.z - z);
  const approachMs = Math.round(walk / MOVE_SPEED * 1000) + HINATA_KISS_SETTLE_MS;
  const startAt = now + approachMs;
  return { cue: { key, startAt, endAt: startAt + HINATA_KISS_DURATION_MS, x, z, yaw: Math.atan2(-dx, -dz) }, approachMs };
}
