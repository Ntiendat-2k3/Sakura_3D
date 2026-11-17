"""Dựng nội thất Denmu Night Club (neon Tokyo, "wine × pop") trong Blender rồi xuất GLB.

Giữ nguyên các mốc mà code runtime phụ thuộc:
- Mặt sàn ~0 m, sân khấu cao 0.76 m (x ±5.5, z -7.8..-3.5), bục DJ ở (0, 0.77, -6.5).
- Quầy bar trái (x -7.8..-5.4) và dãy sofa phải (đệm cao 0.78 m, ghế CLUB_SEATS x 6.6, z -2.1/0/2.1).
- Mặt tường chiếu đèn disco ở |x|, |z| ≈ 7.76 và trần ≤ 5.55 m (clubProjection.ts).
- Ô sàn LED x -3..3, z -2..2 do DanceFloorLightingSystem vẽ ở runtime.
Đồ nội thất đứng được thêm ở góc trước phải khớp với CLUB_COLLIDERS trong game-protocol.
"""
import bpy, math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
RAW_GLB = ROOT / 'assets/processed/denmu-club.raw.glb'
PUBLIC_GLB = ROOT / 'apps/web/public/assets/buildings/denmu-club.glb'
bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'assets/processed/neon-sakura-street.blend'))
surface = bpy.data.materials.get('Sakura / stone wood glass metal fabric')
if not surface: raise RuntimeError('Missing shared material')
for obj in list(bpy.data.objects): bpy.data.objects.remove(obj, do_unlink=True)
items = []


def material(name, color, emission=0.0, roughness=.45, metallic=0.0):
    mat = bpy.data.materials.new(name); mat.use_nodes = True
    node = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    node.inputs['Base Color'].default_value = (*color, 1)
    node.inputs['Roughness'].default_value = roughness
    node.inputs['Metallic'].default_value = metallic
    node.inputs['Emission Color'].default_value = (*color, 1)
    node.inputs['Emission Strength'].default_value = emission
    return mat


# Bảng màu: đen bóng + chrome + vàng champagne làm nền, neon hồng/xanh/tím làm điểm nhấn.
pink = material('Club / rose light', (1, .06, .3), 2)
cyan = material('Club / cyan light', (.05, .65, 1), 2)
violet = material('Club / violet light', (.45, .08, 1), 2)
amber = material('Club / champagne light', (1, .62, .25), 1.6)
pink_soft = material('Club / rose glow panel', (1, .1, .45), .7)
dark = material('Club / acoustic velvet', (.045, .02, .075), roughness=.85)
obsidian = material('Club / obsidian gloss floor', (.018, .014, .026), roughness=.12, metallic=.35)
lacquer = material('Club / black piano lacquer', (.02, .015, .025), roughness=.18, metallic=.1)
chrome = material('Club / mirror chrome', (.82, .82, .9), roughness=.12, metallic=1)
gold = material('Club / champagne gold', (.92, .68, .32), roughness=.24, metallic=1)
plum = material('Club / plum velvet wall', (.11, .025, .1), roughness=.82)
magenta_velvet = material('Club / magenta tufted velvet', (.36, .02, .2), roughness=.7)
wine_velvet = material('Club / wine runner velvet', (.24, .015, .06), roughness=.8)
mirror = material('Club / smoked mirror', (.08, .07, .12), roughness=.04, metallic=1)
marble = material('Club / white onyx', (.82, .78, .8), roughness=.15, emission=.08)
bottle_mats = [material(f'Club / bottle {i}', c, 1.1, roughness=.1) for i, c in enumerate([(1, .45, .1), (.3, 1, .45), (.25, .55, 1), (1, .2, .5), (.85, .85, 1)])]


