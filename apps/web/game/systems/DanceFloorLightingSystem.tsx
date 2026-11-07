'use client';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useEffect } from 'react';
import { Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, type PointLight } from 'three';
import type { ClubShow } from '@metaverse/game-protocol';
import { getClubBeat, type ClubVisualSettings } from './BeatSyncController';

function FloorTiles({ id, parity }: { id: string; parity: number }) {
  const { scene } = useGLTF(`/assets/props/club/${id}.glb`);
  const group = useMemo(() => {
    const root = new Group(); scene.updateMatrixWorld(true);
    const places: [number, number][] = [];
    for (let x = 0; x < 6; x++) for (let z = 0; z < 4; z++) if ((x + z) % 2 === parity) places.push([x - 2.5, z - 1.5]);
    scene.traverse(node => {
      if (!(node instanceof Mesh)) return;
      const originals = Array.isArray(node.material) ? node.material : [node.material];
      const materials = originals.map(original => {
        const material = original.clone();
        if (material instanceof MeshStandardMaterial) {
          material.color.multiplyScalar(.55);
          material.emissiveIntensity *= .16;
          material.roughness = .4;
        }
        return material;
      });
      const instanced = new InstancedMesh(node.geometry, Array.isArray(node.material) ? materials : materials[0], places.length);
      places.forEach(([x, z], i) => instanced.setMatrixAt(i, new Matrix4().makeTranslation(x, -.005, z).multiply(node.matrixWorld)));
      instanced.computeBoundingSphere(); root.add(instanced);
    });
    return root;
  }, [scene, parity]);
  useEffect(() => () => group.traverse(node => {
    if (node instanceof InstancedMesh) {
      (Array.isArray(node.material) ? node.material : [node.material]).forEach(material => material.dispose());
      node.dispose();
    }
  }), [group]);
  return <primitive object={group} dispose={null}/>;
}

export function DanceFloorLightingSystem({ epoch, show, settings }: { epoch: number; show: ClubShow; settings: ClubVisualSettings }) {
  const light = useRef<PointLight>(null);
  useFrame(() => {
    if (!light.current) return;
    const { beat, cue } = getClubBeat(epoch, show);
    light.current.visible = settings.quality === 'high';
    light.current.color.setHSL(.84 + .08 * Math.sin(beat * Math.PI / 16), .8, .65);
    light.current.intensity = (cue === 'lounge' ? 2 : 4) * (settings.reducedFlashing ? 1 : .9 + .1 * Math.sin(beat * Math.PI / 2));
  });
  return <>
    <FloorTiles id="34111" parity={0}/><FloorTiles id="34112" parity={1}/>
    <pointLight ref={light} position={[0, 2.7, 0]} distance={9} intensity={8} decay={2}/>
  </>;
}
