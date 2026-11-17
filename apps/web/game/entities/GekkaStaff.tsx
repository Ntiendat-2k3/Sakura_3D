'use client';
import { Billboard, Text } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Frustum, MathUtils, Matrix4, Sphere, type Camera, type Group, type Material, type Mesh, type Object3D } from 'three';
import { GEKKA_ESCORT, GEKKA_SEATS, POKER_SEATS, type PokerTableView, type PositionSnapshot } from '@metaverse/game-protocol';
import { CLUB_NPCS, getCachedCharacterAsset, loadCharacterAsset, type CharacterAsset, type CharacterId } from '../systems/characterAssets';
import { createRecordedClubDance } from '../systems/retargetClubMotion';
import { createKohakuNpcMotion } from '../systems/kohakuNpcMotion';
import { createGekkaActorMotion, GEKKA_STAFF_CLIPS, punchClipTime, type RecordedGekkaClip } from '../systems/gekkaNpcMotion';
import { createHostessDirector, HOSTESS_BOW_SECONDS, HOSTESS_STREET } from '../systems/gekkaHostess';
import type { GekkaPunchCue } from '../systems/useGekkaPunchCue';
import { createExecutionerDirector, type ExecutionerMode } from '../systems/gekkaExecutioner';

const DEALER = GEKKA_SEATS.find(seat => seat.id === 'gekka-dealer')!;

const cullFrustum = new Frustum(), cullMatrix = new Matrix4(), cullSphere = new Sphere();
/** Viền MToon chỉ vẽ khi camera trong khoảng này: xa hơn thì viền mảnh 1–2 px, mà mỗi viền là một draw call. */
const OUTLINE_DISTANCE = 4.5;
const outlineCache = new WeakMap<Object3D, Material[]>();
function outlinesOf(scene: Object3D): Material[] {
  let list = outlineCache.get(scene);
  if (!list) {
    const found = new Set<Material>();
    scene.traverse(node => {
      if (!(node as Mesh).isMesh) return;
      const materials = (node as Mesh).material;
      for (const material of Array.isArray(materials) ? materials : [materials]) {
        if ((material as Material & { isOutline?: boolean }).isOutline) found.add(material);
      }
    });
    list = [...found];
    outlineCache.set(scene, list);
  }
  return list;
}
/** Trả viền về như cũ khi rời Gekkarō: VRM nằm trong cache dùng chung. */
function restoreOutlines(scene: Object3D) {
  for (const material of outlinesOf(scene)) material.visible = true;
}

/**
 * Mesh VRM tắt frustumCulled (bound của skin lệch khi xương đổi), nên tự loại NPC ngoài khung hình:
 * ẩn đi và bỏ qua tính xương + lò xo tóc, phần tốn CPU nhất của mỗi VRM mỗi frame. Ở xa thì tắt viền.
 */
function culled(camera: Camera, root: Group, at: { x: number; y?: number; z: number }, scene?: Object3D): boolean {
  cullMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  cullFrustum.setFromProjectionMatrix(cullMatrix);
  cullSphere.center.set(at.x, (at.y ?? 0) + 0.9, at.z);
  cullSphere.radius = 1.4;
  const hidden = !cullFrustum.intersectsSphere(cullSphere);
  root.visible = !hidden;
  if (!hidden && scene) {
    const near = camera.position.distanceTo(cullSphere.center) < OUTLINE_DISTANCE;
    for (const material of outlinesOf(scene)) material.visible = near;
  }
  return hidden;
}

/** Model NPC dùng chung cache với Club/Kohaku (đã làm ấm ở màn hình tải); VRM 0.x quay mặt về +Z của gốc. */
function useStaffAsset(id: CharacterId) {
  const [asset, setAsset] = useState<CharacterAsset | null>(() => getCachedCharacterAsset(id) ?? null);
  const [failed, setFailed] = useState(false);
  const { gl } = useThree();
  useEffect(() => {
    let cancelled = false;
    const prepare = (loaded: CharacterAsset) => {
      loaded.scene.position.set(0, loaded.baseY, 0);
      loaded.scene.rotation.set(0, loaded.vrm?.meta?.metaVersion === '0' ? Math.PI : 0, 0);
      setAsset(loaded);
      gl.domElement.dataset[`gekkaNpc_${id}`] = 'ready';
    };
    void loadCharacterAsset(id).then(loaded => { if (!cancelled) prepare(loaded); }).catch(() => {
      if (cancelled) return;
      setFailed(true);
      gl.domElement.dataset[`gekkaNpc_${id}`] = 'error';
    });
    return () => {
      cancelled = true;
      delete gl.domElement.dataset[`gekkaNpc_${id}`];
      const cached = getCachedCharacterAsset(id);
      if (cached) restoreOutlines(cached.scene);
    };
  }, [id, gl]);
  return { asset, failed };
}

