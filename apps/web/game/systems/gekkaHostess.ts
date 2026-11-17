/**
 * Lịch trình bà chủ Aos ở 月華楼: đứng trong cửa đón khách, dẫn khách mới tới ghế trống, cúi chào khi khách ngồi
 * rồi quay lại cửa; khi trận bắt đầu thì đi dạo quanh phòng tới lúc bàn về sảnh chờ.
 * Thuần dữ liệu (không three/React) để kiểm thử được; NPC chỉ là trang trí phía client, không qua server.
 */
import { GEKKA_EXIT, GEKKA_SEATS, POKER_SEATS, isGekkaWalkable, type PokerPhase } from '@metaverse/game-protocol';

export type HostessPoint = { x: number; z: number };
export type HostessGuest = { sessionId: string; x: number; z: number; seatId?: string };
export type HostessInput = { phase: PokerPhase; guests: HostessGuest[]; freeSeats: string[] };
export type HostessFrame = { x: number; z: number; yaw: number; walking: boolean; bowElapsed: number | null };
type Mode = 'door' | 'escort' | 'greet' | 'return' | 'toStroll' | 'stroll';

/** Chỗ đứng đón khách ngay trong cửa, lệch sang phải lối vào để không chắn khách. */
export const HOSTESS_DOOR: HostessPoint = { x: 1.3, z: 5.6 };
/** Chỗ đứng ngoài phố cạnh cửa 月華楼 (cửa ở x = 5.76 quay mặt ra đường). */
export const HOSTESS_STREET = { x: 5.0, z: -16.45, yaw: -Math.PI / 2 } as const;
export const HOSTESS_WALK_SPEED = 0.9;
/** Thời lượng clip cúi chào Quick Formal Bow sau khi nối vòng (2.73 s − 0.25 s chồng đầu cuối). */
export const HOSTESS_BOW_SECONDS = 2.45;
/** Chờ khách ngồi tối đa bao lâu trước khi tự cúi chào rồi quay lại cửa. */
const GREET_TIMEOUT = 7;
const STROLL_SPEED = 0.6;
const STROLL_PAUSE = 2.5;
const TABLE_CENTER: HostessPoint = { x: 0, z: -1.5 };
/** Hai làn dọc hai bên bàn để đi vòng, cách xa ghế, quầy rượu và lỗ cầu thang. */
const LANE_X = 3.2;
/** Vòng đi dạo quanh bàn trong lúc trận diễn ra (đi theo thứ tự, khép kín). */
export const HOSTESS_STROLL_LOOP: readonly HostessPoint[] = [
  { x: 3.2, z: 4.4 }, { x: -3.2, z: 4.4 }, { x: -4.2, z: -0.5 }, { x: -3.4, z: -3.4 }, { x: 3.4, z: -3.4 }, { x: 4.2, z: -0.5 },
];

const yawTo = (from: HostessPoint, to: HostessPoint) => Math.atan2(to.x - from.x, to.z - from.z);
const inGame = (phase: PokerPhase) => phase !== 'lobby' && phase !== 'gameOver';

/** Đoạn thẳng còn cách vật cản ít nhất ~0.35 m (lấy mẫu dọc đường và hai bên). */
function segmentClear(a: HostessPoint, b: HostessPoint) {
  const length = Math.hypot(b.x - a.x, b.z - a.z), steps = Math.max(1, Math.ceil(length / 0.2));
  const nx = length ? -(b.z - a.z) / length : 0, nz = length ? (b.x - a.x) / length : 0;
  for (let i = 0; i <= steps; i++) {
    const x = a.x + (b.x - a.x) * i / steps, z = a.z + (b.z - a.z) * i / steps;
    if (![0, 0.35, -0.35].every(offset => isGekkaWalkable(x + nx * offset, z + nz * offset, 0))) return false;
  }
  return true;
}

