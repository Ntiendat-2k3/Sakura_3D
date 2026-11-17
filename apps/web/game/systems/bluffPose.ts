import { Matrix4, Quaternion, Vector3, type Object3D } from 'three';

/** aim/slump là của người cầm súng; flip/point/slam/laugh là cà khịa (thoáng qua, nhường aim/slump). */
export type BluffPose = 'aim' | 'slump' | 'flip' | 'point' | 'slam' | 'laugh' | null;

/** Người cầm súng không thể vừa chĩa súng vừa cà khịa: tư thế bắn luôn thắng. */
export function resolveAvatarPose(shooterPose: BluffPose, taunt: BluffPose): BluffPose {
  return shooterPose ?? taunt;
}

/**
 * Rig người chơi dùng tên xương kiểu Mixamo không tiền tố (Spine2, Neck, Head, RightArm, RightForeArm, RightHand),
 * nhưng hướng trục cục bộ của xương KHÁC NHAU giữa các mẫu (rig cm của Blender vs rig mét của ubel/yui/mint).
 * Vì vậy mọi tư thế được tính trong hệ trục của model (gốc avatar: +Z trước mặt, +Y lên, −X là phía tay phải)
 * rồi đổi ngược về hệ cục bộ của từng xương, thay vì cộng góc Euler cục bộ cố định.
 * Vẫn khớp theo hậu tố (`mixamorig:RightArm`, `..._RightArm`) phòng khi rig khác xuất ra có tiền tố.
 */

/** Độ cao tâm đầu khi ngồi so với gốc avatar (m). Đo trên 9 mẫu ở clip Sit: 1.38–1.58 (xem test kohaku-bluff.spec). */
export const BLUFF_SEATED_HEAD_HEIGHT = 1.48;

/** Điểm thái dương phải so với xương Head, trong hệ model (m): lệch phải ~nửa bề ngang đầu, cao hơn gốc sọ. */
const TEMPLE_OFFSET = new Vector3(-0.14, 0.11, 0.03);
/** Hướng nòng (từ đầu nòng vào thái dương): chủ yếu vào trong (+X), hơi chúi xuống và hơi về sau để bàn tay nằm trước thái dương, camera trước mặt thấy được. */
const BARREL_DIRECTION = new Vector3(1, -0.1, -0.35).normalize();
/**
 * Tỉ lệ súng so với revolver.glb (dài 0.33 m). Tay các mẫu anime chỉ với được 0.37–0.52 m: ở cỡ gốc cổ tay phải nằm
 * cách thái dương ~0.5 m nên tay duỗi thẳng ra ngang và súng quay ngược vào đầu. Dùng chung cho súng trên bàn để không đổi cỡ khi cầm lên.
 */
export const BLUFF_GUN_SCALE = 0.72;
/** Tầm với vai → cổ tay (m) mà BLUFF_GUN_SCALE được chỉnh cho; mẫu tay ngắn hơn (yui 0.37 m) thu nhỏ súng theo tỉ lệ. */
const REFERENCE_ARM_REACH = 0.45;
/** Đầu nòng trong hệ của revolver.glb (node `muzzle`), chưa nhân BLUFF_GUN_SCALE. */
export const BLUFF_GUN_MUZZLE = new Vector3(0, 0.054, 0.278);
/**
 * Vị trí cổ tay (gốc xương RightHand) trong hệ súng (+Z nòng, +Y sống súng; báng ở z ≈ −0.02, y −0.11…0):
 * sau gáy báng và lệch sang −X (phía bàn tay phải áp vào báng) để lòng bàn tay ôm báng thay vì xuyên qua thân súng.
 */
