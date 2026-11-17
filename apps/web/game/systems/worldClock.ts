// Đồng hồ thế giới dùng chung: thời tiết và ngày/đêm tính thuần từ giờ thật (epoch ms),
// nên mọi máy chơi cùng lúc đều thấy cùng một trạng thái mà server không cần đồng bộ gì thêm.

const MINUTE_MS = 60_000;

/** Một vòng ngày + đêm: 30 phút ngày, 30 phút đêm. */
export const DAY_NIGHT_CYCLE_MS = 60 * MINUTE_MS;
export const DAYTIME_MS = 30 * MINUTE_MS;
/** Bình minh/hoàng hôn kéo dài 3 phút, căn giữa tại mốc đổi ngày/đêm. */
export const TWILIGHT_MS = 3 * MINUTE_MS;

/** Mỗi giờ có đúng một trận mưa 10 phút; phút bắt đầu đổi theo từng giờ để lúc mưa ngày, lúc mưa đêm. */
export const RAIN_PERIOD_MS = 60 * MINUTE_MS;
export const RAIN_DURATION_MS = 10 * MINUTE_MS;
/** Mưa nặng hạt dần / ngớt dần ở đầu và cuối trận. */
export const RAIN_RAMP_MS = 60_000;
/** Mặt đường ướt đẫm sau 90 giây mưa và khô hẳn 5 phút sau khi tạnh. */
export const WET_UP_MS = 90_000;
export const DRY_DOWN_MS = 5 * MINUTE_MS;

export type WorldEnvironment = {
  /** 0 = đêm hẳn, 1 = ngày hẳn (có chuyển tiếp bình minh/hoàng hôn). */
  daylight: number;
  /** Vị trí trong vòng ngày/đêm, 0..1 (0 = bình minh, 0.5 = hoàng hôn). */
  dayPhase: number;
  /** Độ cao mặt trời -1..1 (dương = ban ngày); mặt trăng đối xứng. */
  sunElevation: number;
  isRaining: boolean;
  /** 0 = tạnh, 1 = mưa to. */
  rainIntensity: number;
  /** Độ ướt mặt đường 0..1: tăng khi mưa, khô dần sau mưa. */
  wetness: number;
};

const mod = (value: number, size: number) => ((value % size) + size) % size;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Hash số nguyên ổn định (không phụ thuộc Math.random) để mọi client chọn cùng phút mưa. */
function hashHour(hourIndex: number) {
  let h = Math.imul(hourIndex | 0, 0x9e3779b1) ^ 0x85ebca6b;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Thời điểm bắt đầu trận mưa của giờ `hourIndex` (epoch ms). Trận mưa luôn nằm gọn trong giờ đó. */
export function rainStartForHour(hourIndex: number) {
  const latestStartMinute = (RAIN_PERIOD_MS - RAIN_DURATION_MS) / MINUTE_MS;
  const startMinute = hashHour(hourIndex) % (latestStartMinute + 1);
  return hourIndex * RAIN_PERIOD_MS + startMinute * MINUTE_MS;
}

export function calculateDaylight(nowMs: number) {
  const t = mod(nowMs, DAY_NIGHT_CYCLE_MS);
  const half = TWILIGHT_MS / 2;
  if (t < DAYTIME_MS) {
    // Ban ngày: chỉ giảm ở rìa bình minh (t≈0) và hoàng hôn (t≈30 phút)
    return Math.min(smoothstep(-half, half, t), 1 - smoothstep(-half, half, t - DAYTIME_MS));
  }
  // Ban đêm: chỉ sáng lên ở rìa hoàng hôn vừa qua và bình minh sắp tới
  return Math.max(1 - smoothstep(-half, half, t - DAYTIME_MS), smoothstep(-half, half, t - DAY_NIGHT_CYCLE_MS));
}

export function calculateRain(nowMs: number) {
  const hourIndex = Math.floor(nowMs / RAIN_PERIOD_MS);
  const start = rainStartForHour(hourIndex);
  const end = start + RAIN_DURATION_MS;

  let rainIntensity = 0;
  if (nowMs >= start && nowMs < end) {
    rainIntensity = Math.min(smoothstep(start, start + RAIN_RAMP_MS, nowMs), 1 - smoothstep(end - RAIN_RAMP_MS, end, nowMs));
  }

  let wetness: number;
  if (nowMs >= start && nowMs < end) {
    wetness = clamp01((nowMs - start) / WET_UP_MS);
  } else {
    // Đang khô dần sau trận mưa gần nhất (của giờ này, hoặc của giờ trước nếu trận giờ này chưa tới)
    const lastEnd = nowMs >= end ? end : rainStartForHour(hourIndex - 1) + RAIN_DURATION_MS;
    wetness = 1 - clamp01((nowMs - lastEnd) / DRY_DOWN_MS);
  }

  return { isRaining: rainIntensity > 0, rainIntensity, wetness };
}

export function getWorldEnvironment(nowMs: number): WorldEnvironment {
  const dayPhase = mod(nowMs, DAY_NIGHT_CYCLE_MS) / DAY_NIGHT_CYCLE_MS;
  return {
    daylight: calculateDaylight(nowMs),
    dayPhase,
    sunElevation: Math.sin(dayPhase * Math.PI * 2),
    ...calculateRain(nowMs),
  };
}

/**
 * Mức bật đèn đường/lồng đèn 0..1: tắt ban ngày, bật lúc chạng vạng; trời mưa tối sầm ban ngày cũng bật bớt.
 */
export function streetLightLevel(env: Pick<WorldEnvironment, 'daylight' | 'rainIntensity'>) {
  const night = 1 - smoothstep(0.25, 0.75, env.daylight);
  return Math.max(night, env.rainIntensity * 0.45);
}

/** Biển hiệu neon vẫn sáng nhẹ ban ngày (như phố thật) nhưng rực rỡ nhất về đêm. */
export function neonLevel(env: Pick<WorldEnvironment, 'daylight' | 'rainIntensity'>) {
  return 0.35 + 0.65 * streetLightLevel(env);
}
