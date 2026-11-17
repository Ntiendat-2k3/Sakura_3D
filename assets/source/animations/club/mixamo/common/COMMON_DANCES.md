# Chuyển động chung của nhân vật (`mixamo/common/`)

Thư mục `assets/source/animations/club/mixamo/common/` chứa toàn bộ các chuyển động dùng chung cho tất cả 11 nhân vật người chơi (dáng đi lại, các điệu nhảy chung), tách biệt với các điệu nhảy riêng của từng NPC trong `assets/source/animations/club/mixamo/`.

| Nhóm / Phím tắt | File nguồn (`mixamo/common/`) | Clip runtime | Thời lượng vòng |
| --- | --- | --- | --- |
| Di chuyển (`WASD` / Mũi tên) | `Dwarf Walk.fbx` | `Walk` | 1,020 giây |
| `N + 3` | `Flair.fbx` | `Flair` | 2,403 giây |
| `N + 4` | `Hip Hop Dancing.fbx` | `HipHop` | 17,983 giây |
| `N + 5` | `Dancing Maraschino Step.fbx` | `Maraschino` | 3,153 giây |
| `N + 6` | `Swing Dancing.fbx` | `Swing` | 20,820 giây |
| `N + 7` | `Snake Hip Hop Dance.fbx` | `SnakeHipHop` | 15,187 giây |

Giữ N rồi bấm số, hoặc chọn nút trên HUD. Nhấn lại tổ hợp, di chuyển hoặc ngồi để dừng. Server kiểm tra kiểu nhảy và đồng bộ cho các client khác. Các clip chạy theo giây nguồn, nối chồng 0,08 giây ở biên, không co giãn theo BPM; root ngang giữ nguyên và chân được bù theo skin thật.

Tái tạo từ thư mục gốc:

```powershell
corepack.cmd pnpm characters:walk
corepack.cmd pnpm characters:flair
corepack.cmd pnpm characters:hiphop
corepack.cmd pnpm characters:maraschino
corepack.cmd pnpm characters:swing
corepack.cmd pnpm characters:snakehiphop
```

Dùng lại `bake-player-flair.ts --motion=...`, hỗ trợ `--character=bocchi` để xử lý một mẫu. Script giữ backup, preview và báo cáo riêng theo tên điệu. GLB ghép thêm animation, giữ mesh, texture và clip cũ. Ba clip mới lấy keyframe 24 Hz rồi nội suy theo FPS hiển thị; khớp có sai số vượt 1 độ giữ dữ liệu 30 Hz. Thời lượng và tốc độ không đổi. Kiểm tra sai số góc khớp với dữ liệu nguồn 30 Hz dưới 1 độ. Các mốc thời gian giống nhau dùng chung accessor để giảm dung lượng và giữ ngân sách GLB dưới 6 MiB. Pipeline dựng nhân vật từ Blender ghép lại đủ năm clip mocap sau khi xuất rig.

Bảng `PLAYER_DANCES` trong game-protocol quy định phím, nhãn, tên clip và nguồn cho web/server/công cụ bake. Kiểm tra bằng terminal trên GLB thật, phím tắt và Colyseus; chưa kiểm thử trình duyệt.
