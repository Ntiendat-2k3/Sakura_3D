"""Chỉ đọc rig/material của Rosetta bản mặc trang phục; không sửa file tác giả."""
import bpy, json, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
render='--render' in sys.argv
bpy.ops.wm.open_mainfile(filepath=str(ROOT/('assets/source/characters/club-import/Rosetta/Render/Render.blend' if render else 'assets/source/characters/club-import/Rosetta/Model/Rosetta.blend')))
def describe_action(action):
    curves=[]
    if hasattr(action,'fcurves'): curves=list(action.fcurves)
    else:
        for layer in action.layers:
            for strip in layer.strips:
                for bag in getattr(strip,'channelbags',[]): curves.extend(bag.fcurves)
    frames=sorted({round(point.co.x,4) for curve in curves for point in curve.keyframe_points})
    return {'name':action.name,'frameRange':list(action.frame_range),'curveCount':len(curves),'keyframeCount':sum(len(curve.keyframe_points) for curve in curves),'uniqueFrames':frames[:120]}
result={
 'meshes':[{'name':o.name,'vertices':len(o.data.vertices),'hidden':o.hide_render,'collections':[c.name for c in o.users_collection],'materials':[m.name for m in o.data.materials],'armature':o.find_armature().name if o.find_armature() else None} for o in bpy.data.objects if o.type=='MESH'],
 'rigs':[{'name':o.name,'bones':list(o.data.bones.keys())} for o in bpy.data.objects if o.type=='ARMATURE'],
 'images':[{'name':i.name,'size':list(i.size),'packed':bool(i.packed_file),'filepath':i.filepath} for i in bpy.data.images],
 'materials':[{'name':m.name,'nodes':[(n.type,n.name) for n in m.node_tree.nodes] if m.use_nodes else []} for m in bpy.data.materials],
 'actions':[describe_action(a) for a in bpy.data.actions],
 'scenes':[{'name':s.name,'frame':s.frame_current,'start':s.frame_start,'end':s.frame_end,'camera':s.camera.name if s.camera else None,'markers':[{'name':m.name,'frame':m.frame} for m in s.timeline_markers]} for s in bpy.data.scenes],
 'objects':[{'name':o.name,'type':o.type,'action':o.animation_data.action.name if o.animation_data and o.animation_data.action else None,'nlaTracks':len(o.animation_data.nla_tracks) if o.animation_data else 0,'shapeKeys':list(o.data.shape_keys.key_blocks.keys()) if o.type=='MESH' and o.data.shape_keys else []} for o in bpy.data.objects if o.type in ['ARMATURE','MESH','CAMERA']],
 'armRest':[{ 'name':b.name,'head':list(b.head_local),'tail':list(b.tail_local)} for o in bpy.data.objects if o.type=='ARMATURE' for b in o.data.bones if b.name in ['Hips','Head','Upper Arm.R','Lower Arm.R','Hand.R','Upper Arm.L','Lower Arm.L']],
 'instances':[{'name':o.name,'collection':o.instance_collection.name} for o in bpy.data.objects if o.instance_collection]
}
(ROOT/('assets/processed/rosetta-render-inspection.json' if render else 'assets/processed/greeter-inspection.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'meshes':len(result['meshes']),'rigs':len(result['rigs']),'images':len(result['images'])}))
