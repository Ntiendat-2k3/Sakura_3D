import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { AnimationMixer, Box3, Quaternion, SkinnedMesh, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DEFAULT_CLUB_SHOW, DEFAULT_PLAYER_CHARACTER, MOVE_SPEED, PLAYER_CHARACTERS, PLAYER_DANCES, type PlayerCharacterId } from '@metaverse/game-protocol';
import { createPlayerAnimation } from '../game/systems/playerAnimation';
import character from '../game/entities/player-character.json';
import { retargetSkeletonMotion } from '../game/systems/retargetSkeletonMotion';
import type { Motion } from '../game/systems/retargetClubMotion';

/** Đọc geometry/rig/clip GLB thật bằng Three; phần decode ảnh được thay vì Node không có DOM. */
async function loadPlayer(id: PlayerCharacterId = DEFAULT_PLAYER_CHARACTER) {
  const raw = await readFile(resolve(__dirname, '../public', PLAYER_CHARACTERS[id].url.slice(1)));
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'NODE_TEST_TEXTURE', loadTexture: async () => new Texture() }));
  return loader.parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
}

for (const definition of [{ clip: 'Walk' as const, source: 'Dwarf Walk' }, ...Object.values(PLAYER_DANCES).filter(dance => dance.source)]) test(`${definition.clip} có trên cả 9 mẫu, giữ root, lặp mượt ở tốc độ gốc và không xuyên sàn khi đổi tư thế`, async () => {
  const motion = definition.clip;
  const source = JSON.parse(await readFile(resolve(__dirname, `../public/assets/animations/club/${definition.source}.json`), 'utf8'));
  for (const id of Object.keys(PLAYER_CHARACTERS) as PlayerCharacterId[]) {
    const gltf = await loadPlayer(id), clip = gltf.animations.find(item => item.name === motion)!;
    assert.ok(clip && Math.abs(clip.duration - (source.duration - .08)) < .001, `${id}: ${motion} phải giữ thời lượng nguồn ngoài đoạn nối vòng`);
    const controller = createPlayerAnimation(gltf.scene, gltf.animations, PLAYER_CHARACTERS[id].guitar);
    const hips = controller.scene.getObjectByName('Hips')!, root = controller.scene.position.clone(), point = new Vector3();
    const meshes: SkinnedMesh[] = []; controller.scene.traverse(node => { if (node instanceof SkinnedMesh && node.name !== 'guitar') meshes.push(node); });
    let minFloor = Infinity, maxFloor = -Infinity, maxHipTurn = 0;
    const first = new Quaternion();
    try {
      for (let frame = 0; frame <= 120; frame++) {
        controller.update(1 / 60, motion, motion === 'Walk' ? MOVE_SPEED : 0, 1000, DEFAULT_CLUB_SHOW, 1000 + frame / 120 * clip.duration * 1000);
        assert.ok(controller.scene.position.distanceTo(root) < 1e-8);
        assert.ok([...hips.position.toArray(), ...hips.quaternion.toArray()].every(Number.isFinite));
        if (frame === 30) first.copy(hips.quaternion);
        if (frame > 30) maxHipTurn = Math.max(maxHipTurn, hips.quaternion.angleTo(first));
        if (frame > 40 && frame % 10 === 0) {
          controller.scene.updateMatrixWorld(true); let floor = Infinity;
          for (const mesh of meshes) {
            mesh.skeleton.update();
            for (let i = 0; i < mesh.geometry.attributes.position.count; i++) floor = Math.min(floor, mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld).y);
          }
          minFloor = Math.min(minFloor, floor); maxFloor = Math.max(maxFloor, floor);
        }
      }
      assert.ok(minFloor > -.04 && maxFloor < .04, `${id}: ${motion} lệch sàn ${minFloor}..${maxFloor}`);
      assert.ok(maxHipTurn > (motion === 'Flair' || motion === 'HipHop' ? .4 : motion === 'Walk' ? .05 : .1), `${id}: ${motion} không giữ chuyển động hông từ nguồn`);
      const guitar = controller.scene.getObjectByName('guitar'); if (guitar) assert.equal(guitar.visible, false);
    } finally { controller.dispose(); }
  }
});

