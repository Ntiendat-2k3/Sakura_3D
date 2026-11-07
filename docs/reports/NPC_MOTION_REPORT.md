# Chuyển động Rosetta và lễ tân Galaxy Summer

Cập nhật mới nhất: Galaxy Summer đã đổi tên thành **DJ Rio** và chuyển lên bàn DJ, ngừng tuần tra sảnh. Rosetta dùng clip nhảy thứ hai khi tương tác. Xem [DJ_RIO_LANTERN_UPGRADE_REPORT.md](DJ_RIO_LANTERN_UPGRADE_REPORT.md); phần dưới ghi lại hành vi trước thay đổi này.

Ngày kiểm tra: 2026-11-06. Trạng thái **PARTIAL**: đã triển khai và kiểm tra rig thật/offline; chưa kiểm thử hình ảnh hoặc FPS trong trình duyệt vì người dùng chưa cho phép mở browser/Playwright.

Cập nhật clip nhảy người dùng cung cấp: xem [USER_DANCE_IMPORT_REPORT.md](USER_DANCE_IMPORT_REPORT.md). Rosetta dùng clip mới khi chọn Nhảy; phần vẫy/tạo dáng và bước đi Galaxy bên dưới được giữ lại.

## Hành vi đã triển khai — DONE

- **Rosetta:** đứng nguyên vị trí, vẫy tay rồi chuyển sang dáng co một chân đã được duyệt; đổi trạng thái mỗi khoảng 3 giây trong chu kỳ 6 giây. Hạ/nâng chân và chuyển trọng tâm bằng blend kết hợp IK, giữ chân trụ. Bàn tay mở khi vẫy, ngón tay cũng được retarget. Giữ nguyên mặt, trang phục đen–đỏ, chiều cao, chớp mắt và quay mặt về người chơi ở gần.
- Tái sử dụng clip `Rosetta_Welcome_Wave` 4 giây đã tạo trước đó trong dự án, tách thành `Rosetta_Wave.json`: 51 quaternion tracks, 53,340 byte. Không tải mesh cũ vào runtime; không coi ảnh Render/Picture là animation. Clip nhảy Rokoko hiện có và tương tác **F → Nhảy / Hủy** được giữ lại.
- **Galaxy Summer:** đi quanh phần sàn trống với tốc độ tối đa 0.55 m/s; bo góc, tăng/giảm tốc rồi nghỉ 1.8 giây. Chân trái/phải luân phiên nhấc tối đa khoảng 9 cm, chân chống neo tại điểm đặt, tay đánh đối pha, có chuyển động nhẹ thân/đầu và chớp mắt. Đế giày được hiệu chỉnh với sàn cao 0.086 m.
- Galaxy dùng chuyển động procedural IK trên rig VRM thật, không phải clip đi bộ mocap. Quỹ đạo kiểm tra chừa đệm 0.65 m với vật cản tĩnh. Không thay model bằng placeholder, không đổi backend, database hoặc thêm dependency.
- Chu kỳ NPC tách khỏi đồng hồ show/DJ để đổi BPM/track không đưa lễ tân nhảy về đầu đường. Giữ cache model/mixer hiện có; không cập nhật React state mỗi frame.

## Kiểm tra

| Kiểm tra | Trạng thái | Kết quả |
| --- | --- | --- |
| Unit tests toàn monorepo | PASS | 27 test, gồm 14 test frontend; có regression cho đường đi, tốc độ, điểm neo chân, IK và chu kỳ 3 giây |
| Production build và typecheck | PASS | 5 tác vụ build thành công; chạy riêng frontend typecheck cũng thành công |
| Dịch vụ và animation qua HTTP | PASS | Web/API health trả 200; file Rosetta_Wave.json trả 200, 53,340 byte; ba server đang chạy |
| Rosetta trên GLB thật | PASS | 361 frame/12 giây; sai lệch chân trụ tối đa 0.20 mm; cổ tay đổi vị trí khoảng 0.50 m; chân phải hạ/nâng rõ ràng; không có bước nhảy khớp vượt ngưỡng kiểm tra |
| Galaxy trên VRM thật | PASS | 1,861 frame/62 giây, có rẽ/dừng; sai số mục tiêu IK dưới 10⁻¹² m; nâng chân 9 cm, tay đánh khoảng 24 cm; điểm đế giày thấp nhất 0.08594 m so với sàn 0.086 m |
| API/Colyseus hai người chơi bằng Node | PASS | 2 test: auth, đồng bộ di chuyển, chuyển/cô lập phòng, chat, ghế và disconnect |
| Render Blender offline | DONE | Đã xem ảnh vẫy/tạo dáng và hai pha bước chân từ pose xuất trực tiếp bởi controller |
| Browser/Playwright, FPS, trải nghiệm trong cảnh thật | SKIPPED | Chưa được người dùng cho phép; render offline không thay thế kiểm thử này |

