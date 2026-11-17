'use client';
import { Billboard, Sparkles, Text, useGLTF } from '@react-three/drei';
import { useEffect, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import { HOTEL_EXIT } from '@metaverse/game-protocol';
import { InteractiveEntranceDoor } from '../entities/InteractiveEntranceDoor';

export type HotelMoodId = 'magenta' | 'crimson' | 'violet';

export const HOTEL_MOODS: Record<
  HotelMoodId,
  {
    label: string;
    bg: string;
    fog: string;
    ambient: string;
    bedLight: string;
    jacuzziLight: string;
    barLight: string;
    sparkleColor: string;
  }
> = {
  magenta: {
    label: 'Cyber Magenta · Phố Đèn Đỏ',
    bg: '#09030f',
    fog: '#14051f',
    ambient: '#ff99d6',
    bedLight: '#ff2a9d',
    jacuzziLight: '#1ee8ff',
    barLight: '#ff66cc',
    sparkleColor: '#ff80df',
  },
  crimson: {
    label: 'Crimson Passion · Đêm Nóng Bỏng',
    bg: '#120308',
    fog: '#210510',
    ambient: '#ffb3c6',
    bedLight: '#ff1744',
    jacuzziLight: '#ff77a9',
    barLight: '#ffab40',
    sparkleColor: '#ff6688',
  },
  violet: {
    label: 'Violet Honeymoon · Tím Huyền Ảo',
    bg: '#070414',
    fog: '#120826',
    ambient: '#d9b3ff',
    bedLight: '#9d4edd',
    jacuzziLight: '#00f5d4',
    barLight: '#f15bb5',
    sparkleColor: '#c77dff',
  },
};

/** Cảnh nội thất Cyberpunk Neon Love Hotel 20+ với giường đôi King-size, bồn tắm Jacuzzi phát sáng, Minibar và đổi mood đèn. */
export function HotelScene({
  onReady,
  player,
  mood = 'magenta',
  children,
  isDoorOpening = false,
}: {
  onReady: () => void;
  player?: { x: number; z: number };
  mood?: HotelMoodId;
  children?: ReactNode;
  isDoorOpening?: boolean;
}) {
  const { scene } = useGLTF('/assets/buildings/love-hotel.glb');
  const { gl } = useThree();
  const palette = HOTEL_MOODS[mood];

  useEffect(() => {
    gl.domElement.dataset.assetStatus = 'ready';
    gl.domElement.dataset.assetSource = 'love-hotel';
    onReady();
    return () => {
      delete gl.domElement.dataset.assetStatus;
    };
  }, [gl, onReady]);

  return (
    <>
      <color attach="background" args={[palette.bg]} />
      <fog attach="fog" args={[palette.fog, 9, 25]} />
      <ambientLight intensity={0.26} color={palette.ambient} />
      <hemisphereLight args={[palette.ambient, '#1a0622', 0.42]} />
      <directionalLight position={[0, 5.8, 2.5]} intensity={0.45} color="#ffd6ec" />

      {/* Đèn vòm Neon trên giường đôi King-size */}
      <pointLight position={[0, 3.3, -3.8]} intensity={14} distance={10} color={palette.bedLight} />
      {/* Đèn hắt gương đầu giường */}
      <pointLight position={[0, 2.2, -5.1]} intensity={8} distance={7} color="#ff85c2" />
      {/* Đèn sục nước Aqua-Cyan tại bồn tắm đôi Jacuzzi Spa */}
      <pointLight position={[-4.2, 2.4, -0.8]} intensity={11} distance={9} color={palette.jacuzziLight} />
      {/* Đèn quầy Champagne Minibar & Ghế đôi Loveseat */}
      <pointLight position={[4.2, 2.8, -1.6]} intensity={9} distance={9} color={palette.barLight} />
      <pointLight position={[4.0, 2.5, 2.0]} intensity={7} distance={8} color={palette.bedLight} />

      <primitive object={scene} dispose={null} />

      {/* Hạt bụi ánh sáng lấp lánh trên giường King-size và hơi nước bồn Jacuzzi */}
      <Sparkles
        count={42}
        scale={[4.2, 2.4, 3.2]}
        position={[0, 1.8, -3.8]}
        size={2.2}
        speed={0.25}
        color={palette.sparkleColor}
      />
      <Sparkles
        count={36}
        scale={[2.4, 1.8, 3.0]}
        position={[-4.4, 1.2, -0.8]}
        size={2.5}
        speed={0.4}
        color="#66f7ff"
      />

      {/* Biển hiệu Neon đầu giường & chỉ dẫn tương tác */}
      <Text position={[0, 3.72, -5.68]} fontSize={0.38} color="#ff77c8" letterSpacing={0.1}>
        CYBER LOVE HOTEL · REIKA 2F
      </Text>
      <Text position={[0, 3.32, -5.68]} fontSize={0.14} color="#80f5ff" letterSpacing={0.08}>
        PRIVATE KING SUITE · NEON JACUZZI · CHAMPAGNE BAR
      </Text>

      <Billboard position={[0, 1.55, -2.2]}>
        <Text fontSize={0.14} color="#ffb3e6" outlineWidth={0.01} outlineColor="#1a0624">
          Giường King Velvet · Nhấn Enter để ngồi/tựa đôi
        </Text>
      </Billboard>
      <Billboard position={[-3.6, 1.55, -0.8]}>
        <Text fontSize={0.13} color="#80f8ff" outlineWidth={0.01} outlineColor="#081c24">
          Neon Jacuzzi Spa · Nhấn Enter để ngâm mình
        </Text>
      </Billboard>
      <Billboard position={[4.3, 1.45, 2.0]}>
        <Text fontSize={0.13} color="#ffd1ea" outlineWidth={0.01} outlineColor="#1a0624">
          Sofa Tình Nhân · Nhấn Enter
        </Text>
      </Billboard>

      {/* Cửa 3D ra chiếu nghỉ tầng 2 Reika Lounge */}
      <InteractiveEntranceDoor
        id="hotel-exit"
        position={[0, 0.04, 5.45]}
        yaw={Math.PI}
        player={player}
        isInteracting={isDoorOpening}
        theme="exit"
      />
      {children}
    </>
  );
}
