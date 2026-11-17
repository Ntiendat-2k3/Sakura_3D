/**
 * Hôn trên ghế đá và đấm người đứng gần ngoài phố Sakura. Server chọn người ngồi cạnh / mục tiêu từ vị trí authoritative
 * (client không gửi ai là mục tiêu), giới hạn tần suất, rồi phát hiệu ứng cho cả phòng. Đấm chỉ là hiệu ứng: không có máu.
 */
import { STREET_SEATS, STREET_SOCIAL_MESSAGES, STREET_SOCIAL_TIMING, findPunchTarget, knockbackPosition, streetBenchPartnerSeat } from '@metaverse/game-protocol';

type SocialPlayer = { x: number; z: number; yaw: number; seatId: string; dancing: boolean; danceStyle: string };

export type StreetKissFx = { a: string; b: string };
export type StreetPunchFx = { attacker: string; target: string };

export function createStreetSocial(deps: {
  players: () => Iterable<[string, SocialPlayer]>;
  broadcast: (type: string, payload: StreetKissFx | StreetPunchFx) => void;
  /** Hẹn giờ của room (clock.setTimeout) để đẩy lùi đúng lúc cú đấm trúng. */
  schedule: (ms: number, run: () => void) => void;
  walkable: (x: number, z: number) => boolean;
}) {
  const kissingUntil = new Map<string, number>();
  const lastKiss = new Map<string, number>();
  const lastPunch = new Map<string, number>();
  const find = (sessionId: string) => [...deps.players()].find(([id]) => id === sessionId)?.[1];

  return {
    kiss(sessionId: string, now: number): string | null {
      const player = find(sessionId);
      if (!player || !STREET_SEATS.some(seat => seat.id === player.seatId)) return 'Hãy ngồi lên ghế đá trước.';
      const partnerSeat = streetBenchPartnerSeat(player.seatId);
      const partner = [...deps.players()].find(([id, other]) => id !== sessionId && other.seatId === partnerSeat?.id);
      if (!partner) return 'Chưa có ai ngồi cạnh bạn trên ghế này.';
      if (now - (lastKiss.get(sessionId) ?? -Infinity) < STREET_SOCIAL_TIMING.kissCooldownMs) return null;
      if ((kissingUntil.get(sessionId) ?? 0) > now || (kissingUntil.get(partner[0]) ?? 0) > now) return null;
      const until = now + STREET_SOCIAL_TIMING.kissMs;
      kissingUntil.set(sessionId, until); kissingUntil.set(partner[0], until); lastKiss.set(sessionId, now);
      deps.broadcast(STREET_SOCIAL_MESSAGES.kissFx, { a: sessionId, b: partner[0] });
      return null;
    },
    punch(sessionId: string, now: number): string | null {
      const attacker = find(sessionId);
      if (!attacker || attacker.seatId) return null;
      if (now - (lastPunch.get(sessionId) ?? -Infinity) < STREET_SOCIAL_TIMING.punchCooldownMs) return null;
      const bodies = [...deps.players()].map(([id, p]) => ({ id, x: p.x, z: p.z, seatId: p.seatId }));
      const target = findPunchTarget({ id: sessionId, x: attacker.x, z: attacker.z }, bodies);
      if (!target) return 'Không có ai đứng đủ gần để đấm.';
      lastPunch.set(sessionId, now);
      attacker.yaw = Math.atan2(target.x - attacker.x, target.z - attacker.z);
      attacker.dancing = false; attacker.danceStyle = 'normal';
      deps.broadcast(STREET_SOCIAL_MESSAGES.punchFx, { attacker: sessionId, target: target.id });
      deps.schedule(STREET_SOCIAL_TIMING.punchImpactMs, () => {
        // Đọc lại lúc trúng: người kia có thể đã ngồi xuống hoặc rời phòng trong nửa giây ra đòn.
        const victim = find(target.id), puncher = find(sessionId);
        if (!victim || !puncher || victim.seatId) return;
        Object.assign(victim, knockbackPosition(puncher, victim, deps.walkable));
        victim.yaw = Math.atan2(puncher.x - victim.x, puncher.z - victim.z);
        victim.dancing = false; victim.danceStyle = 'normal';
      });
      return null;
    },
    forget(sessionId: string) { kissingUntil.delete(sessionId); lastKiss.delete(sessionId); lastPunch.delete(sessionId); },
  };
}
