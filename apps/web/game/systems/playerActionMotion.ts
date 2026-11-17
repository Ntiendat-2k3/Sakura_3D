/**
 * Động tác một lần ngoài phố Sakura chồng lên animation nền của người chơi: ra đòn Cross Punch, trúng đòn Reaction Hit,
 * và hôn khi đang ngồi ghế đá (chỉ thân trên của Kiss_player để chân giữ tư thế Sit).
 */
import { Quaternion, Vector3, type AnimationClip, type Object3D } from 'three';
import { STREET_SOCIAL_TIMING } from '@metaverse/game-protocol';
import { loadClubMotion } from './retargetClubMotion';
import { retargetSkeletonMotion } from './retargetSkeletonMotion';
import { createMotionOverlay, type OverlaySample } from './playerMotionOverlay';
import { PLAYER_BONE_MAPPING, PLAYER_KISS_MOTION } from './playerKissMotion';
import { PUNCH_IMPACT_SECONDS } from './gekkaNpcMotion';

export type PlayerActionKind = 'punch' | 'hit' | 'seatKiss';
/**
 * startAt theo performance.now (ms). Khi hôn trên ghế: twist/lean là xoắn/nghiêng thân trên về phía bạn (radian),
 * slideX/slideZ là quãng hông nhích sát lại theo hệ thế giới (m). Gốc avatar vẫn ở ghế, chỉ phần hiển thị dịch.
 */
export type PlayerActionCue = { kind: PlayerActionKind; startAt: number; twist?: number; lean?: number; slideX?: number; slideZ?: number };

/**
 * Hôn trên ghế: chân và hông giữ hướng ngồi, chỉ thân trên chuyển động để đùi hai người không đâm xuyên nhau.
 * twist: xoắn quanh trục đứng (radian); lean: nghiêng ngang quanh trục hướng mặt, dấu dương ngả về forward × up.
 * Mỗi góc chia dần lên cột sống theo [tên xương, phần twist, phần lean].
 */
const SPINE_SHARE: [string, number, number][] = [['Spine', 0.25, 0.4], ['Spine1', 0.25, 0.35], ['Spine2', 0.25, 0.25], ['Neck', 0.15, 0], ['Head', 0.1, 0]];

const PUNCH_LEAD = STREET_SOCIAL_TIMING.punchImpactMs / 1000;
/** Mỗi động tác: clip nguồn, khung bắt đầu trong clip, thời lượng phát và thời gian hòa vào/ra (giây). */
export const PLAYER_ACTIONS: Record<PlayerActionKind, { clip: string; from: number; duration: number; fadeIn: number; fadeOut: number; upperBody?: boolean }> = {
  // Bắt đầu từ lúc lấy đà để nắm tay duỗi thẳng nhất đúng lúc server đẩy người kia lùi lại.
  punch: { clip: 'Cross Punch', from: PUNCH_IMPACT_SECONDS - PUNCH_LEAD, duration: PUNCH_LEAD + 0.45, fadeIn: 0.12, fadeOut: 0.2 },
  hit: { clip: 'Reaction Hit', from: 0.18, duration: 1.2, fadeIn: 0.06, fadeOut: 0.35 },
  seatKiss: { clip: PLAYER_KISS_MOTION, from: 0, duration: STREET_SOCIAL_TIMING.kissMs / 1000, fadeIn: 0.3, fadeOut: 0.4, upperBody: true },
};
const KINDS = Object.keys(PLAYER_ACTIONS) as PlayerActionKind[];

const smooth = (x: number) => { const t = Math.min(Math.max(x, 0), 1); return t * t * (3 - 2 * t); };

/** Khung clip và trọng số tại thời điểm nowMs; null khi chưa tới hoặc đã xong. Thuần để test không cần rig. */
export function samplePlayerAction(cue: PlayerActionCue | null | undefined, nowMs: number) {
  if (!cue) return null;
  const action = PLAYER_ACTIONS[cue.kind], seconds = (nowMs - cue.startAt) / 1000;
  if (seconds < 0 || seconds >= action.duration) return null;
  return {
    clip: KINDS.indexOf(cue.kind),
    time: action.from + seconds,
    weight: Math.min(smooth(seconds / action.fadeIn), smooth((action.duration - seconds) / action.fadeOut)),
  };
}

const LOWER_BODY = /^(Hips|(Left|Right)(UpLeg|Leg|Foot|ToeBase))\./;

export type PlayerActionMotion = { apply(cue: PlayerActionCue | null | undefined, nowMs: number): void };

export async function loadPlayerActionMotion(scene: Object3D): Promise<PlayerActionMotion> {
  const motions = await Promise.all(KINDS.map(kind => loadClubMotion(PLAYER_ACTIONS[kind].clip)));
  const clips = motions.map((motion, index) => {
    const clip: AnimationClip = retargetSkeletonMotion(motion, scene, PLAYER_BONE_MAPPING, { name: KINDS[index], overlap: 0.01 });
    // Hôn khi ngồi: bỏ hông và chân để thân trên nghiêng sang mà mông vẫn ngồi trên ghế.
    if (PLAYER_ACTIONS[KINDS[index]].upperBody) clip.tracks = clip.tracks.filter(track => !LOWER_BODY.test(track.name));
    return clip;
  });
  const overlay = createMotionOverlay(scene, clips);
  const twists = SPINE_SHARE.flatMap(([name, share, leanShare]) => {
    const node = scene.getObjectByName(name);
    return node?.parent ? [{ node, share, leanShare, before: new Quaternion(), after: new Quaternion(), active: false }] : [];
  });
  const up = new Vector3(0, 1, 0), forward = new Vector3(), parentWorld = new Quaternion(), turn = new Quaternion(), tilt = new Quaternion();
  return {
    apply(cue, nowMs) {
      // Gỡ phần xoắn frame trước TRƯỚC khi lớp chồng clip tự khôi phục: lớp đó so xương với kết quả của chính nó.
      for (const twist of [...twists].reverse()) {
        if (twist.active && twist.node.quaternion.equals(twist.after)) twist.node.quaternion.copy(twist.before);
        twist.active = false;
      }
      // Gọi cả khi không có động tác để trả xương về nền.
      const sample = samplePlayerAction(cue, nowMs);
      overlay.apply(sample ? [{ clip: sample.clip, time: sample.time, weight: 1 } satisfies OverlaySample] : [], sample?.weight ?? 0);
      const angle = (cue?.twist ?? 0) * (sample?.weight ?? 0), lean = (cue?.lean ?? 0) * (sample?.weight ?? 0);
      if (!sample || (angle === 0 && lean === 0)) return;
      // Trục nghiêng = hướng mặt của người ngồi (gốc avatar chỉ xoay quanh trục đứng).
      scene.getWorldDirection(forward).setY(0).normalize();
      for (const twist of twists) {
        // Quay quanh trục thế giới rồi đổi sang hệ cha của xương: q' = P⁻¹ · R · P · q.
        twist.node.parent!.getWorldQuaternion(parentWorld);
        turn.setFromAxisAngle(up, angle * twist.share).multiply(tilt.setFromAxisAngle(forward, lean * twist.leanShare));
        twist.before.copy(twist.node.quaternion);
        twist.node.quaternion.premultiply(parentWorld.clone().invert().multiply(turn).multiply(parentWorld));
        twist.after.copy(twist.node.quaternion);
        twist.active = true;
      }
    },
  };
}
