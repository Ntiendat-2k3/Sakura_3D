"""Đối chiếu mặt bằng GLB ở tầm avatar với collider dùng chung, đọc file Blender đã lưu."""
from pathlib import Path
from mathutils import Vector
import bpy, json

ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/processed/neon-sakura-street.blend'))
layout=json.loads((ROOT/'packages/game-protocol/src/street-layout.json').read_text())
results=[]
for block in layout:
    obj=bpy.data.objects[block['id']]
    points=[obj.matrix_world @ v.co for v in obj.data.vertices]
    body=[p for p in points if p.z<=2.7]
    bounds={'xMin':min(p.x for p in body),'xMax':max(p.x for p in body),'zMin':min(-p.y for p in body),'zMax':max(-p.y for p in body)}
    contained=(bounds['xMin']>=block['x']-block['halfWidth'] and bounds['xMax']<=block['x']+block['halfWidth'] and bounds['zMin']>=block['z']-block['halfDepth'] and bounds['zMax']<=block['z']+block['halfDepth'])
    results.append(dict(venue=block['id'],bodyHeight=2.7,bounds=bounds,insideCollider=contained))
report={'blender':bpy.app.version_string,'units':'meters','upAxis':'Blender Z / runtime glTF Y','buildings':results,'pass':all(r['insideCollider'] for r in results)}
(ROOT/'assets/processed/collision-audit.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
if not report['pass']: raise RuntimeError('Công trình vượt collider')
