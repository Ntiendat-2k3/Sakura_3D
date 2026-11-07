# DENMU — Lighting upgrade

Trạng thái tổng thể: **PARTIAL**. Asset và ánh sáng trước đây đã kiểm thử. Đã tích hợp `music.mp3` và hiệu ứng projection đốm/vòng sáng mới; phần mới chưa kiểm thử trong browser vì người dùng chưa cho phép Playwright. Blender MCP chưa kết nối ở lượt asset trước.

## Cập nhật không khí club tối và đèn bảy màu

- Giảm ambient từ 0.45 xuống 0.07, hemisphere từ 0.85 xuống 0.2, directional từ 1.35 xuống 0.38. Nền tím đen, fog từ 9–29 m.
- Giảm emissive sàn LED còn 16%, làm dịu màu bề mặt; đèn bar giảm từ khoảng 9 xuống 3. Chỉ bật nguồn sáng sàn riêng ở High.
- Bổ sung 6 moving-head GLB quanh hai bên phòng, nâng tổng số model moving head lên 10. Tái sử dụng asset CC0 hiện có; không tải thêm hoặc thêm dependency.
- Dải đỏ → cam → vàng → lục → cyan → lam → tím chuyển mềm, có lệch pha giữa các fixture. Đèn/beam/lens cùng màu, target đổi liên tục quanh sàn.
- Hai đèn sân khấu chiếu trắng ấm cố định `#ffe8dd`, intensity 42, ngắm mặt/thân người WINE/POP. Không đổi màu hoặc nhấp nháy theo beat; giảm từ mức thử 80 để tránh cháy tóc/da. Đèn bảy màu tiếp tục quét ở vòng ngoài. Model và SpotLight cùng pivot.
- Low: 2 đèn sân khấu + 2 đèn quanh phòng + bar. Medium: 2 + 3 + bar. High: 4 + 4 + bar/sàn và laser tùy cue. Các model còn lại giữ lens đổi màu; giới hạn đèn thực để giảm chi phí GPU.
- Mặc định vẫn giảm nhấp nháy và bloom tắt; chế độ giảm nhấp nháy kéo dài chuyển màu và tắt laser.
- Đã cập nhật bố cục và tái tạo file Blender/GLB processed; màu chuyển động, fog và mức sáng được điều khiển trong Three.js runtime.

## DONE — Asset và scene

