/** Bố cục Gekkarō dùng chung cho di chuyển có thẩm quyền và cảnh dựng trên web. */
export const GEKKA_ROOM_NAME = 'sakura-gekka' as const;
export const GEKKA_PORTAL = { x: 4.2, z: -15, radius: 2.1 } as const;
export const GEKKA_EXIT = { x: 0, z: 6.6, radius: 1.9 } as const;
export const GEKKA_BASEMENT_Y = -3.2;

const TABLE_CENTER_Z = -1.5;
const STAIR_X_MIN = 5.2;
const STAIR_X_MAX = 6.6;
const STAIR_Z_BOTTOM = -1.5;
const STAIR_Z_TOP = 3.5;

const playerSeats = [-120, -72, -24, 24, 72, 120].map((degrees, index) => {
  const angle = degrees * Math.PI / 180;
  const x = 1.9 * Math.sin(angle);
  const z = TABLE_CENTER_Z + 1.3 * Math.cos(angle);
  const outwardLength = Math.hypot(x, z - TABLE_CENTER_Z);
  return {
    id: `gekka-player-${index + 1}`,
    x, y: 0, z,
    yaw: Math.atan2(-x, TABLE_CENTER_Z - z),
    standX: x + 0.6 * x / outwardLength,
    standZ: z + 0.6 * (z - TABLE_CENTER_Z) / outwardLength,
    npcOnly: false,
  };
});

export const POKER_SEATS: readonly string[] = playerSeats.map(seat => seat.id);
export const GEKKA_SEATS = [
  { id: 'gekka-dealer', x: 0, y: 0, z: -2.8, yaw: 0, standX: 0, standZ: -3.4, npcOnly: true },
  ...playerSeats,
  { id: 'gekka-post', x: 0, y: GEKKA_BASEMENT_Y, z: -3.6, yaw: 0, standX: 4.2, standZ: 2, npcOnly: true },
  ...Array.from({ length: 6 }, (_, index) => ({
    id: `gekka-cell-${index + 1}`,
    x: -5.4, y: GEKKA_BASEMENT_Y, z: -4.5 + index * 1.1,
    yaw: Math.PI / 2, standX: 4.2, standZ: 2, npcOnly: true,
  })),
];

/** Nội thất tầng trên chặn đi xuyên (quầy rượu, góc sofa, bình phong); cảnh web dựng đồ khít các hình chữ nhật này. */
export const GEKKA_UPPER_BLOCKERS = {
  bar: { xMin: -6.5, xMax: -5.7, zMin: 0.6, zMax: 4 },
  lounge: { xMin: -7, xMax: -3.8, zMin: 5, zMax: 7 },
  screen: { xMin: 3.6, xMax: 7, zMin: 5.9, zMax: 7 },
} as const;
/** Khung gỗ chữ A ở hầm: người thua bị trói dang tay chân giữa hai thanh xiên, tâm trùng ghế gekka-post. */
export const GEKKA_RACK = { x: 0, z: -3.6, halfWidth: 1.05, halfDepth: 0.3 } as const;

const onStairs = (x: number, z: number) => x >= STAIR_X_MIN && x <= STAIR_X_MAX && z >= STAIR_Z_BOTTOM && z <= STAIR_Z_TOP;
const onTable = (x: number, z: number) => (x / 1.5) ** 2 + ((z - TABLE_CENTER_Z) / 0.95) ** 2 <= 1;
const byDealerCounter = (x: number, z: number) => Math.abs(x) <= 1.9 && z >= -5.4 && z <= -4.1;
const byRack = (x: number, z: number) => Math.abs(x - GEKKA_RACK.x) <= GEKKA_RACK.halfWidth && Math.abs(z - GEKKA_RACK.z) <= GEKKA_RACK.halfDepth;
const byFurniture = (x: number, z: number) => Object.values(GEKKA_UPPER_BLOCKERS)
  .some(box => x >= box.xMin && x <= box.xMax && z >= box.zMin && z <= box.zMax);

/** Các mặt sàn có thể đứng tại cùng tọa độ X/Z; chọn mặt gần Y hiện tại để không xuyên tầng. */
function candidateSurfaces(x: number, z: number): number[] {
  const surfaces: number[] = [];
  if (x >= -7 && x <= 7 && z >= -7 && z <= 7 && !onTable(x, z) && !byDealerCounter(x, z) && !byFurniture(x, z) && !onStairs(x, z)) {
    surfaces.push(0);
  }
  if (onStairs(x, z)) {
    surfaces.push(z === STAIR_Z_TOP ? 0 : GEKKA_BASEMENT_Y * (STAIR_Z_TOP - z) / (STAIR_Z_TOP - STAIR_Z_BOTTOM));
  }
  if (x >= -6 && x <= 6.6 && z >= -6 && z <= 3.5 && x >= -4.9 && !byRack(x, z) && !(onStairs(x, z) && z > STAIR_Z_BOTTOM)) {
    surfaces.push(GEKKA_BASEMENT_Y);
  }
  return surfaces;
}

export function getGekkaSurfaceY(x: number, z: number, currentY = 0): number {
  if (![x, z, currentY].every(Number.isFinite)) return currentY;
  const surfaces = candidateSurfaces(x, z);
  if (!surfaces.length) return currentY;
  return surfaces.reduce((best, surface) => Math.abs(surface - currentY) < Math.abs(best - currentY) ? surface : best);
}

/** Mỗi bước chỉ được đổi cao tối đa 0,65 m, nên không thể nhảy qua lỗ cầu thang. */
export function resolveGekkaStep(fromX: number, fromY: number, fromZ: number, toX: number, toZ: number): { allowed: boolean; y: number } {
  if (![fromX, fromY, fromZ, toX, toZ].every(Number.isFinite)) return { allowed: false, y: fromY };
  // Chặn cắt ngang mép thang giữa dốc; chỉ đầu trên mới nối trực tiếp với sàn tầng trệt.
  if (fromX !== toX) {
    for (const edge of [STAIR_X_MIN, STAIR_X_MAX]) {
      const crosses = Math.min(fromX, toX) <= edge && Math.max(fromX, toX) >= edge
        && (edge === STAIR_X_MIN ? Math.min(fromX, toX) < edge : Math.max(fromX, toX) > edge);
      if (!crosses) continue;
      const crossingZ = fromZ + (toZ - fromZ) * (edge - fromX) / (toX - fromX);
      if (crossingZ > STAIR_Z_BOTTOM && crossingZ < STAIR_Z_TOP - 0.15) return { allowed: false, y: fromY };
    }
  }
  const surfaces = candidateSurfaces(toX, toZ).filter(y => Math.abs(y - fromY) <= 0.65);
  if (!surfaces.length) return { allowed: false, y: fromY };
  const y = surfaces.reduce((best, surface) => Math.abs(surface - fromY) < Math.abs(best - fromY) ? surface : best);
  return { allowed: true, y };
}

export function isGekkaWalkable(x: number, z: number, y = 0): boolean {
  return resolveGekkaStep(x, y, z, x, z).allowed;
}
