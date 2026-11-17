# 月華楼 Gekkarō Poker & Hầm — Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm zone `gekka`: sòng Texas Hold'em Taishō 2–6 người thật, thua sạch chip bị đưa xuống hầm trói lên cột và bị NPC đấm, rồi chọn rời bàn hoặc vay (tối đa 2 lần).

**Architecture:** Làm y khuôn Kohaku Bluff. Luật nằm trong module thuần ở `apps/world-server/src/systems/` nhận `now` và `deps`. Room chỉ nối message/ghế/schema. Bài tẩy gửi riêng bằng message. Web đọc view công khai qua một hàm `read…`, logic trong `game/systems/`, hiển thị trong `game/entities|scenes|ui/`. Tầng trên và hầm nằm trong cùng một room (hầm là tầng y âm, như các tầng của Kohaku).

**Tech Stack:** TypeScript, Colyseus 0.16 (`@colyseus/schema`), Next.js 15 + R3F + three, `@pixiv/three-vrm`, Node test runner qua `tsx --test`, Blender script Python cho asset, ffmpeg cho audio.

**Spec:** `docs/superpowers/specs/2026-11-13-gekka-poker-design.md`

## Global Constraints

- Ngôn ngữ chú thích, chuỗi UI: tiếng Việt như phần còn lại của repo; chú thích giải thích *vì sao*.
- Chip ảo **1.000**/người; blind **10/20**, **nhân đôi sau mỗi 10 ván bài**; lượt **30 giây** (hết giờ: check nếu được, không thì fold); bàn **2–6 người**; **không** NPC/bot ngồi chơi.
- Thua sạch: đấm **5 cú**, cộng **3 cú mỗi khoản nợ đang có** (5 / 8 / 11); chọn trong **20 giây**, hết giờ = rời bàn; **vay tối đa 2 lần mỗi trận**; thua sạch lần 3 = bị treo ở hầm tới hết trận.
- Người xem chỉ đứng xem và cà khịa; **chỉ NPC đao phủ ra đòn**. Ai không ngồi bàn cũng cà khịa được người đang bị trói; cooldown như Kohaku (`BLUFF_TIMING.tauntCooldownMs`).
- Không máu ở hầm, không nội dung tình dục, không cổng hỏi tuổi; NPC mới là người trưởng thành (ghi trong data).
- Không tiền thật, không lưu chip/nợ vào DB; mọi thứ sống trong bộ nhớ room.
- Bài tẩy và bộ bài **không bao giờ** vào Schema; lá chung chỉ vào khi tới vòng lật.
- Tiếng kêu: bản thu giọng người thật có giấy phép CC0/CC-BY, 4–6 tiếng/nhân vật cho 9 nhân vật trong `player-characters.json`, đổi cao độ để khác nhau; giấy phép lưu ở `assets/source/`.
- Mỗi package liệt kê spec file tường minh trong script `test`: **file spec mới phải thêm vào script đó**.
- App tiêu thụ `dist/` của package: sau khi sửa `packages/game-protocol` chạy `corepack.cmd pnpm --filter @metaverse/game-protocol build`.
- Không chạy Playwright/trình duyệt khi người dùng chưa cho phép (AGENTS.md). Kiểm hình ảnh/âm thanh: báo "chưa kiểm" và nhờ người dùng chạy `npm run dev`.
- `pnpm test:e2e` hiện dùng Node và hai client Colyseus, có thể chạy qua terminal khi các server local sẵn sàng; kiểm thử hình ảnh bằng Playwright/trình duyệt vẫn cần người dùng cho phép rõ ràng.
- Không commit/push trừ khi người dùng yêu cầu (CLAUDE.md toàn cục). Các mục "Checkpoint" bên dưới là điểm dừng chạy test, không phải commit.

## Điều kiện tiên quyết (người dùng cung cấp, trước Task 10/12/13)

1. Hai model VRM người trưởng thành: dealer (vest đuôi tôm) và đao phủ (to con) → `assets/source/characters/gekka/{dealer,executioner}.vrm` kèm file giấy phép.
2. Mixamo FBX: một clip đấm (vd. "Punching"), một clip trúng đòn (vd. "Hit Reaction"/"Taking Punch") → `assets/source/animations/gekka/`.
3. Tiếng kêu đau giọng nữ CC0/CC-BY (ít nhất 3 giọng gốc × 6 tiếng) → `assets/source/audio/gekka-screams/` kèm `LICENSE.md` liệt kê nguồn/tác giả/giấy phép từng file.

Nếu chưa có, làm Task 1–9 và 11 trước; Task 10, 12 và 13 chờ asset.

## Trạng thái (2026-11-16)

- Task 1–8 và 11: xong. Đã sửa: room `GekkaRoom` chưa được đăng ký trong `main.ts`; web join zone `gekka` bằng tên phòng phố; `World.tsx` vẽ ClubScene cho `gekka`; schema Poker sai kiểu literal; `gekka-room.spec.ts` treo vì interval chưa dừng và chưa có trong script test.
- Task 9 (thay bằng code): chưa có `gekka-casino.glb`. Tòa nhà dựng bằng khối với texture vẽ canvas (`gekkaTextures.ts`), tách thành `GekkaSalon.tsx` (sàn gỗ xương cá, giấy dán tường, cửa sổ trăng kính màu, đèn chùm pha lê, bàn nỉ, ghế bành nhung, quầy rượu, góc sofa và máy hát, bình phong vàng) và `GekkaDungeon.tsx` (đá, đuốc, khung gỗ chữ A, chuồng song sắt, xích). Thêm collider `GEKKA_UPPER_BLOCKERS` (quầy rượu, sofa, bình phong) và `GEKKA_RACK` (khung chữ A, thay cho cột tròn).
- Task 10/12 (đã có model): VRM Aos (bà chủ), Espeon (dealer Tsukimi), Lindsay (đao phủ Onizuka), Rina (quầy rượu), nén meshopt ở `public/assets/characters/gekka/`. Đã git-ignore vì 3/4 model cấm phân phối lại (xem `assets/source/characters/gekka-import/LICENSE.md`). Code: `GekkaStaff.tsx`, `gekkaNpcMotion.ts`, `gekkaHostess.ts`. Bà chủ đứng ngoài cửa phố; trong salon thì đón khách, dẫn tới ghế, cúi chào, đi dạo khi trận chạy. Đao phủ ra đòn Cross Punch canh `dungeon.deadline`. Người bị trói: tư thế chữ A bằng IK (`gekkaRestraintPose.ts`), chỉ thân trên dùng Dizzy Idle / Reaction Hit / Big Hit To Head. Chưa dùng clip Taking Punch.
- Cảnh đao phủ lôi người (thêm ngoài kế hoạch): `game-protocol/src/gekka-escort.ts` là lộ trình tất định dùng chung. Đao phủ đứng canh ở salon, đi vòng bàn túm từng người, lôi cả đoàn ra cầu thang xuống trước khung. Server dắt người bị lôi (`PokerTableView.escort`, engine `tickEscort`), khóa input bằng `isInputLocked`. Người thua khi hầm còn bận thì ngồi chờ ở ghế tới khi đao phủ quay về (`GEKKA_EXECUTIONER_RETURN_MS`). Người khác được hỏi "Đi theo": người đứng tự đi theo xuống hầm (`gekkaFollow.ts`, `GekkaFollowPilot`), người ngồi bàn chỉ xem bằng camera.
- Hiệu năng: `GekkaSalon` và phần tĩnh của hầm dùng `memo` (trước đây dựng lại theo mỗi patch 10 Hz) và `StaticBatch` (gộp mesh cùng material). NPC ngoài khung hình được ẩn và bỏ tính xương. Giảm đèn phủ salon từ 4 xuống 2.
- Task 13: chờ file tiếng kêu. Task 14: phím 1–4 cà khịa đã có (`useGekkaTauntKeys`); còn e2e trong `pnpm test:e2e` và báo cáo `docs/reports/`.

