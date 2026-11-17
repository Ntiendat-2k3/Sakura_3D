# Bàn Hổ Phách (Kohaku Bluff) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trò chơi bài nói dối kèm súng ổ xoay cho 2–4 người tại bàn tròn tầng 1 tòa Kohaku, server quyết định toàn bộ.

**Architecture:**
- Luật nằm trong một engine thuần (`apps/world-server/src/systems/kohakuBluff.ts`, theo mẫu `clubDj.ts`). Engine thao tác trên một view công khai dạng plain object. `KohakuRoom` chép view đó sang Schema mỗi lần thay đổi.
- Bài trên tay và vị trí viên đạn chỉ nằm trong closure của engine. Bài gửi riêng từng client qua `client.send`.
- Web đọc view công khai từ state, nhận bài riêng qua message. Phần hiển thị gồm: HUD, vật thể 3D trên bàn, tư thế xương của avatar, camera cận cảnh và âm thanh tổng hợp bằng WebAudio.

**Tech Stack:** TypeScript, Colyseus 0.16 (`@colyseus/schema`), Next.js 15 / React 19 / R3F 9 / three 0.173, Node test runner qua `tsx --test`, Blender (Python) cho model.

**Spec:** `docs/superpowers/specs/2026-11-12-kohaku-bluff-design.md`

## Global Constraints

- Bộ bài: 6 K, 6 Q, 6 A, 2 Joker. Mỗi người 5 lá. Mỗi lần úp 1–3 lá. Lá chuẩn ∈ {K, Q, A}. Joker luôn tính là thật.
- Người chơi: tối thiểu 2, tối đa 4, ngồi ở các ghế `kohaku-player-1..4`.
- Súng riêng: ổ 6 ngăn, vị trí viên đạn chọn một lần mỗi ván, giữ qua các vòng. Lần bóp thứ 6 chắc chắn nổ.
- Giờ lượt 30 000 ms. Đếm ngược sẵn sàng 20 000 ms.
- Bài trên tay, vị trí đạn và kết quả bóp cò **không được** xuất hiện trong Schema state trước thời điểm công bố.
- Không có máu. Không dùng tên, nhân vật hay hình ảnh của Liar's Bar.
- Domain/application không import Sequelize/NestJS/Colyseus. Engine luật không import `@colyseus/*`.
- Không bake hoặc ghi đè GLB người chơi. Tư thế chĩa súng và gục làm bằng điều khiển xương trong code. Xương dùng tên trong rig hiện có: `Spine2`, `Neck`, `Head`, `RightShoulder`, `RightArm`, `RightForeArm`, `RightHand`.
- File spec mới phải được thêm vào script `test` của package tương ứng.
- Không chạy Playwright hay mở trình duyệt khi người dùng chưa cho phép.
- **Git:** làm trên nhánh `feat/kohaku-bluff` (tạo từ `main` ở bước đầu). **Chỉ commit khi người dùng yêu cầu.** Các mốc "Checkpoint" bên dưới là nơi nên đề nghị commit.
- Sau khi sửa `packages/game-protocol`, phải chạy `corepack.cmd pnpm --filter @metaverse/game-protocol build` trước khi test hoặc typecheck các app, vì app dùng `dist/`.

## Review Focus

1. **Client gửi id lá không có trên tay, trùng id, quá 3 lá, hoặc gửi khi không phải lượt mình.** Phải bị bỏ qua, state không đổi. Test ở Task 2.
2. **Người rời bàn đúng lúc đang ở pha `reveal`, `shooting` hoặc `result`.** Không được treo bàn hay bắn nhầm người. Nếu còn ≥2 người thì chia vòng mới, nếu không thì kết thúc ván. Test ở Task 3.
3. **Người thắng bị loại cùng lúc với người cuối, ví dụ người kia mất kết nối giữa lúc người thắng đang bóp cò.** Phải có đúng một người thắng, hoặc về lobby nếu không còn ai. Test ở Task 3.
4. **Người mới vào phòng Kohaku giữa ván.** Phải thấy đúng pha và bàn hiện tại nhưng không ngồi được vào ghế trống. Test ở Task 4 (kiểm tra `isSeatLocked`) và Task 9 (e2e).
5. **Đọc network không lộ kết quả.** Trong pha `shooting`, `shotResult` phải rỗng. `revealed` chỉ có giá trị trong pha `reveal` trở đi. Test ở Task 3.

---

### Task 1: Protocol — kiểu, hằng số, chuẩn hóa input

**Files:**
- Create: `packages/game-protocol/src/kohaku-bluff.ts`
- Modify: `packages/game-protocol/src/index.ts` (thêm `export * from './kohaku-bluff';` cạnh các dòng export khác)
- Modify: `packages/game-protocol/package.json` (script `test`: thêm `test/kohaku-bluff.spec.ts`)
- Test: `packages/game-protocol/test/kohaku-bluff.spec.ts`

