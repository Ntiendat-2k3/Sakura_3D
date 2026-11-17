'use client';

// Chu kỳ ngày/đêm của phố Sakura theo đồng hồ thế giới chung (30 phút ngày, 30 phút đêm):
// nội suy màu trời, sương mù, ánh sáng môi trường, mặt trời và sao; trời mưa thì u ám, sương dày hơn.
// Đây là nơi duy nhất điều khiển nền trời và sương mù của cảnh Sakura.
import { Stars } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getWorldEnvironment } from './worldClock';

type SkyLook = {
  top: string; horizon: string; fog: string; fogNear: number; fogFar: number;
  ambient: string; ambientIntensity: number;
  hemiSky: string; hemiGround: string; hemiIntensity: number;
  sun: string; sunIntensity: number;
};

// Đêm giữ đúng tông neon u ám ban đầu của phố; ngày trời trong; hai bảng "mưa" thay thế khi mưa to.
const NIGHT: SkyLook = {
  top: '#020105', horizon: '#100e26', fog: '#070512', fogNear: 18, fogFar: 55,
  ambient: '#1d1730', ambientIntensity: 0.16,
  hemiSky: '#52427a', hemiGround: '#160e28', hemiIntensity: 0.42,
  sun: '#b8d2ff', sunIntensity: 0.58,
};
const DAY: SkyLook = {
  top: '#4f8fd9', horizon: '#cfe3f7', fog: '#b7cde6', fogNear: 35, fogFar: 120,
  ambient: '#e8eeff', ambientIntensity: 0.55,
  hemiSky: '#cfe2ff', hemiGround: '#7a6a5c', hemiIntensity: 1.05,
  sun: '#fff1d8', sunIntensity: 2.4,
};
const NIGHT_RAIN: SkyLook = {
  ...NIGHT, top: '#020104', horizon: '#0b0a14', fog: '#040208', fogNear: 10, fogFar: 38, sunIntensity: 0.4,
};
const DAY_RAIN: SkyLook = {
  top: '#5d6673', horizon: '#8f98a4', fog: '#8a93a0', fogNear: 12, fogFar: 50,
  ambient: '#c9d0da', ambientIntensity: 0.7,
  hemiSky: '#aeb7c4', hemiGround: '#4c4a4c', hemiIntensity: 0.85,
  sun: '#dfe6f0', sunIntensity: 0.8,
};
/** Chân trời cam hồng lúc bình minh/hoàng hôn. */
const TWILIGHT_HORIZON = new THREE.Color('#ff9466');
const TWILIGHT_TOP = new THREE.Color('#3b4f8f');

const SKY_RADIUS = 150;
/** Quỹ đạo mặt trời: mọc phía -X, lặn phía +X, lệch về -Z (mặt trăng ở +Z). */
const SUN_ORBIT = { x: 90, y: 70, z: -40 };
const NIGHT_LIGHT_POSITION = new THREE.Vector3(-5, 18, 8);

type LookColors = Record<'top' | 'horizon' | 'fog' | 'ambient' | 'hemiSky' | 'hemiGround' | 'sun', THREE.Color>;
const toColors = (look: SkyLook): LookColors => ({
  top: new THREE.Color(look.top), horizon: new THREE.Color(look.horizon), fog: new THREE.Color(look.fog),
  ambient: new THREE.Color(look.ambient), hemiSky: new THREE.Color(look.hemiSky), hemiGround: new THREE.Color(look.hemiGround),
  sun: new THREE.Color(look.sun),
});
const LOOK_COLORS = { night: toColors(NIGHT), day: toColors(DAY), nightRain: toColors(NIGHT_RAIN), dayRain: toColors(DAY_RAIN) };
const COLOR_KEYS = Object.keys(LOOK_COLORS.night) as (keyof LookColors)[];

