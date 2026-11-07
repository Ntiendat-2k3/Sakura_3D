"""Dựng nội thất club tối thiểu trong Blender bằng vật liệu atlas hiện có; giữ riêng scene phố."""
import bpy, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/processed/neon-sakura-street.blend'))
surface=bpy.data.materials.get('Sakura / stone wood glass metal fabric')
if not surface: raise RuntimeError('Missing shared material')
for obj in list(bpy.data.objects): bpy.data.objects.remove(obj,do_unlink=True)
items=[]

def material(name,color,emission=0):
    mat=bpy.data.materials.new(name);mat.use_nodes=True
    node=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    node.inputs['Base Color'].default_value=(*color,1)
    node.inputs['Roughness'].default_value=.45
    node.inputs['Emission Color'].default_value=(*color,1)
    node.inputs['Emission Strength'].default_value=emission
    return mat
pink=material('Club / rose light',(1,.06,.3),2)
cyan=material('Club / cyan light',(.05,.65,1),2)
dark=material('Club / acoustic velvet',(.045,.02,.075))

def box(name,position,size,tile=14,mat=None,bevel=.04):
    x,y,z=position;w,h,d=size
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y))
    obj=bpy.context.object;obj.name=name;obj.dimensions=(w,d,h)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=obj.modifiers.new('Rounded edges','BEVEL');mod.width=bevel;mod.segments=2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.materials.clear();obj.data.materials.append(mat or surface)
    if not mat:
        uv=obj.data.uv_layers.active
        for point in uv.data:
            u,v=point.uv
            point.uv=((tile%4+.01+u*.98)/4,(3-tile//4+.01+v*.98)/4)
    items.append(obj)
    return obj

box('dance-floor',(0,-.13,0),(16,.24,16),3)
box('back-wall',(0,2.7,-8),(16,5.6,.25),2)
for side in [-1,1]:
    box('side-wall',(side*8,2.7,0),(.25,5.6,16),0)
    box('front-wall',(side*4.9,1.3,7.9),(6.2,2.6,.2),2)
    box('door-gold-jamb',(side*1.6,1.6,7.8),(.12,3.2,.2),6)
    for z in [-5,-2,1,4,7]:
        box('wall-pilaster',(side*7.8,2.1,z),(.18,4.2,.18),6)
    box('wall-neon',(side*7.78,4.5,0),(.09,.08,15),mat=pink if side<0 else cyan)
box('stage',(0,.38,-5.65),(11,.76,4.3),14,bevel=.12)
box('stage-gold-front',(0,.52,-3.5),(10.9,.07,.08),6)
box('stage-neon-front',(0,.15,-3.48),(10.7,.05,.06),mat=pink)
box('backdrop',(0,2.5,-7.75),(10,3.4,.12),mat=dark)
for i in range(11):
    box('backdrop-rib',(-4.6+i*.92,2.5,-7.65),(.09,3.35,.13),6)
for x in [-4.7,4.7]:
    box('speaker',(x,1.55,-6.8),(1.0,1.6,.8),14,bevel=.08)
    for y in [1.2,1.9]:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=.3,location=(x,6.35,y))
        obj=bpy.context.object;obj.name='speaker-cone';obj.scale=(1,.14,1);obj.data.materials.append(dark);items.append(obj)
box('bar-counter',(-6.9,.65,0),(1.5,1.3,6.4),2,bevel=.08)
box('bar-gold-top',(-6.9,1.35,0),(1.7,.15,6.5),6)
box('bar-glow',(-6.08,.65,0),(.04,.06,6.2),mat=cyan)
for z in [-2.1,0,2.1]:
    box('sofa-seat',(6.9,.43,z),(1.5,.7,1.8),14,bevel=.16)
    box('sofa-back',(7.5,.95,z),(.3,.9,1.8),7,bevel=.12)
    for dz in [-.85,.85]: box('sofa-arm',(6.9,.8,z+dz),(1.5,.5,.15),6)
for x in [-4,-2,0,2,4]:
    box('ceiling-truss',(x,5,-2),(.07,.1,10),6)
    box('ceiling-tube',(x,4.95,-2),(.08,.05,7.5),mat=pink if x%4 else cyan)
for i in range(6):
    for j in range(4):
        box('floor-inlay',(-4.5+i*1.8,.004,-2+j*1.8),(1.65,.012,1.65),8,bevel=0)

bpy.ops.object.select_all(action='DESELECT')
for obj in items: obj.select_set(True)
bpy.context.view_layer.objects.active=items[0]
bpy.ops.export_scene.gltf(filepath=str(ROOT/'assets/processed/denmu-club.raw.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
scene=bpy.context.scene
data=bpy.data.cameras.new('Club preview');cam=bpy.data.objects.new('Club preview',data);scene.collection.objects.link(cam)
cam.location=(0,-10,5);cam.rotation_euler=(Vector((0,4,2))-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam;data.lens=24
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/processed/denmu-club.blend'))
print('CLUB_EXPORT_COMPLETE',len(items))
