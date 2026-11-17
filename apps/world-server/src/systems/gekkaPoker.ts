/** Luật bàn Poker chạy trên server; bộ bài và bài tẩy chỉ tồn tại trong closure của trận. */
import { randomInt } from 'node:crypto';
import {
  POKER_RULES, POKER_TIMING, POKER_SEATS, BLUFF_TIMING, GEKKA_EXECUTIONER_RETURN_MS, blindsFor, punchesFor,
  normalizePokerAction, normalizePokerChoice, normalizePokerTaunt, planGekkaEscort, sampleGekkaEscort,
  type GekkaEscortPlan, type GekkaEscortPose, type PokerCard, type PokerSeatView, type PokerTableView, type PokerTauntFx,
} from '@metaverse/game-protocol';
import { rankHand } from './pokerHandRank';
import { awardPots, buildPots } from './pokerPots';
import { advanceDungeonClock, beginDungeonPost, createDungeonQueue } from './gekkaDungeon';

export type PokerDeps = {
  seated(): { sessionId: string; seatId: string }[];
  sendHole(sessionId: string, cards: PokerCard[]): void;
  standUp(sessionId: string): void;
  capture(sessionId: string, slot: string): void;
  /** Đặt người đang bị đao phủ lôi đi tại tư thế trên lộ trình (rời ghế, không tự đi được). */
  escort(sessionId: string, pose: GekkaEscortPose): void;
  release(sessionId: string, to: 'table' | 'exit', seatId: string): void;
  rng?: () => number;
};

