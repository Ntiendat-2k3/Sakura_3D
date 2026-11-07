# NPC anime — BLOCKED

Cập nhật: đã nhận WINE/POP và tích hợp vào bản test Denmu; xem [CLUB_TEST_REPORT.md](../../../docs/reports/CLUB_TEST_REPORT.md). Hai model chưa có bằng chứng giấy phép phân phối đầy đủ và không được tự gán thành Reina/Ayame. Trạng thái BLOCKED bên dưới áp dụng cho roster được lên kế hoạch và việc xác nhận quyền phát hành.

Chưa có model VRM/GLB nữ trưởng thành kèm quyền phân phối trong source đã kiểm kê. Avatar capsule hiện có chỉ là placeholder của người chơi. Chưa có NPC nào trong roster được import, rig hoặc kiểm thử animation.

Roster cần model: Reina, Mizuki, Sora, Yuna, Kaede, Hana, Rika, Emi, Ayame, Madam Kurenai. Ưu tiên đề xuất cho lần xác nhận pipeline: Reina — Luxury Hostess và Ayame — Oiran; chưa có tài liệu thiết kế chi tiết của roster trong repository để đối chiếu.

## Chuẩn bị hai model bằng VRoid Studio miễn phí

1. Tải ứng dụng từ https://vroid.com/en/studio và tạo hai nhân vật gốc. Dùng preset thông thường hoặc texture tự vẽ; kiểm tra điều khoản riêng nếu dùng preset/sample hay phụ kiện của người khác.
2. Thiết kế rõ là phụ nữ trưởng thành: tỷ lệ cơ thể người lớn, trang phục và khuôn mặt trưởng thành. Reina mặc đầm lounge; Ayame mặc kimono/obi. Đây là định hướng đề xuất, chưa phải model đã hoàn thành.
3. Lưu bản chỉnh sửa `.vroid`; chọn chức năng **Export as VRM**, định dạng VRM 1.0. Điền tác giả, tên nhân vật và quyền sử dụng/phân phối đúng với asset do mình tạo. Giữ rig humanoid; giảm texture xuống 1024–2048 và polygon bằng tùy chọn xuất nếu có.
4. Lưu `reina.vroid`, `reina.vrm`, `ayame.vroid`, `ayame.vrm` trong thư mục này. Thêm `LICENSE.md` ghi tác giả, nguồn từng item và quyền phân phối model trong game web; client tải được file model nên chỉ quyền dùng hình render là chưa đủ.
5. Sau khi có model: kiểm tra metadata/license, chiều cao, UV, MToon, rig và idle/walk; chuyển đổi hoặc tích hợp bằng loader VRM phù hợp rồi thử trong scene. Các bước này **chưa được thực hiện**. Không đổi đuôi `.vrm` thành `.glb` rồi coi là đã chuyển đổi.

Quy định chính thức: https://vroid.com/en/studio/guidelines . Nội dung nền do pixiv cung cấp không phải CC0; một số sample/preset có điều kiện riêng. Không dùng model tải ngẫu nhiên từ VRoid Hub khi chưa xác minh quyền chỉnh sửa và phân phối.
