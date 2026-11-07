/** Tương tác DJ và đường đi dùng chung; server quyết định thời điểm/đích, client chỉ diễn lại đường đã duyệt. */
import layout from './club-dj-layout.json';
import { isClubWalkable } from './club';

export const CLUB_DJ_LAYOUT = layout;
export const DJ_HOLD_MS = 1200, DJ_WAIT_MS = 30000, DJ_REACH = 2;
export const DJ_HOME = layout.home, DJ_FLOOR_Y = .086;
export type DjPhase = 'idle' | 'holding' | 'approaching' | 'ready' | 'returning';
export type DjVisit = { phase: DjPhase; requesterId: string; startedAt: number; playerX: number; playerZ: number; targetX: number; targetZ: number; returnDistance: number };
export const DEFAULT_DJ_VISIT: DjVisit = { phase: 'idle', requesterId: '', startedAt: 0, playerX: 0, playerZ: 0, targetX: 0, targetZ: -2, returnDistance: 0 };
export type DjPoint = { x: number; y: number; z: number };
export type DjSample = DjPoint & { yaw: number; distance: number; speed: number };
const SPEED = 1.1, ACCEL = .5;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const length = (a: DjPoint, b: DjPoint) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const between = (a: DjPoint, b: DjPoint, t: number): DjPoint => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) });

export function canCallClubDj(player?: { x: number; z: number; seatId?: string }) {
  return !!player && !player.seatId && Math.abs(player.x) <= 5.2 && player.z > -3.5 && player.z <= -1 && isClubWalkable(player.x, player.z);
}

export function getDjMeetingPoint(player: { x: number; z: number }): DjPoint | undefined {
  return [{ x: player.x, z: player.z - .95 }, { x: player.x + .95, z: player.z },
    { x: player.x - .95, z: player.z }, { x: player.x, z: player.z + .95 }]
    .filter(point => Math.abs(point.x) <= 5.6 && isClubWalkable(point.x, point.z)).map(point => ({ ...point, y: DJ_FLOOR_Y }))[0];
}

export function getDjSurfaceY(x: number, z: number) {
  if (z <= -3.5) return DJ_HOME.y;
  for (const step of layout.stairs) if (Math.abs(x - step.x) <= step.width / 2 + .05 && Math.abs(z - step.z) <= step.depth / 2 + .001) return step.top;
  return DJ_FLOOR_Y;
}

/** Bo góc bằng Bezier trong miền lồi, không overshoot ra tường/console như Catmull-Rom. */
export function createDjRoute(targetX: number, targetZ: number) {
  const nodes: DjPoint[] = [{ ...DJ_HOME }, { x: 2.9, y: .77, z: -7.35 }, { x: 2.9, y: .77, z: -3.6 },
    ...layout.stairs.map(step => ({ x: step.x, y: step.top, z: step.z })),
    { x: 2.9, y: DJ_FLOOR_Y, z: -2.45 }, { x: targetX, y: DJ_FLOOR_Y, z: -2.45 }, { x: targetX, y: DJ_FLOOR_Y, z: targetZ }]
    .filter((point, index, all) => index === 0 || length(point, all[index - 1]) > .0001);
  const points: DjPoint[] = [nodes[0]];
  for (let i = 1; i < nodes.length - 1; i++) {
    const previous = nodes[i - 1], corner = nodes[i], next = nodes[i + 1];
    const before = length(previous, corner), after = length(corner, next);
    if (before < .0001 || after < .0001) { points.push(corner); continue; }
    const radius = Math.min(.23, before / 3, after / 3);
    const from = between(corner, previous, radius / before), to = between(corner, next, radius / after);
    points.push(from);
    for (let j = 1; j <= 8; j++) { const t = j / 8; points.push(between(between(from, corner, t), between(corner, to, t), t)); }
  }
  points.push(nodes[nodes.length - 1]);
  const distances = [0];
  for (let i = 1; i < points.length; i++) distances.push(distances[i - 1] + length(points[i - 1], points[i]));
  const total = distances[distances.length - 1];
  return {
    length: total, stride: total / Math.max(1, Math.round(total / .84)),
    sample(distance: number, out: DjSample, reverse = false, returnFrom = total) {
      const d = Math.max(0, Math.min(total, reverse ? returnFrom - distance : distance));
      let i = 1; while (i < distances.length - 1 && distances[i] < d) i++;
      const a = points[i - 1], b = points[i], span = distances[i] - distances[i - 1];
      const t = span > 0 ? (d - distances[i - 1]) / span : 1;
      Object.assign(out, between(a, b, t)); out.yaw = Math.atan2(b.x - a.x, b.z - a.z) + (reverse ? Math.PI : 0); out.distance = distance;
      return out;
    },
  };
}

export function getDjTravelDuration(distance: number) { return Math.max(0, distance) / SPEED + Math.min(ACCEL, Math.max(0, distance) / SPEED); }
export function sampleDjTravel(seconds: number, distance: number) {
  if (distance <= 0) return { distance: 0, speed: 0 };
  const acceleration = Math.min(ACCEL, distance / SPEED);
  const duration = getDjTravelDuration(distance), time = Math.max(0, Math.min(duration, seconds));
  const integrated = (u: number) => SPEED * acceleration * (u ** 3 - .5 * u ** 4);
  if (time < acceleration) { const u = time / acceleration; return { distance: Math.min(distance, integrated(u)), speed: SPEED * u * u * (3 - 2 * u) }; }
  if (time < duration - acceleration) return { distance: SPEED * (time - acceleration / 2), speed: SPEED };
  const u = (duration - time) / acceleration;
  return { distance: Math.max(0, distance - integrated(u)), speed: SPEED * u * u * (3 - 2 * u) };
}
