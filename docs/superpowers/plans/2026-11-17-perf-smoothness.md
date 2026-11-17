# Tối ưu độ mượt khi chơi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giảm chi phí mỗi frame và VRAM khi đang chơi, giữ cơ chế tải toàn bộ ban đầu và giữ đồ họa gần như nguyên vẹn.

**Architecture:** Bốn thay đổi độc lập: (1) giữ identity state mạng ổn định để React bỏ qua render thừa, (2) "pool" số đèn cố định ở Kohaku chọn các đèn gần người chơi, (3) script thu nhỏ texture >1024px trong GLB/VRM tại chỗ + chạy script meshopt sẵn có cho file chưa nén, (4) header cache cho `/assets` ở production + báo cáo hướng dẫn đo.

**Tech Stack:** Next.js 15, React Three Fiber, three.js, Node test runner (`tsx --test`), sharp (đi kèm `@gltf-transform/cli`).

**Spec:** `docs/superpowers/specs/2026-11-17-perf-smoothness-design.md`

## Số liệu khảo sát (2026-11-17)
- Texture >1024px chỉ có ở 4 VRM Gekka (`aos`, `espeon`, `lindsay`, `rina`: 8–11 ảnh 2048² mỗi file, ~38 ảnh ≈ 600MB+ VRAM có mipmap). Các nhân vật khác đã ≤1024. `rosetta-restored.glb` không được runtime dùng → bỏ qua.
- Chưa nén meshopt: 9 VRM `club-local` (trừ `shinku`), `player/mint.glb`, `player/yui.glb` và các player GLB nhỏ. Dung lượng chủ yếu là hình học + morph target (399–560 morph/VRM), không phải texture.
- Đèn: chỉ Kohaku vượt ngân sách (16 `pointLight` trong group `roomLights`, `KohakuScene.tsx:66-98`); three.js tính mọi đèn cho mọi pixel bất kể `distance`.

## Global Constraints
- Không commit/push trừ khi người dùng yêu cầu (quy tắc người dùng) — bước "Commit" trong plan thay bằng kiểm chứng.
- Không xóa asset nguồn; bản gốc trước khi ghi đè lưu ở `assets/processed/`.
- Không tự chạy trình duyệt/Playwright (AGENTS.md).
- Spec test mới phải thêm vào script `test` trong `apps/web/package.json`.
- Trước khi sửa symbol: chạy `gitnexus_impact` (upstream) và báo mức rủi ro.
- Chú thích code bằng tiếng Việt, giải thích "vì sao".

## Review Focus
1. Đèn Kohaku khi đang có màn bóp cò (`BluffStagingLights`): phòng phải tối đúng `STAGING_DIM`, không nhấp nháy khi pool đổi đèn — test ở Task 2.
2. Số đèn trong scene không bao giờ đổi khi người chơi di chuyển (đổi số đèn = biên dịch lại shader = khựng) — test ở Task 2.
3. VRM sau khi resize vẫn giữ extension `VRM`/`VRMC_*`, số lượng images/textures/materials giữ nguyên — test ở Task 3.
4. File đã nén meshopt (Gekka) resize xong vẫn hợp lệ: offset của `EXT_meshopt_compression` trỏ đúng sau khi dồn lại buffer — test ở Task 3.
5. Dev không bị cache asset cũ khi đang sửa GLB — Task 4 chỉ bật header ở production.

---

### Task 1: Giữ identity state mạng ổn định

**Files:**
- Create: `apps/web/game/networking/stableState.ts`
- Modify: `apps/web/game/networking/useCityConnection.ts:45-55` (hàm `update`)
- Modify: `apps/web/game/entities/Avatar.tsx` (bọc `memo`)
- Test: `apps/web/test/stable-state.spec.ts` (thêm vào script `test`)

**Interfaces:**
- Produces: `keepIfEqual<T>(previous: T, next: T): T` — trả `previous` nếu bằng nhau theo cấu trúc (so sánh sâu cho object/array/primitive), ngược lại `next`.
- Produces: `reusePlayers(previous: Record<string, PositionSnapshot>, next: Record<string, PositionSnapshot>): Record<string, PositionSnapshot>` — giữ object từng người không đổi; trả `previous` nếu không ai đổi và không thêm/bớt.

