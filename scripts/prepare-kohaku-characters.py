"""Tối ưu dung lượng texture cho 3 NPC Kohaku Club (Shinku, Hinata, Bartender Caca) từ nguồn VRM 0.x/1.0, giữ nguyên toàn bộ metadata và skin."""
import hashlib
import json
import struct
import tempfile
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / 'assets/source/characters/kohaku-import'
OUT_DIR = ROOT / 'apps/web/public/assets/characters/club-local'
MAX_TEXTURE_PX = 768

CHARACTERS = [
    ('shinku', 'shinku.vrm', 'kohaku-dealer'),
    ('hinata', 'hinata.vrm', 'kohaku-greeter'),
    ('bartender', 'caca.vrm', 'kohaku-bartender'),
]


def parse_glb(raw: bytes):
    magic, version, total_len = struct.unpack_from('<III', raw, 0)
    if magic != 0x46546C67 or version != 2:
        raise ValueError('Tệp VRM không đúng chuẩn glTF 2.0 binary')
    pos = 12
    doc = None
    bin_data = b''
    while pos < total_len:
        chunk_len, chunk_type = struct.unpack_from('<II', raw, pos)
        payload = raw[pos + 8:pos + 8 + chunk_len]
        if chunk_type == 0x4E4F534A:
            doc = json.loads(payload.decode('utf-8'))
        elif chunk_type == 0x004E4942:
            bin_data = payload
        pos += 8 + chunk_len
    if doc is None:
        raise ValueError('Thiếu JSON chunk trong VRM')
    return doc, bin_data


def downscale_image_bytes(img_bytes: bytes, mime: str, temp_dir: Path, idx: int, max_dim: int):
    ext = '.jpg' if 'jpeg' in mime or 'jpg' in mime else '.png'
    src_path = temp_dir / f'src_{idx}{ext}'
    src_path.write_bytes(img_bytes)
    image = bpy.data.images.load(str(src_path), check_existing=False)
    try:
        w, h = image.size[0], image.size[1]
        if w <= 0 or h <= 0 or max(w, h) <= max_dim:
            return img_bytes, mime, [w, h], [w, h]
        scale = max_dim / max(w, h)
        nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
        image.scale(nw, nh)
        out_path = temp_dir / f'dst_{idx}.png'
        image.filepath_raw = str(out_path)
        image.file_format = 'PNG'
        image.save()
        return out_path.read_bytes(), 'image/png', [w, h], [nw, nh]
    finally:
        bpy.data.images.remove(image)


def build_glb(doc: dict, bin_bytes: bytes) -> bytes:
    encoded = json.dumps(doc, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    while len(encoded) % 4 != 0:
        encoded += b' '
    padded_bin = bytearray(bin_bytes)
    while len(padded_bin) % 4 != 0:
        padded_bin.append(0)
    total_len = 12 + 8 + len(encoded) + 8 + len(padded_bin)
    return (
        struct.pack('<III', 0x46546C67, 2, total_len)
        + struct.pack('<II', len(encoded), 0x4E4F534A)
        + encoded
        + struct.pack('<II', len(padded_bin), 0x004E4942)
        + bytes(padded_bin)
    )


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    results = []
    with tempfile.TemporaryDirectory() as tmp:
        temp_dir = Path(tmp)
        for name, src_name, role in CHARACTERS:
            bpy.ops.wm.read_factory_settings(use_empty=True)
            source = SRC_DIR / src_name
            raw = source.read_bytes()
            doc, bin_data = parse_glb(raw)

            buffer_views = doc.get('bufferViews', [])
            images = doc.get('images', [])
            # Đảm bảo chỉ sửa bufferView độc lập của từng ảnh để không làm lệch accessor hình học.
            bv_image_counts = {}
            for img in images:
                bv = img.get('bufferView')
                if bv is not None:
                    bv_image_counts[bv] = bv_image_counts.get(bv, 0) + 1

            image_bytes_by_bv = {}
            texture_report = []
            for idx, img in enumerate(images):
                bv = img.get('bufferView')
                if bv is None or bv_image_counts.get(bv, 0) != 1:
                    continue
                view = buffer_views[bv]
                offset = view.get('byteOffset', 0)
                length = view['byteLength']
                orig = bin_data[offset:offset + length]
                mime = img.get('mimeType', 'image/png')
                scaled, new_mime, orig_size, new_size = downscale_image_bytes(
                    orig, mime, temp_dir, idx, MAX_TEXTURE_PX
                )
                img['mimeType'] = new_mime
                image_bytes_by_bv[bv] = scaled
                texture_report.append({
                    'name': img.get('name', f'image-{idx}'),
                    'origSize': orig_size,
                    'newSize': new_size,
                    'origBytes': len(orig),
                    'newBytes': len(scaled),
                })

            new_bin = bytearray()
            for bv_idx, view in enumerate(buffer_views):
                while len(new_bin) % 4 != 0:
                    new_bin.append(0)
                if bv_idx in image_bytes_by_bv:
                    chunk = image_bytes_by_bv[bv_idx]
                else:
                    old_off = view.get('byteOffset', 0)
                    old_len = view['byteLength']
                    chunk = bin_data[old_off:old_off + old_len]
                view['byteOffset'] = len(new_bin)
                view['byteLength'] = len(chunk)
                new_bin.extend(chunk)

            doc['buffers'][0]['byteLength'] = len(new_bin)
            output = build_glb(doc, bytes(new_bin))
            target = OUT_DIR / f'{name}.vrm'
            target.write_bytes(output)
            results.append({
                'name': name,
                'role': role,
                'source': str(source.relative_to(ROOT)).replace('\\', '/'),
                'runtime': str(target.relative_to(ROOT)).replace('\\', '/'),
                'sourceSha256': hashlib.sha256(raw).hexdigest(),
                'runtimeSha256': hashlib.sha256(output).hexdigest(),
                'sourceBytes': len(raw),
                'bytes': len(output),
                'maxTexturePx': MAX_TEXTURE_PX,
                'textures': texture_report,
            })
            print(f'KOHAKU_NPC_READY: {name} {len(raw)/1048576:.1f}MB -> {len(output)/1048576:.1f}MB')

    manifest_path = ROOT / 'assets/processed/kohaku-character-manifest.json'
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding='utf-8')


if __name__ == '__main__':
    main()
