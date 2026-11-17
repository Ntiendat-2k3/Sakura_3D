'use client';
import { Billboard, Text } from '@react-three/drei';
import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import { Color, Object3D, type InstancedMesh } from 'three';
import { GEKKA_SEATS, GEKKA_UPPER_BLOCKERS, POKER_SEATS } from '@metaverse/game-protocol';
import { Box, PalmPot, Rod, StaticBatch, type Vec3 } from './gekkaParts';
import { byobuTexture, damaskTexture, feltTexture, moonWindowTexture, parquetTexture, rugTexture, tiled, wainscotTexture } from './gekkaTextures';

export const GEKKA_WALL_H = 4.2;
/** Lỗ cầu thang trên sàn (khớp collider onStairs của game-protocol). */
export const GEKKA_STAIR = { xMin: 5.2, xMax: 6.6, zTop: 3.5, zBottom: -1.5, steps: 16 } as const;
const INNER = 7.4;
const GOLD = '#c9a24c';
const WOOD = '#2b170e';
const VELVET = '#6b1420';
const TABLE = { x: 0, z: -1.5, rx: 1.5, rz: 0.95, top: 0.777 };

/** Một mặt tường nhìn từ trong phòng: giấy dán tường, ván ốp chân, nẹp vàng, phào trần. Gốc nằm trên mặt tường, +Z hướng vào phòng. */
function WallFace({ at, yaw, length, height = GEKKA_WALL_H, bottom = 0 }: { at: [number, number]; yaw: number; length: number; height?: number; bottom?: number }) {
  const paper = useMemo(() => tiled(damaskTexture(), length / 1.4, height / 1.4), [length, height]);
  const panel = useMemo(() => tiled(wainscotTexture(), length / 1.1, 1), [length]);
  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, yaw, 0]}>
      <Box at={[0, bottom + height / 2, 0.01]} size={[length, height, 0.02]} map={paper} rough={0.85} />
      {bottom === 0 && <>
        <Box at={[0, 0.55, 0.04]} size={[length, 1.1, 0.06]} map={panel} rough={0.55} />
        <Box at={[0, 1.12, 0.075]} size={[length, 0.05, 0.05]} color={GOLD} metal={0.75} rough={0.3} />
        <Box at={[0, 0.06, 0.08]} size={[length, 0.12, 0.04]} color="#140b06" rough={0.5} />
      </>}
      <Box at={[0, bottom + height - 0.08, 0.06]} size={[length, 0.16, 0.1]} color={GOLD} metal={0.7} rough={0.35} />
    </group>
  );
}

