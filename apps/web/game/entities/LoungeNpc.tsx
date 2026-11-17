'use client';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Billboard, Text } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import type { PositionSnapshot, WorldZone } from '@metaverse/game-protocol';
import { getLoungeSurfaceY } from '@metaverse/game-protocol';
import { CLUB_NPCS, getCachedCharacterAsset, loadCharacterAsset, type CharacterAsset } from '../systems/characterAssets';
import { createRecordedClubDance } from '../systems/retargetClubMotion';
import {
  canTalkToLoungeNpc,
  createLoungeNpcMotion,
  getCompanionDanceClip,
  LOUNGE_DANCE_CLIPS,
  stepCompanionFollow,
  type CompanionFollowState,
  type LoungeNpcId,
  type LoungeNpcMode,
} from '../systems/loungeNpcMotion';

/** Hiển thị Hostess VRM tại vị trí cố định trong Reika Lounge khi chưa đi theo người chơi. */
export function LoungeNpc({
  id,
  x,
  z,
  yaw,
  roleLabel,
  mode = 'idle',
  player,
}: {
  id: LoungeNpcId;
  x: number;
  z: number;
  yaw: number;
  roleLabel: string;
  mode?: LoungeNpcMode;
  player?: { x: number; z: number };
}) {
  const config = CLUB_NPCS[id];
  const [asset, setAsset] = useState<CharacterAsset | null>(() => getCachedCharacterAsset(id) ?? null);
  const [dance, setDance] = useState<Awaited<ReturnType<typeof createRecordedClubDance>> | undefined>(() => getCachedCharacterAsset(id)?.dance);
  const [failed, setFailed] = useState(false);
  const root = useRef<Group>(null);
  const { gl } = useThree();

  useEffect(() => {
    let cancelled = false;
    let ownedDance: Awaited<ReturnType<typeof createRecordedClubDance>> | undefined;
    setFailed(false);
    const cached = getCachedCharacterAsset(id);
    if (cached) {
      cached.scene.position.set(0, cached.baseY, 0);
      cached.scene.rotation.set(0, cached.vrm?.meta?.metaVersion === '0' ? Math.PI : 0, 0);
      setAsset(cached);
      if (cached.dance) {
        setDance(cached.dance);
        gl.domElement.dataset[`npc${id}`] = 'ready';
        return () => { delete gl.domElement.dataset[`npc${id}`]; };
      }
    }
    void loadCharacterAsset(id)
      .then(async loaded => {
        if (cancelled) return;
        loaded.scene.position.set(0, loaded.baseY, 0);
        loaded.scene.rotation.set(0, loaded.vrm?.meta?.metaVersion === '0' ? Math.PI : 0, 0);
        let activeDance = loaded.dance;
        if (!activeDance && loaded.vrm) {
          try {
            ownedDance = await createRecordedClubDance(loaded.vrm, config.name, LOUNGE_DANCE_CLIPS[id]);
            activeDance = ownedDance;
          } catch {
            /* Giữ nguyên tư thế IK khi clip nhảy chưa sẵn sàng */
          }
        }
        if (cancelled) {
          ownedDance?.dispose();
          return;
        }
        setDance(activeDance);
        setAsset(loaded);
        gl.domElement.dataset[`npc${id}`] = 'ready';
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          gl.domElement.dataset[`npc${id}`] = 'error';
        }
      });
    return () => {
      cancelled = true;
      ownedDance?.dispose();
      delete gl.domElement.dataset[`npc${id}`];
    };
  }, [id, config.name, gl]);

  const motion = useMemo(
    () => (asset?.vrm ? createLoungeNpcMotion(asset.vrm, id, 0, yaw, dance) : null),
    [asset, id, yaw, dance],
  );

  const nearPlayer = canTalkToLoungeNpc(player, { x, z });

  useFrame((_, delta) => {
    if (!asset || !root.current || !motion) return;
    const dt = Math.min(delta, 0.05);
    root.current.position.set(x, 0, z);
    const targetYaw = nearPlayer && player ? Math.atan2(player.x - x, player.z - z) : yaw;
    const diff = targetYaw - root.current.rotation.y;
    root.current.rotation.y += Math.atan2(Math.sin(diff), Math.cos(diff)) * (1 - Math.exp(-8 * dt));
    motion.update(Date.now() / 1000, dt, root.current.rotation.y, mode);
  });

  return (
    <group
      ref={root}
      name={`npc:${id}`}
      userData={{ npcId: id, role: config.role, ready: !!asset, mode }}
      position={[x, 0, z]}
      rotation={[0, yaw, 0]}
    >
      {asset && <primitive object={asset.scene} dispose={null} />}
      <Billboard position={[0, config.height + 0.3, 0]}>
        <Text fontSize={0.14} color={failed ? '#ff879e' : nearPlayer ? '#ff99cc' : '#ffe599'} outlineWidth={0.01} outlineColor="#1a0c24">
          {failed ? `${config.name}: lỗi model` : nearPlayer ? `${config.name} · [F]` : config.name}
        </Text>
      </Billboard>
      <Billboard position={[0, config.height + 0.1, 0]}>
        <Text fontSize={0.105} maxWidth={2.4} textAlign="center" color={nearPlayer ? '#ffe6f2' : '#ffd1e8'}>
          {nearPlayer ? 'Nhấn F · Trò chuyện & Gọi đào' : roleLabel}
        </Text>
      </Billboard>
    </group>
  );
}

