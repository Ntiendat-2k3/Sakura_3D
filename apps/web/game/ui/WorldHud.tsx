'use client';
import { useState, type FormEvent } from 'react';
import { PLAYER_DANCES, type ChatMessage, type PlayerDanceStyle, type WorldZone } from '@metaverse/game-protocol';
import { HOTEL_MOODS, type HotelMoodId } from '../scenes/HotelScene';
import type { CameraViewMode } from '../systems/FollowCamera';

const danceStyles = Object.keys(PLAYER_DANCES) as PlayerDanceStyle[];
export function WorldHud({
  online,
  connection,
  count,
  chat,
  sendChat,
  bloom,
  toggleBloom,
  zone,
  nearPortal,
  portalLabel = 'Night Club',
  switching,
  isDoorOpening = false,
  interact,
  seated,
  seatEnabled,
  seatOccupied,
  sit,
  dancing,
  danceStyle,
  dance,
  characterName = 'Bocchi',
  hasGuitar = true,
  chooseCharacter,
  hotelMood = 'magenta',
  setHotelMood,
  cameraMode = 'overview',
  setCameraMode,
}: {
  online: boolean;
  connection: string;
  count: number;
  chat: ChatMessage[];
  sendChat: (text: string) => void;
  bloom: boolean;
  toggleBloom: () => void;
  zone: WorldZone;
  nearPortal: boolean;
  portalLabel?: string;
  switching: boolean;
  isDoorOpening?: boolean;
  interact: () => void;
  seated: boolean;
  seatEnabled: boolean;
  seatOccupied: boolean;
  sit: () => void;
  dancing: boolean;
  danceStyle: PlayerDanceStyle;
  dance: (style: PlayerDanceStyle) => void;
  characterName?: string;
  hasGuitar?: boolean;
  chooseCharacter?: () => void;
  hotelMood?: HotelMoodId;
  setHotelMood?: (mood: HotelMoodId) => void;
  cameraMode?: CameraViewMode;
  setCameraMode?: (mode: CameraViewMode) => void;
}) {
  const [input, setInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); sendChat(input); setInput(''); };
  return <>
    <header className="hud top">
      <h1>🌸 NEON SAKURA CITY</h1>
      <p>{zone === 'club' ? 'DENMU NIGHT CLUB · WINE × POP' : zone === 'lounge' ? 'REIKA HOSTESS LOUNGE · CHAMPAGNE & VIP' : zone === 'hotel' ? 'CYBER LOVE HOTEL · PRIVATE SUITE 2077 (20+)' : zone === 'kohaku' ? '琥珀 KOHAKU CLUB · 1F CASINO · 2F GALLERY · 3F SKY VIP' : zone === 'gekka' ? '月華楼 GEKKARŌ · TAISHŌ POKER SALON' : 'Hòn Đảo Sakura · Cổng Torii Huyết Nguyệt, DENMU, REIKA, HOTEL, KOHAKU & GEKKARŌ'}</p>
      <div className="top-actions">
        <button className="graphics-toggle" aria-pressed={bloom} onClick={toggleBloom}>Ánh sáng bloom: {bloom ? 'Bật' : 'Tắt'} · {bloom ? 'Điện ảnh' : 'Ưu tiên FPS'}</button>
      </div>
    </header>
    {zone === 'street' && setCameraMode && (
      <div className="hud view-mode-switcher" role="group" aria-label="Chế độ góc nhìn">
        <span className="view-mode-label">GÓC NHÌN CAMERA (PHÍM V)</span>
        <div className="view-mode-buttons">
          <button
            type="button"
            className={`graphics-toggle view-mode-btn${cameraMode === 'overview' ? ' is-active' : ''}`}
            aria-pressed={cameraMode === 'overview'}
            onClick={() => setCameraMode('overview')}
          >
            🏝️ Toàn cảnh Đảo
          </button>
          <button
            type="button"
            className={`graphics-toggle view-mode-btn${cameraMode === 'character' ? ' is-active' : ''}`}
            aria-pressed={cameraMode === 'character'}
            onClick={() => setCameraMode('character')}
          >
            👤 Góc nhìn Nhân vật
          </button>
        </div>
      </div>
    )}
    <div className="hud panel"><span className={online?'pill online':'pill'}>{online?'● ONLINE':'○ OFFLINE'} · {count} người</span><p>{connection}</p>{chooseCharacter && <button type="button" className="graphics-toggle" onClick={chooseCharacter}>{characterName} · Đổi nhân vật</button>}</div>
    <div className="hud help">🎮 WASD / ↑↓←→ — Đi theo hướng nhìn<br/>🖱 Kéo chuột: xoay 360° · Cuộn: zoom · Phím C: căn sau lưng<br/>{zone === 'club' ? 'WINE × POP · Sân khấu phía trước' : zone === 'lounge' ? 'REIKA LOUNGE · Nhấn F gọi đào · Thang bộ lên tầng 2 Love Hotel' : zone === 'hotel' ? 'CYBER LOVE HOTEL · Giường King Velvet, Bồn Jacuzzi & Đèn Mood' : zone === 'kohaku' ? 'KOHAKU CLUB · Ngồi bàn Poker bằng Enter · Cầu thang phải lên 2F & 3F' : zone === 'gekka' ? 'GEKKARŌ · Ngồi bàn bằng Enter · Phím 1–4 cà khịa · Cầu thang phải xuống hầm' : 'REIKA (Lounge & Hotel) · KOHAKU (Casino 3 Tầng) · GEKKARŌ (Poker) · Công viên: ghế đá (K hôn) · Q đấm người đứng gần'}<br/>
      <button className="graphics-toggle portal-action" disabled={!online || !nearPortal || switching || isDoorOpening} onClick={interact}>
        {switching || isDoorOpening ? 'Đang mở cửa…' : nearPortal ? `Bước qua cửa hoặc nhấn E · ${portalLabel}` : (zone === 'street' ? 'Tiến sát cửa để tự động bước vào nhà' : zone === 'lounge' ? 'Tiến sát cửa ra phố hoặc bước lên cầu thang Tầng 2 Love Hotel' : zone === 'hotel' ? 'Tiến sát cửa để xuống lại tầng 1 Reika Lounge' : zone === 'kohaku' || zone === 'gekka' ? 'Tiến sát cửa sảnh tầng 1 để ra phố Sakura' : 'Tiến sát cửa EXIT để bước ra phố')}
      </button>
      {(zone === 'club' || zone === 'lounge' || zone === 'hotel' || zone === 'kohaku' || zone === 'gekka' || (zone === 'street' && (seated || seatEnabled))) && (
        <button className="graphics-toggle seat-action" disabled={!online || !seatEnabled || switching} onClick={sit}>
          {seated
            ? 'Enter · Đứng dậy'
            : seatOccupied
              ? 'Vị trí này đang có người'
              : seatEnabled
                ? (zone === 'hotel' ? 'Enter · Ngồi / Tựa trên giường & Jacuzzi' : zone === 'kohaku' ? 'Enter · Ngồi xuống ghế Poker / Sofa' : zone === 'gekka' ? 'Enter · Ngồi vào bàn Poker' : zone === 'street' ? 'Enter · Ngồi xuống ghế đá' : 'Enter · Ngồi xuống ghế')
                : (zone === 'hotel' ? 'Đến sát giường King / Jacuzzi / Sofa · Enter' : zone === 'kohaku' ? 'Đến sát ghế Poker / Sofa · Enter để ngồi' : zone === 'gekka' ? 'Đến sát ghế bàn Poker · Enter để ngồi' : 'Đến sát sofa · Enter để ngồi')}
        </button>
      )}
      {zone === 'hotel' && setHotelMood && (
        <div className="dance-actions" style={{ marginTop: 6 }}>
          {(Object.keys(HOTEL_MOODS) as HotelMoodId[]).map(moodKey => (
            <button
              key={moodKey}
              type="button"
              className="graphics-toggle dance-action"
              aria-pressed={hotelMood === moodKey}
              onClick={() => setHotelMood(moodKey)}
            >
              {`Đèn: ${HOTEL_MOODS[moodKey].label}`}
            </button>
          ))}
        </div>
      )}
      {zone === 'club' && <>
        <div className="dance-actions">{danceStyles.map(style => {
          const definition = PLAYER_DANCES[style], active = dancing && danceStyle === style;
          const label = active ? style === 'normal' ? 'Dừng nhảy' : style === 'guitar' ? 'Cất đàn, dừng nhảy' : `Dừng ${definition.label}` : definition.label;
          return <button key={style} type="button" className="graphics-toggle dance-action" aria-pressed={active} disabled={!online || seated || switching || style === 'guitar' && !hasGuitar} onClick={() => dance(style)}>{style === 'guitar' && !hasGuitar ? 'Nhân vật này không có đàn' : `N + ${definition.key} · ${label}`}</button>;
        })}</div>
        <small>{seated ? 'Đứng dậy để nhảy.' : dancing ? 'Nhấn lại tổ hợp đang chọn hoặc WASD để dừng.' : 'Giữ N rồi bấm 1–7 để chọn kiểu nhảy.'}</small>
      </>}
    </div>
    <aside className={`chatbox${chatOpen ? '' : ' chatbox-collapsed'}`} aria-label="Chat phòng">
      <button type="button" className="chat-title chat-toggle" aria-expanded={chatOpen} aria-controls="room-chat-content" aria-label={chatOpen ? 'Thu gọn chat phòng' : 'Mở chat phòng'} title={chatOpen ? 'Thu gọn chat' : 'Mở chat phòng'} onClick={() => setChatOpen(value => !value)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3Z"/><path d="M7 8h9M7 12h6"/></svg>
        {chatOpen && <><span>Room Chat</span><span aria-hidden="true">−</span></>}
      </button>
      <div id="room-chat-content" hidden={!chatOpen}>
      <div className="chat-messages" aria-live="polite">{chat.length===0?<p className="empty">Hãy chào những người trong phòng!</p>:chat.map((m,i)=><div key={`${m.userId}-${m.at}-${i}`}><b>{m.name}: </b>{m.text}</div>)}</div>
      <form onSubmit={submit}><input aria-label="Nhập nội dung chat" value={input} onChange={e=>setInput(e.target.value)} placeholder="Nhắn tin..." maxLength={180}/><button type="submit" disabled={!online || !input.trim()}>Gửi</button></form>
      </div>
    </aside>
  </>;
}
