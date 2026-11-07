/** Mỗi avatar có rig/mixer riêng; chỉ chia sẻ geometry, material và clip đã tải từ GLB. */
import { AnimationMixer, MathUtils, Mesh, SkinnedMesh, type AnimationClip, type Object3D } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { getClubBeat } from './BeatSyncController';
import type { ClubShow } from '@metaverse/game-protocol';
import character from '../entities/player-character.json';

const bodyMotions = ['Idle', 'Walk', 'Run', 'Sit', 'Dance', 'GuitarDance', 'Flair'] as const;
export type PlayerMotion = Exclude<typeof bodyMotions[number], 'Run'>;

export function createPlayerAnimation(source: Object3D, clips: AnimationClip[], guitarRequired = true) {
  for (const name of [...bodyMotions, 'Blink']) {
    if (!clips.some(clip => clip.name === name && clip.duration > 0)) throw new Error(`Thiếu chuyển động người chơi: ${name}`);
  }
  const scene = clone(source);
  const mixer = new AnimationMixer(scene);
  const actions = new Map(clips.map(clip => [clip.name, mixer.clipAction(clip)]));
  const guitar = scene.getObjectByName('guitar');
  if (!guitar && guitarRequired) throw new Error('Thiếu cây đàn của người chơi');
  if (guitar) guitar.visible = false;
  for (const action of actions.values()) action.play().setEffectiveWeight(0);
  scene.traverse(node => {
    if (node instanceof Mesh) { node.castShadow = true; node.receiveShadow = true; }
    // Biên skin tĩnh không bao phủ tay giơ cao khi nhảy.
    if (node instanceof SkinnedMesh) node.frustumCulled = false;
  });
  actions.get('Idle')!.setEffectiveWeight(1);
  actions.get('Blink')!.setEffectiveWeight(1);
  let gaitPhase = 0, gaitSpeed = 0, idleTime = 0;
  return {
    scene,
    /** Dùng pha beat chung của phòng; blend trọng số không đổi vị trí authoritative của avatar. */
    update(delta: number, motion: PlayerMotion, speed: number, epoch: number, show: ClubShow, now = Date.now()) {
      const dt = Math.min(Math.max(delta, 0), .1);
      if (!guitar && motion === 'GuitarDance') motion = 'Dance';
      if (guitar) guitar.visible = motion === 'GuitarDance';
      idleTime += dt;
      gaitSpeed = MathUtils.damp(gaitSpeed, motion === 'Walk' ? Math.max(0, speed) : 0, 12, dt);
      const running = MathUtils.smoothstep(gaitSpeed, 2, 3.8);
      const locomotion = motion === 'Walk' || motion === 'Idle';
      const moving = locomotion ? MathUtils.smoothstep(gaitSpeed, .05, .7) : 0;
      for (const name of bodyMotions) {
        const action = actions.get(name)!;
        let target = name === motion ? 1 : 0;
        if (name === 'Idle') target = locomotion ? 1 - moving : 0;
        else if (name === 'Walk') target = moving * (1 - running);
        else if (name === 'Run') target = moving * running;
        const weight = MathUtils.damp(action.getEffectiveWeight(), target, 10, dt);
        action.setEffectiveWeight(Math.abs(weight - target) < .001 ? target : weight);
      }
      const walk = actions.get('Walk')!, run = actions.get('Run')!;
      const locomotionWeight = walk.getEffectiveWeight() + run.getEffectiveWeight();
      const runBlend = locomotionWeight > .001 ? run.getEffectiveWeight() / locomotionWeight : 0;
      // Nhịp theo sải chân đang hiển thị, kể cả lúc trọng số chưa chuyển xong sang chạy.
      const stride = MathUtils.lerp(walk.getClip().duration * character.walkSpeed, run.getClip().duration * character.runSpeed, runBlend);
      gaitPhase = (gaitPhase + dt * gaitSpeed / stride) % 1;
      for (const name of bodyMotions) {
        const action = actions.get(name)!;
        const duration = action.getClip().duration;
        action.time = name === 'Flair' ? ((now - epoch) / 1000 % duration + duration) % duration
          : name === 'Dance' || name === 'GuitarDance'
          ? (getClubBeat(epoch, show, now).beat % character.danceBeats) / character.danceBeats * duration
          : name === 'Walk' || name === 'Run' ? gaitPhase * duration : name === 'Sit' ? 0 : idleTime % duration;
      }
      actions.get('Blink')!.time = idleTime % actions.get('Blink')!.getClip().duration;
      mixer.update(0);
    },
    dispose() {
      mixer.stopAllAction(); mixer.uncacheRoot(scene);
      scene.traverse(node => { if (node instanceof SkinnedMesh) node.skeleton.dispose(); });
    },
  };
}