## Review Focus

1. **Hai người thua sạch cùng một ván (side pot)**: cả hai đều bị bắt, xếp hàng, mỗi người lần lượt lên cột; người chờ bị xích ở tường. → test trong Task 6.
2. **Người đang bị trói rời phòng/mất kết nối**: rời khỏi hàng đợi, ghế được giải phóng, bàn không kẹt, trận kết thúc đúng nếu chỉ còn một người. → test trong Task 6.
3. **Chỉ còn 1 người có chip nhưng người dưới hầm còn quyền vay**: bàn tạm dừng (phase `waiting`), không tự tuyên bố thắng cho tới khi người đó chọn. → test trong Task 6.
4. **Client gửi số tố bịa** (âm, lẻ thập phân, lớn hơn chip, dưới mức raise tối thiểu, sai lượt): engine bỏ qua, không đổi bàn. → test trong Task 2 (chuẩn hóa) và Task 5 (luật).
5. **Người bị trói bấm phím đứng dậy/ngồi ghế khác**: server từ chối, vẫn ở cột. → test trong Task 7.

---

### Task 1: Bố cục zone `gekka` trong protocol (cổng, ghế, mặt sàn hai tầng)

**Files:**
- Create: `packages/game-protocol/src/gekka.ts`
- Modify: `packages/game-protocol/src/club.ts` (`WorldZone`, `getZoneSeats`, `nearestZoneSeat`, `nearestStreetPortal`, `canUsePortal`, `getWalkThroughTarget`)
- Modify: `packages/game-protocol/src/index.ts` (export `./gekka`)
- Modify: `apps/world-server/src/simulation/movement.ts` (nhánh `zone === 'gekka'` giống nhánh kohaku)
- Test: `packages/game-protocol/test/movement.spec.ts`

**Interfaces:**
- Produces:
  - `WorldZone` thêm `'gekka'`; `GEKKA_ROOM_NAME = 'sakura-gekka'`.
  - `GEKKA_PORTAL = { x: 4.2, z: -15, radius: 2.1 }` (mặt tiền tòa `izakaya` đối diện Kohaku); `GEKKA_EXIT = { x: 0, z: 6.6, radius: 1.9 }`; spawn trong phòng `{ z: 5.6, yaw: Math.PI }`; ra phố đặt `{ x: 2.8, z: -15, yaw: -Math.PI / 2 }`.
  - `GEKKA_BASEMENT_Y = -3.2`.
  - `GEKKA_SEATS`: `gekka-dealer` (`npcOnly`), `gekka-player-1..6` trên elip tâm `(0, -1.5)`, bán trục `rx 1.9`, `rz 1.3`, góc từ +Z `φ ∈ {-120,-72,-24,24,72,120}°` (`x = 1.9·sinφ`, `z = -1.5 + 1.3·cosφ`, yaw nhìn tâm, `stand` lùi ra 0.6 m); dealer ở `φ = 180°`; `gekka-post` (`npcOnly`, `x 0`, `z -3.6`, `y` hầm, yaw 0, `standX 4.2`, `standZ 2.0`); `gekka-cell-1..6` (`npcOnly`, tường trái hầm `x -5.4`, `z` từ -4.5 bước 1.1, yaw `+π/2`, stand như post).
  - `POKER_SEATS: readonly string[]` = id `gekka-player-*` theo thứ tự 1..6.
  - `getGekkaSurfaceY(x, z, currentY): number`, `resolveGekkaStep(fromX, fromY, fromZ, toX, toZ): { allowed: boolean; y: number }`, `isGekkaWalkable(x, z, y)`: sàn trên y=0 trong `x∈[-7,7], z∈[-7,7]`; lỗ cầu thang `x∈[5.2,6.6], z∈[-1.5,3.5]` ở tầng trên; cầu thang dốc đều từ `z 3.5 (y 0)` xuống `z -1.5 (y -3.2)`; sàn hầm `x∈[-6,6.6], z∈[-6,3.5]` ở `y -3.2`; collider: bàn (elip tâm (0,-1.5), bán trục 1.5/0.95), quầy dealer, cột hầm (bán kính 0.35 quanh post), dãy cell (`x < -4.9` ở hầm). Cửa hầm đi từ tầng trên vào đầu cầu thang ở `x 5.9, z 3.5`.
  - `canUsePortal('gekka', …)` chỉ đúng ở `GEKKA_EXIT` khi `y > -1`; `getWalkThroughTarget('gekka')` ra phố khi `y > -1 && |x|<=1.2 && z>=6.3`; street → `'gekka'` khi gần `GEKKA_PORTAL` hoặc `x >= 4.25 && |z+15| <= 1.15`.

- [x] **Step 1: Viết test hỏng** trong `packages/game-protocol/test/movement.spec.ts`:
  - `test('gekka: cầu thang hầm dốc đều 0 → -3.2 và tầng trên không đi xuyên lỗ cầu thang')`: `getGekkaSurfaceY(5.9, 3.5, 0) === 0`; `Math.abs(getGekkaSurfaceY(5.9, 1.0, -1.6) - (-1.6)) < 0.05`; `getGekkaSurfaceY(0, -3, -3.2) === -3.2`; `resolveGekkaStep(5.9, 0, 0.5, 5.9, 0.4).allowed === false` khi `fromY = 0` ở giữa lỗ (đứng trên sàn trên không được bước vào lỗ trừ qua đầu cầu thang).
  - `test('gekka: cổng phố và cửa ra')`: `nearestStreetPortal(4.2, -15)?.destination === 'gekka'`; `canUsePortal('gekka', 0, 6.6, undefined, 0) === true`; `canUsePortal('gekka', 0, 6.6, undefined, -3.2) === false`; `getWalkThroughTarget('street', 4.6, -15) === 'gekka'`.
  - `test('gekka: ghế đủ 6 người chơi + dealer + cột + 6 cell, chỉ ghế người chơi là ghế poker')`: `POKER_SEATS.length === 6`; mọi ghế `gekka-post`, `gekka-cell-*`, `gekka-dealer` có `npcOnly: true`; `getZoneSeats('gekka') === GEKKA_SEATS`.
