"""Chuẩn hóa bộ mẫu figure, tạo chuyển động trên rig gốc và xuất GLB/ảnh chọn cho người chơi."""
import hashlib
import json
import math
import re
import sys
import subprocess
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parents[1]
CHARACTER = next((arg.split('=', 1)[1] for arg in sys.argv if arg.startswith('--character=')), 'bocchi')
CATALOG = json.loads((ROOT / 'packages/game-protocol/src/player-characters.json').read_text(encoding='utf8'))
SOURCE_ROOT = ROOT / 'assets/source/characters/figure'
SOURCES = {name: SOURCE_ROOT / path for name, path in {
    'bocchi': 'gotou_booth/bocchi.blend', 'kita': 'kita/kita dl.blend', 'ryo': 'ryo model/ryo.blend',
    'ubel': 'ubelllll/ubel.blend', 'miorine': 'miorine/mio mio booth.fbx',
    'nijika': 'nijika/nijika.blend', 'serie': 'booth_serie/serie.blend'}.items()}
SOURCES['yui'] = ROOT / 'assets/processed/unity/yui/Assets/YUI/FBX/YUI_1.fbx'
RECONSTRUCTED = {'airi', 'annie', 'kuroki'}
for identity in RECONSTRUCTED: SOURCES[identity] = ROOT / f'assets/processed/reconstructed/{identity}-source.blend'
SOURCES['mint'] = ROOT / 'assets/processed/mint-source.blend'
if CHARACTER not in CATALOG:
    raise ValueError('Nhân vật không hợp lệ')
SOURCE = SOURCES[CHARACTER]
CONFIG = json.loads((ROOT / 'apps/web/game/entities/player-character.json').read_text(encoding='utf8'))
TARGET = ROOT / 'apps/web/public' / CATALOG[CHARACTER]['url'].lstrip('/')
PROCESSED = ROOT / 'assets/processed'
FPS = 30
HEIGHT = CONFIG['height']
DURATIONS = {'Idle': 4, 'Walk': .8, 'Run': .6, 'Sit': 2, 'Dance': 4, 'GuitarDance': 4}
RUN_CONTACT = .26

if SOURCE.suffix == '.blend':
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE), load_ui=False, use_scripts=False)
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(SOURCE))
scene = bpy.context.scene
rig = bpy.data.objects['Armature']
# Một số file nguồn khóa/ẩn rig trong viewport; phải đưa rig vào tập xuất cùng mesh để giữ skin.
rig.hide_select = False; rig.hide_viewport = False; rig.hide_set(False)
# Chuẩn hóa tên xương của cùng bộ mẫu sang tên runtime; đổi cả vertex group để giữ skin.
bone_aliases = {'Spine1': ['chest', 'Chest'], 'Spine2': ['up chest']}
for side, suffix in [('Left', 'L'), ('Right', 'R')]:
    aliases = {'Shoulder': [f'shoulder.{suffix}', f'Shoulder.{suffix}'], 'Arm': [f'arm.{suffix}', f'Arm.{suffix}', f'Upper_arm.{suffix}'],
               'ForeArm': [f'elbow.{suffix}', f'foreArm.{suffix}', f'Lower_arm.{suffix}'], 'Hand': [f'hand.{suffix}', f'Hand.{suffix}'],
               'UpLeg': [f'leg.{suffix}', f'Upper_leg.{suffix}'], 'Leg': [f'knee.{suffix}', f'Lower_leg.{suffix}'], 'Foot': [f'shoes.{suffix}', f'feet.{suffix}', f'foot.{suffix}', f'Foot.{suffix}'],
               'ToeBase': [f'feet.{suffix}.001', f'toes.{suffix}', f'toe.{suffix}', f'Toes.{suffix}', f'feet.{suffix}']}
    for finger, stem in [('Thumb', 'thumb'), ('Index', 'index'), ('Middle', 'middle'), ('Ring', 'ring'), ('Pinky', 'pinky')]:
        for joint in range(1, 4):
            end = '' if joint == 1 else f'.00{joint - 1}'
            aliases[f'Hand{finger}{joint}'] = [f'{stem}.{suffix}{end}']
            unity_stem = 'little' if finger == 'Pinky' else stem
            aliases[f'Hand{finger}{joint}'].append(f'{unity_stem}_{["proximal", "intermediate", "distal"][joint - 1]}.{suffix}')
            if finger == 'Thumb': aliases[f'Hand{finger}{joint}'].append(f'thumbs.{suffix}{end}')
            if finger == 'Pinky': aliases[f'Hand{finger}{joint}'].append(f'index.{suffix}.00{joint + 2}')
    for canonical, choices in aliases.items():
        bone_aliases[side + canonical] = choices
