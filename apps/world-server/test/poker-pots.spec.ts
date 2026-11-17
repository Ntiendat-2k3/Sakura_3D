import assert from 'node:assert/strict';
import { test } from 'node:test';
import { awardPots, buildPots } from '../src/systems/pokerPots';

test('all-in 100/300/300 tạo pot chính 300 và side pot 400', () => {
  assert.deepEqual(buildPots([
    { seatId: 'a', committed: 100, folded: false },
    { seatId: 'b', committed: 300, folded: false },
    { seatId: 'c', committed: 300, folded: false },
  ]), [
    { amount: 300, eligible: ['a', 'b', 'c'] },
    { amount: 400, eligible: ['b', 'c'] },
  ]);
});

test('nhiều tầng all-in chia từng pot cho đúng người đủ quyền nhận', () => {
  const pots = buildPots([
    { seatId: 'a', committed: 50, folded: false },
    { seatId: 'b', committed: 100, folded: false },
    { seatId: 'c', committed: 300, folded: false },
    { seatId: 'd', committed: 300, folded: false },
  ]);
  assert.deepEqual(pots, [
    { amount: 200, eligible: ['a', 'b', 'c', 'd'] },
    { amount: 150, eligible: ['b', 'c', 'd'] },
    { amount: 400, eligible: ['c', 'd'] },
  ]);
  const awards = awardPots(pots, new Map([['a', [8, 14]], ['b', [7, 13]], ['c', [6, 12]], ['d', [5, 11]]]), ['a', 'b', 'c', 'd']);
  assert.deepEqual([...awards], [['a', 200], ['b', 150], ['c', 400]]);
  assert.equal([...awards.values()].reduce((sum, chips) => sum + chips, 0), 750);
});

test('người fold góp chip nhưng không nhận pot; lớp có cùng quyền thắng được gộp', () => {
  const pots = buildPots([
    { seatId: 'a', committed: 100, folded: false },
    { seatId: 'b', committed: 300, folded: false },
    { seatId: 'c', committed: 300, folded: false },
    { seatId: 'f', committed: 50, folded: true },
  ]);
  assert.deepEqual(pots, [
    { amount: 350, eligible: ['a', 'b', 'c'] },
    { amount: 400, eligible: ['b', 'c'] },
  ]);
  const awards = awardPots(pots, new Map([['a', [7]], ['b', [6]], ['c', [5]]]), ['a', 'b', 'c', 'f']);
  assert.equal(awards.get('a'), 350);
  assert.equal(awards.get('b'), 400);
  assert.equal(awards.has('f'), false);
});

test('chip lẻ khi hòa thuộc người thắng đầu tiên bên trái nút', () => {
  const awards = awardPots([{ amount: 5, eligible: ['a', 'b'] }], new Map([['a', [4, 10]], ['b', [4, 10]]]), ['b', 'a']);
  assert.equal(awards.get('b'), 3);
  assert.equal(awards.get('a'), 2);
});

test('phần tố không ai theo là pot một người và được hoàn trả không cần score', () => {
  const pots = buildPots([
    { seatId: 'a', committed: 100, folded: false },
    { seatId: 'b', committed: 300, folded: false },
  ]);
  assert.deepEqual(pots, [
    { amount: 200, eligible: ['a', 'b'] },
    { amount: 200, eligible: ['b'] },
  ]);
  const awards = awardPots(pots, new Map([['a', [8]], ['b', [1]]]), ['a', 'b']);
  assert.equal(awards.get('a'), 200);
  assert.equal(awards.get('b'), 200);
  assert.equal(awardPots([pots[1]], new Map(), ['a', 'b']).get('b'), 200);
});

test('người fold có phần tố không ai theo được hoàn trả; tổng chip bảo toàn', () => {
  const pots = buildPots([
    { seatId: 'a', committed: 100, folded: false },
    { seatId: 'b', committed: 300, folded: true },
  ]);
  assert.deepEqual(pots, [
    { amount: 200, eligible: ['a'] },
    { amount: 200, eligible: ['b'] },
  ]);
  const awards = awardPots(pots, new Map(), ['a', 'b']);
  assert.equal(awards.get('a'), 200);
  assert.equal(awards.get('b'), 200);
  assert.equal([...awards.values()].reduce((sum, chips) => sum + chips, 0), 400);
});

test('nhiều người fold ở mức cao là trạng thái không thể chia pot hợp lệ', () => {
  assert.throws(() => buildPots([
    { seatId: 'a', committed: 100, folded: false },
    { seatId: 'b', committed: 300, folded: true },
    { seatId: 'c', committed: 200, folded: true },
  ]), /không có người đủ quyền nhận/);
});

test('thiếu điểm khi nhiều người đủ quyền nhận phải báo lỗi', () => {
  assert.throws(() => awardPots([{ amount: 10, eligible: ['a', 'b'] }], new Map([['a', [2]]]), ['a', 'b']), /Thiếu điểm/);
});
