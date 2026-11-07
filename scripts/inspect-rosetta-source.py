"""Kiểm kê rig, vật liệu và pose Rosetta từ bản Blender nguồn."""
import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root/'assets/source/characters/club-import/Rosetta/Render/Render.blend'))
def val(v):
 try:return list(v)
 except TypeError:return v if isinstance(v,(str,float,int,bool)) else str(v)
def nodes(tree,depth=0):
 return [{'name':n.name,'type':n.type,'image':n.image.name if n.type=='TEX_IMAGE' and n.image else None,'group':n.node_tree.name if n.type=='GROUP' and n.node_tree else None,'inputs':{s.name:{'value':val(s.default_value) if hasattr(s,'default_value') else None,'links':[(l.from_node.name,l.from_socket.name) for l in s.links]} for s in n.inputs},'children':nodes(n.node_tree,depth+1) if n.type=='GROUP' and n.node_tree and depth<2 else []} for n in tree.nodes]
r={'objects':[{'name':o.name,'type':o.type,'hidden':o.hide_render,'location':list(o.location),'rotation':list(o.rotation_euler),'scale':list(o.scale),'parent':o.parent.name if o.parent else None,'parentType':o.parent_type,'parentBone':o.parent_bone,'rig':o.find_armature().name if o.type=='MESH' and o.find_armature() else None,'materials':[m.name for m in o.data.materials] if o.type=='MESH' else [],'vertices':len(o.data.vertices) if o.type=='MESH' else 0,'modifiers':[(m.name,m.type,m.show_render,m.show_viewport) for m in o.modifiers],'shapeValues':{k.name:k.value for k in o.data.shape_keys.key_blocks if k.value!=0} if o.type=='MESH' and o.data.shape_keys else {}} for o in bpy.data.objects], 'rigs':[{'name':o.name,'bones':len(o.pose.bones),'constraints':[(b.name,[(c.name,c.type) for c in b.constraints]) for b in o.pose.bones if b.constraints],'pose':{b.name:{'location':list(b.location),'rotation':list(b.rotation_quaternion),'mode':b.rotation_mode,'euler':list(b.rotation_euler),'scale':list(b.scale)} for b in o.pose.bones if b.matrix_basis!=__import__('mathutils').Matrix.Identity(4)}} for o in bpy.data.objects if o.type=='ARMATURE'], 'materials':[{ 'name':m.name,'nodes':nodes(m.node_tree) if m.use_nodes else []} for m in bpy.data.materials], 'images':[{'name':i.name,'size':list(i.size),'packed':bool(i.packed_file),'path':i.filepath} for i in bpy.data.images]}
(root/'assets/processed/rosetta-source-detail.json').write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf8')
print('Inspect source completed')