export function createGekkaPoker(table: PokerTableView, deps: PokerDeps) {
  const rng = deps.rng ?? (() => randomInt(0x100000000) / 0x100000000);
  const holes = new Map<string, PokerCard[]>();
  const actedSinceRaise = new Set<string>();
  const lastActedBet = new Map<string, number>();
  const handParticipants = new Set<string>();
  const dungeonQueue = createDungeonQueue();
  const cellSlots = new Map<string, string>();
  const lastTaunt = new Map<string, number>();
  /** Người thua sạch còn ngồi ở bàn chờ đao phủ rảnh tay tới lôi đi. */
  const awaitingEscort: string[] = [];
  let escort: { route: string[]; startedAt: number; plan: GekkaEscortPlan } | null = null;
  /** Đao phủ chỉ có một: xong việc ở hầm phải đi bộ về chỗ canh rồi mới lôi người kế. */
  let executionerFreeAt = 0;
  let deck: PokerCard[] = [];

  const seatOf = (sessionId: string) => table.seats.find(seat => seat.sessionId === sessionId);
  const seatById = (seatId: string) => table.seats.find(seat => seat.seatId === seatId);
  const inHand = () => table.seats.filter(seat => handParticipants.has(seat.seatId) && !seat.out && !seat.folded);
  const dungeonPending = () => !!dungeonQueue.post() || dungeonQueue.waiting().length > 0 || awaitingEscort.length > 0 || !!escort;
  const clearEscort = () => {
    awaitingEscort.length = 0; escort = null;
    table.escort = { route: [], startedAt: 0 };
  };
  const inMatch = () => table.seats.filter(seat => seat.inMatch && !seat.out && seat.captive === 'none' && seat.sessionId && seat.chips > 0);
  const nextSeat = (from: string, predicate: (seat: PokerSeatView) => boolean): PokerSeatView | undefined => {
    const start = table.seats.findIndex(seat => seat.seatId === from);
    for (let step = 1; step <= table.seats.length; step++) {
      const seat = table.seats[(start + step + table.seats.length) % table.seats.length];
      if (predicate(seat)) return seat;
    }
    return undefined;
  };

  const syncLobbySeats = () => {
    const occupied = new Map(deps.seated().filter(entry => POKER_SEATS.includes(entry.seatId)).map(entry => [entry.seatId, entry.sessionId]));
    for (const seat of table.seats) {
      const sessionId = occupied.get(seat.seatId) ?? '';
      if (seat.sessionId !== sessionId) { seat.sessionId = sessionId; seat.ready = false; }
      if (!sessionId) seat.ready = false;
    }
  };

  const clearPrivateCards = () => {
    for (const sessionId of holes.keys()) deps.sendHole(sessionId, []);
    holes.clear();
    deck = [];
  };

  const resetLobby = () => {
    clearPrivateCards();
    // Người còn ngồi chờ bị lôi đi thì chỉ đứng dậy ở bàn; người đã xuống hầm thì thả ra ở hầm.
    const stillSeated = (seat: PokerSeatView) => seat.captive === 'none' || awaitingEscort.includes(seat.seatId);
    const toStand = table.seats.filter(seat => seat.inMatch && seat.sessionId && stillSeated(seat)).map(seat => seat.sessionId);
    const toRelease = table.seats.filter(seat => seat.sessionId && !stillSeated(seat)).map(seat => ({ sessionId: seat.sessionId, seatId: seat.seatId }));
    for (const seat of table.seats) {
      seat.ready = false; seat.inMatch = false; seat.out = false; seat.chips = 0;
      seat.bet = 0; seat.committed = 0; seat.folded = false; seat.allIn = false;
      seat.captive = 'none'; seat.debt = 0; seat.lastAction = '';
    }
    table.phase = 'lobby'; table.street = 'preflop'; table.handNumber = 0;
    table.buttonSeat = ''; table.turnSeat = ''; table.deadline = 0;
    table.board = []; table.pot = 0; table.currentBet = 0; table.minRaise = POKER_RULES.bigBlind;
    table.smallBlind = POKER_RULES.smallBlind; table.bigBlind = POKER_RULES.bigBlind;
    table.showdown = []; table.winnerSeat = '';
    table.dungeon = { phase: 'idle', seatId: '', punchesTotal: 0, punchesDone: 0, deadline: 0, canBorrow: false };
    dungeonQueue.clear(); cellSlots.clear(); handParticipants.clear(); lastTaunt.clear(); clearEscort();
    actedSinceRaise.clear();
    lastActedBet.clear();
    for (const seat of toRelease) deps.release(seat.sessionId, 'exit', seat.seatId);
    for (const sessionId of toStand) deps.standUp(sessionId);
    syncLobbySeats();
  };

  const gameOver = (now: number) => {
    const remaining = inMatch();
    if (remaining.length === 0) { resetLobby(); return; }
    for (const seat of table.seats) {
      if (seat.captive !== 'hanging' || !seat.sessionId) continue;
      const sessionId = seat.sessionId;
      seat.out = true; seat.captive = 'none'; seat.sessionId = '';
      cellSlots.delete(seat.seatId);
      deps.release(sessionId, 'exit', seat.seatId);
    }
    table.phase = 'gameOver'; table.turnSeat = '';
    table.winnerSeat = remaining[0].seatId;
    table.deadline = now + POKER_TIMING.gameOverMs;
    clearPrivateCards();
  };

  const makeDeck = (): PokerCard[] => {
    const cards = [...'23456789TJQKA'].flatMap(rank => [...'shdc'].map(suit => `${rank}${suit}`));
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  };
  const draw = () => {
    const card = deck.pop();
    if (!card) throw new Error('Bộ bài Poker đã hết.');
    return card;
  };
  const revealStreet = () => {
    draw(); // Đốt một lá trước mỗi vòng lật như Hold'em.
    if (table.street === 'preflop') {
      table.board.push(draw(), draw(), draw());
      table.street = 'flop';
    } else if (table.street === 'flop') {
      table.board.push(draw()); table.street = 'turn';
    } else if (table.street === 'turn') {
      table.board.push(draw()); table.street = 'river';
    }
  };

  const cellFor = (seatId: string): string => {
    const occupied = new Set(cellSlots.values());
    for (let index = 1; index <= POKER_RULES.maxPlayers; index++) {
      const slot = `gekka-cell-${index}`;
      if (!occupied.has(slot)) { cellSlots.set(seatId, slot); return slot; }
    }
    throw new Error('Hầm không còn chỗ xích.');
  };
  const orderFromButton = () => Array.from({ length: table.seats.length }, (_, index) =>
    table.seats[(table.seats.findIndex(seat => seat.seatId === table.buttonSeat) + index + 1) % table.seats.length].seatId);
  const startNextPost = (now: number) => {
    const seatId = dungeonQueue.startNext();
    if (!seatId) return;
    const seat = seatById(seatId)!;
    cellSlots.delete(seatId);
    seat.captive = 'post';
    table.dungeon = beginDungeonPost(seatId, punchesFor(seat.debt), seat.debt < POKER_RULES.maxLoans, now);
    deps.capture(seat.sessionId, 'gekka-post');
  };
  /** Đưa người vào khung (người đầu) và cùm tường (người sau). */
  const lockUp = (seatIds: readonly string[], now: number) => {
    dungeonQueue.enqueue(seatIds);
    startNextPost(now);
    for (const seatId of dungeonQueue.waiting()) {
      if (cellSlots.has(seatId)) continue;
      const seat = seatById(seatId)!;
      deps.capture(seat.sessionId, cellFor(seatId));
    }
  };
  /** Hầm trống và đao phủ đã về chỗ canh thì lôi cả nhóm đang chờ đi một lượt. */
  const tryStartEscort = (now: number) => {
    if (escort || !awaitingEscort.length || dungeonQueue.post() || dungeonQueue.waiting().length || now < executionerFreeAt) return;
    const route = awaitingEscort.splice(0);
    escort = { route, startedAt: now, plan: planGekkaEscort(route) };
    table.escort = { route: [...route], startedAt: now };
  };
  const tickEscort = (now: number) => {
    if (!escort) return;
    const frame = sampleGekkaEscort(escort.plan, (now - escort.startedAt) / 1000);
    const remaining = escort.route.filter(seatId => seatById(seatId)?.captive === 'queued' && !!seatById(seatId)?.sessionId);
    if (frame.done || !remaining.length) {
      escort = null;
      table.escort = { route: [], startedAt: 0 };
      if (remaining.length) lockUp(remaining, now);
      // Cả đoàn rời phòng giữa đường: đao phủ vẫn phải đi về chỗ canh.
      else executionerFreeAt = now + GEKKA_EXECUTIONER_RETURN_MS;
      return;
    }
    for (const seatId of remaining) {
      const pose = frame.prisoners.get(seatId);
      if (pose) deps.escort(seatById(seatId)!.sessionId, pose);
    }
  };
  const enqueueBusted = (orderFromButton: readonly string[], now: number) => {
    const busted = orderFromButton.map(seatById).filter((seat): seat is PokerSeatView =>
      !!seat && handParticipants.has(seat.seatId) && seat.inMatch && !seat.out && seat.chips === 0 && seat.captive === 'none');
    for (const seat of busted) { seat.captive = 'queued'; awaitingEscort.push(seat.seatId); }
    tryStartEscort(now);
  };
  /** Khung vừa trống: lấy người kế trong cùm; không còn ai thì đao phủ đi về chỗ canh. */
  const afterPostCleared = (now: number) => {
    startNextPost(now);
    if (!dungeonQueue.post()) executionerFreeAt = now + GEKKA_EXECUTIONER_RETURN_MS;
  };

  /** Chia pot một lần, sau đó chỉ công bố bài của người chưa fold khi đủ năm lá chung. */
  const finishHand = (now: number) => {
    const contenders = inHand();
    if (!contenders.length) { resetLobby(); return; }
    const reveal = contenders.length > 1;
    const scores = new Map<string, number[]>();
    if (reveal) for (const seat of contenders) scores.set(seat.seatId, rankHand([...(holes.get(seat.sessionId) ?? []), ...table.board]).score);
    const entries = table.seats.filter(seat => seat.committed > 0).map(seat => ({ seatId: seat.seatId, committed: seat.committed, folded: seat.folded || seat.out }));
    const pots = buildPots(entries);
    const awards = awardPots(pots, scores, orderFromButton());
    for (const [seatId, chips] of awards) seatById(seatId)!.chips += chips;
    table.showdown = reveal ? contenders.map(seat => ({
      seatId: seat.seatId, cards: [...(holes.get(seat.sessionId) ?? [])],
      label: rankHand([...(holes.get(seat.sessionId) ?? []), ...table.board]).label,
      won: awards.get(seat.seatId) ?? 0,
    })) : [];
    clearPrivateCards();
    table.turnSeat = '';
    const hasBusted = table.seats.some(seat => handParticipants.has(seat.seatId) && seat.inMatch && !seat.out && seat.chips === 0 && seat.captive === 'none');
    if (inMatch().length <= 1 && contenders.length === 1 && !hasBusted && !dungeonPending()) { gameOver(now); return; }
    table.phase = 'showdown';
    table.deadline = now + POKER_TIMING.showdownMs;
  };

  const needsAction = (seat: PokerSeatView) => handParticipants.has(seat.seatId) && seat.inMatch && !seat.out && !seat.folded && !seat.allIn && seat.chips > 0
    && (!actedSinceRaise.has(seat.seatId) || seat.bet < table.currentBet);
  const setTurn = (after: string, now: number) => {
    const next = nextSeat(after, needsAction);
    table.turnSeat = next?.seatId ?? '';
    table.deadline = next ? now + POKER_TIMING.turnMs : 0;
  };
  const runout = (now: number) => {
    while (table.street !== 'river') revealStreet();
    finishHand(now);
  };
  const advanceStreet = (now: number) => {
    if (table.street === 'river') { finishHand(now); return; }
    revealStreet();
    table.currentBet = 0;
    table.minRaise = table.bigBlind;
    actedSinceRaise.clear();
    lastActedBet.clear();
    for (const seat of table.seats) { seat.bet = 0; seat.lastAction = ''; }
    setTurn(table.buttonSeat, now);
  };
  const settleAfterAction = (after: string, now: number) => {
    const contenders = inHand();
    if (contenders.length <= 1) { finishHand(now); return; }
    const canBet = contenders.filter(seat => !seat.allIn && seat.chips > 0);
    if (canBet.length <= 1 && canBet.every(seat => seat.bet === table.currentBet)) { runout(now); return; }
    if (table.seats.some(needsAction)) { setTurn(after, now); return; }
    advanceStreet(now);
  };

  const postBlind = (seat: PokerSeatView, blind: number) => {
    const chips = Math.min(seat.chips, blind);
    seat.chips -= chips; seat.bet += chips; seat.committed += chips; table.pot += chips;
    seat.allIn = seat.chips === 0;
  };
  const startHand = (now: number) => {
    const players = inMatch();
    if (players.length <= 1) {
      if (dungeonPending()) {
        table.phase = 'waiting'; table.turnSeat = ''; table.deadline = 0; table.winnerSeat = '';
        table.board = []; table.showdown = []; table.pot = 0; table.currentBet = 0;
        for (const seat of table.seats) { seat.bet = 0; seat.committed = 0; seat.lastAction = ''; }
      } else gameOver(now);
      return;
    }
    handParticipants.clear();
    for (const seat of players) handParticipants.add(seat.seatId);
    table.buttonSeat = table.buttonSeat ? nextSeat(table.buttonSeat, seat => players.includes(seat))!.seatId : players[Math.floor(rng() * players.length)].seatId;
    table.handNumber += 1;
    const blinds = blindsFor(table.handNumber);
    table.smallBlind = blinds.small; table.bigBlind = blinds.big;
    table.street = 'preflop'; table.board = []; table.showdown = [];
    table.pot = 0; table.currentBet = blinds.big; table.minRaise = blinds.big;
    table.winnerSeat = '';
    actedSinceRaise.clear();
    lastActedBet.clear();
    for (const seat of table.seats) {
      seat.bet = 0; seat.committed = 0; seat.folded = false; seat.allIn = false; seat.lastAction = '';
    }
    deck = makeDeck();
    holes.clear();
    for (const seat of players) {
      const cards = [draw(), draw()];
      holes.set(seat.sessionId, cards);
      deps.sendHole(seat.sessionId, [...cards]);
    }
    const smallBlind = players.length === 2 ? seatById(table.buttonSeat)! : nextSeat(table.buttonSeat, seat => players.includes(seat))!;
    const bigBlind = nextSeat(smallBlind.seatId, seat => players.includes(seat))!;
    postBlind(smallBlind, blinds.small);
    postBlind(bigBlind, blinds.big);
    table.phase = 'betting';
    setTurn(bigBlind.seatId, now);
    // Trường hợp blind all-in: người còn chip có thể phải theo trước khi tự lật hết bài.
    if (!table.turnSeat) settleAfterAction(bigBlind.seatId, now);
  };
  const startMatch = (now: number) => {
    const players = table.seats.filter(seat => seat.sessionId && seat.ready);
    dungeonQueue.clear(); cellSlots.clear(); lastTaunt.clear(); clearEscort();
    executionerFreeAt = 0;
    for (const seat of table.seats) {
      const joined = players.includes(seat);
      seat.ready = false; seat.inMatch = joined; seat.out = false;
      seat.chips = joined ? POKER_RULES.startingChips : 0;
      seat.debt = 0; seat.captive = 'none';
    }
    table.handNumber = 0; table.buttonSeat = '';
    startHand(now);
  };
  const maybeContinue = (now: number) => {
    if (table.phase === 'lobby' || table.phase === 'betting' || table.phase === 'gameOver') return;
    if (table.phase === 'showdown') {
      if (now >= table.deadline) {
        enqueueBusted(orderFromButton(), now);
        startHand(now);
      }
      return;
    }
    const active = inMatch();
    if (active.length <= 1 && !dungeonPending()) { gameOver(now); return; }
    if (table.phase === 'waiting' && active.length >= POKER_RULES.minPlayers) startHand(now);
  };
  const releaseCaptive = (seat: PokerSeatView, destination: 'table' | 'exit', now: number) => {
    const wasPost = dungeonQueue.post() === seat.seatId;
    dungeonQueue.remove(seat.seatId);
    cellSlots.delete(seat.seatId);
    const waitingIndex = awaitingEscort.indexOf(seat.seatId);
    if (waitingIndex >= 0) awaitingEscort.splice(waitingIndex, 1);
    const sessionId = seat.sessionId;
    seat.captive = 'none';
    if (destination === 'table') {
      seat.chips = POKER_RULES.startingChips;
      seat.debt += 1;
      deps.release(sessionId, 'table', seat.seatId);
    } else {
      seat.out = true; seat.sessionId = '';
      deps.release(sessionId, 'exit', seat.seatId);
      deps.standUp(sessionId);
    }
    if (wasPost) {
      table.dungeon = { phase: 'idle', seatId: '', punchesTotal: 0, punchesDone: 0, deadline: 0, canBorrow: false };
      afterPostCleared(now);
    }
    maybeContinue(now);
  };
  const tickDungeon = (now: number) => {
    const seat = seatById(dungeonQueue.post());
    if (!seat) return;
    const next = advanceDungeonClock(table.dungeon, now);
    table.dungeon = next.view;
    if (next.outcome === 'leave') { releaseCaptive(seat, 'exit', now); return; }
    if (next.outcome === 'hang') {
      dungeonQueue.remove(seat.seatId);
      seat.captive = 'hanging';
      deps.capture(seat.sessionId, cellFor(seat.seatId));
      afterPostCleared(now);
      maybeContinue(now);
    }
  };
  const evaluateLobby = (now: number) => {
    const seated = table.seats.filter(seat => seat.sessionId);
    const ready = seated.filter(seat => seat.ready);
    if (seated.length < POKER_RULES.minPlayers || ready.length === 0) { table.deadline = 0; return; }
    if (ready.length === seated.length) { startMatch(now); return; }
    if (table.deadline === 0) table.deadline = now + POKER_TIMING.readyCountdownMs;
  };

  return {
    ready(sessionId: string, value: unknown, now: number): void {
      if (table.phase !== 'lobby' || typeof value !== 'boolean') return;
      syncLobbySeats();
      const seat = seatOf(sessionId);
      if (!seat) return;
      seat.ready = value;
      evaluateLobby(now);
    },
    act(sessionId: string, input: unknown, now: number): boolean {
      if (table.phase === 'betting' && table.deadline > 0 && now >= table.deadline) {
        const expired = seatById(table.turnSeat);
        if (expired) {
          const canCheck = expired.bet === table.currentBet;
          if (!canCheck) expired.folded = true;
          expired.lastAction = canCheck ? 'check' : 'fold';
          actedSinceRaise.add(expired.seatId);
          lastActedBet.set(expired.seatId, expired.bet);
          settleAfterAction(expired.seatId, now);
        }
        return false;
      }
      const action = normalizePokerAction(input);
      const seat = seatOf(sessionId);
      if (!action || !seat || table.phase !== 'betting' || table.turnSeat !== seat.seatId || !needsAction(seat)) return false;
      const toCall = Math.max(0, table.currentBet - seat.bet);
      const canRaise = !actedSinceRaise.has(seat.seatId)
        || table.currentBet - (lastActedBet.get(seat.seatId) ?? table.currentBet) >= table.minRaise;
      let raiseTo = 0;
      if (action.action === 'check' && toCall > 0) return false;
      if (action.action === 'call' && toCall === 0) return false;
      if (action.action === 'raise') {
        raiseTo = action.amount!;
        if (!canRaise || raiseTo < table.currentBet + table.minRaise || raiseTo > seat.bet + seat.chips) return false;
      }
      if (action.action === 'allin' && (seat.chips === 0 || (!canRaise && seat.bet + seat.chips > table.currentBet))) return false;

      if (action.action === 'fold') seat.folded = true;
      else if (action.action === 'call') {
        const chips = Math.min(toCall, seat.chips);
        seat.chips -= chips; seat.bet += chips; seat.committed += chips; table.pot += chips;
      } else if (action.action === 'raise' || action.action === 'allin') {
        const target = action.action === 'allin' ? seat.bet + seat.chips : raiseTo;
        const priorBet = table.currentBet;
        const chips = target - seat.bet;
        seat.chips -= chips; seat.bet = target; seat.committed += chips; table.pot += chips;
        if (target > priorBet) {
          const increment = target - priorBet;
          if (increment >= table.minRaise) { table.minRaise = increment; actedSinceRaise.clear(); lastActedBet.clear(); }
          table.currentBet = target;
        }
      }
      seat.allIn = seat.chips === 0;
      seat.lastAction = action.action;
      actedSinceRaise.add(seat.seatId);
      lastActedBet.set(seat.seatId, seat.bet);
      settleAfterAction(seat.seatId, now);
      return true;
    },
    choose(sessionId: string, input: unknown, now: number): boolean {
      const choice = normalizePokerChoice(input);
      const seat = seatOf(sessionId);
      if (!choice || !seat || table.dungeon.phase !== 'choice' || table.dungeon.seatId !== seat.seatId) return false;
      if (now >= table.dungeon.deadline) { tickDungeon(now); return false; }
      if (choice === 'borrow' && !table.dungeon.canBorrow) return false;
      releaseCaptive(seat, choice === 'borrow' ? 'table' : 'exit', now);
      return true;
    },
    leave(sessionId: string, now: number): void {
      const seat = seatOf(sessionId);
      if (!seat) return;
      if (table.phase === 'lobby') { seat.ready = false; evaluateLobby(now); return; }
      if (!seat.inMatch || seat.out) return;
      if (seat.captive !== 'none') { releaseCaptive(seat, 'exit', now); return; }
      seat.out = true; seat.folded = true;
      if (holes.delete(sessionId)) deps.sendHole(sessionId, []);
      if (table.phase === 'betting') settleAfterAction(seat.seatId, now);
      else maybeContinue(now);
    },
    taunt(sessionId: string, seatIdOfSender: string, input: unknown, now: number): PokerTauntFx | null {
      const taunt = normalizePokerTaunt(input);
      if (!taunt || table.phase === 'lobby' || table.phase === 'gameOver') return null;
      const sender = seatOf(sessionId);
      if (seatIdOfSender === '') {
        if (sender?.captive !== undefined && sender.captive !== 'none') return null;
        if (taunt.target !== 'prisoner' || !['capture', 'punching', 'choice'].includes(table.dungeon.phase)) return null;
      } else {
        if (!sender || sender.seatId !== seatIdOfSender || !sender.inMatch || sender.out || sender.captive !== 'none') return null;
        const target = seatById(taunt.target);
        if (!target || target === sender || !target.inMatch || target.out || target.captive !== 'none') return null;
      }
      const previous = lastTaunt.get(sessionId);
      if (previous !== undefined && now - previous < BLUFF_TIMING.tauntCooldownMs) return null;
      lastTaunt.set(sessionId, now);
      return { sessionId, kind: taunt.kind, target: taunt.target };
    },
    isSeatLocked: () => table.phase !== 'lobby',
    isCaptive: (sessionId: string) => seatOf(sessionId)?.captive !== 'none' && !!seatOf(sessionId),
    tick(now: number): void {
      tickEscort(now);
      tryStartEscort(now);
      tickDungeon(now);
      if (table.phase === 'lobby') {
        syncLobbySeats();
        if (table.deadline !== 0 && now >= table.deadline) {
          for (const seat of table.seats) if (seat.sessionId && !seat.ready) deps.standUp(seat.sessionId);
          syncLobbySeats();
          if (table.seats.filter(seat => seat.sessionId && seat.ready).length >= POKER_RULES.minPlayers) startMatch(now);
          else table.deadline = 0;
        } else evaluateLobby(now);
        return;
      }
      if (table.phase === 'waiting') { maybeContinue(now); return; }
      if (table.deadline === 0 || now < table.deadline) return;
      if (table.phase === 'betting') {
        const seat = seatById(table.turnSeat);
        if (seat) this.act(seat.sessionId, { action: seat.bet === table.currentBet ? 'check' : 'fold' }, now);
      } else if (table.phase === 'showdown') {
        maybeContinue(now);
      } else if (table.phase === 'gameOver') {
        resetLobby();
      }
    },
    holeOf: (sessionId: string): readonly PokerCard[] => [...(holes.get(sessionId) ?? [])],
  };
}
