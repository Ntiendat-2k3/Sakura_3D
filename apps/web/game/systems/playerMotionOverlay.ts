/** Chồng một hoặc nhiều clip retarget lên rig người chơi SAU mixer nền, trộn theo trọng số mà không cộng dồn qua frame. */
import { Quaternion, QuaternionKeyframeTrack, Vector3, type AnimationClip, type Interpolant, type Object3D } from 'three';

type Channel =
  | { kind: 'quaternion'; node: Object3D; samplers: (Interpolant | null)[]; base: Quaternion; result: Quaternion; active: boolean }
  | { kind: 'position'; node: Object3D; samplers: (Interpolant | null)[]; base: Vector3; result: Vector3; active: boolean };

/** Một clip trong lần trộn: chỉ số clip, thời điểm lấy mẫu (giây) và trọng số tương đối. */
export type OverlaySample = { clip: number; time: number; weight: number };

export type MotionOverlay = {
  durations: number[];
  /**
   * weight 0 trả các xương về giá trị nền rồi thôi tác động. Mixer nền chỉ ghi xương khi giá trị của nó đổi,
   * nên xương còn giữ kết quả frame trước được khôi phục về nền trước khi trộn (cùng cách với applyBluffPose).
   */
  apply(samples: OverlaySample[], weight: number): void;
};

const sampled = new Quaternion(), target = new Quaternion();
const sampledPosition = new Vector3(), targetPosition = new Vector3();

/** Lấy mẫu track trực tiếp (không qua AnimationMixer) để không vướng cache "chỉ ghi khi đổi" của mixer thứ hai. */
export function createMotionOverlay(scene: Object3D, clips: AnimationClip[]): MotionOverlay {
  const channels = new Map<string, Channel>();
  clips.forEach((clip, index) => {
    for (const track of clip.tracks) {
      const [name, property] = track.name.split('.');
      const node = scene.getObjectByName(name);
      const kind = track instanceof QuaternionKeyframeTrack ? 'quaternion' : property === 'position' ? 'position' : null;
      if (!node || !kind) continue;
      const key = `${name}.${kind}`;
      let channel = channels.get(key);
      if (!channel) {
        const samplers = clips.map(() => null);
        channel = kind === 'quaternion'
          ? { kind, node, samplers, base: new Quaternion(), result: new Quaternion(), active: false }
          : { kind, node, samplers, base: new Vector3(), result: new Vector3(), active: false };
        channels.set(key, channel);
      }
      channel.samplers[index] = track.createInterpolant();
    }
  });
  const durations = clips.map(clip => clip.duration);
  return {
    durations,
    apply(samples, weight) {
      for (const channel of channels.values()) {
        if (!channel.active) continue;
        if (channel.kind === 'quaternion') {
          if (channel.node.quaternion.equals(channel.result)) channel.node.quaternion.copy(channel.base);
        } else if (channel.node.position.equals(channel.result)) channel.node.position.copy(channel.base);
        channel.active = false;
      }
      const w = Math.min(Math.max(weight, 0), 1);
      const live = samples.filter(sample => sample.weight > 0);
      if (w <= 0 || !live.length) return;
      for (const channel of channels.values()) {
        // Trộn dồn: mỗi clip mới chiếm phần trọng số của nó trên tổng đã gộp, tương đương trung bình có trọng số.
        let total = 0;
        for (const sample of live) {
          const sampler = channel.samplers[sample.clip];
          if (!sampler) continue;
          const value = sampler.evaluate(Math.min(Math.max(sample.time, 0), durations[sample.clip]));
          const share = sample.weight / (total + sample.weight);
          if (channel.kind === 'quaternion') {
            sampled.fromArray(value);
            if (total === 0) target.copy(sampled); else target.slerp(sampled, share);
          } else {
            sampledPosition.fromArray(value);
            if (total === 0) targetPosition.copy(sampledPosition); else targetPosition.lerp(sampledPosition, share);
          }
          total += sample.weight;
        }
        if (total === 0) continue;
        if (channel.kind === 'quaternion') {
          channel.base.copy(channel.node.quaternion);
          channel.node.quaternion.slerp(target, w);
          channel.result.copy(channel.node.quaternion);
        } else {
          channel.base.copy(channel.node.position);
          channel.node.position.lerp(targetPosition, w);
          channel.result.copy(channel.node.position);
        }
        channel.active = true;
      }
    },
  };
}