**Interfaces:**
- Produces (tất cả export từ `@metaverse/game-protocol`):
  ```ts
  export type BluffRank = 'K' | 'Q' | 'A';
  export type BluffFace = BluffRank | 'JOKER';
  export type BluffCard = { id: string; face: BluffFace };
  export const BLUFF_DECK: Readonly<Record<BluffFace, number>>;   // { K: 6, Q: 6, A: 6, JOKER: 2 }
  export const BLUFF_RANKS: readonly BluffRank[];                 // ['K','Q','A']
  export const BLUFF_HAND_SIZE = 5, BLUFF_MAX_PLAY = 3, BLUFF_MIN_PLAYERS = 2, BLUFF_CHAMBERS = 6;
  export const BLUFF_SEATS: readonly string[];                    // id các ghế KOHAKU_SEATS bắt đầu bằng 'kohaku-player-', đúng thứ tự 1..4
  export const BLUFF_TIMING: { turnMs: 30000; readyCountdownMs: 20000; revealMs: 2500; suspenseMs: 2000; resultMs: 2500; gameOverMs: 5000 };
  export type BluffPhase = 'lobby' | 'turn' | 'reveal' | 'shooting' | 'result' | 'gameOver';
  export type BluffSeatView = { seatId: string; sessionId: string; ready: boolean; inMatch: boolean; alive: boolean; cardCount: number; pulls: number };
  export type BluffLastPlay = { seatId: string; count: number; revealed: BluffFace[] };   // seatId '' = chưa có lần úp
  export type BluffTableView = {
    phase: BluffPhase; tableRank: BluffRank | ''; turnSeat: string; deadline: number;
    lastPlay: BluffLastPlay; accuserSeat: string; shooterSeat: string; shotResult: '' | 'click' | 'bang';
    winnerSeat: string; seats: BluffSeatView[];   // luôn 4 phần tử theo BLUFF_SEATS, ghế trống có sessionId ''
  };
  export const BLUFF_MESSAGES: { ready: 'bluff-ready'; play: 'bluff-play'; liar: 'bluff-liar'; hand: 'bluff-hand' };
  export function createEmptyBluffTable(): BluffTableView;   // phase 'lobby', mọi chuỗi rỗng, số = 0, 4 ghế trống
  export function normalizeBluffPlay(input: unknown): string[] | null;   // nhận { cardIds: string[] }
  export function isBluffTruthful(faces: readonly BluffFace[], rank: BluffRank): boolean;
  ```

- [ ] **Step 0: Tạo nhánh làm việc**

Run: `git switch -c feat/kohaku-bluff`
Expected: `Switched to a new branch 'feat/kohaku-bluff'`. Các thay đổi chưa commit của người dùng vẫn đi theo, **không stash, không reset**.

- [ ] **Step 1: Viết test fail**

