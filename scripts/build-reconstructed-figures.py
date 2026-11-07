"""Dựng ba biến thể tham chiếu trên rig Yui có sẵn; không khôi phục hoặc giả làm model thương mại gốc."""
import hashlib
import json
import math
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/processed/reconstructed'
OUT.mkdir(parents=True, exist_ok=True)
BASE = ROOT / 'assets/processed/yui-player.blend'


def material(name, color, roughness=.5, metallic=0):
    mat = bpy.data.materials.new(name); mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    mat.diffuse_color = (*color, 1)
    return mat


def skin_mesh(name, vertices, faces, mat, bone='Head', weights=None):
    """Tạo mesh theo tọa độ world rồi đổi về rig; phụ kiện luôn có skin để theo clip runtime."""
    mesh = bpy.data.meshes.new(name)
    inverse = rig.matrix_world.inverted()
    mesh.from_pydata([inverse @ Vector(point) for point in vertices], [], faces); mesh.update()
    obj = bpy.data.objects.new(name, mesh); bpy.context.collection.objects.link(obj)
    obj.parent = rig; obj.matrix_parent_inverse = Matrix.Identity(4)
    obj.data.materials.append(mat)
    for i, point in enumerate(vertices):
        for group, weight in (weights(Vector(point)) if weights else [(bone, 1)]):
            target = obj.vertex_groups.get(group) or obj.vertex_groups.new(name=group)
            target.add([i], weight, 'REPLACE')
    obj.modifiers.new('Theo rig người chơi', 'ARMATURE').object = rig
    for polygon in mesh.polygons: polygon.use_smooth = True
    return obj


def tube(name, points, radii, mat, depth=1, bone='Head', sides=10):
    vertices, faces = [], []
    points = [Vector(point) for point in points]
    if len(points) < 10:
        smooth_points, smooth_radii = [], []
        for i in range(len(points) - 1):
            p0, p1, p2, p3 = points[max(0, i - 1)], points[i], points[i + 1], points[min(len(points) - 1, i + 2)]
            for step in range(6):
                t = step / 6
                smooth_points.append((2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3) / 2)
                smooth_radii.append(radii[i] * (1 - t) + radii[i + 1] * t)
        points, radii = smooth_points + [points[-1]], smooth_radii + [radii[-1]]
    for i, point in enumerate(points):
        tangent = (points[min(i + 1, len(points) - 1)] - points[max(0, i - 1)]).normalized()
        reference = Vector((0, 1, 0)) if abs(tangent.y) < .95 else Vector((0, 0, 1))
        normal = tangent.cross(reference).normalized(); bitangent = tangent.cross(normal).normalized()
        for j in range(sides):
            angle = j * math.tau / sides
            vertices.append(point + radii[i] * (normal * math.cos(angle) + bitangent * math.sin(angle) * depth))
        if i:
            for j in range(sides):
                a = (i - 1) * sides + j; b = (i - 1) * sides + (j + 1) % sides
                faces.append((a, b, b + sides, a + sides))
    faces.extend([tuple(reversed(range(sides))), tuple((len(points) - 1) * sides + j for j in range(sides))])
    return skin_mesh(name, vertices, faces, mat, bone)


def cat_ears(hair, inner):
    for sign in [-1, 1]:
        vertices = [(sign * .045, .015, 1.515), (sign * .13, .035, 1.51),
                    (sign * .115, .055, 1.66), (sign * .06, .105, 1.51)]
        skin_mesh(f'Tai mèo {sign}', vertices, [(0, 1, 2), (0, 2, 3), (1, 3, 2), (0, 3, 1)], hair)
        skin_mesh(f'Lòng tai {sign}', [(sign * .061, .009, 1.53), (sign * .117, .027, 1.53),
                                      (sign * .109, .044, 1.633)], [(0, 1, 2)], inner)


