/** Chuyển động VRM cho bà chủ Aos (đứng/đi/cúi chào) và đao phủ Onizuka (đứng/thủ thế/đấm) ở 月華楼. */
import { MathUtils, Quaternion, Vector3, type Group } from 'three';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import { alignVrmSoles, createTwoBoneIK } from './hostLocomotion';
import { updateDanceRig, type createRecordedClubDance } from './retargetClubMotion';

export type RecordedGekkaClip = Awaited<ReturnType<typeof createRecordedClubDance>>;
export type GekkaActorStance = 'hostess' | 'executioner';
/** Một khung điều khiển: vị trí gốc (thế giới), có đang đi không, hoặc clip đang phát ở thời điểm nào. */
export type GekkaActorFrame = {
  x: number; y: number; z: number; yaw: number;
  walking: boolean;
  /** key đổi thì nội suy từ pose đang hiển thị sang clip mới, tránh giật giữa thủ thế và cú đấm. */
  clip?: { key: string; motion: RecordedGekkaClip; time: number } | null;
  /** Tay phải vươn tới điểm này (thế giới), vd. đao phủ túm áo người bị lôi; weight 0..1 để vươn/thu mượt. */
  reach?: { x: number; y: number; z: number; weight: number } | null;
};

/** Clip Mixamo của nhân sự Gekkarō; màn hình tải nạp sẵn để vào sòng không phải chờ tải. */
export const GEKKA_STAFF_CLIPS = { walk: 'Dwarf Walk', bow: 'Quick Formal Bow', punch: 'Cross Punch' } as const;

/** Cú đấm Cross Punch: nắm tay phải duỗi thẳng nhất ở 1.13 s (đo từ clip đã chuyển). */
export const PUNCH_IMPACT_SECONDS = 1.13;
/** Ra đòn trước khi trúng và thu tay sau khi trúng (giây); tổng < POKER_TIMING.punchIntervalMs để không chồng cú. */
export const PUNCH_LEAD_SECONDS = 0.5;
export const PUNCH_TAIL_SECONDS = 0.45;
/** Khung thủ thế trong Cross Punch (trước khi lấy đà), dùng khi đao phủ chờ giữa các cú. */
export const PUNCH_GUARD_SECONDS = 0.35;
const CROSSFADE_SECONDS = 0.3;

/**
 * Chọn khung clip đấm theo hạn cú kế tiếp của server (deadline, ms Date.now) và lúc cú trước vừa trúng (ms performance.now).
 * Trả null khi không cần thủ thế (hầm đang trống).
 */
export function punchClipTime(options: { active: boolean; punching: boolean; deadline: number; nowMs: number; lastImpactAgo: number | null; punchesDone: number }) {
  if (!options.active) return null;
  const { lastImpactAgo } = options;
  if (lastImpactAgo !== null && lastImpactAgo >= 0 && lastImpactAgo < PUNCH_TAIL_SECONDS) {
    return { key: `punch-${options.punchesDone}`, time: PUNCH_IMPACT_SECONDS + lastImpactAgo };
  }
  const untilImpact = (options.deadline - options.nowMs) / 1000;
  if (options.punching && options.deadline > 0 && untilImpact > 0 && untilImpact <= PUNCH_LEAD_SECONDS) {
    return { key: `punch-${options.punchesDone + 1}`, time: PUNCH_IMPACT_SECONDS - untilImpact };
  }
  return { key: 'guard', time: PUNCH_GUARD_SECONDS };
}