- [ ] **Step 1: Viết test thất bại** — `keepIfEqual` trả đúng tham chiếu cũ cho object lồng bằng nhau (`{a:1,b:[1,2]}`), trả `next` khi một lá khác; `reusePlayers` giữ `prev.p1 === result.p1` khi p1 không đổi và p2 đổi `x`; trả `previous` khi toàn bộ giống; trả object mới khi có người rời.
- [ ] **Step 2: Chạy** `corepack.cmd pnpm --filter @metaverse/web exec tsx --test test/stable-state.spec.ts` — Expected: FAIL (module không tồn tại).
- [ ] **Step 3: Cài đặt** hai hàm trong `stableState.ts` (so sánh sâu tự viết, không thêm thư viện).
- [ ] **Step 4: Áp dụng** trong `update`: `setPlayers(prev => reusePlayers(prev, next))`, `setDj(prev => keepIfEqual(prev, nextDj))`, tương tự `setBluff`, `setPoker`. `setShow` giữ nguyên (đã ổn định).
- [ ] **Step 5: Bọc `Avatar` bằng `memo`.** Rà props truyền từ `World.tsx:249-263`: prop nào tạo mới mỗi render (ví dụ kết quả `resolveAvatarPose`, `gekkaRestraintCue`, `taunts[session]?.target`) thì kiểm tra có trả primitive/tham chiếu ổn định không; nếu không, ổn định bằng `useMemo` ở `World.tsx` hoặc ghi chú rằng memo không có hiệu quả cho prop đó. Không đổi hành vi.
- [ ] **Step 6: Chạy** test file → PASS; `corepack.cmd pnpm --filter @metaverse/web test` → toàn bộ PASS.

### Task 2: Pool đèn cố định cho Kohaku

**Files:**
- Create: `apps/web/game/scenes/kohaku-lights.json` — 16 preset hiện có `{ position:[x,y,z], intensity, distance, color }`, chép nguyên giá trị từ `KohakuScene.tsx:72-97`.
- Create: `apps/web/game/systems/lightPool.ts` (hàm thuần)
- Create: `apps/web/game/systems/PooledPointLights.tsx` (component)
- Modify: `apps/web/game/scenes/KohakuScene.tsx:72-97` — thay 16 `pointLight` bằng `<PooledPointLights presets={...} count={KOHAKU_LIGHT_POOL_SIZE} player={player} />` bên trong group `roomLights`.
- Modify: `apps/web/game/entities/BluffStagingLights.tsx` — ghi hệ số mờ vào `roomLights.current.userData.stagingFactor`; bỏ qua light có `userData.pooled === true` khi tự nhân intensity.
- Test: `apps/web/test/light-pool.spec.ts` (thêm vào script `test`)

**Interfaces:**
- Produces: `type LightPreset = { position: [number, number, number]; intensity: number; distance: number; color: string }`
- Produces: `pickNearestLights(presets: LightPreset[], from: { x: number; y: number; z: number }, count: number): number[]` — chỉ số preset gần nhất theo khoảng cách 3D, độ dài luôn `min(count, presets.length)`, thứ tự ổn định khi bằng khoảng cách (chỉ số nhỏ trước).
- Produces: `assignSlots(previous: number[], wanted: number[]): number[]` — giữ preset đang ở slot cũ nếu vẫn được chọn (để không tắt/bật lại đèn vẫn đang dùng), điền preset mới vào slot trống; độ dài = `previous.length`.
- Hằng: `KOHAKU_LIGHT_POOL_SIZE = 6` (export trong `lightPool.ts`).