const GUN_WRIST = new Vector3(-0.028, -0.08, -0.095);
/** Hướng cổ tay → khớp ngón giữa trong hệ súng: ra trước, hơi ngóc lên theo độ nghiêng của báng. */
const HAND_FORWARD = new Vector3(0, 0.3, 1).normalize();
/** Hướng khớp ngón út → khớp ngón trỏ trong hệ súng: ngón trỏ ở trên (sát cò), ngón út ở dưới đáy báng. */
const HAND_KNUCKLES_UP = new Vector3(0, 1, 0);
/**
 * Góc cuộn mỗi đốt ngón (rad) quanh trục khớp ngón, dương = gập về phía lòng bàn tay (+X hệ súng) để ôm báng.
 * Ngón trỏ gập ít hơn vì đặt trên cò; ngón cái gập nhẹ vòng qua phía bên kia báng.
 */
const FINGER_CURL: [string, number][] = [
  ['Index', 0.55], ['Middle', 1.05], ['Ring', 1.1], ['Pinky', 1.15],
];
const THUMB_CURL = 0.45;
const FINGER_BONES = FINGER_CURL.flatMap(([finger]) => [1, 2, 3].map(i => `RightHand${finger}${i}`));
const THUMB_BONES = [1, 2, 3].map(i => `RightHandThumb${i}`);
/**
 * Khuỷu tay hướng ra ngoài (−X) và xuống dưới, hơi ra trước (hệ model): cẳng tay đi chéo lên tới cạnh đầu.
 */
const ELBOW_POLE = new Vector3(-0.6, -1, 0.1).normalize();
/**
 * Gục: gập quanh trục ngang của model (+X), dương = đỉnh đầu đổ về trước. Mỗi mục là danh sách tên thay thế:
 * rig yui không có Spine2 (Head < Neck < Spine1), khi đó phần gập ngực dồn vào Spine1.
 * Đây là tỉ lệ giữa các đốt; độ gập tổng được dò theo từng rig để đầu chạm mặt bàn (SLUMP_HEAD_HEIGHT).
 */
const SLUMP_ANGLES: [string[], number][] = [[['Spine1'], 0.6], [['Spine2', 'Spine1'], 0.75], [['Neck'], 0.45], [['Head'], 0.3]];
/** Độ cao xương Head (gốc sọ) so với gốc avatar khi gục: mặt bàn ở 0.97 m, má áp xuống bàn. */
export const SLUMP_HEAD_HEIGHT = 1.1;
/** Giới hạn hệ số nhân góc gục khi dò: rig nào cũng gập ít nhất như cũ, không gập quá gấp đôi. */
const SLUMP_SCALE_RANGE = [1, 2] as const;
/** Đầu nghiêng sang một bên (quanh trục trước mặt) để má áp bàn thay vì cắm trán xuống. */
const SLUMP_HEAD_ROLL = 0.45;

/** Hướng súng trong hệ model: trục +Z (nòng) theo BARREL_DIRECTION, trục +Y (sống súng) hướng lên. */
const GUN_MODEL_QUATERNION = (() => {
  const z = BARREL_DIRECTION.clone();
  const x = new Vector3(0, 1, 0).cross(z).normalize();
  const y = z.clone().cross(x);
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
})();

const AIM_BONES = ['RightArm', 'RightForeArm', 'RightHand'];
const LEFT_ARM_BONES = ['LeftArm', 'LeftForeArm', 'LeftHand'];
const ALL_NAMES = [...new Set([...SLUMP_ANGLES.flatMap(([names]) => names), ...AIM_BONES, ...LEFT_ARM_BONES, ...FINGER_BONES, ...THUMB_BONES])];

/** Mixer chỉ ghi đè xương khi giá trị clip đổi (clip Sit đứng yên); xương không bị ghi sẽ giữ giá trị ta đã đặt, nên phải nhớ nền để không cộng dồn qua từng frame. */
type BoneState = { base: Quaternion; result: Quaternion };
const states = new WeakMap<Object3D, BoneState>();
const boneIndex = new WeakMap<Object3D, Map<string, Object3D | null>>();
const full = new Map<Object3D, Quaternion>();
const v1 = new Vector3(), v2 = new Vector3(), v3 = new Vector3(), v4 = new Vector3(), v5 = new Vector3();
const q1 = new Quaternion(), q2 = new Quaternion(), rootQuaternion = new Quaternion();
const m1 = new Matrix4();

