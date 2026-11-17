'use client';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Mesh, MeshStandardMaterial, PointLight } from 'three';

const BASE_INTENSITY = 9;

/**
 * Bóng đèn treo chập chờn ở hầm: nhấp nháy ngẫu nhiên, thỉnh thoảng tắt hẳn 150–400 ms.
 * Chỉ đổi cường độ, không thêm/bớt light để material không phải biên dịch lại.
 */
export function GekkaBasementLight({ position }: { position: [number, number, number] }) {
  const light = useRef<PointLight>(null);
  const bulb = useRef<Mesh>(null);
  const state = useRef({ offUntil: 0, nextBlackout: performance.now() + 3000 });
  useFrame(() => {
    const now = performance.now();
    const s = state.current;
    if (now >= s.nextBlackout) {
      s.offUntil = now + 150 + Math.random() * 250;
      s.nextBlackout = now + 2500 + Math.random() * 5000;
    }
    const flicker = now < s.offUntil ? 0 : 0.75 + Math.random() * 0.25;
    if (light.current) light.current.intensity = BASE_INTENSITY * flicker;
    if (bulb.current) (bulb.current.material as MeshStandardMaterial).emissiveIntensity = 2.5 * flicker;
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.7, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh ref={bulb}>
        <sphereGeometry args={[0.07, 12, 10]} />
        <meshStandardMaterial color="#ffdca0" emissive="#ffb85c" emissiveIntensity={2.5} />
      </mesh>
      <pointLight ref={light} intensity={BASE_INTENSITY} distance={9} decay={2} color="#ffbe73" />
    </group>
  );
}
