'use client';
import { useEffect, useRef } from 'react';
import { BLUFF_TAUNTS, type BluffTauntKind, type PokerTableView } from '@metaverse/game-protocol';
import { canPokerTaunt, defaultPokerTauntTarget } from './gekkaPokerView';

const KIND_BY_KEY = new Map(Object.entries(BLUFF_TAUNTS).map(([kind, def]) => [def.key, kind as BluffTauntKind]));

/** Phím 1-4 như Kohaku: người ngồi bàn khịa người chơi khác, người đứng xem khịa người đang bị trói; cooldown do server chặn. */
export function useGekkaTauntKeys(table: PokerTableView, sessionId: string, mySeatId: string, taunt: (kind: BluffTauntKind, target: string) => void, enabled: boolean) {
  // Đọc bàn mới nhất qua ref để không phải gỡ/gắn listener mỗi lần state đổi (10 Hz).
  const latest = useRef({ table, sessionId, mySeatId, taunt });
  latest.current = { table, sessionId, mySeatId, taunt };
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const kind = KIND_BY_KEY.get(event.key);
      if (!kind || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
      const el = event.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const { table: current, sessionId: me, mySeatId: seatId, taunt: send } = latest.current;
      if (!canPokerTaunt(current, me, seatId)) return;
      const target = defaultPokerTauntTarget(current, seatId);
      if (target) send(kind, target);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