/** Cache cả kết quả "không thấy": rig thiếu xương sẽ không bị traverse lại mỗi frame (cây clone đã dựng xong khi gọi). */
function findBone(root: Object3D, name: string): Object3D | null {
  let index = boneIndex.get(root);
  if (!index) { index = new Map(); boneIndex.set(root, index); }
  const cached = index.get(name);
  if (cached !== undefined) return cached;
  let found: Object3D | null = root.getObjectByName(name) ?? null;
  if (!found) root.traverse(node => { if (!found && node.name.length > name.length && node.name.endsWith(name) && /[^A-Za-z0-9]/.test(node.name[node.name.length - name.length - 1])) found = node; });
  index.set(name, found);
  return found;
}

/** Quay xương thêm `rotation` (trong hệ thế giới) rồi cập nhật ma trận cây con để bước sau đọc đúng vị trí. */
function rotateWorld(bone: Object3D, rotation: Quaternion) {
  const parent = q1.identity();
  if (bone.parent) bone.parent.getWorldQuaternion(parent);
  // local mới = P⁻¹ · R · P · local, với P là hướng thế giới của xương cha.
  bone.quaternion.premultiply(parent).premultiply(rotation).premultiply(parent.invert()).normalize();
  bone.updateWorldMatrix(false, true);
}

/** Quay xương để hướng từ gốc nó tới `tip` (vị trí thế giới hiện tại) trỏ về `target`. */
function aimBone(bone: Object3D, tip: Vector3, target: Vector3) {
  const origin = bone.getWorldPosition(v4);
  const from = v5.subVectors(tip, origin);
  const to = q2.identity();
  if (from.lengthSq() < 1e-10) return;
  from.normalize();
  const dir = target.clone().sub(origin);
  if (dir.lengthSq() < 1e-10) return;
  rotateWorld(bone, to.setFromUnitVectors(from, dir.normalize()));
}

const gunScales = new WeakMap<Object3D, number>();
/** Cỡ súng trong tay của rig này: khoảng cách giữa các khớp không đổi khi xoay nên đo một lần rồi cache. */
function handGunScale(root: Object3D): number {
  const cached = gunScales.get(root);
  if (cached !== undefined) return cached;
  const [upper, lower, hand] = AIM_BONES.map(name => findBone(root, name));
  let scale = BLUFF_GUN_SCALE;
  if (upper && lower && hand) {
    root.updateWorldMatrix(true, true);
    const elbow = lower.getWorldPosition(new Vector3());
    const reach = upper.getWorldPosition(new Vector3()).distanceTo(elbow) + elbow.distanceTo(hand.getWorldPosition(new Vector3()));
    scale = BLUFF_GUN_SCALE * Math.min(1, reach / REFERENCE_ARM_REACH);
  }
  gunScales.set(root, scale);
  return scale;
}

/** Đặt điểm cổ tay (hệ thế giới) mà tay phải cần với tới để đầu nòng chạm thái dương. */
function wristTarget(root: Object3D, head: Object3D, out: Vector3) {
  root.getWorldQuaternion(rootQuaternion);
  const temple = head.getWorldPosition(out).add(v1.copy(TEMPLE_OFFSET).applyQuaternion(rootQuaternion));
  // cổ tay = thái dương − R·s·(muzzle − wrist), R = hướng súng trong thế giới, s = handGunScale.
  q2.copy(rootQuaternion).multiply(GUN_MODEL_QUATERNION);
  return temple.sub(v1.copy(BLUFF_GUN_MUZZLE).sub(GUN_WRIST).multiplyScalar(handGunScale(root)).applyQuaternion(q2));
}

/**
 * Xoay bàn tay theo đủ hai trục (cổ tay → ngón giữa, ngón út → ngón trỏ) rồi cuộn ngón quanh báng.
 * Chỉ ngắm một trục thì bàn tay còn tự do lăn quanh trục đó: trên rig thật lòng bàn tay nằm ngang, ngón trỏ dưới ngón út,
 * nên báng súng nổi lơ lửng phía trên bàn tay.
 */
