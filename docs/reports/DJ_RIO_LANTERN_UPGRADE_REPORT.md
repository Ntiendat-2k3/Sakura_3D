# Rosetta dance 2, DJ Rio và lồng đèn đỏ

Cập nhật đèn phố tiếp theo: đã chuyển sang tay đỡ cao hai bên, nâng các đèn thấp và thêm ánh đỏ xuống đường. Xem [STREET_LANTERN_HEIGHT_REPORT.md](STREET_LANTERN_HEIGHT_REPORT.md); số lượng/bố trí đèn ghi dưới đây thuộc lần dựng trước.

Ngày thực hiện: 2026-11-06. **DONE** về triển khai/asset và kiểm tra offline; **PARTIAL** về xác nhận hình ảnh/FPS trong game. Không mở browser/Playwright theo yêu cầu người dùng.

## Thay đổi

- **Rosetta — DONE:** chọn `Rosetta_dance2.fbx` làm clip khi bấm **F → Nhảy**. Giữ hành vi vẫy tay/tạo dáng lúc đón khách, mặt, trang phục, vị trí và dáng co chân đã duyệt. Clip nguồn dài 29.067 giây; vòng runtime 28.817 giây do chồng 0.25 giây cuối/đầu. Giữ nguyên tốc độ phần còn lại.
- File mới dùng rig kiểu UE, có một số frame xoắn tay rất mạnh. Đã sửa **5 đoạn track** quanh giây 8.1–8.33 và 15.9–16.23 bằng nội suy giữa hai pose ổn định. FBX gốc không bị chỉnh sửa; JSON có metadata `cleanup` ghi đúng các đoạn đã xử lý. Không thay bằng clip khác.
- **DJ Rio — DONE:** đổi tên hiển thị Galaxy Summer thành DJ Rio, giữ nguyên model VRM và metadata nguồn. Chuyển từ tuần tra sảnh sang đứng tại `[0, 0.77, -7.35]` trên sân khấu. Hai tay IK thao tác platter/mixer, có chuyển núm/fader, nhún nhẹ và gật đầu theo beat show; chân đứng cố định. Đây là diễn hoạt DJ procedural, không phải mocap DJ tải ngoài.
- **Bàn DJ — DONE:** console GLB mới dùng lại ba asset CC0 sẵn có: booth `34089`, turntable `34088`, mixer `34090`. Bổ sung thân kim loại có texture nhúng, viền champagne, hai màn waveform, màn mặt trước, tên DJ RIO, loa monitor và LED. Hai platter có animation xoay. Model cũ còn nguyên trên đĩa.
- **Đèn DJ — DONE:** hai moving-head GLB có SpotLight thật: key trắng ấm intensity 32 và rim hồng intensity 12, cùng hướng vào DJ. Sáng ổn định cả chế độ Low; các đèn sân khấu WINE/POP! và phòng tối được giữ lại.
- **Phố — DONE:** thêm **42 lồng đèn đỏ trên 6 dây võng**, dùng lại model giấy có nếp, vành và dây treo đã có. Tổng cộng 66 lồng đèn gồm 24 cái cũ. Instance chung geometry/material; dây mới gộp một primitive. Ba PointLight đỏ tĩnh bổ sung, không bật shadow map riêng cho từng lồng đèn.
- Console được preload khi đến gần cửa club; cache nhân vật hiện có tiếp tục được sử dụng. Không thêm dependency, thay nhạc, sửa backend, Sequelize hoặc giao thức Colyseus.

## Asset và hiệu năng

| Asset | Chi tiết |
| --- | --- |
| `apps/web/public/assets/props/club/dj-rio-console.glb` | Khoảng 1.5 MB; 21,994 tam giác; 21 primitive/material; 1 texture nhúng; 2 animation platter |
| `apps/web/public/assets/props/lantern-garlands.glb` | 113,612 byte; 4,608 tam giác; 1 primitive/material |
| `apps/web/public/assets/animations/club/Rosetta_dance2.json` | Khoảng 2 MB, 30 Hz, 52 bone tham chiếu/53 track nguồn; runtime retarget 51 quaternion tracks và hips Y |

Số byte và SHA-256 chính xác nằm trong `assets/manifests/CLUB_ASSET_MANIFEST.json` và `assets/manifests/ASSET_MANIFEST.json`. Các số đếm hình học không phải kết quả đo FPS.

## Kiểm tra

| Kiểm tra | Trạng thái | Kết quả |
| --- | --- | --- |
| TypeScript frontend | PASS | `corepack pnpm --filter @metaverse/web typecheck` |
| Unit tests monorepo | PASS | 29 test; 16 test frontend, không có test thất bại |
| Production build | PASS | 5 tác vụ thành công; file tạm đặt ở F: |
| Rosetta dance 2 trên GLB thật | PASS | 1,791 mẫu frame, hơn hai vòng; khớp hữu hạn, không có bước nhảy góc vượt ngưỡng 0.8 rad/frame; trở lại dáng đón khách khi dừng |
| DJ Rio trên VRM thật | PASS | 901 frame/30 giây; sai số tay tới targets và chân tới điểm neo dưới 10⁻¹² m; tay phải đổi vị trí khoảng 20 cm |
| Khronos glTF Validator | PASS | 22 GLB trong props/club và props: **0 error, 0 warning** |
| Node multiplayer/API | PASS | 2 test hai người chơi: auth, di chuyển, chuyển/cô lập phòng, chat, ghế và disconnect |
| HTTP asset và health API | PASS | Ba asset mới trả 200 và khớp byte/SHA-256 file trên đĩa; API health trả 200, log `test-results/dj-rio-http.json` |
| Blender render offline | DONE | Đã xem DJ cùng console, phố treo đèn và Rosetta clip mới |
| Browser/Playwright, console WebGL, FPS | SKIPPED | Chưa được người dùng cho phép |

