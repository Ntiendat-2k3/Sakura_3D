import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POKER_SEATS, createEmptyPokerTable, type PokerTableView } from '@metaverse/game-protocol';
import {
  canPokerTaunt, defaultPokerTauntTarget, describeCard, isGekkaCaptiveSeat, localDungeonRole, pokerActions, readPokerTable,
} from '../game/systems/gekkaPokerView';
import { KOHAKU_GAME_RULES } from '../game/ui/kohakuGameRules';
import { punchEvents } from '../game/systems/gekkaPunchTimeline';

/** Bàn đang ở vòng tố với hai người: A (ghế 1) tới lượt. */
function bettingTable(): PokerTableView {
  const table = createEmptyPokerTable();
  table.phase = 'betting';
  table.turnSeat = POKER_SEATS[0];
  table.currentBet = 40;
  table.minRaise = 20;
  Object.assign(table.seats[0], { sessionId: 'a', inMatch: true, chips: 500, bet: 20 });
  Object.assign(table.seats[1], { sessionId: 'b', inMatch: true, chips: 500, bet: 40 });
  return table;
}

test('readPokerTable: thiếu schema trả bàn rỗng 6 ghế, đủ trường thì giữ nguyên giá trị', () => {
  assert.equal(readPokerTable(undefined).seats.length, 6);
  const view = bettingTable();
  view.board = ['As', 'Kd', 'Qh'];
  view.showdown = [{ seatId: POKER_SEATS[0], cards: ['Ah', 'Ac'], label: 'Sám cô', won: 80 }];
  view.dungeon = { phase: 'punching', seatId: POKER_SEATS[1], punchesTotal: 5, punchesDone: 2, deadline: 0, canBorrow: false };
  // Giả lập ArraySchema: chỉ có forEach, không phải mảng thật.
  const list = <T,>(items: T[]) => ({ forEach: (cb: (value: T, index: number) => void) => items.forEach(cb) });
  const raw = {
    ...view,
    board: list(view.board),
    showdown: list(view.showdown.map(entry => ({ ...entry, cards: list(entry.cards) }))),
    seats: list(view.seats),
  };
  assert.deepEqual(readPokerTable(raw), view);
});

test('pokerActions: sai lượt không hành động; phải call phần chênh, raise tối thiểu và tối đa theo chip', () => {
  const table = bettingTable();
  assert.equal(pokerActions(table, 'b').canAct, false);
  const mine = pokerActions(table, 'a');
  assert.equal(mine.canAct, true);
  assert.equal(mine.callAmount, 20);
  assert.equal(mine.canCheck, false);
  assert.equal(mine.minRaiseTo, 60);
  assert.equal(mine.maxRaiseTo, 520);
  assert.equal(mine.canRaise, true);
  table.seats[0].chips = 10;
  const short = pokerActions(table, 'a');
  assert.equal(short.callAmount, 10);
  assert.equal(short.canRaise, false);
});

test('cà khịa: người xem chỉ nhắm người trên cột khi hầm hoạt động; người bị trói không cà khịa được', () => {
  const table = bettingTable();
  assert.equal(canPokerTaunt(table, 'viewer', ''), false);
  for (const phase of ['capture', 'punching', 'choice'] as const) {
    table.dungeon.phase = phase;
    assert.equal(canPokerTaunt(table, 'viewer', ''), true);
  }
  assert.equal(defaultPokerTauntTarget(table, ''), 'prisoner');
  assert.equal(defaultPokerTauntTarget(table, POKER_SEATS[1]), POKER_SEATS[0]);
  table.seats[1].captive = 'post';
  assert.equal(canPokerTaunt(table, 'b', 'gekka-post'), false);
  assert.equal(localDungeonRole(table, 'b'), 'prisoner');
  assert.equal(localDungeonRole(table, 'a'), null);
  assert.equal(isGekkaCaptiveSeat('gekka-post'), true);
  assert.equal(isGekkaCaptiveSeat('gekka-cell-3'), true);
  assert.equal(isGekkaCaptiveSeat(POKER_SEATS[0]), false);
});

test('describeCard đổi mã lá thành chữ hiển thị', () => {
  assert.deepEqual(describeCard('Td'), { rank: '10', suit: '♦', red: true });
  assert.deepEqual(describeCard('As'), { rank: 'A', suit: '♠', red: false });
});

test('luật Gekkarō sinh từ hằng số của server', () => {
  const rules = KOHAKU_GAME_RULES.find(game => game.id === 'gekka-poker');
  assert.ok(rules);
  const text = rules.sections.flatMap(section => section.items).join('\n');
  for (const fragment of ['1.000 chip', '10/20', '10 ván', '30 giây', '5 cú', '3 cú', '2 lần', '20 giây']) {
    assert.ok(text.includes(fragment), `thiếu "${fragment}"`);
  }
});

