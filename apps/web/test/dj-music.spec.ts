import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CLUB_PLAYLIST, DEFAULT_CLUB_TRACK, createClubPlaylist, createDjRoute, getDjTravelDuration, isClubWalkable, type DjSample } from '@metaverse/game-protocol';
import { createDjVisitMotion } from '../game/systems/djVisitMotion';
import { createClubAudioBuffer } from '../game/systems/clubAudioBuffer';

test('catalog chỉ nhận ID/URL nội bộ, thời lượng thật và cue có thứ tự', () => {
  const song = { ...DEFAULT_CLUB_TRACK, id: 'new-song', url: '/assets/audio/club/playlist/test.mp3' };
  assert.equal(createClubPlaylist([song]).length, 2);
  for (const data of [{ ...song, id: song.id.repeat(20) }, { ...song, url: 'https://bad.test/a.mp3' }, { ...song, url: '/assets/audio/club/../a.mp3' }, { ...song, durationSeconds: NaN }, { ...song, bpm: Infinity }, { ...song, cues: [{ atSeconds: 20, cue: 'groove' }, { atSeconds: 0, cue: 'peak' }] }]) assert.throws(() => createClubPlaylist([data]));
  assert.throws(() => createClubPlaylist([song, song])); assert.ok(CLUB_PLAYLIST.length >= 1);
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
