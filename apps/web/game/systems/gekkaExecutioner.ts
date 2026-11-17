/**
 * Lịch trình đao phủ Onizuka phía client: canh bàn ở salon → lôi người thua sạch xuống hầm (theo lộ trình chung với server)
 * → đứng trước khung chữ A ra đòn → đi bộ về chỗ canh khi hầm trống.
 */
import {
  GEKKA_ESCORT, GEKKA_EXECUTIONER_RETURN, GEKKA_SEATS, gekkaPolylineAt, planGekkaEscort, sampleGekkaEscort,
  type GekkaEscortPlan, type GekkaEscortPose, type PokerTableView,
} from '@metaverse/game-protocol';

export type ExecutionerMode = 'guard' | 'escort' | 'rack' | 'return';
export type ExecutionerFrame = GekkaEscortPose & {
  mode: ExecutionerMode;
  walking: boolean;
  /** Điểm tay phải túm (thế giới) khi đang túm hoặc đang lôi. */
  reach: { x: number; y: number; z: number; weight: number } | null;
};

/** Vai người đang ngồi và chỗ túm áo người đang bị lôi (m trên mặt sàn). */
const SEATED_SHOULDER = 1.0;
const WALKING_COLLAR = 1.2;
const GRAB_REACH_SECONDS = 0.45;

/** Lộ trình được nhớ theo route + mốc bắt đầu: patch mạng mỗi 100 ms không phải dựng lại. */
export function escortPlanCache() {
  let key = '', plan: GekkaEscortPlan | null = null;
  return (escort: PokerTableView['escort']): GekkaEscortPlan | null => {
    if (!escort.startedAt || !escort.route.length) return null;
    const next = `${escort.startedAt}:${escort.route.join(',')}`;
    if (next !== key) { key = next; plan = planGekkaEscort(escort.route); }
    return plan;
  };
}

export function createExecutionerDirector() {
  const planFor = escortPlanCache();
  let busy = false, returnStartedAt: number | null = null;
  return {
    /** nowMs theo Date.now để khớp mốc server (startedAt). */
    update(nowMs: number, table: Pick<PokerTableView, 'dungeon' | 'escort'>): ExecutionerFrame {
      const plan = planFor(table.escort);
      if (plan) {
        busy = true; returnStartedAt = null;
        const seconds = (nowMs - table.escort.startedAt) / 1000;
        const frame = sampleGekkaEscort(plan, seconds);
        const { executioner } = frame;
        let reach: ExecutionerFrame['reach'] = null;
        if (executioner.grabbing) {
          const seat = GEKKA_SEATS.find(item => item.id === executioner.grabbing)!;
          const stop = plan.stops.find(item => item.seatId === executioner.grabbing)!;
          const grabStart = stop.releasedAt - GEKKA_ESCORT.grabSeconds;
          reach = { x: seat.x, y: SEATED_SHOULDER, z: seat.z, weight: Math.min(1, (seconds - grabStart) / GRAB_REACH_SECONDS) };
        } else {
          // Túm áo người đầu đoàn (đi ngay sau lưng) suốt đường xuống hầm.
          const lead = plan.stops.map(stop => frame.prisoners.get(stop.seatId)).find(Boolean);
          if (lead) reach = { x: lead.x, y: lead.y + WALKING_COLLAR, z: lead.z, weight: 1 };
        }
        return { ...executioner, mode: 'escort', walking: executioner.walking, reach };
      }
      if (table.dungeon.phase !== 'idle') {
        busy = true; returnStartedAt = null;
        return { ...GEKKA_ESCORT.rack, mode: 'rack', walking: false, reach: null };
      }
      // Hầm vừa trống (hoặc đoàn bị hủy giữa đường): đi bộ về, server cũng chờ đúng quãng này mới lôi người kế.
      if (busy) { busy = false; returnStartedAt = nowMs; }
      if (returnStartedAt !== null) {
        const s = (nowMs - returnStartedAt) / 1000 * GEKKA_ESCORT.returnSpeed;
        if (s < GEKKA_EXECUTIONER_RETURN.length) return { ...gekkaPolylineAt(GEKKA_EXECUTIONER_RETURN, s), mode: 'return', walking: true, reach: null };
        returnStartedAt = null;
      }
      return { ...GEKKA_ESCORT.guard, mode: 'guard', walking: false, reach: null };
    },
  };
}
