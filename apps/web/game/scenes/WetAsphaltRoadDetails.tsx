'use client';

// Lớp phủ chi tiết mặt đường nhựa Tokyo Cyberpunk: vân nhựa đường, vạch phân làn, vạch sang đường zebra, nắp cống hoa anh đào,
// cùng lớp nước động theo đồng hồ thế giới: đường ướt bóng khi mưa, vũng nước lan/co, tóe nước, gợn sóng và nước chảy dọc rãnh.
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getWorldEnvironment } from '../systems/worldClock';
import { RainRippleField } from '../systems/RainRippleField';

/** Tạo texture chi tiết mặt đường nhựa ướt mưa bằng Canvas 2D độ phân giải cao */
function createWetRoadTexture(): { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
  const width = 1024;
  const height = 2048;

  // 1. Canvas khuếch tán màu (Color Map)
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 2. Canvas độ nhẵn bóng (Roughness Map: đen = bóng loáng như gương, trắng = nhám ráp)
  const rCanvas = document.createElement('canvas');
  rCanvas.width = width;
  rCanvas.height = height;
  const rCtx = rCanvas.getContext('2d')!;

  // A. Nền nhựa đường ướt mưa (Wet Asphalt Base)
  ctx.fillStyle = '#111219';
  ctx.fillRect(0, 0, width, height);

  rCtx.fillStyle = '#606060'; // Nhựa đường nhám vừa phải
  rCtx.fillRect(0, 0, width, height);

  // B. Hàng ngàn hạt đá dăm khoáng và sỏi mịn nhựa đường (Asphalt Aggregate Grain)
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = 1 + Math.random() * 2.2;
    const tone = Math.random();
    ctx.fillStyle = tone > 0.65 ? '#282b3d' : tone > 0.35 ? '#1a1b24' : '#0a0a0f';
    ctx.fillRect(x, y, size, size);
  }

  // C. Vạch kẻ lề đường màu trắng mờ ở 2 bên mép
  const drawEdgeLine = (xPos: number) => {
    ctx.fillStyle = 'rgba(180, 192, 210, 0.45)';
    ctx.fillRect(xPos - 5, 0, 10, height);
    rCtx.fillStyle = '#505050';
    rCtx.fillRect(xPos - 5, 0, 10, height);
  };
  drawEdgeLine(60);
  drawEdgeLine(width - 60);

  // D. Vạch kẻ đường nét đứt màu vàng hổ phách neon ở tim đường (Centerline)
  const centerX = width / 2;
  const dashLen = 70;
  const gapLen = 50;
  let curY = 10;
  while (curY < height) {
    ctx.fillStyle = 'rgba(235, 175, 45, 0.78)';
    ctx.fillRect(centerX - 7, curY, 14, dashLen);
    rCtx.fillStyle = '#454545';
    rCtx.fillRect(centerX - 7, curY, 14, dashLen);
    curY += dashLen + gapLen;
  }

  // E. Hai cụm vạch sang đường cho người đi bộ (Crosswalk Zebra Stripes)
  const drawCrosswalk = (baseY: number, stripeCount: number) => {
    const stripeWidth = 56;
    const stripeHeight = 160;
    const startX = 140;
    const spacing = 75;

    for (let i = 0; i < stripeCount; i++) {
      const sx = startX + i * spacing;
      // Vạch sơn trắng với vết mòn nứt tự nhiên
      ctx.fillStyle = 'rgba(230, 238, 248, 0.82)';
      ctx.fillRect(sx, baseY, stripeWidth, stripeHeight);

      // Vết xước mòn do lốp xe chạy qua
      for (let s = 0; s < 12; s++) {
        ctx.fillStyle = 'rgba(17, 18, 25, 0.4)';
        ctx.fillRect(sx + Math.random() * stripeWidth, baseY + Math.random() * stripeHeight, 3 + Math.random() * 6, 8 + Math.random() * 22);
      }

      rCtx.fillStyle = '#303030';
      rCtx.fillRect(sx, baseY, stripeWidth, stripeHeight);
    }
  };

  // Vạch sang đường ngã tư trung tâm (z = 0)
  drawCrosswalk(height * 0.48, 10);
  // Vạch sang đường trước Reika Lounge (z = -14)
  drawCrosswalk(height * 0.22, 10);

  // G. Nắp cống kim loại hoa văn Nhật Bản (Sakura Manhole Covers)
  const drawManhole = (cx: number, cy: number) => {
    const r = 42;
    ctx.save();
    ctx.translate(cx, cy);

    // Vành nắp cống gang đúc xám thép
    ctx.fillStyle = '#22232c';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#3a3d4f';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Vòng ren rãnh thoát nước
    ctx.strokeStyle = '#14151c';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, r - 8, 0, Math.PI * 2);
    ctx.stroke();

    // Hoa văn 5 cánh hoa anh đào Sakura ở tâm nắp cống
    ctx.fillStyle = 'rgba(255, 160, 200, 0.45)';
    for (let k = 0; k < 5; k++) {
      ctx.save();
      ctx.rotate((k * Math.PI * 2) / 5);
      ctx.beginPath();
      ctx.ellipse(0, -14, 5, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();

    // Kim loại nắp cống có độ phản quang bóng kim loại cao
    rCtx.save();
    rCtx.translate(cx, cy);
    rCtx.fillStyle = '#181818';
    rCtx.beginPath();
    rCtx.arc(0, 0, r, 0, Math.PI * 2);
    rCtx.fill();
    rCtx.restore();
  };

  drawManhole(260, 720);
  drawManhole(760, 1340);

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.ClampToEdgeWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  map.needsUpdate = true;

  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.wrapS = THREE.ClampToEdgeWrapping;
  roughnessMap.wrapT = THREE.ClampToEdgeWrapping;
  roughnessMap.needsUpdate = true;

  return { map, roughnessMap };
}

