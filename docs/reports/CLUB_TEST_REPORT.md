# Denmu Night Club — Bản test local WINE × POP

Ngày: 05/11/2026. Phạm vi: một club có thể vào/ra, hai NPC thật nhảy, chơi cùng phòng. Đây là bản tối thiểu để kiểm thử, chưa phải hoàn thiện toàn bộ nightlife metaverse.

Cập nhật điều khiển: đã bổ sung camera xoay chuột 360°, sửa rung do đồng bộ transform và ngồi/đứng ghế bằng Enter; xem [CAMERA_SEATING_REPORT.md](CAMERA_SEATING_REPORT.md).

## Cách thử

1. Mở http://localhost:3000 khi các server đã chạy. Nếu chưa chạy, từ workspace dùng `npm run dev` một lần; PostgreSQL local phải sẵn sàng.
2. Di chuyển WASD hoặc phím mũi tên tới vòng sáng **DENMU · E**, phía tòa Night Club. Tọa độ cửa gần `(4.2, 1)`; từ điểm xuất hiện đi lên trước rồi sang phải.
3. Khi nút **E · Vào Night Club** sáng, nhấn E hoặc bấm nút.
4. Đi tới sàn trước sân khấu để xem **WINE** và **POP**. Sân khấu/quầy bar có vùng chặn; đến sát sofa và nhấn Enter để ngồi, Enter lần nữa để đứng dậy.
5. Để ra ngoài, đi về cửa **EXIT** phía sau, gần `(0, 6.4)`, rồi nhấn E hoặc bấm **Ra phố**.
6. Mở thêm tab/browser để thử hai người vào cùng club và chat. Chat của club tách khỏi phố. Bloom mặc định tắt để ưu tiên FPS.

## Nội dung đã làm

| Hạng mục | Trạng thái | Chi tiết |
| --- | --- | --- |
| Giải nén và kiểm kê | DONE | Giữ `WINE.rar`, `POP_.rar`; trong gói là VRM và ảnh thumbnail, không có animation clip hoặc license đầy đủ |
| Hai model nhân vật | DONE — local | Load VRM 0.x bằng `@pixiv/three-vrm` 3.5.5, giữ MToon và rig; tối đa 1024 px cho texture runtime |
| Nhảy trên sân khấu | DONE — prototype | Chuyển động rig nguyên bản cho hông, thân, vai, tay, đầu và chân; loop club không tường minh, nhịp 112 BPM |
| Đồng bộ vòng nhảy | DONE — local | Mốc `danceEpoch` do room server tạo, client tính pha theo thời gian chung; người vào sau tiếp tục cùng timeline |
| Nội thất club | DONE — prototype | Scene Blender riêng, GLB có sân khấu, loa, quầy bar, sofa, sàn và dải đèn; tái sử dụng atlas hiện có |
| Vào/ra bằng E hoặc nút | DONE | Server dùng JWT để xác định người chơi và hỏi room nguồn kiểm tra khoảng cách cửa; không nhận tọa độ client khai báo làm căn cứ |
| Room multiplayer | DONE | `sakura-city` và `sakura-club` là hai room Colyseus riêng; club tối đa 12 người, joinOrCreate theo loại room |
| Xử lý lỗi chuyển room | DONE | Giữ room cũ đến khi nhận state của chính người chơi trong room mới; lỗi join giữ lại phiên hiện tại |
| Collision | DONE — phạm vi test | Biên phòng, sân khấu, quầy bar và khu sofa được chặn trong mô phỏng server |
| Source/backend | DONE | Giữ NestJS/Clean Architecture/Sequelize; không đổi schema DB, không lưu chuyển động mỗi frame |
| Quyền phân phối model | BLOCKED | Metadata có các cờ cho phép, nhưng `licenseName=Other` và không có URL điều khoản đầy đủ; đang chờ trang nguồn/license |

Model này giữ tên WINE và POP. Chưa xác nhận chúng tương ứng với bất kỳ nhân vật nào trong roster Reina/Mizuki/Sora/Yuna/Kaede/Hana/Rika/Emi/Ayame/Madam Kurenai.

## Model và nguồn

| Model | Metadata tác giả | Tam giác nguồn | Runtime sau giảm texture |
| --- | --- | --- | --- |
| WINE | BABYCORE / NANAMI | 54.204 | 11.547.412 byte |
| POP | nanami / babycore | 20.860 | 10.138.824 byte |

File nguồn giữ tại `assets/source/characters/club-import/`. Bản runtime ở `apps/web/public/assets/characters/club-local/`. Cả thư mục model lẫn RAR được đưa vào `.gitignore` trong khi chờ xác minh quyền phân phối; không coi hai model là CC0.

Metadata, SHA-256, kích thước và trạng thái quyền: [club-character-manifest.json](../../assets/processed/club-character-manifest.json). Manifest chung cũng ghi riêng phần `clubPrototype`: [ASSET_MANIFEST.json](../../assets/manifests/ASSET_MANIFEST.json).

Không có animation nhảy trong hai gói. Vòng nhảy hiện tại được điều khiển bằng code trên normalized humanoid bones, không phải mocap hoặc clip do tác giả model cung cấp. Không tự tải nhạc; bản test chưa có âm thanh.

## Kiểm thử

