import { useEffect, useState } from 'react';
import { KOHAKU_SEATS, type BluffTableView } from '@metaverse/game-protocol';
import type { KohakuNpcId } from './kohakuNpcMotion';

/** Hinata và Bartender quay nhìn bàn trong khoảng này sau tiếng nổ rồi trở lại việc của mình. */
export const BANG_GLANCE_MS = 3000;
const TABLE_CENTER = { x: 0, z: 0 } as const;

function seatPoint(seatId: string): { x: number; z: number } | null {
  const seat = KOHAKU_SEATS.find(item => item.id === seatId);
  return seat ? { x: seat.x, z: seat.z } : null;
}

/**
 * Điểm NPC nên nhìn theo diễn biến ván (null = hành vi mặc định).
 * Shinku dõi theo người đang tới lượt, rồi người cầm súng (thiếu thì người vừa úp) suốt pha lật bài/bóp cò.
 * `bangAgeMs`: thời gian kể từ tiếng nổ gần nhất (Infinity nếu chưa có).
 */
export function npcFocus(id: KohakuNpcId, table: BluffTableView, bangAgeMs: number): { x: number; z: number } | null {
  if (id !== 'shinku') return bangAgeMs >= 0 && bangAgeMs < BANG_GLANCE_MS ? { ...TABLE_CENTER } : null;
  if (table.phase === 'turn') return seatPoint(table.turnSeat);
  if (table.phase === 'reveal' || table.phase === 'shooting' || table.phase === 'result') return seatPoint(table.shooterSeat || table.lastPlay.seatId);
  return null;
}

/** Số ms kể từ lúc shotResult chuyển sang 'bang' (Infinity nếu chưa có); tự render lại khi hết thời gian liếc nhìn. */
export function useBangAge(bluff?: BluffTableView): number {
  const [bangAt, setBangAt] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const shot = bluff?.shotResult;
  useEffect(() => { if (shot === 'bang') setBangAt(performance.now()); }, [shot]);
  useEffect(() => {
    if (bangAt === null) return;
    const timer = window.setTimeout(() => setTick(n => n + 1), BANG_GLANCE_MS + 1);
    return () => window.clearTimeout(timer);
  }, [bangAt]);
  return bangAt === null ? Infinity : performance.now() - bangAt;
}
