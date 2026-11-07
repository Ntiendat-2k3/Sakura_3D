import { DEFAULT_CLUB_TRACK, type ClubTrack } from './club-music';

export const CLUB_CUES = ['auto', 'lounge', 'groove', 'peak'] as const;
export type ClubCue = typeof CLUB_CUES[number];
export type ClubShow = { bpm: number; offset: number; cue: ClubCue; trackId?: string };
export function getDefaultClubShow(track: ClubTrack = DEFAULT_CLUB_TRACK): ClubShow {
  return { bpm: track.bpm, offset: track.beatOffsetSeconds, cue: 'auto', trackId: track.id };
}
export const DEFAULT_CLUB_SHOW = getDefaultClubShow();

/** Chỉ cho phép metadata hữu hạn; không nhận URL, byte âm thanh hoặc vị trí từ client. */
export function validateClubShow(value: unknown): ClubShow | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as Record<string, unknown>;
  if (typeof p.bpm !== 'number' || !Number.isFinite(p.bpm) || p.bpm < 60 || p.bpm > 180) return null;
  if (typeof p.offset !== 'number' || !Number.isFinite(p.offset) || Math.abs(p.offset) > 10) return null;
  if (!CLUB_CUES.includes(p.cue as ClubCue)) return null;
  return { bpm: p.bpm, offset: p.offset, cue: p.cue as ClubCue };
}
