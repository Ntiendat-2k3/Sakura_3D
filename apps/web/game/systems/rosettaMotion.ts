/** Chuyển động chào khách cố định trước cửa và retarget mocap có sẵn sang rest pose rig Rosetta. */
import { AnimationClip, type Object3D } from 'three';
import { loadClubMotion } from './retargetClubMotion';
import { retargetSkeletonMotion } from './retargetSkeletonMotion';
import choreography from '../scenes/club-choreography.json';

export type RosettaMode = 'greeting' | 'dialogue' | 'dancing';
const danceClips = new WeakMap<Object3D, Promise<AnimationClip>>();
export const ROSETTA_BONE_MAPPING: Record<string, string> = { Hips: 'Hips', Spine: 'Spine', Spine1: 'Chest', Neck: 'Neck', Head: 'Head', LeftShoulder: 'Shoulder.L', RightShoulder: 'Shoulder.R', LeftArm: 'Upper Arm.L', RightArm: 'Upper Arm.R', LeftForeArm: 'Lower Arm.L', RightForeArm: 'Lower Arm.R', LeftHand: 'Hand.L', RightHand: 'Hand.R', LeftUpLeg: 'Upper Leg.L', RightUpLeg: 'Upper Leg.R', LeftLeg: 'Lower Leg.L', RightLeg: 'Lower Leg.R', LeftFoot: 'Foot.L', RightFoot: 'Foot.R', LeftToeBase: 'Toe.L', RightToeBase: 'Toe.R' };
for (const [side, suffix] of [['Left', 'L'], ['Right', 'R']]) for (const [source, target] of [['Thumb', 'Thumb'], ['Index', 'Index'], ['Middle', 'Middle'], ['Ring', 'Ring'], ['Pinky', 'Little']]) {
  ['Proximal', 'Intermidiate', 'Distal'].forEach((part, index) => { ROSETTA_BONE_MAPPING[`${side}Hand${source}${index + 1}`] = `${target} ${target === 'Little' && index === 0 ? 'proximal' : part}.${suffix}`; });
}

/** Khoảng cách lấy từ vị trí đứng cố định của NPC để giới hạn tương tác và quay mặt chào khách. */
export function canTalkToRosetta(player: { x: number; z: number } | undefined, npc: { x: number; z: number }) {
  return !!player && Number.isFinite(player.x) && Number.isFinite(player.z) && Math.hypot(player.x - npc.x, player.z - npc.z) <= 2;
}

/** Vẫy trong nửa đầu chu kỳ, chuyển dáng ở giây 3 rồi hạ chân/vẫy lại ở giây 6. */
export function getRosettaPoseWeight(seconds: number) {
  const phase = ((seconds % 6) + 6) % 6;
  const ease = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
  return phase < 3 ? ease((phase - 2.3) / .7) : 1 - ease((phase - 5.3) / .7);
}

const waves = new WeakMap<Object3D, Promise<AnimationClip>>();
export function loadRosettaWave(scene: Object3D) {
  let clip = waves.get(scene);
  if (!clip) { clip = loadClubMotion('Rosetta_Wave').then(motion => retargetSkeletonMotion(motion, scene, ROSETTA_BONE_MAPPING, { name: `Rosetta_${motion.id}` })).catch(error => { waves.delete(scene); throw error; }); waves.set(scene, clip); }
  return clip;
}

export function loadRosettaDance(scene: Object3D) {
  let clip = danceClips.get(scene);
  if (!clip) {
    clip = loadClubMotion(choreography.ROSETTA[0]).then(motion => retargetSkeletonMotion(motion, scene, ROSETTA_BONE_MAPPING, { name: `Rosetta_${motion.id}` })).catch(error => { danceClips.delete(scene); throw error; });
    danceClips.set(scene, clip);
  }
  return clip;
}
