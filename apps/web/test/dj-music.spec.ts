import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CLUB_PLAYLIST, REIKA_PLAYLIST, DEFAULT_CLUB_TRACK, DEFAULT_REIKA_TRACK, DJ_HOME, createClubPlaylist, createReikaPlaylist, getReikaTrack, createDjRoute, getDjTravelDuration, isClubWalkable, type DjSample } from '@metaverse/game-protocol';
import { createDjVisitMotion } from '../game/systems/djVisitMotion';
import { createClubAudioBuffer } from '../game/systems/clubAudioBuffer';
import { getDjStageRoutine, ROUTINE_CYCLE, STAGE_CENTER, sampleWalkToCenter, sampleWalkToConsole } from '../game/systems/djStagePerformance';

test('catalog chỉ nhận ID/URL nội bộ, thời lượng thật và cue có thứ tự', () => {
  const song = { ...DEFAULT_CLUB_TRACK, id: 'new-song', url: '/assets/audio/club/playlist/test.mp3' };
  assert.equal(createClubPlaylist([song]).length, 2);
  assert.equal(createClubPlaylist([{ ...song, url: '/assets/audio/club/playlist/test.m4a' }])[1].url, '/assets/audio/club/playlist/test.m4a');
  assert.throws(() => createClubPlaylist([{ ...song, url: '/assets/audio/club/playlist/test.aac' }]));
  for (const data of [{ ...song, id: song.id.repeat(20) }, { ...song, url: 'https://bad.test/a.mp3' }, { ...song, url: '/assets/audio/club/../a.mp3' }, { ...song, durationSeconds: NaN }, { ...song, bpm: Infinity }, { ...song, cues: [{ atSeconds: 20, cue: 'groove' }, { atSeconds: 0, cue: 'peak' }] }]) assert.throws(() => createClubPlaylist([data]));
  assert.throws(() => createClubPlaylist([song, song])); assert.ok(CLUB_PLAYLIST.length >= 1);
  assert.ok(REIKA_PLAYLIST.length >= 2);
  assert.equal(getReikaTrack(DEFAULT_REIKA_TRACK.id)?.title, DEFAULT_REIKA_TRACK.title);
  assert.throws(() => createReikaPlaylist([]));
  assert.throws(() => createReikaPlaylist([{ ...DEFAULT_REIKA_TRACK, url: '/assets/audio/club/playlist/wrong.m4a' }]));
  // Reika Lounge mặc định không phát nhạc khi chưa có trackId được order
  assert.equal(getReikaTrack(undefined), undefined);
  assert.equal(getReikaTrack(''), undefined);
});

test('đường DJ vòng qua console, đi xuống cầu thang và khớp vị trí khi quay về giữa đường', () => {
  for (const target of [{ x: 0, z: -2.95 }, { x: -5, z: -2 }, { x: 5, z: -1.5 }, { x: 2.9, z: -2.45 }]) {
    const route = createDjRoute(target.x, target.z), out: DjSample = { x: 0, y: 0, z: 0, yaw: 0, distance: 0, speed: 0 };
    for (let d = 0; d < route.length; d += .02) {
      route.sample(d, out);
      assert.ok(Object.values(out).every(Number.isFinite));
      assert.ok(!(Math.abs(out.x) < 1.7 && out.z > -7.2 && out.z < -5.7), 'DJ xuyên console');
      if (out.y < .1) assert.ok(isClubWalkable(out.x, out.z), 'Đích/đường sàn phải đi được');
    }
    route.sample(route.length, out); assert.ok(Math.hypot(out.x - target.x, out.z - target.z) < .0001);
    const distance = route.length * .43, a = { ...out }, b = { ...out };
    route.sample(distance, a); route.sample(0, b, true, distance); assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < .0001);
    const motion = createDjVisitMotion({ phase: 'approaching', requesterId: 'a', startedAt: 0, playerX: target.x, playerZ: target.z + .95, targetX: target.x, targetZ: target.z, returnDistance: 0 });
    motion.sample(getDjTravelDuration(route.length), out); assert.equal(out.speed, 0);
  }
});

test('playlist tải nền tối đa hai bài, giữ blob riêng từng bài và không tải trùng', async () => {
  const original = globalThis.fetch; let active = 0, peak = 0, downloads = 0;
  globalThis.fetch = async () => { downloads++; active++; peak = Math.max(peak, active); await new Promise(resolve => setTimeout(resolve, 10)); active--; return new Response(new Blob(['audio'])); };
  const buffer = createClubAudioBuffer(), tracks = Array.from({ length: 5 }, (_, i) => ({ ...DEFAULT_CLUB_TRACK, id: String(i), url: `/assets/audio/club/${i}.mp3` }));
  try {
    const result: string[] = []; await buffer.preload(tracks, (id, ready) => { assert.ok(ready); result.push(id); });
    assert.equal(result.length, 5); assert.equal(peak, 2); assert.equal(downloads, 5);
    assert.notEqual(await buffer.load(tracks[0]), await buffer.load(tracks[1])); assert.equal(downloads, 5);
  } finally { buffer.dispose(); globalThis.fetch = original; }
});