```ts
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
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `corepack.cmd pnpm --filter @metaverse/game-protocol exec tsx --test test/kohaku-bluff.spec.ts`
Expected: FAIL (module/export không tồn tại).

- [ ] **Step 3: Viết `kohaku-bluff.ts` với đúng các export ở Interfaces.** `BLUFF_SEATS` lấy từ `KOHAKU_SEATS` trong `./club`, không viết cứng danh sách.

- [ ] **Step 4: Chạy lại test, build package**

Run: `corepack.cmd pnpm --filter @metaverse/game-protocol test` rồi `corepack.cmd pnpm --filter @metaverse/game-protocol build`
Expected: tất cả PASS, build không lỗi.

---

### Task 2: Engine — lobby, chia bài, úp bài, hô nói dối, lật bài

**Files:**
- Create: `apps/world-server/src/systems/kohakuBluff.ts`
- Modify: `apps/world-server/package.json` (script `test`: thêm `test/kohaku-bluff.spec.ts`)
- Test: `apps/world-server/test/kohaku-bluff.spec.ts`

**Interfaces:**
- Consumes: mọi thứ của Task 1.
- Produces:
  ```ts
  export type BluffSeated = { sessionId: string; seatId: string };
  export type BluffDeps = {
    seated(): BluffSeated[];                                  // người đang ngồi ghế kohaku-player-*
    sendHand(sessionId: string, cards: BluffCard[]): void;
    standUp(sessionId: string): void;                         // room cho người đó rời ghế
    rng?: () => number;                                       // mặc định Math.random
  };
  export function createKohakuBluff(table: BluffTableView, deps: BluffDeps): {
    ready(sessionId: string, value: unknown, now: number): void;
    play(sessionId: string, input: unknown, now: number): boolean;   // input đi qua normalizeBluffPlay
    callLiar(sessionId: string, now: number): boolean;
    leave(sessionId: string, now: number): void;                     // đứng dậy hoặc mất kết nối
    isSeatLocked(): boolean;                                         // true khi phase !== 'lobby'
    tick(now: number): void;
    handOf(sessionId: string): readonly BluffCard[];                 // chỉ dùng cho test và room gửi lại
  };
  ```

Engine giữ trong closure: `hands: Map<sessionId, BluffCard[]>`, `bullets: Map<sessionId, number>` (0..5), `pending: BluffCard[]` (các lá của lần úp gần nhất). Engine chỉ ghi vào `table` những gì được công khai.

**Hành vi chốt cho task này:**
- **Lobby:** mỗi `tick` đồng bộ `table.seats` theo `deps.seated()`. Người rời ghế thì mất cờ `ready`.
- **Bắt đầu ván:**
  - Khi ≥2 người ngồi và tất cả đã sẵn sàng, bắt đầu ngay.
  - Khi ≥2 người ngồi và ≥1 người sẵn sàng, đặt `deadline = now + readyCountdownMs` (chỉ đặt một lần). Đến hạn: gọi `standUp` cho người chưa sẵn sàng. Còn ≥2 người sẵn sàng thì bắt đầu, nếu không thì `deadline = 0`.
- **Lúc bắt đầu:** người tham gia là những người đã sẵn sàng (`inMatch = alive = true`, `pulls = 0`). Mỗi người được `bullets = floor(rng() * 6)`. Người đi đầu chọn ngẫu nhiên. Sau đó chia vòng.
- **Chia vòng:**
  - Xáo bộ 20 lá bằng Fisher–Yates với `rng`. Id lá gán **sau khi xáo**, dạng `${round}-${i}`, để id không tiết lộ mặt bài.
  - Mỗi người còn sống nhận 5 lá. `tableRank` lấy ngẫu nhiên từ `BLUFF_RANKS`.
  - `lastPlay` về rỗng. `phase = 'turn'`, `deadline = now + turnMs`.
  - Gọi `sendHand` cho từng người tham gia; người đã bị loại nhận `[]`.
- **Úp bài (`play`):**
  - Chỉ hợp lệ khi đang ở `turn`, đúng `turnSeat`, và mọi id đều có trên tay.
  - Bỏ các lá khỏi tay, đặt `pending`, ghi `lastPlay = { seatId, count, revealed: [] }`, cập nhật `cardCount`, gọi `sendHand` cho người úp.
  - Lượt chuyển sang người còn sống kế tiếp theo thứ tự ghế mà còn bài. Nếu không còn ai khác có bài thì tự lật (`accuserSeat = ''`).
- **Hô nói dối (`callLiar`):** chỉ hợp lệ khi đang ở `turn`, đúng `turnSeat`, và `lastPlay.seatId` khác rỗng.
- **Lật bài:** `phase = 'reveal'`, `revealed` = mặt của `pending`, `deadline = now + revealMs`. Ghi `shooterSeat`: người úp nếu nói dối, người hô nếu người úp nói thật. Trường hợp tự lật mà nói thật thì `shooterSeat = ''`.

- [ ] **Step 1: Viết test fail.** Dùng `setup(n)` với rng xác định (ví dụ LCG có seed), `seated` lấy từ mảng, `sendHand` ghi vào `Map`, `standUp` ghi vào mảng.

```ts
test('2 người cùng sẵn sàng thì bắt đầu ngay, mỗi người nhận 5 lá riêng, bàn không chứa mặt bài', () => {
  // ready a, b → phase 'turn', hands.get(a).length === 5, tableRank ∈ BLUFF_RANKS,
  // JSON.stringify(table) không chứa 'JOKER' và không chứa face của bất kỳ lá nào trên tay
});
test('đếm ngược 20s: người chưa sẵn sàng bị đứng dậy, ván bắt đầu với người đã sẵn sàng', () => {
  // 3 ngồi, a và b ready tại t=0 → deadline 20000; tick(19999) vẫn lobby; tick(20000) → standUps === [c], phase 'turn', c không inMatch
});
test('úp bài không hợp lệ bị bỏ qua', () => {
  // sai lượt; id không có trên tay; id trùng; 4 lá; '__proto__' → play trả false, table không đổi (deepEqual với bản sao trước)
});
test('úp 2 lá chuyển lượt cho người kế, người đó hô nói dối thì lật đúng các lá vừa úp', () => {
  // revealed deepEqual mặt của 2 lá; phase 'reveal'; shooterSeat = người úp nếu nói dối, người hô nếu thật
});
test('không được hô nói dối khi vòng chưa có ai úp', () => { /* callLiar ngay đầu vòng → false */ });
test('người hết bài bị bỏ qua; không còn ai khác có bài thì tự lật, nói thật thì shooterSeat rỗng', () => {});
```

- [ ] **Step 2: Chạy, xác nhận fail**

Run: `corepack.cmd pnpm --filter @metaverse/world-server exec tsx --test test/kohaku-bluff.spec.ts`
Expected: FAIL (không tìm thấy `../src/systems/kohakuBluff`).

- [ ] **Step 3: Viết `createKohakuBluff` theo Interfaces và hành vi chốt ở trên.**

- [ ] **Step 4: Chạy lại, xác nhận PASS**

Run: như Step 2. Expected: PASS.

---

### Task 3: Engine — bóp cò, vòng mới, loại, hết giờ, rời bàn, kết thúc

**Files:**
- Modify: `apps/world-server/src/systems/kohakuBluff.ts`
- Test: `apps/world-server/test/kohaku-bluff.spec.ts` (thêm test)

**Interfaces:** Không đổi chữ ký của Task 2. Toàn bộ hành vi mới chạy qua `tick`, `leave` và `play`.

**Hành vi chốt:**
- **Chuyển pha theo thời gian** (khi `now >= deadline`):
  - `reveal` → `shooting`. Đặt `shotResult = ''`, `deadline = now + suspenseMs`. Nếu `shooterSeat = ''` thì bỏ qua bóp cò, chia vòng mới luôn.
  - `shooting` → `result`.
    - Nổ khi `pulls === bullets.get(shooter)`. Khi đó `shotResult = 'bang'`, `alive = false`.
    - Ngược lại `shotResult = 'click'`.
    - `pulls` luôn tăng 1. `deadline = now + resultMs`.
  - `result` → nếu nổ thì gọi `standUp(shooter)`.
    - Còn 1 người sống: `gameOver`, đặt `winnerSeat`, `deadline = now + gameOverMs`.
    - Không còn ai: về lobby.
    - Còn lại: chia vòng mới. Người đi đầu là người vừa bóp cò nếu còn sống, nếu không thì người còn sống kế tiếp theo thứ tự ghế.
  - `gameOver` → lobby. Đặt lại `ready = false`, `inMatch = false`, xóa `hands`, `bullets`, `pending`, gửi `sendHand([])` cho người đã tham gia.
- **Hết giờ lượt ở `turn`:** engine tự úp 1 lá chọn bằng `rng` cho `turnSeat`, đi qua đúng nhánh của `play`.
- **`leave` khi đang trong ván:**
  - Đặt `alive = false`, xóa bài của người đó.
  - Còn 0 hoặc 1 người sống: xử lý như cuối pha `result`.
  - Còn ≥2 người: bỏ lần úp đang chờ và chia vòng mới, **ở mọi pha** `turn`/`reveal`/`shooting`/`result`.
  - Người rời đi chưa từng tham gia ván, hoặc **đã bị loại** (`alive = false`), thì `leave` không làm gì. Lý do: chính `standUp` của engine sẽ kích hoạt `onSeatReleased`, gọi ngược lại `leave`; nếu không chặn thì vòng bị chia hai lần.

- [ ] **Step 1: Viết test fail**

```ts
test('súng riêng: lần bóp thứ (bullet+1) nổ, các lần trước là cạch; pulls tăng mỗi lần', () => {
  // rng cố định để bullets(a) = 2; ép a bóp cò 3 lần qua các lần bị bắt nói dối → click, click, bang
});
test('lần bóp thứ 6 chắc chắn nổ', () => { /* bullets = 5 → 5 lần click rồi bang */ });
test('pha shooting không lộ kết quả', () => {
  // ngay sau reveal→shooting: table.shotResult === '' và JSON.stringify(table) không chứa 'bang'
});
test('sau mỗi lần bóp cò thì chia lại 5 lá và đổi tableRank; người vừa sống sót đi trước', () => {});
test('bị nổ thì standUp được gọi; còn 1 người là gameOver có winnerSeat, sau 5s về lobby với ready = false', () => {});
test('hết 30s lượt thì server tự úp đúng 1 lá', () => {
  // tick(deadline) → lastPlay.count === 1, cardCount giảm 1, lượt sang người kế
});
test('rời bàn trong pha reveal/shooting/result: còn ≥2 người thì chia vòng mới, không ai bị bắn nhầm', () => {});
test('người còn lại mất kết nối đúng lúc người thắng đang bóp cò: đúng một winner hoặc về lobby', () => {});
test('standUp gọi ngược leave cho người vừa bị loại thì không chia vòng lần hai', () => {
  // deps.standUp = id => engine.leave(id, now); 3 người, một người bị nổ → round chỉ tăng 1, mỗi người còn sống nhận sendHand đúng 1 lần
});
```

- [ ] **Step 2: Chạy, xác nhận các test mới fail**

Run: `corepack.cmd pnpm --filter @metaverse/world-server exec tsx --test test/kohaku-bluff.spec.ts`
Expected: test mới FAIL, test của Task 2 vẫn PASS.

- [ ] **Step 3: Viết code các pha trong `tick` và `leave` theo hành vi chốt ở trên.**

- [ ] **Step 4: Chạy, xác nhận PASS, cả test cũ của world-server**

Run: `corepack.cmd pnpm --filter @metaverse/world-server test`
Expected: tất cả PASS.

**Checkpoint:** đề nghị người dùng commit protocol cùng engine.

---

### Task 4: Gắn engine vào KohakuRoom và Schema

**Files:**
- Modify: `apps/world-server/src/state/city.state.ts`. Thêm các class Schema:
  - `BluffSeatSchema` mang các trường của `BluffSeatView`;
  - `BluffTableSchema` mang các trường của `BluffTableView`, trong đó `seats: ArraySchema<BluffSeatSchema>`, `lastPlaySeat`, `lastPlayCount`, `revealed: ArraySchema<string>`;
  - trường `@type(BluffTableSchema) bluff` trong `CityState`.
- Create: `apps/world-server/src/systems/syncBluffSchema.ts`, chứa `export function syncBluffSchema(target: BluffTableSchema, view: BluffTableView): void`.
- Modify: `apps/world-server/src/rooms/sakura.room.ts` (handler `seat` khoảng dòng 74–102, và `onLeave`). Thêm hai hook protected, mặc định không làm gì:
  - `protected canTakeSeat(seatId: string): string | null`: trả về chuỗi lỗi để từ chối ngồi;
  - `protected onSeatReleased(sessionId: string): void`: gọi khi người chơi đứng dậy và trong `onLeave`, trước khi xóa player.
- Modify: `apps/world-server/src/rooms/kohaku.room.ts`.
- Test: `apps/world-server/test/kohaku-bluff.spec.ts` (thêm test cho `syncBluffSchema`)

**Interfaces:**
- Consumes: `createKohakuBluff`, `BluffTableView`, `BLUFF_MESSAGES`, `BLUFF_SEATS`.
- Produces cho client:
  - state `bluff` có dạng `BluffTableSchema`;
  - message riêng `'bluff-hand'` với payload `BluffCard[]`;
  - client gửi `'bluff-ready'` (boolean), `'bluff-play'` (`{ cardIds }`), `'bluff-liar'` (không payload).

**Cách gắn trong `KohakuRoom.onCreate`:**
- Gọi `super.onCreate()`.
- Tạo `view = createEmptyBluffTable()` và engine với:
  - `seated()` lọc `state.players` theo `BLUFF_SEATS`;
  - `sendHand` tìm `this.clients` theo `sessionId`;
  - `standUp` đặt `seatId = ''` và vị trí `standX/standZ` của ghế, giống nhánh đứng dậy trong handler `seat`.
- Đăng ký 3 message ở trên. Sau mỗi lần gọi engine thì gọi `syncBluffSchema`.
- `this.clock.setInterval(() => { engine.tick(Date.now()); syncBluffSchema(...) }, GAME_TICK_MS)`.
- Override hai hook:
  - `canTakeSeat`: nếu ghế thuộc `BLUFF_SEATS` và `engine.isSeatLocked()` thì trả `'Ván đang diễn ra, hãy chờ ván sau.'`;
  - `onSeatReleased`: gọi `engine.leave`.
- Khi client join giữa ván và đang ngồi, room gửi lại `bluff-hand` từ `engine.handOf`. Thực tế người mới vào không thể đang ngồi, nên chỉ cần gửi `[]`.

- [ ] **Step 1: Viết test fail cho `syncBluffSchema`.** Từ một view có 2 lá đã lật và 4 ghế, sau khi sync thì `toJSON()` của schema mang đúng các giá trị đó. Sync lần hai với view rỗng thì `revealed.length === 0`.
- [ ] **Step 2: Chạy, xác nhận fail.** Run như Task 3 Step 2.
- [ ] **Step 3: Thêm Schema, `syncBluffSchema`, hai hook và phần gắn vào `KohakuRoom`.**
- [ ] **Step 4: Kiểm chứng**

Run: `corepack.cmd pnpm --filter @metaverse/world-server test` rồi `corepack.cmd pnpm --filter @metaverse/world-server typecheck`
Expected: PASS, không lỗi kiểu.

---

### Task 5: Web — kết nối, view, chọn bài

**Files:**
- Create: `apps/web/game/systems/kohakuBluffView.ts`
  - `export function readBluffTable(raw: unknown): BluffTableView`: chuyển state schema sang view; khi thiếu dữ liệu thì trả `createEmptyBluffTable()`.
  - `export function toggleBluffSelection(selected: readonly string[], cardId: string): string[]`: bỏ chọn nếu đã chọn, không thêm khi đã có 3 lá.
  - `export function bluffActions(table: BluffTableView, sessionId: string): { canReady: boolean; canPlay: boolean; canCallLiar: boolean; mySeat: string }`.
- Modify: `apps/web/game/networking/useCityConnection.ts`:
  - thêm `bluff` vào `StateView`;
  - state `bluff: BluffTableView` và `bluffHand: BluffCard[]`;
  - `room.onMessage(BLUFF_MESSAGES.hand, ...)`;
  - đặt lại hand về `[]` khi đổi room;
  - thêm `bluffReady(value: boolean)`, `bluffPlay(cardIds: string[])`, `bluffLiar()` theo mẫu `selectDjTrack`;
  - trả cả 5 giá trị mới.
- Modify: `apps/web/package.json` (script `test`: thêm `test/kohaku-bluff.spec.ts`)
- Test: `apps/web/test/kohaku-bluff.spec.ts`

**Interfaces:**
- Consumes: kiểu của Task 1.
- Produces: `readBluffTable`, `toggleBluffSelection`, `bluffActions`, và các giá trị mới trả từ `useCityConnection`: `bluff`, `bluffHand`, `bluffReady`, `bluffPlay`, `bluffLiar`.

- [ ] **Step 1: Viết test fail**

```ts
test('toggleBluffSelection tối đa 3 lá, bấm lại thì bỏ chọn', () => {
  assert.deepEqual(toggleBluffSelection(['a', 'b', 'c'], 'd'), ['a', 'b', 'c']);
  assert.deepEqual(toggleBluffSelection(['a', 'b'], 'a'), ['b']);
});
test('bluffActions: chỉ người đến lượt mới úp được; chỉ hô nói dối được khi đã có lần úp của người khác', () => {});
test('readBluffTable trả bàn rỗng khi state chưa có bluff', () => { assert.equal(readBluffTable(undefined).phase, 'lobby'); });
```

- [ ] **Step 2: Chạy, xác nhận fail.** Run: `corepack.cmd pnpm --filter @metaverse/web exec tsx --test test/kohaku-bluff.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Viết code `kohakuBluffView.ts` và các thay đổi trong `useCityConnection.ts`.**
- [ ] **Step 4: Chạy test và typecheck của web.** Run: lệnh ở Step 2, rồi `corepack.cmd pnpm --filter @metaverse/web typecheck`. Expected: PASS.

