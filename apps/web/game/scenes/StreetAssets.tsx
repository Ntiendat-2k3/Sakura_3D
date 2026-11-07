'use client';

// Nạp GLB theo scene, chia sẻ vật liệu atlas và instancing đạo cụ để giữ ngân sách draw call.
import { ContactShadows, useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import originalPlacements from '../../public/assets/props/placements.json';
import lanterns from './street-lantern-layout.json';

const placements = [...originalPlacements.map(item => item.model === 'lantern' ? { ...item, position: [item.position[0], lanterns.facadeBaseY, item.position[2]] } : item),
  ...lanterns.rows.flatMap(z => lanterns.lanternX.map(x => ({ model: 'lantern', position: [x, lanterns.anchorY - lanterns.cordTop, z], rotation: 0 })))];

const models = [...new Set(placements.map(item => item.model))];
const urls = ['/assets/buildings/sakura-street.glb', '/assets/props/ground.glb', ...models.map(name => `/assets/props/${name}.glb`), '/assets/props/lantern-garlands.glb'];
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
    return { buildings: scenes[0], ground: scenes[1], props, garlands: scenes[scenes.length - 1], ownedMaterials: [...shared.values()].filter(value => value.name.includes('warm ribbed paper')).concat([...wetRoad.values()]) };
  }, [loaded]);

  useEffect(() => () => assets.ownedMaterials.forEach(material => material.dispose()), [assets]);

  useEffect(() => {
    gl.domElement.dataset.assetStatus = 'ready';
    gl.domElement.dataset.assetSource = 'kenney-cc0-glb';
    gl.domElement.dataset.buildings = '8';
    onReady();
    return () => { delete gl.domElement.dataset.assetStatus; };
  }, [gl, onReady]);

  return <group name="Sakura licensed asset street" dispose={null}>
    <primitive object={assets.buildings}/>
    <primitive object={assets.ground}/>
    <primitive object={assets.garlands}/>
    {assets.props.flatMap((parts, index) => parts.map((part, i) => <PropInstances key={`${models[index]}-${i}`} part={part} model={models[index]}/>))}
    {roadLights.map((light, index) => <group key={index}>
      <primitive object={light.target}/>
      <spotLight position={light.position} target={light.target} color={lanterns.light.color} intensity={lanterns.light.intensity} distance={lanterns.light.distance} angle={lanterns.light.angle} penumbra={1} decay={2}/>
    </group>)}
    <ContactShadows position={[0, 0.015, 0]} opacity={0.45} scale={64} blur={2} far={20} resolution={512} frames={1} color="#100d26"/>
  </group>;
}
