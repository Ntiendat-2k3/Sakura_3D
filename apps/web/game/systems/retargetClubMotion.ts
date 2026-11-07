import { AnimationClip, AnimationMixer, Euler, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack, type Object3D } from 'three';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import sequences from '../scenes/club-choreography.json';

export type Motion = { id: string; duration: number; playback?: 'natural'; provider?: 'mixamo' | 'user-fbx'; bones: Record<string, { position: number[]; restWorld: number[]; parentWorld: number[] }>; tracks: { name: string; times: number[]; values: number[] }[] };
const rig: Record<string, VRMHumanBoneName> = { Hips:'hips', Spine:'spine', Spine1:'chest', Spine2:'upperChest', Neck:'neck', Head:'head', LeftShoulder:'leftShoulder', RightShoulder:'rightShoulder', LeftArm:'leftUpperArm', RightArm:'rightUpperArm', LeftForeArm:'leftLowerArm', RightForeArm:'rightLowerArm', LeftHand:'leftHand', RightHand:'rightHand', LeftUpLeg:'leftUpperLeg', RightUpLeg:'rightUpperLeg', LeftLeg:'leftLowerLeg', RightLeg:'rightLowerLeg', LeftFoot:'leftFoot', RightFoot:'rightFoot', LeftToeBase:'leftToes', RightToeBase:'rightToes' };
const downloads = new Map<string, Promise<Motion>>();
const footPoint = new Vector3();
const springRotations = new WeakMap<VRM, { node: Object3D; rotation: Quaternion }[]>();
for (const [side, label] of [['left', 'Left'], ['right', 'Right']]) for (const finger of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) {
  const target = finger === 'Pinky' ? 'Little' : finger;
  const parts = finger === 'Thumb' ? ['Metacarpal', 'Proximal', 'Distal'] : ['Proximal', 'Intermediate', 'Distal'];
  parts.forEach((part, index) => { rig[`${label}Hand${finger}${index + 1}`] = `${side}${target}${part}` as VRMHumanBoneName; });
}

export function loadClubMotion(id: string) {
  if (!downloads.has(id)) downloads.set(id, fetch(`/assets/animations/club/${id}.json`).then(r => { if (!r.ok) throw new Error(`Không tải được ${id}`); return r.json() as Promise<Motion>; }).catch(error => { downloads.delete(id); throw error; }));
  return downloads.get(id)!;
}

/** Chồng 0.25 giây cuối/đầu bằng slerp, giữ tốc độ gốc và cùng pose ở hai đầu vòng; không kéo clip theo số beat. */
export function createLoopingClip(clip: AnimationClip, overlap = .25) {
  const blend = Math.min(overlap, clip.duration / 4), duration = clip.duration - blend;
  const times = Array.from({ length: Math.ceil(duration * 30) + 1 }, (_, i) => Math.min(duration, i / 30));
  const a = new Quaternion(), b = new Quaternion();
  const tracks = clip.tracks.map(track => {
    const first = track.createInterpolant(), last = track.createInterpolant(), values: number[] = [];
    for (const time of times) {
      const phase = time >= duration ? 0 : time, source = first.evaluate(phase);
      if (phase >= blend) { values.push(...source); continue; }
      const end = last.evaluate(duration + phase), t = phase / blend, weight = t * t * (3 - 2 * t);
      if (track instanceof QuaternionKeyframeTrack) values.push(...a.fromArray(end).slerp(b.fromArray(source), weight).normalize().toArray());
      else values.push(...Array.from(source as ArrayLike<number>, (value, i) => end[i] + (value - end[i]) * weight));
    }
    return track instanceof QuaternionKeyframeTrack ? new QuaternionKeyframeTrack(track.name, times, values) : new VectorKeyframeTrack(track.name, times, values);
  });
  return new AnimationClip(clip.name, duration, tracks);
}