for (const style of ['maraschino', 'swing', 'snakehiphop'] as const) test(`${style}: keyframe tối ưu giữ sai số góc khớp dưới 1 độ so với nguồn 30 Hz`, async t => {
  const definition = PLAYER_DANCES[style], gltf = await loadPlayer();
  const source = JSON.parse(await readFile(resolve(__dirname, `../public/assets/animations/club/${definition.source}.json`), 'utf8')) as Motion;
  const mapping = Object.fromEntries(Object.keys(source.bones).map(name => [name.replace('mixamorig', ''), name.replace('mixamorig', '')]));
  const reference = retargetSkeletonMotion(source, gltf.scene, mapping, { name: definition.clip, hipsLimit: 2, overlap: .08 });
  const actual = gltf.animations.find(clip => clip.name === definition.clip)!;
  const a = new Quaternion(), b = new Quaternion(); let greatest = 0;
  for (const track of reference.tracks.filter(track => track.name.endsWith('.quaternion'))) {
    const expected = track.createInterpolant(), sampled = actual.tracks.find(item => item.name === track.name)!.createInterpolant();
    for (let frame = 0; frame <= reference.duration * 60; frame++) {
      const time = frame / 60;
      greatest = Math.max(greatest, a.fromArray(expected.evaluate(time)).normalize().angleTo(b.fromArray(sampled.evaluate(time)).normalize()));
    }
  }
  assert.ok(greatest < Math.PI / 180, `${definition.clip}: sai số ${greatest * 180 / Math.PI} độ`);
  t.diagnostic(`Sai số góc lớn nhất ${(greatest * 180 / Math.PI).toFixed(3)} độ`);
});

for (const motion of ['HipHop', 'Maraschino', 'Swing', 'SnakeHipHop'] as const) test(`${motion} giữ tốc độ gốc khi đổi BPM; client vào muộn lấy cùng pha và chuyển sang đi không kéo root`, async () => {
  const gltf = await loadPlayer(), clip = gltf.animations.find(item => item.name === motion)!;
  const a = createPlayerAnimation(gltf.scene, gltf.animations), b = createPlayerAnimation(gltf.scene, gltf.animations);
  const epoch = 1000, now = 3550;
  try {
    for (let i = 0; i < 100; i++) a.update(.02, motion, 0, epoch, { ...DEFAULT_CLUB_SHOW, bpm: 80 }, now);
    for (let i = 0; i < 50; i++) b.update(.04, motion, 0, epoch, { ...DEFAULT_CLUB_SHOW, bpm: 170 }, now);
    const armA = a.scene.getObjectByName('LeftArm')!, armB = b.scene.getObjectByName('LeftArm')!;
    assert.ok(armA.quaternion.angleTo(armB.quaternion) < .001);
    const expected = new Quaternion().fromArray(clip.tracks.find(item => item.name === 'LeftArm.quaternion')!.createInterpolant().evaluate((now - epoch) / 1000)).normalize();
    assert.ok(armA.quaternion.clone().normalize().angleTo(expected) < .001, 'Phải chạy theo giây nguồn thay vì co giãn theo BPM');
    for (let i = 0; i < 90; i++) a.update(1 / 60, 'Walk', 4.8, epoch, DEFAULT_CLUB_SHOW, now);
    assert.deepEqual(a.scene.position.toArray(), [0, 0, 0]);
    assert.ok(armA.quaternion.angleTo(armB.quaternion) > .1);
  } finally { a.dispose(); b.dispose(); }
});

test('GLB có skin, biểu cảm, đàn và mười hai clip lặp liên tục; chân đứng đúng sàn', async () => {
  const gltf = await loadPlayer();
  assert.deepEqual(gltf.animations.map(clip => clip.name).sort(), ['Blink', 'Dance', 'Flair', 'GuitarDance', 'HipHop', 'Idle', 'Maraschino', 'Run', 'Sit', 'SnakeHipHop', 'Swing', 'Walk']);
  const meshes: SkinnedMesh[] = [];
  gltf.scene.traverse(node => { if (node instanceof SkinnedMesh) meshes.push(node); });
  assert.ok(meshes.length >= 3);
  assert.ok(meshes.some(mesh => mesh.morphTargetInfluences && mesh.morphTargetInfluences.length > 0));
  assert.ok(gltf.scene.getObjectByName('guitar') instanceof SkinnedMesh, 'Đàn phải được skin theo ngực người chơi');
  for (const clip of gltf.animations) {
    assert.ok(clip.duration > 0);
    for (const track of clip.tracks) {
      const size = track.getValueSize();
      const first = track.values.slice(0, size), last = track.values.slice(-size);
      assert.ok(first.every((value, i) => Math.abs(value - last[i]) < .0001), `${clip.name}: ${track.name} giật ở biên vòng`);
      assert.ok(Array.from(track.values).every(Number.isFinite));
    }
  }
  const mixer = new AnimationMixer(gltf.scene);
  mixer.clipAction(gltf.animations.find(clip => clip.name === 'Idle')!).play(); mixer.update(0);
  gltf.scene.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(gltf.scene, true);
  assert.ok(Math.abs(bounds.min.y) < .035, `Chân lệch sàn: ${bounds.min.y}`);
  assert.ok(Math.abs(bounds.max.y - character.height) < .06);
});

