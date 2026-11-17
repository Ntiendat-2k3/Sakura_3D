'use client';

// Bầu trời đêm Trăng Khuyết Màu Trắng (White Crescent Moon) Anime thanh lịch với đĩa trăng lưỡi liềm rực sáng, quầng hào quang bạc và vòm trời đêm chàm tím.
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getWorldEnvironment } from '../systems/worldClock';

/** Cường độ gốc của ánh trăng; ban ngày giảm về 0 cùng độ mờ của trăng. */
const MOON_DIRECTIONAL_INTENSITY = 0.32;
const MOON_POINT_INTENSITY = 7;

/** Tạo texture mặt trăng khuyết màu trắng bạc tinh khôi dạng thủ tục bằng Canvas 2D */
function createWhiteCrescentMoonTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const cx = 256;
  const cy = 256;
  const r = 220;

  // 1. Vẽ đĩa trăng tròn trắng bạc ánh sáng lung linh
  const grad = ctx.createRadialGradient(cx - 50, cy - 20, 20, cx, cy, r);
  grad.addColorStop(0, '#ffffff');    // Tâm trăng trắng sáng tinh khôi
  grad.addColorStop(0.4, '#f2f7ff');  // Thân trăng trắng bạc
  grad.addColorStop(0.75, '#e0edff'); // Rìa trăng trắng phớt lam nhạt
  grad.addColorStop(0.96, '#c6ddff'); // Viền ngoài ánh trăng bạc
  grad.addColorStop(1, '#ffffff');    // Viền sáng viền ngoài

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // 2. Dùng kỹ thuật destination-out để cắt đĩa trăng thành hình TRĂNG KHUYẾT (Lưỡi liềm) cong thanh thoát
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';

  const cutCx = cx + 85;
  const cutCy = cy - 25;
  const cutR = 210;

  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(cutCx, cutCy, cutR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 3. Phủ thêm lớp viền phát sáng viền cong lưỡi liềm trắng sáng
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const rimGrad = ctx.createLinearGradient(0, 0, 512, 512);
  rimGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  rimGrad.addColorStop(0.5, 'rgba(230, 242, 255, 0.45)');
  rimGrad.addColorStop(1, 'rgba(180, 215, 255, 0.15)');
  ctx.fillStyle = rimGrad;
  ctx.fillRect(0, 0, 512, 512);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/** Tạo texture quầng hào quang phát sáng mềm mại quanh mặt trăng khuyết */
function createMoonGlowTexture(innerColor: string, outerColor: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const cx = 128;
  const cy = 128;
  const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 120);
  grad.addColorStop(0, innerColor);
  grad.addColorStop(0.4, outerColor);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/** Tạo texture nền vòm trời đêm chàm tím huyền ảo, u ám sâu thẳm */
function createIndigoSkyDomeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#020105');    // Đỉnh trời đen tuyền sâu thẳm
  grad.addColorStop(0.45, '#060511'); // Tím đen u ám
  grad.addColorStop(0.78, '#0a091a'); // Chàm tím sẫm
  grad.addColorStop(1.0, '#100e26');  // Chân trời đêm huyền bí

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function BloodMoonSky({
  position = [0, 15.2, 48],
  radius = 5.8,
}: {
  position?: [number, number, number];
  radius?: number;
  cloudCount?: number;
}) {
  const moonTexture = useMemo(() => createWhiteCrescentMoonTexture(), []);
  const innerGlowTexture = useMemo(() => createMoonGlowTexture('rgba(255, 255, 255, 0.65)', 'rgba(190, 220, 255, 0.22)'), []);
  const outerGlowTexture = useMemo(() => createMoonGlowTexture('rgba(195, 225, 255, 0.28)', 'rgba(80, 130, 210, 0.04)'), []);
  const skyDomeTexture = useMemo(() => createIndigoSkyDomeTexture(), []);

  // Hướng từ gốc tọa độ (0,0,0) tới mặt trăng: +1 nếu mặt trăng ở +Z, -1 nếu ở -Z
  const dirSign = position[2] >= 0 ? 1 : -1;
  const groupRef = useRef<THREE.Group>(null);
  const moonDirectional = useRef<THREE.DirectionalLight>(null);
  const moonPoint = useRef<THREE.PointLight>(null);
  // Độ mờ gốc của từng vật liệu để nhân với mức "đêm" mỗi frame
  const baseOpacity = useRef(new Map<THREE.MeshBasicMaterial, number>());

  // Trăng và vòm trời đêm mờ dần khi trời sáng theo chu kỳ ngày/đêm chung
  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const night = 1 - getWorldEnvironment(Date.now()).daylight;
    // Chỉ ẩn mesh, không ẩn cả group: ẩn đèn sẽ đổi số lượng đèn và buộc biên dịch lại shader toàn cảnh
    group.traverse(obj => {
      if (!(obj instanceof THREE.Mesh) || !(obj.material instanceof THREE.MeshBasicMaterial)) return;
      const mat = obj.material;
      if (!baseOpacity.current.has(mat)) baseOpacity.current.set(mat, mat.opacity);
      mat.opacity = (baseOpacity.current.get(mat) ?? 1) * night;
      obj.visible = night > 0.01;
    });
    if (moonDirectional.current) moonDirectional.current.intensity = MOON_DIRECTIONAL_INTENSITY * night;
    if (moonPoint.current) moonPoint.current.intensity = MOON_POINT_INTENSITY * night;
  });

  return (
    <group ref={groupRef} name="WhiteCrescentMoonSky">
      {/* 0. Tấm phông vòm trời đêm Chàm Tím phía sau mặt trăng (không bị sương mù che phủ) */}
      <mesh position={[position[0], position[1] + 10, position[2] + dirSign * 4]}>
        <planeGeometry args={[160, 90]} />
        <meshBasicMaterial
          map={skyDomeTexture}
          transparent
          fog={false}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* 1. Mặt Trăng Khuyết Màu Trắng (White Crescent Moon) */}
      <mesh position={position} rotation={[0, 0, 0.22]}>
        <planeGeometry args={[radius * 2, radius * 2]} />
        <meshBasicMaterial
          map={moonTexture}
          transparent
          fog={false}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* 2. Quầng sáng trong mềm mại màu trắng bạc (Inner Silver Glow) */}
      <mesh position={[position[0], position[1], position[2] - dirSign * 0.1]}>
        <planeGeometry args={[radius * 3.2, radius * 3.2]} />
        <meshBasicMaterial
          map={innerGlowTexture}
          transparent
          fog={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* 3. Quầng hào quang rộng xanh trăng êm dịu (Outer Moon Halo) */}
      <mesh position={[position[0], position[1], position[2] - dirSign * 0.2]}>
        <planeGeometry args={[radius * 5.8, radius * 5.8]} />
        <meshBasicMaterial
          map={outerGlowTexture}
          transparent
          fog={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* 4. Ánh sáng trăng khuyết trắng bạc thanh khiết chiếu dịu dàng trong đêm u ám */}
      <directionalLight
        ref={moonDirectional}
        position={[position[0], position[1] + 8, position[2]]}
        target-position={[0, 0, 0]}
        color="#e4f0ff"
        intensity={MOON_DIRECTIONAL_INTENSITY}
      />
      <pointLight
        ref={moonPoint}
        position={[position[0], position[1], position[2] - dirSign * 12]}
        color="#d0e4ff"
        intensity={MOON_POINT_INTENSITY}
        distance={95}
        decay={2}
      />
    </group>
  );
}
