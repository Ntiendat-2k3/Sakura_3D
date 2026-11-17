import type { PokerTableView } from '@metaverse/game-protocol';
import { PokerSeatSchema, PokerShowdownSchema, type PokerTableSchema } from '../state/city.state';

/** Chép dữ liệu bàn công khai; tránh phát patch mảng mỗi tick khi bài không đổi. */
export function syncPokerSchema(target: PokerTableSchema, view: PokerTableView): void {
  target.phase = view.phase;
  target.street = view.street;
  target.handNumber = view.handNumber;
  target.buttonSeat = view.buttonSeat;
  target.turnSeat = view.turnSeat;
  target.deadline = view.deadline;
  target.pot = view.pot;
  target.currentBet = view.currentBet;
  target.minRaise = view.minRaise;
  target.smallBlind = view.smallBlind;
  target.bigBlind = view.bigBlind;
  target.winnerSeat = view.winnerSeat;

  if (target.board.length !== view.board.length || view.board.some((card, index) => target.board[index] !== card)) {
    target.board.clear();
    target.board.push(...view.board);
  }
  const showdownChanged = target.showdown.length !== view.showdown.length || view.showdown.some((entry, index) => {
    const current = target.showdown[index];
    return !current || current.seatId !== entry.seatId || current.label !== entry.label || current.won !== entry.won
      || current.cards.length !== entry.cards.length || entry.cards.some((card, cardIndex) => current.cards[cardIndex] !== card);
  });
  if (showdownChanged) {
    target.showdown.clear();
    for (const entry of view.showdown) {
      const current = new PokerShowdownSchema();
      current.seatId = entry.seatId;
      current.cards.push(...entry.cards);
      current.label = entry.label;
      current.won = entry.won;
      target.showdown.push(current);
    }
  }

  // Số ghế luôn là sáu; giữ nguyên các instance để Colyseus chỉ gửi field thay đổi.
  view.seats.forEach((seat, index) => {
    let current = target.seats[index];
    if (!current) { current = new PokerSeatSchema(); target.seats.push(current); }
    current.seatId = seat.seatId;
    current.sessionId = seat.sessionId;
    current.ready = seat.ready;
    current.inMatch = seat.inMatch;
    current.out = seat.out;
    current.chips = seat.chips;
    current.bet = seat.bet;
    current.committed = seat.committed;
    current.folded = seat.folded;
    current.allIn = seat.allIn;
    current.captive = seat.captive;
    current.debt = seat.debt;
    current.lastAction = seat.lastAction;
  });
  target.dungeon.phase = view.dungeon.phase;
  target.dungeon.seatId = view.dungeon.seatId;
  target.dungeon.punchesTotal = view.dungeon.punchesTotal;
  target.dungeon.punchesDone = view.dungeon.punchesDone;
  target.dungeon.deadline = view.dungeon.deadline;
  target.dungeon.canBorrow = view.dungeon.canBorrow;
  if (target.escort.route.length !== view.escort.route.length || view.escort.route.some((seatId, index) => target.escort.route[index] !== seatId)) {
    target.escort.route.clear();
    target.escort.route.push(...view.escort.route);
  }
  target.escort.startedAt = view.escort.startedAt;
}
