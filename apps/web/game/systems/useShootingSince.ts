'use client';
import { useEffect, useRef } from 'react';
import type { BluffTableView } from '@metaverse/game-protocol';

/** performance.now() lúc bàn vào pha shooting; giữ qua pha result để camera không bật ra, null ở các pha khác. */
export function useShootingSince(table: BluffTableView, enabled: boolean): number | null {
  const since = useRef<number | null>(null);
  const active = enabled && (table.phase === 'shooting' || table.phase === 'result');
  if (active && table.phase === 'shooting' && since.current === null) since.current = performance.now();
  useEffect(() => { if (!active) since.current = null; }, [active]);
  return active ? since.current : null;
}
