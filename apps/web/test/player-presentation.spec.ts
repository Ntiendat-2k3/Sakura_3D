import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Group } from 'three';
import { createPlayerPresentation } from '../game/systems/playerPresentation';
import { MOVE_SPEED } from '@metaverse/game-protocol';

const player = (x: number, yaw = 0) => ({ id: 'test', name: 'Test', x, z: 0, yaw });

test('đệm gói lệch 10 ms giữ chuyển động liên tục, không vượt tọa độ server', () => {
  const root = new Group(), visual = createPlayerPresentation(player(0), 0);
  visual.update(root, 0, 0);
  const frames: number[] = [];
  let next = 1, latest = 0, previous = 0;
  for (let time = 10; time <= 1500; time += 10) {
    while (time >= next * 100 + (next % 2 ? 10 : -10)) {
      latest = next * .1; visual.push(player(latest), next * 100 + (next % 2 ? 10 : -10)); next++;
    }
    visual.update(root, .01, time);
    assert.ok(root.position.x <= latest + 1e-8);
    assert.ok(root.position.x >= previous - 1e-8);
    if (time > 250) frames.push((root.position.x - previous) / .01);
    previous = root.position.x;
  }
  assert.ok(Math.min(...frames) > .8, 'Không được dừng khựng giữa các gói');
  assert.ok(Math.max(...frames) < 1.3, 'Không được tăng tốc để đuổi theo mỗi patch');
});

test('nghỉ lâu rồi đi không nhảy tới đích; mất gói giữ nguyên tại snapshot cuối', () => {
  const root = new Group(), visual = createPlayerPresentation(player(0), 0);
  visual.update(root, 0, 0);
  for (let time = 100; time <= 2000; time += 100) { visual.push(player(0), time); visual.update(root, .1, time); }
  visual.push(player(.48), 2100); visual.update(root, .016, 2100);
  assert.equal(root.position.x, 0);
  visual.update(root, .05, 2200);
  assert.equal(root.position.x, 0);
  visual.update(root, .05, 2250);
  assert.ok(root.position.x > 0 && root.position.x < .48);
  for (let time = 2300; time <= 4000; time += 20) visual.update(root, .02, time);
  assert.equal(root.position.x, .48);
  assert.ok(visual.update(root, .02, 4020) < .001);
});

for (const fps of [30, 60, 144]) test(`mốc server giữ tốc độ đều ở ${fps} FPS dù patch chứa 1/3 tick và gói đến lệch nhịp`, () => {
  const root = new Group(), visual = createPlayerPresentation({ ...player(0), sampleTime: 0 }, 0);
  visual.update(root, 0, 0);
  const packets = Array.from({ length: 70 }, (_, index) => {
    const n = index + 1, sampleTime = n * 100 - (n % 2 ? 50 : 0);
    return { sampleTime, receivedAt: n * 100 + [5, 35, 10, 25][n % 4] };
  });
  let next = 0, previous = 0, latest = 0;
  const speeds: number[] = [];
  for (let frame = 1; frame <= fps * 6; frame++) {
    const now = frame * 1000 / fps;
    while (next < packets.length && packets[next].receivedAt <= now) {
      const packet = packets[next++]; latest = MOVE_SPEED * packet.sampleTime / 1000;
      visual.push({ ...player(latest), sampleTime: packet.sampleTime }, packet.receivedAt);
    }
    visual.update(root, 1 / fps, now);
    assert.ok(root.position.x <= latest + 1e-8, 'Không vượt tọa độ server khi gói đến trễ');
    if (now > 1000) speeds.push((root.position.x - previous) * fps);
    previous = root.position.x;
  }
  assert.ok(Math.min(...speeds) > MOVE_SPEED * .99, `Khựng xuống ${Math.min(...speeds)} m/s`);
  assert.ok(Math.max(...speeds) < MOVE_SPEED * 1.01, `Tăng vọt lên ${Math.max(...speeds)} m/s`);
});

test('đồng hồ server khác client và gói đầu trễ không tạo cú nhảy khi hiệu chỉnh mốc', () => {
  const origin = 50000, root = new Group();
  const visual = createPlayerPresentation({ ...player(0), sampleTime: origin }, 80);
  visual.update(root, 0, 80);
  let next = 1, previous = 0;
  const speeds: number[] = [];
  for (let frame = 1; frame <= 360; frame++) {
    const now = 80 + frame * 1000 / 60;
    while (next * 100 + 10 <= now) {
      visual.push({ ...player(next * .48), sampleTime: origin + next * 100 }, next * 100 + 10); next++;
    }
    visual.update(root, 1 / 60, now);
    if (frame > 60) speeds.push((root.position.x - previous) * 60);
    previous = root.position.x;
  }
  assert.ok(Math.min(...speeds) > MOVE_SPEED * .99);
  assert.ok(Math.max(...speeds) < MOVE_SPEED * 1.05, 'Không nhảy để đuổi lệch đồng hồ');
});

test('quay qua biên pi theo cung ngắn, teleport không tạo bước chạy giả', () => {
  const root = new Group(), visual = createPlayerPresentation(player(0, Math.PI - .1), 0);
  visual.update(root, 0, 0);
  visual.push(player(.1, -Math.PI + .1), 100);
  for (let time = 10; time <= 400; time += 10) visual.update(root, .01, time);
  assert.ok(root.rotation.y > Math.PI - .1 && root.rotation.y < Math.PI + .11);
  visual.push(player(20, 0), 500);
  assert.equal(visual.update(root, .016, 500), 0);
  assert.equal(root.position.x, 20);
});
