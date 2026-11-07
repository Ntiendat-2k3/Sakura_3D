"""Phục hồi bản Rosetta trình diễn của tác giả thành GLB có rig, biểu cảm và vật liệu dùng trong game."""
import bpy, math, json, hashlib, sys, runpy
from pathlib import Path
from mathutils import Vector, Quaternion
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT/'assets/source/characters/club-import/Rosetta/Render/Render.blend'
TARGET = ROOT/'assets/processed/rosetta-restored.glb'
def export_candidate():
    bpy.ops.export_scene.gltf(filepath=str(TARGET),export_format='GLB',use_selection=True,export_morph=True,export_animations=True,export_animation_mode='SCENE',export_frame_range=True,export_force_sampling=True,export_optimize_animation_size=True)
    return runpy.run_path(str(ROOT/'scripts/rosetta_materials.py'))['patch_rosetta_materials'](TARGET,merge_idle=True)

if '--reexport' in sys.argv:
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'assets/processed/rosetta-restored.blend'))
    root=bpy.data.objects['Rosetta_Render_Root']; root.rotation_euler.z=0
    bpy.context.view_layer.update()
    for material in bpy.data.materials:
        if not material.use_nodes: continue
        shader=next((node for node in material.node_tree.nodes if node.type=='BSDF_PRINCIPLED'),None)
        if shader and material.name in ['Face','Face_transparent','Skin','Neck','Eye_Left','Eye_Right','Hair','Costume_Main','Costume_Sub','Tail&Wing']:
            shader.inputs['Roughness'].default_value=.5; shader.inputs['Coat Weight'].default_value=0
            if material.name in ['Face','Face_transparent','Skin','Neck','Eye_Left','Eye_Right']: shader.inputs['Specular IOR Level'].default_value=.15
    policy=export_candidate()
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/processed/rosetta-restored.blend'))
    path=ROOT/'assets/processed/rosetta-restoration-manifest.json'; report=json.loads(path.read_text(encoding='utf8'))
    report.update(bytes=TARGET.stat().st_size,sha256=hashlib.sha256(TARGET.read_bytes()).hexdigest(),materialPolicy=policy)
    path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    print('Reexport completed',TARGET.stat().st_size,flush=True)
    sys.exit(0)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene = bpy.context.scene
names = ['Body','Body_main','Costume','Eye_decal','Hair','mouth_decal','Wing&Tail']
meshes = [bpy.data.objects[name] for name in names]
rig = bpy.data.objects['Armature']
for collection in bpy.data.collections: collection.hide_viewport=False; collection.hide_render=False
def enable(layer):
    layer.exclude=False; layer.hide_viewport=False
    for child in layer.children: enable(child)
enable(bpy.context.view_layer.layer_collection)
for obj in bpy.data.objects:
    obj.hide_set(False); obj.hide_viewport=False; obj.hide_render=obj not in meshes
    obj.select_set(False)
bpy.context.view_layer.update()

# Giữ tư thế đã được tác giả chỉnh, kể cả hướng đầu đang phụ thuộc constraint camera.
pose = {bone.name:bone.matrix.copy() for bone in rig.pose.bones}
for bone in rig.pose.bones:
    for constraint in list(bone.constraints): bone.constraints.remove(constraint)
for bone in rig.pose.bones: bone.matrix=pose[bone.name]
bpy.context.view_layer.update()

expression_report={}
for obj in meshes:
    keys=obj.data.shape_keys
    if not keys: continue
    expression_report[obj.name]={key.name:key.value for key in keys.key_blocks if key.value}
    original=np.empty(len(obj.data.vertices)*3,dtype=np.float32)
    keys.key_blocks[0].data.foreach_get('co',original)
    keep=['blink_left','blink_right'] if obj.name=='Body' else []
    deltas={}
    for name in keep:
        values=np.empty_like(original); keys.key_blocks[name].data.foreach_get('co',values)
        deltas[name]=values-original
    mixed=obj.shape_key_add(name='RenderExpression',from_mix=True)
    base=np.empty_like(original); mixed.data.foreach_get('co',base)
    for key in list(obj.data.shape_keys.key_blocks)[1:]: obj.shape_key_remove(key)
    obj.data.shape_keys.key_blocks[0].data.foreach_set('co',base)
    for name,delta in deltas.items(): obj.shape_key_add(name=name,from_mix=False).data.foreach_set('co',base+delta)
    if not keep: obj.shape_key_remove(obj.data.shape_keys.key_blocks[0])
    if obj.data.shape_keys: obj.data.shape_keys.animation_data_clear()

