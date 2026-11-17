# Kohaku Bluff: cà khịa, giọng Shinku, dàn cảnh bóp cò. Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ván nói dối ở bàn Kohaku có thêm ba thứ, làm theo thứ tự A → B → C:
- A. Người chơi cà khịa nhau bằng động tác kèm âm thanh.
- B. Dealer Shinku nói tiếng Nhật kiểu anime và nhìn người chơi.
- C. Lúc bóp cò có đèn tối, spotlight, tiếng tim đập và camera đẩy sát.

**Architecture:**
- Server: cà khịa là một message thoáng qua. Engine `kohakuBluff.ts` chỉ kiểm điều kiện và cooldown, room broadcast `tauntFx`, không đụng Schema.
- Client: mọi quyết định "phát gì, khi nào" là hàm thuần trong `apps/web/game/systems/` để test được. Phần React/WebAudio chỉ là lớp mỏng gọi các hàm đó.
- Giọng: tạo offline bằng VOICEVOX, xuất ra MP3 tĩnh để commit, phát qua chung `AudioContext` với `bluffSfx`.

**Tech Stack:** TypeScript, Colyseus 0.16, Next.js 15 + React Three Fiber, three.js, WebAudio, Node test runner (`tsx --test`), Docker (VOICEVOX Engine), ffmpeg.

**Spec:** `docs/superpowers/specs/2026-11-12-kohaku-bluff-tension-design.md`. Người làm phải đọc spec cùng với kế hoạch này.

## Global Constraints

- Luật nằm trong `apps/world-server/src/systems/kohakuBluff.ts`. Room `kohaku.room.ts` chỉ nối message. Kiểu và hằng số dùng chung đặt ở `packages/game-protocol/src/kohaku-bluff.ts`.
- Hành vi web mới đặt trong `apps/web/game/systems/`. `World.tsx` chỉ nối dây.
- Cooldown cà khịa là 3000 ms mỗi người, kiểm ở server.
- Điều kiện cà khịa:
  - Người gửi phải `inMatch && alive`.
  - Pha `turn` và `reveal`: luôn được, kể cả khi đang tới lượt mình.
  - Pha `shooting` và `result`: được, trừ khi `shooterSeat` là ghế mình.
  - Pha `lobby` và `gameOver`: không được.
  - Đích phải là ghế khác mình và đang `inMatch && alive`.
- Trong pha `shooting`, cà khịa chỉ có động tác, không có âm thanh.
- Không có nút tắt cà khịa (người dùng đã chốt).
- Không lộ thông tin ẩn: giọng và hiệu ứng chỉ dựa vào dữ liệu đã công khai (`revealed`, `pulls`, `shotResult`).
- Không dùng dịch vụ trả phí, không gọi mạng khi chơi. Giọng là file MP3 tĩnh trong `apps/web/public/assets/audio/kohaku-bluff/`. Nguồn và giấy phép đặt ở `assets/source/audio/kohaku-bluff-voices/LICENSE.md`.
- Không commit file nào có giấy phép chưa rõ ràng.
- Spec mới phải được thêm vào script `test` của package, nếu không sẽ không chạy. Dùng các spec có sẵn: `packages/game-protocol/test/kohaku-bluff.spec.ts`, `apps/world-server/test/kohaku-bluff.spec.ts`, `apps/web/test/kohaku-bluff.spec.ts`.
- Lệnh pnpm dùng `corepack.cmd pnpm ...`. Sau khi sửa game-protocol phải build lại nó, vì các app đọc từ `dist/`.
- Không chạy Playwright hay trình duyệt khi người dùng chưa cho phép.
- Trước khi sửa một symbol có sẵn (ví dụ `applyBluffPose`, `useBluffEffects`, `createKohakuBluff`, `CameraFocusOverride`, `KohakuNpc`), chạy `gitnexus_impact` (upstream) theo `CLAUDE.md`. Nếu kết quả là HIGH hoặc CRITICAL thì báo người dùng.
- **Không commit.** Người dùng chỉ commit khi tự yêu cầu, nên kế hoạch không có bước commit.
- Chú thích code viết bằng tiếng Việt, giải thích *vì sao*, theo đúng giọng của repo.

## Review Focus

