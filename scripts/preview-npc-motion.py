"""Render hai pha chuyển động từ GLB chẩn đoán thật, giữ camera cố định và không mở trình duyệt."""
import bpy, sys, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
host='--host' in sys.argv
dj='--dj' in sys.argv
dancer=next((arg.split('=',1)[1] for arg in sys.argv if arg.startswith('--dance=')),None)
player=next((arg.split('=',1)[1] for arg in sys.argv if arg.startswith('--player-flair=')),None)
if player and player not in json.loads((ROOT/'packages/game-protocol/src/player-characters.json').read_text(encoding='utf8')): raise ValueError('Nhân vật không hợp lệ')
if dancer not in (None,'wine','pop','rosetta'): raise ValueError('NPC không hợp lệ')
name='dj-rio' if dj else f'{dancer}-user-dance' if dancer else 'galaxy-walk' if host else 'rosetta-greeting'
if player: name=f'{player}-flair'
frames=[30,150] if dj else {'wine':[45,210],'pop':[18,75],'rosetta':[30,150]}[dancer] if dancer else [37,54] if host else [30,120]
if player: frames=[2,16]
bpy.ops.wm.read_factory_settings(use_empty=True)
for obj in list(bpy.data.objects): bpy.data.objects.remove(obj,do_unlink=True)
scene=bpy.context.scene; scene.render.fps=30
bpy.ops.import_scene.gltf(filepath=str(ROOT/f'assets/processed/{name}-preview.glb'))
if player:
    for obj in list(scene.objects):
        if obj.name=='guitar': bpy.data.objects.remove(obj,do_unlink=True)
meshes=[o for o in scene.objects if o.type=='MESH' and o.find_armature()]
if dj:
    before=set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=str(ROOT/'apps/web/public/assets/props/club/dj-rio-console.glb'))
    imported=list(set(bpy.data.objects)-before); pos=json.loads((ROOT/'packages/game-protocol/src/club-dj-layout.json').read_text())['booth']['position']
    for obj in imported:
        if obj.parent not in imported: obj.location+=Vector((pos[0],-pos[2],pos[1]))
    meshes.extend(o for o in imported if o.type=='MESH')
points=[]
for frame in frames:
    scene.frame_set(frame); bpy.context.view_layer.update(); graph=bpy.context.evaluated_depsgraph_get()
    for obj in meshes:
        evaluated=obj.evaluated_get(graph); points.extend(evaluated.matrix_world@Vector(c) for c in evaluated.bound_box)
lo=Vector(tuple(min(p[i] for p in points) for i in range(3))); hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
center=(lo+hi)/2; height=hi.z-lo.z; direction=1 if host else -1
bpy.ops.mesh.primitive_plane_add(size=height*5,location=(center.x,center.y,.766 if dj else .082 if host else -.004))
ground=bpy.context.object; ground.name='Sàn kiểm tra'; material=bpy.data.materials.new('Mặt sàn'); material.diffuse_color=(.075,.065,.095,1); ground.data.materials.append(material)
bpy.ops.object.camera_add(location=center+Vector((height*.55 if dj else height*.4 if host else 0,direction*height*2.7,height*.5 if dj else height*.12)))
camera=bpy.context.object; camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler(); camera.data.type='ORTHO'; camera.data.ortho_scale=height*1.15; scene.camera=camera
if dj: camera.data.ortho_scale=max(height*1.2,(hi.x-lo.x)/1.333*1.18)
if player: camera.data.ortho_scale=max(height*1.2,(hi.x-lo.x)/(.666)*1.2)
for offset,power in [((height,direction*height,height*1.6),500),((-height,direction*height*.5,height),350)]:
    bpy.ops.object.light_add(type='AREA',location=center+Vector(offset)); light=bpy.context.object; light.data.energy=power; light.data.size=height
    light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
scene.world=bpy.data.worlds.new('Ánh sáng kiểm tra'); scene.world.use_nodes=True
background=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND'); background.inputs['Color'].default_value=(.09,.09,.12,1); background.inputs['Strength'].default_value=.5
scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=24; scene.cycles.use_denoising=True
scene.render.resolution_x=960 if dj else 480; scene.render.resolution_y=720; scene.render.resolution_percentage=100; scene.render.image_settings.file_format='PNG'
if dj:
    for location,color,power in [((0,4.8,4.5),(1,.75,.55),200),((1.5,7.3,3.7),(1,.15,.5),100)]:
        bpy.ops.object.light_add(type='AREA',location=location); light=bpy.context.object; light.data.color=color; light.data.energy=power; light.data.size=2
        light.rotation_euler=(Vector((0,7.35,2.05))-light.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.file.pack_all(); bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/processed/dj-rio-stage-preview.blend'))
if player:
    scene.frame_start=0; scene.frame_end=28
    bpy.ops.file.pack_all(); bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/f'assets/processed/{name}-preview.blend'))
for frame in frames:
    scene.frame_set(frame); scene.render.filepath=str(ROOT/f'test-results/screenshots/{name}-{frame}-offline.png'); bpy.ops.render.render(write_still=True)
print(json.dumps({'source':name,'frames':frames,'browser':False}))
