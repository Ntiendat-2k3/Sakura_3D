/** Mỗi avatar có rig/mixer riêng; chỉ chia sẻ geometry, material và clip đã tải từ GLB. */
import { AnimationMixer, MathUtils, Mesh, SkinnedMesh, type AnimationClip, type Object3D } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { getClubBeat } from './BeatSyncController';
import { PLAYER_DANCES, type ClubShow } from '@metaverse/game-protocol';
import character from '../entities/player-character.json';

const bodyMotions = ['Idle', 'Walk', 'Run', 'Sit', ...Object.values(PLAYER_DANCES).map(dance => dance.clip)] as const;
const naturalMotions = new Set<string>(Object.values(PLAYER_DANCES).filter(dance => dance.source).map(dance => dance.clip));
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
      // Giữ nhịp bước chân ổn định tự nhiên khi đang đi bộ, không bị khựng bước khi gói mạng trễ nhẹ
      const targetGait = motion === 'Walk' ? (speed > 0.05 ? Math.max(character.runSpeed * 0.85, speed) : character.runSpeed) : 0;
      gaitSpeed = MathUtils.damp(gaitSpeed, targetGait, 10, dt);
      const locomotion = motion === 'Walk' || motion === 'Idle';
      const moving = locomotion ? MathUtils.smoothstep(gaitSpeed, .05, .7) : 0;
      for (const name of bodyMotions) {
        const action = actions.get(name)!;
        let target = name === motion ? 1 : 0;
        if (name === 'Idle') target = locomotion ? 1 - moving : 0;
        else if (name === 'Walk') target = moving;
        else if (name === 'Run') target = 0;
        const weight = MathUtils.damp(action.getEffectiveWeight(), target, 10, dt);
        action.setEffectiveWeight(Math.abs(weight - target) < .001 ? target : weight);
      }
      const walk = actions.get('Walk')!;
      // Nhịp bước Dwarf Walk tại tốc độ gốc tự nhiên, tỷ lệ mượt theo gia tốc khởi hành/dừng.
      const stride = walk.getClip().duration * character.runSpeed;
      gaitPhase = (gaitPhase + dt * gaitSpeed / stride) % 1;
      for (const name of bodyMotions) {
        const action = actions.get(name)!;
        const duration = action.getClip().duration;
        action.time = naturalMotions.has(name) ? ((now - epoch) / 1000 % duration + duration) % duration
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
