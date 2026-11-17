# Báo cáo tối ưu độ mượt

Đợt tối ưu gồm 4 thay đổi nhỏ, không đổi hành vi game. Chưa chạy trình duyệt (theo quy định dự án), nên chưa có số FPS thật. Mục "Cách đo" bên dưới để người dùng tự đo trước/sau.

## Đã đổi gì

### 1. Giữ identity state mạng (`apps/web/game/networking/stableState.ts`)
- `useCityConnection.ts` dùng `keepIfEqual` cho `dj`, `bluff`, `poker` và `reusePlayers` cho `players`, nên patch không đổi nội dung thì không tạo object mới.
- `Avatar` bọc `memo`.
- Giới hạn: `sampleTime` (= `simulationTime`) đổi mỗi patch nên `players` gần như luôn là object mới. `memo(Avatar)` hiện gần như không có tác dụng cho người chơi. Hiệu quả thật của dj/bluff/poker thì có.
- Test: `stable-state.spec.ts` (6 test).

### 2. Pool đèn Kohaku (16 đèn -> 6)
- `PooledPointLights` luôn render đúng 6 `pointLight` (`KOHAKU_LIGHT_POOL_SIZE`), mỗi 0.25s chọn 6 preset gần người chơi nhất (trục y nặng gấp 2 vì đèn khác tầng bị sàn chắn), đèn đổi preset theo hai pha: đèn cũ tắt dần về 0 trong 0.2s (giữ nguyên vị trí), rồi mới dời sang preset mới và sáng dần 0 -> 1 trong 0.4s, nên không còn đèn tắt phụt trong một khung hình. `selectLights` thêm hysteresis: preset mới chỉ thay preset đang gán khi gần hơn ít nhất `LIGHT_SWAP_MARGIN` (0.5 m, cùng khoảng cách có trọng số), tránh đổi qua lại ở ranh giới hạng 6/7. Số đèn trong scene: 16 -> 6 point light (cộng ambient, hemi, directional; spotlight bluff giữ nguyên).
- `BluffStagingLights` ghi `stagingFactor` để đèn pooled vẫn tối đúng ~25% khi bluff.
- Test: `light-pool.spec.ts` (7 test, gồm tầng 2 và hysteresis). Lệch brief: thêm trọng số y x2 để người ở tầng 3 chọn đúng đèn tầng 3.

### 3. Dung lượng asset nhân vật
| Nhóm | Trước | Sau |
|---|---|---|
| Gekka (aos, espeon, lindsay, rina): thu texture 2048 -> 1024 | 59.6 MB (62,458,416 B) | 31.0 MB (32,504,276 B) |
| club-local (8 VRM + rosetta.glb): nén meshopt (*) | 89.5 MB (93,884,584 B) | 39.7 MB (41,618,104 B) |
| **Tổng** | **149.1 MB** | **70.7 MB** |

(*) `club-local/rosetta.glb` (5,219,768 B -> 3,786,496 B, tiết kiệm 1,433,272 B) runtime không nạp: runtime dùng `rosetta-restored.glb` (xem `apps/web/game/entities/club-npcs.json`). Phần runtime thật: club-local 84.6 MB (88,664,816 B) -> 36.1 MB (37,831,608 B); tổng 144.1 MB (151,123,232 B) -> 67.1 MB (70,335,884 B).

- Ước tính VRAM giảm khoảng 540 MB khi cả 4 NPC Gekka cùng được nạp (34 ảnh x ~16 MB, chưa tính 4 thumbnail).
- Ngoại lệ 2048 cho mặt/mắt không cần dùng: ảnh mặt/mắt vốn đã <= 1024.
- Player `*.glb` (37.1 MB) **cố ý để nguyên**: loader trần của test và `bake-player-flair.ts` chưa có MeshoptDecoder (nén sẽ làm 52 test fail và chặn bake).
- Bản gốc nằm ở `assets/processed/texture-raw/` và `assets/processed/meshopt-raw/`. Script mới: `resize-glb-textures.mjs`, `glb-binary.mjs`; lệnh `npm run characters:textures`.
- Test: `glb-binary.spec.ts` (3 test). Toàn bộ web test cuối task 3: 161/161 pass.

