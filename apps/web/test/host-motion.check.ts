/** Chạy IK trên VRM Galaxy thật và xuất clip chẩn đoán; bỏ texture chỉ trong bản đọc trên RAM của Node. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AnimationClip, Box3, Group, QuaternionKeyframeTrack, SkinnedMesh, Vector3, VectorKeyframeTrack } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import definitions from '../game/entities/club-npcs.json';
import { createHostLocomotion } from '../game/systems/hostLocomotion';
import { unpack, pack, withAnimation } from './glb';
import { createDjVisitMotion } from '../game/systems/djVisitMotion';
import { createDjRoute, getDjTravelDuration, DEFAULT_DJ_VISIT } from '@metaverse/game-protocol';

async function main() {
  const rootPath = resolve(__dirname, '../../..');
  const { doc, binary } = unpack(await readFile(resolve(rootPath, 'apps/web/public', definitions.galaxy.url.slice(1))));
  const preview = JSON.parse(JSON.stringify(doc));
  delete doc.images; delete doc.textures; delete doc.extensions.VRM.meta.texture;
  doc.materials = doc.materials.map((material: { name: string }) => ({ name: material.name }));
  doc.extensions.VRM.materialProperties.forEach((material: { shader: string; textureProperties: object }) => { material.shader = 'VRM_USE_GLTFSHADER'; material.textureProperties = {}; });
  const bytes = pack(doc, binary), loader = new GLTFLoader(); loader.register(parser => new VRMLoaderPlugin(parser));
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const vrm = gltf.userData.vrm as VRM; assert.ok(vrm); VRMUtils.rotateVRM0(vrm);
  const bounds = new Box3().setFromObject(vrm.scene);
  const scale = definitions.galaxy.height / (bounds.max.y - bounds.min.y); vrm.scene.scale.setScalar(scale); vrm.scene.position.y = -bounds.min.y * scale;
  vrm.scene.updateWorldMatrix(true, true); vrm.scene.updateMatrixWorld(true);
  const soleVertices: { mesh: SkinnedMesh; index: number }[] = [], vertex = new Vector3();
  vrm.scene.traverse(node => {
    if (!(node instanceof SkinnedMesh)) return;
    const positions = node.geometry.attributes.position;
    for (let index = 0; index < positions.count; index++) {
      vertex.fromBufferAttribute(positions, index).applyMatrix4(node.matrixWorld);
      if (vertex.y < .04) soleVertices.push({ mesh: node, index });
    }
  });
  assert.ok(soleVertices.length > 0, 'Không tìm được đỉnh đế giày');
  const footClearance = Math.min(...(['leftFoot', 'rightFoot'] as const).map(side => vrm.humanoid.getRawBoneNode(side)!.getWorldPosition(new Vector3()).y));
  const root = new Group(); root.name = 'NpcRuntimeRoot'; root.add(vrm.scene);
  const modelNode = preview.nodes.length;
  preview.nodes.push({ name: 'ModelNormalization', children: preview.scenes[0].nodes, translation: vrm.scene.position.toArray(), rotation: vrm.scene.quaternion.toArray(), scale: vrm.scene.scale.toArray() });
  preview.nodes.push({ name: root.name, children: [modelNode] }); preview.scenes[0].nodes = [modelNode + 1];
  const controller = createHostLocomotion(vrm, footClearance), point = new Vector3();
  const boneNames = ['hips', 'spine', 'head', 'leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm', 'leftHand', 'rightHand', 'leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg', 'leftFoot', 'rightFoot'] as const;
  const bones = boneNames.map(name => vrm.humanoid.getRawBoneNode(name)!);
  const times: number[] = [], roots: number[] = [], rotations: number[] = [], data = bones.map(() => ({ positions: [] as number[], rotations: [] as number[] }));
  let maxError = 0, maxPlantError = 0, maxLift = 0, minSoleY = Infinity;
  const armRange = [{ min: Infinity, max: -Infinity }, { min: Infinity, max: -Infinity }];
  for (let frame = 0; frame <= 1860; frame++) {
    const time = frame / 30; controller.update(time, 1 / 30, root);
    for (const side of ['left', 'right'] as const) {
      const shoulderY = vrm.humanoid.getRawBoneNode(`${side}UpperArm`)!.getWorldPosition(point).y;
      assert.ok(vrm.humanoid.getRawBoneNode(`${side}Hand`)!.getWorldPosition(point).y < shoulderY - .25, 'Tay đi bộ bị giơ lên trên vai');
      if (controller.route.speed > .5) {
        point.sub(root.position); const distance = point.x * Math.sin(root.rotation.y) + point.z * Math.cos(root.rotation.y), range = armRange[side === 'left' ? 0 : 1];
        range.min = Math.min(range.min, distance); range.max = Math.max(range.max, distance);
      }
    }
    for (let i = 0; i < 2; i++) {
      vrm.humanoid.getRawBoneNode(i === 0 ? 'leftFoot' : 'rightFoot')!.getWorldPosition(point);
      const leg = controller.feet[i], error = point.distanceTo(leg.sample.position);
      maxError = Math.max(maxError, error); if (leg.sample.planted) maxPlantError = Math.max(maxPlantError, error);
      maxLift = Math.max(maxLift, leg.sample.position.y - root.position.y - controller.ankleClearance);
      assert.ok(point.toArray().every(Number.isFinite));
    }
    if (frame % 10 === 0) {
      for (const { mesh, index } of soleVertices) minSoleY = Math.min(minSoleY, mesh.getVertexPosition(index, vertex).applyMatrix4(mesh.matrixWorld).y);
    }
    if (frame <= 150) {
      times.push(time); roots.push(...root.position.toArray()); rotations.push(...root.quaternion.toArray());
      bones.forEach((bone, index) => { data[index].positions.push(...bone.position.toArray()); data[index].rotations.push(...bone.quaternion.toArray()); });
    }
  }
  const tracks = [new VectorKeyframeTrack(`${root.name}.position`, times, roots), new QuaternionKeyframeTrack(`${root.name}.quaternion`, times, rotations)];
  preview.nodes[modelNode].translation = vrm.scene.position.toArray();
  bones.forEach((bone, i) => { tracks.push(new VectorKeyframeTrack(`${bone.name}.position`, times, data[i].positions), new QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, data[i].rotations)); });
  await writeFile(resolve(rootPath, 'assets/processed/galaxy-walk-preview.glb'), withAnimation(preview, binary, new AnimationClip('Galaxy_Walk', 5, tracks)));
  const report = { maxError, maxPlantError, maxLift, minSoleY, armSwingMeters: armRange.map(range => range.max - range.min), frames: 1861, browser: 'SKIPPED theo yêu cầu người dùng' };
  await writeFile(resolve(rootPath, 'test-results/galaxy-walk-check.json'), JSON.stringify(report, null, 2)); console.log(report);
  assert.ok(maxPlantError < .02, 'Chân trụ lệch khỏi điểm neo hơn 2 cm');
  assert.ok(maxLift > .04, 'Không có bước nhấc chân');
  assert.ok(minSoleY >= .086 - .015, 'Giày xuyên sàn quá 1.5 cm');
  assert.ok(armRange.every(range => range.max - range.min > .18), 'Tay không đánh theo bước chân');
  let djFootError = 0, worst: unknown;
  const route = createDjRoute(0, -2.95), duration = getDjTravelDuration(route.length);
  for (const phase of ['approaching', 'ready', 'returning'] as const) {
    const motion = createHostLocomotion(vrm, footClearance, createDjVisitMotion({ ...DEFAULT_DJ_VISIT, phase, targetX: 0, targetZ: -2.95, playerX: 0, playerZ: -2, returnDistance: route.length }));
    const end = phase === 'ready' ? 2 : duration;
    for (let t = 0; t <= end; t += 1 / 60) {
      motion.update(t, 1 / 60, root);
      for (const leg of motion.feet) { const error = leg.foot.getWorldPosition(point).distanceTo(leg.sample.position); if (error > djFootError) { djFootError = error; worst = { phase, t, root: root.position.toArray(), goal: leg.sample.position.toArray(), actual: point.toArray(), clearance: motion.ankleClearance }; } }
      assert.ok(bones.every(bone => [...bone.position.toArray(), ...bone.quaternion.toArray()].every(Number.isFinite)));
    }
  }
  await writeFile(resolve(rootPath, 'test-results/dj-visit-motion.json'), JSON.stringify({ djFootError, routeLength: route.length, duration, browser: 'SKIPPED theo yêu cầu người dùng' }, null, 2));
  console.log({ djFootError, duration, worst });
  assert.ok(djFootError < .04, 'Bước DJ vượt khả năng IK trên cầu thang');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
