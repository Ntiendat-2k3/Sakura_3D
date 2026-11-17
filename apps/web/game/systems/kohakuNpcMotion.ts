/** Điều khiển chuyển động và tư thế đứng/ngồi cho 3 NPC VRM của Kohaku Club (Shinku, Hinata, Bartender). */
import { MathUtils, Quaternion, Vector3 } from 'three';
import type { VRM } from '@pixiv/three-vrm';
import { alignVrmSoles, createTwoBoneIK } from './hostLocomotion';
import { applyVrmPose, createRecordedClubDance, updateDanceRig, updateSpringBones } from './retargetClubMotion';

export type KohakuNpcId = 'shinku' | 'hinata' | 'bartender';
/** idle: đứng chờ; bow: cúi chào MỘT lần (mỗi actionKey); kiss: hôn người chơi một lần. */
export type HinataActionMode = 'idle' | 'bow' | 'kiss';
export type RecordedKohakuClip = Awaited<ReturnType<typeof createRecordedClubDance>>;

export type HinataMotionClips = {
  bow?: RecordedKohakuClip | null;
  kiss?: RecordedKohakuClip | null;
};

export type KohakuNpcPoseOptions = {
  lookYaw?: number;
  seated?: boolean;
  hinataMode?: HinataActionMode;
  actionElapsed?: number;
  actionKey?: number;
  /** Góc (rad) quay đầu/ngực thêm so với thân khi ngồi, để Shinku dõi theo người chơi mà không rời ghế. */
  headYaw?: number;
};

const DEALER_SEAT_HIP_WORLD_Y = 0.84;
/** Thời gian hòa trộn khi Hinata đổi động tác (chào → đứng → hôn), tránh giật pose giữa hai clip. */
const HINATA_CROSSFADE_SECONDS = 0.35;
const X_AXIS = new Vector3(1, 0, 0);
const DEALER_SEAT_ANKLE_WORLD_Y = 0.24;

