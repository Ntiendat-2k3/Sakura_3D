/** Quy tắc điều khiển voice (push-to-talk, lỗi micro, cấu hình ICE, danh sách chặn/tắt tiếng) tách khỏi API trình duyệt. */

/** Phím V đã dùng để đổi góc nhìn camera, nên push-to-talk dùng B (ngay cạnh V). */
export const VOICE_PUSH_TO_TALK_CODE = 'KeyB';
export const VOICE_PUSH_TO_TALK_LABEL = 'B';
/** Ngưỡng RMS để coi là đang nói; đo trên tín hiệu đã qua khử ồn của trình duyệt. */
export const VOICE_SPEAKING_RMS = 0.02;
export const VOICE_LEVEL_POLL_MS = 100;
/** Bên gọi chờ kết nối tối đa chừng này rồi bỏ, và nghỉ một lúc trước khi gọi lại (đối phương có thể đã chặn hoặc đầy). */
export const VOICE_CONNECT_TIMEOUT_MS = 15000;
export const VOICE_RETRY_BACKOFF_MS = 10000;
export const VOICE_STORAGE_KEYS = { muted: 'neon-sakura.voice.muted', blocked: 'neon-sakura.voice.blocked', mode: 'neon-sakura.voice.mode' } as const;

export type VoiceMode = 'push-to-talk' | 'open-mic';
/** Chỉ báo voice trên bảng tên avatar. */
export type VoiceIndicator = 'speaking' | 'muted';
export type VoiceStatus = 'off' | 'consent' | 'requesting' | 'on' | 'denied' | 'no-mic' | 'busy' | 'insecure' | 'unsupported' | 'error';

export function shouldTransmit(state: { enabled: boolean; mode: VoiceMode; pttHeld: boolean; selfMuted: boolean }): boolean {
  if (!state.enabled || state.selfMuted) return false;
  return state.mode === 'open-mic' || state.pttHeld;
}

/** Không kích hoạt push-to-talk khi đang gõ chat hay ô nhập khác. */
export function isTypingTarget(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const element = target as { tagName?: unknown; isContentEditable?: unknown };
  return element.isContentEditable === true || (typeof element.tagName === 'string' && ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName));
}

/** Đổi lỗi getUserMedia thành trạng thái HUD; tên lỗi theo chuẩn DOMException. */
export function classifyMediaError(error: unknown): VoiceStatus {
  const name = error && typeof error === 'object' && 'name' in error ? String((error as { name: unknown }).name) : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'no-mic';
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'busy';
  return 'error';
}

/** Kiểm tra trước khi xin micro: getUserMedia chỉ có trên trang bảo mật (https hoặc localhost). */
export function voiceSupport(env: { isSecureContext?: boolean; hasGetUserMedia: boolean; hasPeerConnection: boolean; hasAudioContext: boolean }): VoiceStatus | null {
  if (env.isSecureContext === false) return 'insecure';
  if (!env.hasGetUserMedia || !env.hasPeerConnection || !env.hasAudioContext) return 'unsupported';
  return null;
}

export type IceServerConfig = { urls: string | string[]; username?: string; credential?: string };
/**
 * NEXT_PUBLIC_VOICE_ICE_SERVERS là mảng JSON kiểu RTCIceServer. Mặc định rỗng: qua Tailscale/LAN hai máy thấy nhau trực tiếp,
 * không cần STUN/TURN bên thứ ba. Giá trị sai bị bỏ qua thay vì làm hỏng voice.
 */
export function parseIceServers(raw: string | undefined): IceServerConfig[] {
  if (!raw?.trim()) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(parsed)) return [];
  const isUrl = (value: unknown) => typeof value === 'string' && /^(stun|stuns|turn|turns):/i.test(value);
  return parsed.flatMap((item): IceServerConfig[] => {
    if (!item || typeof item !== 'object') return [];
    const value = item as Record<string, unknown>;
    const urls = Array.isArray(value.urls) ? value.urls.filter(isUrl) as string[] : isUrl(value.urls) ? value.urls as string : null;
    if (!urls || (Array.isArray(urls) && !urls.length)) return [];
    return [{ urls, ...(typeof value.username === 'string' ? { username: value.username } : {}), ...(typeof value.credential === 'string' ? { credential: value.credential } : {}) }];
  });
}

export type StorageLike = { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void };
/** localStorage có thể ném lỗi (chế độ riêng tư, bị chặn); khi đó chỉ giữ trong bộ nhớ. */
export function loadVoiceIds(storage: StorageLike | undefined, key: string): Set<string> {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(key) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string' && id.length <= 64).slice(0, 500) : []);
  } catch { return new Set(); }
}
export function saveVoiceIds(storage: StorageLike | undefined, key: string, ids: ReadonlySet<string>): void {
  try { storage?.setItem(key, JSON.stringify([...ids])); } catch { /* chỉ giữ trong bộ nhớ */ }
}
export function loadVoiceMode(storage: StorageLike | undefined): VoiceMode {
  try { return storage?.getItem(VOICE_STORAGE_KEYS.mode) === 'open-mic' ? 'open-mic' : 'push-to-talk'; } catch { return 'push-to-talk'; }
}
export function saveVoiceMode(storage: StorageLike | undefined, mode: VoiceMode): void {
  try { storage?.setItem(VOICE_STORAGE_KEYS.mode, mode); } catch { /* chỉ giữ trong bộ nhớ */ }
}

/** RMS của một khung mẫu thời gian [-1, 1]. */
export function rms(samples: ArrayLike<number>): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}
