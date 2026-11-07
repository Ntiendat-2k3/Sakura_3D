# Import ba clip nhảy người dùng cung cấp

Cập nhật tiếp theo: Rosetta đã chuyển sang `Rosetta_dance2.fbx`, Galaxy Summer trở thành DJ Rio. Xem [DJ_RIO_LANTERN_UPGRADE_REPORT.md](DJ_RIO_LANTERN_UPGRADE_REPORT.md); nội dung bên dưới là hồ sơ lần import ba clip đầu.

Ngày kiểm tra: 2026-11-06. **PARTIAL**: đã import, tích hợp, chạy trên rig thật và render kiểm tra offline. Chưa thử hình ảnh/FPS trong browser theo yêu cầu người dùng. Kiểm tra kết nối dịch vụ hiện **BLOCKED** bởi Docker Desktop đang ở trạng thái `Stopping`.

## Gán clip — DONE

| NPC | FBX nguồn | Thời lượng nguồn | Vòng runtime | JSON runtime |
| --- | --- | --- | --- | --- |
| WINE | `Wine_dance.fbx` | 21.967 giây | 21.717 giây | 1,409,251 byte |
| POP! | `Pop_dance.fbx` | 4.900 giây | 4.650 giây | 329,620 byte |
| Rosetta | `Rosetta_dance.fbx` | 9.567 giây | 9.317 giây | 671,170 byte |

- Nguồn nằm trong `assets/source/animations/club/mixamo/`; file FBX gốc được giữ nguyên. Các FBX có cả mesh nhân vật mẫu, nhưng runtime chỉ nhận dữ liệu xương/keyframe trong `apps/web/public/assets/animations/club/`.
- WINE/POP! tự dùng clip tương ứng trên sân khấu. Hai nhân vật chạy theo giây từ epoch chung của show, giữ tốc độ clip gốc. Không kéo toàn bộ clip vào 32 beat và không cộng lớp lắc hông cũ. Đèn/nhạc vẫn dùng cơ chế hiện có; chưa phân tích BPM của từng điệu nhảy để khớp nhịp nhạc chính xác.
- Rosetta vẫn vẫy tay/tạo dáng lúc đón khách. Đi gần, bấm **F → Nhảy** để dùng clip mới; dừng nhảy thì trở lại dáng đã duyệt. Lựa chọn nhảy vẫn là diễn hoạt cục bộ như trước.
- Mỗi NPC hiện có **một clip mới được người dùng chọn**. Các clip cũ được giữ trên đĩa, không còn là chuỗi mặc định của WINE/POP!. Galaxy Summer giữ hành vi lễ tân/đi bộ.

## Xử lý animation — DONE

- Bake toàn bộ clip tại 30 Hz, giữ ngón tay; dữ liệu mỗi clip có 52 bone tham chiếu và 53 track nguồn.
- Đọc inverse bind từ skin để lấy T-pose thật. `Rosetta_dance.fbx` dùng tên xương kiểu UE, có bone animation và skin trùng tên; không lấy pose đang nhảy ở frame đầu làm rest pose. Gộp Spine2 vào Chest trên rig Rosetta.
- Retarget sang VRM 0.x của WINE/POP! và rig GLB của Rosetta; giữ model, mặt, trang phục và vị trí đứng hiện có.
- Chồng 0.25 giây cuối/đầu bằng quaternion slerp để nối vòng. Đây là đoạn chuyển tiếp bổ sung; phần còn lại chạy tốc độ gốc.
- Khóa root X/Z để NPC ở đúng điểm biểu diễn; giữ nhún hông theo Y với giới hạn an toàn và hiệu chỉnh chân thấp nhất về cao độ hiện có. Phép đo này không chứng minh hoàn toàn hết trượt chân hoặc xuyên trang phục trong mọi pose.
- Phát hiện spring-bone khởi tạo trước khi normalize model gây giật lớn ở frame đầu. Đã reset solver sau normalize/đổi phòng, đặt cao độ chân trước khi giải physics, chia bước solver tối đa 120 Hz và giới hạn tốc độ pose hiển thị của xương phụ ở 8 rad/s. Không sửa keyframe thân nguồn để che lỗi physics.

## Kiểm tra