- [x] **Step 2:** `corepack.cmd pnpm --filter @metaverse/game-protocol test` → FAIL (chưa export).
- [x] **Step 3: Cài đặt** các hằng số và hàm trên trong `gekka.ts` (mẫu theo `getKohakuCandidateSurfaces`/`resolveKohakuStep`), nối vào `club.ts` và `movement.ts`.
- [x] **Step 4:** chạy lại test protocol → PASS; `corepack.cmd pnpm --filter @metaverse/game-protocol build`; `corepack.cmd pnpm --filter @metaverse/world-server test` → PASS.
- [x] **Checkpoint.**

### Task 2: Kiểu dữ liệu, hằng số và chuẩn hóa input của Poker trong protocol

**Files:**
- Create: `packages/game-protocol/src/gekka-poker.ts` (export từ `index.ts`)
- Test: `packages/game-protocol/test/gekka-poker.spec.ts` (thêm vào script `test` của package)

**Interfaces:**
- Produces:
  - `PokerCard = string` dạng 2 ký tự hạng+chất: hạng `23456789TJQKA`, chất `shdc` (vd `'As'`, `'Td'`).
  - `POKER_RULES = { startingChips: 1000, smallBlind: 10, bigBlind: 20, blindDoubleEveryHands: 10, maxLoans: 2, minPlayers: 2, maxPlayers: 6 } as const`.
  - `POKER_TIMING = { turnMs: 30000, readyCountdownMs: 20000, showdownMs: 5000, captureMs: 2500, punchIntervalMs: 1200, finalPunchIntervalMs: 1800, choiceMs: 20000, gameOverMs: 5000 } as const` (2 cú cuối dùng `finalPunchIntervalMs` cho cảm giác "chậm dần").
  - `punchesFor(debt: number): number` = `5 + 3 * debt`.
  - `blindsFor(handNumber: number): { small: number; big: number }`: level = `floor((handNumber - 1) / 10)`, nhân `2^level`.
  - `PokerPhase = 'lobby' | 'betting' | 'showdown' | 'waiting' | 'gameOver'`; `PokerStreet = 'preflop' | 'flop' | 'turn' | 'river'`.
  - `PokerAction = 'fold' | 'check' | 'call' | 'raise' | 'allin'`.
  - `PokerCaptive = 'none' | 'queued' | 'post' | 'hanging'`.
  - `PokerSeatView = { seatId; sessionId; ready; inMatch; out: boolean; chips; bet; committed; folded; allIn; captive: PokerCaptive; debt; lastAction: PokerAction | '' }`.
  - `PokerShowdownEntry = { seatId: string; cards: PokerCard[]; label: string; won: number }`.
  - `DungeonPhase = 'idle' | 'capture' | 'punching' | 'choice'`.
  - `PokerTableView = { phase; street; handNumber; buttonSeat; turnSeat; deadline; board: PokerCard[]; pot; currentBet; minRaise; smallBlind; bigBlind; showdown: PokerShowdownEntry[]; winnerSeat; seats: PokerSeatView[]; dungeon: { phase: DungeonPhase; seatId: string; punchesTotal: number; punchesDone: number; deadline: number; canBorrow: boolean } }`.
  - `createEmptyPokerTable(): PokerTableView` (6 ghế theo `POKER_SEATS`).
  - `POKER_MESSAGES = { ready: 'poker-ready', act: 'poker-act', choose: 'poker-choose', hole: 'poker-hole', taunt: 'poker-taunt', tauntFx: 'poker-taunt-fx' } as const`.
  - `normalizePokerAction(input: unknown): { action: PokerAction; amount?: number } | null`: `amount` chỉ cho `'raise'`, phải là số nguyên dương hữu hạn ≤ 10^9; mọi thứ khác null.
  - `normalizePokerChoice(input: unknown): 'borrow' | 'leave' | null` từ `{ choice }`.
  - `PokerTauntInput = { kind: BluffTauntKind; target: string }`, `target` ∈ `POKER_SEATS` hoặc `'prisoner'`; `PokerTauntFx = { sessionId: string; kind: BluffTauntKind; target: string }`; `normalizePokerTaunt(input: unknown): PokerTauntInput | null` (dùng lại `BLUFF_TAUNTS`).

- [x] **Step 1: Viết test hỏng** `gekka-poker.spec.ts`: `punchesFor(0/1/2) === 5/8/11`; `blindsFor(1)` và `blindsFor(10)` = `{10,20}`, `blindsFor(11)` = `{20,40}`, `blindsFor(21)` = `{40,80}`; `normalizePokerAction({action:'raise', amount: 60})` giữ nguyên; trả `null` với `amount` âm, `12.5`, `NaN`, `'60'`, thiếu amount cho raise, action lạ; `normalizePokerAction({action:'call', amount: 5})` bỏ amount; `normalizePokerChoice({choice:'borrow'}) === 'borrow'`, `{choice:'x'}` → null; `normalizePokerTaunt({kind:'laugh', target:'prisoner'})` hợp lệ, target `'gekka-post'` → null; `createEmptyPokerTable().seats.length === 6`.
- [x] **Step 2:** chạy test protocol → FAIL.
- [x] **Step 3: Cài đặt** trong `gekka-poker.ts`.
- [x] **Step 4:** test → PASS; build protocol.
- [x] **Checkpoint.**

### Task 3: Bộ xếp hạng bài Hold'em (server)

**Files:**
- Create: `apps/world-server/src/systems/pokerHandRank.ts`
- Test: `apps/world-server/test/poker-hand-rank.spec.ts` (thêm vào script `test` của world-server)

**Interfaces:**
- Produces: `rankHand(cards: readonly PokerCard[]): { score: number[]; label: string; best: PokerCard[] }` cho 5–7 lá, chọn 5 lá tốt nhất; `compareScores(a: number[], b: number[]): number` (âm/0/dương). `score[0]` là hạng tổ hợp 0..8, phần còn lại là kicker giảm dần. Nhãn: `Mậu thầu, Đôi, Thú, Sám cô, Sảnh, Thùng, Cù lũ, Tứ quý, Thùng phá sảnh`.

