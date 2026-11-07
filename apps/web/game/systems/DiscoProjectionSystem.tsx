'use client';
import { Billboard } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { AdditiveBlending, Color, DynamicDrawUsage, Euler, Float32BufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, PlaneGeometry, Quaternion, RingGeometry, ShaderMaterial, Vector3 } from 'three';
import type { ClubShow } from '@metaverse/game-protocol';
import { getClubBeat, type ClubVisualSettings } from './BeatSyncController';
import { CLUB_DISCO_ORIGIN, CLUB_PROJECTION_BUDGET, getClubProjectionDirection, traceClubProjection } from './clubProjection';

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    vUv = uv;
    vec4 local = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      local = instanceMatrix * local;
    #endif
    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #else
      vColor = vec3(1.0);
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * local;
  }
`;
const fragmentShader = `
  uniform float power;
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    vec2 p = vUv - .5;
    float radius = dot(p, p);
    float core = exp(-radius * 160.0);
    float halo = exp(-radius * 24.0) * .18;
    float star = exp(-abs(p.x) * 90.0 - abs(p.y) * 12.0)
               + exp(-abs(p.y) * 90.0 - abs(p.x) * 12.0);
    float alpha = min(1.0, core + .35 * star + halo) * power;
    if (alpha < .003) discard;
    gl_FragColor = vec4(vColor, alpha);
    #include <colorspace_fragment>
  }
`;

/** Chiếu đốm/vòng sáng giả lập bằng instancing, không tạo hàng trăm đèn hoặc thay model disco ball. */
export function DiscoProjectionSystem({ epoch, show, settings }: { epoch: number; show: ClubShow; settings: ClubVisualSettings }) {
  const { gl } = useThree();
  const rig = useMemo(() => {
    const geometry = new PlaneGeometry(1, 1);
    const material = new ShaderMaterial({ vertexShader, fragmentShader, uniforms: { power: { value: .8 } }, transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false });
    const bulbMaterial = material.clone();
    bulbMaterial.depthTest = false; bulbMaterial.uniforms.power.value = .7;
    const spots = new InstancedMesh(geometry, material, CLUB_PROJECTION_BUDGET.high);
    spots.instanceMatrix.setUsage(DynamicDrawUsage);
    for (let i = 0; i < CLUB_PROJECTION_BUDGET.high; i++) spots.setColorAt(i, new Color());
    spots.instanceColor!.setUsage(DynamicDrawUsage);
    spots.frustumCulled = false;
    const ringGeometry = new RingGeometry(.976, 1, 96);
    const positions = ringGeometry.getAttribute('position');
    const colors = new Float32Array(positions.count * 3);
    const color = new Color();
    for (let i = 0; i < positions.count; i++) {
      color.setHSL((Math.atan2(positions.getY(i), positions.getX(i)) / (Math.PI * 2) + 1) % 1, 1, .6);
      color.toArray(colors, i * 3);
    }
    ringGeometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    const ringMaterial = new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .55, blending: AdditiveBlending, depthWrite: false, toneMapped: false });
    const rings = new InstancedMesh(ringGeometry, ringMaterial, 3);
    rings.instanceMatrix.setUsage(DynamicDrawUsage); rings.frustumCulled = false;
    return { spots, geometry, material, bulbMaterial, rings, ringGeometry, ringMaterial, color, matrix: new Matrix4(), ray: new Vector3(), point: new Vector3(), normal: new Vector3(), tangent: new Vector3(), bitangent: new Vector3(), scale: new Vector3(), orientation: new Quaternion(), euler: new Euler(), lastMetric: 0 };
  }, []);
  useEffect(() => () => {
    rig.spots.dispose(); rig.rings.dispose(); rig.geometry.dispose(); rig.material.dispose(); rig.bulbMaterial.dispose(); rig.ringGeometry.dispose(); rig.ringMaterial.dispose(); delete gl.domElement.dataset.discoProjection;
  }, [rig, gl]);
  useFrame(() => {
    const clock = getClubBeat(epoch, show);
    const count = CLUB_PROJECTION_BUDGET[settings.quality];
    rig.spots.count = count;
    const energy = clock.cue === 'lounge' ? .7 : clock.cue === 'peak' ? 1 : .85;
    rig.material.uniforms.power.value = energy * (settings.reducedFlashing ? .8 : .78 + .14 * clock.pulse);
    for (let i = 0; i < count; i++) {
      getClubProjectionDirection(i, count, clock.seconds, settings.reducedFlashing, rig.ray);
      if (!traceClubProjection(rig.ray, rig.point, rig.normal)) {
        rig.matrix.makeScale(0, 0, 0); rig.spots.setMatrixAt(i, rig.matrix); continue;
      }
      const distance = rig.point.distanceTo(CLUB_DISCO_ORIGIN);
      const incidence = Math.abs(rig.ray.dot(rig.normal));
      rig.tangent.copy(rig.ray).addScaledVector(rig.normal, -rig.ray.dot(rig.normal));
      if (rig.tangent.lengthSq() < 1e-6) rig.tangent.set(1, 0, 0);
      rig.tangent.normalize(); rig.bitangent.crossVectors(rig.normal, rig.tangent).normalize();
      const size = .12 + distance * .025;
      rig.scale.set(size / Math.max(.4, incidence), size, 1);
      rig.matrix.makeBasis(rig.tangent, rig.bitangent, rig.normal).scale(rig.scale);
      rig.point.addScaledVector(rig.normal, .014); rig.matrix.setPosition(rig.point);
      rig.spots.setMatrixAt(i, rig.matrix);
      rig.color.setHSL((i * .142857 + clock.seconds * .008) % 1, 1, .6);
      rig.spots.setColorAt(i, rig.color);
    }
    rig.spots.instanceMatrix.needsUpdate = true; rig.spots.instanceColor!.needsUpdate = true;
    for (let i = 0; i < 3; i++) {
      const angle = clock.seconds * (settings.reducedFlashing ? .09 : .18) + i * Math.PI * 2 / 3;
      rig.point.set(Math.cos(angle) * .72, .106, .3 + Math.sin(angle) * .72);
      rig.orientation.setFromEuler(rig.euler.set(-Math.PI / 2, 0, angle));
      rig.matrix.compose(rig.point, rig.orientation, rig.scale.set(1.65, 1.65, 1));
      rig.rings.setMatrixAt(i, rig.matrix);
    }
    rig.ringMaterial.opacity = (settings.reducedFlashing ? .44 : .62) * energy;
    rig.rings.instanceMatrix.needsUpdate = true;
    if (clock.seconds - rig.lastMetric > .5 || clock.seconds < rig.lastMetric) {
      rig.lastMetric = clock.seconds;
      gl.domElement.dataset.discoProjection = JSON.stringify({ spots: count, rings: 3, rotation: clock.seconds * (settings.reducedFlashing ? .12 : .24), mode: 'continuous', cue: clock.cue });
    }
  });
  return <>
    <primitive object={rig.spots} dispose={null}/>
    <primitive object={rig.rings} dispose={null}/>
    <Billboard position={[CLUB_DISCO_ORIGIN.x, CLUB_DISCO_ORIGIN.y, CLUB_DISCO_ORIGIN.z]}>
      <mesh geometry={rig.geometry} material={rig.bulbMaterial} scale={.9} dispose={null}/>
    </Billboard>
  </>;
}