for target, choices in bone_aliases.items():
    if target in rig.data.bones: continue
    old = next((name for name in choices if name in rig.data.bones), None)
    if old:
        rig.data.bones[old].name = target
        for obj in bpy.data.objects:
            if obj.type == 'MESH' and old in obj.vertex_groups: obj.vertex_groups[old].name = target
for required in ['Hips', 'Spine', 'Spine1', 'Head', 'LeftArm', 'RightArm', 'LeftUpLeg', 'RightUpLeg']:
    if required not in rig.data.bones: raise ValueError(f'Thiếu xương {required}')
guitar = next((obj for obj in scene.objects if obj.type == 'MESH' and ('guitar' in obj.name.lower() or obj.name == 'bass')), None)
if bool(guitar) != CATALOG[CHARACTER]['guitar']: raise ValueError('Khả năng đàn không khớp catalog')
for obj in list(scene.objects):
    if obj.type == 'MESH' and obj.name in ['staff', 'drum stick.L', 'drum stick.R']: bpy.data.objects.remove(obj, do_unlink=True)
meshes = [obj for obj in scene.objects if obj.type == 'MESH' and obj != guitar]
source_triangles = sum(len(poly.vertices) - 2 for obj in meshes for poly in obj.data.polygons)
original_rig_world = rig.matrix_world.copy()
guitar_original_world = guitar.matrix_world.copy() if guitar else None


def bounds():
    graph = bpy.context.evaluated_depsgraph_get()
    points = [obj.evaluated_get(graph).matrix_world @ Vector(corner)
              for obj in meshes for corner in obj.evaluated_get(graph).bound_box]
    return (Vector(tuple(min(p[i] for p in points) for i in range(3))),
            Vector(tuple(max(p[i] for p in points) for i in range(3))))


