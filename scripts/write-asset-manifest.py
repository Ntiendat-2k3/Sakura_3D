"""Ghi nguồn, giấy phép, checksum và trạng thái trung thực của asset đã đưa vào game."""
from pathlib import Path
import hashlib, json
from datetime import datetime, timezone

ROOT=Path(__file__).resolve().parents[1]
def checksum(path): return hashlib.sha256((ROOT/path).read_bytes()).hexdigest()
packs={
    'kenney-commercial':('City Kit Commercial','2.1','https://kenney.nl/assets/city-kit-commercial'),
    'kenney-roads':('City Kit Roads','2.2','https://kenney.nl/assets/city-kit-roads'),
    'kenney-nature':('Nature Kit','2.1','https://kenney.nl/assets/nature-kit'),
}
used=json.loads((ROOT/'assets/processed/used-sources.json').read_text())
sources=[]
for key,(title,version,url) in packs.items():
    license_file=f'assets/source/{key}/License.txt'
    sources.append(dict(id=key,title=title,version=version,author='Kenney',source=url,license='CC0-1.0',licenseUrl='https://creativecommons.org/publicdomain/zero/1.0/',licenseEvidence=license_file,licenseSha256=checksum(license_file),files=[{'path':p,'sha256':checksum(p)} for p in used if f'/{key}/' in p],status='DONE'))
stats=json.loads((ROOT/'assets/processed/runtime-asset-stats.json').read_text())
textures=sorted({str((ROOT/Path(s['file']).parent/uri).resolve().relative_to(ROOT)).replace('\\','/') for s in stats for uri in s['textures']})
manifest={
    'project':'Neon Sakura City','generatedAt':datetime.now(timezone.utc).isoformat(),'overallStatus':'PARTIAL',
    'sources':sources,
    'originalWork':{'author':'Neon Sakura City project, authored with Codex','license':'Original project work; project licensing applies. Third-party bases remain CC0.','files':['scripts/build-sakura-street.py','scripts/create-street-textures.py'],'work':['UV remapping and shared surface atlas','Japanese venue signs and blade signs','Pleated lantern mesh','Vending machine mesh and original soda labels','Street assembly and collision proxies'],'fontNote':'Yu Gothic and Arial were rasterized locally from Windows fonts. No font files are redistributed.'},
    'processing':{'blender':'5.2.3 LTS','gltfTransform':'4.5.0','steps':['import CC0 GLB','normalize meters, pivots, Y-up export','remap UV/materials','dedup, weld, quantize, prune','external shared PNG atlases','Khronos glTF Validator'],'sourceScene':'assets/processed/neon-sakura-street.blend','runtimeGLBBytes':sum(s['bytes'] for s in stats),'runtimeTextureBytes':sum((ROOT/p).stat().st_size for p in textures),'textureFiles':[{'file':p,'bytes':(ROOT/p).stat().st_size,'sha256':checksum(p)} for p in textures]},
    'runtimeAssets':stats,
    'layout':{'venues':8,'backgroundTowers':3,'props':len(json.loads((ROOT/'apps/web/public/assets/props/placements.json').read_text())),'authoritativeLayout':'packages/game-protocol/src/street-layout.json','propLayout':'apps/web/public/assets/props/placements.json'},
    'characters':[{'name':name,'status':'BLOCKED','runtimeAsset':None,'reason':'No adult anime model with verified redistribution license has been supplied or imported.'} for name in ['Reina','Mizuki','Sora','Yuna','Kaede','Hana','Rika','Emi','Ayame','Madam Kurenai']],
    'limitations':['Kenney low-poly architecture restyled for a Japanese nightlife street; premium anime art direction is PARTIAL.','Player avatar remains the existing geometric placeholder, not a finished anime character.','VRM import, MToon, rigs and NPC animations are not verified.','Buildings are exterior-only. No club interiors or venue interactions are implemented.','Trees are recolored stylized Kenney foliage, not botanical sakura models.','Authoritative collisions cover building rectangles; decorative props and trees do not have individual colliders.','GLB files reference shared textures; distribute the entire public/assets directory.'],
    'evidence':{'before':'test-results/screenshots/asset-upgrade-before.png','after':'test-results/screenshots/asset-upgrade-after.png','validator':'assets/processed/gltf-validation.json','collision':'assets/processed/collision-audit.json','browser':'test-results/visual-upgrade-browser.json'},
}
club_file=ROOT/'assets/processed/club-character-manifest.json'
if club_file.exists():
    manifest['clubPrototype']={
        'status':'DONE_LOCAL_TEST',
        'report':'docs/reports/CLUB_TEST_REPORT.md',
        'sourceScene':'assets/processed/denmu-club.blend',
        'environmentModel':'apps/web/public/assets/buildings/denmu-club.glb',
        'environmentAuthor':'Neon Sakura City project; original geometry with the existing project atlas',
        'characters':json.loads(club_file.read_text(encoding='utf-8')),
        'animation':'Original procedural humanoid club dance; 112 BPM, room epoch, no external dance clip or audio',
        'licenseStatus':'User supplied VRM files for local testing. Full redistribution license is pending; these models are not CC0.',
    }
    manifest['limitations']=[item for item in manifest['limitations'] if not item.startswith(('VRM import,','Buildings are exterior-only.'))]
    manifest['limitations']+=['WINE and POP VRM0/MToon and procedural dance are tested locally; the original ten-name roster is not completed.','Denmu has a local test interior and a separate room; other venues have no enterable interiors yet.','Club character redistribution is pending complete license evidence.']
lantern_layout_file=ROOT/'apps/web/game/scenes/street-lantern-layout.json'
if lantern_layout_file.exists():
    lantern_layout=json.loads(lantern_layout_file.read_text(encoding='utf8'))
    count=len(lantern_layout['rows'])*len(lantern_layout['lanternX'])
    wire_path='apps/web/public/assets/props/lantern-garlands.glb'
    manifest['streetLanterns']={'status':'PARTIAL','implementationStatus':'DONE','additionalLanterns':count,'oldLanternsRaised':24,'cantileverMounts':len(lantern_layout['rows'])*2,'newBottomY':lantern_layout['anchorY']-lantern_layout['cordTop'],'facadeBottomY':lantern_layout['facadeBaseY'],'model':'apps/web/public/assets/props/lantern.glb','modelOrigin':'Lồng đèn giấy có nếp do dự án tạo trong build-sakura-street.py; dùng lại mesh/material bằng instancing.','layout':'apps/web/game/scenes/street-lantern-layout.json','wire':{'file':wire_path,'bytes':(ROOT/wire_path).stat().st_size,'sha256':checksum(wire_path)},'sourceBlend':'assets/processed/street-lantern-garlands.blend','sourceBuilder':'scripts/build-street-lanterns.py','lighting':'Sáu SpotLight đỏ thật hắt xuống đường; vật liệu đường giảm roughness để có ánh phản xạ specular. Không SSR/mirror hoặc shadow map riêng từng đèn.','report':'docs/reports/STREET_LANTERN_HEIGHT_REPORT.md','browserStatus':'SKIPPED theo yêu cầu người dùng'}
    manifest['layout']['props']+=count
(ROOT/'assets/manifests').mkdir(parents=True, exist_ok=True)
(ROOT/'assets/manifests/ASSET_MANIFEST.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding='utf-8')
print('Đã ghi assets/manifests/ASSET_MANIFEST.json; trạng thái PARTIAL')
