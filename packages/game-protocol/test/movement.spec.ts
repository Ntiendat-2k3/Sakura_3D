import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COLLIDERS, STREET_LAYOUT, isWalkable, normalizeDanceInput, normalizeMoveInput, validateClubShow, DEFAULT_CLUB_TRACK, DEFAULT_CLUB_SHOW, getClubPlaybackSeconds, getClubTrackCue } from '../src';

test('kiểu nhảy được giới hạn normal/guitar/flair, lệnh dừng luôn cất đàn', () => {
  assert.deepEqual(normalizeDanceInput({ dancing: true }), { dancing: true, style: 'normal' });
  assert.deepEqual(normalizeDanceInput({ dancing: true, style: 'guitar' }), { dancing: true, style: 'guitar' });
  assert.deepEqual(normalizeDanceInput({ dancing: true, style: 'flair' }), { dancing: true, style: 'flair' });
  assert.deepEqual(normalizeDanceInput({ dancing: false, style: 'flair' }), { dancing: false, style: 'normal' });
  assert.deepEqual(normalizeDanceInput({ dancing: false, style: 'guitar' }), { dancing: false, style: 'normal' });
  for (const input of [null, {}, { dancing: 'true' }, { dancing: true, style: 'invalid' }, { dancing: true, style: 2 }]) assert.equal(normalizeDanceInput(input), null);
});

test('nhạc chung lặp cùng epoch, bù offset và cue theo track', () => {
  assert.ok(DEFAULT_CLUB_TRACK.durationSeconds > 0);
  assert.equal(DEFAULT_CLUB_SHOW.bpm, DEFAULT_CLUB_TRACK.bpm);
  assert.equal(DEFAULT_CLUB_SHOW.cue, 'auto');
  assert.equal(getClubPlaybackSeconds(1000, 10, 3500), 2.5);
  assert.equal(getClubPlaybackSeconds(1000, 10, 23500), 2.5);
  assert.equal(getClubPlaybackSeconds(1000, 10, 500), 0);
  assert.equal(getClubPlaybackSeconds(1000, 0, 3500), 0);
  for (const cue of DEFAULT_CLUB_TRACK.cues) assert.equal(getClubTrackCue(cue.atSeconds), cue.cue);
  assert.ok(validateClubShow(DEFAULT_CLUB_SHOW));
});
test('metadata club loại số không hữu hạn, cue lạ và không truyền file âm thanh', () => {
  assert.equal(validateClubShow({ bpm: NaN, offset: 0, cue: 'peak' }), null);
  assert.equal(validateClubShow({ bpm: 120, offset: Infinity, cue: 'peak' }), null);
  assert.equal(validateClubShow({ bpm: 120, offset: 0, cue: 'unknown' }), null);
  assert.equal(validateClubShow({ bpm: 1000, offset: 0, cue: 'groove' }), null);
  assert.deepEqual(validateClubShow({ bpm: 128, offset: .2, cue: 'peak', audio: 'discard' }), { bpm: 128, offset: .2, cue: 'peak' });
});
test('rejects NaN and out-of-range move commands', () => {
  assert.equal(normalizeMoveInput({ x: NaN, z: 0 }), null);
  assert.equal(normalizeMoveInput({ x: 5, z: 0 }), null);
  const normalized = normalizeMoveInput({ x: 1, z: 1 });
  assert.ok(normalized && Math.abs(Math.hypot(normalized.x, normalized.z) - 1) < 1e-9);
});
test('server collisions: road allowed, buildings denied', () => {
  assert.equal(isWalkable(0, 0), true);
  assert.equal(isWalkable(9, 9), false);
  assert.equal(isWalkable(50, 0), false);
});

test('mọi công trình GLB có collider, đường và khoảng hở vẫn đi được', () => {
  assert.equal(STREET_LAYOUT.length, 8);
  assert.equal(COLLIDERS.length, STREET_LAYOUT.length);
  for (const block of STREET_LAYOUT) {
    assert.equal(isWalkable(block.x, block.z), false, block.id);
    assert.equal(isWalkable(Math.sign(block.x) * 4.8, block.z), true, `vỉa hè ${block.id}`);
    assert.equal(isWalkable(block.x, block.z + 3.8), true, `khe giữa nhà ${block.id}`);
  }
});
