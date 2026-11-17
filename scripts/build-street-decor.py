"""Dựng lớp trang trí phố Sakura (cây anh đào, đèn đá tōrō, cột điện + dây võng, cổng bắc, chậu cây, ghế, xe đạp,
thảm cỏ công viên, cánh hoa rơi) theo packages/game-protocol/src/street-decor.json rồi xuất street-decor.glb.

Chạy: blender -b -P scripts/build-street-decor.py
Collider của các khối rắn được game-protocol suy ra từ cùng file JSON (STREET_PROP_COLLIDERS), nên chỉ sửa vị trí ở JSON.
"""
import bmesh, bpy, json, math, random
from pathlib import Path
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
LAYOUT = json.loads((ROOT / 'packages/game-protocol/src/street-decor.json').read_text(encoding='utf8'))
RAW_GLB = ROOT / 'assets/processed/street-decor.raw.glb'
PUBLIC_GLB = ROOT / 'apps/web/public/assets/props/street-decor.glb'
BLEND_FILE = ROOT / 'assets/processed/street-decor.blend'

bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, color, roughness=.6, metallic=0.0, emission=0.0):
    mat = bpy.data.materials.new(name); mat.use_nodes = True
    node = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    node.inputs['Base Color'].default_value = (*color, 1)
    node.inputs['Roughness'].default_value = roughness
    node.inputs['Metallic'].default_value = metallic
    if emission:
        node.inputs['Emission Color'].default_value = (*color, 1)
        node.inputs['Emission Strength'].default_value = emission
    return mat


# Tên chứa "decor glow" được StreetAssets điều khiển theo ngày/đêm (tắt ban ngày như lồng đèn giấy).
bark = material('Street decor / cherry bark', (.16, .1, .09), .85)
blossoms = [material(f'Street decor / sakura blossom {i}', c, .75) for i, c in enumerate([(.97, .58, .72), (.9, .44, .62), (1, .74, .84)])]
petal = material('Street decor / fallen petal', (1, .74, .84), .8)
granite = material('Street decor / weathered granite', (.46, .45, .42), .92)
lantern_glow = material('Street decor / decor glow stone lantern', (1, .78, .45), .5, emission=2.2)
concrete = material('Street decor / concrete pole', (.58, .58, .56), .88)
steel = material('Street decor / dark steel', (.08, .08, .09), .45, .7)
wire = material('Street decor / power wire', (.03, .03, .03), .6)
porcelain = material('Street decor / insulator porcelain', (.86, .86, .82), .25)
transformer = material('Street decor / transformer grey', (.36, .38, .4), .5, .4)
wood = material('Street decor / cedar wood', (.36, .2, .11), .7)
leaf = material('Street decor / shrub leaf', (.12, .3, .13), .8)
bamboo = material('Street decor / bamboo', (.42, .55, .22), .5)
lawn = material('Street decor / park lawn', (.13, .24, .1), .95)
gravel = material('Street decor / gravel path', (.5, .47, .42), .95)
lacquer = material('Street decor / gate vermilion', (.62, .07, .04), .35)
sign_glow = material('Street decor / decor glow gate sign', (1, .93, .82), .4, emission=1.6)
paper_red = material('Street decor / decor glow gate lantern', (1, .16, .1), .6, emission=1.4)
bike_paint = [material('Street decor / bike mint', (.42, .78, .7), .4, .3), material('Street decor / bike cream', (.92, .86, .72), .4, .3)]
rubber = material('Street decor / tyre rubber', (.04, .04, .04), .8)


# Dựng thẳng vào một bmesh cho mỗi vật liệu: nhanh hơn hẳn tạo hàng nghìn object bằng bpy.ops,
# và cả lớp trang trí ra đúng một mesh/draw call cho mỗi vật liệu.
meshes = {}


def bm_of(mat):
    return meshes.setdefault(mat, bmesh.new())


def at(position):
    """Đổi tọa độ game (x, y lên, z) sang Blender (x, -z, y)."""
    return Matrix.Translation((position[0], -position[2], position[1]))


def box(position, size, mat, yaw=0.0):
    w, h, d = size
    bmesh.ops.create_cube(bm_of(mat), size=1, matrix=at(position) @ Matrix.Rotation(yaw, 4, 'Z') @ Matrix.Diagonal((w, d, h, 1)))