function orientGrip(root: Object3D, hand: Object3D) {
  const middle = findBone(root, 'RightHandMiddle1');
  if (!middle) return;
  const gun = q2.copy(rootQuaternion).multiply(GUN_MODEL_QUATERNION).clone();
  const wrist = hand.getWorldPosition(new Vector3());
  const forward = HAND_FORWARD.clone().applyQuaternion(gun);
  const align = new Quaternion().setFromUnitVectors(middle.getWorldPosition(new Vector3()).sub(wrist).normalize(), forward);
  const index = findBone(root, 'RightHandIndex1'), pinky = findBone(root, 'RightHandPinky1');
  if (index && pinky) {
    // Sau khi khớp trục trước, lăn quanh chính trục đó để hàng khớp ngón đứng dọc theo báng.
    const knuckles = index.getWorldPosition(new Vector3()).sub(pinky.getWorldPosition(new Vector3())).applyQuaternion(align);
    const up = HAND_KNUCKLES_UP.clone().applyQuaternion(gun);
    knuckles.addScaledVector(forward, -knuckles.dot(forward));
    up.addScaledVector(forward, -up.dot(forward));
    if (knuckles.lengthSq() > 1e-10 && up.lengthSq() > 1e-10) align.premultiply(new Quaternion().setFromUnitVectors(knuckles.normalize(), up.normalize()));
  }
  rotateWorld(hand, align);
  const curlAxis = HAND_KNUCKLES_UP.clone().applyQuaternion(gun);
  for (const [finger, angle] of FINGER_CURL) {
    for (let i = 1; i <= 3; i++) {
      const bone = findBone(root, `RightHand${finger}${i}`);
      if (bone) rotateWorld(bone, new Quaternion().setFromAxisAngle(curlAxis, angle));
    }
  }
  // Ngón cái nằm phía bên kia báng: gập quanh trục cổ tay → ngón giữa thay vì trục khớp ngón.
  for (const name of THUMB_BONES) {
    const bone = findBone(root, name);
    if (bone) rotateWorld(bone, new Quaternion().setFromAxisAngle(forward, -THUMB_CURL));
  }
}

/** IK hai đoạn vai → khuỷu → cổ tay theo cosin; khuỷu cong về phía `poleWorld` (đã ở hệ thế giới). */
function twoBoneIk(upper: Object3D, lower: Object3D, hand: Object3D, target: Vector3, poleWorld: Vector3): boolean {
  const shoulder = upper.getWorldPosition(new Vector3());
  const elbow = lower.getWorldPosition(new Vector3());
  const wrist = hand.getWorldPosition(new Vector3());
  const a = shoulder.distanceTo(elbow), b = elbow.distanceTo(wrist);
  if (a < 1e-6 || b < 1e-6) return false;
  const toTarget = v2.subVectors(target, shoulder);
  const d = Math.min(Math.max(toTarget.length(), Math.abs(a - b) + 1e-4), a + b - 1e-4);
  const axis = toTarget.normalize();
  // Thành phần của pole vuông góc với trục vai → cổ tay quyết định khuỷu cong về phía nào.
  const pole = v3.copy(poleWorld);
  pole.addScaledVector(axis, -pole.dot(axis));
  if (pole.lengthSq() < 1e-8) pole.subVectors(elbow, shoulder).addScaledVector(axis, -v1.subVectors(elbow, shoulder).dot(axis));
  pole.normalize();
  const cosA = Math.min(Math.max((a * a + d * d - b * b) / (2 * a * d), -1), 1);
  const elbowTarget = shoulder.clone().addScaledVector(axis, a * cosA).addScaledVector(pole, a * Math.sqrt(1 - cosA * cosA));
  aimBone(upper, elbow, elbowTarget);
  const reach = shoulder.clone().addScaledVector(axis, d);
  aimBone(lower, hand.getWorldPosition(wrist), reach);
  return true;
}

