'use client';

// Môi trường Hòn Đảo Neon Sakura (Sakura Island) bao quanh thành phố: thân đảo đá, bờ kè đèn neon, trụ hải đăng cyberpunk và mặt biển đêm phản chiếu ánh Trăng Máu.
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getWorldEnvironment } from '../systems/worldClock';

/** Tạo texture mặt biển đêm với dải phản chiếu ánh Trăng Máu lấp lánh */
function createNightOceanTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Nền nước biển đêm sâu thẳm
  const bg = ctx.createRadialGradient(256, 256, 20, 256, 256, 260);
  bg.addColorStop(0, '#120f26');
  bg.addColorStop(0.45, '#0a0818');
  bg.addColorStop(1, '#05030e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 512);

  // Các gợn sóng phản chiếu ánh bạc của Trăng Khuyết và đèn Neon
  for (let i = 0; i < 160; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const w = 14 + Math.random() * 42;
    const h = 1.5 + Math.random() * 2.5;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(230, 242, 255, 0.24)' : 'rgba(120, 210, 255, 0.12)';
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  texture.needsUpdate = true;
  return texture;
}

const ISLAND_CORNERS: Array<[number, number]> = [
  [-21.5, -24.5],
  [21.5, -24.5],
  [-21.5, 24.5],
  [21.5, 24.5],
];

const OCEAN_NIGHT = new THREE.Color('#080512');
const OCEAN_DAY = new THREE.Color('#3f86b8');

export function SakuraIslandEnv() {
  const oceanTexture = useMemo(() => createNightOceanTexture(), []);
  const waterRingRef = useRef<THREE.Mesh>(null);
  const moonReflectionRef = useRef<THREE.Mesh>(null);
  const oceanMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const moonReflectionMaterialRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    // Mặt biển: đêm tím đen phản chiếu trăng, ngày xanh biển; dải ánh trăng chỉ có về đêm
    const { daylight } = getWorldEnvironment(Date.now());
    if (oceanMaterialRef.current) {
      oceanMaterialRef.current.color.lerpColors(OCEAN_NIGHT, OCEAN_DAY, daylight);
      oceanMaterialRef.current.metalness = THREE.MathUtils.lerp(0.82, 0.35, daylight);
    }
    if (moonReflectionMaterialRef.current) moonReflectionMaterialRef.current.opacity = 0.34 * (1 - daylight);
    oceanTexture.offset.y = (t * 0.03) % 1;
    oceanTexture.offset.x = Math.sin(t * 0.25) * 0.02;

    if (waterRingRef.current) {
      const scale = 1 + Math.sin(t * 1.8) * 0.012;
      waterRingRef.current.scale.set(scale, scale, 1);
    }
    if (moonReflectionRef.current) {
      moonReflectionRef.current.scale.x = 1 + Math.sin(t * 2.4) * 0.08;
    }
  });

  return (
    <group name="SakuraIslandEnv">
      {/* 1. Mặt biển đêm bao la xung quanh hòn đảo */}
      <mesh position={[0, -1.65, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[155, 64]} />
        <meshStandardMaterial
          ref={oceanMaterialRef}
          map={oceanTexture}
          color="#080512"
          emissive="#06030d"
          emissiveIntensity={0.15}
          roughness={0.18}
          metalness={0.82}
          fog={false}
        />
      </mesh>

      {/* Dải ánh trăng khuyết trắng bạc phản chiếu lấp lánh trên mặt biển phía +Z */}
      <mesh
        ref={moonReflectionRef}
        position={[0, -1.6, 36]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[14, 28]} />
        <meshBasicMaterial
          ref={moonReflectionMaterialRef}
          color="#dbe8ff"
          transparent
          opacity={0.34}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fog={false}
        />
      </mesh>

      {/* Vòng sóng bọt biển phát sáng nhẹ ôm quanh chân đảo */}
      <mesh
        ref={waterRingRef}
        position={[0, -1.58, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[30.5, 33.2, 48]} />
        <meshBasicMaterial
          color="#ff4d88"
          transparent
          opacity={0.28}
          side={THREE.DoubleSide}
          fog={false}
        />
      </mesh>

      {/* 2. Khối đá ngầm nâng đỡ toàn bộ Hòn Đảo Thành Phố (Sakura Island Base) */}
      <mesh position={[0, -3.6, 0]}>
        <cylinderGeometry args={[31.2, 22.5, 4.2, 12]} />
        <meshStandardMaterial
          color="#1c1124"
          roughness={0.85}
          metalness={0.2}
          fog={false}
        />
      </mesh>

      {/* Thềm bờ kè bao quanh thành phố trên mặt đảo */}
      <mesh position={[0, -0.82, 0]}>
        <boxGeometry args={[45.6, 1.5, 51.6]} />
        <meshStandardMaterial
          color="#181226"
          roughness={0.55}
          metalness={0.45}
          fog={false}
        />
      </mesh>

      {/* Viền đèn Neon hồng/cyan chạy dọc bờ kè 4 cạnh Hòn Đảo */}
      {/* Cạnh Bắc (+Z, hướng Mặt Trăng) */}
      <mesh position={[0, -0.02, 25.85]}>
        <boxGeometry args={[45.8, 0.14, 0.16]} />
        <meshStandardMaterial color="#ff2a6d" emissive="#ff2a6d" emissiveIntensity={1.2} toneMapped={false} fog={false} />
      </mesh>
      {/* Cạnh Nam (-Z) */}
      <mesh position={[0, -0.02, -25.85]}>
        <boxGeometry args={[45.8, 0.14, 0.16]} />
        <meshStandardMaterial color="#ff2a6d" emissive="#ff2a6d" emissiveIntensity={1.2} toneMapped={false} fog={false} />
      </mesh>
      {/* Cạnh Đông (+X) */}
      <mesh position={[22.85, -0.02, 0]}>
        <boxGeometry args={[0.16, 0.14, 51.8]} />
        <meshStandardMaterial color="#05d5fa" emissive="#05d5fa" emissiveIntensity={1.1} toneMapped={false} fog={false} />
      </mesh>
      {/* Cạnh Tây (-X) */}
      <mesh position={[-22.85, -0.02, 0]}>
        <boxGeometry args={[0.16, 0.14, 51.8]} />
        <meshStandardMaterial color="#05d5fa" emissive="#05d5fa" emissiveIntensity={1.1} toneMapped={false} fog={false} />
      </mesh>

      {/* Cầu tàu gỗ đỏ (Torii Pier) vươn từ Cổng Torii (+Z) ra sát mép biển hướng về Mặt Trăng Máu */}
      <mesh position={[0, -0.04, 22.2]}>
        <boxGeometry args={[6.4, 0.18, 7.6]} />
        <meshStandardMaterial color="#241326" roughness={0.4} metalness={0.35} fog={false} />
      </mesh>
      {[-3.1, 3.1].map((x, idx) => (
        <mesh key={`pier-rail-${idx}`} position={[x, 0.45, 22.2]}>
          <boxGeometry args={[0.12, 0.1, 7.5]} />
          <meshStandardMaterial color="#ff2e63" emissive="#ff1e56" emissiveIntensity={2.2} toneMapped={false} fog={false} />
        </mesh>
      ))}

      {/* 3. Bốn Trụ Hải Đăng Cyberpunk ở 4 góc Hòn Đảo */}
      {ISLAND_CORNERS.map(([cx, cz], idx) => (
        <group key={`beacon-${idx}`} position={[cx, 0, cz]}>
          <mesh position={[0, 1.4, 0]}>
            <cylinderGeometry args={[0.35, 0.55, 2.8, 8]} />
            <meshStandardMaterial color="#1d142b" metalness={0.6} roughness={0.35} fog={false} />
          </mesh>
          <mesh position={[0, 3.1, 0]}>
            <octahedronGeometry args={[0.48, 0]} />
            <meshStandardMaterial
              color={idx % 2 === 0 ? '#ff2a85' : '#00f0ff'}
              emissive={idx % 2 === 0 ? '#ff2a85' : '#00f0ff'}
              emissiveIntensity={3.0}
              toneMapped={false}
              fog={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
