/** So bài Texas Hold'em trên server; điểm chỉ dùng để so sánh và không đi qua Schema. */
import type { PokerCard } from '@metaverse/game-protocol';

const RANKS = '23456789TJQKA';
const LABELS = ['Mậu thầu', 'Đôi', 'Thú', 'Sám cô', 'Sảnh', 'Thùng', 'Cù lũ', 'Tứ quý', 'Thùng phá sảnh'] as const;

/** So từng hạng rồi từng kicker từ cao xuống thấp; trả 0 khi bài hòa tuyệt đối. */
export function compareScores(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = (a[i] ?? 0) - (b[i] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function scoreFive(cards: readonly PokerCard[]): number[] {
  const ranks = cards.map(card => RANKS.indexOf(card[0]) + 2).sort((a, b) => b - a);
  const counts = new Map<number, number>();
  for (const rank of ranks) counts.set(rank, (counts.get(rank) ?? 0) + 1);
  const groups = [...counts].map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);
  const flush = cards.every(card => card[1] === cards[0][1]);
  const distinct = [...counts.keys()].sort((a, b) => b - a);
  const wheel = distinct.join(',') === '14,5,4,3,2';
  const straightHigh = distinct.length === 5 && distinct[0] - distinct[4] === 4 ? distinct[0] : wheel ? 5 : 0;

  if (flush && straightHigh) return [8, straightHigh];
  if (groups[0].count === 4) return [7, groups[0].rank, groups[1].rank];
  if (groups[0].count === 3 && groups[1].count === 2) return [6, groups[0].rank, groups[1].rank];
  if (flush) return [5, ...ranks];
  if (straightHigh) return [4, straightHigh];
  if (groups[0].count === 3) return [3, groups[0].rank, ...groups.slice(1).map(group => group.rank).sort((a, b) => b - a)];
  if (groups[0].count === 2 && groups[1].count === 2) return [2, groups[0].rank, groups[1].rank, groups[2].rank];
  if (groups[0].count === 2) return [1, groups[0].rank, ...groups.slice(1).map(group => group.rank).sort((a, b) => b - a)];
  return [0, ...ranks];
}

/** Duyệt tối đa 21 bộ năm lá từ bảy lá, giữ năm lá mạnh nhất theo luật Hold'em. */
export function rankHand(cards: readonly PokerCard[]): { score: number[]; label: string; best: PokerCard[] } {
  if (cards.length < 5 || cards.length > 7) throw new RangeError('Bài phải có 5–7 lá.');
  if (new Set(cards).size !== cards.length) throw new Error('Bộ bài có lá trùng.');
  if (!cards.every(card => /^[2-9TJQKA][shdc]$/.test(card))) throw new Error('Có lá bài không hợp lệ.');

  let best: PokerCard[] = [];
  let bestScore: number[] = [];
  for (let a = 0; a < cards.length - 4; a++) {
    for (let b = a + 1; b < cards.length - 3; b++) {
      for (let c = b + 1; c < cards.length - 2; c++) {
        for (let d = c + 1; d < cards.length - 1; d++) {
          for (let e = d + 1; e < cards.length; e++) {
            const hand = [cards[a], cards[b], cards[c], cards[d], cards[e]];
            const score = scoreFive(hand);
            if (!best.length || compareScores(score, bestScore) > 0) {
              best = hand;
              bestScore = score;
            }
          }
        }
      }
    }
  }
  return { score: bestScore, label: LABELS[bestScore[0]], best };
}