/** IK tay phải RightArm → RightForeArm → RightHand tới thái dương, khuỷu hướng theo ELBOW_POLE. */
function solveAim(root: Object3D): boolean {
  const head = findBone(root, 'Head');
  const [upper, lower, hand] = AIM_BONES.map(name => findBone(root, name));
  if (!head || !upper || !lower || !hand) return false;
  const target = wristTarget(root, head, new Vector3());
  if (!twoBoneIk(upper, lower, hand, target, new Vector3().copy(ELBOW_POLE).applyQuaternion(rootQuaternion))) return false;
  orientGrip(root, hand);
  return true;
}

function solveSlump(root: Object3D) {
  root.getWorldQuaternion(rootQuaternion);
  const axis = new Vector3(1, 0, 0).applyQuaternion(rootQuaternion);
  const bones = SLUMP_ANGLES.map(([names, angle]) => [names.map(name => findBone(root, name)).find(Boolean), angle] as const)
    .filter((entry): entry is readonly [Object3D, number] => !!entry[0]);
  const base = bones.map(([bone]) => bone.quaternion.clone());
  const head = findBone(root, 'Head');
  const floorY = root.getWorldPosition(new Vector3()).y;
  const bend = (scale: number) => {
    bones.forEach(([bone], i) => { bone.quaternion.copy(base[i]); bone.updateWorldMatrix(false, true); });
    for (const [bone, angle] of bones) rotateWorld(bone, q2.setFromAxisAngle(axis, angle * scale));
  };
  // Chiều cao/tỉ lệ thân khác nhau giữa các mẫu: dò nhị phân hệ số gập để gốc sọ hạ xuống đúng tầm mặt bàn.
  let [low, high]: number[] = [...SLUMP_SCALE_RANGE];
  if (head) {
    for (let i = 0; i < 8; i++) {
      const mid = (low + high) / 2;
      bend(mid);
      if (head.getWorldPosition(v1).y - floorY > SLUMP_HEAD_HEIGHT) low = mid; else high = mid;
    }
  }
  bend(head ? low : SLUMP_SCALE_RANGE[0]);
  if (head) rotateWorld(head, q2.setFromAxisAngle(v1.set(0, 0, 1).applyQuaternion(rootQuaternion), SLUMP_HEAD_ROLL));
}

/** Mặt bàn Kohaku cao 0.97 m: cổ tay khi đập bàn nằm sát trên mặt bàn. */
const TABLE_WRIST_HEIGHT = 1.0;
/** Độ gập mỗi đốt ngón khi nắm tay (rad); 3 đốt cộng lại đủ cuộn ngón vào lòng bàn tay. */
const FIST_CURL = 1.15;
const FIST_THUMB_CURL = 0.5;
/** Xoay thân trên về phía đích tối đa (rad), phần còn lại do cánh tay tự với. */
const TAUNT_TWIST_MAX = 0.45;
const TAUNT_FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'];

/** Pháp tuyến lòng bàn tay phải (phía ngón gập vào), suy từ độ cong sẵn có của ngón giữa, thiếu thì nhờ ngón cái. */
function palmNormal(root: Object3D, hand: Object3D): Vector3 | null {
  const [index1, pinky1, m1, m2, m3] = ['RightHandIndex1', 'RightHandPinky1', 'RightHandMiddle1', 'RightHandMiddle2', 'RightHandMiddle3'].map(name => findBone(root, name));
  if (!index1 || !pinky1 || !m1) return null;
  const wrist = hand.getWorldPosition(new Vector3());
  const forward = m1.getWorldPosition(new Vector3()).sub(wrist).normalize();
  const normal = index1.getWorldPosition(new Vector3()).sub(pinky1.getWorldPosition(new Vector3())).cross(forward).normalize();
  // Tích có hướng chỉ cho trục, chưa cho chiều: ngón luôn hơi cong về phía lòng bàn tay, ngón cái cũng nằm phía đó.
  let hint = new Vector3();
  if (m2 && m3) {
    const p1 = m1.getWorldPosition(new Vector3()), p2 = m2.getWorldPosition(new Vector3()), p3 = m3.getWorldPosition(new Vector3());
    hint = p3.clone().sub(p2).normalize().sub(p2.clone().sub(p1).normalize());
  }
  if (hint.lengthSq() < 0.0025) {
    const thumb = findBone(root, 'RightHandThumb3') ?? findBone(root, 'RightHandThumb2');
    if (thumb) hint = thumb.getWorldPosition(new Vector3()).sub(wrist);
  }
  if (normal.dot(hint) < 0) normal.negate();
  return normal;
}