def cyl(position, radius, height, mat, vertices=10, radius_top=None):
    bmesh.ops.create_cone(bm_of(mat), cap_ends=True, segments=vertices, radius1=radius, radius2=radius if radius_top is None else radius_top, depth=height, matrix=at(position))


def smooth(result):
    """Đổ bóng mượt cho tán/cành/bánh xe: đỉnh dùng chung giữa các mặt nên GLB nhẹ hơn nhiều so với bóng phẳng."""
    for face in {f for v in result['verts'] for f in v.link_faces}: face.smooth = True


def petal_quad(x, z, yaw, size=(.07, .05)):
    """Cánh hoa nằm trên mặt đất: một mặt 4 đỉnh thay vì hộp 24 đỉnh."""
    bm = bm_of(petal)
    rot = Matrix.Rotation(yaw, 4, 'Z')
    w, d = size[0] / 2, size[1] / 2
    verts = [bm.verts.new(at((x, .012, z)) @ rot @ Vector(c)) for c in ((-w, -d, 0), (w, -d, 0), (w, d, 0), (-w, d, 0))]
    bm.faces.new(verts)


def limb(a, b, r0, r1, mat, vertices=7):
    """Trụ côn nối hai điểm game (x, y, z): thân/cành cây, ống khung xe đạp, đoạn dây điện."""
    pa, pb = Vector((a[0], -a[2], a[1])), Vector((b[0], -b[2], b[1]))
    d = pb - pa
    if d.length < 1e-5: return
    matrix = Matrix.Translation((pa + pb) / 2) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    smooth(bmesh.ops.create_cone(bm_of(mat), cap_ends=False, segments=vertices, radius1=r0, radius2=r1, depth=d.length, matrix=matrix))


def blob(center, radius, mat, squash=(1, 1, .72), subdiv=2):
    smooth(bmesh.ops.create_icosphere(bm_of(mat), subdivisions=subdiv, radius=radius, matrix=at(center) @ Matrix.Diagonal((*squash, 1))))


def ring(center, radius, thickness, mat, axis='x', segments=24, sides=6):
    """Vòng xuyến dựng đứng (bánh xe); axis là trục quay của bánh theo hệ game."""
    bm = bm_of(mat)
    rot = Matrix.Rotation(math.pi / 2, 4, 'Y') if axis == 'x' else Matrix.Rotation(math.pi / 2, 4, 'X')
    matrix = at(center) @ rot
    grid = []
    for i in range(segments):
        u = i * math.tau / segments
        row = []
        for j in range(sides):
            v = j * math.tau / sides
            r = radius + thickness * math.cos(v)
            row.append(bm.verts.new(matrix @ Vector((r * math.cos(u), r * math.sin(u), thickness * math.sin(v)))))
        grid.append(row)
    for i in range(segments):
        for j in range(sides):
            a, b = grid[i][j], grid[(i + 1) % segments][j]
            bm.faces.new((a, b, grid[(i + 1) % segments][(j + 1) % sides], grid[i][(j + 1) % sides])).smooth = True


def cable(a, b, sag, mat, radius=.012, steps=14):
    """Dây điện võng theo parabol giữa hai điểm, dựng bằng các đoạn trụ mảnh."""
    pts = []
    for i in range(steps + 1):
        t = i / steps
        pts.append(tuple(a[k] + (b[k] - a[k]) * t for k in range(3)))
        pts[-1] = (pts[-1][0], pts[-1][1] - 4 * sag * t * (1 - t), pts[-1][2])
    for p, q in zip(pts, pts[1:]):
        limb(p, q, radius, radius, mat, vertices=5)


