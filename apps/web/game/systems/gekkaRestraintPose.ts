/**
 * Tư thế bị trói chữ A ở hầm 月華楼 cho rig GLB người chơi.
 * Tay chân bị khóa vào khung: hai tay dang chéo xuống (chữ A), hai chân dạng, giải bằng IK tới điểm cùm cố định.
 * Chỉ thân trên (Spine → Head) lấy chuyển động từ clip Mixamo: lắc lư choáng (Dizzy Idle) và giật khi trúng đòn
 * (Reaction Hit, cú cuối Big Hit To Head). Tay chân trong các clip đó bỏ đi vì bị trói thì không thể vung như vậy.
 */
import { Quaternion, Vector3, type Interpolant, type Object3D } from 'three';
import { createTwoBoneIK } from './hostLocomotion';
import { loadClubMotion } from './retargetClubMotion';
import { retargetSkeletonMotion } from './retargetSkeletonMotion';
import { PLAYER_BONE_MAPPING } from './playerKissMotion';
import type { GekkaRestraintCue } from './gekkaPokerView';

export const GEKKA_RESTRAINT_CLIPS = { idle: 'Dizzy Idle', light: 'Reaction Hit', heavy: 'Big Hit To Head' } as const;
export type { GekkaRestraintCue };

/** Góc tay dưới phương ngang (rad): ở khung chữ A dang rộng, ở vòng xích tường khép hơn để không chạm người bên cạnh. */
export const RESTRAINT_ARM_DROP = { post: 0.55, cell: 0.9 } as const;
/** Góc dạng chân so với phương thẳng đứng (rad). */
export const RESTRAINT_LEG_SPREAD = { post: 0.2, cell: 0.1 } as const;
const UPPER_BODY = ['Spine', 'Spine1', 'Spine2', 'Neck', 'Head'];
/** Bắt đầu clip trúng đòn sau khung này (giây) để cú giật đầu rơi đúng lúc server báo trúng. */
const HIT_CLIP_OFFSET = 0.18;
const HIT_FADE_IN = 0.06;
const HIT_FADE_OUT = 0.35;
const HIT_SNAP_BLEND = 0.12;
const POSE_BLEND_SECONDS = 0.6;

type Sampler = { duration: number; channels: Map<string, Interpolant> };
const sample = new Quaternion(), hitSample = new Quaternion(), worldPoint = new Vector3();
const smooth = (x: number) => { const t = Math.min(Math.max(x, 0), 1); return t * t * (3 - 2 * t); };

async function upperBodySampler(scene: Object3D, id: string, loop: boolean): Promise<Sampler> {
  const motion = await loadClubMotion(id);
  const clip = retargetSkeletonMotion(motion, scene, PLAYER_BONE_MAPPING, { name: `gekka-${id}`, overlap: loop ? 0.25 : 0.02 });
  const channels = new Map<string, Interpolant>();
  for (const track of clip.tracks) {
    const [name, property] = track.name.split('.');
    if (property === 'quaternion' && UPPER_BODY.includes(name)) channels.set(name, track.createInterpolant());
  }
  return { duration: clip.duration, channels };
}

export type GekkaRestraintMotion = {
  /** Gọi SAU mixer nền mỗi frame; cue null thì nhả dần về tư thế nền rồi thôi tác động. */
  apply(nowMs: number, delta: number, cue: GekkaRestraintCue | null): void;
  /** Trả xương về nền ngay (khi gỡ component hoặc rời Gekkarō). */
  reset(): void;
};

