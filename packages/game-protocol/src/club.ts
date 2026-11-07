/** Bố cục và cổng club dùng chung cho renderer và kiểm tra chuyển phòng phía server. */
import djLayout from './club-dj-layout.json';
export type WorldZone = 'street' | 'club';
export const CLUB_ROOM_NAME = 'sakura-club' as const;
export const CLUB_PORTAL = { x: 4.2, z: 1, radius: 2.1 } as const;
export const CLUB_EXIT = { x: 0, z: 6.4, radius: 1.9 } as const;
export const CLUB_STAGE = { xMin: -5.5, xMax: 5.5, zMin: -7.8, zMax: -3.5 } as const;
export const CLUB_COLLIDERS = [
  CLUB_STAGE,
  { xMin: -7.8, xMax: -6.1, zMin: -3.2, zMax: 3.2 },
  { xMin: 6.1, xMax: 7.8, zMin: -3.2, zMax: 3.2 },
  { xMin: djLayout.stairs[0].x - djLayout.stairs[0].width / 2, xMax: djLayout.stairs[0].x + djLayout.stairs[0].width / 2, zMin: -3.5, zMax: -2.6 },
] as const;

/** Vị trí ngồi sát mép đệm và điểm đứng dậy khớp sofa trong denmu-club.glb. */
export const CLUB_SEATS = [-2.1, 0, 2.1].map((z, index) => ({
  id: `sofa-${index + 1}`, x: 6.6, z, yaw: -Math.PI / 2,
  standX: 5.3, standZ: z,
}));
export const SEAT_REACH = 1.6;

export function nearestClubSeat(x: number, z: number) {
  return CLUB_SEATS.filter(seat => Math.hypot(x - seat.x, z - seat.z) <= SEAT_REACH)
    .sort((a, b) => Math.hypot(x - a.x, z - a.z) - Math.hypot(x - b.x, z - b.z))[0];
}

export function isClubWalkable(x: number, z: number): boolean {
  return Number.isFinite(x) && Number.isFinite(z) && Math.abs(x) < 7.7 && z > -7.7 && z < 7.2
    && !CLUB_COLLIDERS.some(b => x >= b.xMin && x <= b.xMax && z >= b.zMin && z <= b.zMax);
}

export function canUsePortal(zone: WorldZone, x: number, z: number): boolean {
  const portal = zone === 'street' ? CLUB_PORTAL : CLUB_EXIT;
  return Math.hypot(x - portal.x, z - portal.z) <= portal.radius;
}