- [ ] **Step 1: Viết test thất bại** — người chơi ở `(0,0,0)` tầng 1 → chọn có preset `[0,3.1,0]` và `[0,1.3,0]`, không có preset tầng 3 `y≥9.4`; người ở `(0,7.2,0)` → có cả 3 preset tầng 3; `count=6` luôn trả 6 phần tử; `assignSlots([3,5,7],[5,9,3])` → `[3,5,9]`.
- [ ] **Step 2: Chạy** `... exec tsx --test test/light-pool.spec.ts` → FAIL.
- [ ] **Step 3: Cài đặt** `pickNearestLights`, `assignSlots`.
- [ ] **Step 4: Cài đặt `PooledPointLights`**: render đúng `count` `pointLight` cố định (không bao giờ thêm/bớt). Mỗi ~0,25s chọn lại theo `player` (prop `PositionSnapshot | undefined`; không có player thì dùng gốc toạ độ). Slot đổi preset: đặt vị trí/màu/distance mới, intensity ramp từ 0 lên trong ~0,4s (damp trong `useFrame`). Intensity cuối = giá trị ramp × `parent.userData.stagingFactor ?? 1`. Đánh dấu `userData.pooled = true`.
- [ ] **Step 5: Sửa `BluffStagingLights`** như phần Files; giữ nguyên hành vi với các đèn không thuộc pool (ambient/hemisphere/directional).
- [ ] **Step 6: Chạy** test file → PASS; toàn bộ `test` web → PASS; `typecheck` → sạch.
- [ ] **Step 7: Ghi lại cho người dùng kiểm tra bằng mắt**: đi qua 3 tầng Kohaku và một ván bóp cò; đèn không giật, phòng vẫn tối đúng lúc bóp cò.

### Task 3: Thu nhỏ texture + nén meshopt cho nhân vật

**Files:**
- Create: `apps/web/scripts/glb-binary.mjs` — tách `readGlb`/`writeGlb` từ `compress-vrm-meshopt.mjs` + thêm `rebuildBuffer(json, bin, replacements: Map<number, Buffer>): Buffer`.
- Modify: `apps/web/scripts/compress-vrm-meshopt.mjs` — import `readGlb`/`writeGlb` từ module trên (không đổi hành vi).
- Create: `apps/web/scripts/resize-glb-textures.mjs`
- Modify: root `package.json` — thêm script `characters:textures` gọi script mới (cùng kiểu với các script `characters:*` sẵn có).
- Test: `apps/web/test/glb-binary.spec.ts` (thêm vào script `test`)

**Interfaces:**
- Produces: `rebuildBuffer(json, bin, replacements)` — thay byte của các bufferView chỉ số trong `replacements`, dồn lại mọi bufferView của buffer 0 theo căn lề 4 byte, cập nhật `byteOffset`/`byteLength`, cập nhật `extensions.EXT_meshopt_compression.byteOffset` của mọi view có extension đó nếu nó trỏ vào buffer 0, cập nhật `json.buffers[0].byteLength`; trả BIN mới. Không đổi số lượng/chỉ số của images, textures, materials, meshes, accessors.
- CLI: `node apps/web/scripts/resize-glb-textures.mjs [--dry-run] <file> [...]` — ảnh có cạnh dài >1024 thu về 1024 (giữ tỉ lệ, giữ mimeType); ngoại lệ giữ tối đa 2048 cho ảnh được material có tên khớp `/face|eye|顔|目/i` tham chiếu. In mỗi ảnh: tên, kích thước cũ → mới, quyết định. Lưu bản gốc vào `assets/processed/texture-raw/` trước khi ghi đè; file đã có bản gốc ở đó thì bỏ qua.

