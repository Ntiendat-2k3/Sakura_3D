import assert from 'node:assert/strict';
import test from 'node:test';
import { createPetals, stepPetal } from '../game/systems/SakuraPetals';
import { CLUB_PRELOAD_URLS } from '../game/systems/ClubAssetWarmup';
import { STREET_DECOR_URL } from '../game/scenes/StreetAssets';

test('cánh hoa rơi liên tục: không thủng đất, không trôi khỏi phố, cùng hạt cho cùng kết quả', () => {
  const petals = createPetals(120, 3);
  assert.deepEqual(createPetals(5, 9).map(p => p.x), createPetals(5, 9).map(p => p.x));
  for (let frame = 0; frame < 60 * 40; frame++) {
    for (const petal of petals) {
      stepPetal(petal, 1 / 60, frame / 60);
      assert.ok(petal.y >= 0 && petal.y <= 8.6, `cao ${petal.y}`);
      assert.ok(Math.abs(petal.x) <= 18 && Math.abs(petal.z) <= 25, `vị trí ${petal.x},${petal.z}`);
    }
  }
});

test('lớp trang trí phố được tải trước cùng các GLB phố', () => {
  assert.ok(CLUB_PRELOAD_URLS.includes(STREET_DECOR_URL));
});
