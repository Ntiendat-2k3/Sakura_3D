import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AnimationClip, BoxGeometry, Group, Mesh, MeshBasicMaterial, NumberKeyframeTrack, QuaternionKeyframeTrack, Texture, type WebGLRenderer } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clearCharacterAssets, loadCharacterAsset, retainCharacterAssets, warmCharacterTextures } from '../game/systems/characterAssets';

function model(onDispose: () => void) {
  const scene = new Group(), geometry = new BoxGeometry(1, 2, .5);
  geometry.addEventListener('dispose', onDispose); scene.add(new Mesh(geometry, new MeshBasicMaterial()));
  return { scene, animations: [], userData: {} } as unknown as GLTF;
}

test('cache dùng chung promise/model qua tháo/gắn phòng, chỉ dispose lúc World thật sự rời', async () => {
  const original = GLTFLoader.prototype.loadAsync;
  let loads = 0, disposed = 0;
  GLTFLoader.prototype.loadAsync = async () => { loads++; return model(() => disposed++); };
  try {
    const first = loadCharacterAsset('rosetta'), second = loadCharacterAsset('rosetta');
    assert.equal(first, second);
    const asset = await first; assert.equal(loads, 1);
    const room = new Group(); room.add(asset.scene); room.remove(asset.scene);
    assert.equal(await loadCharacterAsset('rosetta'), asset); assert.equal(disposed, 0);
    const releaseA = retainCharacterAssets(); releaseA();
    const releaseB = retainCharacterAssets(); await Promise.resolve();
    assert.equal(await loadCharacterAsset('rosetta'), asset, 'StrictMode không được xóa cache');
    releaseB(); await Promise.resolve(); assert.equal(disposed, 1);
  } finally { clearCharacterAssets(); GLTFLoader.prototype.loadAsync = original; }
});

test('lỗi tải không bị cache vĩnh viễn, lần vào sau được thử lại', async () => {
  const original = GLTFLoader.prototype.loadAsync;
  let count = 0;
  GLTFLoader.prototype.loadAsync = async () => { if (++count === 1) throw new Error('Lỗi giả lập'); return model(() => {}); };
  try {
    await assert.rejects(loadCharacterAsset('rosetta'));
    const asset = await loadCharacterAsset('rosetta'); assert.ok(asset.scene); assert.equal(count, 2);
  } finally { clearCharacterAssets(); GLTFLoader.prototype.loadAsync = original; }
});

test('biểu cảm Rosetta giữ trọng số riêng khi động tác thân chuyển sang nhảy', async () => {
  const original = GLTFLoader.prototype.loadAsync;
  const gltf = model(() => {}), face = gltf.scene.children[0] as Mesh;
  face.name = 'face'; face.morphTargetInfluences = [0]; face.morphTargetDictionary = { blink_left: 0 };
  gltf.animations = [new AnimationClip('idle', 1, [new NumberKeyframeTrack('face.morphTargetInfluences[0]', [0, 1], [0, 1]), new QuaternionKeyframeTrack('face.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1])])];
  GLTFLoader.prototype.loadAsync = async () => gltf;
  try {
    const asset = await loadCharacterAsset('rosetta');
    assert.ok(asset.expression); assert.ok(asset.mixer);
    assert.ok(asset.animations.every(clip => clip.tracks.every(track => !track.name.includes('morphTargetInfluences'))));
    asset.mixer.clipAction(asset.animations[0]).setEffectiveWeight(0);
    asset.expression.time = .5; asset.mixer.update(0);
    assert.equal(face.morphTargetInfluences![0], .5);
  } finally { clearCharacterAssets(); GLTFLoader.prototype.loadAsync = original; }
});

test('hai lời gọi warm cùng chờ upload thật; lỗi GPU không đánh dấu sẵn sàng vĩnh viễn', async () => {
  const original = GLTFLoader.prototype.loadAsync;
  const gltf = model(() => {});
  ((gltf.scene.children[0] as Mesh).material as MeshBasicMaterial).map = new Texture();
  GLTFLoader.prototype.loadAsync = async () => gltf;
  let uploads = 0, fail = true;
  const renderer = { getContext: () => ({ isContextLost: () => false }), initTexture: () => { uploads++; if (fail) throw new Error('GPU'); } } as unknown as WebGLRenderer;
  try {
    await assert.rejects(warmCharacterTextures('rosetta', renderer));
    fail = false;
    const first = warmCharacterTextures('rosetta', renderer), second = warmCharacterTextures('rosetta', renderer);
    await second; assert.equal(uploads, 2, 'Không resolve sớm trước upload'); await first;
    await warmCharacterTextures('rosetta', renderer); assert.equal(uploads, 2);
  } finally { clearCharacterAssets(); GLTFLoader.prototype.loadAsync = original; }
});

test('HTTP model độc lập bắt đầu song song, không chờ NPC trước tải/retarget xong', async () => {
  const original = GLTFLoader.prototype.loadAsync;
  const releases: ((error: Error) => void)[] = [];
  GLTFLoader.prototype.loadAsync = () => new Promise((_resolve, reject) => releases.push(reject));
  const pending = Promise.allSettled([loadCharacterAsset('rosetta'), loadCharacterAsset('galaxy')]);
  try {
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(releases.length, 2);
  } finally {
    releases.forEach(reject => reject(new Error('Kết thúc fixture'))); await pending;
    clearCharacterAssets(); GLTFLoader.prototype.loadAsync = original;
  }
});

test('đóng World khi đang tải không đưa asset đã dispose vào cache phiên mới', async () => {
  const original = GLTFLoader.prototype.loadAsync;
  const resolvers: ((value: GLTF) => void)[] = [];
  let disposed = 0;
  GLTFLoader.prototype.loadAsync = () => new Promise(resolve => resolvers.push(resolve));
  const rejected = assert.rejects(loadCharacterAsset('rosetta'), /đã được giải phóng/);
  try {
    await new Promise(resolve => setTimeout(resolve, 10)); clearCharacterAssets();
    const second = loadCharacterAsset('rosetta');
    await new Promise(resolve => setTimeout(resolve, 10));
    resolvers[0](model(() => disposed++)); resolvers[1](model(() => {}));
    await rejected; assert.equal(disposed, 1);
    assert.equal(await loadCharacterAsset('rosetta'), await second);
  } finally { clearCharacterAssets(); GLTFLoader.prototype.loadAsync = original; }
});
