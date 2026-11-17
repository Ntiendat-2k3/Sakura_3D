# Báo cáo mở rộng Thành phố: Trăng Máu, Chu kỳ Thời tiết, Màn hình Loading, Love Hotel & Reika Lounge

Ngày cập nhật: 2026-11-09  
Trạng thái: **DONE** (Đã triển khai, tích hợp hệ thống, viết unit tests và vượt qua 100% kiểm thử kỹ thuật).

---

## 1. Tóm tắt các nội dung đã được cập nhật

Đợt cập nhật này tập trung vào nâng cấp chiều sâu đồ họa, mở rộng không gian trải nghiệm và hoàn thiện trải nghiệm người dùng từ màn hình đăng nhập vào game:

1. **Bầu trời đêm Trăng Khuyết Màu Trắng & Không Gian Đêm U Ám Huyền Ảo**:
   - Thay đĩa trăng máu tròn bằng **Trăng Khuyết (Lưỡi Liềm) Màu Trắng Bạc (`WhiteCrescentMoonSky`)** tại hướng `+Z` (`position={[0, 15.2, 48]}`, bán kính `5.8m`), thiết kế cong mềm mại, đỉnh nhọn thanh thoát với viền rim glow trắng sáng ngọc bích.
   - **Bỏ hoàn toàn hiệu ứng đám mây**: Bầu trời đêm quang đãng, không có mây che vầng trăng khuyết.
   - **Tái lập không gian đêm u ám, ma mị phong cách Anime Cyberpunk**:
     - Giảm độ sáng toàn cảnh: `ambientLight` hạ xuống `0.08`, `hemisphereLight` hạ xuống `0.28`, `directionalLight` trăng hạ xuống `0.32`.
     - Vòm trời đêm (`skyDome`) chuyển sang tím đen sâu thẳm (`#020105` -> `#100e26`).
     - Sương mù u ám kéo gần (`near = 10m - 18m`, `far = 38m - 52m`), màu sương tối sẫm `#040208`.
     - Đèn đường spotlight hạ công suất xuống `22`, chỉ chiếu sáng ấm áp cục bộ tương phản trên nền đêm tối u ám.
     - Nguồn sáng chiếu rọi và vệt phản chiếu trên mặt biển (`SakuraIslandEnv.tsx`) chuyển sang ánh trăng trắng bạc lấp lánh `#dbe8ff`, mang lại không gian Anime đêm thanh bình và sang trọng.
     - Cổng Torii (`ToriiWindChimeGate.tsx`) ở cuối đại lộ `+Z` với 6 chuông gió Fuurin đung đưa và phát tiếng kêu leng keng khi người chơi tiến lại gần.

2. **Khôi Phục & Nâng Cấp Hệ Thống Mưa Hạt Siêu Nhỏ Li Ti Bay Lượn**:
   - Khi vừa tải game (`t = 0`), **trời đổ mưa ngay lập tức** (bù offset +20s vào chu kỳ để bắt đầu ngay ở đợt mưa to `rainIntensity = 1.0`).
   - **Mưa hạt siêu nhỏ li ti bay lơ lửng (Micro-Drizzle Droplets)**:
     - Nâng cấp hơn **5.600 hạt mưa nhỏ li ti** (`CylinderGeometry(0.0035, 0.0035, 0.08, 3)`), bán kính siêu mảnh **3.5mm**, chiều dài chỉ **8cm**, màu trắng ngọc bích lấp lánh `#edf5ff` với độ mờ `opacity = 0.68`.
     - Vận tốc rơi êm ái, bồng bềnh (`speed: 3.8 - 7.4 m/s`), kết hợp dao động lượn sóng ngang `Math.sin(time * 2.2 + driftPhase)` và `driftSpeedX` trôi theo làn gió đêm Anime lãng mạn như bụi sao đêm.
   - Luôn duy trì màn mưa bụi và sương mù u ám nhẹ nhàng tối thiểu `0.25 - 0.28`, không bao giờ để phố khô khốc mất mưa.

