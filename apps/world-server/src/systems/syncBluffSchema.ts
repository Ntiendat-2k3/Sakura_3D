import type { BluffTableView } from '@metaverse/game-protocol';
import { BluffSeatSchema, type BluffTableSchema } from '../state/city.state';

/** Chép view công khai của engine sang schema; chỉ ghi lại mảng lá đã lật khi nội dung đổi để khỏi patch thừa mỗi tick. */
export function syncBluffSchema(target: BluffTableSchema, view: BluffTableView): void {
  target.phase = view.phase;
  target.tableRank = view.tableRank;
  target.turnSeat = view.turnSeat;
  target.deadline = view.deadline;
  target.lastPlaySeat = view.lastPlay.seatId;
  target.lastPlayCount = view.lastPlay.count;
  target.accuserSeat = view.accuserSeat;
  target.shooterSeat = view.shooterSeat;
  target.shotResult = view.shotResult;
  target.winnerSeat = view.winnerSeat;

  const revealed = view.lastPlay.revealed;
  if (target.revealed.length !== revealed.length || revealed.some((face, i) => target.revealed[i] !== face)) {
    // ArraySchema.splice không cho chèn nhiều hơn xóa nên dùng clear rồi push.
    target.revealed.clear();
    target.revealed.push(...revealed);
  }

  // Số ghế cố định theo BLUFF_SEATS nên chỉ tạo schema ghế một lần rồi cập nhật tại chỗ.
  view.seats.forEach((seat, i) => {
    let out = target.seats[i];
    if (!out) { out = new BluffSeatSchema(); target.seats.push(out); }
    out.seatId = seat.seatId;
    out.sessionId = seat.sessionId;
    out.ready = seat.ready;
    out.inMatch = seat.inMatch;
    out.alive = seat.alive;
    out.cardCount = seat.cardCount;
    out.pulls = seat.pulls;
  });
}