for obj in meshes:
    for polygon in obj.data.polygons: polygon.use_smooth=True
    for modifier in list(obj.modifiers):
        if modifier.type=='NODES': modifier.show_viewport=False; modifier.show_render=False
        if modifier.type=='SUBSURF':
            # Mái tóc cần đường viền mềm; phần thân/trang phục giữ topology gốc để hạn chế chi phí GPU.
            if obj.name=='Hair':
                modifier.levels=1; modifier.render_levels=1; modifier.show_viewport=True; modifier.show_render=True
                bpy.context.view_layer.objects.active=obj
                bpy.ops.object.modifier_apply(modifier=modifier.name)
            else: modifier.show_viewport=False; modifier.show_render=False

materials=list({material for obj in meshes for material in obj.data.materials})
material_report=[]
scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=1
scene.render.bake.margin=8; scene.render.bake.use_clear=True
bpy.ops.mesh.primitive_plane_add(size=2,location=(100,100,100))
plane=bpy.context.object; plane.name='AlbedoBakePlane'

def albedo_socket(material):
    tree=material.node_tree
    group=next((node for node in tree.nodes if node.type=='GROUP' and node.node_tree and node.node_tree.name.startswith('Skin')),None)
    if group: return group.inputs['Color']
    group=next((node for node in tree.nodes if node.type=='GROUP' and node.node_tree and node.node_tree.name.startswith('Diffuse')),None)
    if group:
        group.node_tree=group.node_tree.copy()
        group.node_tree.interface.new_socket(name='BakeAlbedo',in_out='OUTPUT',socket_type='NodeSocketColor')
        shader=next(node for node in group.node_tree.nodes if node.type=='BSDF_PRINCIPLED')
        output=next(node for node in group.node_tree.nodes if node.type=='GROUP_OUTPUT')
        if shader.inputs['Base Color'].is_linked: group.node_tree.links.new(shader.inputs['Base Color'].links[0].from_socket,output.inputs['BakeAlbedo'])
        return group.outputs['BakeAlbedo']
    shader=next((node for node in tree.nodes if node.type=='BSDF_PRINCIPLED'),None)
    return shader.inputs['Base Color'] if shader else None

for material in materials:
    tree=material.node_tree
    color=albedo_socket(material)
    if color is None: raise RuntimeError('Thiếu màu gốc của '+material.name)
    textured=any(node.type=='TEX_IMAGE' for node in tree.nodes)
    alpha_texture=next((node for node in tree.nodes if node.type=='TEX_IMAGE' and node.image),None) if material.name.startswith(('Face','Eye_')) else None
    color_image=None; alpha_image=None
    if textured:
        size=2048 if material.name in ['Face','Hair','Costume_Main','Costume_Sub'] else 1024
        color_image=bpy.data.images.new('Rosetta_'+material.name+'_Albedo',width=size,height=size,alpha=True)
        output=next(node for node in tree.nodes if node.type=='OUTPUT_MATERIAL')
        emission=tree.nodes.new('ShaderNodeEmission')
        if color.is_output: tree.links.new(color,emission.inputs['Color'])
        elif color.is_linked: tree.links.new(color.links[0].from_socket,emission.inputs['Color'])
        else: emission.inputs['Color'].default_value=color.default_value
        tree.links.new(emission.outputs[0],output.inputs['Surface'])
        target=tree.nodes.new('ShaderNodeTexImage'); target.image=color_image; tree.nodes.active=target
        plane.data.materials.clear(); plane.data.materials.append(material)
        bpy.ops.object.select_all(action='DESELECT'); plane.select_set(True); bpy.context.view_layer.objects.active=plane
        print('Bake albedo:',material.name,flush=True)
        bpy.ops.object.bake(type='EMIT')
        if alpha_texture:
            alpha_image=bpy.data.images.new('Rosetta_'+material.name+'_Alpha',width=size,height=size,alpha=True)
            target.image=alpha_image; tree.links.new(alpha_texture.outputs['Alpha'],emission.inputs['Color'])
            bpy.ops.object.bake(type='EMIT')
            rgba=np.empty(size*size*4,dtype=np.float32); alpha=np.empty_like(rgba)
            color_image.pixels.foreach_get(rgba); alpha_image.pixels.foreach_get(alpha)
            # Kênh bake alpha đi qua quản lý màu linear; sao chép giá trị RGB linear sang alpha dữ liệu.
            rgba[3::4]=alpha[0::4]; color_image.pixels.foreach_set(rgba)
            bpy.data.images.remove(alpha_image)
        color_image.pack()
    else:
        fixed_color=list(color.default_value)
    original_shader=next((node for node in tree.nodes if node.type=='BSDF_PRINCIPLED'),None)
    metallic=original_shader.inputs['Metallic'].default_value if original_shader else (0 if material.name!='Tights' else .15)
    roughness=original_shader.inputs['Roughness'].default_value if original_shader else .5
    coat=original_shader.inputs['Coat Weight'].default_value if original_shader else 0
    tree.nodes.clear(); output=tree.nodes.new('ShaderNodeOutputMaterial'); shader=tree.nodes.new('ShaderNodeBsdfPrincipled')
    shader.inputs['Metallic'].default_value=metallic; shader.inputs['Roughness'].default_value=roughness
    shader.inputs['Coat Weight'].default_value=coat
    if material.name in ['Face','Face_transparent','Skin','Neck','Eye_Left','Eye_Right']: shader.inputs['Specular IOR Level'].default_value=.15
    if color_image:
        image_node=tree.nodes.new('ShaderNodeTexImage'); image_node.image=color_image
        tree.links.new(image_node.outputs['Color'],shader.inputs['Base Color'])
        if alpha_texture: tree.links.new(image_node.outputs['Alpha'],shader.inputs['Alpha'])
    else: shader.inputs['Base Color'].default_value=fixed_color
    tree.links.new(shader.outputs[0],output.inputs['Surface']); material.use_backface_culling=False
    material_report.append({'name':material.name,'albedoSize':list(color_image.size) if color_image else None,'metallic':metallic,'roughness':roughness,'alpha':bool(alpha_texture),'sourceColorBaked':bool(color_image)})
