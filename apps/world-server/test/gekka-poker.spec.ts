import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BLUFF_TIMING, GEKKA_EXECUTIONER_RETURN_MS, POKER_SEATS, POKER_TIMING, createEmptyPokerTable, planGekkaEscort,
  type GekkaEscortPose, type PokerCard,
} from '@metaverse/game-protocol';
import { createGekkaPoker } from '../src/systems/gekkaPoker';

function setup(count = 2) {
  const table = createEmptyPokerTable();
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'].slice(0, count);
  let seated = ids.map((sessionId, index) => ({ sessionId, seatId: POKER_SEATS[index] }));
  const holeCalls: { sessionId: string; cards: PokerCard[] }[] = [];
  const standUps: string[] = [];
  const captures: { sessionId: string; slot: string }[] = [];
  const releases: { sessionId: string; to: 'table' | 'exit'; seatId: string }[] = [];
  const escorts: { sessionId: string; pose: GekkaEscortPose }[] = [];
  const engine = createGekkaPoker(table, {
    seated: () => seated,
    sendHole: (sessionId, cards) => { holeCalls.push({ sessionId, cards }); },
    standUp: sessionId => { standUps.push(sessionId); seated = seated.filter(entry => entry.sessionId !== sessionId); },
    capture: (sessionId, slot) => {
      captures.push({ sessionId, slot });
      seated = seated.filter(entry => entry.sessionId !== sessionId);
    },
    escort: (sessionId, pose) => {
      escorts.push({ sessionId, pose });
      seated = seated.filter(entry => entry.sessionId !== sessionId);
    },
    release: (sessionId, to, seatId) => {
      releases.push({ sessionId, to, seatId });
      if (to === 'table') seated.push({ sessionId, seatId });
    },
    rng: () => 0,
  });
  engine.tick(0);
  for (const id of ids) engine.ready(id, true, 0);
  return { table, ids, engine, holeCalls, standUps, captures, releases, escorts };
}

function sessionAt(ctx: ReturnType<typeof setup>, seatId: string): string {
  return ctx.table.seats.find(seat => seat.seatId === seatId)?.sessionId ?? '';
}

function allInThree(ctx: ReturnType<typeof setup>) {
  ctx.table.seats[0].chips = 100;
  ctx.table.seats[1].chips = 90;
  ctx.table.seats[2].chips = 80;
  assert.equal(ctx.engine.act('a', { action: 'allin' }, 1), true);
  assert.equal(ctx.engine.act('b', { action: 'allin' }, 2), true);
  assert.equal(ctx.engine.act('c', { action: 'allin' }, 3), true);
}

function finishPunches(ctx: ReturnType<typeof setup>) {
  if (ctx.table.phase === 'showdown') closeShowdown(ctx);
  let now = ctx.table.dungeon.deadline;
  ctx.engine.tick(now);
  assert.equal(ctx.table.dungeon.phase, 'punching');
  const total = ctx.table.dungeon.punchesTotal;
  for (let punch = 1; punch <= total; punch++) {
    now += punch > total - 2 ? POKER_TIMING.finalPunchIntervalMs : POKER_TIMING.punchIntervalMs;
    ctx.engine.tick(now);
    assert.equal(ctx.table.dungeon.punchesDone, punch);
  }
  return now;
}

/** Mốc đao phủ lôi xong đoàn hiện tại xuống hầm (server trói người ở tick này). */
function escortEnd(ctx: ReturnType<typeof setup>) {
  return ctx.table.escort.startedAt + Math.ceil(planGekkaEscort(ctx.table.escort.route).duration * 1000);
}

/** Hết showdown: đao phủ lôi người thua sạch xuống hầm rồi trói. */
function closeShowdown(ctx: ReturnType<typeof setup>) {
  assert.equal(ctx.table.phase, 'showdown');
  ctx.engine.tick(ctx.table.deadline);
  if (ctx.table.escort.startedAt) ctx.engine.tick(escortEnd(ctx));
}