1. **Người chơi bị loại hoặc rời ghế giữa ván vẫn gửi cà khịa.** Phải bị bỏ qua. Đích là người đã chết cũng bị bỏ qua. → test ở Task 2.
2. **Người vào phòng giữa ván (seed).** Không được nghe lại câu thoại hay tim đập của chuyển trạng thái cũ. → test `bluffVoiceFor` chưa seed ở Task 6.
3. **Đổi zone khi đang có giọng hoặc tim đập.** Âm thanh phải dừng và hàng đợi phải xóa ngay. → test `createVoiceQueue().clear()` ở Task 6, test dừng tim đập ở Task 8.
4. **Lật bài khi hết bài (`accuserSeat` rỗng, `shooterSeat` rỗng).** Không có câu "hô dối", không vào bóp cò, không có tim đập. → test ở Task 6 và Task 8.
5. **Cà khịa khi `tauntFx` tới trước lúc avatar đích tồn tại, hoặc khi đang `aim`/`slump`.** `aim`/`slump` phải thắng, không được crash. → test `resolveAvatarPose` ở Task 4.

---

## Phần A: Cà khịa

### Task 1: Hằng số và chuẩn hóa cà khịa trong game-protocol

**Files:**
- Modify: `packages/game-protocol/src/kohaku-bluff.ts`
- Test: `packages/game-protocol/test/kohaku-bluff.spec.ts`

**Interfaces:**
- Produces:
  - `export type BluffTauntKind = 'flip' | 'point' | 'slam' | 'laugh'`
  - `export const BLUFF_TAUNTS: Readonly<Record<BluffTauntKind, { label: string; key: string; durationMs: number }>>`, với giá trị:
    - `flip`: `{ label: 'Giơ ngón giữa', key: '1', durationMs: 1500 }`
    - `point`: `{ label: 'Chỉ mặt', key: '2', durationMs: 1500 }`
    - `slam`: `{ label: 'Đập bàn', key: '3', durationMs: 1200 }`
    - `laugh`: `{ label: 'Cười khẩy', key: '4', durationMs: 1600 }`
  - `BLUFF_TIMING.tauntCooldownMs = 3000`, thêm vào object `BLUFF_TIMING` sẵn có.
  - `BLUFF_MESSAGES.taunt = 'bluff-taunt'` và `BLUFF_MESSAGES.tauntFx = 'bluff-taunt-fx'`.
  - `export type BluffTauntInput = { kind: BluffTauntKind; targetSeat: string }`
  - `export type BluffTauntFx = { seatId: string; kind: BluffTauntKind; targetSeat: string }`
  - `export function normalizeBluffTaunt(input: unknown): BluffTauntInput | null`

- [ ] **Step 1: Viết test lỗi**
  - Test `'normalizeBluffTaunt nhận kind hợp lệ và targetSeat là ghế Bluff'`:
    - `normalizeBluffTaunt({ kind: 'flip', targetSeat: BLUFF_SEATS[1] })` deepEqual `{ kind: 'flip', targetSeat: BLUFF_SEATS[1] }`.
    - Trả `null` với: `null`, `'flip'`, `{ kind: 'kiss', targetSeat: BLUFF_SEATS[1] }`, `{ kind: 'flip' }`, `{ kind: 'flip', targetSeat: 'kohaku-dealer' }`, `{ kind: 'flip', targetSeat: 42 }`.
  - Test `'BLUFF_TAUNTS dùng phím 1-4 không trùng'`: các `key` deepEqual `['1','2','3','4']`.
- [ ] **Step 2: Chạy** `corepack.cmd pnpm --filter @metaverse/game-protocol test`. Kỳ vọng FAIL vì `normalizeBluffTaunt` chưa được export.
- [ ] **Step 3: Cài đặt.** Thêm các hằng số và kiểu ở trên. `normalizeBluffTaunt` chỉ nhận object có `kind` thuộc `BLUFF_TAUNTS` và `targetSeat` thuộc `BLUFF_SEATS`. Trả object mới, không trả lại input.
- [ ] **Step 4: Chạy lại test protocol, kỳ vọng PASS.** Sau đó chạy `corepack.cmd pnpm --filter @metaverse/game-protocol build`.

### Task 2: Engine và room xử lý cà khịa

**Files:**
- Modify: `apps/world-server/src/systems/kohakuBluff.ts`, thêm method vào object trả về
- Modify: `apps/world-server/src/rooms/kohaku.room.ts`, thêm `onMessage(BLUFF_MESSAGES.taunt)`
- Test: `apps/world-server/test/kohaku-bluff.spec.ts`