Đã phát hiện/sửa lỗi UV `texCoord=-1` sau khi ghép mesh có tên UV khác nhau: chuẩn hóa một `UVMap`, tạo UV cho các phần bổ sung và gắn UV node rõ ràng trước khi xuất. Bản xuất sau sửa đã đạt validator; FBX/model nguồn không bị ghi đè.

Trong kiểm tra dịch vụ cuối, container PostgreSQL được phát hiện đã dừng với exit code 255, làm health API trả 500. Đã bật lại riêng service `postgres` bằng Docker Compose, giữ nguyên volume; container healthy và health API đã trả lại 200. Không suy đoán nguyên nhân dừng là do code hoặc ổ đĩa.

Phép đo tay/chân là phép đo rig/IK; không khẳng định đã hết mọi trường hợp xuyên tóc, trang phục hoặc trượt chân của clip nhảy trong game. Lựa chọn nhảy Rosetta vẫn là local preview, chưa đồng bộ tương tác qua server như trạng thái trước đây.

## File Blender và ảnh

- Console nguồn: `assets/processed/dj-rio-console.blend`.
- Dây treo nguồn: `assets/processed/street-lantern-garlands.blend`.
- Bản ghép xem DJ: `assets/processed/dj-rio-stage-preview.blend`.
- Bản ghép xem phố: `assets/processed/street-red-lanterns-preview.blend`.
- Ảnh: `test-results/screenshots/dj-rio-30-offline.png`, `dj-rio-150-offline.png`, `street-red-lanterns-offline.png`, `rosetta-user-dance-30-offline.png`, `rosetta-user-dance-150-offline.png`.
- Số đo/log: `test-results/dj-rio-check.json`, `user-dances-check.json`, `rosetta-dance2-check.log`, `dj-rio-all-tests.log`, `dj-rio-build.log`, `dj-rio-e2e.log`, `assets/processed/dj-rio-gltf-validation.json`.

Ảnh được render từ asset/pose runtime bằng Blender CLI, không phải screenshot chụp trong game. Blender MCP đã thử nhưng addon chưa kết nối; không thay đổi phiên Blender đang mở.

## Những file chính đã sửa

- Config: `club-npcs.json`, `club-choreography.json`, `club-dj-layout.json`, `club-lighting-layout.json`, `street-lantern-layout.json` trong `apps/web/game/`.
- Runtime: `WelcomeNpc.tsx`, `ClubScene.tsx`, `StreetAssets.tsx`, `StageLightingSystem.tsx`, `ClubAssetWarmup.tsx`, `djPerformance.ts`, `hostLocomotion.ts`, `rosettaMotion.ts`.
- Pipeline: `scripts/prepare-club-motion.mjs`, `build-dj-rio-assets.py`, `preview-npc-motion.py`, `preview-street-lanterns.py`, hai script ghi manifest.
- Kiểm tra: `apps/web/test/dj-rio.check.ts`, `user-dances.check.ts`, điều chỉnh kiểm tra route đi bộ cũ để độc lập với vị trí DJ mới; cập nhật manifest/báo cáo và `.gitignore` cho preview chứa model người dùng.

## Môi trường và sử dụng

Ổ C: lúc kiểm tra còn khoảng **106 MB** trống; file tạm/build phụ trợ được đưa vào `test-results/tmp/` ở F:. Không thay đổi phân vùng, reset database/volume hoặc tự dọn dữ liệu người dùng.

Refresh trang game đang mở. Vào club để xem DJ Rio; đến Rosetta và chọn **F → Nhảy** để thử clip mới. Không cần cung cấp thêm asset cho lần nâng cấp này. Khi server chưa chạy, dùng `npm run dev` tại workspace.

Tái tạo/kiểm tra bằng terminal:

```powershell
node scripts/prepare-club-motion.mjs --mixamo
corepack pnpm --filter @metaverse/web exec tsx test/user-dances.check.ts
corepack pnpm --filter @metaverse/web exec tsx test/dj-rio.check.ts
corepack pnpm --filter @metaverse/web test:e2e
```

Nguồn/phạm vi quyền sử dụng model người dùng giữ nguyên. Tên clip Rosetta mới trong FBX là `snaptik_vn_7649390784478792981`; chưa có nguồn cụ thể để tự gán giấy phép Mixamo hoặc CC0 cho clip này. Bản tích hợp phục vụ thử local theo yêu cầu; giữ thông tin quyền sử dụng trước khi phát hành.
