'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, type RefObject } from 'react';
import * as THREE from 'three';
import { COLLIDERS, CLUB_COLLIDERS, type PositionSnapshot, type WorldZone } from '@metaverse/game-protocol';
import character from '../entities/player-character.json';

type ViewDiagnostics = { x: number; z: number; rawX: number; rawZ: number; cameraX: number; cameraZ: number; yaw: number; pitch: number; radius: number; screenX: number; screenY: number };
type DebugCanvas = HTMLCanvasElement & { neonView?: ViewDiagnostics };

/** Camera và avatar dùng chung transform đã nội suy; góc orbit độc lập với các state patch mạng. */
export function FollowCamera({ target, targetObject, zone = 'street' }: { target?: PositionSnapshot; targetObject: RefObject<THREE.Group | null>; zone?: WorldZone }) {
  const { gl } = useThree();
  const canvas = gl.domElement as DebugCanvas;
  const rig = useMemo(() => {
    const bounds = (zone === 'club' ? CLUB_COLLIDERS : COLLIDERS).map(b => new THREE.Box3(
      new THREE.Vector3(b.xMin, 0, b.zMin), new THREE.Vector3(b.xMax, zone === 'club' ? (b === CLUB_COLLIDERS[0] ? .8 : b === CLUB_COLLIDERS[3] ? .65 : 1.45) : 24, b.zMax),
    ));
    if (zone === 'club') {
      bounds.push(
        new THREE.Box3(new THREE.Vector3(-8.2, 0, -8.2), new THREE.Vector3(-7.8, 5.6, 8.1)),
        new THREE.Box3(new THREE.Vector3(7.8, 0, -8.2), new THREE.Vector3(8.2, 5.6, 8.1)),
        new THREE.Box3(new THREE.Vector3(-8.2, 0, -8.2), new THREE.Vector3(8.2, 5.6, -7.8)),
        new THREE.Box3(new THREE.Vector3(-8.2, 0, 7.8), new THREE.Vector3(-1.6, 2.6, 8.2)),
        new THREE.Box3(new THREE.Vector3(1.6, 0, 7.8), new THREE.Vector3(8.2, 2.6, 8.2)),
      );
    }
    return {
      focus: new THREE.Vector3(), direction: new THREE.Vector3(), hit: new THREE.Vector3(), screen: new THREE.Vector3(), ray: new THREE.Ray(), bounds,
      yaw: 0, wantedYaw: 0, pitch: .36, wantedPitch: .36,
      distance: zone === 'club' ? 7.8 : 8.5, wantedDistance: zone === 'club' ? 7.8 : 8.5,
      resolvedDistance: 0, snap: true, lastSample: 0,
      diagnostics: { x: 0, z: 0, rawX: 0, rawZ: 0, cameraX: 0, cameraZ: 0, yaw: 0, pitch: .36, radius: 0, screenX: 0, screenY: 0 } as ViewDiagnostics,
    };
  }, [zone]);

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
      rig.wantedDistance = THREE.MathUtils.clamp(rig.wantedDistance * Math.exp(event.deltaY * .001), 2.6, 12);
    };
    const contextMenu = (event: Event) => event.preventDefault();
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('lostpointercapture', release);
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('contextmenu', contextMenu);
    window.addEventListener('blur', release);
    window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true);
    if (process.env.NODE_ENV === 'development') canvas.neonView = rig.diagnostics;
    return () => {
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', release); canvas.removeEventListener('pointercancel', release);
      canvas.removeEventListener('lostpointercapture', release); canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('contextmenu', contextMenu); window.removeEventListener('blur', release);
      window.removeEventListener('pointerup', release, true); window.removeEventListener('pointercancel', release, true);
      release(); canvas.style.cursor = previous.cursor; canvas.style.touchAction = previous.touchAction; canvas.tabIndex = previous.tabIndex;
      delete canvas.neonView;
    };
  }, [canvas, rig]);

  useFrame(({ camera, clock }, delta) => {
    const avatar = targetObject.current;
    if (!target || !avatar) return;
    const dt = Math.min(delta, .1), orbitAlpha = 1 - Math.exp(-18 * dt);
    rig.yaw += (rig.wantedYaw - rig.yaw) * orbitAlpha;
    rig.pitch += (rig.wantedPitch - rig.pitch) * orbitAlpha;
    rig.distance += (rig.wantedDistance - rig.distance) * orbitAlpha;
    rig.focus.copy(avatar.position); rig.focus.y += character.height * .7 - (target.seatId ? .18 : 0);
    const horizontal = Math.cos(rig.pitch);
    rig.direction.set(Math.sin(rig.yaw) * horizontal, Math.sin(rig.pitch), Math.cos(rig.yaw) * horizontal);
    rig.ray.set(rig.focus, rig.direction);
    let allowed = rig.distance;
    for (const box of rig.bounds) {
      if (!rig.ray.intersectBox(box, rig.hit)) continue;
      const hitDistance = rig.focus.distanceTo(rig.hit);
      allowed = Math.min(allowed, Math.max(.001, hitDistance > .2 ? hitDistance - .2 : hitDistance * .5));
    }
    // Thu vào ngay để tránh xuyên tường; giãn ra từ từ khi rời vật cản để không bật camera đột ngột.
    if (rig.snap || allowed < rig.resolvedDistance) rig.resolvedDistance = allowed;
    else rig.resolvedDistance += (allowed - rig.resolvedDistance) * (1 - Math.exp(-10 * dt));
    rig.snap = false;
    camera.position.copy(rig.focus).addScaledVector(rig.direction, rig.resolvedDistance);
    camera.lookAt(rig.focus); camera.updateMatrixWorld();
    if (process.env.NODE_ENV === 'development') {
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
