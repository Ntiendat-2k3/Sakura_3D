/**
 * Người xem bấm "Đi theo" khi đao phủ lôi người xuống hầm: client tự lái nhân vật dọc lộ trình chung, đi sau đoàn,
 * rồi đứng ở một chỗ xem trong hầm. Chỉ sinh input di chuyển như phím bấm, server vẫn kiểm va chạm như thường.
 */
import {
  GEKKA_BASEMENT_Y, GEKKA_ESCORT, GEKKA_ESCORT_SPECTATOR_SPOTS, gekkaPolylineAt, makeGekkaPolyline, nearestOnGekkaPolyline, sampleGekkaEscort,
  type GekkaEscortPlan, type GekkaEscortPoint, type GekkaPolyline, type MoveInput,
} from '@metaverse/game-protocol';

/** Đi sau người cuối đoàn ít nhất chừng này, thêm một khoảng theo slot để nhiều người xem không chồng lên nhau. */
const FOLLOW_GAP = 1.2;
const SLOT_GAP = 0.9;
/** Còn cách lộ trình quá ngưỡng này thì đi thẳng vào lộ trình trước, gần rồi thì nhắm điểm phía trước. */
const JOIN_DISTANCE = 0.5;
const LOOKAHEAD = 0.9;
const ARRIVE_DISTANCE = 0.2;
/** Gần đích thì giảm input để không lố rồi quay lại (server đi 4.8 m/s, tick 50 ms). */
const SLOW_RADIUS = 0.7;

/** Slot cố định theo sessionId: mỗi máy tự tính mà vẫn ra chỗ đứng khác nhau. */
export function followSlot(sessionId: string): number {
  let hash = 0;
  for (const char of sessionId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % GEKKA_ESCORT_SPECTATOR_SPOTS.length;
}

export type FollowRoute = { line: GekkaPolyline; offset: number; spot: GekkaEscortPoint };

/**
 * Lộ trình người xem: chỉ phần đoàn bị lôi đi (từ chỗ túm người cuối ra cầu thang, xuống hầm), nối thêm chỗ đứng xem.
 * Bỏ đoạn đao phủ đi vòng bàn túm người vì đoạn đó đi ra rồi quay lại trùng đường, điểm gần nhất sẽ nhảy qua lại.
 */
export function followRoute(plan: GekkaEscortPlan, slot: number): FollowRoute {
  const spot = GEKKA_ESCORT_SPECTATOR_SPOTS[slot % GEKKA_ESCORT_SPECTATOR_SPOTS.length];
  const lastStop = plan.stops.at(-1)?.s;
  // Sau chỗ túm cuối là điểm vòng bàn ngay cạnh; không có ai thì bắt đầu ở điểm vào vòng.
  const first = lastStop === undefined ? 1 : plan.cumulative.findIndex(s => s > lastStop + 1e-6);
  return { line: makeGekkaPolyline([...plan.points.slice(first), spot]), offset: plan.cumulative[first], spot };
}

/**
 * Một bước lái: escortSeconds = null khi đoàn đã xuống tới hầm (đi thẳng tới chỗ xem).
 * Trả input thế giới (x, z ∈ [-1, 1]) và arrived khi đã đứng ở chỗ xem.
 */
export function followPilotStep(options: {
  plan: GekkaEscortPlan; route: FollowRoute; escortSeconds: number | null; slot: number;
  position: { x: number; y: number; z: number };
}): { move: MoveInput; arrived: boolean } {
  const { plan, route, escortSeconds, slot, position } = options;
  let cap = route.line.length;
  if (escortSeconds !== null) {
    const frame = sampleGekkaEscort(plan, escortSeconds);
    const tail = frame.executioner.s - GEKKA_ESCORT.prisonerGap * (plan.stops.length + 1) - FOLLOW_GAP - SLOT_GAP * slot;
    cap = Math.max(0, Math.min(route.line.length, tail - route.offset));
  }
  // Nhập vào lộ trình ở điểm gần mình nhất; đoàn chưa đi qua điểm đó thì đứng chờ, không băng ngang phòng chen vào đoàn.
  const near = nearestOnGekkaPolyline(route.line, position.x, position.y, position.z);
  const onPath = gekkaPolylineAt(route.line, near);
  const offPath = Math.hypot(onPath.x - position.x, onPath.z - position.z);
  if (near > cap + 0.05) return { move: { x: 0, z: 0 }, arrived: false };
  const target = offPath > JOIN_DISTANCE ? onPath : gekkaPolylineAt(route.line, Math.min(near + LOOKAHEAD, cap));
  const dx = target.x - position.x, dz = target.z - position.z, distance = Math.hypot(dx, dz);
  const atCap = near >= cap - 0.05;
  if (distance < ARRIVE_DISTANCE && atCap) {
    return { move: { x: 0, z: 0 }, arrived: escortSeconds === null && cap >= route.line.length - 1e-6 };
  }
  const scale = Math.min(1, Math.max(0.25, distance / SLOW_RADIUS)) / distance;
  return { move: { x: dx * scale, z: dz * scale }, arrived: false };
}

/** Góc camera xem từ ghế: chéo trước khung chữ A để thấy cả người bị trói lẫn đao phủ. */
export const GEKKA_SPECTATE_FOCUS = { x: 0, y: GEKKA_BASEMENT_Y + 1.45, z: -3.6, yaw: 0.75 } as const;
