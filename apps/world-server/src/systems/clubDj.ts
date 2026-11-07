/** Server giữ lượt gọi DJ, đo thời gian giữ phím và chỉ đổi bài sau khi DJ đã đến đúng người. */
import { canCallClubDj, createDjRoute, DEFAULT_DJ_VISIT, DJ_HOLD_MS, DJ_REACH, DJ_WAIT_MS, getClubTrack, getDjMeetingPoint, getDjTravelDuration, sampleDjTravel, type ClubTrack, type DjVisit } from '@metaverse/game-protocol';

type Guest = { x: number; z: number; seatId: string; dancing: boolean };
export function createClubDj(visit: DjVisit, players: { get(id: string): Guest | undefined }, play: (track: ClubTrack, now: number) => void) {
  const reset = () => Object.assign(visit, DEFAULT_DJ_VISIT);
  const distance = () => createDjRoute(visit.targetX, visit.targetZ).length;
  const returnHome = (now: number) => {
    if (visit.phase === 'holding') { reset(); return; }
    if (visit.phase !== 'approaching' && visit.phase !== 'ready') return;
    visit.returnDistance = visit.phase === 'ready' ? distance() : sampleDjTravel((now - visit.startedAt) / 1000, distance()).distance;
    visit.phase = 'returning'; visit.startedAt = now;
  };
  return {
    hold(id: string, held: unknown, now: number) {
      if (held === false) { if (visit.requesterId === id && visit.phase === 'holding') reset(); return; }
      if (held !== true || visit.phase !== 'idle') return;
      const player = players.get(id);
      if (!canCallClubDj(player)) return;
      const target = getDjMeetingPoint(player!);
      if (!target) return;
      player!.dancing = false;
      Object.assign(visit, { phase: 'holding', requesterId: id, startedAt: now, playerX: player!.x, playerZ: player!.z, targetX: target.x, targetZ: target.z, returnDistance: 0 });
    },
    cancel(id: string, now: number) { if (visit.requesterId === id) returnHome(now); },
    select(id: string, value: unknown, now: number) {
      const track = getClubTrack(value), player = players.get(id);
      if (!track || visit.phase !== 'ready' || visit.requesterId !== id || !player || Math.hypot(player.x - visit.targetX, player.z - visit.targetZ) > DJ_REACH) return false;
      play(track, now); returnHome(now); return true;
    },
    tick(now: number) {
      if (visit.phase === 'idle') return;
      if (visit.phase === 'returning') { if (now - visit.startedAt >= getDjTravelDuration(visit.returnDistance) * 1000) reset(); return; }
      const player = players.get(visit.requesterId);
      if (!canCallClubDj(player) || Math.hypot(player!.x - visit.playerX, player!.z - visit.playerZ) > .65) { returnHome(now); return; }
      const elapsed = now - visit.startedAt;
      if (visit.phase === 'holding' && elapsed >= DJ_HOLD_MS) { visit.phase = 'approaching'; visit.startedAt = now; }
      else if (visit.phase === 'approaching' && elapsed >= getDjTravelDuration(distance()) * 1000) { visit.phase = 'ready'; visit.startedAt = now; }
      else if (visit.phase === 'ready' && elapsed >= DJ_WAIT_MS) returnHome(now);
    },
  };
}
