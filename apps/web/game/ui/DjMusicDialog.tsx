'use client';
import { useEffect, useRef } from 'react';
import { CLUB_PLAYLIST } from '@metaverse/game-protocol';
import type { useDjInteraction } from '../systems/useDjInteraction';
import type { ClubAudioState } from '../systems/useClubAudio';

export function DjMusicDialog({ interaction, audio, activeTrackId, select }: { interaction: ReturnType<typeof useDjInteraction>; audio: ClubAudioState; activeTrackId?: string; select: (id: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (interaction.opened && element && !element.open) element.showModal();
    else if (!interaction.opened && element?.open) element.close();
  }, [interaction.opened]);
  useEffect(() => {
    if (!interaction.own || interaction.opened) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') interaction.cancel(); };
    window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape);
  }, [interaction.own, interaction.opened, interaction.cancel]);
  return <>
    {interaction.near && (!interaction.own || interaction.phase === 'holding') && <button className="npc-interact graphics-toggle" disabled={interaction.phase !== 'idle' && interaction.phase !== 'holding'} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); interaction.begin(); }} onPointerUp={interaction.end} onPointerCancel={interaction.end} onLostPointerCapture={interaction.end} onKeyDown={event => { if (!event.repeat && (event.key === ' ' || event.key === 'Enter')) { event.preventDefault(); interaction.begin(); } }} onKeyUp={interaction.end} onBlur={interaction.end}>
      {interaction.phase === 'holding' && interaction.own ? 'Tiếp tục giữ O…' : interaction.phase === 'idle' ? 'Giữ O · Gọi DJ Rio chọn nhạc' : 'DJ đang phục vụ khách · Vui lòng chờ'}
    </button>}
    {interaction.own && !interaction.opened && <div className="dj-status" role="status">
      <span>{interaction.phase === 'holding' ? 'Đang gọi DJ…' : 'DJ đang đi tới bạn…'}</span>
      {interaction.phase === 'holding' && <progress aria-label="Thời gian giữ O" value={interaction.progress} max={1}/>}
      <button onClick={interaction.cancel}>Hủy · Esc</button>
    </div>}
    <dialog ref={dialog} className="npc-dialog dj-music-dialog" aria-labelledby="dj-music-title" onCancel={event => { event.preventDefault(); interaction.cancel(); }}>
      <small>DJ RIO · DENMU</small><h2 id="dj-music-title">Bạn muốn nghe bài nào?</h2>
      <p>Chọn một bài để phát cho cả phòng. Âm lượng được chỉnh riêng trên máy bạn.</p>
      <ul className="dj-playlist">{CLUB_PLAYLIST.map(track => {
        const loaded = audio.buffered[track.id];
        return <li key={track.id}><span>{track.title}{track.artist ? ` · ${track.artist}` : ''}<small>{Math.floor(track.durationSeconds / 60)}:{String(Math.floor(track.durationSeconds % 60)).padStart(2, '0')}{track.id === activeTrackId ? ' · Đang phát' : ''}</small></span>
          {loaded === 'error' ? <button onClick={() => audio.prepareTrack(track.id)}>Tải lại</button> : <button disabled={loaded !== 'ready'} onClick={() => { audio.chooseShared(); select(track.id); }}>{loaded === 'ready' ? 'Phát' : 'Đang tải…'}</button>}
        </li>;
      })}</ul>
      <button autoFocus onClick={interaction.cancel}>Đóng · DJ quay lại bàn</button>
    </dialog>
  </>;
}
