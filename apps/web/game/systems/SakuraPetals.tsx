'use client';

// Cánh hoa anh đào rơi lả tả theo gió dọc phố: một InstancedMesh, cập nhật ma trận mỗi frame, không cấp phát trong vòng lặp.
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const PETAL_COUNT = 260;
/** Khối không gian cánh hoa rơi: phủ đại lộ, hai công viên sau dãy nhà và hai quảng trường đầu phố. */
const AREA = { x: 18, z: 25, top: 8.5 } as const;
const FALL_SPEED = [0.35, 0.7] as const;

type Petal = { x: number; y: number; z: number; speed: number; phase: number; sway: number; spin: THREE.Vector3; rotation: THREE.Euler };

/** Sinh ngẫu nhiên có hạt để mọi client thấy cùng kiểu rơi và test lặp lại được. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
}

export function createPetals(count = PETAL_COUNT, seed = 7): Petal[] {
  const random = seeded(seed);
  return Array.from({ length: count }, () => ({
    x: (random() * 2 - 1) * AREA.x,
    y: random() * AREA.top,
    z: (random() * 2 - 1) * AREA.z,
    speed: FALL_SPEED[0] + random() * (FALL_SPEED[1] - FALL_SPEED[0]),
    phase: random() * Math.PI * 2,
    sway: 0.25 + random() * 0.45,
    spin: new THREE.Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).multiplyScalar(2.2),
    rotation: new THREE.Euler(random() * Math.PI, random() * Math.PI, random() * Math.PI),
  }));
}

/** Rơi + trôi theo gió; chạm đất thì quay lại đỉnh ở chỗ mới để mật độ luôn đều. */
export function stepPetal(petal: Petal, dt: number, time: number) {
  petal.y -= petal.speed * dt;
  petal.x += (0.35 + Math.sin(time * 0.6 + petal.phase) * petal.sway) * dt;
  petal.z += Math.cos(time * 0.45 + petal.phase * 1.7) * petal.sway * 0.6 * dt;
  petal.rotation.x += petal.spin.x * dt; petal.rotation.y += petal.spin.y * dt; petal.rotation.z += petal.spin.z * dt;
  if (petal.y < 0.02) { petal.y += AREA.top; petal.x = -petal.x * 0.9; }
  // Gió có lúc thổi ngược nên quấn vòng cả hai mép mỗi trục, giữ mật độ đều trong vùng phố.
  if (petal.x > AREA.x) petal.x -= AREA.x * 2; else if (petal.x < -AREA.x) petal.x += AREA.x * 2;
  if (petal.z > AREA.z) petal.z -= AREA.z * 2; else if (petal.z < -AREA.z) petal.z += AREA.z * 2;
}

export function SakuraPetals() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const petals = useMemo(() => createPetals(), []);
  const transform = useMemo(() => new THREE.Object3D(), []);
  const geometry = useMemo(() => new THREE.PlaneGeometry(0.075, 0.055), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffb7cf', emissive: '#ff8fb5', emissiveIntensity: 0.18, roughness: 0.8, side: THREE.DoubleSide }), []);
  useLayoutEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  useFrame((state, delta) => {
    const target = mesh.current;
    if (!target) return;
    const dt = Math.min(delta, 0.1), time = state.clock.elapsedTime;
    petals.forEach((petal, index) => {
      stepPetal(petal, dt, time);
      transform.position.set(petal.x, petal.y, petal.z);
      transform.rotation.copy(petal.rotation);
      transform.updateMatrix();
      target.setMatrixAt(index, transform.matrix);
    });
    target.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[geometry, material, petals.length]} frustumCulled={false} name="sakura-petals"/>;
}