Các sai số trên là phép đo toán học của controller/rig hoặc mẫu đỉnh đế giày, không phải đánh giá chuyển động từ video trong game.

## Bằng chứng

- Rosetta vẫy: `test-results/screenshots/rosetta-greeting-30-offline.png`.
- Rosetta tạo dáng: `test-results/screenshots/rosetta-greeting-120-offline.png`.
- Galaxy bước trái/phải: `test-results/screenshots/galaxy-walk-37-offline.png` và `galaxy-walk-54-offline.png`.
- Số đo: `test-results/rosetta-greeting-check.json`, `test-results/galaxy-walk-check.json`.
- Log: `test-results/logs/npc-motion-tests.log`, `npc-motion-build.log`, `npc-motion-e2e.log`.
- Nguồn và hash animation: trường `npcMotion` trong `assets/manifests/CLUB_ASSET_MANIFEST.json`.

## File thay đổi

- Controller: `apps/web/game/systems/hostLocomotion.ts`, `rosettaGreeting.ts`, `rosettaMotion.ts`.
- Tích hợp: `apps/web/game/entities/WelcomeNpc.tsx`, `club-npcs.json`; bỏ prop epoch không còn dùng ở `apps/web/components/World.tsx` và `apps/web/game/scenes/ClubScene.tsx`.
- Animation: `apps/web/public/assets/animations/club/Rosetta_Wave.json`; công cụ tái tạo `scripts/prepare-rosetta-wave.ts`.
- Kiểm tra: `apps/web/test/host-motion.spec.ts`, `host-motion.check.ts`, `rosetta-greeting.check.ts`, `rosetta-motion.spec.ts`, `glb.ts`, `greeter-assets.check.ts`; cập nhật test script trong `apps/web/package.json`.
- Render offline: `scripts/preview-npc-motion.py`; GLB chẩn đoán trong `assets/processed/` được thêm vào `.gitignore`, không đưa vào public runtime.
- Manifest/báo cáo: `scripts/write-club-manifest.py`, `assets/manifests/CLUB_ASSET_MANIFEST.json`, báo cáo này và liên kết trong `docs/reports/ROSETTA_RESTORATION_REPORT.md`.

## Giới hạn và asset cần cung cấp

- Hiện chưa cần cung cấp thêm file để thử hành vi này. Mở lại `http://localhost:3000`, refresh trang đang mở rồi đến Rosetta và vào club để xem Galaxy.
- Nếu muốn thay bước đi IK bằng diễn xuất mocap cụ thể, có thể cung cấp **FBX walk loop in-place** kèm nguồn/quyền sử dụng; không bắt buộc cho bản hiện tại. Không cung cấp nhạc hoặc model mới.
- NPC hiện là diễn hoạt trang trí phía client theo đồng hồ máy; chưa có state NPC authoritative, tương tác va chạm với người chơi hoặc kiểm tra đồng bộ NPC giữa hai máy có lệch đồng hồ. Hai test multiplayer xác nhận luồng người chơi vẫn hoạt động, không chứng minh các mục này.
- Lựa chọn nhảy Rosetta vẫn là local preview như trước. Galaxy chỉ thực hiện vai trò lễ tân/đi bộ; điều kiện quyền sử dụng model không thay đổi.

## Chạy lại kiểm tra bằng terminal

Từ workspace, dùng `npm run dev` để chạy hệ thống nếu chưa chạy. Trong terminal khác:

```powershell
corepack pnpm --filter @metaverse/web test
corepack pnpm --filter @metaverse/web exec tsx test/rosetta-greeting.check.ts
corepack pnpm --filter @metaverse/web exec tsx test/host-motion.check.ts
corepack pnpm --filter @metaverse/web test:e2e
```

Không chạy production build đồng thời với Next dev dùng chung `.next`. Không tự mở Playwright khi chưa được cho phép.
