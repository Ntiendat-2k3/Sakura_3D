'use client';
import { Billboard, Text, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { CanvasTexture, MathUtils, type Group, type Mesh, type PointLight, type Sprite } from 'three';
import { isBluffTruthful, KOHAKU_SEATS, type BluffFace, type BluffTableView } from '@metaverse/game-protocol';
import { BLUFF_GUN_SCALE } from '../systems/bluffPose';
import { BluffBloodEffect } from './BluffBloodEffect';

export const BLUFF_CARD_URL = '/assets/props/kohaku-bluff/card.glb';
export const BLUFF_REVOLVER_URL = '/assets/props/kohaku-bluff/revolver.glb';

// Cùng hệ số đặt nhãn SEAT trong KohakuScene: mép bàn tròn, trước mặt từng ghế.
const PILE_SCALE = 0.54;
const TABLE_Y = 0.97;
const CARD_THICKNESS = 0.002;
const CARD_SPREAD = 0.075;
const FLIP_SECONDS = 0.4;
const GUN_SLIDE_SECONDS = 0.8;
const GUN_REST_Y = 0.982; // súng nằm nghiêng, nửa bề dày thân (đã nhân BLUFF_GUN_SCALE) cao hơn mặt bàn
const GUN_SEAT_SCALE = 0.62; // đặt súng gần người bắn hơn chồng bài để không đè lên bài
const FLASH_MS = 120;
const FLASH_INTENSITY = 12;
const FLASH_HEIGHT = 1.35; // tầm đầu người ngồi; súng đang ở tay người bắn nên chớp đặt tại ghế
const BUBBLE_HEIGHT = 2.05;

const seatOf = (id: string) => KOHAKU_SEATS.find(s => s.id === id);
const DEALER = seatOf('kohaku-dealer');
const BLOOD_FALLBACK_SEAT = KOHAKU_SEATS.find(s => s.id.startsWith('kohaku-player-'));

/** Lời thoại của Shinku theo pha; trả '' khi không có gì để nói. */
export function dealerLine(table: BluffTableView, names: Record<string, string> = {}): string {
  if (table.phase === 'gameOver') {
    const winner = table.seats.find(s => s.seatId === table.winnerSeat);
    return winner ? `${names[winner.sessionId] ?? 'Người chơi'} thắng!` : '';
  }
  if (table.phase === 'reveal' && table.tableRank && table.lastPlay.revealed.length > 0) {
    return isBluffTruthful(table.lastPlay.revealed, table.tableRank) ? 'Toàn lá thật!' : 'Có lá sai!';
  }
  if (table.phase === 'turn' && table.tableRank && !table.lastPlay.seatId) return `Lá chuẩn: ${table.tableRank}`;
  return '';
}

/** Vòng sáng mềm cho tia chớp đầu nòng, vẽ một lần bằng canvas để khỏi thêm file texture. */
function useFlashTexture() {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,250,220,1)');
    g.addColorStop(0.35, 'rgba(255,190,80,0.8)');
    g.addColorStop(1, 'rgba(255,120,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new CanvasTexture(canvas);
  }, []);
}

function Card({ face, faceUp, flip, x, y }: { face: BluffFace | null; faceUp: boolean; flip: RefObject<number>; x: number; y: number }) {
  const { scene } = useGLTF(BLUFF_CARD_URL);
  const group = useRef<Group>(null);
  // Mỗi hạng là một mesh riêng trong card.glb; lá úp dùng K chỉ để lấy mặt sau.
  const mesh = useMemo(() => {
    const source = scene.getObjectByName(`card-${face ?? 'K'}`) as Mesh | undefined;
    return source ? source.clone() : null;
  }, [scene, face]);
  useFrame(() => {
    // Mặt trước hướng +Y; xoay X = π là úp. Lật mượt theo tiến độ flip khi lá được công bố.
    if (group.current) group.current.rotation.x = faceUp ? Math.PI * (1 - (flip.current ?? 1)) : Math.PI;
  });
  if (!mesh) return null;
  return <group ref={group} position={[x, y, 0]}><primitive object={mesh} dispose={null} /></group>;
}

function BluffGun({ table }: { table: BluffTableView }) {
  const { scene } = useGLTF(BLUFF_REVOLVER_URL);
  const group = useRef<Group>(null);
  const phaseStart = useRef({ phase: table.phase, at: 0 });
  const dealerHome = DEALER ? { x: DEALER.x * PILE_SCALE, z: DEALER.z * PILE_SCALE } : { x: 0, z: -1 };
  const shooter = seatOf(table.shooterSeat);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const now = clock.elapsedTime;
    if (phaseStart.current.phase !== table.phase) phaseStart.current = { phase: table.phase, at: now };
    // Pha shooting/result: súng đã gắn vào tay phải người bắn (Task 8) nên ẩn súng trên bàn.
    g.visible = table.phase !== 'shooting' && table.phase !== 'result';
    let x = dealerHome.x, z = dealerHome.z, yaw = 0;
    if (table.phase === 'reveal' && shooter) {
      const t = MathUtils.smoothstep((now - phaseStart.current.at) / GUN_SLIDE_SECONDS, 0, 1);
      x = MathUtils.lerp(dealerHome.x, shooter.x * GUN_SEAT_SCALE, t);
      z = MathUtils.lerp(dealerHome.z, shooter.z * GUN_SEAT_SCALE, t);
      // Với rotation (0, yaw, π/2) nòng +Z kết thúc ở hướng −forward của ghế (yaw + π). Quay theo đường ngắn nhất
      // (đưa góc lệch về [−π, π]) để súng không xoay gần một vòng khi trượt tới ghế.
      const delta = Math.atan2(Math.sin(shooter.yaw + Math.PI), Math.cos(shooter.yaw + Math.PI));
      yaw = delta * t;
    }
    g.position.set(x, GUN_REST_Y, z);
    g.rotation.set(0, yaw, Math.PI / 2); // nằm nghiêng sang bên, nòng hướng +Z rồi xoay theo yaw
  });
  return <group ref={group} scale={BLUFF_GUN_SCALE}><primitive object={scene} dispose={null} /></group>;
}

