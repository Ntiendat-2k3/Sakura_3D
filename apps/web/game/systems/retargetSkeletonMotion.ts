/** Retarget mocap qua bind pose thật; khóa root ngang, giữ trục hông và bù parent rig theo model đích. */
import { AnimationClip, Bone, Matrix4, Object3D, PropertyBinding, Quaternion, QuaternionKeyframeTrack, SkinnedMesh, Vector3, VectorKeyframeTrack } from 'three';
import { createLoopingClip, type Motion } from './retargetClubMotion';

/** GLB đang ở tư thế tạo dáng; lấy bind pose thật từ skin rồi khôi phục ngay để không retarget trên pose trình diễn. */
export function readSkeletonBindPose(scene: Object3D, mapping: Record<string, string>) {
  let mesh: SkinnedMesh | undefined;
  scene.traverse(node => { if (!mesh && node instanceof SkinnedMesh) mesh = node; });
  if (!mesh) throw new Error('Rig thiếu skin');
  const skeleton = mesh.skeleton;
  const saved = skeleton.bones.map(node => ({ node, position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone() }));
  const rest = new Map<string, { node: Object3D; world: Quaternion; parentInverse: Quaternion; position: Vector3; height: number; parentScale: Vector3 }>();
  try {
    scene.updateWorldMatrix(true, true);
    const assetWorldInverse = new Matrix4().copy(scene.matrixWorld).invert();
    skeleton.pose();
    // Skeleton.pose bỏ qua parent không phải Bone; rig này có Armature xoay 90° nên phải bù parent đó.
    for (const bone of skeleton.bones) if (bone.parent && !(bone.parent instanceof Bone)) {
      const parentInAsset = new Matrix4().multiplyMatrices(assetWorldInverse, bone.parent.matrixWorld);
      bone.matrix.copy(parentInAsset).invert().multiply(bone.matrixWorld);
      bone.matrix.decompose(bone.position, bone.quaternion, bone.scale);
    }
    scene.updateWorldMatrix(true, true);
    const externalInverse = scene.parent?.getWorldQuaternion(new Quaternion()).invert() ?? new Quaternion();
    for (const [source, target] of Object.entries(mapping)) {
      const node = scene.getObjectByName(PropertyBinding.sanitizeNodeName(target));
      if (node) rest.set(`mixamorig${source}`, { node, world: node.getWorldQuaternion(new Quaternion()).premultiply(externalInverse), parentInverse: (node.parent?.getWorldQuaternion(new Quaternion()) ?? new Quaternion()).premultiply(externalInverse).invert(), position: node.position.clone(), height: node.getWorldPosition(new Vector3()).y - scene.getWorldPosition(new Vector3()).y, parentScale: node.parent?.getWorldScale(new Vector3()) ?? new Vector3(1, 1, 1) });
    }
  } finally {
    saved.forEach(({ node, position, quaternion, scale }) => { node.position.copy(position); node.quaternion.copy(quaternion); node.scale.copy(scale); });
    scene.updateWorldMatrix(true, true);
  }
  return rest;
}

export function retargetSkeletonMotion(motion: Motion, scene: Object3D, mapping: Record<string, string>, options: { name?: string; hipsLimit?: number; overlap?: number } = {}) {
  const rest = readSkeletonBindPose(scene, mapping);
  const tracks: (QuaternionKeyframeTrack | VectorKeyframeTrack)[] = [], q = new Quaternion(), extra = new Quaternion(), offset = new Vector3();
  const upperChest = motion.tracks.find(track => track.name === 'mixamorigSpine2.quaternion');
  const upperChestSource = motion.bones.mixamorigSpine2;
  const upperChestSample = upperChest ? new QuaternionKeyframeTrack('upperChest', upperChest.times, upperChest.values).createInterpolant() : null;
  const upperChestParent = new Quaternion().fromArray(upperChestSource?.parentWorld ?? [0, 0, 0, 1]);
  const upperChestInverse = new Quaternion().fromArray(upperChestSource?.restWorld ?? [0, 0, 0, 1]).invert();
  for (const track of motion.tracks) {
    const [name, property] = track.name.split('.'), target = rest.get(name), source = motion.bones[name];
    if (!target || !source) continue;
    if (name === 'mixamorigHips' && property === 'position' && motion.playback === 'natural') {
      const values: number[] = [], scale = target.height / source.position[1];
      for (let i = 0; i < track.values.length; i += 3) {
        const y = Math.max(-(options.hipsLimit ?? .4), Math.min(options.hipsLimit ?? .4, (track.values[i + 1] - source.position[1]) * scale));
        offset.set(0, y, 0).applyQuaternion(target.parentInverse).divide(target.parentScale).add(target.position).toArray(values, i);
      }
      tracks.push(new VectorKeyframeTrack(`${target.node.name}.position`, track.times, values));
      continue;
    }
    if (property !== 'quaternion') continue;
    const values = track.values.slice();
    const sourceParent = new Quaternion().fromArray(source.parentWorld), sourceInverse = new Quaternion().fromArray(source.restWorld).invert();
    for (let i = 0; i < values.length; i += 4) {
      q.fromArray(values, i).premultiply(sourceParent).multiply(sourceInverse);
      // Rig chỉ có Chest cần gộp đốt ngực trên; rig đủ Spine2 giữ hai chuyển động riêng.
      if (name === 'mixamorigSpine1' && !mapping.Spine2 && upperChestSample && upperChestSource) {
        extra.fromArray(upperChestSample.evaluate(track.times[i / 4])).premultiply(upperChestParent).multiply(upperChestInverse);
        q.multiply(extra);
      }
      q.premultiply(target.parentInverse).multiply(target.world).normalize().toArray(values, i);
    }
    tracks.push(new QuaternionKeyframeTrack(`${target.node.name}.quaternion`, track.times, values));
  }
  if (tracks.length < 15) throw new Error('Không đủ bone tương thích để retarget');
  // Giữ cao/thấp từ clip mới; vị trí ngang vẫn do root của người chơi hoặc NPC sở hữu.
  const clip = new AnimationClip(options.name ?? motion.id, motion.duration, tracks);
  return motion.playback === 'natural' ? createLoopingClip(clip, options.overlap) : clip;
}