lo, hi = bounds()
rig.scale *= HEIGHT / (hi.z - lo.z)
bpy.context.view_layer.update()
lo, hi = bounds()
rig.location.z -= lo.z
bpy.context.view_layer.update()
# Đàn rời của Kita/Ryo nhận cùng phép chuẩn hóa; mẫu không có đàn chỉ dùng nhảy thường.
if guitar:
    guitar_world = rig.matrix_world @ original_rig_world.inverted() @ guitar_original_world
    guitar.data = bpy.data.meshes.new_from_object(guitar.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    if CHARACTER != 'bocchi':
        # Đàn/bass rời trong nguồn đang dựng bên cạnh người; đưa về tư thế đeo chéo trước ngực.
        points = [guitar_world @ vertex.co for vertex in guitar.data.vertices]
        lo_g = Vector(tuple(min(point[i] for point in points) for i in range(3)))
        hi_g = Vector(tuple(max(point[i] for point in points) for i in range(3)))
        guitar.data.transform(Matrix.Translation(-(lo_g + hi_g) / 2) @ guitar_world)
        instrument_scale = .95 / (hi_g.z - lo_g.z)
        guitar_world = Matrix.LocRotScale(Vector((-.03, -.25, 1.1)), Quaternion((0, 1, 0), .9), Vector((instrument_scale,) * 3))
    guitar.modifiers.clear(); guitar.constraints.clear()
    guitar.parent = rig; guitar.parent_type = 'OBJECT'
    guitar.matrix_parent_inverse = Matrix.Identity(4)
    guitar.matrix_basis = rig.matrix_world.inverted() @ guitar_world
    guitar.vertex_groups.clear()
    guitar.vertex_groups.new(name='Spine2').add(list(range(len(guitar.data.vertices))), 1, 'REPLACE')
    guitar.modifiers.new('Đàn theo ngực', 'ARMATURE').object = rig
    guitar.name = 'guitar'
    bpy.context.view_layer.update()
    meshes.append(guitar)
else:
    guitar_world = Matrix.Identity(4)
guitar_points = [guitar_world @ vertex.co for vertex in guitar.data.vertices] if guitar else [Vector((0, 0, 0))]
guitar_lo = Vector(tuple(min(point[i] for point in guitar_points) for i in range(3)))
guitar_hi = Vector(tuple(max(point[i] for point in guitar_points) for i in range(3)))
guitar_inverse = guitar_world.inverted()
guitar_chest_inverse = (rig.matrix_world @ rig.data.bones['Spine2'].matrix_local).inverted() if guitar else Matrix.Identity(4)
guitar_neck = guitar_inverse @ Vector((guitar_lo.x + (guitar_hi.x - guitar_lo.x) * .74, guitar_lo.y - .015, guitar_lo.z + (guitar_hi.z - guitar_lo.z) * .75))
guitar_pick = guitar_inverse @ Vector((guitar_lo.x + (guitar_hi.x - guitar_lo.x) * .30, guitar_lo.y - .015, guitar_lo.z + (guitar_hi.z - guitar_lo.z) * .47))
if CHARACTER == 'yui':
    # Khôi phục các slot từ prefab Unity; FBX có tên material khác tên .mat và thiếu đường dẫn ảnh.
    unity_root = ROOT / 'assets/processed/unity/yui'
    unity_assets = json.loads((unity_root / 'package-manifest.json').read_text(encoding='utf8'))['assets']
    unity_textures = {}
    material_map = {'Material': 'body', 'Material.006': 'head', 'hair_1': 'hair',
                    'Customization': 'Customization', 'Material.001': 'Customization 1', 'Material.005': 'Customization'}
    for material_name, unity_name in material_map.items():
        material = bpy.data.materials[material_name]
        text = (unity_root / f'Assets/YUI/Materials/{unity_name}.mat').read_text(encoding='utf-8-sig')
        match = re.search(r'- _MainTex:\s*\n\s*m_Texture: \{[^\n]*guid: ([a-f0-9]+)', text)
        if not match or match.group(1) not in unity_assets: raise ValueError(f'Thiếu texture {unity_name}')
        guid = match.group(1)
        if guid not in unity_textures:
            texture = bpy.data.images.load(str(unity_root / unity_assets[guid]), check_existing=True)
            if max(texture.size) > 1024:
                factor = 1024 / max(texture.size)
                texture.scale(*(round(size * factor) for size in texture.size))
            # Lưu bản thu nhỏ riêng, giữ nguyên ảnh nguồn trong package và vùng giải nén.
            texture_dir = unity_root / 'runtime-textures'; texture_dir.mkdir(exist_ok=True)
            texture.filepath_raw = str(texture_dir / (Path(texture.filepath).stem + '.png'))
            texture.file_format = 'PNG'; texture.save(); texture.pack()
            unity_textures[guid] = texture
        texture = unity_textures[guid]
        material.use_nodes = True; material.node_tree.nodes.clear()
        output = material.node_tree.nodes.new('ShaderNodeOutputMaterial')
        shader = material.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
        image_node = material.node_tree.nodes.new('ShaderNodeTexImage'); image_node.image = texture
        material.node_tree.links.new(image_node.outputs['Color'], shader.inputs['Base Color'])
        material.node_tree.links.new(shader.outputs[0], output.inputs['Surface'])
    # Chỉ giữ biểu cảm runtime đang dùng; giảm mesh không có morph để avatar không mang toàn bộ chi phí VRChat.
    for obj in meshes:
        if obj.data.shape_keys:
            for key in list(obj.data.shape_keys.key_blocks)[1:]:
                if key.name not in ['eyeBlinkLeft', 'eyeBlinkRight']: obj.shape_key_remove(key)
        else:
            bpy.context.view_layer.objects.active = obj
            modifier = obj.modifiers.new('Giảm lưới cho Web', 'DECIMATE'); modifier.ratio = .5
            bpy.ops.object.modifier_apply(modifier=modifier.name)
elif CHARACTER not in RECONSTRUCTED and CHARACTER != 'mint':
    for image in bpy.data.images:
        if image.source == 'FILE':
            texture = next((path for path in SOURCE.parent.rglob('*.png') if path.name.lower() in ['gotoh tx.png', 'kita.png', 'ryo.png', 'selen.png', 'miorine tx.png', 'nijika.png', 'serie.png']), None)
            if not texture: raise ValueError('Thiếu texture nhân vật')
            image.filepath = str(texture)
            image.reload()
            image.pack()
if CHARACTER in RECONSTRUCTED:
    for image in bpy.data.images:
        if max(image.size) > 1024:
            factor = 1024 / max(image.size)
            image.scale(*(round(size * factor) for size in image.size))
            image.filepath_raw = str(PROCESSED / 'reconstructed' / f'{CHARACTER}-runtime-{Path(image.filepath).stem}.png')
            image.file_format = 'PNG'; image.save()
            replacement = bpy.data.images.load(image.filepath_raw, check_existing=False); replacement.pack()
            for material in bpy.data.materials:
                if not material.use_nodes: continue
                for node in material.node_tree.nodes:
                    if node.type == 'TEX_IMAGE' and node.image == image: node.image = replacement
for material in bpy.data.materials:
    if not material.use_nodes:
        continue
    material.use_backface_culling = False
    for node in material.node_tree.nodes:
        if node.type == 'TEX_IMAGE':
            node.interpolation = 'Linear' if CHARACTER in ('yui', 'mint') or CHARACTER in RECONSTRUCTED else 'Closest'
        if node.type == 'BSDF_PRINCIPLED':
            node.inputs['Metallic'].default_value = 0
            node.inputs['Roughness'].default_value = .82

rest = {bone.name: rig.matrix_world @ bone.matrix_local for bone in rig.data.bones}
heads = {name: matrix.translation.copy() for name, matrix in rest.items()}
arm_inverse = rig.matrix_world.inverted()
arm_rotation = rig.matrix_world.to_quaternion()
# Location của pose bone theo trục rest riêng; Übel có Hips xoay gần 90° so với armature.
hip_inverse = rest['Hips'].to_3x3().inverted()
lengths = {bone.name: (rig.matrix_world @ bone.tail_local - heads[bone.name]).length
           for bone in rig.data.bones}
for bone in rig.pose.bones:
    bone.rotation_mode = 'QUATERNION'
rig.animation_data_clear()
scene.render.fps = FPS


def rotate(name, x=0, y=0, z=0):
    """Đổi độ lệch trục world sang hệ trục riêng của từng xương, không giả định bone roll."""
    if name not in rest: return
    world_rotation = rest[name].to_quaternion()
    delta = Quaternion((0, 0, 1), z) @ Quaternion((0, 1, 0), y) @ Quaternion((1, 0, 0), x)
    rig.pose.bones[name].rotation_quaternion = world_rotation.inverted() @ delta @ world_rotation


def set_segment(name, head, tail):
    bone = rig.data.bones[name]
    rest_direction = (rig.matrix_world @ bone.tail_local - heads[name]).normalized()
    rotation = rest_direction.rotation_difference((tail - head).normalized()) @ rest[name].to_quaternion()
    rig.pose.bones[name].matrix = Matrix.LocRotScale(
        arm_inverse @ head, arm_rotation.inverted() @ rotation, Vector((1, 1, 1)))
    bpy.context.view_layer.update()


def reach_limb(upper, lower, target, pole):
    """IK hai đoạn dùng chung cho chân và tay cầm đàn; không kéo dài xương khi ngoài tầm với."""
    hip = rig.matrix_world @ rig.pose.bones[upper].head
    delta = target - hip
    distance = max(.001, min(delta.length, lengths[upper] + lengths[lower] - .001))
    direction = delta.normalized()
    target = hip + direction * distance
    along = (lengths[upper] ** 2 - lengths[lower] ** 2 + distance ** 2) / (2 * distance)
    pole = (pole - direction * pole.dot(direction)).normalized()
    knee = hip + direction * along + pole * math.sqrt(max(0, lengths[upper] ** 2 - along ** 2))
    set_segment(upper, hip, knee)
    set_segment(lower, knee, target)
    return target


def plant_leg(side, ankle, foot_pitch=0):
    foot = side + 'Foot'
    ankle = reach_limb(side + 'UpLeg', side + 'Leg', ankle, Vector((0, -1, 0)))
    direction = (rig.matrix_world @ rig.data.bones[foot].tail_local - heads[foot]).normalized()
    direction = Quaternion((1, 0, 0), foot_pitch) @ direction
    set_segment(foot, ankle, ankle + direction * lengths[foot])


def pose(kind, phase):
    if kind == 'GuitarDance' and not guitar: kind = 'Dance'
    for bone in rig.pose.bones:
        bone.matrix_basis.identity()
    cycle = phase * math.tau
    breath = math.sin(cycle)
    hip_offset = Vector((0, 0, -.018))
    if kind in ('Walk', 'Run'):
        running = kind == 'Run'
        # Hông hạ giữa pha chịu lực, nâng trong pha thu chân; tránh nhún ngay lúc vừa chạm đất.
        hip_offset.z = -.09 - .018 * math.cos(2 * cycle - math.tau * RUN_CONTACT) if running else -.09 - .012 * math.cos(2 * cycle)
        hip_offset.x = .012 * math.sin(cycle)
        rotate('Hips', y=.018 * math.sin(cycle), z=(.04 if running else .035) * math.sin(cycle))
        rotate('Spine', x=.08 if running else .035, z=-(.035 if running else .025) * math.sin(cycle))
        rotate('Spine1', x=-.025 if running else -.01, z=.015 * math.sin(cycle - .2))
    elif kind in ('Dance', 'GuitarDance'):
        hip_offset.x = .085 * math.sin(cycle)
        hip_offset.z = -.045 - .035 * (1 - math.cos(cycle * 8)) / 2
        rotate('Hips', y=.055 * math.sin(cycle), z=.10 * math.sin(cycle * 2))
        rotate('Spine', y=-.08 * math.sin(cycle), z=-.08 * math.sin(cycle * 2))
        rotate('Spine1', x=.035 * math.sin(cycle * 4))
    elif kind == 'Sit':
        # Đệm sofa cao .78 m; hông cao hơn đệm, bàn chân đặt trước mép ghế.
        hip_offset.z = .86 - heads['Hips'].z
        rotate('Spine', x=-.06)
    else:
        rotate('Spine', x=.012 * breath)
        rotate('Spine1', y=.01 * breath)
    rig.pose.bones['Hips'].location = hip_inverse @ hip_offset
    rotate('Head', x=.018 * breath, z=.025 * math.sin(cycle * 2) if kind == 'Dance' else 0)
    for side, sign in [('Left', 1), ('Right', -1)]:
        offset = 0 if side == 'Left' else math.pi
        frequency = 2 if kind in ('Dance', 'GuitarDance') else 1
        wrist = math.sin(cycle * frequency + offset - .35)
        rotate(side + 'Shoulder', y=-sign * (.035 if kind == 'Dance' else .015) * math.sin(cycle * frequency + offset))
        rotate(side + 'Arm', x=-.45 if kind == 'Sit' else -.04, y=sign * 1.05)
        rotate(side + 'ForeArm', x=-.22)
        rotate(side + 'Hand', x=-.04 + .07 * wrist, y=sign * .04 * wrist, z=sign * (.04 + .07 * wrist))
        # Thả lỏng các đốt ngón thay vì giữ bàn tay phẳng; mở/khép nhẹ trễ theo cổ tay.
        curl = .35 if kind == 'GuitarDance' and side == 'Left' else .10 + (.08 if kind == 'Dance' else .025) * math.sin(cycle * frequency + offset - .65)
        for finger, extra in [('Index', 0), ('Middle', .02), ('Ring', .04), ('Pinky', .06)]:
            for joint, factor in [(1, 1), (2, 1.35), (3, .8)]:
                rotate(f'{side}Hand{finger}{joint}', z=sign * (curl + extra) * factor)
    rotate('hair front', x=.025 * breath)
    rotate('back hair', x=.035 * math.sin(cycle - .5))
    rotate('skirt', x=-.1 if kind == 'Sit' else .015 * breath)
    bpy.context.view_layer.update()
    if kind == 'GuitarDance':
        # Tay trái giữ cần, tay phải quạt dây; điểm tiếp xúc theo chính transform cây đàn gắn ở ngực.
        guitar_pose = (rig.matrix_world @ rig.pose.bones['Spine2'].matrix) @ guitar_chest_inverse @ guitar_world
        for side, point in [('Left', guitar_neck), ('Right', guitar_pick)]:
            target = guitar_pose @ point
            if side == 'Right':
                target.z += .035 * math.sin(cycle * 8)
            hand = reach_limb(side + 'Arm', side + 'ForeArm', target, Vector((1 if side == 'Left' else -1, -.5, -.4)))
            direction = Vector((.7, 0, .5)) if side == 'Left' else Vector((-.2, 0, -.8))
            set_segment(side + 'Hand', hand, hand + direction.normalized() * lengths[side + 'Hand'])
    if kind in ('Idle', 'Walk', 'Run', 'Dance'):
        for side, sign in [('Left', 1), ('Right', -1)]:
            upper, lower = side + 'Arm', side + 'ForeArm'
            shoulder = rig.matrix_world @ rig.pose.bones[upper].head
            offset = 0 if side == 'Left' else math.pi
            if kind == 'Dance':
                lift = .5 + .5 * math.sin(cycle * 2 + offset)
                direction = Vector((sign * (.20 + .05 * math.cos(cycle * 2 + offset)),
                                    -.12 - .08 * math.sin(cycle * 2 + offset - .4), -.12 + .38 * lift))
                forearm = Vector((sign * (.05 + .08 * math.cos(cycle * 2 + offset - .35)),
                                  -.17 - .06 * math.sin(cycle * 4 + offset - .25), .08 + .15 * lift))
            elif kind in ('Walk', 'Run'):
                # Tay đánh ngược chân cùng bên; khuỷu và cổ tay theo sau vai để không chuyển như khối cứng.
                running = kind == 'Run'
                if running:
                    # Giữ khuỷu gập mềm theo vai thay vì quạt cẳng tay độc lập như chèo thuyền.
                    swing_angle = -.43 * math.sin(cycle + offset - math.pi * RUN_CONTACT)
                    bend = 1.05 + .06 * math.sin(cycle + offset - .2)
                    direction = Vector((sign * .18, math.sin(swing_angle), -math.cos(swing_angle)))
                    forearm = Vector((sign * .06, math.sin(swing_angle - bend), -math.cos(swing_angle - bend)))
                else:
                    direction = Vector((sign * .085, .20 * math.cos(cycle + offset), -.26))
                    forearm = Vector((sign * .025, .11 * math.cos(cycle + offset - .18) - .055, -.27))
            else:
                direction = Vector((sign * .085, .012 * breath, -.26))
                forearm = Vector((sign * .018, -.035 + .009 * math.sin(cycle - .3), -.27))
            elbow = shoulder + direction.normalized() * lengths[upper]
            set_segment(upper, shoulder, elbow)
            set_segment(lower, elbow, elbow + forearm.normalized() * lengths[lower])
    feet = []
    for side, offset in [('Left', 0), ('Right', .5)]:
        ankle = heads[side + 'Foot'].copy()
        foot_pitch = 0
        if kind in ('Walk', 'Run'):
            step = (phase + offset) % 1
            running = kind == 'Run'
            contact = RUN_CONTACT if running else .6
            speed = CONFIG['runSpeed'] if running else CONFIG['walkSpeed']
            stance_distance = speed * DURATIONS[kind] * contact
            if step < contact:
                ankle.y += stance_distance * (step / contact - .5)
            else:
                swing = (step - contact) / (1 - contact)
                # Hermite nối cả vận tốc ở nhấc/chạm chân, tránh đổi chiều tức thời như sóng tam giác.
                tangent = stance_distance / contact * (1 - contact)
                if running:
                    # Chỉ giữ vận tốc tiếp đất ở hai đầu cung, không kéo tiếp tuyến qua cả pha vung
                    # làm chân văng xa. Quãng chống = tốc độ × thời gian chống, nên chân không trượt.
                    edge = swing * (1 - swing) * (1 - 2 * swing) * math.exp(-10 * swing * (1 - swing))
                    ankle.y += stance_distance / 2 * math.cos(math.pi * swing) + tangent * edge
                else:
                    h00 = 2 * swing ** 3 - 3 * swing ** 2 + 1
                    h10 = swing ** 3 - 2 * swing ** 2 + swing
                    h01 = -2 * swing ** 3 + 3 * swing ** 2
                    h11 = swing ** 3 - swing ** 2
                    ankle.y += h00 * stance_distance / 2 - h01 * stance_distance / 2 + (h10 + h11) * tangent
                lift = math.sin(math.pi * swing) ** 2
                if running:
                    foot_pitch = .3 * lift
                ankle.z += (.14 if running else .10) * lift
        elif kind in ('Dance', 'GuitarDance'):
            # Hai chân neo sàn trong khi hông, gối và tay chuyển động theo tám beat.
            ankle.x += .045 * (1 if side == 'Left' else -1)
        elif kind == 'Sit':
            ankle.y -= lengths[side + 'UpLeg'] + .04
            ankle.z = .86 + heads[side + 'UpLeg'].z - heads['Hips'].z - lengths[side + 'Leg']
        feet.append((side, ankle, foot_pitch))
    if kind == 'Run':
        # Mỗi mẫu có tỷ lệ đùi/cẳng chân khác nhau. Hạ hông vừa đủ theo chân xa nhất,
        # chừa độ gập gối thay vì để IK cắt ngắn quỹ đạo và gây trượt chân chống.
        correction = 0
        for side, ankle, _ in feet:
            hip = rig.matrix_world @ rig.pose.bones[side + 'UpLeg'].head
            reach = .99 * (lengths[side + 'UpLeg'] + lengths[side + 'Leg'])
            horizontal = (ankle.x - hip.x) ** 2 + (ankle.y - hip.y) ** 2
            highest_hip = ankle.z + math.sqrt(max(.001, reach ** 2 - horizontal))
            correction = min(correction, highest_hip - hip.z)
        rig.pose.bones['Hips'].location += hip_inverse @ Vector((0, 0, correction))
        bpy.context.view_layer.update()
    for side, ankle, foot_pitch in feet:
        plant_leg(side, ankle, foot_pitch)


actions = {}
for name, duration in DURATIONS.items():
    rig.animation_data_create()
    rig.animation_data.action = None
    count = round(duration * FPS)
    for frame in range(count + 1):
        scene.frame_set(frame)
        pose(name, frame / count)
        for bone in rig.pose.bones:
            bone.keyframe_insert(data_path='rotation_quaternion', frame=frame, group=bone.name)
            if bone.name == 'Hips':
                bone.keyframe_insert(data_path='location', frame=frame, group=bone.name)
    action = rig.animation_data.action
    action.name = name
    action.use_fake_user = True
    actions[name] = action

# Chớp mắt là clip riêng để không mất biểu cảm khi blend động tác thân hoặc đổi BPM.
blink_names = (['eyeBlinkLeft', 'eyeBlinkRight'] if CHARACTER in RECONSTRUCTED or CHARACTER == 'yui' else
               {'bocchi': ['blink 1 L', 'blink 1 R'], 'kita': ['blink left', 'blink right'], 'ryo': ['blink'], 'ubel': ['blink'], 'miorine': ['blink L', 'blink R'], 'nijika': ['blink'], 'serie': ['blink'], 'mint': ['Blink Left', 'Blink Right']}[CHARACTER])
face = next(obj for obj in meshes if obj.data.shape_keys and all(name in obj.data.shape_keys.key_blocks for name in blink_names))
keys = face.data.shape_keys
for frame, value in [(0, 0), (48, 0), (51, 1), (54, 0), (120, 0)]:
    for name in blink_names:
        keys.key_blocks[name].value = value
        keys.key_blocks[name].keyframe_insert(data_path='value', frame=frame)
keys.animation_data.action.name = 'Blink'
keys.animation_data.action.use_fake_user = True
rig.animation_data.action = actions['Idle']
scene.frame_start = 0
scene.frame_end = 120
scene.frame_set(0)
TARGET.parent.mkdir(parents=True, exist_ok=True)
PROCESSED.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
for obj in meshes + [rig]:
    obj.hide_select = False; obj.hide_viewport = False; obj.hide_set(False)
    obj.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(
    filepath=str(TARGET), export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='ACTIONS', export_frame_range=False,
    export_force_sampling=True, export_morph=True, export_morph_animation=True,
    export_def_bones=False, export_skins=True, export_yup=True)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(PROCESSED / f'{CHARACTER}-player.blend'))