def box(name, position, size, tile=14, mat=None, bevel=.04, rotation_y=0.0):
    x, y, z = position; w, h, d = size
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -z, y))
    obj = bpy.context.object; obj.name = name; obj.dimensions = (w, d, h)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new('Rounded edges', 'BEVEL'); mod.width = bevel; mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if rotation_y:
        obj.rotation_euler = (0, 0, rotation_y)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    obj.data.materials.clear(); obj.data.materials.append(mat or surface)
    if not mat:
        uv = obj.data.uv_layers.active
        for point in uv.data:
            u, v = point.uv
            point.uv = ((tile % 4 + .01 + u * .98) / 4, (3 - tile // 4 + .01 + v * .98) / 4)
    items.append(obj)
    return obj


def cylinder(name, position, radius, height, mat, vertices=24):
    x, y, z = position
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=height, location=(x, -z, y))
    obj = bpy.context.object; obj.name = name
    obj.data.materials.clear(); obj.data.materials.append(mat)
    items.append(obj)
    return obj


def ring(name, position, radius, thickness, mat, facing='up', segments=48):
    """Vòng neon/khung tròn; facing='up' nằm ngang (trần), 'front' dựng đứng nhìn theo trục z."""
    x, y, z = position
    bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=thickness, major_segments=segments, minor_segments=8, location=(x, -z, y))
    obj = bpy.context.object; obj.name = name
    if facing == 'front':
        obj.rotation_euler = (math.pi / 2, 0, 0)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    obj.data.materials.clear(); obj.data.materials.append(mat)
    items.append(obj)
    return obj


# ==============================================================================
# 1. VỎ PHÒNG: SÀN ĐEN BÓNG, TƯỜNG NHUNG MẬN, ỐP CHÂN TƯỜNG LACQUER + NẸP VÀNG, TRẦN
# ==============================================================================
box('dance-floor', (0, -.13, 0), (16, .24, 16), mat=obsidian)
box('back-wall', (0, 2.7, -8), (16, 5.6, .25), mat=plum)
box('ceiling', (0, 5.72, 0), (16, .2, 16), mat=dark, bevel=0)
for side in [-1, 1]:
    box('side-wall', (side * 8, 2.7, 0), (.25, 5.6, 16), mat=plum)
    box('front-wall', (side * 4.9, 2.7, 7.9), (6.2, 5.6, .2), mat=plum)
    box('door-gold-jamb', (side * 1.6, 1.6, 7.8), (.12, 3.2, .2), mat=gold)
    # Ốp chân tường lacquer đen + nẹp vàng chạy quanh phòng (mỏng để không che vùng chiếu disco ở 7.76).
    box('wainscot', (side * 7.86, .55, 0), (.04, 1.1, 15.7), mat=lacquer, bevel=0)
    box('wainscot-rail', (side * 7.83, 1.12, 0), (.05, .05, 15.7), mat=gold, bevel=.01)
    box('front-wainscot', (side * 4.75, .55, 7.78), (6.3, 1.1, .04), mat=lacquer, bevel=0)
    box('front-wainscot-rail', (side * 4.75, 1.12, 7.76), (6.3, .05, .05), mat=gold, bevel=.01)
    for z in [-5, -2, 1, 4, 7]:
        box('wall-pilaster', (side * 7.8, 2.75, z), (.18, 5.5, .18), mat=chrome, bevel=.02)
        if z in (-5, 4, 7):  # Pilaster sau quầy bar / sofa VIP không gắn neon để khỏi xuyên kệ rượu và gương.
            box('pilaster-neon', (side * 7.7, 2.9, z), (.03, 3.4, .05), mat=violet if z % 2 else cyan, bevel=0)
    box('wall-neon', (side * 7.78, 4.5, 0), (.09, .08, 15), mat=pink if side < 0 else cyan)
    box('ceiling-cove', (side * 7.6, 5.55, 0), (.4, .06, 15.6), mat=pink if side < 0 else cyan, bevel=0)
box('back-wainscot', (0, .55, -7.86), (15.7, 1.1, .04), mat=lacquer, bevel=0)
box('front-header', (0, 4.4, 7.9), (3.2, 2.4, .2), mat=plum)
box('front-cove', (0, 5.55, 7.6), (15.6, .06, .4), mat=violet, bevel=0)

# Trần: dầm lưới chrome mảnh + 3 vòng halo LED đồng tâm trên sàn nhảy (dưới 5.55 m của trần chiếu).
for x in [-6, -3, 0, 3, 6]:
    box('ceiling-grid-x', (x, 5.6, 0), (.08, .1, 15.6), mat=chrome, bevel=0)
