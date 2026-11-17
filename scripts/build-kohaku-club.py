"""Dựng nội thất Câu Lạc Bộ VIP 琥珀 (Kohaku Private Members Club) 3 Tầng bằng Blender 5.2.
Quy hoạch kiến trúc 3 tầng hoàn chỉnh đi lại được qua hệ thống cầu thang xoắn quanh giếng trời:
- Tầng 1 (y = 0.0m):
  + Sàn gỗ óc chó & thảm tròn Art Deco hoàng gia.
  + Bàn tròn Poker / Casino lớn ở trung tâm cho 2-4 người chơi + vị trí NPC Dealer chia bài.
  + Quầy Bar Whisky & Xì gà hảo hạng bên trái, khu Sofa Chesterfield & Bàn cờ vua bên phải, Lò sưởi & Vách gia huy Kohaku.
- Cầu thang 1 -> 2 (x: 4.7..7.1, z: -1.6..-6.0, y: 0.0..3.6m):
  + 16 bậc đá cẩm thạch đen nẹp đồng kèm đèn LED hắt chân từng bậc.
- Tầng 2 (y = 3.6m):
  + Sảnh hành lang chữ L/U (Chiếu nghỉ phải, Sảnh sau & Cánh trái) nhìn xuyên giếng trời xuống bàn Poker Tầng 1.
  + Khu bàn trà ngắm cảnh và lan can kính đồng thau bảo vệ.
- Cầu thang 2 -> 3 (x: -7.1..-4.7, z: -1.6..+2.8, y: 3.6..7.2m):
  + 16 bậc đối xứng bên cánh trái dẫn lên Tầng 3.
- Tầng 3 (y = 7.2m):
  + Sảnh thượng tầng Penthouse VIP rộng lớn phía trước & Hành lang ngắm cảnh cánh phải nhìn toàn cảnh 3 tầng giếng trời.
  + Đèn chùm pha lê khổng lồ thả cáp xuyên suốt từ mái (y = 10.8m) xuống bàn tròn Poker Tầng 1.
"""
import math
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
RAW_GLB = ROOT / 'assets/processed/kohaku-club.raw.glb'
PUBLIC_GLB = ROOT / 'apps/web/public/assets/buildings/kohaku-club.glb'
BLEND_FILE = ROOT / 'assets/processed/kohaku-club.blend'

# Xóa các đối tượng cũ trong scene
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)

# Lấy vật liệu atlas dùng chung từ neon-sakura-street.blend
surface = bpy.data.materials.get('Sakura / stone wood glass metal fabric')
if not surface:
    with bpy.data.libraries.load(str(ROOT / 'assets/processed/neon-sakura-street.blend'), link=False) as (data_from, data_to):
        data_to.materials = [name for name in data_from.materials if name == 'Sakura / stone wood glass metal fabric']
    surface = bpy.data.materials.get('Sakura / stone wood glass metal fabric')
if not surface:
    raise RuntimeError('Missing shared material from neon-sakura-street.blend')

items = []