function allInTwo(ctx: ReturnType<typeof setup>) {
  assert.equal(ctx.engine.act('a', { action: 'allin' }, 1), true);
  assert.equal(ctx.engine.act('b', { action: 'call' }, 2), true);
  return ctx.table.seats.find(seat => seat.chips === 0)!;
}

test('showdown hiển thị đủ thời gian rồi mới bắt người thua sạch', () => {
  const ctx = setup();
  const busted = allInTwo(ctx);
  const deadline = ctx.table.deadline;
  assert.equal(deadline, 2 + POKER_TIMING.showdownMs);
  assert.equal(ctx.table.phase, 'showdown');
  assert.equal(busted.captive, 'none');
  assert.equal(ctx.table.dungeon.phase, 'idle');
  assert.deepEqual(ctx.captures, []);
  ctx.engine.tick(deadline - 1);
  assert.equal(busted.captive, 'none');
  assert.deepEqual(ctx.captures, []);
  ctx.engine.tick(deadline);
  assert.equal(busted.captive, 'queued');
  assert.deepEqual(ctx.table.escort, { route: [busted.seatId], startedAt: deadline });
  assert.deepEqual(ctx.captures, [], 'chưa trói khi đao phủ còn đang đi tới bàn');
  ctx.engine.tick(escortEnd(ctx));
  assert.equal(busted.captive, 'post');
  assert.deepEqual(ctx.table.escort, { route: [], startedAt: 0 });
  assert.deepEqual(ctx.captures, [{ sessionId: busted.sessionId, slot: 'gekka-post' }]);
});

test('đao phủ túm rồi dắt người thua sạch theo lộ trình; người đó không tự đứng dậy được', () => {
  const ctx = setup();
  const busted = allInTwo(ctx);
  const start = ctx.table.deadline;
  ctx.engine.tick(start);
  const plan = planGekkaEscort(ctx.table.escort.route);
  const grabbedAt = start + Math.ceil(plan.stops[0].releasedAt * 1000);
  ctx.engine.tick(grabbedAt - 50);
  assert.deepEqual(ctx.escorts, [], 'còn ngồi ở ghế khi đao phủ đang túm');
  assert.equal(ctx.engine.isCaptive(busted.sessionId), true);
  ctx.engine.tick(grabbedAt + 3000);
  const last = ctx.escorts.at(-1)!;
  assert.equal(last.sessionId, busted.sessionId);
  assert.ok(Number.isFinite(last.pose.x) && last.pose.y <= 0);
  ctx.engine.tick(escortEnd(ctx) - 1);
  assert.ok(ctx.escorts.at(-1)!.pose.y < -3, 'đã xuống tới hầm');
});

test('người thua khi hầm đang bận chờ ở bàn tới lúc khung trống và đao phủ về chỗ canh', () => {
  const ctx = setup(3);
  ctx.table.seats[0].chips = 100;
  assert.equal(ctx.engine.act('a', { action: 'allin' }, 1), true);
  assert.equal(ctx.engine.act('b', { action: 'call' }, 2), true);
  assert.equal(ctx.engine.act('c', { action: 'call' }, 3), true);
  while (ctx.table.phase === 'betting') ctx.engine.act(sessionAt(ctx, ctx.table.turnSeat), { action: 'check' }, 4 + ctx.table.board.length);
  closeShowdown(ctx);
  const first = ctx.table.seats[0];
  assert.equal(first.captive, 'post');
  // Ván kế: b thua sạch trong lúc a còn trên khung.
  const second = ctx.table.seats.find(seat => seat.sessionId === 'b')!;
  let now = escortEnd(ctx) + 10;
  second.chips = 50;
  while (ctx.table.phase === 'betting') {
    const seat = ctx.table.seats.find(entry => entry.seatId === ctx.table.turnSeat)!;
    ctx.engine.act(seat.sessionId, { action: seat.sessionId === 'b' ? 'allin' : seat.bet < ctx.table.currentBet ? 'call' : 'check' }, now++);
  }
  assert.equal(second.chips, 0, "b phải thua sạch ở ván này");
  ctx.engine.tick(ctx.table.deadline);
  assert.equal(second.captive, 'queued');
  assert.equal(ctx.table.escort.startedAt, 0, 'đao phủ đang bận ở hầm');
  now = finishPunches(ctx);
  assert.equal(ctx.engine.choose('a', { choice: 'leave' }, now + 1), true);
  ctx.engine.tick(now + 1 + GEKKA_EXECUTIONER_RETURN_MS - 1);
  assert.equal(ctx.table.escort.startedAt, 0, 'đao phủ còn đang đi về');
  ctx.engine.tick(now + 1 + GEKKA_EXECUTIONER_RETURN_MS);
  assert.deepEqual(ctx.table.escort.route, [second.seatId]);
});

