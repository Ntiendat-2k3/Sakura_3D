/** Tuần tra sàn club với quỹ đạo bo góc, bước chân neo theo mặt đất và IK hai khớp trên rig VRM. */
import { MathUtils, Quaternion, SkinnedMesh, Vector3, type Group, type Object3D } from 'three';
import type { VRM } from '@pixiv/three-vrm';

const STRIDE = .64, SPEED = .55, ACCEL = .6, PAUSE = 1.8, RADIUS = .8;
// Chia chu vi thành số nguyên chu kỳ bước để điểm nghỉ không rơi vào lúc chân đang vung.
const QUARTER_DISTANCE = 11 * STRIDE;
const LOOP_DISTANCE = QUARTER_DISTANCE * 4;
const X_MAX = 4.4, Z_MAX = 4.2;
const WIDTH = X_MAX * 2;
const DEPTH = (LOOP_DISTANCE - 2 * WIDTH + 8 * RADIUS - 2 * Math.PI * RADIUS) / 2;
const Z_MIN = Z_MAX - DEPTH;
const TRAVEL_TIME = QUARTER_DISTANCE / SPEED + ACCEL;
const PERIOD = TRAVEL_TIME + PAUSE;
const Y_AXIS = new Vector3(0, 1, 0);
const mod = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;

export type PatrolSample = { x: number; y?: number; z: number; yaw: number; distance: number; speed: number };
export type HostMotionRoute = { sample: (seconds: number, out: PatrolSample) => PatrolSample; path: (distance: number, out: PatrolSample) => PatrolSample; stride: number; speed: number };
export type FootSample = { position: Vector3; yaw: number; planted: boolean };

/** Trả điểm theo độ dài cung để tốc độ không thay đổi khi vào góc bo. Không tạo state mạng mới. */
export function sampleHostPath(distance: number, out: PatrolSample): PatrolSample {
  let d = mod(distance, LOOP_DISTANCE);
  const vertical = DEPTH - 2 * RADIUS, horizontal = WIDTH - 2 * RADIUS, arc = Math.PI * RADIUS / 2;
  const straight = (length: number, x: number, z: number, dx: number, dz: number) => {
    if (d <= length) { out.x = x + dx * d; out.z = z + dz * d; out.yaw = Math.atan2(dx, dz); return true; }
    d -= length; return false;
  };
  const corner = (x: number, z: number, start: number) => {
    if (d <= arc) { const angle = start - d / RADIUS; out.x = x + Math.cos(angle) * RADIUS; out.z = z + Math.sin(angle) * RADIUS; out.yaw = Math.atan2(Math.sin(angle), -Math.cos(angle)); return true; }
    d -= arc; return false;
  };
  if (straight(vertical, X_MAX, Z_MAX - RADIUS, 0, -1)
    || corner(X_MAX - RADIUS, Z_MIN + RADIUS, 0)
    || straight(horizontal, X_MAX - RADIUS, Z_MIN, -1, 0)
    || corner(-X_MAX + RADIUS, Z_MIN + RADIUS, -Math.PI / 2)
    || straight(vertical, -X_MAX, Z_MIN + RADIUS, 0, 1)
    || corner(-X_MAX + RADIUS, Z_MAX - RADIUS, -Math.PI)
    || straight(horizontal, -X_MAX + RADIUS, Z_MAX, 1, 0)
    || corner(X_MAX - RADIUS, Z_MAX - RADIUS, -Math.PI * 1.5)) return out;
  out.x = X_MAX; out.z = Z_MAX - RADIUS; out.yaw = Math.PI;
  return out;
}