export function DayNightSystem() {
  const background = useRef<THREE.Color>(null);
  const fog = useRef<THREE.Fog>(null);
  const ambient = useRef<THREE.AmbientLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sunLight = useRef<THREE.DirectionalLight>(null);
  const sunDisc = useRef<THREE.Mesh>(null);
  const stars = useRef<THREE.Group>(null);

  const skyGeometry = useMemo(() => {
    const geometry = new THREE.SphereGeometry(SKY_RADIUS, 32, 16);
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 3), 3));
    return geometry;
  }, []);
  const scratch = useMemo(() => ({
    clear: toColors(NIGHT), rain: toColors(NIGHT), mix: toColors(NIGHT), vertex: new THREE.Color(),
  }), []);

  useEffect(() => () => skyGeometry.dispose(), [skyGeometry]);

  useFrame(() => {
    const { daylight, rainIntensity, sunElevation, dayPhase } = getWorldEnvironment(Date.now());
    const { clear, rain, mix } = scratch;
    const rainWeight = rainIntensity * 0.85;
    for (const key of COLOR_KEYS) {
      clear[key].lerpColors(LOOK_COLORS.night[key], LOOK_COLORS.day[key], daylight);
      rain[key].lerpColors(LOOK_COLORS.nightRain[key], LOOK_COLORS.dayRain[key], daylight);
      mix[key].lerpColors(clear[key], rain[key], rainWeight);
    }
    const lerpLook = (pick: (look: SkyLook) => number) => {
      const clearValue = THREE.MathUtils.lerp(pick(NIGHT), pick(DAY), daylight);
      return THREE.MathUtils.lerp(clearValue, THREE.MathUtils.lerp(pick(NIGHT_RAIN), pick(DAY_RAIN), daylight), rainWeight);
    };

    // Ráng chiều mạnh nhất đúng lúc nửa sáng nửa tối, bị mây mưa che bớt
    const twilight = (1 - Math.abs(2 * daylight - 1)) * (1 - rainIntensity * 0.7);
    mix.horizon.lerp(TWILIGHT_HORIZON, twilight * 0.75);
    mix.top.lerp(TWILIGHT_TOP, twilight * 0.4);
    mix.fog.lerp(TWILIGHT_HORIZON, twilight * 0.25);

    // Vòm trời: gradient từ chân trời lên đỉnh, ghi vào màu đỉnh của khối cầu
    const position = skyGeometry.attributes.position;
    const colors = skyGeometry.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i++) {
      const t = Math.pow(Math.max(0, position.getY(i) / SKY_RADIUS), 0.6);
      scratch.vertex.lerpColors(mix.horizon, mix.top, t);
      colors.setXYZ(i, scratch.vertex.r, scratch.vertex.g, scratch.vertex.b);
    }
    colors.needsUpdate = true;

    background.current?.copy(mix.horizon);
    if (fog.current) {
      fog.current.color.copy(mix.fog);
      fog.current.near = lerpLook(look => look.fogNear);
      fog.current.far = lerpLook(look => look.fogFar);
    }
    if (ambient.current) {
      ambient.current.color.copy(mix.ambient);
      ambient.current.intensity = lerpLook(look => look.ambientIntensity);
    }
    if (hemi.current) {
      hemi.current.color.copy(mix.hemiSky);
      hemi.current.groundColor.copy(mix.hemiGround);
      hemi.current.intensity = lerpLook(look => look.hemiIntensity);
    }

    // Mặt trời chạy theo cung trời ban ngày; ban đêm đèn định hướng quay về vị trí ánh trăng dịu ban đầu
    const angle = dayPhase * Math.PI * 2;
    const sunX = -Math.cos(angle) * SUN_ORBIT.x;
    const sunY = Math.max(sunElevation, 0.15) * SUN_ORBIT.y;
    if (sunLight.current) {
      sunLight.current.color.copy(mix.sun);
      sunLight.current.intensity = lerpLook(look => look.sunIntensity);
      sunLight.current.position.set(sunX, sunY, SUN_ORBIT.z).lerp(NIGHT_LIGHT_POSITION, 1 - daylight);
    }
    if (sunDisc.current) {
      sunDisc.current.visible = sunElevation > -0.05 && rainIntensity < 0.6;
      sunDisc.current.position.set(sunX * 1.2, sunElevation * SUN_ORBIT.y * 1.2, SUN_ORBIT.z * 1.2);
      sunDisc.current.lookAt(0, 0, 0);
    }
    if (stars.current) stars.current.visible = daylight < 0.35 && rainIntensity < 0.5;
  });

  return <>
    <color ref={background} attach="background" args={[NIGHT.horizon]}/>
    <fog ref={fog} attach="fog" args={[NIGHT.fog, NIGHT.fogNear, NIGHT.fogFar]}/>
    <ambientLight ref={ambient} intensity={NIGHT.ambientIntensity} color={NIGHT.ambient}/>
    <hemisphereLight ref={hemi} color={NIGHT.hemiSky} groundColor={NIGHT.hemiGround} intensity={NIGHT.hemiIntensity}/>
    <directionalLight ref={sunLight} position={NIGHT_LIGHT_POSITION.toArray()} color={NIGHT.sun} intensity={NIGHT.sunIntensity}/>

    {/* Vòm trời gradient (không bị sương mù che) vẽ trước mọi thứ */}
    <mesh geometry={skyGeometry} renderOrder={-10}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} depthWrite={false}/>
    </mesh>

    {/* Đĩa mặt trời sáng rực (bloom bắt sáng) */}
    <mesh ref={sunDisc} renderOrder={-9}>
      <circleGeometry args={[5, 32]}/>
      <meshBasicMaterial color="#fff6e0" fog={false} depthWrite={false} toneMapped={false}/>
    </mesh>

    <group ref={stars}>
      <Stars radius={80} depth={20} count={260} factor={1.4} fade/>
    </group>
  </>;
}
