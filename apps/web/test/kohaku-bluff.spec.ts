import assert from 'node:assert/strict';
import { existsSync, readFileSync as readFileSyncNode } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { unpack } from './glb';
import { Box3, Bone, Matrix4, Object3D, Quaternion, SkinnedMesh, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createEmptyBluffTable, DEFAULT_CLUB_SHOW, KOHAKU_SEATS, PLAYER_CHARACTERS, type BluffTableView, type PlayerCharacterId } from '@metaverse/game-protocol';
import { createPlayerAnimation } from '../game/systems/playerAnimation';
import { bluffSoundFor, type BluffSoundState } from '../game/systems/bluffSfx';
import { applyBluffPose, snapshotBluffPose, resolveAvatarPose, type BluffPose, bluffHandGunMatrix, BLUFF_GUN_MUZZLE, BLUFF_GUN_SCALE, BLUFF_SEATED_HEAD_HEIGHT, SLUMP_HEAD_HEIGHT } from '../game/systems/bluffPose';
import { activeTaunts } from '../game/systems/useBluffTaunts';
import { closeupPush, heartbeatActive, heartbeatBpm, stagingDim } from '../game/systems/bluffStaging';
import { bluffVoiceFor, createOneShots, createVoiceQueue, pickVoiceLine, tauntSound, type BluffVoiceState } from '../game/systems/bluffVoice';
import { bluffActions, canTauntNow, defaultTauntTarget, readBluffTable, toggleBluffSelection } from '../game/systems/kohakuBluffView';

test('toggleBluffSelection tối đa 3 lá, bấm lại thì bỏ chọn', () => {
  assert.deepEqual(toggleBluffSelection(['a', 'b', 'c'], 'd'), ['a', 'b', 'c']);
  assert.deepEqual(toggleBluffSelection(['a', 'b'], 'a'), ['b']);
  assert.deepEqual(toggleBluffSelection(['a'], 'b'), ['a', 'b']);
  assert.deepEqual(toggleBluffSelection(['a', 'b', 'c'], 'b'), ['a', 'c']);
});

test('bluffActions: chỉ người đến lượt mới úp được; chỉ hô nói dối được khi đã có lần úp của người khác', () => {
  const table = createEmptyBluffTable();
  table.seats[0].sessionId = 'me';
  table.seats[1].sessionId = 'other';
  assert.deepEqual(bluffActions(table, 'me'), { canReady: true, canPlay: false, canCallLiar: false, mySeat: table.seats[0].seatId, isPlaying: true });
  assert.equal(bluffActions(table, 'nobody').canReady, false);
  assert.equal(bluffActions(table, 'nobody').mySeat, '');

  const mine = table.seats[0].seatId;
  const theirs = table.seats[1].seatId;
  table.phase = 'turn'; table.turnSeat = mine;
  for (const seat of table.seats.slice(0, 2)) { seat.inMatch = true; seat.alive = true; } // đang trong ván
  let a = bluffActions(table, 'me');
  assert.equal(a.canReady, false); assert.equal(a.canPlay, true); assert.equal(a.canCallLiar, false);
  table.lastPlay = { seatId: mine, count: 2, revealed: [] };
  assert.equal(bluffActions(table, 'me').canCallLiar, false);
  table.lastPlay = { seatId: theirs, count: 2, revealed: [] };
  a = bluffActions(table, 'me');
  assert.equal(a.canCallLiar, true);
  assert.equal(bluffActions(table, 'other').canPlay, false);
});

test('bluffActions: người bị loại hoặc đã đứng dậy giữa ván không còn vùng bài/nút', () => {
  const table = createEmptyBluffTable();
  table.seats[0].sessionId = 'me'; table.seats[1].sessionId = 'other';
  table.phase = 'turn';
  table.seats[0].inMatch = true; table.seats[0].alive = false; table.turnSeat = table.seats[0].seatId;
  table.lastPlay = { seatId: table.seats[1].seatId, count: 1, revealed: [] };
  let a = bluffActions(table, 'me');
  assert.equal(a.isPlaying, false); assert.equal(a.canPlay, false); assert.equal(a.canCallLiar, false);
  assert.equal(a.mySeat, table.seats[0].seatId); // vẫn giữ để lớp mờ khi bị bắn còn hoạt động
  table.seats[0].inMatch = false; table.seats[0].alive = true; // đứng dậy giữa ván, ghế còn sessionId
  a = bluffActions(table, 'me');
  assert.equal(a.isPlaying, false); assert.equal(a.canPlay, false);
  table.seats[0].inMatch = true; // còn trong ván và sống
  assert.equal(bluffActions(table, 'me').isPlaying, true);
});

test('readBluffTable trả bàn rỗng khi state chưa có bluff', () => {
  assert.equal(readBluffTable(undefined).phase, 'lobby');
  assert.deepEqual(readBluffTable(null), createEmptyBluffTable());
});

