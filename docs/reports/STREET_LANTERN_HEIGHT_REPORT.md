# Nâng cao đèn lồng và ánh đỏ xuống đường

**DONE** về triển khai/kiểm tra offline; **PARTIAL** về xác nhận hình ảnh/FPS trong browser. Không mở trình duyệt hoặc Playwright.

- Bỏ dây giăng ngang giữa đường. Bố trí **24 đèn trên 12 tay đỡ gỗ**, chia hai bên phố; cột gá, thanh chìa và giằng chéo gắn cao trên mặt tiền. Các chi tiết gá dùng lại atlas gỗ hiện có, có đai đồng và móc sắt.
- Đáy đèn mới cao **5.27 m**; 24 đèn mặt tiền cũ được nâng từ 2.5 m lên **4.5 m**, có móc treo tương ứng. Tổng 48 đèn, giữa phố thoáng khoảng **7 m** khi tính cả đường kính đèn.
- Thêm **6 SpotLight đỏ thật** chiếu từ hai bên xuống mặt đường. Chỉ vật liệu các đoạn đường được giảm roughness để tạo vệt phản xạ specular kiểu đường ẩm; không làm bóng cả nhà/vỉa hè, không bật SSR hoặc render mặt gương.
- Model đèn vẫn instancing. Khung treo có 3 nhóm vật liệu; GLB đã tách/reuse 3 atlas có sẵn, giảm từ khoảng 2.7 MB xuống **964,872 byte**, không thêm bản texture trùng.

## Kiểm tra

- **PASS:** TypeScript frontend.
- **PASS:** Khronos glTF Validator trên 11 GLB trong props, không lỗi/cảnh báo.
- **PASS:** Đọc geometry GLB thật bằng Three.js: chi tiết gá thấp nhất 5.25 m, cao nhất 6.68 m; không thêm cột chạm mặt đường.
- **PASS:** GLB và ba atlas tải qua HTTP 200, payload GLB khớp file trên đĩa.
- **DONE:** Blender render offline, đã xem khoảng trống giữa phố và ánh đỏ trên đường; xác nhận cả 24 đèn cũ đã được nâng trong bản xem.
- **SKIPPED:** Browser/WebGL/FPS theo yêu cầu người dùng. Không chạy lại full build hoặc các bài multiplayer vì không sửa backend/mạng hay logic người chơi.

Ảnh: `test-results/screenshots/street-raised-lanterns-offline.png`.

Scene Blender: `assets/processed/street-lantern-garlands.blend`, `assets/processed/street-red-lanterns-preview.blend`.

Bằng chứng: `test-results/raised-lanterns-check.json`, `assets/processed/raised-lanterns-gltf-validation.json`, các log `raised-lanterns-*`.

Các file thay đổi chính: `StreetAssets.tsx`, `street-lantern-layout.json`, `scripts/build-street-lanterns.py`, `preview-street-lanterns.py`, `package-street-assets.py`, `write-asset-manifest.py`, GLB khung treo và manifest. Pipeline DJ gọi lại script đèn riêng khi tái tạo; lần sửa này không dựng lại bàn DJ/NPC.

Tái tạo asset: chạy Blender CLI với `scripts/build-street-lanterns.py`, rồi:

```powershell
python scripts/package-street-assets.py apps/web/public/assets/props/lantern-garlands.glb
python scripts/write-asset-manifest.py
```

Refresh trang game để bỏ cache model cũ. Không cần cung cấp thêm file.
