/** Giao thức và hình học thuần dùng chung; không phụ thuộc server hay database. */
import streetLayout from './street-layout.json';
import streetDecor from './street-decor.json';
import playerCharacters from './player-characters.json';
export * from './club';
export * from './club-show';
export * from './club-music';
export * from './club-dj';
export * from './kohaku-bluff';
export * from './kohaku-jump';
export * from './street-social';
export * from './gekka';
export * from './gekka-poker';
export * from './gekka-escort';
export * from './voice';

export const STREET_LAYOUT = streetLayout;
/** Cây anh đào, đèn đá, chậu cây, ghế, xe đạp, cột điện và cổng bắc của phố (dùng chung với scripts/build-street-decor.py). */
export const STREET_DECOR = streetDecor;
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
/** Một bảng chung cho phím tắt, giao diện, kiểm tra input và tên clip trên rig người chơi. */
export const PLAYER_DANCES = {
  normal: { key: '1', label: 'Nhảy', clip: 'Dance', source: null },
  guitar: { key: '2', label: 'Cầm đàn nhảy', clip: 'GuitarDance', source: null },
  flair: { key: '3', label: 'Flair', clip: 'Flair', source: 'Flair' },
  hiphop: { key: '4', label: 'Hip Hop', clip: 'HipHop', source: 'Hip Hop Dancing' },
  maraschino: { key: '5', label: 'Maraschino Step', clip: 'Maraschino', source: 'Dancing Maraschino Step' },
  swing: { key: '6', label: 'Swing Dancing', clip: 'Swing', source: 'Swing Dancing' },
  snakehiphop: { key: '7', label: 'Snake Hip Hop', clip: 'SnakeHipHop', source: 'Snake Hip Hop Dance' },
} as const;
export type PlayerDanceStyle = keyof typeof PLAYER_DANCES;
export type DanceInput = { dancing: boolean; style?: PlayerDanceStyle };
export type ChatMessage = { userId: string; name: string; text: string; at: number };
/** sampleTime là ms mô phỏng của phòng, được adapter gắn vào vị trí; không phải giờ máy người chơi. */
/** voice: người chơi đang bật voice chat (công khai để người khác biết có thể kết nối). */
export type PositionSnapshot = { id: string; name: string; x: number; y?: number; z: number; yaw: number; sampleTime?: number; seatId?: string; dancing?: boolean; danceStyle?: PlayerDanceStyle; characterId?: PlayerCharacterId; voice?: boolean; /** Kohaku: id điểm nhảy đang bay, rỗng khi không nhảy. */ jumpSpot?: string };

export function normalizeDanceInput(input: unknown): Required<DanceInput> | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  if (typeof value.dancing !== 'boolean') return null;
  if (value.style !== undefined && (typeof value.style !== 'string' || !Object.hasOwn(PLAYER_DANCES, value.style))) return null;
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

/** Nửa bề rộng (x) / nửa bề sâu (z) phần thân rắn của từng loại đồ trang trí phố trong street-decor.json. */
const STREET_PROP_EXTENTS = {
  trees: [0.35, 0.35], stoneLanterns: [0.4, 0.4], stoneBenches: [0.35, 0.85], planters: [0.35, 0.6], benches: [0.3, 0.8], bicycles: [0.25, 0.9], poles: [0.22, 0.22],
} as const;
/** Thân cây, đèn đá, chậu cây, ghế, xe đạp, cột điện và 2 trụ cổng bắc: người chơi đi vòng, không xuyên qua. */
export const STREET_PROP_COLLIDERS = [
  ...(Object.keys(STREET_PROP_EXTENTS) as (keyof typeof STREET_PROP_EXTENTS)[]).flatMap(kind => STREET_DECOR[kind].map(({ x, z }) => {
    const [hx, hz] = STREET_PROP_EXTENTS[kind];
    return { xMin: x - hx, xMax: x + hx, zMin: z - hz, zMax: z + hz };
  })),
  ...[-1, 1].map(side => ({ xMin: side * STREET_DECOR.gate.x - 0.35, xMax: side * STREET_DECOR.gate.x + 0.35, zMin: STREET_DECOR.gate.z - 0.35, zMax: STREET_DECOR.gate.z + 0.35 })),
];

export function isWalkable(x: number, z: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  if (Math.abs(x) > WORLD_BOUNDS || Math.abs(z) > WORLD_BOUNDS) return false;
  return !COLLIDERS.some(b => x >= b.xMin && x <= b.xMax && z >= b.zMin && z <= b.zMax)
    && !STREET_PROP_COLLIDERS.some(b => x >= b.xMin && x <= b.xMax && z >= b.zMin && z <= b.zMax);
}