test('người bị lôi thoát phòng giữa đường thì hủy cảnh lôi, bàn không kẹt', () => {
  const ctx = setup(3);
  allInThree(ctx);
  ctx.engine.tick(ctx.table.deadline);
  const route = [...ctx.table.escort.route];
  assert.equal(route.length, 2);
  for (const seatId of route) ctx.engine.leave(sessionAt(ctx, seatId), ctx.table.escort.startedAt + 5000);
  ctx.engine.tick(ctx.table.escort.startedAt + 5050);
  assert.deepEqual(ctx.table.escort, { route: [], startedAt: 0 });
  assert.equal(ctx.table.phase, 'gameOver');
});

test('hai người sẵn sàng nhận chip, blind và bài tẩy riêng', () => {
  const ctx = setup();
  assert.equal(ctx.table.phase, 'betting');
  assert.equal(ctx.table.street, 'preflop');
  assert.equal(ctx.table.handNumber, 1);
  assert.equal(ctx.table.pot, 30);
  assert.deepEqual(ctx.table.seats.slice(0, 2).map(seat => seat.chips), [990, 980]);
  assert.equal(ctx.holeCalls.length, 2);
  const cards = ctx.ids.flatMap(id => ctx.engine.holeOf(id));
  assert.equal(cards.length, 4);
  assert.equal(new Set(cards).size, 4);
  assert.equal(ctx.table.deadline, POKER_TIMING.turnMs);
});

test('heads-up: nút đặt small blind, đi trước preflop; người còn lại đi trước postflop', () => {
  const ctx = setup();
  assert.equal(ctx.table.buttonSeat, POKER_SEATS[0]);
  assert.equal(ctx.table.turnSeat, POKER_SEATS[0]);
  assert.equal(ctx.engine.act('a', { action: 'call' }, 1), true);
  assert.equal(ctx.engine.act('b', { action: 'check' }, 2), true);
  assert.equal(ctx.table.street, 'flop');
  assert.equal(ctx.table.board.length, 3);
  assert.equal(ctx.table.turnSeat, POKER_SEATS[1]);
});

test('ba người: sau big blind đi trước; flop check hết thì mở turn', () => {
  const ctx = setup(3);
  assert.equal(ctx.table.turnSeat, POKER_SEATS[0]);
  assert.equal(ctx.engine.act('a', { action: 'call' }, 1), true);
  assert.equal(ctx.engine.act('b', { action: 'call' }, 2), true);
  assert.equal(ctx.engine.act('c', { action: 'check' }, 3), true);
  assert.equal(ctx.table.street, 'flop');
  assert.equal(ctx.table.turnSeat, POKER_SEATS[1]);
  assert.equal(ctx.engine.act('b', { action: 'check' }, 4), true);
  assert.equal(ctx.engine.act('c', { action: 'check' }, 5), true);
  assert.equal(ctx.engine.act('a', { action: 'check' }, 6), true);
  assert.equal(ctx.table.street, 'turn');
  assert.equal(ctx.table.board.length, 4);
});