/** Giải IK và biểu cảm cho từng NPC Kohaku trên cả hai chuẩn VRM 0.x và VRM 1.0. */
export function createKohakuNpcMotion(vrm: VRM, id: KohakuNpcId, clips?: HinataMotionClips) {
  const h = vrm.humanoid;
  const hips = h.getNormalizedBoneNode('hips')!;
  const legs = (['left', 'right'] as const).map(side => {
    const upper = h.getNormalizedBoneNode(`${side}UpperLeg`)!;
    const lower = h.getNormalizedBoneNode(`${side}LowerLeg`)!;
    const foot = h.getNormalizedBoneNode(`${side}Foot`)!;
    return {
      foot,
      solve: createTwoBoneIK(upper, lower, foot),
      anchor: new Vector3(),
      rotation: new Quaternion(),
    };
  });
  const arms = (['left', 'right'] as const).map(side => {
    const upper = h.getNormalizedBoneNode(`${side}UpperArm`)!;
    const lower = h.getNormalizedBoneNode(`${side}LowerArm`)!;
    const hand = h.getNormalizedBoneNode(`${side}Hand`)!;
    return {
      upper,
      lower,
      hand,
      solve: createTwoBoneIK(upper, lower, hand),
    };
  });

  const forward = new Vector3();
  const leftVec = new Vector3();
  const kneePole = new Vector3();
  const elbowPole = new Vector3();
  const shoulder = new Vector3();
  const elbow = new Vector3();
  const handPos = new Vector3();
  const outward = new Vector3();
  const goal = new Vector3();
  const scale = new Vector3();
  const hipWorld = new Vector3();
  const footWorld = new Vector3();
  const footQuat = new Quaternion();

  const phaseOffset = id === 'shinku' ? 0 : id === 'hinata' ? 1.8 : 3.4;
  const vrm0Sign = vrm.meta?.metaVersion === '0' ? -1 : 1;
  let initialized = false;
  let standingSceneY = 0;
  let ankle = 0;
  let lastMode: HinataActionMode | null = null;
  let lastActionKey = -1;
  let actionElapsed = 0;
  // Ảnh chụp pose frame trước lúc đổi động tác; nội suy từ đó sang clip mới trong HINATA_CROSSFADE_SECONDS.
  const humanBones = Object.keys(h.humanBones) as (keyof typeof h.humanBones)[];
  const fadeFrom = new Map<string, Quaternion>();
  const fadeHips = new Vector3();
  let fadeElapsed = HINATA_CROSSFADE_SECONDS;
  const breath = new Quaternion();
  // Làm mượt để đầu quay dần khi đổi lượt thay vì giật sang ghế khác.
  let headYaw = 0;

  return {
    update(seconds: number, delta: number, options: KohakuNpcPoseOptions = {}) {
      const dt = MathUtils.clamp(delta, 0, 0.05);
      const lookYaw = options.lookYaw ?? 0;
      const seated = options.seated ?? false;

      if (id === 'hinata') {
        const mode: HinataActionMode = options.hinataMode ?? 'idle';
        const actionKey = options.actionKey ?? 0;
        if (mode !== lastMode || actionKey !== lastActionKey) {
          actionElapsed = 0;
          // Xương vẫn giữ pose frame trước (chưa reset) nên chụp ngay tại đây.
          if (initialized) {
            for (const name of humanBones) {
              const node = h.getNormalizedBoneNode(name);
              if (node) fadeFrom.set(name, (fadeFrom.get(name) ?? new Quaternion()).copy(node.quaternion));
            }
            fadeHips.copy(hips.position);
            fadeElapsed = 0;
          }
        } else {
          actionElapsed += dt;
        }
        fadeElapsed += dt;
        lastMode = mode;
        lastActionKey = actionKey;
      }

      if (!initialized) {
        h.resetNormalizedPose();
        vrm.scene.updateWorldMatrix(true, true);
        ankle = alignVrmSoles(vrm, 0);
        standingSceneY = vrm.scene.position.y;
      }

      h.resetNormalizedPose();
      // Khi ngồi ghế Dealer cần giữ nguyên cao độ gốc của mô hình để mặt đệm 0.76m khớp chính xác.
      if (seated) {
        vrm.scene.position.y = standingSceneY;
      }
      vrm.scene.updateWorldMatrix(true, true);

      const t = seconds + phaseOffset;
      const blinkCycle = (t % 4.3) - 4.05;
      const blink = Math.max(0, 1 - Math.abs(blinkCycle) / 0.1);

      if (id === 'hinata') {
        const mode: HinataActionMode = options.hinataMode ?? 'idle';
        const activeClip = mode === 'kiss' && clips?.kiss ? clips.kiss : clips?.bow;
        if (activeClip) {
          // Clip chào/hôn chạy đúng MỘT lần rồi dừng ở khung đầu: clip 'natural' đã nối vòng nên khung cuối trùng khung
          // đầu (tư thế đứng), giữ khung 0 không bị giật và Hinata không cúi chào lặp đi lặp lại.
          const elapsed = options.actionElapsed ?? actionElapsed;
          const playing = mode !== 'idle' && elapsed < activeClip.duration;
          const clipTime = playing ? elapsed : 0;
          activeClip.update(clipTime, 0, clipTime);
          if (!playing) {
            // Đứng chờ: chỉ thở nhẹ ở ngực, đầu giữ yên (không gật).
            h.getNormalizedBoneNode('chest')?.quaternion.multiply(breath.setFromAxisAngle(X_AXIS, 0.012 * Math.sin(t * 1.65) * vrm0Sign));
          }
          if (fadeElapsed < HINATA_CROSSFADE_SECONDS) {
            const x = fadeElapsed / HINATA_CROSSFADE_SECONDS, w = x * x * (3 - 2 * x);
            for (const name of humanBones) {
              const node = h.getNormalizedBoneNode(name), from = fadeFrom.get(name);
              if (node && from) node.quaternion.copy(breath.copy(from).slerp(node.quaternion, w));
            }
            hips.position.lerpVectors(fadeHips, hips.position, w);
          }
          vrm.expressionManager?.setValue('blink', blink);
          vrm.expressionManager?.setValue('happy', mode === 'kiss' ? 0.85 : 0.48);
          vrm.expressionManager?.setValue('relaxed', mode === 'kiss' ? 0.35 : 0.25);
          updateDanceRig(vrm, dt, ankle, !initialized);
          initialized = true;
          return;
        }
      }

      const breathe = Math.sin(t * 1.65);
      const sway = Math.sin(t * 0.95);

      forward.set(Math.sin(lookYaw), 0, Math.cos(lookYaw)).normalize();
      // Khi yaw = 0 (nhìn về +Z), +X là hướng bên trái của nhân vật.
      leftVec.set(forward.z, 0, -forward.x).normalize();

      hips.parent!.getWorldScale(scale);

      if (seated) {
        hips.getWorldPosition(hipWorld);
        // Hạ hông về đúng cao độ mặt đệm ghế da Poker (y = 0.76m) kèm nhịp thở nhẹ.
        hips.position.y += (DEALER_SEAT_HIP_WORLD_Y + 0.004 * breathe - hipWorld.y) / scale.y;
        hips.rotation.set(0.05 * vrm0Sign, 0.03 * sway, 0);

        h.getNormalizedBoneNode('spine')?.rotation.set((0.06 + 0.015 * breathe) * vrm0Sign, -0.025 * sway, 0);
        headYaw += ((options.headYaw ?? 0) - headYaw) * (1 - Math.exp(-6 * dt));
        h.getNormalizedBoneNode('chest')?.rotation.set(0.03 * breathe * vrm0Sign, 0.03 * sway + 0.3 * headYaw, 0);
        h.getNormalizedBoneNode('head')?.rotation.set(-0.04 * breathe * vrm0Sign, 0.08 * Math.sin(t * 0.6) + 0.7 * headYaw, 0);
        vrm.scene.updateWorldMatrix(true, true);

        legs.forEach((leg, i) => {
          const hipNode = h.getNormalizedBoneNode(i === 0 ? 'leftUpperLeg' : 'rightUpperLeg')!;
          hipNode.getWorldPosition(hipWorld);
          const footY = leg.foot.getWorldPosition(footWorld).y;
          // Ghi nhận hướng bàn chân hướng thẳng về phía bàn Poker khi ngồi.
          leg.foot.getWorldQuaternion(footQuat);
          goal
            .copy(hipWorld)
            .addScaledVector(forward, 0.34)
            .addScaledVector(leftVec, i === 0 ? 0.035 : -0.035);
          goal.y = Math.min(DEALER_SEAT_ANKLE_WORLD_Y, Math.max(0.14, footY + 0.14));
          kneePole.copy(forward).add(new Vector3(0, 0.35, 0)).normalize();
          leg.solve(goal, kneePole, footQuat);
        });

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

          const dealPulse = i === 1 ? 0.025 * Math.sin(t * 2.1) : 0;
          goal
            .copy(shoulder)
            .addScaledVector(forward, 0.27 + dealPulse)
            .addScaledVector(outward, -0.04);
          goal.y = Math.max(1.01, shoulder.y - Math.min(length * 0.68, 0.34));
          elbowPole.copy(forward).negate().addScaledVector(outward, 0.55).normalize();
          arm.solve(goal, elbowPole);
        });
      } else {
        legs.forEach(leg => {
          leg.foot.getWorldPosition(leg.anchor);
          leg.foot.getWorldQuaternion(leg.rotation);
        });

        hips.position.x += (0.018 * sway * vrm0Sign) / scale.x;
        hips.position.y -= (0.018 + 0.004 * (1 + breathe)) / scale.y;
        hips.rotation.set(0.015 * breathe * vrm0Sign, 0.045 * sway, 0.035 * sway * vrm0Sign);

        h.getNormalizedBoneNode('spine')?.rotation.set((0.02 + 0.018 * breathe) * vrm0Sign, -0.035 * sway, -0.025 * sway * vrm0Sign);
        h.getNormalizedBoneNode('chest')?.rotation.set(0.018 * breathe * vrm0Sign, 0.03 * Math.cos(t * 0.9), 0);
        h.getNormalizedBoneNode('head')?.rotation.set(
          (id === 'hinata' ? -0.04 : 0.02) * Math.sin(t * 1.1) * vrm0Sign,
          0.06 * Math.sin(t * 0.6),
          0.025 * sway * vrm0Sign,
        );
        vrm.scene.updateWorldMatrix(true, true);

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

          if (id === 'hinata') {
            // Vẫy tay mời chào thanh lịch ở thảm đỏ đón khách vào Kohaku Club.
            const wave = i === 1 ? 0.5 + 0.5 * Math.sin(t * 2.2) : 0;
            const fwdOffset = i === 0 ? 0.10 : 0.22 + 0.06 * wave;
            const outOffset = i === 0 ? -0.04 : 0.14 + 0.07 * Math.sin(t * 3.8);
            const downOffset = MathUtils.clamp(length * (i === 0 ? 0.72 : 0.34 - 0.10 * wave), 0.08, length * 0.9);
            goal.copy(shoulder).addScaledVector(forward, fwdOffset).addScaledVector(outward, outOffset);
            goal.y -= downOffset;
          } else if (id === 'bartender') {
            // Tư thế Bartender đặt hai tay sẵn sàng pha chế & rót đồ uống trên mặt quầy bar.
            const mixOffset = i === 1 ? 0.04 * Math.sin(t * 2.4) : -0.02 * Math.sin(t * 1.6);
            goal
              .copy(shoulder)
              .addScaledVector(forward, 0.25 + mixOffset)
              .addScaledVector(outward, i === 0 ? -0.02 : 0.03);
            goal.y -= MathUtils.clamp(length * (i === 0 ? 0.56 : 0.48), 0.12, length * 0.85);
          } else {
            // Shinku đứng thanh lịch cạnh bàn Poker, hai tay đan nhẹ hoặc ra hiệu chào bàn chơi.
            const gesture = i === 1 ? 0.5 + 0.5 * Math.sin(t * 1.2) : 0;
            goal
              .copy(shoulder)
              .addScaledVector(forward, i === 0 ? 0.12 : 0.22)
              .addScaledVector(outward, i === 0 ? -0.06 : 0.04 * gesture);
            goal.y -= MathUtils.clamp(length * (i === 0 ? 0.70 : 0.56 - 0.08 * gesture), 0.12, length * 0.9);
          }
          elbowPole.copy(forward).negate().addScaledVector(outward, 0.52).normalize();
          arm.solve(goal, elbowPole);
        });
      }

      for (const side of ['left', 'right'] as const) {
        for (const finger of ['Index', 'Middle', 'Ring', 'Little'] as const) {
          const node = h.getNormalizedBoneNode(`${side}${finger}Proximal`);
          if (node) node.rotation.z = side === 'left' ? -0.14 : 0.14;
        }
      }

      vrm.expressionManager?.setValue('blink', blink);
      vrm.expressionManager?.setValue('happy', id === 'hinata' ? 0.5 : 0.28);
      vrm.expressionManager?.setValue('relaxed', 0.22);

      if (seated) {
        applyVrmPose(vrm);
        updateSpringBones(vrm, dt);
        vrm.scene.updateMatrixWorld(true);
      } else {
        updateDanceRig(vrm, dt, ankle, !initialized);
      }
      initialized = true;
    },
  };
}
