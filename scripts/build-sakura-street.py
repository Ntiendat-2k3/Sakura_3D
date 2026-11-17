"""Nhập asset CC0, chuẩn hóa mét/UV, dựng phố và xuất GLB cùng file Blender có thể chỉnh sửa."""
import bpy, json, math, random
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'apps/web/public/assets'
PROCESSED = ROOT / 'assets/processed'
LAYOUT = json.loads((ROOT/'packages/game-protocol/src/street-layout.json').read_text())
RNG = random.Random(512)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
used_sources = set()
palette_cache = {}

def material(name, texture, emission=None, strength=0, orm=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(str(PUBLIC/'textures'/texture), check_existing=True)
    links.new(tex.outputs['Color'], shader.inputs['Base Color'])
    shader.inputs['Roughness'].default_value = .7
    if emission:
        glow = nodes.new('ShaderNodeTexImage')
        glow.image = bpy.data.images.load(str(PUBLIC/'textures'/emission), check_existing=True)
        links.new(glow.outputs['Color'], shader.inputs['Emission Color'])
        shader.inputs['Emission Strength'].default_value = strength
    if orm:
        tex_orm = nodes.new('ShaderNodeTexImage')
        tex_orm.image = bpy.data.images.load(str(PUBLIC/'textures'/orm), check_existing=True)
        tex_orm.image.colorspace_settings.name = 'Non-Color'
        split = nodes.new('ShaderNodeSeparateColor')
        links.new(tex_orm.outputs['Color'], split.inputs['Color'])
        links.new(split.outputs['Green'], shader.inputs['Roughness'])
        links.new(split.outputs['Blue'], shader.inputs['Metallic'])
    return mat

surfaces = material('Sakura / stone wood glass metal fabric', 'street-surfaces.png', 'street-emission.png', .8, 'street-orm.png')
signs = material('Sakura / luminous venue atlas', 'venue-signs.png', 'venue-signs.png', 1.2)
blade_signs = material('Sakura / vertical sign atlas', 'blade-signs.png', 'blade-signs.png', 1.2)
vending_mat = material('Sakura / illuminated drinks', 'vending-front.png', 'vending-front.png', .55)
lantern_mat = bpy.data.materials.new('Sakura / warm ribbed paper')
lantern_mat.use_nodes = True
p = next(n for n in lantern_mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
p.inputs['Base Color'].default_value = (.65,.055,.09,1)
p.inputs['Emission Color'].default_value = (1,.14,.045,1)
p.inputs['Emission Strength'].default_value = .7
p.inputs['Roughness'].default_value = .85

def bounds(obj):
    pts = [obj.matrix_world @ Vector(v) for v in obj.bound_box]
    return Vector([min(p[i] for p in pts) for i in range(3)]), Vector([max(p[i] for p in pts) for i in range(3)])

def select(objects):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]

def project_uv(obj, indices):
    """Mỗi mặt dùng một ô atlas, phép chiếu theo trục giữ đường gạch liên tục qua các tam giác."""
    mesh = obj.data
    uv = mesh.uv_layers.active or mesh.uv_layers.new(name='UVMap')
    lo = Vector([min(v.co[i] for v in mesh.vertices) for i in range(3)])
    hi = Vector([max(v.co[i] for v in mesh.vertices) for i in range(3)])
    span = hi-lo
    for poly, tile in zip(mesh.polygons, indices):
        axis = max(range(3), key=lambda i: abs(poly.normal[i]))
        axes = [i for i in range(3) if i != axis]
        for loop in poly.loop_indices:
            co = mesh.vertices[mesh.loops[loop].vertex_index].co
            u,v = [(co[a]-lo[a])/max(span[a],.001) for a in axes]
            uv.data[loop].uv = ((tile%4 + .015 + u*.97)/4, (3-tile//4 + .015 + v*.97)/4)
        poly.material_index = 0
    mesh.materials.clear()
    mesh.materials.append(surfaces)

def palette_color(obj, poly):
    mat = obj.data.materials[poly.material_index] if obj.data.materials else None
    tex = next((n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image), None) if mat and mat.use_nodes else None
    if not tex or not obj.data.uv_layers.active:
        return mat.diffuse_color[:3] if mat else (.5,.5,.5)
    img = tex.image
    if img.name not in palette_cache:
        palette_cache[img.name] = (list(img.pixels), img.size[0], img.size[1])
    pixels,w,h = palette_cache[img.name]
    uv = obj.data.uv_layers.active.data[poly.loop_indices[0]].uv
    i = (min(h-1,max(0,int(uv.y*h)))*w + min(w-1,max(0,int(uv.x*w))))*4
    return pixels[i:i+3]

def classify(color, kind, variant):
    r,g,b = color
    if kind == 'tree':
        return 13 if g>r*1.05 else 2
    if kind == 'road':
        return 12 if min(color)>.68 else 8 if max(color)>.58 else 9
    if kind == 'prop':
        return 4 if r>.8 and g>.6 and b<.5 else 14
    if g > r*1.15 and g > b*1.1:
        return 13
    if b > r*1.12 and b > g*1.02:
        return [4,5,10][variant%3]
    if max(color)-min(color)<.14:
        return (0 if variant%2 else 1) if max(color)>.72 else 3 if max(color)<.3 else 14
    if r>g*1.2:
        return 7 if r>.6 else 2
    return 6 if r>.6 and g>.35 else 14

def import_model(pack, name, size, kind='building', variant=0, height=False):
    folder = 'GLTF format' if pack == 'kenney-nature' else 'GLB format'
    path = ROOT/'assets/source'/pack/'Models'/folder/(name+'.glb')
    used_sources.add(str(path.relative_to(ROOT)).replace('\\','/'))
    before = set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [o for o in scene.objects if o not in before and o.type == 'MESH']
    for obj in imported:
        mw = obj.matrix_world.copy()
        obj.parent = None
        obj.data.transform(mw)
        obj.matrix_world = Matrix.Identity(4)
        slots = [classify(palette_color(obj,p),kind,variant) for p in obj.data.polygons]
        project_uv(obj,slots)
    select(imported)
    bpy.ops.object.join()
    obj = bpy.context.object
    lo,hi = bounds(obj)
    scale = size / ((hi-lo).z if height else max((hi-lo).x,(hi-lo).y))
    center = Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
    for v in obj.data.vertices:
        v.co = (v.co-center)*scale
    obj.rotation_mode = 'XYZ'
    obj.name = name
    return obj

def cube(name, location, dimensions, tile=14, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj=bpy.context.object
    obj.name=name
    obj.dimensions=dimensions
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=obj.modifiers.new('Soft manufactured edges','BEVEL')
        mod.width=bevel
        mod.segments=2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    project_uv(obj,[tile]*len(obj.data.polygons))
    return obj

def face(name, cx, y, z, width, height, mat, cell=None):
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata([(cx-width/2,y,z-height/2),(cx+width/2,y,z-height/2),(cx+width/2,y,z+height/2),(cx-width/2,y,z+height/2)],[],[(0,1,2,3)])
    obj=bpy.data.objects.new(name,mesh)
    scene.collection.objects.link(obj)
    mesh.materials.append(mat)
    uv=mesh.uv_layers.new()
    coords=[(0,0),(1,0),(1,1),(0,1)]
    for loop,(u,v) in enumerate(coords):
        uv.data[loop].uv=((cell%4+.01+u*.98)/4,(1-cell//4+.01+v*.98)/2) if cell is not None else (u,v)
    return obj

def curve(name, points, thickness, tile=14):
    data=bpy.data.curves.new(name,'CURVE')
    data.dimensions='3D'
    data.resolution_u=2
    data.bevel_depth=thickness
    data.bevel_resolution=1
    spline=data.splines.new('POLY')
    spline.points.add(len(points)-1)
    for p,co in zip(spline.points,points): p.co=(*co,1)
    obj=bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    select([obj])
    bpy.ops.object.convert(target='MESH')
    project_uv(obj,[tile]*len(obj.data.polygons))
    return obj

def join(objects,name):
    select(objects)
    bpy.ops.object.join()
    obj=bpy.context.object
    obj.rotation_mode='XYZ'
    obj.name=name
    scene.cursor.location=(0,0,0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    return obj

def export(objects, path):
    select(objects)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_cameras=False,export_lights=False,export_extras=True)

def lantern():
    """Lồng đèn tiện theo biên dạng có nếp giấy, vành kim loại và dây treo; không phải capsule NPC."""
    verts,faces=[],[]
    rings,segments=20,20
    for row in range(rings+1):
        t=row/rings
        radius=.13+.17*math.sin(math.pi*t)**.55
        radius += .012 if row%2==0 else -.009
        for k in range(segments):
            a=k*math.tau/segments
            verts.append((radius*math.cos(a),radius*math.sin(a),t*.68))
    for row in range(rings):
        for k in range(segments):
            a=row*segments+k; b=row*segments+(k+1)%segments
            faces.append((a,b,b+segments,a+segments))
    mesh=bpy.data.meshes.new('Pleated paper lantern')
    mesh.from_pydata(verts,[],faces)
    # Giữ UVMap trên mesh đích trước khi join, tránh glTF exporter tạo texCoord=-1 cho vành.
    mesh.uv_layers.new(name='UVMap')
    obj=bpy.data.objects.new('lantern-paper',mesh)
    scene.collection.objects.link(obj)
    mesh.materials.append(lantern_mat)
    parts=[obj]
    for h in [0,.68]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.145,depth=.055,location=(0,0,h))
        ring=bpy.context.object
        project_uv(ring,[6]*len(ring.data.polygons))
        parts.append(ring)
    parts.append(curve('lantern-cord',[(0,0,.7),(0,0,1.05)],.012))
    return join(parts,'lantern')

def build_entrance_door(block, index):
    """Thiết kế khung cửa, bậc tam cấp, thảm đón khách, nẹp đồng và đèn cổng ở mặt tiền quay ra đường; cánh cửa đóng mở do R3F điều khiển."""
    venue = block['id']
    traditional = venue in ('oiran', 'izakaya', 'tea')
    frame_tile = 2 if traditional else 6
    glow_tile = [4, 5, 10][index % 3]
    door_parts = [
        # Bậc thềm đá và thảm đón khách trước cửa
        cube('door-threshold', (0, -3.14, .11), (2.64, .52, .08), 8, .015),
        cube('door-welcome-mat', (0, -3.18, .16), (1.84, .34, .025), 7, .008),
        # Hốc cửa lùi sâu tạo chiều sâu kiến trúc thật khi cửa mở
        cube('door-recess-wall', (0, -2.88, 1.25), (2.04, .08, 2.24), 3),
        cube('door-recess-floor', (0, -2.96, .12), (2.04, .24, .06), 8),
        cube('door-recess-ceiling', (0, -2.96, 2.38), (2.04, .24, .06), frame_tile),
        # Hai trụ khung bao cửa + nẹp đồng và dầm ngang trên cửa
        cube('door-jamb-l', (-1.08, -3.05, 1.26), (.18, .28, 2.32), frame_tile, .02),
        cube('door-jamb-r', (1.08, -3.05, 1.26), (.18, .28, 2.32), frame_tile, .02),
        cube('door-trim-l', (-.97, -3.10, 1.26), (.05, .22, 2.28), 7),
        cube('door-trim-r', (.97, -3.10, 1.26), (.05, .22, 2.28), 7),
        cube('door-lintel-header', (0, -3.08, 2.48), (2.56, .34, .20), frame_tile, .02),
        cube('door-transom-glow', (0, -3.14, 2.32), (1.88, .08, .14), glow_tile),
    ]
    for side in (-1, 1):
        sx = side * 1.38
        door_parts.extend([
            cube('door-sconce-box', (sx, -3.04, 1.76), (.16, .16, .40), 6, .015),
            cube('door-sconce-lamp', (sx, -3.08, 1.76), (.11, .12, .28), glow_tile),
        ])
    if traditional or venue == 'hostess':
        door_parts.append(cube('noren-rod', (0, -3.15, 2.26), (1.92, .04, .04), 2))
        for nx in (-.69, -.23, .23, .69):
            door_parts.append(cube('noren-flap', (nx, -3.16, 2.04), (.41, .03, .42), 7, .008))
    return door_parts

# Tám công trình nhập từ Kenney; mọi chi tiết bổ sung đều có texture và tái sử dụng vật liệu chung.
model_names=['building-skyscraper-a','building-d','building-h','building-d','building-f','building-a','building-h','building-a']
buildings=[]
for index,(block,name) in enumerate(zip(LAYOUT,model_names)):
    base=import_model('kenney-commercial',name,5.8,variant=index)
    parts=[base]
    top=bounds(base)[1].z
    parts.append(cube('stone-plinth',(0,0,.08),(6,6,.16),8,.04))
    parts.append(cube('sign-frame',(0,-3.02,3.9),(4.7,.16,1.65),6,.035))
    parts.append(face('venue-sign',0,-3.112,3.9,4.55,1.51,signs,index))
    parts.append(cube('entry-lintel',(0,-2.99,2.85),(4.95,.35,.18),6,.025))
    parts.extend(build_entrance_door(block,index))
    # Biển nhô vuông góc mặt tiền (2 mặt): nhìn rõ từ cả hai chiều đi dọc theo phố.
    sign=cube('blade-frame',(-2.5,-2.95,5.7),(.13,1.15,2.05),6,.025)
    parts.append(sign)
    for bx,rot_z in [(-2.58,math.pi/2),(-2.42,-math.pi/2)]:
        blade=face('blade-sign',0,0,0,1.05,1.92,blade_signs,index)
        blade.rotation_mode='XYZ'
        blade.rotation_euler.z=rot_z
        blade.location=(bx,-2.95,5.7)
        parts.append(blade)
    # Mái hiên nhập từ bộ asset, kèm khung gỗ hai bên mặt tiền cho các quán truyền thống.
    awning=import_model('kenney-commercial','detail-awning-wide',4.8,variant=index)
    awning.location=(0,-2.65,2.62)
    parts.append(awning)
    if block['id'] in ('oiran','izakaya','tea'):
        for x in [-2.25,-1.85,1.85,2.25]:
            parts.append(cube('timber-screen',(x,-3.04,1.35),(.09,.11,2.3),2))
        for row in range(3):
            # Mái ngói có mép cong, nhiều dải lợp, không phải một mặt phẳng tô màu.
            y=-2.3-row*.35
            points=[(-3.05,y,top+.2),(-2.5,y,top-.05),(0,y,top-.17),(2.5,y,top-.05),(3.05,y,top+.2)]
            parts.append(curve('curved-tiled-eave',points,.13,3))
    obj=join(parts,block['id'])
    yaw=math.pi/2 if block['x']<0 else -math.pi/2
    obj.data.transform(Matrix.Rotation(yaw,4,'Z'))
    obj.rotation_euler=(0,0,0)
    obj.location=(block['x'],-block['z'],.03)
    obj['source']='Kenney City Kit Commercial 2.1 / CC0 + original Sakura trim'
    obj['venue']=block['id']
    buildings.append(obj)
for i,x in enumerate([-12,0,12]):
    background=import_model('kenney-commercial','building-skyscraper-a',7.5,variant=i)
    background.name='background-tower-'+str(i)
    background.location=(x,33,0)
    buildings.append(background)
export(buildings,PROCESSED/'buildings.raw.glb')

# Các đạo cụ lặp lại được xuất một lần rồi instancing tại runtime.
templates=[]
for pack,name,size,kind,height in [
    ('kenney-roads','road-straight',10.6,'road',False),
    ('kenney-roads','road-crossing',10.6,'road',False),
    ('kenney-roads','electricity-pole',6.8,'prop',True),
    ('kenney-roads','electricity-wires',8,'prop',False),
    ('kenney-roads','light-curved',4.8,'prop',True),
    ('kenney-roads','dumpster',1.1,'prop',True),
    ('kenney-nature','tree_oak',4.7,'tree',True),
]:
    obj=import_model(pack,name,size,kind,height=height)
    if name=='electricity-wires':
        # File nguồn dùng cao độ tuyệt đối; đặt gốc mới ngay tại dây để bố trí lại theo mét.
        obj.rotation_euler.z=math.pi/2
    templates.append(obj)
templates.append(lantern())
parts=[cube('vending-body',(0,0,1.05),(1.0,.78,2.1),7,.06),face('vending-display',0,-.402,1.05,.94,1.98,vending_mat)]
parts.append(cube('vending-canopy',(0,-.04,2.14),(1.12,.9,.09),6,.025))
vending=join(parts,'vending-machine')
templates.append(vending)
for obj in templates:
    obj.location=(0,0,0)
    export([obj],PROCESSED/(obj.name+'.raw.glb'))

# Bố cục đạo cụ dùng lại trong Blender và R3F; tọa độ JSON là Y-up của glTF.
placements=[]
def place(name,x,y,z,rotation=0):
    placements.append(dict(model=name,position=[x,y,z],rotation=rotation))
for z in [-21.2,-10.6,0,10.6,21.2]:
    place('road-crossing' if z==0 else 'road-straight',0,-.18,z,math.pi/2)
for side in [-1,1]:
    for z in [-15,-7,1,9]:
        place('light-curved',side*5.45,0,z+2, -math.pi/2 if side>0 else math.pi/2)
        for dz in [-1.45,0,1.45]:
            place('lantern',side*5.72,2.5,z+dz)
    # Cột điện, dây điện và cây do scripts/build-street-decor.py dựng (cột bê tông kiểu Nhật, dây võng, anh đào).
for x,z,r in [(-5.8,-9.3,math.pi/2),(5.8,11.3,-math.pi/2)]:
    place('vending-machine',x,0,z,r)
for x,z in [(-11.3,-4.8),(11.3,3.2)]:
    place('dumpster',x,0,z)
(PUBLIC/'props/placements.json').write_text(json.dumps(placements,indent=2))
for template in templates:
    template.hide_render=True
    template.hide_set(True)
for item in placements:
    template=next(o for o in templates if o.name==item['model'])
    obj=bpy.data.objects.new(item['model']+'-instance',template.data)
    scene.collection.objects.link(obj)
    x,y,z=item['position']
    obj.location=(x,-z,y)
    obj.rotation_euler.z=item['rotation']

ground=cube('ground',(0,0,-.27),(75,75,.12),9)
export([ground],PROCESSED/'ground.raw.glb')

# Proxy va chạm chỉ để chỉnh sửa/kiểm tra trong Blender, không xuất cùng cảnh nhìn thấy.
collision_collection=bpy.data.collections.new('COLLISION / shared authoritative bounds')
scene.collection.children.link(collision_collection)
for block in LAYOUT:
    obj=cube('COLLIDER_'+block['id'],(block['x'],-block['z'],8),(block['halfWidth']*2,block['halfDepth']*2,16))
    for collection in list(obj.users_collection): collection.objects.unlink(obj)
    collision_collection.objects.link(obj)
    obj.display_type='WIRE'
    obj.hide_render=True
collision_collection.hide_render=True

scene.world=bpy.data.worlds.new('Sakura night')
scene.world.use_nodes=True
background=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND')
background.inputs[0].default_value=(.075,.045,.14,1)
background.inputs[1].default_value=.4
for name,loc,color,energy,size in [('Moon',(0,1,18),(.52,.67,1),2600,14),('Warm street',(-4,-2,10),(1,.47,.24),1100,9),('Neon',(5,8,8),(.8,.16,.5),900,8)]:
    data=bpy.data.lights.new(name,'AREA'); data.energy=energy; data.color=color; data.shape='DISK'; data.size=size
    obj=bpy.data.objects.new(name,data); scene.collection.objects.link(obj); obj.location=loc
cam_data=bpy.data.cameras.new('Street preview')
cam=bpy.data.objects.new('Street preview',cam_data);scene.collection.objects.link(cam)
cam.location=(2,-16,5.8)
cam.rotation_euler=(Vector((0,3,3.3))-cam.location).to_track_quat('-Z','Y').to_euler()
cam_data.lens=25
scene.camera=cam
scene.render.engine='CYCLES'
scene.cycles.samples=24
scene.render.resolution_x=1280;scene.render.resolution_y=800;scene.render.resolution_percentage=100
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(PROCESSED/'neon-sakura-street.blend'))
(PROCESSED/'used-sources.json').write_text(json.dumps(sorted(used_sources),indent=2))
print('SAKURA_EXPORT_COMPLETE',len(buildings),'buildings',len(placements),'prop placements')
