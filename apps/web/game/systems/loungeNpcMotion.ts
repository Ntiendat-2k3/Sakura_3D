/** Diễn hoạt tương tác 20+ và chế độ đi cùng người chơi cho 3 Hostess Reika Lounge (Yuzu, Bunny, Zankou). */
import { MathUtils, Quaternion, Vector3 } from 'three';
import type { VRM } from '@pixiv/three-vrm';
import {
  isClubWalkable,
  isHotelWalkable,
  isLoungeWalkable,
  isWalkable,
  LOUNGE_NPC_SLOTS,
  MOVE_SPEED,
  PLAYER_DANCES,
  type PlayerDanceStyle,
  type WorldZone,
} from '@metaverse/game-protocol';
import { alignVrmSoles, createTwoBoneIK } from './hostLocomotion';
import { createRecordedClubDance, updateDanceRig } from './retargetClubMotion';

export type LoungeNpcId = 'yuzu' | 'bunny' | 'zankou';
export type LoungeNpcMode = 'idle' | 'walk' | 'flirt' | 'toast' | 'dance';

export const LOUNGE_INTERACT_RADIUS = 2.2;

/** Danh sách clip mocap nhảy riêng cho từng đào trong Reika Hostess Lounge. */
export const LOUNGE_DANCE_CLIPS: Record<LoungeNpcId, readonly string[]> = {
  yuzu: ['Snake Hip Hop Dance'],
  bunny: ['Pop_dance'],
  zankou: ['zankou_dance'],
};

/** Chọn clip nhảy cho đào khi nhảy cùng người chơi trong Club hoặc nhảy riêng tại Lounge. */
export function getCompanionDanceClip(id: LoungeNpcId, style?: PlayerDanceStyle): string {
  if (style && style in PLAYER_DANCES) {
    const source = PLAYER_DANCES[style].source;
    if (source) return source;
  }
  return LOUNGE_DANCE_CLIPS[id][0];
}

function isZonePointWalkable(zone: WorldZone, x: number, z: number): boolean {
  return zone === 'club'
    ? isClubWalkable(x, z)
    : zone === 'lounge'
      ? isLoungeWalkable(x, z)
      : zone === 'hotel'
        ? isHotelWalkable(x, z)
        : isWalkable(x, z);
}

export type CompanionFollowState = {
  x: number;
  z: number;
  yaw: number;
  speed: number;
  zone: WorldZone | null;
};

/** Nội suy vị trí đào đi theo sau/bên cạnh người chơi qua các phòng (Lounge, Phố, Club, Love Hotel) không xuyên tường. */
export function stepCompanionFollow(
  state: CompanionFollowState,
  player: { x: number; z: number; yaw?: number; dancing?: boolean; seatId?: string },
  zone: WorldZone,
  delta: number,
): { moving: boolean; x: number; z: number; yaw: number; speed: number } {
  const dt = MathUtils.clamp(delta, 0, 0.05);
  const playerYaw = Number.isFinite(player.yaw) ? player.yaw! : 0;
  // Nếu người chơi đang ngồi trên giường đôi ở Love Hotel, đào đứng/tạo dáng sát mép giường bên cạnh đầy tình tứ.
  let targetX: number;
  let targetZ: number;
  if (zone === 'hotel' && player.seatId?.startsWith('hotel-bed-')) {
    targetX = player.seatId === 'hotel-bed-1' ? 0.55 : -0.55;
    targetZ = -1.85;
  } else {
    // Đứng lệch sang phải và hơi lùi sau lưng người chơi để không che camera và sánh đôi tự nhiên.
    const sideX = Math.cos(playerYaw) * 0.65 - Math.sin(playerYaw) * 0.85;
    const sideZ = -Math.sin(playerYaw) * 0.65 - Math.cos(playerYaw) * 0.85;
    targetX = player.x + sideX;
    targetZ = player.z + sideZ;
    if (!isZonePointWalkable(zone, targetX, targetZ)) {
      targetX = player.x;
      targetZ = player.z;
    }
  }

  const dx = targetX - state.x;
  const dz = targetZ - state.z;
  const dist = Math.hypot(dx, dz);

  // Khi mới gọi đi cùng, đổi phòng (Lounge <-> Street <-> Club) hoặc khoảng cách quá xa thì dịch chuyển ngay cạnh người chơi.
  if (state.zone !== zone || !Number.isFinite(dist) || dist > 8) {
    state.zone = zone;
    state.x = targetX;
    state.z = targetZ;
    state.yaw = playerYaw;
    state.speed = 0;
    return { moving: false, x: state.x, z: state.z, yaw: state.yaw, speed: 0 };
  }

  const shouldMove = dist > 0.16;
  const desiredSpeed = shouldMove ? Math.min(MOVE_SPEED, Math.max(1.4, dist * 3.6)) : 0;
  state.speed = MathUtils.damp(state.speed, desiredSpeed, 12, dt);

  if (shouldMove && dist > 1e-4) {
    const step = Math.min(dist, state.speed * dt);
    const nx = state.x + (dx / dist) * step;
    const nz = state.z + (dz / dist) * step;
    if (isZonePointWalkable(zone, nx, nz)) {
      state.x = nx;
      state.z = nz;
    } else {
      state.x = targetX;
      state.z = targetZ;
    }
    const moveYaw = Math.atan2(dx, dz);
    const diff = moveYaw - state.yaw;
    state.yaw += Math.atan2(Math.sin(diff), Math.cos(diff)) * (1 - Math.exp(-10 * dt));
    return { moving: true, x: state.x, z: state.z, yaw: state.yaw, speed: state.speed };
  }

  // Khi dừng lại: nếu người chơi đang nhảy thì quay cùng hướng nhảy, ngược lại quay mặt nhìn người chơi.
  const lookYaw = player.dancing
    ? playerYaw
    : Math.hypot(player.x - state.x, player.z - state.z) > 0.05
      ? Math.atan2(player.x - state.x, player.z - state.z)
      : playerYaw;
  const diff = lookYaw - state.yaw;
  state.yaw += Math.atan2(Math.sin(diff), Math.cos(diff)) * (1 - Math.exp(-8 * dt));
  return { moving: state.speed > 0.25, x: state.x, z: state.z, yaw: state.yaw, speed: state.speed };
}