**Interfaces:**
- Consumes: `normalizeBluffTaunt`, `BluffTauntFx`, `BLUFF_TIMING.tauntCooldownMs` từ Task 1.
- Produces: `taunt(sessionId: string, input: unknown, now: number): BluffTauntFx | null` trên engine.
  - Engine giữ thời điểm cà khịa cuối của từng session trong closure, giống `bullets`.
  - Khi về lobby (`backToLobby`) thì xóa dữ liệu cooldown.
  - Engine không đổi bất cứ trường nào của `table`.
- Room: gọi `engine.taunt(...)`; nếu kết quả khác `null` thì `this.broadcast(BLUFF_MESSAGES.tauntFx, fx)`. Không gọi `syncBluff()`, vì bàn không đổi.

- [ ] **Step 1: Viết test lỗi.** Dùng `setup`/`startAll` có sẵn trong spec.
  - `'taunt hợp lệ ở pha turn, kể cả người đang tới lượt'`:
    - Sau `startAll`, cả người có `turnSeat` lẫn người còn lại gọi `taunt(id, { kind: 'flip', targetSeat: <ghế người kia> }, 0)`, mỗi người dùng `now` khác nhau.
    - Kết quả deepEqual `{ seatId, kind: 'flip', targetSeat }`.
    - `JSON.stringify(ctx.table)` không đổi so với trước khi gọi.
  - `'taunt bị chặn: cooldown 3s'`: gọi lần hai ở `now = 2999` trả `null`; ở `now = 3000` trả kết quả.
  - `'taunt bị chặn: lobby, gameOver, tự nhắm mình, đích không trong ván, người gửi đã chết'`: mỗi trường hợp trả `null`.
  - `'taunt bị chặn với người cầm súng ở shooting/result, người khác vẫn được'`:
    - Đưa ván tới `shooting` theo đúng cách các test bắn hiện có làm (ép `firstRng`, úp bài, `callLiar`, `tick` qua `revealMs`).
    - `taunt` của `shooter` trả `null`; của người kia trả kết quả.
    - Lặp lại ở pha `result`.
  - `'taunt ở reveal được, kể cả người sắp bị bắn'`.
- [ ] **Step 2: Chạy** `corepack.cmd pnpm --filter @metaverse/world-server exec tsx --test test/kohaku-bluff.spec.ts`. Kỳ vọng FAIL vì `taunt` không tồn tại.
- [ ] **Step 3: Cài `taunt` trong engine theo Global Constraints, và thêm `onMessage` trong room.** Room chặn sớm khi payload không phải object, giống handler `play`.
- [ ] **Step 4: Chạy lại test, kỳ vọng PASS.** Chạy thêm `corepack.cmd pnpm --filter @metaverse/world-server typecheck`.

### Task 3: Client gửi/nhận cà khịa, HUD và phím tắt

