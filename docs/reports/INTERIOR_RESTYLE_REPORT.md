# Làm lại nội thất Denmu Club và Kohaku Club

## Denmu Night Club (`scripts/build-denmu-club.py` → `denmu-club.glb`)
Phong cách neon Tokyo, nền đen bóng + chrome + vàng champagne, neon hồng/tím/xanh làm điểm nhấn:
- Vỏ phòng: sàn obsidian bóng, tường nhung mận, ốp chân tường lacquer có nẹp vàng, trần lưới chrome với 3 vòng halo LED trên sàn nhảy, tường trước cao kín tới trần.
- Sân khấu: bục lacquer có hai dải neon, cổng proscenium chrome có panel LED và dãy bóng đèn, tường LED dạng thanh, vòng halo đôi sau lưng DJ. Chữ DENMU được nâng lên y 4.4 để không đè lên halo.
- Quầy bar: thân lacquer, mặt đá onyx phát sáng nhẹ, gương và 3 kệ rượu có đèn, 39 chai màu, 5 ghế bar, 3 đèn quả cầu thả (đặt lệch khỏi đèn bar runtime).
- VIP: băng sofa nhung magenta lưng cao chần rãnh, gương viền neon, xô champagne; booth tròn ở góc trước phải; 2 bàn cocktail đứng ở góc trước trái; thảm runner, đèn dẫn sàn và 2 cổng neon ở lối vào.
- Mesh được gộp theo vật liệu, còn 20 object (trước đây ~100).

## Kohaku Private Members Club (`scripts/build-kohaku-club.py` → `kohaku-club.glb`)
Thêm mục 13: lớp nội thất Nhật cao cấp đặt trên nền Art Deco sẵn có:
- Vách shoji kumiko có giấy washi phát sáng ở tường trước tầng 1 và tầng 3, và trên lưng sofa Chesterfield.
- Rèm noren chàm 4 vạt trên lối vào, gia huy vàng/đỏ phía trên chữ 琥珀.
- 11 đèn lồng chōchin treo dưới mép sàn tầng 2 và tầng 3.
- Bình phong vàng byobu ở tầng 2, tháp thùng sake komodaru, 2 bình ikebana men ngọc trên bệ sơn mài đỏ.
- Góc trà tatami (bàn chabudai, nệm zabuton, đèn andon, ấm trà) ở tầng 1 và cuối hành lang phải tầng 3, kèm dù wagasa đỏ.
- Mesh được gộp theo vật liệu, còn 28 object.

## Code/runtime
- `packages/game-protocol/src/club.ts`: collider cho ghế bar, 2 bàn cocktail và booth của club; collider cho thùng sake, 2 bệ ikebana, góc trà tầng 1, 2 byobu ở tầng 2 và góc trà tầng 3 của Kohaku.
- `FollowCamera.tsx`: club có thêm khung camera cho trần (5.5 m) và tường trước cao 5.6 m.
- `ClubScene.tsx`: dời chữ DENMU, thêm biển VIP LOUNGE. `kohaku-lights.json`: thêm 2 đèn cho 2 góc trà.

## Kiểm chứng
- Blender 5.2 headless dựng lại được cả 2 GLB. Khronos glTF Validator báo 0 lỗi, 0 cảnh báo.
- Test game-protocol 32/32, world-server 99/99, web 179/179. Typecheck web và world-server đều sạch.
- Ảnh render EEVEE nằm trong `test-results/screenshots/interior-restyle/`. Chưa chạy thử trong trình duyệt vì cần người dùng cho phép theo `AGENTS.md`.