/** Kiểm tra khoảng cách người chơi đứng đủ gần để trò chuyện hoặc gọi đào biểu diễn. */
export function canTalkToLoungeNpc(player: { x: number; z: number } | undefined, npc: { x: number; z: number }) {
  return (
    !!player &&
    Number.isFinite(player.x) &&
    Number.isFinite(player.z) &&
    Math.hypot(player.x - npc.x, player.z - npc.z) <= LOUNGE_INTERACT_RADIUS
  );
}

/** Tìm Hostess gần nhất trong tầm tương tác tại Reika Lounge. */
export function nearestLoungeNpc(player: { x: number; z: number } | undefined) {
  if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.z)) return undefined;
  return LOUNGE_NPC_SLOTS
    .filter(slot => canTalkToLoungeNpc(player, slot))
    .sort((a, b) => Math.hypot(player.x - a.x, player.z - a.z) - Math.hypot(player.x - b.x, player.z - b.z))[0];
}

/** Khởi tạo bộ điều khiển dáng đứng quyến rũ, đi bộ Dwarf Walk, cử chỉ tương tác (flirt/toast) và nhảy mocap cho từng Hostess. */
export function createLoungeNpcMotion(
  vrm: VRM,
  id: LoungeNpcId,
  floorY: number,
  yaw: number,
  dance?: Awaited<ReturnType<typeof createRecordedClubDance>>,
  walk?: Awaited<ReturnType<typeof createRecordedClubDance>>,
) {
  const h = vrm.humanoid;
  const hips = h.getNormalizedBoneNode('hips')!;
  const legs = (['left', 'right'] as const).map(side => {
    const upper = h.getNormalizedBoneNode(`${side}UpperLeg`)!;
    const lower = h.getNormalizedBoneNode(`${side}LowerLeg`)!;
    const foot = h.getNormalizedBoneNode(`${side}Foot`)!;
    return { foot, solve: createTwoBoneIK(upper, lower, foot), anchor: new Vector3(), rotation: new Quaternion() };
  });
  const arms = (['left', 'right'] as const).map(side => {
    const upper = h.getNormalizedBoneNode(`${side}UpperArm`)!;
    const lower = h.getNormalizedBoneNode(`${side}LowerArm`)!;
    const hand = h.getNormalizedBoneNode(`${side}Hand`)!;
    return { upper, lower, hand, solve: createTwoBoneIK(upper, lower, hand) };
  });

  const forward = new Vector3(), kneePole = new Vector3(), elbowPole = new Vector3();
  const shoulder = new Vector3(), elbow = new Vector3(), handPos = new Vector3(), outward = new Vector3(), goal = new Vector3(), scale = new Vector3();
  const phaseOffset = id === 'yuzu' ? 0 : id === 'bunny' ? 2.1 : 4.2;
  const vrm0Sign = vrm.meta?.metaVersion === '0' ? -1 : 1;
  let initialized = false, ankle = 0;

  return {
    legs,
    arms,
    update(seconds: number, delta: number, lookYaw = yaw, mode: LoungeNpcMode = 'idle') {
      const dt = MathUtils.clamp(delta, 0, 0.05);
      if (!initialized) {
        h.resetNormalizedPose();
        vrm.scene.updateWorldMatrix(true, true);
        ankle = alignVrmSoles(vrm, floorY);
      }

      const t = seconds + phaseOffset;
      const blinkCycle = (t % 4.4) - 4.1;
      const blink = Math.max(0, 1 - Math.abs(blinkCycle) / 0.1);

      if (mode === 'walk' && walk) {
        h.resetNormalizedPose();
        walk.update(seconds * 2, 0, seconds);
        vrm.expressionManager?.setValue('blink', blink);
        vrm.expressionManager?.setValue('happy', 0.35);
        vrm.expressionManager?.setValue('relaxed', 0.2);
        updateDanceRig(vrm, dt, floorY + ankle, !initialized);
        initialized = true;
        return;
      }

      if (mode === 'dance' && dance) {
        h.resetNormalizedPose();
        dance.update(seconds * (128 / 60), id === 'yuzu' ? 0 : 1, seconds);
        vrm.expressionManager?.setValue('blink', blink);
        vrm.expressionManager?.setValue('happy', 0.55);
        vrm.expressionManager?.setValue('relaxed', 0.35);
        updateDanceRig(vrm, dt, floorY + ankle, !initialized);
        initialized = true;
        return;
      }

      h.resetNormalizedPose();
      vrm.scene.updateWorldMatrix(true, true);
      legs.forEach(leg => {
        leg.foot.getWorldPosition(leg.anchor);
        leg.foot.getWorldQuaternion(leg.rotation);
      });
      hips.parent!.getWorldScale(scale);

      const breathe = Math.sin(t * 1.7);
      const sway = Math.sin(t * (mode === 'flirt' ? 1.85 : 1.05));
      const hipShift = (mode === 'flirt' ? 0.038 : 0.022) * sway * vrm0Sign;

      hips.position.x += hipShift / scale.x;
      hips.position.y -= (0.022 + 0.005 * (1 + breathe)) / scale.y;
      hips.rotation.set(
        0.02 * breathe * vrm0Sign,
        0.06 * sway,
        (mode === 'flirt' ? 0.095 : 0.055) * sway * vrm0Sign,
      );

      const leanForward = mode === 'flirt' ? 0.075 : mode === 'toast' ? 0.045 : 0.02;
      h.getNormalizedBoneNode('spine')?.rotation.set(
        (leanForward + 0.02 * breathe) * vrm0Sign,
        -0.045 * sway,
        -(mode === 'flirt' ? 0.07 : 0.04) * sway * vrm0Sign,
      );
      h.getNormalizedBoneNode('chest')?.rotation.set(
        0.02 * breathe * vrm0Sign,
        0.035 * Math.cos(t * 1.05),
        -0.025 * sway * vrm0Sign,
      );
      h.getNormalizedBoneNode('head')?.rotation.set(
        (mode === 'flirt' ? -0.05 : 0.025) * Math.sin(t * 1.2) * vrm0Sign,
        0.07 * Math.sin(t * 0.65),
        (mode === 'flirt' ? 0.11 * Math.cos(t * 0.9) : 0.035 * sway) * vrm0Sign,
      );

      vrm.scene.updateWorldMatrix(true, true);
      forward.set(Math.sin(lookYaw), 0, Math.cos(lookYaw));
      kneePole.copy(forward);
      legs.forEach(leg => leg.solve(leg.anchor, kneePole, leg.rotation));

      arms.forEach((arm, i) => {
        arm.upper.getWorldPosition(shoulder);
        arm.lower.getWorldPosition(elbow);
        arm.hand.getWorldPosition(handPos);
        const length = shoulder.distanceTo(elbow) + elbow.distanceTo(handPos);
        arms[1 - i].upper.getWorldPosition(outward);
        outward.subVectors(shoulder, outward);
        outward.y = 0;
        if (outward.lengthSq() < 1e-6) outward.set(i === 0 ? 1 : -1, 0, 0);
        else outward.normalize();

        if (mode === 'flirt') {
          if (i === 0) {
            goal.copy(shoulder).addScaledVector(forward, 0.08).addScaledVector(outward, -0.04);
            goal.y -= MathUtils.clamp(length * 0.66, 0.14, length * 0.88);
            elbowPole.copy(outward).addScaledVector(forward, -0.4).normalize();
          } else {
            const kissPhase = 0.5 + 0.5 * Math.sin(t * 2.1);
            const fwdOffset = 0.18 + 0.16 * kissPhase;
            const outOffset = -0.08 + 0.14 * kissPhase;
            const downOffset = MathUtils.clamp(length * (0.22 + 0.18 * kissPhase), 0.06, length * 0.75);
            goal.copy(shoulder).addScaledVector(forward, fwdOffset).addScaledVector(outward, outOffset);
            goal.y -= downOffset;
            elbowPole.copy(forward).negate().addScaledVector(outward, 0.55).normalize();
          }
        } else if (mode === 'toast') {
          if (i === 0) {
            goal.copy(shoulder).addScaledVector(forward, 0.15).addScaledVector(outward, -0.05);
            goal.y -= MathUtils.clamp(length * 0.72, 0.14, length * 0.88);
            elbowPole.copy(forward).negate().addScaledVector(outward, 0.45).normalize();
          } else {
            const toastLift = 0.03 * Math.sin(t * 1.8);
            goal.copy(shoulder).addScaledVector(forward, 0.28).addScaledVector(outward, -0.03);
            goal.y -= MathUtils.clamp(length * 0.36 - toastLift, 0.08, length * 0.75);
            elbowPole.copy(forward).negate().addScaledVector(outward, 0.45).normalize();
          }
        } else if (id === 'yuzu') {
          const wave = i === 1 ? Math.max(0, Math.sin(t * 1.1)) : 0;
          const fwdOffset = 0.16 + 0.06 * wave;
          const outOffset = -0.05 + 0.15 * wave + 0.025 * Math.sin(t * 3.0) * wave;
          const downOffset = MathUtils.clamp(length * (0.74 - 0.30 * wave), 0.12, length * 0.92);
          goal.copy(shoulder).addScaledVector(forward, fwdOffset).addScaledVector(outward, outOffset);
          goal.y -= downOffset;
          elbowPole.copy(forward).negate().addScaledVector(outward, 0.45).normalize();
        } else if (id === 'bunny') {
          const poseWave = 0.5 + 0.5 * Math.sin(t * 1.25);
          const fwdOffset = i === 0 ? 0.22 : 0.16 + 0.04 * poseWave;
          const outOffset = i === 0 ? 0.05 : -0.04 + 0.05 * poseWave;
          const downOffset = MathUtils.clamp(length * (i === 0 ? 0.68 : 0.46 + 0.08 * poseWave), 0.12, length * 0.9);
          goal.copy(shoulder).addScaledVector(forward, fwdOffset).addScaledVector(outward, outOffset);
          goal.y -= downOffset;
          elbowPole.copy(forward).negate().addScaledVector(outward, 0.52).normalize();
        } else {
          const gesture = i === 1 ? 0.5 + 0.5 * Math.sin(t * 1.15) : 0;
          const fwdOffset = i === 0 ? 0.09 : 0.18 + 0.06 * gesture;
          const outOffset = i === 0 ? -0.03 : 0.02 + 0.06 * gesture;
          const downOffset = MathUtils.clamp(length * (i === 0 ? 0.67 : 0.58 - 0.14 * gesture), 0.14, length * 0.92);
          goal.copy(shoulder).addScaledVector(forward, fwdOffset).addScaledVector(outward, outOffset);
          goal.y -= downOffset;
          elbowPole.copy(forward).negate().addScaledVector(outward, 0.46).normalize();
        }
        arm.solve(goal, elbowPole);
      });

      for (const side of ['left', 'right'] as const) {
        for (const finger of ['Index', 'Middle', 'Ring', 'Little'] as const) {
          const node = h.getNormalizedBoneNode(`${side}${finger}Proximal`);
          if (node) node.rotation.z = side === 'left' ? -0.14 : 0.14;
        }
      }

      vrm.expressionManager?.setValue('blink', blink);
      vrm.expressionManager?.setValue('happy', mode === 'flirt' ? 0.65 : mode === 'toast' ? 0.5 : 0.25);
      vrm.expressionManager?.setValue('relaxed', mode === 'flirt' ? 0.45 : 0.2);
      updateDanceRig(vrm, dt, floorY + ankle, !initialized);
      initialized = true;
    },
  };
}
