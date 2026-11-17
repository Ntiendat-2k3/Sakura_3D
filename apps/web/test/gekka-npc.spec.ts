import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { Box3, Group, Texture, Vector3, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import { DEFAULT_CLUB_SHOW, PLAYER_CHARACTERS, POKER_TIMING, type PlayerCharacterId } from '@metaverse/game-protocol';
import { CLUB_NPCS, type CharacterId } from '../game/systems/characterAssets';
import { createPlayerAnimation } from '../game/systems/playerAnimation';
import { loadGekkaRestraintMotion } from '../game/systems/gekkaRestraintPose';
import { createGekkaActorMotion, punchClipTime, PUNCH_IMPACT_SECONDS, PUNCH_LEAD_SECONDS, PUNCH_TAIL_SECONDS } from '../game/systems/gekkaNpcMotion';
import { createRecordedClubDance } from '../game/systems/retargetClubMotion';

const at = (node: Object3D) => node.getWorldPosition(new Vector3());

/** Clip chuyển động đọc thẳng từ public/ thay cho fetch của trình duyệt. */
async function withLocalFetch<T>(run: () => Promise<T>) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => new Response(await readFile(resolve(__dirname, '../public', String(url).replace(/^\//, '')), 'utf8'));
  try { return await run(); } finally { globalThis.fetch = originalFetch; }
}

async function loadPlayer(id: PlayerCharacterId) {
  const raw = await readFile(resolve(__dirname, '../public', PLAYER_CHARACTERS[id].url.slice(1)));
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'NODE_TEST_TEXTURE', loadTexture: async () => new Texture() }));
  return loader.parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
}

async function loadNpc(id: CharacterId) {
  const def = CLUB_NPCS[id];
  const raw = await readFile(resolve(__dirname, '../public', def.url.slice(1)));
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.register(() => ({ name: 'NODE_TEST_TEXTURE', loadTexture: async () => new Texture() }));
  loader.register(parser => new VRMLoaderPlugin(parser));
  const gltf = await loader.parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
  const vrm = gltf.userData.vrm as VRM;
  VRMUtils.rotateVRM0(vrm);
  const bounds = new Box3().setFromObject(vrm.scene);
  const scale = def.height / (bounds.max.y - bounds.min.y);
  vrm.scene.scale.setScalar(scale);
  vrm.scene.position.y = -bounds.min.y * scale;
  vrm.scene.rotation.set(0, vrm.meta?.metaVersion === '0' ? Math.PI : 0, 0);
  const root = new Group();
  root.add(vrm.scene);
  root.updateMatrixWorld(true);
  return { vrm, root };
}

test('punchClipTime: thủ thế khi chờ, ra đòn trước hạn cú kế tiếp, thu tay sau khi trúng, hầm trống thì không thủ thế', () => {
  const base = { active: true, punching: true, deadline: 10_000, nowMs: 5_000, lastImpactAgo: null, punchesDone: 2 };
  assert.equal(punchClipTime({ ...base, active: false }), null);
  assert.equal(punchClipTime(base)?.key, 'guard');
  const windup = punchClipTime({ ...base, nowMs: 10_000 - 250 })!;
  assert.equal(windup.key, 'punch-3');
  assert.ok(Math.abs(windup.time - (PUNCH_IMPACT_SECONDS - 0.25)) < 1e-9);
  const follow = punchClipTime({ ...base, punchesDone: 3, lastImpactAgo: 0.2 })!;
  assert.equal(follow.key, 'punch-3', 'cùng cú với lúc ra đòn để không nội suy lại giữa chừng');
  assert.ok(Math.abs(follow.time - (PUNCH_IMPACT_SECONDS + 0.2)) < 1e-9);
  assert.ok((PUNCH_LEAD_SECONDS + PUNCH_TAIL_SECONDS) * 1000 < POKER_TIMING.punchIntervalMs, 'một cú gọn trong khoảng cách giữa hai cú');
});

for (const id of Object.keys(PLAYER_CHARACTERS) as PlayerCharacterId[]) test(`${id}: bị trói chữ A — tay dang chéo xuống, chân dạng chạm sàn, đầu giật khi trúng đòn`, async () => {
  const gltf = await loadPlayer(id);
  const controller = createPlayerAnimation(gltf.scene, gltf.animations, PLAYER_CHARACTERS[id].guitar);
  const { scene } = controller;
  const bone = (name: string) => scene.getObjectByName(name)!;
  try {
    const restraint = await withLocalFetch(() => loadGekkaRestraintMotion(scene));
    let now = 10_000;
    const run = (cue: Parameters<typeof restraint.apply>[2], frames: number) => {
      for (let i = 0; i < frames; i++) {
        now += 1000 / 30;
        controller.update(1 / 30, 'Idle', 0, 0, DEFAULT_CLUB_SHOW, now);
        restraint.apply(now, 1 / 30, cue);
      }
      scene.updateMatrixWorld(true);
    };
    run(null, 10);
    const footY = Math.min(at(bone('LeftFoot')).y, at(bone('RightFoot')).y);
    const hipsGap = at(bone('LeftUpLeg')).distanceTo(at(bone('RightUpLeg')));
    run({ kind: 'post', hitAt: null, heavy: false }, 40);
    for (const side of ['Left', 'Right'] as const) {
      const outward = side === 'Left' ? 1 : -1;
      const shoulder = at(bone(`${side}Arm`)), hand = at(bone(`${side}Hand`));
      const reach = shoulder.distanceTo(at(bone(`${side}ForeArm`))) + at(bone(`${side}ForeArm`)).distanceTo(hand);
      // Mô hình nhìn +Z, bên trái là +X: cổ tay phải ở phía ngoài vai, thấp hơn vai.
      assert.ok((hand.x - shoulder.x) * outward > reach * 0.6, `${id} ${side}: tay chưa dang ra (${(hand.x - shoulder.x).toFixed(2)})`);
      assert.ok(hand.y < shoulder.y - reach * 0.25 && hand.y > shoulder.y - reach * 0.75, `${id} ${side}: tay không chéo xuống kiểu chữ A`);
    }
    const feet = [at(bone('LeftFoot')), at(bone('RightFoot'))];
    assert.ok(Math.abs(Math.min(feet[0].y, feet[1].y) - footY) < 0.06, `${id}: chân rời sàn ${Math.min(feet[0].y, feet[1].y).toFixed(3)} so với ${footY.toFixed(3)}`);
    assert.ok(feet[0].x - feet[1].x > hipsGap * 1.2, `${id}: chân chưa dạng`);

    const head = bone('Head');
    const calm = head.getWorldQuaternion(head.quaternion.clone());
    const hitAt = now + 1;
    run({ kind: 'post', hitAt, heavy: true }, 10);
    const hit = head.getWorldQuaternion(head.quaternion.clone());
    assert.ok(calm.angleTo(hit) > 0.08, `${id}: đầu không giật khi trúng đòn (${calm.angleTo(hit).toFixed(3)} rad)`);
    const wrist = at(bone('LeftHand'));
    run({ kind: 'post', hitAt, heavy: true }, 3);
    assert.ok(at(bone('LeftHand')).distanceTo(wrist) < 0.04, `${id}: cổ tay bị cùm vẫn trôi khi trúng đòn`);

    run({ kind: 'cell', hitAt: null, heavy: false }, 40);
    const cellHand = at(bone('LeftHand')), cellShoulder = at(bone('LeftArm'));
    assert.ok(cellHand.x - cellShoulder.x < (cellHand.y < cellShoulder.y ? 0.45 : 0), `${id}: ở vòng xích tường tay phải khép hơn`);
    // Hết bị trói thì trả về tư thế nền của clip Idle.
    run(null, 40);
    assert.ok(at(bone('LeftHand')).x - at(bone('LeftArm')).x < 0.3, `${id}: không nhả tay sau khi được thả`);
  } finally {
    controller.dispose();
  }
});

test('Onizuka (đao phủ VRM): nắm tay phải vươn ra trước khi tới khung trúng của Cross Punch', async () => {
  const { vrm, root } = await loadNpc('lindsay');
  const punch = await withLocalFetch(() => createRecordedClubDance(vrm, 'Gekka_Punch', ['Cross Punch']));
  try {
    const motion = createGekkaActorMotion(vrm, 'executioner', null);
    const hand = vrm.humanoid.getRawBoneNode('rightHand')!;
    const pose = (time: number) => {
      for (let i = 0; i < 20; i++) motion.update(i / 30, 1 / 30, root, { x: 0, y: -3.2, z: 0, yaw: 0, walking: false, clip: { key: 'k', motion: punch, time } });
      return root.worldToLocal(at(hand));
    };
    const guard = pose(0.35), impact = pose(PUNCH_IMPACT_SECONDS);
    assert.ok(impact.z - guard.z > 0.25, `tay chỉ vươn ${(impact.z - guard.z).toFixed(2)} m`);
    const feet = (['leftFoot', 'rightFoot'] as const).map(side => at(vrm.humanoid.getRawBoneNode(side)!).y);
    assert.ok(Math.min(...feet) > -3.2 && Math.min(...feet) < -3.2 + 0.2, `chân không đứng trên sàn hầm (${Math.min(...feet).toFixed(3)})`);
  } finally {
    punch.dispose();
  }
});

test('Onizuka đứng canh (không clip) và khi đi bộ: hai tay buông xuôi, cổ tay thấp hơn vai', async () => {
  const { vrm, root } = await loadNpc('lindsay');
  const walk = await withLocalFetch(() => createRecordedClubDance(vrm, 'Onizuka_walk', ['Dwarf Walk']));
  try {
    const motion = createGekkaActorMotion(vrm, 'executioner', walk);
    const h = vrm.humanoid;
    for (const walking of [false, true]) {
      for (let i = 0; i < 20; i++) motion.update(i / 30, 1 / 30, root, { x: 3.3, y: 0, z: -1.5, yaw: -Math.PI / 2, walking, clip: null });
      for (const side of ['left', 'right'] as const) {
        const shoulder = at(h.getRawBoneNode(`${side}UpperArm`)!).y, wrist = at(h.getRawBoneNode(`${side}Hand`)!).y;
        assert.ok(shoulder - wrist > 0.3, `${walking ? 'đi' : 'đứng'} · tay ${side}: cổ tay chỉ thấp hơn vai ${(shoulder - wrist).toFixed(2)} m`);
      }
    }
  } finally {
    walk.dispose();
  }
});

test('Aos (bà chủ VRM): đứng chắp tay trước bụng, chân chạm sàn; khi đi thì hai chân thay nhau bước', async () => {
  const { vrm, root } = await loadNpc('aos');
  const walk = await withLocalFetch(() => createRecordedClubDance(vrm, 'Aos_walk', ['Dwarf Walk']));
  try {
    const motion = createGekkaActorMotion(vrm, 'hostess', walk);
    for (let i = 0; i < 20; i++) motion.update(i / 30, 1 / 30, root, { x: 1, y: 0, z: 2, yaw: 0.4, walking: false });
    const h = vrm.humanoid;
    const left = at(h.getRawBoneNode('leftHand')!), right = at(h.getRawBoneNode('rightHand')!), hips = at(h.getRawBoneNode('hips')!);
    assert.ok(left.distanceTo(right) < 0.22, `hai tay cách nhau ${left.distanceTo(right).toFixed(2)} m`);
    const toHands = left.clone().add(right).multiplyScalar(0.5).sub(hips);
    assert.ok(toHands.x * Math.sin(0.4) + toHands.z * Math.cos(0.4) > 0.08, 'tay không ở trước bụng');
    const soles = (['leftFoot', 'rightFoot'] as const).map(side => at(h.getRawBoneNode(side)!).y);
    assert.ok(Math.min(...soles) > 0 && Math.min(...soles) < 0.16, `cổ chân ở ${Math.min(...soles).toFixed(3)}`);
    const gaps = new Set<number>();
    for (let i = 0; i < 45; i++) {
      motion.update(1 + i / 30, 1 / 30, root, { x: 1, y: 0, z: 2, yaw: 0.4, walking: true });
      const l = root.worldToLocal(at(h.getRawBoneNode('leftFoot')!)).z, r = root.worldToLocal(at(h.getRawBoneNode('rightFoot')!)).z;
      gaps.add(Math.sign(Math.round((l - r) * 20)));
    }
    assert.ok(gaps.has(1) && gaps.has(-1), 'khi đi hai chân không thay nhau ra trước');
  } finally {
    walk.dispose();
  }
});
