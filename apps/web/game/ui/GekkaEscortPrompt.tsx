'use client';
import type { PokerTableView } from '@metaverse/game-protocol';
import type { GekkaFollowMode } from '../systems/useGekkaEscortFollow';

/** Hỏi người khác có đi theo đao phủ xuống hầm xem tra tấn không; khi đang đi/xem thì hiện nút dừng. */
export function GekkaEscortPrompt({ table, names, mode, seatedAtTable, follow, stop }: {
  table: PokerTableView;
  names: Record<string, string>;
  mode: GekkaFollowMode;
  seatedAtTable: boolean;
  follow(): void;
  stop(): void;
}) {
  if (mode === 'none') return null;
  if (mode === 'walking') {
    return (
      <div className="hud gekka-escort" role="status">
        <p>Đang đi theo Onizuka xuống hầm… Bấm phím di chuyển để tự đi.</p>
        <button type="button" className="bluff-btn" onClick={stop}>Dừng lại</button>
      </div>
    );
  }
  if (mode === 'spectating') {
    return (
      <div className="hud gekka-escort" role="status">
        <p>{table.dungeon.phase === 'idle' ? 'Chờ đao phủ lôi xuống tới hầm…' : 'Đang xem dưới hầm từ ghế.'}</p>
        <button type="button" className="bluff-btn" onClick={stop}>Về bàn</button>
      </div>
    );
  }
  // Đoàn đã xuống tới hầm thì route rỗng: lúc đó gọi tên người đang trên khung.
  const dragging = table.escort.route.length > 0;
  const victims = (dragging ? table.escort.route : [table.dungeon.seatId])
    .map(seatId => table.seats.find(seat => seat.seatId === seatId)?.sessionId)
    .map(sessionId => (sessionId && names[sessionId]) || 'người thua')
    .join(', ');
  return (
    <div className="hud gekka-escort" role="dialog" aria-label="Đi theo xuống hầm">
      <p>{dragging
        ? <>Đao phủ Onizuka đang lôi <b>{victims}</b> xuống hầm. Đi theo xem tra tấn?</>
        : <>Onizuka đang tra tấn <b>{victims}</b> dưới hầm. Xuống xem?</>}</p>
      <div className="bluff-buttons">
        <button type="button" className="bluff-btn bluff-btn-danger" onClick={follow}>{seatedAtTable ? 'Xem từ ghế' : 'Đi theo'}</button>
        <button type="button" className="bluff-btn" onClick={stop}>Thôi</button>
      </div>
    </div>
  );
}
