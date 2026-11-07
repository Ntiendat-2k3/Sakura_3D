'use client';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { BufferGeometry, Float32BufferAttribute, type Group } from 'three';
import type { ClubShow } from '@metaverse/game-protocol';
import { getClubBeat, type ClubVisualSettings } from './BeatSyncController';
import { CinematicLighting } from './CinematicLighting';
import { DiscoProjectionSystem } from './DiscoProjectionSystem';

export function ClubEffectsController({ epoch, show, settings, bloom }: { epoch: number; show: ClubShow; settings: ClubVisualSettings; bloom: boolean }) {
  const fan = useRef<Group>(null);
  const { gl } = useThree();
  const lastMetric = useRef(0);
  const geometry = useMemo(() => {
    const data: number[] = [];
    for (let i = -3; i <= 3; i++) data.push(0, 0, 0, i * .6, -.6, 7);
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(data, 3)); return g;
  }, []);
  useEffect(() => () => { geometry.dispose(); delete gl.domElement.dataset.clubShow; }, [geometry, gl]);
  useFrame(() => {
    const clock = getClubBeat(epoch, show);
    if (fan.current) {
      fan.current.rotation.y = clock.seconds * .12;
      fan.current.visible = settings.quality === 'high' && !settings.reducedFlashing && clock.cue === 'peak';
    }
    if (clock.seconds - lastMetric.current > .2 || clock.seconds < lastMetric.current) {
      lastMetric.current = clock.seconds;
      gl.domElement.dataset.clubShow = JSON.stringify({ ...show, ...settings, beat: clock.beat, trackSeconds: clock.trackSeconds, activeCue: clock.cue, epoch, pulse: clock.pulse });
    }
  });
  return <>
    <group ref={fan} visible={false}>
      {[-4.6, 4.6].map(x => <lineSegments key={x} position={[x, 2.6, -6.4]} geometry={geometry}><lineBasicMaterial color="#66f2d4" transparent opacity={.2} depthWrite={false}/></lineSegments>)}
      <pointLight position={[0, 2.6, -6]} color="#66f2d4" intensity={3} distance={7}/>
    </group>
    <DiscoProjectionSystem epoch={epoch} show={show} settings={settings}/>
    <CinematicLighting enabled={bloom && settings.quality === 'high'}/>
  </>;
}
