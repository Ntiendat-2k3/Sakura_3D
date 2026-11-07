import { DEFAULT_CLUB_TRACK, getClubTrack, getClubPlaybackSeconds, getClubTrackCue, type ClubShow } from '@metaverse/game-protocol';

/** Mốc thời gian server là nguồn chung cho đèn và nhảy; không phụ thuộc tốc độ khung hình. */
export function getClubBeat(epoch: number, show: ClubShow, now = Date.now()) {
  const seconds = Math.max(0, (now - epoch) / 1000);
  const track = getClubTrack(show.trackId) ?? DEFAULT_CLUB_TRACK;
  const trackSeconds = getClubPlaybackSeconds(epoch, track.durationSeconds, now);
  const beat = Math.max(0, (trackSeconds - show.offset) * show.bpm / 60);
  const elapsedBeat = seconds * show.bpm / 60;
  const phase = beat % 1;
  const cue = show.cue === 'auto' ? getClubTrackCue(trackSeconds, track) : show.cue;
  return { seconds, trackSeconds, beat, elapsedBeat, phase, cue, pulse: .5 + .5 * Math.cos(phase * Math.PI * 2), phrase: Math.floor(beat / 32) };
}

export type ClubQuality = 'low' | 'medium' | 'high';
export type ClubVisualSettings = { quality: ClubQuality; reducedFlashing: boolean };
