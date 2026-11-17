'use client';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { BufferAttribute, BufferGeometry, CanvasTexture, MathUtils, type Mesh } from 'three';
import { BLUFF_SEATED_HEAD_HEIGHT } from '../systems/bluffPose';

type Seat = { x: number; z: number; yaw: number };

// Hình học bàn trong kohaku-club.glb (scripts/build-kohaku-club.py): thành da 1.34–1.50 m cao tới 0.994 m, nỉ ở 0.958 m.
const RAIL_TOP_Y = 0.996;
const FELT_TOP_Y = 0.961;
/** Đầu người gục nằm trên thành bàn, cách tâm ghế ~0.4 m về phía tâm bàn (đo dz của tư thế slump trên 9 mẫu). */
const HEAD_REST_FORWARD = 0.42;
/** Máu tràn qua mép thành xuống mặt nỉ, sâu thêm vào trong bàn. */
const FELT_POOL_FORWARD = 0.66;
const RAIL_SPLAT_RADIUS = 0.11;
const FELT_POOL_RADIUS = 0.22;
/** Vũng trên thành bàn bắt đầu khi đầu đã đổ chạm bàn (tư thế gục mất ~1.3 s, xem BLUFF_SLUMP_BLEND_SECONDS). */
const RAIL_DELAY_SECONDS = 1.0;
const RAIL_SPREAD_SECONDS = 1.6;
/** Rồi tràn qua mép xuống mặt nỉ; xong trước khi hết BLUFF_TIMING.bangResultMs (6.5 s) để kịp thấy trọn vũng máu. */
const FELT_DELAY_SECONDS = 2.0;
const FELT_SPREAD_SECONDS = 3.5;
/** Máu bắn ra phía thái dương bên kia (bên trái người bắn, đối diện đầu nòng). */
const SPRAY_COUNT = 40;
const SPRAY_SECONDS = 0.7;
const SPRAY_SPEED = [1.2, 2.6] as const;
const GRAVITY = 9.8;
const HEAD_HALF_WIDTH = 0.12;

/** Vết máu không đều cạnh, kèm vài giọt văng, vẽ một lần bằng canvas để khỏi thêm file texture. */
function useBloodTexture() {
  return useMemo(() => {
    const size = 128, c = size / 2;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    // Hạt giống cố định: mọi client thấy cùng một hình vết máu.
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const blob = (x: number, y: number, r: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(70,0,4,0.97)');
      g.addColorStop(0.75, 'rgba(110,4,8,0.92)');
      g.addColorStop(1, 'rgba(120,6,10,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    };
    blob(c, c, c * 0.62);
    for (let i = 0; i < 9; i++) {
      const a = rand() * Math.PI * 2, d = c * (0.3 + rand() * 0.3);
      blob(c + Math.cos(a) * d, c + Math.sin(a) * d, c * (0.18 + rand() * 0.18));
    }
    for (let i = 0; i < 14; i++) {
      const a = rand() * Math.PI * 2, d = c * (0.7 + rand() * 0.25);
      blob(c + Math.cos(a) * d, c + Math.sin(a) * d, c * (0.025 + rand() * 0.04));
    }
    return new CanvasTexture(canvas);
  }, []);
}

/** Giây (performance.now()/1000) lúc đạn nổ; null khi chưa nổ. Đọc mỗi frame nên đổi giá trị không cần render lại. */
type BangClock = RefObject<number | null>;
/** Trước khi nổ, vẫn vẽ (scale gần 0 / hạt dưới sàn) để shader và texture được biên dịch sẵn, tránh khựng đúng lúc nổ. */
const IDLE_SCALE = 1e-4;
const IDLE_Y = -50;

function Pool({ seat, forward, y, radius, delay, spread, bangAt, texture }: {
  seat: Seat; forward: number; y: number; radius: number; delay: number; spread: number; bangAt: BangClock; texture: CanvasTexture;
}) {
  const mesh = useRef<Mesh>(null);
  const dirX = Math.sin(seat.yaw), dirZ = Math.cos(seat.yaw);
  useFrame(() => {
    if (!mesh.current) return;
    const startAt = bangAt.current;
    // Lan nhanh lúc đầu rồi chậm dần như chất lỏng.
    const t = startAt === null ? 0 : MathUtils.clamp((performance.now() / 1000 - startAt - delay) / spread, 0, 1);
    const s = t > 0 ? Math.max(1e-3, radius * 2 * (1 - (1 - t) ** 3)) : IDLE_SCALE;
    mesh.current.scale.set(s, s, 1);
  });
  return (
    <mesh ref={mesh} scale={[IDLE_SCALE, IDLE_SCALE, 1]} position={[seat.x + dirX * forward, y, seat.z + dirZ * forward]} rotation={[-Math.PI / 2, 0, seat.yaw]}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial map={texture} transparent depthWrite={false} roughness={0.15} metalness={0.1} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  );
}

function Spray({ seat, bangAt }: { seat: Seat; bangAt: BangClock }) {
  const geometry = useMemo(() => {
    const value = new BufferGeometry();
    value.setAttribute('position', new BufferAttribute(new Float32Array(SPRAY_COUNT * 3).fill(IDLE_Y), 3));
    return value;
  }, []);
  // Hướng văng ngẫu nhiên lấy mới cho mỗi lần nổ, không phụ thuộc lần gắn component.
  const burst = useRef<{ startAt: number; velocity: Float32Array; origin: number[] } | null>(null);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    const startAt = bangAt.current;
    const position = geometry.attributes.position as BufferAttribute;
    const t = startAt === null ? -1 : performance.now() / 1000 - startAt;
    if (t < 0 || t >= SPRAY_SECONDS) {
      if (position.getY(0) !== IDLE_Y) { (position.array as Float32Array).fill(IDLE_Y); position.needsUpdate = true; }
      return;
    }
    if (!burst.current || burst.current.startAt !== startAt) burst.current = { startAt: startAt!, ...sprayBurst(seat) };
    const { velocity, origin } = burst.current;
    for (let i = 0; i < SPRAY_COUNT; i++) {
      // Rơi tự do, dừng ở mặt bàn.
      const y = Math.max(FELT_TOP_Y, origin[1] + velocity[i * 3 + 1] * t - 0.5 * GRAVITY * t * t);
      position.setXYZ(i, origin[0] + velocity[i * 3] * t, y, origin[2] + velocity[i * 3 + 2] * t);
    }
    position.needsUpdate = true;
  });
  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial color="#8a0610" size={0.028} sizeAttenuation transparent opacity={0.95} depthWrite={false} />
    </points>
  );
}

