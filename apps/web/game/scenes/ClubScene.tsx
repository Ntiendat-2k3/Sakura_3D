'use client';
import { Billboard, Text, useGLTF } from '@react-three/drei';
import { useEffect, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import { ClubDancer } from '../entities/ClubDancer';
import { WelcomeNpc } from '../entities/WelcomeNpc';
import { StageLightingSystem } from '../systems/StageLightingSystem';
import { BarLightingSystem } from '../systems/BarLightingSystem';
import { DanceFloorLightingSystem } from '../systems/DanceFloorLightingSystem';
import { ClubEffectsController } from '../systems/ClubEffectsController';
import type { ClubVisualSettings } from '../systems/BeatSyncController';
import { CLUB_DJ_LAYOUT, type DjVisit, type ClubShow } from '@metaverse/game-protocol';

export function ClubScene({ epoch, show, settings, bloom, onReady, children, dj }: { epoch: number; show: ClubShow; settings: ClubVisualSettings; bloom: boolean; onReady: () => void; children?: ReactNode; dj: DjVisit }) {
  const { scene } = useGLTF('/assets/buildings/denmu-club.glb');
  const { gl } = useThree();
  useEffect(() => {
    gl.domElement.dataset.assetStatus = 'ready';
    gl.domElement.dataset.assetSource = 'denmu-club';
    onReady();
    return () => { delete gl.domElement.dataset.assetStatus; };
  }, [gl, onReady]);
  return <>
    <color attach="background" args={['#05030d']}/>
    <fog attach="fog" args={['#090516', 9, 29]}/>
    <ambientLight intensity={.07}/>
    <hemisphereLight args={['#8c8bc4', '#190b24', .2]}/>
    <directionalLight position={[0, 7, 4]} intensity={.38} color="#c7b7df"/>
    <primitive object={scene} dispose={null}/>
    <Text position={[0, 3.7, -7.5]} fontSize={.64} color="#ff80bf" letterSpacing={.16}>DENMU</Text>
    <Text position={[0, 3.12, -7.5]} fontSize={.16} color="#b5dbff">DJ RIO · WINE × POP</Text>
    <Billboard position={[0, 2.7, 7.65]}><Text fontSize={.3} color="#80ffd6">EXIT · E</Text></Billboard>
    <ClubDancer id="wine" x={-2} epoch={epoch} phase={0} show={show}/>
    <ClubDancer id="pop" x={2} epoch={epoch} phase={Math.PI} show={show}/>
    {CLUB_DJ_LAYOUT.stairs.map(step => <mesh key={step.z} position={[step.x, step.top / 2, step.z]}><boxGeometry args={[step.width, step.top, step.depth]}/><meshStandardMaterial color="#23182e" roughness={.75}/></mesh>)}
    <WelcomeNpc id="galaxy" epoch={epoch} show={show} dj={dj}/>
    <StageLightingSystem epoch={epoch} show={show} settings={settings}/>
    <BarLightingSystem epoch={epoch} show={show}/>
    <DanceFloorLightingSystem epoch={epoch} show={show} settings={settings}/>
    {children}
    <ClubEffectsController epoch={epoch} show={show} settings={settings} bloom={bloom}/>
  </>;
}
