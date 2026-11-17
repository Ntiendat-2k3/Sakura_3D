# Tối ưu độ mượt khi chơi (giữ tải toàn bộ ban đầu)

Ngày: 2026-11-17 · Trạng thái: đã duyệt

## Mục đích
Người chơi chấp nhận màn tải ban đầu lâu, miễn là khi đã vào game thì chơi mượt, không giật. Đồ họa phải gần như giữ nguyên.

## Mục tiêu / Không làm / Phản mục tiêu
- **Mục tiêu:** giảm chi phí mỗi frame (GPU + React), giảm VRAM, giảm dung lượng tải, cache asset dài hạn, có hướng dẫn đo.
- **Không làm:** đổi cơ chế warmup toàn bộ (`ClubAssetWarmup` giữ nguyên), Redis, KTX2 (để sau), Service Worker.
- **Phản mục tiêu:** mất extension VRM (biểu cảm, spring bone), nhân vật mờ rõ rệt khi nhìn gần, cảnh tối/xỉn hẳn đi, sai lệch đồng bộ multiplayer.

## Cách tiếp cận đã chọn
- Tải: hướng C (giữ tải toàn bộ). Bỏ A (tải ngầm, có thể khựng khi đang chơi) và B (chờ mỗi lần vào khu).
- Texture: thu nhỏ texture tại chỗ trong GLB (không qua gltf-transform vì nó bỏ extension VRM). Bỏ KTX2 lúc này vì cần cài KTX-Software và lợi ích chống khựng upload đã nằm trong màn tải.

## Thiết kế
1. **Mạng → React (bản nhẹ 1a, đã chốt):** vị trí vẫn ở state `players` vì ~15 nơi trong `World.tsx` tính khoảng cách từ `current` khi render. `useCityConnection.ts` giữ nguyên identity object `dj`, `bluff`, `poker` khi dữ liệu không đổi; bọc `React.memo` cho các thành phần nặng không phụ thuộc vị trí. Refactor đầy đủ (1b: vị trí sang ref, proximity đọc theo frame) để dự án riêng sau khi đo bằng React Profiler.
2. **Đèn:** Kohaku 16 → ~4 `pointLight` ở chỗ người chơi đứng (bàn, quầy, cửa); phần còn lại thay bằng emissive. Rà Hotel/Lounge/scene khác; áp dụng cùng ngân sách ~4 đèn động mỗi cảnh nếu vượt.
3. **Texture:** script mới cạnh `apps/web/scripts/compress-vrm-meshopt.mjs`, đọc/ghi GLB thô giống script đó; resize ảnh nhúng tối đa 1024px, ảnh mặt/mắt giữ 2048px; giữ định dạng ảnh; bản gốc lưu ở `assets/processed/`; file đã xử lý bỏ qua. Khảo sát cho thấy chỉ 4 VRM Gekka có texture >1024; phần lớn dung lượng các NPC club là hình học/morph chưa nén, nên chạy thêm `compress-vrm-meshopt.mjs` sẵn có cho các file chưa nén.
4. **Cache HTTP:** `next.config.ts` thêm `headers()` cho `/assets/:path*` với `Cache-Control: public, max-age=31536000, immutable`, kèm cơ chế phiên bản URL để tránh bản cũ khi ghi đè file.
5. **Đo:** báo cáo `docs/reports/` (liên kết từ `docs/README.md`) hướng dẫn đo bằng build production + Chrome Performance + `renderer.info`.

## Ràng buộc
- Tuân `AGENTS.md`: không tự chạy trình duyệt/Playwright khi chưa được phép; không xóa asset nguồn.
- Test spec mới phải thêm vào script `test` của package.

## Để lại cho người thực hiện
Ngưỡng nhận diện texture "mặt/mắt", vị trí cụ thể 4 đèn giữ lại, cách đánh phiên bản URL asset.
