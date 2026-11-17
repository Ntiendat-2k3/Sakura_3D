import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POKER_RULES, POKER_TIMING, POKER_SEATS, blindsFor, createEmptyPokerTable, normalizePokerAction, normalizePokerChoice, normalizePokerTaunt, punchesFor } from '../src';

test('luật chip, blind và số cú đấm giữ chung một nguồn', () => {
  assert.equal(POKER_RULES.startingChips, 1000);
  assert.equal(POKER_RULES.maxPlayers, 6);
  assert.equal(POKER_TIMING.turnMs, 30000);
  assert.deepEqual([0, 1, 2].map(punchesFor), [5, 8, 11]);
  assert.deepEqual(blindsFor(1), { small: 10, big: 20 });
  assert.deepEqual(blindsFor(10), { small: 10, big: 20 });
  assert.deepEqual(blindsFor(11), { small: 20, big: 40 });
  assert.deepEqual(blindsFor(21), { small: 40, big: 80 });
});

test('lệnh tố chỉ nhận hành động hợp lệ và số nguyên dương hữu hạn', () => {
  assert.deepEqual(normalizePokerAction({ action: 'raise', amount: 60 }), { action: 'raise', amount: 60 });
  assert.deepEqual(normalizePokerAction({ action: 'call', amount: 5 }), { action: 'call' });
  assert.deepEqual(normalizePokerAction({ action: 'allin' }), { action: 'allin' });
  for (const input of [null, {}, { action: 'raise' }, { action: 'raise', amount: 0 }, { action: 'raise', amount: -1 }, { action: 'raise', amount: 12.5 }, { action: 'raise', amount: NaN }, { action: 'raise', amount: Infinity }, { action: 'raise', amount: '60' }, { action: 'raise', amount: 1_000_000_001 }, { action: 'unknown' }]) {
    assert.equal(normalizePokerAction(input), null);
  }
});

test('lựa chọn vay hoặc rời bàn và đích cà khịa được chuẩn hóa', () => {
  assert.equal(normalizePokerChoice({ choice: 'borrow' }), 'borrow');
  assert.equal(normalizePokerChoice({ choice: 'leave' }), 'leave');
  assert.equal(normalizePokerChoice({ choice: 'x' }), null);
  assert.deepEqual(normalizePokerTaunt({ kind: 'laugh', target: 'prisoner' }), { kind: 'laugh', target: 'prisoner' });
  assert.deepEqual(normalizePokerTaunt({ kind: 'point', target: POKER_SEATS[0] }), { kind: 'point', target: POKER_SEATS[0] });
  for (const input of [null, { kind: 'laugh', target: 'gekka-post' }, { kind: '__proto__', target: 'prisoner' }, { kind: 'laugh', target: 1 }]) {
    assert.equal(normalizePokerTaunt(input), null);
  }
});

test('bàn rỗng có sáu ghế và không chứa bài tẩy', () => {
  const table = createEmptyPokerTable();
  assert.equal(table.phase, 'lobby');
  assert.equal(table.seats.length, 6);
  assert.deepEqual(table.seats.map(seat => seat.seatId), POKER_SEATS);
  assert.ok(table.seats.every(seat => seat.sessionId === '' && seat.chips === 0 && seat.captive === 'none'));
  assert.deepEqual(table.board, []);
  assert.deepEqual(table.showdown, []);
  assert.equal(table.dungeon.phase, 'idle');
});