# ------------------------------------------------------------------------------
# Cây anh đào: thân cong chia cành, tán là các cụm hoa dẹt nhiều sắc hồng
# ------------------------------------------------------------------------------
def sakura_tree(x, z, scale, seed):
    rng = random.Random(seed)
    s = scale
    lean = rng.uniform(0, math.tau)
    top = (x + math.cos(lean) * .35 * s, 2.1 * s, z + math.sin(lean) * .35 * s)
    limb((x, 0, z), (x + math.cos(lean) * .15 * s, 1.1 * s, z + math.sin(lean) * .15 * s), .26 * s, .19 * s, bark)
    limb((x + math.cos(lean) * .15 * s, 1.1 * s, z + math.sin(lean) * .15 * s), top, .19 * s, .14 * s, bark)
    for root in range(4):
        a = root * math.pi / 2 + rng.uniform(-.3, .3)
        limb((x, .12, z), (x + math.cos(a) * .5 * s, 0, z + math.sin(a) * .5 * s), .1 * s, .04 * s, bark, 5)
    branches = rng.randint(4, 6)
    for b in range(branches):
        a = b * math.tau / branches + rng.uniform(-.35, .35)
        reach = rng.uniform(1.4, 2.2) * s
        rise = rng.uniform(.8, 1.6) * s
        tip = (top[0] + math.cos(a) * reach, top[1] + rise, top[2] + math.sin(a) * reach)
        limb(top, tip, .1 * s, .045 * s, bark, 6)
        # Nhiều chùm nhỏ lệch nhau tạo mép tán lởm chởm như hoa thật, thay vì vài khối tròn như mây.
        for c in range(rng.randint(6, 8)):
            off = (rng.uniform(-.75, .75) * s, rng.uniform(-.35, .55) * s, rng.uniform(-.75, .75) * s)
            blob((tip[0] + off[0], tip[1] + off[1], tip[2] + off[2]), rng.uniform(.32, .6) * s, blossoms[rng.randrange(3)], squash=(1, 1, .6), subdiv=1)
        # Vài chùm rủ xuống dưới cành.
        for c in range(2):
            mid = [top[k] + (tip[k] - top[k]) * rng.uniform(.45, .8) for k in range(3)]
            blob((mid[0], mid[1] - .25 * s, mid[2]), rng.uniform(.25, .38) * s, blossoms[1], squash=(1, 1, .8), subdiv=1)
    # Cụm hoa giữa tán (màu đậm, nằm trong) che chỗ các cành giao nhau.
    blob((top[0], top[1] + 1.2 * s, top[2]), 1.0 * s, blossoms[1], subdiv=2)
    for p in range(70):
        r = rng.uniform(.3, 2.8) * s; a = rng.uniform(0, math.tau)
        petal_quad(x + math.cos(a) * r, z + math.sin(a) * r, rng.uniform(0, math.pi))


# ------------------------------------------------------------------------------
# Đèn đá kasuga tōrō
# ------------------------------------------------------------------------------
def stone_lantern(x, z):
    cyl((x, .09, z), .42, .18, granite, 6)
    cyl((x, .55, z), .12, .8, granite, 8)
    cyl((x, 1.0, z), .32, .12, granite, 6)
    box((x, 1.24, z), (.4, .34, .4), granite)
    box((x, 1.24, z), (.42, .2, .26), lantern_glow)
    box((x, 1.24, z), (.26, .2, .42), lantern_glow)
    cyl((x, 1.52, z), .52, .24, granite, 6, radius_top=.12)
    blob((x, 1.7, z), .09, granite, squash=(1, 1, 1.4), subdiv=1)


# ------------------------------------------------------------------------------
# Cột điện bê tông kiểu Nhật: 2 xà ngang, sứ cách điện, biến áp trên cột giữa
# ------------------------------------------------------------------------------
POLE_ARMS = (7.45, 6.95)
WIRE_OFFSETS = (-.6, 0, .6)


def utility_pole(x, z, transformer_pot):
    cyl((x, 4.1, z), .17, 8.2, concrete, 12, radius_top=.12)
    for y in POLE_ARMS:
        box((x, y, z), (1.5, .09, .09), steel)
        for dx in WIRE_OFFSETS:
            cyl((x + dx, y + .1, z), .035, .12, porcelain, 8)
    for k in range(10):
        box((x + (.17 if k % 2 else -.17), 2.4 + k * .4, z), (.12, .025, .025), steel)
    box((x - math.copysign(.18, x), 3.0, z), (.02, .5, .26), porcelain)  # Biển số cột
    if transformer_pot:
        cyl((x - math.copysign(.42, x), 6.2, z), .24, .8, transformer, 14)
        cyl((x - math.copysign(.42, x), 6.64, z), .26, .06, steel, 14)
        limb((x - math.copysign(.42, x), 6.66, z), (x - math.copysign(.6, x), POLE_ARMS[1] + .1, z), .015, .015, wire, 5)


