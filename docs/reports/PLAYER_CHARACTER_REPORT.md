# Chọn nhân vật người chơi và nhảy trong club

## Cách dùng

- Chạy lại `npm run dev` nếu đang mở phiên cũ, rồi tải lại trang để Web và World Server cùng dùng schema mới.
- Màn chọn có 11 lựa chọn: Bocchi, Kita, Ryo, Übel, Miorine, Nijika, Serie, Yui và Airi/Annie/Kuroki **bản dựng lại**. Ba bản dựng dựa trên rig/hình học Yui và hình tham chiếu, không phải ba avatar thương mại gốc. Chọn mẫu rồi bấm **Vào game**; guest local được tạo tự động, không nhập mật khẩu. Giữ nguyên JWT, kiểm tra phòng và chặn guest khi API chạy production.
- Trình duyệt ghi nhớ ID đã chọn qua localStorage. Dữ liệu hỏng, ID lạ hoặc storage bị khóa không chặn game; lựa chọn trở về Bocchi mặc định. Không lưu token hoặc mật khẩu vào storage.
- Nút **Đổi nhân vật** trên HUD đóng World hiện tại, rời phòng/giải phóng audio rồi quay lại màn chọn. Lần vào tiếp theo tạo một guest mới theo luồng test hiện có.
- WASD/phím mũi tên điều khiển di chuyển theo camera như trước.
- Trong Denmu, giữ **N** rồi bấm **1** để nhảy thường, hoặc **2** để cầm đàn nhảy. Có hai nút tương ứng trên HUD. Nhấn lại tổ hợp của kiểu đang chọn để dừng; chọn tổ hợp còn lại để đổi kiểu. N đơn vẫn được giữ tương thích và chỉ xử lý khi thả phím, tránh bật nhảy thường trước N+2.
- Phím tắt không chạy ngoài club, khi đang ngồi hoặc gõ chat/văn bản. Giữ phím không tự lặp lệnh; mất focus/ẩn tab hủy trạng thái tổ hợp.
- Người chơi đang ngồi cần đứng dậy trước khi nhảy. Khi ra phố, trạng thái nhảy được đặt lại.
- N+2 có trên Bocchi, Kita và Ryo; Ryo dùng đàn bass. Các mẫu còn lại dùng nhảy thường; client vô hiệu hóa nút đàn và server từ chối lệnh đàn không phù hợp. Nijika không dùng hai dùi trống rời trong bộ chuyển động người chơi hiện tại.
- Thao tác E/click vào club tiếp tục mở khóa phát nhạc trên cùng audio element; nếu trình duyệt từ chối, dùng nút Cho phép phát nhạc. Tải trước không đồng nghĩa tự phát nhạc khi vừa mở trang.

## Tải trước club

- Ngay khi World mở, bắt đầu tải code club, nội thất, đèn/đạo cụ, cả 11 GLB người chơi, bốn NPC và nhạc. Màn chuẩn bị ban đầu chỉ hoàn tất sau khi model/animation được tải, texture upload xong và audio đã có thể phát. Nếu tải lỗi có nút thử lại. Ảnh chọn được tải ngay ở màn chọn.
- Dùng đúng khóa URL đơn của `useGLTF` mà các scene đang dùng; không tạo cache mảng URL riêng rồi tải lại khi vào club.
- Các NPC tải song song thay vì chờ toàn bộ HTTP/decode/retarget của model trước xong mới bắt đầu model sau. Promise/model/rig được dùng lại trong cùng World.
- Upload tối đa ba texture mỗi lượt nhàn rỗi. Hai lời gọi warm cùng chờ chung promise; lỗi GPU cho phép thử lại. Đóng World khi đang chuẩn bị hủy công việc và không đưa model đã dispose vào cache phiên mới.
- MP3 tải đủ qua một lần fetch và phát từ blob trong bộ nhớ. Audio element và blob sống cùng World; đổi phòng hoặc quay lại nhạc chung không tải lại file. Khi World đóng, hủy request và thu hồi object URL.
- Lần mở game đầu vẫn cần tải dữ liệu; thay đổi chuyển thời gian chờ về màn chuẩn bị đầu phiên. Chưa đo thời gian thực hoặc chi phí biên dịch shader lần đầu trên GPU trong browser.

