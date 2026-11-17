'use client';

// Hệ thống mưa Neon Sakura City: mỗi giờ một trận mưa 10 phút theo đồng hồ thế giới chung (worldClock),
// hạt mưa vệt dài rơi xiên theo gió, tiếng mưa tổng hợp; đèn đường/biển hiệu chập chờn nhẹ khi mưa.
// Sương mù do DayNightSystem điều khiển (một nơi duy nhất) để không giành nhau với hệ ngày/đêm.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getWorldEnvironment } from './worldClock';
import { createRainAudio } from './rainAudio';

/** Tính hệ số nhấp nháy đèn đường (flicker) êm dịu, không giật gân, tạo không khí đêm mưa nhẹ nhàng */
export function calculateFlicker(timeSeconds: number, rainIntensity: number): number {
  if (rainIntensity <= 0.01) return 1.0;

  // Dao động điện nhẹ nhàng, êm dịu, không giật tắt đột ngột gây đau mắt
  const gentleNoise = 0.92 + 0.08 * Math.sin(timeSeconds * 4.2) * Math.cos(timeSeconds * 6.5);
  return THREE.MathUtils.lerp(1.0, gentleNoise, rainIntensity * 0.5);
}

/** Biển hiệu Neon nhấp nháy sinh động phong cách Cyberpunk tự nhiên, êm dịu và không gây đau mắt */
export function calculateSignFlicker(timeSeconds: number, seed: number, rainIntensity: number): number {
  // Chu kỳ nhấp nháy tự nhiên mỗi 3.2 giây cho từng biển hiệu riêng biệt
  const cycle = ((timeSeconds * 0.45 + seed * 1.37) % 3.2 + 3.2) % 3.2;
  let pulse = 1.0;

  // Nhịp chớp nhẹ tự nhiên của đèn ống neon khí hiếm (nháy rõ rệt nhưng biên độ êm dịu 0.68 - 1.22)
  if (cycle < 0.12) {
    pulse = 0.78 + 0.08 * Math.sin(cycle * 48);
  } else if (cycle >= 0.12 && cycle < 0.22) {
    pulse = 1.22;
  } else if (cycle >= 0.22 && cycle < 0.30) {
    pulse = 0.82;
  }

  // Nhịp thở neon êm dịu kết hợp nhịp chớp nhẹ
  const breathing = 0.95 + 0.05 * Math.sin(timeSeconds * 2.4 + seed * 2.1);
  return breathing * pulse;
}

// Vùng mưa phủ toàn đảo thành phố (mét)
const RAIN_COUNT = 6000;
const AREA_X = 44;
const AREA_Z_MIN = -38;
const AREA_Z = 66;
const TOP_Y = 22;
/** Gió thổi xiên theo -X: mưa thật rơi ~9 m/s, gió làm vệt mưa nghiêng. */
const WIND_X = -1.6;

/** Màn mưa vệt dài rơi xiên theo gió + tiếng mưa, mật độ theo cường độ của trận mưa hiện tại. */
export function RainWeatherSystem() {
  const rainMeshRef = useRef<THREE.InstancedMesh>(null);

  const rainData = useMemo(() => {
    const data = [];
    for (let i = 0; i < RAIN_COUNT; i++) {
      data.push({
        x: (Math.random() - 0.5) * AREA_X,
        y: Math.random() * TOP_Y,
        z: AREA_Z_MIN + Math.random() * AREA_Z,
        speed: 8.5 + Math.random() * 3.5,
        gust: Math.random() * Math.PI * 2,
        scale: 0.7 + Math.random() * 0.6,
      });
    }
    return data;
  }, []);

  // Vệt mưa mảnh dài ~32cm: mắt người thấy giọt mưa rơi nhanh như một vệt sáng, không phải một chấm
  const rainGeometry = useMemo(() => new THREE.CylinderGeometry(0.0028, 0.0028, 0.32, 3), []);
  const rainMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#dce8ff',
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    toneMapped: false,
  }), []);
  const rainAudio = useMemo(() => createRainAudio(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => () => {
    rainGeometry.dispose();
    rainMaterial.dispose();
    rainAudio.dispose();
  }, [rainGeometry, rainMaterial, rainAudio]);

  useFrame((state, delta) => {
    const mesh = rainMeshRef.current;
    if (!mesh) return;
    const { rainIntensity, daylight } = getWorldEnvironment(Date.now());
    rainAudio.setIntensity(rainIntensity);

    if (rainIntensity <= 0.01) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    // Mưa lắc rắc lúc mới bắt đầu, dày đặc khi mưa to: chỉ vẽ và cập nhật số hạt cần thiết
    const count = Math.max(1, Math.round(RAIN_COUNT * rainIntensity));
    mesh.count = count;
    // Ban ngày vệt mưa xám mờ, ban đêm bắt sáng neon rõ hơn
    rainMaterial.opacity = THREE.MathUtils.lerp(0.5, 0.3, daylight) * (0.6 + 0.4 * rainIntensity);

    const time = state.clock.getElapsedTime();
    const step = Math.min(delta, 0.1);
    for (let i = 0; i < count; i++) {
      const p = rainData[i];
      const windX = WIND_X + Math.sin(time * 0.7 + p.gust) * 0.5;
      p.y -= p.speed * step;
      p.x += windX * step;

      if (p.y < 0.02) {
        p.y = TOP_Y - Math.random() * 2;
        p.x = (Math.random() - 0.5) * AREA_X;
        p.z = AREA_Z_MIN + Math.random() * AREA_Z;
      }

      dummy.position.set(p.x, p.y, p.z);
      // Vệt mưa nghiêng đúng theo hướng vận tốc (gió ngang / tốc độ rơi)
      dummy.rotation.set(0, 0, Math.atan2(windX, p.speed));
      dummy.scale.set(1, p.scale, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={rainMeshRef} args={[rainGeometry, rainMaterial, RAIN_COUNT]} frustumCulled={false}/>;
}
