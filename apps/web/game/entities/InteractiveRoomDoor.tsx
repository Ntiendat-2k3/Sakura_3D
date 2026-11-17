'use client';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils, type Group, type PointLight } from 'three';
import { Text } from '@react-three/drei';

/**
 * Cửa phòng nhỏ đơn lập riêng tư (Room 201 · VIP Suite) trên chiếu nghỉ tầng 2 Reika Lounge dẫn vào Cyber Love Hotel.
 * Cánh cửa tự động hé mở khi lại gần và xoay mở toang vào trong phòng khi người chơi nhấn [E] mở cửa.
 */
export function InteractiveRoomDoor({
  id = 'room-201-door',
  position = [5.3, 2.38, 6.55],
  yaw = Math.PI,
  player,
  isInteracting = false,
  triggerRadius = 2.4,
}: {
  id?: string;
  position?: [number, number, number];
  yaw?: number;
  player?: { x: number; z: number };
  isInteracting?: boolean;
  triggerRadius?: number;
}) {
  const hinge = useRef<Group>(null);
  const handleLever = useRef<Group>(null);
  const glowLight = useRef<PointLight>(null);
  const openRatio = useRef(0);
  const handleAngle = useRef(0);

  const maxDoorAngle = Math.PI * 0.46; // Mở xoay vào phòng ~83 độ
  const maxHandleAngle = Math.PI * 0.16; // Gạt tay nắm xuống ~28 độ

  useFrame((_, delta) => {
    const dt = MathUtils.clamp(delta, 0, 0.05);
    let targetOpen = 0;
    let targetHandle = 0;

    if (isInteracting) {
      targetOpen = 1.0;
      targetHandle = 1.0;
    } else if (player && Number.isFinite(player.x) && Number.isFinite(player.z)) {
      const dist = Math.hypot(player.x - position[0], player.z - position[2]);
      if (dist < triggerRadius) {
        // Cửa mở rộng đón khách khi người chơi bước tới gần
        const factor = Math.max(0, Math.min(1, (triggerRadius - dist) / (triggerRadius - 0.7)));
        targetOpen = factor * 0.95;
        targetHandle = factor * 0.95;
      }
    }

    openRatio.current = MathUtils.damp(openRatio.current, targetOpen, 6.5, dt);
    handleAngle.current = MathUtils.damp(handleAngle.current, targetHandle, 12.0, dt);

    if (hinge.current) {
      // Cánh cửa xoay mở vào trong phòng quanh trục bản lề bên trái
      hinge.current.rotation.y = -openRatio.current * maxDoorAngle;
    }

    if (handleLever.current) {
      // Tay gạt mạ vàng xoay chúc xuống khi vặn chốt cửa
      handleLever.current.rotation.z = -handleAngle.current * maxHandleAngle;
    }

    if (glowLight.current) {
      // Luồng sáng ấm áp từ phòng khách sạn hắt ra chiếu nghỉ khi cánh cửa mở
      glowLight.current.intensity = 1.5 + openRatio.current * 14;
    }
  });

  return (
    <group name={`interactive-room-door:${id}`} position={position} rotation={[0, yaw, 0]}>
      {/* Nguồn sáng ấm hắt từ bên trong phòng ra ngoài */}
      <pointLight
        ref={glowLight}
        position={[0, 1.2, -0.45]}
        color="#ff73b9"
        intensity={1.5}
        distance={4.2}
        decay={2}
      />

      {/* Trục bản lề bên trái: x = -0.56, y = 1.08 */}
      <group ref={hinge} position={[-0.56, 1.08, 0]}>
        {/* Khối cánh cửa: tâm dịch chuyển về +0.56 để xoay quanh mép bản lề */}
        <group position={[0.56, 0, 0]}>
          {/* Tấm cánh cửa chính gỗ bóng màu mận chín / nhung đỏ */}
          <mesh>
            <boxGeometry args={[1.12, 2.14, 0.05]} />
            <meshStandardMaterial
              color="#2a0a1c"
              roughness={0.4}
              metalness={0.15}
            />
          </mesh>

          {/* Viền chỉ nẹp gỗ hoa văn vàng kim chạy bo quanh cánh cửa */}
          <mesh position={[0, 0, 0.028]}>
            <boxGeometry args={[0.96, 1.94, 0.012]} />
            <meshStandardMaterial
              color="#996e28"
              roughness={0.3}
              metalness={0.7}
            />
          </mesh>

          {/* Ô pano trang trí lõm giữa cánh cửa bọc nhung cao cấp */}
          <mesh position={[0, 0, 0.032]}>
            <boxGeometry args={[0.88, 1.84, 0.01]} />
            <meshStandardMaterial
              color="#42102c"
              roughness={0.65}
              metalness={0.1}
            />
          </mesh>

          {/* Biển số phòng sang trọng: ROOM 201 · VIP */}
          <group position={[0, 0.58, 0.038]}>
            {/* Đế biển đồng đen nẹp viền vàng */}
            <mesh>
              <boxGeometry args={[0.48, 0.16, 0.012]} />
              <meshStandardMaterial color="#1a1208" roughness={0.3} metalness={0.8} />
            </mesh>
            <mesh position={[0, 0, 0.007]}>
              <boxGeometry args={[0.46, 0.14, 0.006]} />
              <meshStandardMaterial color="#c49a45" roughness={0.25} metalness={0.85} />
            </mesh>
            <Text
              position={[0, 0.01, 0.012]}
              fontSize={0.065}
              color="#ffe6a8"
              anchorX="center"
              anchorY="middle"
              letterSpacing={0.12}
            >
              ROOM 201
            </Text>
            <Text
              position={[0, -0.042, 0.012]}
              fontSize={0.036}
              color="#ff66cc"
              anchorX="center"
              anchorY="middle"
              letterSpacing={0.18}
            >
              VIP SUITE ♥
            </Text>
          </group>

          {/* Cụm khóa tay nắm gạt ngang mạ vàng kim bên phải (mép mở cửa) */}
          <group position={[0.44, -0.05, 0.036]}>
            {/* Tấm ốp khóa mạ đồng vàng */}
            <mesh>
              <boxGeometry args={[0.06, 0.22, 0.015]} />
              <meshStandardMaterial color="#d4af37" roughness={0.2} metalness={0.9} />
            </mesh>
            {/* Đèn báo khóa điện tử / cyber card reader */}
            <mesh position={[0, 0.065, 0.009]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.008, 0.008, 0.006, 16]} />
              <meshBasicMaterial color="#33ff88" />
            </mesh>
            {/* Trục xoay tay gạt */}
            <group ref={handleLever} position={[0, -0.01, 0.01]}>
              <mesh position={[-0.05, 0, 0.015]}>
                <boxGeometry args={[0.11, 0.024, 0.022]} />
                <meshStandardMaterial color="#e6be44" roughness={0.2} metalness={0.92} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
