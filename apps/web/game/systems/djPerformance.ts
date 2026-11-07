/** Diễn hoạt DJ tại chỗ: tay chạm mâm xoay/mixer bằng IK, chân trụ cố định và gật đầu theo nhịp. */
import { MathUtils, Quaternion, Vector3 } from 'three';
import type { VRM } from '@pixiv/three-vrm';
import { CLUB_DJ_LAYOUT as layout } from '@metaverse/game-protocol';
import { alignVrmSoles, createTwoBoneIK } from './hostLocomotion';
import { updateDanceRig } from './retargetClubMotion';

/** Đợi frame đầu sau khi gắn rig lên sân khấu mới đo giày/neo chân; mục tiêu hai tay là tọa độ world của controls. */
export function createDjPerformance(vrm: VRM, floorY: number) {
  const h = vrm.humanoid, hips = h.getNormalizedBoneNode('hips')!;
  const legs = (['left', 'right'] as const).map(side => {
    const upper = h.getNormalizedBoneNode(`${side}UpperLeg`)!, lower = h.getNormalizedBoneNode(`${side}LowerLeg`)!, foot = h.getNormalizedBoneNode(`${side}Foot`)!;
    return { foot, solve: createTwoBoneIK(upper, lower, foot), anchor: new Vector3(), rotation: new Quaternion() };
  });
  const arms = (['left', 'right'] as const).map(side => {
    const upper = h.getNormalizedBoneNode(`${side}UpperArm`)!, lower = h.getNormalizedBoneNode(`${side}LowerArm`)!, hand = h.getNormalizedBoneNode(`${side}Hand`)!;
    return { upper, hand, target: new Vector3(), solve: createTwoBoneIK(upper, lower, hand) };
  });
  const pole = new Vector3(), point = new Vector3(), scale = new Vector3();
  let initialized = false, ankle = 0;
  return {
    arms, legs,
    update(seconds: number, delta: number, beat = seconds * 140 / 60) {
      h.resetNormalizedPose(); vrm.scene.updateWorldMatrix(true, true);
      if (!initialized) {
        ankle = alignVrmSoles(vrm, floorY);
        legs.forEach(leg => { leg.foot.getWorldPosition(leg.anchor); leg.foot.getWorldQuaternion(leg.rotation); });
      }
      hips.parent!.getWorldScale(scale);
      const nod = Math.sin(beat * Math.PI), breathe = Math.sin(seconds * 1.7);
      hips.position.y -= (.024 + .006 * (1 + nod)) / scale.y;
      h.getNormalizedBoneNode('spine')?.rotation.set(-.07 + .015 * breathe, .025 * Math.sin(beat * Math.PI / 8), 0);
      h.getNormalizedBoneNode('chest')?.rotation.set(-.025, .015 * Math.sin(seconds), 0);
      h.getNormalizedBoneNode('head')?.rotation.set(-.09 + .035 * nod, .1 * Math.sin(beat * Math.PI / 16), .02 * breathe);
      vrm.scene.updateWorldMatrix(true, true);
      legs.forEach(leg => leg.solve(leg.anchor, pole.set(0, 0, 1), leg.rotation));
      // Tay trái xoay nhẹ trên platter; tay phải đổi giữa fader và núm chỉnh, không vẫy tay khỏi bàn.
      const switcher = .5 - .5 * Math.cos(beat * Math.PI / 8), scratch = Math.sin(beat * Math.PI / 2);
      arms[0].target.fromArray(layout.leftHand).add(point.set(.025 * scratch, .006 * breathe, .018 * Math.cos(beat * Math.PI / 2)));
      arms[1].target.fromArray(layout.rightHand).add(point.set(-.2 * switcher, .008 * (1 + nod), .025 * Math.sin(seconds * .7)));
      arms.forEach((arm, i) => {
        pole.set(i === 0 ? 1 : -1, -.1, -.15).normalize(); arm.solve(arm.target, pole);
        arm.hand.rotation.x += .08 * scratch;
      });
      for (const side of ['left', 'right'] as const) for (const finger of ['Index', 'Middle', 'Ring', 'Little'] as const) {
        const node = h.getNormalizedBoneNode(`${side}${finger}Proximal`); if (node) node.rotation.z = side === 'left' ? -.13 : .13;
      }
      vrm.expressionManager?.setValue('blink', Math.max(0, 1 - Math.abs(seconds % 4.7 - 4.4) / .1));
      updateDanceRig(vrm, MathUtils.clamp(delta, 0, .05), floorY + ankle, !initialized);
      initialized = true;
    },
  };
}
