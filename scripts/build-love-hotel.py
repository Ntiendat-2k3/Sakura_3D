"""Xây dựng nội thất Cyberpunk Neon Love Hotel 20+ (love-hotel.glb) bằng Blender 5.2."""
import math
from pathlib import Path
import bpy
import bmesh
from mathutils import Matrix

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "assets" / "processed" / "love-hotel.raw.glb"
BLEND = ROOT / "assets" / "processed" / "love-hotel.blend"
OUT = ROOT / "apps" / "web" / "public" / "assets" / "buildings" / "love-hotel.glb"
ATLAS = ROOT / "assets" / "processed" / "textures" / "street-surface-atlas.png"

TILES = {
    "paving": (0, 1),
    "plaster": (1, 1),
    "roof": (2, 1),
    "timber": (3, 1),
    "awning": (0, 0),
    "metal": (1, 0),
    " foliage": (2, 0),
    "window": (3, 0),
}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.unit_settings.system = "METRIC"


def srgb_image(path: Path):
    image = bpy.data.images.load(str(path), check_existing=True)
    image.colorspace_settings.name = "sRGB"
    return image


def atlas_material():
    with bpy.data.libraries.load(str(ROOT / "assets" / "processed" / "neon-sakura-street.blend"), link=False) as (data_from, data_to):
        data_to.materials = [name for name in data_from.materials if name == "Sakura / stone wood glass metal fabric"]
    mat = bpy.data.materials.get("Sakura / stone wood glass metal fabric")
    if not mat:
        raise RuntimeError("Missing shared material from neon-sakura-street.blend")
    return mat


def pbr_material(
    name: str,
    color: tuple[float, float, float, float],
    roughness: float = 0.35,
    metallic: float = 0.1,
    emission: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
    alpha: float = 1.0,
):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        mat.blend_method = "BLEND"
    if emission is not None and emission_strength > 0:
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


SURFACE = atlas_material()
VELVET_CRIMSON = pbr_material(
    "hotel-velvet-crimson",
    (0.42, 0.04, 0.18, 1.0),
    roughness=0.68,
    metallic=0.05,
    emission=(0.25, 0.02, 0.12, 1.0),
    emission_strength=0.18,
)
VELVET_PLUM = pbr_material(
    "hotel-velvet-plum",
    (0.18, 0.04, 0.24, 1.0),
    roughness=0.58,
    metallic=0.08,
)
SILK_BLUSH = pbr_material(
    "hotel-silk-blush",
    (0.88, 0.48, 0.68, 1.0),
    roughness=0.28,
    metallic=0.12,
    emission=(0.45, 0.12, 0.28, 1.0),
    emission_strength=0.12,
)
DARK_MARBLE = pbr_material(
    "hotel-dark-marble",
    (0.06, 0.04, 0.09, 1.0),
    roughness=0.14,
    metallic=0.25,
)
CHROME_GOLD = pbr_material(
    "hotel-chrome-gold",
    (0.92, 0.72, 0.42, 1.0),
    roughness=0.18,
    metallic=0.88,
    emission=(0.45, 0.28, 0.10, 1.0),
    emission_strength=0.2,
)
MIRROR_GLASS = pbr_material(
    "hotel-mirror-glass",
    (0.18, 0.12, 0.25, 1.0),
    roughness=0.04,
    metallic=0.95,
    emission=(0.32, 0.08, 0.26, 1.0),
    emission_strength=0.25,
)
NEON_MAGENTA = pbr_material(
    "hotel-neon-magenta",
    (1.0, 0.18, 0.68, 1.0),
    roughness=0.15,
    metallic=0.1,
    emission=(1.0, 0.15, 0.65, 1.0),
    emission_strength=3.6,
)
NEON_CYAN = pbr_material(
    "hotel-neon-cyan",
    (0.18, 0.92, 1.0, 1.0),
    roughness=0.15,
    metallic=0.1,
    emission=(0.15, 0.88, 1.0, 1.0),
    emission_strength=3.2,
)
NEON_VIOLET = pbr_material(
    "hotel-neon-violet",
    (0.68, 0.24, 1.0, 1.0),
    roughness=0.18,
    metallic=0.1,
    emission=(0.65, 0.20, 1.0, 1.0),
    emission_strength=2.8,
)
JACUZZI_WATER = pbr_material(
    "hotel-jacuzzi-water",
    (0.16, 0.82, 0.96, 1.0),
    roughness=0.06,
    metallic=0.15,
    emission=(0.12, 0.72, 0.92, 1.0),
    emission_strength=1.45,
    alpha=0.82,
)
GLASS_PARTITION = pbr_material(
    "hotel-glass-partition",
    (0.75, 0.45, 0.88, 1.0),
    roughness=0.08,
    metallic=0.2,
    emission=(0.45, 0.14, 0.58, 1.0),
    emission_strength=0.35,
    alpha=0.38,
)


