# Phục hồi Rosetta từ bản render gốc

Cập nhật chuyển động sau phục hồi: xem [NPC_MOTION_REPORT.md](NPC_MOTION_REPORT.md) để biết chu kỳ vẫy/tạo dáng và bước đi của Galaxy. Nội dung dưới đây ghi lại lần phục hồi asset.

Trạng thái: **PARTIAL** về kiểm thử cuối trong game; asset đã được phục hồi, kiểm tra offline và đưa vào cấu hình frontend. Không mở Playwright hoặc browser theo yêu cầu người dùng.

## Đã phục hồi

- **DONE** Lấy từ `assets/source/characters/club-import/Rosetta/Render/Render.blend`, giữ tư thế trình diễn và biểu cảm của tác giả. Không thay đổi file nguồn. File này chỉ có frame 0, không có animation gốc; các ảnh Picture là ảnh tạo dáng từ nhiều camera.
- **DONE** Giữ 7 mesh, gồm `Eye_decal`, `mouth_decal`, khuôn mặt, tóc, thân, trang phục và đuôi/cánh. Không đưa mesh castoff vào GLB. Giữ cố định bộ đồ đen–đỏ.
- **DONE** Bake màu qua chính chuỗi Gamma/HSV/phối màu của shader nguồn thành albedo tương thích glTF. Giữ màu mắt xanh, tóc hồng, viền đỏ, chất liệu da/vải và tham số riêng cho kim loại/trang sức. Shader vật lý trong game là bản chuyển đổi, không phải toàn bộ shader Blender chạy trực tiếp trong Three.js.
- **DONE** Giữ biểu cảm khuôn mặt của bản render vào geometry cơ sở, thêm morph chớp mắt trái/phải. Idle 8 giây chỉ có chuyển động rất nhẹ ở đầu/ngực/cổ tay và chớp mắt. Đây là idle bổ sung từ pose gốc, không phải animation được tìm thấy trong thư mục ảnh.
- **DONE** Biểu cảm có action riêng trong cache để không bị mất khi blend sang clip nhảy Rokoko đã có. Giữ tương tác F → Nhảy / Hủy và Esc. Lựa chọn nhảy vẫn chỉ chạy cục bộ.
- **DONE** Giữ nguyên vị trí `[3.5, 0, 2.5]`, chiều cao cấu hình 2.12 và hành vi quay mặt về người chơi ở gần. Không di chuyển tuần tra.

## Kích thước và hiệu năng

- GLB mới: **8,953,288 byte**, **91,908 tam giác**, 7 mesh, 15 material.
- Mặt/tóc/trang phục chính dùng atlas 2048; các atlas còn lại tối đa 1024. Mặt và mắt giữ PNG có alpha; các atlas đặc nén JPEG quality 94, không subsampling. Sai lệch màu trung bình từng kênh được kiểm tra dưới 1.5/255; kết quả trong `textureCompression` của manifest.
- Dung lượng giảm từ bản phục hồi chưa nén khoảng 13.8 MB xuống 9 MB. Bản cũ khoảng 5.2 MB nên vẫn có chi phí tải/bộ nhớ cao hơn để đổi lấy chi tiết. Tái sử dụng cache rig/texture/mixer hiện có, không thêm NPC hoặc dependency.
- Alpha MASK cho mặt/mắt, OPAQUE cho da/tóc/trang phục. Không đưa toàn bộ model vào hàng đợi BLEND gây che mặt sai.
- Chưa đo FPS, thời gian tải, shader compilation và mức dùng GPU trong browser; không cam kết hết giật hoặc giống hoàn toàn ảnh studio dưới ánh sáng phố đêm.

## File đang sử dụng

- Runtime: `apps/web/public/assets/characters/club-local/rosetta-restored.glb`.
- Blender đã chuẩn bị: `assets/processed/rosetta-restored.blend`.
- Manifest chi tiết: `assets/processed/rosetta-restoration-manifest.json`, `assets/processed/rosetta-greeter-manifest.json`, `assets/manifests/CLUB_ASSET_MANIFEST.json`.
- Bản trước được giữ tại `assets/processed/rosetta-before-restore/` và GLB cũ vẫn còn. Các file model người dùng và bản sao không được đưa vào Git.

## Bằng chứng hình ảnh

- [Toàn thân sau phục hồi](../../test-results/screenshots/rosetta-restored-offline-preview.png).
- [Cận mặt sau phục hồi](../../test-results/screenshots/rosetta-restored-offline-preview-portrait.png).
- [Kiểm tra clip nhảy trên model phục hồi](../../test-results/screenshots/rosetta-dance-offline-preview.png).
- [Bản trước phục hồi](../../assets/processed/rosetta-before-restore/rosetta-offline-preview.png).

Các ảnh trên là render Blender từ GLB thật, **không phải screenshot trong game**.

## Kiểm tra

- **PASS** Three.js Node: idle 8 giây, morph chớp mắt đóng/mở, giữ Costume, có mắt/miệng riêng, không castoff; skin và quaternion hữu hạn, retarget giữ chiều đứng, không phụ thuộc góc/scale ngoài model.
- **PASS** HTTP runtime trả 200 và SHA-256 khớp file. Bằng chứng `test-results/club-greeter-assets.json`.
- **PASS** Khronos glTF Validator: 0 lỗi; 7 cảnh báo skinned mesh dưới parent. Bằng chứng `assets/processed/greeter-gltf-validation.json`.
- **PASS** 22 unit tests toàn workspace, gồm 9 bài Web và regression biểu cảm vẫn chạy khi trọng số động tác thân bằng 0. Typecheck Web đạt.
- **PASS** Build toàn monorepo 5/5, gồm kiểm tra TypeScript của Next.js; log `test-results/logs/rosetta-restoration-build.log`.
- **PASS** Sau restart, Web/API trả 200, 2 e2e Node về auth/phòng club/multiplayer đạt. Log `test-results/logs/rosetta-restoration-e2e.log`. Không coi các e2e mạng này là xác minh hiển thị NPC trong browser.
- **PASS** SHA-256 của Render.blend nguồn trùng giá trị đã ghi trước khi phục hồi, xác nhận không thay đổi file tác giả.
- **SKIPPED** Browser, Playwright, điều khiển F bằng UI, ánh sáng thực trong phố, FPS và so sánh trực tiếp với ảnh nguồn trong game: chưa được người dùng cho phép mở browser.

## Tái tạo

1. Blender CLI: `blender --background --python scripts/build-rosetta-greeter.py` tạo ứng viên mới từ Render.blend.
2. `python scripts/rosetta_materials.py --candidate` hợp nhất idle, chuẩn hóa alpha và nén atlas đặc.
3. `corepack.cmd pnpm --filter @metaverse/web exec tsx test/greeter-assets.check.ts --candidate` kiểm tra ứng viên.
4. `blender --background --python scripts/preview-rosetta-greeter.py -- --restored --both` render toàn thân/cận mặt.
5. Khi ứng viên đạt, sao chép sang đường dẫn runtime nêu trên, cập nhật manifest và chạy lại kiểm tra asset không có `--candidate`.

`restore-rosetta-render.py --reexport` dùng bản Blender đã chuẩn bị để xuất lại mà không bake lại albedo. Sau đó vẫn chạy bước nén và kiểm tra.

Tải lại trang game để bỏ model cũ trong cache phiên chơi. Không thay đổi backend, Sequelize, database hoặc giao thức multiplayer.
