import { AnimationClip, AnimationMixer, Box3, Mesh, PropertyBinding, SkinnedMesh, Texture, Vector3, type AnimationAction, type Group, type Skeleton, type WebGLRenderer } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import definitions from '../entities/club-npcs.json';
import { createRecordedClubDance } from './retargetClubMotion';

export { definitions as CLUB_NPCS };
export type CharacterId = keyof typeof definitions;
export type CharacterAsset = { scene: Group; vrm?: VRM; animations: AnimationClip[]; baseY: number; footClearance: number; dance?: Awaited<ReturnType<typeof createRecordedClubDance>>; mixer?: AnimationMixer; expression?: AnimationAction };
type Entry = { promise: Promise<CharacterAsset>; value?: CharacterAsset; discarded: boolean; warming?: Promise<void> };
const cache = new Map<CharacterId, Entry>();
let owners = 0;

function idle() {
  return new Promise<void>(resolve => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) window.requestIdleCallback(() => resolve(), { timeout: 250 });
    else setTimeout(resolve, 0);
  });
}

function disposeAsset(asset: CharacterAsset) {
  asset.dance?.dispose(); asset.mixer?.stopAllAction(); asset.mixer?.uncacheRoot(asset.scene);
  const skeletons = new Set<Skeleton>();
  asset.scene.traverse(object => { if (object instanceof SkinnedMesh) skeletons.add(object.skeleton); });
  skeletons.forEach(skeleton => skeleton.dispose());
  VRMUtils.deepDispose(asset.scene);
}

/** Chỉ có bốn model đã khai báo; giữ rig/material/texture và mixer qua các lần đổi phòng, không tăng cache theo URL tùy ý. */
export function loadCharacterAsset(id: CharacterId): Promise<CharacterAsset> {
  const existing = cache.get(id);
  if (existing) return existing.promise;
  let entry: Entry;
  const load = async (): Promise<CharacterAsset> => {
    await idle();
    const definition = definitions[id];
    const loader = new GLTFLoader();
    if (definition.format === 'vrm') loader.register(parser => new VRMLoaderPlugin(parser));
    const gltf = await loader.loadAsync(definition.url);
    const vrm = gltf.userData.vrm as VRM | undefined;
    if (definition.format === 'vrm' && !vrm) throw new Error(`Không đọc được rig ${definition.name}`);
    if (vrm) VRMUtils.rotateVRM0(vrm);
    const scene = vrm?.scene ?? gltf.scene;
    const bounds = new Box3().setFromObject(scene);
    const scale = definition.height / (bounds.max.y - bounds.min.y);
    if (!Number.isFinite(scale) || scale <= 0) { VRMUtils.deepDispose(scene); throw new Error(`Kích thước ${definition.name} không hợp lệ`); }
    scene.scale.setScalar(scale); scene.position.y = -bounds.min.y * scale;
    scene.traverse(object => { if (object instanceof Mesh) object.frustumCulled = false; });
    scene.updateMatrixWorld(true);
    // Solver được tạo trước khi normalize scale/hướng; đặt lại đuôi xương để không giật ở frame đầu.
    vrm?.springBoneManager?.reset();
    let footClearance = 0;
    if (vrm) {
      const heights = (['leftFoot', 'rightFoot'] as const).flatMap(side => {
        const bone = vrm.humanoid.getRawBoneNode(side); return bone ? [bone.getWorldPosition(new Vector3()).y] : [];
      });
      footClearance = heights.length ? Math.min(...heights) : 0;
    } else if (id === 'rosetta') {
      const heights = ['Foot.L', 'Foot.R'].flatMap(name => {
        const bone = scene.getObjectByName(PropertyBinding.sanitizeNodeName(name)); return bone ? [bone.getWorldPosition(new Vector3()).y] : [];
      });
      footClearance = heights.length ? Math.min(...heights) : 0;
    }
    const asset: CharacterAsset = { scene, vrm, animations: gltf.animations, baseY: scene.position.y, footClearance };
    if (vrm && (id === 'wine' || id === 'pop')) {
      try { asset.dance = await createRecordedClubDance(vrm, definition.name); } catch { /* Vẫn cho model vào game với điệu dự phòng khi clip lỗi. */ }
    } else if (gltf.animations.length) {
      asset.mixer = new AnimationMixer(scene);
      const expressions = id === 'rosetta' ? gltf.animations.flatMap(clip => clip.tracks.filter(track => track.name.includes('morphTargetInfluences'))) : [];
      if (expressions.length) {
        // Biểu cảm chạy riêng để khi blend sang nhảy, mắt vẫn chớp thay vì mất theo trọng số động tác thân.
        asset.expression = asset.mixer.clipAction(new AnimationClip('Rosetta_Expression', -1, expressions)).play();
        asset.animations = gltf.animations.map(clip => new AnimationClip(clip.name, clip.duration, clip.tracks.filter(track => !track.name.includes('morphTargetInfluences'))));
      }
      asset.animations.forEach(clip => asset.mixer!.clipAction(clip).play());
    }
    if (entry.discarded) { disposeAsset(asset); throw new Error('Model đã được giải phóng'); }
    entry.value = asset;
    return asset;
  };
  // Bắt đầu tải các model độc lập cùng lúc; không nối tiếp cả HTTP, decode và retarget của từng NPC.
  const promise = load().catch(error => { if (cache.get(id) === entry) cache.delete(id); throw error; });
  entry = { promise, discarded: false };
  cache.set(id, entry);
  return promise;
}

/** Upload texture chia từng nhịp nhàn rỗi, tránh dồn toàn bộ PNG lên GPU đúng lúc mở cửa. */
export async function warmCharacterTextures(id: CharacterId, renderer: WebGLRenderer) {
  const asset = await loadCharacterAsset(id), entry = cache.get(id);
  if (!entry || entry.discarded) throw new Error('Model đã được giải phóng');
  if (!entry.warming) entry.warming = warmSceneTextures(asset.scene, renderer, () => entry.discarded).catch(error => { entry.warming = undefined; throw error; });
  return entry.warming;
}

/** Dùng chung bước upload texture cho NPC, người chơi và nội thất được tải bằng useGLTF. */
export async function warmSceneTextures(scene: Group, renderer: WebGLRenderer, cancelled = () => false) {
  const textures = new Set<Texture>();
  scene.traverse(object => {
    if (!(object instanceof Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      Object.values(material).forEach(value => { if (value instanceof Texture) textures.add(value); });
      if ('uniforms' in material) Object.values(material.uniforms as Record<string, { value: unknown }>).forEach(uniform => { if (uniform.value instanceof Texture) textures.add(uniform.value); });
    }
  });
  let index = 0;
  for (const texture of textures) {
    // Tối đa ba texture mỗi lượt nhàn rỗi để giảm thời gian chuẩn bị mà không dồn toàn bộ upload vào một frame.
    if (index++ % 3 === 0) await idle();
    if (cancelled()) throw new Error('Đã hủy chuẩn bị texture');
    if (renderer.getContext().isContextLost()) throw new Error('WebGL đang mất kết nối');
    renderer.initTexture(texture);
  }
}

export function clearCharacterAssets() {
  for (const entry of cache.values()) { entry.discarded = true; if (entry.value) disposeAsset(entry.value); }
  cache.clear();
}

/** Cleanup trễ một microtask để StrictMode không xóa cache giữa cleanup/setup giả lập. */
export function retainCharacterAssets() {
  owners++; let released = false;
  return () => {
    if (released) return; released = true; owners--;
    queueMicrotask(() => { if (owners === 0) clearCharacterAssets(); });
  };
}
