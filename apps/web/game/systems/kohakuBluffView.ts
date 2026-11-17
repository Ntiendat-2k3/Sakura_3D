// Chuyển state Schema của bàn Bluff sang view thuần và gom luật bật/tắt nút, để HUD không phải biết dạng Schema.
import { BLUFF_MAX_PLAY, createEmptyBluffTable, type BluffFace, type BluffPhase, type BluffRank, type BluffSeatView, type BluffTableView } from '@metaverse/game-protocol';

type Iterable<T> = { forEach: (cb: (value: T, index: number) => void) => void };

// ArraySchema phía client không phải mảng thường nên phải chép ra, nếu không React so sánh/serialize sai.
function copyList<T>(list: Iterable<T> | undefined): T[] {
  const out: T[] = [];
  list?.forEach(item => out.push(item));
  return out;
}

export function readBluffTable(raw: unknown): BluffTableView {
  if (!raw || typeof raw !== 'object') return createEmptyBluffTable();
  const s = raw as Record<string, unknown>;
  const empty = createEmptyBluffTable();
  // Server làm phẳng lastPlay thành 3 trường; ghép lại để web dùng đúng BluffTableView.
  return {
    phase: (s.phase as BluffPhase) ?? empty.phase,
    tableRank: (s.tableRank as BluffRank | '') ?? '',
    turnSeat: (s.turnSeat as string) ?? '',
    deadline: (s.deadline as number) ?? 0,
    lastPlay: { seatId: (s.lastPlaySeat as string) ?? '', count: (s.lastPlayCount as number) ?? 0, revealed: copyList(s.revealed as Iterable<BluffFace> | undefined) },
    accuserSeat: (s.accuserSeat as string) ?? '',
    shooterSeat: (s.shooterSeat as string) ?? '',
    shotResult: (s.shotResult as BluffTableView['shotResult']) ?? '',
    winnerSeat: (s.winnerSeat as string) ?? '',
    seats: s.seats ? copyList(s.seats as Iterable<BluffSeatView>).map(seat => ({ seatId: seat.seatId, sessionId: seat.sessionId, ready: seat.ready, inMatch: seat.inMatch, alive: seat.alive, cardCount: seat.cardCount, pulls: seat.pulls })) : empty.seats,
  };
}

/** Bấm lại thì bỏ chọn; đủ số lá tối đa thì bỏ qua lá mới (server cũng chặn, đây chỉ để UI khớp). */
export function toggleBluffSelection(selected: readonly string[], cardId: string): string[] {
  if (selected.includes(cardId)) return selected.filter(id => id !== cardId);
  return selected.length >= BLUFF_MAX_PLAY ? [...selected] : [...selected, cardId];
}

export function bluffActions(table: BluffTableView, sessionId: string) {
  const seat = sessionId ? table.seats.find(item => item.sessionId === sessionId) : undefined;
  const mySeat = seat?.seatId ?? '';
  // Trong ván engine giữ sessionId của ghế dù người đó đã bị loại/đứng dậy (chỉ lobby mới đồng bộ lại ghế),
  // nên "có ghế" chưa đủ: phải còn trong ván và còn sống mới được coi là đang chơi. mySeat vẫn giữ để HUD hiện lớp mờ khi bị bắn.
  const isPlaying = !!seat && (table.phase === 'lobby' || (seat.inMatch && seat.alive));
  const canReady = table.phase === 'lobby' && mySeat !== '';
  const canPlay = isPlaying && table.phase === 'turn' && table.turnSeat === mySeat;
  // Không thể tố chính lần úp của mình, và chưa có lần úp nào thì không có gì để tố.
  const canCallLiar = canPlay && table.lastPlay.seatId !== '' && table.lastPlay.seatId !== mySeat;
  return { canReady, canPlay, canCallLiar, mySeat, isPlaying };
}

/** Phản chiếu điều kiện cà khịa của server (trừ cooldown) để phím 1-4 không gửi vô ích. */
export function canTauntNow(table: BluffTableView, sessionId: string): boolean {
  const seat = sessionId ? table.seats.find(item => item.sessionId === sessionId) : undefined;
  if (!seat || !seat.inMatch || !seat.alive) return false;
  if (table.phase === 'lobby' || table.phase === 'gameOver') return false;
  return !((table.phase === 'shooting' || table.phase === 'result') && table.shooterSeat === seat.seatId);
}

/**
 * Không có UI chọn đích nên đích luôn là người "đáng bị khịa" nhất lúc đó:
 * người đang tới lượt, hoặc người vừa úp nếu đang là lượt mình, hoặc người cầm súng; thiếu thì người sống kế tiếp.
 */
export function defaultTauntTarget(table: BluffTableView, mySeat: string): string {
  const valid = (seatId: string) => seatId !== '' && seatId !== mySeat && table.seats.some(s => s.seatId === seatId && s.inMatch && s.alive);
  const preferred = table.phase === 'turn'
    ? (table.turnSeat !== mySeat ? [table.turnSeat] : [table.lastPlay.seatId])
    : [table.shooterSeat];
  const hit = preferred.find(valid);
  if (hit) return hit;
  const start = table.seats.findIndex(s => s.seatId === mySeat);
  for (let step = 1; step <= table.seats.length; step++) {
    const seat = table.seats[(start + step) % table.seats.length];
    if (valid(seat.seatId)) return seat.seatId;
  }
  return '';
}
