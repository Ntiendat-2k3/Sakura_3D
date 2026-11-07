# Neon Sakura City — Việc cần làm và tài liệu cần cung cấp

Ngày lập: 05/11/2026. Đây là kế hoạch tiếp tục từ source hiện tại, không phải xác nhận các tính năng dưới đây đã hoàn thành.

**Cập nhật sau khi nhận WINE.rar và POP_.rar:** Denmu đã có bản test vào/ra, nội thất, hai NPC VRM nhảy và room riêng. Xem [CLUB_TEST_REPORT.md](reports/CLUB_TEST_REPORT.md) để biết trạng thái mới; các bảng dưới đây giữ lại mốc lập kế hoạch ban đầu.

## 1. Đích hoàn thiện trước mắt

Hoàn thành một bản **local chơi được từ đầu đến cuối**:

> Vào phố → đi đến cửa → nhấn E để vào club → thấy nội thất và NPC anime → tương tác cơ bản → gặp người chơi khác trong cùng phòng → ra phố lại.

Ưu tiên làm trọn **một địa điểm** trước, sau đó mở rộng sang các tòa nhà còn lại. Đề xuất bắt đầu với **Reika Hostess Lounge**, đồng thời xác nhận pipeline nhân vật bằng Reina và một NPC Oiran.

**Không cần đợi đủ 10 NPC mới làm tiếp được.** Tôi có thể triển khai cửa, chuyển cảnh/phòng, điểm xuất hiện, va chạm và kiểm thử multiplayer ngay. Model nhân vật và asset nội thất quyết định mức hoàn thiện hình ảnh; phần logic không phụ thuộc việc đã có đủ asset đẹp.

## 2. Hiện tại đã có và còn thiếu gì?

| Hạng mục | Hiện trạng | Phần phải làm tiếp |
| --- | --- | --- |
| Web, API, World Server, PostgreSQL | Đã kiểm thử local trong đợt trước | Kiểm tra lại khi bắt đầu phiên mới |
| Ngoại cảnh phố GLB | Có model CC0, vật liệu và đèn | Tiếp tục nâng chất lượng kiến trúc Nhật/anime |
| Di chuyển và camera | Hoạt động, có kiểm tra va chạm công trình | Hoàn thiện va chạm nội thất, đạo cụ và các góc camera mới |
| Multiplayer ngoài phố | Đã kiểm thử | Mở rộng cho chuyển phòng và nội thất |
| Cửa các tòa nhà | Chưa triển khai | Vùng tương tác, gợi ý phím E, kiểm tra server, vào/ra |
| Nội thất club/lounge/VIP | Chưa triển khai | Model nội thất, bố cục, ánh sáng, collider và spawn |
| NPC anime | Chưa có model được xác minh | Nhập model, rig, vật liệu, animation, tương tác |
| Avatar người chơi | Vẫn là placeholder hình học | Model thật và animation idle/walk |
| Hội thoại, ghế ngồi, hoạt động | Chưa triển khai | Chốt hành vi, làm từng tính năng |
| Tài khoản thật, quyền VIP, kiểm soát truy cập | Chưa hoàn chỉnh | Làm trước khi dùng cho người dùng bên ngoài |
| Production build sau đợt asset | Chưa chạy lại | Build và chạy thử bản production |

Chi tiết và bằng chứng đợt trước: [VISUAL_UPGRADE_REPORT.md](reports/VISUAL_UPGRADE_REPORT.md). Nguồn/giấy phép: [ASSET_MANIFEST.json](../assets/manifests/ASSET_MANIFEST.json).

## 3. Những gì bạn cần cung cấp trước

### 3.1. Thông tin tối thiểu để tôi bắt đầu làm cửa và nội thất

Bạn có thể trả lời bằng vài dòng, không cần viết tài liệu kỹ thuật:

| Thông tin | Đề xuất nếu bạn chưa có lựa chọn |
| --- | --- |
| Địa điểm làm đầu tiên | Reika Hostess Lounge |
| Mục tiêu bản đầu | Chạy local, chưa mở công khai |
| Kiểu nội thất | Quầy tiếp đón, quầy bar, sofa, một khu trò chuyện |
| Cách vào cửa | Đứng gần cửa, nhấn E; có điểm ra phố rõ ràng |
| Cách chia phòng | Người chơi vào cùng địa điểm gặp nhau trong cùng phòng; có giới hạn sức chứa |
| Tương tác đầu tiên | Bấm E gần NPC để mở hội thoại cố định; chưa cần AI/API key |
| Hình thức VIP trong bản local | Chưa khóa quyền; không mua bán hoặc thu tiền |

