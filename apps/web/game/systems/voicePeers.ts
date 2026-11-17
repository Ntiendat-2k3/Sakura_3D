/** Chọn tập peer voice từ vị trí server: thuần, không đụng WebRTC để test được trong Node. */
import { VOICE_MAX_PEERS, VOICE_RANGE, voiceDistance, type PositionSnapshot } from '@metaverse/game-protocol';

export type VoicePeerSelection = {
  selfSessionId: string;
  players: Record<string, PositionSnapshot>;
  /** sessionId các peer đang mở; được giữ tới ngưỡng disconnect (hysteresis). */
  current: ReadonlySet<string>;
  /** userId bị chặn: không bao giờ kết nối. */
  blocked: ReadonlySet<string>;
  maxPeers?: number;
};

/** Trả tập sessionId nên kết nối. Peer đang mở được ưu tiên bằng đúng biên hysteresis để không giành chỗ qua lại khi đầy. */
export function selectVoicePeers({ selfSessionId, players, current, blocked, maxPeers = VOICE_MAX_PEERS }: VoicePeerSelection): Set<string> {
  const self = players[selfSessionId];
  if (!self?.voice) return new Set();
  const margin = VOICE_RANGE.disconnect - VOICE_RANGE.connect;
  const ranked: { sessionId: string; score: number }[] = [];
  for (const [sessionId, other] of Object.entries(players)) {
    if (sessionId === selfSessionId || !other.voice || blocked.has(other.id)) continue;
    const distance = voiceDistance(self, other);
    const open = current.has(sessionId);
    if (distance > (open ? VOICE_RANGE.disconnect : VOICE_RANGE.connect)) continue;
    ranked.push({ sessionId, score: open ? distance - margin : distance });
  }
  ranked.sort((a, b) => a.score - b.score || a.sessionId.localeCompare(b.sessionId));
  return new Set(ranked.slice(0, Math.max(0, maxPeers)).map(item => item.sessionId));
}

/** Tránh hai bên cùng gửi offer (glare): sessionId nhỏ hơn luôn là bên gọi. */
export function isVoiceInitiator(selfSessionId: string, otherSessionId: string): boolean {
  return selfSessionId < otherSessionId;
}

/**
 * Bên nhận offer dùng ngưỡng rộng (disconnect) vì vị trí hai máy lệch nhau vài trăm ms;
 * vẫn từ chối người bị chặn, người chưa bật voice và khi đã đủ số peer.
 */
export function canAcceptVoiceOffer(selection: VoicePeerSelection, fromSessionId: string): boolean {
  const self = selection.players[selection.selfSessionId];
  const other = selection.players[fromSessionId];
  if (!self?.voice || !other?.voice || fromSessionId === selection.selfSessionId || selection.blocked.has(other.id)) return false;
  if (voiceDistance(self, other) > VOICE_RANGE.disconnect) return false;
  const openOthers = [...selection.current].filter(id => id !== fromSessionId).length;
  return openOthers < (selection.maxPeers ?? VOICE_MAX_PEERS);
}
