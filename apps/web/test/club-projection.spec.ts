import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector3 } from 'three';
import { CLUB_DISCO_ORIGIN, CLUB_PROJECTION_BUDGET, getClubProjectionDirection, traceClubProjection } from '../game/systems/clubProjection';
import { getClubBeat } from '../game/systems/BeatSyncController';
import { DEFAULT_CLUB_SHOW, DEFAULT_CLUB_TRACK } from '@metaverse/game-protocol';

test('vệt sáng chạm sàn/tường/sân khấu và không chiếu lơ lửng trong cửa', () => {
  const position = new Vector3(), normal = new Vector3();
  assert.ok(traceClubProjection(new Vector3(0, -1, 0), position, normal));
  assert.ok(Math.abs(position.y - .086) < 1e-8); assert.deepEqual(normal.toArray(), [0, 1, 0]);
  assert.ok(traceClubProjection(new Vector3(-1, -.2, 0).normalize(), position, normal));
  assert.ok(Math.abs(position.x + 7.76) < 1e-8); assert.equal(normal.x, 1);
  assert.ok(traceClubProjection(new Vector3(0, -.65, -.76).normalize(), position, normal));
  assert.ok(Math.abs(position.y - .777) < 1e-8); assert.ok(position.z < -3.5);
  assert.equal(traceClubProjection(new Vector3(0, -.5, 1).normalize(), position, normal), false);
});

test('mọi mức chất lượng giữ tia hữu hạn, có chuẩn đơn vị và quay liên tục qua vòng nhạc', () => {
  const direction = new Vector3(), point = new Vector3(), normal = new Vector3();
  for (const count of Object.values(CLUB_PROJECTION_BUDGET)) {
    let hits = 0;
    for (let i = 0; i < count; i++) {
      getClubProjectionDirection(i, count, 20, false, direction);
      assert.ok(Math.abs(direction.length() - 1) < 1e-8);
      if (traceClubProjection(direction, point, normal)) {
        hits++;
        assert.ok(Math.abs(point.x) <= 7.761 && Math.abs(point.z) <= 7.761);
        assert.ok(point.y >= .08 && point.y <= CLUB_DISCO_ORIGIN.y);
        assert.ok(Math.abs(normal.length() - 1) < 1e-8);
      }
    }
    assert.ok(hits > count * .85);
  }
  const before = getClubProjectionDirection(0, 168, 1, false, new Vector3());
  const fullTurn = getClubProjectionDirection(0, 168, 1 + Math.PI * 2 / .24, false, new Vector3());
  assert.ok(before.distanceTo(fullTurn) < 1e-8);
});

test('beat/cue lặp theo bài nhưng đồng hồ quay vẫn tăng; preset thủ công được giữ', () => {
  const epoch = 1000, position = 80;
  const first = getClubBeat(epoch, DEFAULT_CLUB_SHOW, epoch + position * 1000);
  const repeated = getClubBeat(epoch, DEFAULT_CLUB_SHOW, epoch + (position + DEFAULT_CLUB_TRACK.durationSeconds) * 1000);
  assert.ok(Math.abs(first.beat - repeated.beat) < 1e-7);
  assert.equal(first.cue, repeated.cue);
  assert.ok(repeated.elapsedBeat > first.elapsedBeat);
  assert.equal(getClubBeat(epoch, { ...DEFAULT_CLUB_SHOW, cue: 'peak' }, 2000).cue, 'peak');
});