**Files:**
- Modify: `apps/web/game/systems/kohakuBluffView.ts`, thêm hàm thuần
- Modify: `apps/web/game/networking/useCityConnection.ts`
- Modify: `apps/web/game/ui/kohakuGameRules.ts`, thêm 1 dòng luật về cà khịa và phím 1–4
- Modify: `apps/web/components/World.tsx`, chỉ truyền props
- Test: `apps/web/test/kohaku-bluff.spec.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `canTauntNow(table: BluffTableView, sessionId: string): boolean`. Phản chiếu đúng điều kiện phía server, trừ cooldown.
  - `defaultTauntTarget(table: BluffTableView, mySeat: string): string`. Trả `''` nếu không có đích. Quy tắc:
    - Pha `turn`: lấy `turnSeat` nếu khác ghế mình. Nếu đang là lượt mình thì lấy `lastPlay.seatId` khi khác `''` và khác mình. Nếu không có thì lấy ghế sống kế tiếp theo thứ tự `table.seats`.
    - Các pha sau: lấy `shooterSeat` nếu khác mình, nếu không thì lấy ghế sống kế tiếp.
    - Ghế được chọn phải `inMatch && alive`.
  - `useCityConnection` trả thêm:
    - `bluffTaunt(kind: BluffTauntKind, targetSeat: string): void`
    - `bluffTaunts: { fx: BluffTauntFx; at: number }[]`. Đây là danh sách sự kiện mới nhận, `at = performance.now()`. Chỉ giữ các mục còn trong `durationMs`; dọn khi nhận sự kiện mới, và xóa sạch khi đổi phòng giống `setBluffHand([])`.
  - **Không có UI chọn cà khịa** (người dùng chốt). Tạo `apps/web/game/systems/useBluffTauntKeys.ts` với `useBluffTauntKeys(table, sessionId, taunt, enabled)`.
    - Phím `1`–`4` (theo `BLUFF_TAUNTS[kind].key`) gửi `taunt(kind, defaultTauntTarget(table, mySeat))` khi `canTauntNow`. Không gửi khi đang gõ trong input/textarea, khi `event.repeat`, hoặc khi đích là `''`.
    - Không cần cooldown phía client; server tự chặn.
    - `World.tsx` gọi hook với `enabled = zone === 'kohaku'`.
  - Bỏ file `KohakuBluffHud.tsx` và `style.css` khỏi task này.

- [ ] **Step 1: Viết test lỗi**
  - `'canTauntNow theo pha và người cầm súng'`:
    - Pha `turn`, đang lượt mình: `true`.
    - `lobby`: `false`.
    - `shooting` với `shooterSeat` là mình: `false`; là người khác: `true`.
    - Mình `alive=false`: `false`.
  - `'defaultTauntTarget'`:
    - Lượt người khác: trả `turnSeat`.
    - Lượt mình, có `lastPlay` của người khác: trả ghế đó.
    - Lượt mình, `lastPlay.seatId=''`: trả ghế sống kế tiếp.
    - `shooting`: trả `shooterSeat`.
    - Mình là shooter: trả ghế sống kế tiếp.
    - Không bao giờ trả ghế mình hoặc ghế đã chết.
- [ ] **Step 2: Chạy** `corepack.cmd pnpm --filter @metaverse/web exec tsx --test test/kohaku-bluff.spec.ts`. Kỳ vọng FAIL.
- [ ] **Step 3: Cài các hàm thuần, nối dây trong `useCityConnection`, HUD, style và luật chơi.**
- [ ] **Step 4: Chạy lại test, kỳ vọng PASS.** Chạy thêm `corepack.cmd pnpm --filter @metaverse/web typecheck`.

### Task 4: Động tác cà khịa trên avatar

**Files:**
- Modify: `apps/web/game/systems/bluffPose.ts`
- Create: `apps/web/game/systems/useBluffTaunts.ts`. Hook này gom `bluffTaunts` thành pose cho từng session.
- Modify: `apps/web/game/entities/Avatar.tsx`
- Modify: `apps/web/components/World.tsx`
- Test: `apps/web/test/kohaku-bluff.spec.ts`

**Interfaces:**
- Consumes: `bluffTaunts` từ Task 3, `KOHAKU_SEATS`.
- Produces:
  - `export type BluffPose = 'aim' | 'slump' | 'flip' | 'point' | 'slam' | 'laugh' | null`.
  - `applyBluffPose(root, pose, weight, target?: Vector3)`. Tham số `target` là vị trí thế giới của ghế đích ở độ cao đầu ngồi. Với `flip`/`point`, cánh tay phải và thân trên xoay về `target`. Không có `target` thì giơ thẳng về phía trước.
  - Cong ngón tay:
    - `flip`: mọi ngón phải nắm, trừ `RightHandMiddle1-3` duỗi thẳng.
    - `point`: tương tự nhưng ngón duỗi là `RightHandIndex1-3`.
  - `slam`: hai tay (`Left*` và `Right*`) hạ xuống mặt bàn, cổ tay ở khoảng độ cao bàn. Thêm xương tay trái vào `ALL_NAMES` để reset nền đúng cách.
  - `laugh`: đầu nghiêng khoảng 0.25 rad, tay phải đưa lên gần miệng, vai rung bằng sin theo thời gian. Truyền thời gian qua tham số `t?: number`.
  - `export function resolveAvatarPose(shooterPose: BluffPose, taunt: BluffPose): BluffPose`. Trả `shooterPose` nếu khác `null`, nếu không thì trả `taunt`.
  - `useBluffTaunts(taunts, seats: BluffSeatView[], nowMs: () => number)` trả `Record<sessionId, { pose: BluffPose; target: { x: number; y: number; z: number } }>`. Mỗi session chỉ có động tác mới nhất; hết `durationMs` thì bỏ.
  - `Avatar`/`PlayerModel` nhận thêm `bluffTarget?: { x: number; y: number; z: number }`. `World.tsx` truyền `bluffPose={resolveAvatarPose(session === shooterSession ? shooterPose : null, taunts[session]?.pose ?? null)}` và `bluffTarget={taunts[session]?.target}`. Hai biến `shooterSession` và `shooterPose` đã có sẵn trong `World.tsx`.

- [ ] **Step 1: Viết test lỗi.** Dùng helper GLB có sẵn trong spec, như các test `applyBluffPose` hiện tại.
  - `'flip duỗi ngón giữa, các ngón khác cong, trên mọi player GLB'`: sau `applyBluffPose(root, 'flip', 1, target)`, góc giữa `RightHandMiddle2` và nền nhỏ hơn 0.2 rad, còn `RightHandIndex2` và `RightHandRing2` cong hơn 0.6 rad. Lặp cho mọi `PLAYER_CHARACTERS`.
  - `'point hướng ngón trỏ về đích'`: vector từ `RightHand` tới `RightHandIndex3` tạo với hướng tới `target` một góc nhỏ hơn 0.5 rad.
  - `'weight 0 trả xương về nền sau slam'`: quaternion mọi xương trùng với nền.
  - `'resolveAvatarPose: aim/slump luôn thắng'`: `('aim','flip') → 'aim'`, `(null,'flip') → 'flip'`, `(null,null) → null`.
- [ ] **Step 2: Chạy test web Bluff. Kỳ vọng FAIL.**
- [ ] **Step 3: Cài đặt.** Dùng lại `findBone`, `rotateWorld`, `aimBone` và cơ chế `states` có sẵn. Không nhân bản logic reset nền.
- [ ] **Step 4: Chạy lại test, kỳ vọng PASS.** Chạy thêm typecheck web.

## Phần B: Giọng Shinku

### Task 5: Sản xuất file giọng bằng VOICEVOX

**Files:**
- Create: `apps/web/game/systems/bluff-voice-lines.json`
- Create: `scripts/generate-bluff-voices.mjs`
- Create: `apps/web/public/assets/audio/kohaku-bluff/*.mp3`. Các file này là đầu ra và được commit.
- Create: `assets/source/audio/kohaku-bluff-voices/LICENSE.md`
- Modify: root `package.json`, thêm script `"voices:bluff": "node scripts/generate-bluff-voices.mjs"`.

**Interfaces:**
- Produces: mảng JSON `{ id: string; group: BluffVoiceGroup /* union các nhóm dưới đây, export từ bluffVoice.ts ở Task 6 */; speaker: 'dealer' | 'taunt'; ja: string; vi: string }[]`.
  - Nhóm của dealer: `welcome`, `rank-K`, `rank-Q`, `rank-A`, `liar-called`, `reveal-truth`, `reveal-lie`, `shooting`, `click`, `bang`, `two-left`, `winner`.
  - Nhóm cà khịa: `taunt-flip`, `taunt-point`, `taunt-laugh`.
  - Mỗi nhóm có 2–3 câu. Câu mẫu lấy theo bảng trong spec. Giọng của dealer điềm tĩnh, lịch sự, hơi lạnh.
  - File `apps/web/public/assets/audio/kohaku-bluff/<id>.mp3` cho mọi `id`.
  - `speakerId` của VOICEVOX ghi trong script: map `dealer` và `taunt` sang id style số.

- [ ] **Step 1: Đọc điều khoản của speaker trước khi chọn.** Gợi ý ban đầu: 冥鳴ひまり cho `dealer`, 春日部つむぎ cho `taunt`. Xem điều khoản của từng nhân vật trên trang chính thức. Speaker phải cho phép dùng miễn phí khi ghi nguồn, và không cấm nội dung bạo lực hay lời trêu chọc. Nếu bị cấm thì làm theo thứ tự dự phòng trong spec: đổi speaker → viết lại câu → bỏ nhóm câu đó và báo lại. Ghi kết quả vào `LICENSE.md` gồm: `VOICEVOX:<tên>`, link điều khoản, ngày đọc.
- [ ] **Step 2: Viết `bluff-voice-lines.json` và script.**
  - Script đọc JSON, rồi gọi `POST /audio_query?text=…&speaker=…` và `POST /synthesis?speaker=…` tới `http://127.0.0.1:50021`.
  - Ghi WAV vào `test-results/tmp/voices/`, rồi chạy `ffmpeg -y -i in.wav -ac 1 -b:a 96k out.mp3`.
  - Bỏ qua file MP3 đã tồn tại, trừ khi có cờ `--force`.
  - Nếu không kết nối được engine thì báo lỗi rõ ràng, có kèm lệnh docker.
