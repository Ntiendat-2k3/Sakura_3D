'use client';
import { useEffect, useState } from 'react';
import { BLUFF_CHAMBERS, type BluffCard, type BluffTableView } from '@metaverse/game-protocol';
import { bluffActions, toggleBluffSelection } from '../systems/kohakuBluffView';

const TICK_MS = 300;

/** Số giây còn lại tới deadline (epoch ms của server); 0 nghĩa là không có đếm ngược. */
export function useCountdown(deadline: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline <= 0) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, [deadline]);
  return deadline > 0 ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
}

/** HUD 2D của bàn Kohaku Bluff: chỉ hiển thị, mọi luật do server quyết định. */
export function KohakuBluffHud({ table, hand, sessionId, names, ready, play, liar }: {
  table: BluffTableView;
  hand: BluffCard[];
  sessionId: string;
  names: Record<string, string>;
  ready(value: boolean): void;
  play(cardIds: string[]): void;
  liar(): void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const seconds = useCountdown(table.deadline);
  const { canReady, canPlay, canCallLiar, mySeat, isPlaying } = bluffActions(table, sessionId);
  const inGame = table.phase !== 'lobby' && table.phase !== 'gameOver';
  const nameOf = (seatId: string) => {
    const seat = table.seats.find(item => item.seatId === seatId);
    return (seat && names[seat.sessionId]) || seatId;
  };

  // Bài đổi (úp xong, chia vòng mới) hoặc hết lượt thì bỏ chọn, tránh gửi id không còn trên tay.
  useEffect(() => { setSelected([]); }, [hand]);
  useEffect(() => { if (table.phase !== 'turn') setSelected([]); }, [table.phase]);

  const seated = table.seats.filter(seat => seat.sessionId !== '');
  const mine = table.seats.find(seat => seat.seatId === mySeat);
  const eliminated = table.phase === 'result' && mySeat !== '' && table.shooterSeat === mySeat && table.shotResult === 'bang';
  const showHud = table.phase !== 'lobby' || seated.length > 0;
  if (!showHud) return null;

  return <>
    {eliminated && <div className="bluff-eliminated" aria-hidden="true"/>}
    <section className="hud bluff-status" aria-label="Trạng thái bàn Bluff">
      {table.phase === 'lobby' && <p className="bluff-line">Chờ người chơi ({seated.length}/4){seconds > 0 && <> · Bắt đầu sau {seconds}s</>}</p>}
      {inGame && <>
        {table.tableRank && <p className="bluff-line bluff-rank">Lá chuẩn: {table.tableRank}</p>}
        {table.phase === 'turn' && table.turnSeat && <p className="bluff-line">Lượt: {nameOf(table.turnSeat)} · {seconds}s</p>}
      </>}
      {table.phase === 'gameOver' && <p className="bluff-line bluff-win">{nameOf(table.winnerSeat)} thắng ván!</p>}
      {(inGame || table.phase === 'gameOver') && table.seats.filter(seat => seat.inMatch).map(seat => (
        <p key={seat.seatId} className={seat.alive ? 'bluff-player' : 'bluff-player is-out'}>
          {nameOf(seat.seatId)} · {seat.cardCount} lá · 🔫 {seat.pulls}/{BLUFF_CHAMBERS}
        </p>
      ))}
    </section>
    {mySeat !== '' && canReady && <div className="hud bluff-actions">
      <button type="button" className="bluff-btn" onClick={() => ready(!mine?.ready)}>{mine?.ready ? 'Hủy sẵn sàng' : 'Sẵn sàng'}</button>
    </div>}
    {isPlaying && inGame && <div className="hud bluff-hand-area">
      <div className="bluff-hand" role="group" aria-label="Bài trên tay">
        {hand.map(card => <button key={card.id} type="button" disabled={!canPlay}
          className={selected.includes(card.id) ? 'bluff-card is-selected' : 'bluff-card'}
          aria-pressed={selected.includes(card.id)} onClick={() => setSelected(current => toggleBluffSelection(current, card.id))}>{card.face === 'JOKER' ? '🃏' : card.face}</button>)}
      </div>
      <div className="bluff-buttons">
        <button type="button" className="bluff-btn" disabled={!canPlay || selected.length === 0} onClick={() => { play(selected); setSelected([]); }}>Úp bài ({selected.length} lá)</button>
        <button type="button" className="bluff-btn bluff-btn-danger" disabled={!canCallLiar} onClick={liar}>NÓI DỐI!</button>
      </div>
    </div>}
  </>;
}
