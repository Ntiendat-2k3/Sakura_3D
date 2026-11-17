// Chuyển state Schema của bàn Poker Gekkarō sang view thuần và gom luật bật/tắt nút, để HUD không phải biết dạng Schema.
import {
  POKER_SEATS, createEmptyPokerTable,
  type DungeonPhase, type PokerAction, type PokerCaptive, type PokerCard, type PokerPhase, type PokerStreet, type PokerTableView,
} from '@metaverse/game-protocol';

type Iterable<T> = { forEach: (cb: (value: T, index: number) => void) => void };

// ArraySchema phía client không phải mảng thường nên phải chép ra, nếu không React so sánh/serialize sai.
function copyList<T>(list: Iterable<T> | undefined): T[] {
  const out: T[] = [];
  list?.forEach(item => out.push(item));
  return out;
}

const DUNGEON_ACTIVE: readonly DungeonPhase[] = ['capture', 'punching', 'choice'];

export function readPokerTable(raw: unknown): PokerTableView {
  const empty = createEmptyPokerTable();
  if (!raw || typeof raw !== 'object') return empty;
  const s = raw as Record<string, unknown>;
  const d = (s.dungeon ?? {}) as Record<string, unknown>;
  const seats = s.seats ? copyList(s.seats as Iterable<Record<string, unknown>>) : [];
  return {
    phase: (s.phase as PokerPhase) ?? empty.phase,
    street: (s.street as PokerStreet) ?? empty.street,
    handNumber: (s.handNumber as number) ?? 0,
    buttonSeat: (s.buttonSeat as string) ?? '',
    turnSeat: (s.turnSeat as string) ?? '',
    deadline: (s.deadline as number) ?? 0,
    board: copyList(s.board as Iterable<PokerCard> | undefined),
    pot: (s.pot as number) ?? 0,
    currentBet: (s.currentBet as number) ?? 0,
    minRaise: (s.minRaise as number) ?? empty.minRaise,
    smallBlind: (s.smallBlind as number) ?? empty.smallBlind,
    bigBlind: (s.bigBlind as number) ?? empty.bigBlind,
    showdown: copyList(s.showdown as Iterable<Record<string, unknown>> | undefined).map(entry => ({
      seatId: (entry.seatId as string) ?? '',
      cards: copyList(entry.cards as Iterable<PokerCard> | undefined),
      label: (entry.label as string) ?? '',
      won: (entry.won as number) ?? 0,
    })),
    winnerSeat: (s.winnerSeat as string) ?? '',
    // Schema đôi khi chưa kịp có đủ 6 ghế ở patch đầu; luôn trả đủ ghế theo POKER_SEATS để HUD không lệch chỉ số.
    seats: empty.seats.map((fallback, index) => {
      const seat = seats[index];
      if (!seat) return fallback;
      return {
        seatId: (seat.seatId as string) || POKER_SEATS[index],
        sessionId: (seat.sessionId as string) ?? '',
        ready: !!seat.ready,
        inMatch: !!seat.inMatch,
        out: !!seat.out,
        chips: (seat.chips as number) ?? 0,
        bet: (seat.bet as number) ?? 0,
        committed: (seat.committed as number) ?? 0,
        folded: !!seat.folded,
        allIn: !!seat.allIn,
        captive: (seat.captive as PokerCaptive) ?? 'none',
        debt: (seat.debt as number) ?? 0,
        lastAction: (seat.lastAction as PokerAction | '') ?? '',
      };
    }),
    dungeon: {
      phase: (d.phase as DungeonPhase) ?? 'idle',
      seatId: (d.seatId as string) ?? '',
      punchesTotal: (d.punchesTotal as number) ?? 0,
      punchesDone: (d.punchesDone as number) ?? 0,
      deadline: (d.deadline as number) ?? 0,
      canBorrow: !!d.canBorrow,
    },
    escort: {
      route: copyList((s.escort as { route?: Iterable<string> } | undefined)?.route),
      startedAt: ((s.escort as { startedAt?: number } | undefined)?.startedAt) ?? 0,
    },
  };
}

const seatOfSession = (table: PokerTableView, sessionId: string) =>
  sessionId ? table.seats.find(seat => seat.sessionId === sessionId) : undefined;