def map_atlas_uv(mesh, tile: str):
    col, row = TILES.get(tile, (1, 0))
    u0, v0 = col * 0.25 + 0.008, row * 0.5 + 0.016
    du, dv = 0.234, 0.468
    uv_layer = mesh.uv_layers.active or mesh.uv_layers.new(name="UVMap")
    for poly in mesh.polygons:
        n = poly.normal
        for loop_idx in poly.loop_indices:
            v = mesh.vertices[mesh.loops[loop_idx].vertex_index].co
            if abs(n.z) > 0.7:
                s, t = (v.x * 0.28) % 1.0, (v.y * 0.28) % 1.0
            elif abs(n.x) > abs(n.y):
                s, t = (v.y * 0.28) % 1.0, (v.z * 0.28) % 1.0
            else:
                s, t = (v.x * 0.28) % 1.0, (v.z * 0.28) % 1.0
            uv_layer.data[loop_idx].uv = (u0 + s * du, v0 + t * dv)


def finalize(obj, mat=SURFACE, tile="metal"):
    if mat == SURFACE:
        map_atlas_uv(obj.data, tile)
    for poly in obj.data.polygons:
        poly.use_smooth = False
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)
    return obj


def add_box(name, size, loc, mat=SURFACE, tile="metal", bevel=0.02, rot_z=0.0):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    if bevel > 0:
        bmesh.ops.bevel(
            bm,
            geom=list(bm.edges),
            offset=min(bevel, min(size) * 0.22),
            segments=2,
            profile=0.5,
            affect="EDGES",
        )
    if abs(rot_z) > 1e-6:
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(rot_z, 3, "Z"), verts=bm.verts)
    bmesh.ops.translate(bm, vec=loc, verts=bm.verts)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finalize(obj, mat, tile)


def add_cylinder(name, radius, depth, loc, mat=SURFACE, tile="metal", vertices=28, rot_x=0.0, rot_y=0.0):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=False,
        segments=vertices,
        radius1=radius,
        radius2=radius,
        depth=depth,
    )
    if abs(rot_x) > 1e-6:
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(rot_x, 3, "X"), verts=bm.verts)
    if abs(rot_y) > 1e-6:
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(rot_y, 3, "Y"), verts=bm.verts)
    bmesh.ops.translate(bm, vec=loc, verts=bm.verts)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finalize(obj, mat, tile)


# ==============================================================================
# 1. SÀN PHÒNG, THẢM NHUNG TRÒN & TƯỜNG BAO CYBERPUNK (12m × 12m, z từ -6 đến +6)
# ==============================================================================
add_box("hotel-floor", (12.0, 12.0, 0.16), (0, 0, -0.08), DARK_MARBLE, bevel=0)
add_cylinder("hotel-plush-carpet-outer", 3.3, 0.025, (0, 2.8, 0.012), VELVET_PLUM, vertices=48)
add_cylinder("hotel-plush-carpet-inner", 2.95, 0.03, (0, 2.8, 0.016), VELVET_CRIMSON, vertices=48)
add_cylinder("hotel-carpet-neon-ring", 3.34, 0.018, (0, 2.8, 0.01), NEON_MAGENTA, vertices=48)

# Tường bao quanh (Blender Y = -Three.js Z, nên Bắc z=-6 là y=+6, Nam cửa ra z=+6 là y=-6)
add_box("wall-north", (12.2, 0.28, 4.6), (0, 6.0, 2.3), SURFACE, "plaster", 0.02)
add_box("wall-west", (0.28, 12.2, 4.6), (-6.0, 0, 2.3), SURFACE, "plaster", 0.02)
add_box("wall-east", (0.28, 12.2, 4.6), (6.0, 0, 2.3), SURFACE, "plaster", 0.02)
# Tường Nam chừa lối cửa đôi (rộng 2.4m ở giữa)
add_box("wall-south-left", (4.8, 0.28, 4.6), (-3.6, -5.85, 2.3), SURFACE, "plaster", 0.02)
add_box("wall-south-right", (4.8, 0.28, 4.6), (3.6, -5.85, 2.3), SURFACE, "plaster", 0.02)
add_box("wall-south-header", (2.6, 0.30, 1.8), (0, -5.85, 3.7), SURFACE, "timber", 0.02)

