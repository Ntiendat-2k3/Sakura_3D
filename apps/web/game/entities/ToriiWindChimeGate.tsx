'use client';

// Cổng Torii Huyết Nguyệt ở cuối đại lộ hướng Mặt Trăng Máu (+Z), trang trí dàn chuông gió (Fuurin) đung đưa và phát âm thanh khi người chơi đến gần.
import { Billboard, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import type { PositionSnapshot } from '@metaverse/game-protocol';

/** Đường dẫn file âm thanh chuông gió để người dùng có thể thay thế bất kỳ lúc nào */
export const WIND_CHIME_AUDIO_URL = '/assets/audio/street/wind-chime.mp3';

/** Khoảng cách tối đa (m) từ cổng Torii để kích hoạt tiếng chuông gió kêu */
const CHIME_TRIGGER_RADIUS = 8.5;

/** Tần số âm giai ngũ cung Nhật Bản (In-sen / Hirajoshi) cho tiếng chuông gió thủy tinh Fuurin dự phòng khi chưa có file mp3 */
const FUURIN_FREQUENCIES = [1046.5, 1174.66, 1318.51, 1567.98, 1760.0, 2093.0, 2349.32, 2637.02];

/** Phát một nốt chuông gió thủy tinh (Fuurin) trong trẻo bằng Web Audio API khi chưa cung cấp file âm thanh ngoài */
function playProceduralWindChime(ctx: AudioContext, gainScale: number) {
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => undefined);
  }
  const now = ctx.currentTime;
  const noteCount = Math.random() > 0.45 ? 2 : 1;

  for (let i = 0; i < noteCount; i++) {
    const startTime = now + i * (0.09 + Math.random() * 0.08);
    const freq = FUURIN_FREQUENCIES[Math.floor(Math.random() * FUURIN_FREQUENCIES.length)];

    // Âm cơ bản + họa âm thủy tinh bậc cao của chuông gió Fuurin
    const oscMain = ctx.createOscillator();
    const oscOvertone = ctx.createOscillator();
    const gain = ctx.createGain();

    oscMain.type = 'sine';
    oscMain.frequency.setValueAtTime(freq, startTime);

    oscOvertone.type = 'sine';
    oscOvertone.frequency.setValueAtTime(freq * 2.756, startTime);

    const peakGain = Math.min(0.18, Math.max(0.02, 0.14 * gainScale));
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.45);

    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(peakGain * 0.35, startTime);
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.45);

    oscMain.connect(gain);
    oscOvertone.connect(overtoneGain);
    overtoneGain.connect(gain);
    gain.connect(ctx.destination);

    oscMain.start(startTime);
    oscOvertone.start(startTime);
    oscMain.stop(startTime + 1.5);
    oscOvertone.stop(startTime + 0.5);
  }
}

type ChimeSpec = {
  x: number;
  y: number;
  z: number;
  bellColor: string;
  stripColor: string;
  phase: number;
};

const CHIME_SPECS: ChimeSpec[] = [
  { x: -3.1, y: 4.55, z: 0.18, bellColor: '#88f2ff', stripColor: '#ff7eb6', phase: 0.2 },
  { x: -2.05, y: 4.55, z: 0.18, bellColor: '#ffa6d2', stripColor: '#fff0f6', phase: 1.1 },
  { x: -1.05, y: 4.55, z: 0.18, bellColor: '#9efcff', stripColor: '#ff5992', phase: 2.3 },
  { x: 1.05, y: 4.55, z: 0.18, bellColor: '#ffa6d2', stripColor: '#fff0f6', phase: 3.4 },
  { x: 2.05, y: 4.55, z: 0.18, bellColor: '#88f2ff', stripColor: '#ff7eb6', phase: 4.5 },
  { x: 3.1, y: 4.55, z: 0.18, bellColor: '#9efcff', stripColor: '#ff5992', phase: 5.6 },
];