- [x] **Step 1: Viết test hỏng**: mỗi hạng tổ hợp một ca có `label` đúng; `A2345` là sảnh thấp nhất (thua `23456`); thùng phá sảnh thắng tứ quý; hai đôi so đôi cao rồi đôi thấp rồi kicker; cùng đôi khác kicker; hai tay 7 lá bằng nhau → `compareScores === 0`; `best.length === 5`.
- [x] **Step 2:** `corepack.cmd pnpm --filter @metaverse/world-server exec tsx --test test/poker-hand-rank.spec.ts` → FAIL.
- [x] **Step 3: Cài đặt** (duyệt 21 tổ hợp 5 lá của 7 lá là đủ nhanh, không cần bảng tra).
- [x] **Step 4:** test → PASS.
- [x] **Checkpoint.**

### Task 4: Chia pot và side pot (server)

**Files:**
- Create: `apps/world-server/src/systems/pokerPots.ts`
- Test: `apps/world-server/test/poker-pots.spec.ts` (thêm vào script)

**Interfaces:**
- Produces:
  - `buildPots(entries: readonly { seatId: string; committed: number; folded: boolean }[]): { amount: number; eligible: string[] }[]`: tách pot theo mức `committed` của người all-in; người fold góp tiền nhưng không có quyền thắng. Phần cược không ai theo được biểu diễn bằng pot chỉ có một người đủ quyền nhận, không tạo pot không có người đủ quyền nhận.
  - `awardPots(pots, scores: ReadonlyMap<string, number[]>, orderFromButton: readonly string[]): Map<string, number>`: mỗi pot chia đều cho người có điểm cao nhất trong `eligible`; pot chỉ có một người đủ quyền nhận thì trao thẳng như hoàn trả cược, không cần score; chip lẻ cho người thắng đầu tiên theo `orderFromButton` (bắt đầu từ ghế bên trái nút).

- [x] **Step 1: Viết test hỏng**: 3 người committed 100/300/300 (người 100 all-in) → pot chính 300 (3 người) + side pot 400 (2 người); người fold committed 50 nằm trong amount nhưng không trong eligible; phần cược không ai theo nằm trong pot chỉ có một người đủ quyền nhận và được trao không cần score; hòa chia đôi, pot lẻ 1 chip cho người gần nút nhất; người thắng pot chính thua side pot nhận đúng phần pot chính; tổng thưởng luôn bằng tổng committed.
- [x] **Step 2:** chạy test → FAIL.
- [x] **Step 3: Cài đặt.**
- [x] **Step 4:** test → PASS.
- [x] **Checkpoint.**

### Task 5: Engine bàn Poker — lobby, ván bài, vòng tố, showdown

**Files:**
- Create: `apps/world-server/src/systems/gekkaPoker.ts`
- Test: `apps/world-server/test/gekka-poker.spec.ts` (thêm vào script; dùng đồng hồ giả và RNG giả như `kohaku-bluff.spec.ts`)

**Interfaces:**
- Consumes: Task 2 (kiểu, hằng số, normalize), Task 3 `rankHand`/`compareScores`, Task 4 `buildPots`/`awardPots`.
- Produces:
  ```ts
  export type PokerDeps = {
    seated(): { sessionId: string; seatId: string }[];          // người đang ngồi ghế POKER_SEATS
    sendHole(sessionId: string, cards: PokerCard[]): void;
    standUp(sessionId: string): void;                            // không gọi lại onSeatReleased
    capture(sessionId: string, slot: string): void;              // slot: 'gekka-post' | 'gekka-cell-N'
    release(sessionId: string, to: 'table' | 'exit', seatId: string): void;
    rng?: () => number;
  };
  export function createGekkaPoker(table: PokerTableView, deps: PokerDeps): {
    ready(sessionId: string, value: unknown, now: number): void;
    act(sessionId: string, input: unknown, now: number): boolean;
    choose(sessionId: string, input: unknown, now: number): boolean;   // Task 6
    leave(sessionId: string, now: number): void;
    taunt(sessionId: string, seatIdOfSender: string, input: unknown, now: number): PokerTauntFx | null; // Task 6
    isSeatLocked(): boolean;
    isCaptive(sessionId: string): boolean;                             // Task 6
    tick(now: number): void;
    holeOf(sessionId: string): readonly PokerCard[];
  };
  ```
- Hành vi chốt: lobby/sẵn sàng/đếm ngược như Bluff (`POKER_TIMING.readyCountdownMs`); bắt đầu trận: mọi người ngồi + sẵn sàng có `chips = startingChips`, `debt 0`, `inMatch true`; nút đầu tiên ngẫu nhiên. Heads-up: nút đặt small blind và hành động trước ở preflop. Raise tối thiểu = mức raise lớn nhất trước đó trên street (tối thiểu big blind); all-in không đủ mức raise tối thiểu **không mở lại** quyền raise cho người đã hành động. Khi mọi người còn lại đều all-in (hoặc chỉ một người chưa all-in) thì lật hết lá chung rồi showdown. Chỉ còn một người chưa fold → thắng ngay, không lật bài tẩy (showdown rỗng). Showdown hiển thị bài của người chưa fold trong `showdown` ở `POKER_TIMING.showdownMs` rồi sang ván mới (hoặc bắt người thua sạch — Task 6). Bộ bài 52 lá xáo bằng `rng` (mặc định `crypto.randomInt`), gửi `sendHole` cho từng người ngay khi chia và gửi `[]` khi ván kết thúc.

- [x] **Step 1: Viết test hỏng** (mỗi mục một `test(...)`):
  - lobby: 2 người sẵn sàng → `phase 'betting'`, `street 'preflop'`, chip mỗi người = 1000 trừ blind, `pot === 30`, `holeOf` mỗi người 2 lá khác nhau, `sendHole` gọi đúng 2 lần.
  - heads-up: nút là small blind và là `turnSeat` preflop; postflop người còn lại hành động trước.
  - 3 người: preflop người sau big blind hành động trước; check vòng quanh ở flop chuyển sang turn với `board.length === 4`.
  - `act` bị từ chối (trả `false`, bàn không đổi): sai lượt; check khi đang có cược; raise dưới `minRaise`; raise vượt chip (phải dùng `'allin'`); người đã fold.
  - all-in ngắn không mở lại raise: A raise 100, B all-in 150 (dưới mức raise tối thiểu 180), A chỉ được call/fold.
  - hết 30 s: tự check nếu `currentBet === bet` của người đó, ngược lại fold.
  - fold hết còn 1 → người đó nhận pot, `showdown` rỗng, không lộ bài.
  - showdown: hai người all-in preflop → lật đủ 5 lá, `showdown` có nhãn từ `rankHand`, tổng chip trên bàn bảo toàn.
  - blind tăng: ván số 11 có `smallBlind 20`, `bigBlind 40`.
  - bảo mật: `JSON.stringify(table)` không chứa lá tẩy nào của người chưa tới showdown.
  - `leave` giữa vòng tố của người đang tới lượt → coi như fold, lượt chuyển đúng; còn 1 người → kết thúc trận (`phase 'gameOver'`, `winnerSeat`).
