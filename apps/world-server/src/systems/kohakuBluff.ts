/** Luật Kohaku Bluff chạy hoàn toàn trên server; chỉ ghi vào bàn những gì được công khai. */
import {
  BLUFF_CHAMBERS, BLUFF_DECK, BLUFF_HAND_SIZE, BLUFF_MIN_PLAYERS, BLUFF_RANKS, BLUFF_TIMING,
  isBluffTruthful, normalizeBluffPlay, normalizeBluffTaunt,
  type BluffCard, type BluffTauntFx, type BluffFace, type BluffSeatView, type BluffTableView,
} from '@metaverse/game-protocol';

export type BluffSeated = { sessionId: string; seatId: string };
export type BluffDeps = {
  seated(): BluffSeated[];
  sendHand(sessionId: string, cards: BluffCard[]): void;
  /** Room cho người đó rời ghế (không gọi onSeatReleased). */
  standUp(sessionId: string): void;
  rng?: () => number;
};

export function createKohakuBluff(table: BluffTableView, deps: BluffDeps) {
  const rng = deps.rng ?? Math.random;
  // Bài, vị trí đạn và các lá vừa úp chỉ sống trong closure, không bao giờ vào Schema/table.
  const hands = new Map<string, BluffCard[]>();
  const bullets = new Map<string, number>();
  let pending: BluffCard[] = [];
  // Mốc cà khịa gần nhất của từng người để chặn spam; không ảnh hưởng luật nên cũng không vào Schema.
  const lastTaunt = new Map<string, number>();
  let round = 0;

  const seatById = (seatId: string) => table.seats.find(s => s.seatId === seatId);
  const seatOf = (sessionId: string) => sessionId ? table.seats.find(s => s.sessionId === sessionId) : undefined;
  const randomInt = (n: number) => Math.floor(rng() * n);

  const syncSeats = () => {
    const bySeat = new Map(deps.seated().map(p => [p.seatId, p.sessionId]));
    for (const seat of table.seats) {
      const sessionId = bySeat.get(seat.seatId) ?? '';
      if (sessionId !== seat.sessionId) { seat.sessionId = sessionId; seat.ready = false; }
      if (!sessionId) seat.ready = false;
    }
  };

  const syncCardCounts = () => {
    for (const seat of table.seats) seat.cardCount = seat.inMatch && seat.alive ? hands.get(seat.sessionId)?.length ?? 0 : 0;
  };

  /** Người còn sống, còn bài, kế tiếp theo thứ tự ghế (không tính chính fromSeat). */
  const nextSeatWithCards = (fromSeat: string): BluffSeatView | undefined => {
    const start = table.seats.findIndex(s => s.seatId === fromSeat);
    for (let step = 1; step < table.seats.length; step++) {
      const seat = table.seats[(start + step) % table.seats.length];
      if (seat.inMatch && seat.alive && seat.cardCount > 0) return seat;
    }
    return undefined;
  };

  const shuffledDeck = (): BluffFace[] => {
    const faces = (Object.keys(BLUFF_DECK) as BluffFace[]).flatMap(face => Array<BluffFace>(BLUFF_DECK[face]).fill(face));
    for (let i = faces.length - 1; i > 0; i--) { const j = randomInt(i + 1); [faces[i], faces[j]] = [faces[j], faces[i]]; }
    return faces;
  };

  /** Chia vòng mới; Task sau dùng lại cho vòng kế tiếp với firstSeat là người đi đầu. */
  const dealRound = (now: number, firstSeat: string) => {
    round += 1;
    const deck = shuffledDeck();
    // Gán id sau khi xáo để id không tiết lộ mặt bài.
    const cards: BluffCard[] = deck.map((face, i) => ({ id: `${round}-${i}`, face }));
    hands.clear();
    let cursor = 0;
    for (const seat of table.seats) {
      if (!seat.inMatch || !seat.alive) continue;
      hands.set(seat.sessionId, cards.slice(cursor, cursor + BLUFF_HAND_SIZE));
      cursor += BLUFF_HAND_SIZE;
    }
    pending = [];
    table.tableRank = BLUFF_RANKS[randomInt(BLUFF_RANKS.length)];
    table.lastPlay = { seatId: '', count: 0, revealed: [] };
    table.accuserSeat = ''; table.shooterSeat = ''; table.shotResult = '';
    table.turnSeat = firstSeat;
    table.phase = 'turn';
    table.deadline = now + BLUFF_TIMING.turnMs;
    syncCardCounts();
    for (const seat of table.seats) {
      if (seat.inMatch) deps.sendHand(seat.sessionId, seat.alive ? [...(hands.get(seat.sessionId) ?? [])] : []);
    }
  };

  const startMatch = (now: number) => {
    const players = table.seats.filter(s => s.sessionId && s.ready);
    for (const seat of table.seats) {
      const joined = players.includes(seat);
      seat.inMatch = joined; seat.alive = joined; seat.pulls = 0; seat.ready = false;
      if (joined) bullets.set(seat.sessionId, randomInt(BLUFF_CHAMBERS));
    }
    table.winnerSeat = '';
    dealRound(now, players[randomInt(players.length)].seatId);
  };

  /** Lật bài vừa úp: người nói dối chịu bắn, nói thật thì người hô chịu bắn. */
  const reveal = (accuserSeat: string, now: number) => {
    const faces = pending.map(c => c.face);
    const truthful = isBluffTruthful(faces, table.tableRank as 'K' | 'Q' | 'A');
    table.accuserSeat = accuserSeat;
    table.lastPlay.revealed = faces;
    table.shooterSeat = truthful ? accuserSeat : table.lastPlay.seatId;
    table.phase = 'reveal';
    table.deadline = now + BLUFF_TIMING.revealMs;
  };

  /** Đường duy nhất xử lý một lần úp, dùng chung cho người chơi và (sau này) tự úp khi hết giờ. */
  const resolvePlay = (seat: BluffSeatView, cardIds: string[], now: number) => {
    const hand = hands.get(seat.sessionId) ?? [];
    const played = hand.filter(c => cardIds.includes(c.id));
    hands.set(seat.sessionId, hand.filter(c => !cardIds.includes(c.id)));
    pending = played;
    table.lastPlay = { seatId: seat.seatId, count: played.length, revealed: [] };
    syncCardCounts();
    deps.sendHand(seat.sessionId, [...(hands.get(seat.sessionId) ?? [])]);
    const next = nextSeatWithCards(seat.seatId);
    if (!next) { reveal('', now); return; }
    table.turnSeat = next.seatId;
    table.deadline = now + BLUFF_TIMING.turnMs;
  };

  /** Người còn sống kế tiếp theo thứ tự ghế; includeSelf cho phép chính fromSeat nếu còn sống. */
  const nextAliveSeat = (fromSeat: string, includeSelf: boolean): BluffSeatView | undefined => {
    const start = table.seats.findIndex(s => s.seatId === fromSeat);
    for (let step = includeSelf ? 0 : 1; step <= table.seats.length; step++) {
      const seat = table.seats[(start + step + table.seats.length) % table.seats.length];
      if (seat.inMatch && seat.alive) return seat;
    }
    return undefined;
  };
  const aliveSeats = () => table.seats.filter(s => s.inMatch && s.alive);

  /** Về lobby: xóa mọi dữ liệu riêng của ván, người chơi phải bấm sẵn sàng lại. */
  const backToLobby = () => {
    for (const seat of table.seats) {
      if (seat.inMatch) deps.sendHand(seat.sessionId, []);
      seat.ready = false; seat.inMatch = false; seat.alive = false; seat.cardCount = 0; seat.pulls = 0;
    }
    hands.clear(); bullets.clear(); lastTaunt.clear(); pending = [];
    table.phase = 'lobby'; table.deadline = 0; table.turnSeat = '';
    table.accuserSeat = ''; table.shooterSeat = ''; table.shotResult = '';
    table.lastPlay = { seatId: '', count: 0, revealed: [] };
  };

  /** Còn ≤1 người sống: có người thắng thì gameOver, không còn ai thì về lobby. */
  const concludeMatch = (now: number) => {
    const alive = aliveSeats();
    if (alive.length === 0) { backToLobby(); return; }
    table.winnerSeat = alive[0].seatId;
    table.phase = 'gameOver'; table.turnSeat = ''; table.deadline = now + BLUFF_TIMING.gameOverMs;
  };

  /** Kết thúc pha result: đuổi người bị nổ khỏi ghế rồi xét kết thúc ván hay chia vòng mới. */
  const finishResult = (now: number) => {
    const shooter = seatById(table.shooterSeat);
    // alive đã là false từ lúc nổ nên leave() do standUp gọi ngược sẽ không chia vòng lần hai.
    if (table.shotResult === 'bang' && shooter) deps.standUp(shooter.sessionId);
    if (aliveSeats().length <= 1) { concludeMatch(now); return; }
    dealRound(now, nextAliveSeat(table.shooterSeat || table.lastPlay.seatId, true)!.seatId);
  };

  const pullTrigger = (now: number) => {
    const shooter = seatById(table.shooterSeat)!;
    // Chỉ ghi kết quả ở đây, pha shooting trước đó phải giữ shotResult rỗng để không lộ qua network.
    const bang = shooter.pulls === bullets.get(shooter.sessionId);
    shooter.pulls += 1;
    if (bang) shooter.alive = false;
    table.shotResult = bang ? 'bang' : 'click';
    table.phase = 'result';
    table.deadline = now + (bang ? BLUFF_TIMING.bangResultMs : BLUFF_TIMING.resultMs);
    syncCardCounts();
  };

  const evaluateLobby = (now: number) => {
    if (table.phase !== 'lobby') return;
    const seated = table.seats.filter(s => s.sessionId);
    const ready = seated.filter(s => s.ready);
    if (seated.length < BLUFF_MIN_PLAYERS || ready.length === 0) { table.deadline = 0; return; }
    if (ready.length === seated.length) { startMatch(now); return; }
    if (table.deadline === 0) table.deadline = now + BLUFF_TIMING.readyCountdownMs;
  };

  const lobbyTick = (now: number) => {
    syncSeats();
    if (table.deadline !== 0 && now >= table.deadline) {
      const seated = table.seats.filter(s => s.sessionId);
      for (const seat of seated) if (!seat.ready) deps.standUp(seat.sessionId);
      if (seated.filter(s => s.ready).length >= BLUFF_MIN_PLAYERS) startMatch(now);
      else table.deadline = 0;
      return;
    }
    evaluateLobby(now);
  };

  return {
    ready(sessionId: string, value: unknown, now: number) {
      if (table.phase !== 'lobby' || typeof value !== 'boolean') return;
      syncSeats();
      const seat = seatOf(sessionId);
      if (!seat) return;
      seat.ready = value;
      evaluateLobby(now);
    },
    play(sessionId: string, input: unknown, now: number): boolean {
      const cardIds = normalizeBluffPlay(input);
      const seat = seatOf(sessionId);
      if (!cardIds || !seat || table.phase !== 'turn' || table.turnSeat !== seat.seatId) return false;
      const hand = hands.get(sessionId) ?? [];
      if (!cardIds.every(id => hand.some(c => c.id === id))) return false;
      resolvePlay(seat, cardIds, now);
      return true;
    },
    callLiar(sessionId: string, now: number): boolean {
      const seat = seatOf(sessionId);
      if (!seat || table.phase !== 'turn' || table.turnSeat !== seat.seatId || table.lastPlay.seatId === '') return false;
      reveal(seat.seatId, now);
      return true;
    },
    leave(sessionId: string, now: number) {
      const seat = seatOf(sessionId);
      if (!seat) return;
      if (table.phase === 'lobby') { seat.ready = false; return; }
      // Chưa tham gia ván hoặc đã bị loại thì bỏ qua: standUp của engine gọi ngược leave, chặn để không chia vòng hai lần.
      if (!seat.inMatch || !seat.alive) return;
      seat.alive = false;
      hands.delete(sessionId);
      syncCardCounts();
      if (table.phase === 'gameOver') return;
      // Pha result phải đi qua finishResult trước mọi kiểm tra số người sống: nó đuổi người bị nổ rồi tự kết thúc ván nếu còn <=1 người.
      if (table.phase === 'result') { finishResult(now); return; }
      if (aliveSeats().length <= 1) { concludeMatch(now); return; }
      // Bỏ lần úp đang chờ và chia lại để không ai bị bắn nhầm vì lượt của người đã rời.
      dealRound(now, nextAliveSeat(seat.seatId, false)!.seatId);
    },
    /** Cà khịa chỉ là hiệu ứng: trả sự kiện để room broadcast, không đổi bất cứ trường nào của bàn. */
    taunt(sessionId: string, input: unknown, now: number): BluffTauntFx | null {
      const taunt = normalizeBluffTaunt(input);
      const seat = seatOf(sessionId);
      if (!taunt || !seat || !seat.inMatch || !seat.alive) return null;
      if (table.phase === 'lobby' || table.phase === 'gameOver') return null;
      // Người đang cầm súng không rảnh tay để cà khịa; mọi lúc khác (kể cả đang tới lượt) đều được.
      if ((table.phase === 'shooting' || table.phase === 'result') && table.shooterSeat === seat.seatId) return null;
      const target = seatById(taunt.targetSeat);
      if (!target || target === seat || !target.inMatch || !target.alive) return null;
      const last = lastTaunt.get(sessionId);
      if (last !== undefined && now - last < BLUFF_TIMING.tauntCooldownMs) return null;
      lastTaunt.set(sessionId, now);
      return { seatId: seat.seatId, kind: taunt.kind, targetSeat: target.seatId };
    },
    isSeatLocked: () => table.phase !== 'lobby',
    tick(now: number) {
      if (table.phase === 'lobby') { lobbyTick(now); return; }
      if (table.deadline === 0 || now < table.deadline) return;
      switch (table.phase) {
        case 'turn': {
          // Hết giờ thì úp ngẫu nhiên 1 lá qua đúng đường của người chơi.
          const seat = seatById(table.turnSeat);
          const hand = seat ? hands.get(seat.sessionId) ?? [] : [];
          if (seat && hand.length > 0) resolvePlay(seat, [hand[randomInt(hand.length)].id], now);
          break;
        }
        case 'reveal':
          // shooterSeat rỗng: bài thật và không còn ai để hô, không ai phải bóp cò.
          if (table.shooterSeat === '') {
            dealRound(now, nextAliveSeat(table.lastPlay.seatId, true)!.seatId);
          } else {
            table.phase = 'shooting'; table.shotResult = ''; table.deadline = now + BLUFF_TIMING.suspenseMs;
          }
          break;
        case 'shooting': pullTrigger(now); break;
        case 'result': finishResult(now); break;
        case 'gameOver': backToLobby(); break;
      }
    },
    handOf: (sessionId: string): readonly BluffCard[] => hands.get(sessionId) ?? [],
  };
}
