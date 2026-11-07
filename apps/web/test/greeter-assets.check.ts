/** Kiểm tra rig/clip và tài nguyên HTTP thật bằng Node; không mở trình duyệt hay phát âm thanh. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { AnimationMixer, Box3, Group, PropertyBinding, SkinnedMesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import definitions from '../game/entities/club-npcs.json';
import { ROSETTA_BONE_MAPPING } from '../game/systems/rosettaMotion';
import { retargetSkeletonMotion } from '../game/systems/retargetSkeletonMotion';
import type { Motion } from '../game/systems/retargetClubMotion';
import { unpack } from './glb';

const root = resolve(__dirname, '../../..');

async function main() {
  const candidate = process.argv.includes('--candidate');
  const bytes = await readFile(candidate ? resolve(root, 'assets/processed/rosetta-restored.glb') : resolve(root, 'apps/web/public', definitions.rosetta.url.slice(1)));
  const { doc, binary } = unpack(bytes);
  const restored = doc.animations?.[0]?.name === 'Rosetta_Render_Idle';
  for (const material of doc.materials) {
    const masked = material.name.startsWith('Face') || material.name.startsWith('Eye_');
    assert.equal(material.alphaMode, masked ? 'MASK' : 'OPAQUE', `Alpha sai ở ${material.name}`);
    if (masked) assert.equal(material.alphaCutoff, .3);
  }
  const previewDoc = JSON.parse(JSON.stringify(doc));
  assert.equal(doc.animations.length, 1);
  assert.equal(doc.animations[0].name, restored ? 'Rosetta_Render_Idle' : 'Rosetta_Welcome_Wave');
  if (candidate) assert.ok(restored, 'Bản phục hồi thiếu clip idle hợp nhất');
  assert.ok(doc.meshes.some((mesh: { name?: string }) => mesh.name === 'Costume'));
  assert.ok(!doc.nodes.some((node: { name?: string }) => /costumeoff|castoff/i.test(node.name ?? '')));
  // Node không giải mã ảnh: giữ nguyên geometry, skin, animation; bỏ material chỉ trong bản kiểm tra trên RAM.
  delete doc.images; delete doc.textures; delete doc.materials;
  if (restored) {
    assert.ok(doc.nodes.some((node: { name?: string }) => node.name === 'Eye_decal'));
    assert.ok(doc.nodes.some((node: { name?: string }) => node.name === 'mouth_decal'));
  }
  for (const mesh of doc.meshes) for (const primitive of mesh.primitives) delete primitive.material;
  let json = Buffer.from(JSON.stringify(doc));
  json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
  const header = Buffer.alloc(20), binHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + json.length + binary.length, 8);
  header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  binHeader.writeUInt32LE(binary.length); binHeader.writeUInt32LE(0x004e4942, 4);
  const glb = Buffer.concat([header, json, binHeader, binary]);
  const model = await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
  const mixer = new AnimationMixer(model.scene);
  assert.ok(Math.abs(model.animations[0].duration - (restored ? 8 : 4)) < .01);
  mixer.clipAction(model.animations[0]).play();
  const hand = model.scene.getObjectByName(PropertyBinding.sanitizeNodeName('Hand.R'));
  assert.ok(hand, 'Thiếu bone vẫy tay');
  const positions: number[][] = [], heights: number[] = [];
  for (const t of [.25, .75, 1.25, 1.75]) {
    mixer.setTime(t); model.scene.updateMatrixWorld(true);
    model.scene.traverse(node => { if (node instanceof SkinnedMesh) node.computeBoundingBox(); });
    positions.push(hand.getWorldPosition(new Vector3()).toArray());
    const box = new Box3().setFromObject(model.scene); heights.push(box.max.y - box.min.y);
  }
  const distance = new Vector3().fromArray(positions[0]).distanceTo(new Vector3().fromArray(positions[1]));
  assert.ok(distance > (restored ? .0001 : .01), `Thiếu chuyển động idle: ${distance}; ${JSON.stringify(positions)}`);
  assert.ok(heights.every(h => Number.isFinite(h) && h > 1 && h < 3), 'Scale/hệ trục không hợp lệ');
  let blinkVerified = false;
  if (restored) {
    let face: SkinnedMesh | undefined;
    model.scene.traverse(node => { if (node instanceof SkinnedMesh && node.morphTargetDictionary?.blink_left !== undefined) face = node; });
    assert.ok(face, 'Thiếu morph chớp mắt');
    const index = face.morphTargetDictionary!.blink_left;
    mixer.setTime(3.4); assert.ok(face.morphTargetInfluences![index] < .1);
    mixer.setTime(3.6); assert.ok(face.morphTargetInfluences![index] > .85);
    blinkVerified = true;
  }

  const beforeRetarget: number[][] = [];
  model.scene.traverse(node => beforeRetarget.push([...node.position.toArray(), ...node.quaternion.toArray()]));
  const motion = JSON.parse(await readFile(resolve(root, 'apps/web/public/assets/animations/club/GentleSwayingDancing.json'), 'utf8')) as Motion;
  const dance = retargetSkeletonMotion(motion, model.scene, ROSETTA_BONE_MAPPING);
  const afterRetarget: number[][] = [];
  model.scene.traverse(node => afterRetarget.push([...node.position.toArray(), ...node.quaternion.toArray()]));
  assert.deepEqual(afterRetarget, beforeRetarget, 'Retarget phải khôi phục pose đang hiển thị');
  assert.ok(dance.tracks.length >= 15); assert.ok(dance.tracks.every(track => track.name.endsWith('.quaternion')));
  mixer.stopAllAction(); mixer.clipAction(dance).play();
  const danceHeights: number[] = [];
  for (const time of [0, 1, 3, 6, 10, 15]) {
    mixer.setTime(time); model.scene.updateWorldMatrix(true, true);
    model.scene.traverse(node => { if (node instanceof SkinnedMesh) node.computeBoundingBox(); });
    const bounds = new Box3().setFromObject(model.scene); danceHeights.push(bounds.max.y - bounds.min.y);
    const head = model.scene.getObjectByName('Head')!.getWorldPosition(new Vector3()), hips = model.scene.getObjectByName('Hips')!.getWorldPosition(new Vector3());
    assert.ok(head.y - hips.y > .3, 'Rig bị xoay ngang vì Armature parent');
    model.scene.traverse(node => { assert.ok(node.position.toArray().every(Number.isFinite)); assert.ok(Math.abs(node.quaternion.length() - 1) < 1e-4); });
  }
  assert.ok(danceHeights.every(h => h > 1 && h < 3));
  const parent = new Group(); parent.rotation.y = -1.2; parent.position.set(3.5, 0, 2.5);
  const savedScale = model.scene.scale.clone(), savedPosition = model.scene.position.clone();
  model.scene.scale.setScalar(1.2); model.scene.position.y = .1; parent.add(model.scene);
  const placedDance = retargetSkeletonMotion(motion, model.scene, ROSETTA_BONE_MAPPING);
  dance.tracks.forEach((track, index) => track.values.forEach((value, i) => assert.ok(Math.abs(value - placedDance.tracks[index].values[i]) < 1e-4, 'Retarget phụ thuộc góc/scale ngoài scene')));
  parent.remove(model.scene); model.scene.scale.copy(savedScale); model.scene.position.copy(savedPosition); model.scene.updateWorldMatrix(true, true);
  const additions: Buffer[] = []; let byteLength = binary.length;
  function accessor(array: Float32Array, type: 'SCALAR' | 'VEC4') {
    const data = Buffer.from(array.buffer, array.byteOffset, array.byteLength), view = previewDoc.bufferViews.length;
    previewDoc.bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: data.length }); additions.push(data); byteLength += data.length;
    const index = previewDoc.accessors.length;
    previewDoc.accessors.push({ bufferView: view, componentType: 5126, count: array.length / (type === 'VEC4' ? 4 : 1), type, ...(type === 'SCALAR' ? { min: [array[0]], max: [array[array.length - 1]] } : {}) });
    return index;
  }
  const animation = { name: dance.name, samplers: [] as { input: number; output: number; interpolation: string }[], channels: [] as { sampler: number; target: { node: number; path: string } }[] };
  for (const track of dance.tracks) {
    const name = track.name.slice(0, -'.quaternion'.length), node = previewDoc.nodes.findIndex((item: { name?: string }) => PropertyBinding.sanitizeNodeName(item.name ?? '') === name);
    assert.ok(node >= 0);
    animation.channels.push({ sampler: animation.samplers.length, target: { node, path: 'rotation' } });
    animation.samplers.push({ input: accessor(track.times as Float32Array, 'SCALAR'), output: accessor(track.values as Float32Array, 'VEC4'), interpolation: 'LINEAR' });
  }
  previewDoc.animations = [animation]; previewDoc.buffers[0].byteLength = byteLength;
  let previewJson = Buffer.from(JSON.stringify(previewDoc)); previewJson = Buffer.concat([previewJson, Buffer.alloc((4 - previewJson.length % 4) % 4, 32)]);
  const previewHeader = Buffer.from(header), previewBinHeader = Buffer.from(binHeader);
  previewHeader.writeUInt32LE(28 + previewJson.length + byteLength, 8); previewHeader.writeUInt32LE(previewJson.length, 12); previewBinHeader.writeUInt32LE(byteLength);
  if (!candidate) await writeFile(resolve(root, 'assets/processed/rosetta-dance-preview.glb'), Buffer.concat([previewHeader, previewJson, previewBinHeader, binary, ...additions]));

  const sourceGalaxy = unpack(await readFile(resolve(root, 'assets/source/characters/club-import/club-e1/Galaxy Summer.vrm')));
  const runtimeGalaxy = unpack(await readFile(resolve(root, 'apps/web/public', definitions.galaxy.url.slice(1))));
  assert.deepEqual(runtimeGalaxy.doc.extensions.VRM, sourceGalaxy.doc.extensions.VRM, 'Metadata/quyền VRM phải được giữ nguyên');
  for (const view of runtimeGalaxy.doc.bufferViews) assert.ok((view.byteOffset ?? 0) + view.byteLength <= runtimeGalaxy.binary.length);

  const http = [];
  for (const id of ['rosetta', 'galaxy'] as const) {
    if (candidate && id === 'rosetta') continue;
    const file = await readFile(resolve(root, 'apps/web/public', definitions[id].url.slice(1)));
    const response = await fetch(`http://127.0.0.1:3000${definitions[id].url}`);
    assert.equal(response.status, 200);
    const received = Buffer.from(await response.arrayBuffer());
    const hash = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex');
    assert.equal(hash(received), hash(file));
    http.push({ id, bytes: received.length, sha256: hash(received), status: response.status });
  }
  const report = { status: 'PASS', rosetta: { restored, blinkVerified, clips: model.animations.map(clip => clip.name), duration: model.animations[0].duration, handDisplacement: distance, sampledHeights: heights, costumePresent: true, interactionDance: { clip: dance.name, duration: dance.duration, tracks: dance.tracks.length, sampledHeights: danceHeights, poseRestoredAfterRetarget: true } }, galaxy: { metadataPreserved: true, license: runtimeGalaxy.doc.extensions.VRM.meta }, http, browserTest: 'SKIPPED: user has not authorized opening a browser' };
  await writeFile(resolve(root, candidate ? 'test-results/rosetta-restored-assets.json' : 'test-results/club-greeter-assets.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, handDisplacement: distance, http }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
