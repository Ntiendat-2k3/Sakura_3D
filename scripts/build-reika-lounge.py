"""Dựng nội thất Reika Hostess Lounge trong Blender bằng vật liệu atlas dùng chung và lưu bản .blend/.glb."""
import bpy
from pathlib import Path
from mathutils import Vector

ROOT = Path(r'F:\Code\Project\Mix\webGame3D')
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)
surface = bpy.data.materials.get('Sakura / stone wood glass metal fabric')
if not surface:
    with bpy.data.libraries.load(str(ROOT / 'assets/processed/neon-sakura-street.blend'), link=False) as (data_from, data_to):
        data_to.materials = [name for name in data_from.materials if name == 'Sakura / stone wood glass metal fabric']
    surface = bpy.data.materials.get('Sakura / stone wood glass metal fabric')
if not surface:
    raise RuntimeError('Missing shared material')
items = []


def material(name, color, emission=0.0, roughness=0.38, metallic=0.0):
    """Tạo vật liệu PBR cho đèn trang trí, nhung và mặt bàn đá trong Reika Lounge."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    node = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    node.inputs['Base Color'].default_value = (*color, 1)
    node.inputs['Roughness'].default_value = roughness
    node.inputs['Metallic'].default_value = metallic
    node.inputs['Emission Color'].default_value = (*color, 1)
    node.inputs['Emission Strength'].default_value = emission
    return mat


rose_gold = material('Lounge / warm rose gold light', (1.0, 0.42, 0.68), emission=1.8, roughness=0.25)
amber_glow = material('Lounge / champagne amber light', (1.0, 0.76, 0.38), emission=2.1, roughness=0.2)
velvet_plum = material('Lounge / velvet plum upholstery', (0.24, 0.06, 0.16), roughness=0.78)
marble_top = material('Lounge / dark emperador marble', (0.12, 0.09, 0.14), roughness=0.18, metallic=0.1)


def box(name, position, size, tile=14, mat=None, bevel=0.04):
    """Tạo khối hộp có vát cạnh và ánh xạ UV vào ô vật liệu thuộc atlas dùng chung."""
    x, y, z = position
    w, h, d = size
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -z, y))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (w, d, h)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new('Rounded edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.materials.clear()
    obj.data.materials.append(mat or surface)
    if not mat:
        uv = obj.data.uv_layers.active
        for point in uv.data:
            u, v = point.uv
            point.uv = ((tile % 4 + 0.01 + u * 0.98) / 4, (3 - tile // 4 + 0.01 + v * 0.98) / 4)
    items.append(obj)
    return obj


# Sàn gỗ trầm và thảm nhung trung tâm
box('lounge-floor', (0, -0.12, 0), (14.4, 0.24, 14.4), 2)
box('lounge-carpet', (0, 0.008, -0.6), (9.2, 0.016, 9.6), mat=velvet_plum, bevel=0.02)
box('lounge-carpet-border', (0, 0.004, -0.6), (9.6, 0.01, 10.0), 6, bevel=0)

# Tường bao quanh và lam gỗ trang trí
box('back-wall', (0, 2.5, -7.1), (14.4, 5.0, 0.24), 2)
for side in [-1, 1]:
    box('side-wall', (side * 7.1, 2.5, 0), (0.24, 5.0, 14.4), 0)
    box('front-wall', (side * 4.3, 1.4, 7.0), (5.4, 2.8, 0.22), 2)
    box('door-gold-jamb', (side * 1.55, 1.6, 6.92), (0.14, 3.2, 0.22), 6)
    for z in [-5.4, -2.7, 0.0, 2.7, 5.4]:
        box('wall-pilaster', (side * 6.92, 2.2, z), (0.18, 4.4, 0.2), 6)
    box('wall-crown-light', (side * 6.88, 4.35, 0), (0.08, 0.07, 13.4), mat=rose_gold if side > 0 else amber_glow)

# Tiểu cảnh VIP & vách trang trí золотой/rose-gold phía cuối phòng (z = -6.8)
box('vip-backdrop', (0, 2.35, -6.88), (8.4, 3.6, 0.14), mat=velvet_plum)
box('vip-platform', (0, 0.14, -5.5), (7.6, 0.28, 2.6), 2, bevel=0.06)
box('vip-platform-trim', (0, 0.26, -4.2), (7.5, 0.05, 0.06), mat=amber_glow)
for i in range(9):
    box('backdrop-slat', (-3.6 + i * 0.9, 2.35, -6.76), (0.08, 3.4, 0.1), 6)

# Quầy lễ tân đón khách gần lối vào bên trái
box('reception-desk', (-3.2, 0.55, 3.8), (2.2, 1.1, 0.9), 2, bevel=0.06)
box('reception-top', (-3.2, 1.12, 3.8), (2.34, 0.1, 1.02), mat=marble_top, bevel=0.03)
box('reception-glow', (-3.2, 0.55, 4.27), (2.0, 0.06, 0.04), mat=amber_glow)

# Quầy Champagne Bar bên trái (x = -5.8, z từ -3.6 đến 1.2)
box('champagne-bar', (-5.8, 0.62, -1.2), (1.3, 1.24, 4.8), 2, bevel=0.07)
box('champagne-bar-top', (-5.8, 1.28, -1.2), (1.5, 0.12, 4.96), mat=marble_top, bevel=0.04)
box('champagne-bar-glow', (-5.12, 0.62, -1.2), (0.04, 0.06, 4.6), mat=amber_glow)
for level in [1.45, 2.25, 3.05]:
    box('bottle-shelf', (-6.72, level, -1.2), (0.36, 0.07, 4.2), 6)
    box('bottle-shelf-light', (-6.56, level + 0.05, -1.2), (0.04, 0.04, 4.0), mat=rose_gold)

# Khu vực Sofa Booth sang trọng bên phải (x = 5.6) và bàn trà đá cẩm thạch (x = 4.2)
for z in [-2.4, 0.4]:
    # Ghế sofa chính sát tường phải (nhìn về hướng -X)
    box('lounge-sofa-seat', (5.75, 0.42, z), (1.35, 0.68, 2.1), mat=velvet_plum, bevel=0.14)
    box('lounge-sofa-back', (6.32, 0.92, z), (0.28, 0.88, 2.1), mat=velvet_plum, bevel=0.1)
    for dz in [-0.98, 0.98]:
        box('lounge-sofa-arm', (5.75, 0.74, z + dz), (1.35, 0.48, 0.16), 6)
    # Bàn trà đá cẩm thạch ở giữa cụm sofa
    box('lounge-table-top', (4.35, 0.56, z), (0.95, 0.08, 1.45), mat=marble_top, bevel=0.03)
    box('lounge-table-base', (4.35, 0.26, z), (0.45, 0.52, 0.75), 6)

# Sofa VIP phía cuối phòng (z = -5.8, nhìn ra sảnh hướng +Z)
box('vip-sofa-seat', (0, 0.56, -5.95), (3.2, 0.68, 1.25), mat=velvet_plum, bevel=0.14)
box('vip-sofa-back', (0, 1.06, -6.48), (3.2, 0.88, 0.28), mat=velvet_plum, bevel=0.1)
for dx in [-1.52, 1.52]:
    box('vip-sofa-arm', (dx, 0.88, -5.95), (0.16, 0.48, 1.25), 6)
box('vip-table-top', (0, 0.68, -4.65), (1.6, 0.08, 0.82), mat=marble_top, bevel=0.03)
box('vip-table-base', (0, 0.40, -4.65), (0.85, 0.50, 0.42), 6)

# Hệ thống đèn thả trần ấm áp (Chandeliers)
for x in [-2.8, 2.8]:
    for z in [-2.4, 1.6]:
        box('chandelier-rod', (x, 4.45, z), (0.05, 1.1, 0.05), 6, bevel=0)
        box('chandelier-ring', (x, 3.85, z), (0.95, 0.09, 0.95), mat=amber_glow, bevel=0.03)

# ==============================================================================
# CẦU THANG BỘ HOÀNG GIA & CHIẾU NGHỈ TẦNG 2 DẪN LÊN CYBER LOVE HOTEL (2F)
# ==============================================================================
# Chiếu nghỉ tầng 2 (2F Mezzanine Landing) ở góc trước bên phải (x = 5.3, z = 5.5, y = 2.4m)
box('mezzanine-floor', (5.3, 2.32, 5.5), (2.8, 0.16, 2.2), 2, bevel=0.04)
box('mezzanine-carpet', (5.3, 2.41, 5.5), (2.6, 0.02, 2.0), mat=velvet_plum, bevel=0.02)
box('mezzanine-edge-trim', (3.9, 2.42, 5.5), (0.06, 0.06, 2.2), mat=amber_glow)
box('mezzanine-front-trim', (5.3, 2.42, 4.4), (2.8, 0.06, 0.06), mat=amber_glow)

# Trụ đỡ kết cấu chiếu nghỉ tầng 2 từ sàn tầng 1
box('mezzanine-pillar-1', (3.95, 1.16, 4.45), (0.16, 2.32, 0.16), 6, bevel=0.02)
box('mezzanine-pillar-2', (3.95, 1.16, 6.55), (0.16, 2.32, 0.16), 6, bevel=0.02)

# Lan can an toàn CHỈ ĐẶT Ở MÉP TRÁI (x = 3.95) để tránh ngã xuống sảnh tầng 1.
# MẶT TRƯỚC (z = 4.4) HOÀN TOÀN MỞ THÔNG để bậc thang bước thẳng lên sàn chiếu nghỉ!
box('mezzanine-railing-side', (3.95, 2.92, 5.5), (0.04, 0.95, 2.1), 6, bevel=0.01)
box('mezzanine-handrail-side', (3.95, 3.42, 5.5), (0.08, 0.06, 2.16), 6, bevel=0.02)
box('mezzanine-railing-glow', (3.95, 3.39, 5.5), (0.04, 0.02, 2.0), mat=rose_gold)

# Dãy 11 bậc thang bộ từ sàn tầng 1 bước lên chiếu nghỉ tầng 2 (z từ 2.5 đến 4.4)
num_steps = 11
step_start_z = 2.5
step_end_z = 4.4
step_dz = (step_end_z - step_start_z) / num_steps
step_dy = 2.32 / num_steps
for i in range(num_steps):
    step_y = (i + 0.5) * step_dy
    step_z = step_start_z + (i + 0.5) * step_dz
    # Khối bậc thang gỗ mun nẹp đồng
    box(f'stair-step-{i}', (5.3, step_y, step_z), (1.8, step_dy, step_dz * 1.05), mat=marble_top, bevel=0.02)
    # Nẹp đồng vàng kim mũi bậc
    box(f'stair-nosing-{i}', (5.3, (i + 1) * step_dy, step_z - step_dz * 0.48), (1.82, 0.03, 0.04), 6)
    # Đèn LED neon hồng hắt chân từng bậc thang
    box(f'stair-led-{i}', (5.3, step_y + step_dy * 0.45, step_z - step_dz * 0.46), (1.75, 0.02, 0.02), mat=rose_gold)

# Tay vịn cầu thang chạy xiên theo độ dốc ở mép trái cầu thang
box('stair-handrail-slope', (4.38, 1.85, 3.45), (0.06, 1.95, 0.06), 6)
box('stair-handrail-pole-bottom', (4.38, 0.65, 2.55), (0.08, 1.3, 0.08), 6)
box('stair-handrail-pole-mid', (4.38, 1.8, 3.45), (0.08, 1.3, 0.08), 6)

# ==============================================================================
# CỬA PHÒNG NHỎ RIÊNG TƯ TẦNG 2 (ROOM 201 · VIP SUITE)
# ==============================================================================
# Khung bao cửa phòng gỗ mun nẹp đồng
box('room-door-frame-l', (4.65, 3.48, 6.55), (0.10, 2.18, 0.12), 6, bevel=0.02)
box('room-door-frame-r', (5.95, 3.48, 6.55), (0.10, 2.18, 0.12), 6, bevel=0.02)
box('room-door-lintel', (5.3, 4.62, 6.55), (1.40, 0.12, 0.14), 6, bevel=0.02)
box('room-door-threshold', (5.3, 2.42, 6.55), (1.30, 0.04, 0.12), 6)

# Tường ngăn tầng 2 bao quanh khung cửa phòng (không bị hở ra khoảng không ngoài toà nhà)
box('mezzanine-wall-l', (4.15, 3.7, 6.55), (0.9, 2.6, 0.12), 2)
box('mezzanine-wall-r', (6.45, 3.7, 6.55), (0.9, 2.6, 0.12), 2)
box('mezzanine-wall-top', (5.3, 4.95, 6.55), (3.2, 0.54, 0.12), 2)
# Hốc tiền sảnh bước vào phòng bọc nhung mận chín
box('mezzanine-door-recess', (5.3, 3.48, 6.85), (1.3, 2.2, 0.5), mat=velvet_plum)

# Đèn tường ấm áp hắt xuống cửa phòng
box('room-sconce-arm', (5.3, 4.75, 6.45), (0.04, 0.04, 0.16), 6)
box('room-sconce-lamp', (5.3, 4.75, 6.36), (0.14, 0.18, 0.14), mat=amber_glow, bevel=0.02)

# Biển hiệu neon trên đầu cửa
box('hotel-door-sign-bg', (5.3, 4.96, 6.78), (2.4, 0.32, 0.06), mat=velvet_plum)
box('hotel-door-sign-neon', (5.3, 4.96, 6.74), (2.2, 0.18, 0.03), mat=rose_gold)

bpy.ops.object.select_all(action='DESELECT')
for obj in items:
    obj.select_set(True)
bpy.context.view_layer.objects.active = items[0]
RAW_GLB = ROOT / 'assets/processed/reika-lounge.raw.glb'
PUBLIC_GLB = ROOT / 'apps/web/public/assets/buildings/reika-lounge.glb'
bpy.ops.export_scene.gltf(
    filepath=str(RAW_GLB),
    export_format='GLB',
    use_selection=True,
    export_yup=True,
    export_animations=False,
)
PUBLIC_GLB.write_bytes(RAW_GLB.read_bytes())

scene = bpy.context.scene
data = bpy.data.cameras.new('Lounge preview')
cam = bpy.data.objects.new('Lounge preview', data)
scene.collection.objects.link(cam)
cam.location = (0, -9.2, 4.6)
cam.rotation_euler = (Vector((0, 3.5, 1.6)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera = cam
data.lens = 24
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/processed/reika-lounge.blend'))
print('REIKA_LOUNGE_EXPORT_COMPLETE', len(items))