test('tay đi/nhảy có chuyển động riêng ở vai, khuỷu, cổ tay và ngón; không giữ nguyên cả cánh tay', async () => {
  const gltf = await loadPlayer();
  for (const name of ['Walk', 'Run', 'Dance']) {
    const clip = gltf.animations.find(item => item.name === name)!;
    for (const side of ['Left', 'Right']) {
      for (const [joint, minimum] of [['Arm', .5], ['ForeArm', .15], ['Hand', .12], ['HandIndex2', .04]] as const) {
        const track = clip.tracks.find(item => item.name === `${side}${joint}.quaternion`)!;
        assert.ok(track, `${name} thiếu ${side}${joint}`);
        const sampler = track.createInterpolant();
        const start = new Quaternion().fromArray(sampler.evaluate(0));
        let greatest = 0;
        for (let i = 1; i <= 32; i++) greatest = Math.max(greatest, start.angleTo(new Quaternion().fromArray(sampler.evaluate(clip.duration * i / 32))));
        assert.ok(greatest > minimum, `${name}: ${side}${joint} ít chuyển động (${greatest})`);
      }
    }
  }
});

test('hai người dùng chung mesh/material nhưng rig, biểu cảm và chuyển động độc lập', async () => {
  const gltf = await loadPlayer();
  const a = createPlayerAnimation(gltf.scene, gltf.animations);
  const b = createPlayerAnimation(gltf.scene, gltf.animations);
  try {
    const leftA = a.scene.getObjectByName('LeftArm')!, leftB = b.scene.getObjectByName('LeftArm')!;
    assert.notEqual(leftA, leftB);
    const meshA: SkinnedMesh[] = [], meshB: SkinnedMesh[] = [];
    a.scene.traverse(node => { if (node instanceof SkinnedMesh) meshA.push(node); });
    b.scene.traverse(node => { if (node instanceof SkinnedMesh) meshB.push(node); });
    assert.equal(meshA[0].geometry, meshB[0].geometry);
    assert.equal(meshA[0].material, meshB[0].material);
    assert.notEqual(meshA[0].skeleton, meshB[0].skeleton);
    for (let i = 0; i < 90; i++) {
      a.update(1 / 60, 'Dance', 0, 1000, DEFAULT_CLUB_SHOW, 2000);
      b.update(1 / 60, 'Idle', 0, 1000, DEFAULT_CLUB_SHOW, 2000);
    }
    assert.ok(leftA.quaternion.angleTo(leftB.quaternion) > .2);
    const bBefore = leftB.quaternion.clone();
    a.dispose();
    b.update(0, 'Idle', 0, 1000, DEFAULT_CLUB_SHOW, 2000);
    assert.ok(leftB.quaternion.angleTo(bBefore) < .0001);
  } finally { a.dispose(); b.dispose(); }
});

test('nhảy theo cùng pha beat cho client vào muộn; chuyển sang ngồi/đi không kéo root', async () => {
  const gltf = await loadPlayer();
  const a = createPlayerAnimation(gltf.scene, gltf.animations);
  const b = createPlayerAnimation(gltf.scene, gltf.animations);
  const show = { ...DEFAULT_CLUB_SHOW, bpm: 120, offset: 0 };
  try {
    for (let i = 0; i < 100; i++) a.update(.02, 'Dance', 0, 1000, show, 2550);
    for (let i = 0; i < 50; i++) b.update(.04, 'Dance', 0, 1000, show, 2550);
    const handA = a.scene.getObjectByName('LeftHand')!, handB = b.scene.getObjectByName('LeftHand')!;
    assert.ok(handA.getWorldPosition(new Vector3()).distanceTo(handB.getWorldPosition(new Vector3())) < .0001);
    const danceRotation = a.scene.getObjectByName('LeftUpLeg')!.quaternion.clone();
    for (let i = 0; i < 90; i++) a.update(1 / 60, 'Sit', 0, 1000, show, 2550);
    assert.ok(a.scene.getObjectByName('LeftUpLeg')!.quaternion.angleTo(danceRotation) > .3);
    assert.deepEqual(a.scene.position.toArray(), [0, 0, 0]);
    for (let i = 0; i < 90; i++) a.update(1 / 60, 'Walk', 4.8, 1000, show, 2550);
    assert.deepEqual(a.scene.position.toArray(), [0, 0, 0]);
  } finally { a.dispose(); b.dispose(); }
});