test('punchEvents: một cú mỗi lần punchesDone tăng, cú cuối có final, người mới vào không thấy cú cũ', () => {
  const base = { phase: 'punching' as const, seatId: POKER_SEATS[0], punchesTotal: 5, punchesDone: 2, deadline: 0, canBorrow: true };
  assert.deepEqual(punchEvents(null, base, 100), { punchAt: null, final: false });
  assert.deepEqual(punchEvents(base, base, 100), { punchAt: null, final: false });
  assert.deepEqual(punchEvents(base, { ...base, punchesDone: 3 }, 200), { punchAt: 200, final: false });
  assert.deepEqual(punchEvents({ ...base, punchesDone: 4 }, { ...base, phase: 'choice', punchesDone: 5 }, 300), { punchAt: 300, final: true });
  assert.deepEqual(punchEvents(base, { ...base, seatId: POKER_SEATS[1], punchesDone: 3 }, 400), { punchAt: null, final: false });
});

test('bà chủ: mọi điểm đứng, vòng dạo và đường dẫn khách đều đi được, không xuyên bàn/quầy', async () => {
  const { HOSTESS_DOOR, HOSTESS_STROLL_LOOP, escortSpot, planHostessPath, sampleStroll } = await import('../game/systems/gekkaHostess');
  const { isGekkaWalkable } = await import('@metaverse/game-protocol');
  const walkable = (point: { x: number; z: number }, label: string) => assert.ok(isGekkaWalkable(point.x, point.z, 0), `${label} (${point.x.toFixed(2)}, ${point.z.toFixed(2)})`);
  walkable(HOSTESS_DOOR, 'cửa');
  for (const seatId of POKER_SEATS) {
    const spot = escortSpot(seatId);
    walkable(spot, `chỗ mời ${seatId}`);
    let from = HOSTESS_DOOR;
    for (const point of planHostessPath(HOSTESS_DOOR, spot)) {
      for (let k = 0; k <= 20; k++) walkable({ x: from.x + (point.x - from.x) * k / 20, z: from.z + (point.z - from.z) * k / 20 }, `đường tới ${seatId}`);
      from = point;
    }
  }
  for (let t = 0; t < 120; t += 0.25) walkable(sampleStroll(t), `vòng dạo t=${t}`);
  assert.ok(HOSTESS_STROLL_LOOP.length >= 4);
});

test('bà chủ: khách mới vào thì dẫn tới ghế trống, cúi chào khi khách ngồi, quay về cửa; trận bắt đầu thì đi dạo', async () => {
  const { createHostessDirector, HOSTESS_DOOR, HOSTESS_BOW_SECONDS } = await import('../game/systems/gekkaHostess');
  const director = createHostessDirector();
  const free = [...POKER_SEATS];
  let now = 0;
  const step = (input: Parameters<typeof director.update>[2], seconds: number) => {
    let frame = director.update(now, 0, input);
    for (let t = 0; t < seconds; t += 0.1) { now += 0.1; frame = director.update(now, 0.1, input); }
    return frame;
  };
  // Mở cảnh: chưa có khách thì đứng ở cửa.
  let frame = step({ phase: 'lobby', guests: [], freeSeats: free }, 1);
  assert.equal(frame.walking, false);
  assert.ok(Math.hypot(frame.x - HOSTESS_DOOR.x, frame.z - HOSTESS_DOOR.z) < 0.01);
  // Khách bước vào cửa: bà chủ rời cửa đi dẫn.
  const guest = { sessionId: 'g1', x: 0, z: 6.2 };
  frame = step({ phase: 'lobby', guests: [guest], freeSeats: free }, 0.5);
  assert.equal(frame.walking, true);
  // Đi tới nơi rồi chờ; khách ngồi xuống thì cúi chào.
  for (let t = 0; t < 40 && frame.walking; t += 0.1) frame = step({ phase: 'lobby', guests: [guest], freeSeats: free }, 0.1);
  assert.equal(frame.walking, false, 'tới chỗ mời ngồi trong 40 giây');
  assert.equal(frame.bowElapsed, null, 'chưa cúi khi khách chưa ngồi');
  frame = step({ phase: 'lobby', guests: [{ ...guest, seatId: POKER_SEATS[0] }], freeSeats: free.slice(1) }, 0.3);
  assert.ok(frame.bowElapsed !== null && frame.bowElapsed < HOSTESS_BOW_SECONDS);
  // Cúi xong thì quay lại cửa.
  frame = step({ phase: 'lobby', guests: [{ ...guest, seatId: POKER_SEATS[0] }], freeSeats: free.slice(1) }, 30);
  assert.ok(Math.hypot(frame.x - HOSTESS_DOOR.x, frame.z - HOSTESS_DOOR.z) < 0.01);
  // Trận bắt đầu: rời cửa đi dạo, có lúc đi có lúc dừng.
  const states = new Set<boolean>();
  for (let i = 0; i < 400; i++) states.add(step({ phase: 'betting', guests: [{ ...guest, seatId: POKER_SEATS[0] }], freeSeats: [] }, 0.1).walking);
  assert.deepEqual([...states].sort(), [false, true]);
});
