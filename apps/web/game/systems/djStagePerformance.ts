/**
 * Quản lý tiết mục biểu diễn sân khấu của DJ Rio trong phòng Denmu Night Club.
 * Khi nhạc phát được một lúc, DJ rời bàn console, bước ra giữa sân khấu nhảy Snake Hip Hop rồi quay về.
 */
import { DJ_HOME } from '@metaverse/game-protocol';

export type DjStagePhase = 'console' | 'walking_to_center' | 'snake_dancing' | 'walking_to_console';

export type DjStageRoutine = {
  phase: DjStagePhase;
  progress: number;
  phaseTime: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
};

/** Vị trí trung tâm sân khấu Denmu Club (nằm giữa Wine ở x=-2 và Pop ở x=2, hướng nhìn về khán phòng). */
export const STAGE_CENTER = { x: 0, y: 0.77, z: -5.0, yaw: 0 } as const;

/** Chu kỳ thời gian của tiết mục biểu diễn sân khấu (68 giây). */
export const ROUTINE_CYCLE = 68.0;

/** Mốc thời gian kết thúc từng giai đoạn trong chu kỳ (tính bằng giây). */
export const ROUTINE_TIMELINE = {
  /** 0s - 18s: DJ chơi nhạc tại bàn console. */
  CONSOLE_INTRO_END: 18.0,
  /** 18s - 21.6s (3.6s): DJ bước từ bàn console ra giữa sân khấu. */
  WALK_TO_CENTER_END: 21.6,
  /** 21.6s - 37.2s (15.6s): DJ đứng giữa sân khấu biểu diễn điệu nhảy Snake Hip Hop. */
  DANCE_END: 37.2,
  /** 37.2s - 40.8s (3.6s): DJ bước từ giữa sân khấu quay trở lại bàn console. */
  WALK_TO_CONSOLE_END: 40.8,
  /** 40.8s - 68s: DJ tiếp tục chơi nhạc tại bàn console trước khi bắt đầu chu kỳ mới. */
  CYCLE_END: 68.0,
} as const;

const WALK_DURATION = 3.6;
const L1 = 1.35;
const L2 = 2.20;
const L3 = 1.3583; // Math.hypot(1.35, 0.15)
const TOTAL_WALK_DISTANCE = L1 + L2 + L3; // ~4.9083 m
const WALK_SPEED = TOTAL_WALK_DISTANCE / WALK_DURATION; // ~1.36 m/s

/**
 * Lấy mẫu vị trí và góc nhìn của DJ khi bước từ bàn console ra giữa sân khấu.
 * Đường đi lách qua bên phải bàn console để không đi xuyên qua thiết bị DJ.
 */
export function sampleWalkToCenter(progress: number): { x: number; y: number; z: number; yaw: number } {
  const p = Math.max(0, Math.min(1, progress));
  const s = p * TOTAL_WALK_DISTANCE;
  const radius = 0.22;

  // Chặng 1: Từ (0, -7.35) sang phải đến (1.35, -7.35)
  if (s < L1 - radius) {
    const t = s / L1;
    return { x: 1.35 * t, y: 0.77, z: -7.35, yaw: Math.PI / 2 };
  }

  // Góc cua 1: Bo góc từ chặng 1 sang chặng 2
  if (s < L1 + radius) {
    const t = (s - (L1 - radius)) / (2 * radius);
    const angle = (t * Math.PI) / 2;
    return {
      x: 1.35 - radius + radius * Math.sin(angle),
      y: 0.77,
      z: -7.35 + radius * (1 - Math.cos(angle)),
      yaw: (Math.PI / 2) * (1 - t),
    };
  }

  // Chặng 2: Đi thẳng ra trước từ (1.35, -7.35 + r) đến (1.35, -5.15 - r)
  if (s < L1 + L2 - radius) {
    const t = (s - L1) / L2;
    return { x: 1.35, y: 0.77, z: -7.35 + 2.2 * t, yaw: 0 };
  }

  // Góc cua 2: Bo góc từ chặng 2 sang chặng 3
  if (s < L1 + L2 + radius) {
    const t = (s - (L1 + L2 - radius)) / (2 * radius);
    const angle = (t * Math.PI) / 2;
    return {
      x: 1.35 - radius * (1 - Math.cos(angle)),
      y: 0.77,
      z: -5.15 - radius + radius * Math.sin(angle),
      yaw: -t * (Math.PI / 2),
    };
  }

  // Chặng 3: Từ (1.35 - r, -5.15 + r) vào giữa sân khấu (0, -5.0)
  const t = Math.min(1, (s - (L1 + L2)) / L3);
  const remainingX = 1.35 * (1 - t);
  const currentZ = -5.15 + 0.15 * t;

  // Khi sắp đến vị trí giữa sân khấu (x < 0.4), dần xoay người về hướng khán phòng (yaw = 0)
  const faceForwardWeight = Math.max(0, Math.min(1, (0.4 - remainingX) / 0.4));
  const yaw = (-Math.PI / 2) * (1 - faceForwardWeight);

  return { x: remainingX, y: 0.77, z: currentZ, yaw };
}

/**
 * Lấy mẫu vị trí và góc nhìn của DJ khi bước từ giữa sân khấu trở về bàn console.
 */
