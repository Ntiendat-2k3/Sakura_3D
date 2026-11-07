'use client';

import { Sparkles, Stars } from '@react-three/drei';
import { Component, Suspense, type ReactNode } from 'react';
import { StreetAssets } from './StreetAssets';
import { CinematicLighting } from '../systems/CinematicLighting';

export class SceneLoadBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() {
    return this.state.failed
      ? null
      : this.props.children;
  }
}

export function SakuraScene({ children, onReady, onError, bloom }: { children?: ReactNode; onReady: () => void; onError: () => void; bloom: boolean }) {
  return <>
    <color attach="background" args={['#101428']}/>
    <fog attach="fog" args={['#101428', 27, 65]}/>
    <ambientLight intensity={0.25}/>
    <hemisphereLight color="#a6bbef" groundColor="#38233b" intensity={0.9}/>
    <directionalLight position={[-5, 15, 8]} color="#bfcfff" intensity={1.2}/>
    <pointLight position={[-4, 4, -5]} color="#fa76b2" intensity={28} distance={16} decay={2}/>
    <pointLight position={[4, 4, 5]} color="#ffc58d" intensity={24} distance={16} decay={2}/>
    <Stars radius={80} depth={20} count={240} factor={1.5} fade/>
    <Sparkles count={45} scale={[21, 7, 42]} position={[0, 3, -2]} size={1.6} speed={0.15} color="#ffc1dd"/>
    <SceneLoadBoundary onError={onError}>
      <Suspense fallback={null}>
        <StreetAssets onReady={onReady}/>
      </Suspense>
    </SceneLoadBoundary>
    {children}
    <CinematicLighting enabled={bloom}/>
  </>;
}
