/** Blend vẫy tay/dáng đã duyệt với chuyển trọng tâm và chân trụ IK; không đổi vị trí nhóm NPC. */
import { MathUtils, PropertyBinding, Quaternion, Vector3, type AnimationAction, type AnimationClip, type Object3D } from 'three';
import type { CharacterAsset } from './characterAssets';
import { getRosettaPoseWeight, type RosettaMode } from './rosettaMotion';
import { createTwoBoneIK } from './hostLocomotion';

export function createRosettaGreeting(asset: CharacterAsset, clip: AnimationClip) {
  const { scene, mixer } = asset;
  if (!mixer) throw new Error('Thiếu mixer Rosetta');
  mixer.stopAllAction();
  const idle = asset.animations.map(value => mixer.clipAction(value).reset().play().setEffectiveWeight(1));
  asset.expression?.reset().play();
  mixer.update(0);
  const find = (name: string) => { const node = scene.getObjectByName(PropertyBinding.sanitizeNodeName(name)); if (!node) throw new Error(`Thiếu bone ${name}`); return node; };
  const hip = find('Hips');
  const legs = (['L', 'R'] as const).map(side => {
    const upper = find(`Upper Leg.${side}`), lower = find(`Lower Leg.${side}`), foot = find(`Foot.${side}`);
    return { upper, lower, foot, solve: createTwoBoneIK(upper, lower, foot), beauty: new Vector3(), standing: new Vector3(), beautyRotation: new Quaternion(), standingRotation: new Quaternion(), target: new Vector3(), flat: new Quaternion() };
  });
  const localFoot = (leg: typeof legs[number], position: Vector3, rotation: Quaternion) => {
    scene.updateWorldMatrix(true, true);
    scene.worldToLocal(leg.foot.getWorldPosition(position));
    scene.getWorldQuaternion(rotation).invert().multiply(leg.foot.getWorldQuaternion(new Quaternion()));
  };
  legs.forEach(leg => localFoot(leg, leg.beauty, leg.beautyRotation));
  idle.forEach(action => action.setEffectiveWeight(0));
  const wave = mixer.clipAction(clip).reset().play().setEffectiveWeight(1); mixer.update(0);
  legs.forEach(leg => localFoot(leg, leg.standing, leg.standingRotation));
  const shift = legs[0].beauty.clone().sub(legs[0].standing);
  legs.forEach(leg => { leg.standing.add(shift); leg.standing.y = legs[0].beauty.y; });
  wave.setEffectiveWeight(0); idle.forEach(action => action.setEffectiveWeight(1)); mixer.update(0);
  const affected: Object3D[] = [hip, ...legs.flatMap(leg => [leg.upper, leg.lower, leg.foot])];
  const bases = affected.map(node => ({ node, position: node.position.clone(), rotation: node.quaternion.clone() }));
  const sourceRotations = legs.map(() => [new Quaternion(), new Quaternion(), new Quaternion()]);
  const worldRotation = new Quaternion(), point = new Vector3(), displacement = new Vector3(), pole = new Vector3(), knee = new Vector3(), line = new Vector3();
  let danceWeight = 0, poseWeight = 1;
  return {
    legs,
    update(seconds: number, delta: number, mode: RosettaMode, dance: AnimationAction | null, danceSeconds: number) {
      const dt = Math.min(delta, .05);
      const targetPose = MathUtils.damp(poseWeight, mode === 'greeting' ? getRosettaPoseWeight(seconds) : 1, 12, dt);
      poseWeight += MathUtils.clamp(targetPose - poseWeight, -dt / .7, dt / .7);
      danceWeight = MathUtils.damp(danceWeight, mode === 'dancing' && dance ? 1 : 0, 7, dt);
      bases.forEach(({ node, position, rotation }) => { node.position.copy(position); node.quaternion.copy(rotation); });
      idle.forEach(action => { action.play().setEffectiveWeight((1 - danceWeight) * poseWeight); action.time = seconds % action.getClip().duration; });
      wave.play().setEffectiveWeight((1 - danceWeight) * (1 - poseWeight)); wave.time = seconds % clip.duration;
      if (dance) { dance.play().setEffectiveWeight(danceWeight); dance.time = danceSeconds % dance.getClip().duration; }
      if (asset.expression) { asset.expression.play().setEffectiveWeight(1); asset.expression.time = seconds % asset.expression.getClip().duration; }
      mixer.update(0);
      bases.forEach(base => { base.position.copy(base.node.position); base.rotation.copy(base.node.quaternion); });
      scene.updateWorldMatrix(true, true);
      hip.getWorldPosition(point); displacement.copy(shift).multiplyScalar((1 - poseWeight) * (1 - danceWeight));
      scene.localToWorld(displacement); scene.getWorldPosition(knee); displacement.sub(knee); point.add(displacement);
      hip.position.copy(hip.parent!.worldToLocal(point)); scene.updateWorldMatrix(true, true);
      scene.getWorldQuaternion(worldRotation);
      legs.forEach((leg, i) => {
        leg.target.copy(leg.standing).lerp(leg.beauty, poseWeight); scene.localToWorld(leg.target);
        leg.flat.copy(leg.standingRotation).slerp(leg.beautyRotation, poseWeight).premultiply(worldRotation);
        leg.upper.getWorldPosition(point); leg.lower.getWorldPosition(knee); pole.copy(knee).sub(point);
        line.copy(leg.target).sub(point).normalize(); pole.addScaledVector(line, -pole.dot(line));
        if (pole.lengthSq() < 1e-6) pole.set(0, 0, 1).applyQuaternion(worldRotation);
        [leg.upper, leg.lower, leg.foot].forEach((bone, index) => sourceRotations[i][index].copy(bone.quaternion));
        leg.solve(leg.target, pole.normalize(), leg.flat);
        [leg.upper, leg.lower, leg.foot].forEach((bone, index) => bone.quaternion.slerp(sourceRotations[i][index], danceWeight));
        scene.updateWorldMatrix(true, true);
      });
    },
  };
}
