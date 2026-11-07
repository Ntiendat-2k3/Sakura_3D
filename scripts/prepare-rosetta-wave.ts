/** Tách clip vẫy tay đã tạo trước đó, giữ rest pose để chuyển sang rig render mà không tải lại mesh cũ. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { GLTFLoader } from '../apps/web/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { unpack, pack } from '../apps/web/test/glb';
import { readRosettaBindPose } from '../apps/web/game/systems/rosettaMotion';
const root = resolve(__dirname, '..');
async function main() {
  const { doc, binary } = unpack(await readFile(resolve(root, 'assets/processed/rosetta-before-restore/rosetta.glb')));
  delete doc.images; delete doc.textures; delete doc.materials;
  for (const mesh of doc.meshes) for (const primitive of mesh.primitives) delete primitive.material;
  const bytes = pack(doc, binary), gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const rest = readRosettaBindPose(gltf.scene), clip = gltf.animations[0];
  const bones: Record<string, object> = {}, tracks = [];
  for (const [name, bone] of rest) {
    const track = clip.tracks.find(value => value.name === `${bone.node.name}.quaternion`);
    if (!track) continue;
    bones[name] = { position: bone.node.position.toArray(), restWorld: bone.world.toArray(), parentWorld: bone.parentInverse.clone().invert().toArray() };
    tracks.push({ name: `${name}.quaternion`, times: Array.from(track.times, n => +n.toFixed(5)), values: Array.from(track.values, n => +n.toFixed(6)) });
  }
  const data = { id: 'Rosetta_Wave', source: 'Original authored Rosetta_Welcome_Wave, existing project backup', duration: clip.duration, bones, tracks };
  await writeFile(resolve(root, 'apps/web/public/assets/animations/club/Rosetta_Wave.json'), JSON.stringify(data));
  console.log({ tracks: tracks.length, duration: clip.duration });
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