export function ToriiWindChimeGate({
  position = [0, 0, 18.5],
  player,
  avatarRef,
}: {
  position?: [number, number, number];
  player?: PositionSnapshot;
  avatarRef?: RefObject<THREE.Group | null>;
}) {
  const chimeRefs = useRef<Array<THREE.Group | null>>([]);
  const stripRefs = useRef<Array<THREE.Mesh | null>>([]);
  const glowLightRef = useRef<THREE.PointLight>(null);

  // Quản lý âm thanh chuông gió (ưu tiên file mp3 nếu người dùng đã bỏ vào, tự động fallback sang synthesizer)
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const customAudioAvailableRef = useRef<boolean | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastRingTimeRef = useRef<number>(0);
  const isNearRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
    const audio = new Audio(WIND_CHIME_AUDIO_URL);
    audio.loop = true;
    audio.volume = 0;
    audio.preload = 'auto';

    const handleCanPlay = () => {
      customAudioAvailableRef.current = true;
    };
    const handleError = () => {
      customAudioAvailableRef.current = false;
    };

    audio.addEventListener('canplaythrough', handleCanPlay);
    audio.addEventListener('error', handleError);
    audioElRef.current = audio;

    return () => {
      audio.removeEventListener('canplaythrough', handleCanPlay);
      audio.removeEventListener('error', handleError);
      audio.pause();
      audioElRef.current = null;
      if (audioCtxRef.current) {
        void audioCtxRef.current.close().catch(() => undefined);
        audioCtxRef.current = null;
      }
    };
  }, []);

  const materials = useMemo(() => {
    return {
      vermilion: new THREE.MeshStandardMaterial({
        color: '#d91b2e',
        emissive: '#3d040b',
        emissiveIntensity: 0.45,
        roughness: 0.32,
        metalness: 0.18,
      }),
      obsidian: new THREE.MeshStandardMaterial({
        color: '#14101c',
        roughness: 0.4,
        metalness: 0.65,
      }),
      goldNeon: new THREE.MeshStandardMaterial({
        color: '#ffd166',
        emissive: '#ffaa2b',
        emissiveIntensity: 2.2,
        toneMapped: false,
      }),
      crimsonNeon: new THREE.MeshStandardMaterial({
        color: '#ff2e63',
        emissive: '#ff1e56',
        emissiveIntensity: 2.8,
        toneMapped: false,
      }),
    };
  }, []);

  useEffect(() => {
    return () => {
      Object.values(materials).forEach(m => m.dispose());
    };
  }, [materials]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    // Tính khoảng cách từ nhân vật tới cổng Torii
    let px = player?.x ?? 0;
    let pz = player?.z ?? 0;
    if (avatarRef?.current) {
      px = avatarRef.current.position.x;
      pz = avatarRef.current.position.z;
    }
    const dist = Math.hypot(px - position[0], pz - position[2]);
    const nearFactor = THREE.MathUtils.clamp(1 - dist / CHIME_TRIGGER_RADIUS, 0, 1);
    isNearRef.current = nearFactor > 0.02;

    // Đung đưa chuông gió Fuurin và thẻ giấy ước nguyện Tanzaku (càng đến gần gió càng rung sinh động)
    const windBoost = 1 + nearFactor * 1.15;
    CHIME_SPECS.forEach((spec, idx) => {
      const group = chimeRefs.current[idx];
      if (group) {
        const swingZ = (Math.sin(t * 2.8 + spec.phase) * 0.16 + Math.sin(t * 5.2 + spec.phase) * 0.05) * windBoost;
        const swingX = Math.cos(t * 2.1 + spec.phase * 0.7) * 0.09 * windBoost;
        group.rotation.set(swingX, Math.sin(t * 1.3 + spec.phase) * 0.25, swingZ);
      }
      const strip = stripRefs.current[idx];
      if (strip) {
        strip.rotation.z = Math.sin(t * 4.6 + spec.phase + 0.8) * 0.28 * windBoost;
        strip.rotation.y = Math.cos(t * 3.1 + spec.phase) * 0.35;
      }
    });

    if (glowLightRef.current) {
      glowLightRef.current.intensity = 6 + nearFactor * 6 + Math.sin(t * 2.5) * 1.5;
    }

    // Xử lý phát âm thanh chuông gió khi người chơi đến gần
    const audioEl = audioElRef.current;
    if (nearFactor > 0.02) {
      if (customAudioAvailableRef.current && audioEl) {
        audioEl.volume = Math.min(0.85, nearFactor * 0.85);
        if (audioEl.paused) {
          void audioEl.play().catch(() => {
            customAudioAvailableRef.current = false;
          });
        }
      } else if (typeof window !== 'undefined') {
        // Phát tiếng chuông gió thủy tinh leng keng theo nhịp gió khi đến gần
        const interval = THREE.MathUtils.lerp(1.6, 0.65, nearFactor);
        if (t - lastRingTimeRef.current > interval) {
          lastRingTimeRef.current = t;
          const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (AudioCtx) {
            if (!audioCtxRef.current) {
              audioCtxRef.current = new AudioCtx();
            }
            playProceduralWindChime(audioCtxRef.current, nearFactor);
          }
        }
      }
    } else if (audioEl && !audioEl.paused) {
      audioEl.volume = 0;
      audioEl.pause();
    }
  });

  return (
    <group name="ToriiWindChimeGate" position={position}>
      {/* Chân đế đá & Bọc chân cột đen (Nemaki) */}
      {[-3.9, 3.9].map((x, idx) => (
        <group key={`pillar-${idx}`} position={[x, 0, 0]}>
          {/* Đế đá bát giác */}
          <mesh position={[0, 0.2, 0]} material={materials.obsidian}>
            <cylinderGeometry args={[0.52, 0.62, 0.4, 8]} />
          </mesh>
          {/* Chân cột bọc đen Nemaki */}
          <mesh position={[0, 0.95, 0]} material={materials.obsidian}>
            <cylinderGeometry args={[0.37, 0.4, 1.5, 16]} />
          </mesh>
          {/* Thân cột trụ chính màu đỏ son (Hashira) */}
          <mesh position={[0, 3.4, 0]} material={materials.vermilion}>
            <cylinderGeometry args={[0.31, 0.35, 5.6, 16]} />
          </mesh>
          {/* Vòng neon vàng trang trí thân cột */}
          <mesh position={[0, 1.72, 0]} material={materials.goldNeon}>
            <cylinderGeometry args={[0.38, 0.38, 0.06, 16]} />
          </mesh>
          <mesh position={[0, 4.45, 0]} material={materials.crimsonNeon}>
            <cylinderGeometry args={[0.34, 0.34, 0.06, 16]} />
          </mesh>
        </group>
      ))}

      {/* Xà ngang dưới (Nuki) xuyên qua 2 cột */}
      <mesh position={[0, 4.7, 0]} material={materials.vermilion}>
        <boxGeometry args={[9.8, 0.34, 0.38]} />
      </mesh>
      {/* Viền neon mảnh dưới xà Nuki */}
      <mesh position={[0, 4.51, 0]} material={materials.crimsonNeon}>
        <boxGeometry args={[9.4, 0.04, 0.4]} />
      </mesh>

      {/* Xà đỡ trên (Shimaki) */}
      <mesh position={[0, 5.85, 0]} material={materials.obsidian}>
        <boxGeometry args={[10.4, 0.28, 0.48]} />
      </mesh>

      {/* Mái xà cong trên cùng (Kasagi) */}
      <mesh position={[0, 6.18, 0]} material={materials.vermilion}>
        <boxGeometry args={[11.2, 0.42, 0.64]} />
      </mesh>
      {/* Hai đầu mái Kasagi vểnh nhẹ kiểu truyền thống Nhật Bản */}
      <mesh position={[-5.75, 6.32, 0]} rotation={[0, 0, 0.18]} material={materials.vermilion}>
        <boxGeometry args={[1.1, 0.38, 0.64]} />
      </mesh>
      <mesh position={[5.75, 6.32, 0]} rotation={[0, 0, -0.18]} material={materials.vermilion}>
        <boxGeometry args={[1.1, 0.38, 0.64]} />
      </mesh>
      {/* Viền neon rực sáng trên đỉnh cổng Torii */}
      <mesh position={[0, 6.41, 0]} material={materials.goldNeon}>
        <boxGeometry args={[11.4, 0.05, 0.66]} />
      </mesh>

      {/* Trụ đỡ trung tâm (Gakuzuka) & Biển ngạch thần đạo */}
      <mesh position={[0, 5.3, 0]} material={materials.vermilion}>
        <boxGeometry args={[0.38, 1.0, 0.32]} />
      </mesh>
      <mesh position={[0, 5.32, -0.2]} material={materials.obsidian}>
        <boxGeometry args={[1.55, 0.88, 0.12]} />
      </mesh>
      <mesh position={[0, 5.32, -0.27]} material={materials.goldNeon}>
        <boxGeometry args={[1.62, 0.94, 0.02]} />
      </mesh>
      <Billboard position={[0, 5.32, -0.35]}>
        <Text fontSize={0.32} color="#fff2b2" outlineWidth={0.02} outlineColor="#3b0510">
          紅月鳥居
        </Text>
      </Billboard>

      {/* Dàn 6 Chuông gió Thủy tinh (Fuurin) treo dọc xà ngang cổng Torii */}
      {CHIME_SPECS.map((spec, idx) => (
        <group
          key={`chime-${idx}`}
          position={[spec.x, spec.y, spec.z]}
          ref={el => { chimeRefs.current[idx] = el; }}
        >
          {/* Dây treo chuông gió */}
          <mesh position={[0, -0.12, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.24, 6]} />
            <meshBasicMaterial color="#ffd166" />
          </mesh>
          {/* Bầu chuông thủy tinh Fuurin */}
          <mesh position={[0, -0.28, 0]}>
            <sphereGeometry args={[0.13, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.78]} />
            <meshStandardMaterial
              color={spec.bellColor}
              emissive={spec.bellColor}
              emissiveIntensity={1.35}
              transparent
              opacity={0.82}
              roughness={0.1}
              metalness={0.1}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Quả lắc bên trong chuông (Zetsu) */}
          <mesh position={[0, -0.33, 0]}>
            <sphereGeometry args={[0.032, 8, 8]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffd166" emissiveIntensity={1.5} />
          </mesh>
          {/* Dây nối xuống thẻ giấy ước nguyện */}
          <mesh position={[0, -0.48, 0]}>
            <cylinderGeometry args={[0.005, 0.005, 0.28, 4]} />
            <meshBasicMaterial color="#ffccd5" />
          </mesh>
          {/* Thẻ giấy ước nguyện (Tanzaku) đung đưa đón gió */}
          <mesh
            ref={el => { stripRefs.current[idx] = el; }}
            position={[0, -0.78, 0]}
          >
            <planeGeometry args={[0.11, 0.42]} />
            <meshStandardMaterial
              color={spec.stripColor}
              emissive={spec.stripColor}
              emissiveIntensity={1.6}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {/* Đèn lồng đá (Toro) hai bên chân cổng Torii */}
      {[-5.1, 5.1].map((x, idx) => (
        <group key={`toro-${idx}`} position={[x, 0, -0.6]}>
          <mesh position={[0, 0.55, 0]} material={materials.obsidian}>
            <cylinderGeometry args={[0.22, 0.3, 1.1, 6]} />
          </mesh>
          <mesh position={[0, 1.25, 0]}>
            <boxGeometry args={[0.38, 0.38, 0.38]} />
            <meshStandardMaterial color="#ff5d8f" emissive="#ff2a6d" emissiveIntensity={2.4} toneMapped={false} />
          </mesh>
          <mesh position={[0, 1.55, 0]} material={materials.obsidian}>
            <coneGeometry args={[0.45, 0.28, 6]} />
          </mesh>
        </group>
      ))}

      {/* Nguồn sáng huyền ảo từ cổng Torii */}
      <pointLight
        ref={glowLightRef}
        position={[0, 4.2, -0.5]}
        color="#ff3864"
        intensity={20}
        distance={16}
        decay={2}
      />
    </group>
  );
}