### 4. Cache header production (`apps/web/next.config.ts`)
- `/assets/:path*` trả `Cache-Control: public, max-age=N, stale-while-revalidate=N*7` chỉ khi `NODE_ENV=production`; dev không thêm header.
- `N = ASSET_CACHE_MAX_AGE_SECONDS` nếu là số nguyên dương, ngược lại 86400. Không dùng `immutable` vì URL asset chưa có phiên bản (nếu thay file cùng tên, người chơi chỉ thấy bản mới sau tối đa N giây).
- Lưu ý: `headers()` được Next đánh giá lúc `next build` và ghi cứng vào `.next/routes-manifest.json`, nên `ASSET_CACHE_MAX_AGE_SECONDS` phải có mặt khi chạy `next build`; đổi nó lúc `next start` không có tác dụng (muốn đổi thì build lại). Next trong `apps/web` chỉ tự đọc `.env` nằm trong `apps/web`, không đọc `.env` ở gốc monorepo, nên đặt biến trong shell chạy build hoặc `apps/web/.env.production`. Không đặt thì dùng mặc định 86400. Đã xác nhận: routes-manifest của bản build mặc định chứa `public, max-age=86400, stale-while-revalidate=604800`.
- Biến đã thêm vào `.env.example`.

## Cách đo

Không đo trên `next dev` (có StrictMode render đôi, HMR, không minify).

1. Build và chạy production, cùng API + world-server như thường lệ:
   ```powershell
   pnpm build
   pnpm --filter @metaverse/web start
   ```
2. **Chrome DevTools > Performance**: ghi 10-15 giây khi đi trong từng khu. Đọc vùng Scripting (JS/React) so với GPU/Rendering. Scripting cao thì nghẽn CPU/React, GPU cao thì nghẽn đồ họa (đèn, texture, draw call).
3. **React DevTools Profiler**: ghi khi đứng yên có vài người chơi khác, đếm commit/giây của `World`. Nếu commit mỗi patch (~10/s) và tốn thời gian đáng kể thì cần làm refactor 1b.
4. **`renderer.info`** (draw calls, triangles, textures, programs): đo ở từng khu (sakura, club, lounge, hotel, kohaku 3 tầng), ví dụ trong Console qua một tham chiếu tạm tới renderer, ghi lại `info.render.calls`, `info.render.triangles`, `info.memory.textures`, `info.programs.length`.
5. Network tab: kiểm tra `/assets/...` có header `Cache-Control` và lần tải thứ hai lấy từ cache. Ghi lại tổng byte tải lần đầu.
6. Ghi số trước/sau (checkout lại commit cũ nếu cần) vào bảng cho cùng kịch bản.

## Kiểm bằng mắt (người dùng)
- Kohaku: đi cả 3 tầng (cầu thang phải lên 2F, trái lên 3F): đèn đổi mượt, không chớp. Chơi một ván bóp cò: phòng tối xuống ~25%, spotlight rọi ghế, hết ván sáng lại bình thường. So độ sáng quanh bàn poker tầng 1.
- Gekka (aos, espeon, lindsay, rina): mặt, mắt, tóc (không đổi); da và quần áo có mờ/vỡ họa tiết không (normal map thân giảm chi tiết nhẹ).
- NPC club/lounge/kohaku (wine, pop, galaxy/DJ Rio, yuzu, bunny, zankou, hinata, bartender): lưới không thủng/lật mặt, nhảy đúng, tóc spring bone chạy.
- Nhân vật người chơi: không hồi quy.

## Việc để sau
- **Refactor 1b**: đưa vị trí ra khỏi React state. Hiện `players` memo gần như vô dụng vì `sampleTime` đổi mỗi patch; chỉ làm khi Profiler cho thấy cần.
- **KTX2** cho texture.
- Nén player GLB: cần thêm `MeshoptDecoder` vào `apps/web/scripts/bake-player-flair.ts` và các helper `loadPlayer` trong test (`player-animation.spec.ts`, `kohaku-bluff.spec.ts`, `gekka-npc.spec.ts`), rồi chạy `compress-vrm-meshopt.mjs` (tiết kiệm khoảng 7.2 MB).
- Thêm `MeshoptDecoder` vào các script check đang hỏng với VRM club đã nén: `user-dances.check.ts`, `greeter-assets.check.ts` (dòng ~121 nạp runtimeGalaxy; dòng 18 rosetta-restored không nén nên không sao), `dj-rio.check.ts:16` và `host-motion.check.ts:16`.
- `BluffStagingLights` unmount giữa lúc đang tối thì các đèn không pooled còn bị giữ tối (lỗi có từ trước).
- `restraint` ở Avatar tạo object mới mỗi render cho người bị trói (Gekka).
