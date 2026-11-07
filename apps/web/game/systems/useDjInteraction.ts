'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { canCallClubDj, DJ_HOLD_MS, type DjVisit, type PositionSnapshot } from '@metaverse/game-protocol';

/** Giữ O gửi cạnh nhấn/nhả; chỉ state ready của server mới được mở danh sách bài. */
export function useDjInteraction({ enabled, visit, sessionId, player, hold, cancel }: { enabled: boolean; visit: DjVisit; sessionId: string; player?: PositionSnapshot; hold: (held: boolean) => void; cancel: () => void }) {
  const pressed = useRef(false), started = useRef(0);
  const [progress, setProgress] = useState(0);
  const own = visit.requesterId === sessionId && visit.phase !== 'idle' && visit.phase !== 'returning';
  const near = enabled && canCallClubDj(player);
  const current = useRef({ near, phase: visit.phase }); current.current = { near, phase: visit.phase };
  const begin = useCallback(() => {
    if (pressed.current || !current.current.near || current.current.phase !== 'idle') return;
    pressed.current = true; started.current = Date.now(); setProgress(.001); hold(true);
  }, [hold]);
  const end = useCallback(() => { if (pressed.current) { pressed.current = false; setProgress(0); hold(false); } }, [hold]);
  useEffect(() => {
    if (!enabled) { end(); return; }
    const down = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || target instanceof HTMLElement && (target.isContentEditable || !!target.closest('input,textarea,select,button,dialog'))) return;
      if (event.code === 'KeyO') { event.preventDefault(); begin(); }
    };
    const up = (event: KeyboardEvent) => { if (event.code === 'KeyO') end(); };
    const hidden = () => { if (document.hidden) end(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', end); document.addEventListener('visibilitychange', hidden);
    const timer = setInterval(() => { if (pressed.current) setProgress(Math.min(1, (Date.now() - started.current) / DJ_HOLD_MS)); }, 40);
    return () => { end(); clearInterval(timer); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', end); document.removeEventListener('visibilitychange', hidden); };
  }, [enabled, begin, end]);
  return { near, own, progress, begin, end, cancel, phase: visit.phase, opened: enabled && own && visit.phase === 'ready' };
}
