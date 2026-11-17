/** Đổi sự kiện hôn/đấm ngoài phố thành động tác cho từng avatar (người đấm, người trúng đòn, hai người hôn). */
import { STREET_SOCIAL_TIMING, type PositionSnapshot } from '@metaverse/game-protocol';
import type { StreetFx } from '../networking/useCityConnection';
import type { PlayerActionCue } from './playerActionMotion';

/**
 * Chân và hông giữ hướng ngồi; chỉ thân trên xoắn + nghiêng sang bạn, hông nhích nhẹ trên ghế.
 * (Xoay cả người làm đùi hai người đâm xuyên nhau: đo được chỉ còn 0.02 m giữa hai đầu gối.)
 * Dò trên rig thật 3 cặp (kita+serie, bocchi+ryo, nijika+ubel), ghế cách 0.76 m:
 * tâm hai đầu cách 0.17–0.22 m (mặt chạm nhau), đùi/gối cách nhau tối thiểu 0.29 m.
 */
const KISS_TWIST_SHARE = 0.65;
const KISS_LEAN = 0.42;
const KISS_SLIDE = 0.14;

function leanToward(from: PositionSnapshot | undefined, to: PositionSnapshot | undefined) {
  if (!from || !to) return { twist: 0, lean: 0, slideX: 0, slideZ: 0 };
  const dx = to.x - from.x, dz = to.z - from.z, length = Math.hypot(dx, dz) || 1;
  const desired = Math.atan2(dx, dz);
  // Nghiêng quanh trục hướng mặt: dấu dương ngả về hướng (−cos yaw, 0, sin yaw) (= forward × up).
  const side = Math.sign(-Math.cos(from.yaw) * dx + Math.sin(from.yaw) * dz) || 1;
  return {
    twist: Math.atan2(Math.sin(desired - from.yaw), Math.cos(desired - from.yaw)) * KISS_TWIST_SHARE,
    lean: side * KISS_LEAN,
    slideX: dx / length * KISS_SLIDE,
    slideZ: dz / length * KISS_SLIDE,
  };
}

/** Sự kiện mới hơn ghi đè sự kiện cũ của cùng người. */
export function buildStreetActionCues(fx: readonly StreetFx[], players: Record<string, PositionSnapshot>): Record<string, PlayerActionCue> {
  const cues: Record<string, PlayerActionCue> = {};
  for (const item of [...fx].sort((a, b) => a.at - b.at)) {
    if (item.kind === 'punch') {
      cues[item.a] = { kind: 'punch', startAt: item.at };
      cues[item.b] = { kind: 'hit', startAt: item.at + STREET_SOCIAL_TIMING.punchImpactMs };
    } else {
      cues[item.a] = { kind: 'seatKiss', startAt: item.at, ...leanToward(players[item.a], players[item.b]) };
      cues[item.b] = { kind: 'seatKiss', startAt: item.at, ...leanToward(players[item.b], players[item.a]) };
    }
  }
  return cues;
}