test('readBluffTable gộp lastPlay phẳng và chép ArraySchema thành mảng thường', () => {
  const arr = <T,>(items: T[]) => ({ length: items.length, forEach: (cb: (v: T, i: number) => void) => items.forEach(cb) });
  const view = readBluffTable({
    phase: 'reveal', tableRank: 'K', turnSeat: 's2', deadline: 99, lastPlaySeat: 's1', lastPlayCount: 2,
    revealed: arr(['K', 'JOKER']), accuserSeat: 's2', shooterSeat: '', shotResult: '', winnerSeat: '',
    seats: arr([{ seatId: 's1', sessionId: 'x', ready: true, inMatch: true, alive: true, cardCount: 3, pulls: 1 }]),
  });
  assert.deepEqual(view.lastPlay, { seatId: 's1', count: 2, revealed: ['K', 'JOKER'] });
  assert.equal(view.seats.length, 1);
  assert.equal(view.seats[0].cardCount, 3);
  assert.equal(Array.isArray(view.lastPlay.revealed), true);
});

const propPath = (name: string) => resolve(__dirname, '../public/assets/props/kohaku-bluff', name);

test('card.glb có 4 material mặt trước face-K/Q/A/JOKER, texture <= 512px, đúng kích thước lá bài', async () => {
  const { doc, binary } = unpack(await readFile(propPath('card.glb')));
  const names = (doc.materials as { name: string }[]).map(m => m.name);
  for (const face of ['face-K', 'face-Q', 'face-A', 'face-JOKER']) assert.ok(names.includes(face), `thiếu material ${face}`);
  assert.ok(names.some(n => n.startsWith('card-back')), 'thiếu material mặt sau');
  for (const item of doc.images ?? []) {
    const view = doc.bufferViews[item.bufferView];
    const png = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    assert.ok(png.readUInt32BE(16) <= 512 && png.readUInt32BE(20) <= 512, 'texture lá bài vượt 512px');
  }
  const pos = doc.accessors.find((a: { type: string; min?: number[] }) => a.type === 'VEC3' && a.min);
  assert.ok(Math.abs(pos.max[0] - 0.0315) < 1e-4 && Math.abs(pos.max[2] - 0.044) < 1e-4, 'lá bài phải rộng 0.063 x cao 0.088 m');
});

test('revolver.glb có mesh, ít hơn 3000 tam giác và đầu nòng hướng +Z', async () => {
  const { doc } = unpack(await readFile(propPath('revolver.glb')));
  assert.ok(doc.meshes.length > 0);
  let tris = 0;
  for (const mesh of doc.meshes) for (const prim of mesh.primitives) tris += doc.accessors[prim.indices].count / 3;
  assert.ok(tris > 0 && tris < 3000, `số tam giác ${tris}`);
  const muzzle = doc.nodes.find((n: { name?: string }) => n.name === 'muzzle');
  assert.ok(muzzle && muzzle.translation[2] > 0.2, 'nòng phải hướng +Z');
});

// Chuỗi xương tối giản có độ dài thật (m): IK cần vị trí khớp, rig phẳng mọi xương ở gốc không giải được.
const POSE_BONES: [string, string, [number, number, number]][] = [
  ['Spine2', '', [0, 1.0, 0]], ['Neck', 'Spine2', [0, 0.25, 0]], ['Head', 'Neck', [0, 0.08, 0]],
  ['RightShoulder', 'Spine2', [-0.06, 0.2, 0]], ['RightArm', 'RightShoulder', [-0.1, 0, 0]],
  ['RightForeArm', 'RightArm', [0, -0.25, 0]], ['RightHand', 'RightForeArm', [0, -0.24, 0]],
];
function poseRig(skip: string[] = []) {
  const root = new Object3D();
  const bones: Record<string, Bone> = {};
  for (const [name, parent, position] of POSE_BONES) {
    if (skip.includes(name)) continue;
    const bone = new Bone(); bone.name = name; bone.position.set(...position);
    (bones[parent] ?? root).add(bone); bones[name] = bone;
  }
  return { root, bones };
}
const changed = (bone: Bone) => bone.quaternion.angleTo(new Quaternion()) > 1e-4;

test('applyBluffPose: weight 0 hoặc pose null không đổi xương nào', () => {
  const { root, bones } = poseRig();
  applyBluffPose(root, 'aim', 0); applyBluffPose(root, null, 1);
  for (const bone of Object.values(bones)) assert.equal(changed(bone), false);
});

test('applyBluffPose: aim đổi RightArm/RightForeArm, slump đổi Spine2', () => {
  const aim = poseRig(); applyBluffPose(aim.root, 'aim', 1);
  assert.equal(changed(aim.bones.RightArm), true); assert.equal(changed(aim.bones.RightForeArm), true);
  assert.equal(changed(aim.bones.Spine2), false);
  const slump = poseRig(); applyBluffPose(slump.root, 'slump', 1);
  assert.equal(changed(slump.bones.Spine2), true); assert.equal(changed(slump.bones.RightArm), false);
});

test('applyBluffPose: weight 0.5 quay ít hơn weight 1; thiếu xương Head không ném lỗi', () => {
  const half = poseRig(); applyBluffPose(half.root, 'aim', 0.5);
  const full = poseRig(); applyBluffPose(full.root, 'aim', 1);
  assert.ok(half.bones.RightArm.quaternion.angleTo(new Quaternion()) < full.bones.RightArm.quaternion.angleTo(new Quaternion()));
  const missing = poseRig(['Head']);
  assert.doesNotThrow(() => { applyBluffPose(missing.root, 'aim', 1); applyBluffPose(missing.root, 'slump', 1); });
});

