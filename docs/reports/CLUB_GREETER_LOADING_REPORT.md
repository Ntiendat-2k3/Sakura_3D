# NPC đón khách, cache model và nhạc vào cửa

Trạng thái tổng thể: **PARTIAL**. Đã tích hợp source và kiểm tra model/clip bằng Blender CLI, Three.js trong Node và HTTP. Chưa mở trình duyệt theo chỉ định của người dùng; không đánh dấu hình ảnh game, FPS hoặc autoplay đã được xác minh.

Cập nhật phục hồi hình ảnh Rosetta: xem `docs/reports/ROSETTA_RESTORATION_REPORT.md`. Model đang dùng là `rosetta-restored.glb`, được chuyển từ Render.blend với mắt/miệng, biểu cảm và tư thế gốc. Thông tin bản Model.blend/clip vẫy tay bên dưới là lịch sử của phiên bản trước.

## NPC

| Thành phần | Trạng thái | Kết quả |
| --- | --- | --- |
| Rosetta | DONE về asset/tích hợp; PARTIAL kiểm thử game | Đứng cố định `[3.5, 0, 2.5]` trước DENMU, bỏ tuần tra 3 giây theo yêu cầu mới. Chiều cao cấu hình 2.12 m, tăng khoảng 13%. Quay mặt về người chơi khi vào phạm vi 2 m. |
| Galaxy Summer | DONE về asset/tích hợp; PARTIAL kiểm thử game | Đứng phía phải sảnh, vị trí `[4.4, 0, 4.5]`, có idle thở/chớp mắt. Không nằm trong chuỗi nhảy sân khấu. |
| Tương tác Rosetta | PARTIAL | Đến trong 2 m, nhấn F hoặc nút gợi ý: “Anh cần gì ạ?”, hai lựa chọn Nhảy / Hủy. Chặn WASD/E khi mở dialog. Hủy/Esc đóng và trở lại chào tại chỗ. Tương tác này chạy cục bộ, chưa đồng bộ lựa chọn cho cả phòng. |
| Galaxy Summer | Chưa thêm tương tác | Giữ idle lễ tân như trước. |

Rosetta lấy từ `assets/source/characters/club-import/Rosetta/Model/Rosetta.blend`. Không dùng bản costume off. Blender CLI chuyển shader tác giả sang PBR có atlas/alpha và tạo clip vẫy tay trên rig thật; không sử dụng chuyển động tải ngoài. Đã loại PoseLib khỏi GLB để không trộn xung đột với clip chào.

File xuất riêng: `assets/processed/rosetta-greeter.blend`; runtime `apps/web/public/assets/characters/club-local/rosetta.glb`. Không sửa file Blender nguồn. Ảnh `test-results/screenshots/rosetta-offline-preview.png` là render asset offline, **không phải screenshot trong game**.

Galaxy lấy đúng `club-e1/Galaxy Summer.vrm`; giữ nguyên rig, metadata và quyền tác giả OneLazerBunny (Nanasita). Metadata ghi `ExplicitlyLicensedPerson`, `Redistribution_Prohibited`, `sexualUssageName: Disallow`. Chỉ tích hợp làm NPC đứng lễ tân trong bản thử local, không dùng chuyển động gợi dục và không coi việc có file là quyền phân phối. File nguồn/runtime và Blender phái sinh Rosetta được loại khỏi Git; cần có quyền tương ứng trước khi phân phối model.

## Bổ sung tương tác Rosetta và chat

- Cập nhật mới: bỏ toàn bộ dịch chuyển tuần tra, giữ vị trí đứng cố định; tăng riêng Rosetta từ 1.88 lên 2.12 và nâng nhãn theo kích thước. Cố định bộ váy ngắn đen–đỏ, tất cao và giày cao gót đang có trong model.
- Phát hiện cả 9 material GLB đều xuất BLEND, kể cả texture da/tóc có alpha 255 toàn ảnh. Sửa da/tóc/trang phục thành OPAQUE, hai material mặt/mi thành MASK với cutoff 0.3 để tránh lỗi sắp thứ tự trong suốt. Bản nguồn không đổi; pipeline xuất GLB cũng áp dụng chính sách này để không tái phát sau export.