## Asset và chuyển động

- Nguồn trong `assets/source/characters/figure`: sáu mẫu dùng Blender, Miorine dùng FBX, Yui dùng FBX/texture tách từ unitypackage. Ba bản dựng có source riêng tại `assets/processed/reconstructed`. Không ghi đè nguồn hoặc ảnh texture người dùng. Đường dẫn Kita đã cập nhật theo thư mục người dùng đổi tên thành `kita`.
- Catalog duy nhất tại `packages/game-protocol/src/player-characters.json`; renderer, màn chọn, tải trước và server dùng chung danh sách này.
- Chuẩn hóa tên xương và vertex group về cùng hệ Hips/Spine/LeftArm/LeftLeg..., giữ bone roll. Bộ máy tạo animation dùng lại cho cả 11 mẫu. Yui và ba bản dựng chỉ có một xương ngực; không chèn thêm xương giả vì các động tác không có đàn dùng được trực tiếp với cấu trúc đó.
- Bản Blender có animation tại `assets/processed/<id>-player.blend`; GLB và ảnh chọn tại `apps/web/public/assets/characters/player/`, mỗi mẫu cao 1,78 m. Manifest có hash nguồn/runtime cho từng mẫu.

| Mẫu | Dung lượng GLB | Tam giác trước xuất | Đàn |
| --- | ---: | ---: | --- |
| Bocchi | 1.541.360 byte | 10.853 | Guitar |
| Kita | 2.673.472 byte | 12.901 | Guitar |
| Ryo | 1.634.236 byte | 12.585 | Bass |
| Übel | 1.077.740 byte | 5.640 | Không |
| Miorine | 1.014.808 byte | 4.427 | Không |
| Nijika | 1.478.184 byte | 9.291 | Không |
| Serie | 1.493.032 byte | 6.946 | Không |
| Yui | 5.228.464 byte | 51.120 | Không |
| Airi · bản dựng | 3.901.236 byte | 48.062 | Không |
| Annie · bản dựng | 3.355.164 byte | 44.952 | Không |
| Kuroki · bản dựng | 4.038.512 byte | 50.334 | Không |