test('DJ Rio biểu diễn sân khấu: giai đoạn console, đi bộ tránh booth và nhảy snake hip hop', () => {
  // 1. Giai đoạn 0s -> 18s: Chơi nhạc tại bàn DJ
  for (const t of [0, 5, 10, 17.9]) {
    const routine = getDjStageRoutine(t);
    assert.equal(routine.phase, 'console');
    assert.equal(routine.x, DJ_HOME.x);
    assert.equal(routine.y, DJ_HOME.y);
    assert.equal(routine.z, DJ_HOME.z);
    assert.equal(routine.yaw, DJ_HOME.yaw);
    assert.equal(routine.speed, 0);
  }

  // 2. Giai đoạn 18s -> 21.6s: Bước từ bàn console ra giữa sân khấu
  for (let t = 18.0; t <= 21.5; t += 0.2) {
    const routine = getDjStageRoutine(t);
    assert.equal(routine.phase, 'walking_to_center');
    assert.ok(routine.speed > 1.0, 'Tốc độ đi bộ phải dương');
    assert.equal(routine.y, 0.77, 'Độ cao phải giữ đúng mặt sàn sân khấu');

    // Không được đi xuyên qua vùng thiết bị console
    const insideConsole = Math.abs(routine.x) < 1.0 && routine.z > -7.2 && routine.z < -5.7;
    assert.ok(!insideConsole, `DJ đi xuyên qua console tại t=${t}: x=${routine.x}, z=${routine.z}`);
  }

  // Kết thúc chặng đi ra: Phải đến vị trí STAGE_CENTER [0, 0.77, -5.0]
  const arrival = sampleWalkToCenter(1.0);
  assert.ok(Math.hypot(arrival.x - STAGE_CENTER.x, arrival.z - STAGE_CENTER.z) < 0.05, 'Điểm đến phải là giữa sân khấu');
  assert.ok(Math.abs(arrival.yaw - STAGE_CENTER.yaw) < 0.05, 'Hướng nhìn phải hướng về khán giả');

  // 3. Giai đoạn 21.6s -> 37.2s: Nhảy Snake Hip Hop ở giữa sân khấu
  for (const t of [21.6, 25.0, 30.0, 37.1]) {
    const routine = getDjStageRoutine(t);
    assert.equal(routine.phase, 'snake_dancing');
    assert.equal(routine.x, STAGE_CENTER.x);
    assert.equal(routine.y, STAGE_CENTER.y);
    assert.equal(routine.z, STAGE_CENTER.z);
    assert.equal(routine.yaw, STAGE_CENTER.yaw);
    assert.equal(routine.speed, 0);
    assert.ok(routine.phaseTime >= 0 && routine.phaseTime <= 15.6);
  }

  // 4. Giai đoạn 37.2s -> 40.8s: Bước từ giữa sân khấu về bàn console
  for (let t = 37.2; t <= 40.7; t += 0.2) {
    const routine = getDjStageRoutine(t);
    assert.equal(routine.phase, 'walking_to_console');
    assert.ok(routine.speed > 1.0, 'Tốc độ đi bộ về phải dương');
    assert.equal(routine.y, 0.77);

    // Không được đi xuyên qua vùng thiết bị console
    const insideConsole = Math.abs(routine.x) < 1.0 && routine.z > -7.2 && routine.z < -5.7;
    assert.ok(!insideConsole, `DJ đi xuyên qua console khi quay về tại t=${t}: x=${routine.x}, z=${routine.z}`);
  }

  // Kết thúc chặng đi về: Phải về đúng DJ_HOME [0, 0.77, -7.35]
  const backHome = sampleWalkToConsole(1.0);
  assert.ok(Math.hypot(backHome.x - DJ_HOME.x, backHome.z - DJ_HOME.z) < 0.05, 'Điểm về phải là bàn console');
  assert.ok(Math.abs(backHome.yaw - DJ_HOME.yaw) < 0.05, 'Hướng nhìn về bàn console');

  // 5. Giai đoạn 40.8s -> 68s: Tiếp tục chơi nhạc tại bàn console
  for (const t of [40.8, 50.0, 60.0, 67.9]) {
    const routine = getDjStageRoutine(t);
    assert.equal(routine.phase, 'console');
    assert.equal(routine.x, DJ_HOME.x);
    assert.equal(routine.y, DJ_HOME.y);
    assert.equal(routine.z, DJ_HOME.z);
    assert.equal(routine.yaw, DJ_HOME.yaw);
    assert.equal(routine.speed, 0);
  }

  // 6. Chu kỳ lặp lại chính xác ở vòng tiếp theo
  const cycle2 = getDjStageRoutine(ROUTINE_CYCLE + 25.0);
  assert.equal(cycle2.phase, 'snake_dancing');
  assert.equal(cycle2.x, STAGE_CENTER.x);
  assert.equal(cycle2.z, STAGE_CENTER.z);
});