test('server từ chối sai lượt, check sai, raise dưới mức hoặc vượt chip mà không đổi bàn', () => {
  const ctx = setup();
  for (const [id, input] of [
    ['b', { action: 'check' }], ['a', { action: 'check' }],
    ['a', { action: 'raise', amount: 30 }], ['a', { action: 'raise', amount: 1001 }],
    ['a', { action: 'raise', amount: -1 }],
  ] as const) {
    const before = JSON.stringify(ctx.table);
    assert.equal(ctx.engine.act(id, input, 1), false);
    assert.equal(JSON.stringify(ctx.table), before);
  }
  assert.equal(ctx.engine.act('a', { action: 'fold' }, 2), true);
  assert.equal(ctx.engine.act('a', { action: 'call' }, 3), false);
});

test('all-in ngắn bắt người đã tố theo thêm nhưng không mở lại quyền raise', () => {
  const ctx = setup();
  assert.equal(ctx.engine.act('a', { action: 'raise', amount: 100 }, 1), true);
  ctx.table.seats[1].chips = 130;
  assert.equal(ctx.engine.act('b', { action: 'allin' }, 2), true);
  assert.equal(ctx.table.currentBet, 150);
  assert.equal(ctx.table.turnSeat, POKER_SEATS[0]);
  assert.equal(ctx.engine.act('a', { action: 'raise', amount: 300 }, 3), false);
  assert.equal(ctx.engine.act('a', { action: 'allin' }, 3), false);
  assert.equal(ctx.engine.act('a', { action: 'call' }, 4), true);
});

test('hai all-in ngắn cộng dồn đủ mức tố trước thì mở lại quyền raise', () => {
  const ctx = setup(4);
  assert.equal(ctx.table.turnSeat, POKER_SEATS[3]);
  assert.equal(ctx.engine.act('d', { action: 'call' }, 1), true);
  assert.equal(ctx.engine.act('a', { action: 'raise', amount: 100 }, 2), true);
  ctx.table.seats[1].chips = 140;
  ctx.table.seats[2].chips = 180;
  assert.equal(ctx.engine.act('b', { action: 'allin' }, 3), true);
  assert.equal(ctx.engine.act('c', { action: 'allin' }, 4), true);
  assert.equal(ctx.table.currentBet, 200);
  assert.equal(ctx.table.minRaise, 80);
  assert.equal(ctx.engine.act('d', { action: 'call' }, 5), true);
  assert.equal(ctx.table.turnSeat, POKER_SEATS[0]);
  assert.equal(ctx.engine.act('a', { action: 'raise', amount: 280 }, 6), true);
  assert.equal(ctx.table.currentBet, 280);
});

test('hết giờ tự fold khi nợ cược và tự check khi không nợ', () => {
  const first = setup();
  first.engine.tick(POKER_TIMING.turnMs);
  assert.equal(first.table.phase, 'showdown');
  assert.equal(first.table.seats[0].folded, true);
  const second = setup();
  assert.equal(second.engine.act('a', { action: 'call' }, 1), true);
  second.engine.tick(1 + POKER_TIMING.turnMs);
  assert.equal(second.table.street, 'flop');
  assert.equal(second.table.board.length, 3);
});

test('gói hành động đến đúng hạn hoặc trễ bị từ chối và hết lượt xử lý một lần', () => {
  const ctx = setup();
  assert.equal(ctx.engine.act('a', { action: 'call' }, POKER_TIMING.turnMs), false);
  assert.equal(ctx.table.seats[0].folded, true);
  assert.equal(ctx.table.phase, 'showdown');
  const after = JSON.stringify(ctx.table);
  ctx.engine.tick(POKER_TIMING.turnMs + 1);
  assert.equal(JSON.stringify(ctx.table), after);
});