/** Clip Mixamo retarget lên VRM của NPC; tự giải phóng mixer khi gỡ để không giữ tham chiếu tới rig dùng chung. */
function useStaffClips(asset: CharacterAsset | null, label: string, ids: readonly string[]) {
  const [clips, setClips] = useState<(RecordedGekkaClip | null)[]>([]);
  const key = ids.join('|');
  useEffect(() => {
    if (!asset?.vrm) return;
    let cancelled = false;
    const loaded: (RecordedGekkaClip | null)[] = [];
    void Promise.all(key.split('|').map((clip, index) => createRecordedClubDance(asset.vrm!, `${label}_${index}`, [clip]).catch(() => null))).then(result => {
      loaded.push(...result);
      if (cancelled) result.forEach(clip => clip?.dispose()); else setClips(result);
    });
    return () => { cancelled = true; loaded.forEach(clip => clip?.dispose()); setClips([]); };
  }, [asset, label, key]);
  return clips;
}

function StaffLabel({ id, height, failed, caption, children }: { id: CharacterId; height: number; failed: boolean; caption: string; children?: ReactNode }) {
  return <>
    <Billboard position={[0, height + 0.32, 0]}>
      <Text fontSize={0.13} color={failed ? '#ff879e' : '#f3d88f'} outlineWidth={0.01} outlineColor="#160f08">
        {failed ? `${CLUB_NPCS[id].name}: lỗi tải VRM` : CLUB_NPCS[id].name}
      </Text>
    </Billboard>
    <Billboard position={[0, height + 0.14, 0]}>
      <Text fontSize={0.085} maxWidth={2.4} textAlign="center" color="#d8c49c" outlineWidth={0.006} outlineColor="#160f08">{caption}</Text>
    </Billboard>
    {children}
  </>;
}

/**
 * Bà chủ Aos. Ngoài phố: đứng cạnh cửa 月華楼, quay sang và cúi chào khi khách lại gần.
 * Trong salon: đứng cửa đón, dẫn khách mới tới ghế trống, cúi chào khi khách ngồi rồi quay lại cửa; trận diễn ra thì đi dạo.
 */
export function GekkaHostess({ where, player, table, players }: {
  where: 'street' | 'salon';
  player?: { x: number; z: number };
  table?: PokerTableView;
  players?: Record<string, PositionSnapshot>;
}) {
  const { asset, failed } = useStaffAsset('aos');
  const [walk, bow] = useStaffClips(asset, 'Aos', [GEKKA_STAFF_CLIPS.walk, GEKKA_STAFF_CLIPS.bow]);
  const motion = useMemo(() => (asset?.vrm ? createGekkaActorMotion(asset.vrm, 'hostess', walk ?? null) : null), [asset, walk]);
  const director = useMemo(() => createHostessDirector(), []);
  const root = useRef<Group>(null);
  const latest = useRef({ player, table, players });
  latest.current = { player, table, players };
  const street = useRef({ yaw: HOSTESS_STREET.yaw, near: false, bowAt: -Infinity });
  const [caption, setCaption] = useState(CLUB_NPCS.aos.caption);

  useFrame((state, delta) => {
    if (!root.current) return;
    const now = state.clock.elapsedTime;
    let frame: { x: number; z: number; yaw: number; walking: boolean; bowElapsed: number | null };
    if (where === 'street') {
      const s = street.current, guest = latest.current.player;
      const distance = guest ? Math.hypot(guest.x - HOSTESS_STREET.x, guest.z - HOSTESS_STREET.z) : Infinity;
      // Cúi chào một lần mỗi lần khách bước vào vùng 3.2 m; quay người theo khách trong 6 m.
      if (distance < 3.2 && !s.near) s.bowAt = now;
      s.near = distance < 3.2;
      const offset = guest && distance < 6
        ? MathUtils.clamp(Math.atan2(Math.sin(Math.atan2(guest.x - HOSTESS_STREET.x, guest.z - HOSTESS_STREET.z) - HOSTESS_STREET.yaw), Math.cos(Math.atan2(guest.x - HOSTESS_STREET.x, guest.z - HOSTESS_STREET.z) - HOSTESS_STREET.yaw)), -1.3, 1.3)
        : 0;
      s.yaw += (HOSTESS_STREET.yaw + offset - s.yaw) * (1 - Math.exp(-5 * Math.min(delta, 0.05)));
      const elapsed = now - s.bowAt;
      frame = { x: HOSTESS_STREET.x, z: HOSTESS_STREET.z, yaw: s.yaw, walking: false, bowElapsed: elapsed < HOSTESS_BOW_SECONDS ? elapsed : null };
    } else {
      const { table: current, players: everyone } = latest.current;
      const guests = Object.entries(everyone ?? {}).map(([sessionId, item]) => ({ sessionId, x: item.x, z: item.z, seatId: item.seatId || undefined }));
      const freeSeats = (current?.seats ?? []).filter(seat => !seat.sessionId && POKER_SEATS.includes(seat.seatId)).map(seat => seat.seatId);
      frame = director.update(now, Math.min(delta, 0.1), { phase: current?.phase ?? 'lobby', guests, freeSeats });
    }
    if (!culled(state.camera, root.current, frame, asset?.scene)) motion?.update(now, delta, root.current, {
      x: frame.x, y: 0, z: frame.z, yaw: frame.yaw, walking: frame.walking,
      clip: frame.bowElapsed !== null && bow ? { key: 'bow', motion: bow, time: frame.bowElapsed } : null,
    });
    if (!motion || !root.current.visible) { root.current.position.set(frame.x, 0, frame.z); root.current.rotation.set(0, frame.yaw, 0); }
    const next = frame.bowElapsed !== null ? 'Kính chào quý khách · いらっしゃいませ' : frame.walking ? 'Mời quý khách đi lối này…' : CLUB_NPCS.aos.caption;
    if (next !== caption) setCaption(next);
  });

  return (
    <group ref={root} name="gekka-npc:aos">
      {asset && <primitive object={asset.scene} dispose={null} />}
      <StaffLabel id="aos" height={CLUB_NPCS.aos.height} failed={failed} caption={caption} />
    </group>
  );
}

