'use client';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Billboard, Text } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { CLUB_NPCS, loadCharacterAsset, type CharacterAsset } from '../systems/characterAssets';
import { MathUtils, PropertyBinding, Vector3, type AnimationAction, type Group } from 'three';
import { canTalkToRosetta, loadRosettaDance, loadRosettaWave, type RosettaMode } from '../systems/rosettaMotion';
import { createHostLocomotion } from '../systems/hostLocomotion';
import { createDjVisitMotion } from '../systems/djVisitMotion';
import { createDjPerformance } from '../systems/djPerformance';
import { createRosettaGreeting } from '../systems/rosettaGreeting';
import { getClubBeat } from '../systems/BeatSyncController';
import { DJ_HOME, type DjVisit, type ClubShow } from '@metaverse/game-protocol';

/** Rosetta chào khách/nhảy theo tương tác; DJ Rio thao tác console trên sân khấu. Rig dùng lại từ cache. */
export function WelcomeNpc({ id, objectRef, mode = 'greeting', player, onDanceError, epoch, show, dj }: { id: 'rosetta' | 'galaxy'; objectRef?: RefObject<Group | null>; mode?: RosettaMode; player?: { x: number; z: number }; onDanceError?: () => void; epoch?: number; show?: ClubShow; dj?: DjVisit }) {
  const config = CLUB_NPCS[id];
  const position: [number, number, number] = id === 'galaxy' ? [DJ_HOME.x, DJ_HOME.y, DJ_HOME.z] : [...CLUB_NPCS.rosetta.position] as [number, number, number];
  const homeYaw = id === 'galaxy' ? DJ_HOME.yaw : CLUB_NPCS.rosetta.yaw;
  const [asset, setAsset] = useState<CharacterAsset | null>(null);
  const [failed, setFailed] = useState(false);
  const last = useRef(0);
  const ownRoot = useRef<Group>(null), root = objectRef ?? ownRoot;
  const [danceAction, setDanceAction] = useState<AnimationAction | null>(null);
  const [greeting, setGreeting] = useState<ReturnType<typeof createRosettaGreeting> | null>(null);
  const [motionFailed, setMotionFailed] = useState(false);
  const performance = useRef({ weight: 0, started: 0, footHeight: Number.NaN, point: new Vector3() });
  const feet = useMemo(() => asset ? ['Foot.L', 'Foot.R'].map(name => asset.scene.getObjectByName(PropertyBinding.sanitizeNodeName(name))).filter(node => !!node) : [], [asset]);
  const djMotion = useMemo(() => id === 'galaxy' && asset?.vrm ? createDjPerformance(asset.vrm, DJ_HOME.y) : null, [id, asset, config]);
  const walking = dj && ['approaching', 'ready', 'returning'].includes(dj.phase);
  const visitMotion = useMemo(() => walking && dj && asset?.vrm ? createHostLocomotion(asset.vrm, asset.footClearance, createDjVisitMotion(dj)) : null, [walking, asset, dj?.phase, dj?.startedAt, dj?.targetX, dj?.targetZ, dj?.returnDistance]);
  const { gl } = useThree();
  useEffect(() => {
    let cancelled = false;
    setFailed(false); setAsset(null);
    void loadCharacterAsset(id).then(loaded => {
      if (cancelled) return;
      loaded.scene.position.y = loaded.baseY; setAsset(loaded);
      gl.domElement.dataset[`npc${id}`] = 'ready';
    }).catch(() => { if (!cancelled) { setFailed(true); gl.domElement.dataset[`npc${id}`] = 'error'; } });
    return () => { cancelled = true; delete gl.domElement.dataset[`npc${id}`]; };
  }, [id, gl]);
  useEffect(() => {
    setDanceAction(null); performance.current.footHeight = Number.NaN; performance.current.weight = 0;
  }, [asset, id]);
  useEffect(() => {
    let cancelled = false;
    if (id === 'rosetta' && asset?.mixer && !danceAction) {
      void loadRosettaDance(asset.scene).then(clip => {
        if (!cancelled) setDanceAction(asset.mixer!.clipAction(clip).play().setEffectiveWeight(0));
      }).catch(() => { if (!cancelled && mode === 'dancing') onDanceError?.(); });
    }
    return () => { cancelled = true; };
  }, [asset, id, mode, danceAction, onDanceError]);
  useEffect(() => { if (mode === 'dancing') performance.current.started = Date.now(); }, [mode]);
  useEffect(() => {
    let cancelled = false; setGreeting(null); setMotionFailed(false);
    if (id === 'rosetta' && asset) void loadRosettaWave(asset.scene).then(clip => { if (!cancelled) setGreeting(createRosettaGreeting(asset, clip)); }).catch(() => { if (!cancelled) setMotionFailed(true); });
    return () => { cancelled = true; };
  }, [id, asset]);
  useFrame((_, delta) => {
    if (!asset || !root.current) return;
    const dt = Math.min(delta, .05);
    // Đồng hồ tự chủ giữ diễn hoạt nền ổn định khi đổi nhạc hoặc vào lại phòng.
    const seconds = Date.now() / 1000;
    if (id === 'rosetta') {
      const state = performance.current;
      const facePlayer = player && canTalkToRosetta(player, root.current.position);
      const yaw = facePlayer ? Math.atan2(player.x - root.current.position.x, player.z - root.current.position.z) : homeYaw;
      const difference = yaw - root.current.rotation.y;
      root.current.rotation.y += Math.atan2(Math.sin(difference), Math.cos(difference)) * (1 - Math.exp(-8 * dt));
      if (!Number.isFinite(state.footHeight) && feet.length) {
        state.footHeight = asset.footClearance + root.current.getWorldPosition(state.point).y;
      }
      if (greeting) greeting.update(seconds, dt, mode, danceAction, Math.max(0, (Date.now() - state.started) / 1000));
      else if (asset.mixer) {
        state.weight = MathUtils.damp(state.weight, mode === 'dancing' && danceAction ? 1 : 0, 7, dt);
        for (const clip of asset.animations) {
          const action = asset.mixer.clipAction(clip);
          action.setEffectiveWeight(1 - state.weight); action.time = seconds % clip.duration;
        }
        if (danceAction) { danceAction.setEffectiveWeight(state.weight); danceAction.time = Math.max(0, (Date.now() - state.started) / 1000) % danceAction.getClip().duration; }
        if (asset.expression) { asset.expression.setEffectiveWeight(1); asset.expression.time = seconds % asset.expression.getClip().duration; }
        asset.mixer.update(0);
      }
      if (feet.length && Number.isFinite(state.footHeight)) {
        asset.scene.updateWorldMatrix(true, true);
        asset.scene.position.y += state.footHeight - Math.min(...feet.map(foot => foot.getWorldPosition(state.point).y));
      }
    } else if (visitMotion && dj) visitMotion.update(Math.max(0, (Date.now() - dj.startedAt) / 1000), dt, root.current);
    else {
      root.current.position.set(DJ_HOME.x, DJ_HOME.y, DJ_HOME.z); root.current.rotation.y = DJ_HOME.yaw;
      if (asset.mixer) asset.mixer.setTime(seconds);
      djMotion?.update(seconds, dt, epoch && show ? getClubBeat(epoch, show).elapsedBeat : undefined);
    }
    if (process.env.NODE_ENV === 'development' && seconds - last.current > .5) {
      last.current = seconds;
      gl.domElement.dataset[`npc${id}`] = 'ready';
    }
  });
  return <group ref={root} name={`npc:${id}`} userData={{ npcId: id, role: config.role, ready: !!asset, mode }} position={position} rotation={[0, homeYaw, 0]}>
    {asset && <primitive object={asset.scene} dispose={null}/>}
    <Billboard position={[0, id === 'rosetta' ? config.height + .28 : 2.16, 0]}><Text fontSize={.14} color={failed || motionFailed ? '#ff879e' : '#f6d7e9'}>{failed ? `${config.name}: lỗi model` : motionFailed ? `${config.name}: lỗi animation` : config.name}</Text></Billboard>
    <Billboard position={[0, id === 'rosetta' ? config.height + .08 : 1.95, 0]}><Text fontSize={.11} maxWidth={2} textAlign="center" color="#b7dcf1">{config.caption}</Text></Billboard>
  </group>;
}