// Kích thước canvas texture mặt đường và tấm phủ (mét): texture 1024x2048 trải trên tấm 8.4m x 54m.
const TEX_W = 1024;
const TEX_H = 2048;
const ROAD_WIDTH = 8.4;
const ROAD_LENGTH = 54;
/** Độ cao mặt tấm phủ trong hệ toạ độ của group (group đặt ở y = 0.006). */
const ROAD_LOCAL_Y = 0.007;

/** Vũng nước đọng theo toạ độ pixel của texture mặt đường. */
const PUDDLES = [
  { x: 380, y: 350, rx: 110, ry: 75, angle: 0.2 },
  { x: 680, y: 520, rx: 95, ry: 60, angle: -0.3 },
  { x: 420, y: 880, rx: 130, ry: 80, angle: 0.1 },
  { x: 610, y: 1150, rx: 140, ry: 90, angle: -0.15 },
  { x: 340, y: 1420, rx: 105, ry: 70, angle: 0.25 },
  { x: 720, y: 1680, rx: 115, ry: 75, angle: -0.2 },
  { x: 500, y: 1900, rx: 150, ry: 85, angle: 0.05 },
];

/** Đổi toạ độ pixel texture sang toạ độ thế giới (tấm phủ xoay -90° quanh X nên mép trên texture ở z = -27). */
function texelToWorld(px: number, py: number, out: THREE.Vector2) {
  return out.set((px / TEX_W - 0.5) * ROAD_WIDTH, (py / TEX_H) * ROAD_LENGTH - ROAD_LENGTH / 2);
}

/**
 * Texture vũng nước tách riêng khỏi mặt đường: alpha đậm ở tâm, nhạt ra rìa.
 * Khi khô, alphaTest tăng dần nên vũng nước co lại từ rìa vào tâm rồi biến mất.
 */
function createPuddleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  for (const pud of PUDDLES) {
    ctx.save();
    ctx.translate(pud.x, pud.y);
    ctx.rotate(pud.angle);
    ctx.scale(1, pud.ry / pud.rx);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, pud.rx);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.55, '#cccccc');
    grad.addColorStop(1, '#000000');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, pud.rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/** Texture vệt nước chảy dọc rãnh lề đường, cuộn theo trục dọc. */
function createGutterStreamTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  for (let i = 0; i < 70; i++) {
    const x = 6 + Math.random() * 52;
    const y = Math.random() * 512;
    const len = 30 + Math.random() * 90;
    const width = 1.5 + Math.random() * 2;
    const peak = 0.35 + Math.random() * 0.5;
    // Vẽ thêm bản sao lệch 512px để texture cuộn liền mạch qua mép
    for (const offset of [0, -512]) {
      const grad = ctx.createLinearGradient(0, y + offset, 0, y + offset + len);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, `rgba(255,255,255,${peak})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y + offset, width, len);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 6);
  texture.needsUpdate = true;
  return texture;
}

/** Chọn ngẫu nhiên một điểm nằm trong vũng nước (đã co theo độ ướt) cho gợn sóng mưa. */
function randomPointInPuddle(out: THREE.Vector2, shrink: number) {
  const pud = PUDDLES[Math.floor(Math.random() * PUDDLES.length)];
  const r = Math.sqrt(Math.random()) * 0.7 * shrink;
  const a = Math.random() * Math.PI * 2;
  const lx = Math.cos(a) * pud.rx * r;
  const ly = Math.sin(a) * pud.ry * r;
  const c = Math.cos(pud.angle);
  const s = Math.sin(pud.angle);
  return texelToWorld(pud.x + lx * c - ly * s, pud.y + lx * s + ly * c, out);
}

// Hệ số nhân màu nhựa đường: khô thì sáng và xám hơn, ướt giữ màu tối gốc của texture.
const DRY_ROAD_TINT = new THREE.Color(2.2, 2.2, 2.25);
const WET_ROAD_TINT = new THREE.Color(1, 1, 1);
const PUDDLE_NIGHT = new THREE.Color('#0b0c14');
const PUDDLE_DAY = new THREE.Color('#56647a');

export function WetAsphaltRoadDetails() {
  const textures = useMemo(() => createWetRoadTexture(), []);
  const puddleTexture = useMemo(() => createPuddleTexture(), []);
  const streamTexture = useMemo(() => createGutterStreamTexture(), []);
  const streamMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    map: streamTexture,
    color: '#9fb6d8',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }), [streamTexture]);
  const roadMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const puddleMesh = useRef<THREE.Mesh>(null);
  const puddleMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const streamGroup = useRef<THREE.Group>(null);
  const envRef = useRef(getWorldEnvironment(Date.now()));

  useEffect(() => () => {
    textures.map.dispose();
    textures.roughnessMap.dispose();
    puddleTexture.dispose();
    streamTexture.dispose();
    streamMaterial.dispose();
  }, [textures, puddleTexture, streamTexture, streamMaterial]);

  // Tóe nước khắp mặt đường và gợn sóng tròn trong vũng nước, mật độ theo cường độ mưa
  const splashRate = useCallback(() => envRef.current.rainIntensity * 900, []);
  const splashSpawn = useCallback((out: THREE.Vector2) => {
    out.set((Math.random() - 0.5) * (ROAD_WIDTH - 0.4), (Math.random() - 0.5) * (ROAD_LENGTH - 1));
  }, []);
  const rippleRate = useCallback(() => (envRef.current.wetness > 0.25 ? envRef.current.rainIntensity * 70 : 0), []);
  const rippleSpawn = useCallback((out: THREE.Vector2) => {
    randomPointInPuddle(out, 0.4 + 0.6 * envRef.current.wetness);
  }, []);

  useFrame((_, delta) => {
    const env = getWorldEnvironment(Date.now());
    envRef.current = env;
    const { wetness, rainIntensity, daylight } = env;

    // Nhựa đường ướt: tối màu, bóng loáng phản chiếu neon; khô: sáng và nhám
    const road = roadMaterial.current;
    if (road) {
      road.roughness = THREE.MathUtils.lerp(2.4, 0.24, wetness);
      road.metalness = THREE.MathUtils.lerp(0.08, 0.48, wetness);
      road.color.lerpColors(DRY_ROAD_TINT, WET_ROAD_TINT, wetness);
    }

    if (puddleMesh.current && puddleMaterial.current) {
      puddleMesh.current.visible = wetness > 0.02;
      puddleMaterial.current.alphaTest = THREE.MathUtils.lerp(0.97, 0.05, wetness);
      puddleMaterial.current.color.lerpColors(PUDDLE_NIGHT, PUDDLE_DAY, daylight);
    }

    if (streamGroup.current) {
      const flow = wetness * (0.35 + 0.65 * rainIntensity);
      streamGroup.current.visible = flow > 0.02;
      streamMaterial.opacity = flow * 0.5;
      streamTexture.offset.y -= delta * (0.25 + rainIntensity * 0.6);
    }
  });

  return (
    <group name="WetAsphaltRoadDetails" position={[0, 0.006, 0]}>
      {/* Tấm nền phủ mặt đường nhựa chi tiết cao với vạch kẻ, sọc ngựa vằn & nắp cống */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, ROAD_LOCAL_Y, 0]}>
        <planeGeometry args={[ROAD_WIDTH, ROAD_LENGTH]} />
        <meshStandardMaterial
          ref={roadMaterial}
          map={textures.map}
          roughnessMap={textures.roughnessMap}
          roughness={0.24}
          metalness={0.48}
          transparent={true}
          opacity={0.96}
          polygonOffset={true}
          polygonOffsetFactor={-1.5}
          polygonOffsetUnits={-1.5}
        />
      </mesh>

      {/* Lớp vũng nước động: lan rộng khi mưa, co lại khi khô; bóng loáng phản chiếu neon */}
      <mesh ref={puddleMesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, ROAD_LOCAL_Y + 0.001, 0]} renderOrder={1}>
        <planeGeometry args={[ROAD_WIDTH, ROAD_LENGTH]} />
        <meshStandardMaterial
          ref={puddleMaterial}
          alphaMap={puddleTexture}
          color="#0b0c14"
          roughness={0.04}
          metalness={0.7}
          transparent={true}
          depthWrite={false}
          polygonOffset={true}
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>

      {/* Nước chảy thành vệt dọc hai rãnh lề đường */}
      <group ref={streamGroup}>
        {[-1, 1].map(side => (
          <mesh key={side} material={streamMaterial} rotation={[-Math.PI / 2, 0, 0]} position={[side * (ROAD_WIDTH / 2 - 0.22), ROAD_LOCAL_Y + 0.002, 0]} renderOrder={2}>
            <planeGeometry args={[0.32, ROAD_LENGTH]} />
          </mesh>
        ))}
      </group>

      <RainRippleField
        name="RoadRainSplashes"
        capacity={600}
        life={0.28}
        startRadius={0.015}
        endRadius={0.09}
        y={ROAD_LOCAL_Y + 0.003}
        color="#cfe0ff"
        rate={splashRate}
        spawn={splashSpawn}
      />
      <RainRippleField
        name="PuddleRainRipples"
        capacity={140}
        life={0.95}
        startRadius={0.02}
        endRadius={0.24}
        y={ROAD_LOCAL_Y + 0.004}
        color="#e6efff"
        rate={rippleRate}
        spawn={rippleSpawn}
      />
    </group>
  );
}

