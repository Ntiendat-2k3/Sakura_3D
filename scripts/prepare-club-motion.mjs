// Xuất keyframe FBX thành dữ liệu nhẹ; giữ bind pose thật và chuẩn hóa rig ngoài Mixamo khi người dùng cung cấp.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(resolve('apps/web/package.json'));
const three = require.resolve('three');
const { FBXLoader } = await import(pathToFileURL(resolve(three, '../../examples/jsm/loaders/FBXLoader.js')));
const { AnimationMixer, Matrix4, Quaternion, Vector3 } = await import(pathToFileURL(three));
const custom = process.argv.includes('--mixamo');
const selectedFile = process.argv.find(arg => arg.startsWith('--file='))?.slice(7);
if (selectedFile && (!custom || !/^[\w -]+\.fbx$/i.test(selectedFile))) throw new Error('Chỉ chọn tên FBX trong thư mục Mixamo');
const source = resolve(custom ? 'assets/source/animations/club/mixamo' : 'assets/source/animations/club/rokoko-six/Dancing');
const output = resolve('apps/web/public/assets/animations/club');
mkdirSync(output, { recursive: true });
const summary = [];

/** Chữa đoạn xoắn đột ngột quá 0.85 rad/frame bằng hai pose ổn định hai bên; giữ nguyên thời lượng và FBX gốc. */
function repairRotationSpikes(tracks) {
  const repairs = [], a = new Quaternion(), b = new Quaternion(), q = new Quaternion();
  for (const track of tracks.filter(value => value.name.endsWith('.quaternion'))) {
    const spans = [];
    for (let i = 1; i < track.times.length; i++) {
      a.fromArray(track.values, (i - 1) * 4).normalize(); b.fromArray(track.values, i * 4).normalize();
      if (a.angleTo(b) <= .85) continue;
      const start = Math.max(0, i - 3), end = Math.min(track.times.length - 1, i + 3), last = spans[spans.length - 1];
      if (last && start <= last.end) last.end = Math.max(last.end, end); else spans.push({ start, end });
    }
    for (const { start, end } of spans) {
      a.fromArray(track.values, start * 4).normalize(); b.fromArray(track.values, end * 4).normalize();
      for (let i = start + 1; i < end; i++) {
        const t = (i - start) / (end - start), weight = t * t * (3 - 2 * t);
        q.copy(a).slerp(b, weight).normalize().toArray(track.values, i * 4);
      }
      repairs.push({ track: track.name, from: track.times[start], to: track.times[end] });
    }
  }
  return repairs;
}
const unreal = { pelvis: 'Hips', spine_01: 'Spine', spine_02: 'Spine1', spine_03: 'Spine2', neck_01: 'Neck', Head: 'Head' };
for (const [side, label] of [['l', 'Left'], ['r', 'Right']]) {
  for (const [bone, target] of Object.entries({ clavicle: 'Shoulder', upperarm: 'Arm', lowerarm: 'ForeArm', hand: 'Hand', thigh: 'UpLeg', calf: 'Leg', foot: 'Foot', ball: 'ToeBase' })) unreal[`${bone}_${side}`] = `${label}${target}`;
  for (const finger of ['thumb', 'index', 'middle', 'ring', 'pinky']) for (let n = 1; n <= 3; n++) unreal[`${finger}_0${n}_${side}`] = `${label}Hand${finger[0].toUpperCase()}${finger.slice(1)}${n}`;
}

