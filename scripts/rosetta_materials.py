"""Chuẩn hóa alpha GLB Rosetta để mặt/tóc không che sai nhau trong bộ render thời gian thực."""
import hashlib
import json
import struct
import io
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def patch_rosetta_materials(target, merge_idle=False):
    raw = target.read_bytes()
    if raw[:4] != b'glTF':
        raise ValueError('Không phải GLB')
    length = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20 + length])
    binary_chunk = raw[20 + length:]
    if merge_idle and doc.get('animations'):
        merged={'name':'Rosetta_Render_Idle','samplers':[],'channels':[]}
        for animation in doc['animations']:
            offset=len(merged['samplers']); merged['samplers'].extend(animation['samplers'])
            for channel in animation['channels']: merged['channels'].append({**channel,'sampler':channel['sampler']+offset})
        doc['animations']=[merged]
    policy = {}
    for material in doc.get('materials', []):
        name = material.get('name', '')
        # Chỉ mặt/mi có alpha thực sự. Không đưa da, quần áo và tóc đặc vào hàng đợi BLEND.
        if name.startswith(('Face', 'Eye_')):
            material['alphaMode'] = 'MASK'
            material['alphaCutoff'] = .3
        else:
            material['alphaMode'] = 'OPAQUE'
            material.pop('alphaCutoff', None)
        policy[name] = material['alphaMode']
    encoded = json.dumps(doc, ensure_ascii=False, separators=(',', ':')).encode('utf8')
    encoded += b' ' * (-len(encoded) % 4)
    output = struct.pack('<III', 0x46546c67, 2, 20 + len(encoded) + len(binary_chunk)) + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + binary_chunk
    target.write_bytes(output)
    return policy

def compress_opaque_textures(target):
    """Giữ PNG không mất dữ liệu cho mặt/mắt, chỉ nén atlas đặc với ngưỡng sai lệch màu đo được."""
    from PIL import Image, ImageChops, ImageStat
    raw=target.read_bytes(); length=struct.unpack_from('<I',raw,12)[0]
    doc=json.loads(raw[20:20+length]); binary=raw[28+length:]
    masked=set()
    for material in doc.get('materials',[]):
        texture=material.get('pbrMetallicRoughness',{}).get('baseColorTexture')
        if texture and material.get('alphaMode')=='MASK': masked.add(doc['textures'][texture['index']]['source'])
    changes={}; stats=[]
    for index,image in enumerate(doc.get('images',[])):
        if index in masked or image.get('mimeType')!='image/png': continue
        view=doc['bufferViews'][image['bufferView']]; start=view.get('byteOffset',0)
        source=Image.open(io.BytesIO(binary[start:start+view['byteLength']])).convert('RGB')
        output=io.BytesIO(); source.save(output,format='JPEG',quality=94,subsampling=0,optimize=True)
        jpeg=output.getvalue(); mae=ImageStat.Stat(ImageChops.difference(source,Image.open(io.BytesIO(jpeg)))).mean
        if len(jpeg)>=view['byteLength'] or max(mae)>1.5: continue
        changes[image['bufferView']]=jpeg; image['mimeType']='image/jpeg'
        stats.append({'image':image.get('name'),'before':view['byteLength'],'after':len(jpeg),'meanAbsoluteErrorRGB':mae})
    data=bytearray()
    for index,view in enumerate(doc['bufferViews']):
        data.extend(b'\0'*(-len(data)%4)); start=view.get('byteOffset',0)
        content=changes.get(index,binary[start:start+view['byteLength']])
        view.update(byteOffset=len(data),byteLength=len(content)); data.extend(content)
    doc['buffers'][0]['byteLength']=len(data); data.extend(b'\0'*(-len(data)%4))
    encoded=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode('utf8'); encoded+=b' '*(-len(encoded)%4)
    output=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(data))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(data),0x004e4942)+data
    target.write_bytes(output)
    return stats

if __name__ == '__main__':
    candidate='--candidate' in sys.argv
    definitions=json.loads((ROOT/'apps/web/game/entities/club-npcs.json').read_text(encoding='utf8'))
    target = ROOT/'assets/processed/rosetta-restored.glb' if candidate else ROOT/'apps/web/public'/definitions['rosetta']['url'].lstrip('/')
    policy = patch_rosetta_materials(target,merge_idle=candidate)
    texture_stats=compress_opaque_textures(target) if candidate else []
    manifest_path = ROOT / ('assets/processed/rosetta-restoration-manifest.json' if candidate else 'assets/processed/rosetta-greeter-manifest.json')
    manifest = json.loads(manifest_path.read_text(encoding='utf8'))
    manifest.update(runtimeSha256=hashlib.sha256(target.read_bytes()).hexdigest(), bytes=target.stat().st_size, materialPolicy=policy)
    if candidate:
        manifest['sha256']=manifest['runtimeSha256']
        if texture_stats: manifest['textureCompression']=texture_stats
    data=target.read_bytes(); size=struct.unpack_from('<I',data,12)[0]; doc=json.loads(data[20:20+size])
    runtime_materials={m['name']:m for m in doc['materials']}
    for item in manifest.get('materials',[]):
        pbr=runtime_materials[item['name']].get('pbrMetallicRoughness',{})
        item.update(roughness=pbr.get('roughnessFactor',1),metallic=pbr.get('metallicFactor',1))
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf8')
    print(json.dumps({'bytes': manifest['bytes'], 'materialPolicy': policy}))