# Len chân tường và đường viền LED Cyberpunk chạy quanh phòng
add_box("led-skirt-north", (11.6, 0.06, 0.08), (0, 5.83, 0.08), NEON_MAGENTA, bevel=0.01)
add_box("led-skirt-west", (0.06, 11.4, 0.08), (-5.83, 0.1, 0.08), NEON_CYAN, bevel=0.01)
add_box("led-skirt-east", (0.06, 11.4, 0.08), (5.83, 0.1, 0.08), NEON_MAGENTA, bevel=0.01)
add_box("led-crown-north", (11.6, 0.08, 0.10), (0, 5.82, 4.35), NEON_VIOLET, bevel=0.01)
add_box("led-crown-west", (0.08, 11.4, 0.10), (-5.82, 0.1, 4.35), NEON_MAGENTA, bevel=0.01)
add_box("led-crown-east", (0.08, 11.4, 0.10), (5.82, 0.1, 4.35), NEON_CYAN, bevel=0.01)

# Cột ốp đèn LED dọc trên tường
for idx, x in enumerate((-4.6, -2.6, 2.6, 4.6)):
    add_box(f"north-pilaster-{idx}", (0.18, 0.12, 4.4), (x, 5.82, 2.2), DARK_MARBLE, bevel=0.02)
    add_box(f"north-pilaster-neon-{idx}", (0.05, 0.14, 3.9), (x, 5.80, 2.2), NEON_MAGENTA if idx % 2 == 0 else NEON_CYAN, bevel=0.01)

# ==============================================================================
# 2. GIƯỜNG ĐÔI KING-SIZE CYBER VELVET + GƯƠNG TRẦN & VÒM NEON (x=0, z=-3.8 -> y=+3.8)
# ==============================================================================
# Bục giường phát sáng underglow (khớp collider x: [-2.4, 2.4], z: [-5.8, -2.2] -> y: [2.2, 5.8])
add_box("bed-dais-base", (4.5, 3.3, 0.22), (0, 3.95, 0.11), DARK_MARBLE, bevel=0.03)
add_box("bed-dais-neon-front", (4.56, 0.06, 0.06), (0, 2.28, 0.06), NEON_MAGENTA, bevel=0.01)
add_box("bed-dais-neon-left", (0.06, 3.34, 0.06), (-2.27, 3.95, 0.06), NEON_MAGENTA, bevel=0.01)
add_box("bed-dais-neon-right", (0.06, 3.34, 0.06), (2.27, 3.95, 0.06), NEON_MAGENTA, bevel=0.01)

# Khung giường nhung đỏ và đệm King-size êm ái
add_box("bed-frame-velvet", (3.2, 2.7, 0.34), (0, 3.85, 0.38), VELVET_PLUM, bevel=0.05)
add_box("bed-mattress-main", (2.95, 2.48, 0.28), (0, 3.82, 0.64), VELVET_CRIMSON, bevel=0.08)
add_box("bed-silk-duvet", (2.98, 1.65, 0.12), (0, 3.42, 0.78), SILK_BLUSH, bevel=0.05)
add_box("bed-gold-trim", (3.24, 2.74, 0.05), (0, 3.85, 0.26), CHROME_GOLD, bevel=0.01)

# Gối lụa đôi + gối ôm tình nhân
for idx, px in enumerate((-0.72, 0.72)):
    add_box(f"bed-pillow-back-{idx}", (1.05, 0.42, 0.22), (px, 4.72, 0.86), SILK_BLUSH, bevel=0.06)
    add_box(f"bed-pillow-front-{idx}", (0.88, 0.36, 0.18), (px, 4.38, 0.84), VELVET_CRIMSON, bevel=0.05)
add_cylinder("bed-bolster-center", 0.13, 1.4, (0, 4.10, 0.84), CHROME_GOLD, vertices=20, rot_y=math.pi / 2)

# Đầu giường (Headboard) bọc nhung chần chỉ + Vòm Neon Cyber Heart / Halo
add_box("bed-headboard-panel", (3.6, 0.24, 2.35), (0, 5.55, 1.45), VELVET_PLUM, bevel=0.04)
add_box("bed-headboard-crimson", (3.1, 0.28, 1.85), (0, 5.50, 1.45), VELVET_CRIMSON, bevel=0.05)
add_box("bed-headboard-gold-frame", (3.68, 0.18, 2.42), (0, 5.58, 1.45), CHROME_GOLD, bevel=0.02)
add_cylinder("bed-neon-halo-outer", 1.25, 0.06, (0, 5.42, 2.35), NEON_MAGENTA, vertices=36, rot_x=math.pi / 2)
add_cylinder("bed-neon-halo-inner", 0.92, 0.08, (0, 5.39, 2.35), NEON_CYAN, vertices=36, rot_x=math.pi / 2)
add_cylinder("bed-headboard-mirror", 0.86, 0.05, (0, 5.41, 2.35), MIRROR_GLASS, vertices=36, rot_x=math.pi / 2)