/** Đồng bộ raw rig và đặt chân trước physics; chia bước 120 Hz để tóc/phụ kiện không nhận cú giật do scale hoặc dịch sàn. */
export function updateDanceRig(vrm: VRM, delta: number, floorY: number, reset = false) {
  vrm.update(0); vrm.scene.updateMatrixWorld(true);
  const left = vrm.humanoid.getRawBoneNode('leftFoot'), right = vrm.humanoid.getRawBoneNode('rightFoot');
  if (!left || !right) throw new Error('Rig nhảy thiếu bàn chân');
  const y = Math.min(left.getWorldPosition(footPoint).y, right.getWorldPosition(footPoint).y);
  vrm.scene.position.y += floorY - y; vrm.scene.updateMatrixWorld(true);
  if (reset) vrm.springBoneManager?.reset();
  let rotations = springRotations.get(vrm);
  if (!rotations || reset) {
    rotations = Array.from(vrm.springBoneManager?.joints ?? [], joint => ({ node: joint.bone, rotation: joint.bone.quaternion.clone() }));
    springRotations.set(vrm, rotations);
  }
  const dt = Math.min(Math.max(delta, 0), .05), steps = Math.max(1, Math.ceil(dt * 120));
  for (let i = 0; i < steps; i++) vrm.springBoneManager?.update(dt / steps);
  // Collider tóc có thể đẩy joint sang nghiệm xa ở một frame; giới hạn tốc độ pose hiển thị, không sửa mocap thân.
  for (const { node, rotation } of rotations) { rotation.rotateTowards(node.quaternion, dt * 8); node.quaternion.copy(rotation); }
  vrm.scene.updateMatrixWorld(true);
}

/** Chuyển quaternion qua rest pose theo mẫu three-vrm của Pixiv; đảo X/Z cho VRM 0.x. */
function retarget(motion: Motion, vrm: VRM) {
  const tracks: (QuaternionKeyframeTrack | VectorKeyframeTrack)[] = [];
  const hips = vrm.humanoid.getNormalizedBoneNode('hips')!;
  const restHips = vrm.humanoid.normalizedRestPose.hips?.position ?? hips.position.toArray();
  const scale = restHips[1] / motion.bones.mixamorigHips.position[1];
  const q = new Quaternion();
  for (const track of motion.tracks) {
    const [name, property] = track.name.split('.');
    const mapped = rig[name.replace('mixamorig', '')];
    const node = mapped && vrm.humanoid.getNormalizedBoneNode(mapped);
    if (!node) continue;
    const values = track.values.slice();
    if (property === 'quaternion') {
      const restInverse = new Quaternion().fromArray(motion.bones[name].restWorld).invert();
      const parent = new Quaternion().fromArray(motion.bones[name].parentWorld);
      for (let i = 0; i < values.length; i += 4) {
        q.fromArray(values, i).premultiply(parent).multiply(restInverse).normalize();
        if (vrm.meta?.metaVersion === '0') { q.x *= -1; q.z *= -1; }
        q.toArray(values, i);
      }
      tracks.push(new QuaternionKeyframeTrack(`${node.name}.quaternion`, track.times, values));
    } else if (mapped === 'hips' && property === 'position') {
      // Khóa root motion X/Z để hai nhân vật luôn ở đúng vị trí biểu diễn.
      for (let i = 0; i < values.length; i += 3) {
        values[i] = restHips[0]; values[i + 2] = restHips[2];
        const limit = motion.playback === 'natural' ? .4 : .12;
        values[i + 1] = restHips[1] + Math.max(-limit, Math.min(limit, (values[i + 1] - motion.bones[name].position[1]) * scale));
      }
      tracks.push(new VectorKeyframeTrack(`${node.name}.position`, track.times, values));
    }
  }
  const clip = new AnimationClip(motion.id, motion.duration, tracks);
  return motion.playback === 'natural' ? createLoopingClip(clip) : clip;
}