# Ghép mocap chung (dáng đi Dwarf Walk và 5 điệu nhảy) sau bước xuất rig chuẩn.
recorded_dances = {'walk': ('Walk', 'Dwarf Walk'), 'flair': ('Flair', 'Flair'), 'hiphop': ('HipHop', 'Hip Hop Dancing'), 'maraschino': ('Maraschino', 'Dancing Maraschino Step'), 'swing': ('Swing', 'Swing Dancing'), 'snakehiphop': ('SnakeHipHop', 'Snake Hip Hop Dance')}
for motion in recorded_dances:
    subprocess.run(['corepack.cmd', 'pnpm', '--filter', '@metaverse/web', 'exec', 'tsx', 'scripts/bake-player-flair.ts', f'--motion={motion}', f'--character={CHARACTER}'], cwd=str(ROOT), check=True)

raw = TARGET.read_bytes()
import struct
document = json.loads(raw[20:20 + struct.unpack_from('<I', raw, 12)[0]])
if not document.get('skins') or not (set(DURATIONS) | {'Blink'} | {clip for clip, _ in recorded_dances.values()}).issubset({action['name'] for action in document.get('animations', [])}):
    raise ValueError('GLB thiếu skin hoặc clip; kiểm tra rig có bị ẩn/khóa trong nguồn không')