export function createGekkaActorMotion(vrm: VRM, stance: GekkaActorStance, walk: RecordedGekkaClip | null) {
  const h = vrm.humanoid;
  const hips = h.getNormalizedBoneNode('hips')!;
  const bones = Object.keys(h.humanBones) as VRMHumanBoneName[];
  const arms = (['left', 'right'] as const).map(side => ({
    side,
    upper: h.getNormalizedBoneNode(`${side}UpperArm`)!,
    lower: h.getNormalizedBoneNode(`${side}LowerArm`)!,
    hand: h.getNormalizedBoneNode(`${side}Hand`)!,
  })).map(arm => ({ ...arm, solve: createTwoBoneIK(arm.upper, arm.lower, arm.hand) }));
  const vrm0Sign = vrm.meta?.metaVersion === '0' ? -1 : 1;
  const fadeFrom = new Map<string, Quaternion>(), fadeHips = new Vector3(), fadeQ = new Quaternion();
  const forward = new Vector3(), left = new Vector3(), hipWorld = new Vector3(), goal = new Vector3(), pole = new Vector3(), scale = new Vector3();
  const reachFrom = { upper: new Quaternion(), lower: new Quaternion() };
  let initialized = false, ankle = 0, lastKey = '', fadeElapsed = CROSSFADE_SECONDS;

  /** Đứng yên có hơi thở; bà chủ chắp tay trước bụng, đao phủ buông tay nắm đấm, dồn trọng tâm. */
  const idlePose = (t: number, yaw: number) => {
    const breathe = Math.sin(t * 1.6), sway = Math.sin(t * 0.8);
    hips.parent!.getWorldScale(scale);
    hips.position.y -= (0.015 + 0.004 * (1 + breathe)) / scale.y;
    hips.position.x += (stance === 'executioner' ? 0.02 : 0.012) * sway / scale.x;
    h.getNormalizedBoneNode('spine')?.rotation.set((0.02 + 0.015 * breathe) * vrm0Sign, 0.03 * sway, 0);
    h.getNormalizedBoneNode('chest')?.rotation.set((stance === 'executioner' ? -0.04 : 0.01 * breathe) * vrm0Sign, 0, 0);
    h.getNormalizedBoneNode('head')?.rotation.set((stance === 'executioner' ? 0.08 : 0.02 * breathe) * vrm0Sign, 0.07 * Math.sin(t * 0.5), 0);
    vrm.scene.updateWorldMatrix(true, true);
    if (stance === 'executioner') {
      for (const arm of arms) {
        // Xương normalized của three-vrm dùng chung trục cho VRM 0 và 1, nên góc buông tay (trục Z) không nhân vrm0Sign:
        // nhân vào thì với VRM 0.x (cả 4 model Gekkarō) hai tay giơ thẳng lên trời. Đo trong gekka-npc.spec.
        const dir = arm.side === 'left' ? 1 : -1;
        arm.upper.rotation.set(0.06 * vrm0Sign, 0, dir * 1.18);
        arm.lower.rotation.set(0.18 * vrm0Sign, 0, dir * 0.12);
        for (const finger of ['Index', 'Middle', 'Ring', 'Little'] as const) {
          for (const part of ['Proximal', 'Intermediate', 'Distal'] as const) {
            const node = h.getNormalizedBoneNode(`${arm.side}${finger}${part}`);
            if (node) node.rotation.z = arm.side === 'left' ? -1.1 : 1.1;
          }
        }
      }
      return;
    }
    // Bà chủ: hai bàn tay gặp nhau trước bụng, khuỷu hơi mở ra sau.
    forward.set(Math.sin(yaw), 0, Math.cos(yaw));
    left.set(forward.z, 0, -forward.x);
    hips.getWorldPosition(hipWorld);
    for (const arm of arms) {
      const sign = arm.side === 'left' ? 1 : -1;
      goal.copy(hipWorld).addScaledVector(forward, 0.2).addScaledVector(left, sign * 0.035);
      goal.y += 0.02;
      pole.copy(forward).negate().addScaledVector(left, sign * 0.7).normalize();
      arm.solve(goal, pole);
    }
  };

  return {
    update(seconds: number, delta: number, root: Group, frame: GekkaActorFrame) {
      const dt = MathUtils.clamp(delta, 0, 0.05);
      root.position.set(frame.x, frame.y, frame.z);
      root.rotation.set(0, frame.yaw, 0);
      root.updateMatrixWorld(true);
      if (!initialized) {
        h.resetNormalizedPose();
        vrm.scene.updateWorldMatrix(true, true);
        ankle = alignVrmSoles(vrm, frame.y);
      }
      const key = frame.clip ? frame.clip.key : frame.walking && walk ? 'walk' : 'idle';
      if (key !== lastKey && initialized) {
        // Xương còn giữ pose frame trước (chưa reset) nên chụp ngay để nội suy sang động tác mới.
        for (const name of bones) {
          const node = h.getNormalizedBoneNode(name);
          if (node) fadeFrom.set(name, (fadeFrom.get(name) ?? new Quaternion()).copy(node.quaternion));
        }
        fadeHips.copy(hips.position);
        fadeElapsed = 0;
      }
      lastKey = key;
      fadeElapsed += dt;

      h.resetNormalizedPose();
      if (frame.clip) frame.clip.motion.update(frame.clip.time, 0, frame.clip.time);
      else if (key === 'walk') walk!.update(seconds * 2, 0, seconds);
      else idlePose(seconds, frame.yaw);

      if (fadeElapsed < CROSSFADE_SECONDS) {
        const x = fadeElapsed / CROSSFADE_SECONDS, w = x * x * (3 - 2 * x);
        for (const name of bones) {
          const node = h.getNormalizedBoneNode(name), from = fadeFrom.get(name);
          if (node && from) node.quaternion.copy(fadeQ.copy(from).slerp(node.quaternion, w));
        }
        hips.position.lerpVectors(fadeHips, hips.position, w);
      }
      if (frame.reach && frame.reach.weight > 0) {
        // IK chạy sau clip đi bộ nên chỉ đè tay phải; khuỷu hướng xuống và ra ngoài như đang kéo người phía sau.
        const arm = arms[1];
        vrm.scene.updateWorldMatrix(true, true);
        reachFrom.upper.copy(arm.upper.quaternion); reachFrom.lower.copy(arm.lower.quaternion);
        forward.set(Math.sin(frame.yaw), 0, Math.cos(frame.yaw));
        left.set(forward.z, 0, -forward.x);
        goal.set(frame.reach.x, frame.reach.y, frame.reach.z);
        pole.copy(left).multiplyScalar(-0.6).add(forward.multiplyScalar(-0.3)).setY(-1).normalize();
        arm.solve(goal, pole);
        const w = Math.min(1, frame.reach.weight);
        arm.upper.quaternion.copy(reachFrom.upper.slerp(arm.upper.quaternion, w));
        arm.lower.quaternion.copy(reachFrom.lower.slerp(arm.lower.quaternion, w));
      }
      const blink = Math.max(0, 1 - Math.abs((seconds % 4.4) - 4.15) / 0.1);
      vrm.expressionManager?.setValue('blink', blink);
      vrm.expressionManager?.setValue(stance === 'executioner' ? 'angry' : 'happy', stance === 'executioner' ? 0.35 : 0.4);
      vrm.expressionManager?.setValue('relaxed', stance === 'hostess' ? 0.25 : 0);
      updateDanceRig(vrm, dt, frame.y + ankle, !initialized);
      initialized = true;
    },
  };
}
