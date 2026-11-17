/** Hàng đợi và đồng hồ đấm thuần cho hầm Gekkarō; room chỉ thực hiện dịch chuyển nhân vật. */
import { POKER_TIMING, type PokerTableView } from '@metaverse/game-protocol';

type DungeonView = PokerTableView['dungeon'];

export function createDungeonQueue() {
  const waiting: string[] = [];
  let post = '';
  return {
    enqueue(seatIds: readonly string[]) {
      for (const seatId of seatIds) if (seatId !== post && !waiting.includes(seatId)) waiting.push(seatId);
    },
    startNext(): string {
      if (post) return '';
      post = waiting.shift() ?? '';
      return post;
    },
    remove(seatId: string): boolean {
      if (post === seatId) { post = ''; return true; }
      const index = waiting.indexOf(seatId);
      if (index < 0) return false;
      waiting.splice(index, 1);
      return true;
    },
    post: () => post,
    waiting: () => [...waiting],
    clear() { waiting.length = 0; post = ''; },
  };
}

export function beginDungeonPost(seatId: string, punchesTotal: number, canBorrow: boolean, now: number): DungeonView {
  return { phase: 'capture', seatId, punchesTotal, punchesDone: 0, deadline: now + POKER_TIMING.captureMs, canBorrow };
}

/** Tiến theo mốc đã hẹn để tick trễ vẫn giữ đúng số cú và hạn chọn. */
export function advanceDungeonClock(current: DungeonView, now: number): { view: DungeonView; outcome: 'none' | 'hang' | 'leave' } {
  const view = { ...current };
  while (view.phase !== 'idle' && view.deadline > 0 && now >= view.deadline) {
    if (view.phase === 'capture') {
      view.phase = 'punching';
      view.deadline += view.punchesTotal > 2 ? POKER_TIMING.punchIntervalMs : POKER_TIMING.finalPunchIntervalMs;
    } else if (view.phase === 'punching') {
      view.punchesDone += 1;
      if (view.punchesDone >= view.punchesTotal) {
        if (!view.canBorrow) return { view: { ...view, phase: 'idle', deadline: 0 }, outcome: 'hang' };
        view.phase = 'choice';
        view.deadline += POKER_TIMING.choiceMs;
      } else {
        const nextPunch = view.punchesDone + 1;
        view.deadline += nextPunch > view.punchesTotal - 2 ? POKER_TIMING.finalPunchIntervalMs : POKER_TIMING.punchIntervalMs;
      }
    } else {
      return { view: { ...view, phase: 'idle', deadline: 0 }, outcome: 'leave' };
    }
  }
  return { view, outcome: 'none' };
}