- [x] **Step 2:** chạy test → FAIL.
- [x] **Step 3: Cài đặt `createGekkaPoker`** phần bàn chơi (trạng thái bí mật — bộ bài, bài tẩy — chỉ sống trong closure như `kohakuBluff.ts`; `table` chỉ chứa dữ liệu công khai).
- [x] **Step 4:** test → PASS.
- [x] **Checkpoint.**

### Task 6: Engine — hầm, vay nợ, treo và kết thúc trận

**Files:**
- Modify: `apps/world-server/src/systems/gekkaPoker.ts`
- Create: `apps/world-server/src/systems/gekkaDungeon.ts` (hàng đợi và đồng hồ đấm, thuần)
- Test: `apps/world-server/test/gekka-poker.spec.ts`

**Interfaces:**
- Consumes: Task 5 engine, `punchesFor`, `POKER_TIMING`, `POKER_RULES.maxLoans`.
- Produces: `choose`, `isCaptive`, `taunt` của engine; `table.dungeon` và các trường `captive/debt/out` của ghế được cập nhật đúng.
- Hành vi chốt:
  - Sau showdown, mỗi người `chips === 0` → `captive 'queued'`, ghế **giữ chỗ** (không xóa `sessionId` dù `seated()` không còn trả về họ). Hàng đợi theo thứ tự ghế từ trái nút. Người chờ: `deps.capture(sessionId, 'gekka-cell-N')`.
  - Lên cột: `captive 'post'`, `deps.capture(sessionId, 'gekka-post')`, `dungeon.phase 'capture'` trong `captureMs` → `'punching'`, `punchesTotal = punchesFor(debt)`, mỗi `punchIntervalMs` tăng `punchesDone` (2 cú cuối dùng `finalPunchIntervalMs`) → `'choice'` với `deadline = now + choiceMs`, `canBorrow = debt < maxLoans`.
  - `choose('borrow')` (chỉ khi `canBorrow`): `chips = startingChips`, `debt += 1`, `captive 'none'`, `deps.release(sessionId, 'table', seatId)`, vào lại từ ván kế tiếp. `choose('leave')` hoặc hết giờ: `out true`, `release(…, 'exit', …)`, ghế giải phóng qua `deps.standUp`.
  - Không còn quyền vay (`debt === maxLoans`) sau trận đấm: `captive 'hanging'`, chuyển sang cell, bị giữ tới `gameOver` rồi `release(…, 'exit')`.
  - Bàn tiếp tục chơi khi có ≥2 người `inMatch && !out && captive 'none' && chips > 0`; nếu chỉ còn 1 người như vậy nhưng có người `queued/post` còn quyền vay → `phase 'waiting'`; khi không còn ai có thể quay lại → `gameOver`, `winnerSeat` = người còn chip.
  - `leave` của người đang ở hầm: rời hàng đợi, `out true`; nếu là người trên cột thì `dungeon` về `'idle'` và người kế tiếp lên.
  - `taunt(sessionId, seatIdOfSender, …)`: người ngồi bàn trong trận cà khịa ghế khác như Bluff; người **không ngồi bàn** (`seatIdOfSender === ''`) chỉ được nhắm `'prisoner'` và chỉ khi `dungeon.phase ∈ {'capture','punching','choice'}`; cooldown `BLUFF_TIMING.tauntCooldownMs` theo `sessionId`.
  - `isSeatLocked()` = `phase !== 'lobby'`; `isCaptive(sessionId)` = ghế của người đó có `captive !== 'none'`.

- [x] **Step 1: Viết test hỏng**:
  - thua sạch lần đầu: `capture(…, 'gekka-post')` được gọi, `punchesTotal === 5`, sau `captureMs + 5 cú` thì `dungeon.phase === 'choice'`, `canBorrow === true`.
  - vay: `chips === 1000`, `debt === 1`, `release(…, 'table', seatId)` được gọi; lần thua sạch sau `punchesTotal === 8`; lần thứ 3 `punchesTotal === 11`, `canBorrow === false`, sau trận đấm `captive 'hanging'`.
  - hết `choiceMs` không chọn → `out === true`, `release(…, 'exit', …)` và `standUp` được gọi.
  - **(Review Focus 1)** hai người thua sạch cùng một ván: cả hai `queued`, người đầu lên cột, người sau ở `gekka-cell-1`; khi người đầu chọn xong, người sau lên cột.
  - **(Review Focus 2)** người đang trên cột `leave` → người chờ lên cột ngay; nếu không còn ai có thể quay lại thì `gameOver`.
  - **(Review Focus 3)** 2 người, A thua sạch còn quyền vay → `phase 'waiting'`, không có `winnerSeat`; A vay → ván mới bắt đầu; A rời → `gameOver`, `winnerSeat` = B.
  - bàn vẫn chơi khi có người dưới hầm: 3 người, A ở hầm, B và C tiếp tục ván mới, ghế A bị bỏ qua khi xoay nút/blind/lượt.
  - người hanging được thả (`release 'exit'`) khi `gameOver`.
  - taunt: người xem nhắm `'prisoner'` khi đang đấm → trả fx; ngoài lúc hầm hoạt động → `null`; spam trong cooldown → `null`.
- [x] **Step 2:** chạy test → FAIL.
- [x] **Step 3: Cài đặt** `gekkaDungeon.ts` (hàng đợi + mốc thời gian đấm) và nối vào engine.
- [x] **Step 4:** `corepack.cmd pnpm --filter @metaverse/world-server test` → PASS toàn bộ.
- [x] **Checkpoint.**

### Task 7: Schema, room `GekkaRoom` và nối vào server

**Files:**
- Modify: `apps/world-server/src/state/city.state.ts` (thêm `PokerSeatSchema`, `PokerShowdownSchema`, `DungeonSchema`, `PokerTableSchema`, trường `poker` trong `CityState`)
- Create: `apps/world-server/src/systems/syncPokerSchema.ts`
- Create: `apps/world-server/src/rooms/gekka.room.ts`
- Modify: `apps/world-server/src/rooms/sakura.room.ts` (thêm hook `protected canReleaseSeat(sessionId: string): boolean { return true; }` gọi trước khi đứng dậy; danh sách đích hợp lệ thêm `'gekka'`; `fromZone` nhận diện phòng `GEKKA_ROOM_NAME`; vị trí spawn trong `gekka` và khi từ `gekka` ra phố)
- Modify: `apps/world-server/src/main.ts` (`server.define(GEKKA_ROOM_NAME, GekkaRoom)`)
- Test: `apps/world-server/test/gekka-poker.spec.ts` (sync schema), `apps/world-server/test/gekka-room.spec.ts` (thêm vào script)