---

### Task 6: HUD bài và trạng thái bàn

**Files:**
- Create: `apps/web/game/ui/KohakuBluffHud.tsx`, `export function KohakuBluffHud(props: { table: BluffTableView; hand: BluffCard[]; sessionId: string; names: Record<string, string>; ready(v: boolean): void; play(ids: string[]): void; liar(): void })`.
- Modify: `apps/web/components/World.tsx`. Chỉ gắn `<KohakuBluffHud …/>` khi `zone === 'kohaku'`. `names` lấy từ `players[sessionId].name`.
- Modify: `apps/web/app/style.css`. Thêm class `bluff-*` theo phong cách hổ phách, vàng kim, gỗ tối, dùng quy ước class sẵn có của `WorldHud`.

**Nội dung HUD (chữ hiển thị chốt):**
- **Lobby, người đang ngồi ghế bàn:** nút `Sẵn sàng`, đổi thành `Hủy sẵn sàng` khi đã bấm, kèm `Chờ người chơi (n/4)`. Có đếm ngược thì hiện `Bắt đầu sau Ns`.
- **Trong ván:**
  - Góc trên: `Lá chuẩn: Q`, `Lượt: <tên> · Ns`, và mỗi người một dòng `<tên> · <cardCount> lá · 🔫 <pulls>/6`; người bị loại thì gạch tên.
  - Dưới cùng: bài trên tay, bấm để chọn (dùng `toggleBluffSelection`), cùng nút `Úp bài (k lá)` và `NÓI DỐI!`, bật hoặc tắt theo `bluffActions`.