/** Hiển thị Hostess đi theo người chơi ("Đi với anh nhé") qua cả Lounge, Phố và Club; tự đi bộ Dwarf Walk và nhảy theo người chơi. */
export function CompanionNpc({
  id,
  player,
  localAvatar,
  zone,
  mode = 'flirt',
  epoch = 0,
}: {
  id: LoungeNpcId;
  player?: PositionSnapshot;
  localAvatar?: RefObject<Group | null>;
  zone: WorldZone;
  mode?: LoungeNpcMode;
  epoch?: number;
}) {
  const config = CLUB_NPCS[id];
  const [asset, setAsset] = useState<CharacterAsset | null>(null);
  const [walk, setWalk] = useState<Awaited<ReturnType<typeof createRecordedClubDance>> | undefined>(undefined);
  const [dance, setDance] = useState<Awaited<ReturnType<typeof createRecordedClubDance>> | undefined>(undefined);
  const root = useRef<Group>(null);
  const follow = useRef<CompanionFollowState>({
    x: player?.x ?? 0,
    z: player?.z ?? 0,
    yaw: player?.yaw ?? 0,
    speed: 0,
    zone: null,
  });

  const activeDanceClip = getCompanionDanceClip(id, player?.dancing ? player.danceStyle : undefined);

  useEffect(() => {
    let cancelled = false;
    let walkCtrl: Awaited<ReturnType<typeof createRecordedClubDance>> | undefined;
    setAsset(null);
    setWalk(undefined);
    void loadCharacterAsset(id).then(async loaded => {
      if (cancelled) return;
      loaded.scene.position.set(0, loaded.baseY, 0);
      loaded.scene.rotation.set(0, loaded.vrm?.meta?.metaVersion === '0' ? Math.PI : 0, 0);
      if (loaded.vrm) {
        try {
          walkCtrl = await createRecordedClubDance(loaded.vrm, `${config.name}_walk`, ['Dwarf Walk']);
        } catch {
          /* Dự phòng nếu clip đi bộ lỗi */
        }
      }
      if (cancelled) {
        walkCtrl?.dispose();
        return;
      }
      setWalk(walkCtrl);
      setAsset(loaded);
    });
    return () => {
      cancelled = true;
      walkCtrl?.dispose();
    };
  }, [id, config.name]);

  useEffect(() => {
    if (!asset?.vrm) return;
    let cancelled = false;
    let danceCtrl: Awaited<ReturnType<typeof createRecordedClubDance>> | undefined;
    void createRecordedClubDance(asset.vrm, `${config.name}_${activeDanceClip}`, [activeDanceClip])
      .then(ctrl => {
        if (cancelled) {
          ctrl.dispose();
          return;
        }
        danceCtrl = ctrl;
        setDance(ctrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      danceCtrl?.dispose();
    };
  }, [asset, config.name, activeDanceClip]);

  const motion = useMemo(
    () => (asset?.vrm ? createLoungeNpcMotion(asset.vrm, id, 0, 0, dance, walk) : null),
    [asset, id, dance, walk],
  );

  useFrame((_, delta) => {
    if (!asset || !root.current || !motion || !player) return;
    const liveX = localAvatar?.current ? localAvatar.current.position.x : player.x;
    const liveZ = localAvatar?.current ? localAvatar.current.position.z : player.z;
    const liveYaw = localAvatar?.current ? localAvatar.current.rotation.y : player.yaw;

    const step = stepCompanionFollow(
      follow.current,
      { x: liveX, z: liveZ, yaw: liveYaw, dancing: player.dancing, seatId: player.seatId },
      zone,
      delta,
    );
    const targetY = zone === 'lounge' ? getLoungeSurfaceY(step.x, step.z) : 0;
    root.current.position.set(step.x, targetY, step.z);
    root.current.rotation.set(0, step.yaw, 0);

    const activeMode: LoungeNpcMode = step.moving
      ? 'walk'
      : player.dancing
        ? 'dance'
        : mode;
    const seconds = epoch > 0 && activeMode === 'dance' ? (Date.now() - epoch) / 1000 : Date.now() / 1000;
    motion.update(seconds, delta, step.yaw, activeMode);
  });

  return (
    <group ref={root} name={`companion:${id}`} position={[follow.current.x, zone === 'lounge' ? getLoungeSurfaceY(follow.current.x, follow.current.z) : 0, follow.current.z]}>
      {asset && <primitive object={asset.scene} dispose={null} />}
      <Billboard position={[0, config.height + 0.3, 0]}>
        <Text fontSize={0.14} color="#ff99cc" outlineWidth={0.01} outlineColor="#1a0c24">
          {`${config.name} ♥ (Đi cùng bạn)`}
        </Text>
      </Billboard>
      <Billboard position={[0, config.height + 0.1, 0]}>
        <Text fontSize={0.105} maxWidth={2.5} textAlign="center" color="#ffe6f2">
          {player?.dancing ? 'Đang nhảy cùng bạn · [F]' : 'Nhấn F để trò chuyện / đổi kiểu chiều'}
        </Text>
      </Billboard>
    </group>
  );
}
