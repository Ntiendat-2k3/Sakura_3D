'use client';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Group } from 'three';
import { canTalkToRosetta, type RosettaMode } from './rosettaMotion';

/** Tương tác thử nghiệm cục bộ, giới hạn khoảng cách; F không tranh phím E của cửa và không chạy khi gõ chat. */
export function useRosettaInteraction({ npc, player, enabled }: { npc: RefObject<Group | null>; player?: { x: number; z: number }; enabled: boolean }) {
  const [mode, setMode] = useState<RosettaMode>('greeting');
  const [near, setNear] = useState(false);
  const [error, setError] = useState('');
  const context = useRef({ enabled, player }); context.current = { enabled, player };
  const close = useCallback(() => { setMode('greeting'); setError(''); }, []);
  const inRange = useCallback(() => {
    const root = npc.current, current = context.current;
    return current.enabled && !!root?.userData.ready && canTalkToRosetta(current.player, root.position);
  }, [npc]);
  const open = useCallback(() => { if (inRange()) { setError(''); setMode(current => current === 'greeting' ? 'dialogue' : current); } }, [inRange]);
  const dance = useCallback(() => { if (inRange()) { setError(''); setMode('dancing'); } else close(); }, [inRange, close]);
  const failDance = useCallback(() => { setError('Không tải được điệu nhảy. Bạn có thể thử lại.'); setMode('dialogue'); }, []);
  useEffect(() => {
    const check = () => { const value = inRange(); setNear(value); if (!value) close(); };
    check(); const timer = setInterval(check, 100);
    const key = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.repeat || event.key.toLowerCase() !== 'f' || target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      if (inRange()) { event.preventDefault(); open(); }
    };
    window.addEventListener('keydown', key);
    return () => { clearInterval(timer); window.removeEventListener('keydown', key); };
  }, [inRange, open, close]);
  useEffect(() => { if (!enabled) { setNear(false); close(); } }, [enabled, close]);
  return { mode, near, error, open, close, dance, failDance };
}