/** Phản chiếu luật engine để chỉ bật nút hợp lệ; server vẫn là nơi kiểm tra cuối cùng. */
export function pokerActions(table: PokerTableView, sessionId: string) {
  const seat = seatOfSession(table, sessionId);
  const canAct = !!seat && table.phase === 'betting' && table.turnSeat === seat.seatId
    && seat.inMatch && !seat.out && !seat.folded && !seat.allIn && seat.captive === 'none' && seat.chips > 0;
  const toCall = seat ? Math.max(0, table.currentBet - seat.bet) : 0;
  const callAmount = seat ? Math.min(toCall, seat.chips) : 0;
  const minRaiseTo = table.currentBet + table.minRaise;
  const maxRaiseTo = seat ? seat.chips + seat.bet : 0;
  return {
    canAct,
    canCheck: canAct && toCall === 0,
    callAmount,
    minRaiseTo,
    maxRaiseTo,
    // Không đủ chip để raise tối thiểu thì chỉ còn nút All-in.
    canRaise: canAct && maxRaiseTo >= minRaiseTo,
  };
}

export function canPokerTaunt(table: PokerTableView, sessionId: string, mySeatId: string): boolean {
  if (table.phase === 'lobby' || table.phase === 'gameOver') return false;
  const seat = seatOfSession(table, sessionId);
  if (seat && seat.captive !== 'none') return false;
  if (!POKER_SEATS.includes(mySeatId)) return DUNGEON_ACTIVE.includes(table.dungeon.phase);
  return !!seat && seat.seatId === mySeatId && seat.inMatch && !seat.out;
}

/** Không có UI chọn đích: người đứng xem luôn nhắm người trên cột; người ngồi bàn nhắm người đang tới lượt hoặc người kế tiếp. */
export function defaultPokerTauntTarget(table: PokerTableView, mySeatId: string): string {
  if (!POKER_SEATS.includes(mySeatId)) return 'prisoner';
  const valid = (seatId: string) => seatId !== '' && seatId !== mySeatId
    && table.seats.some(seat => seat.seatId === seatId && seat.inMatch && !seat.out && seat.captive === 'none');
  if (valid(table.turnSeat)) return table.turnSeat;
  const start = table.seats.findIndex(seat => seat.seatId === mySeatId);
  for (let step = 1; step <= table.seats.length; step++) {
    const seat = table.seats[(start + step) % table.seats.length];
    if (valid(seat.seatId)) return seat.seatId;
  }
  return '';
}

export function localDungeonRole(table: PokerTableView, sessionId: string): 'prisoner' | 'queued' | 'hanging' | null {
  const seat = seatOfSession(table, sessionId);
  if (!seat || seat.captive === 'none') return null;
  return seat.captive === 'post' ? 'prisoner' : seat.captive;
}

/** Ghế ở hầm (cột, chỗ xích) không phải ghế ngồi: avatar đứng chứ không dùng clip Sit. */
export function isGekkaCaptiveSeat(seatId: string | undefined): boolean {
  return !!seatId && (seatId === 'gekka-post' || seatId.startsWith('gekka-cell-'));
}

const SUITS: Record<string, { symbol: string; red: boolean }> = {
  s: { symbol: '♠', red: false }, h: { symbol: '♥', red: true }, d: { symbol: '♦', red: true }, c: { symbol: '♣', red: false },
};

/** 'Td' → { rank: '10', suit: '♦', red: true } để vẽ lá bài bằng chữ, không cần texture atlas. */
export function describeCard(card: PokerCard): { rank: string; suit: string; red: boolean } {
  const suit = SUITS[card[1]] ?? { symbol: '?', red: false };
  return { rank: card[0] === 'T' ? '10' : card[0] ?? '?', suit: suit.symbol, red: suit.red };
}

/** Lệnh tư thế bị trói cho avatar ở hầm (xem gekkaRestraintPose). */
export type GekkaRestraintCue = {
  kind: 'post' | 'cell';
  /** performance.now() lúc cú đấm gần nhất trúng người này; null nếu chưa bị đấm. */
  hitAt: number | null;
  heavy: boolean;
};

/** Người ở khung chữ A nhận nhịp đấm; người ở vòng xích tường chỉ bị trói, không bị đấm. */
export function gekkaRestraintCue(seatId: string | undefined, punch: { punchAt: number | null; final: boolean }): GekkaRestraintCue | null {
  if (!isGekkaCaptiveSeat(seatId)) return null;
  return seatId === 'gekka-post' ? { kind: 'post', hitAt: punch.punchAt, heavy: punch.final } : { kind: 'cell', hitAt: null, heavy: false };
}
