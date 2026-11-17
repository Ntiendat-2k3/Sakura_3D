/** Voice chat theo khoảng cách: hằng số, tên message và chuẩn hóa payload signaling WebRTC dùng chung cho server và web. */

/**
 * Bán kính tính theo mét thế giới (3D, gồm cả độ cao tầng).
 * - fullVolume: trong bán kính này nghe to đủ; ra tới hear thì nhỏ dần về 0 (PannerNode mô hình linear).
 * - connect/disconnect: hysteresis để không mở/đóng kết nối liên tục khi đứng ngay mép.
 * - relay: server chỉ chuyển tín hiệu khi hai người trong bán kính này; rộng hơn disconnect vì vị trí client nội suy trễ ~200 ms.
 */
export const VOICE_RANGE = { fullVolume: 3, hear: 12, connect: 12, disconnect: 14, relay: 16 } as const;
/** Mesh P2P: mỗi người tự gửi luồng micro tới từng peer, nên giới hạn số kết nối đồng thời để không quá tải uplink. */
export const VOICE_MAX_PEERS = 8;

export const VOICE_MESSAGES = { state: 'voice-state', signal: 'voice-signal', report: 'voice-report', reportAck: 'voice-report-ack' } as const;

/** Giới hạn kích thước: SDP audio-only thường 2–5 KB; ICE candidate vài trăm byte. */
export const VOICE_LIMITS = { sdpChars: 12000, candidateChars: 512, sdpMidChars: 32, sessionIdChars: 64, reportReasonChars: 200 } as const;
/** Token bucket cho signaling: đủ cho trickle ICE của nhiều peer cùng lúc, chặn spam kéo dài. */
export const VOICE_SIGNAL_RATE = { burst: 60, perSecond: 15 } as const;
export const VOICE_STATE_MIN_INTERVAL_MS = 500;
export const VOICE_REPORT_MIN_INTERVAL_MS = 10000;

export type VoiceIceCandidate = { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null };
/** bye: báo đóng kết nối; không cần trong tầm để còn dọn peer khi đối phương vừa đi xa. */
export type VoiceSignalBody =
  | { kind: 'offer' | 'answer'; sdp: string }
  | { kind: 'ice'; candidate: VoiceIceCandidate }
  | { kind: 'bye' };
/** Client gửi lên server. */
export type VoiceSignalInput = VoiceSignalBody & { to: string };
/** Server chuyển tới người nhận; from là sessionId do server gắn, không phải client tự khai. */
export type VoiceSignalRelay = VoiceSignalBody & { from: string };
export type VoiceStateInput = { enabled: boolean };
export type VoiceReportInput = { target: string; reason: string };

function isBoundedString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

/** Chuẩn hóa tín hiệu WebRTC từ client; trả null nếu sai hình dạng hay quá cỡ. Chỉ giữ đúng các trường cần chuyển tiếp. */
export function normalizeVoiceSignal(input: unknown): VoiceSignalInput | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  if (!isBoundedString(value.to, VOICE_LIMITS.sessionIdChars)) return null;
  const to = value.to;
  if (value.kind === 'bye') return { kind: 'bye', to };
  if (value.kind === 'offer' || value.kind === 'answer') {
    if (!isBoundedString(value.sdp, VOICE_LIMITS.sdpChars)) return null;
    return { kind: value.kind, to, sdp: value.sdp };
  }
  if (value.kind === 'ice') {
    const raw = value.candidate;
    if (!raw || typeof raw !== 'object') return null;
    const candidate = raw as Record<string, unknown>;
    // Candidate rỗng là tín hiệu "hết candidate" hợp lệ của WebRTC.
    if (typeof candidate.candidate !== 'string' || candidate.candidate.length > VOICE_LIMITS.candidateChars) return null;
    const sdpMid = candidate.sdpMid ?? null;
    if (sdpMid !== null && (typeof sdpMid !== 'string' || sdpMid.length > VOICE_LIMITS.sdpMidChars)) return null;
    const index = candidate.sdpMLineIndex ?? null;
    if (index !== null && (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index > 16)) return null;
    return { kind: 'ice', to, candidate: { candidate: candidate.candidate, sdpMid, sdpMLineIndex: index } };
  }
  return null;
}

export function normalizeVoiceState(input: unknown): VoiceStateInput | null {
  if (!input || typeof input !== 'object') return null;
  const enabled = (input as Record<string, unknown>).enabled;
  return typeof enabled === 'boolean' ? { enabled } : null;
}

export function normalizeVoiceReport(input: unknown): VoiceReportInput | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  if (!isBoundedString(value.target, VOICE_LIMITS.sessionIdChars)) return null;
  const reason = typeof value.reason === 'string' ? value.reason.replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, VOICE_LIMITS.reportReasonChars) : '';
  return { target: value.target, reason };
}

export type VoicePoint = { x: number; y?: number; z: number };
export function voiceDistance(a: VoicePoint, b: VoicePoint): number {
  return Math.hypot(a.x - b.x, (a.y ?? 0) - (b.y ?? 0), a.z - b.z);
}
