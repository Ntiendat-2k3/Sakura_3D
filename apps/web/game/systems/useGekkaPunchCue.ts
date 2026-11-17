'use client';
import { useEffect, useRef, useState } from 'react';
import type { PokerTableView } from '@metaverse/game-protocol';
import { punchEvents } from './gekkaPunchTimeline';

export type GekkaPunchCue = { punchAt: number | null; final: boolean };

/** Nhịp đấm cục bộ (performance.now) dùng chung cho đao phủ và avatar bị trói; người mới vào không nhận cú cũ. */
export function useGekkaPunchCue(table: PokerTableView): GekkaPunchCue {
  const previous = useRef<PokerTableView['dungeon'] | null>(null);
  const [cue, setCue] = useState<GekkaPunchCue>({ punchAt: null, final: false });
  useEffect(() => {
    const event = punchEvents(previous.current, table.dungeon, performance.now());
    previous.current = table.dungeon;
    if (event.punchAt !== null) setCue({ punchAt: event.punchAt, final: event.final });
  }, [table.dungeon]);
  return cue;
}