test('applyBluffPose: gọi lặp cùng weight không cộng dồn; weight 0 trả về nền; aim -> slump trả tay phải về nền', () => {
  const { root, bones } = poseRig();
  bones.RightArm.quaternion.setFromAxisAngle(new Vector3(0, 0, 1), 0.3);
  const base = bones.RightArm.quaternion.clone();
  applyBluffPose(root, 'aim', 1);
  const once = bones.RightArm.quaternion.clone();
  applyBluffPose(root, 'aim', 1);
  assert.ok(bones.RightArm.quaternion.angleTo(once) < 1e-6);
  applyBluffPose(root, 'slump', 1);
  assert.ok(bones.RightArm.quaternion.angleTo(base) < 1e-6);
  assert.equal(changed(bones.Spine2), true);
  applyBluffPose(root, 'slump', 0);
  assert.equal(changed(bones.Spine2), false);
  applyBluffPose(root, 'aim', 1); applyBluffPose(root, 'aim', 0);
  assert.ok(bones.RightArm.quaternion.angleTo(base) < 1e-6);
});

test('applyBluffPose: aim -> slump nội suy từ ảnh chụp tư thế aim, không bật về tư thế nền giữa chừng', () => {
  const { root, bones } = poseRig();
  applyBluffPose(root, 'aim', 1);
  const aimArm = bones.RightArm.quaternion.clone();
  const snapshot = snapshotBluffPose(root);
  // fade 0: vẫn đúng tư thế aim của frame trước dù pose đã đổi sang slump.
  applyBluffPose(root, 'slump', 1, undefined, 0, { pose: snapshot, weight: 0 });
  assert.ok(bones.RightArm.quaternion.angleTo(aimArm) < 1e-6);
  assert.equal(changed(bones.Spine2), false);
  // Giữa chừng: tay đang hạ dần, ngực đang gập dần.
  applyBluffPose(root, 'slump', 1, undefined, 0, { pose: snapshot, weight: 0.5 });
  const halfAngle = bones.RightArm.quaternion.angleTo(new Quaternion());
  assert.ok(halfAngle > 1e-3 && halfAngle < aimArm.angleTo(new Quaternion()));
  assert.equal(changed(bones.Spine2), true);
  // fade 1 = slump thuần, và gọi lại không cộng dồn.
  applyBluffPose(root, 'slump', 1, undefined, 0, { pose: snapshot, weight: 1 });
  const spine = bones.Spine2.quaternion.clone();
  assert.equal(changed(bones.RightArm), false);
  applyBluffPose(root, 'slump', 1);
  assert.ok(bones.Spine2.quaternion.angleTo(spine) < 1e-6);
});

test('bluffSoundFor: không phát âm cũ cho người vào giữa ván; phát đúng khi đã seed', () => {
  const empty = createEmptyBluffTable();
  const mid = createEmptyBluffTable(); mid.phase = 'turn'; mid.seats[0].sessionId = 'a';
  const fresh: BluffSoundState = { phase: 'lobby', shot: '', seeded: false, rank: '', lastSeat: '' };
  // (a) lobby rỗng ban đầu -> trạng thái giữa ván đầu tiên: chỉ seed.
  assert.equal(bluffSoundFor(fresh, empty).next.seeded, false);
  const seeded = bluffSoundFor(fresh, mid);
  assert.equal(seeded.sound, null); assert.equal(seeded.next.seeded, true);
  // (b) reveal -> turn = shuffle.
  const reveal = createEmptyBluffTable(); reveal.phase = 'reveal'; reveal.seats[0].sessionId = 'a';
  assert.equal(bluffSoundFor({ phase: 'reveal', shot: '', seeded: true, rank: '', lastSeat: '' }, mid).sound, 'shuffle');
  assert.equal(bluffSoundFor({ phase: 'turn', shot: '', seeded: true, rank: '', lastSeat: '' }, mid).sound, null);
  // (c) shooting '' -> result click.
  const click = createEmptyBluffTable(); click.phase = 'result'; click.shotResult = 'click';
  assert.equal(bluffSoundFor({ phase: 'shooting', shot: '', seeded: true, rank: '', lastSeat: '' }, click).sound, 'click');
  // (d) bật lại (seeded false) thì lần đầu không phát dù là click.
  assert.equal(bluffSoundFor({ phase: 'shooting', shot: '', seeded: false, rank: '', lastSeat: '' }, click).sound, null);
});

/** Đọc rig/clip GLB người chơi thật bằng Three; phần decode ảnh được thay vì Node không có DOM. */
async function loadPlayer(id: PlayerCharacterId) {
  const raw = await readFile(resolve(__dirname, '../public', PLAYER_CHARACTERS[id].url.slice(1)));
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'NODE_TEST_TEXTURE', loadTexture: async () => new Texture() }));
  return loader.parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
}