bpy.data.objects.remove(plane,do_unlink=True)

# Đưa mẫu trưng bày về mét, hướng nhìn +Z glTF và chân tại gốc; giữ rig và parent inverse tác giả.
root=bpy.data.objects.new('Rosetta_Render_Root',None); scene.collection.objects.link(root)
world=rig.matrix_world.copy(); rig.parent=root; rig.matrix_world=world
root.rotation_euler.z=0
bpy.context.view_layer.update()
def bounds():
    points=[]; graph=bpy.context.evaluated_depsgraph_get()
    for obj in meshes:
        evaluated=obj.evaluated_get(graph)
        points.extend(evaluated.matrix_world@Vector(corner) for corner in evaluated.bound_box)
    return Vector(tuple(min(p[i] for p in points) for i in range(3))),Vector(tuple(max(p[i] for p in points) for i in range(3)))
lo,hi=bounds(); root.scale*=1.7/(hi.z-lo.z); bpy.context.view_layer.update()
lo,hi=bounds(); root.location-=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z)); bpy.context.view_layer.update()

rig.animation_data_clear(); scene.name='Rosetta_Render_Idle'; scene.render.fps=30; scene.frame_start=0; scene.frame_end=240
rest={bone.name:bone.matrix_basis.copy() for bone in rig.pose.bones}
for bone in rig.pose.bones: bone.rotation_mode='QUATERNION'
face=bpy.data.objects['Body']
for frame in range(0,241,2):
    scene.frame_set(frame); seconds=frame/30
    for name in ['Chest','Head','Hand.R']:
        bone=rig.pose.bones[name]; bone.matrix_basis=rest[name]
        amount=.009*math.sin(seconds*math.pi/2) if name!='Hand.R' else .025*math.sin(seconds*math.pi)
        bone.rotation_quaternion=bone.rotation_quaternion@Quaternion((0,1,0),amount)
        bone.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=name)
    blink=max(0,1-abs(seconds%4-3.6)/.12)
    for name in ['blink_left','blink_right']:
        key=face.data.shape_keys.key_blocks[name]; key.value=blink; key.keyframe_insert(data_path='value',frame=frame)
scene.frame_set(0)
for obj in bpy.data.objects: obj.select_set(False)
for obj in meshes+[rig,root]: obj.select_set(True)
bpy.context.view_layer.objects.active=rig
scene.render.engine='CYCLES'
material_policy=export_candidate()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/processed/rosetta-restored.blend'))
report={'source':str(SOURCE.relative_to(ROOT)),'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'candidate':str(TARGET.relative_to(ROOT)),'bytes':TARGET.stat().st_size,'sha256':hashlib.sha256(TARGET.read_bytes()).hexdigest(),'meshes':names,'expression':expression_report,'materials':material_report,'materialPolicy':material_policy,'animation':'Rosetta_Render_Idle','durationSeconds':8,'outfit':'Fixed original black/red costume; castoff excluded','license':'User supplied, local testing only; redistribution not verified'}
(ROOT/'assets/processed/rosetta-restoration-manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'candidateBytes':report['bytes'],'materials':len(material_report)}),flush=True)