/** Đèn luôn được gắn sẵn và chỉ đổi cường độ: thêm/bớt light làm three biên dịch lại mọi material đúng lúc nổ súng. */
function MuzzleFlash({ shooterSeat, flashUntil }: { shooterSeat: string; flashUntil: RefObject<number> }) {
  const texture = useFlashTexture();
  const seat = seatOf(shooterSeat);
  const light = useRef<PointLight>(null);
  const sprite = useRef<Sprite>(null);
  useFrame(() => {
    const on = performance.now() < (flashUntil.current ?? 0);
    if (light.current) light.current.intensity = on ? FLASH_INTENSITY : 0;
    if (sprite.current) sprite.current.visible = on;
  });
  return (
    <group position={[seat?.x ?? 0, FLASH_HEIGHT, seat?.z ?? 0]}>
      <pointLight ref={light} intensity={0} distance={5} color="#ffcf70" />
      <sprite ref={sprite} visible={false} scale={[0.5, 0.5, 0.5]}>
        <spriteMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  );
}

/** Vật thể trên bàn Kohaku Bluff: chồng bài úp, lật khi mở bài, súng chạy tới người bắn, tia chớp và lời Shinku. */
export function KohakuBluffTable({ table, names }: { table: BluffTableView; names?: Record<string, string> }) {
  const flip = useRef(1);
  const flipStart = useRef<number | null>(null);
  const revealed = table.phase === 'reveal' || table.phase === 'shooting' || table.phase === 'result';
  const faces: (BluffFace | null)[] = revealed && table.lastPlay.revealed.length > 0 ? table.lastPlay.revealed : [];
  const count = faces.length || table.lastPlay.count;
  const pileSeat = seatOf(table.lastPlay.seatId);
  const hasPile = !!pileSeat && count > 0 && table.phase !== 'lobby' && table.phase !== 'gameOver';
  const faceUp = faces.length > 0;

  // Bắt đầu lật mỗi khi pha chuyển sang reveal.
  useEffect(() => {
    flip.current = table.phase === 'reveal' ? 0 : 1;
    flipStart.current = null;
  }, [table.phase, table.lastPlay.seatId]);
  useFrame(({ clock }) => {
    if (flip.current >= 1) return;
    flipStart.current ??= clock.elapsedTime;
    flip.current = Math.min(1, (clock.elapsedTime - flipStart.current) / FLIP_SECONDS);
  });

  // Thời điểm tắt chớp lưu theo đồng hồ, không dùng timer nên đổi shotResult giữa chừng cũng không kẹt sáng.
  const flashUntil = useRef(0);
  const lastShot = useRef(table.shotResult);
  useEffect(() => {
    if (table.shotResult === 'bang' && lastShot.current !== 'bang') flashUntil.current = performance.now() + FLASH_MS;
    lastShot.current = table.shotResult;
  }, [table.shotResult]);
  // Máu chỉ còn trong pha result của lần 'bang'; vòng mới chia bài thì bàn đã được dọn.
  const bangAt = useRef<number | null>(null);
  const bleeding = table.phase === 'result' && table.shotResult === 'bang';
  useEffect(() => {
    bangAt.current = bleeding ? performance.now() / 1000 : null;
  }, [bleeding]);

  const line = dealerLine(table, names);
  // Giữ ghế người bắn gần nhất để vết máu không nhảy chỗ khi pha result kết thúc và shooterSeat bị xóa.
  const lastShooter = useRef(seatOf(table.shooterSeat) ?? BLOOD_FALLBACK_SEAT);
  lastShooter.current = seatOf(table.shooterSeat) ?? lastShooter.current;
  const bloodSeat = lastShooter.current;
  return (
    <>
      {hasPile && pileSeat && (
        <group position={[pileSeat.x * PILE_SCALE, TABLE_Y, pileSeat.z * PILE_SCALE]} rotation={[0, pileSeat.yaw + Math.PI, 0]}>
          {Array.from({ length: count }, (_, i) => (
            <Card
              key={`${table.lastPlay.seatId}-${i}-${faces[i] ?? 'down'}`}
              face={faceUp ? faces[i] : null}
              faceUp={faceUp}
              flip={flip}
              x={faceUp ? (i - (count - 1) / 2) * CARD_SPREAD : (i - 1) * 0.004}
              y={faceUp ? CARD_THICKNESS : i * CARD_THICKNESS}
            />
          ))}
        </group>
      )}
      <BluffGun table={table} />
      <MuzzleFlash shooterSeat={table.shooterSeat} flashUntil={flashUntil} />
      {bloodSeat && <BluffBloodEffect seat={bloodSeat} bangAt={bangAt} />}
      {line && DEALER && (
        <Billboard position={[DEALER.x, BUBBLE_HEIGHT, DEALER.z]}>
          <mesh position={[0, 0, -0.01]}>
            <planeGeometry args={[Math.max(1.1, line.length * 0.1), 0.3]} />
            <meshBasicMaterial color="#1a0d05" transparent opacity={0.78} depthWrite={false} />
          </mesh>
          <Text fontSize={0.15} color="#f5d485" anchorX="center" anchorY="middle" outlineWidth={0.006} outlineColor="#1a0d05">
            {line}
          </Text>
        </Billboard>
      )}
    </>
  );
}