/** Hộp bao các đỉnh mà xương Head chi phối mạnh nhất (phần trên gốc sọ): đo bề ngang và tâm đầu thật của từng mẫu. */
function headBox(scene: Object3D, head: Object3D) {
  const box = new Box3(), point = new Vector3(), headY = head.getWorldPosition(new Vector3()).y;
  scene.traverse(node => {
    if (!(node instanceof SkinnedMesh) || node.name === 'guitar') return;
    node.skeleton.update();
    const index = node.geometry.attributes.skinIndex, weight = node.geometry.attributes.skinWeight;
    const headIndex = node.skeleton.bones.indexOf(head as Bone);
    for (let i = 0; i < node.geometry.attributes.position.count; i++) {
      let best = 0, bone = -1;
      for (let k = 0; k < 4; k++) if (weight.getComponent(i, k) > best) { best = weight.getComponent(i, k); bone = index.getComponent(i, k); }
      if (bone !== headIndex) continue;
      node.getVertexPosition(i, point).applyMatrix4(node.matrixWorld);
      if (point.y > headY) box.expandByPoint(point);
    }
  });
  return box;
}

const POSE_LOG: string[] = [];
for (const id of Object.keys(PLAYER_CHARACTERS) as PlayerCharacterId[]) test(`${id}: tư thế chĩa súng đưa tay phải lên thái dương, bàn tay nắm báng, súng đúng cỡ; gục áp đầu xuống bàn`, async () => {
  const gltf = await loadPlayer(id);
  const controller = createPlayerAnimation(gltf.scene, gltf.animations, PLAYER_CHARACTERS[id].guitar);
  const { scene } = controller;
  const bone = (name: string) => scene.getObjectByName(name)!;
  const at = (name: string) => bone(name).getWorldPosition(new Vector3());
  // Mô phỏng runtime: mixer chạy clip Sit trước, tư thế cộng sau mỗi frame (Avatar.tsx useFrame).
  const frame = (pose: 'aim' | 'slump' | null, frames = 1) => {
    for (let i = 0; i < frames; i++) { controller.update(1 / 60, 'Sit', 0, 0, DEFAULT_CLUB_SHOW, 1000 + i * 16); applyBluffPose(scene, pose, 1); }
    scene.updateMatrixWorld(true);
  };
  try {
    frame(null, 60);
    const head0 = at('Head'), hand0 = at('RightHand'), arm0 = bone('RightArm').quaternion.clone();
    const box = headBox(scene, bone('Head'));
    const headCenter = box.getCenter(new Vector3()), halfWidth = (box.max.x - box.min.x) / 2;
    // Camera cận cảnh nhắm BLUFF_SEATED_HEAD_HEIGHT: tâm đầu của mọi mẫu phải nằm gần độ cao đó.
    assert.ok(Math.abs(headCenter.y - BLUFF_SEATED_HEAD_HEIGHT) < 0.12, `${id}: tâm đầu khi ngồi ${headCenter.y.toFixed(3)}`);

    frame('aim', 10);
    const head = at('Head'), hand = at('RightHand');
    const gun = new Object3D();
    bone('RightHand').add(gun);
    gun.matrixAutoUpdate = false; gun.matrix.copy(bluffHandGunMatrix(scene, bone('RightHand'), new Matrix4()));
    gun.updateMatrixWorld(true);
    const muzzle = gun.localToWorld(BLUFF_GUN_MUZZLE.clone()), gunScale = gun.getWorldScale(new Vector3());
    const muzzleToHead = muzzle.distanceTo(headCenter);
    // Revolver dài 0.33 m: cổ tay cách đầu nòng ~0.38 m nên không thể <0.15 m tới xương Head.
    // Ngưỡng: đầu nòng chạm vùng thái dương (cách tâm đầu ≤ nửa bề ngang đầu + 6 cm) và tay ở ngang đầu.
    assert.ok(muzzleToHead < halfWidth + 0.06, `${id}: đầu nòng cách tâm đầu ${muzzleToHead.toFixed(3)} (nửa bề ngang ${halfWidth.toFixed(3)})`);
    assert.ok(muzzle.x < headCenter.x, `${id}: đầu nòng phải ở phía phải (−X) của đầu`);
    assert.ok(hand.y > hand0.y + 0.3 && hand.y > head.y - 0.1, `${id}: tay chưa giơ lên ngang đầu (${hand0.y.toFixed(3)} -> ${hand.y.toFixed(3)}, Head ${head.y.toFixed(3)})`);
    assert.ok(hand.x < head.x - 0.15, `${id}: tay phải phải nằm bên phải đầu (x ${hand.x.toFixed(3)})`);
    assert.ok(hand.z > head.z - 0.05, `${id}: tay không được ra sau gáy (z ${hand.z.toFixed(3)} so với Head ${head.z.toFixed(3)})`);
    // Súng giữ cỡ đều theo BLUFF_GUN_SCALE (mẫu tay ngắn thu nhỏ thêm), không bị scale lệch trục của xương tay.
    assert.ok(Math.abs(gunScale.x - gunScale.y) < 1e-3 && Math.abs(gunScale.x - gunScale.z) < 1e-3, `${id}: súng bị méo, scale ${gunScale.toArray()}`);
    assert.ok(gunScale.x > 0.5 && gunScale.x <= BLUFF_GUN_SCALE + 1e-3, `${id}: cỡ súng ${gunScale.x}`);
    // Nắm báng (hệ súng: +Z nòng, +Y sống súng, báng ở −X…+X quanh x=0): ngón trỏ trên ngón út, khớp ngón ở phía −X,
    // đầu ngón cuộn qua sang +X; cổ tay không bẻ quá 125° (tay duỗi thẳng ra ngang làm cổ tay gập ~150°).
    const inGun = (name: string) => gun.worldToLocal(at(name)).divideScalar(1);
    if (scene.getObjectByName('RightHandMiddle1')) {
      const index1 = inGun('RightHandIndex1'), pinky1 = inGun('RightHandPinky1'), middle1 = inGun('RightHandMiddle1'), middle3 = inGun('RightHandMiddle3');
      assert.ok(index1.y > pinky1.y + 0.02, `${id}: ngón trỏ phải ở trên ngón út (${index1.y.toFixed(3)} vs ${pinky1.y.toFixed(3)})`);
      assert.ok(middle1.x < 0 && middle3.x > middle1.x + 0.02, `${id}: ngón giữa phải cuộn quanh báng (${middle1.x.toFixed(3)} -> ${middle3.x.toFixed(3)})`);
      const forearm = at('RightHand').sub(at('RightForeArm')).normalize(), palm = at('RightHandMiddle1').sub(at('RightHand')).normalize();
      const bend = Math.acos(Math.min(1, forearm.dot(palm))) * 180 / Math.PI;
      assert.ok(bend < 125, `${id}: cổ tay bẻ ${bend.toFixed(0)}°`);
    }
    const handToHead = hand.distanceTo(head);
    frame('aim', 5);
    assert.ok(at('RightHand').distanceTo(hand) < 1e-4, `${id}: tư thế không được trôi/cộng dồn qua frame`);
    bone('RightHand').remove(gun);

    frame('slump', 10);
    const slumped = at('Head').sub(head0);
    assert.ok(slumped.z > 0.2 && slumped.y < -0.12, `${id}: gục chưa đổ đầu về trước/xuống (${slumped.toArray().map(v => v.toFixed(3))})`);
    assert.ok(bone('RightArm').quaternion.angleTo(arm0) < 1e-3, `${id}: gục phải trả tay phải về tư thế ngồi`);
    assert.ok(at('Head').y > 0.98, `${id}: đầu không được xuyên mặt bàn (y ${at('Head').y.toFixed(3)})`);
    assert.ok(at('Head').y < SLUMP_HEAD_HEIGHT + 0.06, `${id}: gục chưa áp đầu xuống bàn (Head y ${at('Head').y.toFixed(3)})`);
    POSE_LOG.push(`${id}: headCenterY=${headCenter.y.toFixed(3)} halfWidth=${halfWidth.toFixed(3)} handY ${hand0.y.toFixed(3)}->${hand.y.toFixed(3)} (Head ${head.y.toFixed(3)}) hand-Head=${handToHead.toFixed(3)} muzzle-headCenter=${muzzleToHead.toFixed(3)} slump dy=${slumped.y.toFixed(3)} dz=${slumped.z.toFixed(3)}`);
    if (process.env.BLUFF_POSE_LOG) console.log(POSE_LOG[POSE_LOG.length - 1]);
  } finally { controller.dispose(); }
});

