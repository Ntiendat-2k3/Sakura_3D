'use client';
import { Billboard, Text } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MathUtils, type Group } from 'three';
import { KOHAKU_SEATS } from '@metaverse/game-protocol';
import { CLUB_NPCS, getCachedCharacterAsset, loadCharacterAsset, type CharacterAsset } from '../systems/characterAssets';
import {
  createKohakuNpcMotion,
  type HinataActionMode,
  type HinataMotionClips,
  type KohakuNpcId,
} from '../systems/kohakuNpcMotion';
import { createRecordedClubDance } from '../systems/retargetClubMotion';

const DEALER_SEAT = KOHAKU_SEATS.find(seat => seat.id === 'kohaku-dealer')!;

/** Hiển thị một NPC Kohaku Club (Shinku bàn Poker, Hinata thảm đỏ, Bartender quầy Bar). */
export function KohakuNpc({
  id,
  player,
  dealerSeated = false,
  nearPlayer = false,
  hinataMode = 'idle',
  hinataActionKey = 0,
  focus = null,
}: {
  id: KohakuNpcId;
  player?: { x: number; y?: number; z: number };
  dealerSeated?: boolean;
  nearPlayer?: boolean;
  hinataMode?: HinataActionMode;
  hinataActionKey?: number;
  /** Điểm cần nhìn theo diễn biến bàn Bluff (npcFocus); ưu tiên hơn việc nhìn người chơi local. */
  focus?: { x: number; z: number } | null;
}) {
  const config = CLUB_NPCS[id];
  const [asset, setAsset] = useState<CharacterAsset | null>(() => getCachedCharacterAsset(id) ?? null);
  const [fallbackClips, setFallbackClips] = useState<HinataMotionClips>({});
  const [failed, setFailed] = useState(false);
  const root = useRef<Group>(null);
  const stateRef = useRef({
    x: config.position[0],
    z: config.position[2],
    yaw: config.yaw,
  });
  const { gl } = useThree();

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    const prepare = (loaded: CharacterAsset) => {
      loaded.scene.position.set(0, loaded.baseY, 0);
      loaded.scene.rotation.set(0, loaded.vrm?.meta?.metaVersion === '0' ? Math.PI : 0, 0);
      setAsset(loaded);
      gl.domElement.dataset[`kohakuNpc_${id}`] = 'ready';
    };

    const cached = getCachedCharacterAsset(id);
    if (cached) {
      prepare(cached);
      return () => {
        delete gl.domElement.dataset[`kohakuNpc_${id}`];
      };
    }

    void loadCharacterAsset(id)
      .then(loaded => {
        if (!cancelled) prepare(loaded);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          gl.domElement.dataset[`kohakuNpc_${id}`] = 'error';
        }
      });

    return () => {
      cancelled = true;
      delete gl.domElement.dataset[`kohakuNpc_${id}`];
    };
  }, [id, gl]);

  useEffect(() => {
    if (id !== 'hinata' || !asset?.vrm || (asset.dance && asset.stageDance)) return;
    let cancelled = false;
    let bowLoaded: HinataMotionClips['bow'] = null;
    let kissLoaded: HinataMotionClips['kiss'] = null;
    void Promise.all([
      asset.dance ? Promise.resolve(null) : createRecordedClubDance(asset.vrm, 'Hinata_Bow', ['Quick Formal Bow']).catch(() => null),
      asset.stageDance ? Promise.resolve(null) : createRecordedClubDance(asset.vrm, 'Hinata_Kiss', ['Kiss']).catch(() => null),
    ]).then(([bow, kiss]) => {
      if (cancelled) {
        bow?.dispose();
        kiss?.dispose();
        return;
      }
      bowLoaded = bow;
      kissLoaded = kiss;
      setFallbackClips({ bow, kiss });
    });
    return () => {
      cancelled = true;
      bowLoaded?.dispose();
      kissLoaded?.dispose();
    };
  }, [asset, id]);

  const hinataClips = useMemo<HinataMotionClips | undefined>(() => (
    id === 'hinata'
      ? {
          bow: asset?.dance ?? fallbackClips.bow,
          kiss: asset?.stageDance ?? fallbackClips.kiss,
        }
      : undefined
  ), [asset, fallbackClips, id]);

  const motion = useMemo(() => (asset?.vrm ? createKohakuNpcMotion(asset.vrm, id, hinataClips) : null), [asset, id, hinataClips]);

  useFrame((state, delta) => {
    if (!root.current) return;
    const dt = MathUtils.clamp(delta, 0, 0.05);

    const shouldSit = id === 'shinku' && dealerSeated;
    const targetX = shouldSit ? DEALER_SEAT.x : config.position[0];
    const targetZ = shouldSit ? DEALER_SEAT.z : config.position[2];

    let targetYaw = shouldSit ? DEALER_SEAT.yaw : config.yaw;
    let headYaw = 0;
    // Đang hôn thì Hinata luôn nhìn người chơi, bỏ qua điểm nhìn theo bàn Bluff.
    const focusYaw = focus && hinataMode !== 'kiss' ? Math.atan2(focus.x - targetX, focus.z - targetZ) : null;
    if (focusYaw !== null && shouldSit) {
      // Đang ngồi chia bài thì chỉ quay đầu/ngực, thân giữ hướng ghế Dealer.
      headYaw = MathUtils.clamp(Math.atan2(Math.sin(focusYaw - targetYaw), Math.cos(focusYaw - targetYaw)), -0.9, 0.9);
    } else if (focusYaw !== null) {
      targetYaw = id === 'bartender'
        ? config.yaw + MathUtils.clamp(Math.atan2(Math.sin(focusYaw - config.yaw), Math.cos(focusYaw - config.yaw)), -0.75, 0.75)
        : focusYaw;
    } else if (!shouldSit && player && (player.y ?? 0) < 1.5) {
      const dist = Math.hypot(player.x - targetX, player.z - targetZ);
      const lookRange = id === 'bartender' ? 4.8 : 3.6;
      if (dist <= lookRange && dist > 0.25) {
        const toward = Math.atan2(player.x - targetX, player.z - targetZ);
        // Giới hạn góc xoay của Bartender để luôn hướng ra phía quầy trước, không quay lưng vào tường rượu.
        if (id === 'bartender') {
          const offset = Math.atan2(Math.sin(toward - config.yaw), Math.cos(toward - config.yaw));
          targetYaw = config.yaw + MathUtils.clamp(offset, -0.75, 0.75);
        } else {
          targetYaw = toward;
        }
      }
    }

    const lerpFactor = 1 - Math.exp(-8 * dt);
    stateRef.current.x = MathUtils.lerp(stateRef.current.x, targetX, lerpFactor);
    stateRef.current.z = MathUtils.lerp(stateRef.current.z, targetZ, lerpFactor);
    const yawDiff = targetYaw - stateRef.current.yaw;
    stateRef.current.yaw += Math.atan2(Math.sin(yawDiff), Math.cos(yawDiff)) * lerpFactor;

    root.current.position.set(stateRef.current.x, 0, stateRef.current.z);
    root.current.rotation.set(0, stateRef.current.yaw, 0);

    motion?.update(state.clock.elapsedTime, delta, {
      lookYaw: stateRef.current.yaw,
      seated: shouldSit,
      hinataMode,
      actionKey: hinataActionKey,
      headYaw,
    });
  });

  const subtitle =
    id === 'hinata' && hinataMode === 'kiss'
      ? 'Đang hôn quý khách ♥'
      : nearPlayer
        ? id === 'hinata'
          ? 'Nhấn F · Chào & Kiss ♥'
          : 'Nhấn F · Trò chuyện'
        : id === 'shinku' && dealerSeated
          ? 'Dealer · Đang ngồi giữ bàn'
          : config.caption;

  return (
    <group ref={root} name={`kohaku-npc:${id}`} position={[config.position[0], config.position[1], config.position[2]]} rotation={[0, config.yaw, 0]}>
      {asset && <primitive object={asset.scene} dispose={null} />}
      <Billboard position={[0, config.height + 0.34, 0]}>
        <Text fontSize={0.14} color={failed ? '#ff879e' : nearPlayer ? '#ffdf85' : '#f5d485'} outlineWidth={0.012} outlineColor="#160f08">
          {failed ? `${config.name}: lỗi tải VRM` : nearPlayer ? `${config.name} · [F]` : config.name}
        </Text>
      </Billboard>
      <Billboard position={[0, config.height + 0.14, 0]}>
        <Text fontSize={0.10} maxWidth={2.5} textAlign="center" color={nearPlayer ? '#fff2cc' : '#d6c198'}>
          {subtitle}
        </Text>
      </Billboard>
    </group>
  );
}