| Kiểm tra | Trạng thái | Bằng chứng |
| --- | --- | --- |
| Unit tests monorepo | PASS | 29 test; frontend 16 test, có kiểm tra vòng nối, tốc độ theo giây và regression mixer cũ |
| TypeScript | PASS | `corepack pnpm --filter @metaverse/web typecheck` |
| Production build | PASS | 5 tác vụ thành công, log `test-results/logs/user-dances-build.log` |
| Chạy trên rig thật | PASS | WINE 1,365 mẫu frame; POP! 341; Rosetta 620; hơn hai vòng mỗi clip, tọa độ hữu hạn và chuyển động tay rõ |
| Dừng nhảy Rosetta | PASS | Trả hips và dáng co chân về tư thế đón khách |
| Vẫy/tạo dáng Rosetta cũ | PASS | Kiểm tra 361 frame; chân trụ lệch tối đa 0.20 mm |
| Blender offline | DONE | Đã xem các pose xuất trực tiếp từ controller bằng Blender 5.2.3 LTS |
| HTTP asset/API và multiplayer sau lần sửa này | BLOCKED | Docker Desktop đang `Stopping`; PostgreSQL 5434 chưa listen, `npm run dev` chờ tại predev. Chưa chạy lại bài Node e2e trong lần sửa này |
| Browser, FPS, WebGL và hình ảnh trong club | SKIPPED | Chưa được người dùng cho phép mở browser/Playwright |

Số đo cổ chân thấp nhất sau hiệu chỉnh gần bằng cao độ mục tiêu trong sai số số thực. Góc đổi khớp lớn nhất mỗi frame ở 30 Hz là WINE 0.563 rad, POP! 0.401 rad, Rosetta 0.679 rad; đây là ngưỡng kiểm tra kỹ thuật, không thay thế đánh giá chuyển động trong game. Những xương phụ dùng physics có giới hạn làm mượt riêng.

## Ảnh và log

- `test-results/screenshots/wine-user-dance-45-offline.png`, `wine-user-dance-210-offline.png`.
- `test-results/screenshots/pop-user-dance-18-offline.png`, `pop-user-dance-75-offline.png`.
- `test-results/screenshots/rosetta-user-dance-30-offline.png`, `rosetta-user-dance-150-offline.png`.
- `test-results/user-dances-check.json`, `user-dances-check.log`, `user-dances-unit.log`, `user-dances-greeting-regression.log`, `user-dances-build.log`.
- SHA-256 của FBX/JSON và thông tin rig nằm trong `userAnimations` của `assets/manifests/CLUB_ASSET_MANIFEST.json`.

## Nguồn và quyền sử dụng

Người dùng cung cấp ba FBX sau khi chọn/tải animation. Hai file WINE/POP! có rig và clip `mixamo.com`; file Rosetta có rig khác và clip tên `gemini_generated_video_cdc2ff3f`. Tên clip không đủ để xác minh tác giả/giấy phép. Không tự gán CC0 hay giấy phép Mixamo cho Rosetta; chưa cần thêm file để thử local, nhưng cần giữ thông tin nguồn/quyền sử dụng clip khi chuẩn bị phát hành.

## File thay đổi

- `scripts/prepare-club-motion.mjs`: thêm chế độ import ba FBX mới; mặc định xử lý Rokoko cũ được giữ lại.
- `apps/web/public/assets/animations/club/{Wine_dance,Pop_dance,Rosetta_dance}.json` và `mixamo-manifest.json`.
- `apps/web/game/systems/retargetClubMotion.ts`, `rosettaMotion.ts`, `characterAssets.ts`; tích hợp `apps/web/game/entities/ClubDancer.tsx` và `apps/web/game/scenes/club-choreography.json`.
- `apps/web/test/club-dance.spec.ts`, `user-dances.check.ts`; `scripts/preview-npc-motion.py`, `scripts/write-club-manifest.py`, `.gitignore` và các báo cáo/manifest liên quan.
- Không cài dependency mới; không sửa backend, Sequelize, nhạc hoặc giao thức multiplayer.

## Chạy lại

```powershell
node scripts/prepare-club-motion.mjs --mixamo
corepack pnpm --filter @metaverse/web test
corepack pnpm --filter @metaverse/web exec tsx test/user-dances.check.ts
```

Docker cần về **Engine running** để `npm run dev` tiếp tục chuẩn bị PostgreSQL và khởi động ba server. Không reset database/volume hoặc tác động dịch vụ PostgreSQL Windows.