for (const fps of [30, 60, 144]) test(`giữ chạy ở ${fps} FPS rồi dừng/đi lại có nhịp phù hợp, không giật chân hoặc đổi root`, async () => {
  const gltf = await loadPlayer();
  const controller = createPlayerAnimation(gltf.scene, gltf.animations);
  const foot = controller.scene.getObjectByName('LeftFoot')!;
  const point = new Vector3(), previous = new Vector3();
  let contacts = 0, grounded = false, largestStep = 0;
  try {
    for (let frame = 0; frame < fps * 5; frame++) {
      controller.update(1 / fps, 'Walk', 4.8, 0, DEFAULT_CLUB_SHOW);
      foot.getWorldPosition(point);
      if (frame > fps * 2) {
        const onFloor = point.y < .17;
        if (onFloor && !grounded) contacts++;
        grounded = onFloor;
      }
      if (frame > 0) largestStep = Math.max(largestStep, point.distanceTo(previous));
      previous.copy(point);
    }
    assert.ok(contacts >= 3 && contacts <= 6, `Chân trái chạm sàn ${contacts} lần trong 3 giây, nhịp bước không phù hợp`);
    for (const motion of ['Idle', 'Walk'] as const) for (let frame = 0; frame < fps * 1.5; frame++) {
      controller.update(1 / fps, motion, motion === 'Walk' ? 4.8 : 0, 0, DEFAULT_CLUB_SHOW);
      foot.getWorldPosition(point);
      largestStep = Math.max(largestStep, point.distanceTo(previous)); previous.copy(point);
    }
    assert.ok(largestStep * fps < 9.6, `Bàn chân giật ${largestStep} m trong một frame ở ${fps} FPS`);
    assert.deepEqual(controller.scene.position.toArray(), [0, 0, 0]);
  } finally { controller.dispose(); }
});

test('mọi mẫu chạy giữ chân thấp, khuỷu ổn định, tay đối nhịp và chân chống bám đất', async t => {
  assert.equal(character.runSpeed, MOVE_SPEED, 'Tốc độ tạo dáng chạy phải khớp tốc độ authoritative của server');
  for (const id of Object.keys(PLAYER_CHARACTERS) as PlayerCharacterId[]) {
    const gltf = await loadPlayer(id), mixer = new AnimationMixer(gltf.scene);
    const clip = gltf.animations.find(clip => clip.name === 'Run')!;
    const action = mixer.clipAction(clip).play();
    const feet: Vector3[] = [], hands: number[] = [], angles: number[] = [];
    let slip = 0, samples = 0, kneeAngle = 0;
    for (let frame = 0; frame < 240; frame++) {
      const phase = frame / 240;
      action.time = phase * clip.duration; mixer.update(0); gltf.scene.updateMatrixWorld(true);
      const point = (name: string) => gltf.scene.getObjectByName(name)!.getWorldPosition(new Vector3());
      const foot = point('LeftFoot'), shoulder = point('LeftArm'), elbow = point('LeftForeArm'), hand = point('LeftHand');
      const hip = point('LeftUpLeg'), knee = point('LeftLeg');
      kneeAngle = Math.max(kneeAngle, hip.sub(knee).angleTo(foot.clone().sub(knee)) * 180 / Math.PI);
      feet.push(foot); hands.push(hand.z - shoulder.z);
      angles.push(shoulder.sub(elbow).angleTo(hand.sub(elbow)) * 180 / Math.PI);
      // Bỏ vùng đổi tiếp xúc nơi GLB nội suy giữa hai mẫu bake, đo vận tốc chân chống trong world.
      if (phase > .04 && phase < .20) {
        slip += Math.abs((foot.z - feet[frame - 1].z) / (clip.duration / 240) + character.runSpeed);
        samples++;
      }
    }
    const heights = feet.map(foot => foot.y), reaches = feet.map(foot => foot.z);
    const centerFoot = reaches.reduce((sum, value) => sum + value, 0) / reaches.length;
    const centerHand = hands.reduce((sum, value) => sum + value, 0) / hands.length;
    let covariance = 0, footVariance = 0, handVariance = 0;
    for (let i = 0; i < feet.length; i++) {
      const f = reaches[i] - centerFoot, h = hands[i] - centerHand;
      covariance += f * h; footVariance += f * f; handVariance += h * h;
    }
    assert.ok(Math.max(...heights) - Math.min(...heights) < .18, `${id}: chân nhấc quá cao`);
    assert.ok(Math.max(...reaches) - Math.min(...reaches) < .9, `${id}: chân văng quá xa`);
    assert.ok(Math.min(...angles) > 100 && Math.max(...angles) < 140 && Math.max(...angles) - Math.min(...angles) < 20, `${id}: khuỷu quạt quá mạnh`);
    assert.ok(covariance / Math.sqrt(footVariance * handVariance) < -.65, `${id}: tay không đối nhịp chân`);
    assert.ok(kneeAngle < 168, `${id}: gối duỗi khóa ở ${kneeAngle}°`);
    assert.ok(slip / samples < .15, `${id}: chân chống trượt trung bình ${slip / samples} m/s`);
    t.diagnostic(`${id}: biên độ chân ${((Math.max(...heights) - Math.min(...heights)) * 100).toFixed(1)} cm; khuỷu ${Math.min(...angles).toFixed(1)}–${Math.max(...angles).toFixed(1)}°; gối tối đa ${kneeAngle.toFixed(1)}°; trượt pha chống ${(slip / samples).toFixed(3)} m/s`);
    mixer.stopAllAction(); mixer.uncacheRoot(gltf.scene);
  }
});