- [ ] **Step 3: Chạy engine.** Lệnh: `docker run --rm -d -p 127.0.0.1:50021:50021 --name voicevox voicevox/voicevox_engine:<tag CPU cụ thể>`. Tag phải ghim cụ thể, ra đời ít nhất 2 tuần; ghi tag này trong `LICENSE.md` và trong chú thích đầu script. Kiểm bằng `curl http://127.0.0.1:50021/version`.
- [ ] **Step 4: Chạy** `node scripts/generate-bluff-voices.mjs`. Kỳ vọng có đủ một MP3 cho mỗi `id`, mỗi file từ 2 KB đến 200 KB. Kiểm bằng `ls -la apps/web/public/assets/audio/kohaku-bluff`.
- [ ] **Step 5: Dọn.** Chạy `docker stop voicevox`, rồi xóa `test-results/tmp/voices/`.

### Task 6: Chọn câu và phát giọng (Shinku + âm cà khịa)

**Files:**
- Create: `apps/web/game/systems/bluffVoice.ts`. File này chứa hàm thuần chọn câu, hàng đợi, và phần tải/phát WebAudio.
- Modify: `apps/web/game/systems/bluffSfx.ts`:
  - Export `bluffAudioContext()`, chính là hàm `audio()` hiện tại, để giọng dùng chung context.
  - Thêm kind `'slam'` vào `playBluffSfx`.
