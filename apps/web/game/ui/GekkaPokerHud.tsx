'use client';
import { useEffect, useState } from 'react';
import { BLUFF_TAUNTS, POKER_SEATS, type PokerAction, type PokerCard, type PokerTableView, type PokerTauntFx } from '@metaverse/game-protocol';
import { describeCard, localDungeonRole, pokerActions } from '../systems/gekkaPokerView';
import { useCountdown } from './KohakuBluffHud';

const STREET_LABEL = { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' } as const;

function CardFace({ card }: { card: PokerCard }) {
  const face = describeCard(card);
  return <span className={face.red ? 'gekka-card is-red' : 'gekka-card'}>{face.rank}{face.suit}</span>;
}

/** HUD 2D của bàn Gekkarō: chỉ hiển thị và gửi lệnh, mọi luật do server quyết định. */
export function GekkaPokerHud({ table, hole, sessionId, mySeatId, names, taunts, ready, act }: {
  table: PokerTableView;
  hole: PokerCard[];
  sessionId: string;
  mySeatId: string;
  names: Record<string, string>;
  taunts: { fx: PokerTauntFx; at: number }[];
  ready(value: boolean): void;
  act(action: PokerAction, amount?: number): void;
}) {
  const seconds = useCountdown(table.deadline);
  const actions = pokerActions(table, sessionId);
  const [raiseTo, setRaiseTo] = useState(actions.minRaiseTo);
  // Mức raise hợp lệ đổi theo từng lượt; kẹp lại để thanh kéo không gửi số dưới mức tối thiểu.
  useEffect(() => { setRaiseTo(actions.minRaiseTo); }, [actions.minRaiseTo, table.turnSeat]);

  const nameOf = (seatId: string) => {
    const seat = table.seats.find(item => item.seatId === seatId);
    return (seat && names[seat.sessionId]) || seatId;
  };
  const mine = table.seats.find(seat => seat.sessionId === sessionId);
  const seated = table.seats.filter(seat => seat.sessionId !== '');
  const role = localDungeonRole(table, sessionId);
  const inGame = table.phase !== 'lobby' && table.phase !== 'gameOver';
  const sittingAtTable = POKER_SEATS.includes(mySeatId);
  const lastTaunt = taunts.at(-1);
  if (table.phase === 'lobby' && seated.length === 0 && !sittingAtTable) return null;

  return <>
    <section className="hud bluff-status" aria-label="Trạng thái bàn Poker">
      {table.phase === 'lobby' && <p className="bluff-line">Chờ người chơi ({seated.length}/{POKER_SEATS.length}){seconds > 0 && <> · Bắt đầu sau {seconds}s</>}</p>}
      {inGame && <>
        <p className="bluff-line bluff-rank">Ván {table.handNumber} · {STREET_LABEL[table.street]} · Blind {table.smallBlind}/{table.bigBlind}</p>
        <p className="bluff-line">Pot: {table.pot.toLocaleString('vi-VN')}{table.currentBet > 0 && <> · Cược hiện tại {table.currentBet}</>}</p>
        {table.phase === 'betting' && table.turnSeat && <p className="bluff-line">Lượt: {nameOf(table.turnSeat)} · {seconds}s</p>}
        {table.phase === 'waiting' && <p className="bluff-line">Bàn tạm dừng, chờ người dưới hầm quyết định…</p>}
        {table.phase === 'showdown' && table.showdown.filter(entry => entry.won > 0).map(entry => (
          <p key={entry.seatId} className="bluff-line bluff-win">{nameOf(entry.seatId)} ăn {entry.won.toLocaleString('vi-VN')}{entry.label && <> · {entry.label}</>}</p>
        ))}
      </>}
      {table.phase === 'gameOver' && <p className="bluff-line bluff-win">{table.winnerSeat ? `${nameOf(table.winnerSeat)} thắng trận!` : 'Trận kết thúc.'}</p>}
      {(inGame || table.phase === 'gameOver') && table.seats.filter(seat => seat.inMatch).map(seat => (
        <p key={seat.seatId} className={seat.out || seat.captive !== 'none' ? 'bluff-player is-out' : 'bluff-player'}>
          {nameOf(seat.seatId)} · {seat.chips.toLocaleString('vi-VN')} chip{seat.debt > 0 && <> · nợ {seat.debt}</>}
          {seat.captive !== 'none' && <> · ở hầm</>}{seat.folded && !seat.out && seat.captive === 'none' && <> · fold</>}{seat.allIn && <> · all-in</>}
        </p>
      ))}
      {role === 'queued' && <p className="bluff-line">{
        mine && table.escort.route.includes(mine.seatId) ? 'Đao phủ Onizuka đang lôi bạn xuống hầm…'
          : sittingAtTable ? 'Bạn thua sạch: ngồi chờ đao phủ xong việc dưới hầm rồi lên lôi đi.'
            : 'Bạn đang bị xích chờ tới lượt lên khung trói.'
      }</p>}
      {role === 'hanging' && <p className="bluff-line">Hết quyền vay: bạn bị treo ở hầm tới hết trận.</p>}
    </section>
    {lastTaunt && <div className="hud gekka-taunt" key={lastTaunt.at}>
      {names[lastTaunt.fx.sessionId] ?? 'Ai đó'} {BLUFF_TAUNTS[lastTaunt.fx.kind].label} {lastTaunt.fx.target === 'prisoner' ? 'người trên khung trói' : nameOf(lastTaunt.fx.target)}
    </div>}
    {sittingAtTable && table.phase === 'lobby' && <div className="hud bluff-actions">
      <button type="button" className="bluff-btn" onClick={() => ready(!mine?.ready)}>{mine?.ready ? 'Hủy sẵn sàng' : 'Sẵn sàng'}</button>
    </div>}
    {mine && inGame && !role && !mine.out && <div className="hud bluff-hand-area">
      {hole.length > 0 && <div className="gekka-hole" aria-label="Bài tẩy">{hole.map(card => <CardFace key={card} card={card}/>)}</div>}
      {table.board.length > 0 && <div className="gekka-hole" aria-label="Bài chung">{table.board.map(card => <CardFace key={card} card={card}/>)}</div>}
      {actions.canAct && <>
        {actions.canRaise && <label className="gekka-raise">
          Raise tới
          <input type="range" min={actions.minRaiseTo} max={actions.maxRaiseTo} step={table.bigBlind > 0 ? Math.min(table.bigBlind, Math.max(1, actions.maxRaiseTo - actions.minRaiseTo)) : 1}
            value={Math.min(Math.max(raiseTo, actions.minRaiseTo), actions.maxRaiseTo)} onChange={event => setRaiseTo(Number(event.target.value))}/>
          <b>{Math.min(Math.max(raiseTo, actions.minRaiseTo), actions.maxRaiseTo)}</b>
        </label>}
        <div className="bluff-buttons">
          <button type="button" className="bluff-btn bluff-btn-danger" onClick={() => act('fold')}>Fold</button>
          {actions.canCheck
            ? <button type="button" className="bluff-btn" onClick={() => act('check')}>Check</button>
            : <button type="button" className="bluff-btn" disabled={actions.callAmount <= 0} onClick={() => act('call')}>Call {actions.callAmount}</button>}
          {actions.canRaise && <button type="button" className="bluff-btn" onClick={() => act('raise', Math.min(Math.max(raiseTo, actions.minRaiseTo), actions.maxRaiseTo))}>Raise</button>}
          <button type="button" className="bluff-btn" onClick={() => act('allin')}>All-in</button>
        </div>
      </>}
    </div>}
  </>;
}
