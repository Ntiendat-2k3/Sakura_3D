/**
 * Ghép 3 clip Mixamo cho cú nhảy ban công Kohaku: Jumping Down (nhún, bật) → Falling Idle (rơi, lặp) → Falling To Landing.
 * Vị trí do quỹ đạo dùng chung trong game-protocol quyết định; clip chỉ tạo dáng người, root motion ngang bị bỏ.
 */
import { Vector3, type Object3D } from 'three';
import { KOHAKU_JUMP_TIMING, kohakuJumpAirSeconds, kohakuJumpDuration, type KohakuJumpSpot } from '@metaverse/game-protocol';
import { loadClubMotion, type Motion } from './retargetClubMotion';
import { retargetSkeletonMotion } from './retargetSkeletonMotion';
import { createMotionOverlay, type OverlaySample } from './playerMotionOverlay';
import { PLAYER_BONE_MAPPING } from './playerKissMotion';

export const JUMP_CLIPS = { takeoff: 0, fall: 1, land: 2 } as const;
const MOTION_IDS = ['Jumping Down', 'Falling Idle', 'Falling To Landing'] as const;

/** Đoạn dùng trong "Jumping Down" (giây clip): từ lúc nhún tới khi đã rời mép, trước phần rơi có root motion. */
const TAKEOFF_CLIP = { from: 0.35, to: 1.35 } as const;
/** "Falling To Landing" chạm đất ở ~0.3 s clip; bắt đầu sớm chừng đó để cú khuỵu khớp lúc chân chạm sàn. */
const LAND_IMPACT_SECONDS = 0.3;
const BLEND_IN_SECONDS = 0.15;
const BLEND_OUT_SECONDS = 0.25;
const GROUND_RELEASE_SECONDS = 0.2;

const smooth = (x: number) => { const t = Math.min(Math.max(x, 0), 1); return t * t * (3 - 2 * t); };

/** Trọng số từng clip theo thời gian kể từ lúc bắt đầu nhảy; thuần để test được không cần rig. */
export function kohakuJumpBlend(spot: KohakuJumpSpot, seconds: number, durations: readonly number[]): { weight: number; samples: OverlaySample[] } {
  const prep = KOHAKU_JUMP_TIMING.prepSeconds, air = kohakuJumpAirSeconds(spot), total = kohakuJumpDuration(spot);
  if (seconds < 0 || seconds >= total) return { weight: 0, samples: [] };
  const takeoffSpan = prep + 0.35;
  const landStart = prep + air - LAND_IMPACT_SECONDS;
  const landWeight = smooth((seconds - landStart) / 0.15);
  const takeoffWeight = (1 - smooth((seconds - (prep + 0.15)) / 0.3)) * (1 - landWeight);
  const fallWeight = Math.max(0, 1 - takeoffWeight - landWeight);
  const fallDuration = durations[JUMP_CLIPS.fall];
  return {
    weight: Math.min(smooth(seconds / BLEND_IN_SECONDS), smooth((total - seconds) / BLEND_OUT_SECONDS)),
    samples: [
      { clip: JUMP_CLIPS.takeoff, time: TAKEOFF_CLIP.from + Math.min(seconds / takeoffSpan, 1) * (TAKEOFF_CLIP.to - TAKEOFF_CLIP.from), weight: takeoffWeight },
      { clip: JUMP_CLIPS.fall, time: fallDuration > 0 ? seconds % fallDuration : 0, weight: fallWeight },
      // Chừa đuôi clip: retarget nối vòng đầu/cuối nên khung cuối cùng là pose đầu clip (đang trên không).
      { clip: JUMP_CLIPS.land, time: Math.min(seconds - landStart, durations[JUMP_CLIPS.land] - 0.02), weight: landWeight },
    ],
  };
}

/** "Jumping Down" bắt đầu đứng trên bục ~1 m: neo hông khung đầu về tư thế đứng để lúc nhún không bị nhấc lên không trung. */
function anchorHipsToFirstFrame(motion: Motion): Motion {
  const rest = motion.bones.mixamorigHips?.position[1];
  const index = motion.tracks.findIndex(track => track.name === 'mixamorigHips.position');
  if (rest === undefined || index < 0) return motion;
  const track = motion.tracks[index], shift = rest - track.values[1];
  const values = track.values.map((value, i) => (i % 3 === 1 ? value + shift : value));
  return { ...motion, tracks: motion.tracks.map((item, i) => (i === index ? { ...track, values } : item)) };
}

export type PlayerJumpMotion = { apply(spot: KohakuJumpSpot | undefined, seconds: number): void };

export async function loadPlayerJumpMotion(scene: Object3D): Promise<PlayerJumpMotion> {
  const [takeoff, fall, land] = await Promise.all(MOTION_IDS.map(id => loadClubMotion(id)));
  const clips = [
    retargetSkeletonMotion(anchorHipsToFirstFrame(takeoff), scene, PLAYER_BONE_MAPPING, { name: MOTION_IDS[0], overlap: 0.01, hipsLimit: 0.12 }),
    retargetSkeletonMotion(fall, scene, PLAYER_BONE_MAPPING, { name: MOTION_IDS[1], overlap: 0.2 }),
    retargetSkeletonMotion(land, scene, PLAYER_BONE_MAPPING, { name: MOTION_IDS[2], overlap: 0.01 }),
  ];
  const overlay = createMotionOverlay(scene, clips);
  const toes = ['LeftToeBase', 'RightToeBase'].map(name => scene.getObjectByName(name)).filter(node => !!node);
  const baseY = scene.position.y, point = new Vector3();
  return {
    apply(spot, seconds) {
      // Gọi cả khi không nhảy để trả xương về nền sau cú nhảy.
      const blend = spot ? kohakuJumpBlend(spot, seconds, overlay.durations) : { weight: 0, samples: [] };
      overlay.apply(blend.samples, blend.weight);
      scene.position.y = baseY;
      // Lúc nhún lấy đà, gốc còn đứng trên sàn nhưng clip gốc nhún trên bục nên co chân lên 10–40 cm:
      // hạ cả model cho ngón chân thấp nhất chạm sàn (như WelcomeNpc). Khi bay/tiếp đất chân đã khớp quỹ đạo.
      // Sau khi rời đất nhả dần trong GROUND_RELEASE_SECONDS để thân không bật giật lên một cái.
      const prep = KOHAKU_JUMP_TIMING.prepSeconds;
      if (!spot || seconds >= prep + GROUND_RELEASE_SECONDS || !toes.length || !scene.parent) return;
      scene.updateMatrixWorld(true);
      const floor = scene.parent.getWorldPosition(point).y;
      const lowest = Math.min(...toes.map(toe => toe.getWorldPosition(point).y)) - floor;
      const hold = 1 - smooth((seconds - prep) / GROUND_RELEASE_SECONDS);
      if (lowest > 0) { scene.position.y = baseY - lowest * hold; scene.updateMatrixWorld(true); }
    },
  };
}
