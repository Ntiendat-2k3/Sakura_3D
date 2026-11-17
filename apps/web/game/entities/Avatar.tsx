'use client';
import { Billboard, Text, useGLTF } from '@react-three/drei';
import { createPortal, useFrame } from '@react-three/fiber';
import { Suspense, memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import {
  DEFAULT_CLUB_SHOW,
  DEFAULT_PLAYER_CHARACTER,
  isPlayerCharacterId,
  PLAYER_CHARACTERS,
  PLAYER_DANCES,
  getLoungeSurfaceY,
  getKohakuSurfaceY,
  getKohakuJumpSpot,
  kohakuJumpDuration,
  sampleKohakuJump,
  resolveKohakuStep,
  getGekkaSurfaceY,
  resolveGekkaStep,
  isWalkable,
  isClubWalkable,
  isLoungeWalkable,
  isHotelWalkable,
  MOVE_SPEED,
  type ClubShow,
  type MoveInput,
  type PositionSnapshot,
  type WorldZone,
} from '@metaverse/game-protocol';
import { applyBluffPose, bluffHandGunMatrix, snapshotBluffPose, type BluffPose, type BluffPoseSnapshot } from '../systems/bluffPose';
import { BLUFF_REVOLVER_URL } from './KohakuBluffTable';
import { createPlayerAnimation } from '../systems/playerAnimation';
import { createPlayerPresentation } from '../systems/playerPresentation';
import { isGekkaCaptiveSeat, type GekkaRestraintCue } from '../systems/gekkaPokerView';
import { loadGekkaRestraintMotion, type GekkaRestraintMotion } from '../systems/gekkaRestraintPose';
import { loadPlayerKissMotion, type PlayerKissMotion } from '../systems/playerKissMotion';
import { loadPlayerJumpMotion, type PlayerJumpMotion } from '../systems/playerJumpMotion';
import { loadPlayerActionMotion, samplePlayerAction, type PlayerActionCue, type PlayerActionMotion } from '../systems/playerActionMotion';
import type { PlayerKissCue } from '../systems/hinataKiss';
import { registerVoiceAvatar } from '../systems/voiceAvatarRegistry';
import type { VoiceIndicator } from '../systems/voiceControls';
import character from './player-character.json';

/** Thời gian nội suy vào/ra tư thế chĩa súng hoặc gục (giây). */
const BLUFF_POSE_BLEND_SECONDS = 0.4;
/** Gục xuống bàn sau phát nổ chậm hơn hẳn (giây) để người xem kịp thấy cơ thể đổ xuống, không giật cái một. */
const BLUFF_SLUMP_BLEND_SECONDS = 1.3;
/** Hòa vào/ra clip hôn (giây) để không giật từ Idle sang Kiss và ngược lại. */
const KISS_BLEND_IN_SECONDS = 0.25;
const KISS_BLEND_OUT_SECONDS = 0.35;
/** Mốc cục bộ của cú nhảy ban công đang chiếu: bắt đầu khi lần đầu thấy jumpSpot mới từ server. */
type JumpClock = { spotId: string; startMs: number };
const smoothstep01 = (x: number) => { const t = THREE.MathUtils.clamp(x, 0, 1); return t * t * (3 - 2 * t); };
/**
 * Súng gắn dưới xương RightHand của rig đã clone. Phải là bản clone riêng vì súng trên bàn dùng chung scene đã cache.
 * Ma trận cục bộ tính lại mỗi frame (sau khi tư thế đã cộng ở priority -1.5) để súng giữ hướng theo model và cỡ mét thật:
 * trục/scale xương tay khác nhau giữa các rig nên một offset cục bộ cố định sẽ đặt súng sai chỗ hoặc lọt vào trong người.
 */
function HandGun({ root, hand }: { root: THREE.Object3D; hand: THREE.Object3D }) {
  const { scene } = useGLTF(BLUFF_REVOLVER_URL);
  const gun = useMemo(() => scene.clone(), [scene]);
  const holder = useRef<THREE.Group>(null);
  useFrame(() => {
    const group = holder.current;
    if (!group) return;
    bluffHandGunMatrix(root, hand, group.matrix);
    group.matrixWorldNeedsUpdate = true;
  }, -1.4);
  return createPortal(
    <group ref={holder} matrixAutoUpdate={false}><primitive object={gun} dispose={null} /></group>,
    hand,
  );
}

/** Quản lý clone rig và animation mixer đồng bộ, an toàn với React StrictMode và đảm bảo chuyển động mượt mà. */
function PlayerModel({
  player,
  speed,
  epoch,
  show,
  local = false,
  bluffPose = null,
  bluffTarget,
  kiss,
  restraint,
  jump,
  action,
}: {
  player: PositionSnapshot;
  speed: { current: number };
  epoch: number;
  show: ClubShow;
  local?: boolean;
  bluffPose?: BluffPose;
  bluffTarget?: { x: number; y: number; z: number };
  /** undefined: avatar này không bao giờ hôn (không tải clip). null: có thể hôn, hiện chưa. */
  kiss?: PlayerKissCue | null;
  /** undefined: ngoài Gekkarō (không tải clip). null: ở Gekkarō nhưng không bị trói. */
  restraint?: GekkaRestraintCue | null;
  /** Chỉ ở Kohaku: đồng hồ nhảy ban công do AvatarImpl giữ; undefined thì không tải clip nhảy. */
  jump?: RefObject<JumpClock>;
  /** Chỉ ngoài phố: động tác đấm/trúng đòn/hôn khi ngồi. undefined thì không tải clip. */
  action?: PlayerActionCue | null;
}) {
  const id = isPlayerCharacterId(player.characterId) ? player.characterId : DEFAULT_PLAYER_CHARACTER;
  const definition = PLAYER_CHARACTERS[id];
  const { scene, animations } = useGLTF(definition.url);
  const [controller, setController] = useState<ReturnType<typeof createPlayerAnimation> | null>(null);
  const currentMotion = useRef<'Idle' | 'Walk'>('Idle');
  const stopTimer = useRef(0);
  const poseWeight = useRef(0);
  const activePose = useRef<BluffPose>(null);
  // Giữ đích qua cả lúc blend ra (prop đã về undefined) để tay không giật về phía trước rồi mới hạ.
  const poseTarget = useRef(new THREE.Vector3());
  const hasPoseTarget = useRef(false);
  const poseCrossfade = useRef<{ pose: BluffPoseSnapshot; weight: number } | null>(null);
  const hand = useMemo(() => controller?.scene.getObjectByName('RightHand') ?? null, [controller]);
  const kissMotion = useRef<PlayerKissMotion | null>(null);
  const kissCue = useRef(kiss);
  kissCue.current = kiss;
  const canKiss = kiss !== undefined;
  const restraintMotion = useRef<GekkaRestraintMotion | null>(null);
  const restraintCue = useRef(restraint);
  restraintCue.current = restraint;
  const canRestrain = restraint !== undefined;
  const jumpMotion = useRef<PlayerJumpMotion | null>(null);
  const canJump = jump !== undefined;
  const actionMotion = useRef<PlayerActionMotion | null>(null);
  const actionCue = useRef(action);
  actionCue.current = action;
  const canAct = action !== undefined;

  useEffect(() => {
    if (!controller || !canAct) return;
    // Tải sẵn khi ra phố để cú đấm/hôn đầu tiên không trễ vì đang retarget.
    let alive = true;
    void loadPlayerActionMotion(controller.scene).then(motion => { if (alive) actionMotion.current = motion; }).catch(() => undefined);
    return () => {
      alive = false;
      actionMotion.current?.apply(null, 0);
      actionMotion.current = null;
    };
  }, [controller, canAct]);

  useEffect(() => {
    if (!controller || !canJump) return;
    // Tải sẵn khi vào Kohaku để lúc bấm nhảy clip đã retarget xong.
    let alive = true;
    void loadPlayerJumpMotion(controller.scene).then(motion => { if (alive) jumpMotion.current = motion; }).catch(() => undefined);
    return () => {
      alive = false;
      jumpMotion.current?.apply(undefined, 0);
      jumpMotion.current = null;
    };
  }, [controller, canJump]);

  useEffect(() => {
    if (!controller || !canRestrain) return;
    // Tải sẵn khi vào Gekkarō để lúc bị lôi xuống hầm tư thế trói và clip trúng đòn đã retarget xong.
    let alive = true;
    void loadGekkaRestraintMotion(controller.scene).then(motion => { if (alive) restraintMotion.current = motion; }).catch(() => undefined);
    return () => {
      alive = false;
      restraintMotion.current?.reset();
      restraintMotion.current = null;
    };
  }, [controller, canRestrain]);

  useEffect(() => {
    if (!controller || !canKiss) return;
    // Tải sẵn khi vào Kohaku để lúc bấm Kiss clip đã retarget xong, không trễ nhịp với Hinata.
    let alive = true;
    void loadPlayerKissMotion(controller.scene).then(motion => { if (alive) kissMotion.current = motion; }).catch(() => undefined);
    return () => {
      alive = false;
      kissMotion.current?.apply(0, 0);
      kissMotion.current = null;
    };
  }, [controller, canKiss]);

  useEffect(() => {
    const instance = createPlayerAnimation(scene, animations, definition.guitar);
    setController(instance);
    return () => instance.dispose();
  }, [scene, animations, definition.guitar]);

  useFrame((state, delta) => {
    // Đổi thẳng từ pose này sang pose khác (aim -> slump): chụp tư thế đang hiển thị TRƯỚC khi mixer ghi đè,
    // rồi nội suy từ ảnh chụp sang pose mới. Không reset weight về 0 vì như thế tay súng bật về tư thế ngồi rồi mới gục.
    if (controller && bluffPose && activePose.current && activePose.current !== bluffPose && poseWeight.current > 0) {
      poseCrossfade.current = { pose: snapshotBluffPose(controller.scene), weight: 0 };
    }
    // Cơ chế trễ trạng thái (Hysteresis & Debounce) giúp bước đi mượt mà.
    // Với người chơi local: khi nhả phím, chuyển ngay về Idle trong 30ms (1-2 frame) triệt tiêu cảm giác trễ bước chân.
    // Với remote: giữ debounce 140ms để tránh giật khựng khi gói mạng đến trễ.
    const stopThreshold = local ? 0.03 : 0.14;
    let nextMotion: 'Idle' | 'Walk' = currentMotion.current;
    if (currentMotion.current === 'Idle') {
      if (speed.current > 0.18) {
        nextMotion = 'Walk';
        stopTimer.current = 0;
      }
    } else {
      if (speed.current < 0.08) {
        stopTimer.current += delta;
        if (stopTimer.current > stopThreshold) {
          nextMotion = 'Idle';
        }
      } else {
        stopTimer.current = 0;
      }
    }
    currentMotion.current = nextMotion;

    controller?.update(
      delta,
      player.seatId && !isGekkaCaptiveSeat(player.seatId)
        ? 'Sit'
        : player.dancing
          ? PLAYER_DANCES[player.danceStyle ?? 'normal'].clip
          : currentMotion.current,
      speed.current,
      epoch,
      show,
    );

    const cue = kissCue.current;
    if (kissMotion.current) {
      const now = performance.now();
      const seconds = cue ? (now - cue.startAt) / 1000 : 0;
      const weight = !cue || seconds < 0
        ? 0
        : Math.min(smoothstep01(seconds / KISS_BLEND_IN_SECONDS), smoothstep01((cue.endAt - now) / 1000 / KISS_BLEND_OUT_SECONDS));
      // Gọi cả khi weight 0 để trả xương về nền sau lần hôn.
      kissMotion.current.apply(seconds, weight);
    }
    // Hôn chỉ khi còn ngồi: người đứng dậy giữa chừng thì thôi chồng clip.
    const act = actionCue.current;
    actionMotion.current?.apply(act?.kind === 'seatKiss' && !player.seatId ? null : act, performance.now());
    if (jumpMotion.current && jump?.current) {
      const clock = jump.current;
      jumpMotion.current.apply(getKohakuJumpSpot(clock.spotId), (performance.now() - clock.startMs) / 1000);
    }
    // Sau mixer nền: khóa tay chân vào khung/cùm, thân trên lắc và giật theo cú đấm.
    restraintMotion.current?.apply(performance.now(), delta, restraintCue.current ?? null);

    if (bluffPose) activePose.current = bluffPose;
    if (bluffTarget) { poseTarget.current.set(bluffTarget.x, bluffTarget.y, bluffTarget.z); hasPoseTarget.current = true; }
    poseWeight.current = THREE.MathUtils.clamp(
      poseWeight.current + (bluffPose ? 1 : -1) * Math.min(delta, 0.1) / (bluffPose === 'slump' ? BLUFF_SLUMP_BLEND_SECONDS : BLUFF_POSE_BLEND_SECONDS), 0, 1,
    );
    // Gọi sau mixer.update: mixer ghi đè quaternion xương mỗi frame nên phần cộng thêm không bị cộng dồn.
    // Bỏ qua hẳn khi không có pose; lần gọi cuối với weight 0 trả xương về nền rồi mới tắt.
    const crossfade = poseCrossfade.current;
    if (crossfade) {
      const blendSeconds = activePose.current === 'slump' ? BLUFF_SLUMP_BLEND_SECONDS : BLUFF_POSE_BLEND_SECONDS;
      crossfade.weight = Math.min(1, crossfade.weight + Math.min(delta, 0.1) / blendSeconds);
      if (crossfade.weight >= 1) poseCrossfade.current = null;
    }
    if (controller && activePose.current) {
      // Easing smoothstep: tay/thân tăng tốc rồi hãm lại, không bắt đầu và dừng đột ngột như nội suy tuyến tính.
      const ease = (x: number) => x * x * (3 - 2 * x);
      applyBluffPose(
        controller.scene, activePose.current, ease(poseWeight.current), hasPoseTarget.current ? poseTarget.current : undefined,
        state.clock.elapsedTime, crossfade && { pose: crossfade.pose, weight: ease(crossfade.weight) },
      );
      if (poseWeight.current === 0 && !bluffPose) { activePose.current = null; poseCrossfade.current = null; }
    }
  }, -1.5);

  return controller ? (
    <>
      <primitive object={controller.scene} dispose={null} />
      {bluffPose === 'aim' && hand && <Suspense fallback={null}><HandGun root={controller.scene} hand={hand} /></Suspense>}
    </>
  ) : null;
}

/** Root luôn giữ vị trí nội suy cho camera; animation chỉ tác động rig bên trong. */
function AvatarImpl({
  player,
  local,
  objectRef,
  localMove,
  epoch = 0,
  show = DEFAULT_CLUB_SHOW,
  zone = 'street',
  bluffPose = null,
  bluffTarget,
  kiss,
  restraint,
  voice,
  action,
}: {
  player: PositionSnapshot;
  local: boolean;
  objectRef?: RefObject<THREE.Group | null>;
  localMove?: RefObject<MoveInput>;
  epoch?: number;
  show?: ClubShow;
  zone?: WorldZone;
  bluffPose?: BluffPose;
  bluffTarget?: { x: number; y: number; z: number };
  /** Chỉ avatar local ở Kohaku: undefined nếu không bao giờ hôn, null khi chưa có lệnh hôn. */
  kiss?: PlayerKissCue | null;
  /** Ở Gekkarō: lệnh trói khi bị giữ ở hầm; undefined ở zone khác. */
  restraint?: GekkaRestraintCue | null;
  /** Chỉ báo voice trên bảng tên: đang nói hoặc đã tắt tiếng. */
  voice?: VoiceIndicator;
  /** Ngoài phố: động tác đấm/trúng đòn/hôn ghế đá (null khi không có); undefined ở zone khác. */
  action?: PlayerActionCue | null;
}) {
  const ownRef = useRef<THREE.Group>(null);
  const visual = useRef<THREE.Group>(null);
  // Vị trí/hướng hiển thị (thế giới) khi avatar bước tới Hinata; gốc avatar vẫn ở vị trí authoritative của server.
  const glide = useRef({ active: false, x: 0, z: 0, yaw: 0 });
  const root = objectRef ?? ownRef;
  const [initialPosition] = useState<[number, number, number]>(() => [
    player.x,
    zone === 'lounge'
      ? getLoungeSurfaceY(player.x, player.z)
      : zone === 'kohaku'
        ? (player.y ?? getKohakuSurfaceY(player.x, player.z, 0))
        : zone === 'gekka'
          ? (player.y ?? getGekkaSurfaceY(player.x, player.z, 0))
          : 0,
    player.z,
  ]);
  const [initialRotation] = useState<[number, number, number]>(() => [0, player.yaw, 0]);
  const speed = useRef(0);
  const jumpClock = useRef<JumpClock>({ spotId: '', startMs: 0 });
  const [presentation] = useState(() => createPlayerPresentation(player, performance.now()));

  useLayoutEffect(() => {
    presentation.push(player, performance.now());
  }, [player, presentation]);
  // Âm thanh voice lấy vị trí đã nội suy của gốc avatar, không phải patch 10 Hz.
  useEffect(() => root.current ? registerVoiceAvatar(player.id, root.current) : undefined, [player.id, root]);

  useFrame((_, delta) => {
    if (!root.current) return;

    // Nhảy ban công Kohaku: chiếu đúng quỹ đạo dùng chung với server theo đồng hồ cục bộ, mượt hơn patch 10 Hz.
    if (zone === 'kohaku') {
      const clock = jumpClock.current, now = performance.now();
      if (player.jumpSpot && player.jumpSpot !== clock.spotId) { clock.spotId = player.jumpSpot; clock.startMs = now; }
      const spot = getKohakuJumpSpot(clock.spotId), seconds = (now - clock.startMs) / 1000;
      if (spot && seconds < kohakuJumpDuration(spot)) {
        const pose = sampleKohakuJump(spot, seconds);
        root.current.position.set(pose.x, pose.y, pose.z);
        root.current.rotation.y = pose.yaw;
        speed.current = 0;
        return;
      }
      // Giữ id đến khi server xóa jumpSpot để không phát lại cú nhảy vừa xong.
      if (!player.jumpSpot) clock.spotId = '';
    }

    if (local && localMove) {
      // Xử lý di chuyển local mượt mà không độ trễ (Client prediction) kèm đồng bộ vị trí server (Server reconciliation)
      const resolveY = (x: number, z: number, refY: number) =>
        zone === 'lounge'
          ? getLoungeSurfaceY(x, z)
          : zone === 'kohaku'
            ? getKohakuSurfaceY(x, z, refY)
            : zone === 'gekka'
              ? getGekkaSurfaceY(x, z, refY)
              : 0;
      // Kohaku và Gekkarō có nhiều tầng: Y lấy từ server/bước đi, không suy từ X/Z.
      const layered = zone === 'kohaku' || zone === 'gekka';
      const resolveStep = zone === 'gekka' ? resolveGekkaStep : resolveKohakuStep;

      if (player.seatId) {
        // Đang ngồi: cố định tại ghế
        const posY = layered ? (player.y ?? 0) : resolveY(player.x, player.z, 0);
        root.current.position.set(player.x, posY, player.z);
        root.current.rotation.y = player.yaw;
        speed.current = 0;
        return;
      }

      if (player.dancing) {
        // Đang nhảy: giữ nguyên vị trí, không nhận di chuyển
        speed.current = 0;
        return;
      }

      const input = localMove.current;
      const isMoving = input && (input.x !== 0 || input.z !== 0);
      const dt = Math.min(delta, 0.1);
      const serverY = player.y ?? 0;

      if (isMoving) {
        const dx = input.x * MOVE_SPEED * dt;
        const dz = input.z * MOVE_SPEED * dt;
        let nextX = root.current.position.x;
        let nextY = root.current.position.y;
        let nextZ = root.current.position.z;

        if (layered) {
          const diag = resolveStep(nextX, nextY, nextZ, nextX + dx, nextZ + dz);
          if (diag.allowed) {
            nextX += dx;
            nextZ += dz;
            nextY = diag.y;
          } else {
            const stepX = resolveStep(nextX, nextY, nextZ, nextX + dx, nextZ);
            if (stepX.allowed) {
              nextX += dx;
              nextY = stepX.y;
            }
            const stepZ = resolveStep(nextX, nextY, nextZ, nextX, nextZ + dz);
            if (stepZ.allowed) {
              nextZ += dz;
              nextY = stepZ.y;
            }
          }
        } else {
          const walkable =
            zone === 'club'
              ? isClubWalkable
              : zone === 'lounge'
                ? isLoungeWalkable
                : zone === 'hotel'
                  ? isHotelWalkable
                  : isWalkable;
          if (walkable(nextX + dx, nextZ + dz)) {
            nextX += dx;
            nextZ += dz;
          } else {
            if (walkable(nextX + dx, nextZ)) nextX += dx;
            if (walkable(nextX, nextZ + dz)) nextZ += dz;
          }
          nextY = resolveY(nextX, nextZ, nextY);
        }

        // Đồng bộ server: nếu lệch lớn do teleport/portal/khác tầng thì snap, lệch nhỏ thì hòa trộn êm dịu chống trôi
        const distToServer = Math.hypot(nextX - player.x, nextZ - player.z);
        if (distToServer > 2.0 || Math.abs(nextY - serverY) > 1.2) {
          nextX = player.x;
          nextZ = player.z;
          nextY = layered ? serverY : resolveY(nextX, nextZ, serverY);
        } else if (distToServer > 0.04) {
          const blend = 1 - Math.exp(-4 * dt);
          nextX = THREE.MathUtils.lerp(nextX, player.x, blend);
          nextZ = THREE.MathUtils.lerp(nextZ, player.z, blend);
          nextY = resolveY(nextX, nextZ, serverY);
        }

        root.current.position.set(nextX, nextY, nextZ);

        // Quay mặt mượt mà theo hướng di chuyển
        const targetYaw = Math.atan2(input.x, input.z);
        const turn = Math.atan2(Math.sin(targetYaw - root.current.rotation.y), Math.cos(targetYaw - root.current.rotation.y));
        root.current.rotation.y += turn * (1 - Math.exp(-22 * dt));

        speed.current = MOVE_SPEED;
      } else {
        // Người chơi đã nhả phím di chuyển: dừng ngay tức thì, không đi thêm
        speed.current = 0;
        const distToServer = Math.hypot(root.current.position.x - player.x, root.current.position.z - player.z);
        if (distToServer > 2.0 || Math.abs(root.current.position.y - serverY) > 1.2) {
          const posY = layered ? serverY : resolveY(player.x, player.z, serverY);
          root.current.position.set(player.x, posY, player.z);
          root.current.rotation.y = player.yaw;
        } else if (distToServer > 0.002 || Math.abs(root.current.position.y - serverY) > 0.002) {
          const nextX = THREE.MathUtils.damp(root.current.position.x, player.x, 16, dt);
          const nextZ = THREE.MathUtils.damp(root.current.position.z, player.z, 16, dt);
          const posY = resolveY(nextX, nextZ, serverY);
          root.current.position.set(nextX, posY, nextZ);
        }
      }
    } else {
      // Remote player: dùng nội suy snapshot mạng mượt mà
      speed.current = presentation.update(root.current, delta, performance.now(), zone);
    }
  }, -2);

  // Hôn trên ghế đá: phần hiển thị chỉ nhích sát về phía bạn ngồi cạnh (thân trên xoắn/nghiêng trong PlayerModel), gốc vẫn ở ghế.
  useFrame(() => {
    const v = visual.current, r = root.current;
    if (!v || !r || action === undefined) return;
    const sample = action?.kind === 'seatKiss' && player.seatId ? samplePlayerAction(action, performance.now()) : null;
    if (!sample) {
      if (v.position.lengthSq() > 0) v.position.set(0, 0, 0);
      return;
    }
    // Trọng số clip đã hòa vào/ra mượt nên dùng thẳng, không cần damp riêng.
    const w = sample.weight, c = Math.cos(r.rotation.y), sn = Math.sin(r.rotation.y);
    const ox = (action?.slideX ?? 0) * w, oz = (action?.slideZ ?? 0) * w;
    v.position.set(ox * c - oz * sn, 0, ox * sn + oz * c);
  }, -1.85);

  // Cảnh hôn Hinata: chỉ phần hiển thị bước tới chỗ đứng (có anim đi bộ), quay mặt vào Hinata, hôn xong đi về gốc.
  // Không đổi vị trí gốc nên không lệch với server; người chơi bị khóa di chuyển trong lúc hôn (npcBusy ở World).
  useFrame((_, delta) => {
    const r = root.current, v = visual.current, g = glide.current;
    if (!r || !v) return;
    const cue = kiss && performance.now() < kiss.endAt ? kiss : null;
    if (!cue && !g.active) return;
    if (!g.active) { g.active = true; g.x = r.position.x; g.z = r.position.z; g.yaw = r.rotation.y; }
    const dt = Math.min(delta, 0.1);
    const tx = cue ? cue.x : r.position.x, tz = cue ? cue.z : r.position.z;
    const dx = tx - g.x, dz = tz - g.z, dist = Math.hypot(dx, dz);
    let faceYaw = cue ? cue.yaw : r.rotation.y;
    if (dist > 0.01) {
      const step = Math.min(1, MOVE_SPEED * dt / dist);
      g.x += dx * step; g.z += dz * step;
      faceYaw = Math.atan2(dx, dz);
      speed.current = MOVE_SPEED;
    } else {
      g.x = tx; g.z = tz;
    }
    const turn = Math.atan2(Math.sin(faceYaw - g.yaw), Math.cos(faceYaw - g.yaw));
    g.yaw += turn * (1 - Math.exp(-22 * dt));
    if (!cue && dist <= 0.01 && Math.abs(turn) < 0.02) {
      g.active = false;
      v.position.set(0, 0, 0);
      v.rotation.set(0, 0, 0);
      return;
    }
    // Đổi độ lệch thế giới sang hệ cục bộ của gốc (gốc chỉ xoay quanh Y).
    const ox = g.x - r.position.x, oz = g.z - r.position.z, c = Math.cos(r.rotation.y), sn = Math.sin(r.rotation.y);
    v.position.set(ox * c - oz * sn, 0, ox * sn + oz * c);
    v.rotation.set(0, g.yaw - r.rotation.y, 0);
  }, -1.9);

  return (
    <group ref={root} position={initialPosition} rotation={initialRotation} name={local ? 'local-avatar' : 'remote-avatar'}>
      <group ref={visual}>
        <Suspense fallback={<mesh position={[0, .9, 0]}><capsuleGeometry args={[.25, 1, 4, 8]}/><meshStandardMaterial color="#e8a3c0" wireframe/></mesh>}>
          <PlayerModel player={player} speed={speed} epoch={epoch} show={show} local={local} bluffPose={bluffPose} bluffTarget={bluffTarget} kiss={kiss} restraint={restraint} jump={zone === 'kohaku' ? jumpClock : undefined} action={action} />
        </Suspense>
        <Billboard position={[0, character.height + .22, 0]}>
          <Text fontSize={.125} color={local ? '#ffe9ab' : '#ffffff'} anchorX="center" outlineWidth={.01} outlineColor="#171025" maxWidth={2.0}>
            {local ? `${player.name} (bạn)` : player.name}
          </Text>
          {voice && <mesh position={[0, .17, 0]}>
            <circleGeometry args={[voice === 'speaking' ? .055 : .04, 16]}/>
            <meshBasicMaterial color={voice === 'speaking' ? '#5dffb0' : '#ff6b8a'} toneMapped={false}/>
          </mesh>}
        </Billboard>
      </group>
    </group>
  );
}

// memo chỉ có tác dụng khi vị trí rời khỏi state `players` (refactor 1b); hiện sampleTime đổi mỗi patch nên `player` luôn là object mới.
export const Avatar = memo(AvatarImpl);
