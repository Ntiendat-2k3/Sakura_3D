/** Tiện ích căn đế giày, giải IK hai khớp trên rig VRM và điều khiển di chuyển DJ bằng dáng đi chung Dwarf Walk. */
import { MathUtils, Quaternion, SkinnedMesh, Vector3, type Group, type Object3D } from 'three';
import type { VRM } from '@pixiv/three-vrm';
import { createRecordedClubDance, updateDanceRig } from './retargetClubMotion';

export const SHARED_WALK_CLIP_ID = 'Dwarf Walk' as const;

export type PatrolSample = { x: number; y?: number; z: number; yaw: number; distance: number; speed: number };
export type HostMotionRoute = { sample: (seconds: number, out: PatrolSample) => PatrolSample; path: (distance: number, out: PatrolSample) => PatrolSample; stride: number; speed: number };

/** Giải chuỗi hai xương theo world, giữ chiều dài; tùy chọn khóa hướng bàn chân hoặc để bàn tay theo cẳng tay. */
export function createTwoBoneIK(upper: Object3D, lower: Object3D, foot: Object3D) {
  const hip = new Vector3(), knee = new Vector3(), ankle = new Vector3(), direction = new Vector3(), bend = new Vector3(), wantedKnee = new Vector3();
  const source = new Vector3(), target = new Vector3(), delta = new Quaternion(), rotation = new Quaternion(), parent = new Quaternion();
  const rotateToward = (node: Object3D, child: Object3D, point: Vector3) => {
    node.getWorldPosition(source); child.getWorldPosition(target); target.sub(source).normalize();
    direction.copy(point).sub(source).normalize(); delta.setFromUnitVectors(target, direction);
    node.getWorldQuaternion(rotation).premultiply(delta); node.parent!.getWorldQuaternion(parent).invert();
    node.quaternion.copy(parent.multiply(rotation)); node.updateWorldMatrix(true, true);
  };
  return (goal: Vector3, pole: Vector3, flatFoot?: Quaternion) => {
    upper.getWorldPosition(hip); lower.getWorldPosition(knee); foot.getWorldPosition(ankle);
    const a = hip.distanceTo(knee), b = knee.distanceTo(ankle), length = MathUtils.clamp(hip.distanceTo(goal), Math.abs(a - b) + .00001, a + b - .00001);
    direction.copy(goal).sub(hip).normalize(); bend.copy(pole).addScaledVector(direction, -pole.dot(direction)).normalize();
    const along = (a * a - b * b + length * length) / (2 * length), height = Math.sqrt(Math.max(0, a * a - along * along));
    wantedKnee.copy(hip).addScaledVector(direction, along).addScaledVector(bend, height);
    rotateToward(upper, lower, wantedKnee); rotateToward(lower, foot, goal);
    if (flatFoot) { foot.parent!.getWorldQuaternion(parent).invert(); foot.quaternion.copy(parent.multiply(flatFoot)); foot.updateWorldMatrix(true, true); }
  };
}

/** Đo đế giày từ skin thực sau normalize, tránh bounding box chứa biên morph làm NPC lơ lửng trên sàn. */
export function alignVrmSoles(vrm: VRM, floorY: number) {
  vrm.update(0); vrm.scene.updateMatrixWorld(true);
  const meshes: SkinnedMesh[] = [], point = new Vector3();
  vrm.scene.traverse(node => { if (node instanceof SkinnedMesh) meshes.push(node); });
  let rawFloor = Infinity, soleFloor = Infinity;
  for (const mesh of meshes) {
    const positions = mesh.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) rawFloor = Math.min(rawFloor, point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).y);
  }
  for (const mesh of meshes) {
    const positions = mesh.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) if (point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).y <= rawFloor + .035) soleFloor = Math.min(soleFloor, mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld).y);
  }
  if (!Number.isFinite(soleFloor)) throw new Error('Không đo được đế giày VRM');
  const restAnkle = Math.min(...(['leftFoot', 'rightFoot'] as const).map(side => vrm.humanoid.getRawBoneNode(side)!.getWorldPosition(point).y));
  vrm.scene.position.y -= soleFloor - floorY; vrm.scene.updateMatrixWorld(true);
  return restAnkle - soleFloor;
}

/** Điều khiển di chuyển của NPC VRM (DJ Rio) theo quỹ đạo với dáng đi chung Dwarf Walk từ thư mục common. */
export function createHostLocomotion(
  vrm: VRM,
  footClearance: number,
  custom: HostMotionRoute,
  walk?: Awaited<ReturnType<typeof createRecordedClubDance>>,
) {
  const h = vrm.humanoid;
  const hips = h.getNormalizedBoneNode('hips')!;
  const route: PatrolSample = { x: 0, z: 0, yaw: 0, distance: 0, speed: 0 };
  const scale = new Vector3();
  const vrm0Sign = vrm.meta?.metaVersion === '0' ? -1 : 1;
  let initialized = false, ankleClearance = footClearance;
  return {
    route,
    get ankleClearance() { return ankleClearance; },
    update(seconds: number, delta: number, root: Group) {
      const dt = MathUtils.clamp(delta, 0, .05);
      custom.sample(seconds, route);
      const floorY = route.y ?? .086;
      root.position.set(route.x, floorY, route.z);
      root.rotation.y = route.yaw;

      if (!initialized) {
        h.resetNormalizedPose();
        vrm.scene.updateWorldMatrix(true, true);
        ankleClearance = alignVrmSoles(vrm, floorY);
      }

      const blink = Math.max(0, 1 - Math.abs(seconds % 4.6 - 4.3) / .1);
      if (route.speed > .04 && walk) {
        h.resetNormalizedPose();
        walk.update(seconds * 2, 0, seconds);
        vrm.expressionManager?.setValue('blink', blink);
        vrm.expressionManager?.setValue('relaxed', .2);
        updateDanceRig(vrm, dt, floorY + ankleClearance, !initialized);
        initialized = true;
        return;
      }

      // Khi DJ dừng trước mặt khách chờ chọn bài (phase === 'ready'), giữ dáng đứng tự nhiên nhìn về khách.
      h.resetNormalizedPose();
      vrm.scene.updateWorldMatrix(true, true);
      hips.parent!.getWorldScale(scale);
      const breathe = Math.sin(seconds * 1.7);
      hips.position.y -= (.02 + .005 * (1 + breathe)) / scale.y;
      h.getNormalizedBoneNode('spine')?.rotation.set(.02 * breathe * vrm0Sign, .02 * Math.sin(seconds * .9), 0);
      h.getNormalizedBoneNode('head')?.rotation.set(.015 * breathe * vrm0Sign, .05 * Math.sin(seconds * .55), 0);
      for (const side of ['left', 'right'] as const) {
        const upperArm = h.getNormalizedBoneNode(`${side}UpperArm`);
        const lowerArm = h.getNormalizedBoneNode(`${side}LowerArm`);
        const dir = (side === 'left' ? 1 : -1) * vrm0Sign;
        if (upperArm) upperArm.rotation.set(.06 * vrm0Sign, 0, dir * 1.18);
        if (lowerArm) lowerArm.rotation.set(.18 * vrm0Sign, 0, dir * .12);
      }
      vrm.expressionManager?.setValue('blink', blink);
      vrm.expressionManager?.setValue('happy', .25);
      updateDanceRig(vrm, dt, floorY + ankleClearance, !initialized);
      initialized = true;
    },
  };
}