- **Kết thúc ván:** `<tên> thắng ván!`
- **Người bị loại:** lớp phủ tối nhẹ (opacity 0.35) trong pha `result` khi `shooterSeat` là ghế của mình và `shotResult === 'bang'`.
- **Người không ngồi ở bàn:** chỉ thấy khối trạng thái góc trên.

- [ ] **Step 1: Viết component và gắn vào `World.tsx`.** Logic đã được test ở Task 5, component chỉ hiển thị.
- [ ] **Step 2: Kiểm chứng.** Run: `corepack.cmd pnpm --filter @metaverse/web typecheck`. Expected: không lỗi.

**Checkpoint:** đề nghị commit. Từ đây người dùng đã chơi được bằng HUD, chưa có hiệu ứng 3D.

---

### Task 7: Model súng và lá bài (Blender) cùng vật thể trên bàn

**Files:**
- Create: `scripts/build-kohaku-bluff-props.py`. Chạy bằng `blender -b -P`, theo cấu trúc `scripts/build-kohaku-club.py` (ROOT, đường dẫn raw, public). Xuất:
  - `apps/web/public/assets/props/kohaku-bluff/revolver.glb`: súng ổ xoay báng gỗ tối, khắc hoa văn vàng kim, dưới 3 000 tam giác, gốc tọa độ ở tay cầm, nòng hướng +Z.
  - `apps/web/public/assets/props/kohaku-bluff/card.glb`: lá bài 0.063 × 0.088 m, mặt sau hoa văn hổ phách 琥珀; texture ≤ 512 px. Mặt trước K/Q/A/JOKER là 4 material đặt tên `face-K`, `face-Q`, `face-A`, `face-JOKER`.
  - `.blend` đặt trong `assets/processed/`.
