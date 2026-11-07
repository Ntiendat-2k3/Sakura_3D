# Neon Sakura City — Báo cáo nâng cấp ngoại cảnh

Ngày: 05/11/2026. **Trạng thái tổng thể: PARTIAL.**

Blockout công trình đã được thay bằng model GLB nhập từ các bộ Kenney CC0 và xử lý trong Blender. Game đang chạy tại http://localhost:3000. Mức hình ảnh hiện tại là phố đêm stylized low-poly, chưa đạt toàn bộ yêu cầu “premium anime”: chưa có NPC anime nữ, chưa có nội thất club và cây mới là foliage Kenney phối màu hồng.

## Kết quả theo yêu cầu

| Hạng mục | Trạng thái | Bằng chứng / giới hạn |
| --- | --- | --- |
| Kiểm kê trước khi nâng cấp | DONE | Ban đầu không có GLB/GLTF/FBX/VRM/BLEND trong source được kiểm kê. Scene dùng primitive. |
| Ảnh trước và sau | DONE | `test-results/screenshots/asset-upgrade-before.png`, `asset-upgrade-after.png` |
| Model công trình có nguồn và giấy phép | DONE | 13 file nguồn thực sự sử dụng từ 3 bộ Kenney; có License.txt và SHA-256 trong manifest |
| Một phố nhỏ thay cho blockout | DONE | 8 mặt tiền + 3 tòa nhà hậu cảnh; đường, vỉa hè, mái hiên, cột điện, dây điện, đèn đường, thùng rác |
| Các địa điểm nightlife | DONE | Reika Hostess Lounge, Kurenai Oiran Lounge, Gekka Cabaret, Denmu Night Club, Kohaku VIP; thêm izakaya, atelier và quán trà. **Chỉ có ngoại cảnh và biển hiệu.** |
| Đèn lồng và máy bán nước | DONE | Mesh đèn lồng có nếp giấy, vành và dây; máy bán nước có mặt sản phẩm/nhãn nguyên bản; đã xuất GLB và kiểm tra trong browser |
| Chất liệu | DONE | UV atlas cho gạch/đá, gỗ, kính, kim loại, vải; roughness/metalness/emission, biển Nhật riêng. Không phải toàn bộ vật thể dùng màu phẳng. |
| Lighting | DONE | Night sky, fog, ánh sáng nền xanh, hai nguồn sáng hồng/ấm, bóng tiếp xúc tĩnh, tone mapping; bloom tùy chọn |
| Phong cách Nhật/anime cao cấp | PARTIAL | Có biển Nhật, mái hiên, màn gỗ và mái cong, nhưng bộ nhà nền là Kenney low-poly; chưa phải bộ kiến trúc Nhật chuyên dụng cao cấp |
| Cây anh đào | PARTIAL | Dùng `tree_oak.glb` CC0 và atlas hồng; chưa có mesh hoa/tán anh đào chi tiết |
| Hai NPC Luxury Hostess và Oiran | BLOCKED | Không có model anime nữ trưởng thành kèm quyền chỉnh sửa/phân phối để import. Hướng dẫn chuẩn bị bên dưới. |
| Roster 10 NPC | BLOCKED | Reina, Mizuki, Sora, Yuna, Kaede, Hana, Rika, Emi, Ayame, Madam Kurenai đều chưa có runtime model |
| Avatar người chơi | PARTIAL | Giữ placeholder hình học cũ; sửa nhãn tên luôn hướng về camera. **Không đánh dấu là nhân vật anime hoàn chỉnh.** |
| Blender MCP | BLOCKED | Add-on không kết nối được. Đã dùng Blender CLI local để hoàn thành xử lý môi trường. |
| Blender CLI và file scene | DONE | Blender 5.2.3 LTS; `assets/processed/neon-sakura-street.blend`, có texture đóng gói và proxy va chạm |
| GLB tối ưu / tích hợp R3F | DONE | 11 GLB, useGLTF + Suspense, tái sử dụng geometry/material, instancing 61 vị trí đạo cụ |
| Collision và camera | DONE | Shared layout cho Blender/server; 8/8 công trình ở tầm avatar nằm trong collider; Playwright xác nhận avatar bị chặn và camera ngoài công trình |
| Nội thất, cửa vào club, tương tác NPC | BLOCKED | Chưa được triển khai; nâng cấp ngoại cảnh không tự tạo các tính năng này |

## Nguồn và quyền sử dụng

