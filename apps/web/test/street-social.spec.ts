import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PLAYER_CHARACTERS, STREET_SEATS, STREET_SOCIAL_TIMING, type PlayerCharacterId, type PositionSnapshot } from '@metaverse/game-protocol';
import { PLAYER_ACTIONS, loadPlayerActionMotion, samplePlayerAction } from '../game/systems/playerActionMotion';
import { buildStreetActionCues } from '../game/systems/streetSocialCues';
import { createPlayerAnimation } from '../game/systems/playerAnimation';

const snap = (id: string, x: number, z: number, yaw: number, seatId = ''): PositionSnapshot => ({ id, name: id, x, z, yaw, seatId });

test('cú đấm: người trúng đòn bắt đầu giật đúng lúc nắm tay duỗi thẳng; sự kiện mới ghi đè cũ', () => {
  const cues = buildStreetActionCues([{ kind: 'punch', a: 'p1', b: 'p2', at: 1000 }], {});
  assert.deepEqual(cues.p1, { kind: 'punch', startAt: 1000 });
  assert.deepEqual(cues.p2, { kind: 'hit', startAt: 1000 + STREET_SOCIAL_TIMING.punchImpactMs });
  const impact = samplePlayerAction(cues.p1, 1000 + STREET_SOCIAL_TIMING.punchImpactMs)!;
  assert.ok(Math.abs(impact.time - 1.13) < 1e-9, 'khung trúng của Cross Punch');
  assert.equal(samplePlayerAction(cues.p2, 1000 + STREET_SOCIAL_TIMING.punchImpactMs - 1), null, 'chưa trúng thì chưa giật');
  const later = buildStreetActionCues([{ kind: 'punch', a: 'p1', b: 'p2', at: 1000 }, { kind: 'punch', a: 'p2', b: 'p1', at: 3000 }], {});
  assert.equal(later.p1.kind, 'hit');
  assert.equal(later.p2.kind, 'punch');
});

test('hôn ghế đá: thân trên xoắn/nghiêng ngược chiều về phía nhau, hông nhích nhẹ, hết thời lượng thì tắt hẳn', () => {
  const [a, b] = STREET_SEATS;
  const cues = buildStreetActionCues([{ kind: 'kiss', a: 'p1', b: 'p2', at: 0 }], { p1: snap('p1', a.x, a.z, a.yaw, a.id), p2: snap('p2', b.x, b.z, b.yaw, b.id) });
  assert.ok(cues.p1.twist! * cues.p2.twist! < 0, 'xoắn ngược chiều nhau');
  assert.ok(cues.p1.lean! * cues.p2.lean! < 0, 'nghiêng ngược chiều nhau');
  assert.ok(Math.abs(cues.p1.twist!) < Math.PI / 2, 'không quay hẳn người');
  assert.ok(Math.sign(cues.p1.slideZ!) === Math.sign(b.z - a.z) && Math.abs(cues.p1.slideZ! + cues.p2.slideZ!) < 1e-9);
  assert.ok(samplePlayerAction(cues.p1, 1800)!.weight === 1);
  assert.equal(samplePlayerAction(cues.p1, STREET_SOCIAL_TIMING.kissMs + 1), null);
  for (const action of Object.values(PLAYER_ACTIONS)) assert.ok(action.fadeIn + action.fadeOut <= action.duration);
});