for z in [-6, -3, 0, 3, 6]:
    box('ceiling-grid-z', (0, 5.6, z), (15.6, .1, .08), mat=chrome, bevel=0)
for index, (radius, mat) in enumerate([(1.6, pink), (2.6, violet), (3.6, cyan)]):
    ring(f'halo-ring-{index}', (0, 5.38 + index * .04, -.3), radius, .045, mat)
    for a in range(4):
        angle = a * math.pi / 2 + math.pi / 4
        cylinder(f'halo-cable-{index}-{a}', (math.cos(angle) * radius, 5.5 + index * .02, -.3 + math.sin(angle) * radius), .008, .24, chrome, 6)

# ==============================================================================
# 2. LỐI VÀO: THẢM NHUNG RƯỢU VANG, ĐÈN DẪN SÀN, 2 KHUNG CỔNG NEON
# ==============================================================================
box('entrance-runner', (0, .004, 5.0), (2.6, .015, 5.6), mat=wine_velvet, bevel=0)
for side in [-1, 1]:
    box('runner-gold-edge', (side * 1.33, .006, 5.0), (.06, .015, 5.6), mat=gold, bevel=0)
    for z in [2.6, 3.6, 4.6, 5.6, 6.6, 7.4]:
        cylinder('runner-floor-led', (side * 1.5, .012, z), .05, .02, amber, 12)
for index, z in enumerate([6.95, 5.75]):
    for side in [-1, 1]:
        box('gate-post', (side * 1.75, 1.55, z), (.12, 3.1, .12), mat=chrome, bevel=.02)
        box('gate-post-neon', (side * 1.68, 1.55, z), (.03, 2.9, .05), mat=pink if index == 0 else cyan, bevel=0)
    box('gate-lintel', (0, 3.12, z), (3.62, .14, .14), mat=chrome, bevel=.02)
    box('gate-lintel-neon', (0, 3.04, z), (3.4, .04, .05), mat=pink if index == 0 else cyan, bevel=0)

# ==============================================================================
# 3. SÀN NHẢY: KHUNG CHROME + VIỀN NEON QUANH Ô LED, ĐÈN SÀN 4 GÓC
# ==============================================================================
for i in range(6):
    for j in range(4):
        box('floor-inlay', (-2.5 + i, .004, -1.5 + j), (.96, .012, .96), mat=mirror, bevel=0)
for side in [-1, 1]:
    box('dancefloor-frame-x', (0, .02, side * 2.08), (6.32, .04, .16), mat=chrome, bevel=.01)
    box('dancefloor-neon-x', (0, .045, side * 2.08), (6.1, .015, .04), mat=pink, bevel=0)
    box('dancefloor-frame-z', (side * 3.08, .02, 0), (.16, .04, 4.32), mat=chrome, bevel=.01)
    box('dancefloor-neon-z', (side * 3.08, .045, 0), (.04, .015, 4.1), mat=cyan, bevel=0)
for sx in [-1, 1]:
    for sz in [-1, 1]:
        cylinder('dancefloor-corner-disc', (sx * 3.08, .03, sz * 2.08), .22, .04, gold)
        cylinder('dancefloor-corner-led', (sx * 3.08, .055, sz * 2.08), .14, .02, violet)

# ==============================================================================
# 4. SÂN KHẤU: BỤC LACQUER, BẬC NEON, KHUNG CỔNG CHROME, VÒNG HALO SAU DJ, TƯỜNG LED
# ==============================================================================
box('stage', (0, .38, -5.65), (11, .76, 4.3), mat=lacquer, bevel=.08)
box('stage-gold-front', (0, .74, -3.5), (10.9, .05, .08), mat=gold)
box('stage-neon-front', (0, .15, -3.48), (10.7, .05, .06), mat=pink)
box('stage-neon-mid', (0, .45, -3.48), (10.7, .03, .05), mat=violet, bevel=0)
for side in [-1, 1]:
    box('stage-side-neon', (side * 5.48, .45, -5.65), (.05, .03, 4.2), mat=cyan, bevel=0)
    # Cột cổng sân khấu (proscenium) trong vùng collider sân khấu.
    box('proscenium-column', (side * 5.3, 2.95, -3.75), (.32, 4.4, .32), mat=chrome, bevel=.04)
    for k in range(5):
        box('proscenium-led', (side * 5.3, 1.3 + k * .8, -3.58), (.22, .5, .03), mat=pink_soft, bevel=0)
