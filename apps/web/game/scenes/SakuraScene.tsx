'use client';

// Cảnh quan đại lộ Neon Sakura City dưới ánh Trăng Máu (Blood Moon), chu kỳ thời tiết mưa giông và đèn đường chập chờn u ám.
import { Sparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Component, Suspense, useRef, type ReactNode } from 'react';
import type * as THREE from 'three';
import { StreetAssets } from './StreetAssets';
import { BloodMoonSky } from './BloodMoonSky';
import { SakuraIslandEnv } from './SakuraIslandEnv';
import { WetAsphaltRoadDetails } from './WetAsphaltRoadDetails';
import { RainWeatherSystem, calculateFlicker } from '../systems/RainWeatherSystem';
import { DayNightSystem } from '../systems/DayNightSystem';
import { getWorldEnvironment, neonLevel } from '../systems/worldClock';
import { CinematicLighting } from '../systems/CinematicLighting';
import { SakuraPetals } from '../systems/SakuraPetals';

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

/** Đèn neon màu bổ trợ dịu nhẹ và phản quang ánh sáng biển hiệu hai bên đường */
function StreetPointLights() {
  const p1 = useRef<THREE.PointLight>(null);
  const p2 = useRef<THREE.PointLight>(null);
  const p3 = useRef<THREE.PointLight>(null);
  const p4 = useRef<THREE.PointLight>(null);
  useFrame(state => {
    const time = state.clock.getElapsedTime();
    const env = getWorldEnvironment(Date.now());
    // Phản quang biển hiệu mờ đi ban ngày (ánh nắng át neon), rực nhất về đêm
    const flicker = calculateFlicker(time, env.rainIntensity) * neonLevel(env);
    if (p1.current) p1.current.intensity = 18 * flicker;
    if (p2.current) p2.current.intensity = 16 * flicker;
    if (p3.current) p3.current.intensity = 16 * flicker;
    if (p4.current) p4.current.intensity = 16 * flicker;
  });
  return <>
    {/* Ánh sáng neon phản chiếu từ các biển hiệu lớn hai bên đại lộ Sakura */}
    <pointLight ref={p1} position={[-4, 4.5, -6]} color="#ff4fa3" intensity={18} distance={18} decay={2}/>
    <pointLight ref={p2} position={[4, 4.5, 6]} color="#ffb066" intensity={16} distance={18} decay={2}/>
    <pointLight ref={p3} position={[-4, 4.5, 12]} color="#4de2ff" intensity={16} distance={18} decay={2}/>
    <pointLight ref={p4} position={[4, 4.5, -12]} color="#ff6bb5" intensity={16} distance={18} decay={2}/>
  </>;
}

export function SakuraScene({ children, onReady, onError, bloom }: { children?: ReactNode; onReady: () => void; onError: () => void; bloom: boolean }) {
  return <>
    {/* Chu kỳ ngày/đêm 30 phút + 30 phút: nền trời, sương mù, ánh sáng môi trường, mặt trời và sao */}
    <DayNightSystem/>
    <StreetPointLights/>
    {/* Cánh hoa anh đào rơi theo gió từ các hàng cây hai đầu phố và công viên sau dãy nhà */}
    <SakuraPetals/>
    <Sparkles count={45} scale={[21, 7, 42]} position={[0, 3, -2]} size={1.4} speed={0.12} color="#9ec5ff"/>

    {/* Bầu trời đêm Trăng Khuyết Màu Trắng ở hướng +Z cuối đại lộ Sakura */}
    <BloodMoonSky position={[0, 15.2, 48]} radius={6.2}/>

    {/* Hòn Đảo Thành Phố Neon Sakura giữa mặt biển đêm phản chiếu ánh trăng khuyết */}
    <SakuraIslandEnv/>

    {/* Chi tiết mặt đường nhựa ướt Tokyo: vạch phân làn, vạch sang đường zebra, vũng nước & nắp cống */}
    <WetAsphaltRoadDetails/>

    {/* Hệ thống mưa: mỗi giờ một trận mưa 10 phút theo đồng hồ thế giới chung */}
    <RainWeatherSystem/>

    <SceneLoadBoundary onError={onError}>
      <Suspense fallback={null}>
        <StreetAssets onReady={onReady}/>
      </Suspense>
    </SceneLoadBoundary>
    {children}
    <CinematicLighting enabled={bloom}/>
  </>;
}
