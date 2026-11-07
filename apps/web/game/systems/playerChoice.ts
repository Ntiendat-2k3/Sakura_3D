import { DEFAULT_PLAYER_CHARACTER, isPlayerCharacterId, type PlayerCharacterId } from '@metaverse/game-protocol';

const key = 'neon-sakura-player-character';

/** Tùy chọn chỉ lưu trên trình duyệt, không phải thông tin đăng nhập; storage bị khóa không chặn vào game. */
export function readPlayerChoice(storage: Pick<Storage, 'getItem'>): PlayerCharacterId {
  try { const value = storage.getItem(key); return isPlayerCharacterId(value) ? value : DEFAULT_PLAYER_CHARACTER; }
  catch { return DEFAULT_PLAYER_CHARACTER; }
}

export function savePlayerChoice(storage: Pick<Storage, 'setItem'>, characterId: PlayerCharacterId) {
  try { storage.setItem(key, characterId); } catch { /* Chế độ riêng tư vẫn cho phép chơi bằng lựa chọn hiện tại. */ }
}