/** Dừng chỉ tại bội số một chu kỳ bước, để hai chân chạm sàn; tăng/giảm tốc có gia tốc đầu-cuối bằng 0. */
export function sampleHostPatrol(seconds: number, out: PatrolSample): PatrolSample {
  const time = Math.max(0, Number.isFinite(seconds) ? seconds : 0), segment = Math.floor(time / PERIOD), phase = time % PERIOD;
  const integrated = (u: number) => SPEED * ACCEL * (u ** 3 - .5 * u ** 4);
  let distance = QUARTER_DISTANCE, speed = 0;
  if (phase < ACCEL) { const u = phase / ACCEL; distance = integrated(u); speed = SPEED * u * u * (3 - 2 * u); }
  else if (phase < TRAVEL_TIME - ACCEL) { distance = SPEED * (phase - ACCEL / 2); speed = SPEED; }
  else if (phase < TRAVEL_TIME) { const u = (TRAVEL_TIME - phase) / ACCEL; distance = QUARTER_DISTANCE - integrated(u); speed = SPEED * u * u * (3 - 2 * u); }
  out.distance = segment * QUARTER_DISTANCE + distance; out.speed = speed;
  return sampleHostPath(out.distance, out);
}

/** Pha chống chân trả đúng cùng tọa độ world; pha vung chân nối hai điểm đặt chân với cung nâng mũi giày. */
export function sampleHostFoot(distance: number, offset: number, lateral: number, ankleY: number, out: FootSample, scratch: PatrolSample, path = sampleHostPath, stride = STRIDE): FootSample {
  const cycles = distance / stride + offset, cycle = Math.floor(cycles), phase = mod(cycles, 1);
  const contact = (cycle - offset) * stride, from = contact + .3 * stride;
  path(from, scratch);
  const x = scratch.x + Math.cos(scratch.yaw) * lateral, z = scratch.z - Math.sin(scratch.yaw) * lateral, yaw = scratch.yaw;
  out.position.set(x, ankleY + (scratch.y ?? 0), z); out.yaw = yaw; out.planted = phase < .6;
  if (!out.planted) {
    const t = (phase - .6) / .4, smooth = t * t * (3 - 2 * t);
    path(from + stride, scratch);
    out.position.x = MathUtils.lerp(x, scratch.x + Math.cos(scratch.yaw) * lateral, smooth);
    out.position.z = MathUtils.lerp(z, scratch.z - Math.sin(scratch.yaw) * lateral, smooth);
    out.position.y = MathUtils.lerp(out.position.y, ankleY + (scratch.y ?? 0), smooth) + .025 * Math.sin(Math.PI * t) + .065 * Math.sin(Math.PI * t) ** 2;
    out.yaw = yaw + Math.atan2(Math.sin(scratch.yaw - yaw), Math.cos(scratch.yaw - yaw)) * smooth;
  }
  return out;
}

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

