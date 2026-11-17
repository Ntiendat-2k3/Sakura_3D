import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KOHAKU_JUMP_SPOTS, KOHAKU_JUMP_TIMING, PLAYER_CHARACTERS, kohakuJumpAirSeconds, kohakuJumpDuration, type PlayerCharacterId } from '@metaverse/game-protocol';
import { JUMP_CLIPS, kohakuJumpBlend, loadPlayerJumpMotion } from '../game/systems/playerJumpMotion';
import { createPlayerAnimation } from '../game/systems/playerAnimation';

const durations = [1.36, 0.5, 1.05];

test('timeline nhảy: lấy đà → rơi → tiếp đất, trọng số luôn cộng thành 1 và tắt hẳn khi xong', () => {
  for (const spot of KOHAKU_JUMP_SPOTS) {
    const prep = KOHAKU_JUMP_TIMING.prepSeconds, air = kohakuJumpAirSeconds(spot), total = kohakuJumpDuration(spot);
    const dominant = (t: number) => kohakuJumpBlend(spot, t, durations).samples.reduce((a, b) => (b.weight > a.weight ? b : a)).clip;
    assert.equal(dominant(0.2), JUMP_CLIPS.takeoff);
    assert.equal(dominant(prep + air * 0.6), JUMP_CLIPS.fall);
    assert.equal(dominant(prep + air + 0.1), JUMP_CLIPS.land);
    for (let t = 0; t < total; t += 0.01) {
      const { weight, samples } = kohakuJumpBlend(spot, t, durations);
      const sum = samples.reduce((acc, sample) => acc + sample.weight, 0);
      assert.ok(Math.abs(sum - 1) < 1e-9, `${spot.id} @${t.toFixed(2)}: tổng trọng số ${sum}`);
      assert.ok(weight >= 0 && weight <= 1);
      for (const sample of samples) assert.ok(sample.time <= durations[sample.clip], 'không lấy mẫu quá cuối clip');
    }
    assert.equal(kohakuJumpBlend(spot, total, durations).weight, 0);
    assert.equal(kohakuJumpBlend(spot, -0.1, durations).weight, 0);
  }
});

test('3 clip Mixamo retarget được lên cả 9 mẫu nhân vật, tạo dáng khi bay và trả xương về nền sau khi nhảy', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => new Response(await readFile(resolve(__dirname, '../public', String(url).replace(/^\//, '')), 'utf8'))) as typeof fetch;
  try {
    const spot = KOHAKU_JUMP_SPOTS[2];
    for (const id of Object.keys(PLAYER_CHARACTERS) as PlayerCharacterId[]) {
      const raw = await readFile(resolve(__dirname, '../public', PLAYER_CHARACTERS[id].url.slice(1)));
      const loader = new GLTFLoader();
      loader.register(() => ({ name: 'NODE_TEST_TEXTURE', loadTexture: async () => new Texture() }));
      const gltf = await loader.parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
      const controller = createPlayerAnimation(gltf.scene, gltf.animations, PLAYER_CHARACTERS[id].guitar);
      try {
        const motion = await loadPlayerJumpMotion(controller.scene);
        const leg = controller.scene.getObjectByName('LeftUpLeg')!;
        controller.update(1 / 60, 'Idle', 0, 0, { bpm: 120, offset: 0, cue: 'auto' }, 0);
        const idle = leg.quaternion.clone();
        motion.apply(spot, KOHAKU_JUMP_TIMING.prepSeconds + kohakuJumpAirSeconds(spot) * 0.6);
        assert.ok(leg.quaternion.angleTo(idle) > 0.05, `${id}: tư thế rơi phải khác hẳn đứng`);
        motion.apply(undefined, 0);
        // So khớp từng thành phần: angleTo trên quaternion chưa chuẩn hóa tuyệt đối lệch ~1e-3 do acos gần 1.
        assert.ok(leg.quaternion.equals(idle), `${id}: hết nhảy phải trả chân về đúng tư thế nền`);
      } finally {
        controller.dispose();
      }
    }
  } finally {
    globalThis.fetch = realFetch;
  }
});
