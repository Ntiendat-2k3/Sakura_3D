/**
 * Nhảy từ ban công tầng 2/3 Kohaku xuống tầng 1. Server chọn điểm nhảy theo vị trí authoritative của người chơi
 * (client không gửi điểm hay vị trí), rồi tự đặt vị trí theo quỹ đạo dùng chung trong game-protocol mỗi tick.
 */
import { findKohakuJumpSpot, kohakuJumpDuration, sampleKohakuJump, type KohakuJumpSpot } from '@metaverse/game-protocol';

type JumpingPlayer = { x: number; y: number; z: number; yaw: number; seatId: string; dancing: boolean; jumpSpot: string };

export function createKohakuJumps(getPlayer: (sessionId: string) => JumpingPlayer | undefined) {
  const active = new Map<string, { spot: KohakuJumpSpot; startedAt: number; endsAt: number }>();
  return {
    /** Trả lời nhắn lỗi cho người chơi, hoặc null khi đã bắt đầu nhảy. */
    start(sessionId: string, now: number): string | null {
      const player = getPlayer(sessionId);
      if (!player || active.has(sessionId)) return null;
      if (player.seatId) return 'Hãy đứng dậy trước khi nhảy.';
      const spot = findKohakuJumpSpot(player.x, player.y, player.z);
      if (!spot) return 'Hãy đứng sát lan can ở điểm nhảy trên tầng 2 hoặc 3.';
      active.set(sessionId, { spot, startedAt: now, endsAt: now + kohakuJumpDuration(spot) * 1000 });
      player.dancing = false;
      player.jumpSpot = spot.id;
      Object.assign(player, { ...spot.from, yaw: sampleKohakuJump(spot, 0).yaw });
      return null;
    },
    tick(now: number): void {
      for (const [sessionId, jump] of active) {
        const player = getPlayer(sessionId);
        if (!player) { active.delete(sessionId); continue; }
        const { x, y, z, yaw } = sampleKohakuJump(jump.spot, (now - jump.startedAt) / 1000);
        Object.assign(player, { x, y, z, yaw });
        if (now >= jump.endsAt) { player.jumpSpot = ''; active.delete(sessionId); }
      }
    },
    isJumping: (sessionId: string) => active.has(sessionId),
    forget: (sessionId: string) => { active.delete(sessionId); },
  };
}