- Modify: `apps/web/game/systems/useBluffEffects.ts`. Gọi thêm `bluffVoiceFor` và đẩy kết quả vào hàng đợi. Phát âm cà khịa khi có `tauntFx` mới.
- Modify: `apps/web/game/systems/ClubAssetWarmup.tsx`. Tải trước và decode mọi MP3 giọng; tính vào `total` như một mục `'kohaku-bluff-voices'`, có nhãn thân thiện.
- Modify: `apps/web/components/World.tsx`. Truyền `bluffTaunts` vào `useBluffEffects`.
- Test: `apps/web/test/kohaku-bluff.spec.ts`

**Interfaces:**
- Consumes: JSON từ Task 5, `bluffTaunts` từ Task 3, `isBluffTruthful` từ game-protocol.
- Produces:
  - `export type BluffVoiceState = { phase: string; shot: string; alive: number; seeded: boolean }`
  - `export function bluffVoiceFor(prev: BluffVoiceState, table: BluffTableView): { groups: BluffVoiceGroup[]; next: BluffVoiceState }`. Mỗi lần trả về tối đa 2 nhóm, đúng thứ tự:
    - `lobby → turn`: `['welcome', 'rank-<tableRank>']`.
    - Vào `turn` từ pha khác `lobby`: `['rank-<tableRank>']`.
    - Vào `reveal` với `accuserSeat !== ''`: `['liar-called', truthful ? 'reveal-truth' : 'reveal-lie']`. Với `accuserSeat === ''`: chỉ câu lật bài.
    - Vào `shooting`: `['shooting']`.
    - `shotResult` đổi sang `click`: `['click']`. Đổi sang `bang`: `['bang']`, thêm `'two-left'` nếu số ghế `inMatch && alive` bằng 2.
    - Vào `gameOver`: `['winner']`.
    - Chưa seed: cùng quy tắc như `bluffSoundFor`, tức không phát gì.
  - `export function pickVoiceLine(group: BluffVoiceGroup, rng?: () => number): string`. Trả `id` của câu; không lặp lại câu vừa phát của nhóm đó khi nhóm có từ 2 câu trở lên.
  - `export function tauntSound(kind: BluffTauntKind, phase: BluffPhase): { voice?: BluffVoiceGroup; sfx?: 'slam' } | null`. Pha `shooting` trả `null`. `slam` trả `{ sfx: 'slam' }`. Các kind còn lại trả `{ voice: 'taunt-<kind>' }`.
  - `export function createVoiceQueue(play: (id: string, onEnd: () => void) => () => void)` trả `{ push(ids: string[]): void; clear(): void }`.
    - Phát nối tiếp từng câu, tối đa 3 câu đang chờ; khi đầy thì bỏ câu cũ nhất chưa phát.
    - `clear()` dừng câu đang phát và xóa hàng chờ.
    - Câu cà khịa đi kênh riêng, phát ngay, không vào hàng đợi của Shinku.
  - `preloadBluffVoices(): Promise<void>` và `playBluffVoice(id: string, onEnd: () => void): () => void`. Cả hai dùng `bluffAudioContext()` và cache `AudioBuffer` theo id. Cache sống suốt phiên.
  - `useBluffEffects(table, enabled, taunts)`: khi `enabled` chuyển `false` thì gọi `queue.clear()`.