**Interfaces:**
- Consumes: Task 5–6 engine, Task 1 seats.
- Produces: `syncPokerSchema(target: PokerTableSchema, view: PokerTableView): void` (mảng `board`/`showdown` chỉ ghi lại khi nội dung đổi, ghế cố định 6 phần tử tạo một lần — như `syncBluffSchema`). Room: message `POKER_MESSAGES.ready/act/choose/taunt` → engine; `tauntFx` broadcast; `hole` gửi riêng; `onJoin` gửi `holeOf`; `canTakeSeat` khóa ghế poker khi `isSeatLocked`; `canReleaseSeat` trả `!engine.isCaptive(sessionId)`; `deps.capture` đặt `player.seatId = slot`, `x/z/yaw` của slot, `y = GEKKA_BASEMENT_Y`, xóa input; `deps.release('table')` đặt lại ghế poker và `y = 0`; `release('exit')` đặt `seatId ''`, vị trí `standX/standZ` của post, `y = GEKKA_BASEMENT_Y`.

- [x] **Step 1: Viết test hỏng**:
  - `syncPokerSchema`: bàn sau một ván có `board` 3 lá và `showdown` → schema đúng giá trị; gọi lại không đổi gì thì không `clear()` mảng (đếm bằng spy hoặc so `$changes` nếu tiện).
  - `gekka-room.spec.ts` dùng lớp con kiểm thử hoặc gọi hook trực tiếp: **(Review Focus 5)** người `isCaptive` gửi `toggle-seat` với `seatId ''` → vẫn ở `gekka-post`; gửi `seatId` ghế khác → bị từ chối.
- [x] **Step 2:** chạy test → FAIL.
- [x] **Step 3: Cài đặt** schema, sync, room, hook và đăng ký room.
- [x] **Step 4:** `corepack.cmd pnpm --filter @metaverse/world-server test` và `corepack.cmd pnpm typecheck` → PASS.
- [x] **Checkpoint.**

### Task 8: Web — kết nối, đọc bàn và luật hành động phía client

**Files:**
- Modify: `apps/web/game/networking/useCityConnection.ts` (room name cho `'gekka'`; state `poker`, `pokerHole`, `pokerTaunts`; hàm `pokerReady(v)`, `pokerAct(action, amount?)`, `pokerChoose(choice)`, `pokerTaunt(kind, target)`; reset khi đổi room như bluff)
- Create: `apps/web/game/systems/gekkaPokerView.ts`
- Test: `apps/web/test/gekka-poker.spec.ts` (thêm vào script `test` của web)

**Interfaces:**
- Consumes: Task 2 kiểu/hằng số.
- Produces:
  - `readPokerTable(raw: unknown): PokerTableView` (chịu được schema thiếu trường, trả bàn rỗng như `readBluffTable`).
  - `pokerActions(table: PokerTableView, sessionId: string): { canAct: boolean; canCheck: boolean; callAmount: number; minRaiseTo: number; maxRaiseTo: number; canRaise: boolean }`.
  - `canPokerTaunt(table, sessionId, mySeatId: string): boolean` và `defaultPokerTauntTarget(table, mySeatId): string` (người không ngồi → `'prisoner'`).
  - `localDungeonRole(table, sessionId): 'prisoner' | 'queued' | 'hanging' | null`.

- [x] **Step 1: Viết test hỏng**: `readPokerTable(undefined)` = bàn rỗng 6 ghế; đọc một object giả schema đủ trường giữ nguyên giá trị; `pokerActions`: sai lượt → `canAct false`; có cược 40 khi mình đã đặt 20 → `callAmount 20`, `canCheck false`, `minRaiseTo` = `currentBet + minRaise`, `maxRaiseTo` = `chips + bet`; chip không đủ call → `callAmount` = chip còn lại, `canRaise false`; người xem chỉ được taunt `'prisoner'` khi `dungeon.phase` là `capture`, `punching` hoặc `choice`.
- [x] **Step 2:** `corepack.cmd pnpm --filter @metaverse/web exec tsx --test test/gekka-poker.spec.ts` → FAIL.
- [x] **Step 3: Cài đặt** view + nối connection.
- [x] **Step 4:** test → PASS; `corepack.cmd pnpm --filter @metaverse/web exec tsc --noEmit -p .` → sạch.
- [x] **Checkpoint.**

### Task 9: Asset tòa nhà Gekkarō (Blender)

**Files:**
- Create: `scripts/build-gekka-casino.py` (theo cấu trúc `scripts/build-kohaku-club.py`)
- Create (output): `apps/web/public/assets/buildings/gekka-casino.glb`; bài/chip: `apps/web/public/assets/props/gekka/{card,chip}.glb` (có thể tái dùng `card.glb` của Kohaku nếu đủ 52 mặt qua texture atlas — người làm quyết)
- Create: `assets/manifests/gekka-casino.json` (nguồn, giấy phép)
- Test: `apps/web/test/gekka-assets.spec.ts` (thêm vào script)

**Interfaces:**
- Produces: các node có tên cố định trong GLB để scene bám: `gekka-poker-table`, `gekka-post`, `gekka-bulb` (bóng đèn hầm), `gekka-basement-door`, `gekka-chandelier`. Toạ độ khớp Task 1 (bàn tâm `(0,-1.5)`, post `(0,-3.6)` ở `y -3.2`, cầu thang `x∈[5.2,6.6]`, cell tường `x -5.4`).
- Phong cách theo spec mục 4: tầng trên Taishō Roman (gỗ bóng, đèn chùm pha lê, cột cẩm thạch, rèm nhung đỏ, tranh, bình sứ); hầm gạch nứt, nước rỉ, xích, cột gỗ cũ. Texture ≤ 1024 px như các GLB khác.

- [ ] **Step 1: Viết test hỏng** `gekka-assets.spec.ts` (đọc GLB bằng `unpack` của `test/glb.ts`): file tồn tại, là glTF; có đủ 5 node tên trên; node `gekka-post` ở `y` ≈ -3.2 (±0.1) và `x,z` ≈ `(0,-3.6)`; ảnh nhúng ≤ 1024 px.
- [ ] **Step 2:** chạy test → FAIL (chưa có file).
- [ ] **Step 3:** viết script Blender, chạy `blender -b -P scripts/build-gekka-casino.py`, ghi manifest.
- [ ] **Step 4:** test → PASS.
- [ ] **Checkpoint.**