function sprayBurst(seat: Seat) {
  // Bên trái người ngồi (trục +X của avatar) trong hệ thế giới; súng ở thái dương phải nên máu thoát ra bên trái.
  const leftX = Math.cos(seat.yaw), leftZ = -Math.sin(seat.yaw);
  const origin = [seat.x + leftX * HEAD_HALF_WIDTH, BLUFF_SEATED_HEAD_HEIGHT, seat.z + leftZ * HEAD_HALF_WIDTH];
  const velocity = new Float32Array(SPRAY_COUNT * 3);
  for (let i = 0; i < SPRAY_COUNT; i++) {
    const speed = MathUtils.lerp(SPRAY_SPEED[0], SPRAY_SPEED[1], Math.random());
    const side = (Math.random() - 0.5) * 0.9, up = Math.random() * 0.7 - 0.1;
    const dx = leftX + Math.sin(seat.yaw) * side, dz = leftZ + Math.cos(seat.yaw) * side;
    const len = Math.hypot(dx, up, dz);
    velocity.set([dx / len * speed, up / len * speed, dz / len * speed], i * 3);
  }
  return { velocity, origin };
}

/**
 * Máu khi viên đạn thật nổ: tia máu văng ra thái dương bên kia rồi vũng máu lan dưới đầu người gục trên thành bàn,
 * chảy xuống mặt nỉ. Luôn được gắn sẵn trong Kohaku (đặt ở ghế người bắn) và chỉ hiện khi `bangAt` có giá trị:
 * tạo texture/biên dịch material ngay lúc nổ súng làm hình khựng đúng khoảnh khắc kịch tính nhất.
 */
export function BluffBloodEffect({ seat, bangAt }: { seat: Seat; bangAt: BangClock }) {
  const texture = useBloodTexture();
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <>
      <Spray seat={seat} bangAt={bangAt} />
      <Pool seat={seat} forward={HEAD_REST_FORWARD} y={RAIL_TOP_Y} radius={RAIL_SPLAT_RADIUS} delay={RAIL_DELAY_SECONDS} spread={RAIL_SPREAD_SECONDS} bangAt={bangAt} texture={texture} />
      <Pool seat={seat} forward={FELT_POOL_FORWARD} y={FELT_TOP_Y} radius={FELT_POOL_RADIUS} delay={FELT_DELAY_SECONDS} spread={FELT_SPREAD_SECONDS} bangAt={bangAt} texture={texture} />
    </>
  );
}