- [ ] **Step 1: Viết test lỗi**
  - `'bluffVoiceFor: chưa seed thì im, seed xong mới phản ứng'`.
  - `'bluffVoiceFor: lobby→turn chào rồi báo lá chủ theo tableRank'`.
  - `'bluffVoiceFor: reveal có người hô; lật bài khi hết bài thì không có liar-called'`.
  - `'bluffVoiceFor: không phản ứng thật/dối khi còn ở turn'`. Đổi `lastPlay.count` trong pha `turn` thì `groups` phải rỗng.
  - `'bluffVoiceFor: bang còn 2 người → bang rồi two-left; vào gameOver → winner'`.
  - `'tauntSound: shooting im lặng, slam là sfx'`.
  - `'createVoiceQueue phát lần lượt, giữ tối đa 3 chờ, clear dừng ngay'`. Dùng `play` giả để ghi lại thứ tự phát, và gọi `onEnd` thủ công.
  - `'mọi id trong bluff-voice-lines.json có file mp3'`: đọc JSON rồi kiểm `existsSync` cho từng file.
- [ ] **Step 2: Chạy test web Bluff. Kỳ vọng FAIL.**
- [ ] **Step 3: Cài `bluffVoice.ts`, thêm `slam` vào `bluffSfx`, nối `useBluffEffects` và warmup.**
- [ ] **Step 4: Chạy lại test, kỳ vọng PASS.** Chạy thêm typecheck web.

### Task 7: Shinku nhìn người chơi; Hinata và Bartender quay nhìn khi súng nổ

**Files:**
- Modify: `apps/web/game/entities/KohakuNpc.tsx`, thêm prop `focus`
- Modify: `apps/web/game/systems/kohakuNpcMotion.ts`, thêm `headYaw?: number` vào `KohakuNpcPoseOptions`
- Create: `apps/web/game/systems/kohakuNpcFocus.ts`, chứa hàm thuần chọn điểm nhìn
- Modify: `apps/web/game/scenes/KohakuScene.tsx`, truyền `focus` từ `bluff`
- Test: `apps/web/test/kohaku-npc.spec.ts` (đã có trong script test)

**Interfaces:**
- Produces:
  - `export function npcFocus(id: KohakuNpcId, table: BluffTableView, bangAgeMs: number): { x: number; z: number } | null`.
    - `shinku`: pha `turn` thì nhìn ghế `turnSeat`; các pha `reveal`, `shooting`, `result` thì nhìn ghế `shooterSeat`, nếu rỗng thì nhìn `lastPlay.seatId`. Các trường hợp khác trả `null`.
    - `hinata` và `bartender`: nhìn tâm bàn `{ x: 0, z: 0 }` khi `bangAgeMs` nằm trong khoảng 0 đến 3000, ngoài ra trả `null`.
  - `KohakuNpc` nhận `focus?: { x: number; z: number } | null`.
    - Khi có focus: tính góc lệch giữa hướng tới focus và `yaw` hiện tại, kẹp trong ±0.9 rad.
    - Truyền góc này làm `headYaw` cho `motion.update`. Motion xoay cổ/đầu VRM thêm góc đó, có làm mượt. Không xoay toàn thân Shinku khi đang ngồi.
  - Scene tự đo `bangAgeMs`: ghi `performance.now()` lúc `shotResult` chuyển sang `'bang'`.

- [ ] **Step 1: Viết test lỗi** cho `npcFocus`, gồm từng nhánh trên, và trả `null` khi ở lobby.
- [ ] **Step 2: Chạy** `corepack.cmd pnpm --filter @metaverse/web exec tsx --test test/kohaku-npc.spec.ts`. Kỳ vọng FAIL.
- [ ] **Step 3: Cài đặt** `npcFocus`, `headYaw` trong motion (dùng `vrm.humanoid` để lấy xương `neck`/`head`), prop `focus` và nối dây trong scene.
- [ ] **Step 4: Chạy lại test, kỳ vọng PASS.** Chạy thêm typecheck web.

## Phần C: Dàn cảnh bóp cò

### Task 8: Đèn, spotlight, tim đập, camera đẩy sát

