import type { PokerTableView } from '@metaverse/game-protocol';

type Dungeon = PokerTableView['dungeon'];

/**
 * Một cú đấm mỗi khi punchesDone tăng trên cùng một người. Lần đọc đầu (prev null, vd. vừa vào phòng)
 * không phát gì để người mới vào không thấy cả loạt đấm cũ diễn lại.
 */
export function punchEvents(prev: Dungeon | null, next: Dungeon, now: number): { punchAt: number | null; final: boolean } {
  if (!prev || next.phase !== 'punching' && next.phase !== 'choice') return { punchAt: null, final: false };
  const sameVictim = prev.seatId === next.seatId;
  if (!sameVictim || next.punchesDone <= prev.punchesDone) return { punchAt: null, final: false };
  return { punchAt: now, final: next.punchesDone >= next.punchesTotal };
}