/** Bàn 3 người đang chơi: me ở ghế 1, b ở ghế 2, c ở ghế 3. */
function tauntTable() {
  const table = createEmptyBluffTable();
  ['me', 'b', 'c'].forEach((id, i) => { const seat = table.seats[i]; seat.sessionId = id; seat.inMatch = true; seat.alive = true; });
  table.phase = 'turn';
  return table;
}

test('canTauntNow theo pha và người cầm súng', () => {
  const table = tauntTable();
  const [me, b] = table.seats;
  table.turnSeat = me.seatId;
  assert.equal(canTauntNow(table, 'me'), true); // đang lượt mình vẫn được
  table.phase = 'lobby'; assert.equal(canTauntNow(table, 'me'), false);
  table.phase = 'gameOver'; assert.equal(canTauntNow(table, 'me'), false);
  table.phase = 'shooting'; table.shooterSeat = me.seatId; assert.equal(canTauntNow(table, 'me'), false);
  table.phase = 'result'; assert.equal(canTauntNow(table, 'me'), false);
  table.shooterSeat = b.seatId; assert.equal(canTauntNow(table, 'me'), true);
  table.phase = 'reveal'; table.shooterSeat = me.seatId; assert.equal(canTauntNow(table, 'me'), true);
  me.alive = false; assert.equal(canTauntNow(table, 'me'), false);
  assert.equal(canTauntNow(table, 'nobody'), false);
});

test('defaultTauntTarget: lượt người khác, lượt mình, bóp cò; không bao giờ mình hoặc người chết', () => {
  const table = tauntTable();
  const [me, b, c] = table.seats;
  table.turnSeat = c.seatId;
  assert.equal(defaultTauntTarget(table, me.seatId), c.seatId);
  table.turnSeat = me.seatId; table.lastPlay = { seatId: c.seatId, count: 1, revealed: [] };
  assert.equal(defaultTauntTarget(table, me.seatId), c.seatId);
  table.lastPlay = { seatId: '', count: 0, revealed: [] };
  assert.equal(defaultTauntTarget(table, me.seatId), b.seatId);
  b.alive = false;
  assert.equal(defaultTauntTarget(table, me.seatId), c.seatId);
  b.alive = true;
  table.phase = 'shooting'; table.shooterSeat = b.seatId;
  assert.equal(defaultTauntTarget(table, me.seatId), b.seatId);
  table.shooterSeat = me.seatId;
  assert.equal(defaultTauntTarget(table, me.seatId), b.seatId);
  b.alive = false; c.alive = false;
  assert.equal(defaultTauntTarget(table, me.seatId), '');
});

