'use client';
import { useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { MoveInput, PlayerDanceStyle } from '@metaverse/game-protocol';
import { createPlayerDanceShortcuts } from './playerDanceShortcuts';

/** WASD theo camera; N+1/N+2/N+3 chọn kiểu nhảy trong club. Bỏ input khi gõ văn bản hoặc đang ngồi. */
export function PlayerInput({ sendMove, enabled, toggleDance }: { sendMove: (input: MoveInput) => void; enabled: boolean; toggleDance?: (style: PlayerDanceStyle) => void }) {
  const keys = useRef(new Set<string>());
  const elapsed = useRef(0);
  const dirty = useRef(false);
  const danceRef = useRef(toggleDance); danceRef.current = toggleDance;
  const basis = useMemo(() => ({ forward: new Vector3(), right: new Vector3(), move: new Vector3() }), []);
  useEffect(() => {
    const shortcuts = createPlayerDanceShortcuts(style => danceRef.current?.(style));
    const clear = () => { keys.current.clear(); shortcuts.reset(); dirty.current = true; sendMove({ x: 0, z: 0 }); };
    const editable = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(target.tagName));
    const keydown = (e: KeyboardEvent) => {
      if (!enabled || editable(e.target)) return;
      const key = e.key.toLowerCase();
      if (danceRef.current && !e.isComposing && !e.ctrlKey && !e.altKey && !e.metaKey && !(e.target instanceof HTMLButtonElement) && shortcuts.down(key, e.repeat)) {
        e.preventDefault(); return;
      }
      if (!['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)) return;
      e.preventDefault();
      if (!keys.current.has(key)) { keys.current.add(key); dirty.current = true; }
    };
    const keyup = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (enabled && !editable(e.target) && !(e.target instanceof HTMLButtonElement) && !e.isComposing && !e.ctrlKey && !e.altKey && !e.metaKey) shortcuts.up(key);
      else if (key === 'n') shortcuts.reset();
      if (keys.current.delete(key)) dirty.current = true;
    };
    const focus = (e: FocusEvent) => { if (editable(e.target)) clear(); };
    const visibility = () => { if (document.hidden) clear(); };
    if (!enabled) clear();
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup);
    window.addEventListener('blur', clear); window.addEventListener('focusin', focus);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', clear); window.removeEventListener('focusin', focus);
      document.removeEventListener('visibilitychange', visibility); clear();
    };
  }, [enabled, sendMove]);
  useFrame(({ camera }, delta) => {
    if (!enabled) return;
    elapsed.current += delta;
    if (elapsed.current < .05 && !dirty.current) return;
    elapsed.current = 0; dirty.current = false;
    const k = keys.current;
    const x = Number(k.has('d') || k.has('arrowright')) - Number(k.has('a') || k.has('arrowleft'));
    const forward = Number(k.has('w') || k.has('arrowup')) - Number(k.has('s') || k.has('arrowdown'));
    camera.getWorldDirection(basis.forward); basis.forward.y = 0; basis.forward.normalize();
    basis.right.crossVectors(basis.forward, camera.up).normalize();
    basis.move.copy(basis.right).multiplyScalar(x).addScaledVector(basis.forward, forward);
    if (basis.move.lengthSq() > 1) basis.move.normalize();
    sendMove({ x: basis.move.x, z: basis.move.z });
  });
  return null;
}