export async function createRecordedClubDance(vrm: VRM, name: string, motionIds?: readonly string[]) {
  const ids = motionIds ?? sequences[name as keyof typeof sequences] ?? sequences.WINE;
  const motions = await Promise.all(ids.map(loadClubMotion));
  const mixer = new AnimationMixer(vrm.scene);
  const actions = motions.map(m => mixer.clipAction(retarget(m, vrm)).play());
  const hips = vrm.humanoid.getNormalizedBoneNode('hips')!;
  const spine = vrm.humanoid.getNormalizedBoneNode('spine');
  const chest = vrm.humanoid.getNormalizedBoneNode('chest');
  const accent = new Quaternion();
  const angles = new Euler();
  const phaseOffset = name === 'WINE' ? 0 : Math.PI * .7;
  const baseHipsPosition = hips.position.clone();
  const restHips = vrm.humanoid.normalizedRestPose.hips?.position;
  if (restHips) baseHipsPosition.fromArray(restHips);
  const hipsOriginX = baseHipsPosition.x;
  const baseRotations = [hips, spine, chest].flatMap(node => node ? [{ node, rotation: node.quaternion.clone() }] : []);
  let activeIndex = -1, outgoingIndex = -1, outgoingTime = 0, transitionBeat = 0, lastBeat = -1;
  return {
    resync() { activeIndex = -1; outgoingIndex = -1; lastBeat = -1; },
    update(beat: number, cueOffset = 0, seconds = beat * 60 / 140) {
      if (motions[0].playback === 'natural') {
        // Clip người dùng chọn chạy nguyên tốc độ; không cộng thêm lắc hông làm sai diễn xuất nguồn.
        const action = actions[0];
        actions.forEach((value, i) => value.setEffectiveWeight(i === 0 ? 1 : 0));
        action.time = ((seconds % action.getClip().duration) + action.getClip().duration) % action.getClip().duration;
        mixer.update(0);
        return { clip: ids[0], previous: ids[0], blend: 1, phrase: Math.floor(seconds / action.getClip().duration), style: 'source-clip', provider: motions[0].provider, sway: 0, hipsBaseX: hipsOriginX };
      }
      const phrase = Math.floor(beat / 32);
      const index = (phrase + cueOffset) % actions.length;
      const phase = beat % 32;
      // Giữ pose đang biểu diễn khi đổi clip hoặc nhạc lặp, không nhảy sang cuối một clip khác.
      if (index !== activeIndex || beat < lastBeat) {
        outgoingIndex = activeIndex >= 0 ? activeIndex : (index + actions.length - 1) % actions.length;
        outgoingTime = activeIndex >= 0 ? actions[activeIndex].time : motions[outgoingIndex].duration - .001;
        transitionBeat = lastBeat < 0 ? beat - phase : beat;
        // Restart cùng clip không được đưa tổng trọng số về 0 và lộ rest pose.
        if (outgoingIndex === index) transitionBeat = beat - 2;
        activeIndex = index;
      }
      lastBeat = beat;
      const fade = Math.min(1, Math.max(0, (beat - transitionBeat) / 2));
      const weight = fade * fade * (3 - 2 * fade);
      actions.forEach((action, i) => {
        action.setEffectiveWeight(i === index ? weight : i === outgoingIndex ? 1 - weight : 0);
        action.time = i === index ? phase / 32 * motions[i].duration : i === outgoingIndex ? outgoingTime : 0;
      });
      // Mixer có thể bỏ qua track không đổi; phục hồi pose nền trước để lớp cộng không tích lũy qua frame.
      hips.position.copy(baseHipsPosition);
      baseRotations.forEach(({ node, rotation }) => node.quaternion.copy(rotation));
      mixer.update(0);
      baseHipsPosition.copy(hips.position);
      baseRotations.forEach(({ node, rotation }) => rotation.copy(node.quaternion));
      // Lớp diễn xuất cộng lên mocap: nhấn hông, xoắn eo ngược chiều và body roll chậm, không đổi chiều dài xương.
      const rhythm = beat * Math.PI / 2 + phaseOffset;
      const sway = Math.sin(rhythm), roll = Math.sin(rhythm * .5);
      angles.set(.035 * Math.cos(rhythm), .14 * roll, .16 * sway);
      accent.setFromEuler(angles); hips.quaternion.multiply(accent);
      hips.position.x += .055 * sway;
      if (spine) { accent.setFromEuler(angles.set(.075 * Math.sin(rhythm - .6), -.11 * roll, -.09 * sway)); spine.quaternion.multiply(accent); }
      if (chest) { accent.setFromEuler(angles.set(.065 * Math.sin(rhythm - 1.2), .08 * roll, -.045 * sway)); chest.quaternion.multiply(accent); }
      return { clip: ids[index], previous: ids[outgoingIndex], blend: weight, phrase, style: 'hip-sway-body-roll', sway, hipsBaseX: hipsOriginX };
    },
    dispose() { mixer.stopAllAction(); mixer.uncacheRoot(vrm.scene); },
  };
}
