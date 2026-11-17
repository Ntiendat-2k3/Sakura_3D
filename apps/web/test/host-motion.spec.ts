import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { Group, Quaternion, Vector3 } from 'three';
import { createDjRoute, getDjTravelDuration, isLoungeWalkable, LOUNGE_NPC_SLOTS, nearestLoungePortal, type DjSample } from '@metaverse/game-protocol';
import { CLUB_NPCS } from '../game/systems/characterAssets';
import { createDjVisitMotion } from '../game/systems/djVisitMotion';
import { createTwoBoneIK, SHARED_WALK_CLIP_ID } from '../game/systems/hostLocomotion';
import {
  canTalkToLoungeNpc,
  getCompanionDanceClip,
  LOUNGE_DANCE_CLIPS,
  nearestLoungeNpc,
  stepCompanionFollow,
  type CompanionFollowState,
} from '../game/systems/loungeNpcMotion';
import { LOUNGE_HOSTESS_PERSONAS } from '../game/systems/useLoungeInteraction';

test('DJ Rio trong Denmu Club sử dụng dáng đi chung Dwarf Walk từ common khi rời bàn DJ xuống gặp khách', async () => {
  assert.equal(SHARED_WALK_CLIP_ID, 'Dwarf Walk');
  const walkMotion = JSON.parse(await readFile(resolve(__dirname, `../public/assets/animations/club/${SHARED_WALK_CLIP_ID}.json`), 'utf8'));
  assert.equal(walkMotion.playback, 'natural');
  assert.ok(walkMotion.duration > 0.8 && walkMotion.tracks.length >= 20);

  const route = createDjRoute(0, -2.95);
  const visit = createDjVisitMotion({
    phase: 'approaching',
    requesterId: 'guest-1',
    startedAt: 0,
    playerX: 0,
    playerZ: -2,
    targetX: 0,
    targetZ: -2.95,
    returnDistance: 0,
  });
  const sample: DjSample = { x: 0, y: 0, z: 0, yaw: 0, distance: 0, speed: 0 };
  visit.sample(0.6, sample);
  assert.ok(sample.speed > 0.04, 'Khi đang đi xuống cầu thang DJ phải có tốc độ > 0.04 để phát clip Dwarf Walk');
  visit.sample(getDjTravelDuration(route.length), sample);
  assert.equal(sample.speed, 0, 'Khi tới đích DJ dừng lại chờ khách chọn nhạc');
});
test('IK chạm mục tiêu, giữ chiều dài xương và hướng bàn chân', () => {
  const root = new Group(), upper = new Group(), lower = new Group(), foot = new Group();
  upper.position.y = 1; lower.position.y = -.45; foot.position.y = -.45;
  root.add(upper); upper.add(lower); lower.add(foot); root.updateMatrixWorld(true);
  const solve = createTwoBoneIK(upper, lower, foot), target = new Vector3(.03, .15, .18);
  solve(target, new Vector3(0, 0, 1), new Quaternion());
  assert.ok(foot.getWorldPosition(new Vector3()).distanceTo(target) < 1e-6);
  assert.ok(Math.abs(upper.getWorldPosition(new Vector3()).distanceTo(lower.getWorldPosition(new Vector3())) - .45) < 1e-8);
  assert.ok(foot.getWorldQuaternion(new Quaternion()).angleTo(new Quaternion()) < 1e-6);
});
test('3 NPC Reika Lounge (Yuzu, Bunny, Zankou) khớp vị trí walkable và có VRM runtime hợp lệ', async () => {
  assert.deepEqual(LOUNGE_NPC_SLOTS.map(slot => slot.id), ['yuzu', 'bunny', 'zankou']);
  for (const slot of LOUNGE_NPC_SLOTS) {
    assert.ok(isLoungeWalkable(slot.x, slot.z), `Vị trí ${slot.id} không walkable`);
    const def = CLUB_NPCS[slot.id];
    assert.ok(def && def.format === 'vrm');
    const bytes = await readFile(resolve(__dirname, '../public', def.url.slice(1)));
    assert.equal(bytes.subarray(0, 4).toString(), 'glTF', def.url);
    assert.ok(bytes.byteLength > 100_000, `File VRM ${slot.id} quá nhỏ`);
  }
});
test('tương tác Hostess Reika Lounge giới hạn bán kính 2.2m, đủ lời thoại và clip nhảy riêng', async () => {
  assert.equal(canTalkToLoungeNpc(undefined, LOUNGE_NPC_SLOTS[0]), false);
  assert.equal(canTalkToLoungeNpc({ x: 0, z: 3 }, LOUNGE_NPC_SLOTS[0]), false);
  assert.equal(canTalkToLoungeNpc({ x: 0, z: -0.2 }, LOUNGE_NPC_SLOTS[0]), true);
  assert.equal(nearestLoungeNpc({ x: 0.1, z: -1.5 })?.id, 'yuzu');
  assert.equal(nearestLoungeNpc({ x: -3.8, z: -1.2 })?.id, 'bunny');
  assert.equal(nearestLoungeNpc({ x: 2.1, z: -3.2 })?.id, 'zankou');
  assert.deepEqual(LOUNGE_DANCE_CLIPS.yuzu, ['Snake Hip Hop Dance']);
  assert.deepEqual(LOUNGE_DANCE_CLIPS.zankou, ['zankou_dance']);
  for (const slot of LOUNGE_NPC_SLOTS) {
    const persona = LOUNGE_HOSTESS_PERSONAS[slot.id];
    assert.ok(persona && persona.lines.idle && persona.lines.flirt && persona.lines.toast && persona.lines.dance);
    for (const clipId of LOUNGE_DANCE_CLIPS[slot.id]) {
      const motion = JSON.parse(await readFile(resolve(__dirname, `../public/assets/animations/club/${clipId}.json`), 'utf8'));
      assert.ok(motion.duration > 1 && motion.tracks.length >= 20);
    }
  }
});
test('chức năng "Đi với anh nhé" dẫn đào đi bộ theo sau qua các phòng và nhảy cùng kiểu với người chơi trong Club', () => {
  const state: CompanionFollowState = { x: 0, z: -1.8, yaw: 0, speed: 0, zone: null };
  const initial = stepCompanionFollow(state, { x: 0, z: 0, yaw: 0 }, 'lounge', 1 / 60);
  assert.equal(initial.moving, false);
  assert.equal(state.zone, 'lounge');
  assert.ok(isLoungeWalkable(state.x, state.z));

  let moved = false;
  for (let i = 0; i < 90; i++) {
    const step = stepCompanionFollow(state, { x: 0, z: 3.5, yaw: 0 }, 'lounge', 1 / 60);
    if (step.moving) moved = true;
    assert.ok(isLoungeWalkable(step.x, step.z));
  }
  assert.equal(moved, true);
  assert.ok(Math.hypot(state.x - 0.65, state.z - 2.65) < 0.25);

  // Chuyển sang phòng Club dịch chuyển đào đi cùng ngay cạnh người chơi và đồng bộ kiểu nhảy
  const inClub = stepCompanionFollow(state, { x: 0, z: 1, yaw: Math.PI, dancing: true }, 'club', 1 / 60);
  assert.equal(state.zone, 'club');
  assert.equal(inClub.moving, false);
  assert.equal(getCompanionDanceClip('yuzu', 'hiphop'), 'Hip Hop Dancing');
  assert.equal(getCompanionDanceClip('zankou', 'swing'), 'Swing Dancing');
  assert.equal(getCompanionDanceClip('zankou', 'normal'), 'zankou_dance');
  assert.equal(getCompanionDanceClip('yuzu', 'normal'), 'Snake Hip Hop Dance');

  // Chuyển sang phòng Cyber Love Hotel khi người chơi ngồi trên giường đôi King-size
  const inHotel = stepCompanionFollow(state, { x: -0.75, z: -2.1, yaw: 0, seatId: 'hotel-bed-1' }, 'hotel', 1 / 60);
  assert.equal(state.zone, 'hotel');
  assert.equal(inHotel.moving, false);
  assert.ok(Math.hypot(inHotel.x - 0.55, inHotel.z - -1.85) < 0.05);
  assert.ok(LOUNGE_HOSTESS_PERSONAS.yuzu.hotelLine.includes('Love Hotel'));

  // Kiểm tra portal thang bộ tầng 2 bên trong Reika Lounge
  assert.equal(nearestLoungePortal(5.2, 4.2)?.destination, 'hotel');
  assert.equal(nearestLoungePortal(0, 5.8)?.destination, 'street');
});