/** Đèn tường hình hoa tulip: chỉ phát sáng bằng emissive để không tăng số light. */
function Sconce({ at, yaw }: { at: Vec3; yaw: number }) {
  return (
    <group position={at} rotation={[0, yaw, 0]}>
      <Box at={[0, 0, 0.03]} size={[0.12, 0.22, 0.04]} color={GOLD} metal={0.8} rough={0.3} />
      <Rod from={[0, -0.05, 0.05]} to={[0, 0.05, 0.22]} radius={0.012} color={GOLD} />
      <mesh position={[0, 0.12, 0.24]}>
        <sphereGeometry args={[0.09, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <meshStandardMaterial color="#fff1d6" emissive="#ffc77a" emissiveIntensity={1.4} side={2} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

/** Cửa sổ kính màu vòm cao, phát sáng ánh trăng nhẹ. */
function StainedWindow({ at, yaw }: { at: Vec3; yaw: number }) {
  const glass = moonWindowTexture();
  return (
    <group position={at} rotation={[0, yaw, 0]}>
      <Box at={[0, 0, 0.02]} size={[1.1, 2.0, 0.04]} color="#1a0f08" />
      <mesh position={[0, 0, 0.05]}>
        <planeGeometry args={[0.92, 1.82]} />
        <meshStandardMaterial map={glass} emissiveMap={glass} emissive="#ffffff" emissiveIntensity={0.55} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.92, 0.06]}>
        <torusGeometry args={[0.47, 0.03, 8, 24, Math.PI]} />
        <meshStandardMaterial color={GOLD} metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Chandelier() {
  const crystals = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = crystals.current;
    if (!mesh) return;
    const dummy = new Object3D();
    for (let i = 0; i < 48; i++) {
      const ring = i % 2, angle = (i / 48) * Math.PI * 2;
      const radius = ring ? 0.68 : 0.42, drop = ring ? 0.18 + (i % 4) * 0.05 : 0.32 + (i % 3) * 0.06;
      dummy.position.set(Math.cos(angle) * radius, -drop, Math.sin(angle) * radius);
      dummy.rotation.set(0, angle, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <group position={[TABLE.x, 3.55, TABLE.z]}>
      <Rod from={[0, 0.7, 0]} to={[0, 0.05, 0]} radius={0.02} color={GOLD} />
      {[[0.7, 0], [0.45, -0.2]].map(([radius, y]) => (
        <mesh key={radius} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius, 0.025, 8, 40]} />
          <meshStandardMaterial color={GOLD} metalness={0.85} roughness={0.25} />
        </mesh>
      ))}
      {Array.from({ length: 12 }, (_, index) => {
        const angle = index / 12 * Math.PI * 2;
        return (
          <mesh key={index} position={[Math.cos(angle) * 0.7, 0.08, Math.sin(angle) * 0.7]}>
            <sphereGeometry args={[0.045, 10, 8]} />
            <meshStandardMaterial color="#fff6dc" emissive="#ffd59a" emissiveIntensity={2.2} />
          </mesh>
        );
      })}
      <instancedMesh ref={crystals} args={[undefined, undefined, 48]}>
        <octahedronGeometry args={[0.035, 0]} />
        <meshStandardMaterial color="#f4fbff" roughness={0.05} metalness={0.2} emissive="#ffe8c0" emissiveIntensity={0.35} transparent opacity={0.85} />
      </instancedMesh>
      <pointLight position={[0, -0.4, 0]} intensity={28} distance={9} color="#fff1d0" />
    </group>
  );
}

function PokerTable() {
  const felt = feltTexture();
  return (
    <group position={[TABLE.x, 0, TABLE.z]}>
      <mesh position={[0, 0.05, 0]} scale={[1.2, 1, 0.8]}>
        <cylinderGeometry args={[0.55, 0.6, 0.1, 32]} />
        <meshStandardMaterial color={WOOD} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.28, 0.42, 0.7, 24]} />
        <meshStandardMaterial color={WOOD} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.745, 0]} scale={[TABLE.rx, 1, TABLE.rz]}>
        <cylinderGeometry args={[1, 1, 0.05, 64]} />
        <meshStandardMaterial color="#4a2512" roughness={0.3} />
      </mesh>
      <mesh position={[0, TABLE.top, 0]} scale={[TABLE.rx - 0.12, 1, TABLE.rz - 0.1]}>
        <cylinderGeometry args={[1, 1, 0.012, 64]} />
        <meshStandardMaterial map={felt} roughness={0.95} />
      </mesh>
      {/* Gờ tì tay bọc da và nẹp đồng */}
      <mesh position={[0, 0.79, 0]} scale={[TABLE.rx - 0.03, 1, TABLE.rz - 0.03]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.06, 12, 72]} />
        <meshStandardMaterial color="#2a1208" roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.782, 0]} scale={[TABLE.rx - 0.1, 1, TABLE.rz - 0.09]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.008, 6, 72]} />
        <meshStandardMaterial color={GOLD} metalness={0.85} roughness={0.25} />
      </mesh>
    </group>
  );
}

/** Ghế bành nhung đỏ đinh tán vàng; mặt ghế giữ cao 0.45 m như ghế cũ để clip Sit khớp. */
function Armchair({ x, z, yaw, label }: { x: number; z: number; yaw: number; label: string }) {
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      {[[-0.2, 0.15], [0.2, 0.15], [-0.2, -0.25], [0.2, -0.25]].map(([lx, lz]) => (
        <Rod key={`${lx},${lz}`} from={[lx, 0, lz]} to={[lx, 0.36, lz]} radius={0.022} color={WOOD} metal={0} rough={0.4} />
      ))}
      <Box at={[0, 0.41, -0.05]} size={[0.52, 0.12, 0.5]} color={VELVET} rough={0.9} />
      <Box at={[0, 0.8, -0.3]} size={[0.5, 0.7, 0.09]} color={VELVET} rough={0.9} rotation={[-0.12, 0, 0]} />
      <mesh position={[0, 1.16, -0.34]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 0.54, 12]} />
        <meshStandardMaterial color={WOOD} roughness={0.35} />
      </mesh>
      {[-0.29, 0.29].map(side => <Box key={side} at={[side, 0.58, -0.07]} size={[0.07, 0.07, 0.48]} color={WOOD} rough={0.35} />)}
      {Array.from({ length: 7 }, (_, index) => (
        <mesh key={index} position={[-0.21 + index * 0.07, 0.48, 0.2]}>
          <sphereGeometry args={[0.012, 6, 6]} />
          <meshStandardMaterial color={GOLD} metalness={0.9} roughness={0.25} />
        </mesh>
      ))}
      <Billboard position={[0, 1.36, 0]}>
        <Text fontSize={0.07} color="#e7c46b" outlineWidth={0.004} outlineColor="#000">{label}</Text>
      </Billboard>
    </group>
  );
}

