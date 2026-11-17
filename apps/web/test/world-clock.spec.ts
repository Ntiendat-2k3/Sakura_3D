import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DAY_NIGHT_CYCLE_MS, DAYTIME_MS, DRY_DOWN_MS, RAIN_DURATION_MS, RAIN_PERIOD_MS, RAIN_RAMP_MS, TWILIGHT_MS, WET_UP_MS,
  calculateDaylight, calculateRain, getWorldEnvironment, neonLevel, rainStartForHour, streetLightLevel,
} from '../game/systems/worldClock';

const MIN = 60_000;
const BASE_HOUR = 482_000; // một giờ bất kỳ (epoch hour index)

test('ngày 30 phút rồi đêm 30 phút, chuyển tiếp êm qua bình minh/hoàng hôn', () => {
  const cycle = BASE_HOUR * DAY_NIGHT_CYCLE_MS;
  assert.equal(calculateDaylight(cycle + 15 * MIN), 1, 'giữa ban ngày sáng hẳn');
  assert.equal(calculateDaylight(cycle + 45 * MIN), 0, 'giữa ban đêm tối hẳn');
  assert.ok(Math.abs(calculateDaylight(cycle) - 0.5) < 1e-9, 'đúng mốc bình minh là nửa sáng');
  assert.ok(Math.abs(calculateDaylight(cycle + DAYTIME_MS) - 0.5) < 1e-9, 'đúng mốc hoàng hôn là nửa sáng');
  assert.equal(calculateDaylight(cycle + DAYTIME_MS + TWILIGHT_MS), 0);
  assert.equal(calculateDaylight(cycle + TWILIGHT_MS), 1);

  // Liên tục, không nhảy cóc giữa hai mẫu cách nhau 1 giây
  let prev = calculateDaylight(cycle);
  for (let t = 1000; t <= DAY_NIGHT_CYCLE_MS; t += 1000) {
    const cur = calculateDaylight(cycle + t);
    assert.ok(cur >= 0 && cur <= 1);
    assert.ok(Math.abs(cur - prev) < 0.02, `nhảy cóc tại t=${t}`);
    prev = cur;
  }
});

test('mỗi giờ có đúng một trận mưa 10 phút, nằm gọn trong giờ đó, phút bắt đầu thay đổi giữa các giờ', () => {
  const starts = new Set<number>();
  let rainyNights = 0;
  let rainyDays = 0;
  for (let h = BASE_HOUR; h < BASE_HOUR + 48; h++) {
    const start = rainStartForHour(h);
    const hourStart = h * RAIN_PERIOD_MS;
    assert.ok(start >= hourStart && start + RAIN_DURATION_MS <= hourStart + RAIN_PERIOD_MS);
    starts.add((start - hourStart) / MIN);

    let rainySamples = 0;
    for (let t = hourStart; t < hourStart + RAIN_PERIOD_MS; t += 10_000) if (calculateRain(t).isRaining) rainySamples++;
    // 10 phút mưa = 60 mẫu 10s (mẫu đúng mốc bắt đầu có cường độ 0)
    assert.ok(rainySamples >= 59 && rainySamples <= 60, `giờ ${h} có ${rainySamples} mẫu mưa`);

    const mid = start + RAIN_DURATION_MS / 2;
    if (calculateDaylight(mid) > 0.5) rainyDays++; else rainyNights++;
  }
  assert.ok(starts.size > 10, 'phút bắt đầu mưa phải thay đổi giữa các giờ');
  assert.ok(rainyDays > 0 && rainyNights > 0, 'lệch pha: có trận mưa ban ngày lẫn ban đêm');
});

test('cường độ mưa tăng dần, giữ mức to rồi ngớt dần', () => {
  const start = rainStartForHour(BASE_HOUR);
  assert.equal(calculateRain(start - 1).rainIntensity, 0);
  const ramp = calculateRain(start + RAIN_RAMP_MS / 2).rainIntensity;
  assert.ok(ramp > 0.3 && ramp < 0.7);
  assert.equal(calculateRain(start + RAIN_DURATION_MS / 2).rainIntensity, 1);
  assert.equal(calculateRain(start + RAIN_DURATION_MS).rainIntensity, 0);
});

test('mặt đường ướt dần khi mưa và khô dần sau mưa, kể cả qua ranh giới giờ', () => {
  const start = rainStartForHour(BASE_HOUR);
  const end = start + RAIN_DURATION_MS;
  assert.equal(calculateRain(start).wetness, 0);
  assert.ok(Math.abs(calculateRain(start + WET_UP_MS / 2).wetness - 0.5) < 1e-9);
  assert.equal(calculateRain(start + WET_UP_MS).wetness, 1);
  assert.ok(Math.abs(calculateRain(end + DRY_DOWN_MS / 2).wetness - 0.5) < 1e-9);
  assert.equal(calculateRain(end + DRY_DOWN_MS).wetness, 0);

  // Giờ kế tiếp, trước trận mưa mới: độ ướt tính tiếp từ trận của giờ trước
  const nextHourStart = (BASE_HOUR + 1) * RAIN_PERIOD_MS;
  if (rainStartForHour(BASE_HOUR + 1) > nextHourStart && end + DRY_DOWN_MS > nextHourStart) {
    const expected = 1 - (nextHourStart - end) / DRY_DOWN_MS;
    assert.ok(Math.abs(calculateRain(nextHourStart).wetness - expected) < 1e-9);
  }
  for (let h = BASE_HOUR; h < BASE_HOUR + 24; h++) {
    const t = h * RAIN_PERIOD_MS;
    const wet = calculateRain(t).wetness;
    assert.ok(wet >= 0 && wet <= 1);
  }
});

test('cùng một thời điểm luôn cho cùng trạng thái (đồng bộ giữa các máy)', () => {
  const now = BASE_HOUR * RAIN_PERIOD_MS + 1_234_567;
  assert.deepEqual(getWorldEnvironment(now), getWorldEnvironment(now));
});

test('đèn đường tắt ban ngày, bật ban đêm; neon luôn sáng nhẹ', () => {
  assert.equal(streetLightLevel({ daylight: 1, rainIntensity: 0 }), 0);
  assert.equal(streetLightLevel({ daylight: 0, rainIntensity: 0 }), 1);
  assert.ok(streetLightLevel({ daylight: 1, rainIntensity: 1 }) > 0.3, 'mưa tối trời ban ngày thì bật bớt đèn');
  assert.ok(Math.abs(neonLevel({ daylight: 1, rainIntensity: 0 }) - 0.35) < 1e-9);
  assert.equal(neonLevel({ daylight: 0, rainIntensity: 0 }), 1);
});