/** Đường đi qua làn bên khi đường thẳng bị bàn/quầy chắn; không bao gồm điểm xuất phát. */
export function planHostessPath(from: HostessPoint, to: HostessPoint): HostessPoint[] {
  if (segmentClear(from, to)) return [to];
  const side = Math.sign(to.x || from.x || 1);
  return [{ x: side * LANE_X, z: from.z }, { x: side * LANE_X, z: to.z }, to];
}

/** Chỗ bà chủ đứng khi mời khách vào ghế: ngoài ghế, lệch sang bên để khách có lối ngồi. */
export function escortSpot(seatId: string): HostessPoint {
  const seat = GEKKA_SEATS.find(item => item.id === seatId);
  if (!seat) return { x: LANE_X, z: TABLE_CENTER.z };
  const ox = seat.x - TABLE_CENTER.x, oz = seat.z - TABLE_CENTER.z, length = Math.hypot(ox, oz) || 1;
  const ux = ox / length, uz = oz / length;
  // Đi ra ngoài 1.1 m rồi lệch 0.6 m theo chiều tiếp tuyến (về phía cửa) để không đứng chắn ghế.
  const tangent = uz >= 0 ? 1 : -1;
  return { x: seat.x + ux * 1.1 - uz * 0.6 * tangent, z: seat.z + uz * 1.1 + ux * 0.6 * tangent };
}

const STROLL_LEGS = HOSTESS_STROLL_LOOP.map((point, index) => {
  const next = HOSTESS_STROLL_LOOP[(index + 1) % HOSTESS_STROLL_LOOP.length];
  return { from: point, to: next, walk: Math.hypot(next.x - point.x, next.z - point.z) / STROLL_SPEED };
});
const STROLL_CYCLE = STROLL_LEGS.reduce((sum, leg) => sum + STROLL_PAUSE + leg.walk, 0);

/** Vị trí trên vòng dạo ở thời điểm t (giây); mỗi góc dừng lại ngắm bàn một lúc. */
export function sampleStroll(t: number): { x: number; z: number; yaw: number; walking: boolean } {
  let rest = ((t % STROLL_CYCLE) + STROLL_CYCLE) % STROLL_CYCLE;
  for (const leg of STROLL_LEGS) {
    if (rest < STROLL_PAUSE) return { ...leg.from, yaw: yawTo(leg.from, TABLE_CENTER), walking: false };
    rest -= STROLL_PAUSE;
    if (rest < leg.walk) {
      const k = rest / leg.walk;
      return { x: leg.from.x + (leg.to.x - leg.from.x) * k, z: leg.from.z + (leg.to.z - leg.from.z) * k, yaw: yawTo(leg.from, leg.to), walking: true };
    }
    rest -= leg.walk;
  }
  return { ...HOSTESS_STROLL_LOOP[0], yaw: 0, walking: false };
}

/** Thời điểm trên vòng dạo khi bà chủ vừa tới góc `index` (đầu đoạn dừng ngắm). */
function strollTimeAt(index: number) {
  return STROLL_LEGS.slice(0, index).reduce((sum, leg) => sum + STROLL_PAUSE + leg.walk, 0);
}