def tint_eyes(identity):
    """Chỉ đổi vùng màu vàng bão hòa của iris; giữ alpha, nét mặt và hai morph chớp mắt."""
    face = bpy.data.objects['head']; mat = face.data.materials[0].copy(); face.data.materials[0] = mat
    node = next(node for node in mat.node_tree.nodes if node.type == 'TEX_IMAGE')
    image = node.image.copy(); node.image = image; image.name = identity + '-face'
    pixels = np.array(image.pixels[:], dtype=np.float32).reshape((-1, 4))
    x, y = np.meshgrid(np.arange(image.size[0]) / image.size[0], np.arange(image.size[1]) / image.size[1])
    iris = ((((x - .166) / .15) ** 2 + ((y - .837) / .15) ** 2 < 1) |
            (((x - .834) / .15) ** 2 + ((y - .837) / .15) ** 2 < 1)).ravel()
    mask = iris & (pixels[:, 0] > pixels[:, 2] * 1.05) & (pixels[:, :3].max(axis=1) > .04)
    color = pixels[mask, :3]; light = color.max(axis=1); saturation = (light - color.min(axis=1)) / np.maximum(light, .001)
    pixels[mask, :3] = light[:, None] * (1 - saturation[:, None] + saturation[:, None] * np.array([.63, .38, 1]))
    image.pixels.foreach_set(pixels.ravel()); image.update()
    image.filepath_raw = str(OUT / f'{identity}-face.png'); image.file_format = 'PNG'; image.save()
    # Image.copy giữ blob packed cũ; nạp lại PNG mới để GLB không dùng nhầm mắt vàng của mẫu nền.
    replacement = bpy.data.images.load(image.filepath_raw, check_existing=False); replacement.pack(); node.image = replacement


def anatomical_frame(armature, bone):
    """Dùng hướng xương và hướng trước chung, tránh xoắn trang phục do bone roll khác giữa hai rig."""
    head = armature.matrix_world @ bone.head_local
    axis = (armature.matrix_world @ bone.tail_local - head).normalized()
    forward = Vector((0, -1, 0)) if abs(axis.y) < .95 else Vector((0, 0, 1))
    side = axis.cross(forward).normalized(); front = side.cross(axis).normalized()
    return head, Matrix((side, axis, front)).transposed().to_quaternion()


def fit_kuroki_clothing():
    """Chuyển rest-space của áo có sẵn sang từng đoạn xương Yui; không lấy hình học cơ thể Kuroki gốc."""
    before = set(bpy.data.objects)
    source = ROOT / 'assets/processed/unity/kuroki/Assets/YaokiSubWork/Living Bodysuit Alpha/Kuroki/fbx/TBS alpha for Kuroki.fbx'
    bpy.ops.import_scene.fbx(filepath=str(source))
    imported = set(bpy.data.objects) - before
    source_rig = next(obj for obj in imported if obj.type == 'ARMATURE'); source_rig.data.pose_position = 'REST'
    source_mesh = next(obj for obj in imported if obj.name == 'Clothing')
    mapping = {'Chest': 'Spine1'}
    for suffix, side in [('L', 'Left'), ('R', 'Right')]:
        for source_name, target in [('Shoulder', 'Shoulder'), ('Upper_arm', 'Arm'), ('Lower_arm', 'ForeArm'),
                                    ('Hand', 'Hand'), ('Upper_leg', 'UpLeg'), ('lower_leg', 'Leg'), ('Foot', 'Foot'), ('Toe', 'ToeBase')]:
            mapping[source_name + '_' + suffix] = side + target
    frames = {}
    radius_scale = ((rig.matrix_world @ rig.data.bones['Head'].head_local - rig.matrix_world @ rig.data.bones['Hips'].head_local).length /
                    (source_rig.matrix_world @ source_rig.data.bones['Head'].head_local - source_rig.matrix_world @ source_rig.data.bones['Hips'].head_local).length)
    for group in source_mesh.vertex_groups:
        bone = source_rig.data.bones.get(group.name)
        while bone:
            target_name = mapping.get(bone.name, bone.name)
            if target_name in rig.data.bones: break
            bone = bone.parent
        if not bone: continue
        target = rig.data.bones[target_name]
        source_head, source_rotation = anatomical_frame(source_rig, bone)
        target_head, target_rotation = anatomical_frame(rig, target)
        source_length = (source_rig.matrix_world @ bone.tail_local - source_head).length
        target_length = (rig.matrix_world @ target.tail_local - target_head).length
        frames[group.index] = (target_name, source_head, source_rotation.inverted(), target_head, target_rotation, target_length / source_length)
    vertices, groups = [], []
    for vertex in source_mesh.data.vertices:
        world = source_mesh.matrix_world @ vertex.co; point = Vector(); weights = {}; total = 0
        for item in vertex.groups:
            if item.group not in frames: continue
            name, origin, inverse, target, rotation, along = frames[item.group]
            local = inverse @ (world - origin); local.x *= radius_scale; local.z *= radius_scale; local.y *= along
            point += (target + rotation @ local) * item.weight
            total += item.weight; weights[name] = weights.get(name, 0) + item.weight
        if not total: raise ValueError('Áo có đỉnh không nối được rig')
        point /= total; point.x *= 1.025; point.y *= 1.025
        vertices.append(point); groups.append({name: weight / total for name, weight in weights.items()})
    mat = material('Kuroki · áo từ gói người dùng', (.035, .025, .055), .48)
    image = bpy.data.images.load(str(source.parents[1] / 'Texture/Tentacle suit A_base.png')); image.pack()
    node = mat.node_tree.nodes.new('ShaderNodeTexImage'); node.image = image
    mat.node_tree.links.new(node.outputs['Color'], mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    obj = skin_mesh('Áo Kuroki đã ráp rig', vertices, [tuple(face.vertices) for face in source_mesh.data.polygons], mat)
    obj.vertex_groups.clear()
    for i, weights in enumerate(groups):
        for name, weight in weights.items():
            group = obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name); group.add([i], weight, 'REPLACE')
    uv = obj.data.uv_layers.new(name='UVMap')
    for i, value in enumerate(source_mesh.data.uv_layers.active.data): uv.data[i].uv = value.uv
    for obj in imported: bpy.data.objects.remove(obj, do_unlink=True)
    return str(source.relative_to(ROOT))


