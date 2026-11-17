'use client';
/** Mỗi khung hình đặt listener theo avatar mình + hướng camera, và nguồn âm từng peer theo avatar của họ. */
import { useFrame } from '@react-three/fiber';
import { useRef, type RefObject } from 'react';
import { Vector3, type Group } from 'three';
import type { PositionSnapshot } from '@metaverse/game-protocol';
import type { VoiceChatEngine } from './VoiceChatEngine';
import { getVoiceAvatar } from './voiceAvatarRegistry';

/** Đặt cả tai và miệng ở cao độ đầu xấp xỉ, chỉ để hướng trái/phải của HRTF tự nhiên hơn. */
const HEAD_HEIGHT = 1.5;

export function VoiceSpatialAudio({ engine, players, sessionId, localAvatar }: {
  engine: RefObject<VoiceChatEngine | null>;
  players: Record<string, PositionSnapshot>;
  sessionId: string;
  localAvatar: RefObject<Group | null>;
}) {
  const scratch = useRef({ position: new Vector3(), forward: new Vector3(), up: new Vector3() });
  useFrame(({ camera }) => {
    const voice = engine.current;
    if (!voice) return;
    const { position, forward, up } = scratch.current;
    const self = players[sessionId];
    if (localAvatar.current) localAvatar.current.getWorldPosition(position);
    else if (self) position.set(self.x, self.y ?? 0, self.z);
    else return;
    position.y += HEAD_HEIGHT;
    camera.getWorldDirection(forward);
    up.copy(camera.up);
    voice.positionListener(position, forward, up);
    for (const id of voice.peerIds()) {
      const player = players[id];
      if (!player) continue;
      const avatar = getVoiceAvatar(player.id);
      if (avatar) avatar.getWorldPosition(position);
      else position.set(player.x, player.y ?? 0, player.z);
      voice.positionPeer(id, position.x, position.y + HEAD_HEIGHT, position.z);
    }
  });
  return null;
}
