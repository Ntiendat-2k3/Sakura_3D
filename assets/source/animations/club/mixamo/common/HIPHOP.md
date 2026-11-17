# Hip Hop cho nhân vật người chơi

Nguồn: `Hip Hop Dancing.fbx` do người dùng cung cấp, dài khoảng 7,067 giây. Trong club, giữ **N rồi bấm 4** hoặc bấm nút **N + 4 · Hip Hop**. Nhấn lại để dừng; di chuyển hoặc ngồi cũng dừng. Cả 11 nhân vật đều dùng được và đồng bộ kiểu nhảy qua server.

Tái tạo từ thư mục gốc:

```powershell
corepack.cmd pnpm characters:hiphop
```

Dùng lại pipeline Flair: chuyển FBX sang JSON, retarget theo bind pose rồi ghép clip `HipHop` vào các GLB hiện có. Giữ các clip, mesh và texture cũ; thêm khoảng 239–243 KB mỗi model. Vòng lặp chồng 0,08 giây ở biên, dài khoảng 6,987 giây và chạy theo giây nguồn, không co giãn theo BPM. Root ngang giữ nguyên; độ cao được bù theo các đỉnh skin thật.

`apps/web/scripts/bake-player-flair.ts --motion=hiphop --character=bocchi` chỉ xử lý một mẫu. Backup, preview và báo cáo dùng hậu tố `hiphop` riêng để không ghi đè tài liệu Flair. Script dựng nhân vật từ Blender ghép lại cả Flair và Hip Hop sau khi xuất rig.

Kiểm tra bằng terminal trên GLB thật, phím tắt và Colyseus hai client. Chưa kiểm thử trình duyệt.
