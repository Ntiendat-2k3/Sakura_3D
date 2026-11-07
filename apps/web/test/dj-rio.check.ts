/** Đo thao tác tay/chân trên VRM DJ thật và xuất clip runtime để kiểm tra cùng bàn Blender offline. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AnimationClip, Box3, Group, PropertyBinding, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import { DJ_HOME } from '@metaverse/game-protocol';
import definitions from '../game/entities/club-npcs.json';
import { createDjPerformance } from '../game/systems/djPerformance';
import { unpack, pack, withAnimation } from './glb';

async function main() {
  const rootPath=resolve(__dirname,'../../..'), definition=definitions.galaxy;
  assert.equal(definition.name,'DJ Rio'); assert.equal(definition.role,'dj');
  const {doc,binary}=unpack(await readFile(resolve(rootPath,'apps/web/public',definition.url.slice(1)))), preview=JSON.parse(JSON.stringify(doc));
  delete doc.images; delete doc.textures; delete doc.extensions.VRM.meta.texture;
  doc.materials=doc.materials.map((m:{name:string})=>({name:m.name}));
  doc.extensions.VRM.materialProperties.forEach((m:{shader:string;textureProperties:object})=>{m.shader='VRM_USE_GLTFSHADER';m.textureProperties={};});
  const bytes=pack(doc,binary),loader=new GLTFLoader();loader.register(parser=>new VRMLoaderPlugin(parser));
  const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),vrm=gltf.userData.vrm as VRM;
  VRMUtils.rotateVRM0(vrm);const bounds=new Box3().setFromObject(vrm.scene),scale=definition.height/(bounds.max.y-bounds.min.y);
  vrm.scene.scale.setScalar(scale);vrm.scene.position.y=-bounds.min.y*scale;
  const root=new Group();root.name='DJ_Rio_Runtime_Root';root.position.fromArray([DJ_HOME.x,DJ_HOME.y,DJ_HOME.z]);root.rotation.y=DJ_HOME.yaw;root.add(vrm.scene);root.updateMatrixWorld(true);
  const modelNode=preview.nodes.length;
  preview.nodes.push({name:'ModelNormalization',children:preview.scenes[0].nodes,translation:vrm.scene.position.toArray(),rotation:vrm.scene.quaternion.toArray(),scale:vrm.scene.scale.toArray()});
  preview.nodes.push({name:root.name,children:[modelNode],translation:root.position.toArray(),rotation:root.quaternion.toArray()});preview.scenes[0].nodes=[modelNode+1];
  const joints=new Set<number>(preview.skins.flatMap((s:{joints:number[]})=>s.joints));
  const bones=[...joints].map(i=>vrm.scene.getObjectByName(PropertyBinding.sanitizeNodeName(preview.nodes[i].name))!).filter(Boolean);
  const data=bones.map(()=>({positions:[] as number[],rotations:[] as number[]})),times:number[]=[],positions:number[]=[];
  const controller=createDjPerformance(vrm,[DJ_HOME.x,DJ_HOME.y,DJ_HOME.z][1]),point=new Vector3(),first=new Vector3();
  let maxHandError=0,maxFootDrift=0,handTravel=0;
  for(let frame=0;frame<=900;frame++) {
    const t=frame/30;controller.update(t,1/30);
    for(const arm of controller.arms) maxHandError=Math.max(maxHandError,arm.hand.getWorldPosition(point).distanceTo(arm.target));
    for(const leg of controller.legs) maxFootDrift=Math.max(maxFootDrift,leg.foot.getWorldPosition(point).distanceTo(leg.anchor));
    controller.arms[1].hand.getWorldPosition(point);if(!frame)first.copy(point);else handTravel=Math.max(handTravel,point.distanceTo(first));
    assert.ok(bones.every(b=>[...b.position.toArray(),...b.quaternion.toArray()].every(Number.isFinite)));
    if(frame<=240){times.push(t);positions.push(...vrm.scene.position.toArray());bones.forEach((bone,i)=>{data[i].positions.push(...bone.position.toArray());data[i].rotations.push(...bone.quaternion.toArray());});}
  }
  preview.nodes[modelNode].translation=vrm.scene.position.toArray();
  const tracks=[new VectorKeyframeTrack('ModelNormalization.position',times,positions)] as (VectorKeyframeTrack|QuaternionKeyframeTrack)[];
  bones.forEach((bone,i)=>tracks.push(new VectorKeyframeTrack(`${bone.name}.position`,times,data[i].positions),new QuaternionKeyframeTrack(`${bone.name}.quaternion`,times,data[i].rotations)));
  await writeFile(resolve(rootPath,'assets/processed/dj-rio-preview.glb'),withAnimation(preview,binary,new AnimationClip('DJ_Rio_Console',8,tracks)));
  const report={name:definition.name,position:[DJ_HOME.x,DJ_HOME.y,DJ_HOME.z],frames:901,maxHandError,maxFootDrift,handTravel,browser:'SKIPPED theo yêu cầu người dùng'};
  await writeFile(resolve(rootPath,'test-results/dj-rio-check.json'),JSON.stringify(report,null,2));console.log(report);
  assert.ok(maxHandError<.035,'Tay không chạm vùng điều khiển bàn DJ');assert.ok(maxFootDrift<.025,'Chân DJ trượt khỏi vị trí đứng');assert.ok(handTravel>.1,'Tay DJ không thao tác');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
