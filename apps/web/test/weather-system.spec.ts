import assert from 'node:assert/strict';
import { test } from 'node:test';
// Chu kỳ mưa/ngày đêm được kiểm trong world-clock.spec.ts; file này kiểm nhịp chập chờn của đèn.
import { calculateFlicker, calculateSignFlicker } from '../game/systems/RainWeatherSystem';

test('đèn đường sáng ổn định khi trời tạnh và dao động êm dịu khi trời mưa', () => {
  // Khi trời tạnh (rainIntensity = 0): đèn sáng ổn định tuyệt đối (flicker = 1.0)
  for (let t = 0; t < 20; t += 2) {
    const flicker = calculateFlicker(t, 0);
    assert.equal(flicker, 1.0, `Tại t=${t} khi trời tạnh đèn phải sáng 100% không nhấp nháy`);
  }

  // Khi trời mưa (rainIntensity = 1.0): đèn có dao động êm dịu, không giật gân gây đau mắt
  let hasVariations = false;
  let minFlicker = 1.0;
  let maxFlicker = 0.0;

  for (let t = 0; t < 50; t += 0.5) {
    const flicker = calculateFlicker(t, 1.0);
    assert.ok(Number.isFinite(flicker), 'Hệ số flicker phải là số thực hợp lệ');
    assert.ok(flicker >= 0.88 && flicker <= 1.05, 'Hệ số flicker nằm trong ngưỡng êm dịu an toàn cho mắt');
    if (Math.abs(flicker - 1.0) > 0.01) hasVariations = true;
    if (flicker < minFlicker) minFlicker = flicker;
    if (flicker > maxFlicker) maxFlicker = flicker;
  }

  assert.ok(hasVariations, 'Khi trời mưa đèn đường có dao động nhẹ nhàng');
});

test('đèn biển hiệu neon nhấp nháy sinh động, biên độ êm dịu không chớp giật gây đau mắt', () => {
  let minSign = 2.0;
  let maxSign = 0.0;
  for (let t = 0; t < 20; t += 0.05) {
    const val = calculateSignFlicker(t, 1, 0.5);
    assert.ok(Number.isFinite(val) && val > 0);
    if (val < minSign) minSign = val;
    if (val > maxSign) maxSign = val;
  }
  // Giữ biên độ ánh sáng êm dịu (khoảng 0.60 - 1.25), có hiệu ứng nhấp nháy neon rõ nét nhưng không chớp tắt đột ngột về 0
  assert.ok(minSign >= 0.60, 'Biển hiệu neon không bị chớp tắt ngúm về 0 gây đau mắt');
  assert.ok(maxSign <= 1.30, 'Biển hiệu neon không bị chói sáng quá đà');
  assert.ok(minSign < 0.85 && maxSign > 1.15, 'Biển hiệu có nhịp chớp neon sinh động rõ ràng');
});
