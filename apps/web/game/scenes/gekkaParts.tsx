'use client';
import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { Quaternion, Vector3, type Group, type Texture } from 'three';
import { batchStaticMeshes } from '../systems/staticBatch';

export type Vec3 = [number, number, number];

/**
 * Bọc phần dựng tĩnh: sau khi mount thì gộp mesh cùng material để giảm draw call (xem batchStaticMeshes).
 * Con bên trong không được đổi vị trí hay material sau đó; mesh cần đổi mỗi frame đặt userData.dynamic hoặc để ngoài.
 */
export function StaticBatch({ children }: { children: ReactNode }) {
  const root = useRef<Group>(null);
  useLayoutEffect(() => {
    if (!root.current) return;
    return batchStaticMeshes(root.current).undo;
  }, []);
  return <group ref={root}>{children}</group>;
}

/** Hộp theo tâm và kích thước; tòa nhà dựng bằng khối có texture vẽ tay tới khi có gekka-casino.glb. */
export function Box({ at, size, color = '#ffffff', rough = 0.8, metal = 0, map, emissive, glow = 0.6, rotation }: {
  at: Vec3; size: Vec3; color?: string; rough?: number; metal?: number; map?: Texture; emissive?: string; glow?: number; rotation?: Vec3;
}) {
  return (
    <mesh position={at} rotation={rotation}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={rough} metalness={metal} map={map} emissive={emissive ?? '#000000'} emissiveIntensity={emissive ? glow : 0} />
    </mesh>
  );
}

/** Thanh tròn nối hai điểm (dây xích, thanh sắt, cán đuốc). */
export function Rod({ from, to, radius = 0.015, color = '#5b5b5b', metal = 0.8, rough = 0.45 }: { from: Vec3; to: Vec3; radius?: number; color?: string; metal?: number; rough?: number }) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new Vector3(...from), b = new Vector3(...to), direction = b.clone().sub(a);
    return {
      position: a.clone().add(b).multiplyScalar(0.5),
      quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize()),
      length: direction.length(),
    };
  }, [from, to]);
  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 8]} />
      <meshStandardMaterial color={color} metalness={metal} roughness={rough} />
    </mesh>
  );
}

/** Dây xích: các mắt xích xoay xen kẽ dọc đoạn thẳng. */
export function Chain({ from, to, link = 0.07 }: { from: Vec3; to: Vec3; link?: number }) {
  const links = useMemo(() => {
    const a = new Vector3(...from), b = new Vector3(...to), direction = b.clone().sub(a);
    const count = Math.max(1, Math.round(direction.length() / (link * 0.8)));
    const align = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize());
    return Array.from({ length: count }, (_, index) => ({
      position: a.clone().lerp(b, (index + 0.5) / count).toArray() as Vec3,
      quaternion: align.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), index % 2 ? Math.PI / 2 : 0)),
    }));
  }, [from, to, link]);
  return <>
    {links.map((item, index) => (
      <mesh key={index} position={item.position} quaternion={item.quaternion} scale={[1, 1.6, 1]}>
        <torusGeometry args={[link * 0.3, link * 0.08, 6, 10]} />
        <meshStandardMaterial color="#6e6a64" metalness={0.85} roughness={0.4} />
      </mesh>
    ))}
  </>;
}

/** Chậu cây lá dài (cau cảnh) đặt góc phòng. */
export function PalmPot({ at, scale = 1 }: { at: Vec3; scale?: number }) {
  return (
    <group position={at} scale={scale}>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.26, 0.2, 0.6, 16]} />
        <meshStandardMaterial color="#1e3a5c" roughness={0.25} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.61, 0]}>
        <torusGeometry args={[0.25, 0.025, 8, 24]} />
        <meshStandardMaterial color="#c9a24c" metalness={0.8} roughness={0.3} />
      </mesh>
      {Array.from({ length: 9 }, (_, index) => {
        const angle = index * 2.4, tilt = 0.5 + (index % 3) * 0.25;
        return (
          <mesh key={index} position={[Math.sin(angle) * 0.25, 1.05 + (index % 3) * 0.12, Math.cos(angle) * 0.25]} rotation={[Math.cos(angle) * tilt, 0, -Math.sin(angle) * tilt]}>
            <coneGeometry args={[0.09, 1.0, 4]} />
            <meshStandardMaterial color={index % 2 ? '#2f5b2a' : '#3c6e33'} roughness={0.8} />
          </mesh>
        );
      })}
    </group>
  );
}
