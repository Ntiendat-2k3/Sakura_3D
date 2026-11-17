# Flair cho nhân vật người chơi

Nguồn: `Flair.fbx` do người dùng cung cấp. Clip nguồn dài 1 giây, 52 bone và 53 track có thể dùng. Bản runtime chồng 0,08 giây ở biên để lặp liên tục, còn 0,92 giây mỗi vòng; chạy theo tốc độ gốc, không kéo theo BPM bài nhạc.

Trong club: **giữ N, bấm 3** hoặc bấm **N + 3 · Flair**. Dùng lại tổ hợp để dừng; di chuyển/ngồi cũng dừng như các điệu cũ. Mọi nhân vật đều dùng được, không cần đàn. N+1 và N+2 giữ nguyên.

Tái tạo sau khi sửa FBX, từ thư mục gốc:

```powershell
corepack.cmd pnpm characters:flair
```

Pipeline dùng lại bộ chuyển FBX → JSON và retarget theo bind pose. Clip `Flair` được ghép vào 11 GLB người chơi, giữ mesh/texture và các clip cũ; tăng khoảng 50 KB mỗi model. Root X/Z bị khóa để animation không thay vị trí server. Độ cao được bake theo các đỉnh skin thật để động tác chống tay/quay chân sát sàn.

Các file liên quan:

- `scripts/prepare-club-motion.mjs --mixamo --file=Flair.fbx`: chuyển nguồn sang `apps/web/public/assets/animations/club/Flair.json`.
- `apps/web/scripts/bake-player-flair.ts`: retarget và ghép clip; cập nhật manifest từng model. Có thể chọn `--character=bocchi` để xử lý một mẫu.
- `scripts/build-player-character.py`: tự ghép Flair sau khi dựng lại model từ nguồn.
- `assets/processed/*-before-flair.glb`: bản trước lần ghép; chỉ tái sử dụng nếu runtime vẫn khớp checksum lần bake trước, tránh bỏ mất sửa đổi model mới.
- `assets/processed/*-flair-preview.glb`: clip riêng để kiểm tra offline.
- `assets/processed/bocchi-flair-preview.blend`: bản đã nhập vào Blender, có camera/sàn và Action Flair để xem.

Kiểm tra: test trên đủ 11 GLB thật về biên vòng, rig, độ cao, root và ẩn đàn; kiểm thử Colyseus hai client; ảnh render Blender trong `test-results/screenshots/bocchi-flair-*-offline.png`. Chưa kiểm thử trình duyệt.
