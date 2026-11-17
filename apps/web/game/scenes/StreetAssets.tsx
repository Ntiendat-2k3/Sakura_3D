'use client';

// Nạp GLB theo scene, chia sẻ vật liệu atlas và instancing đạo cụ để giữ ngân sách draw call.
import { ContactShadows, Text, useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import originalPlacements from '../../public/assets/props/placements.json';
import lanterns from './street-lantern-layout.json';
import { calculateFlicker, calculateSignFlicker } from '../systems/RainWeatherSystem';
import { getWorldEnvironment, neonLevel, streetLightLevel } from '../systems/worldClock';
import { STREET_DECOR } from '@metaverse/game-protocol';

const placements = [...originalPlacements.map(item => item.model === 'lantern' ? { ...item, position: [item.position[0], lanterns.facadeBaseY, item.position[2]] } : item),
  ...lanterns.rows.flatMap(z => lanterns.lanternX.map(x => ({ model: 'lantern', position: [x, lanterns.anchorY - lanterns.cordTop, z], rotation: 0 })))];

const models = [...new Set(placements.map(item => item.model))];
/** Cây anh đào, đèn đá, cột điện + dây, cổng bắc, đồ vỉa hè (scripts/build-street-decor.py). */
export const STREET_DECOR_URL = '/assets/props/street-decor.glb';
const urls = ['/assets/buildings/sakura-street.glb', '/assets/props/ground.glb', ...models.map(name => `/assets/props/${name}.glb`), '/assets/props/lantern-garlands.glb', STREET_DECOR_URL];
type Part = { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; matrix: THREE.Matrix4 };

function PropInstances({ part, model }: { part: Part; model: string }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const instances = useMemo(() => placements.filter(item => item.model === model), [model]);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const transform = new THREE.Object3D();
    instances.forEach((item, index) => {
      transform.position.fromArray(item.position);
      transform.rotation.set(0, item.rotation, 0);
      transform.updateMatrix();
      ref.current!.setMatrixAt(index, transform.matrix.clone().multiply(part.matrix));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [instances, part]);

  return <instancedMesh ref={ref} name={`asset:${model}`} args={[part.geometry, part.material, instances.length]} dispose={null}/>;
}

export function StreetAssets({ onReady }: { onReady: () => void }) {
  const loaded = useGLTF(urls);
  const { gl } = useThree();
  const roadLights = useMemo(() => lanterns.lightRows.flatMap(z => [-1, 1].map(side => {
    const target = new THREE.Object3D(); target.position.set(side * lanterns.light.targetX, .02, z);
    return { position: [side * lanterns.light.x, lanterns.light.height, z] as [number, number, number], target };
  })), []);
  const assets = useMemo(() => {
    const shared = new Map<string, THREE.Material>();
    const share = (material: THREE.Material) => {
      if (!shared.has(material.name)) {
        if (material instanceof THREE.MeshStandardMaterial && material.name.includes('warm ribbed paper')) {
          const red = material.clone(); red.color.set('#b00b1e'); red.emissive.set('#ff0820'); red.emissiveIntensity = .55; shared.set(material.name, red);
        } else shared.set(material.name, material);
      }
      return shared.get(material.name)!;
    };
    const scenes = loaded.map(gltf => {
      const scene = gltf.scene.clone(true);
      scene.updateMatrixWorld(true);
      scene.traverse(object => {
        if (object instanceof THREE.Mesh) object.material = Array.isArray(object.material) ? object.material.map(share) : share(object.material);
      });
      return scene;
    });
    const wetRoad = new Map<THREE.Material, THREE.Material>();
    const wet = (material: THREE.Material) => {
      if (!(material instanceof THREE.MeshStandardMaterial)) return material;
      let copy = wetRoad.get(material);
      if (!copy) { copy = material.clone(); copy.name = `${material.name} / wet road`; (copy as THREE.MeshStandardMaterial).roughness = lanterns.road.roughness; (copy as THREE.MeshStandardMaterial).metalness = lanterns.road.metalness; wetRoad.set(material, copy); }
      return copy;
    };
    const props = scenes.slice(2, 2 + models.length).map((scene, index) => {
      const parts: Part[] = [];
      scene.traverse(object => {
        if (object instanceof THREE.Mesh) {
          const material = models[index].startsWith('road-') ? Array.isArray(object.material) ? object.material.map(wet) : wet(object.material) : object.material;
          parts.push({ geometry: object.geometry, material, matrix: object.matrixWorld.clone() });
        }
      });
      return parts;
    });
    return { buildings: scenes[0], ground: scenes[1], props, garlands: scenes[2 + models.length], decor: scenes[3 + models.length], ownedMaterials: [...shared.values()].filter(value => value.name.includes('warm ribbed paper')).concat([...wetRoad.values()]) };
  }, [loaded]);

  useEffect(() => () => assets.ownedMaterials.forEach(material => material.dispose()), [assets]);

  useEffect(() => {
    gl.domElement.dataset.assetStatus = 'ready';
    gl.domElement.dataset.assetSource = 'kenney-cc0-glb';
    gl.domElement.dataset.buildings = '8';
    onReady();
    return () => { delete gl.domElement.dataset.assetStatus; };
  }, [gl, onReady]);

  const spotLightsRef = useRef<THREE.SpotLight[]>([]);
  spotLightsRef.current = [];

  // 8 bóng đèn đường tại đúng vị trí cột đèn cong (light-curved) hai bên vỉa hè
  const streetLamps = useMemo(() => {
    const zRows = [-13, -5, 3, 11];
    return zRows.flatMap(z => [-1, 1].map(side => {
      const target = new THREE.Object3D();
      target.position.set(side * 1.8, 0, z);
      return {
        side,
        z,
        bulbPosition: [side * 3.85, 4.65, z] as [number, number, number],
        target,
      };
    }));
  }, []);

  const streetLampSpotsRef = useRef<THREE.SpotLight[]>([]);
  streetLampSpotsRef.current = [];
  const streetLampPointsRef = useRef<THREE.PointLight[]>([]);
  streetLampPointsRef.current = [];

  // Tìm các vật liệu phát sáng của biển hiệu tòa nhà để tăng độ sáng và tạo hiệu ứng nhấp nháy sinh động, êm dịu
  const buildingEmissiveMaterials = useMemo(() => {
    const list: Array<{ mat: THREE.MeshStandardMaterial; baseIntensity: number }> = [];
    const visited = new Set<THREE.Material>();
    assets.buildings.traverse(obj => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(m => {
        if (m instanceof THREE.MeshStandardMaterial && !visited.has(m)) {
          visited.add(m);
          const lum = m.emissive.r + m.emissive.g + m.emissive.b;
          if (lum > 0.05 || m.emissiveMap) {
            // Nâng độ sáng phát quang của biển hiệu tòa nhà rực rỡ, lung linh trong đêm
            list.push({ mat: m, baseIntensity: Math.max(2.2, (m.emissiveIntensity || 1.0) * 2.2) });
          }
        }
      });
    });
    return list;
  }, [assets.buildings]);

  // Đèn đá, lồng đèn và bảng hiệu cổng bắc: vật liệu tên "decor glow" sáng theo ngày/đêm như lồng đèn giấy.
  const decorGlow = useMemo(() => {
    const list: Array<{ mat: THREE.MeshStandardMaterial; base: number; sign: boolean }> = [];
    const seen = new Set<THREE.Material>();
    assets.decor.traverse(obj => {
      if (!(obj instanceof THREE.Mesh)) return;
      for (const m of Array.isArray(obj.material) ? obj.material : [obj.material]) {
        if (!(m instanceof THREE.MeshStandardMaterial) || seen.has(m) || !m.name.includes('decor glow')) continue;
        seen.add(m);
        list.push({ mat: m, base: m.emissiveIntensity || 1, sign: m.name.includes('gate sign') });
      }
    });
    return list;
  }, [assets.decor]);

  // Tìm vật liệu lồng đèn đỏ giấy để điều khiển phát sáng ấm áp
  const lanternPaperMaterial = useMemo(() => {
    return assets.ownedMaterials.find(m => m.name.includes('warm ribbed paper')) as THREE.MeshStandardMaterial | undefined;
  }, [assets]);

  // Điều khiển ánh sáng đèn đường, lồng đèn và biển hiệu nhấp nháy êm dịu trong đêm mưa u ám
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const env = getWorldEnvironment(Date.now());
    const { rainIntensity } = env;
    const flicker = calculateFlicker(time, rainIntensity);
    // Ban ngày đèn đường/lồng đèn tắt, chạng vạng bật dần; biển hiệu neon chỉ dịu bớt chứ không tắt hẳn
    const lights = streetLightLevel(env);
    const neon = neonLevel(env);

    // Cường độ đèn rọi lồng đèn đỏ trên cao
    for (let i = 0; i < spotLightsRef.current.length; i++) {
      const spot = spotLightsRef.current[i];
      if (spot) {
        spot.intensity = 42 * flicker * lights;
      }
    }

    // Điều khiển 8 bóng đèn đường: sáng rõ ấm áp, thỉnh thoảng có bóng chập chờn nhẹ tự nhiên
    for (let i = 0; i < streetLampSpotsRef.current.length; i++) {
      const spot = streetLampSpotsRef.current[i];
      const point = streetLampPointsRef.current[i];
      // Chu kỳ chập chờn từ 6.5s đến 11s riêng biệt cho từng bóng đèn đường
      const period = 6.5 + (i * 1.9) % 4.5;
      const phase = (time + i * 3.7) % period;
      let lampFlicker = 1.0;

      // Chỉ chập chờn trong khoảng 0.22s của chu kỳ, còn lại luôn sáng ổn định
      if (phase < 0.20) {
        lampFlicker = 0.45 + 0.55 * Math.sin(phase * 48 + i);
      } else if (phase >= 0.20 && phase < 0.28) {
        lampFlicker = 1.18; // Khởi động lại sáng nhẹ
      }

      if (rainIntensity > 0.3) {
        lampFlicker *= (0.95 + 0.05 * Math.sin(time * 3.2 + i));
      }

      const currentFlicker = THREE.MathUtils.clamp(lampFlicker, 0.35, 1.25);
      if (spot) spot.intensity = 55 * currentFlicker * lights;
      if (point) point.intensity = 14 * currentFlicker * lights;
    }

    // Hiệu ứng nhấp nháy biển hiệu neon tòa nhà sinh động nhưng hoàn toàn không gây đau mắt
    buildingEmissiveMaterials.forEach((entry, idx) => {
      const signFlicker = calculateSignFlicker(time, idx + 1, rainIntensity);
      entry.mat.emissiveIntensity = entry.baseIntensity * signFlicker * neon;
    });

    // Ban ngày đèn đá/lồng đèn gần như tắt; bảng hiệu cổng dịu theo neon chứ không tắt hẳn.
    for (const entry of decorGlow) entry.mat.emissiveIntensity = entry.base * (entry.sign ? .3 + .7 * neon : (.08 + .92 * lights) * flicker);

    // Phát sáng lồng đèn đỏ dịu ấm
    if (lanternPaperMaterial) {
      lanternPaperMaterial.emissiveIntensity = 0.95 * flicker * (0.15 + 0.85 * lights);
    }
  });

  return <group name="Sakura licensed asset street" dispose={null}>
    <primitive object={assets.buildings}/>
    <primitive object={assets.ground}/>
    <primitive object={assets.garlands}/>
    <primitive object={assets.decor}/>
    {/* Chữ bảng hiệu cổng thương phố phía bắc, hai mặt (mặt nam nhìn từ trong phố). */}
    {[1, -1].map(face => <Text key={face} position={[0, STREET_DECOR.gate.height - 1.35, STREET_DECOR.gate.z + face * .11]} rotation={[0, face > 0 ? 0 : Math.PI, 0]} fontSize={.5} color="#9c1010" letterSpacing={.18} anchorX="center" anchorY="middle">
      SAKURA DORI
    </Text>)}
    {assets.props.flatMap((parts, index) => parts.map((part, i) => <PropInstances key={`${models[index]}-${i}`} part={part} model={models[index]}/>))}
    {/* Đèn rọi lồng đèn trên cao */}
    {roadLights.map((light, index) => <group key={`road-light-${index}`}>
      <primitive object={light.target}/>
      <spotLight
        ref={el => { if (el) spotLightsRef.current.push(el); }}
        position={light.position}
        target={light.target}
        color={lanterns.light.color}
        intensity={lanterns.light.intensity}
        distance={lanterns.light.distance}
        angle={lanterns.light.angle}
        penumbra={1}
        decay={2}
      />
    </group>)}
    {/* 8 bóng đèn đường tại các cột đèn cong hai bên vỉa hè: tỏa ánh sáng vàng ấm xuống đường và vỉa hè */}
    {streetLamps.map((lamp, index) => <group key={`street-lamp-${index}`}>
      <primitive object={lamp.target}/>
      <spotLight
        ref={el => { if (el) streetLampSpotsRef.current.push(el); }}
        position={lamp.bulbPosition}
        target={lamp.target}
        color="#fff0cf"
        intensity={55}
        distance={16}
        angle={0.75}
        penumbra={0.85}
        decay={1.8}
      />
      <pointLight
        ref={el => { if (el) streetLampPointsRef.current.push(el); }}
        position={lamp.bulbPosition}
        color="#ffe6b0"
        intensity={14}
        distance={9}
        decay={2}
      />
      {/* Khối cầu bóng đèn phát quang tại chao đèn */}
      <mesh position={lamp.bulbPosition}>
        <sphereGeometry args={[0.075, 8, 8]}/>
        <meshBasicMaterial color="#fff6e5"/>
      </mesh>
    </group>)}
    <ContactShadows position={[0, 0.015, 0]} opacity={0.45} scale={64} blur={2} far={20} resolution={512} frames={1} color="#100d26"/>
  </group>;
}