/** Dealer Tsukimi đứng giữa bàn và quầy, xoay người dõi theo ghế đang tới lượt. */
export function GekkaDealer({ table, names }: { table: PokerTableView; names?: Record<string, string> }) {
  const { asset, failed } = useStaffAsset('espeon');
  const motion = useMemo(() => (asset?.vrm ? createKohakuNpcMotion(asset.vrm, 'shinku') : null), [asset]);
  const root = useRef<Group>(null);
  const yaw = useRef(DEALER.yaw);
  const turn = useRef(table.turnSeat);
  turn.current = table.turnSeat;

  useFrame((state, delta) => {
    if (!root.current) return;
    const seat = GEKKA_SEATS.find(item => item.id === turn.current);
    const wanted = seat ? DEALER.yaw + MathUtils.clamp(Math.atan2(seat.x - DEALER.x, seat.z - DEALER.z) - DEALER.yaw, -0.8, 0.8) : DEALER.yaw;
    yaw.current += (wanted - yaw.current) * (1 - Math.exp(-4 * Math.min(delta, 0.05)));
    root.current.position.set(DEALER.x, 0, DEALER.z);
    root.current.rotation.set(0, yaw.current, 0);
    // Dùng chung dáng đứng chia bài của Shinku (Kohaku): tay đặt trên mép bàn, tay phải nhịp chia bài.
    if (!culled(state.camera, root.current, DEALER, asset?.scene)) motion?.update(state.clock.elapsedTime, delta, { lookYaw: yaw.current });
  });

  const seat = table.seats.find(item => item.seatId === table.turnSeat);
  const caption = table.phase === 'betting' && seat ? `Mời ${names?.[seat.sessionId] ?? seat.seatId} · ${table.street.toUpperCase()}`
    : table.phase === 'showdown' ? 'Lật bài!' : CLUB_NPCS.espeon.caption;
  return (
    <group ref={root} name="gekka-npc:espeon" position={[DEALER.x, 0, DEALER.z]}>
      {asset && <primitive object={asset.scene} dispose={null} />}
      <StaffLabel id="espeon" height={CLUB_NPCS.espeon.height} failed={failed} caption={caption} />
    </group>
  );
}

/**
 * Đao phủ Onizuka: canh bàn ở salon; có người thua sạch thì đi tới túm và lôi xuống hầm theo lộ trình chung với server,
 * thủ thế và ra Cross Punch canh đúng hạn cú kế tiếp; hầm trống thì đi bộ về chỗ canh.
 */