Bạn có thể chấp nhận các đề xuất này để tôi tự xử lý chi tiết. Chưa có asset nội thất thì tôi có thể tìm asset miễn phí có giấy phép và phối lại trong Blender. Bạn không phải tự lập trình cửa, server, collision hoặc viết migration.

### 3.2. Tài liệu hình ảnh để đạt đúng phong cách bạn muốn

Chuẩn bị khoảng 3–5 ảnh tham khảo hoặc đường dẫn:

- Một ảnh phong cách tổng thể của phố.
- Một hoặc hai ảnh nội thất địa điểm đầu tiên.
- Một ảnh phong cách nhân vật Luxury Hostess và một ảnh Oiran.
- Ghi rõ điểm muốn giữ: bảng màu, mức độ chi tiết, ánh sáng, trang phục, góc camera.

Ảnh tham khảo chỉ dùng định hướng mỹ thuật. Nếu muốn đưa ảnh/texture/model đó trực tiếp vào game, cần thêm nguồn và quyền sử dụng. Không bắt buộc ảnh phải mô tả chính xác mọi vật thể.

Bạn có thể đặt ảnh trong `assets/source/references/` rồi gửi cho tôi đường dẫn trong workspace.

### 3.3. Model nhân vật — phần đầu vào quan trọng nhất

Ưu tiên **hai NPC trước**, chưa cần chuẩn bị cả roster:

| Nhân vật | Vai trò đề xuất, chưa phải thiết kế đã chốt | File cần có |
| --- | --- | --- |
| Reina | Luxury Hostess tại Reika | Model `.vrm` hoặc GLB có rig; bản nguồn nếu có |
| Ayame | Oiran tại Kurenai | Model `.vrm` hoặc GLB có rig; bản nguồn nếu có |
| Avatar người chơi | Chọn riêng hoặc dùng một model được phép tái sử dụng | Model có rig và quyền dùng làm avatar |

Reina/Ayame là lựa chọn đề xuất từ tên roster; hãy sửa nếu bạn đã có thiết kế khác. Không có tài liệu thiết kế chi tiết cũ của roster trong source đã kiểm kê.

Với mỗi nhân vật, cung cấp:

- Tên, tuổi hư cấu trưởng thành, vai trò, tính cách ngắn và trang phục.
- File model thật; ảnh chân dung không thay thế được file 3D.
- Tên tác giả, trang nguồn và bản giấy phép/điều khoản của model, trang phục, tóc, texture, animation.
- Quyền chỉnh sửa, dùng trong game và phân phối file cho client web; ghi rõ yêu cầu ghi công hay giới hạn sử dụng.
- Bản `.vroid` hoặc `.blend` nếu có để chỉnh sửa và tối ưu; đây là phần khuyến khích, không bắt buộc với mọi định dạng.
- Animation nếu đã có. Một file VRM có rig không đồng nghĩa đã có animation idle/walk.

Không cần tự tối ưu model trước khi gửi. Tôi sẽ kiểm tra topology, texture, rig và mức phù hợp. Mục tiêu ban đầu để thử trên máy hiện tại: khoảng tối đa 40.000 tam giác/NPC, texture 1024 khi đủ rõ, số vật liệu hạn chế và chỉ 1–2 NPC trong cảnh thử đầu. Đây là ngân sách thử nghiệm, sẽ điều chỉnh theo số đo, không phải điều kiện loại bỏ ngay model nguồn.

### 3.4. Tạo nhân vật bằng VRoid Studio nếu chưa có model