- Modify: `scripts/write-club-manifest.py`, hoặc manifest Kohaku tương ứng nếu có. Ghi nguồn là "tự dựng".
- Create: `apps/web/game/entities/KohakuBluffTable.tsx`, `export function KohakuBluffTable({ table }: { table: BluffTableView })`:
  - Chồng lá úp trước ghế `lastPlay.seatId` tại `(seat.x * 0.54, 0.97, seat.z * 0.54)`, cùng công thức đặt nhãn SEAT trong `KohakuScene.tsx:149`.
  - Trong pha `reveal`, các lá lật ngửa với material `face-*` lấy từ `revealed`.
  - Súng trượt từ chỗ ghế `kohaku-dealer` tới chỗ `shooterSeat` trong pha `reveal`→`shooting`, chuyển động lerp 0.8 s. Trong pha `shooting`/`result`, súng gắn vào tay phải avatar (Task 8).
  - Chớp sáng đầu nòng (pointLight kèm sprite, 120 ms) khi `shotResult` đổi thành `'bang'`.
  - Bong bóng chữ của Shinku dùng `Billboard` + `Text` của drei, đặt trên ghế dealer:
    - đầu vòng: `Lá chuẩn: <rank>`;
    - khi lật: `Có lá sai!` hoặc `Toàn lá thật!`;
    - khi hết ván: `<tên> thắng!`.