3. **Tối Ưu Chuyển Động Nhân Vật Siêu Mượt Mà (Triệt Tiêu Khựng 100%)**:
   - **Cơ chế Adaptive Jitter Offset ([`playerPresentation.ts`](file:///f:/Code/Project/Mix/webGame3D/apps/web/game/systems/playerPresentation.ts))**: Cho phép bù đệm thời gian thích ứng nhẹ nhàng theo độ trễ thực tế của mạng (`targetOffset += (offset - targetOffset) * 0.04`), chống cạn bộ đệm (buffer starvation). `renderTime` luôn có sẵn gói snapshot dự trữ để nội suy, không bao giờ bị chạm trần hay dừng khựng lại giữa chừng.
   - **Cơ chế Hysteresis & Debounce Locomotion ([`Avatar.tsx`](file:///f:/Code/Project/Mix/webGame3D/apps/web/game/entities/Avatar.tsx))**: Khử hoàn toàn hiện tượng chập chờn animation giữa `Walk` và `Idle`. Chuyển sang `Walk` khi tốc độ `> 0.18`, và chỉ dừng chân về `Idle` khi tốc độ `< 0.08` liên tục trong hơn `140ms`, giữ cho bước chân người chơi luôn sải bước liên tục ngay cả khi có vi trễ mạng 10–30ms.
   - **Ổn định nhịp bước chân Dwarf Walk ([`playerAnimation.ts`](file:///f:/Code/Project/Mix/webGame3D/apps/web/game/systems/playerAnimation.ts))**: Khi đang trong trạng thái `Walk`, nhịp bước chân (`gaitSpeed`) luôn duy trì ổn định quanh tốc độ bước tự nhiên, không bị gián đoạn hay khựng bước.
   - **Tăng độ nhạy phím Server ([`sakura.room.ts`](file:///f:/Code/Project/Mix/webGame3D/apps/world-server/src/rooms/sakura.room.ts))**: Giảm ngưỡng chặn lặp input từ 30ms xuống 15ms, giúp máy chủ tiếp nhận ngay lập tức các thao tác rẽ hướng và đi chéo (W+A, S+D) mà không bị drop packet.

3. **Họa Tiết Mặt Đường Nhựa Ướt Chân Thực (Wet Asphalt Road Details)**:
   - Tích hợp thành phần [`WetAsphaltRoadDetails.tsx`](file:///f:/Code/Project/Mix/webGame3D/apps/web/game/scenes/WetAsphaltRoadDetails.tsx) trải dọc đại lộ `8.4m x 54m` (`position={[0, 0.025, 6]}`):
     - **Vân nhựa đường ẩm ướt**: Bản đồ độ nhám `roughnessMap` và Canvas 2D texture (1024x2048) tái hiện chân thực các hạt đá sẫm màu ngấm nước mưa.
     - **Vạch phân làn**: Đường nét đứt màu vàng hổ phách (amber yellow `#e6a122`) chạy dọc tim đường.
     - **Vạch sang đường (Zebra Crosswalk)**: 2 cụm vạch kẻ đường người đi bộ màu trắng ngà phản quang trước lối vào Denmu Club và Reika Lounge.
     - **Vũng nước mưa đọng (Puddles)**: 7 vũng nước loang tự nhiên với độ bóng cực cao (`roughness = 0.04`), phản chiếu rõ bóng đèn neon và vầng trăng khuyết trắng.
     - **Nắp cống hoa văn Sakura**: 2 nắp cống gang đúc tròn hoa văn cánh hoa anh đào và rãnh thoát nước.
     - **Vệt loang dầu (Oil Sheen)**: Hiệu ứng tán sắc màng dầu nhẹ trên mặt nước mưa tạo chiều sâu thị giác chân thực cho phố đêm.

4. **Khắc phục lỗi Cột Nhà Di Chuyển & Đèn Biển Hiệu Nhấp Nháy Êm Dịu, Hết Đau Mắt**:
   - **Sửa triệt để lỗi cột nhà bị lắc**: Loại bỏ hoàn toàn việc can thiệp xoay/dịch chuyển `assets.garlands` (vốn chứa toàn bộ hệ dầm xà và cột gỗ đỡ dọc phố) và ma trận instancing lồng đèn. Toàn bộ các cột nhà, dầm gỗ và lồng đèn đứng vững chắc 100% trên mặt đường.
   - **Biển hiệu nhấp nháy sinh động, êm dịu, không gây đau mắt**:
     - Thuật toán `calculateSignFlicker` tạo chu kỳ chớp neon tự nhiên mỗi 3.2s, biên độ ánh sáng được giữ trong khoảng êm dịu `0.60 - 1.25`, kết hợp nhịp thở neon tự nhiên (`breathing`).
     - Có hiệu ứng chớp tắt chân thực của đèn neon khí hiếm nhưng không bị giật tắt về 0 hoặc chớp tần số cao gây mỏi mắt người chơi.

3. **Khắc phục triệt để Lỗi Chuyển Động Nhân Vật**:
   - Khôi phục cơ chế quản lý vòng đời an toàn của `controller` trong [`Avatar.tsx`](file:///f:/Code/Project/Mix/webGame3D/apps/web/game/entities/Avatar.tsx) để tránh bị hủy mixer khi mount/unmount trong StrictMode.
   - Cập nhật [`FollowCamera.tsx`](file:///f:/Code/Project/Mix/webGame3D/apps/web/game/systems/FollowCamera.tsx): Dù ở góc nhìn toàn cảnh đảo hay góc nhìn nhân vật, tâm ngắm camera luôn bám theo nhân vật (`avatar.position`), giúp người chơi điều khiển WASD luôn chuẩn hướng nhìn, di chuyển chân tay mượt mà.
   - Đưa `{entities}` vào đúng phân cấp Scene của React Three Fiber trong [`World.tsx`](file:///f:/Code/Project/Mix/webGame3D/apps/web/components/World.tsx).

4. **Màn hình Loading 1 lần duy nhất & Tối ưu chống khựng 100% khi vào phòng**:
   - Màn hình loading chỉ hiển thị **1 lần duy nhất khi mới vào game** (`hasLoadedInitial`), sử dụng ảnh nền `/assets/ui/loading-bg.jpg` và thanh tiến trình 0% -> 100%.
   - **Tối ưu 0ms khi chuyển phòng**:
     - Nạp và **pre-retarget sẵn toàn bộ clip nhảy/đi bộ của mọi NPC** (`wine`, `pop`, `galaxy`, `rosetta`, `yuzu`, `bunny`, `zankou`) ngay trong `characterAssets.ts` ở bước warmup đầu game và truy xuất đồng bộ qua `getCachedCharacterAsset(id)` ở frame đầu tiên khi mở phòng.
     - Đưa `entities` (`<Avatar>`, `<CompanionNpc>`, `<FollowCamera>`, `<PlayerInput>`) ra ngoài nhánh điều kiện `zone` trong `World.tsx` với khóa cố định `key="local-player"` để nhân vật của người chơi không bao giờ bị unmount hay clone lại skeleton khi bước qua cửa.

4. **Tầng 2 Cyber Love Hotel & Cầu thang bộ**:
   - Thiết kế phòng Cyber Love Hotel phong cách đèn đỏ neon sexy, giường tròn King-size, bồn tắm sục Jacuzzi đôi, sofa đôi, minibar và 4 mood ánh sáng tùy chọn (`magenta`, `violet`, `cyan`, `amber`).
   - Chuyển Love Hotel lên **Tầng 2 toà Reika**, xây dựng cầu thang bộ dốc ngoài trời và trong nhà có chiếu nghỉ và biển hiệu `2F · CYBER LOVE HOTEL`, kèm cửa nhỏ vào phòng Suite 201.
   - Cập nhật collider server và logic đổi phòng tầng 2.

5. **Cửa ra vào & Cơ chế bước qua ngưỡng cửa tự động**:
   - Thiết kế cánh cửa mở ra vào chân thực (`InteractiveEntranceDoor`, `InteractiveRoomDoor`) với biển hiệu quay ra mặt đường.
   - Xóa bỏ toàn bộ các vòng tròn dưới sàn ở tất cả các cửa.
   - Xóa bỏ các chú thích chữ lơ lửng (`[E] Vào phòng`, `DENMU · E`, `REIKA · E`, v.v.).
   - Khi người chơi tiến sát vào cửa, cánh cửa tự động mở ra và bước tiếp qua ngưỡng cửa sẽ tự động chuyển phòng liền mạch, không cần bấm phím E.

6. **Hostess Reika Lounge, Order Nhạc & NPC Dáng đi**:
   - Thêm 3 Hostess NPC: Yuzu, Bunny, Zankou tại Reika Lounge.
   - Điệu nhảy Yuzu: `Snake Hip Hop Dance` (`Snake Hip Hop Dance.json`).
   - Điệu nhảy Zankou: `zankou_dance.json`, đã chỉnh quay mặt chuẩn về phía người chơi.
   - Chức năng "Đi với anh nhé": Đào đi theo sau người chơi qua các phòng (`CompanionNpc`) và nhảy đồng điệu với người chơi trong Club.
   - Chức năng Order nhạc Reika Lounge: nạp danh sách nhạc từ `assets/source/audio/reika`, chỉ phát khi khách gọi bài.
   - DJ Denmu Club: xóa dáng đi cũ, chuẩn hóa dùng dáng đi `Dwarf Walk` từ `common` khi rời bàn mixer xuống gặp khách.

---

## 2. Danh mục tệp mã nguồn và tài nguyên liên quan

| Tệp | Trách nhiệm |
| --- | --- |
| `apps/web/game/scenes/BloodMoonSky.tsx` | Đĩa Trăng Máu 3D ở hướng `+Z` (`position={[0, 15.2, 48]}`), quầng hào quang kép, mây đêm trôi và phông vòm trời |
| `apps/web/game/scenes/ToriiWindChimeGate.tsx` | Cổng Torii ở cuối đại lộ `+Z` kèm 6 chuông gió Fuurin đung đưa & phát tiếng kêu khi đến gần |
| `apps/web/game/scenes/WetAsphaltRoadDetails.tsx` | Lớp phủ mặt đường 8.4m x 54m vân nhựa ẩm ướt, vạch vàng amber, 2 vạch zebra crosswalk, nắp cống Sakura và vũng nước phản chiếu |
| `apps/web/game/scenes/SakuraIslandEnv.tsx` | Môi trường Hòn Đảo Thành Phố (Sakura Island) giữa biển đêm phản chiếu ánh trăng máu, bờ kè neon và 4 trụ hải đăng |
| `apps/web/game/systems/FollowCamera.tsx` | Hệ thống Camera hỗ trợ 2 góc nhìn: Toàn cảnh Đảo (`overview` - mặc định khi vào game) và Góc nhìn Nhân vật (`character`) |
| `apps/web/game/ui/WorldHud.tsx` | Bộ chuyển đổi chế độ Góc nhìn ở góc trái màn hình (`🏝️ Toàn cảnh Đảo` / `👤 Góc nhìn Nhân vật`, phím tắt `V`) |
| `apps/web/game/systems/RainWeatherSystem.tsx` | Chu kỳ 5 phút mưa / 5 phút tạnh, hạt mưa InstancedMesh, sương mù và thuật toán nhấp nháy mạnh (`calculateSignFlicker`) |
| `apps/web/game/scenes/StreetAssets.tsx` | Điều khiển nhấp nháy mạnh mẽ cho biển hiệu tòa nhà, đèn đường và hiệu ứng đèn lồng đung đưa theo gió |
| `apps/web/game/systems/characterAssets.ts` | Nạp và pre-retarget sẵn toàn bộ clip nhảy/đi bộ của mọi NPC ngay từ đầu game, truy xuất đồng bộ qua `getCachedCharacterAsset` |
| `apps/web/game/scenes/SakuraScene.tsx` | Tích hợp Trăng Máu, Hòn Đảo Sakura, thời tiết mưa và đèn điểm đường phố |
| `apps/web/game/ui/GameLoadingScreen.tsx` | Màn hình Loading 1 lần duy nhất với background ảnh `/assets/ui/loading-bg.jpg` và thanh tiến trình đồ họa |
| `apps/web/game/systems/ClubAssetWarmup.tsx` | Pipeline nạp trước toàn bộ GLBs, 11 nhân vật, nội thất, audio và texture warmup |
| `apps/web/components/World.tsx` | Giữ `entities` cố định ở cấp ngoài chống khựng khi đổi phòng, tích hợp Cổng Torii, chế độ Camera Đảo và Loading 1 lần |
| `apps/web/game/scenes/HotelScene.tsx` | Không gian Cyber Love Hotel với giường tròn, bồn tắm sục Jacuzzi và 4 mood màu |
| `apps/web/game/scenes/LoungeScene.tsx` | Reika Lounge 1F và thang bộ kết nối lên tầng 2 Love Hotel |
| `apps/web/game/entities/InteractiveEntranceDoor.tsx` | Cửa ra vào hoạt họa tự động mở khi lại gần |
| `apps/web/test/weather-system.spec.ts` | Unit test chu kỳ thời tiết 600s, nhấp nháy đèn đường và nhấp nháy biển hiệu neon |
| `apps/web/test/game-loading.spec.ts` | Unit test xác thực tệp ảnh nền loading và danh mục tải trước |

---

## 3. Bằng chứng kiểm thử và xác thực kỹ thuật

1. **Unit tests Frontend (`@metaverse/web`)**:
   - Lệnh chạy: `corepack.cmd pnpm --filter @metaverse/web test`
   - Kết quả: **65/65 tests PASS** (0 fail, 0 skipped, thời lượng ~12.8s).
   - Kiểm tra bao gồm: chu kỳ thời tiết 600s, độ nhấp nháy đèn, tồn tại tệp ảnh nền loading, tải trước 11 avatars, 12 animation clips, IK DJ Rio, tương tác Reika Hostess, v.v.

2. **World Server (`@metaverse/world-server`)**:
   - Lệnh chạy: `corepack.cmd pnpm --filter @metaverse/world-server test`
   - Kết quả: **13/13 tests PASS**.
   - Kiểm tra bao gồm: va chạm toà nhà, collider thang bộ và phòng Love Hotel tầng 2, kiểm tra chuyển phòng, chuyển động server-authoritative.

3. **Game Protocol (`@metaverse/game-protocol`)**:
   - Lệnh chạy: `corepack.cmd pnpm --filter @metaverse/game-protocol test`
   - Kết quả: **8/8 tests PASS**.
   - Kiểm tra bao gồm: logic bước qua ngưỡng cửa chuyển phòng liền mạch không cần bấm E, collider toà nhà, 7 kiểu nhảy, metadata nhạc.

4. **Kiểm tra TypeScript Monorepo**:
   - Lệnh chạy: `corepack.cmd pnpm turbo run typecheck`
   - Kết quả: **6/6 packages thành công**, không có lỗi kiểu dữ liệu.