1. Mở [trang VRoid Studio chính thức](https://vroid.com/en/studio) để tải ứng dụng nếu chưa cài.
2. Tạo nhân vật gốc, thể hiện rõ là người trưởng thành; chỉnh tỷ lệ, khuôn mặt, tóc và trang phục theo ảnh tham khảo.
3. Dùng preset có điều khoản phù hợp, texture tự tạo hoặc phụ kiện có quyền sử dụng rõ ràng. Kiểm tra điều khoản riêng của sample/preset trước khi dùng.
4. Lưu bản chỉnh sửa `.vroid`.
5. Dùng chức năng xuất VRM, ưu tiên VRM 1.0; điền tác giả và metadata quyền sử dụng đúng với nội dung thực tế.
6. Lưu file `.vrm`, `.vroid` và tài liệu quyền sử dụng vào thư mục nhân vật tương ứng ở mục 4.
7. Chụp thêm ảnh trước, bên và sau nếu muốn tôi đối chiếu hình ảnh sau khi nhập vào game.

Hướng dẫn hiện có: [assets/source/characters/README.md](../assets/source/characters/README.md). Điều khoản chính thức: [VRoid Studio Guidelines](https://vroid.com/en/studio/guidelines).

Nếu chưa tự tạo được, gửi ảnh định hướng và cho phép tôi tìm model miễn phí phù hợp. Tôi sẽ kiểm tra nguồn trước khi tích hợp, và báo rõ nếu không tìm được model đáp ứng cả phong cách lẫn quyền sử dụng. Không dùng nhân vật capsule để đánh dấu hoàn thành bước này.

### 3.5. Nếu bạn đã có nội thất hoặc đạo cụ

Gửi đường dẫn tới `.blend`, `.glb`, `.gltf` hoặc `.fbx`, kèm texture và giấy phép. Với `.gltf`, giữ cả file `.bin` và các ảnh được tham chiếu. Nếu là file ZIP từ tác giả, giữ nguyên ZIP gốc để đối chiếu.

Ghi thêm nếu đã biết:

- Cửa vào/ra nằm ở đâu; hướng mặt tiền.
- Khu nào đi được, khu nào bị chặn; vị trí quầy, sofa và sân khấu.
- Khu vực dành cho NPC, điểm xuất hiện người chơi.
- Mức sáng và bảng màu mong muốn.

Nếu chưa biết các thông số này, tôi có thể tự thiết kế bố cục nhỏ rồi chụp ảnh để bạn duyệt. Bạn không bắt buộc mua asset hoặc dựng cả phòng bằng Blender.

## 4. Cách đặt file để tôi tiếp nhận

Đây là cấu trúc đề xuất; chưa yêu cầu bạn tạo tất cả thư mục hoặc có đủ mọi file:

```text
docs/design/
  YEU_CAU_HOAN_THIEN.md           # Mẫu trả lời ở mục 8
assets/source/
  references/                    # Ảnh định hướng
  characters/
    reina/
      reina.vroid                # Nếu tạo bằng VRoid
      reina.vrm                  # Hoặc GLB có rig
      LICENSE.md
      reference-front.png        # Tùy chọn
    ayame/
      ayame.vroid
      ayame.vrm
      LICENSE.md
    player/                      # Tùy chọn ở giai đoạn đầu
  interiors/
    reika/
      original.zip               # Nếu tải từ một bộ asset
      LICENSE.md
      textures/                  # Nếu model tham chiếu ảnh ngoài
  animations/                    # Nếu đã có animation hợp lệ
assets/processed/                # Tôi xử lý và ghi kết quả tại đây
apps/web/public/assets/
  buildings/
  props/
  characters/
  textures/
```

Giữ nguyên file đã có. Chỉ cần cho tôi biết đường dẫn file mới; tôi sẽ kiểm kê, xử lý và đưa bản runtime vào thư mục phù hợp. Không cần bạn tự chép model nguồn vào `public/`.

Mẫu `LICENSE.md` cho mỗi nguồn asset:

```markdown
# Thông tin nguồn asset
- Tên asset:
- Tác giả:
- Trang tải chính thức:
- Ngày tải:
- Tên giấy phép / điều khoản:
- File hoặc đường dẫn bằng chứng giấy phép:
- Quyền chỉnh sửa:
- Quyền dùng trong game:
- Quyền phân phối file cho client web:
- Yêu cầu ghi công:
- Giới hạn / phần chưa rõ:
- Trang phục, tóc, texture, animation từ nguồn khác:
```

Không tự đánh dấu quyền là “có” khi chưa rõ. Gửi trang nguồn/điều khoản để tôi kiểm tra thay vì chỉ ghi “tải miễn phí”.

## 5. Thứ tự tôi sẽ triển khai

### Mốc 0 — Xác nhận nền chạy ổn

- [ ] Đọc lại thay đổi mới, báo cáo và cấu hình; kiểm tra port/process trước khi khởi động.
- [ ] Kiểm tra Web, API, World Server, PostgreSQL và migration hiện tại.
- [ ] Chạy kiểm thử nền, lưu screenshot và số đo hiệu năng làm mốc.
- [ ] Giữ bản nguồn/asset cũ cho tới khi bản thay thế được kiểm thử.

**Bạn cung cấp:** đường dẫn file mới và các lựa chọn ở mục 3.1. Chưa cần đủ NPC.

### Mốc 1 — Vào/ra được một địa điểm

- [ ] Tạo định nghĩa địa điểm, cửa, vùng tương tác, điểm vào/ra và collider dùng chung.
- [ ] Hiện gợi ý nhấn E khi ở gần cửa; ngăn gửi thao tác lặp liên tục.
- [ ] Server xác minh địa điểm, điều kiện truy cập và vị trí người chơi; không tin tọa độ do client tự khai.
- [ ] Chuyển sang phòng Colyseus/nội thất đúng địa điểm với giới hạn sức chứa rõ ràng.
- [ ] Có trạng thái đang tải và xử lý khi phòng đầy, join lỗi hoặc mất kết nối; không để nhân vật mắc kẹt.
- [ ] Ra lại phố ở vị trí an toàn, tránh spawn bên trong tường hoặc sát cửa gây lặp chuyển phòng.
- [ ] Hai người vào cùng phòng nhìn thấy nhau; người ngoài phố không thấy avatar đang ở nội thất.

**Nghiệm thu:** đi từ phố vào địa điểm, đi lại bên trong rồi ra phố thành công; thử với hai người chơi. Có thể xác nhận logic này trước khi hoàn thiện model NPC.

### Mốc 2 — Nội thất có model và phong cách thống nhất

- [ ] Chọn/tạo bộ asset có giấy phép: tường, sàn, trần, quầy bar, ghế, bàn, đèn và vật trang trí.
- [ ] Dựng một phòng nhỏ đủ chi tiết, kiểm tra tỷ lệ cửa và nội thất với avatar.
- [ ] Làm UV/vật liệu, texture, ánh sáng và bóng phù hợp thời gian thực.
- [ ] Xuất GLB, xác minh texture, collision và camera.
- [ ] Ghi nguồn vào manifest; lưu file Blender và ảnh trong game.

**Bạn cung cấp:** ảnh định hướng hoặc asset đã có. Nếu không có model, tôi sẽ tìm asset miễn phí/tạo chi tiết bổ sung; chỉ đánh dấu hình ảnh hoàn thành khi đã kiểm thử model thực tế.

### Mốc 3 — Hai NPC và một avatar thật

- [ ] Xác minh file, quyền sử dụng, chiều cao, UV, vật liệu và humanoid rig.
- [ ] Chọn loader VRM hoặc chuyển GLB theo đặc điểm model; kiểm tra MToon, tóc và các extension cần thiết.
- [ ] Tích hợp idle và walk với animation tương thích; xử lý chuyển trạng thái mượt.
- [ ] Thay avatar người chơi placeholder bằng model thật.
- [ ] Đặt NPC, nhãn tên, vùng tương tác; xác định chỗ đứng và hướng quay.
- [ ] Tương tác E mở hội thoại cố định do dự án quản lý; chưa cần gọi AI.
- [ ] Hai client nhìn thấy cùng trạng thái tương tác cần đồng bộ; vị trí và quyền thao tác do server xác nhận.
- [ ] Kiểm tra xuyên ghế/tường, ánh sáng trên da/tóc, camera gần nhân vật và FPS.

**Bạn cung cấp:** ít nhất một model đã có quyền phù hợp để thử pipeline; mục tiêu nghiệm thu là hai NPC đã chốt và một avatar người chơi. Nếu dùng lại model NPC làm avatar, cần chốt lựa chọn và quyền tái sử dụng đó.

### Mốc 4 — Mở rộng các tòa nhà còn lại

- [ ] Kurenai Oiran Lounge.
- [ ] Gekka Cabaret.
- [ ] Denmu Night Club.
- [ ] Kohaku VIP.
- [ ] Izakaya, atelier và quán trà nếu vẫn nằm trong phạm vi bạn chọn.
- [ ] Hoàn thiện đủ roster 10 NPC, vai trò, vị trí và hội thoại.
- [ ] Thêm ngồi ghế, hoạt động sân khấu hoặc sự kiện theo yêu cầu đã chốt.

Tái sử dụng hệ thống cửa, phòng và tương tác đã nghiệm thu. Nội thất, model và quyền truy cập vẫn phải được định nghĩa riêng; không chỉ đổi biển hiệu rồi gọi các địa điểm đã hoàn thành.

### Mốc 5 — Chất lượng và hiệu năng toàn trải nghiệm

- [ ] Nâng kiến trúc Nhật, cây anh đào và chi tiết ngoại cảnh theo ảnh tham khảo.
- [ ] Bổ sung collider cho đạo cụ có thể chạm tới; xử lý các góc camera khó.
- [ ] Tối ưu geometry, material, texture, instancing và phạm vi tải asset.
- [ ] Giới hạn số NPC/animation/đèn hoạt động theo số đo; không bật hiệu ứng nặng mặc định khi gây lag.
- [ ] Typecheck, unit tests, migration checks và build production.
- [ ] Playwright kiểm tra cả hành trình phố → nội thất → NPC → ra phố.
- [ ] Hai browser contexts kiểm tra room, movement, chat và disconnect; thử tình huống vào/ra đồng thời.
- [ ] Báo cáo console/network/WebSocket, ảnh trước/sau, FPS và p95 frame time với điều kiện đo rõ ràng.

Mục tiêu tham khảo trên máy hiện tại là gần 60 FPS ở chế độ nhẹ. Đây là mục tiêu tối ưu, cần đo lại với nội thất/NPC thật và nhiều người chơi, không phải bảo đảm trước khi có asset.

## 6. Hướng triển khai theo kiến trúc hiện có

| Khu vực | Nơi tiếp tục | Quy tắc |
| --- | --- | --- |
| Renderer, cửa và NPC | `apps/web/game/{scenes,entities,systems,ui}` | Tái sử dụng input/camera hiện có; không dồn logic vào `World.tsx` |
| Kết nối/chuyển phòng | `apps/web/game/networking` | Quản lý vòng đời room và trạng thái lỗi rõ ràng |
| Giao thức, bố cục và collision thuần | `packages/game-protocol` | Không phụ thuộc ORM, NestJS hoặc giao diện |
| Room, movement và tương tác có thẩm quyền | `apps/world-server/src` | Client gửi input/yêu cầu; server xác nhận và đồng bộ state |
| Dữ liệu địa điểm, NPC, quyền truy cập bền vững nếu cần | `apps/api/src/modules` | Domain/Application dùng port; Infrastructure triển khai adapter, Presentation chứa DTO/controller |
| Model DB và thay đổi cấu trúc DB | `packages/database/src` | Sequelize v6, migration Umzug; không auto-sync, không lưu vị trí mỗi frame |
| Model nguồn, model tối ưu và giấy phép | `assets/source`, `assets/processed`, `apps/web/public/assets`, `assets/manifests/ASSET_MANIFEST.json` | Giữ nguồn, xác minh đầu vào và kiểm tra bản xuất |

Chưa cần thêm Redis, microservices hay Kubernetes cho bản local này. Chỉ thêm dependency khi source và thư viện đã có không đáp ứng được tính năng cụ thể.

## 7. Phần riêng trước khi mở cho người dùng bên ngoài

Các mục này không bắt buộc phải làm hết để thử bản local ở mục 1, nhưng cần hoàn thiện trước khi phát hành tính năng tương ứng:

- [ ] Đăng ký/đăng nhập và phiên đăng nhập thật, thay guest auth local.
- [ ] Quyền truy cập phòng/VIP và biện pháp xác minh tuổi phù hợp với nội dung được phát hành; một checkbox hoặc tuổi hư cấu của NPC không thay thế việc này.
- [ ] Report, mute, ban và quy trình quản lý lạm dụng cho chat; kiểm soát quyền tương tác.
- [ ] Nếu thêm voice: xin phép microphone, đồng ý tham gia, mute và công cụ quản lý.
- [ ] Nếu thêm inventory/wallet: giao dịch do server kiểm soát, transaction, ledger và chống thực hiện trùng; bản đầu chỉ dùng dữ liệu/demo coin local, không thu tiền thật.
- [ ] Bảo mật API/WebSocket, CORS, rate limit, quản lý secret, backup và kiểm thử tải.
- [ ] Quyết định phạm vi triển khai và chi phí trước khi bật dịch vụ bên ngoài. Không tự kích hoạt cloud trả phí.

Bạn chưa cần cung cấp tài khoản cloud, thông tin thanh toán hay API key để làm bản local. Không gửi mật khẩu, JWT secret hoặc toàn bộ `.env` vào hội thoại.

## 8. Mẫu bạn điền và gửi lại

Bạn có thể copy phần dưới vào tin nhắn hoặc lưu tại `docs/design/YEU_CAU_HOAN_THIEN.md`. Chỉ điền mục bạn đã biết; ghi “để bạn đề xuất” ở phần còn lại.

```markdown
# Yêu cầu hoàn thiện Neon Sakura City

## Phạm vi bản đầu
- Mục tiêu: local / thử riêng với bạn bè / chuẩn bị phát hành
- Địa điểm làm đầu tiên:
- Chấp nhận đề xuất mặc định ở mục 3.1: có / cần sửa như sau
- Tính năng bắt buộc trong bản đầu:
- Tính năng để sau:

## Hình ảnh
- Ảnh hoặc link tham khảo phố:
- Ảnh hoặc link tham khảo nội thất:
- Phong cách nhân vật:
- Điều không thích ở bản hiện tại:

## Nội thất và multiplayer
- Các khu cần có trong địa điểm đầu:
- Hoạt động: trò chuyện / ngồi ghế / xem biểu diễn / khác
- Phòng chung hay phòng riêng:
- Sức chứa mong muốn:
- Quy tắc VIP trong bản local:

## Nhân vật
- Reina: tuổi hư cấu trưởng thành, ngoại hình, trang phục, vai trò
- NPC Oiran được chọn: tên, tuổi hư cấu trưởng thành, ngoại hình, trang phục
- Avatar người chơi: dùng model nào, có cần tự chọn avatar không
- Đường dẫn model và bản nguồn:
- Đường dẫn giấy phép/trang tác giả:
- Đường dẫn animation nếu có:
- Các NPC còn lại: đã có thiết kế / để đề xuất sau

## Asset khác
- Đường dẫn model nội thất/đạo cụ nếu có:
- Đường dẫn giấy phép:
- Chưa có asset và muốn bạn tự tìm/tạo phần phù hợp:

## Máy và tiêu chí nghiệm thu
- Máy mục tiêu, độ phân giải, số người thử cùng lúc:
- Ưu tiên: FPS / hình ảnh / cân bằng
- Điều kiện để tôi coi bản đầu đã hoàn thành:
```

## 9. Câu lệnh giao việc tiếp theo

Sau khi điền mẫu, có thể gửi:

> Đọc KE_HOACH_HOAN_THIEN.md và docs/design/YEU_CAU_HOAN_THIEN.md. Triển khai Mốc 0–2 cho địa điểm đầu tiên, dùng asset miễn phí hợp lệ và giữ kiến trúc hiện có. Tự chạy server, sửa lỗi, kiểm thử hành trình vào/ra với hai người chơi và lưu screenshot. Nếu chưa có NPC thì tiếp tục phần không phụ thuộc NPC và ghi rõ phần hình ảnh còn thiếu. Không báo hoàn tất khi chỉ có placeholder.

Khi đã có model nhân vật:

> Các model và giấy phép nằm tại [đường dẫn]. Kiểm kê, xác minh rồi triển khai Mốc 3: hai NPC anime và avatar có animation, tương tác cơ bản, kiểm thử trong browser và đo FPS. Giữ bản nguồn, cập nhật manifest và báo cáo phần chưa đạt.

## 10. Cách kiểm tra và ghi nhận hoàn thành

- Mỗi mốc phải có kết quả chạy được, screenshot và danh sách kiểm thử; ghi rõ model nào đã nhập thật.
- Dùng `DONE` cho phần đã triển khai và kiểm thử; `PARTIAL` cho phần còn thiếu; `BLOCKED` khi thực sự cần asset/thao tác bên ngoài. Việc code chưa làm không tự động được coi là bị chặn bởi NPC.
- Đối chiếu scripts hiện có trước khi chạy. Khởi động từ root bằng `npm run dev` khi chưa có bộ server đang chạy; không mở thêm app dev trùng cổng.
- Tôi sẽ dùng các script typecheck/test/build/migration phù hợp và Playwright MCP để kiểm tra, không yêu cầu bạn tự chạy toàn bộ quy trình kỹ thuật.
- Khi build production, cần xử lý việc dùng chung output `.next` với dev server để tránh làm hỏng phiên đang chạy.
- “Bản local hoàn chỉnh” chỉ được nghiệm thu khi hành trình ở mục 1 hoạt động với model thật; không đồng nghĩa đã đủ điều kiện phát hành công khai.