test('mọi người khác fold: người cuối nhận pot, không lật bài tẩy', () => {
  const ctx = setup();
  assert.equal(ctx.engine.act('a', { action: 'fold' }, 1), true);
  assert.equal(ctx.table.phase, 'showdown');
  assert.deepEqual(ctx.table.showdown, []);
  assert.equal(ctx.table.seats[1].chips, 1010);
  assert.equal(ctx.engine.holeOf('a').length, 0);
  assert.equal(ctx.engine.holeOf('b').length, 0);
  assert.equal(ctx.holeCalls.filter(call => call.cards.length === 0).length, 2);
});

test('hai người all-in preflop: lật năm lá, so bài và bảo toàn chip', () => {
  const ctx = setup();
  assert.equal(ctx.engine.act('a', { action: 'allin' }, 1), true);
  assert.equal(ctx.engine.act('b', { action: 'call' }, 2), true);
  assert.equal(ctx.table.phase, 'showdown');
  assert.equal(ctx.table.board.length, 5);
  assert.equal(ctx.table.showdown.length, 2);
  assert.ok(ctx.table.showdown.every(entry => entry.cards.length === 2 && entry.label));
  assert.equal(ctx.table.seats.slice(0, 2).reduce((sum, seat) => sum + seat.chips, 0), 2000);
});

test('ba mức góp chip khác nhau qua engine vẫn bảo toàn tổng chip', () => {
  const ctx = setup(3);
  ctx.table.seats[0].chips = 100;
  ctx.table.seats[1].chips = 190;
  const total = ctx.table.pot + ctx.table.seats.slice(0, 3).reduce((sum, seat) => sum + seat.chips, 0);
  assert.equal(ctx.engine.act('a', { action: 'allin' }, 1), true);
  assert.equal(ctx.engine.act('b', { action: 'allin' }, 2), true);
  assert.equal(ctx.engine.act('c', { action: 'call' }, 3), true);
  assert.equal(ctx.table.phase, 'showdown');
  assert.equal(ctx.table.pot, 500);
  assert.equal(ctx.table.seats.slice(0, 3).reduce((sum, seat) => sum + seat.chips, 0), total);
  assert.equal(ctx.table.showdown.reduce((sum, entry) => sum + entry.won, 0), 500);
});

test('đếm ngược lobby không khởi động trận khi còn một người sẵn sàng', () => {
  const table = createEmptyPokerTable();
  const seated = [{ sessionId: 'a', seatId: POKER_SEATS[0] }, { sessionId: 'b', seatId: POKER_SEATS[1] }];
  const standUps: string[] = [];
  const engine = createGekkaPoker(table, {
    seated: () => seated,
    sendHole: () => {},
    standUp: id => { standUps.push(id); seated.splice(seated.findIndex(entry => entry.sessionId === id), 1); },
    capture: () => {}, escort: () => {}, release: () => {}, rng: () => 0,
  });
  engine.tick(0);
  engine.ready('a', true, 0);
  assert.equal(table.deadline, POKER_TIMING.readyCountdownMs);
  engine.tick(POKER_TIMING.readyCountdownMs);
  assert.equal(table.phase, 'lobby');
  assert.equal(table.deadline, 0);
  assert.deepEqual(standUps, ['b']);
});

test('blind tăng ở ván 11', () => {
  const ctx = setup();
  let now = 0;
  while (ctx.table.handNumber < 11) {
    assert.equal(ctx.engine.act(sessionAt(ctx, ctx.table.turnSeat), { action: 'fold' }, now), true);
    now += POKER_TIMING.showdownMs;
    ctx.engine.tick(now);
  }
  assert.equal(ctx.table.smallBlind, 20);
  assert.equal(ctx.table.bigBlind, 40);
});

test('bàn công khai không chứa bài tẩy trước showdown', () => {
  const ctx = setup();
  const json = JSON.stringify(ctx.table);
  for (const id of ctx.ids) for (const card of ctx.engine.holeOf(id)) assert.equal(json.includes(`"${card}"`), false);
});