test('resolveAvatarPose: aim/slump luôn thắng cà khịa', () => {
  assert.equal(resolveAvatarPose('aim', 'flip'), 'aim');
  assert.equal(resolveAvatarPose('slump', 'laugh'), 'slump');
  assert.equal(resolveAvatarPose(null, 'flip'), 'flip');
  assert.equal(resolveAvatarPose(null, null), null);
});

/** Góc (rad) giữa đốt gốc → đầu ngón và cổ tay → đốt gốc: ~0 là ngón duỗi thẳng theo bàn tay. */
function fingerBend(at: (name: string) => Vector3, finger: string) {
  const knuckle = at(`RightHand${finger}1`);
  const palm = knuckle.clone().sub(at('RightHand')).normalize();
  return Math.acos(Math.min(1, palm.dot(at(`RightHand${finger}3`).sub(knuckle).normalize())));
}

for (const id of Object.keys(PLAYER_CHARACTERS) as PlayerCharacterId[]) test(`${id}: động tác cà khịa giơ ngón giữa/chỉ mặt/đập bàn/cười khẩy và trả về nền`, async () => {
  const gltf = await loadPlayer(id);
  const controller = createPlayerAnimation(gltf.scene, gltf.animations, PLAYER_CHARACTERS[id].guitar);
  const { scene } = controller;
  const at = (name: string) => scene.getObjectByName(name)!.getWorldPosition(new Vector3());
  // Đích là ghế đối diện chếch trái trong hệ model (gốc avatar ở 0, +Z trước mặt), ngang độ cao đầu ngồi.
  const target = new Vector3(0.8, BLUFF_SEATED_HEAD_HEIGHT, 2.2);
  const frame = (pose: BluffPose, frames = 1) => {
    for (let i = 0; i < frames; i++) { controller.update(1 / 60, 'Sit', 0, 0, DEFAULT_CLUB_SHOW, 1000 + i * 16); applyBluffPose(scene, pose, 1, target, 0); }
    scene.updateMatrixWorld(true);
  };
  try {
    frame(null, 60);
    const hand0 = at('RightHand'), left0 = at('LeftHand');

    frame('flip', 10);
    assert.ok(fingerBend(at, 'Middle') < 0.35, `${id}: flip ngón giữa phải duỗi (${fingerBend(at, 'Middle').toFixed(2)})`);
    for (const f of ['Index', 'Ring', 'Pinky']) assert.ok(fingerBend(at, f) > 0.9, `${id}: flip ngón ${f} phải gập (${fingerBend(at, f).toFixed(2)})`);
    assert.ok(at('RightHand').y > hand0.y + 0.2, `${id}: flip phải giơ tay lên (${hand0.y.toFixed(3)} -> ${at('RightHand').y.toFixed(3)})`);
    const flipHand = at('RightHand');
    frame('flip', 3);
    assert.ok(at('RightHand').distanceTo(flipHand) < 1e-4, `${id}: flip không được trôi qua frame`);

    frame('point', 10);
    assert.ok(fingerBend(at, 'Index') < 0.35, `${id}: point ngón trỏ phải duỗi`);
    assert.ok(fingerBend(at, 'Middle') > 0.9, `${id}: point ngón giữa phải gập`);
    const pointing = at('RightHandIndex3').sub(at('RightHand')).normalize();
    const toTarget = target.clone().sub(at('RightHand')).normalize();
    assert.ok(pointing.angleTo(toTarget) < 0.6, `${id}: point phải chỉ về đích (lệch ${pointing.angleTo(toTarget).toFixed(2)} rad)`);

    frame('slam', 10);
    for (const side of ['RightHand', 'LeftHand']) {
      const p = at(side);
      assert.ok(p.y > 0.9 && p.y < 1.15, `${id}: slam ${side} phải ở mặt bàn (y ${p.y.toFixed(3)})`);
      assert.ok(p.z > 0.2, `${id}: slam ${side} phải ở trước người (z ${p.z.toFixed(3)})`);
    }

    frame('laugh', 10);
    assert.ok(at('RightHand').distanceTo(at('Head')) < 0.3, `${id}: laugh tay phải lên gần mặt (${at('RightHand').distanceTo(at('Head')).toFixed(3)})`);

    frame(null, 2);
    assert.ok(at('RightHand').distanceTo(hand0) < 1e-3 && at('LeftHand').distanceTo(left0) < 1e-3, `${id}: hết cà khịa phải trả hai tay về tư thế ngồi`);
  } finally { controller.dispose(); }
});

