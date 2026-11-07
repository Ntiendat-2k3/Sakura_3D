"""Import model CC0 vào bản sao club, giữ nguyên nội thất gốc và lưu hồ sơ kiểm tra Blender."""
import bpy, json, math
from pathlib import Path
from mathutils import Matrix, Vector, Euler

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'assets/processed/denmu-club.blend'))
layout = json.loads((ROOT / 'apps/web/game/scenes/club-lighting-layout.json').read_text())
conversion = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))
fixtures = []
report = {'fixtures': [], 'motion': [], 'blender': bpy.app.version_string}

def import_fixture(asset_id, position, rotation):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / f'assets/source/club-lighting/{asset_id}.glb'))
    objects = list(set(bpy.data.objects) - before)
    roots = [obj for obj in objects if obj.parent not in objects]
    transform = (conversion @ Euler(rotation, 'XYZ').to_matrix() @ conversion.inverted()).to_4x4()
    transform.translation = Vector((position[0], -position[2], position[1]))
    for obj in roots:
        obj.matrix_world = transform @ obj.matrix_world
    fixtures.extend(objects)
    report['fixtures'].append({'id': asset_id, 'meshes': sum(o.type == 'MESH' for o in objects), 'position': position})

for entry in layout:
    import_fixture(entry['id'], entry['position'], entry['rotation'])
for x in range(6):
    for z in range(4):
        import_fixture('34111' if (x + z) % 2 == 0 else '34112', [x - 2.5, -.005, z - 1.5], [0, 0, 0])

bpy.ops.object.select_all(action='DESELECT')
for obj in fixtures: obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT / 'assets/processed/denmu-premium-lighting.glb'), export_format='GLB', use_selection=True, export_animations=False)

# Giữ FBX và action gốc trong file làm việc để kiểm tra pipeline; không xuất rig nguồn ra game.
for file in (ROOT / 'assets/source/animations/club/rokoko-six/Dancing').glob('*.fbx'):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=str(file))
    imported = list(set(bpy.data.objects) - before)
    armatures = [o for o in imported if o.type == 'ARMATURE']
    report['motion'].append({'file': file.name, 'rigs': len(armatures), 'bones': [len(o.data.bones) for o in armatures]})
    for obj in imported: obj.hide_render = True; obj.hide_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/processed/denmu-premium-club.blend'))
(ROOT / 'assets/processed/club-blender-validation.json').write_text(json.dumps(report, indent=2), encoding='utf8')