/** Xoay bàn tay phải để hướng cổ tay → ngón giữa theo `forward`, rồi lăn quanh trục đó để lòng bàn tay nhìn theo `palm`. */
function orientHand(root: Object3D, hand: Object3D, forward: Vector3, palm: Vector3) {
  const middle = findBone(root, 'RightHandMiddle1');
  if (!middle) return;
  const wrist = hand.getWorldPosition(new Vector3());
  rotateWorld(hand, new Quaternion().setFromUnitVectors(middle.getWorldPosition(new Vector3()).sub(wrist).normalize(), forward));
  const current = palmNormal(root, hand);
  if (!current) return;
  const want = palm.clone().addScaledVector(forward, -palm.dot(forward));
  current.addScaledVector(forward, -current.dot(forward));
  if (want.lengthSq() > 1e-8 && current.lengthSq() > 1e-8) rotateWorld(hand, new Quaternion().setFromUnitVectors(current.normalize(), want.normalize()));
}

/** Nắm các ngón tay phải trừ `extended` (nắn thẳng theo bàn tay); ngón cái gập nhẹ vào lòng. */
function makeFist(root: Object3D, hand: Object3D, extended: string | null) {
  const palm = palmNormal(root, hand);
  if (!palm) return;
  const wrist = hand.getWorldPosition(new Vector3());
  for (const finger of TAUNT_FINGERS) {
    const bones = [1, 2, 3].map(i => findBone(root, `RightHand${finger}${i}`));
    if (!bones[0]) continue;
    const along = bones[0].getWorldPosition(new Vector3()).sub(wrist).normalize();
    if (finger === extended) {
      // Clip Sit để ngón hơi cong nên phải nắn thẳng từng đốt theo hướng cổ tay → khớp ngón.
      for (let i = 0; i < 2; i++) {
        const bone = bones[i], child = bones[i + 1];
        if (bone && child) aimBone(bone, child.getWorldPosition(new Vector3()), bone.getWorldPosition(new Vector3()).add(along));
      }
      continue;
    }
    const axis = along.clone().cross(palm).normalize();
    for (const bone of bones) if (bone) rotateWorld(bone, new Quaternion().setFromAxisAngle(axis, FIST_CURL));
  }
  const forward = (findBone(root, 'RightHandMiddle1') ?? hand).getWorldPosition(new Vector3()).sub(wrist).normalize();
  for (const name of THUMB_BONES) {
    const bone = findBone(root, name);
    if (bone) rotateWorld(bone, new Quaternion().setFromAxisAngle(forward, -FIST_THUMB_CURL));
  }
}

/** Xoay thân trên (Spine2, rig thiếu thì Spine1) quanh trục đứng một góc `angle`. */
function twistChest(root: Object3D, angle: number) {
  const chest = findBone(root, 'Spine2') ?? findBone(root, 'Spine1');
  if (chest && Math.abs(angle) > 1e-5) rotateWorld(chest, new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0).applyQuaternion(rootQuaternion), angle));
}

/**
 * Cà khịa trong hệ model (+Z trước mặt, −X tay phải): flip/point vươn tay phải về đích, slam hai tay đập mặt bàn,
 * laugh che miệng và rung vai theo `t` (giây). Thiếu xương thì bỏ qua.
 */
