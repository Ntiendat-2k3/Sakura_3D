"""Tách texture dùng chung khỏi GLB để tránh tải và lưu cùng atlas nhiều lần."""
from pathlib import Path
import json, struct, hashlib, sys

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'apps/web/public/assets'
stats=[]
targets=[(ROOT/value).resolve() for value in sys.argv[1:]] if len(sys.argv)>1 else sorted([*PUBLIC.glob('buildings/*.glb'),*PUBLIC.glob('props/*.glb')])
for path in targets:
    if not path.resolve().is_relative_to(PUBLIC.resolve()) or path.suffix.lower()!='.glb':raise ValueError('Chỉ đóng gói GLB trong public/assets')
for path in targets:
    raw=path.read_bytes()
    json_length=struct.unpack_from('<I',raw,12)[0]
    doc=json.loads(raw[20:20+json_length])
    binary=raw[28+json_length:]
    removed=set()
    for image in doc.get('images',[]):
        if 'bufferView' not in image: continue
        index=image.pop('bufferView')
        view=doc['bufferViews'][index]
        content=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
        suffix='.png' if image['mimeType']=='image/png' else '.jpg'
        digest=hashlib.sha256(content).hexdigest()[:12]
        filename='atlas-'+digest+suffix
        target=PUBLIC/'textures'/filename
        if not target.exists(): target.write_bytes(content)
        image['uri']='../textures/'+filename
        removed.add(index)
    new_views=[]; remap={}; data=bytearray()
    for i,view in enumerate(doc.get('bufferViews',[])):
        if i in removed: continue
        while len(data)%4: data.append(0)
        start=view.get('byteOffset',0)
        new_view={**view,'byteOffset':len(data)}
        data.extend(binary[start:start+view['byteLength']])
        remap[i]=len(new_views)
        new_views.append(new_view)
    for accessor in doc.get('accessors',[]):
        if 'bufferView' in accessor: accessor['bufferView']=remap[accessor['bufferView']]
        if 'sparse' in accessor:
            for key in ('indices','values'):
                accessor['sparse'][key]['bufferView']=remap[accessor['sparse'][key]['bufferView']]
    doc['bufferViews']=new_views
    doc['buffers']=[{'byteLength':len(data)}]
    while len(data)%4: data.append(0)
    encoded=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode('utf-8')
    encoded+=b' '*((-len(encoded))%4)
    output=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(data))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(data),0x004e4942)+data
    path.write_bytes(output)
    triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc.get('meshes',[]) for p in m['primitives'] if 'indices' in p)
    stats.append(dict(file=str(path.resolve().relative_to(ROOT.resolve())).replace('\\','/'),bytes=len(output),triangles=triangles,meshes=len(doc.get('meshes',[])),materials=len(doc.get('materials',[])),textures=[i['uri'] for i in doc.get('images',[])],sha256=hashlib.sha256(output).hexdigest()))
if len(sys.argv)>1:
    previous=json.loads((ROOT/'assets/processed/runtime-asset-stats.json').read_text())
    combined={item['file']:item for item in previous}
    combined.update({item['file']:item for item in stats});stats=sorted(combined.values(),key=lambda item:item['file'])
(ROOT/'assets/processed/runtime-asset-stats.json').write_text(json.dumps(stats,indent=2))
print('Runtime GLB total:',sum(item['bytes'] for item in stats),'bytes')
print('Unique atlas files:',len({uri for item in stats for uri in item['textures']}))
