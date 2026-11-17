/**
 * Nhảy từ ban công tầng 2/3 Kohaku xuống sàn tầng 1. Hàm thuần dùng chung: server lấy vị trí authoritative
 * mỗi tick, client tính đúng quỹ đạo đó để vẽ mượt (không phụ thuộc nhịp patch 10 Hz).
 */
export const KOHAKU_JUMP_MESSAGE = 'kohaku-jump' as const;

export const KOHAKU_JUMP_TIMING = {
  /** Nhún lấy đà tại chỗ trước khi bật. */
  prepSeconds: 0.4,
  /** Khuỵu gối tiếp đất rồi đứng dậy, vẫn khóa di chuyển. */
  landSeconds: 0.75,
  /** Gia tốc rơi đã "anime hóa" (chậm hơn 9.81 để người xem kịp thấy cú nhảy). */
  gravity: 12,
  /** Độ bật lên trên mép sàn để chân vượt lan can kính cao 0.95 m. */
  apexHeight: 1.1,
} as const;

/** Bán kính quanh điểm đứng được phép bấm nhảy. */
export const KOHAKU_JUMP_REACH = 0.8;

export type KohakuJumpSpot = {
  id: string;
  label: string;
  /** Điểm đứng sát lan can (chân), y là cao độ sàn tầng. */
  from: { x: number; y: number; z: number };
  /** Điểm tiếp đất trên sàn tầng 1 (đã chọn tránh collider, đèn lồng và đèn chùm). */
  to: { x: number; z: number };
};

/** Lan can giếng trời: tầng 2 ở z = -4.4, tầng 3 trước ở z = 2.8 và hành lang phải ở x = 4.4 (scripts/build-kohaku-club.py). */
export const KOHAKU_JUMP_SPOTS: readonly KohakuJumpSpot[] = [
  { id: '2f-back-left', label: 'Tầng 2', from: { x: -2.7, y: 3.6, z: -4.85 }, to: { x: -2.7, z: -3.0 } },
  { id: '2f-back-right', label: 'Tầng 2', from: { x: 2.7, y: 3.6, z: -4.85 }, to: { x: 2.7, z: -3.0 } },
  { id: '3f-front-left', label: 'Tầng 3', from: { x: -2.0, y: 7.2, z: 3.2 }, to: { x: -2.0, z: 1.7 } },
  { id: '3f-front-right', label: 'Tầng 3', from: { x: 2.0, y: 7.2, z: 3.2 }, to: { x: 2.0, z: 1.7 } },
  { id: '3f-right', label: 'Tầng 3', from: { x: 4.85, y: 7.2, z: -0.2 }, to: { x: 3.3, z: -0.2 } },
];

export function getKohakuJumpSpot(id: string | undefined): KohakuJumpSpot | undefined {
  return id ? KOHAKU_JUMP_SPOTS.find(spot => spot.id === id) : undefined;
}

/** Điểm nhảy trong tầm với ở đúng tầng người chơi đang đứng. */
export function findKohakuJumpSpot(x: number, y: number, z: number): KohakuJumpSpot | undefined {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return undefined;
  return KOHAKU_JUMP_SPOTS.find(spot => Math.abs(y - spot.from.y) < 0.3 && Math.hypot(x - spot.from.x, z - spot.from.z) <= KOHAKU_JUMP_REACH);
}

/** Thời gian bay: bật lên v0 rồi rơi qua (độ cao + apex) dưới gia tốc g. */
export function kohakuJumpAirSeconds(spot: KohakuJumpSpot): number {
  const { gravity: g, apexHeight } = KOHAKU_JUMP_TIMING;
  const v0 = Math.sqrt(2 * g * apexHeight);
  return (v0 + Math.sqrt(v0 * v0 + 2 * g * spot.from.y)) / g;
}

export function kohakuJumpDuration(spot: KohakuJumpSpot): number {
  return KOHAKU_JUMP_TIMING.prepSeconds + kohakuJumpAirSeconds(spot) + KOHAKU_JUMP_TIMING.landSeconds;
}

export type KohakuJumpPhase = 'prep' | 'air' | 'land' | 'done';
export type KohakuJumpSample = { x: number; y: number; z: number; yaw: number; phase: KohakuJumpPhase };

/**
 * Vị trí chân theo thời gian kể từ lúc bắt đầu. Ngang đi theo smoothstep để thân bật lên trước rồi mới lao ra,
 * nhờ vậy chân đã cao hơn lan can khi đi ngang qua nó.
 */
export function sampleKohakuJump(spot: KohakuJumpSpot, seconds: number): KohakuJumpSample {
  const { prepSeconds, landSeconds, gravity: g, apexHeight } = KOHAKU_JUMP_TIMING;
  const air = kohakuJumpAirSeconds(spot);
  const yaw = Math.atan2(spot.to.x - spot.from.x, spot.to.z - spot.from.z);
  const t = Math.max(0, seconds) - prepSeconds;
  if (t <= 0) return { ...spot.from, yaw, phase: 'prep' };
  if (t >= air) return { x: spot.to.x, y: 0, z: spot.to.z, yaw, phase: t >= air + landSeconds ? 'done' : 'land' };
  const u = t / air, ease = u * u * (3 - 2 * u);
  const v0 = Math.sqrt(2 * g * apexHeight);
  return {
    x: spot.from.x + (spot.to.x - spot.from.x) * ease,
    y: Math.max(0, spot.from.y + v0 * t - 0.5 * g * t * t),
    z: spot.from.z + (spot.to.z - spot.from.z) * ease,
    yaw,
    phase: 'air',
  };
}