box('proscenium-header', (0, 5.22, -3.75), (10.92, .36, .36), mat=chrome, bevel=.04)
box('proscenium-header-neon', (0, 5.08, -3.56), (10.4, .05, .04), mat=pink, bevel=0)
for k in range(12):
    cylinder('proscenium-bulb', (-4.95 + k * .9, 5.22, -3.55), .05, .04, amber, 10)

box('backdrop', (0, 2.85, -7.75), (10.4, 4.1, .12), mat=dark)
box('backdrop-frame-top', (0, 4.92, -7.7), (10.6, .1, .1), mat=gold)
box('backdrop-frame-bottom', (0, .8, -7.7), (10.6, .1, .1), mat=gold)
for i in range(13):
    x = -4.8 + i * .8
    if abs(x) < 1.5: continue  # Chừa khoảng sau lưng DJ cho vòng halo.
    box('backdrop-light-bar', (x, 2.85, -7.66), (.05, 3.9, .04), mat=[pink, violet, cyan][i % 3], bevel=0)
ring('dj-halo-outer', (0, 2.45, -7.64), 1.32, .05, pink, facing='front', segments=64)
ring('dj-halo-inner', (0, 2.45, -7.62), 1.1, .03, cyan, facing='front', segments=64)
for x in [-4.7, 4.7]:
    box('speaker', (x, 1.55, -6.8), (1.0, 1.6, .8), mat=lacquer, bevel=.08)
    box('speaker-trim', (x, 2.36, -6.8), (1.04, .04, .84), mat=gold, bevel=0)
    for y in [1.2, 1.9]:
        ring('speaker-cone-ring', (x, y, -6.39), .3, .025, chrome, facing='front', segments=24)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=.28, location=(x, 6.38, y))
        obj = bpy.context.object; obj.name = 'speaker-cone'; obj.scale = (1, .14, 1); obj.data.materials.append(dark); items.append(obj)
for x in [-4, -2, 2, 4]:
    box('ceiling-truss', (x, 5.0, -5.6), (.07, .1, 4.4), mat=chrome, bevel=0)
    box('ceiling-tube', (x, 4.95, -5.6), (.08, .05, 3.8), mat=pink if x % 4 else cyan, bevel=0)

# ==============================================================================
# 5. QUẦY BAR TRÁI: QUẦY LACQUER MẶT ĐÁ ONYX PHÁT SÁNG, KỆ RƯỢU GƯƠNG, GHẾ BAR, ĐÈN THẢ
# ==============================================================================
box('bar-counter', (-6.6, .62, 0), (.9, 1.24, 6.2), mat=lacquer, bevel=.06)
box('bar-gold-top', (-6.6, 1.28, 0), (1.25, .08, 6.4), mat=marble, bevel=.03)
box('bar-gold-edge', (-6.0, 1.22, 0), (.04, .05, 6.4), mat=gold, bevel=0)
box('bar-glow', (-6.13, .1, 0), (.04, .05, 6.0), mat=cyan, bevel=0)
for z in [-2.4, -1.2, 0, 1.2, 2.4]:
    box('bar-front-fluting', (-6.13, .65, z), (.03, 1.0, .08), mat=gold, bevel=0)
box('back-bar-mirror', (-7.84, 2.45, 0), (.03, 2.1, 6.0), mat=mirror, bevel=0)
box('back-bar-frame', (-7.82, 3.55, 0), (.06, .08, 6.2), mat=gold, bevel=0)
for level, y in enumerate([1.62, 2.22, 2.82]):
    box('back-bar-shelf', (-7.62, y, 0), (.36, .04, 5.8), mat=chrome, bevel=0)
    box('back-bar-shelf-led', (-7.48, y - .03, 0), (.03, .015, 5.7), mat=amber, bevel=0)
    for k in range(13):
        h = .26 + .05 * ((k + level) % 3)
        cylinder('back-bar-bottle', (-7.66, y + .02 + h / 2, -2.7 + k * .45), .045, h, bottle_mats[(k + level) % len(bottle_mats)], 10)
