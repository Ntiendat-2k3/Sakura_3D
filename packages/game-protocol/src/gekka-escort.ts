/**
 * Cảnh đao phủ Onizuka lôi người thua sạch từ bàn xuống hầm Gekkarō.
 * Lộ trình và nhịp thời gian tất định: server dắt người bị lôi theo nó, web dựng đao phủ và cho người xem đi theo,
 * nên hai phía chỉ cần chung danh sách ghế (route) và mốc bắt đầu.
 */
import { GEKKA_BASEMENT_Y, GEKKA_SEATS } from './gekka';

export type GekkaEscortPoint = { x: number; y: number; z: number };
export type GekkaEscortPose = GekkaEscortPoint & { yaw: number };
export type GekkaPolyline = { points: readonly GekkaEscortPoint[]; cumulative: readonly number[]; length: number };

const B = GEKKA_BASEMENT_Y;
const TABLE_CENTER_Z = -1.5;
/** Vòng đi quanh bàn, trùng bán kính chỗ đứng cạnh ghế (standX/standZ); 0° là phía cửa (+Z), 90° là phía cầu thang (+X). */
const RING = { rx: 2.65, rz: 2.05, entryDeg: 90, stepDeg: 12 } as const;

export const GEKKA_ESCORT = {
  /** Chỗ đao phủ đứng canh trên salon, mép phải bàn, nhìn vào bàn. */
  guard: { x: 3.3, y: 0, z: TABLE_CENTER_Z, yaw: -Math.PI / 2 },
  /** Đứng trước khung chữ A trong hầm (khớp vị trí ra đòn). */
  rack: { x: 0, y: B, z: -2.82, yaw: Math.PI },
  approachSpeed: 1.9,
  dragSpeed: 1.6,
  returnSpeed: 1.9,
  grabSeconds: 1.2,
  /** Giữ người trước khung một nhịp trước khi trói (server dịch người vào khung sau mốc này). */
  settleSeconds: 0.5,
  /** Người bị lôi đi sau đao phủ, người thứ hai sau người thứ nhất... */
  prisonerGap: 0.8,
} as const;

/** Mép phải bàn → vòng qua lan can ra đầu cầu thang → xuống hầm → trước khung chữ A. */
const RING_EXIT_TO_RACK: readonly GekkaEscortPoint[] = [
  { x: 4.2, y: 0, z: 2.6 }, { x: 4.6, y: 0, z: 4.3 }, { x: 5.9, y: 0, z: 4.3 }, { x: 5.9, y: 0, z: 3.5 },
  { x: 5.9, y: B, z: -1.5 }, { x: 5.9, y: B, z: -2.3 }, { x: 1.4, y: B, z: -2.65 },
  { x: GEKKA_ESCORT.rack.x, y: B, z: GEKKA_ESCORT.rack.z },
];

/**
 * Chỗ người xem đứng trong hầm khi đi theo xuống: hai bên khung, chéo góc.
 * Không đứng giữa trục khung–đao phủ: camera sau lưng người xem sẽ bị chính nhân vật đó che mất cảnh tra tấn.
 */
export const GEKKA_ESCORT_SPECTATOR_SPOTS: readonly GekkaEscortPoint[] = [
  { x: 2.0, y: B, z: -2.0 }, { x: -2.0, y: B, z: -2.1 }, { x: 2.9, y: B, z: -2.9 },
  { x: -2.9, y: B, z: -3.0 }, { x: 1.6, y: B, z: -1.1 }, { x: -1.6, y: B, z: -1.2 },
];

const ringPoint = (degrees: number): GekkaEscortPoint => {
  const angle = degrees * Math.PI / 180;
  return { x: RING.rx * Math.sin(angle), y: 0, z: TABLE_CENTER_Z + RING.rz * Math.cos(angle) };
};
/** Các điểm trên vòng từ góc from (không gồm) tới góc to (gồm), mỗi bước ≤ stepDeg. */
const ringArc = (from: number, to: number): GekkaEscortPoint[] => {
  const steps = Math.ceil(Math.abs(to - from) / RING.stepDeg);
  return Array.from({ length: steps }, (_, index) => ringPoint(from + (to - from) * (index + 1) / steps));
};
const seatDegrees = (seat: { x: number; z: number }) => Math.atan2(seat.x / 1.9, (seat.z - TABLE_CENTER_Z) / 1.3) * 180 / Math.PI;