test('activeTaunts: mỗi người giữ cà khịa mới nhất còn hạn, đích là ghế ở độ cao đầu ngồi', () => {
  const table = tauntTable();
  const [me, b] = table.seats;
  const taunts = [
    { fx: { seatId: me.seatId, kind: 'flip' as const, targetSeat: b.seatId }, at: 0 },
    { fx: { seatId: me.seatId, kind: 'laugh' as const, targetSeat: b.seatId }, at: 100 },
    { fx: { seatId: b.seatId, kind: 'slam' as const, targetSeat: me.seatId }, at: 0 },
  ];
  const now = activeTaunts(taunts, table.seats, 500);
  assert.equal(now.me.pose, 'laugh');
  assert.equal(now.b.pose, 'slam');
  const seatB = KOHAKU_SEATS.find(seat => seat.id === b.seatId)!;
  assert.deepEqual(now.me.target, { x: seatB.x, y: BLUFF_SEATED_HEAD_HEIGHT, z: seatB.z });
  const later = activeTaunts(taunts, table.seats, 1300); // slam 1200ms đã hết, laugh 1600ms còn
  assert.equal(later.b, undefined);
  assert.equal(later.me.pose, 'laugh');
  assert.deepEqual(activeTaunts(taunts, table.seats, 5000), {});
});

// ---- Giọng Shinku và âm cà khịa ----

function voiceTable(phase: BluffTableView['phase']) {
  const table = tauntTable();
  table.phase = phase; table.tableRank = 'Q';
  return table;
}
const seeded = (phase: string, shot = '', rank = 'Q', lastSeat = ''): BluffVoiceState => ({ phase, shot, seeded: true, rank, lastSeat });

test('bluffVoiceFor: chưa seed thì im, seed xong mới phản ứng', () => {
  const empty = createEmptyBluffTable();
  let r = bluffVoiceFor({ phase: 'lobby', shot: '', seeded: false, rank: '', lastSeat: '' }, empty);
  assert.deepEqual(r.groups, []); assert.equal(r.next.seeded, false);
  r = bluffVoiceFor(r.next, voiceTable('shooting')); // người vào giữa ván
  assert.deepEqual(r.groups, []); assert.equal(r.next.seeded, true);
  assert.deepEqual(bluffVoiceFor(r.next, voiceTable('shooting')).groups, []);
});

test('bluffVoiceFor: lobby→turn chào rồi báo lá chủ; vòng mới chỉ báo lá chủ', () => {
  assert.deepEqual(bluffVoiceFor(seeded('lobby'), voiceTable('turn')).groups, ['welcome', 'rank-Q']);
  assert.deepEqual(bluffVoiceFor(seeded('result', 'click'), voiceTable('turn')).groups, ['rank-Q']);
  assert.deepEqual(bluffVoiceFor(seeded('turn'), voiceTable('turn')).groups, []);
});

test('bluffVoiceFor: reveal có người hô thì hô dối + kết quả; lật khi hết bài chỉ có kết quả', () => {
  const lie = voiceTable('reveal');
  lie.accuserSeat = lie.seats[1].seatId; lie.lastPlay = { seatId: lie.seats[0].seatId, count: 2, revealed: ['Q', 'K'] };
  assert.deepEqual(bluffVoiceFor(seeded('turn'), lie).groups, ['liar-called', 'reveal-lie']);
  const truth = voiceTable('reveal');
  truth.lastPlay = { seatId: truth.seats[0].seatId, count: 2, revealed: ['Q', 'JOKER'] };
  assert.deepEqual(bluffVoiceFor(seeded('turn'), truth).groups, ['reveal-truth']);
});

test('bluffVoiceFor: không phản ứng thật/dối khi còn ở turn', () => {
  const table = voiceTable('turn');
  table.lastPlay = { seatId: table.seats[0].seatId, count: 3, revealed: [] };
  assert.deepEqual(bluffVoiceFor(seeded('turn'), table).groups, []);
});

test('bluffVoiceFor: shooting, click, bang còn 2 người, gameOver', () => {
  assert.deepEqual(bluffVoiceFor(seeded('reveal'), voiceTable('shooting')).groups, ['shooting']);
  const click = voiceTable('result'); click.shotResult = 'click';
  assert.deepEqual(bluffVoiceFor(seeded('shooting'), click).groups, ['click']);
  const bang = voiceTable('result'); bang.shotResult = 'bang'; bang.seats[2].alive = false;
  assert.deepEqual(bluffVoiceFor(seeded('shooting'), bang).groups, ['bang', 'two-left']);
  const bang3 = voiceTable('result'); bang3.shotResult = 'bang';
  assert.deepEqual(bluffVoiceFor(seeded('shooting'), bang3).groups, ['bang']);
  assert.deepEqual(bluffVoiceFor(seeded('result', 'bang'), voiceTable('gameOver')).groups, ['winner']);
});

test('pickVoiceLine: chọn câu đúng nhóm, không lặp câu vừa nói khi nhóm có ≥2 câu', () => {
  const first = pickVoiceLine('bang', () => 0);
  assert.match(first, /^bang-/);
  for (let i = 0; i < 5; i++) assert.notEqual(pickVoiceLine('bang', () => 0), pickVoiceLine('bang', () => 0));
});

test('tauntSound: shooting im lặng, slam là sfx, còn lại là giọng', () => {
  assert.equal(tauntSound('flip', 'shooting'), null);
  assert.deepEqual(tauntSound('slam', 'turn'), { sfx: 'slam' });
  assert.deepEqual(tauntSound('laugh', 'result'), { voice: 'taunt-laugh' });
});