for z in [-2.4, -1.2, 0, 1.2, 2.4]:
    cylinder('bar-stool-base', (-5.75, .03, z), .2, .05, chrome)
    cylinder('bar-stool-stem', (-5.75, .4, z), .035, .72, chrome, 12)
    ring('bar-stool-footrest', (-5.75, .3, z), .17, .015, gold, segments=20)
    cylinder('bar-stool-seat', (-5.75, .8, z), .21, .08, magenta_velvet)
# Đèn thả đặt lệch khỏi 2 đèn bar runtime (x -6.8, z 0 / 2, y 3.5) trong club-lighting-layout.json.
for z in [-2.5, -1.0, 1.0]:
    cylinder('bar-pendant-cord', (-6.2, 4.3, z), .008, 2.6, chrome, 6)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=10, radius=.17, location=(-6.2, -z, 2.95))
    obj = bpy.context.object; obj.name = 'bar-pendant-globe'; obj.data.materials.append(amber); items.append(obj)
for z in [-1.6, .4, 1.9]:
    cylinder('bar-glass', (-6.35, 1.37, z), .035, .1, chrome, 10)
cylinder('bar-champagne-bucket', (-6.4, 1.42, -.6), .1, .2, gold)
cylinder('bar-champagne-bottle', (-6.4, 1.6, -.6), .04, .26, bottle_mats[1], 10)

# ==============================================================================
# 6. KHU SOFA VIP PHẢI: BĂNG GHẾ NHUNG MAGENTA, LƯNG CAO CHẦN RÃNH, GƯƠNG VIỀN NEON
# ==============================================================================
for z in [-2.1, 0, 2.1]:
    box('sofa-seat', (6.9, .39, z), (1.5, .78, 1.8), mat=magenta_velvet, bevel=.14)
    box('sofa-plinth', (6.9, .04, z), (1.56, .08, 1.86), mat=gold, bevel=.01)
    for dz in [-.85, .85]: box('sofa-arm', (6.9, .82, z + dz), (1.5, .48, .15), mat=lacquer, bevel=.04)
box('sofa-back', (7.55, 1.25, 0), (.3, 1.9, 6.1), mat=magenta_velvet, bevel=.1)
for k in range(15):
    box('sofa-back-channel', (7.39, 1.25, -2.8 + k * .4), (.04, 1.75, .03), mat=lacquer, bevel=0)
box('sofa-back-gold-cap', (7.55, 2.22, 0), (.36, .06, 6.2), mat=gold, bevel=.01)
box('sofa-underglow', (6.16, .1, 0), (.04, .05, 6.0), mat=pink, bevel=0)
box('vip-mirror', (7.84, 3.35, 0), (.03, 1.6, 5.2), mat=mirror, bevel=0)
box('vip-mirror-neon-top', (7.8, 4.18, 0), (.04, .04, 5.3), mat=pink, bevel=0)
box('vip-mirror-neon-bottom', (7.8, 2.52, 0), (.04, .04, 5.3), mat=pink, bevel=0)
for z in [-1.05, 1.05]:
    cylinder('vip-side-bucket', (6.9, 1.12, z), .09, .16, gold)
    cylinder('vip-side-bottle', (6.9, 1.28, z), .035, .24, bottle_mats[3], 10)

# ==============================================================================
# 7. GÓC TRƯỚC: BÀN COCKTAIL ĐỨNG (TRÁI) VÀ BOOTH TRÒN VIP (PHẢI) — KHỚP CLUB_COLLIDERS
# ==============================================================================
for x, z in [(-6.3, 4.6), (-4.6, 5.9)]:
    cylinder('cocktail-base', (x, .03, z), .3, .05, chrome)
    cylinder('cocktail-stem', (x, .55, z), .045, 1.0, chrome, 12)
    cylinder('cocktail-top', (x, 1.07, z), .42, .05, marble, 32)
    ring('cocktail-rim', (x, 1.07, z), .42, .02, gold, segments=32)
    ring('cocktail-led', (x, 1.02, z), .36, .015, violet, segments=32)
    cylinder('cocktail-glass', (x + .12, 1.15, z - .08), .035, .11, chrome, 10)
    cylinder('cocktail-candle', (x - .1, 1.13, z + .06), .05, .08, amber, 12)