- Import 10 GLB thật từ [Nightclub and DJ Booth / 3D Assets](https://3dassets.dev/packs/nightclub-and-dj-booth). Manifest chính thức ghi **CC0-1.0**, tác giả 3D Assets, asset được tạo bằng AI. SHA-256, URL tải, vật liệu, mesh, bounding box và giấy phép lưu trong `assets/manifests/CLUB_ASSET_MANIFEST.json`.
- Model: moving head, strobe/LED bar, UV bar, laser fixture, disco ball/motor, LED floor hồng/cyan, bàn DJ, turntable và mixer.
- Giữ nguyên Denmu, sofa, bar, sân khấu và hai VRM. Có 10 moving heads, 2 laser fixtures, bộ đèn bar, disco ball, bàn DJ với hai deck/mixer, 24 ô sàn LED. Bố cục chung trong `club-lighting-layout.json`.
- Runtime GLB mới tổng **345,428 byte**, có quantization từ nguồn, không tải model/texture từ dịch vụ bên ngoài khi chơi. Sàn lặp sử dụng InstancedMesh; geometry/material GLB được tái sử dụng.
- Khronos glTF Validator: **10/10 GLB, 0 errors, 0 warnings**. `assets/processed/club-gltf-validation.json`.
- Blender 5.2.3 LTS import/kiểm tra model và FBX thành công bằng CLI. Đã lưu riêng:
  - `assets/processed/denmu-premium-club.blend`: nội thất + fixture, các rig/action FBX tham chiếu được ẩn.
  - `assets/processed/denmu-premium-lighting.glb`: bố cục đèn portable, khoảng 1.24 MB; runtime dùng các GLB riêng nhỏ hơn, không tải trùng file này.
  - File cũ `denmu-club.blend` và `denmu-club.glb` được giữ nguyên.

## DONE — Hệ thống runtime

| Module | Hành vi |
|---|---|
| StageLightingSystem | SpotLight thực gắn vào pivot head; pan/tilt cùng model, lens và hướng chiếu khớp nhau. Chạy clip quay baked của deck/disco ball. |
| BarLightingSystem | Bar/UV fixtures cùng PointLight tím, thay đổi chậm và có giới hạn. |
| DanceFloorLightingSystem | Sàn GLB instanced và PointLight đổi màu liên tục ở Medium/High. |
| BeatSyncController | Tính beat/phrase từ epoch server, BPM và offset dùng chung với animation. |
| ClubEffectsController | Beam bán trong suốt, laser fan và ánh sáng xanh bổ trợ ở High/peak, phối hợp với bloom hiện có; không tạo compositor thứ hai. |

Các cone/line chỉ biểu diễn tia trong không khí; SpotLight/PointLight mới là nguồn chiếu sáng thực. Laser fan chưa phải projector vật lý. Disco ball nhận highlight từ đèn scene, chưa có hệ projector gobo lên tường.

| Chế độ | Thiết lập |
|---|---|
| Low | 2 đèn sân khấu + 2 đèn quanh phòng + bar, beam quanh phòng nhẹ; tắt laser và floor light. |
| Medium | 2 đèn sân khấu + 3 đèn quanh phòng + bar, beam nhẹ, không bloom. |
| High | 4 đèn sân khấu + 4 đèn quanh phòng + bar/floor, laser ở cue peak khi cho phép; có thể bật bloom. |
| Giảm nhấp nháy | Mặc định bật, ẩn laser fan, thay pulse rõ bằng biến thiên chậm, giảm opacity beam. Tùy chọn riêng mỗi máy. |

Không dùng strobe nhấp nháy gắt, không bật shadow map tốn kém mỗi frame. Fog nhẹ/nền đêm và ánh sáng nền giữ khả năng nhìn trong club. Bloom mặc định tắt.

## DONE — Kiểm thử

Số đo của lần nâng cấp đầu, trước bản phòng tối/bảy màu: Playwright MCP, WebGL thật, viewport 1536×776, Canvas DPR=1. Mỗi mẫu FPS khoảng 3 giây; đây là smoke test trên máy local, không phải bảo đảm cho mọi GPU. Kết quả bản cập nhật nằm ở cuối báo cáo.

| Mức | FPS | p95 frame |
|---|---:|---:|
| Low, bloom tắt | 59.67 | 17.2 ms |
| Medium, bloom tắt | 59.67 | 17.1 ms |
| High, bloom tắt, giảm nhấp nháy bật | 60.01 | 17.1 ms |
| High + bloom, giảm nhấp nháy tắt | 35.03 | Chưa lấy p95 |

- **DONE** SpotLight có intensity >0, pan/tilt thay đổi thực. Ảnh xác nhận fixture và vùng chiếu trên sân khấu.
- **DONE** Bài acceptance: không có JS/console errors, failed requests hay WebSocket errors; đủ bốn clip/NPC, blend, hai browser contexts, chat và disconnect.
- **DONE** `corepack.cmd pnpm typecheck`: toàn workspace đạt.
- **DONE** `corepack.cmd pnpm test`: 12 unit tests đạt.
- **DONE** `corepack.cmd pnpm --filter @metaverse/web test:e2e`: 2 bài API/multiplayer/club đạt, gồm movement, seat, room-transfer auth và DJ validation.
- **DONE** `corepack.cmd pnpm build`: 5/5 build tasks đạt; Next compile/type validation/static generation hoàn tất.
- **DONE** Sau build đã khởi động lại một cây dev duy nhất: Web **3000**, API **4000** (health HTTP 200), World **2567**, PostgreSQL Docker healthy. Browser vào lại club, cả hai mocap ready và WebGL context không mất.
- **DONE** Dọn hai cây dev trùng trước đó để xử lý EADDRINUSE; chỉ dừng tiến trình đã xác định thuộc workspace này. Không dừng PostgreSQL Windows và không reset volume.

Bằng chứng:

- [Trước nâng cấp](../../test-results/screenshots/club-premium-before.png)
- [Sau nâng cấp, hai người](../../test-results/screenshots/club-premium-after.png)
- [Ảnh cuối sau build](../../test-results/screenshots/club-premium-final.png)
- `test-results/club-premium-qa.json`, `test-results/club-final-smoke.json`, `test-results/club-audio-bloom-qa.json`, `test-results/logs/club-build.log`.

## PARTIAL / BLOCKED

- **PARTIAL** High + bloom khoảng 35 FPS: giữ bloom tắt để ưu tiên chuyển động mượt. Chưa benchmark nhiều GPU, nhiều room hoặc 12 người đầy phòng.
- **BLOCKED** Blender MCP báo không kết nối được addon; không đánh dấu đã verify bằng MCP. CLI Blender đã làm được phần import/export và lưu file.
- **PARTIAL** Đã dùng đúng `music.mp3` từ người dùng, có phân tích BPM/offset/cue tự động; chưa nghe/biên tập chính xác drop/intro và kiểm thử playback browser. Không tìm, mua, tạo hoặc thay bài khác. Xem `docs/reports/CLUB_MUSIC_PROJECTION_REPORT.md`.
- **PARTIAL** Quyền giữ bàn DJ hiện là khách đầu tiên cho test local, server kiểm tra và throttle 1 giây; chưa phải hệ thống role/moderation production.
- **PARTIAL** Đồng bộ kiểm tra hai contexts trên cùng máy; chưa đồng bộ clock/độ trễ audio giữa thiết bị khác nhau.
- **DONE / không dùng** [1DesignTool lighting rig](https://1designtool.com/3d/models/music-festival-lighting-rig) đã kiểm tra. [Giấy phép](https://1designtool.com/3d/license) cho dùng trong game nhưng hạn chế phân phối file model độc lập; không import trùng vì pack CC0 đã đáp ứng.

## File thay đổi và tái tạo

- Frontend: `ClubScene.tsx`, `ClubDancer.tsx`, `World.tsx`, `style.css`, `ClubShowControls.tsx`, 5 module đèn/beat và `retargetClubMotion.ts`, bố cục JSON.
- Realtime: `club-show.ts`, export protocol, `city.state.ts`, `club.room.ts`, `useCityConnection.ts`; chỉ metadata show trong bộ nhớ, không audio hay vị trí NPC gửi theo frame.
- Tests/tooling: validation metadata, `club.e2e.cjs`, `playtest-club-premium.js`, `prepare-club-motion.mjs`, `build-club-lighting.py`, `write-club-manifest.py`. Mở rộng validator hiện có để nhận thư mục/output khác, giữ hành vi mặc định.
- Asset/provenance: source GLB/FBX/archive và manifest chính thức, runtime GLB/JSON, file Blender/GLB processed, `assets/manifests/CLUB_ASSET_MANIFEST.json`, hai báo cáo và screenshots; README cập nhật hướng dẫn.
- Không thêm dependency, không sửa Sequelize/database schema, không thay đổi backend REST hoặc dịch vụ cloud.

Chạy dự án bằng `npm run dev`. Tái tạo mocap: `node scripts/prepare-club-motion.mjs`; Blender: `blender --background --python scripts/build-club-lighting.py`; manifest: `python scripts/write-club-manifest.py`.

## Kết quả kiểm tra bản tối phòng / sáng sân khấu

- **DONE** Web typecheck đạt. Monorepo build đạt 5/5 trong lượt nâng cấp; các chỉnh cuối về đèn trắng ấm/rest pose đã được xác nhận bằng typecheck và Next dev/browser, chưa chạy lại production build sau các chỉnh cuối này.
- **DONE** Playwright MCP: Low 59.67 FPS, Medium 59.30 FPS, High 60.01 FPS, bloom tắt, Canvas DPR 1, viewport 1536×776. Mẫu mỗi mức khoảng 3 giây; phép đo thực hiện khi đèn stage ở mức thử 80, trước khi giảm còn 42. Smoke/FPS ở mức cuối lưu trong `test-results/club-stage-final-qa.json`.
- **DONE** Quan sát đủ 7 màu qua một chu kỳ, đèn xoay quanh phòng hoạt động; đèn sân khấu giữ màu/cường độ ổn định. Không ghi nhận JS/console, asset hay WebSocket errors trong bài acceptance.
- **DONE** Hai browser contexts cùng room/epoch/BPM/cue, chat/disconnect hoạt động; sai số pha sau bù thời điểm lấy mẫu khoảng 0.072 beat. Test đã xử lý telemetry stale do tab nền bị throttle, không so sánh trực tiếp hai frame cũ/mới.
- **DONE** Đủ 4 clip mỗi NPC, không có robot, thấy blend và lớp nhấn hông/body roll. Hips X được kiểm tra theo rest pose để tránh tích lũy.
- Bằng chứng: `test-results/club-mood-qa.json`, `test-results/club-stage-final-qa.json`, `test-results/logs/club-mood-build.log`, `test-results/screenshots/club-mood-before.png`, `test-results/screenshots/club-dark-room-bright-stage.png`.
- Bản đèn bảy màu đầu chạy cùng pipeline Blender cho FPS thấp hơn; phép đo cuối thực hiện sau khi Blender hoàn tất. Các bài unit/backend đã đạt ở lượt trước, không chạy lại vì không sửa backend trong lượt này.

## Bản nhạc chung và projection mới

Đã thêm `DiscoProjectionSystem`: đốm/cánh sao nhiều màu lên sàn/tường, ba vòng cầu vồng giao nhau và quầng sáng tại disco ball. Xoay một chiều theo đồng hồ phòng, không reset khi bài nhạc lặp. Giữ hai đèn trắng ấm trên nhân vật và giới hạn số đốm theo Low/Medium/High.

Các số FPS/ảnh ở trên thuộc bản trước khi thêm projection này, không phải kết quả bản mới. **SKIPPED** browser/WebGL/FPS/screenshot theo chỉ định người dùng; chỉ chạy terminal, unit, build và Node HTTP/Colyseus. Báo cáo hiện tại: `docs/reports/CLUB_MUSIC_PROJECTION_REPORT.md`.