export function createHostLocomotion(vrm: VRM, footClearance: number, custom?: HostMotionRoute) {
  const stride = custom?.stride ?? STRIDE, speed = custom?.speed ?? SPEED;
  const h = vrm.humanoid;
  const hips = h.getNormalizedBoneNode('hips')!;
  const feet = (['left', 'right'] as const).map(side => {
    const upper = h.getNormalizedBoneNode(`${side}UpperLeg`)!, lower = h.getNormalizedBoneNode(`${side}LowerLeg`)!, foot = h.getNormalizedBoneNode(`${side}Foot`)!;
    return { upper, lower, foot, solve: createTwoBoneIK(upper, lower, foot), sample: { position: new Vector3(), yaw: 0, planted: true }, flat: new Quaternion(), lateral: 0 };
  });
  const arms = (['left', 'right'] as const).map(side => {
    const upper = h.getNormalizedBoneNode(`${side}UpperArm`)!, lower = h.getNormalizedBoneNode(`${side}LowerArm`)!, hand = h.getNormalizedBoneNode(`${side}Hand`)!;
    return { upper, lower, hand, solve: createTwoBoneIK(upper, lower, hand) };
  });
  const route: PatrolSample = { x: 0, z: 0, yaw: 0, distance: 0, speed: 0 }, scratch = { ...route };
  const forward = new Vector3(), point = new Vector3(), scale = new Vector3(), right = new Vector3(), armGoal = new Vector3(), elbow = new Vector3(), hand = new Vector3(), outward = new Vector3(), pole = new Vector3(), yawRotation = new Quaternion(), pitchRotation = new Quaternion();
  let initialized = false, ankleClearance = footClearance;
  return {
    feet, route,
    get ankleClearance() { return ankleClearance; },
    update(seconds: number, delta: number, root: Group) {
      (custom?.sample ?? sampleHostPatrol)(seconds, route);
      root.position.set(route.x, route.y ?? .086, route.z); root.rotation.y = route.yaw;
      h.resetNormalizedPose(); vrm.scene.updateWorldMatrix(true, true);
      if (!initialized) {
        ankleClearance = alignVrmSoles(vrm, root.position.y);
        const rightX = Math.cos(route.yaw), rightZ = -Math.sin(route.yaw);
        feet.forEach(leg => { leg.foot.getWorldPosition(point); leg.lateral = (point.x - root.position.x) * rightX + (point.z - root.position.z) * rightZ; });
        initialized = true;
      }
      hips.parent!.getWorldScale(scale);
      feet.forEach((leg, i) => sampleHostFoot(route.distance, i * .5, leg.lateral, (custom ? 0 : root.position.y) + ankleClearance, leg.sample, scratch, custom?.path, stride));
      // Khi lên/xuống bậc, hạ trọng tâm theo chân thấp hơn để không kéo quá chiều dài chân trụ.
      const stairDrop = custom ? Math.max(0, root.position.y + ankleClearance - Math.min(...feet.map(leg => leg.sample.position.y))) : 0;
      hips.position.y -= stairDrop / scale.y;
      hips.position.y -= (.035 + .006 * (1 - Math.cos(route.distance / stride * Math.PI * 4)) * route.speed / speed) / scale.y;
      const swing = -Math.cos(route.distance / stride * Math.PI * 2), intensity = MathUtils.clamp(route.speed / speed, 0, 1);
      h.getNormalizedBoneNode('spine')?.rotation.set(.01 * Math.sin(seconds * 1.6), .025 * swing * intensity, .01 * swing * intensity);
      h.getNormalizedBoneNode('head')?.rotation.set(0, .06 * Math.sin(seconds * .45) * (1 - intensity), 0);
      vrm.scene.updateWorldMatrix(true, true); forward.set(Math.sin(route.yaw), 0, Math.cos(route.yaw));
      // Hướng trục tay VRM 0.x không nên suy đoán bằng góc Z cố định; đặt cổ tay world và giải khuỷu tay.
      pole.copy(forward).negate();
      arms.forEach((arm, i) => {
        arm.upper.getWorldPosition(point); arm.lower.getWorldPosition(elbow); arm.hand.getWorldPosition(hand);
        const length = point.distanceTo(elbow) + elbow.distanceTo(hand), offset = .035 + (i === 0 ? 1 : -1) * .12 * swing * intensity;
        arms[1 - i].upper.getWorldPosition(outward); outward.subVectors(point, outward); outward.y = 0; outward.normalize();
        armGoal.copy(point).addScaledVector(forward, offset).addScaledVector(outward, .06); armGoal.y -= Math.sqrt(Math.max(.001, (length * .96) ** 2 - offset * offset - .06 ** 2));
        arm.solve(armGoal, pole);
      });
      feet.forEach((leg, i) => {
        leg.foot.getWorldQuaternion(leg.flat);
        yawRotation.setFromAxisAngle(Y_AXIS, leg.sample.yaw - route.yaw); leg.flat.premultiply(yawRotation);
        if (!leg.sample.planted) {
          const phase = (mod(route.distance / stride + i * .5, 1) - .6) / .4;
          right.set(Math.cos(leg.sample.yaw), 0, -Math.sin(leg.sample.yaw));
          pitchRotation.setFromAxisAngle(right, .12 * Math.sin(Math.PI * 2 * phase)); leg.flat.premultiply(pitchRotation);
        }
        leg.solve(leg.sample.position, forward, leg.flat);
      });
      vrm.expressionManager?.setValue('blink', Math.max(0, 1 - Math.abs(seconds % 4.6 - 4.3) / .1));
      vrm.update(Math.min(delta, .05)); vrm.scene.updateWorldMatrix(true, true); vrm.scene.updateMatrixWorld(true);
    },
  };
}