/** Bone skin trùng tên bone animation vẫn có inverse bind T-pose; không lấy frame đầu đang nhảy làm rest pose. */
function prepareCustom(asset, clip, file) {
  const isMixamo = !!asset.getObjectByName('mixamorigHips');
  const canonical = name => isMixamo ? (/^mixamorig/.test(name) ? name : null) : unreal[name] ? `mixamorig${unreal[name]}` : null;
  const bind = new Map();
  asset.traverse(node => {
    if (node.isSkinnedMesh) node.skeleton.bones.forEach((bone, index) => bind.set(bone.name, node.skeleton.boneInverses[index].clone().invert()));
  });
  const quaternion = matrix => new Quaternion().setFromRotationMatrix(new Matrix4().extractRotation(matrix));
  const frames = Math.ceil(clip.duration * 30), times = Array.from({ length: frames + 1 }, (_, i) => Math.min(clip.duration, i / 30));
  const bones = {}, tracks = [], q = new Quaternion(), position = new Vector3();
  const hips = asset.getObjectByName(isMixamo ? 'mixamorigHips' : 'pelvis');
  if (!hips || !bind.has(hips.name)) throw new Error(`Thiếu hips/inverse bind: ${file}`);
  for (const track of clip.tracks) {
    const split = track.name.lastIndexOf('.'), name = track.name.slice(0, split), property = track.name.slice(split + 1), target = canonical(name);
    if (!target || property !== 'quaternion') continue;
    const node = asset.getObjectByName(name), rest = bind.get(name);
    if (!node || !rest) throw new Error(`Thiếu bind pose cho ${name}`);
    const parent = bind.get(node.parent.name) ?? node.parent.matrixWorld;
    bones[target] = { position: new Vector3().setFromMatrixPosition(rest).toArray(), restWorld: quaternion(rest).toArray(), parentWorld: target === 'mixamorigHips' ? [0, 0, 0, 1] : quaternion(parent).toArray() };
    const interpolant = track.createInterpolant();
    tracks.push({ name: `${target}.quaternion`, times: times.map(t => +t.toFixed(5)), values: target === 'mixamorigHips' ? [] : times.flatMap(t => Array.from(interpolant.evaluate(t), v => +Number(v).toFixed(6))) });
  }
  const mixer = new AnimationMixer(asset); mixer.clipAction(clip).play();
  const hipsTrack = tracks.find(track => track.name === 'mixamorigHips.quaternion'), positions = [];
  for (const time of times) {
    mixer.setTime(Math.min(time, clip.duration - .000001)); asset.updateMatrixWorld(true);
    hips.getWorldQuaternion(q).normalize(); hipsTrack.values.push(...q.toArray().map(v => +v.toFixed(6)));
    hips.getWorldPosition(position); positions.push(...position.toArray().map(v => +v.toFixed(6)));
  }
  mixer.stopAllAction(); mixer.uncacheRoot(asset);
  tracks.push({ name: 'mixamorigHips.position', times: times.map(t => +t.toFixed(5)), values: positions });
  const id = file.replace(/\.fbx$/i, '');
  const repairs = repairRotationSpikes(tracks);
  return { id, source: file, sourceRig: isMixamo ? 'Mixamo' : 'UE-style humanoid with duplicate skin joints', provider: isMixamo ? 'mixamo' : 'user-fbx', playback: 'natural', duration: clip.duration, originalDuration: clip.duration, cleanup: { thresholdRadiansPerFrame: .85, repairs }, bones, tracks };
}

for (const file of readdirSync(source).filter(f => selectedFile ? f === selectedFile : custom ? /^(Wine|Pop|Rosetta)_dance\d*\.fbx$/.test(f) : f.endsWith('.fbx') && !f.startsWith('DancingwithDrink'))) {
  const bytes = readFileSync(resolve(source, file));
  const asset = new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  asset.updateMatrixWorld(true);
  const clip = asset.animations.find(value => value.duration > 0 && value.tracks.length);
  if (!clip) throw new Error(`Không có animation: ${file}`);
  if (custom) {
    const data = prepareCustom(asset, clip, file), json = JSON.stringify(data);
    writeFileSync(resolve(output, `${data.id}.json`), json);
    summary.push({ id: data.id, source: file, sourceRig: data.sourceRig, duration: data.duration, bones: Object.keys(data.bones).length, tracks: data.tracks.length, bytes: Buffer.byteLength(json) });
    continue;
  }
  const bones = {};
  asset.traverse(node => { if (node.isBone) bones[node.name] = { position: node.position.toArray(), restWorld: node.getWorldQuaternion(new Quaternion()).toArray(), parentWorld: node.parent.getWorldQuaternion(new Quaternion()).toArray() }; });
  const id = file.replace('_mixamo.fbx', '');
  const duration = Math.min(16, clip.duration);
  const tracks = clip.tracks.filter(t => !/Hand.*[1-4]|Toe_End|HeadTop_End/.test(t.name) && (t.name.endsWith('.quaternion') || t.name.endsWith('Hips.position'))).map(t => {
    const times = Array.from({ length: Math.ceil(duration * 30) + 1 }, (_, i) => Math.min(duration, i / 30));
    const sample = t.createInterpolant();
    return { name: t.name, times: times.map(v => +v.toFixed(4)), values: times.flatMap(time => Array.from(sample.evaluate(time), v => +Number(v).toFixed(5))) };
  });
  const data = { id, source: file, duration, originalDuration: clip.duration, bones, tracks };
  writeFileSync(resolve(output, `${id}.json`), JSON.stringify(data));
  summary.push({ id, duration, originalDuration: clip.duration, bones: Object.keys(bones).length, tracks: data.tracks.length, bytes: JSON.stringify(data).length });
}
if (!summary.length) throw new Error('Không tìm thấy animation được yêu cầu');
const manifest = resolve(output, custom ? 'mixamo-manifest.json' : 'manifest.json');
const previous = selectedFile && existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')).filter(item => !summary.some(next => next.id === item.id)) : [];
writeFileSync(manifest, JSON.stringify([...previous, ...summary], null, 2));
console.log(summary);
