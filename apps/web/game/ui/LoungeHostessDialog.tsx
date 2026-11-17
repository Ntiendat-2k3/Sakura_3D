'use client';
import { useEffect, useRef } from 'react';
import { REIKA_PLAYLIST } from '@metaverse/game-protocol';
import type { ClubAudioState } from '../systems/useClubAudio';
import { HOTEL_MOODS, type HotelMoodId } from '../scenes/HotelScene';
import {
  LOUNGE_HOSTESS_PERSONAS,
  type useLoungeInteraction,
} from '../systems/useLoungeInteraction';

/** Hộp thoại tương tác 20+, nút "Đi với anh nhé", đổi đèn Love Hotel và order nhạc phòng Reika/Love Hotel (Yuzu, Bunny, Zankou). */
export function LoungeHostessDialog({
  interaction,
  audio,
  activeTrackId,
  selectTrack,
  inLounge = true,
  inHotel = false,
  hotelMood = 'magenta',
  setHotelMood,
}: {
  interaction: ReturnType<typeof useLoungeInteraction>;
  audio?: ClubAudioState;
  activeTrackId?: string;
  selectTrack?: (id: string) => void;
  inLounge?: boolean;
  inHotel?: boolean;
  hotelMood?: HotelMoodId;
  setHotelMood?: (mood: HotelMoodId) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const activeId = interaction.openNpc;
  const nearId = interaction.nearNpc;
  const persona = activeId ? LOUNGE_HOSTESS_PERSONAS[activeId] : nearId ? LOUNGE_HOSTESS_PERSONAS[nearId] : null;
  const currentMode = activeId ? interaction.modes[activeId] : 'idle';
  const isCompanion = !!activeId && interaction.companionId === activeId;
  const opened = !!activeId;

  useEffect(() => {
    const element = dialog.current;
    if (opened && element && !element.open) element.showModal();
    if (!opened && element?.open) element.close();
  }, [opened]);

  return (
    <>
      {nearId && persona && (
        <button hidden={opened} className="npc-interact graphics-toggle" onClick={interaction.open}>
          {interaction.companionId === nearId
            ? `F · Trò chuyện với ${persona.name} ♥ (${inHotel ? 'Trong phòng Love Hotel' : 'Đang đi cùng bạn'})`
            : `F · Trò chuyện, Order nhạc & Gọi đào ${persona.name}`}
        </button>
      )}
      <dialog
        ref={dialog}
        className="npc-dialog dj-music-dialog"
        aria-labelledby="lounge-hostess-title"
        onCancel={event => {
          event.preventDefault();
          interaction.close();
        }}
      >
        {activeId && persona && (
          <>
            <small>{inHotel ? 'CYBER LOVE HOTEL · PRIVATE SUITE 2077 (20+)' : persona.badge}</small>
            <h2 id="lounge-hostess-title">{persona.greetingTitle}</h2>
            <p>{inHotel && isCompanion ? persona.hotelLine : isCompanion ? persona.companionLine : persona.lines[currentMode]}</p>
            <div className="npc-dialog-actions" style={{ flexWrap: 'wrap' }}>
              <button
                autoFocus
                style={{ background: isCompanion ? '#4a2540' : '#a83279', borderColor: '#ff99cc', fontWeight: 700 }}
                onClick={() => interaction.toggleCompanion(activeId)}
              >
                {isCompanion ? 'Cho em về lại vị trí' : 'Đi với anh nhé ♥'}
              </button>
              <button
                disabled={currentMode === 'dance'}
                onClick={() => interaction.setNpcMode(activeId, 'dance')}
              >
                Nhảy riêng quyến rũ
              </button>
              <button
                disabled={currentMode === 'flirt'}
                onClick={() => interaction.setNpcMode(activeId, 'flirt')}
              >
                Tạo dáng & Hôn gió ♥
              </button>
              <button
                disabled={currentMode === 'toast'}
                onClick={() => interaction.setNpcMode(activeId, 'toast')}
              >
                Mời rượu Champagne
              </button>
              {currentMode !== 'idle' && (
                <button onClick={() => interaction.setNpcMode(activeId, 'idle')}>
                  Nghỉ tạo dáng
                </button>
              )}
              <button onClick={interaction.close}>Đóng</button>
            </div>
            {inHotel && setHotelMood && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(255,42,157,0.12)', borderRadius: 8, border: '1px solid rgba(255,119,200,0.35)' }}>
                <small style={{ display: 'block', color: '#ff99dd', fontWeight: 700, marginBottom: 6 }}>
                  ĐÈN NEON MOOD PHÒNG LOVE HOTEL
                </small>
                <div className="npc-dialog-actions" style={{ flexWrap: 'wrap' }}>
                  {(Object.keys(HOTEL_MOODS) as HotelMoodId[]).map(moodKey => (
                    <button
                      key={moodKey}
                      type="button"
                      aria-pressed={hotelMood === moodKey}
                      style={hotelMood === moodKey ? { background: '#b81d7a', borderColor: '#ff99e6', fontWeight: 700 } : undefined}
                      onClick={() => setHotelMood(moodKey)}
                    >
                      {HOTEL_MOODS[moodKey].label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {(inLounge || inHotel) && audio && selectTrack && (
              <>
                <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(255,214,153,0.08)', borderRadius: 8, border: '1px solid rgba(255,214,153,0.2)' }}>
                  <small style={{ display: 'block', color: '#ffd699', fontWeight: 700 }}>
                    {activeTrackId
                      ? inHotel ? 'ĐANG PHÁT NHẠC PHÒNG LOVE HOTEL' : 'ĐANG PHÁT TẠI REIKA LOUNGE'
                      : 'PHÒNG YÊN TĨNH · CHƯA BẬT NHẠC'}
                  </small>
                  <p style={{ margin: '4px 0 8px', fontSize: 13, color: '#e6ccdc' }}>
                    {activeTrackId
                      ? `Phòng đang phát bài đã order. Bạn có thể đổi bài khác bất kỳ lúc nào.`
                      : `Mặc định phòng giữ yên tĩnh. Chọn một bài bên dưới để order mở nhạc cho cả phòng:`}
                  </p>
                </div>
                <ul className="dj-playlist">
                  {REIKA_PLAYLIST.map(track => {
                    const loaded = audio.buffered[track.id];
                    const isPlayingTrack = !!activeTrackId && (track.id === activeTrackId);
                    return (
                      <li key={track.id}>
                        <span>
                          {track.title}
                          {track.artist ? ` · ${track.artist}` : ''}
                          <small>
                            {Math.floor(track.durationSeconds / 60)}:
                            {String(Math.floor(track.durationSeconds % 60)).padStart(2, '0')}
                            {isPlayingTrack ? ' · Đang phát tại Reika' : ''}
                          </small>
                        </span>
                        {loaded === 'error' ? (
                          <button onClick={() => audio.prepareTrack(track.id)}>Tải lại</button>
                        ) : (
                          <button
                            disabled={loaded !== 'ready' || isPlayingTrack}
                            onClick={() => {
                              audio.chooseShared();
                              selectTrack(track.id);
                            }}
                          >
                            {isPlayingTrack ? 'Đang phát' : loaded === 'ready' ? 'Order nhạc' : 'Đang tải…'}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            <small>
              {isCompanion
                ? 'Đào đang đi theo bạn sang cả Phố và Club; khi bạn nhảy (N+1..7) cô ấy sẽ tự nhảy cùng bạn!'
                : 'Chọn "Đi với anh nhé ♥" để dẫn đào đi dạo phố hoặc vào Club nhảy cùng bạn'}
            </small>
          </>
        )}
      </dialog>
    </>
  );
}
