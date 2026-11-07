'use client';
import { useState, type FormEvent } from 'react';
import type { ChatMessage, PlayerDanceStyle, WorldZone } from '@metaverse/game-protocol';
export function WorldHud({ online, connection, count, chat, sendChat, bloom, toggleBloom, zone, nearPortal, switching, interact, seated, seatEnabled, seatOccupied, sit, dancing, danceStyle, dance, characterName = 'Bocchi', hasGuitar = true, chooseCharacter }: {online:boolean;connection:string;count:number;chat:ChatMessage[];sendChat:(text:string)=>void;bloom:boolean;toggleBloom:()=>void;zone:WorldZone;nearPortal:boolean;switching:boolean;interact:()=>void;seated:boolean;seatEnabled:boolean;seatOccupied:boolean;sit:()=>void;dancing:boolean;danceStyle:PlayerDanceStyle;dance:(style:PlayerDanceStyle)=>void;characterName?:string;hasGuitar?:boolean;chooseCharacter?:()=>void}) {
  const [input, setInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); sendChat(input); setInput(''); };
  return <>
    <header className="hud top"><h1>🌸 NEON SAKURA CITY</h1><p>{zone === 'club' ? 'DENMU NIGHT CLUB · WINE × POP' : 'Khu phố Sakura · Cửa DENMU ở vòng sáng xanh/hồng'}</p><button className="graphics-toggle" aria-pressed={bloom} onClick={toggleBloom}>Ánh sáng bloom: {bloom ? 'Bật' : 'Tắt'} · {bloom ? 'Điện ảnh' : 'Ưu tiên FPS'}</button></header>
    <div className="hud panel"><span className={online?'pill online':'pill'}>{online?'● ONLINE':'○ OFFLINE'} · {count} người</span><p>{connection}</p>{chooseCharacter && <button type="button" className="graphics-toggle" onClick={chooseCharacter}>{characterName} · Đổi nhân vật</button>}</div>
    <div className="hud help">🎮 WASD / ↑↓←→ — Đi theo hướng nhìn<br/>🖱 Kéo chuột trái/phải: xoay 360° · Cuộn: zoom<br/>{zone === 'club' ? 'WINE × POP · Sân khấu phía trước' : 'Đi tới cửa DENMU · Nhấn E để vào club'}<br/>
      <button className="graphics-toggle portal-action" disabled={!online || !nearPortal || switching} onClick={interact}>{switching ? 'Đang chuyển phòng…' : nearPortal ? (zone === 'club' ? 'E · Ra phố' : 'E · Vào Night Club') : (zone === 'club' ? 'Đi tới cửa EXIT để ra phố' : 'Tới vòng sáng cửa DENMU để vào')}</button>
      {zone === 'club' && <button className="graphics-toggle seat-action" disabled={!online || !seatEnabled || switching} onClick={sit}>{seated ? 'Enter · Đứng dậy' : seatOccupied ? 'Ghế đang có người ngồi' : seatEnabled ? 'Enter · Ngồi xuống ghế' : 'Đến sát sofa · Enter để ngồi'}</button>}
      {zone === 'club' && <>
        <button type="button" className="graphics-toggle dance-action" aria-pressed={dancing && danceStyle === 'normal'} disabled={!online || seated || switching} onClick={() => dance('normal')}>{dancing && danceStyle === 'normal' ? 'N + 1 · Dừng nhảy' : 'N + 1 · Nhảy'}</button>
        <button type="button" className="graphics-toggle dance-action" aria-pressed={dancing && danceStyle === 'guitar'} disabled={!online || seated || switching || !hasGuitar} onClick={() => dance('guitar')}>{!hasGuitar ? 'Nhân vật này không có đàn' : dancing && danceStyle === 'guitar' ? 'N + 2 · Cất đàn, dừng nhảy' : 'N + 2 · Cầm đàn nhảy'}</button>
        <button type="button" className="graphics-toggle dance-action" aria-pressed={dancing && danceStyle === 'flair'} disabled={!online || seated || switching} onClick={() => dance('flair')}>{dancing && danceStyle === 'flair' ? 'N + 3 · Dừng Flair' : 'N + 3 · Flair'}</button>
        <small>{seated ? 'Đứng dậy để nhảy.' : dancing ? 'Nhấn lại tổ hợp đang chọn hoặc WASD để dừng.' : 'Giữ N rồi bấm 1, 2 hoặc 3 để chọn kiểu nhảy.'}</small>
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
