'use client';
import { POKER_RULES, type PokerTableView } from '@metaverse/game-protocol';
import { useCountdown } from './KohakuBluffHud';

/** Chỉ hiện cho người trên cột ở pha choice: vay tiếp hoặc rời bàn; hết giờ server tự tính là rời bàn. */
export function GekkaDungeonDialog({ table, mySeatId, choose }: {
  table: PokerTableView;
  mySeatId: string;
  choose(choice: 'borrow' | 'leave'): void;
}) {
  const { dungeon } = table;
  const seconds = useCountdown(dungeon.phase === 'choice' ? dungeon.deadline : 0);
  if (dungeon.phase !== 'choice' || !mySeatId || dungeon.seatId !== mySeatId) return null;
  const debt = table.seats.find(seat => seat.seatId === mySeatId)?.debt ?? 0;
  return (
    <div className="hud gekka-dungeon" role="dialog" aria-label="Lựa chọn ở hầm">
      <p>Còn {seconds} giây để quyết định.</p>
      <div className="bluff-buttons">
        {dungeon.canBorrow && (
          <button type="button" className="bluff-btn" onClick={() => choose('borrow')}>
            Vay {POKER_RULES.startingChips.toLocaleString('vi-VN')} chip (nợ {debt + 1}/{POKER_RULES.maxLoans})
          </button>
        )}
        <button type="button" className="bluff-btn bluff-btn-danger" onClick={() => choose('leave')}>Rời bàn</button>
      </div>
    </div>
  );
}