- Giữ texture bảng màu 128 × 128, rig và shape keys khuôn mặt. Đàn gốc được bake thành mesh rồi skin toàn bộ vào xương ngực `Spine2`; bỏ constraint nguồn khỏi bản xuất để tránh lệch hệ tọa độ. Chỉ hiện đàn ở kiểu nhảy với đàn.
- Đàn rời của Kita/Ryo được đặt chéo trước ngực thay vì đứng cạnh người như file nguồn. Gậy của Übel được loại khỏi bản runtime vận động.
- Blender tạo các clip `Idle`, `Walk`, `Run`, `Sit`, `Dance`, `GuitarDance` và `Blink`. `GuitarDance` có tay trái giữ cần, tay phải quạt dây, theo chuyển động thân. Đàn và clip cùng nằm trong GLB tải trước, N+2 không tải thêm file. Không thêm dependency.
- `Walk` được tạo ở 1,4 m/s, vòng 0,8 giây; `Run` ở 4,8 m/s, vòng 0,6 giây (200 bước/phút). Một lần chống kéo dài 156 ms, bàn chân lùi tương đối 74,9 cm để bù đúng quãng root tiến. Giữ nguyên tốc độ gameplay của server.
- Đi/chạy dùng chung pha chân và blend theo tốc độ hiển thị; nhịp tính theo trọng số clip thực sự đang hiển thị, tránh dùng sải chạy quá sớm khi cơ thể vẫn đang chuyển từ đi. Nhịp chân giảm về không lúc nghỉ.
- Chân dùng IK hai đoạn, giới hạn tầm với để không kéo dài xương. Đi bộ giữ đường Hermite; chạy dùng cung cosine kèm hiệu chỉnh vận tốc ở hai đầu, tránh tiếp tuyến dài làm chân văng quá xa. Giảm nhấc chân chạy từ 32 cm xuống 14 cm, bỏ nhịp hất chân phụ, thêm xoay cổ chân trong pha thu chân.
- Hông thấp nhất ở giữa pha chịu lực; kiểm tra tầm với cả hai chân theo tỷ lệ xương từng mẫu và chừa 1% chiều dài cho gối gập. Đổi vector dịch chuyển qua trục rest của chính xương Hips, vì Übel có hướng xương khác armature gần 90°. Nhờ đó hạ hông đúng hướng và IK không cắt ngắn quỹ đạo chân chống. Điệu nhảy vẫn giữ chân tại chỗ theo chu kỳ tám beat.
- Tay chạy đánh ngược chân theo đúng pha tiếp đất, vai vung khoảng 25°, khuỷu giữ góc mềm khoảng 117–123° thay vì quạt 90–154° như cũ. Dáng đi bộ giữ nguyên. Khi nhảy, hai tay thay phiên nâng/hạ theo cung, ngón tay mở/khép nhẹ.
- `Sit` là tư thế giữ dáng; đứng/ngồi chuyển qua blend trọng số, chưa có clip chuyển tiếp riêng. Đệm sofa hiện cao nên chân nhân vật ngồi thả xuống.
- Chớp mắt chạy thành lớp riêng, tiếp tục hoạt động khi chuyển clip. Mỗi người có clone skeleton và mixer riêng; geometry, material và texture được chia sẻ.
- Chưa có chỉnh tóc/mặt, thay đồ hoặc lưu avatar theo tài khoản. Đây là chọn mẫu hoàn chỉnh và nhớ lựa chọn trên trình duyệt cho test.
- Nguồn do người dùng cung cấp để dùng trong dự án local; chưa xác minh quyền phân phối mẫu. Xem thêm `assets/processed/bocchi-player-manifest.json`.

Đo trực tiếp clip chạy GLB của 11 mẫu bằng Three ở 240 pha/vòng: biên độ cổ chân 14,8–15,1 cm, khuỷu 116,6–123,3°, gối duỗi tối đa 163,8°. Sai số vận tốc chân chống trung bình 0,040–0,056 m/s trong đoạn giữa tiếp xúc (dưới 1,2% tốc độ root); phép đo bỏ vùng đổi tiếp xúc giữa hai mẫu bake. Unit test mô phỏng giữ chạy 5 giây rồi dừng/đi lại ở bước thời gian 30/60/144 FPS, không phải đo FPS trình duyệt.

## Các gói mới và Unity

| Thư mục | Nội dung đã xác minh | Kết quả |
| --- | --- | --- |
| `nijika` | Model Blender/FBX đầy đủ, palette và blink | Đã thêm vào catalog, ảnh chọn và tải trước |
| `booth_serie` | Model Blender/FBX đầy đủ, palette và blink | Đã thêm vào catalog, ảnh chọn và tải trước |
| `yui` | `YUI_1.0.0.unitypackage` có avatar FBX, prefab, vật liệu và texture | Đã chuyển sang GLB, đủ bảy clip |
| `Airi` | Chỉ texture/vật liệu thay thế; không có model/rig | Đã dựng phiên bản tham chiếu riêng; avatar gốc vẫn chưa có |
| `Annie` | Gói `PoleDanceSystem` và ảnh hướng dẫn; không có avatar Annie | Đã dựng biến thể theo ảnh trong tài liệu; chưa đưa bộ PoleDance vào game |
| `Kuroki` | FBX gồm 13 mesh trang phục/phụ kiện, không có model cơ thể/đầu | Đã ráp áo vào bản dựng trên rig Yui; avatar gốc vẫn chưa có |