function solveTaunt(root: Object3D, pose: 'flip' | 'point' | 'slam' | 'laugh', target: Vector3 | undefined, t: number) {
  root.getWorldQuaternion(rootQuaternion);
  const origin = root.getWorldPosition(new Vector3());
  const forward = new Vector3(0, 0, 1).applyQuaternion(rootQuaternion);
  const up = new Vector3(0, 1, 0).applyQuaternion(rootQuaternion);
  const right = new Vector3(-1, 0, 0).applyQuaternion(rootQuaternion);
  const [upper, lower, hand] = AIM_BONES.map(name => findBone(root, name));
  const head = findBone(root, 'Head');
  if (!upper || !lower || !hand) return;
  const elbowPole = new Vector3().copy(ELBOW_POLE).applyQuaternion(rootQuaternion);

  if (pose === 'flip' || pose === 'point') {
    const shoulder0 = upper.getWorldPosition(new Vector3());
    const aim = target ? target.clone() : shoulder0.clone().addScaledVector(forward, 2);
    // Xoay ngực về phía đích một phần để động tác có chủ đích, tránh vặn tay ra sau lưng.
    const flat0 = aim.clone().sub(shoulder0); flat0.addScaledVector(up, -flat0.dot(up));
    const yaw = Math.atan2(-flat0.dot(right), flat0.dot(forward));
    twistChest(root, Math.max(-TAUNT_TWIST_MAX, Math.min(TAUNT_TWIST_MAX, yaw * 0.5)));
    const shoulder = upper.getWorldPosition(new Vector3());
    const flat = aim.clone().sub(shoulder); flat.addScaledVector(up, -flat.dot(up)); flat.normalize();
    if (pose === 'flip') {
      // Nắm tay giơ lên trước mặt chếch về đích, ngón giữa dựng đứng, mu bàn tay hướng về đối thủ.
      twoBoneIk(upper, lower, hand, shoulder.clone().addScaledVector(flat, 0.28).addScaledVector(up, 0.2), elbowPole);
      orientHand(root, hand, up.clone().addScaledVector(flat, 0.25).normalize(), flat.clone().negate());
      makeFist(root, hand, 'Middle');
    } else {
      const elbow = lower.getWorldPosition(new Vector3());
      const reach = shoulder.distanceTo(elbow) + elbow.distanceTo(hand.getWorldPosition(new Vector3()));
      twoBoneIk(upper, lower, hand, shoulder.clone().addScaledVector(aim.clone().sub(shoulder).normalize(), reach * 0.92), elbowPole);
      orientHand(root, hand, aim.clone().sub(hand.getWorldPosition(new Vector3())).normalize(), up.clone().negate());
      makeFist(root, hand, 'Index');
    }
    return;
  }

  if (pose === 'slam') {
    const chest = (findBone(root, 'Spine2') ?? findBone(root, 'Spine1') ?? upper).getWorldPosition(new Vector3());
    const sides: [string[], number][] = [[AIM_BONES, 1], [LEFT_ARM_BONES, -1]];
    for (const [names, side] of sides) {
      const [u, l, h] = names.map(name => findBone(root, name));
      if (!u || !l || !h) continue;
      const wrist = chest.clone().addScaledVector(right, 0.2 * side).addScaledVector(forward, 0.38);
      wrist.y = origin.y + TABLE_WRIST_HEIGHT;
      // Khuỷu bè ra ngoài và lùi về sau như đang chống tay đập xuống.
      twoBoneIk(u, l, h, wrist, right.clone().multiplyScalar(side).addScaledVector(up, -0.2).addScaledVector(forward, -0.4).normalize());
    }
    orientHand(root, hand, forward, up.clone().negate());
    makeFist(root, hand, null);
    return;
  }

  // laugh: rung vai, nghiêng đầu, tay phải che miệng.
  twistChest(root, 0.05 * Math.sin(t * 22));
  if (head) rotateWorld(head, new Quaternion().setFromAxisAngle(forward, -0.25));
  const mouth = head
    ? head.getWorldPosition(new Vector3()).addScaledVector(forward, 0.11).addScaledVector(up, -0.02).addScaledVector(right, 0.03)
    : upper.getWorldPosition(new Vector3()).addScaledVector(forward, 0.2).addScaledVector(up, 0.2);
  twoBoneIk(upper, lower, hand, mouth, elbowPole);
  orientHand(root, hand, up.clone().addScaledVector(right, -0.6).normalize(), forward.clone().negate());
}