### Task 10: Web — scene, bàn poker, dealer NPC và tích hợp World

*(Chờ VRM dealer — điều kiện tiên quyết 1.)*

**Files:**
- Create: `apps/web/game/scenes/GekkaScene.tsx` (tải `gekka-casino.glb`, ánh sáng hai tầng, children là entities như `KohakuScene`)
- Create: `apps/web/game/entities/GekkaPokerTable.tsx` (lá chung, chồng chip/pot, lá tẩy úp trước mỗi ghế, lật bài ở showdown, nút dealer)
- Modify: `apps/web/game/entities/club-npcs.json` (thêm `gekka-dealer`, `gekka-executioner` với `role`, `height`, `"adult": true`), `apps/web/game/systems/characterAssets.ts` (id mới)
- Create: `apps/web/game/entities/GekkaNpc.tsx` (dealer đứng/ngồi ghế dealer, nhìn người tới lượt — dùng lại cách `KohakuNpc` + `npcFocus`)
- Modify: `apps/web/components/World.tsx` (scene `gekka`, lazy load như Kohaku), `apps/web/game/entities/Avatar.tsx` và `apps/web/game/systems/playerPresentation.ts`, `FollowCamera.tsx` (nhánh zone `'gekka'` dùng `getGekkaSurfaceY`/`resolveGekkaStep`), `apps/web/game/systems/ClubAssetWarmup.tsx` (tải sẵn GLB + VRM mới), `apps/web/game/scenes/SakuraScene.tsx` (biển hiệu 月華楼 ở `GEKKA_PORTAL`), `apps/web/game/ui/WorldHud.tsx` (nhãn cửa ra)
- Test: `apps/web/test/gekka-poker.spec.ts`

**Interfaces:**
- Consumes: Task 1, 8, 9.
- Produces: `GekkaScene` props `{ onReady, player, poker: PokerTableView, names: Record<string,string>, children }`.

- [ ] **Step 1: Viết test hỏng**: `club-npcs.json` có `gekka-dealer` và `gekka-executioner` với `adult === true`; `loadCharacterAsset` nhận id mới (theo cách `character-cache.spec.ts` kiểm id).
- [ ] **Step 2:** chạy test → FAIL.
- [ ] **Step 3: Cài đặt** scene, entities, nhánh zone, warmup.
- [ ] **Step 4:** web test + tsc → PASS. Hình ảnh: **chưa kiểm**, nhờ người dùng `npm run dev`.
- [ ] **Checkpoint.**

### Task 11: Web — HUD poker và hộp chọn ở hầm

**Files:**
- Create: `apps/web/game/ui/GekkaPokerHud.tsx` (lá tẩy của mình, chip, pot, nút Fold/Check/Call N/Raise + thanh kéo từ `minRaiseTo` tới `maxRaiseTo`/All-in, đồng hồ lượt; nút Sẵn sàng ở lobby; thông báo người thắng/nhãn bài ở showdown)
- Create: `apps/web/game/ui/GekkaDungeonDialog.tsx` (chỉ người trên cột ở pha `choice`: đếm ngược 20 s, nút "Vay 1.000 chip (nợ N/2)" ẩn khi `canBorrow false`, nút "Rời bàn")
- Modify: `apps/web/game/ui/kohakuGameRules.ts` (thêm mục luật Gekkarō, số liệu lấy từ `POKER_RULES`/`POKER_TIMING`/`punchesFor`)
- Modify: `apps/web/components/World.tsx` (gắn HUD/dialog khi `zone === 'gekka'`)
- Test: `apps/web/test/gekka-poker.spec.ts`

**Interfaces:**
- Consumes: Task 8 `pokerActions`, `localDungeonRole`, các hàm gửi của connection.

- [x] **Step 1: Viết test hỏng**: luật Gekkarō trong `KOHAKU_GAME_RULES` (hoặc bảng luật chung) chứa `1.000 chip`, `10/20`, `10 ván`, `30 giây`, `5`, `3 cú`, `2 lần`, `20 giây` sinh từ hằng số (mẫu theo test luật Bluff trong `kohaku-npc.spec.ts`).
- [x] **Step 2:** chạy test → FAIL.
- [x] **Step 3: Cài đặt** HUD, dialog, luật.
- [x] **Step 4:** web test + tsc → PASS. Giao diện: **chưa kiểm**.
- [x] **Checkpoint.**

### Task 12: Web — cảnh hầm: trói, đấm, đèn chập chờn, camera

*(Chờ VRM đao phủ + FBX đấm/trúng đòn — điều kiện tiên quyết 1, 2.)*

**Files:**
- Modify: `scripts/prepare-club-motion.mjs` (cho phép thư mục nguồn `assets/source/animations/gekka/` như `kohaku/`)
- Create (output): `apps/web/public/assets/animations/club/<Punch>.json`, `<HitReaction>.json`
- Create: `apps/web/game/systems/gekkaCaptivePose.ts`: `applyCaptivePose(root: Object3D, weight: number, hit: { phase: number } | null): void` — hai tay giơ ra sau cột (IK theo hệ model như `bluffPose.ts`, cùng cơ chế nhớ nền chống cộng dồn), lúc trúng đòn cộng clip HitReaction (retarget runtime như `playerKissMotion.ts`) theo `hit.phase` 0→1.
- Create: `apps/web/game/systems/gekkaPunchTimeline.ts`: `punchEvents(prev: PokerTableView['dungeon'], next: PokerTableView['dungeon'], now: number): { punchAt: number | null; final: boolean }` (một cú mỗi khi `punchesDone` tăng) — thuần, test được.
- Create: `apps/web/game/entities/GekkaExecutioner.tsx` (đứng trước cột, chạy clip Punch đúng nhịp `punchAt`, cà khịa bằng thoại)
- Create: `apps/web/game/entities/GekkaBasementLight.tsx` (bóng đèn treo chập chờn: nhấp nháy ngẫu nhiên, thỉnh thoảng tắt hẳn 150–400 ms; chỉ đổi cường độ, không thêm/bớt light để tránh biên dịch lại material — như `MuzzleFlash`)
- Modify: `apps/web/game/entities/Avatar.tsx` (người có `seatId` là `gekka-post`/`gekka-cell-*`: chuyển động nền `'Idle'` thay vì `'Sit'`, gọi `applyCaptivePose`)
- Create: `apps/web/game/ui/GekkaCaptureFade.tsx` (màn đen mờ dần trong `POKER_TIMING.captureMs` kèm tiếng bước chân/kéo lê cho người chơi local vừa bị bắt — spec 4.4 chọn chuyển cảnh thay vì hoạt cảnh lôi kéo)
- Modify: `apps/web/components/World.tsx` (`focusOverride` camera cho người chơi local đang trên cột: nhìn chéo thấy cả mình và đao phủ; rung camera ngắn khi có cú đấm cho người đứng trong hầm)
- Test: `apps/web/test/gekka-dungeon.spec.ts` (thêm vào script)

