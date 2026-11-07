"""Nâng cấp console từ model CC0 có sẵn và tạo dây treo cho lồng đèn, giữ nguyên các scene nguồn."""
import bpy, json, math
from pathlib import Path
from mathutils import Vector
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.render.fps=30
OUT=ROOT/'apps/web/public/assets/props/club/dj-rio-console.glb'

def mat(name,color,metal=0,rough=.4,emission=0):
    material=bpy.data.materials.new(name); material.use_nodes=True
    p=material.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1); p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
    p.inputs['Emission Color'].default_value=(*color,1); p.inputs['Emission Strength'].default_value=emission
    return material

metal=mat('Rio / brushed graphite',(.035,.045,.065),.8,.34)
gold=mat('Rio / champagne trim',(.55,.3,.09),.8,.3)
pink=mat('Rio / magenta emissive',(.9,.025,.19),.2,.3,2)
blue=mat('Rio / cyan emissive',(.025,.55,.85),.2,.3,1.7)
black=mat('Rio / smoked display',(.005,.012,.025),.35,.2)
# Texture kim loại thật được nhúng trong GLB; không đưa Noise shader không được glTF hỗ trợ vào runtime.
image=bpy.data.images.new('Rio brushed metal',width=256,height=256)
rng=np.random.default_rng(19); grain=rng.uniform(.7,1,(256,1,1))*np.ones((1,256,1)); pixels=np.ones((256,256,4),dtype=np.float32)
pixels[:,:,:3]=grain*np.array([.035,.045,.065]); image.pixels.foreach_set(pixels.ravel()); image.pack()
node=metal.node_tree.nodes.new('ShaderNodeTexImage'); node.image=image
uv_node=metal.node_tree.nodes.new('ShaderNodeUVMap'); uv_node.uv_map='UVMap'; metal.node_tree.links.new(uv_node.outputs['UV'],node.inputs['Vector'])
metal.node_tree.links.new(node.outputs['Color'],metal.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])

