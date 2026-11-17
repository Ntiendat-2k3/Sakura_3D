/** Kohaku Bluff: kiểu dữ liệu, hằng số và chuẩn hóa input dùng chung cho server và web. */
import { KOHAKU_SEATS } from './club';

export type BluffRank = 'K' | 'Q' | 'A';
export type BluffFace = BluffRank | 'JOKER';
export type BluffCard = { id: string; face: BluffFace };

export const BLUFF_DECK: Readonly<Record<BluffFace, number>> = { K: 6, Q: 6, A: 6, JOKER: 2 };
export const BLUFF_RANKS: readonly BluffRank[] = ['K', 'Q', 'A'];
export const BLUFF_HAND_SIZE = 5;
export const BLUFF_MAX_PLAY = 3;
export const BLUFF_MIN_PLAYERS = 2;
export const BLUFF_CHAMBERS = 6;
/** Chỉ các ghế người chơi của bàn Kohaku, giữ đúng thứ tự 1..4. */
export const BLUFF_SEATS: readonly string[] = KOHAKU_SEATS.filter(s => s.id.startsWith('kohaku-player-')).map(s => s.id);

/** bangResultMs: pha result sau phát nổ thật dài hơn 'click' để kịp thấy người thua gục xuống bàn và máu lan ra mặt nỉ. */
export const BLUFF_TIMING = { turnMs: 30000, readyCountdownMs: 20000, revealMs: 2500, suspenseMs: 2000, resultMs: 2500, bangResultMs: 6500, gameOverMs: 5000, tauntCooldownMs: 3000 } as const;

export type BluffPhase = 'lobby' | 'turn' | 'reveal' | 'shooting' | 'result' | 'gameOver';
export type BluffSeatView = { seatId: string; sessionId: string; ready: boolean; inMatch: boolean; alive: boolean; cardCount: number; pulls: number };
/** seatId '' nghĩa là chưa có lần úp bài nào. */
export type BluffLastPlay = { seatId: string; count: number; revealed: BluffFace[] };
export type BluffTableView = {
  phase: BluffPhase; tableRank: BluffRank | ''; turnSeat: string; deadline: number;
  lastPlay: BluffLastPlay; accuserSeat: string; shooterSeat: string; shotResult: '' | 'click' | 'bang';
  winnerSeat: string; seats: BluffSeatView[];
};

export const BLUFF_MESSAGES = { ready: 'bluff-ready', play: 'bluff-play', liar: 'bluff-liar', hand: 'bluff-hand', taunt: 'bluff-taunt', tauntFx: 'bluff-taunt-fx' } as const;

/** Cà khịa chỉ là hiệu ứng thoáng qua (không vào Schema); phím 1-4 bấm khi đang ngồi trong ván. */
export type BluffTauntKind = 'flip' | 'point' | 'slam' | 'laugh';
export const BLUFF_TAUNTS: Readonly<Record<BluffTauntKind, { label: string; key: string; durationMs: number }>> = {
  flip: { label: 'Giơ ngón giữa', key: '1', durationMs: 1500 },
  point: { label: 'Chỉ mặt', key: '2', durationMs: 1500 },
  slam: { label: 'Đập bàn', key: '3', durationMs: 1200 },
  laugh: { label: 'Cười khẩy', key: '4', durationMs: 1600 },
};
export type BluffTauntInput = { kind: BluffTauntKind; targetSeat: string };
/** Server broadcast cho cả phòng sau khi đã kiểm điều kiện và cooldown. */
export type BluffTauntFx = { seatId: string; kind: BluffTauntKind; targetSeat: string };

export function createEmptyBluffTable(): BluffTableView {
  return {
    phase: 'lobby', tableRank: '', turnSeat: '', deadline: 0,
    lastPlay: { seatId: '', count: 0, revealed: [] }, accuserSeat: '', shooterSeat: '', shotResult: '',
    winnerSeat: '',
    seats: BLUFF_SEATS.map(seatId => ({ seatId, sessionId: '', ready: false, inMatch: false, alive: false, cardCount: 0, pulls: 0 })),
  };
}

const MAX_CARD_ID_LENGTH = 16;

/** Nhận { cardIds }: 1–3 id chuỗi ngắn, không trùng. Mọi thứ khác trả null. */
export function normalizeBluffPlay(input: unknown): string[] | null {
  if (!input || typeof input !== 'object') return null;
  const ids = (input as Record<string, unknown>).cardIds;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > BLUFF_MAX_PLAY) return null;
  if (!ids.every(id => typeof id === 'string' && id.length > 0 && id.length <= MAX_CARD_ID_LENGTH)) return null;
  if (new Set(ids).size !== ids.length) return null;
  return [...ids] as string[];
}

/** Joker thay được mọi hạng; chỉ cần một lá khác hạng là nói dối. */
export function isBluffTruthful(faces: readonly BluffFace[], rank: BluffRank): boolean {
  return faces.every(face => face === 'JOKER' || face === rank);
}

/** Nhận { kind, targetSeat } với kind thuộc BLUFF_TAUNTS và đích là ghế người chơi Bluff. Mọi thứ khác trả null. */
export function normalizeBluffTaunt(input: unknown): BluffTauntInput | null {
  if (!input || typeof input !== 'object') return null;
  const { kind, targetSeat } = input as Record<string, unknown>;
  if (typeof kind !== 'string' || !Object.hasOwn(BLUFF_TAUNTS, kind)) return null;
  if (typeof targetSeat !== 'string' || !BLUFF_SEATS.includes(targetSeat)) return null;
  return { kind: kind as BluffTauntKind, targetSeat };
}