Không tìm thấy ba avatar gốc trong dự án. Theo yêu cầu dựng gần giống bằng Blender, đã tạo ba biến thể trên rig/hình học Yui do người dùng cung cấp, ghi rõ “bản dựng” trong catalog và provenance. Airi tham chiếu [ảnh tác giả](https://booth.pm/ja/items/6082686); Kuroki tham chiếu [ảnh tác giả](https://booth.pm/ko/items/8822547) và dùng mesh áo trong gói có sẵn; Annie dựa trên nhân vật minh họa trong `How to set up.docx`, không xác nhận đó là avatar Annie nguyên bản.

- `scripts/build-reconstructed-figures.py` tạo source `.blend` riêng: Airi có sừng cong, tóc dài, váy và tay áo; Annie có tóc tím, tai/đuôi mèo và mặt nạ; Kuroki có tóc đen, kính, tai mèo và áo ráp theo rest-space giữa hai rig.
- Phụ kiện và quần áo được gộp theo mesh/material, giữ vertex group và rig. Ba GLB dưới 6 MiB, dưới 65 nghìn tam giác, tối đa 12 primitive skin và texture tối đa 1024 px. Không tạo ba bản sao chỉ đổi tên.
- Mắt Airi/Kuroki được đổi sang tím trong vùng UV iris; giữ hai morph chớp mắt. PNG sau chỉnh được nạp lại trước khi pack, tránh Blender dùng blob packed cũ. Ảnh cận mặt ở `test-results/screenshots/<id>-head-offline.png`.
- Provenance tại `assets/processed/reconstructed/<id>-provenance.json`, đồng thời được gắn vào manifest GLB. Mô tả rõ phần tái sử dụng từ Yui, mesh áo bổ sung và ảnh tham chiếu. Chưa đạt độ chính xác hình học/biểu cảm như các mẫu thương mại gốc.

- `scripts/extract-unity-character.py` chỉ tách FBX/ảnh/vật liệu/prefab vào `assets/processed/unity`, không nạp code Unity. Đường dẫn phải ở trong `Assets`, từ chối traversal, drive/ADS và đường dẫn trùng. Đã kiểm tra từ chối archive traversal mà không thay đổi dữ liệu đã nhập.
- Yui khôi phục `_MainTex` theo GUID của material Unity, dùng PBR trong GLB thay cho shader Unity; không mang script, controller hoặc hiệu ứng riêng của Unity sang Web. Material dùng chung ảnh được nhúng một lần.
- Texture Yui tối đa 1024 px, lưới giảm còn 51.120 tam giác; giữ riêng hai morph chớp mắt đang dùng. Bản đầy đủ vẫn ở package nguồn. Unit test chặn GLB trên 6 MiB, trên 60 nghìn tam giác, texture lớn hơn 1024 hoặc nhúng ảnh trùng.
- Nijika có rig đang ẩn trong nguồn. Bước xuất mở khóa/hiện rig của bản làm việc, xác nhận GLB có skin và đủ clip trước khi tiếp tục. File tác giả được giữ nguyên.
- Kiểm kê tại `test-results/new-character-inventory.json` và `new-character-inspection-*.json`; hash package/FBX/runtime Yui được ghi trong manifest.

Tách lại nguồn Unity trước khi build Yui:

```powershell
python scripts/extract-unity-character.py assets/source/characters/figure/yui/YUI_1.0.0.unitypackage --character yui
```

Tạo lại asset và bảy ảnh kiểm tra từ chính GLB đã xuất, không mở browser:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/build-player-character.py -- --character=kita --portrait
```

Đổi ID thành một trong 11 ID tại catalog. Với ba bản dựng, chạy `build-reconstructed-figures.py` bằng Blender trước để tạo source, sau đó dùng pipeline xuất chung. `--portrait` xuất ảnh chọn; `--preview` render động tác ngoại tuyến; `--head-preview` thêm ảnh cận mặt; `--guitar-preview` kiểm tra hai pha cầm đàn; `--gait-preview` render sáu pha chạy từ GLB runtime. Bỏ cờ render nếu chỉ cần xuất asset.

## Đồng bộ và xử lý lỗi

- Client gửi `dance: { dancing: boolean, style?: 'normal' | 'guitar' }`; không được gửi vị trí hoặc sửa state người khác. Payload cũ không có style vẫn được hiểu là nhảy thường.
- Server chỉ chấp nhận nhảy trong club, từ người chơi đã được xác thực và không ngồi. Payload sai kiểu bị bỏ qua.
- Khi join, client chỉ gửi `characterId` trong catalog, không gửi URL model. Server từ chối ID lạ trước khi thêm player; default Bocchi giữ tương thích client cũ. `characterId` nằm trong state Colyseus; hook gửi lại cùng ID khi đổi phòng.
- State `dancing` và `danceStyle` được Colyseus đồng bộ, kể cả cho người vào phòng muộn; style không hợp lệ bị từ chối.
- Input nghỉ không hủy nhảy. Input di chuyển hợp lệ khác không, ngồi thành công hoặc vào phòng mới kết thúc nhảy và cất đàn.
- Pha nhảy lấy từ beat/epoch phòng đang có; animation không thay đổi root dùng cho vị trí và camera.
- Mỗi tick tăng `CityState.simulationTime` kể cả khi mọi người đứng yên, để Colyseus vẫn phát patch khoảng 10 Hz. Adapter gắn mốc này vào `PositionSnapshot.sampleTime`; nội suy dùng thời gian mô phỏng thay vì thời điểm React commit. Patch chứa số tick khác nhau hoặc gói đến lệch nhịp không còn bị hiểu nhầm thành tăng/giảm tốc.
- Vị trí hiển thị đệm snapshot 200 ms và quay theo cung ngắn có damping; chỉ nội suy giữa các tọa độ server đã nhận. Camera theo cùng root hiển thị. Đệm tăng 75 ms so với bản trước để bao phủ một patch, tick lệch pha và dao động nhận gói/commit; chưa đo cảm giác input trong browser. Lệch đồng hồ được hiệu chỉnh từ từ, không nhảy ngay sang mốc mới.
- Snapshot đứng yên thật được gửi và giữ, tránh nối quãng đứng yên dài thành một đoạn di chuyển. Khi thiếu gói, nhân vật dừng ở tọa độ cuối thay vì dự đoán ra ngoài; cập nhật dịch chuyển xa được nhận như teleport và không tạo nhịp chạy giả. Snapshot cũ không được đẩy lùi timeline.
- Dùng lại `SceneLoadBoundary` để báo lỗi tải model, và có hình chờ khi GLB đang tải.
- Bỏ import `reflect-metadata` thừa ở World Server: package này không khai báo dependency đó, và schema Colyseus dùng decorator riêng không cần polyfill. Lỗi khởi động được phát hiện khi chạy kiểm thử mạng thật.

## Kiểm chứng

| Kiểm tra | Kết quả |
| --- | --- |
| Blender xuất/nhập GLB và render | Đạt: 11 ảnh chọn; ba bản dựng có ảnh cận mặt và bảy ảnh động tác từ GLB, đã xem chạy/ngồi/nhảy. Tám GLB trước giữ nguyên |
| `corepack.cmd pnpm test` | Đạt: 58 bài toàn workspace, gồm 43 bài Web; kiểm tra đủ 11 lựa chọn, provenance/nhãn bản dựng và ngân sách GLB/texture/mesh |
| `corepack.cmd pnpm typecheck` | Đạt toàn workspace |
| `corepack.cmd pnpm build` | Đạt cả 5 tác vụ build |
| `corepack.cmd pnpm --filter @metaverse/web test:player:e2e` | Đạt: đăng nhập từng ID trong 11 mẫu và xác nhận client khác thấy đúng lựa chọn; hai client kiểm tra nhảy/ngồi/chuyển phòng, heartbeat đứng yên và vận tốc theo mốc server |
| Browser/WebGL, giao diện mobile và FPS | Chưa chạy; chưa được người dùng cho phép mở browser |
| E2E toàn luồng API/PostgreSQL | Chưa chạy lại; bài mạng mới dùng JWT test riêng, không gọi API/database |

Log cập nhật màn chọn tại `test-results/logs/character-selection-tests.log`, `character-selection-web-tests.log`, `character-selection-typecheck.log`, `character-selection-build.log`, `character-selection-room-e2e.log`. Fixture mạng giảm ga gần đích để patch 10 Hz không làm client test chạy qua lại quanh điểm ngồi. Tổ hợp phím, chọn mẫu và storage được kiểm tra bằng unit test; chưa kiểm thử giao diện/bàn phím/audio/WebGL trực tiếp trong browser, và chưa đo FPS/thời gian tải thực tế.

Log lần chỉnh giữ phím chạy tại `test-results/logs/natural-run-test.log`, `natural-run-animation-tests.log`, `natural-run-typecheck.log`, `natural-run-build.log` và `natural-run-<id>.log`. Typecheck ban đầu chạy đồng thời build nên va chạm file sinh trong `.next`; đã chạy lại tuần tự sau build và đạt 6/6 tác vụ. Build đạt 5/5 tác vụ.

Log sửa giật vị trí tại `test-results/logs/movement-jitter-test.log`, `movement-jitter-e2e.log`, `movement-jitter-typecheck.log`, `movement-jitter-build.log`. E2E lần đầu có lỗi tháo listener trong fixture; đã đổi sang API `onStateChange.remove` của bản Colyseus đang cài và chạy lại đạt. Bản này thêm trường schema phòng; khởi động lại cả Web/World Server và tải lại trang để nhận đầy đủ thay đổi.

Log nhập nhân vật mới tại `test-results/new-character-<id>.log`, `new-character-<id>-preview.log`, `new-characters-test.log`, `new-characters-e2e.log`, `new-characters-typecheck.log`, `new-characters-build.log`. Kiểm tra hash cho cả tám nguồn/runtime và package Yui đều đạt. Màn chọn, tải trước, lưu lựa chọn và server dùng chung catalog nên không tạo luồng UI/đăng nhập riêng cho mẫu mới. Khởi động lại phiên dev và tải lại trang để Web/World Server cùng nhận catalog tám mẫu.

Log ba bản dựng tại `test-results/logs/reconstructed-figures-build.log`, `reconstructed-<id>.log`, `reconstructed-<id>-preview.log`, `reconstructed-test.log`, `reconstructed-e2e.log`, `reconstructed-typecheck.log`, `reconstructed-build.log`. Toàn bộ lựa chọn dùng chung luồng guest, tải trước và đồng bộ cũ. Khởi động lại phiên dev và tải lại trang để nhận catalog 11 mẫu. Chưa chạy browser/WebGL/FPS trực tiếp.

Bài `test:player:e2e` tự mở World Server trên cổng local tạm, dùng secret ngẫu nhiên trong bộ nhớ, kiểm tra token thiếu, giới hạn zone, payload sai kiểu, hai client, người vào muộn, dừng/bật lại, di chuyển, ngồi/đứng và chuyển phòng. Bài kiểm tra tự đóng client và server. Chạy build `game-protocol` và `world-server` trước nếu chạy bài này trên checkout mới.

Blender có cảnh báo tương thích API và giới hạn bốn trọng số xương trên mỗi đỉnh khi xuất; đã nhập lại và kiểm tra bản GLB. Không có kiểm chứng hình ảnh trong game thực tế ở lần thay đổi này.