- [ ] **Step 1: Viết test hỏng**: `punchEvents` trả `punchAt` đúng một lần cho mỗi lần `punchesDone` tăng, `final true` ở cú cuối, không phát gì khi người mới vào phòng (lần đọc đầu); `applyCaptivePose` trên rig người chơi thật (`bocchi`, `yui`, cách nạp như `kohaku-npc.spec.ts`): cổ tay cao hơn vai và nằm sau thân (z âm trong hệ model), gọi lặp không cộng dồn, `weight 0` trả về nền.
- [ ] **Step 2:** chạy test → FAIL.
- [ ] **Step 3:** chuyển FBX (`node scripts/prepare-club-motion.mjs --mixamo --file=<tên>.fbx`), cài đặt các file trên.
- [ ] **Step 4:** web test + tsc → PASS. Hình ảnh: **chưa kiểm**.
- [ ] **Checkpoint.**

### Task 13: Âm thanh: tiếng kêu, cú đấm, thoại dealer/đao phủ, không khí hầm

*(Chờ file tiếng kêu — điều kiện tiên quyết 3.)*

**Files:**
- Create: `scripts/prepare-gekka-screams.mjs`: đọc `assets/source/audio/gekka-screams/*` và `gekka-screams.json` (ánh xạ nhân vật → `{ source, pitch }[]`, 4–6 mục, mức `light|heavy`), dùng ffmpeg đổi cao độ (`asetrate`+`atempo`), chuẩn hóa âm lượng, xuất `apps/web/public/assets/audio/gekka/scream-<characterId>-<n>.mp3`; dừng với lỗi nếu thiếu `LICENSE.md`.
- Create: `apps/web/game/systems/gekka-screams.json` (ánh xạ trên, đúng 9 id trong `player-characters.json`)
- Modify: `scripts/generate-bluff-voices.mjs` hoặc tạo `scripts/generate-gekka-voices.mjs` (cùng VOICEVOX, ghi nguồn) cho thoại dealer/đao phủ từ `apps/web/game/systems/gekka-voice-lines.json`
- Create: `apps/web/game/systems/gekkaSfx.ts` (cú đấm: thịch trầm + tiếng thịt, vang hầm bằng ConvolverNode/delay ngắn; ù điện bóng đèn khi nháy; chip/xáo bài — tổng hợp WebAudio như `bluffSfx.ts`)
- Nhạc nền piano jazz cổ tầng trên: một track có giấy phép đặt ở `assets/source/audio/gekka/` + `public/assets/audio/gekka/ambience-piano.mp3`, phát lặp nhỏ khi `zone === 'gekka'` và `y > -1`; nếu chưa có track phù hợp thì bỏ qua và ghi vào báo cáo Task 14 là việc tồn.
- Create: `apps/web/game/systems/useGekkaEffects.ts` (âm theo trạng thái bàn/hầm: xáo bài khi ván mới, chip khi tố, cú đấm + tiếng kêu đúng `characterId` người bị trói, cú nặng dùng mức `heavy`; thoại dealer qua hàng đợi như `createVoiceQueue`; tải sẵn qua warmup)
- Modify: `apps/web/game/ui/kohakuGameRules.ts` (ghi nguồn VOICEVOX và nguồn tiếng kêu nếu giấy phép yêu cầu)
- Test: `apps/web/test/gekka-dungeon.spec.ts`

**Interfaces:**
- Produces: `screamFor(characterId: string, punchIndex: number, total: number, rng?: () => number): string` (url mp3; 2 cú cuối chọn `heavy`) và `gekkaSoundFor(prev, table): { sounds: GekkaSfxKind[]; next }` thuần như `bluffSoundFor`.

- [ ] **Step 1: Viết test hỏng**: `gekka-screams.json` có đúng 9 id trùng `PLAYER_CHARACTERS`, mỗi id 4–6 mục, có ít nhất một `heavy`; mọi file mp3 tham chiếu tồn tại trong `public/assets/audio/gekka/`; `assets/source/audio/gekka-screams/LICENSE.md` tồn tại và nhắc tên từng file nguồn được dùng; `screamFor` cú cuối trả mục `heavy`; `gekkaSoundFor`: không phát lại âm cũ cho người vào giữa trận (seed như Bluff), `punchesDone` tăng → có `'punch'`.
- [ ] **Step 2:** chạy test → FAIL.
- [ ] **Step 3:** chạy `node scripts/prepare-gekka-screams.mjs`, sinh thoại, cài đặt hook/sfx.
- [ ] **Step 4:** web test + tsc → PASS. Âm thanh: **chưa nghe**, nhờ người dùng kiểm.
- [ ] **Checkpoint.**

### Task 14: Cà khịa ở hầm, e2e và tài liệu

**Files:**
- Create: `apps/web/game/systems/useGekkaTauntKeys.ts` (phím 1–4 như `useBluffTauntKeys`; người không ngồi bàn nhắm `'prisoner'`)
- Modify: `apps/web/game/entities/Avatar.tsx` / `World.tsx` (pose cà khịa cho người đứng xem, đích là vị trí cột)
- Modify: e2e hiện có của `pnpm test:e2e` (thêm kịch bản 2 client: vào `gekka`, ngồi, sẵn sàng, một người all-in thua → nhận `dungeon.phase 'capture'`, client kia không nhận được bài tẩy của người khác qua state)
- Create: `docs/reports/2026-11-13-gekka-poker.md` và link trong `docs/README.md`
- Test: `apps/web/test/gekka-poker.spec.ts`

- [ ] **Step 1: Viết test hỏng**: hàm chọn đích cà khịa của người đứng xem trả `'prisoner'` chỉ khi hầm đang hoạt động; pose cà khịa nhắm toạ độ `gekka-post`.
- [ ] **Step 2:** chạy test → FAIL.
- [ ] **Step 3:** cài đặt; viết báo cáo (luật, số liệu, cách chạy, phần chưa kiểm bằng mắt).
- [ ] **Step 4:** `corepack.cmd pnpm build`, `corepack.cmd pnpm typecheck`, `corepack.cmd pnpm test` → PASS; `pnpm test:e2e` (Node/Colyseus qua terminal) với `npm run dev` chạy ở terminal khác → PASS (nếu không chạy được thì ghi rõ "chưa kiểm" và lý do). Không chạy Playwright hoặc tự mở trình duyệt khi chưa được người dùng cho phép rõ ràng.
- [ ] **Checkpoint cuối:** chạy `gitnexus_detect_changes()` trước khi người dùng yêu cầu commit.