export function makeGekkaPolyline(points: readonly GekkaEscortPoint[]): GekkaPolyline {
  const cumulative = [0];
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1], b = points[index];
    cumulative.push(cumulative[index - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
  }
  return { points, cumulative, length: cumulative[cumulative.length - 1] ?? 0 };
}

/** Điểm tại quãng đường s (kẹp trong [0, length]); yaw theo hướng đoạn đang đi trên mặt phẳng. */
export function gekkaPolylineAt(line: GekkaPolyline, s: number): GekkaEscortPose {
  const { points, cumulative } = line;
  if (points.length === 1) return { ...points[0], yaw: 0 };
  const distance = Math.min(Math.max(s, 0), line.length);
  let index = 1;
  while (index < points.length - 1 && cumulative[index] < distance) index++;
  // Đoạn đứng yên theo phương ngang (giữa thang) vẫn có hướng; đoạn dài 0 thì lấy hướng đoạn trước.
  let a = points[index - 1], b = points[index];
  const span = cumulative[index] - cumulative[index - 1];
  const k = span > 1e-6 ? (distance - cumulative[index - 1]) / span : 1;
  const x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k, z = a.z + (b.z - a.z) * k;
  while (Math.hypot(b.x - a.x, b.z - a.z) < 1e-6 && index > 1) { index--; a = points[index - 1]; b = points[index]; }
  return { x, y, z, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
}

/** Quãng đường s của điểm trên polyline gần (x, y, z) nhất, chỉ xét s ≤ maxS. Dùng cho người xem nhập vào lộ trình. */
export function nearestOnGekkaPolyline(line: GekkaPolyline, x: number, y: number, z: number, maxS = line.length): number {
  let best = 0, bestDistance = Infinity;
  for (let index = 1; index < line.points.length && line.cumulative[index - 1] <= maxS; index++) {
    const a = line.points[index - 1], b = line.points[index];
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, lengthSq = dx * dx + dy * dy + dz * dz;
    let k = lengthSq > 0 ? ((x - a.x) * dx + (y - a.y) * dy + (z - a.z) * dz) / lengthSq : 0;
    k = Math.min(Math.max(k, 0), 1);
    const s = Math.min(line.cumulative[index - 1] + k * Math.sqrt(lengthSq), maxS);
    const p = gekkaPolylineAt(line, s);
    const distance = Math.hypot(p.x - x, (p.y - y) * 2, p.z - z);
    if (distance < bestDistance) { bestDistance = distance; best = s; }
  }
  return best;
}

type Segment = { t0: number; t1: number; s0: number; s1: number; grab?: string };
export type GekkaEscortPlan = GekkaPolyline & {
  /** Thứ tự đao phủ túm người (theo vòng bàn) và quãng đường tại chỗ túm. */
  stops: readonly { seatId: string; s: number; releasedAt: number }[];
  segments: readonly Segment[];
  /** Giây từ lúc bắt đầu tới lúc trói (server dịch người vào khung/cùm). */
  duration: number;
};

/**
 * Đao phủ từ chỗ canh đi vòng bàn, túm từng người theo thứ tự góc (từ phía cầu thang vòng qua cửa),
 * rồi lôi cả đoàn quay ra cầu thang, xuống hầm tới trước khung. Ghế lạ hoặc trùng bị bỏ qua.
 */
export function planGekkaEscort(route: readonly string[]): GekkaEscortPlan {
  const targets = [...new Set(route)]
    .map(seatId => GEKKA_SEATS.find(seat => seat.id === seatId && !seat.npcOnly))
    .filter((seat): seat is (typeof GEKKA_SEATS)[number] => !!seat)
    .map(seat => ({ seat, degrees: seatDegrees(seat) }))
    .sort((a, b) => b.degrees - a.degrees);
  const { guard } = GEKKA_ESCORT;
  const points: GekkaEscortPoint[] = [{ x: guard.x, y: guard.y, z: guard.z }, ringPoint(RING.entryDeg)];
  const stopIndex: { seatId: string; index: number }[] = [];
  let degrees: number = RING.entryDeg;
  for (const { seat, degrees: target } of targets) {
    points.push(...ringArc(degrees, target));
    points.push({ x: seat.standX, y: 0, z: seat.standZ });
    stopIndex.push({ seatId: seat.id, index: points.length - 1 });
    points.push(ringPoint(target));
    degrees = target;
  }
  points.push(...ringArc(degrees, RING.entryDeg), ...RING_EXIT_TO_RACK);
  const line = makeGekkaPolyline(points);

  const segments: Segment[] = [];
  const stops: { seatId: string; s: number; releasedAt: number }[] = [];
  let t = 0, s = 0;
  for (const stop of stopIndex) {
    const at = line.cumulative[stop.index];
    const speed = stops.length ? GEKKA_ESCORT.dragSpeed : GEKKA_ESCORT.approachSpeed;
    segments.push({ t0: t, t1: t + (at - s) / speed, s0: s, s1: at });
    t += (at - s) / speed; s = at;
    segments.push({ t0: t, t1: t + GEKKA_ESCORT.grabSeconds, s0: s, s1: s, grab: stop.seatId });
    t += GEKKA_ESCORT.grabSeconds;
    stops.push({ seatId: stop.seatId, s, releasedAt: t });
  }
  const speed = stops.length ? GEKKA_ESCORT.dragSpeed : GEKKA_ESCORT.approachSpeed;
  segments.push({ t0: t, t1: t + (line.length - s) / speed, s0: s, s1: line.length });
  t += (line.length - s) / speed;
  return { ...line, stops, segments, duration: t + GEKKA_ESCORT.settleSeconds };
}

export type GekkaEscortFrame = {
  executioner: GekkaEscortPose & { walking: boolean; grabbing: string | null; s: number };
  /** Người đã bị túm thì có tư thế; người chưa tới lượt túm vẫn ngồi ở ghế (null). */
  prisoners: Map<string, GekkaEscortPose | null>;
  done: boolean;
};

export function sampleGekkaEscort(plan: GekkaEscortPlan, seconds: number): GekkaEscortFrame {
  const t = Math.max(0, seconds);
  const segment = plan.segments.find(item => t < item.t1) ?? plan.segments[plan.segments.length - 1];
  const k = segment.t1 > segment.t0 ? Math.min(1, Math.max(0, (t - segment.t0) / (segment.t1 - segment.t0))) : 1;
  const s = segment.s0 + (segment.s1 - segment.s0) * k;
  const pose = gekkaPolylineAt(plan, s);
  const grabbing = segment.grab && t < segment.t1 ? segment.grab : null;
  if (grabbing) {
    // Lúc túm thì quay mặt vào người đang ngồi.
    const seat = GEKKA_SEATS.find(item => item.id === grabbing)!;
    pose.yaw = Math.atan2(seat.x - pose.x, seat.z - pose.z);
  }
  const prisoners = new Map<string, GekkaEscortPose | null>();
  plan.stops.forEach((stop, rank) => {
    if (t < stop.releasedAt) { prisoners.set(stop.seatId, null); return; }
    const trail = Math.min(s, Math.max(stop.s, s - GEKKA_ESCORT.prisonerGap * (rank + 1)));
    const at = gekkaPolylineAt(plan, trail);
    // Đứng chờ ở chỗ túm thì nhìn theo đao phủ thay vì hướng đoạn đường.
    if (trail === stop.s && s > stop.s) at.yaw = Math.atan2(pose.x - at.x, pose.z - at.z);
    prisoners.set(stop.seatId, at);
  });
  const walking = !grabbing && s < plan.length - 1e-6 && t < (plan.segments[plan.segments.length - 1]?.t1 ?? 0);
  return { executioner: { ...pose, walking, grabbing, s }, prisoners, done: t >= plan.duration };
}

/** Đường đao phủ quay lại chỗ canh sau khi hầm trống (ngược đường xuống). */
export const GEKKA_EXECUTIONER_RETURN: GekkaPolyline = makeGekkaPolyline([
  ...[...RING_EXIT_TO_RACK].reverse(), ringPoint(RING.entryDeg), { x: GEKKA_ESCORT.guard.x, y: 0, z: GEKKA_ESCORT.guard.z },
]);
/** Server không bắt đầu lôi người mới trước khi đao phủ kịp về chỗ canh. */
export const GEKKA_EXECUTIONER_RETURN_MS = Math.ceil(GEKKA_EXECUTIONER_RETURN.length / GEKKA_ESCORT.returnSpeed * 1000);
