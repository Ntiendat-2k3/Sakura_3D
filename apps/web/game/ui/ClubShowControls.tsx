'use client';
import { useEffect, useState } from 'react';
import { CLUB_CUES, getDefaultClubShow, type ClubShow } from '@metaverse/game-protocol';
import type { ClubVisualSettings } from '../systems/BeatSyncController';
import type { ClubAudioState } from '../systems/useClubAudio';

/** Mọi khách dùng cùng MP3 qua HTTP; âm thanh chỉ phát sau thao tác đồng ý, room không chuyển byte audio. */
export function ClubShowControls({ audio, show, settings, setSettings, setShow, isDJ }: { audio: ClubAudioState; show: ClubShow; settings: ClubVisualSettings; setSettings: (s: ClubVisualSettings) => void; setShow: (s: ClubShow) => void; isDJ: boolean }) {
  const [draft, setDraft] = useState(show);
  const { track, playing, volume, error, definition } = audio;
  useEffect(() => setDraft(show), [show]);
  function saveMetadata() {
    if (!track) return;
    const blob = new Blob([JSON.stringify({ title: track.name, duration: track.duration, bpm: draft.bpm, beatOffsetSeconds: draft.offset, cues: track.local ? [{ atSeconds: 0, cue: draft.cue }] : definition.cues }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'club-track-metadata.json'; link.click(); URL.revokeObjectURL(url);
  }
  return <details className="club-show-controls">
    <summary>DENMU · Điều khiển show</summary>
    <label>Chất lượng <select aria-label="Chất lượng club" value={settings.quality} onChange={e => setSettings({ ...settings, quality: e.target.value as ClubVisualSettings['quality'] })}>
      <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
    </select></label>
    <small>Bloom chỉ hoạt động ở High; bật bằng nút ánh sáng phía trên.</small>
    <label><input type="checkbox" checked={settings.reducedFlashing} onChange={e => setSettings({ ...settings, reducedFlashing: e.target.checked })}/> Giảm nhấp nháy</label>
    <p>Show phòng: {show.cue} · {show.bpm} BPM<br/>{isDJ ? 'Bạn đang giữ bàn DJ.' : 'Khách đầu tiên điều khiển bàn DJ.'}</p>
    <fieldset disabled={!isDJ}>
      <legend>Demo / timeline chung</legend>
      <label>Cue <select aria-label="Cue" value={draft.cue} onChange={e => setDraft({ ...draft, cue: e.target.value as ClubShow['cue'] })}>{CLUB_CUES.map(cue => <option key={cue} value={cue}>{cue === 'auto' ? 'Theo bài nhạc' : cue}</option>)}</select></label>
      <label>BPM <input aria-label="BPM" type="number" min="60" max="180" value={draft.bpm} onChange={e => setDraft({ ...draft, bpm: Number(e.target.value) })}/></label>
      <label>Beat offset (giây) <input aria-label="Beat offset" type="number" min="-10" max="10" step="0.01" value={draft.offset} onChange={e => setDraft({ ...draft, offset: Number(e.target.value) })}/></label>
      <button onClick={() => setShow(draft)}>Áp dụng / bắt đầu lại</button>
      <button onClick={() => setShow(getDefaultClubShow(definition))}>Đồng bộ theo bài nhạc</button>
    </fieldset>
    <p>Nhạc chung: {definition.title} · {Math.floor(definition.durationSeconds / 60)}:{String(Math.floor(definition.durationSeconds % 60)).padStart(2, '0')}<br/>BPM ước lượng: {definition.bpm}. Phát khi bạn vào cửa; có nút phát dự phòng nếu trình duyệt chặn.</p>
    <label>Nghe thử file khác (chỉ máy này)<input aria-label="Nhạc của bạn" type="file" accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg" onChange={e => {
      const file = e.target.files?.[0]; if (!file) return;
      audio.selectLocal(file);
      e.target.value = '';
    }}/></label>
    {track ? <>
      <span className="club-track-name">{track.name}</span>
      {track.local && <small>File nghe thử chỉ thay âm thanh trên máy này; timeline của phòng vẫn dùng nhạc chung.</small>}
      <button onClick={audio.toggleAudio}>{playing ? 'Tạm dừng nhạc' : 'Cho phép phát nhạc'}</button>
      <label>Âm lượng <input aria-label="Âm lượng nhạc club" type="range" min="0" max="1" step="0.01" value={volume} onChange={e => audio.setVolume(Number(e.target.value))}/></label>
      <button onClick={saveMetadata}>Lưu metadata track</button>
      <button onClick={audio.clearTrack}>Bỏ file nhạc</button>
    </> : <small>Âm thanh đang tắt trên máy này; show của phòng vẫn chạy.</small>}
    {track?.url !== audio.sharedTrack.url && <button onClick={audio.useSharedTrack}>Dùng nhạc chung của club</button>}
    {error && <p role="alert">{error}</p>}
    {audio.bufferError && <button onClick={() => audio.prepareTrack(definition.id)}>Tải lại nhạc chung</button>}
  </details>;
}
