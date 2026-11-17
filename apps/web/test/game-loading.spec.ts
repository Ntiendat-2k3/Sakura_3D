import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { CLUB_PRELOAD_URLS } from '../game/systems/ClubAssetWarmup';
import { PLAYER_CHARACTERS } from '@metaverse/game-protocol';

test('ảnh nền loading game tồn tại tại thư mục public/assets/ui/loading-bg.jpg', async () => {
  const bgPath = resolve(process.cwd(), 'public/assets/ui/loading-bg.jpg');
  await assert.doesNotReject(access(bgPath), 'Tệp loading-bg.jpg phải tồn tại để người dùng có thể thay thế ảnh nền');
});

test('danh sách tải tài nguyên nạp đầy đủ kiến trúc, 9 nhân vật và Love Hotel trước khi vào game', () => {
  // 1. Phải có toà nhà Love Hotel 2F
  assert.ok(
    CLUB_PRELOAD_URLS.includes('/assets/buildings/love-hotel.glb'),
    'Phải tải trước phòng Cyber Love Hotel'
  );

  // 2. Phải có Denmu Club, Reika Lounge và Kohaku Club
  assert.ok(
    CLUB_PRELOAD_URLS.includes('/assets/buildings/denmu-club.glb'),
    'Phải tải trước Denmu Club'
  );
  assert.ok(
    CLUB_PRELOAD_URLS.includes('/assets/buildings/reika-lounge.glb'),
    'Phải tải trước Reika Lounge'
  );
  assert.ok(
    CLUB_PRELOAD_URLS.includes('/assets/buildings/kohaku-club.glb'),
    'Phải tải trước Kohaku Private Members Club'
  );

  // 3. Phải nạp đầy đủ tất cả 11 nhân vật người chơi
  const characterUrls = Object.values(PLAYER_CHARACTERS).map(p => p.url);
  for (const url of characterUrls) {
    assert.ok(
      CLUB_PRELOAD_URLS.includes(url),
      `Phải tải trước mô hình nhân vật ${url}`
    );
  }
});
