import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readGlb, rebuildBuffer, writeGlb } from '../scripts/glb-binary.mjs';

/** GLB tối thiểu: view 0 là dữ liệu 12 byte, view 1 là ảnh 8 byte (giống bố cục VRM thật). */
function fixture() {
  const bin = Buffer.concat([Buffer.alloc(12, 0xaa), Buffer.alloc(8, 0xbb)]);
  const json = {
    asset: { version: '2.0' },
    extensionsUsed: ['VRM'],
    extensions: { VRM: { meta: { title: 'giữ nguyên' } } },
    buffers: [{ byteLength: bin.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 12 }, { buffer: 0, byteOffset: 12, byteLength: 8 }],
    images: [{ bufferView: 1, mimeType: 'image/png' }],
  };
  return { json, bin };
}

test('thay ảnh bằng dữ liệu dài hơn: dồn offset căn 4 và cập nhật buffer', () => {
  const { json } = fixture();
  // Đặt ảnh lên trước để view sau phải dịch theo.
  json.bufferViews = [{ buffer: 0, byteOffset: 0, byteLength: 8 }, { buffer: 0, byteOffset: 8, byteLength: 12 }];
  const source = Buffer.concat([Buffer.alloc(8, 0xbb), Buffer.alloc(12, 0xaa)]);
  json.images = [{ bufferView: 0, mimeType: 'image/png' }];
  const image = Buffer.alloc(21, 0xcc);
  const out = rebuildBuffer(json, source, new Map([[0, image]]));
  assert.deepEqual(json.bufferViews[0], { buffer: 0, byteOffset: 0, byteLength: 21 });
  assert.deepEqual(json.bufferViews[1], { buffer: 0, byteOffset: 24, byteLength: 12 });
  assert.equal(json.buffers[0].byteLength, out.length);
  assert.equal(out.length, 36);
  assert.deepEqual(out.subarray(0, 21), image);
  assert.deepEqual(out.subarray(24, 36), Buffer.alloc(12, 0xaa));
});

test('thay ảnh 8 byte bằng 20 byte, extension VRM còn nguyên, đọc lại được', () => {
  const { json, bin } = fixture();
  const out = rebuildBuffer(json, bin, new Map([[1, Buffer.alloc(20, 0xcc)]]));
  assert.deepEqual(json.bufferViews[1], { buffer: 0, byteOffset: 12, byteLength: 20 });
  assert.equal(json.buffers[0].byteLength, 32);
  assert.deepEqual(json.extensions.VRM, { meta: { title: 'giữ nguyên' } });
  assert.deepEqual(json.extensionsUsed, ['VRM']);
  const again = readGlb(writeGlb(json, out));
  assert.deepEqual(again.json, json);
  assert.deepEqual(again.bin.subarray(12, 32), Buffer.alloc(20, 0xcc));
  assert.deepEqual(again.bin.subarray(0, 12), Buffer.alloc(12, 0xaa));
});

test('view nén meshopt trỏ vào buffer 0: byteOffset của extension được dịch theo', () => {
  const bin = Buffer.concat([Buffer.alloc(8, 0xbb), Buffer.alloc(6, 0xdd), Buffer.alloc(2)]);
  const meshopt = { buffer: 0, byteOffset: 8, byteLength: 6, byteStride: 4, count: 3, mode: 'ATTRIBUTES' };
  const json = {
    asset: { version: '2.0' },
    extensionsUsed: ['VRM', 'EXT_meshopt_compression'],
    extensions: { VRM: {} },
    buffers: [{ byteLength: 16 }, { byteLength: 12, extensions: { EXT_meshopt_compression: { fallback: true } } }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 8 },
      { buffer: 1, byteOffset: 0, byteLength: 12, extensions: { EXT_meshopt_compression: meshopt } },
    ],
    images: [{ bufferView: 0, mimeType: 'image/png' }],
  };
  const out = rebuildBuffer(json, bin, new Map([[0, Buffer.alloc(13, 0xcc)]]));
  const ext = json.bufferViews[1].extensions!.EXT_meshopt_compression;
  assert.equal(ext.byteOffset, 16);
  assert.equal(ext.byteLength, 6);
  // View dữ liệu thật vẫn nằm ở buffer fallback, không bị đụng.
  assert.equal(json.bufferViews[1].buffer, 1);
  assert.equal(json.bufferViews[1].byteOffset, 0);
  assert.equal(json.buffers[1].byteLength, 12);
  assert.equal(json.buffers[0].byteLength, out.length);
  assert.deepEqual(out.subarray(16, 22), Buffer.alloc(6, 0xdd));
  assert.deepEqual(json.extensions.VRM, {});
});
