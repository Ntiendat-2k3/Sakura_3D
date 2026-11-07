# Tài liệu dự án

Hướng dẫn chạy nằm trong [README chính](../README.md). Các đường dẫn trong manifest và lệnh terminal được tính từ thư mục gốc dự án.

## Kiến trúc và kế hoạch

- [Kiến trúc](ARCHITECTURE.md)
- [Roadmap](ROADMAP.md)
- [Kế hoạch hoàn thiện](KE_HOACH_HOAN_THIEN.md)
- [Ghi chú phát hành](RELEASE_NOTES.md)
- [Checklist QA](QA-CHECKLIST.md)
- [Ghi chú bảo mật](SECURITY-NOTES.md)
- [Hướng dẫn nâng cấp kiến trúc](CODEX-UPGRADE-PROMPT.md)

## Báo cáo kỹ thuật

- [Thiết lập môi trường local](reports/DEV_SETUP_REPORT.md)
- [Nâng cấp hình ảnh khu phố](reports/VISUAL_UPGRADE_REPORT.md)
- [Camera và ghế ngồi](reports/CAMERA_SEATING_REPORT.md)
- [Nhân vật người chơi](reports/PLAYER_CHARACTER_REPORT.md)
- [Kiểm thử Denmu Club](reports/CLUB_TEST_REPORT.md)
- [Animation nhảy](reports/CLUB_DANCE_REPORT.md)
- [Ánh sáng club](reports/CLUB_LIGHTING_REPORT.md)
- [Nhạc và hiệu ứng chiếu sáng](reports/CLUB_MUSIC_PROJECTION_REPORT.md)
- [Lễ tân và tải nhân vật](reports/CLUB_GREETER_LOADING_REPORT.md)
- [Chuyển động NPC](reports/NPC_MOTION_REPORT.md)
- [Phục hồi Rosetta](reports/ROSETTA_RESTORATION_REPORT.md)
- [Import animation người dùng](reports/USER_DANCE_IMPORT_REPORT.md)
- [DJ Rio và đèn lồng](reports/DJ_RIO_LANTERN_UPGRADE_REPORT.md)
- [Chiều cao đèn lồng](reports/STREET_LANTERN_HEIGHT_REPORT.md)

Các báo cáo ghi lại trạng thái tại thời điểm thực hiện; không thay thế kết quả kiểm tra hiện tại.

## Nguồn asset và kết quả kiểm tra

- [Manifest khu phố](../assets/manifests/ASSET_MANIFEST.json)
- [Manifest club](../assets/manifests/CLUB_ASSET_MANIFEST.json)
- [Kết quả kiểm tra có cấu trúc](../test-results/)
- [Log build và test](../test-results/logs/)
- [Ảnh kiểm tra](../test-results/screenshots/)

## Quy ước lưu file

- Đặt báo cáo mới trong `docs/reports/`; cập nhật mục lục này khi thêm báo cáo.
- Ghi log vào `test-results/logs/`, ảnh kiểm tra vào `test-results/screenshots/`, dữ liệu kiểm tra JSON vào `test-results/` và file tạm vào `test-results/tmp/`.
- Đặt công cụ xử lý trong `scripts/`; giữ công cụ phụ thuộc trực tiếp vào package trong package đó, như `apps/web/scripts/`.
- Giữ asset gốc và giấy phép trong `assets/source/`, dữ liệu trung gian trong `assets/processed/`, manifest tổng hợp trong `assets/manifests/`. Asset phục vụ game vẫn ở `apps/web/public/assets/`.
- Chỉ xóa file nén sau khi đối chiếu đầy đủ nội dung với bản giải nén. Không xóa model, texture, animation, giấy phép hoặc file nguồn chỉ vì đã dùng để export.
- Các script `write-asset-manifest.py` và `write-club-manifest.py` ghi vào `assets/manifests/`. Manifest club đọc trực tiếp thư mục FBX đã giải nén, không cần giữ `Dancing.zip`.

## File được Git bỏ qua

`.gitignore` bỏ qua cache, log, bản sao lưu Blender (`.blend1`, `.blend2`, ...), ảnh preview và các định dạng export Kenney mà pipeline không dùng (FBX, OBJ, DAE, STL). Các file này vẫn còn trên máy. Model GLB/glTF, texture, giấy phép, manifest và mã nguồn cần thiết vẫn được Git nhận diện; FBX animation và nhân vật ở các thư mục khác không bị bỏ qua bởi quy tắc Kenney.
