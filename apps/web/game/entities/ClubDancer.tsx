'use client';

import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import { createClubDance } from '../systems/clubDance';
import { CLUB_NPCS, loadCharacterAsset, type CharacterAsset } from '../systems/characterAssets';
import { getClubBeat } from '../systems/BeatSyncController';
import { updateDanceRig } from '../systems/retargetClubMotion';
import type { ClubShow } from '@metaverse/game-protocol';

/** Rig/mixer sống trong cache giới hạn; component chỉ gắn lại model khi quay vào club. */
export function ClubDancer({ id, x, epoch, phase, show }: { id: 'wine' | 'pop'; x: number; epoch: number; phase: number; show: ClubShow }) {
  const name = CLUB_NPCS[id].name;
  const [asset, setAsset] = useState<CharacterAsset | null>(null);
  const model = asset?.vrm;
  const [failed, setFailed] = useState(false);
  const dance = useRef<ReturnType<typeof createClubDance> | null>(null);
  const lastTelemetry = useRef(0);
  const resetPhysics = useRef(true);
  const { gl } = useThree();
  useEffect(() => {
    let cancelled = false;
    gl.domElement.dataset[`npc${name}`] = 'loading';
    setFailed(false);
    setAsset(null);
    void loadCharacterAsset(id).then(loaded => {
      if (cancelled) return;
      const vrm = loaded.vrm;
      if (!vrm) throw new Error('Không có rig VRM');
      vrm.scene.position.y = loaded.baseY;
      dance.current = createClubDance(vrm);
      loaded.dance?.resync();
      resetPhysics.current = true;
      gl.domElement.dataset[`npc${name}`] = 'ready';
      setAsset(loaded);
    }).catch(() => {
      if (!cancelled) { setFailed(true); gl.domElement.dataset[`npc${name}`] = 'error'; }
    });
    return () => {
      cancelled = true; dance.current = null;
      delete gl.domElement.dataset[`npc${name}`];
      delete gl.domElement.dataset[`dance${name}`];
      delete gl.domElement.dataset[`motion${name}`];
    };
  }, [id, name, gl]);
  useFrame((_, delta) => {
    if (!model || !epoch) return;
    const { seconds, beat } = getClubBeat(epoch, show);
    const motion = asset?.dance?.update(beat, show.cue === 'peak' ? 1 : 0, seconds);
    if (!motion) dance.current?.(seconds, phase);
    if (motion) {
      updateDanceRig(model, delta, .77 + (asset?.footClearance ?? 0), resetPhysics.current);
      gl.domElement.dataset[`motion${name}`] = motion.provider ?? 'rokoko-fbx';
    } else model.update(Math.min(delta, .05));
    resetPhysics.current = false;
    if (process.env.NODE_ENV === 'development' && (seconds - lastTelemetry.current > .2 || seconds < lastTelemetry.current)) {
      lastTelemetry.current = seconds;
      gl.domElement.dataset[`dance${name}`] = JSON.stringify({ seconds, beat, ...motion, rootY: model.scene.position.y, hipsX: model.humanoid.getNormalizedBoneNode('hips')?.position.x, hipsZ: model.humanoid.getNormalizedBoneNode('hips')?.rotation.z, armZ: model.humanoid.getNormalizedBoneNode('leftUpperArm')?.rotation.z });
    }
  });
  return <group position={[x, .77, -5.3]}>
    {model && <primitive object={model.scene} dispose={null}/>}
    <Billboard position={[0, 2.05, 0]}><Text fontSize={.16} color={failed ? '#ff8a9d' : '#fce8f5'}>{failed ? `${name}: lỗi model` : model ? name : `Đang tải ${name}…`}</Text></Billboard>
  </group>;
}