| Bộ asset | Tác giả | Giấy phép | File đã sử dụng |
| --- | --- | --- | --- |
| [City Kit Commercial 2.1](https://kenney.nl/assets/city-kit-commercial) | Kenney | CC0-1.0 | building-a/d/f/h, building-skyscraper-a, detail-awning-wide |
| [City Kit Roads 2.2](https://kenney.nl/assets/city-kit-roads) | Kenney | CC0-1.0 | road-straight, road-crossing, electricity-pole, electricity-wires, light-curved, dumpster |
| [Nature Kit 2.1](https://kenney.nl/assets/nature-kit) | Kenney | CC0-1.0 | tree_oak |

Gói tải từ liên kết download do chính trang Kenney cung cấp. License.txt gốc được giữ trong `assets/source/kenney-*/`. Texture atlas, biển hiệu, chi tiết bổ sung, đèn lồng và máy bán nước được tạo cho dự án. Chỉ raster hóa chữ từ font hệ thống, không phân phối font Windows.

Đã xem nguồn Quaternius nhưng không mua/tải bản premium. Không sử dụng asset từ VRoid Hub với giấy phép chưa xác minh. Manifest đầy đủ: [ASSET_MANIFEST.json](../../assets/manifests/ASSET_MANIFEST.json).

## Pipeline và ngân sách runtime

1. Giữ source tải xuống trong `assets/source/`.
2. `scripts/create-street-textures.py` tạo atlas nguyên bản.
3. `scripts/build-sakura-street.py` nhập GLB, chuẩn hóa mét, gốc model, UV và vật liệu; dựng scene, proxy; xuất GLB theo Y-up.
4. glTF Transform 4.5.0 thực hiện dedup, weld, prune và quantize. Không thêm decoder Draco hay dependency production.
5. `scripts/package-street-assets.py` tách atlas chung để tránh nhúng lặp texture vào từng GLB.
6. Khronos glTF Validator kiểm tra các file cuối và toàn bộ texture tham chiếu.

Runtime có **663.040 byte GLB + 1.851.226 byte texture dùng chung**, khoảng **2,40 MiB** trước nén HTTP. Bộ đếm này chỉ gồm tài nguyên môi trường thực sự được tham chiếu, không gồm bản nguồn, bản xuất trung gian, font hoặc bundle JavaScript. Scene Blender khoảng 2,22 MiB.

GLB có URI texture tương đối; cần phân phối cả `apps/web/public/assets/`, không chỉ copy riêng một GLB. Validator ghi thông tin `URI_GLB` là hành vi chủ đích này, không phải lỗi/cảnh báo.

Va chạm hiện dùng proxy chữ nhật cho công trình trên mặt phẳng di chuyển; cây và đạo cụ trang trí chưa có collider riêng. Chưa xác nhận navmesh, địa hình cao thấp hoặc physics đầy đủ.

## Kiểm thử thực tế

| Kiểm tra | Trạng thái | Kết quả |
| --- | --- | --- |
| Web TypeScript | DONE | `corepack.cmd pnpm --filter @metaverse/web typecheck` đạt |
| Shared protocol | DONE | 3/3 unit tests đạt; gồm mọi mặt tiền, vỉa hè và khe giữa nhà |
| World movement | DONE | 3/3 unit tests đạt; chặn mặt tiền và trượt góc |
| API / PostgreSQL / Colyseus | DONE | Bài e2e hai client đạt: auth, cùng room, chuyển động hai chiều, chat, từ chối input sai, disconnect |
| glTF Validator | DONE | 11/11 GLB: **0 lỗi, 0 cảnh báo** |
| Đối chiếu mesh/collider trong Blender | DONE | 8/8 công trình nằm trong proxy ở cao độ 0–2,7 m |
| Playwright MCP | DONE | Tải model + texture HTTP 200; WASD hoạt động; camera theo nhân vật; chặn di chuyển vào công trình |
| Browser console | DONE | 0 lỗi, 0 cảnh báo trong lần kiểm tra cuối; không mất WebGL context |
| FPS mặc định, bloom tắt | DONE | **59,13 FPS**, p95 frame time **17,2 ms**; mẫu 3,5 giây khi di chuyển/chạm tường |
| Bloom bật | DONE | Đã kiểm tra bật/tắt và chụp ảnh; mẫu trước đó khoảng 39 FPS, nên không bật mặc định trên máy này |
| Build production | PARTIAL | Chưa chạy lại trong đợt asset này; đã kiểm tra typecheck và runtime Next dev. Không coi đây là xác nhận production build. |
| NPC VRM, animation, MToon | BLOCKED | Chưa có model đầu vào; chưa kiểm thử pipeline nhân vật |

Điều kiện đo: Intel Iris Xe / ANGLE Direct3D11, viewport **1536×776**, DPR 1, Next dev, một người chơi browser. Tại mẫu cuối: **40 draw call, 47.372 tam giác, 9 GPU textures**. Đây là số đo tại góc nhìn cụ thể, không phải cam kết FPS cho mọi máy hoặc nhiều người chơi. Ảnh trước/sau có thay đổi camera và bố cục, không phải benchmark cùng một góc nhìn.

Chứng cứ:

- [Playwright JSON](../../test-results/visual-upgrade-browser.json)
- [Console](../../test-results/visual-upgrade-console.txt)
- [Validator JSON](../../assets/processed/gltf-validation.json)
- [Collision audit](../../assets/processed/collision-audit.json)
- [Ảnh trước](../../test-results/screenshots/asset-upgrade-before.png)
- [Ảnh sau mặc định](../../test-results/screenshots/asset-upgrade-after.png)
- [Ảnh bloom](../../test-results/screenshots/asset-upgrade-bloom.png)
- [Ảnh kiểm tra va chạm](../../test-results/screenshots/asset-upgrade-collision.png)

## Lỗi phát hiện và sửa

- Link ZIP Kenney cũ trả HTML: chuyển sang endpoint download có session/referer của trang chính thức, xác minh ZIP giải nén và giấy phép.
- PowerShell 5.1 đọc tiếng Việt sai: lưu script build bằng UTF-8 BOM. Tách stderr Blender để cảnh báo deprecation không làm pipeline dừng trước khi xuất xong; vẫn kiểm tra exit code và marker hoàn tất.
- UV đèn lồng bị xuất `texCoord=-1` do mesh đích không có UVMap trước khi join: tạo UVMap trước khi ghép, giữ thuộc tính UV qua bước tối ưu; validator cuối đạt.
- Loading Html bên trong R3F Suspense gây lỗi React unmount: đưa loading/error overlay ra DOM bên ngoài Canvas.
- Đường nhập sai hướng, biển hiệu bị kéo giãn: xoay tile đường, tạo atlas riêng theo tỷ lệ biển ngang và biển dọc.
- Vật liệu thân cây bị nhận nhầm là lá: sửa phân loại màu; thay cây thử nghiệm bằng tree_oak và bỏ bản GLB thử không còn dùng.
- Camera có thể vượt nhẹ vào proxy khi áp khoảng cách tối thiểu: chuyển offset về phía lòng đường và bỏ clamp xuyên tường; kiểm thử lại cho kết quả `cameraInside=false`.
- Bloom gây giảm FPS: xử lý bloom ở độ phân giải thấp hơn, thêm nút lựa chọn và mặc định tắt để ưu tiên FPS.
- Docker/PostgreSQL và API đã tắt trong quá trình tiếp tục phiên: khởi động Docker, bật lại đúng container dự án, xác minh cây Turbo của workspace rồi khởi động lại một bộ `npm run dev`. Giữ nguyên volume, không đổi mật khẩu hoặc migration.

## File tạo/chỉnh sửa

- Scene/runtime: `SakuraScene.tsx`, `StreetAssets.tsx`, `CinematicLighting.tsx`, `FollowCamera.tsx`, `Avatar.tsx`, `WorldHud.tsx`, `components/World.tsx`, `app/style.css`.
- Giữ bản cũ: `apps/web/game/scenes/SakuraBlockout.tsx`; đây là bản tham khảo, không phải fallback hoạt động với layout mới.
- Bố cục thuần dùng chung: `packages/game-protocol/src/street-layout.json`, `src/index.ts`, `tsconfig.json`; cập nhật regression tests cho protocol/world-server. Không đổi kiến trúc API, Sequelize hay schema DB.
- Pipeline: `scripts/Build-Street.ps1`, `create-street-textures.py`, `build-sakura-street.py`, `package-street-assets.py`, `validate-street-assets.cjs`, `audit-street-scene.py`, `write-asset-manifest.py`, `playtest-street.js`.
- Asset nguồn, GLB, texture, scene Blender, manifest, audit, báo cáo và screenshots trong các thư mục được yêu cầu.
- Không thêm production dependency, dịch vụ trả phí hoặc sửa cấu hình Codex/MCP/Skills. glTF Transform và Khronos Validator chạy từ npm cache của công cụ.

## Phần cần người dùng chuẩn bị

**BLOCKED — nhân vật anime.** Chuẩn bị hai model gốc bằng [VRoid Studio](https://vroid.com/en/studio), theo [hướng dẫn xuất và giấy phép trong dự án](../../assets/source/characters/README.md). Ưu tiên đề xuất: Reina (Luxury Hostess) và Ayame (Oiran). Lưu `.vroid`, `.vrm` cùng thông tin tác giả/quyền phân phối tại `assets/source/characters/`.

Không cần cung cấp API key. Các [quy định chính thức VRoid](https://vroid.com/en/studio/guidelines) không coi nội dung nền pixiv là CC0; cần kiểm tra điều khoản riêng của sample/preset. Chưa thể xác nhận rig, animation hay chất lượng anime khi chưa có file nhân vật.

## Chạy lại

Các server đang chạy. Mở http://localhost:3000; không chạy thêm một bản dev trùng cổng. Khi đã dừng các tiến trình cũ, khởi động cả ba app từ workspace:

```powershell
npm run dev
```

Lặp lại kiểm tra:

```powershell
corepack.cmd pnpm --filter @metaverse/web typecheck
corepack.cmd pnpm --filter @metaverse/game-protocol test
corepack.cmd pnpm --filter @metaverse/world-server test
corepack.cmd pnpm --filter @metaverse/web test:e2e
```

Tái tạo asset (cần Blender, Python/Pillow và gói nguồn đang được giữ trong workspace):

```powershell
npx.cmd --yes @gltf-transform/cli@4.5.0 --version
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Build-Street.ps1
python scripts/write-asset-manifest.py
```

`ExecutionPolicy Bypass` chỉ áp dụng cho tiến trình chạy script đã kiểm tra, không đổi chính sách toàn máy. Playtest lại qua Playwright MCP với `browser_run_code_unsafe` và `filename: "scripts/playtest-street.js"`.
