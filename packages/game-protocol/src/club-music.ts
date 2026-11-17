import track from './club-track.json';
import extraTracks from './club-playlist.json';
import reikaTracks from './reika-playlist.json';

export type ClubTrackCue = 'lounge' | 'groove' | 'peak';
export type ClubTrack = { id: string; title: string; artist?: string; url: string; durationSeconds: number; bpm: number; beatOffsetSeconds: number; cues: { atSeconds: number; cue: ClubTrackCue }[] };
export const DEFAULT_CLUB_TRACK = track as ClubTrack;

function validateTrackEntry(item: unknown, urlPattern: RegExp, ids: Set<string>, urls: Set<string>): ClubTrack {
  if (!item || typeof item !== 'object') throw new Error('Metadata bài nhạc không hợp lệ');
  const p = item as Record<string, unknown>;
  if (typeof p.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(p.id) || ids.has(p.id)) throw new Error('ID bài nhạc trống, trùng hoặc sai định dạng');
  if (typeof p.title !== 'string' || !p.title.trim() || p.title.length > 160) throw new Error(`Thiếu tên bài ${p.id}`);
  if (typeof p.url !== 'string' || !urlPattern.test(p.url) || p.url.includes('..') || urls.has(p.url)) throw new Error(`URL bài ${p.id} không hợp lệ`);
  if (typeof p.durationSeconds !== 'number' || !Number.isFinite(p.durationSeconds) || p.durationSeconds <= 0 || p.durationSeconds > 86400) throw new Error(`Sai thời lượng ${p.id}`);
  if (typeof p.bpm !== 'number' || !Number.isFinite(p.bpm) || p.bpm < 60 || p.bpm > 180) throw new Error(`Sai BPM ${p.id}`);
  if (typeof p.beatOffsetSeconds !== 'number' || !Number.isFinite(p.beatOffsetSeconds) || Math.abs(p.beatOffsetSeconds) > 10) throw new Error(`Sai offset ${p.id}`);
  if (!Array.isArray(p.cues) || !p.cues.length) throw new Error(`Thiếu cue ${p.id}`);
  let previous = -1;
  for (const cue of p.cues) {
    if (!cue || typeof cue.atSeconds !== 'number' || !Number.isFinite(cue.atSeconds) || cue.atSeconds < 0 || cue.atSeconds < previous || cue.atSeconds >= p.durationSeconds || !['lounge', 'groove', 'peak'].includes(cue.cue)) throw new Error(`Cue không hợp lệ ${p.id}`);
    previous = cue.atSeconds;
  }
  ids.add(p.id);
  urls.add(p.url);
  return p as ClubTrack;
}

/** Catalog được khai báo tại build time; message realtime chỉ được chọn ID, không nhận URL/audio từ client. */
export function createClubPlaylist(extra: unknown): ClubTrack[] {
  if (!Array.isArray(extra)) throw new Error('club-playlist.json phải là một danh sách');
  const result: ClubTrack[] = [DEFAULT_CLUB_TRACK], ids = new Set([track.id]), urls = new Set([track.url]);
  for (const item of extra) {
    result.push(validateTrackEntry(item, /^\/assets\/audio\/club\/[a-zA-Z0-9_./-]+\.(mp3|m4a|wav|ogg)$/i, ids, urls));
  }
  return result;
}

/** Danh sách nhạc riêng cho Reika Hostess Lounge được nạp từ assets/source/audio/reika. */
export function createReikaPlaylist(items: unknown): ClubTrack[] {
  if (!Array.isArray(items) || !items.length) throw new Error('reika-playlist.json phải có ít nhất một bài nhạc');
  const result: ClubTrack[] = [], ids = new Set<string>(), urls = new Set<string>();
  for (const item of items) {
    result.push(validateTrackEntry(item, /^\/assets\/audio\/reika\/[a-zA-Z0-9_./-]+\.(mp3|m4a|wav|ogg)$/i, ids, urls));
  }
  return result;
}

export const CLUB_PLAYLIST = createClubPlaylist(extraTracks);
export const REIKA_PLAYLIST = createReikaPlaylist(reikaTracks);
export const DEFAULT_REIKA_TRACK = REIKA_PLAYLIST[0];

export function getClubTrack(id: unknown): ClubTrack | undefined {
  return typeof id === 'string' ? CLUB_PLAYLIST.find(item => item.id === id) : undefined;
}

export function getReikaTrack(id: unknown): ClubTrack | undefined {
  return typeof id === 'string' ? REIKA_PLAYLIST.find(item => item.id === id) : undefined;
}

/** Bài nhạc lặp theo epoch của phòng; chỉ đồng bộ thời gian, không gửi byte audio qua realtime. */
export function getClubPlaybackSeconds(epoch: number, duration = track.durationSeconds, now = Date.now()) {
  if (!Number.isFinite(epoch) || !Number.isFinite(now) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.max(0, (now - epoch) / 1000) % duration;
}

export function getClubTrackCue(trackSeconds: number, definition: ClubTrack = DEFAULT_CLUB_TRACK): ClubTrackCue {
  let cue = 'groove';
  for (const entry of definition.cues) {
    if (entry.atSeconds > trackSeconds) break;
    cue = entry.cue;
  }
  return cue === 'lounge' || cue === 'peak' ? cue : 'groove';
}
