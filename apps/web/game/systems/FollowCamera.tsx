'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, type RefObject } from 'react';
import * as THREE from 'three';
import { COLLIDERS, CLUB_COLLIDERS, LOUNGE_COLLIDERS, HOTEL_COLLIDERS, KOHAKU_COLLIDERS, BLUFF_TIMING, type PositionSnapshot, type WorldZone } from '@metaverse/game-protocol';
import character from '../entities/player-character.json';
import { CLOSEUP_PUSH_RATIO, closeupPush } from './bluffStaging';
import { isGekkaCaptiveSeat } from './gekkaPokerView';

export type CameraViewMode = 'overview' | 'character';
/** Điểm cận cảnh: vị trí chân người ở ghế (x, y, z) và hướng mặt (yaw). */
/** Cận cảnh: (x, y, z) là vị trí đầu cần đặt giữa khung hình (thế giới), yaw là hướng mặt của người đó. */
/** pushSince: performance.now() lúc bắt đầu nhịp chờ bóp cò; có thì camera đẩy sát dần trong suspenseMs. */
export type CameraFocusOverride = { x: number; y: number; z: number; yaw: number; pushSince?: number };
const CLOSEUP_DISTANCE = 1.8; // m phía trước mặt, về phía tâm bàn; đủ xa để thấy cả thân trên lẫn mép bàn khi gục
const CLOSEUP_CAMERA_RISE = 0.12; // camera nhỉnh hơn tầm mắt một chút, nhìn xuống được mặt bàn
const CLOSEUP_LOOK_DROP = 0.15; // nhìn thấp hơn tâm đầu để thấy cả tay cầm súng và lúc gục xuống bàn

type ViewDiagnostics = { x: number; z: number; rawX: number; rawZ: number; cameraX: number; cameraZ: number; yaw: number; pitch: number; radius: number; screenX: number; screenY: number };
type DebugCanvas = HTMLCanvasElement & { neonView?: ViewDiagnostics };

