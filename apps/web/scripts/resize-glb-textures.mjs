// Thu nhỏ texture nhúng trong VRM/GLB để giảm bộ nhớ GPU: ảnh 2048² chiếm ~21MB VRAM (kèm mipmap) mỗi tấm,
// trong khi NPC chỉ chiếm một phần nhỏ màn hình. Ảnh có cạnh dài >1024 thu về 1024; ảnh do material mặt/mắt
// tham chiếu được giữ tối đa 2048 vì người chơi nhìn gần mặt và mắt bị vỡ nét rất dễ thấy.
// Thao tác trên JSON + BIN thô (không qua gltf-transform) để không mất extension VRM.
// Dùng: node apps/web/scripts/resize-glb-textures.mjs [--dry-run] <file> [...]
// Bản gốc được giữ ở assets/processed/texture-raw/ trước khi ghi đè; file đã có bản gốc ở đó sẽ được bỏ qua.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { checkGlb, readGlb, rebuildBuffer, writeGlb } from './glb-binary.mjs';

const RAW_DIR = resolve(import.meta.dirname, '../../../assets/processed/texture-raw');
const MAX_SIZE = 1024;
const DETAIL_MAX_SIZE = 2048;
// Tên ảnh Gekka là mã vô nghĩa (_10, _11…) nên nhận diện ảnh mặt/mắt qua tên material tham chiếu tới nó.
const DETAIL_MATERIAL = /face|eye|顔|目/i;
const ENCODERS = { 'image/png': image => image.png({ compressionLevel: 9 }), 'image/jpeg': image => image.jpeg({ quality: 90 }), 'image/webp': image => image.webp({ quality: 90 }) };

// sharp chỉ có sẵn qua @gltf-transform/cli (pnpm không hoist), nên resolve từ gói đó.
const cliRequire = createRequire(createRequire(import.meta.url).resolve('@gltf-transform/cli'));
const { default: sharp } = await import(pathToFileURL(cliRequire.resolve('sharp')).href);

/** Chỉ số texture mà một material dùng: textureInfo glTF (kể cả trong extension) và textureProperties của VRM 0.x. */
function textureIndicesOf(material) {
  const found = [];
  const walk = (value, key) => {
    if (!value || typeof value !== 'object') return;
    if (/texture/i.test(key) && Number.isInteger(value.index)) found.push(value.index);
    for (const [childKey, child] of Object.entries(value)) walk(child, childKey);
  };
  walk(material, '');
  return found;
}

/** Map chỉ số ảnh → tên các material tham chiếu tới nó. */
function materialNamesByImage(json) {
  const byImage = new Map();
  const add = (textureIndex, name) => {
    const image = json.textures?.[textureIndex]?.source;
    if (image != null) byImage.set(image, new Set([...(byImage.get(image) ?? []), name ?? '']));
  };
  (json.materials ?? []).forEach(material => textureIndicesOf(material).forEach(index => add(index, material.name)));
  for (const vrm of json.extensions?.VRM?.materialProperties ?? []) Object.values(vrm.textureProperties ?? {}).forEach(index => add(index, vrm.name));
  return byImage;
}

async function plan(json, bin) {
  const names = materialNamesByImage(json);
  const rows = [], replacements = new Map();
  for (const [index, image] of (json.images ?? []).entries()) {
    if (image.bufferView == null) continue;
    const view = json.bufferViews[image.bufferView];
    const data = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    const { width, height } = await sharp(data).metadata();
    const users = [...(names.get(index) ?? [])];
    const detail = users.some(name => DETAIL_MATERIAL.test(name));
    const limit = detail ? DETAIL_MAX_SIZE : MAX_SIZE;
    const row = { index, name: image.name ?? '', from: `${width}x${height}`, to: `${width}x${height}`, decision: detail ? 'giữ (mặt/mắt)' : 'giữ', users };
    rows.push(row);
    if (Math.max(width, height) <= limit) continue;
    const encode = ENCODERS[image.mimeType];
    if (!encode) { row.decision = `giữ (không hỗ trợ ${image.mimeType})`; continue; }
    const resized = await encode(sharp(data).resize({ width: limit, height: limit, fit: 'inside' })).toBuffer({ resolveWithObject: true });
    replacements.set(image.bufferView, resized.data);
    row.to = `${resized.info.width}x${resized.info.height}`;
    row.decision = `thu về ${limit}${detail ? ' (mặt/mắt)' : ''}`;
  }
  return { rows, replacements };
}

/** Ghi đè chỉ khi bản mới giữ nguyên extension và số lượng đối tượng; tránh để lại asset hỏng. */
function verify(before, output) {
  const { json, bin } = readGlb(output);
  checkGlb(json, bin);
  if (JSON.stringify(json.extensionsUsed) !== JSON.stringify(before.extensionsUsed)) throw new Error('extensionsUsed bị thay đổi');
  for (const key of ['images', 'textures', 'materials', 'meshes', 'accessors', 'bufferViews', 'nodes']) {
    if ((json[key]?.length ?? 0) !== (before[key]?.length ?? 0)) throw new Error(`Số ${key} bị thay đổi`);
  }
}

const dryRun = process.argv.includes('--dry-run');
const files = process.argv.slice(2).filter(arg => arg !== '--dry-run');
if (!files.length) throw new Error('Cần ít nhất một đường dẫn .vrm/.glb');
mkdirSync(RAW_DIR, { recursive: true });
for (const file of files) {
  const backup = resolve(RAW_DIR, basename(file));
  if (existsSync(backup)) { console.log(`${basename(file)}: đã có bản gốc ở ${backup}, bỏ qua`); continue; }
  const source = readFileSync(file);
  const { json, bin } = readGlb(source);
  const before = structuredClone(json);
  const { rows, replacements } = await plan(json, bin);
  console.log(`\n${basename(file)}`);
  console.log('| # | Ảnh | Cũ | Mới | Quyết định | Material |');
  console.log('|---|---|---|---|---|---|');
  for (const row of rows) console.log(`| ${row.index} | ${row.name} | ${row.from} | ${row.to} | ${row.decision} | ${row.users.slice(0, 2).join(', ')}${row.users.length > 2 ? ` (+${row.users.length - 2})` : ''} |`);
  if (!replacements.size) { console.log(`${basename(file)}: không có ảnh cần thu nhỏ`); continue; }
  const output = writeGlb(json, rebuildBuffer(json, bin, replacements));
  verify(before, output);
  if (dryRun) { console.log(`${basename(file)}: (dry-run) ${(source.length / 1048576).toFixed(2)}MB -> ${(output.length / 1048576).toFixed(2)}MB`); continue; }
  copyFileSync(file, backup);
  writeFileSync(file, output);
  console.log(`${basename(file)}: ${(source.length / 1048576).toFixed(2)}MB -> ${(output.length / 1048576).toFixed(2)}MB (bản gốc: ${backup})`);
}