- Modify: `apps/web/game/scenes/KohakuScene.tsx`. Thêm prop `bluff?: BluffTableView`, render `<KohakuBluffTable/>`. `World.tsx` truyền `bluff` vào.
- Modify: `apps/web/game/systems/ClubAssetWarmup.tsx`. Warm 2 GLB mới cùng các asset khác, vì asset phải được tải sẵn khi mở World.

- [ ] **Step 1: Viết script Blender và chạy**

Run: `"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b -P scripts/build-kohaku-bluff-props.py`
Expected: tạo 2 GLB. `corepack.cmd pnpm --filter @metaverse/web exec gltf-transform inspect <đường dẫn tuyệt đối>` báo số tam giác và kích thước texture trong giới hạn.

- [ ] **Step 2: Thêm test asset vào `apps/web/test/kohaku-bluff.spec.ts`.** Đọc GLB bằng helper `unpack` của `test/glb` như `kohaku-npc.spec.ts`. Assert `card.glb` có đủ 4 material `face-K|Q|A|JOKER`, `revolver.glb` có mesh và ít hơn 3 000 tam giác.
- [ ] **Step 3: Viết `KohakuBluffTable.tsx`, gắn vào scene, thêm warmup.**
- [ ] **Step 4: Kiểm chứng.** Run: test web (lệnh ở Task 5 Step 2), rồi typecheck web. Expected: PASS.

---

### Task 8: Tư thế chĩa súng và gục, camera cận cảnh, âm thanh

**Files:**
- Create: `apps/web/game/systems/bluffPose.ts`, chứa:
  - `export type BluffPose = 'aim' | 'slump' | null;`
  - `export function applyBluffPose(root: Object3D, pose: BluffPose, weight: number): void`

  Hàm cộng thêm phép quay (slerp theo `weight`, từ 0 tới 1) lên các xương `RightShoulder`, `RightArm`, `RightForeArm`, `RightHand`, `Head` cho `aim` (bàn tay phải chạm thái dương phải, đầu nghiêng nhẹ); và `Spine2`, `Neck`, `Head` cho `slump` (thân đổ về trước tới mặt bàn). Gọi **sau** `mixer.update` mỗi frame. Xương nào không tìm thấy thì bỏ qua.