report = {
    'source': str(SOURCE.relative_to(ROOT)),
    'sourceSha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    'runtime': str(TARGET.relative_to(ROOT)), 'runtimeSha256': hashlib.sha256(raw).hexdigest(),
    'bytes': len(raw), 'heightMeters': HEIGHT,
    'trianglesInSource': source_triangles,
    'trianglesBeforeExport': sum(len(p.vertices) - 2 for obj in meshes for p in obj.data.polygons),
    'boneCount': len(rig.data.bones),
    'animations': [a['name'] for a in document.get('animations', [])],
    'dance': {'beatsPerLoop': CONFIG['danceBeats'], 'authorBpm': 120},
    **{key: {'source': f'assets/source/animations/club/mixamo/common/{source}.fbx', 'sourceSha256': hashlib.sha256((ROOT / f'assets/source/animations/club/mixamo/common/{source}.fbx').read_bytes()).hexdigest(), 'playback': 'natural'} for key, (_, source) in recorded_dances.items()},
    'locomotion': {name: {'speed': CONFIG['runSpeed'] if name == 'Run' else CONFIG['walkSpeed'], 'duration': DURATIONS[name], 'contactRatio': RUN_CONTACT if name == 'Run' else .6} for name in ['Walk', 'Run']},
    'guitar': bool(guitar), 'characterId': CHARACTER,
    'license': 'Mẫu do người dùng cung cấp cho dự án local; chưa xác minh quyền phân phối.',
    'browserVerified': False,
}
if CHARACTER == 'yui':
    package = json.loads((unity_root / 'package-manifest.json').read_text(encoding='utf8'))
    report['sourcePackage'] = package['source']; report['sourcePackageSha256'] = package['sourceSha256']
    report['textureMaxResolution'] = 1024
    report['materialConversion'] = 'MainTex Unity sang glTF PBR, giữ màu gốc; không mang shader/script Unity sang Web.'
