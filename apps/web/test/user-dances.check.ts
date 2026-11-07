/** Chạy clip người dùng trên ba rig thật, kiểm tra biên vòng và xuất pose runtime để xem bằng Blender offline. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AnimationClip, Group, PropertyBinding, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import { CLUB_NPCS, clearCharacterAssets, loadCharacterAsset } from '../game/systems/characterAssets';
import { loadRosettaDance, loadRosettaWave } from '../game/systems/rosettaMotion';
import { createRosettaGreeting } from '../game/systems/rosettaGreeting';
import { updateDanceRig } from '../game/systems/retargetClubMotion';
import choreography from '../game/scenes/club-choreography.json';
import { unpack, pack, withAnimation } from './glb';

const rootPath = resolve(__dirname, '../../..');
async function check(id: 'wine' | 'pop' | 'rosetta') {
  const definition = CLUB_NPCS[id], bytes = await readFile(resolve(rootPath, 'apps/web/public', definition.url.slice(1))), { doc, binary } = unpack(bytes);
  const preview = JSON.parse(JSON.stringify(doc));
  delete doc.images; delete doc.textures;
  if (doc.extensions?.VRM) {
    delete doc.extensions.VRM.meta.texture;
    doc.materials = doc.materials.map((material: { name: string }) => ({ name: material.name }));
    doc.extensions.VRM.materialProperties.forEach((material: { shader: string; textureProperties: object }) => { material.shader = 'VRM_USE_GLTFSHADER'; material.textureProperties = {}; });
  } else { delete doc.materials; for (const mesh of doc.meshes) for (const primitive of mesh.primitives) delete primitive.material; }
  const buffer = pack(doc, binary), loader = new GLTFLoader(); loader.register(parser => new VRMLoaderPlugin(parser));
  const gltf = await loader.parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
  const originalLoader = GLTFLoader.prototype.loadAsync; let asset;
  try { GLTFLoader.prototype.loadAsync = async () => gltf; asset = await loadCharacterAsset(id); }
  finally { GLTFLoader.prototype.loadAsync = originalLoader; }
  const root = new Group(); root.add(asset.scene);
  const rosettaClip = id === 'rosetta' ? await loadRosettaDance(asset.scene) : null;
  const greeting = id === 'rosetta' ? createRosettaGreeting(asset, await loadRosettaWave(asset.scene)) : null;
  const action = rosettaClip ? asset.mixer!.clipAction(rosettaClip).reset().play().setEffectiveWeight(0) : null;
  const beautyHips = id === 'rosetta' ? asset.scene.getObjectByName('Hips')!.position.clone() : null;
  const idClip = id === 'wine' ? choreography.WINE[0] : id === 'pop' ? choreography.POP[0] : choreography.ROSETTA[0];
  const motion = JSON.parse(await readFile(resolve(rootPath, `apps/web/public/assets/animations/club/${idClip}.json`), 'utf8'));
  const duration = rosettaClip?.duration ?? motion.duration - .25;
  const normalization = preview.nodes.length;
  preview.nodes.push({ name: 'ModelNormalization', children: preview.scenes[0].nodes, translation: asset.scene.position.toArray(), rotation: asset.scene.quaternion.toArray(), scale: asset.scene.scale.toArray() });
  preview.scenes[0].nodes = [normalization];
  const joints = new Set<number>(preview.skins.flatMap((skin: { joints: number[] }) => skin.joints));
  const bones = [...joints].map(index => asset.scene.getObjectByName(PropertyBinding.sanitizeNodeName(preview.nodes[index].name))!).filter(Boolean);
  const times: number[] = [], positions: number[] = [], data = bones.map(() => ({ positions: [] as number[], rotations: [] as number[] }));
  const feet = asset.vrm ? (['leftFoot', 'rightFoot'] as const).map(side => asset.vrm!.humanoid.getRawBoneNode(side)!) : ['FootL', 'FootR'].map(name => asset.scene.getObjectByName(name)!);
  const hand = asset.vrm?.humanoid.getRawBoneNode('rightHand') ?? asset.scene.getObjectByName('HandR')!;
  const point = new Vector3(), previous = bones.map(() => new Quaternion());
  let maxJointChange = 0, maxGroundError = 0, maxHandTravel = 0, worstJoint = '', worstTime = 0;
  const firstHand = new Vector3();
  const frames = Math.ceil((duration * 2 + 2) * 30);
  for (let frame = 0; frame <= frames; frame++) {
    const seconds = frame / 30;
    if (greeting) greeting.update(seconds, 1 / 30, 'dancing', action, seconds);
    else { assert.ok(asset.dance); const state: { clip: string } = asset.dance.update(seconds * 140 / 60, 0, seconds); assert.equal(state.clip, idClip); updateDanceRig(asset.vrm!, 1 / 30, asset.footClearance, frame === 0); }
    if (!asset.vrm) {
      asset.scene.updateMatrixWorld(true);
      const floor = Math.min(...feet.map(foot => foot.getWorldPosition(point).y));
      asset.scene.position.y += asset.footClearance - floor; asset.scene.updateMatrixWorld(true);
    }
    maxGroundError = Math.max(maxGroundError, Math.abs(Math.min(...feet.map(foot => foot.getWorldPosition(point).y)) - asset.footClearance));
    hand.getWorldPosition(point); if (frame === 30) firstHand.copy(point);
    if (frame > 30) maxHandTravel = Math.max(maxHandTravel, point.distanceTo(firstHand));
    bones.forEach((bone, i) => {
      assert.ok([...bone.position.toArray(), ...bone.quaternion.toArray()].every(Number.isFinite));
      if (frame > 0) {
        const change = previous[i].angleTo(bone.quaternion.clone().normalize());
        if (change > maxJointChange) { maxJointChange = change; worstJoint = bone.name; worstTime = seconds; }
      }
      previous[i].copy(bone.quaternion).normalize();
    });
    if (seconds <= 8) {
      times.push(seconds); positions.push(...asset.scene.position.toArray());
      bones.forEach((bone, i) => { data[i].positions.push(...bone.position.toArray()); data[i].rotations.push(...bone.quaternion.toArray()); });
    }
  }
  const tracks = [new VectorKeyframeTrack('ModelNormalization.position', times, positions)] as (VectorKeyframeTrack | QuaternionKeyframeTrack)[];
  bones.forEach((bone, i) => tracks.push(new VectorKeyframeTrack(`${bone.name}.position`, times, data[i].positions), new QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, data[i].rotations)));
  await writeFile(resolve(rootPath, `assets/processed/${id}-user-dance-preview.glb`), withAnimation(preview, binary, new AnimationClip(`${id}_user_dance`, 8, tracks)));
  assert.ok(maxGroundError < .001, 'Chân thấp nhất không giữ độ cao sàn');
  assert.ok(maxHandTravel > .1, 'Không thấy diễn hoạt tay');
  console.log({ id, maxJointChange, worstJoint, worstTime });
  assert.ok(maxJointChange < .8, `Khớp ${id}/${worstJoint} bị nhảy góc lớn lúc ${worstTime}s: ${maxJointChange}`);
  if (greeting && beautyHips) {
    for (let frame = 0; frame < 90; frame++) greeting.update(frame / 30, 1 / 30, 'dialogue', action, duration * 2);
    assert.ok(asset.scene.getObjectByName('Hips')!.position.distanceTo(beautyHips) < .025, 'Dừng nhảy không trả hips về dáng đón khách');
    asset.scene.updateMatrixWorld(true);
    assert.ok(feet[1].getWorldPosition(new Vector3()).y - feet[0].getWorldPosition(new Vector3()).y > .15, 'Dừng nhảy không trở về dáng co chân đã duyệt');
  }
  clearCharacterAssets();
  return { id, source: motion.source, sourceRig: motion.sourceRig, sourceDuration: motion.duration, loopDuration: duration, frames, maxJointChangeRadians: maxJointChange, maxAnkleGroundErrorMeters: maxGroundError, maxHandTravelMeters: maxHandTravel, returnToGreeting: id === 'rosetta' ? 'PASS' : 'N/A' };
}
async function main() {
  const original = globalThis.fetch;
  globalThis.fetch = async url => new Response(await readFile(resolve(rootPath, 'apps/web/public', String(url).replace(/^\//, '')), 'utf8'));
  try {
    const results = [];
    for (const id of ['wine', 'pop', 'rosetta'] as const) results.push(await check(id));
    await writeFile(resolve(rootPath, 'test-results/user-dances-check.json'), JSON.stringify({ results, browser: 'SKIPPED theo yêu cầu người dùng' }, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally { globalThis.fetch = original; clearCharacterAssets(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
