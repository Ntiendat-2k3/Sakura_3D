'use client';
import { Billboard, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import { Object3D, type InstancedMesh, type Mesh, type PointLight } from 'three';
import { GEKKA_BASEMENT_Y, GEKKA_RACK, GEKKA_SEATS, type PokerTableView } from '@metaverse/game-protocol';
import { GekkaBasementLight } from '../entities/GekkaBasementLight';
import { RESTRAINT_ARM_DROP } from '../systems/gekkaRestraintPose';
import { Box, Chain, Rod, StaticBatch, type Vec3 } from './gekkaParts';
import { flagstoneTexture, stoneWallTexture, tiled } from './gekkaTextures';

const B = GEKKA_BASEMENT_Y;
const WOOD = '#3b2616';
const CELLS = GEKKA_SEATS.filter(seat => seat.id.startsWith('gekka-cell-'));
/** Mặt tường trái của hầm (tường x = −6.4 dày 0.4) và hàng song sắt trước dãy xích (lối đi bắt đầu từ x = −4.9). */
const CELL_WALL_X = -6.18;
const CELL_BARS_X = -4.95;
/** Chiều cao khung chữ A; thanh xiên đi từ chân (±halfWidth) lên đỉnh, nằm sau lưng người bị trói. */
const RACK_TOP = 2.75;
const RACK_Z = GEKKA_RACK.z - 0.2;
/** Cổ tay mẫu người chơi trung bình (vai 1.32 m, nửa vai 0.17 m, tầm với 0.5 m) theo góc dang tay của khung chữ A. */
const WRIST = { x: 0.17 + 0.48 * Math.cos(RESTRAINT_ARM_DROP.post), y: 1.32 - 0.48 * Math.sin(RESTRAINT_ARM_DROP.post) };
const CELL_WRIST = { lateral: 0.17 + 0.48 * Math.cos(RESTRAINT_ARM_DROP.cell), y: 1.32 - 0.48 * Math.sin(RESTRAINT_ARM_DROP.cell) };
const beamX = (y: number) => GEKKA_RACK.halfWidth * (1 - y / RACK_TOP);

/** Khung gỗ chữ A: hai thanh xiên, thanh ngang, cùm cổ tay nối xích tới cổ tay người bị trói, vòng sắt dưới sàn cho cổ chân. */
function ARack() {
  return (
    <group position={[GEKKA_RACK.x, B, 0]}>
      {[-1, 1].map(side => (
        <group key={side}>
          <Rod from={[side * GEKKA_RACK.halfWidth, 0, RACK_Z]} to={[0, RACK_TOP, RACK_Z]} radius={0.075} color={WOOD} metal={0} rough={0.95} />
          <Box at={[side * GEKKA_RACK.halfWidth, 0.06, RACK_Z]} size={[0.32, 0.12, 0.62]} color="#2a1a0e" rough={0.95} />
          {/* Cùm cổ tay trên thanh xiên, xích ngắn kéo tới cổ tay */}
          <mesh position={[side * beamX(WRIST.y), WRIST.y, RACK_Z + 0.07]}>
            <torusGeometry args={[0.07, 0.018, 8, 16]} />
            <meshStandardMaterial color="#5e5852" metalness={0.85} roughness={0.4} />
          </mesh>
          <Chain from={[side * beamX(WRIST.y), WRIST.y, RACK_Z + 0.08]} to={[side * WRIST.x, WRIST.y, GEKKA_RACK.z - 0.02]} />
          {/* Dây thừng quấn thanh xiên */}
          {[0.6, 1.6].map(y => (
            <mesh key={y} position={[side * beamX(y), y, RACK_Z]} rotation={[0, 0, side * Math.atan2(GEKKA_RACK.halfWidth, RACK_TOP)]}>
              <torusGeometry args={[0.09, 0.025, 6, 14]} />
              <meshStandardMaterial color="#8a6a42" roughness={1} />
            </mesh>
          ))}
          <mesh position={[side * 0.3, 0.02, GEKKA_RACK.z - 0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.07, 0.018, 8, 16]} />
            <meshStandardMaterial color="#5e5852" metalness={0.85} roughness={0.4} />
          </mesh>
          <Chain from={[side * 0.3, 0.03, GEKKA_RACK.z - 0.1]} to={[side * 0.25, 0.1, GEKKA_RACK.z]} link={0.05} />
        </group>
      ))}
      <Rod from={[-beamX(0.95), 0.95, RACK_Z]} to={[beamX(0.95), 0.95, RACK_Z]} radius={0.06} color={WOOD} metal={0} rough={0.95} />
      <Box at={[0, RACK_TOP, RACK_Z]} size={[0.3, 0.22, 0.24]} color="#2a1a0e" rough={0.95} />
      <Chain from={[0, RACK_TOP - 0.1, RACK_Z]} to={[0, RACK_TOP - 0.7, RACK_Z + 0.02]} />
      {/* Vết máu khô dưới chân khung */}
      {[[0.1, 0.35, 0.5, 0.3], [-0.4, 0.75, 0.25, 0.18], [0.55, 0.05, 0.2, 0.12]].map(([x, z, rx, rz]) => (
        <mesh key={`${x},${z}`} position={[x, 0.006, GEKKA_RACK.z + z]} rotation={[-Math.PI / 2, 0, 0]} scale={[rx, rz, 1]}>
          <circleGeometry args={[1, 20]} />
          <meshStandardMaterial color="#3a0507" roughness={0.3} transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/** Dãy vòng xích tường cho người chờ lên khung, ngăn bằng song sắt. */
function Cells() {
  const bars = useRef<InstancedMesh>(null);
  const zMin = CELLS[0].z - 0.55, zMax = CELLS[CELLS.length - 1].z + 0.55;
  const front = Math.round((zMax - zMin) / 0.16), partitions = CELLS.length + 1, perPartition = 7;
  useLayoutEffect(() => {
    const mesh = bars.current;
    if (!mesh) return;
    const dummy = new Object3D();
    let index = 0;
    for (let i = 0; i <= front; i++) { dummy.position.set(CELL_BARS_X, B + 1.3, zMin + i * (zMax - zMin) / front); dummy.updateMatrix(); mesh.setMatrixAt(index++, dummy.matrix); }
    for (let p = 0; p < partitions; p++) for (let i = 1; i <= perPartition; i++) {
      dummy.position.set(CELL_WALL_X + i * (CELL_BARS_X - CELL_WALL_X) / (perPartition + 1), B + 1.3, zMin + p * 1.1);
      dummy.updateMatrix(); mesh.setMatrixAt(index++, dummy.matrix);
    }
    mesh.count = index;
    mesh.instanceMatrix.needsUpdate = true;
  }, [front, partitions, zMin, zMax]);
  return (
    <group>
      <instancedMesh ref={bars} args={[undefined, undefined, front + 1 + partitions * perPartition]}>
        <cylinderGeometry args={[0.018, 0.018, 2.6, 6]} />
        <meshStandardMaterial color="#2c2a28" metalness={0.8} roughness={0.55} />
      </instancedMesh>
      {[0.05, 2.55].map(y => <Rod key={y} from={[CELL_BARS_X, B + y, zMin]} to={[CELL_BARS_X, B + y, zMax]} radius={0.03} color="#2c2a28" />)}
      {CELLS.map(cell => (
        <group key={cell.id}>
          {[-1, 1].map(side => {
            const ring: Vec3 = [CELL_WALL_X, B + 1.55, cell.z + side * CELL_WRIST.lateral];
            return <group key={side}>
              <mesh position={ring} rotation={[0, Math.PI / 2, 0]}>
                <torusGeometry args={[0.07, 0.018, 8, 16]} />
                <meshStandardMaterial color="#5e5852" metalness={0.85} roughness={0.4} />
              </mesh>
              <Chain from={ring} to={[cell.x - 0.05, B + CELL_WRIST.y, cell.z + side * CELL_WRIST.lateral]} />
            </group>;
          })}
          <mesh position={[cell.x - 0.35, B + 0.03, cell.z]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.4, 0.3, 1]}>
            <circleGeometry args={[1, 12]} />
            <meshStandardMaterial color="#6b5a33" roughness={1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Đuốc tường: ngọn lửa phát sáng lay động; light đi kèm chỉ đổi cường độ (không thêm/bớt light). */
function Torch({ at, yaw, light = false }: { at: Vec3; yaw: number; light?: boolean }) {
  const flame = useRef<Mesh>(null), glow = useRef<PointLight>(null);
  const seed = useMemo(() => at[0] * 3.1 + at[2] * 1.7, [at]);
  useFrame(state => {
    const t = state.clock.elapsedTime + seed;
    const flicker = 0.85 + 0.1 * Math.sin(t * 13) + 0.05 * Math.sin(t * 29);
    if (flame.current) flame.current.scale.set(1, flicker * 1.1, 1);
    if (glow.current) glow.current.intensity = 6 * flicker;
  });
  return (
    <group position={at} rotation={[0, yaw, 0]}>
      <Rod from={[0, -0.25, 0]} to={[0, 0.05, 0.22]} radius={0.025} color="#3a2a1a" metal={0} rough={0.9} />
      <mesh position={[0, 0.07, 0.24]}><cylinderGeometry args={[0.05, 0.035, 0.1, 10]} /><meshStandardMaterial color="#2a2420" metalness={0.6} roughness={0.6} /></mesh>
      <mesh ref={flame} position={[0, 0.2, 0.24]} userData={{ dynamic: true }}>
        <coneGeometry args={[0.055, 0.22, 10]} />
        <meshStandardMaterial color="#ffb347" emissive="#ff7a1a" emissiveIntensity={3} transparent opacity={0.9} />
      </mesh>
      {light && <pointLight ref={glow} position={[0, 0.3, 0.35]} intensity={6} distance={7} decay={2} color="#ff9a4a" />}
    </group>
  );
}

function Props() {
  return (
    <group>
      {[[5.4, -6.1], [6.0, -6.15], [6.6, -6.05]].map(([x, z]) => (
        <group key={`${x}`} position={[x, B, z]}>
          <mesh position={[0, 0.42, 0]}><cylinderGeometry args={[0.27, 0.27, 0.84, 18]} /><meshStandardMaterial color="#4a2e18" roughness={0.9} /></mesh>
          {[0.12, 0.72].map(y => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.275, 0.012, 6, 24]} /><meshStandardMaterial color="#3a3a3a" metalness={0.8} roughness={0.5} /></mesh>)}
        </group>
      ))}
      {/* Bàn gỗ dụng cụ sát tường sau */}
      <group position={[2.8, B, -6.15]}>
        <Box at={[0, 0.8, 0]} size={[1.4, 0.06, 0.45]} color="#3a2414" rough={0.9} />
        {[[-0.62, -0.18], [0.62, -0.18], [-0.62, 0.18], [0.62, 0.18]].map(([x, z]) => <Box key={`${x},${z}`} at={[x, 0.39, z]} size={[0.06, 0.78, 0.06]} color="#2a190d" />)}
        <Rod from={[-0.4, 0.84, 0.05]} to={[-0.05, 0.84, -0.05]} radius={0.015} color="#555" />
        <Rod from={[0.1, 0.84, 0.08]} to={[0.45, 0.84, 0.0]} radius={0.02} color="#6b4a2a" metal={0} rough={0.8} />
        <mesh position={[0.3, 0.9, -0.1]}><cylinderGeometry args={[0.08, 0.06, 0.16, 12]} /><meshStandardMaterial color="#5a5048" metalness={0.5} roughness={0.6} /></mesh>
      </group>
      {/* Xô nước và móc treo từ trần */}
      <mesh position={[1.7, B + 0.15, GEKKA_RACK.z + 0.9]}><cylinderGeometry args={[0.16, 0.13, 0.3, 14, 1, true]} /><meshStandardMaterial color="#4a4038" metalness={0.5} roughness={0.6} side={2} /></mesh>
      {[[2.6, -1.2], [-2.2, -1.8], [3.8, 1.2]].map(([x, z]) => (
        <group key={`${x},${z}`}>
          <Chain from={[x, -0.32, z]} to={[x, -1.55, z]} />
          <mesh position={[x, -1.65, z + 0.04]} rotation={[0, 0, 0]}><torusGeometry args={[0.07, 0.014, 6, 14, Math.PI * 1.3]} /><meshStandardMaterial color="#4f4a45" metalness={0.85} roughness={0.4} /></mesh>
        </group>
      ))}
    </group>
  );
}

function Shell() {
  const floor = useMemo(() => tiled(flagstoneTexture(), 14 / 3, 10.8 / 3), []);
  const longWall = useMemo(() => tiled(stoneWallTexture(), 10.8 / 2.2, 1.4), []);
  const wideWall = useMemo(() => tiled(stoneWallTexture(), 14 / 2.2, 1.4), []);
  return (
    <group>
      <Box at={[0.4, B - 0.1, -1.2]} size={[14, 0.2, 10.8]} map={floor} rough={0.75} />
      <Box at={[-6.4, B / 2, -1.2]} size={[0.4, -B, 10.8]} map={longWall} rough={1} />
      <Box at={[7.2, B / 2, -1.2]} size={[0.4, -B, 10.8]} map={longWall} rough={1} />
      <Box at={[0.4, B / 2, -6.6]} size={[14, -B, 0.4]} map={wideWall} rough={1} />
      <Box at={[0.4, B / 2, 4.0]} size={[14, -B, 0.4]} map={wideWall} rough={1} />
      {/* Dầm gỗ dưới sàn tầng trên */}
      {[-5, -3, -1, 1, 3, 5].map(x => <Box key={x} at={[x, -0.45, -1.2]} size={[0.24, 0.3, 10.8]} color="#24160c" rough={0.9} />)}
      {[-5.5, -1.2, 3].map(z => <Box key={z} at={[0.4, -0.38, z]} size={[14, 0.16, 0.18]} color="#1d1209" rough={0.9} />)}
    </group>
  );
}

/** Hầm 地下 (y = GEKKA_BASEMENT_Y): tường đá, đuốc, khung trói chữ A ở ghế gekka-post và dãy xích tường cho người chờ. */
/** Phần đá, gỗ, xích không đổi: memo + gộp mesh, chỉ nhãn trạng thái và đèn chập chờn nằm ngoài. */
const DungeonStatic = memo(function DungeonStatic() {
  return (
    <StaticBatch>
      <Shell />
      <ARack />
      <Cells />
      <Props />
      <Torch at={[-2.6, B + 1.9, -6.38]} yaw={0} light />
      <Torch at={[2.6, B + 1.9, -6.38]} yaw={0} light />
      <Torch at={[6.98, B + 1.9, -2.6]} yaw={-Math.PI / 2} />
      <Torch at={[-6.18, B + 2.1, 1.9]} yaw={Math.PI / 2} />
    </StaticBatch>
  );
});

export function GekkaDungeon({ dungeon }: { dungeon?: PokerTableView['dungeon'] }) {
  return (
    <group>
      <DungeonStatic />
      <GekkaBasementLight position={[0, B + 2.4, GEKKA_RACK.z + 0.6]} />
      <pointLight position={[-4.5, B + 2.2, -1.5]} intensity={2.2} distance={6} color="#7f95c0" />
      {dungeon && dungeon.phase !== 'idle' && (
        <Billboard position={[GEKKA_RACK.x, B + 3.0, GEKKA_RACK.z]}>
          <Text fontSize={0.12} color="#ff8f7a" outlineWidth={0.006} outlineColor="#000">
            {dungeon.phase === 'capture' ? 'Đang bị lôi xuống hầm…'
              : dungeon.phase === 'punching' ? `Cú đấm ${dungeon.punchesDone}/${dungeon.punchesTotal}`
                : 'Vay tiếp hay rời bàn?'}
          </Text>
        </Billboard>
      )}
    </group>
  );
}
