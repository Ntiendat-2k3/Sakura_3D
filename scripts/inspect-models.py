"""Kiểm kê hình học và kích thước model nguồn trước khi dựng khu phố."""
import bpy, json
from pathlib import Path
from mathutils import Vector

root = Path(__file__).resolve().parents[1]
items = []
for pack, names in [('kenney-commercial', ['building-a', 'building-d', 'building-f', 'building-h', 'building-j', 'building-k', 'building-skyscraper-a', 'detail-awning-wide']), ('kenney-roads', ['road-straight', 'road-crossing', 'electricity-pole', 'electricity-wires', 'light-curved', 'dumpster'])]:
    for name in names:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(root / 'assets/source' / pack / 'Models/GLB format' / (name+'.glb')))
        meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
        pts = [o.matrix_world @ Vector(v) for o in meshes for v in o.bound_box]
        low = [min(p[i] for p in pts) for i in range(3)]
        high = [max(p[i] for p in pts) for i in range(3)]
        items.append(dict(name=name, low=low, high=high, meshes=len(meshes), materials=[m.name for m in bpy.data.materials], uv=all(len(o.data.uv_layers)>0 for o in meshes), faces=sum(len(o.data.polygons) for o in meshes)))
(root/'assets/processed/model-inventory.json').write_text(json.dumps(items,indent=2))
print(json.dumps(items))
