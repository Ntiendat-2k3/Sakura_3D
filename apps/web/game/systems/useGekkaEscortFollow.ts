'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PokerTableView } from '@metaverse/game-protocol';
import { GEKKA_SPECTATE_FOCUS } from './gekkaFollow';

/** offer: đang hỏi có đi theo không; walking: tự đi theo đoàn xuống hầm; spectating: đang ngồi bàn nên chỉ đưa camera xuống. */
export type GekkaFollowMode = 'none' | 'offer' | 'walking' | 'spectating';

/**
 * Mỗi lần đao phủ bắt đầu lôi người, hỏi những người khác có đi theo xem không.
 * Người đang ngồi bàn không rời ghế (rời ghế giữa trận là bỏ cuộc) nên chỉ xem bằng camera.
 */
export function useGekkaEscortFollow(table: PokerTableView, sessionId: string, enabled: boolean, seatedAtTable: boolean) {
  const [mode, setMode] = useState<GekkaFollowMode>('none');
  const offeredFor = useRef(0);
  const captive = table.seats.some(seat => seat.sessionId === sessionId && seat.captive !== 'none');
  const startedAt = table.escort.startedAt;
  const dungeonBusy = startedAt > 0 || table.dungeon.phase !== 'idle';

  useEffect(() => {
    if (!enabled || !startedAt || startedAt === offeredFor.current) return;
    offeredFor.current = startedAt;
    if (!captive) setMode(current => (current === 'none' ? 'offer' : current));
  }, [enabled, startedAt, captive]);
  // Hầm xong việc thì đóng lời mời và camera xem; người đang đi thì đi nốt tới chỗ đứng.
  useEffect(() => {
    if (!dungeonBusy) setMode(current => (current === 'offer' || current === 'spectating' ? 'none' : current));
  }, [dungeonBusy]);
  useEffect(() => { if (!enabled || captive) setMode('none'); }, [enabled, captive]);

  const follow = useCallback(() => setMode(seatedAtTable ? 'spectating' : 'walking'), [seatedAtTable]);
  const stop = useCallback(() => setMode('none'), []);
  const watching = mode === 'spectating' && ['capture', 'punching', 'choice'].includes(table.dungeon.phase);
  return { mode, follow, stop, focus: watching ? GEKKA_SPECTATE_FOCUS : null };
}
