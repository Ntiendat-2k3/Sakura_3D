"""Dựng cột gá và tay đỡ cao hai bên phố; giữ giữa đường thoáng và tái sử dụng material gỗ atlas hiện có."""
import bpy,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
layout=json.loads((ROOT/'apps/web/game/scenes/street-lantern-layout.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
with bpy.data.libraries.load(str(ROOT/'assets/processed/neon-sakura-street.blend'),link=False) as (source,target):
    target.materials=['Sakura / stone wood glass metal fabric']
wood=bpy.data.materials.get('Sakura / stone wood glass metal fabric')
if not wood:raise RuntimeError('Thiếu atlas gỗ của phố')
def material(name,color,metal):
    mat=bpy.data.materials.new(name);mat.use_nodes=True;p=mat.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=.43;return mat
iron=material('Sakura / lantern iron',(.035,.018,.025),.7)
gold=material('Sakura / lantern brass',(.46,.24,.065),.8)
def box(name,position,size,mat):
    bpy.ops.mesh.primitive_cube_add(size=1,location=(position[0],-position[2],position[1]))
    obj=bpy.context.object;obj.name=name;obj.dimensions=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bevel=obj.modifiers.new('Mép gỗ bo nhẹ','BEVEL');bevel.width=.018;bevel.segments=2;bpy.ops.object.modifier_apply(modifier=bevel.name)
    obj.data.materials.append(mat)
    uv=obj.data.uv_layers.active
    for value in uv.data:value.uv=((2+.03+value.uv.x*.94)/4,(3+.03+value.uv.y*.94)/4)
    return obj
def bar(name,a,b,width,mat):
    av=Vector((a[0],-a[2],a[1]));bv=Vector((b[0],-b[2],b[1]));delta=bv-av
    obj=box(name,(0,0,0),(width,delta.length,width),mat);obj.location=(av+bv)/2;obj.rotation_euler=delta.to_track_quat('Z','Y').to_euler();return obj
b=layout['bracket']
for z in layout['rows']:
    for side in [-1,1]:
        wall=side*b['wallX'];tip=side*b['tipX'];mid=(wall+tip)/2
        box('Lantern / wall post',(wall,(b['postBottomY']+b['postTopY'])/2,z),(.22,b['postTopY']-b['postBottomY'],.26),wood)
        box('Lantern / cantilever arm',(mid,b['beamY'],z),(abs(wall-tip)+.2,.16,.22),wood)
        bar('Lantern / diagonal brace',(wall,b['postBottomY']+.18,z),(side*(b['tipX']+.45),b['beamY']-.08,z),.105,wood)
        for y in [b['postBottomY']+.12,b['beamY']-.25]:box('Lantern / brass band',(wall,y,z),(.25,.055,.29),gold)
        box('Lantern / ornamental end',(tip,b['beamY']+.1,z),(.16,.24,.25),wood)
        bar('Lantern / hanging rail',(tip,layout['anchorY'],z),(wall,layout['anchorY'],z),.022,iron)
        for x in layout['lanternX']:
            if x*side>0:box('Lantern / suspension clamp',(x,layout['anchorY']+.04,z),(.045,.1,.07),gold)
# Các đèn mặt tiền cũ cũng nâng cao; móc được đặt đúng tọa độ dây cũ sau khi nâng.
original=json.loads((ROOT/'apps/web/public/assets/props/placements.json').read_text())
for item in original:
    if item['model']!='lantern':continue
    x,_,z=item['position'];side=1 if x>0 else -1;y=layout['facadeBaseY']+layout['cordTop']
    bar('Lantern / facade hook',(x+side*.22,y+.08,z),(x,y,z),.035,iron)
for mat in [wood,iron,gold]:
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and mat in list(o.data.materials)]
    bpy.ops.object.select_all(action='DESELECT')
    for obj in meshes:obj.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join()
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(ROOT/'apps/web/public/assets/props/lantern-garlands.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/processed/street-lantern-garlands.blend'))
print(json.dumps({'newLanterns':len(layout['rows'])*len(layout['lanternX']),'bottomY':layout['anchorY']-layout['cordTop'],'facadeBottomY':layout['facadeBaseY'],'mounts':len(layout['rows'])*2,'centerClearWidth':min(abs(x) for x in layout['lanternX'])*2-.6}))
