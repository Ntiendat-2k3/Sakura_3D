// Đọc/ghi GLB ở mức JSON + BIN thô, dùng chung cho các script tối ưu nhân vật.
// Không đi qua document API của gltf-transform vì nó bỏ extension VRM; thao tác thô giữ nguyên mọi chỉ số
// node/mesh/material/accessor/image nên extension VRM (tham chiếu bằng chỉ số) vẫn hợp lệ.
const EXT_MESHOPT = 'EXT_meshopt_compression';
export const align = n => (n + 3) & ~3;

export function readGlb(bytes) {
  if (bytes.toString('utf8', 0, 4) !== 'glTF') throw new Error('Không phải GLB');
  const jsonLength = bytes.readUInt32LE(12);
  const binStart = 20 + jsonLength + 8;
  return { json: JSON.parse(bytes.subarray(20, 20 + jsonLength).toString()), bin: bytes.subarray(binStart, binStart + bytes.readUInt32LE(20 + jsonLength)) };
}

export function writeGlb(json, body) {
  let text = Buffer.from(JSON.stringify(json));
  text = Buffer.concat([text, Buffer.alloc(align(text.length) - text.length, 0x20)]);
  // Chunk BIN bắt buộc căn 4 byte theo đặc tả GLB.
  if (body.length % 4) body = Buffer.concat([body, Buffer.alloc(align(body.length) - body.length)]);
  const chunk = (length, type) => { const header = Buffer.alloc(8); header.writeUInt32LE(length, 0); header.write(type, 4); return header; };
  const header = Buffer.alloc(12);
  header.write('glTF', 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + text.length + 8 + body.length, 8);
  return Buffer.concat([header, chunk(text.length, 'JSON'), text, chunk(body.length, 'BIN\0'), body]);
}

/**
 * Thay byte của các bufferView trong `replacements` rồi dồn lại toàn bộ buffer 0 (căn 4 byte).
 * Buffer 0 chứa cả view thường lẫn phần nén EXT_meshopt_compression (view nằm ở buffer fallback,
 * extension trỏ vào buffer 0), nên cả hai loại vùng đều phải dịch offset. Giữ thứ tự vùng như bản gốc
 * và không đổi số lượng/chỉ số của bất kỳ đối tượng glTF nào. Sửa `json` tại chỗ, trả BIN mới.
 */
export function rebuildBuffer(json, bin, replacements) {
  for (const index of replacements.keys()) {
    if (json.bufferViews[index]?.buffer !== 0) throw new Error(`bufferView ${index} không nằm trong buffer 0`);
  }
  const regions = [];
  json.bufferViews.forEach((view, index) => {
    if (view.buffer === 0) regions.push({ target: view, index });
    const meshopt = view.extensions?.[EXT_MESHOPT];
    if (meshopt?.buffer === 0) regions.push({ target: meshopt });
  });
  regions.sort((a, b) => (a.target.byteOffset ?? 0) - (b.target.byteOffset ?? 0));
  // Vùng chồng nhau (view dùng chung byte) không dồn an toàn được; dừng thay vì ghi ra file hỏng.
  let end = 0;
  for (const { target } of regions) {
    const start = target.byteOffset ?? 0;
    if (start < end) throw new Error('Các vùng trong buffer 0 chồng nhau, không hỗ trợ');
    end = start + target.byteLength;
  }
  if (end > bin.length) throw new Error('bufferView vượt quá BIN');
  const parts = [];
  let offset = 0;
  for (const { target, index } of regions) {
    const start = target.byteOffset ?? 0;
    const data = (index !== undefined && replacements.get(index)) || bin.subarray(start, start + target.byteLength);
    parts.push(data, Buffer.alloc(align(data.length) - data.length));
    target.byteOffset = offset;
    target.byteLength = data.length;
    offset += align(data.length);
  }
  const body = Buffer.concat(parts);
  json.buffers[0].byteLength = body.length;
  return body;
}

/** Kiểm GLB sau khi ghi: mọi vùng tham chiếu buffer 0 (view thường và phần nén meshopt) phải nằm trọn trong BIN. */
export function checkGlb(json, bin) {
  if (json.buffers[0].byteLength > bin.length) throw new Error('buffers[0].byteLength lớn hơn BIN');
  json.bufferViews.forEach((view, index) => {
    for (const region of [view, view.extensions?.[EXT_MESHOPT]]) {
      if (region?.buffer !== 0) continue;
      const end = (region.byteOffset ?? 0) + region.byteLength;
      if (end > json.buffers[0].byteLength) throw new Error(`bufferView ${index} vượt quá buffer 0`);
    }
  });
}
