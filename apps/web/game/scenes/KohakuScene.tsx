'use client';
import { Text, useGLTF } from '@react-three/drei';
import { useEffect, useRef, type ReactNode } from 'react';
import type { Group } from 'three';
import { BluffStagingLights } from '../entities/BluffStagingLights';
import { useThree } from '@react-three/fiber';
import { KOHAKU_EXIT, KOHAKU_SEATS, type BluffTableView } from '@metaverse/game-protocol';
import { KohakuNpc } from '../entities/KohakuNpc';
import { npcFocus, useBangAge } from '../systems/kohakuNpcFocus';
import { KohakuBluffTable } from '../entities/KohakuBluffTable';
import type { HinataActionMode, KohakuNpcId } from '../systems/kohakuNpcMotion';
import { InteractiveEntranceDoor } from '../entities/InteractiveEntranceDoor';
import { PooledPointLights } from '../systems/PooledPointLights';
import { KOHAKU_LIGHT_POOL_SIZE, type LightPreset } from '../systems/lightPool';
import kohakuLights from './kohaku-lights.json';

/**
 * Cảnh nội thất Câu Lạc Bộ Thượng Lưu 琥珀 (Kohaku Private Members Club) 3 Tầng:
 * - Tầng 1 (y = 0.0m): Bàn tròn Poker / Casino nỉ xanh ngọc bích cho 4 người chơi + NPC Dealer, quầy Whisky Bar & sofa Chesterfield.
 * - Tầng 2 (y = 3.6m): Hành lang ban công ngắm giếng trời trung tâm qua cầu thang cánh phải.
 * - Tầng 3 (y = 7.2m): Sảnh thượng tầng Penthouse VIP Sky Floor qua cầu thang cánh trái.
 */
