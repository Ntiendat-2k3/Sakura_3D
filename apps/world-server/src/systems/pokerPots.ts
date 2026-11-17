/** Chia pot Texas Hold'em trong bộ nhớ server, kể cả all-in và hoàn phần cược không ai theo. */
import { compareScores } from './pokerHandRank';

export type PotEntry = { seatId: string; committed: number; folded: boolean };
export type PokerPot = { amount: number; eligible: string[] };

/** Tách các mức góp chip; lớp chỉ có một người góp là phần chip hoàn trả cho người đó. */
export function buildPots(entries: readonly PotEntry[]): PokerPot[] {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!entry.seatId || ids.has(entry.seatId) || !Number.isSafeInteger(entry.committed) || entry.committed < 0) {
      throw new Error('Mức góp chip hoặc ghế không hợp lệ.');
    }
    ids.add(entry.seatId);
  }

  const levels = [...new Set(entries.map(entry => entry.committed).filter(amount => amount > 0))].sort((a, b) => a - b);
  const pots: PokerPot[] = [];
  let previous = 0;
  for (const level of levels) {
    const contributors = entries.filter(entry => entry.committed >= level);
    const width = level - previous;
    let eligible = contributors.filter(entry => !entry.folded).map(entry => entry.seatId);

    if (contributors.length === 1) {
      // Cược vượt quá mức mọi người đã theo được trả lại, kể cả khi người góp đã fold.
      eligible = [contributors[0].seatId];
    } else if (!eligible.length) {
      // Không tự trao chip cho người chưa góp ở mức này; engine phải xử lý trạng thái bất khả thi.
      throw new Error('Pot không có người đủ quyền nhận.');
    }

    const amount = width * contributors.length;
    const last = pots.at(-1);
    if (last && last.eligible.length === eligible.length && last.eligible.every((seatId, i) => seatId === eligible[i])) {
      last.amount += amount;
    } else {
      pots.push({ amount, eligible });
    }
    previous = level;
  }
  return pots;
}

/** Chia mỗi pot theo điểm bài; chip lẻ đi theo thứ tự ghế bên trái nút dealer. */
export function awardPots(pots: readonly PokerPot[], scores: ReadonlyMap<string, number[]>, orderFromButton: readonly string[]): Map<string, number> {
  const awards = new Map<string, number>();
  for (const pot of pots) {
    if (!Number.isSafeInteger(pot.amount) || pot.amount < 0 || !pot.eligible.length) throw new Error('Pot không hợp lệ.');
    let winners: string[];
    if (pot.eligible.length === 1) {
      winners = pot.eligible;
    } else {
      let bestScore: number[] | undefined;
      winners = [];
      for (const seatId of pot.eligible) {
        const score = scores.get(seatId);
        if (!score) throw new Error(`Thiếu điểm bài của ghế ${seatId}.`);
        const comparison = bestScore ? compareScores(score, bestScore) : 1;
        if (comparison > 0) { bestScore = score; winners = [seatId]; }
        else if (comparison === 0) winners.push(seatId);
      }
    }
    const share = Math.floor(pot.amount / winners.length);
    let oddChips = pot.amount % winners.length;
    const ordered = [...winners].sort((a, b) => {
      const aIndex = orderFromButton.indexOf(a);
      const bIndex = orderFromButton.indexOf(b);
      return (aIndex < 0 ? Infinity : aIndex) - (bIndex < 0 ? Infinity : bIndex);
    });
    for (const seatId of ordered) {
      const extra = oddChips > 0 ? 1 : 0;
      oddChips -= extra;
      const chips = share + extra;
      awards.set(seatId, (awards.get(seatId) ?? 0) + chips);
    }
  }
  return awards;
}
