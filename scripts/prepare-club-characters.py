"""Giữ VRM nguồn, giảm texture runtime và ghi metadata; giấy phép phân phối đang chờ xác minh."""
from pathlib import Path
from PIL import Image
import io, json, struct, hashlib

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'apps/web/public/assets/characters/club-local'
OUT.mkdir(parents=True,exist_ok=True)
results=[]
for name,relative,max_texture in [('wine','WINE/MODEL/WINE.vrm',768),('pop','POP!/MODEL/POP!.vrm',768),('galaxy','club-e1/Galaxy Summer.vrm',512)]:
    source=ROOT/'assets/source/characters/club-import'/relative
    raw=source.read_bytes()
    length=struct.unpack_from('<I',raw,12)[0]
    doc=json.loads(raw[20:20+length]); binary=raw[28+length:]
    replacement={}; textures=[]
    for item in doc.get('images',[]):
        index=item.get('bufferView')
        if index is None: continue
        view=doc['bufferViews'][index]
        data=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
        image=Image.open(io.BytesIO(data)); original=image.size
        if max(original)>max_texture:
            image.thumbnail((max_texture,max_texture),Image.Resampling.LANCZOS)
            output=io.BytesIO(); image.save(output,format='PNG',optimize=True)
            replacement[index]=output.getvalue(); item['mimeType']='image/png'
        textures.append({'original':original,'runtime':image.size})
    data=bytearray()
    for index,view in enumerate(doc['bufferViews']):
        while len(data)%4: data.append(0)
        start=view.get('byteOffset',0)
        content=replacement.get(index,binary[start:start+view['byteLength']])
        view['byteOffset']=len(data); view['byteLength']=len(content)
        data.extend(content)
    doc['buffers'][0]['byteLength']=len(data)
    while len(data)%4: data.append(0)
    encoded=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode('utf-8')
    encoded+=b' '*((-len(encoded))%4)
    output=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(data))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(data),0x004e4942)+data
    target=OUT/(name+'.vrm'); target.write_bytes(output)
    results.append({'name':name,'source':str(source.relative_to(ROOT)).replace('\\','/'),'runtime':str(target.relative_to(ROOT)).replace('\\','/'),'sourceSha256':hashlib.sha256(raw).hexdigest(),'runtimeSha256':hashlib.sha256(output).hexdigest(),'bytes':len(output),'metadata':doc['extensions']['VRM']['meta'],'textures':textures,'animationsInSource':len(doc.get('animations',[])),'licenseStatus':'LOCAL_TEST_ONLY_PENDING_FULL_LICENSE'})
(ROOT/'assets/processed/club-character-manifest.json').write_text(json.dumps(results,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps([{'name':r['name'],'bytes':r['bytes']} for r in results]))