**Files:**
- Create: `apps/web/game/systems/bluffStaging.ts`, chứa hàm thuần
- Create: `apps/web/game/entities/BluffStagingLights.tsx`. Component này giữ spotlight và làm mờ các đèn của scene.
- Modify: `apps/web/game/scenes/KohakuScene.tsx`
  - Bọc các đèn hiện có trong một `<group ref>` để component trên duyệt và nhân intensity.
  - Mount `BluffStagingLights`.
- Modify: `apps/web/game/systems/bluffSfx.ts`, thêm `startHeartbeat(bpm: number): () => void`
- Modify: `apps/web/game/systems/useBluffEffects.ts`, bật/tắt tim đập
- Modify: `apps/web/game/systems/FollowCamera.tsx`, `apps/web/components/World.tsx`. Mở rộng `CameraFocusOverride` thêm `push?: number` (0..1), rồi rút ngắn `CLOSEUP_DISTANCE` theo `1 - 0.15 * push`.
- Test: `apps/web/test/kohaku-bluff.spec.ts`

**Interfaces:**
- Produces:
  - `export function heartbeatBpm(pulls: number): number` = `70 + 18 * pulls`, kẹp `pulls` trong khoảng 0..5.
  - `export function heartbeatActive(table: BluffTableView): boolean`: `true` khi `phase === 'shooting'` và `shotResult === ''` và `shooterSeat !== ''`.
  - `export function stagingDim(table: BluffTableView): number`: trả hệ số đèn mục tiêu, `0.25` khi pha là `shooting` hoặc `result` và có `shooterSeat`, ngược lại `1`. Component nội suy hệ số này trong 0.6 s.
  - `export function closeupPush(phaseStartMs: number, nowMs: number, suspenseMs: number): number`: tăng tuyến tính từ 0 lên 1 trong `suspenseMs`, kẹp trong 0..1.
  - Spotlight: màu `#fff1d6`, đặt ở `(seat.x, 3.2, seat.z)`, chiếu xuống ghế người cầm súng. Cường độ do người làm chọn để thấy rõ khi đèn đã mờ.

- [ ] **Step 1: Viết test lỗi**
  - `heartbeatBpm(0) === 70`, `heartbeatBpm(5) === 160`, `heartbeatBpm(9) === 160`.
  - `heartbeatActive` là `false` khi lật bài lúc hết bài (`shooterSeat` rỗng) và khi đã có `shotResult`.
  - `stagingDim` của `turn` bằng `1`, của `shooting` bằng `0.25`.
  - `closeupPush(0, 1000, 2000) === 0.5`, `closeupPush(0, 5000, 2000) === 1`.
- [ ] **Step 2: Chạy test web Bluff. Kỳ vọng FAIL.**
- [ ] **Step 3: Cài đặt.**
  - Tim đập dùng `bluffAudioContext()`, mỗi nhịp là hai tiếng "thịch" trầm (lowpass khoảng 120 Hz) cách nhau khoảng 0.18 s.
  - Hàm `stop` phải dừng ngay, kể cả khi đổi zone (`enabled` chuyển `false`).
  - Đèn lấy hệ số `stagingDim`, nhân vào intensity gốc (lưu ở `userData` lúc mount, để không bị nhân dồn).
- [ ] **Step 4: Chạy lại test, kỳ vọng PASS.** Chạy thêm typecheck web.

### Task 9: Kiểm chứng toàn bộ

- [ ] **Step 1:** Chạy `corepack.cmd pnpm typecheck`. Kỳ vọng exit 0.
- [ ] **Step 2:** Chạy `corepack.cmd pnpm test`. Kỳ vọng mọi spec PASS. Nếu có lỗi, dán nguyên output vào báo cáo.
- [ ] **Step 3:** Chạy `corepack.cmd pnpm build`. Kỳ vọng exit 0.
- [ ] **Step 4:** Chạy `gitnexus_detect_changes()` để xác nhận phạm vi thay đổi chỉ gồm các symbol dự kiến.
- [ ] **Step 5:** Báo người dùng. Phần nhìn và nghe (động tác, giọng, đèn, tim đập) ghi là **chưa kiểm bằng mắt**, trừ khi người dùng cho phép chạy trình duyệt. Hướng dẫn tự kiểm: chạy `npm run dev`, mở 2 tab, cho cả hai ngồi ghế Bluff, rồi thử phím 1–4 và một lần bóp cò.