/** Camera hỗ trợ 2 chế độ: Toàn cảnh Đảo (overview) và Góc nhìn Nhân vật (character); góc orbit độc lập với các state patch mạng. */
export function FollowCamera({
  target,
  targetObject,
  zone = 'street',
  mode = 'overview',
  focusOverride = null,
}: {
  target?: PositionSnapshot;
  targetObject: RefObject<THREE.Group | null>;
  zone?: WorldZone;
  mode?: CameraViewMode;
  focusOverride?: CameraFocusOverride | null;
}) {
  const { gl } = useThree();
  const canvas = gl.domElement as DebugCanvas;
  const isOverview = mode === 'overview' && zone === 'street';
  const rig = useMemo(() => {
    const activeColliders = zone === 'club' ? CLUB_COLLIDERS : zone === 'lounge' ? LOUNGE_COLLIDERS : zone === 'hotel' ? HOTEL_COLLIDERS : zone === 'kohaku' ? KOHAKU_COLLIDERS : zone === 'gekka' ? [] : COLLIDERS;
    const bounds = activeColliders.map(b => new THREE.Box3(
      new THREE.Vector3(b.xMin, 0, b.zMin), new THREE.Vector3(b.xMax, zone === 'club' ? (b === CLUB_COLLIDERS[0] ? .8 : b === CLUB_COLLIDERS[3] ? .65 : 1.45) : zone === 'lounge' ? 1.35 : zone === 'hotel' ? 1.15 : zone === 'kohaku' ? 1.4 : 24, b.zMax),
    ));
    if (zone === 'club') {
      bounds.push(
        new THREE.Box3(new THREE.Vector3(-8.2, 0, -8.2), new THREE.Vector3(-7.8, 5.6, 8.1)),
        new THREE.Box3(new THREE.Vector3(7.8, 0, -8.2), new THREE.Vector3(8.2, 5.6, 8.1)),
        new THREE.Box3(new THREE.Vector3(-8.2, 0, -8.2), new THREE.Vector3(8.2, 5.6, -7.8)),
        new THREE.Box3(new THREE.Vector3(-8.2, 0, 7.8), new THREE.Vector3(-1.6, 5.6, 8.2)),
        new THREE.Box3(new THREE.Vector3(1.6, 0, 7.8), new THREE.Vector3(8.2, 5.6, 8.2)),
        new THREE.Box3(new THREE.Vector3(-1.6, 3.2, 7.8), new THREE.Vector3(1.6, 5.6, 8.2)),
        new THREE.Box3(new THREE.Vector3(-8.2, 5.5, -8.2), new THREE.Vector3(8.2, 6, 8.2)),
      );
    } else if (zone === 'lounge') {
      bounds.push(
        new THREE.Box3(new THREE.Vector3(-7.3, 0, -7.3), new THREE.Vector3(-6.9, 5.2, 7.2)),
        new THREE.Box3(new THREE.Vector3(6.9, 0, -7.3), new THREE.Vector3(7.3, 5.2, 7.2)),
        new THREE.Box3(new THREE.Vector3(-7.3, 0, -7.3), new THREE.Vector3(7.3, 5.2, -6.9)),
        new THREE.Box3(new THREE.Vector3(-7.3, 0, 6.8), new THREE.Vector3(-1.55, 2.8, 7.2)),
        new THREE.Box3(new THREE.Vector3(1.55, 0, 6.8), new THREE.Vector3(7.3, 5.2, 7.2)),
        new THREE.Box3(new THREE.Vector3(-7.3, 5.1, -7.3), new THREE.Vector3(7.3, 5.6, 7.2)),
      );
    } else if (zone === 'hotel') {
      bounds.push(
        new THREE.Box3(new THREE.Vector3(-6.2, 0, -6.2), new THREE.Vector3(-5.8, 4.6, 6.1)),
        new THREE.Box3(new THREE.Vector3(5.8, 0, -6.2), new THREE.Vector3(6.2, 4.6, 6.1)),
        new THREE.Box3(new THREE.Vector3(-6.2, 0, -6.2), new THREE.Vector3(6.2, 4.6, -5.8)),
        new THREE.Box3(new THREE.Vector3(-6.2, 0, 5.7), new THREE.Vector3(-1.3, 2.7, 6.1)),
        new THREE.Box3(new THREE.Vector3(1.3, 0, 5.7), new THREE.Vector3(6.2, 2.7, 6.1)),
      );
    } else if (zone === 'kohaku') {
      bounds.push(
        new THREE.Box3(new THREE.Vector3(-7.8, 0, -7.8), new THREE.Vector3(-7.35, 11.2, 7.8)),
        new THREE.Box3(new THREE.Vector3(7.35, 0, -7.8), new THREE.Vector3(7.8, 11.2, 7.8)),
        new THREE.Box3(new THREE.Vector3(-7.8, 0, -7.8), new THREE.Vector3(7.8, 11.2, -7.35)),
        new THREE.Box3(new THREE.Vector3(-7.8, 0, 7.35), new THREE.Vector3(-1.3, 11.2, 7.8)),
        new THREE.Box3(new THREE.Vector3(1.3, 0, 7.35), new THREE.Vector3(7.8, 11.2, 7.8)),
        new THREE.Box3(new THREE.Vector3(-1.4, 3.1, 7.35), new THREE.Vector3(1.4, 11.2, 7.8)),
        new THREE.Box3(new THREE.Vector3(-7.8, 11.0, -7.8), new THREE.Vector3(7.8, 11.6, 7.8)),
      );
    } else if (zone === 'gekka') {
      // Tường tầng trên, tường hầm và trần hầm (chừa lỗ cầu thang) để camera không chui qua sàn khi người chơi ở dưới hầm.
      bounds.push(
        new THREE.Box3(new THREE.Vector3(-7.8, -3.2, -7.8), new THREE.Vector3(-7.4, 4.4, 7.8)),
        new THREE.Box3(new THREE.Vector3(7.4, -3.2, -7.8), new THREE.Vector3(7.8, 4.4, 7.8)),
        new THREE.Box3(new THREE.Vector3(-7.8, -3.2, -7.8), new THREE.Vector3(7.8, 4.4, -7.4)),
        new THREE.Box3(new THREE.Vector3(-7.8, 0, 7.4), new THREE.Vector3(-1.3, 4.4, 7.8)),
        new THREE.Box3(new THREE.Vector3(1.3, 0, 7.4), new THREE.Vector3(7.8, 4.4, 7.8)),
        new THREE.Box3(new THREE.Vector3(-7.8, 4.2, -7.8), new THREE.Vector3(7.8, 4.8, 7.8)),
        new THREE.Box3(new THREE.Vector3(-6.6, -3.2, 3.8), new THREE.Vector3(7.4, -0.3, 4.2)),
        new THREE.Box3(new THREE.Vector3(-6.6, -3.2, -6.6), new THREE.Vector3(-6.2, -0.3, 4.2)),
        new THREE.Box3(new THREE.Vector3(-7.4, -0.3, -7.4), new THREE.Vector3(5.2, 0, 7.4)),
        new THREE.Box3(new THREE.Vector3(5.2, -0.3, -7.4), new THREE.Vector3(7.4, 0, -1.5)),
        new THREE.Box3(new THREE.Vector3(5.2, -0.3, 3.5), new THREE.Vector3(7.4, 0, 7.4)),
      );
    }
    const initBehindYaw = (target?.yaw ?? 0) + Math.PI;
    const defaultYaw = isOverview ? Math.PI : initBehindYaw;
    const defaultDist = isOverview ? 28 : zone === 'street' ? 6.2 : 3.8;
    return {
      focus: new THREE.Vector3(0, 2.2, 0),
      targetFocus: new THREE.Vector3(0, 2.2, 0),
      direction: new THREE.Vector3(),
      hit: new THREE.Vector3(),
      screen: new THREE.Vector3(),
      ray: new THREE.Ray(),
      bounds,
      yaw: defaultYaw,
      wantedYaw: defaultYaw,
      pitch: isOverview ? 0.44 : 0.26,
      wantedPitch: isOverview ? 0.44 : 0.26,
      distance: defaultDist,
      wantedDistance: defaultDist,
      resolvedDistance: defaultDist,
      snap: true,
      alignRequested: false,
      lastSample: 0,
      prevSeatId: target?.seatId ?? '',
      isOverview,
      diagnostics: { x: 0, z: 0, rawX: 0, rawZ: 0, cameraX: 0, cameraZ: 0, yaw: defaultYaw, pitch: .36, radius: 0, screenX: 0, screenY: 0 } as ViewDiagnostics,
    };
  }, [zone]);

  // Hệ số pha trộn sang cận cảnh (0 = camera thường), giữ ngoài rig để không bị reset khi đổi zone.
  const closeup = useMemo(() => ({ blend: 0, position: new THREE.Vector3(), look: new THREE.Vector3(), lookAt: new THREE.Vector3(), last: null as CameraFocusOverride | null }), []);

  // Đồng bộ khoảng cách, góc nghiêng và góc quay chuẩn sau lưng góc nhìn nhân vật khi chuyển đổi chế độ góc nhìn
  useEffect(() => {
    rig.isOverview = isOverview;
    if (isOverview) {
      rig.wantedDistance = 28;
      rig.wantedPitch = 0.44;
      rig.wantedYaw = Math.PI;
      rig.alignRequested = false;
    } else {
      rig.wantedDistance = zone === 'street' ? 6.2 : 3.8;
      rig.wantedPitch = 0.24;
      rig.alignRequested = true;
    }
  }, [isOverview, rig, zone]);

  useEffect(() => {
    let pointer: number | null = null;
    let lastX = 0, lastY = 0;
    const previous = { cursor: canvas.style.cursor, touchAction: canvas.style.touchAction, tabIndex: canvas.tabIndex };
    canvas.style.cursor = 'grab'; canvas.style.touchAction = 'none'; canvas.tabIndex = 0;
    const down = (event: PointerEvent) => {
      if (pointer !== null || (event.button !== 0 && event.button !== 2)) return;
      pointer = event.pointerId; lastX = event.clientX; lastY = event.clientY;
      canvas.focus({ preventScroll: true }); canvas.setPointerCapture(pointer); canvas.style.cursor = 'grabbing';
      event.preventDefault();
    };
    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointer) return;
      if (event.pointerType === 'mouse' && event.buttons === 0) { release(); return; }
      rig.wantedYaw -= (event.clientX - lastX) * .005;
      rig.wantedPitch = THREE.MathUtils.clamp(rig.wantedPitch + (event.clientY - lastY) * .004, .08, 1.2);
      lastX = event.clientX; lastY = event.clientY;
    };
    const release = () => {
      if (pointer !== null && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
      pointer = null; canvas.style.cursor = 'grab';
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const minD = rig.isOverview ? 14 : (rig.prevSeatId ? 0.8 : 1.6);
      const maxD = rig.isOverview ? 55 : 12;
      rig.wantedDistance = THREE.MathUtils.clamp(rig.wantedDistance * Math.exp(event.deltaY * .001), minD, maxD);
    };
    const contextMenu = (event: Event) => event.preventDefault();
    const keydown = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (event.code === 'KeyC' && !rig.isOverview) {
        rig.alignRequested = true;
      }
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('lostpointercapture', release);
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('contextmenu', contextMenu);
    window.addEventListener('keydown', keydown);
    window.addEventListener('blur', release);
    window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true);
    if (process.env.NODE_ENV === 'development') canvas.neonView = rig.diagnostics;
    return () => {
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', release); canvas.removeEventListener('pointercancel', release);
      canvas.removeEventListener('lostpointercapture', release); canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('contextmenu', contextMenu); window.removeEventListener('keydown', keydown);
      window.removeEventListener('blur', release);
      window.removeEventListener('pointerup', release, true); window.removeEventListener('pointercancel', release, true);
      release(); canvas.style.cursor = previous.cursor; canvas.style.touchAction = previous.touchAction; canvas.tabIndex = previous.tabIndex;
      delete canvas.neonView;
    };
  }, [canvas, rig]);

  useFrame(({ camera, clock }, delta) => {
    const avatar = targetObject.current;
    if (!target || !avatar) return;
    const dt = Math.min(delta, .1), orbitAlpha = 1 - Math.exp(-14 * dt);

    // Người bị trói ở hầm đứng chứ không ngồi: camera đi theo như lúc đứng.
    const currentSeat = isGekkaCaptiveSeat(target.seatId) ? '' : target.seatId ?? '';

    // Khi mới vào zone ở góc nhìn thứ 3 hoặc được yêu cầu căn lại góc nhìn (C / chuyển chế độ)
    if (rig.snap && !rig.isOverview) {
      const behind = target.yaw + Math.PI;
      rig.yaw = behind;
      rig.wantedYaw = behind;
      rig.alignRequested = false;
    } else if (rig.alignRequested && !rig.isOverview) {
      rig.wantedYaw = (currentSeat ? target.yaw : avatar.rotation.y) + Math.PI;
      if (currentSeat) {
        rig.wantedPitch = 0.46;
        rig.wantedDistance = 1.42;
      } else {
        rig.wantedPitch = 0.24;
        rig.wantedDistance = zone === 'street' ? 6.2 : 3.8;
      }
      rig.alignRequested = false;
    }

    // Khi ngồi vào ghế hoặc đứng dậy: đưa góc nhìn về đúng tầm mắt cao phía trước nhân vật (bao quát bàn, không bị lưng che)
    if (currentSeat !== rig.prevSeatId) {
      rig.prevSeatId = currentSeat;
      if (!rig.isOverview) {
        rig.wantedYaw = target.yaw + Math.PI;
        if (currentSeat) {
          rig.wantedPitch = 0.46;
          rig.wantedDistance = 1.42;
        } else {
          rig.wantedPitch = 0.24;
          rig.wantedDistance = zone === 'street' ? 6.2 : 3.8;
        }
      }
    }

    const yawDiff = Math.atan2(Math.sin(rig.wantedYaw - rig.yaw), Math.cos(rig.wantedYaw - rig.yaw));
    rig.yaw += yawDiff * orbitAlpha;
    rig.pitch += (rig.wantedPitch - rig.pitch) * orbitAlpha;
    rig.distance += (rig.wantedDistance - rig.distance) * orbitAlpha;

    // Khi ngồi: đặt điểm nhìn tiến ra phía trước bàn (1.55m) và nâng góc nhìn cao (~1.61m) để quan sát rõ toàn bộ bàn chơi bài
    rig.targetFocus.copy(avatar.position);
    if (currentSeat) {
      rig.targetFocus.x += Math.sin(target.yaw) * 1.55;
      rig.targetFocus.z += Math.cos(target.yaw) * 1.55;
      rig.targetFocus.y += 0.98;
    } else {
      rig.targetFocus.y += character.height * .82;
    }

    if (rig.snap) {
      rig.focus.copy(rig.targetFocus);
    } else {
      rig.focus.lerp(rig.targetFocus, orbitAlpha);
    }

    const horizontal = Math.cos(rig.pitch);
    rig.direction.set(Math.sin(rig.yaw) * horizontal, Math.sin(rig.pitch), Math.cos(rig.yaw) * horizontal);
    rig.ray.set(rig.focus, rig.direction);
    let allowed = rig.distance;
    if (!rig.isOverview) {
      for (const box of rig.bounds) {
        if (!rig.ray.intersectBox(box, rig.hit)) continue;
        const hitDistance = rig.focus.distanceTo(rig.hit);
        allowed = Math.min(allowed, Math.max(.001, hitDistance > .2 ? hitDistance - .2 : hitDistance * .5));
      }
    }
    // Thu vào ngay để tránh xuyên tường; giãn ra từ từ khi rời vật cản để không bật camera đột ngột.
    if (rig.snap || allowed < rig.resolvedDistance) rig.resolvedDistance = allowed;
    else rig.resolvedDistance += (allowed - rig.resolvedDistance) * (1 - Math.exp(-10 * dt));
    rig.snap = false;
    camera.position.copy(rig.focus).addScaledVector(rig.direction, rig.resolvedDistance);
    // Cận cảnh: pha trộn từ camera thường sang góc nhìn trước mặt người bắn, và trả về mượt khi hết override.
    if (focusOverride) closeup.last = focusOverride;
    closeup.blend += ((focusOverride ? 1 : 0) - closeup.blend) * (1 - Math.exp(-5 * dt));
    if (closeup.blend < .001 && !focusOverride) { closeup.blend = 0; closeup.last = null; }
    const lookAt = closeup.lookAt;
    if (closeup.last && closeup.blend > 0) {
      const o = closeup.last;
      const push = o.pushSince === undefined ? 0 : closeupPush(o.pushSince, performance.now(), BLUFF_TIMING.suspenseMs);
      const distance = CLOSEUP_DISTANCE * (1 - CLOSEUP_PUSH_RATIO * push);
      closeup.position.set(o.x + Math.sin(o.yaw) * distance, o.y + CLOSEUP_CAMERA_RISE, o.z + Math.cos(o.yaw) * distance);
      closeup.look.set(o.x, o.y - CLOSEUP_LOOK_DROP, o.z);
      camera.position.lerp(closeup.position, closeup.blend);
      lookAt.copy(rig.focus).lerp(closeup.look, closeup.blend); // bản sao: không làm lệch focus của rig thường
    } else lookAt.copy(rig.focus);
    camera.lookAt(lookAt); camera.updateMatrixWorld();
    if (process.env.NODE_ENV === 'development' && avatar && target) {
      rig.screen.copy(rig.focus).project(camera);
      const view = rig.diagnostics;
      view.x = avatar.position.x; view.z = avatar.position.z; view.rawX = target.x; view.rawZ = target.z;
      view.cameraX = camera.position.x; view.cameraZ = camera.position.z; view.yaw = rig.yaw; view.pitch = rig.pitch; view.radius = rig.resolvedDistance;
      view.screenX = rig.screen.x; view.screenY = rig.screen.y;
      if (clock.elapsedTime - rig.lastSample > .2) {
        rig.lastSample = clock.elapsedTime;
        canvas.dataset.playerPose = JSON.stringify({ x: target.x, z: target.z, seatId: target.seatId ?? '', camera: camera.position.toArray(), yaw: rig.yaw, pitch: rig.pitch, radius: rig.resolvedDistance });
      }
    }
  }, -1);
  return null;
}