- Modify: `apps/web/game/entities/Avatar.tsx`. Thêm prop `bluffPose?: BluffPose` cho `Avatar` và `PlayerModel`. Trong `useFrame` của `PlayerModel`, sau `controller?.update(...)`, nội suy weight về 1 trong 0.4 s (về 0 khi `null`) rồi gọi `applyBluffPose(controller.scene, …)`. Súng `revolver.glb` gắn làm con của xương `RightHand` khi pose là `aim`.
- Modify: `apps/web/components/World.tsx`. Tính pose cho từng người:
  - người ở `shooterSeat`, pha `shooting` hoặc `result` với `shotResult !== 'bang'`: `aim`;
  - pha `result` với `bang`: `slump`;
  - còn lại: `null`.
- Modify: `apps/web/game/systems/FollowCamera.tsx`. Thêm prop `focusOverride?: { x: number; y: number; z: number; yaw: number } | null`. Khi có giá trị, camera đặt cách điểm đó 1.6 m phía trước mặt nhân vật, cao 1.3 m, nhìn vào đầu. Khi về `null` thì trở lại chế độ cũ. `World` truyền vị trí ghế của `shooterSeat` trong pha `shooting`/`result`, áp dụng cho mọi người trong phòng Kohaku.
- Create: `apps/web/game/systems/bluffSfx.ts`, `export function playBluffSfx(kind: 'shuffle' | 'click' | 'bang'): void`. Tổng hợp âm bằng WebAudio (noise kèm envelope, không dùng file nên không có vấn đề giấy phép). Gọi khi chia vòng mới, khi `shotResult` đổi thành `click` hoặc `bang`.

- [ ] **Step 1: Viết test fail cho `applyBluffPose`** trong `apps/web/test/kohaku-bluff.spec.ts`. Dựng một cây `Bone` có đủ các tên xương ở trên.
  - `weight 0` không đổi quaternion nào.
  - `aim` với `weight 1` làm đổi quaternion của `RightArm` và `RightForeArm`.
  - `slump` làm đổi `Spine2`.
  - Cây thiếu xương `Head` không ném lỗi.
- [ ] **Step 2: Chạy, xác nhận fail.**
- [ ] **Step 3: Viết code `bluffPose.ts`, rồi các thay đổi trong `Avatar`, `World`, `FollowCamera`, `bluffSfx`.**
- [ ] **Step 4: Kiểm chứng.** Run: test web, typecheck web. Expected: PASS.

---

### Task 9: E2E hai client, báo cáo, kiểm chứng toàn bộ

**Files:**
- Create: `apps/web/test/kohaku-bluff.e2e.cjs`. Theo mẫu `test/club.e2e.cjs`:
  1. Hai guest vào phố, đi tới cổng Kohaku và chuyển phòng.
  2. Ngồi `kohaku-player-1` và `kohaku-player-2`, cùng gửi `bluff-ready`.
  3. Assert mỗi client nhận `bluff-hand` 5 lá và state `bluff.phase === 'turn'`.
  4. Người đến lượt úp 1 lá, người kia gửi `bluff-liar`. Assert `phase` lần lượt qua `reveal`, `shooting` (lúc đó `shotResult === ''`), rồi `result`.
  5. Một client thứ ba vào phòng giữa ván, thử ngồi `kohaku-player-3`, nhận `interaction-error`.
- Modify: `apps/web/package.json` (script `test:e2e`: thêm file e2e mới)
- Create: `docs/reports/KOHAKU_BLUFF_REPORT.md`, ghi luật, cách chơi, những gì đã và chưa kiểm chứng. Modify `docs/README.md` để thêm link vào mục Báo cáo kỹ thuật.
- Modify: `README.md`, thêm 1 gạch đầu dòng ở "Working features".

- [ ] **Step 1: Viết e2e.**
- [ ] **Step 2: Chạy toàn bộ**

Run: `corepack.cmd pnpm test` rồi `corepack.cmd pnpm typecheck`
Expected: tất cả PASS.

Nếu người dùng đang chạy `npm run dev` thì chạy thêm `corepack.cmd pnpm test:e2e`. Expected: PASS. Nếu không chạy được, ghi rõ "chưa kiểm" trong báo cáo.

- [ ] **Step 3: Viết báo cáo.** Ghi trung thực rằng phần hiển thị 3D, tư thế, camera và âm thanh **chưa được xem trên trình duyệt** nếu người dùng chưa cho phép mở trình duyệt.

**Checkpoint:** đề nghị commit và chạy `/code-review`.