# Tab đầu giường (Nightstands) + Đèn ngủ pha lê tình nhân 2 bên
for idx, nx in enumerate((-1.92, 1.92)):
    add_box(f"nightstand-{idx}", (0.58, 0.54, 0.56), (nx, 5.15, 0.50), DARK_MARBLE, bevel=0.02)
    add_box(f"nightstand-gold-{idx}", (0.60, 0.56, 0.04), (nx, 5.15, 0.78), CHROME_GOLD, bevel=0.01)
    add_cylinder(f"nightstand-lamp-base-{idx}", 0.10, 0.18, (nx, 5.15, 0.89), CHROME_GOLD, vertices=16)
    add_cylinder(f"nightstand-lamp-shade-{idx}", 0.16, 0.28, (nx, 5.15, 1.10), NEON_MAGENTA if idx == 0 else NEON_CYAN, vertices=20)

# Gương trần nhà + Vòng đèn LED lơ lửng phía trên giường King-size
add_cylinder("ceiling-mirror-frame", 1.85, 0.10, (0, 3.85, 4.42), CHROME_GOLD, vertices=40)
add_cylinder("ceiling-mirror-glass", 1.72, 0.06, (0, 3.85, 4.38), MIRROR_GLASS, vertices=40)
add_cylinder("ceiling-neon-ring", 1.92, 0.06, (0, 3.85, 4.36), NEON_MAGENTA, vertices=40)

# ==============================================================================
# 3. BỒN TẮM SỤC NEON JACUZZI SPA & VÁCH KÍNH MỜ (x in [-5.8, -2.9], z in [-2.6, 1.0] -> y in [-1.0, 2.6])
# ==============================================================================
# Bệ đá cẩm thạch đen của bồn Jacuzzi
add_box("jacuzzi-platform", (2.75, 3.4, 0.58), (-4.42, 0.8, 0.29), DARK_MARBLE, bevel=0.03)
add_box("jacuzzi-gold-rim", (2.80, 3.44, 0.06), (-4.42, 0.8, 0.59), CHROME_GOLD, bevel=0.02)
add_box("jacuzzi-neon-step-strip", (0.06, 3.36, 0.06), (-3.02, 0.8, 0.12), NEON_CYAN, bevel=0.01)
add_box("jacuzzi-step", (0.38, 1.8, 0.28), (-2.92, 0.8, 0.14), DARK_MARBLE, bevel=0.02)

# Lòng nước phát sáng Aqua-Cyan trong bồn tắm đôi
add_box("jacuzzi-water-surface", (2.15, 2.75, 0.08), (-4.45, 0.8, 0.54), JACUZZI_WATER, bevel=0.02)
add_cylinder("jacuzzi-underwater-ring", 0.92, 0.04, (-4.45, 0.8, 0.48), NEON_CYAN, vertices=32)

# Gối tựa đầu spa trên thành bồn Jacuzzi
for idx, jy in enumerate((0.1, 1.5)):
    add_box(f"jacuzzi-headrest-{idx}", (0.28, 0.62, 0.14), (-5.58, jy, 0.68), SILK_BLUSH, bevel=0.04)

# Vách kính tím mờ ngăn khu Jacuzzi đầy gợi cảm
add_box("jacuzzi-glass-screen-north", (2.65, 0.06, 2.45), (-4.42, 2.52, 1.82), GLASS_PARTITION, bevel=0.01)
add_box("jacuzzi-glass-frame-north", (2.70, 0.08, 0.08), (-4.42, 2.52, 3.06), CHROME_GOLD, bevel=0.01)
add_box("jacuzzi-wall-neon-1", (0.06, 2.8, 0.08), (-5.80, 0.8, 1.85), NEON_CYAN, bevel=0.01)
add_box("jacuzzi-wall-neon-2", (0.06, 2.8, 0.08), (-5.80, 0.8, 2.65), NEON_MAGENTA, bevel=0.01)