test('rời giữa lượt xem như fold; khi chỉ còn một người thì kết thúc trận', () => {
  const ctx = setup(3);
  ctx.engine.leave('a', 1);
  assert.equal(ctx.table.seats[0].folded, true);
  assert.equal(ctx.table.turnSeat, POKER_SEATS[1]);
  ctx.engine.leave('b', 2);
  assert.equal(ctx.table.phase, 'gameOver');
  assert.equal(ctx.table.winnerSeat, POKER_SEATS[2]);
});

test('người thua sạch lên cột, nhận đúng năm cú đấm rồi được chọn vay', () => {
  const ctx = setup();
  const busted = allInTwo(ctx);
  closeShowdown(ctx);
  assert.equal(busted.captive, 'post');
  assert.equal(ctx.engine.isCaptive(busted.sessionId), true);
  assert.deepEqual(ctx.captures[0], { sessionId: busted.sessionId, slot: 'gekka-post' });
  assert.equal(ctx.table.dungeon.punchesTotal, 5);
  const now = finishPunches(ctx);
  assert.equal(ctx.table.dungeon.phase, 'choice');
  assert.equal(ctx.table.dungeon.canBorrow, true);
  assert.equal(ctx.table.dungeon.deadline, now + POKER_TIMING.choiceMs);
});

test('người ở hầm còn quyền vay giữ bàn ở waiting; vay vào lại ván sau', () => {
  const ctx = setup();
  const busted = allInTwo(ctx);
  const now = finishPunches(ctx);
  assert.equal(ctx.table.phase, 'waiting');
  assert.equal(ctx.table.winnerSeat, '');
  assert.equal(ctx.engine.choose(busted.sessionId, { choice: 'borrow' }, now + 1), true);
  assert.equal(busted.chips + busted.committed, 1000, 'chip vay đã được cấp rồi trừ blind ván kế');
  assert.equal(busted.debt, 1);
  assert.equal(busted.captive, 'none');
  assert.deepEqual(ctx.releases.at(-1), { sessionId: busted.sessionId, to: 'table', seatId: busted.seatId });
  assert.equal(ctx.table.phase, 'betting');
  assert.equal(ctx.table.handNumber, 2);
});

test('hết hạn chọn hoặc rời bàn ở hầm giải phóng ghế và công bố người thắng', () => {
  const ctx = setup();
  const busted = allInTwo(ctx);
  const sessionId = busted.sessionId;
  const now = finishPunches(ctx);
  ctx.engine.tick(now + POKER_TIMING.choiceMs);
  assert.equal(busted.out, true);
  assert.equal(ctx.engine.isCaptive(busted.sessionId), false);
  assert.deepEqual(ctx.releases.at(-1), { sessionId, to: 'exit', seatId: busted.seatId });
  assert.ok(ctx.standUps.includes(sessionId));
  assert.equal(ctx.table.phase, 'gameOver');
  assert.notEqual(ctx.table.winnerSeat, busted.seatId);
});

test('gói Vay đến đúng hạn chọn bị từ chối và tính là rời bàn', () => {
  const ctx = setup();
  const busted = allInTwo(ctx);
  finishPunches(ctx);
  assert.equal(ctx.engine.choose(busted.sessionId, { choice: 'borrow' }, ctx.table.dungeon.deadline), false);
  assert.equal(busted.out, true);
  assert.equal(busted.debt, 0);
});

test('hai người thua sạch cùng ván xếp hàng theo ghế từ trái nút', () => {
  const ctx = setup(3);
  allInThree(ctx);
  const busted = ctx.table.seats.filter(seat => seat.inMatch && seat.chips === 0);
  assert.equal(busted.length, 2);
  closeShowdown(ctx);
  assert.deepEqual(ctx.captures.map(call => call.slot), ['gekka-post', 'gekka-cell-1']);
  const first = ctx.table.dungeon.seatId;
  const buttonIndex = ctx.table.seats.findIndex(seat => seat.seatId === ctx.table.buttonSeat);
  const expected = Array.from({ length: ctx.table.seats.length }, (_, offset) =>
    ctx.table.seats[(buttonIndex + offset + 1) % ctx.table.seats.length])
    .filter(seat => busted.includes(seat)).map(seat => seat.seatId);
  const second = busted.find(seat => seat.seatId !== first)!;
  assert.deepEqual([first, second.seatId], expected);
  assert.equal(second.captive, 'queued');
  const now = finishPunches(ctx);
  assert.equal(ctx.engine.choose(sessionAt(ctx, first), { choice: 'leave' }, now + 1), true);
  assert.equal(ctx.table.dungeon.seatId, second.seatId);
  assert.equal(second.captive, 'post');
  assert.deepEqual(ctx.captures.at(-1), { sessionId: second.sessionId, slot: 'gekka-post' });
});

