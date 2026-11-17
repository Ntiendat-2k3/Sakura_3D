/** Retarget mocap người chơi lên GLB chuẩn, neo root và đo skin thật để giữ động tác sát sàn. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { AnimationClip, AnimationMixer, Quaternion, SkinnedMesh, Texture, Vector3, VectorKeyframeTrack } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PLAYER_CHARACTERS, PLAYER_DANCES, type PlayerDanceStyle } from '@metaverse/game-protocol';
import { retargetSkeletonMotion } from '../game/systems/retargetSkeletonMotion';
import type { Motion } from '../game/systems/retargetClubMotion';
import { unpack, withAnimation } from '../test/glb';

const root = resolve(__dirname, '../../..');
const mapping: Record<string, string> = Object.fromEntries(['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head'].map(name => [name, name]));
for (const side of ['Left', 'Right']) {
  for (const name of ['Shoulder', 'Arm', 'ForeArm', 'Hand', 'UpLeg', 'Leg', 'Foot', 'ToeBase']) mapping[side + name] = side + name;
  for (const finger of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) for (let n = 1; n <= 3; n++) mapping[`${side}Hand${finger}${n}`] = `${side}Hand${finger}${n}`;
}

async function main() {
  const key = process.argv.find(arg => arg.startsWith('--motion='))?.slice(9) ?? 'flair';
  const motionDefinition = key === 'walk'
    ? { clip: 'Walk', source: 'Dwarf Walk' }
    : Object.hasOwn(PLAYER_DANCES, key)
      ? PLAYER_DANCES[key as PlayerDanceStyle]
      : null;
  if (!motionDefinition) throw new Error('Chuyển động không hợp lệ');
  if (!motionDefinition.source) throw new Error('Chuyển động không dùng nguồn FBX');
  const sampleRate = ['walk', 'maraschino', 'swing', 'snakehiphop'].includes(key) ? 24 : 30;
  const source = `assets/source/animations/club/mixamo/common/${motionDefinition.source}.fbx`;
  const motion = JSON.parse(await readFile(resolve(root, `apps/web/public/assets/animations/club/${motionDefinition.source}.json`), 'utf8')) as Motion;
  const selected = process.argv.find(arg => arg.startsWith('--character='))?.slice(12);
  if (selected && !Object.hasOwn(PLAYER_CHARACTERS, selected)) throw new Error('Nhân vật không hợp lệ');
  type Entry = { id: string; duration: number; tracks: number; addedBytes: number; maxCorrection: number; runtimeSha256: string };
  const reportPath = resolve(root, `test-results/player-${key}-bake.json`);
  let previous: Entry[] = [];
  try { previous = JSON.parse(await readFile(reportPath, 'utf8')); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const report = previous.filter(item => selected && item.id !== selected);
  for (const [id, definition] of Object.entries(PLAYER_CHARACTERS)) {
    if (selected && id !== selected) continue;
    const path = resolve(root, 'apps/web/public', definition.url.slice(1));
    // Chỉ dùng backup nếu GLB hiện tại đúng là kết quả bake trước; không ghi đè thay đổi model mới.
    const backup = resolve(root, 'assets/processed', `${id}-before-${key}.glb`);
    const current = await readFile(path), hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
    let bytes = current;
    if (previous.find(item => item.id === id)?.runtimeSha256 === hash(current)) bytes = await readFile(backup);
    else await writeFile(backup, current);
    const loader = new GLTFLoader(); loader.register(() => ({ name: 'BAKE_TEXTURE', loadTexture: async () => new Texture() }));
    const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const clip = retargetSkeletonMotion(motion, gltf.scene, mapping, { name: motionDefinition.clip, hipsLimit: 2, overlap: .08 });
    const meshes: SkinnedMesh[] = []; gltf.scene.traverse(node => { if (node instanceof SkinnedMesh && node.name !== 'guitar') meshes.push(node); });
    const hips = gltf.scene.getObjectByName('Hips')!, parent = hips.parent!, point = new Vector3(), origin = new Vector3(), up = new Vector3();
    const yTrack = clip.tracks.find(track => track.name === 'Hips.position') as VectorKeyframeTrack;
    assert.ok(yTrack, `${motionDefinition.clip} thiếu root track`);
    const mixer = new AnimationMixer(gltf.scene); mixer.clipAction(clip).play();
    const positions: number[] = [], times = Array.from(yTrack.times);
    let maxCorrection = 0;
    for (const t of times) {
      mixer.setTime(t === clip.duration ? 0 : t); gltf.scene.updateMatrixWorld(true);
      let floor = Infinity;
      for (const mesh of meshes) {
        mesh.skeleton.update();
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) floor = Math.min(floor, mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld).y);
      }
      assert.ok(Number.isFinite(floor));
      maxCorrection = Math.max(maxCorrection, Math.abs(floor));
      parent.worldToLocal(up.set(0, -floor, 0)); parent.worldToLocal(origin.set(0, 0, 0));
      positions.push(...hips.position.clone().add(up.sub(origin)).toArray());
    }
    mixer.stopAllAction(); mixer.uncacheRoot(gltf.scene);
    const grounded = new AnimationClip(motionDefinition.clip, clip.duration, clip.tracks.map(track => {
      if (track === yTrack) return new VectorKeyframeTrack(track.name, times, positions);
      if (key === 'walk' && /^(Left|Right)Hand(Index|Middle|Ring|Pinky)[1-3]\.quaternion$/.test(track.name)) {
        const sign = track.name.startsWith('Left') ? 1 : -1;
        const base = new Quaternion(), delta = new Quaternion(), axis = new Vector3(0, 0, 1);
        const values = Float32Array.from(track.values);
        for (let i = 0; i < track.times.length; i++) {
          const phase = track.times[i] / clip.duration;
          const angle = sign * 0.048 * Math.sin(phase * Math.PI * 2);
          base.fromArray(values, i * 4);
          delta.setFromAxisAngle(axis, angle);
          base.multiply(delta).normalize().toArray(values, i * 4);
        }
        return track.clone().setInterpolation(track.getInterpolation()).constructor === track.constructor
          ? Object.assign(track.clone(), { values })
          : track;
      }
      return track;
    }));
    // Chỉ giảm về 24 Hz khi sai số góc dưới 1 độ; khớp chuyển động nhanh giữ keyframe nguồn.
    if (sampleRate === 24) {
      const samples = Array.from({ length: Math.ceil(grounded.duration * sampleRate) + 1 }, (_, i) => Math.min(grounded.duration, i / sampleRate));
      grounded.tracks = grounded.tracks.map(track => {
        const interpolant = track.createInterpolant(), sampled = track.clone();
        sampled.times = Float32Array.from(samples);
        sampled.values = Float32Array.from(samples.flatMap(time => Array.from(interpolant.evaluate(time))));
        if (track.name.endsWith('.quaternion')) {
          const candidate = sampled.createInterpolant(), a = new Quaternion(), b = new Quaternion();
          for (let frame = 0; frame <= grounded.duration * 60; frame++) {
            const time = frame / 60;
            if (a.fromArray(interpolant.evaluate(time)).normalize().angleTo(b.fromArray(candidate.evaluate(time)).normalize()) > Math.PI / 180) return track;
          }
        }
        return sampled;
      });
    }
    grounded.optimize();
    const { doc, binary } = unpack(bytes), result = withAnimation(doc, binary, grounded, true);
    await writeFile(path, result);
    const manifestPath = resolve(root, 'assets/processed', `${id}-player-manifest.json`);
    let manifest: Record<string, unknown> | undefined;
    try {
      manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    } catch (error) {
      // Khi dựng lần đầu, script Blender sẽ tạo manifest ngay sau bước ghép mocap này.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (manifest) {
      manifest.runtimeSha256 = hash(result); manifest.bytes = result.length;
      manifest.animations = doc.animations.map((animation: { name: string }) => animation.name);
      manifest[key] = { source, sourceSha256: hash(await readFile(resolve(root, source))), duration: clip.duration, playback: 'natural', sampling: sampleRate === 24 ? '24 Hz, giữ 30 Hz cho khớp có sai số vượt 1 độ' : '30 Hz' };
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    }
    const previewDoc = JSON.parse(JSON.stringify(doc));
    const preview = withAnimation(previewDoc, result.subarray(result.length - doc.buffers[0].byteLength), grounded);
    await writeFile(resolve(root, 'assets/processed', `${id}-${key}-preview.glb`), preview);
    report.push({ id, duration: grounded.duration, tracks: grounded.tracks.length, addedBytes: result.length - bytes.length, maxCorrection, runtimeSha256: hash(result) });
    console.log(`${id}: ${motionDefinition.clip} (${grounded.duration.toFixed(3)}s)`);
  }
  await writeFile(reportPath, JSON.stringify(report, null, 2)); console.log(report);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