# ==============================================================================
# 4. QUẦY CHAMPAGNE & CYBER MINIBAR (x in [3.6, 5.8], z in [-3.4, -0.2] -> y in [0.2, 3.4])
# ==============================================================================
add_box("minibar-counter-body", (1.25, 2.95, 1.05), (4.55, 1.8, 0.525), DARK_MARBLE, bevel=0.03)
add_box("minibar-counter-top", (1.36, 3.08, 0.08), (4.55, 1.8, 1.08), CHROME_GOLD, bevel=0.02)
add_box("minibar-front-neon", (0.05, 2.85, 0.06), (3.90, 1.8, 0.92), NEON_CYAN, bevel=0.01)
add_box("minibar-foot-neon", (0.05, 2.85, 0.06), (3.90, 1.8, 0.10), NEON_MAGENTA, bevel=0.01)

# Kệ rượu Champagne gắn tường phía sau Minibar
add_box("minibar-back-mirror", (0.08, 2.75, 2.2), (5.78, 1.8, 2.3), MIRROR_GLASS, bevel=0.01)
for idx, sz in enumerate((1.55, 2.15, 2.75)):
    add_box(f"minibar-shelf-{idx}", (0.38, 2.55, 0.06), (5.62, 1.8, sz), CHROME_GOLD, bevel=0.01)
    add_box(f"minibar-shelf-led-{idx}", (0.06, 2.50, 0.04), (5.44, 1.8, sz - 0.03), NEON_MAGENTA if idx % 2 == 0 else NEON_CYAN, bevel=0.01)

# Chai Champagne & Xô đá phát sáng trên quầy bar
add_cylinder("champagne-ice-bucket", 0.18, 0.24, (4.45, 1.45, 1.24), CHROME_GOLD, vertices=20)
add_cylinder("champagne-bottle-1", 0.06, 0.36, (4.45, 1.45, 1.42), NEON_MAGENTA, vertices=16)
add_cylinder("champagne-bottle-2", 0.055, 0.34, (4.55, 2.15, 1.28), NEON_CYAN, vertices=16)

# ==============================================================================
# 5. SOFA ĐÔI TÌNH NHÂN (LOVESEAT BOOTH) & BÀN TRÀ (x in [3.4, 5.8], z in [0.8, 3.4] -> y in [-3.4, -0.8])
# ==============================================================================
add_box("loveseat-seat", (1.15, 2.25, 0.44), (4.85, -2.05, 0.22), VELVET_CRIMSON, bevel=0.05)
add_box("loveseat-backrest", (0.32, 2.25, 0.92), (5.38, -2.05, 0.56), VELVET_PLUM, bevel=0.05)
add_box("loveseat-arm-north", (1.15, 0.24, 0.66), (4.85, -0.98, 0.33), VELVET_PLUM, bevel=0.04)
add_box("loveseat-arm-south", (1.15, 0.24, 0.66), (4.85, -3.12, 0.33), VELVET_PLUM, bevel=0.04)
add_box("loveseat-gold-base", (1.18, 2.28, 0.06), (4.85, -2.05, 0.03), CHROME_GOLD, bevel=0.01)

# Bàn trà thấp mặt kính tròn trước ghế đôi
add_cylinder("loveseat-table-top", 0.48, 0.06, (3.65, -2.05, 0.46), DARK_MARBLE, vertices=28)
add_cylinder("loveseat-table-rim", 0.50, 0.04, (3.65, -2.05, 0.46), CHROME_GOLD, vertices=28)
add_cylinder("loveseat-table-pedestal", 0.10, 0.44, (3.65, -2.05, 0.22), CHROME_GOLD, vertices=16)

# ==============================================================================
# 6. KHUNG CỬA RA VÀO PHÍA NAM (z = 5.45..5.85 -> y = -5.45..-5.85)
# ==============================================================================
add_box("exit-door-pillar-left", (0.24, 0.36, 2.65), (-1.15, -5.65, 1.325), CHROME_GOLD, bevel=0.02)
add_box("exit-door-pillar-right", (0.24, 0.36, 2.65), (1.15, -5.65, 1.325), CHROME_GOLD, bevel=0.02)
add_box("exit-door-header", (2.62, 0.38, 0.24), (0, -5.65, 2.68), CHROME_GOLD, bevel=0.02)
add_box("exit-door-neon-arch", (2.48, 0.08, 0.08), (0, -5.44, 2.84), NEON_CYAN, bevel=0.01)

RAW.parent.mkdir(parents=True, exist_ok=True)
OUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(RAW),
    export_format="GLB",
    export_yup=True,
    export_apply=True,
    export_texcoords=True,
    export_normals=True,
    export_materials="EXPORT",
    export_animations=False,
)
OUT.write_bytes(RAW.read_bytes())
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
print(f"LOVE_HOTEL_EXPORT_COMPLETE -> {OUT}")