elif CHARACTER == 'mint':
    report['textureMaxResolution'] = 1024
if CHARACTER in RECONSTRUCTED:
    report['reconstruction'] = json.loads((ROOT / f'assets/processed/reconstructed/{CHARACTER}-provenance.json').read_text(encoding='utf8'))
(PROCESSED / f'{CHARACTER}-player-manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf8')
print('PLAYER_ASSET ' + json.dumps(report, ensure_ascii=True), flush=True)

if any(flag in sys.argv for flag in ['--preview', '--portrait', '--guitar-preview', '--gait-preview', '--head-preview']):
    # Render lại chính GLB runtime để phát hiện sai vật liệu/rig do bước xuất, không chỉ xem bản .blend.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(TARGET))
    scene = bpy.context.scene
    rig = next(obj for obj in scene.objects if obj.type == 'ARMATURE')
    actions = {action.name: action for action in bpy.data.actions}
    scene.render.fps = FPS
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 16
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.world = bpy.data.worlds.new('Ánh sáng xem nhân vật')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.09, .10, .14, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .6
    bpy.ops.mesh.primitive_plane_add(size=12)
    ground = bpy.context.object
    ground.name = 'Sàn kiểm tra'
    mat = bpy.data.materials.new('Sàn xám')
    mat.diffuse_color = (.06, .075, .10, 1)
    ground.data.materials.append(mat)
    focus = Vector((0, 0, .9))
    bpy.ops.object.camera_add(location=(2.3, -4.2, 1.9))
    camera = bpy.context.object
    camera.rotation_euler = (focus - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 2.2
    scene.camera = camera
    for location, power in [((2, -3, 4), 350), ((-2, -1, 3), 220), ((0, 2, 3), 260)]:
        bpy.ops.object.light_add(type='AREA', location=location)
        light = bpy.context.object
        light.data.energy = power
        light.data.shape = 'DISK'
        light.data.size = 3
        light.rotation_euler = (focus - light.location).to_track_quat('-Z', 'Y').to_euler()
    preview = ROOT / 'test-results/screenshots'
    preview.mkdir(parents=True, exist_ok=True)
    frames = [('Idle', 0)] if '--portrait' in sys.argv or '--head-preview' in sys.argv else [('Idle', 0), ('Walk', 5), ('Run', 3), ('Sit', 0), ('Dance', 15), ('GuitarDance', 15), ('GuitarDance', 45)]
    if '--guitar-preview' in sys.argv: frames = [('GuitarDance', 15), ('GuitarDance', 45)]
    if '--gait-preview' in sys.argv:
        frames = [('Run', frame) for frame in [0, 3, 6, 9, 12, 15]]
    for name, frame in frames:
        rig.animation_data.action = actions[name]
        instrument = next((obj for obj in scene.objects if obj.name == 'guitar'), None)
        if instrument: instrument.hide_render = name != 'GuitarDance'
        scene.frame_set(frame)
        scene.render.filepath = str(preview / f'{CHARACTER}-{name.lower()}-{frame}-offline.png')
        if '--portrait' in sys.argv:
            portrait = ROOT / 'apps/web/public' / CATALOG[CHARACTER]['portrait'].lstrip('/')
            portrait.parent.mkdir(parents=True, exist_ok=True)
            scene.render.resolution_x = 320; scene.render.resolution_y = 400
            scene.render.film_transparent = True; ground.hide_render = True
            scene.render.image_settings.color_mode = 'RGBA'
            scene.render.filepath = str(portrait)
        bpy.ops.render.render(write_still=True)
    if '--head-preview' in sys.argv:
        rig.animation_data.action = actions['Idle']; scene.frame_set(0)
        focus = rig.matrix_world @ rig.pose.bones['Head'].head + Vector((0, -.02, .10))
        camera.location = focus + Vector((.16, -3, .05))
        camera.rotation_euler = (focus - camera.location).to_track_quat('-Z', 'Y').to_euler()
        camera.data.ortho_scale = .7
        scene.render.resolution_x = 640; scene.render.resolution_y = 640
        scene.render.filepath = str(preview / f'{CHARACTER}-head-offline.png')
        bpy.ops.render.render(write_still=True)
