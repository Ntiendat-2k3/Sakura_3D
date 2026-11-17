import { PLAYER_DANCES, type PlayerDanceStyle } from '@metaverse/game-protocol';

const styles = Object.keys(PLAYER_DANCES) as PlayerDanceStyle[];

/** Chờ thả N để xử lý phím đơn, tránh bật nhảy thường trước khi người chơi bấm tổ hợp N+2. */
export function createPlayerDanceShortcuts(dance: (style: PlayerDanceStyle) => void) {
  let held = false, used = false;
  return {
    down(key: string, repeat: boolean) {
      if (key === 'n') { if (!repeat) { held = true; used = false; } return true; }
      const style = held ? styles.find(style => PLAYER_DANCES[style].key === key) : undefined;
      if (!style) return false;
      if (!repeat) { used = true; dance(style); }
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