| Kiểm tra | Kết quả |
| --- | --- |
| Typecheck Web và World Server | PASS |
| World unit tests | PASS — 5 bài: movement, collider phố, góc tường, collider club và bán kính cửa |
| Toàn bộ unit tests hiện có | PASS — 10 bài: API 2, game-protocol 3, World Server 5 |
| E2E server/API/database | PASS — 2 bài tổng hợp, gồm bộ multiplayer cũ và bộ club mới |
| Chống vào club từ xa | PASS — thiếu room nguồn hoặc giả tọa độ cửa đều bị từ chối |
| Chống ra phố từ xa EXIT | PASS — room nguồn xác minh vị trí thực; bỏ `fromRoomId` khi đang ở club cũng bị chặn |
| Hai browser contexts độc lập | PASS — cùng room club, hiển thị hai người, nhận chat, disconnect dọn avatar |
| Animation thật | PASS — ghi nhận góc xương hông/tay thay đổi theo thời gian, có hai ảnh ở hai pha khác nhau |
| Ra phố và vào lại | PASS — hai VRM tải lại, không mất WebGL context |
| Model môi trường GLB | PASS — 12 GLB hiện có qua Khronos Validator: 0 lỗi, 0 cảnh báo |
| Focus và phím E | PASS — bấm nút vào club rồi tiếp tục WASD; gõ E trong chat không chuyển phòng; phím E vẫn dùng được khi nút có focus |
| FPS | Khoảng 60 FPS, p95 khoảng 17,1 ms; mẫu 3 giây ở 1536×776, DPR 1, bloom tắt, Intel Iris Xe |
| Production build | PASS — Turbo 5/5 tác vụ build thành công, gồm Web/API/World Server và hai package dùng chung; log tại `test-results/logs/club-production-build.log` |

Số đo ở góc nhìn test: khoảng 190 draw call, 108.822 tam giác, 86 GPU textures. Sau một vòng ra/vào: hai NPC vẫn ready, không mất context. Đây không phải thử tải 12 người hoặc soak test kéo dài; chưa kiểm tra clock skew giữa các máy khác nhau và mạng latency cao.

Đã bổ sung dọn riêng bone texture của Skeleton bên cạnh geometry/material/texture của VRM khi rời scene. Các font/atlas dùng chung có cache riêng; chưa kết luận không có rò rỉ bộ nhớ qua kiểm thử kéo dài.

Chứng cứ:

- [Kết quả Playwright](../../test-results/club-browser.json)
- [Cửa vào club](../../test-results/screenshots/club-door.png)
- [Pha nhảy A](../../test-results/screenshots/club-dance-a.png) / [Pha nhảy B](../../test-results/screenshots/club-dance-b.png)
- [Hai người chơi](../../test-results/screenshots/club-two-players.png)
- [Người chơi B](../../test-results/screenshots/club-player-b.png)
- [Ra phố](../../test-results/screenshots/club-return-street.png)
- [Vào lại club](../../test-results/screenshots/club-final.png)

## File và công cụ

- Nội thất Blender: [denmu-club.blend](../../assets/processed/denmu-club.blend).
- Nội thất runtime: `apps/web/public/assets/buildings/denmu-club.glb`, khoảng 293 KB, tham chiếu atlas chung.
- Chuẩn bị VRM: `python scripts/prepare-club-characters.py`.
- Dựng nội thất: Blender background chạy `scripts/build-denmu-club.py`, tối ưu GLB bằng glTF Transform và đóng gói texture bằng script hiện có.
- Renderer: `ClubScene.tsx`, `ClubDancer.tsx`; chuyển động trong `systems/clubDance.ts`; loader VRM được lazy load khi vào club.
- Chuyển cảnh/room: `useCityConnection.ts`, `PortalInteraction.tsx`, `World.tsx`, `WorldHud.tsx` và camera theo zone.
- Server: `ClubRoom` tái sử dụng lifecycle/movement/chat của `SakuraRoom`; `verifyRoomTransfer` xác thực thông qua RPC nội bộ tới room nguồn.
- Bố cục/collision/cửa: `packages/game-protocol/src/club.ts` dùng chung giữa frontend và server.
- Dependency production thêm duy nhất cho tính năng: `@pixiv/three-vrm@3.5.5`, do GLTFLoader thông thường chưa xử lý đầy đủ VRM/MToon/humanoid.

Tài liệu kỹ thuật chính thức đã đối chiếu: [three-vrm](https://github.com/pixiv/three-vrm), [normalized humanoid](https://pixiv.github.io/three-vrm/docs/classes/three-vrm-core.VRMHumanoid.html), [Colyseus 0.16 matchmaker/RPC](https://0-16-x.docs.colyseus.io/server/matchmaker).

## Phần còn lại

- Xin trang tải/license đầy đủ của WINE/POP trước khi xác nhận quyền phát hành hoặc đưa asset vào bản phân phối.
- Nếu muốn đúng một điệu nhảy/video cụ thể: cần video tham khảo hoặc animation có quyền sử dụng. Loop hiện tại là chuyển động procedural tối thiểu, chưa phải biên đạo hoàn chỉnh.
- Chưa có nhạc, hội thoại, tương tác NPC, quầy bar có chức năng, VIP hoặc nội thất các tòa khác. Ngồi ghế đã có, đồng bộ qua server.
- Avatar người chơi vẫn là placeholder; chưa thay toàn bộ roster bằng model thật.
- Chưa có tài khoản thật, kiểm soát truy cập/phát hành công khai, moderation hoặc chính sách VIP. Guest auth vẫn chỉ dành cho môi trường local.
