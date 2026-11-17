'use client';

// Trường vòng nước mưa trên mặt phẳng ngang (tóe nước, gợn sóng vũng nước): một InstancedMesh vòng tròn,
// vòng đời ngắn, mờ dần bằng màu instance với blending cộng nên vòng "chết" chỉ là màu đen (không cần sắp xếp trong suốt).
import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

type RainRippleFieldProps = {
  name: string;
  /** Số vòng tối đa cùng lúc; vòng mới ghi đè vòng cũ nhất. */
  capacity: number;
  /** Thời gian sống của một vòng (giây). */
  life: number;
  startRadius: number;
  endRadius: number;
  /** Độ cao mặt phẳng trong hệ toạ độ cha. */
  y: number;
  color: THREE.ColorRepresentation;
  /** Số vòng sinh ra mỗi giây, đọc lại mỗi frame. */
  rate: () => number;
  /** Ghi toạ độ (x, z) của vòng mới vào `out`. */
  spawn: (out: THREE.Vector2) => void;
};

export function RainRippleField({ name, capacity, life, startRadius, endRadius, y, color, rate, spawn }: RainRippleFieldProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.RingGeometry(0.8, 1, 20).rotateX(-Math.PI / 2), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }), []);
  const state = useMemo(() => ({
    x: new Float32Array(capacity),
    z: new Float32Array(capacity),
    born: new Float32Array(capacity).fill(-1e6),
    next: 0,
    budget: 0,
    alive: 0,
    point: new THREE.Vector2(),
    dummy: new THREE.Object3D(),
    base: new THREE.Color(),
    tint: new THREE.Color(),
  }), [capacity]);

  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    state.base.set(color);
    state.dummy.scale.setScalar(0);
    state.dummy.updateMatrix();
    for (let i = 0; i < capacity; i++) {
      mesh.setMatrixAt(i, state.dummy.matrix);
      mesh.setColorAt(i, state.tint.setRGB(0, 0, 0));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [capacity, color, state]);

  useFrame(({ clock }, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const spawnRate = rate();
    // Trời tạnh và không còn vòng nào: bỏ qua cả vòng lặp cập nhật
    if (spawnRate <= 0 && state.alive === 0) return;
    const now = clock.getElapsedTime();

    // Giới hạn delta để tab bị ẩn lâu quay lại không sinh dồn hàng nghìn vòng một lúc
    state.budget = Math.min(state.budget + spawnRate * Math.min(delta, 0.1), capacity);
    while (state.budget >= 1) {
      state.budget -= 1;
      spawn(state.point);
      const i = state.next;
      state.x[i] = state.point.x;
      state.z[i] = state.point.y;
      state.born[i] = now;
      state.next = (i + 1) % capacity;
    }

    let alive = 0;
    for (let i = 0; i < capacity; i++) {
      const k = (now - state.born[i]) / life;
      if (k >= 1 || k < 0) {
        state.dummy.scale.setScalar(0);
        state.tint.setRGB(0, 0, 0);
      } else {
        alive++;
        const grow = 1 - (1 - k) * (1 - k);
        const fade = (1 - k) * (1 - k);
        state.dummy.position.set(state.x[i], y, state.z[i]);
        state.dummy.scale.setScalar(THREE.MathUtils.lerp(startRadius, endRadius, grow));
        state.tint.copy(state.base).multiplyScalar(fade * 0.8);
      }
      state.dummy.updateMatrix();
      mesh.setMatrixAt(i, state.dummy.matrix);
      mesh.setColorAt(i, state.tint);
    }
    state.alive = alive;
    mesh.visible = alive > 0;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return <instancedMesh ref={meshRef} name={name} args={[geometry, material, capacity]} frustumCulled={false} renderOrder={3}/>;
}
