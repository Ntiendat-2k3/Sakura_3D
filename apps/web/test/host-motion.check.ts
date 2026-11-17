/** Kiểm tra di chuyển của DJ Rio (Galaxy VRM) với dáng đi chung Dwarf Walk dọc theo hành trình xuống bàn DJ. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AnimationClip, Box3, Group, QuaternionKeyframeTrack, SkinnedMesh, Vector3, VectorKeyframeTrack } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import definitions from '../game/entities/club-npcs.json';
import { createHostLocomotion, SHARED_WALK_CLIP_ID } from '../game/systems/hostLocomotion';
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
  const boneNames = ['hips', 'spine', 'head', 'leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm', 'leftHand', 'rightHand', 'leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg', 'leftFoot', 'rightFoot'] as const;
  const bones = boneNames.map(name => vrm.humanoid.getRawBoneNode(name)!);
  const times: number[] = [], roots: number[] = [], rotations: number[] = [], data = bones.map(() => ({ positions: [] as number[], rotations: [] as number[] }));
  const route = createDjRoute(0, -2.95), duration = getDjTravelDuration(route.length);
  for (const phase of ['approaching', 'ready', 'returning'] as const) {
    const motion = createHostLocomotion(vrm, footClearance, createDjVisitMotion({ ...DEFAULT_DJ_VISIT, phase, targetX: 0, targetZ: -2.95, playerX: 0, playerZ: -2, returnDistance: route.length }));
    const end = phase === 'ready' ? 2 : duration;
    for (let t = 0; t <= end; t += 1 / 60) {
      motion.update(t, 1 / 60, root);
      assert.ok(bones.every(bone => [...bone.position.toArray(), ...bone.quaternion.toArray()].every(Number.isFinite)));
      if (phase === 'approaching' && times.length <= 150) {
        times.push(t); roots.push(...root.position.toArray()); rotations.push(...root.quaternion.toArray());
        bones.forEach((bone, index) => { data[index].positions.push(...bone.position.toArray()); data[index].rotations.push(...bone.quaternion.toArray()); });
      }
    }
  }
  const tracks = [new VectorKeyframeTrack(`${root.name}.position`, times, roots), new QuaternionKeyframeTrack(`${root.name}.quaternion`, times, rotations)];
  preview.nodes[modelNode].translation = vrm.scene.position.toArray();
  bones.forEach((bone, i) => { tracks.push(new VectorKeyframeTrack(`${bone.name}.position`, times, data[i].positions), new QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, data[i].rotations)); });
  await writeFile(resolve(rootPath, 'assets/processed/galaxy-walk-preview.glb'), withAnimation(preview, binary, new AnimationClip(SHARED_WALK_CLIP_ID, 5, tracks)));
  await writeFile(resolve(rootPath, 'test-results/dj-visit-motion.json'), JSON.stringify({ clip: SHARED_WALK_CLIP_ID, routeLength: route.length, duration, browser: 'SKIPPED theo yêu cầu người dùng' }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