/** Cộng thêm tư thế chĩa súng hoặc gục lên rig; gọi sau mixer.update mỗi frame. Xương không có thì bỏ qua. */
/** Ảnh chụp quaternion các xương do tư thế Bluff điều khiển (gồm cả phần đã cộng thêm ở frame trước). */
export type BluffPoseSnapshot = Map<Object3D, Quaternion>;

/** Chụp lại tư thế đang hiển thị; gọi TRƯỚC khi mixer ghi đè xương ở frame mới để giữ đúng pose frame trước. */
export function snapshotBluffPose(root: Object3D): BluffPoseSnapshot {
  const snapshot: BluffPoseSnapshot = new Map();
  for (const name of ALL_NAMES) {
    const bone = findBone(root, name);
    if (bone) snapshot.set(bone, bone.quaternion.clone());
  }
  return snapshot;
}

/**
 * `from`: đổi thẳng từ tư thế này sang tư thế khác (aim → slump) thì nội suy từ ảnh chụp tư thế cũ sang tư thế mới
 * theo from.weight (0 → 1), thay vì bật về tư thế nền rồi mới gập xuống.
 */
export function applyBluffPose(root: Object3D, pose: BluffPose, weight: number, target?: Vector3, t = 0, from?: { pose: BluffPoseSnapshot; weight: number } | null): void {
  const w = Math.min(Math.max(weight, 0), 1);
  const bones: Object3D[] = [];
  for (const name of ALL_NAMES) {
    const bone = findBone(root, name);
    if (!bone) continue;
    const state = states.get(bone);
    if (state && bone.quaternion.equals(state.result)) bone.quaternion.copy(state.base); // mixer không đụng tới xương này
    states.delete(bone);
    bones.push(bone);
  }
  if (!pose || w <= 0) return;
  // Mixer vừa ghi quaternion cục bộ; IK cần vị trí thế giới mới của frame này.
  root.updateWorldMatrix(true, true);
  const base = new Map(bones.map(bone => [bone, bone.quaternion.clone()]));
  if (pose === 'aim') { if (!solveAim(root)) return; } else if (pose === 'slump') solveSlump(root); else solveTaunt(root, pose, target, t);
  // Tính trọn tư thế ở weight 1 rồi nội suy từng xương từ nền: chuyển tiếp mượt và không phụ thuộc thứ tự.
  full.clear();
  for (const bone of bones) full.set(bone, bone.quaternion.clone());
  const fade = from ? Math.min(Math.max(from.weight, 0), 1) : 1;
  for (const bone of bones) {
    const start = base.get(bone)!, end = full.get(bone)!;
    bone.quaternion.copy(start);
    if (start.angleTo(end) >= 1e-7) bone.quaternion.slerp(end, w);
    const previous = fade < 1 ? from?.pose.get(bone) : undefined;
    if (previous) bone.quaternion.copy(q1.copy(previous).slerp(bone.quaternion, fade));
    if (start.angleTo(bone.quaternion) >= 1e-7) states.set(bone, { base: start, result: bone.quaternion.clone() });
  }
  root.updateWorldMatrix(false, true);
}

/**
 * Ma trận cục bộ (dưới xương RightHand) của súng trong tay: súng giữ hướng cố định theo model và
 * cỡ handGunScale (mét thật), bất kể trục/scale của xương tay ở từng rig (rig cm có scale 0.01 ở cha).
 */
export function bluffHandGunMatrix(root: Object3D, hand: Object3D, out: Matrix4): Matrix4 {
  root.getWorldQuaternion(rootQuaternion);
  hand.updateWorldMatrix(true, false);
  const rotation = q2.copy(rootQuaternion).multiply(GUN_MODEL_QUATERNION);
  const wrist = v1.setFromMatrixPosition(hand.matrixWorld);
  const scale = handGunScale(root);
  const origin = v2.copy(GUN_WRIST).multiplyScalar(-scale).applyQuaternion(rotation).add(wrist);
  m1.compose(origin, rotation, v3.setScalar(scale));
  return out.copy(hand.matrixWorld).invert().multiply(m1);
}
