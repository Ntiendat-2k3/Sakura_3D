import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { Box3, Group, Quaternion, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import { CLUB_NPCS } from '../game/systems/characterAssets';
import { createKohakuNpcMotion } from '../game/systems/kohakuNpcMotion';
import { createRecordedClubDance } from '../game/systems/retargetClubMotion';
import { nearestKohakuNpc } from '../game/systems/useKohakuInteraction';
import { KOHAKU_GAME_RULES } from '../game/ui/kohakuGameRules';
import { npcFocus } from '../game/systems/kohakuNpcFocus';
import { HINATA_KISS_DISTANCE, HINATA_KISS_DURATION_MS, HINATA_KISS_SETTLE_MS, planHinataKiss } from '../game/systems/hinataKiss';
import { loadPlayerKissMotion } from '../game/systems/playerKissMotion';
import { createPlayerAnimation } from '../game/systems/playerAnimation';
import { BLUFF_CHAMBERS, BLUFF_DECK, BLUFF_TAUNTS, BLUFF_TIMING, DEFAULT_CLUB_SHOW, KOHAKU_SEATS, MOVE_SPEED, PLAYER_CHARACTERS, createEmptyBluffTable } from '@metaverse/game-protocol';
import { unpack } from './glb';

test('3 NPC Kohaku Club (Shinku, Hinata, Bartender) tải đúng VRM, giữ texture <= 768px và diễn hoạt đứng/ngồi ổn định', async () => {
  for (const id of ['shinku', 'hinata', 'bartender'] as const) {
    const def = CLUB_NPCS[id];
    assert.ok(def, `Thiếu định nghĩa ${id} trong club-npcs.json`);
    const raw = await readFile(resolve(__dirname, '../public', def.url.slice(1)));
    assert.equal(raw.subarray(0, 4).toString(), 'glTF', `${id}: phải đúng chuẩn GLB/VRM`);

    const { doc, binary } = unpack(raw);
    for (const item of doc.images ?? []) {
      if (item.bufferView === undefined || item.mimeType !== 'image/png') continue;
      const view = doc.bufferViews[item.bufferView];
      const png = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
      const w = png.readUInt32BE(16);
      const h = png.readUInt32BE(20);
      assert.ok(w <= 768 && h <= 768, `${id}: texture ${item.name} vượt 768px (${w}x${h})`);
    }

    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    loader.register(() => ({ name: 'NODE_TEST_TEXTURE', loadTexture: async () => new Texture() }));
    loader.register(parser => new VRMLoaderPlugin(parser));
    const gltf = await loader.parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
    const vrm = gltf.userData.vrm as VRM;
    assert.ok(vrm, `${id}: phải tải được VRM humanoid`);
    VRMUtils.rotateVRM0(vrm);

    const bounds = new Box3().setFromObject(vrm.scene);
    const scale = def.height / (bounds.max.y - bounds.min.y);
    vrm.scene.scale.setScalar(scale);
    vrm.scene.position.y = -bounds.min.y * scale;
    vrm.scene.rotation.set(0, vrm.meta?.metaVersion === '0' ? Math.PI : 0, 0);

    const root = new Group();
    root.position.set(def.position[0], 0, def.position[2]);
    root.rotation.set(0, def.yaw, 0);
    root.add(vrm.scene);
    root.updateMatrixWorld(true);

    const controller = createKohakuNpcMotion(vrm, id);
    controller.update(0.1, 1 / 60, { lookYaw: def.yaw, seated: false });
    const hipPos = new Vector3();
    const standHipY = vrm.humanoid.getNormalizedBoneNode('hips')!.getWorldPosition(hipPos).y;
    assert.ok(Number.isFinite(standHipY) && standHipY > 0.75, `${id}: hông đứng không hợp lệ (${standHipY})`);

    if (id === 'shinku') {
      root.position.set(0, 0, -1.88);
      root.rotation.set(0, 0, 0);
      root.updateMatrixWorld(true);
      controller.update(0.3, 1 / 60, { lookYaw: 0, seated: true });
      const seatHipY = vrm.humanoid.getNormalizedBoneNode('hips')!.getWorldPosition(hipPos).y;
      assert.ok(seatHipY >= 0.78 && seatHipY <= 0.90, `Shinku khi ngồi ghế Dealer phải khớp đệm 0.76m (hipY=${seatHipY})`);
      // Ngồi chia bài: headYaw xoay đầu/ngực về phía người chơi, toàn thân vẫn ngồi yên trên ghế.
      const headYawOf = () => {
        const q = vrm.humanoid.getNormalizedBoneNode('head')!.getWorldQuaternion(new Quaternion());
        const f = new Vector3(0, 0, 1).applyQuaternion(q);
        return Math.atan2(f.x, f.z);
      };
      for (let i = 0; i < 90; i++) controller.update(0.3 + i / 60, 1 / 60, { lookYaw: 0, seated: true, headYaw: 0 });
      const yaw0 = headYawOf();
      for (let i = 0; i < 90; i++) controller.update(2 + i / 60, 1 / 60, { lookYaw: 0, seated: true, headYaw: 0.7 });
      assert.ok(Math.abs(headYawOf() - yaw0) > 0.35, `Shinku phải quay đầu theo headYaw (${yaw0.toFixed(2)} -> ${headYawOf().toFixed(2)})`);
      const hipAfter = vrm.humanoid.getNormalizedBoneNode('hips')!.getWorldPosition(hipPos).y;
      assert.ok(Math.abs(hipAfter - seatHipY) < 0.02, 'quay đầu không được làm Shinku rời ghế');
    }
  }
});

test('tương tác NPC Tầng 1 Kohaku Club: thảm đỏ, quầy Bar, bàn Poker và không kích hoạt nhầm trên Tầng 2', () => {
  assert.equal(nearestKohakuNpc({ x: 0, y: 0, z: 5.2 }, [0.95, -2.25]), 'hinata');
  assert.equal(nearestKohakuNpc({ x: -4.1, y: 0, z: -0.9 }, [0.95, -2.25]), 'bartender');
  assert.equal(nearestKohakuNpc({ x: 0.9, y: 0, z: -2.1 }, [0.95, -2.25]), 'shinku');
  assert.equal(
    nearestKohakuNpc({ x: -1.82, y: 0, z: -0.45, seatId: 'kohaku-player-1' }, [0, -1.88]),
    'shinku',
    'Khi đang ngồi ghế chơi bài vẫn nói chuyện được với Dealer Shinku'
  );
  assert.equal(nearestKohakuNpc({ x: -5.5, y: 3.6, z: -4.8 }, [0, -1.88]), null, 'Tầng 2 không được bắt nhầm NPC Tầng 1');
});

/** Đỉnh cú hôn của cả hai clip Kiss / Kiss_player (giây), đo trên model thật. */
const HINATA_KISS_PEAK_SECONDS = 2.1;

test('Hinata (VRM 1.0) cúi chào (Quick Formal Bow) đúng một lần và hôn người chơi (Kiss)', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url =>
    new Response(await readFile(resolve(__dirname, '../public', String(url).replace(/^\//, '')), 'utf8'));

  let bow: Awaited<ReturnType<typeof createRecordedClubDance>> | undefined;
  let kiss: Awaited<ReturnType<typeof createRecordedClubDance>> | undefined;
  try {
    const def = CLUB_NPCS.hinata;
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

    bow = await createRecordedClubDance(vrm, 'Hinata_Bow', ['Quick Formal Bow']);
    kiss = await createRecordedClubDance(vrm, 'Hinata_Kiss', ['Kiss']);

    const controller = createKohakuNpcMotion(vrm, 'hinata', { bow, kiss });
    const headPos = new Vector3();
    const hipPos = new Vector3();
    const handPos = new Vector3();
    const leftFoot = new Vector3();
    const rightFoot = new Vector3();

    // Pha đứng thẳng đầu clip Bow và pha cúi người chào về phía trước (+Z).
    controller.update(0.02, 1 / 60, { lookYaw: 0, hinataMode: 'bow' });
    const standHead = vrm.humanoid.getNormalizedBoneNode('head')!.getWorldPosition(new Vector3());
    const standHand = vrm.humanoid.getNormalizedBoneNode('rightHand')!.getWorldPosition(new Vector3());

    controller.update(0.85, 1 / 60, { lookYaw: 0, hinataMode: 'bow', actionElapsed: 0.85 });
    const bowHead = vrm.humanoid.getNormalizedBoneNode('head')!.getWorldPosition(headPos);
    const bowHip = vrm.humanoid.getNormalizedBoneNode('hips')!.getWorldPosition(hipPos);
    assert.ok(bowHead.y < standHead.y - 0.01, `Hinata phải hạ đầu khi cúi chào (${bowHead.y} < ${standHead.y})`);
    assert.ok(bowHead.z > standHead.z + 0.08 && bowHead.z > bowHip.z + 0.05, `Hinata phải cúi hướng về phía trước +Z (${bowHead.z} > ${bowHip.z})`);

    // Cúi chào chỉ MỘT lần: hết clip thì đứng thẳng lại dù vẫn ở chế độ bow, thời gian toàn cục chạy tiếp cũng không cúi lại.
    for (const seconds of [3.2, 5.0, 7.3]) {
      controller.update(seconds, 1 / 60, { lookYaw: 0, hinataMode: 'bow', actionElapsed: seconds });
      const head = vrm.humanoid.getNormalizedBoneNode('head')!.getWorldPosition(headPos);
      assert.ok(Math.abs(head.y - standHead.y) < 0.03, `Hinata không được cúi lại sau lần chào đầu (${head.y} ~ ${standHead.y} ở ${seconds}s)`);
    }

    // Chuyển sang chế độ Kiss (có hòa trộn 0.35 s từ pose cũ). Nhiều frame cùng một thời điểm clip: xương vẫn phải giữ
    // pose của clip (trước đây mixer không ghi lại giá trị không đổi nên sau frame đầu Hinata rơi về T-pose).
    for (let frame = 0; frame < 30; frame++) {
      controller.update(8 + frame / 60, 1 / 60, { lookYaw: 0, hinataMode: 'kiss', actionElapsed: HINATA_KISS_PEAK_SECONDS, actionKey: 1 });
    }
    const kissHead = vrm.humanoid.getNormalizedBoneNode('head')!.getWorldPosition(headPos);
    const kissHand = vrm.humanoid.getNormalizedBoneNode('rightHand')!.getWorldPosition(handPos);
    const minFootY = Math.min(
      vrm.humanoid.getRawBoneNode('leftFoot')!.getWorldPosition(leftFoot).y,
      vrm.humanoid.getRawBoneNode('rightFoot')!.getWorldPosition(rightFoot).y,
    );
    assert.ok(Number.isFinite(kissHead.y) && kissHead.y > 1.25, `Đầu Hinata khi Kiss phải giữ vững (${kissHead.y})`);
    assert.ok(kissHead.z > standHead.z + 0.02, `Hinata phải rướn đầu về phía khách (+Z) ở đỉnh nụ hôn (${kissHead.z} > ${standHead.z})`);
    assert.ok(kissHand.y < standHand.y + 0.6 && Math.abs(kissHand.x) < 0.4, `Tay Hinata không được dang ngang kiểu T-pose (${kissHand.x}, ${kissHand.y})`);
    assert.ok(minFootY >= -0.02 && minFootY <= 0.2, `Bàn chân Hinata phải chạm mặt sàn (${minFootY})`);
  } finally {
    bow?.dispose();
    kiss?.dispose();
    globalThis.fetch = originalFetch;
  }
});

test('Caca ở quầy bar có luật Bàn Hổ Phách, số liệu lấy từ hằng số luật của server', () => {
  const bluff = KOHAKU_GAME_RULES.find(game => game.id === 'bluff');
  assert.ok(bluff, 'thiếu luật Bluff');
  const text = bluff.sections.flatMap(section => section.items).join(' ');
  const deckSize = Object.values(BLUFF_DECK).reduce((a, b) => a + b, 0);
  assert.match(text, new RegExp(`Bộ bài ${deckSize} lá`));
  assert.match(text, new RegExp(`súng ${BLUFF_CHAMBERS} ngăn`));
  assert.match(text, new RegExp(`${BLUFF_TIMING.turnMs / 1000} giây`));
  for (const taunt of Object.values(BLUFF_TAUNTS)) assert.match(text, new RegExp(`${taunt.key}: ${taunt.label}`), `luật thiếu phím cà khịa ${taunt.key}`);
  assert.match(text, new RegExp(`${BLUFF_TIMING.tauntCooldownMs / 1000} giây`));
  // Điều khoản VOICEVOX yêu cầu ghi nguồn ở chỗ người chơi xem được trong game.
  assert.match(text, /VOICEVOX:冥鳴ひまり/);
  assert.match(text, /VOICEVOX:四国めたん/);
  assert.equal(new Set(KOHAKU_GAME_RULES.map(game => game.id)).size, KOHAKU_GAME_RULES.length, 'id trò chơi bị trùng');
});

test('npcFocus: Shinku nhìn người tới lượt / người cầm súng; Hinata và Bartender nhìn bàn 3s sau tiếng nổ', () => {
  const table = createEmptyBluffTable();
  const seat = (id: string) => { const s = KOHAKU_SEATS.find(item => item.id === id)!; return { x: s.x, z: s.z }; };
  const [p1, p2] = table.seats.map(item => item.seatId);
  assert.equal(npcFocus('shinku', table, Infinity), null); // lobby
  table.phase = 'turn'; table.turnSeat = p2;
  assert.deepEqual(npcFocus('shinku', table, Infinity), seat(p2));
  table.phase = 'reveal'; table.shooterSeat = ''; table.lastPlay = { seatId: p1, count: 1, revealed: ['K'] };
  assert.deepEqual(npcFocus('shinku', table, Infinity), seat(p1));
  table.phase = 'shooting'; table.shooterSeat = p2;
  assert.deepEqual(npcFocus('shinku', table, Infinity), seat(p2));
  table.phase = 'gameOver';
  assert.equal(npcFocus('shinku', table, Infinity), null);
  for (const id of ['hinata', 'bartender'] as const) {
    assert.deepEqual(npcFocus(id, table, 0), { x: 0, z: 0 });
    assert.deepEqual(npcFocus(id, table, 2999), { x: 0, z: 0 });
    assert.equal(npcFocus(id, table, 3000), null);
    assert.equal(npcFocus(id, table, -1), null);
  }
});

test('planHinataKiss: đứng trên đường Hinata → khách, cách HINATA_KISS_DISTANCE, quay mặt vào Hinata, chờ bước tới rồi mới hôn', () => {
  const hinata = { x: -0.88, z: 5.3, yaw: 0.55 };
  const { cue, approachMs } = planHinataKiss({ x: -0.88, z: 3.3 }, hinata, 1000, 7);
  assert.equal(cue.key, 7);
  assert.ok(Math.abs(Math.hypot(cue.x - hinata.x, cue.z - hinata.z) - HINATA_KISS_DISTANCE) < 1e-9);
  assert.ok(Math.abs(cue.x - hinata.x) < 1e-9 && cue.z < hinata.z, 'chỗ đứng phải nằm phía khách đang đứng');
  // Khách ở phía -Z của Hinata nên quay mặt về +Z (yaw 0) để nhìn vào Hinata.
  assert.ok(Math.abs(cue.yaw) < 1e-9);
  const walkMs = (2 - HINATA_KISS_DISTANCE) / MOVE_SPEED * 1000;
  assert.ok(Math.abs(approachMs - (walkMs + HINATA_KISS_SETTLE_MS)) <= 1);
  assert.equal(cue.startAt, 1000 + approachMs);
  assert.equal(cue.endAt - cue.startAt, HINATA_KISS_DURATION_MS);
  // Khách đứng đè lên Hinata: dùng hướng mặt của Hinata, không chia cho 0.
  const overlap = planHinataKiss({ x: hinata.x, z: hinata.z }, hinata, 0, 1).cue;
  assert.ok(Number.isFinite(overlap.x) && Number.isFinite(overlap.yaw));
});

test('Kiss_player retarget lên rig người chơi: chồng lên Idle, rướn đầu về trước ở đỉnh nụ hôn và trả xương về nền khi weight 0', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url =>
    new Response(await readFile(resolve(__dirname, '../public', String(url).replace(/^\//, '')), 'utf8'));
  try {
    for (const id of ['bocchi', 'yui'] as const) {
      const definition = PLAYER_CHARACTERS[id];
      const raw = await readFile(resolve(__dirname, '../public', definition.url.slice(1)));
      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      loader.register(() => ({ name: 'NODE_TEST_TEXTURE', loadTexture: async () => new Texture() }));
      const gltf = await loader.parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
      const animation = createPlayerAnimation(gltf.scene, gltf.animations, definition.guitar);
      const root = new Group(); root.add(animation.scene);
      const kiss = await loadPlayerKissMotion(animation.scene);
      const head = animation.scene.getObjectByName('Head')!;
      const frame = (seconds: number, weight: number) => {
        animation.update(1 / 60, 'Idle', 0, 0, DEFAULT_CLUB_SHOW, 0);
        kiss.apply(seconds, weight);
        root.updateMatrixWorld(true);
        return head.getWorldPosition(new Vector3());
      };
      const idle = frame(0, 0);
      assert.ok(kiss.duration * 1000 >= HINATA_KISS_DURATION_MS, `${id}: clip người chơi phải dài ít nhất bằng cảnh hôn`);
      // Nhiều frame cùng thời điểm: không cộng dồn, đầu đứng yên ở cùng vị trí.
      const peak = frame(HINATA_KISS_PEAK_SECONDS, 1);
      const again = frame(HINATA_KISS_PEAK_SECONDS, 1);
      assert.ok(peak.distanceTo(again) < 1e-4, `${id}: pose hôn không được cộng dồn qua frame`);
      assert.ok(peak.z > idle.z + 0.04, `${id}: đầu phải rướn về phía Hinata (${peak.z} > ${idle.z})`);
      const back = frame(0, 0);
      assert.ok(back.distanceTo(idle) < 0.01, `${id}: weight 0 phải trả đầu về tư thế Idle (${back.toArray()} ~ ${idle.toArray()})`);
      animation.dispose();
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