export async function loadGekkaRestraintMotion(scene: Object3D): Promise<GekkaRestraintMotion> {
  const [idle, light, heavy] = await Promise.all([
    upperBodySampler(scene, GEKKA_RESTRAINT_CLIPS.idle, true),
    upperBodySampler(scene, GEKKA_RESTRAINT_CLIPS.light, false),
    upperBodySampler(scene, GEKKA_RESTRAINT_CLIPS.heavy, false),
  ]);
  const bone = (name: string) => scene.getObjectByName(name) ?? null;
  const upper = UPPER_BODY.flatMap(name => { const node = bone(name); return node ? [{ name, node }] : []; });
  const limbs = (['Left', 'Right'] as const).map(side => ({
    side,
    arm: [bone(`${side}Arm`), bone(`${side}ForeArm`), bone(`${side}Hand`)] as const,
    leg: [bone(`${side}UpLeg`), bone(`${side}Leg`), bone(`${side}Foot`)] as const,
  }));
  const chains = limbs.flatMap(limb => [limb.arm, limb.leg]).filter((chain): chain is readonly [Object3D, Object3D, Object3D] => chain.every(Boolean));
  const solvers = new Map(chains.map(chain => [chain, createTwoBoneIK(chain[0], chain[1], chain[2])]));
  const controlled = [...upper.map(item => item.node), ...chains.flat()];
  // Mixer nền chỉ ghi xương khi giá trị clip đổi; xương còn giữ kết quả của ta thì trả về nền trước khi tính lại.
  const base = new Map(controlled.map(node => [node, new Quaternion()]));
  const result = new Map(controlled.map(node => [node, new Quaternion()]));
  const snapshot = new Map(upper.map(item => [item.node, new Quaternion()]));
  const solved = new Quaternion(), footWorld = new Quaternion();
  const rest = { measured: false, scale: 1, armLength: new Map<Object3D, number>(), legLength: new Map<Object3D, number>() };
  let weight = 0, active = false, lastHitAt: number | null = null, snapAt = -Infinity;

  /** Điểm cùm cổ tay/cổ chân trong hệ model (+Z trước mặt, +X bên trái), tính từ vai/háng hiện tại. */
  const restraintTarget = (chain: readonly [Object3D, Object3D, Object3D], isArm: boolean, side: 'Left' | 'Right', kind: GekkaRestraintCue['kind'], out: Vector3) => {
    const root = chain[0];
    scene.worldToLocal(root.getWorldPosition(out));
    const length = (isArm ? rest.armLength : rest.legLength).get(root) ?? 0.5;
    const outward = side === 'Left' ? 1 : -1;
    if (isArm) {
      const drop = RESTRAINT_ARM_DROP[kind];
      // Cổ tay cách vai 96% tầm với để khuỷu còn hơi chùng, không duỗi khóa cứng.
      out.x += outward * Math.cos(drop) * length * 0.96; out.y -= Math.sin(drop) * length * 0.96; out.z -= 0.04 * length;
    } else {
      const spread = RESTRAINT_LEG_SPREAD[kind];
      out.x += outward * Math.sin(spread) * length * 0.985; out.y -= Math.cos(spread) * length * 0.985;
    }
    return scene.localToWorld(out);
  };

  const measure = () => {
    for (const chain of chains) {
      const [a, b, c] = chain.map(node => scene.worldToLocal(node.getWorldPosition(new Vector3())));
      const length = a.distanceTo(b) + b.distanceTo(c);
      (chain === limbs[0].arm || chain === limbs[1].arm ? rest.armLength : rest.legLength).set(chain[0], length);
    }
    rest.measured = true;
  };

  const targets = [new Vector3(), new Vector3(), new Vector3(), new Vector3()], pole = new Vector3();
  const restore = () => {
    for (const node of controlled) if (active && node.quaternion.equals(result.get(node)!)) node.quaternion.copy(base.get(node)!);
    active = false;
  };
  return {
    reset() { restore(); weight = 0; lastHitAt = null; },
    apply(nowMs, delta, cue) {
      restore();
      weight = Math.min(1, Math.max(0, weight + (cue ? 1 : -1) * Math.min(delta, 0.1) / POSE_BLEND_SECONDS));
      if (weight <= 0) { lastHitAt = null; return; }
      for (const node of controlled) base.get(node)!.copy(node.quaternion);
      const kind = cue?.kind ?? 'post';
      const w = smooth(weight), seconds = nowMs / 1000;
      // Điểm cùm lấy từ vai/háng của tư thế nền TRƯỚC khi thân trên giật: thân lắc thì tay bị kéo, cổ tay không trôi theo.
      scene.updateWorldMatrix(true, true);
      if (!rest.measured) measure();
      limbs.forEach((limb, index) => {
        if (limb.arm.every(Boolean)) restraintTarget(limb.arm as readonly [Object3D, Object3D, Object3D], true, limb.side, kind, targets[index * 2]);
        if (limb.leg.every(Boolean)) restraintTarget(limb.leg as readonly [Object3D, Object3D, Object3D], false, limb.side, kind, targets[index * 2 + 1]);
      });

      // Cú mới: chụp thân trên đang hiển thị để nối mượt từ cú trước sang cú này.
      if (cue?.hitAt != null && cue.hitAt !== lastHitAt) {
        for (const item of upper) snapshot.get(item.node)!.copy(item.node.quaternion);
        snapAt = nowMs; lastHitAt = cue.hitAt;
      }
      const hit = cue?.hitAt != null && cue.kind === 'post' ? (cue.heavy ? heavy : light) : null;
      const hitTime = hit && cue?.hitAt != null ? (nowMs - cue.hitAt) / 1000 + HIT_CLIP_OFFSET : -1;
      const hitWeight = hit && hitTime >= 0 && hitTime < hit.duration
        ? smooth((hitTime - HIT_CLIP_OFFSET) / HIT_FADE_IN) * smooth((hit.duration - hitTime) / HIT_FADE_OUT) : 0;
      const idleTime = ((seconds % idle.duration) + idle.duration) % idle.duration;
      const snap = smooth((nowMs - snapAt) / 1000 / HIT_SNAP_BLEND);
      for (const { name, node } of upper) {
        const idleChannel = idle.channels.get(name);
        if (idleChannel) sample.fromArray(idleChannel.evaluate(idleTime)); else sample.copy(node.quaternion);
        const hitChannel = hit?.channels.get(name);
        if (hitChannel && hitWeight > 0) sample.slerp(hitSample.fromArray(hitChannel.evaluate(hitTime)), hitWeight);
        if (snap < 1) sample.copy(hitSample.copy(snapshot.get(node)!).slerp(sample, snap));
        node.quaternion.slerp(sample, w);
      }
      scene.updateWorldMatrix(true, true);

      for (const [index, limb] of limbs.entries()) {
        for (const isArm of [true, false]) {
          const chain = isArm ? limb.arm : limb.leg;
          if (!chain.every(Boolean)) continue;
          const nodes = chain as readonly [Object3D, Object3D, Object3D];
          // Bàn chân giữ hướng đang đứng (phẳng sàn); bàn tay để theo cẳng tay như bị cùm.
          if (!isArm) nodes[2].getWorldQuaternion(footWorld);
          const target = targets[index * 2 + (isArm ? 0 : 1)];
          // Khuỷu cong ra sau-xuống; gối hướng ra trước.
          scene.localToWorld(pole.set(0, isArm ? -0.4 : 0, isArm ? -1 : 1)).sub(scene.getWorldPosition(worldPoint)).normalize();
          solvers.get(nodes)!(target, pole, isArm ? undefined : footWorld);
          for (const node of nodes) {
            solved.copy(node.quaternion);
            node.quaternion.copy(base.get(node)!).slerp(solved, w);
          }
          nodes[0].updateWorldMatrix(false, true);
        }
      }
      for (const node of controlled) result.get(node)!.copy(node.quaternion);
      active = true;
    },
  };
}
