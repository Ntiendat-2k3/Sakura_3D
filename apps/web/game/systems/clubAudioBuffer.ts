import { DEFAULT_CLUB_TRACK, type ClubTrack } from '@metaverse/game-protocol';

/** Giữ blob từng bài qua các lần đổi phòng, gộp yêu cầu trùng và tải nền tối đa hai bài cùng lúc. */
export function createClubAudioBuffer() {
  const abort = new AbortController();
  const pending = new Map<string, Promise<string>>(), urls = new Set<string>();
  let disposed = false;
  return {
    load(track: ClubTrack = DEFAULT_CLUB_TRACK): Promise<string> {
      if (disposed) return Promise.reject(new Error('Buffer nhạc đã đóng'));
      let result = pending.get(track.url);
      if (!result) {
        result = fetch(track.url, { signal: abort.signal }).then(async response => {
          if (!response.ok) throw new Error('Không tải được nhạc club');
          const blob = await response.blob();
          if (disposed) throw new Error('Buffer nhạc đã đóng');
          if (!blob.size) throw new Error('File nhạc trống');
          const url = URL.createObjectURL(blob); urls.add(url);
          return url;
        }).catch(error => { pending.delete(track.url); throw error; });
        pending.set(track.url, result);
      }
      return result;
    },
    async preload(tracks: readonly ClubTrack[], done: (id: string, ready: boolean) => void) {
      let index = 0;
      await Promise.all([0, 1].map(async () => {
        while (!disposed && index < tracks.length) {
          const track = tracks[index++];
          try { await this.load(track); if (!disposed) done(track.id, true); }
          catch { if (!disposed) done(track.id, false); }
        }
      }));
    },
    dispose() { disposed = true; abort.abort(); urls.forEach(url => URL.revokeObjectURL(url)); urls.clear(); pending.clear(); },
  };
}
