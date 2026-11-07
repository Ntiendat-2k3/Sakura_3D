"""Ghép dây/lồng đèn thật vào bản sao phố và render offline, không thay file scene nguồn."""
import bpy,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/processed/neon-sakura-street.blend'))
scene=bpy.context.scene
layout=json.loads((ROOT/'apps/web/game/scenes/street-lantern-layout.json').read_text())
lifted=0
for obj in list(scene.objects):
    if obj.type=='MESH' and abs(abs(obj.location.x)-5.72)<.02 and abs(obj.location.z-2.5)<.02:
        obj.location.z=layout['facadeBaseY'];lifted+=1
    if obj.type=='MESH' and obj.name.startswith('road-'):
        obj.data=obj.data.copy()
        for i,material in enumerate(obj.data.materials):
            wet=material.copy();obj.data.materials[i]=wet
            p=wet.node_tree.nodes.get('Principled BSDF')
            if not p:continue
            rough=p.inputs['Roughness']
            if rough.is_linked:
                source=rough.links[0].from_socket;node=wet.node_tree.nodes.new('ShaderNodeMath');node.operation='MULTIPLY';node.inputs[1].default_value=layout['road']['roughness'];wet.node_tree.links.new(source,node.inputs[0]);wet.node_tree.links.new(node.outputs[0],rough)
            else:rough.default_value=layout['road']['roughness']
bpy.ops.import_scene.gltf(filepath=str(ROOT/'apps/web/public/assets/props/lantern-garlands.glb'))
before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(ROOT/'apps/web/public/assets/props/lantern.glb'))
templates=list(set(bpy.data.objects)-before)
bpy.context.view_layer.update()
for z in layout['rows']:
    for x in layout['lanternX']:
        y=layout['anchorY']-layout['cordTop']
        for template in templates:
            if template.type!='MESH':continue
            obj=template.copy();obj.data=template.data;scene.collection.objects.link(obj);obj.parent=None;obj.matrix_world=template.matrix_world.copy();obj.location+=Vector((x,-z,y))
for obj in templates:bpy.data.objects.remove(obj,do_unlink=True)
for material in bpy.data.materials:
    if 'warm ribbed paper' not in material.name or not material.use_nodes:continue
    p=material.node_tree.nodes.get('Principled BSDF')
    if p:p.inputs['Base Color'].default_value=(.435,.0033,.013,1);p.inputs['Emission Color'].default_value=(1,.0024,.014,1);p.inputs['Emission Strength'].default_value=.55
for z in layout['lightRows']:
    for side in [-1,1]:
        bpy.ops.object.light_add(type='SPOT',location=(side*layout['light']['x'],-z,layout['light']['height']));light=bpy.context.object
        light.data.color=(1,.018,.04);light.data.energy=260;light.data.spot_size=layout['light']['angle']*2;light.data.spot_blend=1;light.data.shadow_soft_size=.5
        target=Vector((side*layout['light']['targetX'],-z,.02));light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
scene.world=bpy.data.worlds.new('Sakura / night preview');scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.12
bpy.ops.object.light_add(type='AREA',location=(0,-3,13));light=bpy.context.object;light.data.energy=600;light.data.color=(.27,.36,.65);light.data.size=16
bpy.ops.object.camera_add(location=(1.5,-18,3.1));camera=bpy.context.object;camera.rotation_euler=(Vector((0,6,4.1))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.lens=22;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.cycles.use_denoising=True
scene.render.resolution_x=1080;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ROOT/'test-results/screenshots/street-raised-lanterns-offline.png')
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/processed/street-red-lanterns-preview.blend'))
bpy.ops.render.render(write_still=True)
print(json.dumps({'extraLanterns':len(layout['rows'])*len(layout['lanternX']),'oldLanternsRaised':lifted,'bottomY':layout['anchorY']-layout['cordTop'],'browser':False}))