test('cầm đàn nhảy hiện đúng đàn theo ngực và gần hai tay; các avatar không ảnh hưởng nhau', async () => {
  const gltf = await loadPlayer();
  const a = createPlayerAnimation(gltf.scene, gltf.animations), b = createPlayerAnimation(gltf.scene, gltf.animations);
  try {
    for (let i = 0; i < 90; i++) {
      a.update(1 / 60, 'GuitarDance', 0, 1000, DEFAULT_CLUB_SHOW, 2000);
      b.update(1 / 60, 'Dance', 0, 1000, DEFAULT_CLUB_SHOW, 2000);
    }
    assert.equal(a.scene.getObjectByName('guitar')!.visible, true);
    assert.equal(b.scene.getObjectByName('guitar')!.visible, false);
    a.scene.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(a.scene.getObjectByName('guitar')!, true);
    assert.ok(bounds.min.y > .5 && bounds.max.y < 1.9, 'Đàn phải ở trước thân, không bay khỏi nhân vật');
    bounds.expandByScalar(.2);
    for (const side of ['Left', 'Right']) assert.ok(bounds.containsPoint(a.scene.getObjectByName(`${side}Hand`)!.getWorldPosition(new Vector3())), `${side}Hand không chạm đàn`);
    a.update(.1, 'Walk', 4.8, 1000, DEFAULT_CLUB_SHOW); assert.equal(a.scene.getObjectByName('guitar')!.visible, false);
  } finally { a.dispose(); b.dispose(); }
});

test('mọi mẫu có rig chuẩn, đủ animation, texture/ảnh chọn và khả năng đàn đúng catalog', async () => {
  for (const id of Object.keys(PLAYER_CHARACTERS) as PlayerCharacterId[]) {
    const definition = PLAYER_CHARACTERS[id], gltf = await loadPlayer(id);
    const controller = createPlayerAnimation(gltf.scene, gltf.animations, definition.guitar);
    try {
      assert.equal(!!controller.scene.getObjectByName('guitar'), definition.guitar, id);
      for (const bone of ['Hips', 'Head', 'LeftArm', 'RightArm', 'LeftLeg', 'RightLeg']) assert.ok(controller.scene.getObjectByName(bone), `${id}: ${bone}`);
      for (const motion of ['Idle', 'Walk', 'Sit', 'Dance', 'GuitarDance'] as const) {
        for (let i = 0; i < 60; i++) controller.update(1 / 60, motion, 4.8, 1000, DEFAULT_CLUB_SHOW, 2000);
        controller.scene.updateMatrixWorld(true);
        const bounds = new Box3().setFromObject(controller.scene, true);
        assert.ok(bounds.min.toArray().every(Number.isFinite) && bounds.max.toArray().every(Number.isFinite), `${id}: ${motion}`);
        assert.ok(bounds.max.y < 3 && bounds.min.y > -.15, `${id}: ${motion} lệch kích thước/sàn ${bounds.min.y}, ${bounds.max.y}`);
        if (motion === 'GuitarDance' && definition.guitar) {
          const instrument = new Box3().setFromObject(controller.scene.getObjectByName('guitar')!, true).expandByScalar(.2);
          for (const side of ['Left', 'Right']) assert.ok(instrument.containsPoint(controller.scene.getObjectByName(`${side}Hand`)!.getWorldPosition(new Vector3())), `${id}: ${side}Hand không giữ đàn`);
        }
        assert.deepEqual(controller.scene.position.toArray(), [0, 0, 0]);
      }
      const portrait = await readFile(resolve(__dirname, '../public', definition.portrait.slice(1)));
      assert.equal(portrait.subarray(1, 4).toString(), 'PNG', id);
    } finally { controller.dispose(); }
  }
});

