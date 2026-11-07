"""Đọc cấu trúc rig/mesh của mẫu mới trong Blender nền; không ghi vào file nguồn."""
import json
import re
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[1]
for relative in sys.argv[sys.argv.index('--') + 1:]:
    source = ROOT / relative
    if source.suffix == '.blend':
        bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.fbx(filepath=str(source))
    result = {
        'source': relative,
        'rigs': [{'name': obj.name, 'bones': list(obj.data.bones.keys())} for obj in bpy.data.objects if obj.type == 'ARMATURE'],
        'meshes': [{'name': obj.name, 'vertices': len(obj.data.vertices),
                    'triangles': sum(len(poly.vertices) - 2 for poly in obj.data.polygons),
                    'materials': [mat.name if mat else None for mat in obj.data.materials],
                    'rig': obj.find_armature().name if obj.find_armature() else None,
                    'shapeKeys': list(obj.data.shape_keys.key_blocks.keys()) if obj.data.shape_keys else []}
                   for obj in bpy.data.objects if obj.type == 'MESH'],
        'images': [{'name': image.name, 'path': image.filepath, 'size': list(image.size)} for image in bpy.data.images],
        'actions': [action.name for action in bpy.data.actions],
    }
    output = ROOT / 'test-results' / ('new-character-inspection-' + re.sub(r'[^a-z0-9]+', '-', source.stem.lower()) + '.json')
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf8')
    print('SOURCE_INSPECTION ' + json.dumps({'source': relative, 'meshes': len(result['meshes']), 'rigs': len(result['rigs'])}), flush=True)