for identity in ['airi', 'annie', 'kuroki']:
    bpy.ops.wm.open_mainfile(filepath=str(BASE), load_ui=False, use_scripts=False)
    rig = bpy.data.objects['Armature']; rig.animation_data_clear(); rig.data.pose_position = 'REST'
    for bone in rig.pose.bones: bone.matrix_basis.identity()
    for obj in bpy.data.objects:
        if obj.type == 'MESH' and obj.data.shape_keys:
            obj.data.shape_keys.animation_data_clear()
            for key in obj.data.shape_keys.key_blocks[1:]: key.value = 0
    for action in list(bpy.data.actions): bpy.data.actions.remove(action)
    remove = ['Customization.002', 'Customization.003', 'Customization.004', 'Customization.005', 'horn', 'Tail']
    if identity in ['airi', 'annie']: remove.append('ponytail')
    for name in remove:
        obj = bpy.data.objects.get(name)
        if obj: bpy.data.objects.remove(obj, do_unlink=True)
    hair_color = {'airi': (.68, .63, .83), 'annie': (.18, .095, .29), 'kuroki': (.026, .017, .044)}[identity]
    hair = material(identity + ' · tóc dựng lại', hair_color, .42)
    black = material(identity + ' · vải đen', (.018, .014, .028), .4)
    white = material(identity + ' · vải trắng', (.82, .79, .9), .65)
    inner = material(identity + ' · lòng tai', (.50, .38, .57), .7)
    for obj in bpy.data.objects:
        if obj.type == 'MESH' and (obj.name.startswith('hair_') or obj.name == 'ponytail'):
            obj.data.materials.clear(); obj.data.materials.append(hair)
        if obj.type == 'MESH' and (obj.name.startswith('Customization') or obj.name == 'Stocking' or (obj.name == 'body' and identity == 'annie')):
            obj.data.materials.clear(); obj.data.materials.append(black)
    if identity != 'annie': tint_eyes(identity)
    extra_source = None
    if identity == 'airi':
        horn = material('Airi · sừng tím', (.36, .27, .56), .38)
        for sign in [-1, 1]:
            tube(f'Sừng cong {sign}', [(sign * .10, .055, 1.50), (sign * .17, .07, 1.54),
                                      (sign * .20, .08, 1.62), (sign * .17, .065, 1.70), (sign * .14, .05, 1.73)],
                 [.036, .044, .035, .017, .001], horn)
            for offset in [0, .045]:
                tube(f'Lọn tóc dài {sign} {offset}', [(sign * (.095 + offset), .10, 1.49), (sign * (.13 + offset), .13, 1.29),
                                                     (sign * (.15 + offset), .15, 1.05), (sign * (.13 + offset), .18, .78)],
                     [.04, .055, .045, .002], hair, .3)
        vertices, faces = [], []
        for z, width, depth in [(.96, .125, .10), (.84, .18, .13), (.66, .25, .175)]:
            for i in range(32):
                angle = i * math.tau / 32; pleat = 1 + .05 * math.cos(angle * 16)
                vertices.append((math.cos(angle) * width * pleat, math.sin(angle) * depth * pleat, z))
        for row in range(2):
            for i in range(32): faces.append((row * 32 + i, row * 32 + (i + 1) % 32, (row + 1) * 32 + (i + 1) % 32, (row + 1) * 32 + i))
        skirt = skin_mesh('Airi · váy xếp', vertices, faces, white, weights=lambda p: [('Hips', .8), ('LeftUpLeg' if p.x > 0 else 'RightUpLeg', .2)])
        skirt.data.materials.append(black)
        for face in skirt.data.polygons: face.material_index = int(face.index >= 32)
        band = [(math.cos(t) * .12, -.077, 1.46 + math.sin(t) * .09) for t in np.linspace(.05, math.pi - .05, 24)]
        tube('Airi · băng tóc đen', band, [.007] * len(band), black, .7)
        for side in ['Left', 'Right']:
            bone = rig.data.bones[side + 'Arm']; start = rig.matrix_world @ bone.head_local
            direction = (rig.matrix_world @ bone.tail_local - start).normalized()
            tube('Airi · tay áo ' + side, [start + direction * d for d in [.045, .08, .13]], [.039, .042, .058], white, bone=side + 'Arm', sides=16)
    else:
        cat_ears(hair, inner)
        tube(identity + ' · đuôi mèo', [(0, .10, .89), (.06, .22, .82), (.12, .28, .61), (.17, .27, .56), (.20, .25, .64)],
             [.022, .024, .02, .017, .008], hair, bone='Hips')
        if identity == 'annie':
            tube('Annie · mặt nạ đen', [(-.06, -.083, 1.365), (0, -.096, 1.365), (.06, -.083, 1.365)], [.025, .028, .025], black, .45, sides=12)
        else:
            extra_source = fit_kuroki_clothing()
            for sign in [-1, 1]:
                points = [(sign * .041 + .041 * math.cos(t), -.083 - .004 * math.cos(t), 1.412 + .018 * math.sin(t)) for t in np.linspace(0, math.tau, 33)]
                tube('Kuroki · gọng kính ' + str(sign), points, [.0025] * len(points), black, sides=6)
            tube('Kuroki · cầu kính', [(-.006, -.087, 1.415), (0, -.094, 1.42), (.006, -.087, 1.415)], [.0025] * 3, black, sides=6)
    rig.data.pose_position = 'POSE'; bpy.context.scene.frame_set(0)
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            for polygon in obj.data.polygons: polygon.use_smooth = True
    # Gộp phần không có morph để phụ kiện mới không tạo thêm hàng chục draw call cho một avatar.
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.data.objects:
        if obj.type == 'MESH' and not obj.data.shape_keys:
            obj.hide_set(False); obj.hide_select = False; obj.select_set(True)
            if obj.data.uv_layers.active: obj.data.uv_layers.active.name = 'UVMap'
    bpy.context.view_layer.objects.active = bpy.data.objects['body']
    bpy.ops.object.join()
    bpy.context.object.name = identity + '-body'
    bpy.context.preferences.filepaths.save_version = 0
    target = OUT / f'{identity}-source.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(target))
    report = {'approximation': True, 'base': str(BASE.relative_to(ROOT)), 'baseSha256': hashlib.sha256(BASE.read_bytes()).hexdigest(),
              'extraSource': extra_source, 'reference': ('test-results/annie-reference/image2.png' if identity == 'annie' else f'test-results/{identity}-official-reference.jpg'),
              'referenceUrl': None if identity == 'annie' else 'https://booth.pm/ja/items/' + ('6082686' if identity == 'airi' else '8822547'),
              'note': 'Bản dựng lại cho thử nghiệm, ghép và chỉnh hình học từ rig Yui do người dùng cung cấp; không phải model Airi/Annie/Kuroki gốc.'}
    (OUT / f'{identity}-provenance.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf8')
    print('RECONSTRUCTED ' + identity, flush=True)