export function createHostessDirector(start: HostessPoint = HOSTESS_DOOR) {
  const doorFacing = { x: GEKKA_EXIT.x, z: GEKKA_EXIT.z };
  const state = {
    mode: 'door' as Mode, x: start.x, z: start.z, yaw: yawTo(start, doorFacing), walking: false,
    path: [] as HostessPoint[], guest: '', since: 0, bowAt: null as number | null, strollOffset: 0,
  };
  const seen = new Set<string>();
  const queue: string[] = [];
  let first = true;

  const walkTo = (mode: Mode, to: HostessPoint, now: number) => {
    state.mode = mode; state.path = planHostessPath(state, to); state.since = now;
  };
  /** Đi dọc path; trả true khi đã tới điểm cuối. */
  const advance = (dt: number) => {
    let budget = HOSTESS_WALK_SPEED * dt;
    while (state.path.length && budget > 0) {
      const target = state.path[0], dx = target.x - state.x, dz = target.z - state.z, distance = Math.hypot(dx, dz);
      if (distance > 1e-4) state.yaw = Math.atan2(dx, dz);
      if (distance <= budget) { state.x = target.x; state.z = target.z; budget -= distance; state.path.shift(); }
      else { state.x += dx / distance * budget; state.z += dz / distance * budget; budget = 0; }
    }
    state.walking = state.path.length > 0;
    return !state.walking;
  };

  return {
    /** now: giây (đồng hồ cục bộ, tăng đều); dt: giây kể từ lần gọi trước. */
    update(now: number, dt: number, input: HostessInput): HostessFrame {
      // Khách mới xuất hiện gần cửa thì xếp hàng chờ được dẫn; người đã có mặt từ trước lúc mở cảnh thì bỏ qua,
      // trừ người đang đứng ở cửa (chính mình vừa bước vào).
      for (const guest of input.guests) {
        if (seen.has(guest.sessionId)) continue;
        seen.add(guest.sessionId);
        const atDoor = guest.z > 3.8 && !guest.seatId;
        if (atDoor && (!first || Math.hypot(guest.x - GEKKA_EXIT.x, guest.z - GEKKA_EXIT.z) < 2.6)) queue.push(guest.sessionId);
      }
      first = false;
      const present = new Set(input.guests.map(guest => guest.sessionId));
      for (let i = queue.length - 1; i >= 0; i--) if (!present.has(queue[i])) queue.splice(i, 1);
      const playing = inGame(input.phase);
      let bowElapsed: number | null = null;

      switch (state.mode) {
        case 'door':
          if (playing) {
            const nearest = HOSTESS_STROLL_LOOP.reduce((best, point, index) => (
              Math.hypot(point.x - state.x, point.z - state.z) < Math.hypot(HOSTESS_STROLL_LOOP[best].x - state.x, HOSTESS_STROLL_LOOP[best].z - state.z) ? index : best
            ), 0);
            state.strollOffset = strollTimeAt(nearest);
            walkTo('toStroll', HOSTESS_STROLL_LOOP[nearest], now);
          } else if (queue.length && input.freeSeats.length) {
            state.guest = queue.shift()!;
            walkTo('escort', escortSpot(input.freeSeats[0]), now);
          } else {
            queue.length = 0;
            state.walking = false;
            state.yaw = yawTo(state, doorFacing);
          }
          break;
        case 'escort':
          if (advance(dt)) { state.mode = 'greet'; state.since = now; state.bowAt = null; }
          break;
        case 'greet': {
          const guest = input.guests.find(item => item.sessionId === state.guest);
          if (guest) state.yaw = yawTo(state, guest);
          const seated = !guest || (guest.seatId !== undefined && POKER_SEATS.includes(guest.seatId));
          if (state.bowAt === null && (seated || now - state.since > GREET_TIMEOUT)) state.bowAt = now;
          if (state.bowAt !== null) {
            bowElapsed = now - state.bowAt;
            if (bowElapsed >= HOSTESS_BOW_SECONDS) { bowElapsed = null; walkTo('return', HOSTESS_DOOR, now); }
          }
          break;
        }
        case 'return':
          if (playing) { state.mode = 'door'; break; }
          if (advance(dt)) { state.mode = 'door'; state.yaw = yawTo(state, doorFacing); }
          break;
        case 'toStroll':
          if (!playing) { walkTo('return', HOSTESS_DOOR, now); break; }
          if (advance(dt)) { state.mode = 'stroll'; state.since = now; }
          break;
        case 'stroll': {
          if (!playing) { walkTo('return', HOSTESS_DOOR, now); break; }
          const sample = sampleStroll(state.strollOffset + now - state.since);
          state.x = sample.x; state.z = sample.z; state.yaw = sample.yaw; state.walking = sample.walking;
          break;
        }
      }
      return { x: state.x, z: state.z, yaw: state.yaw, walking: state.walking, bowElapsed };
    },
  };
}
