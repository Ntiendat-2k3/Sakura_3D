import type { PlayerDanceStyle } from '@metaverse/game-protocol';

/** Chờ thả N để xử lý phím đơn, tránh bật nhảy thường trước khi người chơi bấm tổ hợp N+2. */
export function createPlayerDanceShortcuts(dance: (style: PlayerDanceStyle) => void) {
  let held = false, used = false;
  return {
    down(key: string, repeat: boolean) {
      if (key === 'n') { if (!repeat) { held = true; used = false; } return true; }
      if (!held || (key !== '1' && key !== '2' && key !== '3')) return false;
      if (!repeat) { used = true; dance(key === '2' ? 'guitar' : key === '3' ? 'flair' : 'normal'); }
      return true;
    },
    up(key: string) {
      if (key !== 'n' || !held) return;
      held = false;
      if (!used) dance('normal');
    },
    reset() { held = false; used = false; },
  };
}