- [ ] **Step 1: Viết test thất bại** — dựng GLB tối thiểu trong test (2 bufferView: 1 dữ liệu 12 byte, 1 ảnh 8 byte; JSON có `extensionsUsed:['VRM']`, `extensions.VRM:{}`), thay ảnh bằng 20 byte: view sau được dồn đúng offset căn 4, `buffers[0].byteLength` đúng, `extensions.VRM` còn nguyên, `readGlb(writeGlb(...))` đọc lại được; ca có view mang `EXT_meshopt_compression` → `byteOffset` của extension được dịch theo.
- [ ] **Step 2: Chạy** `... exec tsx --test test/glb-binary.spec.ts` → FAIL.
- [ ] **Step 3: Cài đặt** `glb-binary.mjs`; refactor `compress-vrm-meshopt.mjs` dùng nó.
- [ ] **Step 4: Chạy** test → PASS.
- [ ] **Step 5: Cài đặt** `resize-glb-textures.mjs` (sharp resolve qua `@gltf-transform/cli` giống cách script meshopt resolve `meshoptimizer`).
- [ ] **Step 6: Dry-run** trên `public/assets/characters/gekka/*.vrm` — dán bảng quyết định cho người dùng xem trước khi ghi.
- [ ] **Step 7: Chạy thật** trên 4 VRM Gekka. Kiểm: script tóm tắt (như khảo sát) báo `maxTex ≤ 2048`, số ảnh >1024 chỉ còn ảnh mặt/mắt; extensionsUsed giữ nguyên.
- [ ] **Step 8: Chạy `compress-vrm-meshopt.mjs`** trên các file `raw` trong khảo sát: 9 VRM `club-local` (trừ `shinku`, `rosetta-restored`) và `player/*.glb`. Ghi lại dung lượng trước/sau. Lưu ý trong báo cáo: `player/*.glb` do `characters:*`/`bake-player-flair` sinh ra — bake lại sẽ mất nén, cần chạy lại bước này sau bake.
- [ ] **Step 9: Chạy** `corepack.cmd pnpm --filter @metaverse/web test` (gồm `character-cache.spec.ts` tải nhân vật) → PASS. Ghi cho người dùng kiểm bằng mắt: NPC Gekka (mặt, tóc), NPC club, nhân vật player.

### Task 4: Cache header production + báo cáo hướng dẫn đo

**Files:**
- Modify: `apps/web/next.config.ts`
- Modify: `.env.example` (root) — thêm `ASSET_CACHE_MAX_AGE_SECONDS=86400` kèm chú thích.
- Create: `docs/reports/PERFORMANCE_SMOOTHNESS_REPORT.md`
- Modify: `docs/README.md` — thêm liên kết vào danh sách báo cáo.

**Interfaces:**
- `next.config.ts`: `async headers()` trả rule cho `source: '/assets/:path*'` với `Cache-Control: public, max-age=<N>, stale-while-revalidate=<N*7>` **chỉ khi** `process.env.NODE_ENV === 'production'`; ở dev trả `[]`. `N` = `Number(process.env.ASSET_CACHE_MAX_AGE_SECONDS) || 86400` (hằng có tên). Không dùng `immutable` vì URL asset chưa có phiên bản.

- [ ] **Step 1: Sửa** `next.config.ts` và `.env.example`.
- [ ] **Step 2: Kiểm** `corepack.cmd pnpm --filter @metaverse/web build` → thành công.
- [ ] **Step 3: Viết báo cáo**: đã đổi gì (4 task, số liệu trước/sau dung lượng và số đèn), cách đo — `pnpm build` + `pnpm --filter @metaverse/web start` (không đo trên `next dev`), Chrome DevTools Performance (đọc vùng Scripting vs GPU), React DevTools Profiler (đếm commit/giây để quyết định có cần 1b), `renderer.info` (draw calls, triangles, textures, programs) ở từng khu; ghi phần 1b và KTX2 là việc để sau.
- [ ] **Step 4: Liên kết** báo cáo từ `docs/README.md`.

### Task 5: Kiểm chứng tổng

- [ ] `corepack.cmd pnpm typecheck` → sạch.
- [ ] `corepack.cmd pnpm test` → PASS.
- [ ] `corepack.cmd pnpm build` → thành công.
- [ ] `gitnexus_detect_changes()` → chỉ chạm symbol dự kiến.
- [ ] Báo cáo cho người dùng: file:dòng đã đổi, kết quả lệnh thật, danh sách việc cần họ kiểm bằng mắt (Task 2 Step 7, Task 3 Step 9).