# ------------------------------------------------------------------------------
# Cổng thương phố phía bắc: trụ thép bọc sơn son, mái cong, bảng hiệu sáng, dãy lồng đèn
# ------------------------------------------------------------------------------
def north_gate(gate):
    gz, gx, h = gate['z'], gate['x'], gate['height']
    for side in (-1, 1):
        x = side * gx
        box((x, .15, gz), (.7, .3, .7), granite)
        box((x, h / 2, gz), (.42, h, .42), lacquer)
        box((x, h / 2, gz), (.46, .5, .46), steel)
        box((x, 2.2, gz), (.46, .08, .46), steel)
    box((0, h - .3, gz), (2 * gx + 1.4, .34, .5), lacquer)
    box((0, h - .55, gz), (2 * gx + .6, .12, .4), steel)
    for k in range(13):
        t = k / 12 - .5
        y = h + .15 + .35 * (1 - (2 * t) ** 2)
        box((t * (2 * gx + 2.2), y, gz), ((2 * gx + 2.2) / 12 + .05, .1, 1.3), steel, 0)
    box((0, h - 1.35, gz), (4.4, 1.1, .16), lacquer)
    box((0, h - 1.35, gz), (4.1, .86, .2), sign_glow)
    for k in range(9):
        lx = -gx + .8 + k * (2 * gx - 1.6) / 8
        if abs(lx) < 2.4: continue
        cyl((lx, h - .75, gz), .006, .3, wire, 4)
        cyl((lx, h - 1.08, gz), .16, .38, paper_red, 14)


# ------------------------------------------------------------------------------
# Đồ vỉa hè: chậu cây gỗ, ghế, xe đạp mamachari
# ------------------------------------------------------------------------------
def planter(x, z, rng):
    box((x, .28, z), (.62, .56, 1.15), wood)
    box((x, .57, z), (.68, .04, 1.21), steel)
    for k in range(3):
        blob((x + rng.uniform(-.12, .12), .72, z - .35 + k * .35), rng.uniform(.26, .34), leaf, subdiv=1)
    for k in range(5):
        bx, bz = x + rng.uniform(-.18, .18), z + rng.uniform(-.4, .4)
        h = rng.uniform(1.4, 2.2)
        cyl((bx, .56 + h / 2, bz), .025, h, bamboo, 6)
        blob((bx, .56 + h, bz), .18, leaf, squash=(1, 1, .5), subdiv=1)


def bench(x, z):
    for k in range(4):
        box((x - .15 + k * .1, .46, z), (.08, .04, 1.5), wood)
    for k in range(2):
        box((x + math.copysign(.22, x), .66 + k * .16, z), (.03, .1, 1.5), wood)
    for dz in (-.62, .62):
        box((x, .23, z + dz), (.42, .46, .05), steel)
        box((x + math.copysign(.22, x), .55, z + dz), (.04, .5, .05), steel)


def stone_bench(x, z):
    """Ghế đá công viên quay mặt ra lối sỏi; mặt ngồi 0.74 m khớp tư thế Sit của người chơi (STREET_SEATS)."""
    face = 1 if x > 0 else -1
    for dz in (-.6, .6):
        box((x, .34, z + dz), (.42, .68, .22), granite)
    box((x, .71, z), (.5, .07, 1.7), granite)
    box((x - face * .27, 1.02, z), (.1, .56, 1.6), granite)
    box((x - face * .27, 1.32, z), (.16, .06, 1.7), granite)


def bicycle(x, z, paint):
    for dz in (-.52, .52):
        ring((x, .34, z + dz), .32, .025, rubber, axis='x')
        cyl((x, .34, z + dz), .03, .06, steel, 8)
    limb((x, .34, z - .52), (x, .62, z - .05), .018, .018, paint)
    limb((x, .62, z - .05), (x, .4, z + .1), .018, .018, paint)
    limb((x, .4, z + .1), (x, .34, z + .52), .018, .018, paint)
    limb((x, .4, z + .1), (x, .78, z + .42), .02, .02, paint)
    limb((x, .34, z - .52), (x, .82, z - .42), .016, .016, paint)
    box((x, .86, z - .42), (.5, .025, .025), steel)
    box((x, .82, z - .66), (.3, .2, .24), steel)
    box((x, .8, z + .1), (.12, .05, .22), rubber)