test('createVoiceQueue phát lần lượt, giữ tối đa 3 câu chờ, clear dừng ngay', () => {
  const log: string[] = [];
  let finish = () => {};
  const queue = createVoiceQueue((id, onEnd) => { log.push(`play ${id}`); finish = onEnd; return () => log.push(`stop ${id}`); });
  queue.push(['a', 'b']);
  assert.deepEqual(log, ['play a']);
  queue.push(['c', 'd', 'e']); // chờ: b c d e → bỏ b
  finish();
  assert.deepEqual(log, ['play a', 'play c']);
  queue.clear();
  assert.deepEqual(log, ['play a', 'play c', 'stop c']);
  finish(); // onEnd muộn của câu đã dừng không được phát tiếp
  assert.equal(log.length, 3);
  queue.push(['f']);
  assert.equal(log.at(-1), 'play f');
});

test('mọi câu trong bluff-voice-lines.json có file mp3', () => {
  const lines = JSON.parse(readFileSyncNode(resolve(__dirname, '../game/systems/bluff-voice-lines.json'), 'utf8')) as { id: string }[];
  for (const { id } of lines) assert.ok(existsSync(resolve(__dirname, '../public/assets/audio/kohaku-bluff', `${id}.mp3`)), `thiếu ${id}.mp3`);
});

// ---- Dàn cảnh bóp cò ----
test('heartbeatBpm: 70 lúc chưa bóp, +18 mỗi lần, kẹp ở 5 lần', () => {
  assert.equal(heartbeatBpm(0), 70);
  assert.equal(heartbeatBpm(2), 106);
  assert.equal(heartbeatBpm(5), 160);
  assert.equal(heartbeatBpm(9), 160);
  assert.equal(heartbeatBpm(-1), 70);
});

test('heartbeatActive: chỉ trong shooting có người cầm súng và chưa có kết quả', () => {
  const table = voiceTable('shooting');
  table.shooterSeat = table.seats[0].seatId;
  assert.equal(heartbeatActive(table), true);
  table.shotResult = 'click'; assert.equal(heartbeatActive(table), false);
  table.shotResult = ''; table.shooterSeat = ''; assert.equal(heartbeatActive(table), false);
  const reveal = voiceTable('reveal'); reveal.shooterSeat = reveal.seats[0].seatId;
  assert.equal(heartbeatActive(reveal), false);
});

test('stagingDim: tối lại 0.25 khi bóp cò/kết quả, sáng 1 các pha khác', () => {
  const table = voiceTable('turn');
  assert.equal(stagingDim(table), 1);
  table.phase = 'shooting'; table.shooterSeat = table.seats[0].seatId;
  assert.equal(stagingDim(table), 0.25);
  table.phase = 'result'; assert.equal(stagingDim(table), 0.25);
  table.shooterSeat = ''; assert.equal(stagingDim(table), 1);
});

test('closeupPush: tăng tuyến tính trong suspense rồi giữ 1', () => {
  assert.equal(closeupPush(0, 0, 2000), 0);
  assert.equal(closeupPush(0, 1000, 2000), 0.5);
  assert.equal(closeupPush(0, 5000, 2000), 1);
  assert.equal(closeupPush(1000, 500, 2000), 0);
});

test('chia lại giữa pha turn (có người rời ghế): báo lá chủ mới và xáo bài dù pha không đổi', () => {
  const table = voiceTable('turn'); // tableRank Q, lastPlay rỗng sau khi chia
  const p1 = table.seats[0].seatId;
  // Lá chủ đổi K → Q.
  assert.deepEqual(bluffVoiceFor(seeded('turn', '', 'K', p1), table).groups, ['rank-Q']);
  assert.equal(bluffSoundFor({ phase: 'turn', shot: '', seeded: true, rank: 'K', lastSeat: p1 }, table).sound, 'shuffle');
  // Lá chủ trùng nhưng lần úp trên bàn bị xóa → vẫn là vòng mới.
  assert.deepEqual(bluffVoiceFor(seeded('turn', '', 'Q', p1), table).groups, ['rank-Q']);
  assert.equal(bluffSoundFor({ phase: 'turn', shot: '', seeded: true, rank: 'Q', lastSeat: p1 }, table).sound, 'shuffle');
  // Đổi lượt bình thường (đã có lần úp) thì Shinku im, chỉ có tiếng "xẹt" úp bài.
  table.lastPlay = { seatId: p1, count: 1, revealed: [] };
  assert.deepEqual(bluffVoiceFor(seeded('turn', '', 'Q', ''), table).groups, []);
  assert.equal(bluffSoundFor({ phase: 'turn', shot: '', seeded: true, rank: 'Q', lastSeat: '' }, table).sound, 'play');
  // Cùng lần úp đó (patch khác của bàn) không phát lại.
  assert.equal(bluffSoundFor({ phase: 'turn', shot: '', seeded: true, rank: 'Q', lastSeat: p1 }, table).sound, null);
});

test('createOneShots: phát chồng được, stopAll dừng mọi câu còn đang phát, câu đã xong thì không dừng lại', () => {
  const log: string[] = [];
  const ends = new Map<string, () => void>();
  const shots = createOneShots((id, onEnd) => { log.push(`play ${id}`); ends.set(id, onEnd); return () => log.push(`stop ${id}`); });
  shots.play('a'); shots.play('b'); shots.play('c');
  ends.get('b')!(); // b nói xong tự nhiên
  shots.stopAll();
  assert.deepEqual(log, ['play a', 'play b', 'play c', 'stop a', 'stop c']);
  shots.stopAll();
  assert.equal(log.length, 5);
});