- Nhảy dùng clip Rokoko `GentleSwayingDancing` 16 giây đã có trong dự án. Chuyển 21 track quaternion sang bind pose thật của Rosetta, giữ root tại chỗ. Lấy pose có bù parent Armature xoay 90°, loại ảnh hưởng góc/scale nhóm bên ngoài và khôi phục pose đang hiển thị sau khi chuẩn bị clip.
- Preload clip, cache theo scene và blend chào/nhảy; nhảy lặp cho tới khi Hủy/Esc. Giữ bàn chân chạm sàn bằng bone chân, không tạo hoặc tải nhân vật thay thế.
- Ảnh `test-results/screenshots/rosetta-dance-offline-preview.png` là render Blender của clip retarget, không phải ảnh tương tác trong browser. File preview GLB là bản chẩn đoán local, không thay model runtime.
- Chat thu gọn mặc định thành icon bong bóng ở góc phải; bấm để mở/thu lại. Giữ tin nhắn và nội dung đang gõ khi thu gọn, có nhãn và `aria-expanded` cho nút.
- Giữ model/trang phục hiện tại; các ảnh tham khảo không tự động trở thành tùy chọn trang phục trong game.

## Giảm khựng khi vào lại phòng

- Trước đây component tự parse VRM, tạo controller và dispose model mỗi lần vào/ra. Nay cache cố định bốn NPC, giữ cả rig, texture, mixer và controller xuyên lần đổi phòng; chỉ dispose khi World thực sự rời.
- Tái sử dụng cùng promise khi preload và component cùng yêu cầu; tải lỗi được gỡ cache để thử lại. Cleanup tránh xóa cache trong chu kỳ giả lập của React StrictMode.
- Khi cảnh phố sẵn sàng và người chơi đến cách cửa dưới 10 m: preload module club, GLB phòng/fixture, VRM và clip. Công việc nhân vật được xếp hàng từng model vào thời điểm nhàn rỗi, upload texture lần lượt thay vì dồn cả ba khi mở cửa.
- NPC dùng effect riêng nên tải model không chặn toàn bộ scene bằng Suspense. Model đã sẵn sàng được gắn lại khi đổi phòng.
- Texture runtime được giảm kích thước, giữ nguyên file gốc: WINE 8.91 MB, POP 7.39 MB, Galaxy 8.61 MB; Rosetta GLB 5.22 MB. Manifest ghi byte/hash cụ thể.
- Đây là cache trong phiên chơi, không làm lần tải đầu biến mất. Parse VRM và compile shader vẫn có thể gây khựng trên máy yếu; chưa đo FPS/thời gian chuyển phòng nên không cam kết hết lag. Đổi lại, bộ nhớ giữ tối đa bốn model đã chuẩn bị.

## Nhạc mặc định

Giữ đúng `assets/source/audio/club/music.mp3` và bản public có cùng hash. Audio element được chuyển lên World để giữ buffer qua việc vào/ra club. E/click vào cửa gọi `play()` đồng bộ ngay trong sự kiện người chơi; khi vào phòng mới mở âm lượng và seek theo epoch chung. Ra ngoài thì dừng; vào lại dùng timeline chung. Âm lượng/pause và nghe thử file riêng vẫn có trong bảng điều khiển.

Nếu chính sách autoplay của trình duyệt chặn, giữ nút **Cho phép phát nhạc** và thông báo dự phòng. Chưa nghe playback hay kiểm tra user activation trong browser; không stream audio qua Colyseus.

## Kiểm tra

