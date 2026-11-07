/** Kiểm tra vẫy/chuyển dáng trên GLB thật, đo chân trụ và xuất clip để render offline. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AnimationClip, Group, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import definitions from '../game/entities/club-npcs.json';
import { clearCharacterAssets, loadCharacterAsset } from '../game/systems/characterAssets';
import { ROSETTA_BONE_MAPPING } from '../game/systems/rosettaMotion';
import { retargetSkeletonMotion } from '../game/systems/retargetSkeletonMotion';
import { createRosettaGreeting } from '../game/systems/rosettaGreeting';
import { unpack, pack, withAnimation } from './glb';

async function main() {
  const rootPath = resolve(__dirname, '../../..'), raw = await readFile(resolve(rootPath, 'apps/web/public', definitions.rosetta.url.slice(1)));
  const { doc, binary } = unpack(raw), preview = JSON.parse(JSON.stringify(doc));
  delete doc.images; delete doc.textures; delete doc.materials;
  for (const mesh of doc.meshes) for (const primitive of mesh.primitives) delete primitive.material;
  const bytes = pack(doc, binary), gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const original = GLTFLoader.prototype.loadAsync; GLTFLoader.prototype.loadAsync = async () => gltf;
  const asset = await loadCharacterAsset('rosetta'); GLTFLoader.prototype.loadAsync = original;
  const motion = JSON.parse(await readFile(resolve(rootPath, 'apps/web/public/assets/animations/club/Rosetta_Wave.json'), 'utf8'));
  const wave = retargetSkeletonMotion(motion, asset.scene, ROSETTA_BONE_MAPPING), controller = createRosettaGreeting(asset, wave);
  const root = new Group(); root.add(asset.scene);
  const normalization = preview.nodes.length;
  preview.nodes.push({ name: 'ModelNormalization', children: preview.scenes[0].nodes, translation: asset.scene.position.toArray(), rotation: asset.scene.quaternion.toArray(), scale: asset.scene.scale.toArray() });
  preview.scenes[0].nodes = [normalization];
  const joints = new Set<number>(preview.skins.flatMap((skin: { joints: number[] }) => skin.joints));
  const bones = [...joints].map(index => asset.scene.getObjectByName(preview.nodes[index].name.replace(/[.\[\]:/]/g, '').replace(/\s/g, '_'))!).filter(Boolean);
  const times: number[] = [], positions: number[] = [], data = bones.map(() => ({ positions: [] as number[], rotations: [] as number[] }));
  const point = new Vector3(), leftAnchor = new Vector3(), handPositions: number[][] = [], rightHeights: number[] = [];
  let maxPlantError = 0, maxJointChange = 0;
  const previous = new Map<Object3D, Quaternion>();
  for (let frame = 0; frame <= 360; frame++) {
    const seconds = frame / 30; controller.update(seconds, 1 / 30, 'greeting', null, 0);
    asset.scene.updateWorldMatrix(true, true);
    const legs = controller.legs;
    asset.scene.position.y += asset.footClearance - Math.min(...legs.map(leg => leg.foot.getWorldPosition(point).y));
    asset.scene.updateWorldMatrix(true, true);
    legs[0].foot.getWorldPosition(point);
    if (!frame) leftAnchor.copy(point); else maxPlantError = Math.max(maxPlantError, point.distanceTo(leftAnchor));
    for (const bone of bones) {
      const last = previous.get(bone); if (last) maxJointChange = Math.max(maxJointChange, last.angleTo(bone.quaternion));
      previous.set(bone, bone.quaternion.clone());
    }
    if (frame === 30 || frame === 120) {
      handPositions.push(asset.scene.getObjectByName('HandR')!.getWorldPosition(new Vector3()).toArray());
      rightHeights.push(legs[1].foot.getWorldPosition(point).y);
    }
    if (frame <= 180) {
      times.push(seconds); positions.push(...asset.scene.position.toArray());
      bones.forEach((bone, i) => { data[i].positions.push(...bone.position.toArray()); data[i].rotations.push(...bone.quaternion.toArray()); });
    }
  }
  const tracks = [new VectorKeyframeTrack('ModelNormalization.position', times, positions)];
  const animationTracks: (VectorKeyframeTrack | QuaternionKeyframeTrack)[] = tracks;
  bones.forEach((bone, i) => animationTracks.push(new VectorKeyframeTrack(`${bone.name}.position`, times, data[i].positions), new QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, data[i].rotations)));
  await writeFile(resolve(rootPath, 'assets/processed/rosetta-greeting-preview.glb'), withAnimation(preview, binary, new AnimationClip('Rosetta_Wave_Pose', 6, animationTracks)));
  const handDistance = new Vector3().fromArray(handPositions[0]).distanceTo(new Vector3().fromArray(handPositions[1]));
  const report = { maxPlantError, maxJointChange, handDistance, rightHeights, frames: 361, browser: 'SKIPPED theo yêu cầu người dùng' };
  await writeFile(resolve(rootPath, 'test-results/rosetta-greeting-check.json'), JSON.stringify(report, null, 2)); console.log(report);
  assert.ok(maxPlantError < .02, 'Chân trụ trượt quá 2 cm');
  assert.ok(handDistance > .15, 'Tay không chuyển rõ giữa vẫy và tạo dáng');
  assert.ok(rightHeights[1] - rightHeights[0] > .15, 'Chân phải không hạ/nâng khi đổi dáng');
  assert.ok(maxJointChange < .35, 'Có frame xoay khớp đột ngột');
  clearCharacterAssets();
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
