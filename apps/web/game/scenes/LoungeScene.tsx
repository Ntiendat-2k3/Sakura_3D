'use client';
import { Billboard, Text, useGLTF } from '@react-three/drei';
import { useEffect, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import { LOUNGE_EXIT, LOUNGE_HOTEL_PORTAL, LOUNGE_NPC_SLOTS } from '@metaverse/game-protocol';
import { LoungeNpc } from '../entities/LoungeNpc';
import type { LoungeNpcId, LoungeNpcMode } from '../systems/loungeNpcMotion';
import { InteractiveEntranceDoor } from '../entities/InteractiveEntranceDoor';
import { InteractiveRoomDoor } from '../entities/InteractiveRoomDoor';

/** Cảnh nội thất Reika Hostess Lounge kèm cầu thang bộ hoàng gia lên tầng 2 Cyber Love Hotel và 3 NPC VRM. */
export function LoungeScene({
  onReady,
  player,
  npcModes,
  companionId,
  children,
  isDoorOpening = false,
  nearHotelStairs = false,
}: {
  onReady: () => void;
  player?: { x: number; z: number };
  npcModes?: Record<LoungeNpcId, LoungeNpcMode>;
  companionId?: LoungeNpcId | null;
  children?: ReactNode;
  isDoorOpening?: boolean;
  nearHotelStairs?: boolean;
}) {
  const { scene } = useGLTF('/assets/buildings/reika-lounge.glb');
  const { gl } = useThree();
  useEffect(() => {
    gl.domElement.dataset.assetStatus = 'ready';
    gl.domElement.dataset.assetSource = 'reika-lounge';
    onReady();
    return () => { delete gl.domElement.dataset.assetStatus; };
  }, [gl, onReady]);

  return <>
    <color attach="background" args={['#0d0612']}/>
    <fog attach="fog" args={['#14091c', 10, 28]}/>
    <ambientLight intensity={.22} color="#ffd9e8"/>
    <hemisphereLight args={['#ffe4c4', '#261029', .38]}/>
    <directionalLight position={[0, 6.5, 3.5]} intensity={.52} color="#ffe3c8"/>
    <pointLight position={[-3.2, 3.4, -1.2]} intensity={8} distance={11} color="#ffbf75"/>
    <pointLight position={[3.2, 3.4, -0.5]} intensity={8} distance={11} color="#ff85b3"/>
    <pointLight position={[0, 3.2, -5.2]} intensity={9} distance={10} color="#ffd28a"/>
    {/* Đèn vòm và chiếu sáng chiếu nghỉ cầu thang bộ tầng 2 */}
    <pointLight position={[5.3, 3.8, 5.2]} intensity={11} distance={9} color="#ff4fa3"/>
    <primitive object={scene} dispose={null}/>
    <Text position={[0, 3.55, -6.68]} fontSize={.48} color="#ffd699" letterSpacing={.12}>REIKA LOUNGE</Text>
    <Text position={[0, 3.05, -6.68]} fontSize={.15} color="#ffb3d9">CHAMPAGNE BAR · HOSTESS · 1F VIP BOOTH</Text>
    {/* Cửa thoát tầng 1 ra phố */}
    <InteractiveEntranceDoor
      id="lounge-exit"
      position={[0, 0.04, 6.45]}
      yaw={Math.PI}
      player={player}
      isInteracting={isDoorOpening && !nearHotelStairs}
      theme="exit"
    />

    {/* Cửa phòng nhỏ riêng tư Room 201 trên chiếu nghỉ tầng 2 */}
    <InteractiveRoomDoor
      id="room-201-door"
      position={[5.3, 2.34, 6.55]}
      yaw={Math.PI}
      player={player}
      isInteracting={isDoorOpening && nearHotelStairs}
    />

    {/* Biển hiệu trên đầu cửa tầng 2 */}
    <Billboard position={[5.3, 4.95, 6.65]}>
      <Text fontSize={0.20} color="#ff66cc" letterSpacing={0.08}>2F · CYBER LOVE HOTEL</Text>
    </Billboard>
    {LOUNGE_NPC_SLOTS.filter(slot => slot.id !== companionId).map(slot => (
      <LoungeNpc
        key={slot.id}
        id={slot.id}
        x={slot.x}
        z={slot.z}
        yaw={slot.yaw}
        roleLabel={slot.role}
        mode={npcModes?.[slot.id] ?? 'idle'}
        player={player}
      />
    ))}
    {children}
  </>;
}