def box(name,pos,size,material,bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=(pos[0],-pos[2],pos[1]))
    obj=bpy.context.object; obj.name=name; obj.dimensions=(size[0],size[2],size[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=obj.modifiers.new('Bo cạnh gia công','BEVEL'); mod.width=bevel; mod.segments=3; bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.materials.append(material); return obj

def import_asset(asset_id,name,pos=(0,0,0),dimensions=None):
    before=set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=str(ROOT/f'assets/source/club-lighting/{asset_id}.glb'))
    imported=list(set(bpy.data.objects)-before)
    for obj in imported: obj.animation_data_clear()
    roots=[o for o in imported if o.parent not in imported]
    parent=bpy.data.objects.new(name,None); scene.collection.objects.link(parent)
    for obj in roots: obj.parent=parent
    bpy.context.view_layer.update()
    if dimensions:
        pts=[o.matrix_world@Vector(c) for o in imported if o.type=='MESH' for c in o.bound_box]
        lo=Vector(tuple(min(v[i] for v in pts) for i in range(3))); hi=Vector(tuple(max(v[i] for v in pts) for i in range(3)))
        parent.scale=(dimensions[0]/(hi.x-lo.x),dimensions[2]/(hi.y-lo.y),dimensions[1]/(hi.z-lo.z))
    parent.location=(pos[0],-pos[2],pos[1]); return imported

base=import_asset('34089','Rio / console base',dimensions=(3,.89,1.3))
for obj in base:
    if obj.type=='MESH': obj.data.materials.clear(); obj.data.materials.append(metal)
for side in [-1,1]:
    deck=import_asset('34088',f'Rio / deck {side}',(side*.45,.9,-.45))
    platter=next(o for o in deck if o.name.startswith('platter') and o.type=='EMPTY') if any(o.name.startswith('platter') and o.type=='EMPTY' for o in deck) else next(o for o in deck if o.name.startswith('platter'))
    platter.rotation_mode='XYZ'; start=platter.rotation_euler.z
    for frame,rotation in [(0,start),(120,start-math.tau)]: platter.rotation_euler.z=rotation; platter.keyframe_insert('rotation_euler',index=2,frame=frame)
    platter.rotation_euler.z=start
    box(f'Rio / deck display {side}',(side*.45,1.11,-.12),(.38,.19,.035),black,.012)
    for n in range(18):
        height=.025+.07*(.5+.5*math.sin(n*.8+side))
        box('Rio / waveform',(side*.45-.16+n*.019,1.11,-.096),(.008,height,.003),blue if side<0 else pink,.001)
import_asset('34090','Rio / four-channel mixer',(0,.93,-.45),dimensions=(.4,.11,.4))
for side in [-1,1]:
    box('Rio / side cheek',(side*1.5,.57,0),(.08,.68,1.3),gold,.035)
    box('Rio / top trim',(side*1.15,.9,.25),(.06,.025,.65),gold,.01)
for y in [.22,.78]: box('Rio / front light rail',(0,y,.656),(2.93,.025,.02),pink,.008)
box('Rio / front display',(0,.5,.66),(2.75,.43,.025),black,.025)
for n in range(38):
    height=.06+.18*(.5+.5*math.sin(n*.72))
    box('Rio / front spectrum',(-1.3+n*.07,.48,.68),(.025,height,.01),blue if n%4 else pink,.005)
bpy.ops.object.text_add(location=(0,-.697,.55),rotation=(math.pi/2,0,0))
label=bpy.context.object; label.name='Rio / engraved DJ name'; label.data.body='DJ RIO'; label.data.align_x='CENTER'; label.data.size=.2; label.data.extrude=.002; label.data.materials.append(gold)
bpy.ops.object.convert(target='MESH')
for side in [-1,1]:
    box('Rio / monitor stand',(side*.95,1.04,.24),(.08,.3,.08),metal)
    box('Rio / nearfield monitor',(side*.95,1.25,.24),(.28,.3,.23),metal,.04)
    bpy.ops.mesh.primitive_torus_add(major_radius=.085,minor_radius=.012,major_segments=24,minor_segments=8,location=(side*.95,-.37,1.25),rotation=(math.pi/2,0,0))
    bpy.context.object.name='Rio / monitor woofer ring'; bpy.context.object.data.materials.append(gold)

scene.frame_set(0)
# Gộp phần tĩnh theo material; giữ riêng các platter có animation và con của chúng.
groups={}
for obj in list(scene.objects):
    parent=obj; moving=False
    while parent:
        if parent.animation_data and parent.animation_data.action: moving=True; break
        parent=parent.parent
    if obj.type=='MESH' and not moving:
        key=tuple(material.name for material in obj.data.materials)
        groups.setdefault(key,[]).append(obj)
for meshes in groups.values():
    if len(meshes)<2: continue
    bpy.ops.object.select_all(action='DESELECT')
    for obj in meshes: obj.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]; bpy.ops.object.join()
# Các mesh nhập có tên UV khác nhau; chuẩn hóa một UVMap trước khi material kim loại dùng chung được xuất.
for obj in list(scene.objects):
    if obj.type!='MESH':continue
    while obj.data.uv_layers:obj.data.uv_layers.remove(obj.data.uv_layers[0])
    obj.data.uv_layers.new(name='UVMap');obj.data.uv_layers.active_index=0;obj.data.uv_layers[0].active_render=True
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.015);bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_frame_range=False,export_nla_strips=False)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/processed/dj-rio-console.blend'))

# Pipeline đèn phố tách riêng để chỉnh vị trí treo mà không phải dựng lại console.
import runpy
runpy.run_path(str(ROOT/'scripts/build-street-lanterns.py'),run_name='__main__')
print(json.dumps({'console':str(OUT.relative_to(ROOT)),'sources':['34089','34088','34090'],'license':'CC0 source assets, original project additions'}))
