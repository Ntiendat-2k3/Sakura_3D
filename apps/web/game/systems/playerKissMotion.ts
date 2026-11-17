/** Clip hôn Kiss_player (Mixamo) retarget lúc chạy lên rig GLB người chơi, phát một lần chồng lên animation nền. */
import type { Object3D } from 'three';
import { loadClubMotion } from './retargetClubMotion';
import { retargetSkeletonMotion } from './retargetSkeletonMotion';
import { createMotionOverlay } from './playerMotionOverlay';

export const PLAYER_KISS_MOTION = 'Kiss_player';

/** Rig người chơi dùng tên xương Mixamo không tiền tố (cùng bảng với scripts/bake-player-flair.ts). */
export const PLAYER_BONE_MAPPING: Record<string, string> = Object.fromEntries(['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head'].map(name => [name, name]));
for (const side of ['Left', 'Right']) {
  for (const name of ['Shoulder', 'Arm', 'ForeArm', 'Hand', 'UpLeg', 'Leg', 'Foot', 'ToeBase']) PLAYER_BONE_MAPPING[side + name] = side + name;
  for (const finger of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) for (let n = 1; n <= 3; n++) PLAYER_BONE_MAPPING[`${side}Hand${finger}${n}`] = `${side}Hand${finger}${n}`;
}

export type PlayerKissMotion = {
  /** Độ dài clip (giây). */
  duration: number;
  /** Gọi SAU khi mixer nền đã chạy trong frame. weight 0 trả các xương về giá trị nền rồi thôi tác động. */
  apply(seconds: number, weight: number): void;
};

export async function loadPlayerKissMotion(scene: Object3D): Promise<PlayerKissMotion> {
  const motion = await loadClubMotion(PLAYER_KISS_MOTION);
  const clip = retargetSkeletonMotion(motion, scene, PLAYER_BONE_MAPPING, { name: PLAYER_KISS_MOTION, overlap: 0.08 });
  const overlay = createMotionOverlay(scene, [clip]);
  return { duration: clip.duration, apply: (seconds, weight) => overlay.apply([{ clip: 0, time: seconds, weight: 1 }], weight) };
}
