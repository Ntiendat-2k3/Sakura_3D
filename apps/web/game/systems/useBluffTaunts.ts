'use client';
import { useEffect, useMemo, useState } from 'react';
import { BLUFF_TAUNTS, KOHAKU_SEATS, type BluffSeatView, type BluffTauntFx } from '@metaverse/game-protocol';
import { BLUFF_SEATED_HEAD_HEIGHT, type BluffPose } from './bluffPose';

export type ReceivedTaunt = { fx: BluffTauntFx; at: number };
export type ActiveTaunt = { pose: BluffPose; target: { x: number; y: number; z: number } };

/** Cà khịa mới nhất còn hạn của từng session; đích là đầu người ngồi ở ghế bị khịa. Hàm thuần để test được. */
export function activeTaunts(taunts: readonly ReceivedTaunt[], seats: readonly BluffSeatView[], now: number): Record<string, ActiveTaunt> {
  const result: Record<string, ActiveTaunt> = {};
  const latest: Record<string, number> = {};
  for (const { fx, at } of taunts) {
    if (now - at >= BLUFF_TAUNTS[fx.kind].durationMs) continue;
    const sessionId = seats.find(seat => seat.seatId === fx.seatId)?.sessionId;
    const seat = KOHAKU_SEATS.find(item => item.id === fx.targetSeat);
    if (!sessionId || !seat || (latest[sessionId] ?? -Infinity) > at) continue;
    latest[sessionId] = at;
    result[sessionId] = { pose: fx.kind, target: { x: seat.x, y: BLUFF_SEATED_HEAD_HEIGHT, z: seat.z } };
  }
  return result;
}

/** Bọc activeTaunts: tự render lại đúng lúc động tác sớm nhất hết hạn để avatar nhả tư thế. */
export function useBluffTaunts(taunts: readonly ReceivedTaunt[], seats: readonly BluffSeatView[]): Record<string, ActiveTaunt> {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => { setNow(performance.now()); }, [taunts]);
  useEffect(() => {
    const ends = taunts.map(({ fx, at }) => at + BLUFF_TAUNTS[fx.kind].durationMs).filter(end => end > now);
    if (!ends.length) return;
    const timer = window.setTimeout(() => setNow(performance.now()), Math.min(...ends) - now + 1);
    return () => window.clearTimeout(timer);
  }, [taunts, now]);
  return useMemo(() => activeTaunts(taunts, seats, now), [taunts, seats, now]);
}
