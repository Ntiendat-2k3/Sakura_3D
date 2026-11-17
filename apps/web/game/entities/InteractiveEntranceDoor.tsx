'use client';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils, type Group, type PointLight } from 'three';

/**
 * Cửa đôi ra vào 3D tự động hé mở khi người chơi bước lại gần và xoay mở toang khi nhấn E chuyển phòng.
 * Mỗi cánh cửa xoay quanh trục bản lề (hinge pivot) ở hai bên mép khung.
 */
export function InteractiveEntranceDoor({
  id,
  position,
  yaw = 0,
  player,
  isInteracting = false,
  theme = 'modern',
  triggerRadius = 2.8,
}: {
  id: string;
  position: [number, number, number];
  yaw?: number;
  player?: { x: number; z: number };
  isInteracting?: boolean;
  theme?: 'modern' | 'traditional' | 'exit';
  triggerRadius?: number;
}) {
  const leftHinge = useRef<Group>(null);
  const rightHinge = useRef<Group>(null);
  const glowLight = useRef<PointLight>(null);
  const openRatio = useRef(0);

  // Bảng màu cho từng phong cách: modern (Denmu Club neon), traditional (Reika Lounge mạ vàng / shoji), exit (thoát hiểm)
  const isTraditional = theme === 'traditional';
  const frameColor = isTraditional ? '#382218' : theme === 'exit' ? '#242838' : '#1f1b2b';
  const trimColor = isTraditional ? '#c49a45' : theme === 'exit' ? '#5de8b5' : '#e06da8';
  const glassColor = isTraditional ? '#ffeed4' : theme === 'exit' ? '#80ffd6' : '#88d8ff';
  const glassEmissive = isTraditional ? '#ffa842' : theme === 'exit' ? '#33cca0' : '#4794e6';
  const lightColor = isTraditional ? '#ffd07a' : theme === 'exit' ? '#70ffcb' : '#ff7bb8';

  const maxAngle = Math.PI * 0.44; // Góc mở ~80 độ

  useFrame((_, delta) => {
    const dt = MathUtils.clamp(delta, 0, 0.05);
    let target = 0;

    if (isInteracting) {
      target = 1.0;
    } else if (player && Number.isFinite(player.x) && Number.isFinite(player.z)) {
      const dist = Math.hypot(player.x - position[0], player.z - position[2]);
      if (dist < triggerRadius) {
        // Mở dần từ 0 đến 0.85 khi người chơi bước tới gần
        const factor = Math.max(0, Math.min(1, (triggerRadius - dist) / (triggerRadius - 0.7)));
        target = factor * 0.85;
      }
    }

    // Nội suy mượt mà góc xoay bản lề
    openRatio.current = MathUtils.damp(openRatio.current, target, 7.5, dt);
    const angle = openRatio.current * maxAngle;

    if (leftHinge.current) {
      leftHinge.current.rotation.y = -angle;
    }
    if (rightHinge.current) {
      rightHinge.current.rotation.y = angle;
    }
    if (glowLight.current) {
      glowLight.current.intensity = 2.5 + openRatio.current * 14;
    }
  });

  return (
    <group name={`interactive-door:${id}`} position={position} rotation={[0, yaw, 0]}>
      {/* Đèn hắt khe cửa: khi cửa hé mở ánh sáng từ bên trong rọi hắt ra nền đón khách */}
      <pointLight
        ref={glowLight}
        position={[0, 1.2, -0.25]}
        color={lightColor}
        intensity={2.5}
        distance={4.8}
        decay={2}
      />

      {/* Cánh cửa bên trái: Pivot bản lề tại x = -0.88 */}
      <group ref={leftHinge} position={[-0.88, 1.14, 0]}>
        <group position={[0.44, 0, 0]}>
          {/* Khung đố cánh cửa gỗ/hợp kim */}
          <mesh>
            <boxGeometry args={[0.86, 2.14, 0.05]} />
            <meshStandardMaterial color={frameColor} roughness={0.65} metalness={0.2} />
          </mesh>
          {/* Tấm kính / ô shoji phát sáng */}
          <mesh position={[0, 0.08, 0]}>
            <boxGeometry args={[0.66, 1.62, 0.03]} />
            <meshStandardMaterial
              color={glassColor}
              emissive={glassEmissive}
              emissiveIntensity={0.65}
              roughness={0.2}
              transparent
              opacity={0.88}
            />
          </mesh>
          {/* Các nan đố ngang chia ô kính */}
          {[-0.45, 0, 0.45].map((y, i) => (
            <mesh key={i} position={[0, y + 0.08, 0.018]}>
              <boxGeometry args={[0.66, 0.035, 0.015]} />
              <meshStandardMaterial color={frameColor} roughness={0.7} />
            </mesh>
          ))}
          {/* Tấm ốp chân cửa (kickplate) */}
          <mesh position={[0, -0.88, 0.026]}>
            <boxGeometry args={[0.82, 0.22, 0.01]} />
            <meshStandardMaterial color={trimColor} roughness={0.4} metalness={0.75} />
          </mesh>
          {/* Cụm tay nắm kéo đứng mạ kim loại đặt tại mép trong của cánh */}
          <group position={[0.34, 0, 0.045]}>
            <mesh position={[0, 0.2, 0.015]}>
              <boxGeometry args={[0.025, 0.025, 0.04]} />
              <meshStandardMaterial color={trimColor} metalness={0.85} roughness={0.25} />
            </mesh>
            <mesh position={[0, -0.2, 0.015]}>
              <boxGeometry args={[0.025, 0.025, 0.04]} />
              <meshStandardMaterial color={trimColor} metalness={0.85} roughness={0.25} />
            </mesh>
            <mesh position={[0, 0, 0.035]}>
              <boxGeometry args={[0.025, 0.48, 0.025]} />
              <meshStandardMaterial color={trimColor} metalness={0.85} roughness={0.25} />
            </mesh>
          </group>
        </group>
      </group>

      {/* Cánh cửa bên phải: Pivot bản lề tại x = +0.88 */}
      <group ref={rightHinge} position={[0.88, 1.14, 0]}>
        <group position={[-0.44, 0, 0]}>
          {/* Khung đố cánh cửa */}
          <mesh>
            <boxGeometry args={[0.86, 2.14, 0.05]} />
            <meshStandardMaterial color={frameColor} roughness={0.65} metalness={0.2} />
          </mesh>
          {/* Tấm kính / ô shoji phát sáng */}
          <mesh position={[0, 0.08, 0]}>
            <boxGeometry args={[0.66, 1.62, 0.03]} />
            <meshStandardMaterial
              color={glassColor}
              emissive={glassEmissive}
              emissiveIntensity={0.65}
              roughness={0.2}
              transparent
              opacity={0.88}
            />
          </mesh>
          {/* Các nan đố ngang chia ô kính */}
          {[-0.45, 0, 0.45].map((y, i) => (
            <mesh key={i} position={[0, y + 0.08, 0.018]}>
              <boxGeometry args={[0.66, 0.035, 0.015]} />
              <meshStandardMaterial color={frameColor} roughness={0.7} />
            </mesh>
          ))}
          {/* Tấm ốp chân cửa (kickplate) */}
          <mesh position={[0, -0.88, 0.026]}>
            <boxGeometry args={[0.82, 0.22, 0.01]} />
            <meshStandardMaterial color={trimColor} roughness={0.4} metalness={0.75} />
          </mesh>
          {/* Cụm tay nắm kéo đứng mạ kim loại đặt tại mép trong của cánh */}
          <group position={[-0.34, 0, 0.045]}>
            <mesh position={[0, 0.2, 0.015]}>
              <boxGeometry args={[0.025, 0.025, 0.04]} />
              <meshStandardMaterial color={trimColor} metalness={0.85} roughness={0.25} />
            </mesh>
            <mesh position={[0, -0.2, 0.015]}>
              <boxGeometry args={[0.025, 0.025, 0.04]} />
              <meshStandardMaterial color={trimColor} metalness={0.85} roughness={0.25} />
            </mesh>
            <mesh position={[0, 0, 0.035]}>
              <boxGeometry args={[0.025, 0.48, 0.025]} />
              <meshStandardMaterial color={trimColor} metalness={0.85} roughness={0.25} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}