def pbr(name, color, roughness=0.35, metallic=0.0, emission=(0, 0, 0), emission_strength=0.0, alpha=1.0):
    """Tạo vật liệu PBR cho nhung, nỉ poker, da thuộc, đá cẩm thạch, kính cường lực và đèn neon hổ phách."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    node = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    node.inputs['Base Color'].default_value = (*color, 1.0)
    node.inputs['Roughness'].default_value = roughness
    node.inputs['Metallic'].default_value = metallic
    if alpha < 1.0:
        node.inputs['Alpha'].default_value = alpha
        mat.blend_method = 'BLEND' if hasattr(mat, 'blend_method') else 'OPAQUE'
    if emission_strength > 0:
        node.inputs['Emission Color'].default_value = (*emission, 1.0)
        node.inputs['Emission Strength'].default_value = emission_strength
    return mat


# Bảng màu quý tộc Kohaku (Hổ phách - Vàng kim - Nâu gỗ gụ - Xanh ngọc lục bảo - Đỏ rượu vang)
amber_gold_light = pbr('Kohaku / amber neon light', (1.0, 0.75, 0.28), roughness=0.15, emission=(1.0, 0.72, 0.25), emission_strength=2.8)
warm_chandelier_light = pbr('Kohaku / crystal chandelier light', (1.0, 0.92, 0.75), roughness=0.1, emission=(1.0, 0.90, 0.70), emission_strength=3.5)
poker_felt_green = pbr('Kohaku / emerald casino felt', (0.04, 0.26, 0.12), roughness=0.88, metallic=0.0)
poker_leather_rail = pbr('Kohaku / armrest cognac leather', (0.32, 0.12, 0.05), roughness=0.45, metallic=0.05)
black_gold_marble = pbr('Kohaku / black gold marquina marble', (0.08, 0.07, 0.08), roughness=0.16, metallic=0.15)
rich_walnut_wood = pbr('Kohaku / polished dark walnut', (0.16, 0.08, 0.04), roughness=0.32, metallic=0.0)
chesterfield_leather = pbr('Kohaku / vintage brown leather', (0.22, 0.09, 0.04), roughness=0.55, metallic=0.05)
bordeaux_velvet = pbr('Kohaku / bordeaux wine velvet', (0.35, 0.04, 0.10), roughness=0.72, metallic=0.02)
brass_gold_metal = pbr('Kohaku / brushed brass gold', (0.85, 0.68, 0.26), roughness=0.28, metallic=0.85)
smoked_glass = pbr('Kohaku / smoked balustrade glass', (0.25, 0.20, 0.16), roughness=0.08, metallic=0.1, alpha=0.42)
skylight_amber_glass = pbr('Kohaku / amber skylight glass', (0.45, 0.30, 0.15), roughness=0.12, emission=(0.8, 0.55, 0.2), emission_strength=0.4)
chip_gold = pbr('Kohaku / gold poker chip', (0.95, 0.80, 0.30), roughness=0.2, metallic=0.7, emission=(0.95, 0.80, 0.30), emission_strength=0.8)
chip_red = pbr('Kohaku / crimson poker chip', (0.85, 0.08, 0.12), roughness=0.3, metallic=0.1)
chip_black = pbr('Kohaku / obsidian poker chip', (0.05, 0.05, 0.06), roughness=0.25, metallic=0.2)
bonsai_foliage = pbr('Kohaku / bonsai emerald foliage', (0.06, 0.25, 0.11), roughness=0.72, metallic=0.0)
porcelain_ivory = pbr('Kohaku / ivory porcelain', (0.92, 0.89, 0.84), roughness=0.2, metallic=0.05)
velvet_rope_red = pbr('Kohaku / vip velvet rope', (0.58, 0.04, 0.09), roughness=0.68, metallic=0.0)


def box(name, position, size, tile=14, mat=None, bevel=0.03, rotation_z=0.0):
    """Tạo khối hộp có vát cạnh UV và hỗ trợ xoay quanh trục thẳng đứng (yaw)."""
    x, y, z = position
    w, h, d = size
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -z, y))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (w, d, h)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        mod = obj.modifiers.new('Bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if rotation_z != 0.0:
        obj.rotation_euler = (0, 0, rotation_z)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    obj.data.materials.clear()
    obj.data.materials.append(mat or surface)
    if not mat:
        uv = obj.data.uv_layers.active
        for point in uv.data:
            u, v = point.uv
            point.uv = ((tile % 4 + 0.01 + u * 0.98) / 4, (3 - tile // 4 + 0.01 + v * 0.98) / 4)
    items.append(obj)
    return obj


def make_ring(name, position, inner_r, outer_r, height, segments=48, mat=None):
    """Tạo vòng xuyến rỗng lõi (hollow ring) cho vành đệm da tỳ tay và nẹp đồng quanh mặt bàn tròn."""
    import bmesh
    x, y, z = position
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    top_h = height / 2
    bot_h = -height / 2
    verts_top_in = []
    verts_top_out = []
    verts_bot_in = []
    verts_bot_out = []
    for i in range(segments):
        a = 2 * math.pi * i / segments
        ca, sa = math.cos(a), math.sin(a)
        verts_top_in.append(bm.verts.new((inner_r * ca, inner_r * sa, top_h)))
        verts_top_out.append(bm.verts.new((outer_r * ca, outer_r * sa, top_h)))
        verts_bot_in.append(bm.verts.new((inner_r * ca, inner_r * sa, bot_h)))
        verts_bot_out.append(bm.verts.new((outer_r * ca, outer_r * sa, bot_h)))
    for i in range(segments):
        ni = (i + 1) % segments
        bm.faces.new((verts_top_in[i], verts_top_out[i], verts_top_out[ni], verts_top_in[ni]))
        bm.faces.new((verts_bot_in[ni], verts_bot_out[ni], verts_bot_out[i], verts_bot_in[i]))
        bm.faces.new((verts_bot_out[i], verts_bot_out[ni], verts_top_out[ni], verts_top_out[i]))
        bm.faces.new((verts_top_in[i], verts_top_in[ni], verts_bot_in[ni], verts_bot_in[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = (x, -z, y)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat or surface)
    items.append(obj)
    return obj


def cylinder(name, position, radius, height, vertices=32, mat=None):
    """Tạo khối trụ tròn cho bàn, chân trụ, đèn chùm, phỉnh cược."""
    x, y, z = position
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=height,
        location=(x, -z, y),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.clear()
    obj.data.materials.append(mat or surface)
    items.append(obj)
    return obj


def make_railing_segment(name_prefix, p1, p2, base_y, height=0.95):
    """Tạo đoạn lan can kính cường lực + tay vịn đồng thau nối từ điểm (x1, z1) đến (x2, z2) trên cùng cao độ."""
    x1, z1 = p1
    x2, z2 = p2
    cx = (x1 + x2) / 2
    cz = (z1 + z2) / 2
    dx = x2 - x1
    dz = z2 - z1
    length = math.hypot(dx, dz)
    if length < 0.05:
        return
    is_x_aligned = abs(dx) >= abs(dz)
    w = length if is_x_aligned else 0.04
    d = 0.04 if is_x_aligned else length

    # Kính lan can
    box(f'{name_prefix}-glass', (cx, base_y + height * 0.48, cz), (w, height * 0.85, d), mat=smoked_glass, bevel=0.0)
    # Tay vịn đồng phía trên
    rw = length + 0.06 if is_x_aligned else 0.07
    rd = 0.07 if is_x_aligned else length + 0.06
    box(f'{name_prefix}-top', (cx, base_y + height, cz), (rw, 0.06, rd), mat=brass_gold_metal, bevel=0.01)
    # Trụ cột giữ kính hai đầu và điểm giữa
    posts = max(2, int(length / 1.5) + 1)
    for i in range(posts):
        t = i / (posts - 1)
        px = x1 + dx * t
        pz = z1 + dz * t
        box(f'{name_prefix}-post-{i}', (px, base_y + height * 0.5, pz), (0.07, height, 0.07), mat=brass_gold_metal, bevel=0.01)


def make_sloped_railing(name_prefix, x, z1, y1, z2, y2, height=0.95):
    """Tạo tay vịn nghiêng bằng các trụ đứng & thanh tay vịn chia nhịp dọc theo cầu thang."""
    steps = 6
    for i in range(steps + 1):
        t = i / steps
        pz = z1 + (z2 - z1) * t
        py = y1 + (y2 - y1) * t
        box(f'{name_prefix}-post-{i}', (x, py + height * 0.5, pz), (0.06, height, 0.06), mat=brass_gold_metal, bevel=0.01)
    # Các thanh tay vịn xiên ghép theo đoạn ngắn mượt mà
    for i in range(steps):
        t_mid = (i + 0.5) / steps
        mz = z1 + (z2 - z1) * t_mid
        my = y1 + (y2 - y1) * t_mid + height
        seg_dz = abs(z2 - z1) / steps
        seg_dy = abs(y2 - y1) / steps
        seg_len = math.hypot(seg_dz, seg_dy) + 0.04
        angle = math.atan2(y2 - y1, -(z2 - z1))
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -mz, my))
        obj = bpy.context.object
        obj.name = f'{name_prefix}-rail-{i}'
        obj.dimensions = (0.07, seg_len, 0.06)
        # Xoay trên trục X trong tọa độ Blender (Y hướng -Z, Z hướng +Y) để song song với dốc bậc thang
        obj.rotation_euler = (angle, 0, 0)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        obj.data.materials.clear()
        obj.data.materials.append(brass_gold_metal)
        items.append(obj)


# ==============================================================================
# 1. KHUNG TÒA NHÀ 3 TẦNG, SÀN TẦNG 1 & CỘT TRỤ ĐÈN HẮT THÔNG TẦNG
# ==============================================================================
# Sàn gỗ óc chó Tầng 1 (15.2m x 15.2m, mặt sàn y = 0)
box('floor-1f-walnut', (0, -0.12, 0), (15.2, 0.24, 15.2), 2)
# Thảm tròn nhung đỏ rượu bọc nẹp đồng viền vàng Art Deco ở trung tâm Tầng 1
cylinder('carpet-felt-center', (0, 0.008, 0), radius=2.6, height=0.016, vertices=48, mat=bordeaux_velvet)
cylinder('carpet-border-brass', (0, 0.004, 0), radius=2.72, height=0.01, vertices=48, mat=brass_gold_metal)

# Hệ tường bao cao 11.2m ôm trọn 3 tầng (y: 0 -> 11.2m)
wall_h = 11.2
wall_cy = wall_h / 2
# Tường sau (z = -7.4)
box('back-wall', (0, wall_cy, -7.4), (15.2, wall_h, 0.24), 2)
# Tường trước có cửa đón sảnh Tầng 1 ở giữa (z = 7.4)
box('front-wall-left', (-4.4, wall_cy, 7.4), (6.4, wall_h, 0.24), 2)
box('front-wall-right', (4.4, wall_cy, 7.4), (6.4, wall_h, 0.24), 2)
box('front-wall-top', (0, 7.1, 7.4), (2.4, 8.2, 0.24), 2)
# Tường bên trái (x = -7.4) & Tường bên phải (x = 7.4)
box('left-wall', (-7.4, wall_cy, 0), (0.24, wall_h, 15.2), 0)
box('right-wall', (7.4, wall_cy, 0), (0.24, wall_h, 15.2), 0)

# Mái che giếng trời trên cao (y = 11.1m) với ô kính Art Deco ở giữa để không bí
box('roof-frame-n', (0, 11.1, -5.6), (15.2, 0.2, 3.8), mat=rich_walnut_wood)
box('roof-frame-s', (0, 11.1, 5.6), (15.2, 0.2, 3.8), mat=rich_walnut_wood)
box('roof-frame-w', (-5.6, 11.1, 0), (4.0, 0.2, 7.6), mat=rich_walnut_wood)
box('roof-frame-e', (5.6, 11.1, 0), (4.0, 0.2, 7.6), mat=rich_walnut_wood)
box('roof-skylight-glass', (0, 11.15, 0), (7.6, 0.08, 7.6), mat=skylight_amber_glass, bevel=0.0)
# Thanh dầm trang trí mái giao nhau tại tâm treo dây đèn chùm
box('roof-beam-x', (0, 10.95, 0), (7.8, 0.18, 0.24), mat=brass_gold_metal)
box('roof-beam-z', (0, 10.95, 0), (0.24, 0.18, 7.8), mat=brass_gold_metal)

# Hệ thống cột trụ thông tầng 3 tầng & chỉ đèn LED vàng hổ phách mỗi tầng
for side in [-1, 1]:
    for z in [-5.8, -2.5, 0.8, 4.0, 6.6]:
        box(f'wall-pilaster-{side}-{z}', (side * 7.22, wall_cy, z), (0.22, wall_h, 0.24), mat=rich_walnut_wood)
        box(f'wall-pilaster-brass-{side}-{z}', (side * 7.15, wall_cy, z), (0.06, wall_h - 0.3, 0.10), mat=brass_gold_metal)
    # Đèn hắt chỉ tường cho Tầng 1 (y=3.4), Tầng 2 (y=7.0), Tầng 3 (y=10.6)
    for lvl_y in [3.42, 7.02, 10.62]:
        box(f'cornice-light-{side}-{lvl_y}', (side * 7.16, lvl_y, 0), (0.08, 0.06, 14.2), mat=amber_gold_light)

# Đèn hắt tường sau và tường trước ở Tầng 2 và Tầng 3
for lvl_y in [7.02, 10.62]:
    box(f'back-cornice-light-{lvl_y}', (0, lvl_y, -7.22), (14.2, 0.06, 0.08), mat=amber_gold_light)
    box(f'front-cornice-light-{lvl_y}', (0, lvl_y, 7.22), (14.2, 0.06, 0.08), mat=amber_gold_light)

# Khung cửa đón tiếp sang trọng Tầng 1 (Z = 7.3)
box('entrance-frame-l', (-1.15, 1.50, 7.32), (0.12, 3.0, 0.2), mat=brass_gold_metal)
box('entrance-frame-r', (1.15, 1.50, 7.32), (0.12, 3.0, 0.2), mat=brass_gold_metal)
box('entrance-lintel', (0, 3.05, 7.32), (2.42, 0.12, 0.2), mat=brass_gold_metal)
box('entrance-sign-board', (0, 3.30, 7.28), (2.2, 0.36, 0.08), mat=rich_walnut_wood)
box('entrance-sign-gold', (0, 3.30, 7.22), (2.0, 0.24, 0.04), mat=amber_gold_light)


# ==============================================================================
# 2. TẦNG 1: BÀN TRÒN CHƠI BÀI VIP Ở TRUNG TÂM (GRAND HIGH-ROLLER CARD TABLE)
# ==============================================================================
# Chiều cao chuẩn khớp animation Sit (đệm 0.76m, đùi ~0.84m, mặt bàn 0.95m)
cylinder('table-pedestal-base', (0, 0.08, 0), radius=0.68, height=0.16, vertices=32, mat=brass_gold_metal)
cylinder('table-pedestal-column', (0, 0.48, 0), radius=0.38, height=0.72, vertices=32, mat=rich_walnut_wood)
cylinder('table-pedestal-collar', (0, 0.84, 0), radius=0.55, height=0.08, vertices=32, mat=brass_gold_metal)

cylinder('table-sub-top', (0, 0.90, 0), radius=1.48, height=0.06, vertices=48, mat=rich_walnut_wood)
# Mặt nỉ xanh ngọc lục bảo (Emerald Felt) nằm lộ sáng rực ở giữa lòng bàn
cylinder('table-felt-surface', (0, 0.945, 0), radius=1.32, height=0.025, vertices=48, mat=poker_felt_green)
# Nẹp đồng thau rỗng lõi và vành đệm da tỳ tay cognac rỗng lõi bao quanh viền bàn
make_ring('table-armrest-inner-trim', (0, 0.958, 0), 1.30, 1.34, 0.03, segments=48, mat=brass_gold_metal)
make_ring('table-armrest-ring', (0, 0.968, 0), 1.34, 1.50, 0.052, segments=48, mat=poker_leather_rail)
# Đường kẻ đồng thau chia khu vực đặt cược (Betting Line) trên mặt nỉ xanh
make_ring('table-betting-line', (0, 0.960, 0), 0.82, 0.84, 0.008, segments=48, mat=brass_gold_metal)

box('dealer-chip-tray-case', (0, 0.97, -0.92), (0.62, 0.04, 0.24), mat=brass_gold_metal, bevel=0.01)
box('dealer-card-shoe', (0.42, 0.995, -0.78), (0.16, 0.08, 0.22), mat=black_gold_marble, bevel=0.01)
# Nút Dealer Button & 2 bộ bài Tây trên mặt nỉ xanh
cylinder('dealer-button-rim', (-0.18, 0.963, -0.45), radius=0.055, height=0.012, vertices=24, mat=brass_gold_metal)
cylinder('dealer-button-disc', (-0.18, 0.967, -0.45), radius=0.045, height=0.012, vertices=24, mat=porcelain_ivory)
box('poker-deck-1', (-0.42, 0.973, -0.78), (0.07, 0.025, 0.095), mat=porcelain_ivory, bevel=0.005)
box('poker-deck-2', (-0.52, 0.973, -0.78), (0.07, 0.025, 0.095), mat=bordeaux_velvet, bevel=0.005)

for idx, (cx, cz) in enumerate([(-0.35, 0.2), (0.35, 0.2), (-0.4, -0.2), (0.4, -0.2)]):
    cylinder(f'chip-stack-gold-{idx}', (cx, 0.98, cz), radius=0.045, height=0.04, vertices=16, mat=chip_gold)
    cylinder(f'chip-stack-red-{idx}', (cx + 0.08, 0.985, cz + 0.04), radius=0.045, height=0.05, vertices=16, mat=chip_red)
    cylinder(f'chip-stack-black-{idx}', (cx - 0.08, 0.975, cz + 0.04), radius=0.045, height=0.03, vertices=16, mat=chip_black)


# ==============================================================================
# 3. TẦNG 1: GHẾ DEALER & 4 GHẾ NGƯỜI CHƠI QUANH BÀN TRÒN (CHUẨN ĐỘ CAO SIT 0.76m)
# ==============================================================================
def make_casino_chair(name, position, yaw, is_dealer=False):
    """Tạo ghế Casino High-Roller chân mạ đồng có vòng gác chân, đệm 0.76m khớp chuẩn animation Sit."""
    x, y, z = position
    seat_mat = chesterfield_leather if is_dealer else bordeaux_velvet
    cylinder(f'{name}-base', (x, y + 0.03, z), radius=0.28, height=0.06, vertices=20, mat=brass_gold_metal)
    cylinder(f'{name}-stem', (x, y + 0.37, z), radius=0.042, height=0.66, vertices=12, mat=brass_gold_metal)
    make_ring(f'{name}-footrest', (x, y + 0.30, z), 0.23, 0.265, 0.03, segments=24, mat=brass_gold_metal)
    cylinder(f'{name}-cushion', (x, y + 0.72, z), radius=0.28, height=0.08, vertices=24, mat=seat_mat)
    back_dist = 0.26
    bx = x - math.sin(yaw) * back_dist
    bz = z - math.cos(yaw) * back_dist
    back_h = 0.52 if is_dealer else 0.45
    box(f'{name}-backrest', (bx, y + 0.96, bz), (0.46, back_h, 0.08), mat=seat_mat, bevel=0.025, rotation_z=yaw)


make_casino_chair('seat-dealer', (0, 0, -1.88), 0, is_dealer=True)
make_casino_chair('seat-player-1', (-1.82, 0, -0.45), math.atan2(1.82, 0.45))
make_casino_chair('seat-player-2', (-1.28, 0, 1.32), math.atan2(1.28, -1.32))
make_casino_chair('seat-player-3', (1.28, 0, 1.32), math.atan2(-1.28, -1.32))
make_casino_chair('seat-player-4', (1.82, 0, -0.45), math.atan2(-1.82, 0.45))


# ==============================================================================
# 4. ĐÈN CHÙM PHA LÊ 3 TẦNG THẢ CÁP XUYÊN GIẾNG TRỜI TỪ MÁI (y = 10.9 -> 3.4m)
# ==============================================================================
cylinder('chandelier-ceiling-mount', (0, 10.92, 0), radius=0.45, height=0.12, vertices=24, mat=brass_gold_metal)
# Trục cáp thả dài xuyên suốt 3 tầng giếng trời từ y = 10.9 xuống tới đỉnh đèn y = 3.55
cylinder('chandelier-drop-rod', (0, 7.22, 0), radius=0.035, height=7.35, vertices=12, mat=brass_gold_metal)
cylinder('chandelier-mount', (0, 3.85, 0), radius=0.28, height=0.08, vertices=24, mat=brass_gold_metal)
cylinder('chandelier-ring-outer', (0, 3.55, 0), radius=1.08, height=0.12, vertices=32, mat=brass_gold_metal)
cylinder('chandelier-crystal-outer', (0, 3.48, 0), radius=1.04, height=0.22, vertices=32, mat=warm_chandelier_light)
cylinder('chandelier-ring-mid', (0, 3.32, 0), radius=0.70, height=0.10, vertices=24, mat=brass_gold_metal)
cylinder('chandelier-crystal-mid', (0, 3.26, 0), radius=0.66, height=0.18, vertices=24, mat=warm_chandelier_light)
cylinder('chandelier-ring-inner', (0, 3.12, 0), radius=0.36, height=0.08, vertices=16, mat=brass_gold_metal)
cylinder('chandelier-crystal-inner', (0, 3.06, 0), radius=0.34, height=0.15, vertices=16, mat=warm_chandelier_light)


# ==============================================================================
# 5. CẦU THANG TẦNG 1 -> TẦNG 2 (CÁNH PHẢI: 24 bậc mảnh, dy = 0.15m)
# ==============================================================================
stair12_x = 5.9
stair12_w = 2.4
stair12_steps = 24
s12_z0, s12_z1 = -1.6, -6.0
s12_dz = (s12_z1 - s12_z0) / stair12_steps
s12_dy = 3.6 / stair12_steps

for i in range(stair12_steps):
    cy = (i + 0.5) * s12_dy
    cz = s12_z0 + (i + 0.5) * s12_dz
    box(f'stair12-step-{i}', (stair12_x, cy, cz), (stair12_w, s12_dy, abs(s12_dz) * 1.08), mat=black_gold_marble, bevel=0.015)
    box(f'stair12-nosing-{i}', (stair12_x, (i + 1) * s12_dy, cz + abs(s12_dz) * 0.45), (stair12_w + 0.04, 0.025, 0.035), mat=brass_gold_metal)
    box(f'stair12-led-{i}', (stair12_x, cy + s12_dy * 0.42, cz + abs(s12_dz) * 0.42), (stair12_w - 0.12, 0.016, 0.016), mat=amber_gold_light)

# Vách đỡ gầm cầu thang 1->2 bọc gỗ ốp sang trọng để giấu gầm bên dưới
box('stair12-under-wall', (4.68, 1.4, -4.4), (0.12, 2.8, 3.8), mat=rich_walnut_wood)
# Tay vịn xiên mép trái cầu thang 1->2
make_sloped_railing('stair12-railing', 4.68, -1.6, 0.0, -6.0, 3.6, height=0.95)


# ==============================================================================
# 6. TẦNG 2 (2F · MEZZANINE GALLERY · MẶT SÀN y = 3.6m)
# ==============================================================================
# 6.1 Chiếu nghỉ đỉnh thang phải (x: 4.65..7.3, z: -7.3..-6.0)
box('floor-2f-landing-r', (5.98, 3.51, -6.65), (2.65, 0.18, 1.3), mat=rich_walnut_wood, bevel=0.02)
box('floor-2f-landing-r-trim', (5.98, 3.41, -6.0), (2.65, 0.04, 0.08), mat=brass_gold_metal)

# 6.2 Hành lang Sau Tầng 2 (x: -7.3..4.65, z: -7.3..-4.4)
box('floor-2f-back', (-1.32, 3.51, -5.85), (11.95, 0.18, 2.9), mat=rich_walnut_wood, bevel=0.02)
box('floor-2f-back-fascia', (-1.32, 3.45, -4.4), (11.95, 0.24, 0.08), mat=brass_gold_metal)

# 6.3 Hành lang Cánh Trái Tầng 2 (x: -7.3..-4.4, z: -4.4..-1.6)
box('floor-2f-left', (-5.85, 3.51, -3.0), (2.9, 0.18, 2.8), mat=rich_walnut_wood, bevel=0.02)
box('floor-2f-left-fascia', (-4.4, 3.45, -3.0), (0.08, 0.24, 2.8), mat=brass_gold_metal)

# Lan can kính & đồng thau bảo vệ quanh giếng trời Tầng 2 (y = 3.6m)
make_railing_segment('rail-2f-stair-edge', (4.68, -6.0), (4.68, -4.4), 3.6)
make_railing_segment('rail-2f-back', (4.68, -4.4), (-4.4, -4.4), 3.6)
make_railing_segment('rail-2f-left', (-4.4, -4.4), (-4.4, -1.6), 3.6)

# Trang trí nhẹ trên Tầng 2: Thảm chạy hành lang & Bộ bàn trà góc ngắm cảnh phía sau
box('carpet-2f-runner-back', (0, 3.608, -5.85), (9.2, 0.015, 1.4), mat=bordeaux_velvet, bevel=0.01)
cylinder('table-2f-bistro', (0, 3.96, -6.85), radius=0.35, height=0.72, vertices=24, mat=black_gold_marble)
cylinder('lamp-2f-bistro', (0, 4.44, -6.85), radius=0.12, height=0.22, vertices=16, mat=amber_gold_light)


# ==============================================================================
# 7. CẦU THANG TẦNG 2 -> TẦNG 3 (CÁNH TRÁI: 24 bậc mảnh, dy = 0.15m)
# ==============================================================================
stair23_x = -5.9
stair23_w = 2.4
stair23_steps = 24
s23_z0, s23_z1 = -1.6, 2.8
s23_dz = (s23_z1 - s23_z0) / stair23_steps
s23_dy = 3.6 / stair23_steps

for i in range(stair23_steps):
    cy = 3.6 + (i + 0.5) * s23_dy
    cz = s23_z0 + (i + 0.5) * s23_dz
    box(f'stair23-step-{i}', (stair23_x, cy, cz), (stair23_w, s23_dy, abs(s23_dz) * 1.08), mat=black_gold_marble, bevel=0.015)
    box(f'stair23-nosing-{i}', (stair23_x, 3.6 + (i + 1) * s23_dy, cz - abs(s23_dz) * 0.45), (stair23_w + 0.04, 0.025, 0.035), mat=brass_gold_metal)
    box(f'stair23-led-{i}', (stair23_x, cy + s23_dy * 0.42, cz - abs(s23_dz) * 0.42), (stair23_w - 0.12, 0.016, 0.016), mat=amber_gold_light)

# Tay vịn xiên mép phải cầu thang 2->3
make_sloped_railing('stair23-railing', -4.68, -1.6, 3.6, 2.8, 7.2, height=0.95)


# ==============================================================================
# 8. TẦNG 3 (3F · PENTHOUSE SKY VIP FLOOR · MẶT SÀN y = 7.2m)
# ==============================================================================
# 8.1 Sảnh Trước Rộng Lớn Tầng 3 (x: -7.3..7.3, z: 2.8..7.3)
box('floor-3f-front', (0, 7.11, 5.05), (14.6, 0.18, 4.5), mat=rich_walnut_wood, bevel=0.02)
box('floor-3f-front-fascia', (0, 7.05, 2.8), (14.6, 0.24, 0.08), mat=brass_gold_metal)

# 8.2 Hành lang Ngắm Cảnh Cánh Phải Tầng 3 (x: 4.4..7.3, z: -5.2..2.8)
box('floor-3f-right', (5.85, 7.11, -1.2), (2.9, 0.18, 8.0), mat=rich_walnut_wood, bevel=0.02)
box('floor-3f-right-fascia', (4.4, 7.05, -1.2), (0.08, 0.24, 8.0), mat=brass_gold_metal)

# Lan can kính đồng thau bảo vệ quanh giếng trời Tầng 3 (y = 7.2m)
make_railing_segment('rail-3f-front', (-4.68, 2.8), (4.4, 2.8), 7.2)
make_railing_segment('rail-3f-right', (4.4, 2.8), (4.4, -5.2), 7.2)
make_railing_segment('rail-3f-right-tip', (4.4, -5.2), (7.25, -5.2), 7.2)

# Trang trí Penthouse Tầng 3: Thảm nhung & Bộ bàn VIP Lounge nhìn về giếng trời
box('carpet-3f-sky', (0, 7.208, 5.2), (8.0, 0.015, 2.6), mat=bordeaux_velvet, bevel=0.01)
box('sofa-3f-vip', (0, 7.45, 6.4), (3.2, 0.50, 0.9), mat=chesterfield_leather, bevel=0.05)
box('sofa-3f-vip-back', (0, 7.82, 6.8), (3.2, 0.52, 0.25), mat=chesterfield_leather, bevel=0.05)
box('table-3f-vip', (0, 7.42, 5.1), (1.4, 0.44, 0.8), mat=black_gold_marble, bevel=0.03)
cylinder('lamp-3f-pillar-l', (-3.2, 7.9, 6.2), radius=0.18, height=1.4, vertices=16, mat=brass_gold_metal)
cylinder('lamp-3f-glow-l', (-3.2, 8.7, 6.2), radius=0.20, height=0.35, vertices=16, mat=amber_gold_light)
cylinder('lamp-3f-pillar-r', (3.2, 7.9, 6.2), radius=0.18, height=1.4, vertices=16, mat=brass_gold_metal)
cylinder('lamp-3f-glow-r', (3.2, 8.7, 6.2), radius=0.20, height=0.35, vertices=16, mat=amber_gold_light)


# ==============================================================================
# 9. TẦNG 1: QUẦY BAR WHISKY & XÌ GÀ BÊN TRÁI (LÙI +0.35m CHO BARTENDER NPC ĐỨNG PHỤC VỤ)
# ==============================================================================
box('bar-counter-body', (-5.45, 0.60, -0.9), (1.3, 1.20, 4.8), mat=rich_walnut_wood, bevel=0.06)
box('bar-counter-top', (-5.45, 1.24, -0.9), (1.5, 0.10, 5.0), mat=black_gold_marble, bevel=0.04)
box('bar-counter-brass-trim', (-4.75, 0.60, -0.9), (0.04, 0.06, 4.7), mat=amber_gold_light)

for lvl in [1.5, 2.3, 3.05]:
    box(f'whisky-shelf-{lvl}', (-7.15, lvl, -0.9), (0.36, 0.06, 4.4), mat=rich_walnut_wood)
    box(f'whisky-shelf-brass-{lvl}', (-6.98, lvl + 0.02, -0.9), (0.03, 0.03, 4.3), mat=brass_gold_metal)
    box(f'whisky-shelf-light-{lvl}', (-7.05, lvl + 0.05, -0.9), (0.04, 0.02, 4.1), mat=amber_gold_light)
    for bottle_idx in range(7):
        bz = -2.6 + bottle_idx * 0.6
        cylinder(f'whisky-bottle-{lvl}-{bottle_idx}', (-7.10, lvl + 0.16, bz), radius=0.045, height=0.22, vertices=12, mat=amber_gold_light)

for bz in [-2.4, -0.9, 0.6]:
    cylinder(f'bar-stool-base-{bz}', (-4.25, 0.04, bz), radius=0.24, height=0.06, vertices=16, mat=brass_gold_metal)
    cylinder(f'bar-stool-stem-{bz}', (-4.25, 0.42, bz), radius=0.04, height=0.72, vertices=12, mat=brass_gold_metal)
    cylinder(f'bar-stool-seat-{bz}', (-4.25, 0.82, bz), radius=0.24, height=0.08, vertices=20, mat=chesterfield_leather)


# ==============================================================================
# 10. TẦNG 1: KHU SOFA CHESTERFIELD & BÀN CỜ VUA (ĐỆM CAO 0.74m KHỚP ANIMATION SIT)
# ==============================================================================
box('chesterfield-sofa-base', (5.35, 0.37, 3.6), (1.1, 0.74, 2.8), mat=chesterfield_leather, bevel=0.06)
box('chesterfield-sofa-back', (5.80, 0.94, 3.6), (0.34, 0.54, 2.8), mat=chesterfield_leather, bevel=0.05)
box('chesterfield-sofa-arm-l', (5.35, 0.78, 2.25), (1.05, 0.44, 0.24), mat=chesterfield_leather, bevel=0.04)
box('chesterfield-sofa-arm-r', (5.35, 0.78, 4.95), (1.05, 0.44, 0.24), mat=chesterfield_leather, bevel=0.04)

box('lounge-coffee-table', (3.8, 0.36, 3.6), (0.9, 0.72, 1.4), mat=black_gold_marble, bevel=0.03)
box('chess-board', (3.8, 0.73, 3.6), (0.48, 0.02, 0.48), mat=rich_walnut_wood)
box('chess-board-grid', (3.8, 0.745, 3.6), (0.42, 0.01, 0.42), mat=black_gold_marble)


# ==============================================================================
# 11. TẦNG 1: VÁCH GIA HUY KOHAKU PHÍA SAU LƯNG DEALER (GỌN TRONG CHIỀU CAO TẦNG 1)
# ==============================================================================
# Tấm khung đồng làm viền sau, tấm gỗ óc chó tối nằm phía trước tạo viền đồng sang trọng
box('honor-wall-frame-gold', (0, 1.7, -7.24), (6.5, 3.3, 0.04), mat=brass_gold_metal)
box('honor-wall-backdrop', (0, 1.7, -7.19), (6.2, 3.0, 0.06), mat=rich_walnut_wood)

for side in [-1, 1]:
    box(f'mantel-body-{side}', (side * 2.6, 0.65, -7.12), (1.2, 1.3, 0.36), mat=black_gold_marble, bevel=0.03)
    # Đẩy hốc lửa ra z = -6.92 (trước mặt trước lò sưởi ở -6.94) để hết Z-fighting sọc trắng
    box(f'mantel-hearth-glow-{side}', (side * 2.6, 0.42, -6.93), (0.68, 0.56, 0.04), mat=amber_gold_light, bevel=0.01)
    cylinder(f'trophy-cup-{side}', (side * 2.6, 1.45, -7.08), radius=0.14, height=0.28, vertices=16, mat=brass_gold_metal)


# ==============================================================================
# 12. DECOR BỔ SUNG TẦNG 1 (BAR PROPS, TỦ RƯỢU QUÝ, COCKTAIL, BONSAI, THẢM VIP)
# ==============================================================================
# 12.1 Đồ trang trí trên mặt quầy Whisky Bar (-5.45, 1.29)
cylinder('bar-decanter-body', (-5.10, 1.39, -1.65), radius=0.085, height=0.18, vertices=16, mat=amber_gold_light)
cylinder('bar-decanter-neck', (-5.10, 1.51, -1.65), radius=0.032, height=0.08, vertices=12, mat=brass_gold_metal)
cylinder('bar-ice-bucket', (-5.10, 1.38, -0.20), radius=0.11, height=0.18, vertices=20, mat=brass_gold_metal)
cylinder('bar-champagne-bottle', (-5.10, 1.50, -0.20), radius=0.045, height=0.22, vertices=12, mat=poker_felt_green)
for gz in [-2.2, -1.1, 0.35]:
    cylinder(f'bar-tumbler-{gz}', (-4.97, 1.34, gz), radius=0.04, height=0.09, vertices=16, mat=porcelain_ivory)

# 12.2 Khu Tủ Kính Trưng Bày Rượu Quý & Hộp Xì Gà Vintage ở góc Trước Trái (x = -6.85, z = 4.6)
box('vault-cabinet-body', (-6.92, 1.35, 4.6), (0.65, 2.7, 2.2), mat=rich_walnut_wood, bevel=0.03)
box('vault-cabinet-glass', (-6.58, 1.45, 4.6), (0.04, 2.3, 1.95), mat=smoked_glass, bevel=0.0)
box('vault-cabinet-top-trim', (-6.90, 2.72, 4.6), (0.72, 0.08, 2.3), mat=brass_gold_metal)
for v_lvl in [0.75, 1.40, 2.05]:
    box(f'vault-shelf-{v_lvl}', (-6.78, v_lvl, 4.6), (0.45, 0.04, 1.9), mat=brass_gold_metal)
    box(f'vault-led-{v_lvl}', (-6.82, v_lvl + 0.03, 4.6), (0.03, 0.02, 1.8), mat=amber_gold_light)
    for vb in [-0.6, -0.2, 0.2, 0.6]:
        cylinder(f'vault-bottle-{v_lvl}-{vb}', (-6.78, v_lvl + 0.14, 4.6 + vb), radius=0.048, height=0.22, vertices=12, mat=amber_gold_light)

# 12.3 Bàn Tròn Cocktail Đứng & Đèn Bàn Pha Lê góc Trước Trái (x = -4.2, z = 4.6)
cylinder('cocktail-table-base', (-4.2, 0.03, 4.6), radius=0.32, height=0.06, vertices=24, mat=brass_gold_metal)
cylinder('cocktail-table-stem', (-4.2, 0.52, 4.6), radius=0.045, height=0.96, vertices=16, mat=brass_gold_metal)
cylinder('cocktail-table-top', (-4.2, 1.02, 4.6), radius=0.48, height=0.06, vertices=32, mat=black_gold_marble)
make_ring('cocktail-table-trim', (-4.2, 1.02, 4.6), 0.46, 0.495, 0.065, segments=32, mat=brass_gold_metal)
cylinder('cocktail-lamp-stem', (-4.2, 1.15, 4.6), radius=0.03, height=0.20, vertices=12, mat=brass_gold_metal)
cylinder('cocktail-lamp-shade', (-4.2, 1.29, 4.6), radius=0.13, height=0.16, vertices=18, mat=amber_gold_light)
cylinder('cocktail-glass-1', (-4.0, 1.09, 4.45), radius=0.04, height=0.09, vertices=14, mat=porcelain_ivory)
cylinder('cocktail-ashtray', (-4.38, 1.07, 4.72), radius=0.065, height=0.03, vertices=16, mat=brass_gold_metal)

# 12.4 Thảm Đỏ Sảnh Chào & 4 Trụ Dây Nhung Đỏ VIP đón từ Cửa vào Bàn Bài
box('entrance-red-carpet', (0, 0.008, 4.85), (2.2, 0.015, 4.4), mat=bordeaux_velvet, bevel=0.005)
box('entrance-carpet-trim-l', (-1.12, 0.006, 4.85), (0.05, 0.012, 4.4), mat=brass_gold_metal)
box('entrance-carpet-trim-r', (1.12, 0.006, 4.85), (0.05, 0.012, 4.4), mat=brass_gold_metal)
for sx in [-1.45, 1.45]:
    for sz in [4.2, 6.0]:
        cylinder(f'stanchion-base-{sx}-{sz}', (sx, 0.03, sz), radius=0.14, height=0.05, vertices=18, mat=brass_gold_metal)
        cylinder(f'stanchion-pole-{sx}-{sz}', (sx, 0.46, sz), radius=0.025, height=0.84, vertices=12, mat=brass_gold_metal)
        cylinder(f'stanchion-cap-{sx}-{sz}', (sx, 0.90, sz), radius=0.045, height=0.06, vertices=14, mat=brass_gold_metal)
    # Thanh dây nhung nối dọc mỗi bên
    box(f'stanchion-rope-{sx}', (sx, 0.72, 5.1), (0.045, 0.045, 1.76), mat=velvet_rope_red, bevel=0.015)

# 12.5 Cặp Đôn Đá & Cây Bonsai Tùng Hoàng Kim hai bên Cửa Ra Vào (x = ±2.55, z = 6.65)
for bx in [-2.55, 2.55]:
    box(f'bonsai-plinth-{bx}', (bx, 0.40, 6.65), (0.58, 0.80, 0.58), mat=black_gold_marble, bevel=0.03)
    box(f'bonsai-plinth-trim-{bx}', (bx, 0.81, 6.65), (0.62, 0.03, 0.62), mat=brass_gold_metal)
    cylinder(f'bonsai-pot-{bx}', (bx, 0.93, 6.65), radius=0.22, height=0.22, vertices=20, mat=porcelain_ivory)
    cylinder(f'bonsai-trunk-{bx}', (bx, 1.18, 6.65), radius=0.045, height=0.35, vertices=10, mat=rich_walnut_wood)
    # Các tán lá tùng xếp tầng thanh lịch
    cylinder(f'bonsai-crown-1-{bx}', (bx - 0.08, 1.38, 6.62), radius=0.22, height=0.12, vertices=16, mat=bonsai_foliage)
    cylinder(f'bonsai-crown-2-{bx}', (bx + 0.09, 1.50, 6.68), radius=0.18, height=0.11, vertices=16, mat=bonsai_foliage)
    cylinder(f'bonsai-crown-3-{bx}', (bx, 1.64, 6.64), radius=0.15, height=0.10, vertices=16, mat=bonsai_foliage)

# 12.6 Đồng Hồ Quả Lắc Cổ (Grandfather Clock) góc Sau Trái (x = -6.7, z = -6.6)
box('grandfather-clock-base', (-6.72, 0.35, -6.65), (0.65, 0.70, 0.45), mat=rich_walnut_wood, bevel=0.03)
box('grandfather-clock-body', (-6.72, 1.35, -6.65), (0.52, 1.30, 0.38), mat=rich_walnut_wood, bevel=0.02)
box('grandfather-clock-window', (-6.46, 1.30, -6.65), (0.04, 0.90, 0.24), mat=smoked_glass, bevel=0.0)
box('grandfather-clock-head', (-6.72, 2.25, -6.65), (0.62, 0.55, 0.44), mat=brass_gold_metal, bevel=0.03)
box('grandfather-clock-dial', (-6.40, 2.25, -6.65), (0.03, 0.36, 0.36), mat=amber_gold_light, bevel=0.01)

# 12.7 Khung Tranh Art Deco & Đèn Tường Hổ Phách dọc hai bên vách Tầng 1
for az in [-4.2, 2.2]:
    # Tranh bên tường trái
    box(f'wall-art-frame-l-{az}', (-7.24, 2.35, az), (0.06, 1.25, 1.65), mat=brass_gold_metal, bevel=0.01)
    box(f'wall-art-canvas-l-{az}', (-7.20, 2.35, az), (0.04, 1.08, 1.48), mat=bordeaux_velvet, bevel=0.0)
    box(f'wall-art-gold-l-{az}', (-7.17, 2.35, az), (0.03, 0.42, 0.42), mat=amber_gold_light)
# Đèn tường đôi gắn trên trụ cột Tầng 1
for sz in [-4.0, 2.0, 5.2]:
    for sx_dir in [-1, 1]:
        box(f'sconce-mount-{sx_dir}-{sz}', (sx_dir * 7.12, 2.15, sz), (0.10, 0.28, 0.14), mat=brass_gold_metal)
        cylinder(f'sconce-lamp-{sx_dir}-{sz}', (sx_dir * 7.02, 2.25, sz), radius=0.065, height=0.20, vertices=12, mat=amber_gold_light)

# 12.8 Bổ sung Đèn Bàn & Bộ Ấm Trà trên Bàn Cờ Vua khu Sofa (3.8, 3.6)
cylinder('sofa-table-lamp-base', (3.8, 0.78, 3.05), radius=0.08, height=0.12, vertices=16, mat=brass_gold_metal)
cylinder('sofa-table-lamp-shade', (3.8, 0.94, 3.05), radius=0.14, height=0.18, vertices=18, mat=amber_gold_light)
cylinder('sofa-tea-cup-1', (3.72, 0.75, 4.05), radius=0.04, height=0.06, vertices=14, mat=porcelain_ivory)
cylinder('sofa-tea-cup-2', (3.92, 0.75, 4.12), radius=0.04, height=0.06, vertices=14, mat=porcelain_ivory)


# ==============================================================================
# 13. CHẤT NHẬT BẢN CAO CẤP 琥珀: SHOJI KUMIKO, NOREN, ĐÈN LỒNG, BYOBU, GÓC TRÀ TATAMI
# Mọi khối đứng trên sàn ở mục này đều có collider tương ứng trong KOHAKU_COLLIDERS /
# KOHAKU_FLOOR_2_BOX_COLLIDERS / KOHAKU_FLOOR_3_BOX_COLLIDERS (packages/game-protocol/src/club.ts).
# ==============================================================================
washi_glow = pbr('Kohaku / backlit washi paper', (1.0, 0.88, 0.68), roughness=0.85, emission=(1.0, 0.84, 0.6), emission_strength=0.9)
urushi_red = pbr('Kohaku / urushi red lacquer', (0.42, 0.035, 0.03), roughness=0.22, metallic=0.05)
urushi_black = pbr('Kohaku / urushi black lacquer', (0.025, 0.02, 0.02), roughness=0.18, metallic=0.05)
gold_leaf = pbr('Kohaku / kinpaku gold leaf', (0.95, 0.74, 0.32), roughness=0.38, metallic=0.9)
lantern_red = pbr('Kohaku / chochin lantern glow', (1.0, 0.28, 0.08), roughness=0.6, emission=(1.0, 0.3, 0.08), emission_strength=1.6)
indigo_cloth = pbr('Kohaku / indigo noren cloth', (0.05, 0.07, 0.2), roughness=0.9)
straw = pbr('Kohaku / komodaru straw', (0.78, 0.7, 0.5), roughness=0.92)
tatami = pbr('Kohaku / tatami rush', (0.5, 0.5, 0.28), roughness=0.9)
celadon = pbr('Kohaku / celadon glaze', (0.5, 0.66, 0.56), roughness=0.18)
blossom = pbr('Kohaku / plum blossom', (1.0, 0.55, 0.7), roughness=0.6, emission=(1.0, 0.5, 0.65), emission_strength=0.25)


def front_disc(name, position, radius, depth, mat, vertices=40):
    """Đĩa tròn dựng đứng nhìn theo trục z (gia huy, mặt trời trên byobu)."""
    x, y, z = position
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=(x, -z, y))
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    items.append(obj)
    return obj


def kumiko_panel(name, center, width, height, facing):
    """Vách shoji: giấy washi phát sáng phía sau, lưới gỗ kumiko phía trước.
    facing: 'z-' (gắn tường trước, nhìn vào phòng), 'x-' (gắn tường phải), 'x+' (gắn tường trái)."""
    x, y, z = center
    if facing == 'z-':
        box(f'{name}-washi', (x, y, z), (width, height, 0.03), mat=washi_glow, bevel=0.0)
        box(f'{name}-frame-top', (x, y + height / 2, z - 0.04), (width + 0.08, 0.07, 0.06), mat=rich_walnut_wood, bevel=0.01)
        box(f'{name}-frame-bot', (x, y - height / 2, z - 0.04), (width + 0.08, 0.07, 0.06), mat=rich_walnut_wood, bevel=0.01)
        for i in range(int(width / 0.3) + 1):
            box(f'{name}-v-{i}', (x - width / 2 + i * width / int(width / 0.3), y, z - 0.035), (0.025, height, 0.03), mat=rich_walnut_wood, bevel=0.0)
        for j in range(1, int(height / 0.42)):
            box(f'{name}-h-{j}', (x, y - height / 2 + j * height / int(height / 0.42), z - 0.035), (width, 0.025, 0.03), mat=rich_walnut_wood, bevel=0.0)
    else:
        sign = -1 if facing == 'x-' else 1
        box(f'{name}-washi', (x, y, z), (0.03, height, width), mat=washi_glow, bevel=0.0)
        box(f'{name}-frame-top', (x + sign * 0.04, y + height / 2, z), (0.06, 0.07, width + 0.08), mat=rich_walnut_wood, bevel=0.01)
        box(f'{name}-frame-bot', (x + sign * 0.04, y - height / 2, z), (0.06, 0.07, width + 0.08), mat=rich_walnut_wood, bevel=0.01)
        for i in range(int(width / 0.3) + 1):
            box(f'{name}-v-{i}', (x + sign * 0.035, y, z - width / 2 + i * width / int(width / 0.3)), (0.03, height, 0.025), mat=rich_walnut_wood, bevel=0.0)
        for j in range(1, int(height / 0.42)):
            box(f'{name}-h-{j}', (x + sign * 0.035, y - height / 2 + j * height / int(height / 0.42), z), (0.03, 0.025, width), mat=rich_walnut_wood, bevel=0.0)


def chochin(name, x, y, z, hang_to):
    """Đèn lồng giấy đỏ treo dây đồng từ mép sàn tầng trên xuống."""
    cylinder(f'{name}-cord', (x, (y + 0.25 + hang_to) / 2, z), radius=0.008, height=hang_to - y - 0.25, vertices=6, mat=brass_gold_metal)
    cylinder(f'{name}-cap-top', (x, y + 0.24, z), radius=0.13, height=0.05, vertices=16, mat=urushi_black)
    cylinder(f'{name}-body', (x, y, z), radius=0.2, height=0.44, vertices=20, mat=lantern_red)
    cylinder(f'{name}-belly', (x, y, z), radius=0.215, height=0.24, vertices=20, mat=lantern_red)
    cylinder(f'{name}-cap-bot', (x, y - 0.24, z), radius=0.13, height=0.05, vertices=16, mat=urushi_black)


def tea_nook(name, x0, x1, z0, z1, floor_y):
    """Bục tatami thấp + bàn chabudai sơn mài, 2 nệm zabuton, đèn andon giấy và bộ ấm trà."""
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    w, d = x1 - x0, z1 - z0
    box(f'{name}-plinth', (cx, floor_y + 0.13, cz), (w + 0.1, 0.26, d + 0.1), mat=rich_walnut_wood, bevel=0.02)
    box(f'{name}-tatami', (cx, floor_y + 0.27, cz), (w - 0.06, 0.04, d - 0.06), mat=tatami, bevel=0.005)
    box(f'{name}-tatami-seam', (cx, floor_y + 0.292, cz), (0.03, 0.006, d - 0.08), mat=indigo_cloth, bevel=0.0)
    top = floor_y + 0.29
    box(f'{name}-table', (cx, top + 0.3, cz), (1.1, 0.06, 0.7), mat=urushi_red, bevel=0.015)
    for lx in [-0.48, 0.48]:
        for lz in [-0.28, 0.28]:
            box(f'{name}-table-leg', (cx + lx, top + 0.14, cz + lz), (0.06, 0.28, 0.06), mat=urushi_black, bevel=0.0)
    for side in [-1, 1]:
        box(f'{name}-zabuton', (cx + side * 0.85, top + 0.05, cz), (0.6, 0.1, 0.6), mat=indigo_cloth, bevel=0.04)
    cylinder(f'{name}-kettle', (cx - 0.2, top + 0.4, cz), radius=0.09, height=0.13, vertices=16, mat=urushi_black)
    cylinder(f'{name}-kettle-lid', (cx - 0.2, top + 0.475, cz), radius=0.04, height=0.03, vertices=12, mat=brass_gold_metal)
    for k, (tx, tz) in enumerate([(0.15, -0.12), (0.3, 0.1)]):
        cylinder(f'{name}-chawan-{k}', (cx + tx, top + 0.365, cz + tz), radius=0.055, height=0.07, vertices=14, mat=celadon)
    ax, az = x1 - 0.25, z1 - 0.25
    box(f'{name}-andon-frame', (ax, top + 0.42, az), (0.34, 0.84, 0.34), mat=urushi_black, bevel=0.01)
    box(f'{name}-andon-paper', (ax, top + 0.46, az), (0.36, 0.62, 0.36), mat=washi_glow, bevel=0.0)


# 13.1 Vách shoji kumiko phát sáng trên tường trước Tầng 1 (hai bên cửa) và trên lưng sofa Chesterfield
for sx in [-1, 1]:
    kumiko_panel(f'shoji-1f-front-a-{sx}', (sx * 4.05, 1.75, 7.25), 2.2, 2.5, 'z-')
    kumiko_panel(f'shoji-1f-front-b-{sx}', (sx * 6.25, 1.75, 7.25), 1.7, 2.5, 'z-')
kumiko_panel('shoji-1f-sofa', (7.25, 2.25, 2.4), 2.6, 1.7, 'x-')

# 13.2 Rèm noren chàm 4 vạt treo trên lối vào (đáy 2.45 m, cao hơn cánh cửa 2.28 m)
box('noren-rod', (0, 3.0, 7.2), (2.3, 0.04, 0.04), mat=brass_gold_metal, bevel=0.0)
for i in range(4):
    box(f'noren-panel-{i}', (-0.81 + i * 0.54, 2.72, 7.2), (0.5, 0.54, 0.02), mat=indigo_cloth, bevel=0.0)
    front_disc(f'noren-crest-{i}', (-0.81 + i * 0.54, 2.66, 7.185), 0.08, 0.01, gold_leaf, vertices=20)

# 13.3 Gia huy (kamon) hổ phách mạ vàng phía trên chữ 琥珀 trên vách gia huy
front_disc('kamon-gold', (0, 2.86, -7.14), 0.28, 0.025, gold_leaf)
front_disc('kamon-red', (0, 2.86, -7.125), 0.21, 0.02, urushi_red)
front_disc('kamon-amber', (0, 2.86, -7.11), 0.09, 0.02, amber_gold_light, vertices=24)

# 13.4 Đèn lồng chōchin dưới mép sàn Tầng 2 (sau) và mép sàn Tầng 3 (trước, hành lang phải)
for lx in [-3.6, -1.8, 1.8, 3.6]:
    chochin(f'chochin-2f-{lx}', lx, 2.95, -4.6, 3.42)
for lx in [-3.0, -1.0, 1.0, 3.0]:
    chochin(f'chochin-3f-front-{lx}', lx, 6.5, 3.05, 7.02)
for lz in [-3.8, -1.2, 1.4]:
    chochin(f'chochin-3f-right-{lz}', 4.62, 6.5, lz, 7.02)

# 13.5 Bình phong vàng byobu gấp khúc trên Tầng 2 sát tường sau (trái 6 tấm, phải 4 tấm)
for name, center_x, panels in [('byobu-2f-left', -3.0, 6), ('byobu-2f-right', 2.5, 4)]:
    for p in range(panels):
        px = center_x - (panels - 1) * 0.275 + p * 0.55
        yaw = 0.32 if p % 2 == 0 else -0.32
        box(f'{name}-leaf-{p}', (px, 4.5, -7.0), (0.56, 1.7, 0.03), mat=gold_leaf, bevel=0.0, rotation_z=yaw)
        box(f'{name}-rim-top-{p}', (px, 5.36, -7.0), (0.58, 0.05, 0.05), mat=urushi_black, bevel=0.0, rotation_z=yaw)
        box(f'{name}-rim-bot-{p}', (px, 3.66, -7.0), (0.58, 0.07, 0.05), mat=urushi_black, bevel=0.0, rotation_z=yaw)
    front_disc(f'{name}-sun', (center_x + 0.3, 4.85, -6.88), 0.26, 0.02, urushi_red)

# 13.6 Thùng rượu sake komodaru xếp tháp góc sau trái Tầng 1 (cạnh đồng hồ quả lắc)
for bz, by in [(-5.35, 0.28), (-4.7, 0.28), (-5.02, 0.84)]:
    cylinder(f'komodaru-{bz}-{by}', (-6.62, by, bz), radius=0.3, height=0.55, vertices=24, mat=straw)
    cylinder(f'komodaru-band-{bz}-{by}', (-6.62, by, bz), radius=0.305, height=0.16, vertices=24, mat=urushi_red)
    cylinder(f'komodaru-lid-{bz}-{by}', (-6.62, by + 0.28, bz), radius=0.27, height=0.02, vertices=24, mat=rich_walnut_wood)

# 13.7 Bình ikebana men ngọc trên bệ sơn mài đỏ hai bên lò sưởi
for sx in [-1, 1]:
    x = sx * 4.0
    box(f'ikebana-plinth-{sx}', (x, 0.45, -6.95), (0.5, 0.9, 0.5), mat=urushi_red, bevel=0.02)
    box(f'ikebana-plinth-trim-{sx}', (x, 0.91, -6.95), (0.54, 0.03, 0.54), mat=gold_leaf, bevel=0.0)
    cylinder(f'ikebana-vase-{sx}', (x, 1.17, -6.95), radius=0.14, height=0.48, vertices=20, mat=celadon)
    for k, (bx, by, bz, h) in enumerate([(-0.12, 1.75, 0.02, 0.75), (0.1, 1.62, -0.05, 0.5), (0.02, 1.9, 0.06, 0.95)]):
        cylinder(f'ikebana-branch-{sx}-{k}', (x + bx * 0.5, by - h / 2 + 0.05, -6.95 + bz * 0.5), radius=0.012, height=h, vertices=6, mat=rich_walnut_wood)
        for f in range(3):
            bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.05, location=(x + bx + (f - 1) * 0.06, 6.95 - bz, by - f * 0.12))
            obj = bpy.context.object
            obj.name = f'ikebana-blossom-{sx}-{k}-{f}'
            obj.data.materials.append(blossom)
            items.append(obj)

# 13.8 Góc trà tatami Tầng 1 (góc trước phải) và Tầng 3 (cuối hành lang phải, có dù wagasa đỏ che)
tea_nook('tea-nook-1f', 4.3, 7.1, 5.5, 7.1, 0.0)
tea_nook('tea-nook-3f', 5.55, 7.1, -5.0, -3.35, 7.2)
cylinder('wagasa-pole', (5.75, 8.35, -4.2), radius=0.025, height=2.3, vertices=8, mat=rich_walnut_wood)
bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=1.05, radius2=0.04, depth=0.42, location=(5.75, 4.2, 9.55))
wagasa = bpy.context.object
wagasa.name = 'wagasa-canopy'
wagasa.data.materials.append(urushi_red)
items.append(wagasa)
make_ring('wagasa-rim', (5.75, 9.36, -4.2), 1.0, 1.05, 0.03, segments=24, mat=gold_leaf)

# 13.9 Vách shoji kumiko Penthouse Tầng 3 trên tường trước (chừa giữa cho biển 3F)
for sx in [-1, 1]:
    kumiko_panel(f'shoji-3f-front-a-{sx}', (sx * 3.6, 8.75, 7.25), 2.3, 2.3, 'z-')
    kumiko_panel(f'shoji-3f-front-b-{sx}', (sx * 6.0, 8.75, 7.25), 1.8, 2.3, 'z-')


# ==============================================================================
# 14. EXPORT GLB & BLEND FILE
# ==============================================================================
# Gộp mesh cùng vật liệu: hàng nghìn khối nhỏ thành vài chục draw call (tên mesh không được runtime tra cứu).
by_material = {}
for obj in items:
    by_material.setdefault(obj.data.materials[0].name, []).append(obj)
items = []
for mat_name, group in by_material.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in group:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = group[0]
    if len(group) > 1:
        bpy.ops.object.join()
    group[0].name = 'kohaku:' + mat_name.split('/ ')[-1]
    items.append(group[0])

bpy.ops.object.select_all(action='DESELECT')
for obj in items:
    obj.select_set(True)
bpy.context.view_layer.objects.active = items[0]

RAW_GLB.parent.mkdir(parents=True, exist_ok=True)
PUBLIC_GLB.parent.mkdir(parents=True, exist_ok=True)

bpy.ops.export_scene.gltf(
    filepath=str(RAW_GLB),
    export_format='GLB',
    use_selection=True,
    export_yup=True,
    export_animations=False,
)
PUBLIC_GLB.write_bytes(RAW_GLB.read_bytes())

scene = bpy.context.scene
cam_data = bpy.data.cameras.new('Kohaku Overview Camera')
cam = bpy.data.objects.new('Kohaku Overview Camera', cam_data)
scene.collection.objects.link(cam)
cam.location = (0, -8.6, 6.8)
cam.rotation_euler = (Vector((0, 0, 2.2)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera = cam
cam_data.lens = 22

bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_FILE))
print(f'KOHAKU_CLUB_3FLOOR_EXPORT_COMPLETE: {len(items)} objects exported to {PUBLIC_GLB}')
