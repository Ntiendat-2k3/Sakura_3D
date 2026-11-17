/** Tiện ích fixture nhị phân glTF dùng chung cho kiểm tra rig và xuất clip chẩn đoán offline. */
import assert from 'node:assert/strict';
import { PropertyBinding, type AnimationClip } from 'three';

export function unpack(bytes: Buffer) {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67); assert.equal(bytes.readUInt32LE(8), bytes.length);
  const length = bytes.readUInt32LE(12);
  return { doc: JSON.parse(bytes.subarray(20, 20 + length).toString('utf8')), binary: bytes.subarray(28 + length) };
}
export function pack(doc: ReturnType<typeof unpack>['doc'], binary: Buffer) {
  let json = Buffer.from(JSON.stringify(doc)); json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
  const header = Buffer.alloc(20), bin = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + binary.length, 8);
  header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16); bin.writeUInt32LE(binary.length); bin.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, json, bin, binary]);
}
export function withAnimation(doc: ReturnType<typeof unpack>['doc'], binary: Buffer, clip: AnimationClip, append = false) {
  const additions: Buffer[] = []; let length = binary.length;
  // Các bone thường có cùng mốc lấy mẫu; dùng chung accessor để không nhân bản dãy thời gian trong GLB.
  const timeAccessors = new Map<string, number>();
  function accessor(array: Float32Array, type: string, components: number) {
    const data = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
    const timeKey = type === 'SCALAR' ? data.toString('base64') : undefined;
    const existing = timeKey === undefined ? undefined : timeAccessors.get(timeKey);
    if (existing !== undefined) return existing;
    const view = doc.bufferViews.length;
    doc.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: data.length }); additions.push(data); length += data.length;
    const index = doc.accessors.length;
    doc.accessors.push({ bufferView: view, componentType: 5126, count: array.length / components, type, ...(type === 'SCALAR' ? { min: [array[0]], max: [array[array.length - 1]] } : {}) });
    if (timeKey !== undefined) timeAccessors.set(timeKey, index);
    return index;
  }
  const animation = { name: clip.name, samplers: [] as object[], channels: [] as object[] };
  for (const track of clip.tracks) {
    const split = track.name.lastIndexOf('.'), name = track.name.slice(0, split), property = track.name.slice(split + 1);
    const node = doc.nodes.findIndex((item: { name?: string }) => PropertyBinding.sanitizeNodeName(item.name ?? '') === name);
    assert.ok(node >= 0, `Không tìm thấy node ${name}`);
    animation.channels.push({ sampler: animation.samplers.length, target: { node, path: property === 'quaternion' ? 'rotation' : 'translation' } });
    animation.samplers.push({ input: accessor(track.times as Float32Array, 'SCALAR', 1), output: accessor(track.values as Float32Array, property === 'quaternion' ? 'VEC4' : 'VEC3', property === 'quaternion' ? 4 : 3), interpolation: 'LINEAR' });
  }
  doc.animations = append ? [...(doc.animations ?? []).filter((item: { name?: string }) => item.name !== clip.name), animation] : [animation]; doc.buffers[0].byteLength = length;
  return pack(doc, Buffer.concat([binary, ...additions]));
}
