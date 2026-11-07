'use client';
import { Billboard, Text, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { DEFAULT_CLUB_SHOW, DEFAULT_PLAYER_CHARACTER, isPlayerCharacterId, PLAYER_CHARACTERS, type ClubShow, type PositionSnapshot } from '@metaverse/game-protocol';
import { createPlayerAnimation } from '../systems/playerAnimation';
import { createPlayerPresentation } from '../systems/playerPresentation';
import character from './player-character.json';

/** Sở hữu clone rig và mixer theo vòng đời thật của component, kể cả StrictMode. */
function PlayerModel({ player, speed, epoch, show }: { player: PositionSnapshot; speed: { current: number }; epoch: number; show: ClubShow }) {
  const id = isPlayerCharacterId(player.characterId) ? player.characterId : DEFAULT_PLAYER_CHARACTER;
  const definition = PLAYER_CHARACTERS[id];
  const { scene, animations } = useGLTF(definition.url);
  const [controller, setController] = useState<ReturnType<typeof createPlayerAnimation> | null>(null);
  useEffect(() => {
    const instance = createPlayerAnimation(scene, animations, definition.guitar);
    setController(instance);
    return () => instance.dispose();
  }, [scene, animations, definition.guitar]);
  useFrame((_, delta) => {
    controller?.update(delta, player.seatId ? 'Sit' : player.dancing ? (player.danceStyle === 'guitar' ? 'GuitarDance' : player.danceStyle === 'flair' ? 'Flair' : 'Dance') : speed.current > .12 ? 'Walk' : 'Idle', speed.current, epoch, show);
  }, -1.5);
  return controller ? <primitive object={controller.scene} dispose={null}/> : null;
}

/** Root luôn giữ vị trí nội suy cho camera; animation chỉ tác động rig bên trong. */
export function Avatar({ player, local, objectRef, epoch = 0, show = DEFAULT_CLUB_SHOW }: { player: PositionSnapshot; local: boolean; objectRef?: RefObject<THREE.Group | null>; epoch?: number; show?: ClubShow }) {
  const ownRef = useRef<THREE.Group>(null);
  const root = objectRef ?? ownRef;
  const [initialPosition] = useState<[number, number, number]>(() => [player.x, 0, player.z]);
  const speed = useRef(0);
  const [presentation] = useState(() => createPlayerPresentation(player, performance.now()));
  useLayoutEffect(() => {
    presentation.push(player, performance.now());
  }, [player, presentation]);
  useFrame((_, delta) => {
    if (!root.current) return;
    speed.current = presentation.update(root.current, delta, performance.now());
  }, -2);
  return <group ref={root} position={initialPosition} name={local ? 'local-avatar' : 'remote-avatar'}>
    <Suspense fallback={<mesh position={[0, .9, 0]}><capsuleGeometry args={[.25, 1, 4, 8]}/><meshStandardMaterial color="#e8a3c0" wireframe/></mesh>}>
      <PlayerModel player={player} speed={speed} epoch={epoch} show={show}/>
    </Suspense>
    <Billboard position={[0, character.height + .3, 0]}><Text fontSize={.18} color={local ? '#ffe9ab' : '#ffffff'} anchorX="center" outlineWidth={.012} outlineColor="#171025" maxWidth={3}>{local ? `${player.name} (bạn)` : player.name}</Text></Billboard>
  </group>;
}
