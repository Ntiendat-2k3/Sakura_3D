"""Dựng 2 đạo cụ gốc cho Kohaku Bluff bằng Blender: súng ổ xoay báng gỗ tối khắc vàng và lá bài hổ phách 琥珀.
Chạy: blender -b -P scripts/build-kohaku-bluff-props.py
Toàn bộ hình khối dựng bằng mã, texture vẽ bằng scripts/make-kohaku-bluff-textures.py (không tải tài nguyên ngoài)."""
import math
import subprocess
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
TEX_DIR = ROOT / 'assets/processed/kohaku-bluff-textures'
BLEND_FILE = ROOT / 'assets/processed/kohaku-bluff-props.blend'
OUT_DIR = ROOT / 'apps/web/public/assets/props/kohaku-bluff'
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Blender không có Pillow, nên texture được vẽ bởi Python hệ thống rồi nạp lại ở đây.
subprocess.run(['python', str(ROOT / 'scripts/make-kohaku-bluff-textures.py'), str(TEX_DIR)], check=True)


def reset_scene():
    # Chỉ bỏ khỏi scene (không xóa dữ liệu) để súng vẫn còn trong .blend.
    for obj in list(bpy.context.scene.collection.objects):
        bpy.context.scene.collection.objects.unlink(obj)


def solid(name, rgba, metallic=0.0, roughness=0.5):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = rgba
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    return mat


def textured(name, path, roughness=0.55):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = roughness
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(str(path))
    mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    return mat


def finish(obj, mat):
    obj.data.materials.append(mat)
    return obj


def box(name, size, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    return finish(obj, mat)


def cyl_y(name, radius, depth, loc, mat, verts=16):
    # Trục xi-lanh nằm dọc trục Y của Blender (nòng súng).
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=(math.pi / 2, 0, 0))
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.transform_apply(rotation=True)
    return finish(obj, mat)


def export(objects, path):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True, export_yup=True, export_animations=False)


# ---- Súng ổ xoay ----
# Gốc ở tay cầm; nòng hướng -Y của Blender = +Z trong glTF (export_yup).
reset_scene()
wood = solid('revolver-wood', (0.055, 0.028, 0.016, 1), roughness=0.62)
steel = solid('revolver-steel', (0.10, 0.10, 0.12, 1), metallic=0.9, roughness=0.32)
gold = solid('revolver-gold', (0.95, 0.68, 0.2, 1), metallic=1.0, roughness=0.28)
dark = solid('revolver-chamber', (0.02, 0.015, 0.012, 1))
tilt = math.radians(-14)
gun = []
gun.append(box('grip', (0.034, 0.045, 0.115), (0, 0.022, -0.052), wood, rot=(tilt, 0, 0)))
for side in (-1, 1):  # Khắc vàng hai bên báng
    gun.append(box('grip-inlay', (0.002, 0.026, 0.07), (side * 0.0175, 0.02, -0.05), gold, rot=(tilt, 0, 0)))
gun.append(box('frame', (0.03, 0.105, 0.05), (0, -0.045, 0.03), steel))
gun.append(box('top-strap', (0.022, 0.2, 0.014), (0, -0.1, 0.062), steel))
gun.append(box('hammer', (0.01, 0.022, 0.03), (0, 0.016, 0.066), steel, rot=(math.radians(25), 0, 0)))
gun.append(box('trigger-guard', (0.012, 0.05, 0.006), (0, -0.04, -0.012), steel))
gun.append(box('trigger', (0.006, 0.008, 0.026), (0, -0.036, 0.004), gold, rot=(tilt, 0, 0)))
gun.append(cyl_y('cylinder', 0.028, 0.065, (0, -0.1, 0.038), steel, verts=24))
gun.append(cyl_y('cylinder-band', 0.0295, 0.008, (0, -0.1, 0.038), gold, verts=24))
for k in range(6):  # 6 ngăn đạn ở mặt trước ổ xoay
    a = k * math.pi / 3
    gun.append(cyl_y('chamber', 0.0072, 0.004, (math.cos(a) * 0.0165, -0.134, 0.038 + math.sin(a) * 0.0165), dark, verts=8))
gun.append(cyl_y('barrel', 0.0115, 0.16, (0, -0.195, 0.054), steel))
for y in (-0.14, -0.215, -0.272):
    gun.append(cyl_y('barrel-ring', 0.0128, 0.007, (0, y, 0.054), gold))
gun.append(box('front-sight', (0.004, 0.008, 0.01), (0, -0.268, 0.071), gold))

# Gộp mesh để giữ số node thấp; empty 'muzzle' giữ riêng để entity biết đầu nòng.
bpy.ops.object.select_all(action='DESELECT')
for o in gun:
    o.select_set(True)
bpy.context.view_layer.objects.active = gun[0]
bpy.ops.object.join()
revolver = bpy.context.active_object
revolver.name = 'revolver'
bpy.ops.object.shade_smooth()
bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, -0.278, 0.054))
muzzle = bpy.context.active_object
muzzle.name = 'muzzle'
tris = sum(len(p.vertices) - 2 for p in revolver.data.polygons)
export([revolver, muzzle], OUT_DIR / 'revolver.glb')
# Giữ súng trong .blend nguồn: đưa sang collection riêng (con của scene) để reset_scene() bên dưới không làm mất.
gun_collection = bpy.data.collections.new('revolver')
for o in (revolver, muzzle):
    gun_collection.objects.link(o)
bpy.context.scene.collection.children.link(gun_collection)
print(f'REVOLVER tris={tris}')

# ---- Lá bài ----
# Mỗi hạng một mesh, cùng gốc ở tâm lá, mặt trước hướng +Y glTF (nằm ngửa); mặt sau và cạnh dùng chung vật liệu back.
reset_scene()
back_mat = textured('card-back', TEX_DIR / 'back.png')
CW, CH, CT = 0.063, 0.088, 0.0016
cards = []
for rank in ('K', 'Q', 'A', 'JOKER'):
    face_mat = textured(f'face-{rank}', TEX_DIR / f'face-{rank}.png')
    mesh = bpy.data.meshes.new(f'card-{rank}')
    x, y, z = CW / 2, CH / 2, CT / 2
    verts = [(-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z), (-x, -y, -z), (x, -y, -z), (x, y, -z), (-x, y, -z)]
    faces = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(face_mat)
    mesh.materials.append(back_mat)
    mesh.update()
    uv = mesh.uv_layers.new(name='UVMap')
    for poly in mesh.polygons:
        poly.material_index = 0 if poly.index == 0 else 1
        for li in poly.loop_indices:
            vx, vy, _ = mesh.vertices[mesh.loops[li].vertex_index].co
            u, v = (vx / CW + 0.5, vy / CH + 0.5)
            if poly.index == 1:
                u = 1 - u  # mặt sau nhìn từ phía đối diện nên lật u
            uv.data[li].uv = (u, v)
    obj = bpy.data.objects.new(f'card-{rank}', mesh)
    bpy.context.scene.collection.objects.link(obj)
    cards.append(obj)
export(cards, OUT_DIR / 'card.glb')
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_FILE))
print(f'KOHAKU_BLUFF_PROPS_EXPORT_COMPLETE: {OUT_DIR}')
