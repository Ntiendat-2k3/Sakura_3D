import { type VRM, type VRMHumanBoneName } from '@pixiv/three-vrm';
import type { Object3D } from 'three';

/** Vòng nhảy club nguyên bản, điều khiển rig chuẩn hóa; pha lấy từ epoch room, không tính theo lúc tải model. */
export function createClubDance(vrm: VRM) {
  const names = ['hips', 'spine', 'chest', 'neck', 'head', 'leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm', 'leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg'] as const;
  const bones = new Map<VRMHumanBoneName, Object3D>();
  for (const name of names) {
    const bone = vrm.humanoid.getNormalizedBoneNode(name);
    if (bone) bones.set(name, bone);
  }
  const hips = bones.get('hips');
  const rest = hips?.position.clone();
  const rotate = (name: VRMHumanBoneName, x: number, y: number, z: number) => bones.get(name)?.rotation.set(x, y, z);
  return (seconds: number, offset: number) => {
    const beat = seconds * Math.PI * 2 * (112 / 60) / 2 + offset;
    const sway = Math.sin(beat), pulse = Math.cos(beat * 2), turn = Math.sin(beat / 2);
    rotate('hips', .035 * pulse, .13 * turn, .1 * sway);
    if (hips && rest) hips.position.set(rest.x + .045 * sway, rest.y - .018 + .018 * pulse, rest.z);
    rotate('spine', .035, -.09 * turn, -.06 * sway);
    rotate('chest', -.025, .14 * turn, -.055 * sway);
    rotate('neck', .02, -.08 * turn, .02 * sway);
    rotate('head', .03 * pulse, .1 * turn, .035 * sway);
    const lift = .5 + .5 * Math.sin(beat / 2);
    rotate('leftUpperArm', -.3 - .2 * turn, .12, -.9 + .65 * lift);
    rotate('rightUpperArm', -.3 + .2 * turn, -.12, .9 - .65 * (1 - lift));
    rotate('leftLowerArm', -.25, -.2 - .4 * lift, -.35);
    rotate('rightLowerArm', -.25, .2 + .4 * (1 - lift), .35);
    rotate('leftUpperLeg', -.04 - .05 * pulse, .03, -.025 * sway);
    rotate('rightUpperLeg', -.04 + .05 * pulse, -.03, -.025 * sway);
    rotate('leftLowerLeg', .07 + .05 * pulse, 0, 0);
    rotate('rightLowerLeg', .07 - .05 * pulse, 0, 0);
  };
}