export function GekkaExecutioner({ table, punch }: { table: Pick<PokerTableView, 'dungeon' | 'escort'>; punch: GekkaPunchCue }) {
  const { asset, failed } = useStaffAsset('lindsay');
  const [punchClip, walkClip] = useStaffClips(asset, 'Onizuka', [GEKKA_STAFF_CLIPS.punch, GEKKA_STAFF_CLIPS.walk]);
  const motion = useMemo(() => (asset?.vrm ? createGekkaActorMotion(asset.vrm, 'executioner', walkClip ?? null) : null), [asset, walkClip]);
  const director = useMemo(() => createExecutionerDirector(), []);
  const root = useRef<Group>(null);
  const latest = useRef({ table, punch });
  latest.current = { table, punch };
  const yaw = useRef<number | null>(null);
  const [mode, setMode] = useState<ExecutionerMode>('guard');

  useFrame((state, delta) => {
    if (!root.current) return;
    const { table: t, punch: p } = latest.current;
    const now = Date.now();
    const frame = director.update(now, t);
    // Lộ trình gãy khúc ở góc: xoay người mượt thay vì quay ngoắt.
    const turn = Math.atan2(Math.sin(frame.yaw - (yaw.current ?? frame.yaw)), Math.cos(frame.yaw - (yaw.current ?? frame.yaw)));
    yaw.current = (yaw.current ?? frame.yaw) + turn * (1 - Math.exp(-8 * Math.min(delta, 0.05)));
    const d = t.dungeon;
    const timing = frame.mode === 'rack' ? punchClipTime({
      active: true, punching: d.phase === 'punching', deadline: d.deadline, nowMs: now,
      lastImpactAgo: p.punchAt === null ? null : (performance.now() - p.punchAt) / 1000, punchesDone: d.punchesDone,
    }) : null;
    const actor = { x: frame.x, y: frame.y, z: frame.z, yaw: yaw.current, walking: frame.walking, reach: frame.reach, clip: timing && punchClip ? { ...timing, motion: punchClip } : null };
    if (!culled(state.camera, root.current, frame, asset?.scene)) motion?.update(state.clock.elapsedTime, delta, root.current, actor);
    if (!motion || !root.current.visible) { root.current.position.set(frame.x, frame.y, frame.z); root.current.rotation.set(0, actor.yaw, 0); }
    if (frame.mode !== mode) setMode(frame.mode);
  });

  const caption = mode === 'escort' ? 'Thua sạch rồi thì theo tao xuống hầm!'
    : table.dungeon.phase === 'punching' ? `Cú ${table.dungeon.punchesDone}/${table.dungeon.punchesTotal}`
      : table.dungeon.phase === 'capture' ? 'Trói nó vào khung!' : table.dungeon.phase === 'choice' ? 'Vay tiếp hay cút?' : CLUB_NPCS.lindsay.caption;
  return (
    <group ref={root} name="gekka-npc:lindsay" position={[GEKKA_ESCORT.guard.x, GEKKA_ESCORT.guard.y, GEKKA_ESCORT.guard.z]}>
      {asset && <primitive object={asset.scene} dispose={null} />}
      <StaffLabel id="lindsay" height={CLUB_NPCS.lindsay.height} failed={failed} caption={caption} />
    </group>
  );
}

/** Rina đứng sau quầy rượu salon, pha rượu và quay ra nhìn khách lại gần; lúc lật bài thì hướng về bàn. */
export function GekkaBarmaid({ player, showdown }: { player?: { x: number; y?: number; z: number }; showdown: boolean }) {
  const { asset, failed } = useStaffAsset('rina');
  const motion = useMemo(() => (asset?.vrm ? createKohakuNpcMotion(asset.vrm, 'bartender') : null), [asset]);
  const root = useRef<Group>(null);
  const config = CLUB_NPCS.rina;
  const yaw = useRef(config.yaw);
  const latest = useRef({ player, showdown });
  latest.current = { player, showdown };

  useFrame((state, delta) => {
    if (!root.current) return;
    const { player: guest, showdown: reveal } = latest.current;
    const [x, , z] = config.position;
    let wanted = config.yaw;
    const look = reveal ? { x: 0, z: -1.5 } : guest && (guest.y ?? 0) > -1 && Math.hypot(guest.x - x, guest.z - z) < 4.8 ? guest : null;
    if (look) {
      const offset = Math.atan2(Math.sin(Math.atan2(look.x - x, look.z - z) - config.yaw), Math.cos(Math.atan2(look.x - x, look.z - z) - config.yaw));
      wanted = config.yaw + MathUtils.clamp(offset, -0.75, 0.75);
    }
    yaw.current += (wanted - yaw.current) * (1 - Math.exp(-5 * Math.min(delta, 0.05)));
    root.current.position.set(x, 0, z);
    root.current.rotation.set(0, yaw.current, 0);
    if (!culled(state.camera, root.current, { x, z }, asset?.scene)) motion?.update(state.clock.elapsedTime, delta, { lookYaw: yaw.current });
  });

  return (
    <group ref={root} name="gekka-npc:rina" position={[config.position[0], 0, config.position[2]]} rotation={[0, config.yaw, 0]}>
      {asset && <primitive object={asset.scene} dispose={null} />}
      <StaffLabel id="rina" height={config.height} failed={failed} caption={showdown ? 'Kanpai! 乾杯' : config.caption} />
    </group>
  );
}
