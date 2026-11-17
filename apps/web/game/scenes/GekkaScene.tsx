'use client';
import { useThree } from '@react-three/fiber';
import { useEffect, type ReactNode } from 'react';
import { GEKKA_EXIT, type PokerTableView, type PositionSnapshot } from '@metaverse/game-protocol';
import { InteractiveEntranceDoor } from '../entities/InteractiveEntranceDoor';
import { GekkaPokerTable } from '../entities/GekkaPokerTable';
import { GekkaBarmaid, GekkaDealer, GekkaExecutioner, GekkaHostess } from '../entities/GekkaStaff';
import type { GekkaPunchCue } from '../systems/useGekkaPunchCue';
import { GekkaSalon } from './GekkaSalon';
import { GekkaDungeon } from './GekkaDungeon';

const NO_PUNCH: GekkaPunchCue = { punchAt: null, final: false };

/**
 * Cảnh 月華楼 Gekkarō: tầng trên là salon poker Taishō, hầm (y = GEKKA_BASEMENT_Y) là nơi trói người thua sạch.
 * Tòa nhà dựng bằng khối + texture vẽ canvas (chưa có gekka-casino.glb); nhân sự là VRM thật: bà chủ Aos,
 * dealer Tsukimi, đao phủ Onizuka, cô phục vụ Rina.
 */
export function GekkaScene({ onReady, player, children, isDoorOpening = false, poker, names, players, punch = NO_PUNCH }: {
  onReady: () => void;
  player?: { x: number; y?: number; z: number };
  children?: ReactNode;
  isDoorOpening?: boolean;
  poker?: PokerTableView;
  names?: Record<string, string>;
  players?: Record<string, PositionSnapshot>;
  punch?: GekkaPunchCue;
}) {
  const { gl } = useThree();

  useEffect(() => {
    gl.domElement.dataset.assetStatus = 'ready';
    gl.domElement.dataset.assetSource = 'gekka-procedural';
    onReady();
    return () => { delete gl.domElement.dataset.assetStatus; };
  }, [gl, onReady]);

  return (
    <>
      <color attach="background" args={['#0b0705']} />
      <fog attach="fog" args={['#120a06', 14, 38]} />
      <ambientLight intensity={0.2} color="#ffe2c0" />
      <hemisphereLight args={['#ffe0b0', '#1a0d05', 0.38]} />
      {/* Hai đèn phủ thay bốn: mỗi point light cộng thêm chi phí tô cho mọi pixel của VRM và khối gỗ. */}
      {[[0, -4.6], [0, 3.8]].map(([x, z]) => (
        <pointLight key={`${x},${z}`} position={[x, 3.4, z]} intensity={9} distance={9.5} color="#ffc983" />
      ))}
      <GekkaSalon />
      <GekkaDungeon dungeon={poker?.dungeon} />
      <InteractiveEntranceDoor
        id="gekka-exit"
        position={[GEKKA_EXIT.x, 0.04, 7.3]}
        yaw={Math.PI}
        player={player}
        isInteracting={isDoorOpening}
        theme="traditional"
      />
      {poker && <>
        <GekkaHostess where="salon" table={poker} players={players} />
        <GekkaDealer table={poker} names={names} />
        <GekkaExecutioner table={poker} punch={punch} />
        <GekkaBarmaid player={player} showdown={poker.phase === 'showdown'} />
        <GekkaPokerTable table={poker} names={names} />
      </>}
      {children}
    </>
  );
}
