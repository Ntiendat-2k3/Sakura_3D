/** Giao thức và hình học thuần dùng chung; không phụ thuộc server hay database. */
import streetLayout from './street-layout.json';
import playerCharacters from './player-characters.json';
export * from './club';
export * from './club-show';
export * from './club-music';
export * from './club-dj';

export const STREET_LAYOUT = streetLayout;
export const WORLD_ROOM_NAME = 'sakura-city' as const;
export const WORLD_BOUNDS = 24;
export const MOVE_SPEED = 4.8;
export const GAME_TICK_MS = 50;
export const GAME_PATCH_MS = 100;
export const PLAYER_CHARACTERS = playerCharacters;
export type PlayerCharacterId = keyof typeof PLAYER_CHARACTERS;
export const DEFAULT_PLAYER_CHARACTER: PlayerCharacterId = 'bocchi';
export function isPlayerCharacterId(value: unknown): value is PlayerCharacterId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(playerCharacters, value);
}

export type MoveInput = { x: number; z: number };
export type ChatInput = { text: string };
export type PlayerDanceStyle = 'normal' | 'guitar' | 'flair';
export type DanceInput = { dancing: boolean; style?: PlayerDanceStyle };
export type ChatMessage = { userId: string; name: string; text: string; at: number };
/** sampleTime là ms mô phỏng của phòng, được adapter gắn vào vị trí; không phải giờ máy người chơi. */
export type PositionSnapshot = { id: string; name: string; x: number; z: number; yaw: number; sampleTime?: number; seatId?: string; dancing?: boolean; danceStyle?: PlayerDanceStyle; characterId?: PlayerCharacterId };

export function normalizeDanceInput(input: unknown): Required<DanceInput> | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  if (typeof value.dancing !== 'boolean') return null;
  if (value.style !== undefined && value.style !== 'normal' && value.style !== 'guitar' && value.style !== 'flair') return null;
  return { dancing: value.dancing, style: value.dancing ? value.style as PlayerDanceStyle ?? 'normal' : 'normal' };
}

export function normalizeMoveInput(input: unknown): MoveInput | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  if (typeof value.x !== 'number' || typeof value.z !== 'number') return null;
  if (!Number.isFinite(value.x) || !Number.isFinite(value.z)) return null;
  if (Math.abs(value.x) > 1 || Math.abs(value.z) > 1) return null;
  const len = Math.hypot(value.x, value.z);
  return len > 1 ? { x: value.x / len, z: value.z / len } : { x: value.x, z: value.z };
}

/** Blender và server dùng cùng bố cục; biên có khoảng đệm cho bán kính avatar và mái hiên. */
export const COLLIDERS = STREET_LAYOUT.map(block => ({
  xMin: block.x - block.halfWidth,
  xMax: block.x + block.halfWidth,
  zMin: block.z - block.halfDepth,
  zMax: block.z + block.halfDepth,
}));

export function isWalkable(x: number, z: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  if (Math.abs(x) > WORLD_BOUNDS || Math.abs(z) > WORLD_BOUNDS) return false;
  return !COLLIDERS.some(b => x >= b.xMin && x <= b.xMax && z >= b.zMin && z <= b.zMax);
}