test('Yui chuyển từ Unity giữ texture nhúng tối đa 1024, ngân sách lưới và dung lượng cho Web', async () => {
  const raw = await readFile(resolve(__dirname, '../public', PLAYER_CHARACTERS.yui.url.slice(1)));
  const jsonSize = raw.readUInt32LE(12), document = JSON.parse(raw.subarray(20, 20 + jsonSize).toString());
  const binary = raw.subarray(28 + jsonSize);
  assert.ok(raw.length < 6 * 1024 * 1024, 'Không đưa nguyên gói Unity hoặc texture 4K vào GLB');
  assert.equal(document.images.length, 5, 'Các vật liệu dùng chung texture không được nhúng trùng');
  for (const item of document.images) {
    assert.equal(item.mimeType, 'image/png'); assert.equal(item.uri, undefined);
    const view = document.bufferViews[item.bufferView], png = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.ok(png.readUInt32BE(16) <= 1024 && png.readUInt32BE(20) <= 1024);
  }
  const gltf = await loadPlayer('yui');
  let triangles = 0;
  gltf.scene.traverse(node => { if (node instanceof SkinnedMesh) triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3; });
  assert.ok(triangles < 60000, `Lưới còn quá nặng: ${triangles} tam giác`);
  const face = gltf.scene.getObjectByName('head') as SkinnedMesh;
  assert.deepEqual(Object.keys(face.morphTargetDictionary ?? {}).sort(), ['eyeBlinkLeft', 'eyeBlinkRight']);
});

test('dàn 9 nhân vật gồm Mint giữ đủ skin, ngân sách GLB/texture/draw call và bỏ 3 bản dựng cũ', async () => {
  assert.equal(Object.keys(PLAYER_CHARACTERS).length, 9, 'Màn chọn phải có đủ 9 nhân vật gồm Mint');
  for (const deprecatedId of ['airi', 'annie', 'kuroki']) {
    assert.equal(Object.hasOwn(PLAYER_CHARACTERS, deprecatedId), false, `${deprecatedId}: không còn trong danh sách nhân vật`);
  }
  const id = 'mint' as const;
  assert.equal(PLAYER_CHARACTERS[id].name, 'Mint');
  const manifest = JSON.parse(await readFile(resolve(__dirname, `../../../assets/processed/${id}-player-manifest.json`), 'utf8'));
  assert.equal(manifest.textureMaxResolution, 1024);
  const raw = await readFile(resolve(__dirname, '../public', PLAYER_CHARACTERS[id].url.slice(1)));
  assert.ok(raw.length < 14 * 1024 * 1024, `${id}: GLB quá nặng (${raw.length})`);
  const jsonSize = raw.readUInt32LE(12), document = JSON.parse(raw.subarray(20, 20 + jsonSize).toString());
  const binary = raw.subarray(28 + jsonSize);
  for (const item of document.images) {
    assert.equal(item.uri, undefined); assert.equal(item.mimeType, 'image/png');
    const view = document.bufferViews[item.bufferView], png = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    assert.ok(png.readUInt32BE(16) <= 1024 && png.readUInt32BE(20) <= 1024, `${id}: texture quá lớn`);
  }
  const gltf = await loadPlayer(id); let triangles = 0, meshes = 0;
  gltf.scene.traverse(node => {
    if (node instanceof SkinnedMesh) { meshes++; triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3; }
  });
  assert.ok(meshes <= 12, `${id}: quá nhiều draw call (${meshes})`);
  assert.ok(triangles < 65000, `${id}: lưới quá nặng (${triangles})`);
});
