/**
 * Tương tác xã hội ngoài phố Sakura: ngồi ghế đá công viên, hôn người ngồi cạnh trên cùng ghế, đấm người đứng gần.
 * Hàm thuần dùng chung cho server (quyết định) và client (gợi ý nút bấm).
 */
import streetDecor from './street-decor.json';

export const STREET_SOCIAL_MESSAGES = {
  kiss: 'street-kiss',
  kissFx: 'street-kiss-fx',
  punch: 'street-punch',
  punchFx: 'street-punch-fx',
} as const;

export const STREET_SOCIAL_TIMING = {
  /** Bằng độ dài clip Kiss_player trừ đoạn nối vòng. */
  kissMs: 3600,
  kissCooldownMs: 5000,
  /** Cross Punch ra đòn rồi trúng sau chừng này (khớp đoạn clip phát ở client). */
  punchImpactMs: 500,
  punchCooldownMs: 900,
  /** Tầm với tay tính từ tâm người đấm tới tâm người bị đấm. */
  punchReach: 1.5,
  knockback: 0.55,
} as const;

/** Hai chỗ ngồi mỗi ghế đá, cách nhau theo chiều dài ghế; ghế quay mặt ra lối sỏi giữa công viên. */
const SEAT_OFFSET = 0.38;
const STAND_DISTANCE = 0.85;

export type StreetSeat = { id: string; bench: number; x: number; z: number; yaw: number; standX: number; standZ: number };

export const STREET_SEATS: readonly StreetSeat[] = streetDecor.stoneBenches.flatMap((bench, index) => {
  const face = bench.x > 0 ? 1 : -1;
  return (['a', 'b'] as const).map((slot, k) => ({
    id: `street-bench-${index + 1}-${slot}`,
    bench: index,
    x: bench.x,
    z: bench.z + (k === 0 ? -SEAT_OFFSET : SEAT_OFFSET),
    yaw: face * Math.PI / 2,
    standX: bench.x + face * STAND_DISTANCE,
    standZ: bench.z + (k === 0 ? -SEAT_OFFSET : SEAT_OFFSET),
  }));
});

/** Chỗ ngồi còn lại trên cùng ghế đá (người ngồi cạnh để hôn). */
export function streetBenchPartnerSeat(seatId: string): StreetSeat | undefined {
  const seat = STREET_SEATS.find(item => item.id === seatId);
  return seat ? STREET_SEATS.find(item => item.bench === seat.bench && item.id !== seat.id) : undefined;
}

type Body = { id: string; x: number; z: number; seatId?: string };

/** Người đứng gần nhất trong tầm với; người đang ngồi không bị đấm (đang ở ghế, không phải đứng cạnh). */
export function findPunchTarget<T extends Body>(attacker: Body, others: readonly T[]): T | undefined {
  if (attacker.seatId) return undefined;
  let best: T | undefined, bestDistance: number = STREET_SOCIAL_TIMING.punchReach;
  for (const other of others) {
    if (other.id === attacker.id || other.seatId) continue;
    const distance = Math.hypot(other.x - attacker.x, other.z - attacker.z);
    if (distance <= bestDistance) { best = other; bestDistance = distance; }
  }
  return best;
}

/** Đẩy lùi theo hướng cú đấm; dừng ở bước cuối còn đi được để không bị hất xuyên tường hay đồ vật. */
export function knockbackPosition(attacker: { x: number; z: number }, target: { x: number; z: number }, walkable: (x: number, z: number) => boolean) {
  const dx = target.x - attacker.x, dz = target.z - attacker.z, length = Math.hypot(dx, dz) || 1;
  let x = target.x, z = target.z;
  for (let step = 1; step <= 5; step++) {
    const t = STREET_SOCIAL_TIMING.knockback * step / 5;
    const nx = target.x + dx / length * t, nz = target.z + dz / length * t;
    if (!walkable(nx, nz)) break;
    x = nx; z = nz;
  }
  return { x, z };
}
