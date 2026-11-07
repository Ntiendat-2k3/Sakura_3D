"""Render kiểm tra GLB Rosetta bằng Blender CLI, không mở trình duyệt hoặc sửa file nguồn."""
import bpy, math, json, hashlib, sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
dance='--dance' in sys.argv
restored='--restored' in sys.argv
portrait='--portrait' in sys.argv
definition=json.loads((ROOT/'apps/web/game/entities/club-npcs.json').read_text(encoding='utf8'))['rosetta']
runtime=ROOT/('assets/processed/rosetta-restored.glb' if restored else 'assets/processed/rosetta-dance-preview.glb' if dance else 'apps/web/public'+definition['url'])
stem='rosetta-restored-offline-preview' if restored else 'rosetta-dance-offline-preview' if dance else 'rosetta-offline-preview'
if portrait: stem+='-portrait'
bpy.ops.wm.read_factory_settings(use_empty=True)
for obj in list(bpy.data.objects): bpy.data.objects.remove(obj,do_unlink=True)
bpy.ops.import_scene.gltf(filepath=str(runtime))
for obj in bpy.context.scene.objects:
    if obj.type=='ARMATURE':
        action=next((item for item in bpy.data.actions if ('Rosetta_GentleSwayingDancing' if dance else 'Rosetta_Render_Idle') in item.name),None)
        if action:
            obj.animation_data_create(); obj.animation_data.action=action
            if action.slots: obj.animation_data.action_slot=action.slots[0]
scene=bpy.context.scene; scene.frame_set(25)
meshes=[obj for obj in scene.objects if obj.type=='MESH' and obj.find_armature() is not None]
points=[obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
lo=Vector(tuple(min(p[i] for p in points) for i in range(3))); hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
center=(lo+hi)/2; height=hi.z-lo.z
if portrait: center.z=lo.z+height*.82; height*=.45
bpy.ops.object.camera_add(location=center+Vector((0 if restored else height*.8,-height*2.2,height*.3)))
camera=bpy.context.object; camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler(); camera.data.type='ORTHO'; camera.data.ortho_scale=height*1.25; scene.camera=camera
for location,power in [((height,-height,height*2),500),((-height,-height*.2,height),300)]:
    bpy.ops.object.light_add(type='AREA',location=location); light=bpy.context.object; light.data.energy=power; light.data.shape='DISK'; light.data.size=height
    light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
scene.world=bpy.data.worlds.new('Kiểm tra asset'); scene.world.use_nodes=True
background=next(node for node in scene.world.node_tree.nodes if node.type=='BACKGROUND'); background.inputs['Color'].default_value=(.09,.09,.12,1); background.inputs['Strength'].default_value=.5
scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=32 if restored else 8
scene.cycles.use_denoising=restored
scene.render.resolution_x=460; scene.render.resolution_y=680; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(ROOT/f'test-results/screenshots/{stem}.png')
report={'meshCount':len(meshes),'meshNames':[obj.name for obj in meshes],'height':height,'bounds':[list(lo),list(hi)],'animationActions':[a.name for a in bpy.data.actions],'runtimeSha256':hashlib.sha256(runtime.read_bytes()).hexdigest(),'browserTest':False}
(ROOT/('assets/processed/rosetta-restored-validation.json' if restored else 'assets/processed/rosetta-dance-validation.json' if dance else 'assets/processed/rosetta-export-validation.json')).write_text(json.dumps(report,indent=2),encoding='utf8')
bpy.ops.render.render(write_still=True)
if restored and '--both' in sys.argv:
    height=hi.z-lo.z; center=(lo+hi)/2; center.z=lo.z+height*.79
    for obj in scene.objects:
        if obj.type=='ARMATURE' and 'Head' in obj.pose.bones:
            head=obj.matrix_world@obj.pose.bones['Head'].head
            center.x=head.x; center.y=head.y
            break
    camera.location=center+Vector((0,-height*2.2,height*.1))
    camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale=height*.6
    scene.render.filepath=str(ROOT/'test-results/screenshots/rosetta-restored-offline-preview-portrait.png')
    bpy.ops.render.render(write_still=True)
