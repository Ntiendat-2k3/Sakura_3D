import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BLUFF_RANKS, BLUFF_SEATS, BLUFF_TIMING, createEmptyBluffTable, isBluffTruthful, type BluffCard } from '@metaverse/game-protocol';
import { createKohakuBluff } from '../src/systems/kohakuBluff';
import { syncBluffSchema } from '../src/systems/syncBluffSchema';
import { BluffTableSchema } from '../src/state/city.state';

/** LCG có seed để chia bài xác định. */
function lcg(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

type SetupOpts = { standUpCallsLeave?: boolean; firstRng?: number[] };

/** firstRng: các giá trị rng đầu tiên (bullet từng người, rồi người đi đầu) để ép vị trí đạn; sau đó dùng LCG. */
function setup(n: number, seed = 7, opts: SetupOpts = {}) {
  const table = createEmptyBluffTable();
  const ids = ['a', 'b', 'c', 'd'].slice(0, n);
  const seated = ids.map((sessionId, i) => ({ sessionId, seatId: BLUFF_SEATS[i] }));
  const hands = new Map<string, BluffCard[]>(), standUps: string[] = [];
  const handCalls = new Map<string, number>();
  const queue = [...(opts.firstRng ?? [])], base = lcg(seed);
  const clock = { now: 0 };
  const engine = createKohakuBluff(table, {
    seated: () => seated,
    sendHand: (id, cards) => { hands.set(id, cards); handCalls.set(id, (handCalls.get(id) ?? 0) + 1); },
    standUp: id => { standUps.push(id); if (opts.standUpCallsLeave) engine.leave(id, clock.now); },
    rng: () => (queue.length ? queue.shift()! : base()),
  });
  const seatOfSession = (id: string) => BLUFF_SEATS[ids.indexOf(id)];
  const sessionAt = (seatId: string) => ids[BLUFF_SEATS.indexOf(seatId)];
  return { table, engine, hands, standUps, handCalls, clock, ids, seatOfSession, sessionAt };
}

function startAll(ctx: ReturnType<typeof setup>, now = 0) {
  ctx.engine.tick(now);
  for (const id of ctx.ids) ctx.engine.ready(id, true, now);
}

type Rank = 'K' | 'Q' | 'A';

test('2 người cùng sẵn sàng thì bắt đầu ngay, mỗi người nhận 5 lá riêng, bàn không chứa mặt bài', () => {
  const ctx = setup(2);
  startAll(ctx);
  assert.equal(ctx.table.phase, 'turn');
  assert.ok((BLUFF_RANKS as readonly string[]).includes(ctx.table.tableRank));
  assert.equal(ctx.hands.get('a')!.length, 5);
  assert.equal(ctx.hands.get('b')!.length, 5);
  const ids = [...ctx.hands.get('a')!, ...ctx.hands.get('b')!].map(c => c.id);
  assert.equal(new Set(ids).size, 10);
  assert.equal(ctx.table.deadline, BLUFF_TIMING.turnMs);
  assert.ok(ctx.table.seats.filter(s => s.inMatch).every(s => s.alive && s.cardCount === 5 && s.pulls === 0));
  const json = JSON.stringify(ctx.table);
  assert.ok(!json.includes('JOKER'));
  for (const c of [...ctx.hands.get('a')!, ...ctx.hands.get('b')!]) assert.ok(!json.includes(`"${c.id}"`));
});

test('đếm ngược 20s: người chưa sẵn sàng bị đứng dậy, ván bắt đầu với người đã sẵn sàng', () => {
  const ctx = setup(3);
  ctx.engine.tick(0);
  ctx.engine.ready('a', true, 0); ctx.engine.ready('b', true, 0);
  assert.equal(ctx.table.deadline, BLUFF_TIMING.readyCountdownMs);
  ctx.engine.tick(19999);
  assert.equal(ctx.table.phase, 'lobby');
  assert.equal(ctx.table.deadline, BLUFF_TIMING.readyCountdownMs);
  ctx.engine.tick(20000);
  assert.deepEqual(ctx.standUps, ['c']);
  assert.equal(ctx.table.phase, 'turn');
  assert.equal(ctx.table.seats.find(s => s.sessionId === 'c')!.inMatch, false);
  assert.equal(ctx.engine.isSeatLocked(), true);
});

test('hết đếm ngược mà chỉ còn 1 người sẵn sàng thì ở lại lobby và deadline về 0', () => {
  const ctx = setup(3);
  ctx.engine.tick(0);
  ctx.engine.ready('a', true, 0);
  ctx.engine.tick(20000);
  assert.equal(ctx.table.phase, 'lobby');
  assert.equal(ctx.table.deadline, 0);
  assert.deepEqual([...ctx.standUps].sort(), ['b', 'c']);
});

test('người rời ghế mất cờ sẵn sàng', () => {
  const ctx = setup(3);
  ctx.engine.tick(0);
  ctx.engine.ready('a', true, 0);
  ctx.engine.leave('a', 10);
  assert.equal(ctx.table.seats.find(s => s.sessionId === 'a')!.ready, false);
});

test('úp bài không hợp lệ bị bỏ qua', () => {
  const ctx = setup(2);
  startAll(ctx);
  const turnId = ctx.sessionAt(ctx.table.turnSeat);
  const otherId = ctx.ids.find(i => i !== turnId)!;
  const hand = ctx.hands.get(turnId)!;
  const before = structuredClone(ctx.table);
  assert.equal(ctx.engine.play(otherId, { cardIds: [ctx.hands.get(otherId)![0].id] }, 5), false);
  assert.equal(ctx.engine.play(turnId, { cardIds: ['nope'] }, 5), false);
  assert.equal(ctx.engine.play(turnId, { cardIds: [hand[0].id, hand[0].id] }, 5), false);
  assert.equal(ctx.engine.play(turnId, { cardIds: hand.slice(0, 4).map(c => c.id) }, 5), false);
  assert.equal(ctx.engine.play(turnId, { cardIds: ['__proto__'] }, 5), false);
  assert.equal(ctx.engine.play(turnId, { cardIds: [ctx.hands.get(otherId)![0].id] }, 5), false);
  assert.equal(ctx.engine.play(turnId, null, 5), false);
  assert.deepEqual(ctx.table, before);
  assert.equal(ctx.engine.handOf(turnId).length, 5);
});

test('úp 2 lá chuyển lượt cho người kế, người đó hô nói dối thì lật đúng các lá vừa úp', () => {
  const ctx = setup(2);
  startAll(ctx);
  const first = ctx.sessionAt(ctx.table.turnSeat), second = ctx.ids.find(i => i !== first)!;
  const played = ctx.hands.get(first)!.slice(0, 2);
  assert.equal(ctx.engine.play(first, { cardIds: played.map(c => c.id) }, 100), true);
  assert.equal(ctx.table.turnSeat, ctx.seatOfSession(second));
  assert.equal(ctx.table.deadline, 100 + BLUFF_TIMING.turnMs);
  assert.deepEqual(ctx.table.lastPlay, { seatId: ctx.seatOfSession(first), count: 2, revealed: [] });
  assert.equal(ctx.table.seats.find(s => s.sessionId === first)!.cardCount, 3);
  assert.equal(ctx.hands.get(first)!.length, 3);
  assert.equal(ctx.engine.callLiar(second, 200), true);
  const faces = played.map(c => c.face);
  assert.deepEqual(ctx.table.lastPlay.revealed, faces);
  assert.equal(ctx.table.phase, 'reveal');
  assert.equal(ctx.table.deadline, 200 + BLUFF_TIMING.revealMs);
  assert.equal(ctx.table.accuserSeat, ctx.seatOfSession(second));
  const truthful = isBluffTruthful(faces, ctx.table.tableRank as Rank);
  assert.equal(ctx.table.shooterSeat, truthful ? ctx.seatOfSession(second) : ctx.seatOfSession(first));
});

test('cả hai nhánh nói dối và nói thật đều chọn đúng người bị bắn', () => {
  let sawLie = false, sawTruth = false;
  for (let seed = 1; seed <= 60 && !(sawLie && sawTruth); seed++) {
    const ctx = setup(2, seed);
    startAll(ctx);
    const first = ctx.sessionAt(ctx.table.turnSeat), second = ctx.ids.find(i => i !== first)!;
    const card = ctx.hands.get(first)![0];
    ctx.engine.play(first, { cardIds: [card.id] }, 0);
    ctx.engine.callLiar(second, 1);
    const truthful = isBluffTruthful([card.face], ctx.table.tableRank as Rank);
    assert.equal(ctx.table.shooterSeat, truthful ? ctx.seatOfSession(second) : ctx.seatOfSession(first));
    if (truthful) sawTruth = true; else sawLie = true;
  }
  assert.ok(sawLie && sawTruth);
});

test('không được hô nói dối khi vòng chưa có ai úp', () => {
  const ctx = setup(2);
  startAll(ctx);
  const first = ctx.sessionAt(ctx.table.turnSeat);
  assert.equal(ctx.engine.callLiar(first, 1), false);
  assert.equal(ctx.table.phase, 'turn');
});

/** 3 người úp hết bài: order[2] úp lá cuối nên không còn ai khác có bài và bàn tự lật. */
function autoReveal(seed: number) {
  const ctx = setup(3, seed);
  startAll(ctx);
  const order = [ctx.table.turnSeat];
  for (let i = 0; i < 2; i++) order.push(BLUFF_SEATS[(BLUFF_SEATS.indexOf(order[i]) + 1) % 3]);
  const play = (seatId: string, n: number) => {
    const id = ctx.sessionAt(seatId);
    assert.equal(ctx.table.turnSeat, seatId);
    assert.equal(ctx.engine.play(id, { cardIds: ctx.engine.handOf(id).slice(0, n).map(c => c.id) }, 1), true);
  };
  play(order[0], 3); play(order[1], 3); play(order[2], 3);
  play(order[0], 2); // order[0] hết bài
  assert.equal(ctx.table.seats.find(s => s.seatId === order[0])!.cardCount, 0);
  play(order[1], 2); // order[1] hết bài; lượt kế phải bỏ qua order[0]
  assert.equal(ctx.table.turnSeat, order[2]);
  const last = ctx.engine.handOf(ctx.sessionAt(order[2]));
  const faces = last.map(c => c.face);
  assert.equal(ctx.engine.play(ctx.sessionAt(order[2]), { cardIds: last.map(c => c.id) }, 2), true);
  assert.equal(ctx.table.phase, 'reveal');
  assert.equal(ctx.table.accuserSeat, '');
  assert.deepEqual(ctx.table.lastPlay.revealed, faces);
  return { ctx, order, truthful: isBluffTruthful(faces, ctx.table.tableRank as Rank) };
}

test('người hết bài bị bỏ qua; tự lật: nói thật thì shooterSeat rỗng và chia vòng mới không ai bóp cò, nói dối thì người úp chịu bắn', () => {
  let sawLie = false, sawTruth = false;
  for (let seed = 1; seed <= 200 && !(sawLie && sawTruth); seed++) {
    const { ctx, order, truthful } = autoReveal(seed);
    if (truthful) {
      sawTruth = true;
      assert.equal(ctx.table.shooterSeat, '');
      ctx.engine.tick(2 + BLUFF_TIMING.revealMs);
      assert.equal(ctx.table.phase, 'turn');
      assert.equal(ctx.table.shotResult, '');
      assert.ok(ctx.table.seats.filter(s => s.inMatch).every(s => s.pulls === 0 && s.alive && s.cardCount === 5));
      assert.equal(roundOf(ctx, 'a'), 2); // đã chia vòng thứ hai
    } else {
      sawLie = true;
      assert.equal(ctx.table.shooterSeat, order[2]);
      ctx.engine.tick(2 + BLUFF_TIMING.revealMs);
      assert.equal(ctx.table.phase, 'shooting');
    }
  }
  assert.ok(sawLie && sawTruth);
});

// ---- Task 3: bóp cò, vòng mới, loại, hết giờ, rời bàn, kết thúc ----

type Ctx = ReturnType<typeof setup>;
const rankOf = (ctx: Ctx) => ctx.table.tableRank as Rank;
const roundOf = (ctx: Ctx, id: string) => Number(ctx.hands.get(id)![0].id.split('-')[0]);

/** Tick tới hết hạn của pha hiện tại cho đến khi vào pha mong muốn. */
function toPhase(ctx: Ctx, phase: string) {
  for (let i = 0; i < 6 && ctx.table.phase !== phase; i++) { ctx.clock.now = ctx.table.deadline; ctx.engine.tick(ctx.clock.now); }
  assert.equal(ctx.table.phase, phase);
}

/** Một người úp 1 lá rồi người kế hô nói dối. Có victim thì ép người đó bị bắn (2 người), không thì úp lá đầu. */
function forceShot(ctx: Ctx, victim?: string) {
  const t = ctx.sessionAt(ctx.table.turnSeat);
  const hand = ctx.engine.handOf(t);
  let card = hand[0];
  if (victim) {
    const wantLie = victim === t;
    const found = hand.find(c => isBluffTruthful([c.face], rankOf(ctx)) !== wantLie);
    assert.ok(found, 'seed không có lá phù hợp');
    card = found;
  }
  ctx.engine.play(t, { cardIds: [card.id] }, ctx.clock.now);
  assert.equal(ctx.engine.callLiar(ctx.sessionAt(ctx.table.turnSeat), ctx.clock.now), true);
  if (victim) assert.equal(ctx.table.shooterSeat, ctx.seatOfSession(victim));
  return ctx.table.shooterSeat;
}

test('súng riêng: lần bóp thứ (bullet+1) nổ, các lần trước là cạch; pulls tăng mỗi lần', () => {
  const ctx = setup(2, 7, { firstRng: [2.5 / 6, 5.5 / 6, 0] });
  startAll(ctx);
  const results: string[] = [];
  for (let i = 0; i < 3; i++) {
    forceShot(ctx, 'a');
    toPhase(ctx, 'shooting');
    toPhase(ctx, 'result');
    results.push(ctx.table.shotResult);
    assert.equal(ctx.table.seats[0].pulls, i + 1);
    if (i < 2) toPhase(ctx, 'turn');
  }
  assert.deepEqual(results, ['click', 'click', 'bang']);
  assert.equal(ctx.table.seats[0].alive, false);
});

test('lần bóp thứ 6 chắc chắn nổ', () => {
  const ctx = setup(2, 7, { firstRng: [5.5 / 6, 5.5 / 6, 0] });
  startAll(ctx);
  const results: string[] = [];
  for (let i = 0; i < 6; i++) {
    forceShot(ctx, 'a');
    toPhase(ctx, 'shooting');
    toPhase(ctx, 'result');
    results.push(ctx.table.shotResult);
    if (i < 5) toPhase(ctx, 'turn');
  }
  assert.deepEqual(results, ['click', 'click', 'click', 'click', 'click', 'bang']);
});

test('pha result sau phát nổ kéo dài bangResultMs, trượt (click) chỉ resultMs', () => {
  const ctx = setup(2, 7, { firstRng: [5.5 / 6, 5.5 / 6, 0] }); // bullet 5: 5 lần click rồi mới nổ
  startAll(ctx);
  forceShot(ctx, 'a');
  toPhase(ctx, 'shooting'); toPhase(ctx, 'result');
  assert.equal(ctx.table.shotResult, 'click');
  assert.equal(ctx.table.deadline - ctx.clock.now, BLUFF_TIMING.resultMs);
  const bang = setup(2, 7, { firstRng: [0, 0, 0] }); // bullet 0: lần đầu chắc chắn nổ
  startAll(bang);
  forceShot(bang, 'a');
  toPhase(bang, 'shooting'); toPhase(bang, 'result');
  assert.equal(bang.table.shotResult, 'bang');
  assert.equal(bang.table.deadline - bang.clock.now, BLUFF_TIMING.bangResultMs);
  assert.ok(BLUFF_TIMING.bangResultMs > BLUFF_TIMING.resultMs);
});

test('pha shooting không lộ kết quả', () => {
  const ctx = setup(2, 7, { firstRng: [0, 0, 0] }); // bullet 0: lần đầu chắc chắn nổ
  startAll(ctx);
  forceShot(ctx);
  toPhase(ctx, 'shooting');
  assert.equal(ctx.table.shotResult, '');
  assert.equal(ctx.table.deadline, ctx.clock.now + BLUFF_TIMING.suspenseMs);
  assert.ok(!JSON.stringify(ctx.table).includes('bang'));
  ctx.engine.tick(ctx.table.deadline - 1);
  assert.equal(ctx.table.phase, 'shooting');
  assert.equal(ctx.table.shotResult, '');
  toPhase(ctx, 'result');
  assert.equal(ctx.table.shotResult, 'bang');
});

test('sau mỗi lần bóp cò thì chia lại 5 lá; người vừa sống sót đi trước', () => {
  const ctx = setup(3, 7, { firstRng: [5.5 / 6, 5.5 / 6, 5.5 / 6, 0] });
  startAll(ctx);
  const round0 = roundOf(ctx, 'a');
  const shooter = forceShot(ctx);
  toPhase(ctx, 'shooting'); toPhase(ctx, 'result');
  assert.equal(ctx.table.shotResult, 'click');
  toPhase(ctx, 'turn');
  assert.equal(ctx.table.turnSeat, shooter);
  assert.equal(ctx.table.shotResult, '');
  assert.equal(ctx.table.shooterSeat, '');
  assert.deepEqual(ctx.table.lastPlay, { seatId: '', count: 0, revealed: [] });
  for (const id of ctx.ids) { assert.equal(ctx.hands.get(id)!.length, 5); assert.equal(roundOf(ctx, id), round0 + 1); }
  assert.ok(ctx.table.seats.filter(s => s.inMatch).every(s => s.cardCount === 5));
});

test('bị nổ thì standUp được gọi; còn 1 người là gameOver có winnerSeat, sau 5s về lobby với ready = false', () => {
  const ctx = setup(2, 7, { firstRng: [0, 0, 0] });
  startAll(ctx);
  const shooter = ctx.sessionAt(forceShot(ctx));
  const other = ctx.ids.find(i => i !== shooter)!;
  toPhase(ctx, 'shooting'); toPhase(ctx, 'result');
  assert.deepEqual(ctx.standUps, []); // chỉ đuổi sau khi hết pha result
  toPhase(ctx, 'gameOver');
  assert.deepEqual(ctx.standUps, [shooter]);
  assert.equal(ctx.table.winnerSeat, ctx.seatOfSession(other));
  assert.equal(ctx.table.deadline, ctx.clock.now + BLUFF_TIMING.gameOverMs);
  ctx.engine.tick(ctx.table.deadline - 1);
  assert.equal(ctx.table.phase, 'gameOver');
  ctx.engine.tick(ctx.table.deadline);
  assert.equal(ctx.table.phase, 'lobby');
  assert.ok(ctx.table.seats.every(s => !s.ready && !s.inMatch));
  assert.equal(ctx.engine.handOf(other).length, 0);
  assert.deepEqual(ctx.hands.get(other), []);
  assert.equal(ctx.engine.isSeatLocked(), false);
});

test('3 người, một người bị nổ: ván tiếp tục với 2 người, người đi đầu là người còn sống kế tiếp', () => {
  const ctx = setup(3, 7, { firstRng: [0, 0, 0, 0] });
  startAll(ctx);
  const shooter = forceShot(ctx);
  toPhase(ctx, 'shooting'); toPhase(ctx, 'result');
  toPhase(ctx, 'turn');
  const alive = ctx.table.seats.filter(s => s.alive);
  assert.equal(alive.length, 2);
  assert.equal(ctx.table.turnSeat, BLUFF_SEATS[(BLUFF_SEATS.indexOf(shooter) + 1) % 3]);
  assert.ok(alive.every(s => s.cardCount === 5));
  assert.equal(ctx.table.seats.find(s => s.seatId === shooter)!.cardCount, 0);
});

test('hết 30s lượt thì server tự úp đúng 1 lá', () => {
  const ctx = setup(2);
  startAll(ctx);
  const first = ctx.table.turnSeat;
  ctx.engine.tick(BLUFF_TIMING.turnMs - 1);
  assert.equal(ctx.table.lastPlay.count, 0);
  ctx.engine.tick(BLUFF_TIMING.turnMs);
  assert.equal(ctx.table.lastPlay.count, 1);
  assert.equal(ctx.table.lastPlay.seatId, first);
  assert.equal(ctx.table.seats.find(s => s.seatId === first)!.cardCount, 4);
  assert.equal(ctx.engine.handOf(ctx.sessionAt(first)).length, 4);
  assert.notEqual(ctx.table.turnSeat, first);
  assert.equal(ctx.table.deadline, BLUFF_TIMING.turnMs * 2);
});

for (const phase of ['reveal', 'shooting', 'result'] as const) {
  test(`rời bàn trong pha ${phase}: còn ≥2 người thì chia vòng mới, không ai bị bắn nhầm`, () => {
    const ctx = setup(3, 7, { firstRng: [5.5 / 6, 5.5 / 6, 5.5 / 6, 0] }); // bullet 5: không ai nổ sớm
    startAll(ctx);
    const shooter = forceShot(ctx);
    if (phase !== 'reveal') toPhase(ctx, phase);
    const leaver = ctx.ids.find(id => ctx.seatOfSession(id) !== shooter)!;
    const round0 = roundOf(ctx, ctx.sessionAt(shooter));
    ctx.engine.leave(leaver, ctx.clock.now);
    assert.equal(ctx.table.phase, 'turn');
    assert.equal(roundOf(ctx, ctx.sessionAt(shooter)), round0 + 1);
    assert.equal(ctx.table.shotResult, '');
    assert.equal(ctx.table.seats.find(s => s.sessionId === leaver)!.alive, false);
    const survivors = ctx.table.seats.filter(s => s.alive);
    assert.equal(survivors.length, 2);
    assert.ok(survivors.every(s => s.cardCount === 5));
    assert.deepEqual(ctx.standUps, []);
    // Chưa tới pha result thì người bị tố chưa bị bóp cò; ở result thì lần bóp đã tính.
    assert.ok(survivors.every(s => s.pulls === (phase === 'result' && s.seatId === shooter ? 1 : 0)));
  });
}

test('rời bàn trong pha result khi có người vừa bị nổ: người nổ vẫn bị đuổi, vòng mới chỉ chia một lần', () => {
  const ctx = setup(4, 7, { firstRng: [0, 0, 0, 0, 0], standUpCallsLeave: true });
  startAll(ctx);
  const shooter = forceShot(ctx);
  toPhase(ctx, 'shooting'); toPhase(ctx, 'result');
  const leaver = ctx.ids.find(id => ctx.seatOfSession(id) !== shooter)!;
  const round0 = roundOf(ctx, leaver);
  ctx.engine.leave(leaver, ctx.clock.now);
  assert.deepEqual(ctx.standUps.map(id => ctx.seatOfSession(id)), [shooter]);
  assert.equal(ctx.table.phase, 'turn');
  assert.equal(ctx.table.seats.filter(s => s.alive).length, 2);
  assert.equal(roundOf(ctx, ctx.ids.find(id => ctx.table.seats.find(s => s.sessionId === id)!.alive)!), round0 + 1);
});

test('người còn lại mất kết nối đúng lúc người thắng đang bóp cò: đúng một winner', () => {
  const ctx = setup(2, 7, { firstRng: [0, 0, 0] });
  startAll(ctx);
  const shooter = ctx.sessionAt(forceShot(ctx));
  const other = ctx.ids.find(i => i !== shooter)!;
  toPhase(ctx, 'shooting');
  ctx.engine.leave(other, ctx.clock.now);
  assert.equal(ctx.table.phase, 'gameOver');
  assert.equal(ctx.table.winnerSeat, ctx.seatOfSession(shooter));
  assert.equal(ctx.table.shotResult, '');
  assert.equal(ctx.table.seats.find(s => s.sessionId === shooter)!.pulls, 0);
  ctx.engine.leave(other, ctx.clock.now); // lặp lại không đổi gì
  assert.equal(ctx.table.winnerSeat, ctx.seatOfSession(shooter));
});

test('người bị nổ ở pha result và người còn lại cùng rời: về lobby, không có winner treo', () => {
  const ctx = setup(2, 7, { firstRng: [0, 0, 0] });
  startAll(ctx);
  const shooter = ctx.sessionAt(forceShot(ctx));
  toPhase(ctx, 'shooting'); toPhase(ctx, 'result');
  ctx.engine.leave(ctx.ids.find(i => i !== shooter)!, ctx.clock.now);
  assert.equal(ctx.table.phase, 'lobby');
  assert.equal(ctx.table.winnerSeat, '');
  assert.ok(ctx.table.seats.every(s => !s.inMatch && !s.alive));
  assert.deepEqual(ctx.standUps, [shooter]); // người nổ vẫn phải bị đuổi khỏi ghế
});

test('3 người: một người nổ ở pha result, một người rời: gameOver đúng một winner và người nổ bị đuổi', () => {
  const ctx = setup(3, 7, { firstRng: [0, 0, 0, 0] });
  startAll(ctx);
  const shooter = forceShot(ctx);
  toPhase(ctx, 'shooting'); toPhase(ctx, 'result');
  const others = ctx.ids.filter(id => ctx.seatOfSession(id) !== shooter);
  ctx.engine.leave(others[0], ctx.clock.now);
  assert.equal(ctx.table.phase, 'gameOver');
  assert.equal(ctx.table.winnerSeat, ctx.seatOfSession(others[1]));
  assert.deepEqual(ctx.standUps.map(id => ctx.seatOfSession(id)), [shooter]);
});

test('standUp gọi ngược leave cho người vừa bị loại thì không chia vòng lần hai', () => {
  const ctx = setup(3, 7, { firstRng: [0, 0, 0, 0], standUpCallsLeave: true });
  startAll(ctx);
  const shooter = forceShot(ctx);
  const round0 = roundOf(ctx, 'a');
  const calls0 = new Map(ctx.handCalls);
  toPhase(ctx, 'shooting'); toPhase(ctx, 'result');
  toPhase(ctx, 'turn');
  assert.equal(ctx.standUps.length, 1);
  assert.equal(ctx.table.seats.find(s => s.seatId === shooter)!.alive, false);
  for (const seat of ctx.table.seats.filter(s => s.alive)) {
    assert.equal(roundOf(ctx, seat.sessionId), round0 + 1);
    assert.equal(ctx.handCalls.get(seat.sessionId), calls0.get(seat.sessionId)! + 1);
  }
});

test('syncBluffSchema chép view vào schema và làm rỗng revealed ở lần sync sau', () => {
  const view = createEmptyBluffTable();
  Object.assign(view, { phase: 'reveal', tableRank: 'K', turnSeat: BLUFF_SEATS[1], deadline: 123, accuserSeat: BLUFF_SEATS[1], shooterSeat: BLUFF_SEATS[0], winnerSeat: '' });
  view.lastPlay = { seatId: BLUFF_SEATS[0], count: 2, revealed: ['K', 'JOKER'] };
  view.seats[0] = { seatId: BLUFF_SEATS[0], sessionId: 'a', ready: true, inMatch: true, alive: true, cardCount: 3, pulls: 2 };
  const schema = new BluffTableSchema();
  syncBluffSchema(schema, view);
  const json = schema.toJSON() as any;
  assert.equal(json.phase, 'reveal');
  assert.equal(json.tableRank, 'K');
  assert.equal(json.deadline, 123);
  assert.equal(json.lastPlaySeat, BLUFF_SEATS[0]);
  assert.equal(json.lastPlayCount, 2);
  assert.deepEqual(json.revealed, ['K', 'JOKER']);
  assert.equal(json.seats.length, 4);
  assert.deepEqual(json.seats.map((s: any) => s.seatId), [...BLUFF_SEATS]);
  assert.deepEqual(json.seats[0], { seatId: BLUFF_SEATS[0], sessionId: 'a', ready: true, inMatch: true, alive: true, cardCount: 3, pulls: 2 });

  syncBluffSchema(schema, createEmptyBluffTable());
  assert.equal(schema.revealed.length, 0);
  assert.equal(schema.phase, 'lobby');
  assert.equal(schema.seats[0].alive, false);
  assert.equal(schema.lastPlaySeat, '');
});

// ---- Cà khịa ----
const flipAt = (ctx: Ctx, from: string, to: string, now: number) => ctx.engine.taunt(from, { kind: 'flip', targetSeat: ctx.seatOfSession(to) }, now);

test('taunt hợp lệ ở pha turn, kể cả người đang tới lượt; không đổi bàn', () => {
  const ctx = setup(2);
  startAll(ctx);
  const before = JSON.stringify(ctx.table);
  const turn = ctx.sessionAt(ctx.table.turnSeat), other = turn === 'a' ? 'b' : 'a';
  assert.deepEqual(flipAt(ctx, turn, other, 0), { seatId: ctx.seatOfSession(turn), kind: 'flip', targetSeat: ctx.seatOfSession(other) });
  assert.deepEqual(flipAt(ctx, other, turn, 0), { seatId: ctx.seatOfSession(other), kind: 'flip', targetSeat: ctx.seatOfSession(turn) });
  assert.equal(JSON.stringify(ctx.table), before);
});

test('taunt bị chặn: cooldown 3s', () => {
  const ctx = setup(2);
  startAll(ctx);
  assert.ok(flipAt(ctx, 'a', 'b', 0));
  assert.equal(flipAt(ctx, 'a', 'b', BLUFF_TIMING.tauntCooldownMs - 1), null);
  assert.ok(flipAt(ctx, 'a', 'b', BLUFF_TIMING.tauntCooldownMs));
});

test('taunt bị chặn: lobby, tự nhắm mình, đích không trong ván, payload sai', () => {
  const ctx = setup(2);
  ctx.engine.tick(0);
  assert.equal(flipAt(ctx, 'a', 'b', 0), null); // lobby
  startAll(ctx);
  assert.equal(flipAt(ctx, 'a', 'a', 0), null);
  assert.equal(ctx.engine.taunt('a', { kind: 'flip', targetSeat: BLUFF_SEATS[2] }, 0), null);
  assert.equal(ctx.engine.taunt('a', { kind: 'kiss', targetSeat: ctx.seatOfSession('b') }, 0), null);
  assert.equal(ctx.engine.taunt('zzz', { kind: 'flip', targetSeat: ctx.seatOfSession('b') }, 0), null);
});

test('taunt bị chặn với người đã chết và nhắm vào người đã chết; gameOver cũng chặn', () => {
  const ctx = setup(3, 7, { firstRng: [0, 0, 0, 0] }); // đạn ở ngăn đầu: ai bị bắn cũng nổ
  startAll(ctx);
  const shooterSeat = forceShot(ctx);
  toPhase(ctx, 'result');
  toPhase(ctx, 'turn');
  const dead = ctx.sessionAt(shooterSeat);
  const alive = ctx.ids.filter(id => id !== dead);
  assert.equal(flipAt(ctx, dead, alive[0], ctx.clock.now), null);
  assert.equal(flipAt(ctx, alive[0], dead, ctx.clock.now), null);
  assert.ok(flipAt(ctx, alive[0], alive[1], ctx.clock.now));
  forceShot(ctx);
  toPhase(ctx, 'gameOver');
  const [x, y] = ctx.ids;
  assert.equal(flipAt(ctx, x, y, ctx.clock.now + 10000), null);
});

test('taunt ở reveal được kể cả người sắp bị bắn; shooting/result chặn người cầm súng', () => {
  const ctx = setup(2, 7, { firstRng: [5.5 / 6, 5.5 / 6, 0] });
  startAll(ctx);
  const shooter = ctx.sessionAt(forceShot(ctx, 'a'));
  const other = shooter === 'a' ? 'b' : 'a';
  let now = 0;
  assert.equal(ctx.table.phase, 'reveal');
  assert.ok(flipAt(ctx, shooter, other, now));
  assert.ok(flipAt(ctx, other, shooter, now));
  for (const phase of ['shooting', 'result']) {
    toPhase(ctx, phase);
    now += BLUFF_TIMING.tauntCooldownMs;
    assert.equal(flipAt(ctx, shooter, other, now), null, phase);
    assert.ok(flipAt(ctx, other, shooter, now), phase);
  }
});
