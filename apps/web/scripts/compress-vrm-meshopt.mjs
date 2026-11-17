// Nén hình học VRM/GLB bằng EXT_meshopt_compression ở mức bufferView.
// Không dùng gltf-transform/gltfpack vì chúng bỏ extension VRM; cách này giữ nguyên chỉ số node/mesh/material/accessor
// nên extension VRM vẫn hợp lệ. Next phục vụ .vrm dạng application/octet-stream (không gzip) nên nén ở file là cách duy nhất giảm tải mạng.
// Dùng: node apps/web/scripts/compress-vrm-meshopt.mjs <file.vrm> [...]
// Bản gốc được giữ ở assets/processed/meshopt-raw/ trước khi ghi đè; file đã nén sẽ được bỏ qua.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { align, readGlb, writeGlb } from './glb-binary.mjs';

const EXT = 'EXT_meshopt_compression';
const RAW_DIR = resolve(import.meta.dirname, '../../../assets/processed/meshopt-raw');
const COMPONENT_BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

// meshoptimizer chỉ có sẵn qua @gltf-transform/cli (pnpm không hoist), nên resolve từ gói đó.
const cliRequire = createRequire(createRequire(import.meta.url).resolve('@gltf-transform/cli'));
const { MeshoptEncoder } = await import(pathToFileURL(cliRequire.resolve('meshoptimizer')).href);
await MeshoptEncoder.ready;

/** Chỉ nén view chứa đúng một accessor liền mạch; còn lại (ảnh, view dùng chung, interleaved) giữ nguyên. */
function encodingFor(index, view, accessorsByView, indexAccessors, imageViews) {
  const users = accessorsByView.get(index) ?? [];
  if (imageViews.has(index) || users.length !== 1 || view.byteStride) return undefined;
  const [accessorIndex, accessor] = users[0];
  if (accessor.byteOffset) return undefined;
  const size = COMPONENT_BYTES[accessor.componentType] * COMPONENTS[accessor.type];
  if (size * accessor.count !== view.byteLength) return undefined;
  if (indexAccessors.has(accessorIndex)) return accessor.count % 3 === 0 && (size === 2 || size === 4) ? { mode: 'TRIANGLES', stride: size, count: accessor.count } : undefined;
  return size % 4 === 0 && size <= 256 ? { mode: 'ATTRIBUTES', stride: size, count: accessor.count } : undefined;
}

function compress(bytes) {
  const { json, bin } = readGlb(bytes);
  if (json.extensionsUsed?.includes(EXT)) return undefined;
  if (json.buffers?.length !== 1) throw new Error('Chỉ hỗ trợ GLB một buffer');
  const indexAccessors = new Set(json.meshes.flatMap(mesh => mesh.primitives.filter(p => (p.mode ?? 4) === 4 && p.indices != null).map(p => p.indices)));
  const imageViews = new Set((json.images ?? []).map(image => image.bufferView));
  const accessorsByView = new Map();
  json.accessors.forEach((accessor, index) => {
    if (accessor.bufferView != null) accessorsByView.set(accessor.bufferView, [...(accessorsByView.get(accessor.bufferView) ?? []), [index, accessor]]);
  });
  const parts = [];
  let offset = 0, fallbackLength = 0;
  const append = data => { const at = offset; parts.push(data, Buffer.alloc(align(data.length) - data.length)); offset += align(data.length); return at; };
  json.bufferViews = json.bufferViews.map((view, index) => {
    const data = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    const encoding = encodingFor(index, view, accessorsByView, indexAccessors, imageViews);
    if (!encoding) return { ...view, buffer: 0, byteOffset: append(data) };
    const encoded = Buffer.from(MeshoptEncoder.encodeGltfBuffer(new Uint8Array(data), encoding.count, encoding.stride, encoding.mode));
    // Buffer 1 là fallback không có dữ liệu; loader có decoder chỉ đọc phần nén trong buffer 0.
    const compressed = { buffer: 1, byteOffset: fallbackLength, byteLength: view.byteLength, extensions: { [EXT]: { buffer: 0, byteOffset: append(encoded), byteLength: encoded.length, byteStride: encoding.stride, count: encoding.count, mode: encoding.mode } } };
    fallbackLength += align(view.byteLength);
    return compressed;
  });
  const body = Buffer.concat(parts);
  json.buffers = [{ byteLength: body.length }, { byteLength: fallbackLength, extensions: { [EXT]: { fallback: true } } }];
  json.extensionsUsed = [...new Set([...(json.extensionsUsed ?? []), EXT])];
  json.extensionsRequired = [...new Set([...(json.extensionsRequired ?? []), EXT])];
  return writeGlb(json, body);
}

const files = process.argv.slice(2);
if (!files.length) throw new Error('Cần ít nhất một đường dẫn .vrm/.glb');
mkdirSync(RAW_DIR, { recursive: true });
for (const file of files) {
  const source = readFileSync(file);
  const output = compress(source);
  if (!output) { console.log(`${basename(file)}: đã nén, bỏ qua`); continue; }
  const backup = resolve(RAW_DIR, basename(file));
  if (!existsSync(backup)) copyFileSync(file, backup);
  writeFileSync(file, output);
  console.log(`${basename(file)}: ${(source.length / 1048576).toFixed(2)}MB -> ${(output.length / 1048576).toFixed(2)}MB (bản gốc: ${backup})`);
}
