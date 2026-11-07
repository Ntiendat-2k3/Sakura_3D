# Camera chuột, chuyển động và ngồi ghế — 05/11/2026

## Điều khiển

- Giữ chuột trái hoặc chuột phải trên canvas rồi kéo để xoay ngang đủ 360°. Kéo lên/xuống đổi góc cao; giới hạn góc đứng để tránh lật camera.
- Cuộn chuột để zoom. Camera rút gần khi gặp công trình/tường, giãn ra từ từ khi hết vật cản.
- WASD/mũi tên di chuyển theo hướng nhìn của camera.
- Trong Denmu, tới sát một trong ba sofa phía bên phải rồi nhấn **Enter** hoặc bấm nút **Ngồi xuống ghế**.
- Nhấn **Enter** lần nữa hoặc bấm **Đứng dậy** để rời ghế. Khi ngồi, chuột vẫn xoay được nhưng WASD không di chuyển nhân vật.
- Khi đang nhập chat, Enter gửi tin nhắn; không làm nhân vật đứng dậy/ngồi xuống.

## Thay đổi và nguyên nhân rung

Avatar trước đây vừa nội suy bằng `useFrame`, vừa nhận lại `position` theo props mỗi patch mạng. Việc gán lại transform này làm mất tác dụng nội suy. Camera cũng nhìn theo tọa độ mạng theo từng nấc thay vì transform đang render.

Đã sửa:

1. Chỉ đặt position ban đầu một lần; nội suy giữa các snapshot theo nhịp patch 100 ms, quay yaw theo cung ngắn nhất.
2. Camera đọc cùng object avatar sau bước nội suy, chạy theo thứ tự frame rõ ràng. Bỏ cách kéo vị trí camera và điểm nhìn theo hai nguồn khác nhau.
3. Orbit dùng pointer capture, xử lý nhả chuột/cancel/blur cả ngoài canvas; không để camera tiếp tục kéo sau mouse-up. Có zoom và kiểm tra vật cản.
4. Input theo hướng camera, dừng khi nhập chat/ẩn tab/mất focus/đang ngồi. Server nhận input dừng ngay, vẫn xác nhận vị trí và collision.
5. Tư thế ngồi đặt trong group hình ảnh riêng, tránh đổi độ cao điểm bám camera khi chuyển tư thế. Avatar người chơi vẫn là placeholder, chưa phải nhân vật có animation rig hoàn chỉnh.

Không thêm dependency và không đổi schema database. Server vẫn sở hữu vị trí; chưa thêm client prediction/reconciliation cho mạng latency cao.

## Ghế và đồng bộ

- `CLUB_SEATS` trong `packages/game-protocol/src/club.ts` định nghĩa ba ghế và điểm đứng dậy, khớp sofa hiện có.
- Message `seat` chỉ nhận ID ghế; server kiểm tra zone, khoảng cách thực (1,6 m), ID hợp lệ và ghế chưa có người.
- `seatId` nằm trong Colyseus player state, được đồng bộ sang người chơi khác.
- Khi ngồi, server bỏ input di chuyển và không cho chuyển phòng. Đứng dậy đặt về điểm an toàn trước sofa.
- Ghế được nhả khi đứng dậy hoặc player disconnect; không lưu state ghế/vị trí mỗi frame vào PostgreSQL.

## Kiểm thử

| Kiểm tra | Kết quả |
| --- | --- |
| Typecheck Web/World Server | PASS |
| World unit tests | PASS — 6 bài, gồm phạm vi ghế và chặn di chuyển khi ngồi |
| E2E API/Colyseus | PASS — 2 bài tổng hợp; gồm từ chối ngồi từ xa, ghế đã có người, đứng dậy, disconnect nhả ghế và chuyển phòng |
| Browser kéo chuột phải | PASS — quay khoảng 1,570 rad (90°) |
| Browser kéo chuột trái đủ vòng | PASS — quay khoảng 6,285 rad (360°) |
| Zoom bằng wheel | PASS — khoảng cách trong mẫu từ 8,50 xuống 5,42 m |
| Đi theo hướng nhìn | PASS — sau quay 90°, W di chuyển chủ yếu theo trục X thay vì trục Z cũ |
| Ngồi/đứng bằng Enter và nút | PASS — tư thế ngồi hiển thị trong game |
| Enter trong chat | PASS — không đổi tư thế |
| Hai browser contexts | PASS — người còn lại thấy ghế có người, trạng thái được nhả sau khi đứng/disconnect |
| Browser console | PASS — 0 lỗi, 0 cảnh báo trong lần kiểm tra đã lưu |
| Production build | PASS — 5/5 tác vụ Turbo build thành công; log tại `test-results/logs/camera-seat-build.log` |

Mẫu chuyển động 1,8 giây trong dev, bloom tắt, DPR 1: **59,39 FPS**, p95 frame time **17,3 ms**. Bước nhảy lớn nhất của tọa độ mạng trong mẫu là **0,648 m**; bước hình ảnh giữa hai frame lớn nhất là **0,158 m**. Sai lệch điểm bám camera/avatar ở tọa độ màn hình gần sai số số học (`2,36e-16` NDC).

Đây là bằng chứng xử lý rung do patch/transform trong mẫu local, không phải cam kết hết mọi hiện tượng giật ở mọi máy. Chưa thử tải dài, nhiều người hoặc latency 100–300 ms. Bloom nặng, shader compilation lúc tải asset hoặc phần mềm nền vẫn có thể ảnh hưởng FPS.

## File và bằng chứng

- [Playwright JSON](../../test-results/camera-seat-browser.json)
- [Console](../../test-results/camera-seat-console.txt)
- [E2E log](../../test-results/logs/camera-seat-e2e.log)
- [Unit log](../../test-results/logs/camera-seat-unit.log)
- [Góc camera sau xoay](../../test-results/screenshots/camera-quarter-turn.png)
- [Tư thế ngồi](../../test-results/screenshots/club-seat-final.png)
- [Người chơi khác thấy nhân vật ngồi](../../test-results/screenshots/remote-seated-avatar.png)

Runtime sửa tại `Avatar.tsx`, `FollowCamera.tsx`, `PlayerInput.tsx`, `SeatInteraction.tsx`, `World.tsx`, `WorldHud.tsx`, `useCityConnection.ts`; server sửa player schema, xử lý seat/input, movement và regression tests.

Chạy lại browser QA bằng Playwright MCP `browser_run_code_unsafe` với `filename: "scripts/playtest-camera-seat.js"`. Test server dùng `corepack.cmd pnpm --filter @metaverse/web test:e2e`; các bài dùng server chung được chạy tuần tự và fixture chọn ghế trống để không chiếm ghế của người đang chơi.