export function sampleWalkToConsole(progress: number): { x: number; y: number; z: number; yaw: number } {
  const p = Math.max(0, Math.min(1, progress));
  const s = p * TOTAL_WALK_DISTANCE;
  const radius = 0.22;

  // Chặng 1: Từ (0, -5.0) sang phải đến (1.35, -5.15)
  if (s < L3 - radius) {
    const t = s / L3;
    const initialTurn = Math.min(1, t * 2.5);
    return {
      x: 1.35 * t,
      y: 0.77,
      z: -5.0 - 0.15 * t,
      yaw: (Math.PI / 2) * initialTurn,
    };
  }

  // Góc cua 1: Bo góc từ chặng 1 sang chặng đi lùi về sau
  if (s < L3 + radius) {
    const t = (s - (L3 - radius)) / (2 * radius);
    const angle = (t * Math.PI) / 2;
    return {
      x: 1.35 - radius * (1 - Math.sin(angle)),
      y: 0.77,
      z: -5.15 - radius * (1 - Math.cos(angle)),
      yaw: Math.PI / 2 + t * (Math.PI / 2),
    };
  }

  // Chặng 2: Đi về phía sau sân khấu từ (1.35, -5.15) đến (1.35, -7.35)
  if (s < L3 + L2 - radius) {
    const t = (s - L3) / L2;
    return { x: 1.35, y: 0.77, z: -5.15 - 2.2 * t, yaw: Math.PI };
  }

  // Góc cua 2: Bo góc từ chặng 2 rẽ sang trái về sau bàn console
  if (s < L3 + L2 + radius) {
    const t = (s - (L3 + L2 - radius)) / (2 * radius);
    const angle = (t * Math.PI) / 2;
    return {
      x: 1.35 - radius * (1 - Math.cos(angle)),
      y: 0.77,
      z: -7.35 + radius * (1 - Math.sin(angle)),
      yaw: Math.PI - t * (Math.PI / 2),
    };
  }

  // Chặng 3: Đi vào sau bàn console về tọa độ x = 0
  const t = Math.min(1, (s - (L3 + L2)) / L1);
  const remainingX = 1.35 * (1 - t);

  // Khi sắp về vị trí bàn DJ (x < 0.35), xoay người về hướng bàn console (yaw = 0)
  const faceConsoleWeight = Math.max(0, Math.min(1, (0.35 - remainingX) / 0.35));
  const yaw = (-Math.PI / 2) * (1 - faceConsoleWeight);

  return { x: remainingX, y: 0.77, z: -7.35, yaw };
}

/**
 * Tính toán trạng thái biểu diễn hiện tại của DJ Rio dựa trên thời gian phát nhạc.
 */
export function getDjStageRoutine(trackSeconds: number): DjStageRoutine {
  const rawTime = ((trackSeconds % ROUTINE_CYCLE) + ROUTINE_CYCLE) % ROUTINE_CYCLE;
  const cycleTime = Math.round(rawTime * 1e6) / 1e6;

  // 1. Giai đoạn mở đầu: Chơi nhạc tại bàn DJ
  if (cycleTime < ROUTINE_TIMELINE.CONSOLE_INTRO_END) {
    return {
      phase: 'console',
      progress: cycleTime / ROUTINE_TIMELINE.CONSOLE_INTRO_END,
      phaseTime: cycleTime,
      x: DJ_HOME.x,
      y: DJ_HOME.y,
      z: DJ_HOME.z,
      yaw: DJ_HOME.yaw,
      speed: 0,
    };
  }

  // 2. Giai đoạn bước ra: Rời console đi ra giữa sân khấu
  if (cycleTime < ROUTINE_TIMELINE.WALK_TO_CENTER_END) {
    const elapsed = cycleTime - ROUTINE_TIMELINE.CONSOLE_INTRO_END;
    const progress = Math.min(1, elapsed / WALK_DURATION);
    const sample = sampleWalkToCenter(progress);
    return {
      phase: 'walking_to_center',
      progress,
      phaseTime: elapsed,
      ...sample,
      speed: WALK_SPEED,
    };
  }

  // 3. Giai đoạn biểu diễn: Nhảy điệu Snake Hip Hop ở giữa sân khấu
  if (cycleTime < ROUTINE_TIMELINE.DANCE_END) {
    const elapsed = cycleTime - ROUTINE_TIMELINE.WALK_TO_CENTER_END;
    const danceDuration = ROUTINE_TIMELINE.DANCE_END - ROUTINE_TIMELINE.WALK_TO_CENTER_END;
    return {
      phase: 'snake_dancing',
      progress: Math.min(1, elapsed / danceDuration),
      phaseTime: elapsed,
      x: STAGE_CENTER.x,
      y: STAGE_CENTER.y,
      z: STAGE_CENTER.z,
      yaw: STAGE_CENTER.yaw,
      speed: 0,
    };
  }

  // 4. Giai đoạn quay về: Bước từ giữa sân khấu về lại bàn console
  if (cycleTime < ROUTINE_TIMELINE.WALK_TO_CONSOLE_END) {
    const elapsed = cycleTime - ROUTINE_TIMELINE.DANCE_END;
    const progress = Math.min(1, elapsed / WALK_DURATION);
    const sample = sampleWalkToConsole(progress);
    return {
      phase: 'walking_to_console',
      progress,
      phaseTime: elapsed,
      ...sample,
      speed: WALK_SPEED,
    };
  }

  // 5. Giai đoạn kết thúc: Tiếp tục chơi nhạc tại bàn console
  const elapsed = cycleTime - ROUTINE_TIMELINE.WALK_TO_CONSOLE_END;
  const remainingDuration = ROUTINE_TIMELINE.CYCLE_END - ROUTINE_TIMELINE.WALK_TO_CONSOLE_END;
  return {
    phase: 'console',
    progress: Math.min(1, elapsed / remainingDuration),
    phaseTime: elapsed,
    x: DJ_HOME.x,
    y: DJ_HOME.y,
    z: DJ_HOME.z,
    yaw: DJ_HOME.yaw,
    speed: 0,
  };
}
