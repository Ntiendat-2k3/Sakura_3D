# Nhạc của Denmu Club

Đặt các file **MP3/M4A** vào thư mục này; cũng hỗ trợ WAV/OGG. Có thể chia thư mục con. Giữ file nguồn để lần quét sau không mất bài trong catalog.

Tại thư mục gốc dự án, chạy:

```powershell
corepack.cmd pnpm music:sync
corepack.cmd pnpm dev
```

Nếu game đang chạy, dừng rồi khởi động lại sau khi sync. Máy cần `ffprobe` (đã có trên máy hiện tại). Script kiểm tra thời lượng thật, sao chép sang public với tên an toàn và sinh `packages/game-protocol/src/club-playlist.json`. Không cần đổi tên tiếng Việt của file nguồn. `music.mp3` mặc định được giữ riêng, không thêm trùng nếu nội dung không đổi.

Tên bài lấy từ tag Title hoặc tên file. Có thể sửa `title`, `artist`, `bpm`, `beatOffsetSeconds`, `cues` trong catalog; lần sync sau sẽ giữ các trường này theo đường dẫn nguồn. Đổi tên/di chuyển file nguồn tạo ID mới. BPM lấy từ tag nếu hợp lệ, nếu thiếu dùng 120 làm giá trị tạm; cần chỉnh BPM/offset để đèn khớp nhạc. Đây là danh sách chọn từng bài, bài đã chọn phát lặp cho cả phòng.

Trong club, đến trước sân khấu, đứng yên và **giữ O 1,2 giây**. DJ Rio đi xuống cầu thang đến gặp bạn rồi mở danh sách. Chọn **Order** để yêu cầu bài; bài hiện tại tiếp tục phát trong lúc DJ quay lại bàn, bài mới chỉ phát chung khi DJ đã về tới bàn. Mỗi người tự chỉnh âm lượng/tạm dừng. Nhả O sớm để hủy giữ phím, hoặc Esc/nút Hủy để DJ quay về. Mỗi lần chỉ phục vụ một người. Trước khi order, đi xa, rời phòng hoặc không chọn bài sau 30 giây sẽ hủy lượt; yêu cầu đã nhận vẫn được phát khi DJ về bàn.

Nhạc được tải nền tối đa hai bài cùng lúc và giữ qua các lần đổi phòng. Bài chưa tải xong có trạng thái riêng trong menu; lỗi mạng có nút tải lại. Bộ nhớ sử dụng tăng theo tổng dung lượng danh sách; MP3 gọn hơn WAV. Trình duyệt có thể yêu cầu bấm cho phép phát âm thanh.
