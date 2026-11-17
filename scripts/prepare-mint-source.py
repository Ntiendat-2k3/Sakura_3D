"""Chuyển đổi model gốc Mint (.vrm) sang tệp .blend chuẩn rig Mixamo hướng -Y cho pipeline nhân vật người chơi."""
import math
from pathlib import Path

import bpy
from mathutils import Euler

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/source/characters/figure/mint/mint.vrm'
TARGET = ROOT / 'assets/processed/mint-source.blend'
TEXTURE_DIR = ROOT / 'assets/processed/mint-runtime-textures'

BONE_RENAMES = {
    'Bip001-Pelvis': 'Hips',
    'Bip001-Spine': 'Spine',
    'Bip001-Spine1': 'Spine1',
    'Bip001-Spine2': 'Spine2',
    'Bip001-Neck': 'Neck',
    'Bip001-Head': 'Head',
    'Bip001-L-Clavicle': 'LeftShoulder',
    'Bip001-L-UpperArm': 'LeftArm',
    'Bip001-L-Forearm': 'LeftForeArm',
    'Bip001-L-Hand': 'LeftHand',
    'Bip001-R-Clavicle': 'RightShoulder',
    'Bip001-R-UpperArm': 'RightArm',
    'Bip001-R-Forearm': 'RightForeArm',
    'Bip001-R-Hand': 'RightHand',
    'Bip001-L-Thigh': 'LeftUpLeg',
    'Bip001-L-Calf': 'LeftLeg',
    'Bip001-L-Foot': 'LeftFoot',
    'Bip001-L-Toe0': 'LeftToeBase',
    'Bip001-R-Thigh': 'RightUpLeg',
    'Bip001-R-Calf': 'RightLeg',
    'Bip001-R-Foot': 'RightFoot',
    'Bip001-R-Toe0': 'RightToeBase',
}

FINGER_NAMES = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']
for side_in, side_out in [('L', 'Left'), ('R', 'Right')]:
    for idx, finger in enumerate(FINGER_NAMES):
        BONE_RENAMES[f'Bip001-{side_in}-Finger{idx}'] = f'{side_out}Hand{finger}1'
        BONE_RENAMES[f'Bip001-{side_in}-Finger{idx}1'] = f'{side_out}Hand{finger}2'
        BONE_RENAMES[f'Bip001-{side_in}-Finger{idx}2'] = f'{side_out}Hand{finger}3'


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE), bone_heuristic='TEMPERANCE')

    rig = next(obj for obj in bpy.context.scene.objects if obj.type == 'ARMATURE')
    # Loại bỏ mesh widget thừa do bộ nhập glTF tự sinh (không thuộc skin của Armature).
    for obj in list(bpy.data.objects):
        if obj.type == 'MESH' and obj.parent is None:
            bpy.data.objects.remove(obj, do_unlink=True)

    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and obj.parent == rig]
    if not meshes:
        raise RuntimeError('Không tìm thấy mesh nhân vật gắn với Armature của Mint')

    # VRM0 quay mặt về +Y trong Blender; xoay 180° quanh trục Z để khớp chuẩn -Y của toàn bộ dàn nhân vật.
    rig.rotation_mode = 'XYZ'
    rig.rotation_euler = Euler((0, 0, math.pi), 'XYZ')
    bpy.context.view_layer.update()

    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    for mesh_obj in meshes:
        mesh_obj.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    bpy.context.view_layer.update()

    # Kiểm tra morph chớp mắt không bị hỏng sau transform_apply và tinh giản shape key thừa.
    for mesh_obj in meshes:
        if mesh_obj.data.shape_keys:
            basis = mesh_obj.data.shape_keys.key_blocks[0]
            for name in ['Blink Left', 'Blink Right']:
                key = mesh_obj.data.shape_keys.key_blocks.get(name)
                if not key:
                    raise RuntimeError(f'Mint thiếu shape key {name}')
                max_delta = max((key.data[i].co - basis.data[i].co).length for i in range(len(basis.data)))
                if max_delta < 1e-4:
                    raise RuntimeError(f'Shape key {name} bị triệt tiêu sau transform')
            for key in list(mesh_obj.data.shape_keys.key_blocks)[1:]:
                if key.name not in ('Blink Left', 'Blink Right'):
                    mesh_obj.shape_key_remove(key)

    # Đổi tên xương sang chuẩn Mixamo để pipeline build-player-character và bake mocap dùng trực tiếp.
    for old_name, new_name in BONE_RENAMES.items():
        bone = rig.data.bones.get(old_name)
        if not bone:
            raise RuntimeError(f'Mint thiếu xương bắt buộc: {old_name}')
        bone.name = new_name
        for mesh_obj in meshes:
            vg = mesh_obj.vertex_groups.get(old_name)
            if vg:
                vg.name = new_name

    # Thu nhỏ các ảnh 2048x2048 xuống <= 1024px PNG để giữ ngân sách GPU/GLB trên trình duyệt.
    TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
    replacements = {}
    for image in list(bpy.data.images):
        if image.size[0] == 0 or image.size[1] == 0:
            continue
        if max(image.size) > 1024 or not image.filepath_raw.lower().endswith('.png'):
            if max(image.size) > 1024:
                factor = 1024 / max(image.size)
                image.scale(max(1, round(image.size[0] * factor)), max(1, round(image.size[1] * factor)))
            stem = Path(image.name).stem
            out_path = TEXTURE_DIR / f'{stem}.png'
            image.filepath_raw = str(out_path)
            image.file_format = 'PNG'
            image.save()
            replacement = bpy.data.images.load(str(out_path), check_existing=False)
            replacement.pack()
            replacements[image] = replacement

    if replacements:
        for material in bpy.data.materials:
            if not material.node_tree:
                continue
            for node in material.node_tree.nodes:
                if node.type == 'TEX_IMAGE' and node.image in replacements:
                    node.image = replacements[node.image]

    TARGET.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.file.pack_all()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(TARGET))
    print(f'MINT_SOURCE_READY: {TARGET} (images={[tuple(i.size) for i in replacements.values()]})')


if __name__ == '__main__':
    main()
