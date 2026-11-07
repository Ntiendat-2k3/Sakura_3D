/** Dùng quỹ đạo đã được server chốt và bộ IK hiện có để DJ đi xuống cầu thang, gặp khách rồi quay lại. */
import { createDjRoute, getDjSurfaceY, sampleDjTravel, type DjSample, type DjVisit } from '@metaverse/game-protocol';
import type { HostMotionRoute, PatrolSample } from './hostLocomotion';

export function createDjVisitMotion(visit: DjVisit): HostMotionRoute {
  const route = createDjRoute(visit.targetX, visit.targetZ), returning = visit.phase === 'returning';
  const length = returning ? visit.returnDistance : route.length;
  let faceYaw = 0;
  const path = (distance: number, out: PatrolSample) => {
    if (visit.phase === 'ready') { Object.assign(out, { x: visit.targetX, y: getDjSurfaceY(visit.targetX, visit.targetZ), z: visit.targetZ, yaw: faceYaw }); return out; }
    route.sample(distance, out as DjSample, returning, visit.returnDistance);
    out.y = getDjSurfaceY(out.x, out.z); return out;
  };
  return {
    stride: length / Math.max(1, Math.round(length / .84)) || .84, speed: 1.1, path,
    sample(seconds, out) {
      const travel = sampleDjTravel(visit.phase === 'ready' ? Number.MAX_SAFE_INTEGER : seconds, length);
      route.sample(travel.distance, out as DjSample, returning, visit.returnDistance);
      out.speed = travel.speed;
      if (visit.phase === 'ready') {
        const target = Math.atan2(visit.playerX - out.x, visit.playerZ - out.z);
        out.yaw += Math.atan2(Math.sin(target - out.yaw), Math.cos(target - out.yaw)) * (1 - Math.exp(-5 * Math.max(0, seconds)));
        faceYaw = out.yaw; out.distance = 0;
      }
      return out;
    },
  };
}
