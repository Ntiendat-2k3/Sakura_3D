import { Vector3 } from 'three';
import { CLUB_STAGE } from '@metaverse/game-protocol';
import layout from '../scenes/club-lighting-layout.json';

const fixture = layout.find(entry => entry.role === 'disco')!;
export const CLUB_DISCO_ORIGIN = new Vector3(fixture.position[0], fixture.position[1] + .26, fixture.position[2]);
export const CLUB_PROJECTION_BUDGET = { low: 168, medium: 288, high: 420 };
const surfaces = [
  { axis: 'y', at: .086, normal: [0, 1, 0], kind: 'floor' },
  { axis: 'y', at: .777, normal: [0, 1, 0], kind: 'stage' },
  { axis: 'x', at: -7.76, normal: [1, 0, 0], kind: 'wall' },
  { axis: 'x', at: 7.76, normal: [-1, 0, 0], kind: 'wall' },
  { axis: 'z', at: -7.76, normal: [0, 0, 1], kind: 'wall' },
  { axis: 'z', at: 7.76, normal: [0, 0, -1], kind: 'door' },
] as const;

/** Đưa vệt sáng lên bề mặt phòng gần nhất, giữ khoảng trống cửa; chỉ ghi vào vector cấp sẵn. */
export function traceClubProjection(direction: Vector3, position: Vector3, normal: Vector3) {
  let closest = Infinity;
  for (const surface of surfaces) {
    if (Math.abs(direction[surface.axis]) < 1e-8) continue;
    const t = (surface.at - CLUB_DISCO_ORIGIN[surface.axis]) / direction[surface.axis];
    if (!Number.isFinite(t) || t <= 0 || t >= closest) continue;
    const x = CLUB_DISCO_ORIGIN.x + direction.x * t;
    const y = CLUB_DISCO_ORIGIN.y + direction.y * t;
    const z = CLUB_DISCO_ORIGIN.z + direction.z * t;
    if (Math.abs(x) > 7.761 || Math.abs(z) > 7.761 || y < .08 || y > 5.55) continue;
    if (surface.kind === 'stage' && (x < CLUB_STAGE.xMin || x > CLUB_STAGE.xMax || z < CLUB_STAGE.zMin || z > CLUB_STAGE.zMax)) continue;
    if (surface.kind === 'door' && Math.abs(x) < 1.6 && y < 2.6) continue;
    closest = t;
    position.set(x, y, z); normal.fromArray(surface.normal);
  }
  return Number.isFinite(closest);
}

/** Quay một chiều theo thời gian tuyệt đối; không dùng sin để đảo chiều hoặc dừng ở biên. */
export function getClubProjectionDirection(index: number, count: number, seconds: number, reduced: boolean, target: Vector3) {
  const y = -(.08 + .9 * (index + .5) / count);
  const radius = Math.sqrt(1 - y * y);
  const angle = index * 2.399963229728653 + seconds * (reduced ? .12 : .24);
  return target.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
}
