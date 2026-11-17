'use client';
import { useEffect, useRef } from 'react';
import { BLUFF_TAUNTS, type BluffTableView, type BluffTauntKind } from '@metaverse/game-protocol';
import { canTauntNow, defaultTauntTarget } from './kohakuBluffView';

const KIND_BY_KEY = new Map(Object.entries(BLUFF_TAUNTS).map(([kind, def]) => [def.key, kind as BluffTauntKind]));

/** Phím 1-4 khi đang ngồi trong ván: không có UI chọn cà khịa, đích tự chọn; cooldown do server chặn. */
export function useBluffTauntKeys(table: BluffTableView, sessionId: string, taunt: (kind: BluffTauntKind, targetSeat: string) => void, enabled: boolean) {
  // Đọc bàn mới nhất qua ref để không phải gỡ/gắn listener mỗi lần state đổi (10 Hz).
  const latest = useRef({ table, sessionId, taunt });
  latest.current = { table, sessionId, taunt };
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const kind = KIND_BY_KEY.get(event.key);
      if (!kind || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
      const el = event.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const { table: current, sessionId: me, taunt: send } = latest.current;
      if (!canTauntNow(current, me)) return;
      const mySeat = current.seats.find(seat => seat.sessionId === me)?.seatId ?? '';
      const target = defaultTauntTarget(current, mySeat);
      if (target) send(kind, target);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
