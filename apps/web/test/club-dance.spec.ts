import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { AnimationClip, Group, Quaternion, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three';
import type { VRM } from '@pixiv/three-vrm';
import { createLoopingClip, createRecordedClubDance } from '../game/systems/retargetClubMotion';

test('clip lặp nối cả vị trí/quaternion ở biên, giữ thời gian nguồn ngoài đoạn chồng', () => {
  const original = new AnimationClip('test', 2, [new VectorKeyframeTrack('root.position', [0, 1, 2], [0, 0, 0, 1, 0, 0, 2, 0, 0]), new QuaternionKeyframeTrack('root.quaternion', [0, 2], [0, 0, 0, 1, 0, 1, 0, 0])]);
  const loop = createLoopingClip(original);
  assert.equal(loop.duration, 1.75);
  for (const track of loop.tracks) {
    const sampler = track.createInterpolant(), start: number[] = Array.from(sampler.evaluate(0)), end: number[] = Array.from(sampler.evaluate(loop.duration));
    assert.deepEqual(start, end);
    const before = Array.from(sampler.evaluate(loop.duration - .00001)), after = Array.from(sampler.evaluate(.00001));
    assert.ok(before.every((value, i) => Math.abs(Number(value) - Number(after[i])) < .001));
  }
  assert.equal(loop.tracks[0].createInterpolant().evaluate(1)[0], 1);
  const q = new Quaternion().fromArray(loop.tracks[1].createInterpolant().evaluate(1));
  assert.ok(Math.abs(q.length() - 1) < 1e-6);
});

test('clip WINE/POP người dùng chọn chạy theo giây, không đổi theo BPM/cue hay cộng lắc hông', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => new Response(await readFile(resolve(__dirname, '../public', String(url).replace(/^\//, '')), 'utf8'));
  try {
    for (const name of ['WINE', 'POP']) {
      const scene = new Group(), hips = new Group(); hips.name = 'hips'; hips.position.y = 1; scene.add(hips);
      const vrm = { scene, meta: { metaVersion: '0' }, humanoid: { normalizedRestPose: { hips: { position: [0, 1, 0] } }, getNormalizedBoneNode: (bone: string) => bone === 'hips' ? hips : null } } as unknown as VRM;
      const dance = await createRecordedClubDance(vrm, name);
      try {
        const state = dance.update(5, 0, 1), rotation = hips.quaternion.clone(), position = hips.position.clone();
        dance.update(99, 1, 1);
        assert.equal(state.clip, name === 'WINE' ? 'Wine_dance' : 'Pop_dance');
        assert.equal(state.style, 'source-clip'); assert.equal(state.provider, 'mixamo');
        assert.ok(rotation.clone().normalize().angleTo(hips.quaternion.clone().normalize()) < 1e-6); assert.ok(position.distanceTo(hips.position) < 1e-6);
        dance.update(99, 1, 2); assert.ok(rotation.angleTo(hips.quaternion) > .01);
        assert.equal(hips.position.x, 0); assert.equal(hips.position.z, 0);
      } finally { dance.dispose(); }
    }
  } finally { globalThis.fetch = original; }
});

test('mixer chuyển clip/nhạc lặp giữ pose ra, lớp nhấn hông không tích lũy', async () => {
  const scene = new Group(), hips = new Group(), spine = new Group(), chest = new Group();
  hips.name = 'testHips'; spine.name = 'testSpine'; chest.name = 'testChest';
  hips.position.y = 1; scene.add(hips); hips.add(spine); spine.add(chest);
  const nodes = { hips, spine, chest };
  const vrm = { scene, meta: { metaVersion: '0' }, humanoid: { normalizedRestPose: { hips: { position: [0, 1, 0] } }, getNormalizedBoneNode: (name: string) => nodes[name as keyof typeof nodes] } } as unknown as VRM;
  const original = globalThis.fetch;
  globalThis.fetch = async url => new Response(await readFile(resolve(__dirname, '../public', String(url).replace(/^\//, '')), 'utf8'));
  let dance: Awaited<ReturnType<typeof createRecordedClubDance>> | undefined;
  try {
    dance = await createRecordedClubDance(vrm, 'WINE', ['GentleSwayingDancing', 'DoTheTwist']);
    dance.update(31.99);
    const before = hips.quaternion.clone();
    const transition = dance.update(32.001);
    assert.equal(transition.blend, 0);
    assert.equal(transition.previous, 'GentleSwayingDancing');
    assert.ok(hips.quaternion.angleTo(before) < .02);
    for (let i = 0; i < 200; i++) dance.update(32.001);
    assert.ok(Math.abs(hips.position.x) <= .056);
    assert.ok(hips.quaternion.angleTo(before) < .02);
    dance.update(34.1);
    assert.equal(dance.update(0).blend, 0);
    dance.update(3);
    assert.equal(dance.update(0).blend, 1, 'Restart cùng clip không pha về rest pose');
  } finally { dance?.dispose(); globalThis.fetch = original; }
});
