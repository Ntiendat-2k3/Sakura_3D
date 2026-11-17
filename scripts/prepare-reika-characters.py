"""Giữ nguyên cấu trúc VRM 0.x/1.0 nguồn của Reika Lounge, giảm kích thước texture runtime và ghi manifest."""
from pathlib import Path
import hashlib, io, json, struct, tempfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / 'assets/source/characters/reika-import'
OUT_DIR = ROOT / 'apps/web/public/assets/characters/club-local'
OUT_DIR.mkdir(parents=True, exist_ok=True)


def downscale_image_bytes(data: bytes, max_texture: int) -> tuple[bytes | None, tuple[int, int], tuple[int, int]]:
    """Giảm độ phân giải ảnh vượt ngưỡng bằng Pillow hoặc Blender bpy.data.images."""
    try:
        from PIL import Image
        image = Image.open(io.BytesIO(data))
        original = image.size
        if max(original) <= max_texture:
            return None, original, original
        image.thumbnail((max_texture, max_texture), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        image.save(output, format='PNG', optimize=True)
        return output.getvalue(), original, image.size
    except ImportError:
        import bpy
        with tempfile.TemporaryDirectory() as tmp:
            in_path = Path(tmp) / 'in.png'
            out_path = Path(tmp) / 'out.png'
            in_path.write_bytes(data)
            img = bpy.data.images.load(str(in_path))
            try:
                w, h = int(img.size[0]), int(img.size[1])
                original = (w, h)
                if max(w, h) <= max_texture or max(w, h) == 0:
                    return None, original, original
                scale = max_texture / float(max(w, h))
                nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
                img.scale(nw, nh)
                img.filepath_raw = str(out_path)
                img.file_format = 'PNG'
                img.save()
                return out_path.read_bytes(), original, (nw, nh)
            finally:
                bpy.data.images.remove(img)


def extract_vrm_meta(doc: dict) -> dict:
    """Đọc metadata tương thích cả VRM 0.x và VRM 1.0 (VRMC_vrm)."""
    ext = doc.get('extensions', {})
    if 'VRM' in ext and isinstance(ext['VRM'], dict):
        return ext['VRM'].get('meta', {})
    if 'VRMC_vrm' in ext and isinstance(ext['VRMC_vrm'], dict):
        return ext['VRMC_vrm'].get('meta', {})
    return {}


def main() -> None:
    results = []
    targets = [
        ('yuzu', 'yuzu.vrm', 768, 'greeter'),
        ('zankou', 'zankou.vrm', 768, 'vip-hostess'),
        ('bunny', 'bunny.vrm', 768, 'bartender'),
    ]
    for name, filename, max_texture, role in targets:
        source = SOURCE_DIR / filename
        raw = source.read_bytes()
        length = struct.unpack_from('<I', raw, 12)[0]
        doc = json.loads(raw[20:20 + length])
        binary = raw[28 + length:]
        replacement = {}
        textures = []
        for item in doc.get('images', []):
            index = item.get('bufferView')
            if index is None:
                continue
            view = doc['bufferViews'][index]
            start = view.get('byteOffset', 0)
            chunk = binary[start:start + view['byteLength']]
            resized, original, runtime_size = downscale_image_bytes(chunk, max_texture)
            if resized is not None:
                replacement[index] = resized
                item['mimeType'] = 'image/png'
            textures.append({'original': list(original), 'runtime': list(runtime_size)})

        data = bytearray()
        for index, view in enumerate(doc['bufferViews']):
            while len(data) % 4:
                data.append(0)
            start = view.get('byteOffset', 0)
            content = replacement.get(index, binary[start:start + view['byteLength']])
            view['byteOffset'] = len(data)
            view['byteLength'] = len(content)
            data.extend(content)

        doc['buffers'][0]['byteLength'] = len(data)
        while len(data) % 4:
            data.append(0)

        encoded = json.dumps(doc, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
        encoded += b' ' * ((-len(encoded)) % 4)
        output = (
            struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(data))
            + struct.pack('<II', len(encoded), 0x4E4F534A)
            + encoded
            + struct.pack('<II', len(data), 0x004E4942)
            + data
        )
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
            'metadata': extract_vrm_meta(doc),
            'textures': textures,
            'licenseStatus': 'LOCAL_TEST_ONLY_PENDING_FULL_LICENSE',
        })

    manifest_path = ROOT / 'assets/processed/reika-character-manifest.json'
    manifest_path.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding='utf-8')
    print(json.dumps([{'name': r['name'], 'sourceBytes': r['sourceBytes'], 'bytes': r['bytes']} for r in results]))


if __name__ == '__main__':
    main()

