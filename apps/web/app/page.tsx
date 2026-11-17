'use client';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useEffect, useState, type FormEvent } from 'react';
import { DEFAULT_PLAYER_CHARACTER, PLAYER_CHARACTERS, type PlayerCharacterId } from '@metaverse/game-protocol';
import { readPlayerChoice, savePlayerChoice } from '../game/systems/playerChoice';
const World = dynamic(() => import('../components/World'), { ssr: false });

/** Chọn mẫu trước khi tạo phiên guest; chỉ mount World sau thao tác vào game, không cần mật khẩu cho test local. */
export default function Home() {
  const [choice, setChoice] = useState<PlayerCharacterId>(DEFAULT_PLAYER_CHARACTER);
  const [active, setActive] = useState<PlayerCharacterId | null>(null);
  useEffect(() => {
    try { setChoice(readPlayerChoice(window.localStorage)); } catch { /* Dùng mặc định khi trình duyệt khóa storage. */ }
    void import('../components/World').catch(() => {});
    if (typeof window !== 'undefined') {
      const img = new window.Image();
      img.src = '/assets/ui/loading-bg.jpg';
    }
  }, []);
  const enter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try { savePlayerChoice(window.localStorage, choice); } catch { /* Lựa chọn trong phiên không phụ thuộc storage. */ }
    setActive(choice);
  };
  if (active) return <main><World characterId={active} chooseCharacter={() => setActive(null)}/></main>;
  return <main className="character-select">
    <div className="character-select-inner">
      <header><span className="character-eyebrow">NEON SAKURA CITY</span><h1>Hẹn gặp ở Sakura.</h1><p>Chọn nhân vật của bạn để bắt đầu khám phá thành phố.</p></header>
      <form onSubmit={enter}>
        <fieldset className="character-options"><legend>Chọn nhân vật</legend>
          {(Object.keys(PLAYER_CHARACTERS) as PlayerCharacterId[]).map(id => {
            const model = PLAYER_CHARACTERS[id];
            return <label key={id} className={`character-card${choice === id ? ' is-selected' : ''}`}>
              <input type="radio" name="character" value={id} checked={choice === id} onChange={() => setChoice(id)}/>
              <span className="character-portrait"><Image src={model.portrait} alt={model.name} width={320} height={400} sizes="(max-width: 680px) 42vw, 190px" priority/></span>
              <span className="character-card-name">{model.name}<span aria-hidden="true">{choice === id ? '✓' : '+'}</span></span>
              <span className="character-card-detail">{id === 'ryo' ? 'Đàn bass' : model.guitar ? 'Đàn guitar' : 'Nhảy theo nhạc'}</span>
            </label>;
          })}
        </fieldset>
        <div className="character-entry"><div><strong>{PLAYER_CHARACTERS[choice].name}</strong><p>Chế độ thử nghiệm · Không cần tài khoản</p></div><button type="submit">Vào game <span aria-hidden="true">↗</span></button></div>
      </form>
      <footer>WASD để di chuyển · Trong club: giữ N + 1–7 để chọn điệu nhảy; N + 2 chơi đàn nếu nhân vật có đàn.</footer>
    </div>
  </main>;
}
