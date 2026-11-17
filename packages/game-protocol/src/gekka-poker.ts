/** Giao thức Poker Gekkarō dùng chung; bàn công khai không chứa bài tẩy hoặc bộ bài. */
import { POKER_SEATS } from './gekka';
import { BLUFF_TAUNTS, type BluffTauntKind } from './kohaku-bluff';

export type PokerCard = string;

export const POKER_RULES = {
  startingChips: 1000,
  smallBlind: 10,
  bigBlind: 20,
  blindDoubleEveryHands: 10,
  maxLoans: 2,
  minPlayers: 2,
  maxPlayers: 6,
} as const;

export const POKER_TIMING = {
  turnMs: 30000,
  readyCountdownMs: 20000,
  showdownMs: 5000,
  captureMs: 2500,
  punchIntervalMs: 1200,
  finalPunchIntervalMs: 1800,
  choiceMs: 20000,
  gameOverMs: 5000,
} as const;

export function punchesFor(debt: number): number {
  return 5 + 3 * debt;
}

/** Mỗi mười ván hoàn tất làm blind của ván tiếp theo tăng gấp đôi. */
export function blindsFor(handNumber: number): { small: number; big: number } {
  const multiplier = 2 ** Math.floor((handNumber - 1) / POKER_RULES.blindDoubleEveryHands);
  return { small: POKER_RULES.smallBlind * multiplier, big: POKER_RULES.bigBlind * multiplier };
}

export type PokerPhase = 'lobby' | 'betting' | 'showdown' | 'waiting' | 'gameOver';
export type PokerStreet = 'preflop' | 'flop' | 'turn' | 'river';
export type PokerAction = 'fold' | 'check' | 'call' | 'raise' | 'allin';
export type PokerCaptive = 'none' | 'queued' | 'post' | 'hanging';
export type PokerSeatView = {
  seatId: string;
  sessionId: string;
  ready: boolean;
  inMatch: boolean;
  out: boolean;
  chips: number;
  bet: number;
  committed: number;
  folded: boolean;
  allIn: boolean;
  captive: PokerCaptive;
  debt: number;
  lastAction: PokerAction | '';
};
export type PokerShowdownEntry = { seatId: string; cards: PokerCard[]; label: string; won: number };
export type DungeonPhase = 'idle' | 'capture' | 'punching' | 'choice';
export type PokerTableView = {
  phase: PokerPhase;
  street: PokerStreet;
  handNumber: number;
  buttonSeat: string;
  turnSeat: string;
  deadline: number;
  board: PokerCard[];
  pot: number;
  currentBet: number;
  minRaise: number;
  smallBlind: number;
  bigBlind: number;
  showdown: PokerShowdownEntry[];
  winnerSeat: string;
  seats: PokerSeatView[];
  dungeon: { phase: DungeonPhase; seatId: string; punchesTotal: number; punchesDone: number; deadline: number; canBorrow: boolean };
  /** Đao phủ đang lôi người thua sạch xuống hầm: route là ghế theo thứ tự hàng đợi, startedAt (ms Date.now) = 0 khi rảnh. */
  escort: { route: string[]; startedAt: number };
};

export const POKER_MESSAGES = {
  ready: 'poker-ready',
  act: 'poker-act',
  choose: 'poker-choose',
  hole: 'poker-hole',
  taunt: 'poker-taunt',
  tauntFx: 'poker-taunt-fx',
} as const;

export type PokerTauntInput = { kind: BluffTauntKind; target: string };
export type PokerTauntFx = { sessionId: string; kind: BluffTauntKind; target: string };

export function createEmptyPokerTable(): PokerTableView {
  return {
    phase: 'lobby', street: 'preflop', handNumber: 0, buttonSeat: '', turnSeat: '', deadline: 0,
    board: [], pot: 0, currentBet: 0, minRaise: POKER_RULES.bigBlind,
    smallBlind: POKER_RULES.smallBlind, bigBlind: POKER_RULES.bigBlind,
    showdown: [], winnerSeat: '',
    seats: POKER_SEATS.map(seatId => ({
      seatId, sessionId: '', ready: false, inMatch: false, out: false,
      chips: 0, bet: 0, committed: 0, folded: false, allIn: false,
      captive: 'none', debt: 0, lastAction: '',
    })),
    dungeon: { phase: 'idle', seatId: '', punchesTotal: 0, punchesDone: 0, deadline: 0, canBorrow: false },
    escort: { route: [], startedAt: 0 },
  };
}

/** Chỉ chuyển dữ liệu đầu vào thành lệnh; engine còn phải kiểm tra lượt và mức tố. */
export function normalizePokerAction(input: unknown): { action: PokerAction; amount?: number } | null {
  if (!input || typeof input !== 'object') return null;
  const { action, amount } = input as Record<string, unknown>;
  if (action === 'raise') {
    return typeof amount === 'number' && Number.isInteger(amount) && amount > 0 && amount <= 1_000_000_000
      ? { action, amount }
      : null;
  }
  if (action === 'fold' || action === 'check' || action === 'call' || action === 'allin') return { action };
  return null;
}

export function normalizePokerChoice(input: unknown): 'borrow' | 'leave' | null {
  if (!input || typeof input !== 'object') return null;
  const choice = (input as Record<string, unknown>).choice;
  return choice === 'borrow' || choice === 'leave' ? choice : null;
}

/** Đích cà khịa chỉ là ghế người chơi hoặc người đang ở cột, không nhận ID slot NPC. */
export function normalizePokerTaunt(input: unknown): PokerTauntInput | null {
  if (!input || typeof input !== 'object') return null;
  const { kind, target } = input as Record<string, unknown>;
  if (typeof kind !== 'string' || !Object.hasOwn(BLUFF_TAUNTS, kind)) return null;
  if (typeof target !== 'string' || (target !== 'prisoner' && !POKER_SEATS.includes(target))) return null;
  return { kind: kind as BluffTauntKind, target };
}
