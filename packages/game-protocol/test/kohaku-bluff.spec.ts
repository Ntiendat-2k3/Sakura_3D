import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BLUFF_DECK, BLUFF_SEATS, BLUFF_TAUNTS, createEmptyBluffTable, normalizeBluffPlay, normalizeBluffTaunt, isBluffTruthful } from '../src';

test('bộ bài 20 lá, 4 ghế đúng thứ tự, bàn rỗng ở lobby', () => {
  assert.equal(Object.values(BLUFF_DECK).reduce((a, b) => a + b, 0), 20);
  assert.deepEqual(BLUFF_SEATS, ['kohaku-player-1', 'kohaku-player-2', 'kohaku-player-3', 'kohaku-player-4']);
  const t = createEmptyBluffTable();
  assert.equal(t.phase, 'lobby'); assert.equal(t.seats.length, 4); assert.ok(t.seats.every(s => s.sessionId === ''));
});
test('normalizeBluffPlay chỉ nhận 1–3 id chuỗi ngắn, không trùng', () => {
  assert.deepEqual(normalizeBluffPlay({ cardIds: ['a', 'b'] }), ['a', 'b']);
  for (const bad of [null, {}, { cardIds: [] }, { cardIds: ['a', 'a'] }, { cardIds: ['a', 'b', 'c', 'd'] }, { cardIds: [1] }, { cardIds: ['x'.repeat(17)] }, { cardIds: '__proto__' }])
    assert.equal(normalizeBluffPlay(bad), null);
});
test('isBluffTruthful: Joker luôn thật, một lá sai là nói dối', () => {
  assert.equal(isBluffTruthful(['Q', 'JOKER'], 'Q'), true);
  assert.equal(isBluffTruthful(['Q', 'K'], 'Q'), false);
});
test('normalizeBluffTaunt nhận kind hợp lệ và targetSeat là ghế Bluff', () => {
  assert.deepEqual(normalizeBluffTaunt({ kind: 'flip', targetSeat: BLUFF_SEATS[1] }), { kind: 'flip', targetSeat: BLUFF_SEATS[1] });
  for (const bad of [null, 'flip', { kind: 'kiss', targetSeat: BLUFF_SEATS[1] }, { kind: 'flip' }, { kind: 'flip', targetSeat: 'kohaku-dealer' }, { kind: 'flip', targetSeat: 42 }]) {
    assert.equal(normalizeBluffTaunt(bad), null);
  }
});
test('BLUFF_TAUNTS dùng phím 1-4 không trùng', () => {
  assert.deepEqual(Object.values(BLUFF_TAUNTS).map(t => t.key), ['1', '2', '3', '4']);
});
