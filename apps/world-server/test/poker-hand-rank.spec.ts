import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareScores, rankHand } from '../src/systems/pokerHandRank';

test('chín hạng bài Hold’em có thứ tự và nhãn tiếng Việt đúng', () => {
  const hands = [
    { cards: ['As', 'Kd', 'Qc', 'Jh', '9s'], label: 'Mậu thầu' },
    { cards: ['As', 'Ad', 'Kc', 'Qh', '9s'], label: 'Đôi' },
    { cards: ['As', 'Ad', 'Kc', 'Kh', '9s'], label: 'Thú' },
    { cards: ['As', 'Ad', 'Ac', 'Kh', '9s'], label: 'Sám cô' },
    { cards: ['9s', '8d', '7c', '6h', '5s'], label: 'Sảnh' },
    { cards: ['As', 'Js', '8s', '4s', '2s'], label: 'Thùng' },
    { cards: ['As', 'Ad', 'Ac', 'Kh', 'Ks'], label: 'Cù lũ' },
    { cards: ['As', 'Ad', 'Ac', 'Ah', 'Ks'], label: 'Tứ quý' },
    { cards: ['9s', '8s', '7s', '6s', '5s'], label: 'Thùng phá sảnh' },
  ];
  const results = hands.map(({ cards, label }, index) => {
    const result = rankHand(cards);
    assert.equal(result.label, label);
    assert.equal(result.score[0], index);
    assert.equal(result.best.length, 5);
    return result;
  });
  for (let i = 1; i < results.length; i++) assert.ok(compareScores(results[i].score, results[i - 1].score) > 0);
});

test('sảnh A2345 thấp nhất, cả sảnh thường và thùng phá sảnh', () => {
  const wheel = rankHand(['As', '2d', '3c', '4h', '5s']);
  const sixHigh = rankHand(['2s', '3d', '4c', '5h', '6s']);
  assert.deepEqual(wheel.score, [4, 5]);
  assert.ok(compareScores(wheel.score, sixHigh.score) < 0);
  const wheelFlush = rankHand(['As', '2s', '3s', '4s', '5s']);
  assert.deepEqual(wheelFlush.score, [8, 5]);
  assert.ok(compareScores(wheelFlush.score, rankHand(['2h', '3h', '4h', '5h', '6h']).score) < 0);
});

test('hai đôi so đôi cao, đôi thấp rồi kicker; một đôi so kicker', () => {
  const aceKing = rankHand(['As', 'Ad', 'Ks', 'Kd', 'Qh']);
  const aceQueen = rankHand(['Ah', 'Ac', 'Qs', 'Qd', 'Kh']);
  const aceKingLowerKicker = rankHand(['Ah', 'Ac', 'Kh', 'Kc', 'Jh']);
  assert.ok(compareScores(aceKing.score, aceQueen.score) > 0);
  assert.ok(compareScores(aceKing.score, aceKingLowerKicker.score) > 0);
  assert.ok(compareScores(rankHand(['As', 'Ad', 'Ks', 'Qd', 'Jh']).score, rankHand(['Ah', 'Ac', 'Qs', 'Jd', '9h']).score) > 0);
});

test('bảy lá chọn đúng năm lá mạnh nhất và hai tay dùng chung board có thể hòa', () => {
  const fullHouse = rankHand(['As', 'Ad', 'Ac', 'Ks', 'Kd', 'Kc', '2h']);
  assert.deepEqual(fullHouse.score, [6, 14, 13]);
  assert.equal(fullHouse.best.length, 5);
  assert.equal(fullHouse.best.filter(card => card.startsWith('A')).length, 3);
  const first = rankHand(['As', 'Ks', 'Qs', 'Js', 'Ts', '2d', '3c']);
  const second = rankHand(['As', 'Ks', 'Qs', 'Js', 'Ts', '4d', '5c']);
  assert.equal(compareScores(first.score, second.score), 0);
  assert.equal(first.best.length, 5);
});

test('đầu vào không phải bộ bài 5–7 lá hợp lệ bị từ chối', () => {
  assert.throws(() => rankHand(['As', 'Ad', 'Ks', 'Qd']), /5–7/);
  assert.throws(() => rankHand(['As', 'As', 'Ks', 'Qd', 'Jh']), /trùng/);
  assert.throws(() => rankHand(['As', 'Ad', 'Ks', 'Qd', '1h']), /không hợp lệ/);
});