export function KohakuScene({
  onReady,
  player,
  children,
  isDoorOpening = false,
  dealerSeated = false,
  nearNpc = null,
  hinataMode = 'idle',
  hinataActionKey = 0,
  bluff,
  names,
}: {
  onReady: () => void;
  player?: { x: number; y?: number; z: number };
  children?: ReactNode;
  isDoorOpening?: boolean;
  dealerSeated?: boolean;
  nearNpc?: KohakuNpcId | null;
  hinataMode?: HinataActionMode;
  hinataActionKey?: number;
  bluff?: BluffTableView;
  names?: Record<string, string>;
}) {
  const { scene } = useGLTF('/assets/buildings/kohaku-club.glb');
  const bangAge = useBangAge(bluff);
  const roomLights = useRef<Group>(null);
  const focusOf = (id: KohakuNpcId) => (bluff ? npcFocus(id, bluff, bangAge) : null);
  const { gl } = useThree();

  useEffect(() => {
    gl.domElement.dataset.assetStatus = 'ready';
    gl.domElement.dataset.assetSource = 'kohaku-club';
    onReady();
    return () => {
      delete gl.domElement.dataset.assetStatus;
    };
  }, [gl, onReady]);

  return (
    <>
      {/* Màu nền không gian nâu đen hổ phách tối quý phái */}
      <color attach="background" args={['#0a0604']} />
      <fog attach="fog" args={['#130905', 14, 42]} />

      {/* Mọi đèn phòng nằm trong group để BluffStagingLights hạ độ sáng lúc bóp cò. */}
      <group ref={roomLights}>
      {/* Ánh sáng tổng thể vàng ấm hổ phách thông suốt 3 tầng */}
      <ambientLight intensity={0.22} color="#ffe5c4" />
      <hemisphereLight args={['#ffe4b5', '#1a0d05', 0.45]} />
      <directionalLight position={[0, 10.5, 4.5]} intensity={0.48} color="#ffe6cc" />

      {/* Đèn điểm 3 tầng (kohaku-lights.json): chỉ KOHAKU_LIGHT_POOL_SIZE đèn bám theo người chơi để giảm chi phí shader mỗi pixel. */}
      <PooledPointLights presets={kohakuLights as LightPreset[]} count={KOHAKU_LIGHT_POOL_SIZE} player={player} />
      </group>
      {bluff && <BluffStagingLights table={bluff} roomLights={roomLights} />}

      {/* Render toàn bộ mô hình 3D Kohaku Club 3 tầng đã tạo từ Blender */}
      <primitive object={scene} dispose={null} />

      {/* Biển hiệu chữ nổi mạ vàng Tầng 1 nằm gọn chính giữa vách gỗ gia huy */}
      <Text position={[0, 2.35, -7.12]} fontSize={0.34} color="#f5d485" letterSpacing={0.12}>
        琥珀 · KOHAKU
      </Text>
      <Text position={[0, 1.92, -7.12]} fontSize={0.10} color="#d8b068" letterSpacing={0.08}>
        PRIVATE MEMBERS CLUB · 1F CASINO
      </Text>

      {/* Biển hiệu gắn cố định phía trên tủ rượu Whisky */}
      <Text
        position={[-7.08, 3.72, -0.9]}
        rotation={[0, Math.PI / 2, 0]}
        fontSize={0.16}
        color="#f5d485"
        letterSpacing={0.06}
      >
        WHISKY & CIGAR RESERVE
      </Text>

      {/* Biển chỉ dẫn gắn gọn trên vách tường bên cạnh cầu thang 1 -> 2 (không trôi lơ lửng giữa lối đi) */}
      <Text
        position={[7.22, 2.75, -1.6]}
        rotation={[0, -Math.PI / 2, 0]}
        fontSize={0.15}
        color="#f5d485"
        letterSpacing={0.06}
      >
        2F & 3F STAIRS ↑
      </Text>

      {/* Biển hiệu Tầng 2 đặt cao trên tường sau, không bị bậc thang che */}
      <Text position={[-1.0, 6.25, -7.22]} fontSize={0.25} color="#f5d485" letterSpacing={0.10}>
        2F · BALCONY GALLERY
      </Text>
      <Text
        position={[-7.22, 6.1, -1.6]}
        rotation={[0, Math.PI / 2, 0]}
        fontSize={0.15}
        color="#f5d485"
        letterSpacing={0.06}
      >
        3F PENTHOUSE STAIRS ↑
      </Text>

      {/* Biển hiệu Tầng 3 gắn gọn trên vách trước */}
      <Text position={[0, 9.65, 7.22]} rotation={[0, Math.PI, 0]} fontSize={0.26} color="#f5d485" letterSpacing={0.10}>
        3F · PENTHOUSE SKY VIP
      </Text>

      {/* Chữ thêu vàng kim phẳng nằm trực tiếp trên mặt nỉ xanh bàn Poker (không che người/ghế) */}
      <Text
        position={[0, 0.962, -0.58]}
        rotation={[-Math.PI / 2, 0, Math.PI]}
        fontSize={0.075}
        color="#f0cb70"
        letterSpacing={0.12}
      >
        DEALER
      </Text>
      {KOHAKU_SEATS.filter(s => s.id.startsWith('kohaku-player-')).map((seat, index) => (
        <group key={seat.id} position={[seat.x * 0.54, 0.962, seat.z * 0.54]} rotation={[0, seat.yaw + Math.PI, 0]}>
          <Text rotation={[-Math.PI / 2, 0, 0]} fontSize={0.075} color="#d6f5de" letterSpacing={0.08}>
            {`SEAT ${index + 1}`}
          </Text>
        </group>
      ))}

      {/* Cửa gỗ cổ điển thoát hiểm/ra ngoài phố Sakura */}
      <InteractiveEntranceDoor
        id="kohaku-exit"
        position={[KOHAKU_EXIT.x, 0.04, KOHAKU_EXIT.z]}
        yaw={Math.PI}
        player={player}
        isInteracting={isDoorOpening}
        theme="traditional"
      />

      <KohakuNpc id="shinku" player={player} dealerSeated={dealerSeated} nearPlayer={nearNpc === 'shinku'} focus={focusOf('shinku')} />
      <KohakuNpc id="hinata" player={player} nearPlayer={nearNpc === 'hinata'} hinataMode={hinataMode} hinataActionKey={hinataActionKey} focus={focusOf('hinata')} />
      <KohakuNpc id="bartender" player={player} nearPlayer={nearNpc === 'bartender'} focus={focusOf('bartender')} />
      {bluff && <KohakuBluffTable table={bluff} names={names} />}
      {children}
    </>
  );
}