- **PASS** 8 unit tests Web sau cập nhật đứng yên: cache, mixer, projection, khoảng đệm 0.8 m khi tăng kích thước và giới hạn tương tác 2 m. Bỏ bài test tuần tra vì hành vi đã được gỡ.
- **PASS** Three.js Node đọc GLB thật, chỉ có một clip 4 giây, có Costume và không có Costumeoff; tay thay đổi vị trí khoảng 6.7 cm giữa hai pha. Chiều cao sampled khoảng 1.765 m trước scale runtime, hữu hạn và đúng trục Y.
- **PASS** Galaxy runtime giữ nguyên metadata VRM và buffer view hợp lệ; HTTP hai asset mới trả 200 và SHA-256 trùng file trên đĩa. Bằng chứng `test-results/club-greeter-assets.json`.
- **PASS** Clip nhảy Rosetta có 21 track, quaternion hữu hạn/chuẩn hóa; đầu nằm trên hông trong các mẫu thời gian; kết quả retarget không phụ thuộc góc/scale bên ngoài; không làm thay đổi pose đang hiển thị khi chuẩn bị clip. Kiểm tra bounding box skin được tính lại từng mẫu.
- **PASS** Kiểm tra file thật sau sửa alpha: hai material Face là MASK, các material còn lại là OPAQUE; có một Costume, không có Costumeoff. HTTP hash khớp file mới, Khronos validator vẫn 0 lỗi. Typecheck Web đạt. Chưa kiểm tra lại hiển thị mặt trong browser.
- **PASS** Khronos glTF Validator: Rosetta 0 lỗi, 5 cảnh báo skinned mesh dưới parent và 5 thông tin texture NPOT 768. Đây là cấu trúc export Blender; chưa xác minh kết quả shader/skin trên GPU. Chi tiết `assets/processed/greeter-gltf-validation.json`.
- **PASS** Build toàn monorepo 5/5; `pnpm typecheck` toàn workspace 6/6 tác vụ gồm dependency build. Log bản tương tác mới: `test-results/logs/rosetta-interaction-build.log`, `test-results/logs/rosetta-interaction-typecheck.log`.
- **PASS** 2 e2e Node sau restart bản tương tác: guest auth, hai người vào/chuyển phòng club, di chuyển, ghế, chat và disconnect; metadata nhạc/epoch được giữ đồng bộ. Log `test-results/logs/rosetta-interaction-e2e.log`. Đây là kiểm tra giao thức, không xác minh avatar hiển thị trên hai browser.
- **PASS** Sau restart, Web 3000, API 4000 và World 2567 hoạt động; PostgreSQL healthy tại cổng Docker 5434. MP3 cùng SHA-256, MIME `audio/mpeg`, HEAD 200 và byte-range 206 (`test-results/club-music-http.json`).
- **SKIPPED** Playwright, tự mở browser, screenshot game, kiểm tra vị trí NPC trong cảnh, GPU/FPS và phát nhạc thực tế: người dùng chưa cho phép. Không dùng công cụ browser khác để thay thế.

## File và lệnh

Code chính: `club-npcs.json`, `WelcomeNpc.tsx`, `ClubDancer.tsx`, `characterAssets.ts`, `ClubAssetWarmup.tsx`, `useClubAudio.tsx`, `World.tsx`, `ClubScene.tsx`, `ClubShowControls.tsx`, `retargetClubMotion.ts`, `rosettaMotion.ts`, `useRosettaInteraction.ts`, `RosettaDialog.tsx`, `WorldHud.tsx`, `style.css`.

Pipeline: `scripts/build-rosetta-greeter.py`, `scripts/rosetta_materials.py`, `scripts/preview-rosetta-greeter.py`, `scripts/inspect-club-greeters.py`, `scripts/prepare-club-characters.py`, `scripts/write-club-manifest.py`. Nguồn/quyền/hash được ghi tại `assets/manifests/CLUB_ASSET_MANIFEST.json` và `assets/processed/*manifest.json`.

Chạy từ root bằng `npm run dev`; vào cửa DENMU bằng **E**. Kiểm tra source bằng `corepack.cmd pnpm test` và `corepack.cmd pnpm typecheck`. Khi server đang chạy, kiểm tra asset bằng `corepack.cmd pnpm --filter @metaverse/web exec tsx test/greeter-assets.check.ts`, nhạc bằng `node scripts/verify-club-music.cjs`, mạng bằng `corepack.cmd pnpm --filter @metaverse/web test:e2e`. Các lệnh kiểm tra này không mở browser.

Đến gần Rosetta trong 2 m và nhấn **F**, chọn **Nhảy**; **Hủy/Esc** dừng biểu diễn và đóng hộp thoại. Bấm icon bong bóng ở góc phải để mở/thu chat. Kiểm tra render clip nhảy offline: chạy Blender CLI với `--python scripts/preview-rosetta-greeter.py -- --dance` sau lệnh kiểm tra asset.

Không thêm dependency production, không thay backend/Sequelize/migration/Colyseus và không bật dịch vụ trả phí.