test('người đang bị trói thoát phòng thì người chờ lên cột, bàn không kẹt', () => {
  const ctx = setup(3);
  allInThree(ctx);
  closeShowdown(ctx);
  const first = ctx.table.dungeon.seatId;
  const second = ctx.table.seats.find(seat => seat.captive === 'queued')!;
  ctx.engine.leave(sessionAt(ctx, first), 4);
  assert.equal(ctx.table.dungeon.seatId, second.seatId);
  ctx.engine.leave(second.sessionId, 5);
  assert.equal(ctx.table.phase, 'gameOver');
  assert.ok(ctx.table.winnerSeat);
});

test('khi còn hai người có chip, ván mới bỏ qua ghế của người đang ở hầm', () => {
  const ctx = setup(4);
  assert.equal(ctx.engine.act('d', { action: 'call' }, 1), true);
  ctx.table.seats[0].chips = 100;
  assert.equal(ctx.engine.act('a', { action: 'allin' }, 2), true);
  for (const [id, now] of [['b', 3], ['c', 4], ['d', 5]] as const) assert.equal(ctx.engine.act(id, { action: 'call' }, now), true);
  while (ctx.table.phase === 'betting') {
    const id = sessionAt(ctx, ctx.table.turnSeat);
    assert.equal(ctx.engine.act(id, { action: 'check' }, 6 + ctx.table.board.length), true);
  }
  closeShowdown(ctx);
  const captive = ctx.table.seats.find(seat => seat.captive === 'post')!;
  ctx.engine.tick(ctx.table.deadline);
  assert.equal(ctx.table.phase, 'betting');
  assert.equal(ctx.engine.holeOf(captive.sessionId).length, 0);
  assert.notEqual(ctx.table.buttonSeat, captive.seatId);
  assert.notEqual(ctx.table.turnSeat, captive.seatId);
});

test('người vay giữa ván đang chạy chỉ nhận bài từ ván kế tiếp', () => {
  const ctx = setup(4);
  ctx.engine.act('d', { action: 'call' }, 1);
  ctx.table.seats[0].chips = 100;
  ctx.engine.act('a', { action: 'allin' }, 2);
  for (const [id, now] of [['b', 3], ['c', 4], ['d', 5]] as const) ctx.engine.act(id, { action: 'call' }, now);
  let now = 6;
  while (ctx.table.phase === 'betting') {
    const seat = ctx.table.seats.find(entry => entry.seatId === ctx.table.turnSeat)!;
    ctx.engine.act(seat.sessionId, { action: seat.bet < ctx.table.currentBet ? 'call' : 'check' }, now++);
  }
  closeShowdown(ctx);
  const captive = ctx.table.seats.find(seat => seat.captive === 'post')!;
  const choiceAt = finishPunches(ctx);
  assert.equal(ctx.table.phase, 'betting');
  assert.equal(ctx.engine.choose(captive.sessionId, { choice: 'borrow' }, choiceAt + 1), true);
  assert.equal(ctx.engine.holeOf(captive.sessionId).length, 0);
  assert.notEqual(ctx.table.turnSeat, captive.seatId);
  now = choiceAt + 1;
  while (ctx.table.phase === 'betting') {
    const seat = ctx.table.seats.find(entry => entry.seatId === ctx.table.turnSeat)!;
    assert.equal(ctx.engine.act(seat.sessionId, { action: 'fold' }, ++now), true);
  }
  ctx.engine.tick(ctx.table.deadline);
  assert.equal(ctx.engine.holeOf(captive.sessionId).length, 2);
});

