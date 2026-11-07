'use client';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { PointLight } from 'three';
import type { ClubShow } from '@metaverse/game-protocol';
import layout from '../scenes/club-lighting-layout.json';
import { ClubFixture } from './StageLightingSystem';
import { getClubBeat } from './BeatSyncController';

export function BarLightingSystem({ epoch, show }: { epoch: number; show: ClubShow }) {
  const light = useRef<PointLight>(null);
  useFrame(() => { if (light.current) light.current.intensity = 3 + .4 * Math.sin(getClubBeat(epoch, show).beat * Math.PI / 16); });
  return <>
    {layout.filter(e => e.role === 'bar').map((e, i) => <ClubFixture key={i} {...e}/>)}
    <pointLight ref={light} position={[-6.5, 3.3, 1]} distance={6} decay={2} intensity={3} color="#b252dc"/>
  </>;
}