# Booth tròn: nửa vòng sofa quay về phía sàn nhảy, bàn tròn giữa, đèn thả trên.
booth = (6.15, 5.75)
for k in range(7):
    a = math.pi * (.5 + k / 6)
    bx, bz = booth[0] - math.cos(a) * 1.2, booth[1] + math.sin(a) * 1.2
    box('booth-seat', (bx, .32, bz), (.62, .5, .62), mat=magenta_velvet, bevel=.1, rotation_y=a - math.pi / 2)
    bx2, bz2 = booth[0] - math.cos(a) * 1.55, booth[1] + math.sin(a) * 1.55
    box('booth-back', (bx2, .75, bz2), (.64, 1.0, .18), mat=magenta_velvet, bevel=.06, rotation_y=a - math.pi / 2)
cylinder('booth-table-base', (booth[0], .03, booth[1]), .28, .05, gold)
cylinder('booth-table-stem', (booth[0], .35, booth[1]), .05, .6, gold, 12)
cylinder('booth-table-top', (booth[0], .67, booth[1]), .55, .05, marble, 32)
cylinder('booth-table-bucket', (booth[0], .78, booth[1]), .1, .18, gold)
cylinder('booth-table-bottle', (booth[0], .94, booth[1]), .04, .26, bottle_mats[0], 10)
cylinder('booth-pendant-cord', (booth[0], 4.55, booth[1]), .008, 2.1, chrome, 6)
ring('booth-pendant-ring', (booth[0], 3.5, booth[1]), .55, .03, pink, segments=40)
ring('booth-pendant-ring-2', (booth[0], 3.62, booth[1]), .4, .025, gold, segments=32)
# Tranh neon sakura trên tường trước hai bên cửa (dựng sát tường, không cản đi lại).
for side, mat in [(-1, pink), (1, cyan)]:
    cx = side * 4.6
    ring('front-neon-moon', (cx, 3.3, 7.74), .85, .035, mat, facing='front', segments=56)
    for p in range(5):
        a = p * 2 * math.pi / 5 + math.pi / 2
        ring('front-neon-petal', (cx + math.cos(a) * .38, 3.3 + math.sin(a) * .38, 7.72), .2, .02, pink_soft if side < 0 else violet, facing='front', segments=20)

# Gộp mesh cùng vật liệu: hàng trăm đạo cụ nhỏ thành ~30 draw call thay vì mỗi khối một lần vẽ.
by_material = {}
for obj in items: by_material.setdefault(obj.data.materials[0].name, []).append(obj)
items = []
for name, group in by_material.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in group: obj.select_set(True)
    bpy.context.view_layer.objects.active = group[0]
    if len(group) > 1: bpy.ops.object.join()
    group[0].name = 'club:' + name.split('/ ')[-1]
    items.append(group[0])
bpy.ops.object.select_all(action='DESELECT')
for obj in items: obj.select_set(True)
bpy.context.view_layer.objects.active = items[0]
bpy.ops.export_scene.gltf(filepath=str(RAW_GLB), export_format='GLB', use_selection=True, export_yup=True, export_animations=False)
PUBLIC_GLB.write_bytes(RAW_GLB.read_bytes())
scene = bpy.context.scene
data = bpy.data.cameras.new('Club preview'); cam = bpy.data.objects.new('Club preview', data); scene.collection.objects.link(cam)
cam.location = (0, -10, 5); cam.rotation_euler = (Vector((0, 4, 2)) - cam.location).to_track_quat('-Z', 'Y').to_euler(); scene.camera = cam; data.lens = 24
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/processed/denmu-club.blend'))
print('CLUB_EXPORT_COMPLETE', len(items))