test('nợ hai lần: thua lần ba chịu 11 cú rồi treo ở cell tới hết trận', () => {
  const ctx = setup(3);
  ctx.table.seats[0].debt = 2;
  ctx.table.seats[0].chips = 100;
  assert.equal(ctx.engine.act('a', { action: 'allin' }, 1), true);
  assert.equal(ctx.engine.act('b', { action: 'call' }, 2), true);
  assert.equal(ctx.engine.act('c', { action: 'call' }, 3), true);
  while (ctx.table.phase === 'betting') {
    const id = sessionAt(ctx, ctx.table.turnSeat);
    assert.equal(ctx.engine.act(id, { action: 'check' }, 4 + ctx.table.board.length), true);
  }
  closeShowdown(ctx);
  const captive = ctx.table.seats[0];
  assert.equal(captive.captive, 'post');
  assert.equal(ctx.table.dungeon.punchesTotal, 11);
  assert.equal(ctx.table.dungeon.canBorrow, false);
  finishPunches(ctx);
  assert.equal(captive.captive, 'hanging');
  assert.ok(ctx.captures.some(call => call.sessionId === 'a' && call.slot.startsWith('gekka-cell-')));
  assert.equal(ctx.engine.choose('a', { choice: 'borrow' }, 100000), false);
});

test('người đã vay một lần chịu tám cú và vẫn có quyền vay lần cuối', () => {
  const ctx = setup();
  ctx.table.seats[0].debt = 1;
  const busted = allInTwo(ctx);
  closeShowdown(ctx);
  assert.equal(busted.seatId, POKER_SEATS[0]);
  assert.equal(ctx.table.dungeon.punchesTotal, 8);
  assert.equal(ctx.table.dungeon.canBorrow, true);
});

test('người treo được thả khi trận kết thúc', () => {
  const ctx = setup(3);
  ctx.table.seats[0].debt = 2;
  ctx.table.seats[0].chips = 100;
  ctx.engine.act('a', { action: 'allin' }, 1);
  ctx.engine.act('b', { action: 'call' }, 2);
  ctx.engine.act('c', { action: 'call' }, 3);
  while (ctx.table.phase === 'betting') ctx.engine.act(sessionAt(ctx, ctx.table.turnSeat), { action: 'check' }, 4 + ctx.table.board.length);
  finishPunches(ctx);
  ctx.engine.leave('b', 30000);
  assert.equal(ctx.table.phase, 'gameOver');
  assert.equal(ctx.table.winnerSeat, POKER_SEATS[2]);
  assert.ok(ctx.releases.some(call => call.sessionId === 'a' && call.to === 'exit'));
});

test('người xem chỉ cà khịa prisoner khi hầm hoạt động và có cooldown', () => {
  const ctx = setup();
  assert.equal(ctx.engine.taunt('spectator', '', { kind: 'laugh', target: 'prisoner' }, 0), null);
  allInTwo(ctx);
  closeShowdown(ctx);
  const first = ctx.engine.taunt('spectator', '', { kind: 'laugh', target: 'prisoner' }, 3);
  assert.deepEqual(first, { sessionId: 'spectator', kind: 'laugh', target: 'prisoner' });
  assert.equal(ctx.engine.taunt('spectator', '', { kind: 'laugh', target: 'prisoner' }, 3 + BLUFF_TIMING.tauntCooldownMs - 1), null);
  assert.ok(ctx.engine.taunt('spectator', '', { kind: 'laugh', target: 'prisoner' }, 3 + BLUFF_TIMING.tauntCooldownMs));
  assert.equal(ctx.engine.taunt('spectator', '', { kind: 'laugh', target: 'gekka-post' }, 10000), null);
});