# ------------------------------------------------------------------------------
# Dựng theo bố cục
# ------------------------------------------------------------------------------
rng = random.Random(2026)
for side in (-1, 1):
    # Thảm cỏ và lối sỏi công viên sau dãy nhà (nền đảo phía sau trống trơn).
    box((side * 17.6, .006, -2.2), (9.8, .012, 32), lawn)
    box((side * 17.4, .014, -2.2), (1.2, .012, 32), gravel)
    for k in range(18):
        box((side * 17.4, .02, -17.5 + k * 1.8), (.55, .02, .4), granite, rng.uniform(-.2, .2))
for tree in LAYOUT['trees']:
    sakura_tree(tree['x'], tree['z'], tree['scale'], tree['seed'])
for lantern in LAYOUT['stoneLanterns']:
    stone_lantern(lantern['x'], lantern['z'])
for item in LAYOUT['planters']:
    planter(item['x'], item['z'], rng)
for item in LAYOUT['stoneBenches']:
    stone_bench(item['x'], item['z'])
for item in LAYOUT['benches']:
    bench(item['x'], item['z'])
for index, item in enumerate(LAYOUT['bicycles']):
    bicycle(item['x'], item['z'], bike_paint[index % 2])
north_gate(LAYOUT['gate'])

poles = LAYOUT['poles']
for pole in poles:
    utility_pole(pole['x'], pole['z'], transformer_pot=abs(pole['z'] + 1) < .1)
for side in (-1, 1):
    row = sorted((p for p in poles if p['x'] * side > 0), key=lambda p: p['z'])
    for a, b in zip(row, row[1:]):
        for y in POLE_ARMS:
            for dx in WIRE_OFFSETS:
                cable((a['x'] + dx, y + .16, a['z']), (b['x'] + dx, y + .16, b['z']), .55, wire)
    # Dây chạy tiếp ra hai đầu phố và dây nhánh vào mặt tiền nhà.
    for end in (row[0], row[-1]):
        to_z = -24.5 if end is row[0] else 24.5
        cable((end['x'], POLE_ARMS[0] + .16, end['z']), (end['x'], POLE_ARMS[0] - .3, to_z), .45, wire)
    for p in row:
        for dz in (-1.6, 1.8):
            cable((p['x'], POLE_ARMS[1] + .16, p['z']), (side * 5.45, 5.6, p['z'] + dz), .2, wire, radius=.009, steps=8)
# Dây vượt đường giữa từng cặp cột hai bên.
for left in (p for p in poles if p['x'] < 0):
    right = next(p for p in poles if p['x'] > 0 and abs(p['z'] - left['z']) < .1)
    cable((left['x'] + .6, POLE_ARMS[0] + .16, left['z']), (right['x'] - .6, POLE_ARMS[0] + .16, right['z']), .7, wire)

# Cánh hoa rơi rải dọc vỉa hè hai bên.
for k in range(520):
    side = rng.choice((-1, 1))
    petal_quad(side * rng.uniform(3.6, 5.3), rng.uniform(-22, 22), rng.uniform(0, math.pi))

# Mỗi vật liệu thành một object; tên object không được runtime tra cứu.
objects = []
for mat, bm in meshes.items():
    mesh = bpy.data.meshes.new('decor:' + mat.name.split('/ ')[-1])
    bm.to_mesh(mesh); bm.free()
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(mesh.name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    objects.append(obj)
bpy.ops.object.select_all(action='DESELECT')
for obj in objects: obj.select_set(True)
bpy.context.view_layer.objects.active = objects[0]
RAW_GLB.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(RAW_GLB), export_format='GLB', use_selection=True, export_yup=True, export_animations=False)
PUBLIC_GLB.write_bytes(RAW_GLB.read_bytes())
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_FILE))
print('STREET_DECOR_EXPORT_COMPLETE', len(objects), 'objects')
