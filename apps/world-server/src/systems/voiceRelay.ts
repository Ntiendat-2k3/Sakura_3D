/**
 * Server làm kênh signaling cho voice chat P2P: chỉ chuyển offer/answer/ICE giữa hai người cùng phòng, cùng bật voice
 * và đang ở gần nhau theo vị trí authoritative của server. Âm thanh đi thẳng giữa trình duyệt, không qua server.
 */
import {
  VOICE_MESSAGES, VOICE_RANGE, VOICE_REPORT_MIN_INTERVAL_MS, VOICE_SIGNAL_RATE, VOICE_STATE_MIN_INTERVAL_MS,
  normalizeVoiceReport, normalizeVoiceSignal, normalizeVoiceState, voiceDistance,
  type VoiceSignalInput, type VoiceSignalRelay,
} from '@metaverse/game-protocol';

export type VoicePlayer = { id: string; name: string; x: number; y: number; z: number; voice: boolean };
export type VoiceClient = { sessionId: string; send: (type: string, payload: unknown) => void };
export type VoiceRelayDeps = {
  zone: string;
  getPlayer: (sessionId: string) => VoicePlayer | undefined;
  getClient: (sessionId: string) => VoiceClient | undefined;
  now?: () => number;
  /** Nơi ghi báo cáo vi phạm; mặc định console.warn của tiến trình world-server. */
  logReport?: (entry: VoiceReportLog) => void;
};
export type VoiceReportLog = { at: string; zone: string; reporterId: string; reporterName: string; targetId: string; targetName: string; reason: string };
export type VoiceRelayRejection = 'invalid' | 'self' | 'no-sender' | 'no-target' | 'sender-voice-off' | 'target-voice-off' | 'out-of-range' | 'rate-limited';

/** Quy tắc thuần: trả lý do từ chối hoặc null nếu được chuyển. bye luôn được phép (khi còn người nhận) để dọn kết nối lúc đã ra xa. */
export function authorizeVoiceRelay(fromId: string, signal: VoiceSignalInput, from: VoicePlayer | undefined, to: VoicePlayer | undefined): VoiceRelayRejection | null {
  if (signal.to === fromId) return 'self';
  if (!from) return 'no-sender';
  if (!to) return 'no-target';
  if (signal.kind === 'bye') return null;
  if (!from.voice) return 'sender-voice-off';
  if (!to.voice) return 'target-voice-off';
  if (voiceDistance(from, to) > VOICE_RANGE.relay) return 'out-of-range';
  return null;
}

/** Token bucket theo từng người gửi: cho phép một loạt trickle ICE ngắn nhưng chặn spam kéo dài. */
export class TokenBucket {
  private tokens: number;
  private updatedAt: number;
  constructor(private readonly burst: number, private readonly perSecond: number, now: number) {
    this.tokens = burst;
    this.updatedAt = now;
  }
  take(now: number): boolean {
    this.tokens = Math.min(this.burst, this.tokens + Math.max(0, now - this.updatedAt) / 1000 * this.perSecond);
    this.updatedAt = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

export class VoiceRelay {
  private readonly buckets = new Map<string, TokenBucket>();
  private readonly lastState = new Map<string, number>();
  private readonly lastReport = new Map<string, number>();
  private readonly now: () => number;
  private readonly logReport: (entry: VoiceReportLog) => void;

  constructor(private readonly deps: VoiceRelayDeps) {
    this.now = deps.now ?? Date.now;
    this.logReport = deps.logReport ?? (entry => console.warn('[voice-report]', JSON.stringify(entry)));
  }

  handleState(client: VoiceClient, payload: unknown): boolean {
    const player = this.deps.getPlayer(client.sessionId);
    const input = normalizeVoiceState(payload);
    if (!player || !input) return false;
    const now = this.now();
    if (now - (this.lastState.get(client.sessionId) ?? -Infinity) < VOICE_STATE_MIN_INTERVAL_MS) return false;
    this.lastState.set(client.sessionId, now);
    player.voice = input.enabled;
    return true;
  }

  handleSignal(client: VoiceClient, payload: unknown): VoiceRelayRejection | null {
    const signal = normalizeVoiceSignal(payload);
    if (!signal) return 'invalid';
    const now = this.now();
    let bucket = this.buckets.get(client.sessionId);
    if (!bucket) { bucket = new TokenBucket(VOICE_SIGNAL_RATE.burst, VOICE_SIGNAL_RATE.perSecond, now); this.buckets.set(client.sessionId, bucket); }
    if (!bucket.take(now)) return 'rate-limited';
    const rejection = authorizeVoiceRelay(client.sessionId, signal, this.deps.getPlayer(client.sessionId), this.deps.getPlayer(signal.to));
    if (rejection) return rejection;
    const target = this.deps.getClient(signal.to);
    if (!target) return 'no-target';
    const from = client.sessionId;
    const relay: VoiceSignalRelay = signal.kind === 'bye'
      ? { kind: 'bye', from }
      : signal.kind === 'ice' ? { kind: 'ice', candidate: signal.candidate, from } : { kind: signal.kind, sdp: signal.sdp, from };
    target.send(VOICE_MESSAGES.signal, relay);
    return null;
  }

  /** Dự án local-only chưa có hệ thống kiểm duyệt: ghi log có cấu trúc ở server để chủ phòng tra cứu. */
  handleReport(client: VoiceClient, payload: unknown): boolean {
    const input = normalizeVoiceReport(payload);
    const reporter = this.deps.getPlayer(client.sessionId);
    if (!input || !reporter || input.target === client.sessionId) return false;
    const target = this.deps.getPlayer(input.target);
    if (!target) return false;
    const now = this.now();
    if (now - (this.lastReport.get(client.sessionId) ?? -Infinity) < VOICE_REPORT_MIN_INTERVAL_MS) return false;
    this.lastReport.set(client.sessionId, now);
    this.logReport({ at: new Date(now).toISOString(), zone: this.deps.zone, reporterId: reporter.id, reporterName: reporter.name, targetId: target.id, targetName: target.name, reason: input.reason });
    client.send(VOICE_MESSAGES.reportAck, { target: input.target });
    return true;
  }

  forget(sessionId: string): void {
    this.buckets.delete(sessionId);
    this.lastState.delete(sessionId);
    this.lastReport.delete(sessionId);
  }
}