test('clip đấm/trúng đòn/hôn retarget lên cả 9 mẫu; hôn khi ngồi không động vào chân, xong thì trả xương về nền', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => new Response(await readFile(resolve(__dirname, '../public', String(url).replace(/^\//, '')), 'utf8'))) as typeof fetch;
  try {
    for (const id of Object.keys(PLAYER_CHARACTERS) as PlayerCharacterId[]) {
      const raw = await readFile(resolve(__dirname, '../public', PLAYER_CHARACTERS[id].url.slice(1)));
      const loader = new GLTFLoader();
      loader.register(() => ({ name: 'NODE_TEST_TEXTURE', loadTexture: async () => new Texture() }));
      const gltf = await loader.parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
      const controller = createPlayerAnimation(gltf.scene, gltf.animations, PLAYER_CHARACTERS[id].guitar);
      try {
        const motion = await loadPlayerActionMotion(controller.scene);
        const arm = controller.scene.getObjectByName('RightArm')!, leg = controller.scene.getObjectByName('LeftUpLeg')!, neck = controller.scene.getObjectByName('Neck')!;
        controller.update(1 / 60, 'Sit', 0, 0, { bpm: 120, offset: 0, cue: 'auto' }, 0);
        const [arm0, leg0, neck0] = [arm.quaternion.clone(), leg.quaternion.clone(), neck.quaternion.clone()];
        motion.apply({ kind: 'punch', startAt: 0 }, STREET_SOCIAL_TIMING.punchImpactMs);
        assert.ok(arm.quaternion.angleTo(arm0) > 0.1, `${id}: tay phải vung ra`);
        motion.apply({ kind: 'seatKiss', startAt: 0 }, 1800);
        assert.ok(leg.quaternion.equals(leg0), `${id}: hôn khi ngồi giữ nguyên chân`);
        assert.ok(neck.quaternion.angleTo(neck0) > 0.02, `${id}: cổ nghiêng hôn`);
        motion.apply(null, 0);
        assert.ok(arm.quaternion.equals(arm0) && neck.quaternion.equals(neck0), `${id}: trả xương về nền`);
      } finally {
        controller.dispose();
      }
    }
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('hôn ghế đá trên rig thật: mặt chạm nhau mà đùi/gối hai người không đâm xuyên (lỗi cũ: gối cách 0.02 m)', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => new Response(await readFile(resolve(__dirname, '../public', String(url).replace(/^\//, '')), 'utf8'))) as typeof fetch;
  const { Group, Vector3 } = await import('three');
  const rigs = new Map<PlayerCharacterId, { scene: import('three').Object3D; root: import('three').Group; visual: import('three').Group; motion: Awaited<ReturnType<typeof loadPlayerActionMotion>>; controller: ReturnType<typeof createPlayerAnimation> }>();
  try {
    const rig = async (id: PlayerCharacterId) => {
      if (rigs.has(id)) return rigs.get(id)!;
      const raw = await readFile(resolve(__dirname, '../public', PLAYER_CHARACTERS[id].url.slice(1)));
      const loader = new GLTFLoader();
      loader.register(() => ({ name: 'NODE_TEST_TEXTURE', loadTexture: async () => new Texture() }));
      const gltf = await loader.parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
      const controller = createPlayerAnimation(gltf.scene, gltf.animations, PLAYER_CHARACTERS[id].guitar);
      const root = new Group(), visual = new Group(); root.add(visual); visual.add(controller.scene);
      const entry = { scene: controller.scene, root, visual, controller, motion: await loadPlayerActionMotion(controller.scene) };
      rigs.set(id, entry);
      return entry;
    };
    const [sa, sb] = STREET_SEATS;
    const players = { a: snap('a', sa.x, sa.z, sa.yaw, sa.id), b: snap('b', sb.x, sb.z, sb.yaw, sb.id) };
    const cues = buildStreetActionCues([{ kind: 'kiss', a: 'a', b: 'b', at: 0 }], players);
    const legs = ['LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot'];
    for (const [ia, ib] of [['kita', 'serie'], ['bocchi', 'ryo'], ['nijika', 'ubel']] as [PlayerCharacterId, PlayerCharacterId][]) {
      const A = await rig(ia), B = await rig(ib);
      for (const [r, seat, cue] of [[A, sa, cues.a], [B, sb, cues.b]] as const) {
        r.root.position.set(seat.x, 0, seat.z); r.root.rotation.y = seat.yaw;
        // Cùng phép đổi hệ như Avatar: độ nhích thế giới sang hệ cục bộ của gốc.
        const c = Math.cos(seat.yaw), sn = Math.sin(seat.yaw);
        r.visual.position.set(cue.slideX! * c - cue.slideZ! * sn, 0, cue.slideX! * sn + cue.slideZ! * c);
        r.controller.update(1 / 60, 'Sit', 0, 0, { bpm: 120, offset: 0, cue: 'auto' }, 0);
        r.root.updateMatrixWorld(true);
        r.motion.apply(cue, 1800);
        r.root.updateMatrixWorld(true);
      }
      const at = (r: typeof A, name: string) => r.scene.getObjectByName(name)!.getWorldPosition(new Vector3());
      const head = at(A, 'Head').distanceTo(at(B, 'Head'));
      assert.ok(head < 0.26, `${ia}+${ib}: hai đầu cách ${head.toFixed(2)} m, chưa chạm`);
      const points = (r: typeof A) => [...legs.map(name => at(r, name)), at(r, 'LeftUpLeg').lerp(at(r, 'LeftLeg'), .5), at(r, 'RightUpLeg').lerp(at(r, 'RightLeg'), .5)];
      let nearest = Infinity;
      for (const p of points(A)) for (const q of points(B)) nearest = Math.min(nearest, p.distanceTo(q));
      assert.ok(nearest > 0.22, `${ia}+${ib}: đùi/gối cách ${nearest.toFixed(2)} m, đâm xuyên nhau`);
      for (const r of [A, B]) r.motion.apply(null, 0);
    }
  } finally {
    for (const r of rigs.values()) r.controller.dispose();
    globalThis.fetch = realFetch;
  }
});