/** Quầy dealer sau bàn (collider |x| ≤ 1.9, z −5.4…−4.1): giá phỉnh, hộp bài, đèn bàn. */
function DealerCounter() {
  const chipColors = ['#e7e2d6', '#c4232f', '#1f4fa8', '#1f7a3a', '#1a1a1a'];
  return (
    <group>
      <Box at={[0, 0.5, -4.75]} size={[3.8, 1.0, 1.3]} color="#2f190d" rough={0.4} />
      <Box at={[0, 0.5, -4.09]} size={[3.4, 0.6, 0.02]} color="#40220f" rough={0.35} />
      <Box at={[0, 0.5, -4.08]} size={[3.2, 0.5, 0.01]} color={GOLD} metal={0.7} rough={0.3} emissive="#3a2a08" glow={0.2} />
      <Box at={[0, 1.02, -4.75]} size={[3.9, 0.05, 1.4]} color="#e9e2d6" rough={0.18} />
      {chipColors.map((color, row) => Array.from({ length: 5 }, (_, stack) => (
        <mesh key={`${row}-${stack}`} position={[-0.9 + stack * 0.1 + row * 0.55, 1.08, -4.95]}>
          <cylinderGeometry args={[0.035, 0.035, 0.06, 14]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
      )))}
      <Box at={[1.35, 1.1, -4.55]} size={[0.22, 0.1, 0.3]} color="#3a0f16" rough={0.5} />
      {[-1.5, 1.5].map(x => (
        <group key={x} position={[x, 1.05, -5.15]}>
          <Rod from={[0, 0, 0]} to={[0, 0.45, 0]} radius={0.015} color={GOLD} />
          <mesh position={[0, 0.5, 0]}>
            <coneGeometry args={[0.16, 0.14, 16, 1, true]} />
            <meshStandardMaterial color="#1e5a3c" emissive="#ffd9a0" emissiveIntensity={0.25} side={2} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Quầy rượu của Rina dọc tường trái (khớp GEKKA_UPPER_BLOCKERS.bar), kệ chai và gương sau lưng. */
function Bar() {
  const box = GEKKA_UPPER_BLOCKERS.bar;
  const cx = (box.xMin + box.xMax) / 2, cz = (box.zMin + box.zMax) / 2, length = box.zMax - box.zMin;
  const bottles = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = bottles.current;
    if (!mesh) return;
    const dummy = new Object3D(), color = new Color(), palette = ['#2d6b2a', '#6b2a12', '#c9a24c', '#1f3f66', '#e8e2d0', '#4a1020'];
    let index = 0;
    for (const shelfY of [1.3, 1.75, 2.2]) {
      for (let i = 0; i < 16; i++) {
        dummy.position.set(-7.22, shelfY + 0.15, box.zMin + 0.25 + i * (length - 0.5) / 15);
        dummy.scale.set(1, 0.8 + ((i * 7 + shelfY * 10) % 5) * 0.1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        mesh.setColorAt(index, color.set(palette[(i + Math.round(shelfY * 3)) % palette.length]));
        index++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [box.zMin, length]);
  return (
    <group>
      <Box at={[cx, 0.52, cz]} size={[box.xMax - box.xMin, 1.04, length]} color="#2a160c" rough={0.4} />
      <Box at={[box.xMax + 0.005, 0.52, cz]} size={[0.01, 0.8, length - 0.3]} color={GOLD} metal={0.6} rough={0.35} emissive="#2a1d06" glow={0.2} />
      <Box at={[cx + 0.05, 1.07, cz]} size={[0.95, 0.06, length + 0.1]} color="#e9e2d6" rough={0.15} />
      <Rod from={[box.xMax + 0.12, 0.18, box.zMin + 0.1]} to={[box.xMax + 0.12, 0.18, box.zMax - 0.1]} radius={0.025} color={GOLD} />
      <Box at={[-7.37, 1.8, cz]} size={[0.02, 1.5, length - 0.2]} color="#a8b2ba" metal={0.95} rough={0.08} />
      {[1.3, 1.75, 2.2].map(y => <Box key={y} at={[-7.22, y, cz]} size={[0.32, 0.04, length - 0.2]} color={WOOD} rough={0.4} />)}
      <instancedMesh ref={bottles} args={[undefined, undefined, 48]}>
        <cylinderGeometry args={[0.04, 0.045, 0.3, 10]} />
        <meshStandardMaterial roughness={0.15} metalness={0.1} transparent opacity={0.9} />
      </instancedMesh>
      {[box.zMin + 0.7, cz, box.zMax - 0.7].map(z => (
        <group key={z} position={[cx, 2.5, z]}>
          <Rod from={[0, 1.7, 0]} to={[0, 0.15, 0]} radius={0.006} color="#111" />
          <mesh>
            <coneGeometry args={[0.14, 0.22, 16, 1, true]} />
            <meshStandardMaterial color={GOLD} metalness={0.7} roughness={0.3} emissive="#ffcf86" emissiveIntensity={0.5} side={2} />
          </mesh>
        </group>
      ))}
      <pointLight position={[cx, 2.2, cz]} intensity={5} distance={4.5} color="#ffc27a" />
      <Billboard position={[-7.2, 2.85, cz]}>
        <Text fontSize={0.16} color="#f3d88f" outlineWidth={0.006} outlineColor="#000">酒場 · BAR</Text>
      </Billboard>
    </group>
  );
}

/** Góc sofa chờ dọc tường trước bên trái (khớp GEKKA_UPPER_BLOCKERS.lounge) với máy hát và đèn cây. */
function Lounge() {
  const rug = useMemo(() => tiled(rugTexture(), 1, 1), []);
  return (
    <group>
      <mesh position={[-5.4, 0.006, 6.0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.0, 1.8]} />
        <meshStandardMaterial map={rug} roughness={0.95} />
      </mesh>
      <Box at={[-5.4, 0.24, 6.72]} size={[2.3, 0.36, 0.72]} color={VELVET} rough={0.9} />
      <Box at={[-5.4, 0.66, 7.03]} size={[2.3, 0.64, 0.16]} color={VELVET} rough={0.9} />
      {[-6.6, -4.2].map(x => <Box key={x} at={[x, 0.44, 6.75]} size={[0.14, 0.42, 0.74]} color="#4a0d17" rough={0.85} />)}
      <Box at={[-5.4, 0.36, 5.75]} size={[1.1, 0.05, 0.56]} color="#1c0f08" rough={0.2} />
      {[[-5.9, 5.52], [-4.9, 5.52], [-5.9, 5.98], [-4.9, 5.98]].map(([x, z]) => <Rod key={`${x},${z}`} from={[x, 0, z]} to={[x, 0.34, z]} radius={0.02} color={GOLD} />)}
      {/* Máy hát quay đĩa trên bàn con */}
      <group position={[-4.1, 0, 6.6]}>
        <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.22, 0.22, 0.6, 20]} /><meshStandardMaterial color={WOOD} roughness={0.35} /></mesh>
        <Box at={[0, 0.66, 0]} size={[0.3, 0.12, 0.3]} color="#3a2010" rough={0.35} />
        <mesh position={[0, 0.73, 0]}><cylinderGeometry args={[0.12, 0.12, 0.01, 24]} /><meshStandardMaterial color="#0b0b0b" roughness={0.3} /></mesh>
        <mesh position={[0.05, 0.98, -0.12]} rotation={[-0.9, 0, 0]}><coneGeometry args={[0.2, 0.42, 20, 1, true]} /><meshStandardMaterial color={GOLD} metalness={0.85} roughness={0.25} side={2} /></mesh>
      </group>
      {/* Đèn cây chụp lụa */}
      <group position={[-6.8, 0, 5.3]}>
        <Rod from={[0, 0, 0]} to={[0, 1.55, 0]} radius={0.018} color={GOLD} />
        <mesh position={[0, 1.62, 0]}><cylinderGeometry args={[0.14, 0.24, 0.3, 16, 1, true]} /><meshStandardMaterial color="#f0d9b0" emissive="#ffb866" emissiveIntensity={0.9} side={2} /></mesh>
      </group>
    </group>
  );
}

/** Bình phong sáu tấm lá vàng xếp zigzag ở góc phải trước (khớp GEKKA_UPPER_BLOCKERS.screen). */
function FoldingScreen() {
  const panels = useMemo(() => Array.from({ length: 6 }, (_, index) => {
    const texture = byobuTexture().clone();
    texture.repeat.set(1 / 6, 1);
    texture.offset.set(index / 6, 0);
    texture.needsUpdate = true;
    return texture;
  }), []);
  return (
    <group position={[4.05, 0, 6.45]}>
      {panels.map((map, index) => (
        <group key={index} position={[index * 0.47 + 0.24, 0, index % 2 ? 0.08 : -0.08]} rotation={[0, index % 2 ? -0.32 : 0.32, 0]}>
          <Box at={[0, 0.98, 0]} size={[0.5, 1.72, 0.03]} color="#1a0f08" />
          <mesh position={[0, 0.98, 0.02]}>
            <planeGeometry args={[0.45, 1.64]} />
            <meshStandardMaterial map={map} metalness={0.35} roughness={0.45} />
          </mesh>
        </group>
      ))}
      <PalmPot at={[-0.2, 0, 0.1]} scale={0.9} />
    </group>
  );
}

function Floor() {
  const wood = parquetTexture();
  const pieces: { at: Vec3; size: Vec3 }[] = [
    { at: [-1.1, -0.15, 0], size: [12.6, 0.3, 14.8] },
    { at: [6.3, -0.15, -4.45], size: [2.2, 0.3, 5.9] },
    { at: [6.3, -0.15, 5.45], size: [2.2, 0.3, 3.9] },
    { at: [7.0, -0.15, 1], size: [0.8, 0.3, 5] },
  ];
  const rug = useMemo(() => tiled(rugTexture(), 1, 1), []);
  const runner = useMemo(() => tiled(rugTexture(), 1, 2.4), []);
  return (
    <group>
      {pieces.map(piece => <Box key={piece.at.join()} at={piece.at} size={piece.size} map={tiled(wood, piece.size[0] / 2.4, piece.size[2] / 2.4)} rough={0.32} />)}
      <mesh position={[TABLE.x, 0.004, TABLE.z]} rotation={[-Math.PI / 2, 0, 0]} scale={[2.9, 2.25, 1]}>
        <circleGeometry args={[1, 64]} />
        <meshStandardMaterial map={rug} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.005, 5.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.3, 3.8]} />
        <meshStandardMaterial map={runner} roughness={0.95} />
      </mesh>
    </group>
  );
}

function WallsAndCeiling() {
  const wallPieces: { at: Vec3; size: Vec3 }[] = [
    { at: [-7.6, GEKKA_WALL_H / 2, 0], size: [0.4, GEKKA_WALL_H, 15.2] },
    { at: [7.6, GEKKA_WALL_H / 2, 0], size: [0.4, GEKKA_WALL_H, 15.2] },
    { at: [0, GEKKA_WALL_H / 2, -7.6], size: [15.2, GEKKA_WALL_H, 0.4] },
    { at: [-4.45, GEKKA_WALL_H / 2, 7.6], size: [6.3, GEKKA_WALL_H, 0.4] },
    { at: [4.45, GEKKA_WALL_H / 2, 7.6], size: [6.3, GEKKA_WALL_H, 0.4] },
    { at: [0, 3.6, 7.6], size: [2.6, 1.2, 0.4] },
  ];
  const moon = moonWindowTexture();
  return (
    <group>
      {wallPieces.map(piece => <Box key={piece.at.join()} at={piece.at} size={piece.size} color="#24120a" />)}
      <WallFace at={[-INNER, 0]} yaw={Math.PI / 2} length={14.8} />
      <WallFace at={[INNER, 0]} yaw={-Math.PI / 2} length={14.8} />
      <WallFace at={[0, -INNER]} yaw={0} length={14.8} />
      <WallFace at={[-4.35, INNER]} yaw={Math.PI} length={6.1} />
      <WallFace at={[4.35, INNER]} yaw={Math.PI} length={6.1} />
      <WallFace at={[0, INNER]} yaw={Math.PI} length={2.6} height={1.2} bottom={3.0} />
      {/* Trần: tấm trần sẫm, dầm ô cờ, hoa trần vàng chỗ treo đèn chùm */}
      <Box at={[0, GEKKA_WALL_H + 0.1, 0]} size={[15.2, 0.2, 15.2]} color="#1c0f08" />
      {[-5, -2.5, 0, 2.5, 5].map(v => <group key={v}>
        <Box at={[v, GEKKA_WALL_H - 0.06, 0]} size={[0.18, 0.12, 14.8]} color="#3a2010" rough={0.5} />
        <Box at={[0, GEKKA_WALL_H - 0.06, v]} size={[14.8, 0.12, 0.18]} color="#3a2010" rough={0.5} />
      </group>)}
      <mesh position={[TABLE.x, GEKKA_WALL_H - 0.005, TABLE.z]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.55, 32]} />
        <meshStandardMaterial color={GOLD} metalness={0.7} roughness={0.35} side={2} />
      </mesh>
      {/* Cửa sổ trăng tròn sau quầy dealer: biểu tượng 月華 (hoa trăng) */}
      <group position={[0, 2.75, -INNER + 0.02]}>
        <mesh position={[0, 0, 0.03]}>
          <circleGeometry args={[1.05, 64]} />
          <meshStandardMaterial map={moon} emissiveMap={moon} emissive="#ffffff" emissiveIntensity={0.7} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0, 0.05]}>
          <torusGeometry args={[1.08, 0.07, 12, 64]} />
          <meshStandardMaterial color={GOLD} metalness={0.85} roughness={0.25} />
        </mesh>
      </group>
      {[-4.6, -2.3].map(z => <StainedWindow key={`l${z}`} at={[-INNER + 0.02, 2.35, z]} yaw={Math.PI / 2} />)}
      {[-4.6, -2.3].map(z => <StainedWindow key={`r${z}`} at={[INNER - 0.02, 2.35, z]} yaw={-Math.PI / 2} />)}
      {[-5.75, -3.45, -1.15].map(z => <Sconce key={`sl${z}`} at={[-INNER + 0.02, 2.2, z]} yaw={Math.PI / 2} />)}
      {[-5.75, -3.45, -1.15].map(z => <Sconce key={`sr${z}`} at={[INNER - 0.02, 2.2, z]} yaw={-Math.PI / 2} />)}
      {[-3.2, -1.9, 1.9, 3.2].map(x => <Sconce key={`sb${x}`} at={[x, 2.2, -INNER + 0.02]} yaw={0} />)}
      {[-2.2, 2.2].map(x => <Sconce key={`sf${x}`} at={[x, 2.4, INNER - 0.02]} yaw={Math.PI} />)}
      {/* Cột cẩm thạch bốn góc có chân và đầu cột đồng */}
      {[[-6.6, -6.6], [6.6, -6.6], [-6.6, 6.6], [6.6, 6.6]].map(([x, z]) => (
        <group key={`${x},${z}`} position={[x, 0, z]}>
          <mesh position={[0, GEKKA_WALL_H / 2, 0]}><cylinderGeometry args={[0.24, 0.28, GEKKA_WALL_H, 24]} /><meshStandardMaterial color="#ece6da" roughness={0.18} metalness={0.05} /></mesh>
          <Box at={[0, 0.12, 0]} size={[0.7, 0.24, 0.7]} color="#d9d0c0" rough={0.25} />
          <Box at={[0, GEKKA_WALL_H - 0.2, 0]} size={[0.62, 0.2, 0.62]} color={GOLD} metal={0.7} rough={0.3} />
        </group>
      ))}
    </group>
  );
}

function StairWell() {
  const run = (GEKKA_STAIR.zTop - GEKKA_STAIR.zBottom) / GEKKA_STAIR.steps;
  const B = -3.2;
  const width = GEKKA_STAIR.xMax - GEKKA_STAIR.xMin, cx = (GEKKA_STAIR.xMin + GEKKA_STAIR.xMax) / 2;
  return (
    <group>
      {Array.from({ length: GEKKA_STAIR.steps }, (_, index) => {
        const zCenter = GEKKA_STAIR.zTop - run * (index + 0.5);
        const top = B * (GEKKA_STAIR.zTop - zCenter) / (GEKKA_STAIR.zTop - GEKKA_STAIR.zBottom);
        return <group key={index}>
          <Box at={[cx, (top + B) / 2 - 0.01, zCenter]} size={[width, Math.max(0.05, top - B), run]} color="#2f1a0e" rough={0.5} />
          <Box at={[cx, top + 0.005, zCenter]} size={[width * 0.7, 0.012, run]} color={VELVET} rough={0.95} />
          <Rod from={[cx - width * 0.36, top + 0.02, zCenter + run / 2]} to={[cx + width * 0.36, top + 0.02, zCenter + run / 2]} radius={0.008} color={GOLD} />
        </group>;
      })}
      {/* Vách giếng thang hai bên để nhìn xuống không thấy hố trống */}
      {[GEKKA_STAIR.xMin - 0.03, GEKKA_STAIR.xMax + 0.03].map(x => (
        <Box key={x} at={[x, B / 2 - 0.15, (GEKKA_STAIR.zTop + GEKKA_STAIR.zBottom) / 2]} size={[0.06, -B - 0.3, GEKKA_STAIR.zTop - GEKKA_STAIR.zBottom]} color="#2a160c" rough={0.6} />
      ))}
      {/* Lan can đồng quanh miệng thang */}
      {Array.from({ length: 9 }, (_, index) => {
        const z = GEKKA_STAIR.zBottom + index * (GEKKA_STAIR.zTop - GEKKA_STAIR.zBottom - 0.2) / 8;
        return <Rod key={`p${index}`} from={[GEKKA_STAIR.xMin - 0.05, 0, z]} to={[GEKKA_STAIR.xMin - 0.05, 0.95, z]} radius={0.02} color={WOOD} metal={0} rough={0.4} />;
      })}
      <Rod from={[GEKKA_STAIR.xMin - 0.05, 0.97, GEKKA_STAIR.zBottom]} to={[GEKKA_STAIR.xMin - 0.05, 0.97, GEKKA_STAIR.zTop - 0.2]} radius={0.035} color={GOLD} />
      <Rod from={[GEKKA_STAIR.xMin - 0.05, 0.97, GEKKA_STAIR.zBottom - 0.03]} to={[GEKKA_STAIR.xMax, 0.97, GEKKA_STAIR.zBottom - 0.03]} radius={0.035} color={GOLD} />
      {[GEKKA_STAIR.xMin + 0.4, GEKKA_STAIR.xMin + 0.9].map(x => <Rod key={x} from={[x, 0, GEKKA_STAIR.zBottom - 0.03]} to={[x, 0.95, GEKKA_STAIR.zBottom - 0.03]} radius={0.02} color={WOOD} metal={0} rough={0.4} />)}
      <Billboard position={[cx, 2.2, 4.1]}>
        <Text fontSize={0.12} color="#c9b48a" outlineWidth={0.006} outlineColor="#000">↓ 地下 · HẦM</Text>
      </Billboard>
    </group>
  );
}

/**
 * Tầng trên 月華楼: salon poker Taishō roman — gỗ óc chó, nhung đỏ, đồng vàng, kính màu ánh trăng.
 * memo + StaticBatch: không prop nên không dựng lại theo patch mạng 10 Hz, và hàng trăm khối gộp còn vài chục draw call.
 */
export const GekkaSalon = memo(function GekkaSalon() {
  return (
    <StaticBatch>
      <Floor />
      <WallsAndCeiling />
      <Chandelier />
      <PokerTable />
      {GEKKA_SEATS.filter(seat => POKER_SEATS.includes(seat.id)).map((seat, index) => (
        <Armchair key={seat.id} x={seat.x} z={seat.z} yaw={seat.yaw} label={`SEAT ${index + 1}`} />
      ))}
      <DealerCounter />
      <Bar />
      <Lounge />
      <FoldingScreen />
      <PalmPot at={[-5.85, 0, -6.95]} />
      <PalmPot at={[5.85, 0, -6.95]} />
      <StairWell />
      <Billboard position={[0, 3.25, 6.9]}>
        <Text fontSize={0.22} color="#e7c46b" letterSpacing={0.1}>月華楼</Text>
        <Text position={[0, -0.24, 0]} fontSize={0.09} color="#d8c08a">GEKKARŌ · TAISHŌ POKER SALON</Text>
      </Billboard>
    </StaticBatch>
  );
});
