# DENMU — Dance upgrade

Trạng thái tổng thể: **PARTIAL**. Mocap thật đã được kiểm thử ở lượt trước. Đã tích hợp `music.mp3` do người dùng cung cấp; chưa nghe/kiểm thử browser bản có nhạc theo yêu cầu không mở Playwright.

## DONE

- Giữ nguyên WINE/POP! VRM 0.x và nội thất Denmu.
- Tải `Dancing.zip` qua thư mục Drive được [Rokoko chính thức](https://www.rokoko.com/resources/rokoko-mocap-6-free-dance-animations) liên kết. Trang cho phép dùng trong dự án cá nhân/thương mại; đây không phải CC0.
- Import cả 6 FBX trong Blender 5.2.3 LTS; mỗi file có một rig với 52 bone theo importer Blender. File chưa dùng `DancingwithDrink` chỉ giữ ở source.
- Tạo 5 clip runtime thật từ đoạn đầu 16 giây của FBX, resample 30 Hz, bỏ mesh/texture và track ngón tay. Tổng JSON khoảng 2.22 MB chưa nén HTTP.
- Retarget rest-pose quaternion lên normalized humanoid, đổi hướng X/Z cho VRM 0.x theo [mẫu Pixiv](https://github.com/pixiv/three-vrm/blob/dev/packages/three-vrm/examples/humanoidAnimation/loadMixamoAnimation.js). Khóa root X/Z, giới hạn hip Y và bù độ cao theo bàn chân.
- Mỗi clip chạy trong phrase 32 beat; blend smoothstep 2 beat. Cả hai NPC lấy thời gian từ epoch của room, khách vào giữa show nhận ngay cùng timeline. Cue `peak` đổi điểm bắt đầu chuỗi.

| NPC | Bốn clip thật, theo thứ tự cơ sở |
|---|---|
| WINE | GentleSwayingDancing → DoTheTwist → DancingMedium → NPC_DancingParty |
| POP! | DoTheTwist → NPC_DancingParty → GentleSwayingDancing → DancingMedium |

## Cập nhật phong cách nhảy

- Bỏ robot khỏi chuỗi của POP!, đổi thứ tự clip để ưu tiên sway/twist và hai NPC biểu diễn khác nhau.
- Cộng lớp diễn xuất nguyên bản: nhấn hông ngang khoảng 5.5 cm, nghiêng hông, xoắn eo ngược chiều và body roll chậm. Giữ chiều dài xương và bước bù chân trên sân khấu.
- Pose mocap nền được phục hồi trước mỗi frame để track không đổi không làm lớp cộng tích lũy, gây trôi người. Retarget lấy rest pose thay vì pose procedural đang chạy trong lúc tải clip. QA kiểm tra hips X lệch không quá 5.6 cm so với rest pose trong cả vòng clip.
- Bố cục chuỗi đặt tại `club-choreography.json`, được runtime và script manifest dùng chung.
- Đây là chỉnh phong cách trên mocap Rokoko đã có, không phải các clip sexy/heels/rumba mới tải về. Mức độ gợi cảm vẫn cần người dùng đánh giá trực tiếp.
- **DONE** Bài QA mới sau chỉnh rest pose đã quan sát đủ 4 clip mỗi NPC, không robot, có blend và hips X nằm trong giới hạn so với rest pose. Hai browser contexts cùng show; xem `test-results/club-mood-qa.json`. Sân khấu đã có hai nguồn trắng ấm ổn định để nhìn rõ nhân vật.

## Kiểm thử thực tế

- **DONE** Playwright MCP quan sát đủ 4 clip mỗi NPC trong một vòng test 44 giây ở 180 BPM; thấy các giá trị blend trung gian.
- **DONE** Ảnh trước/sau, model VRM và pose hiển thị thực trong WebGL; root Y bù trong khoảng 0.0067–0.0989 m ở mẫu đo, không quan sát thấy trôi ngang hoặc xuyên sàn. Đây chưa phải kiểm tra xuyên váy/giày ở mọi frame.
- **DONE** Hai browser contexts có cùng room/epoch/BPM/cue, chat và disconnect hoạt động. Telemetry beat lệch 0.258 beat trong mẫu chụp, tương đương 86 ms ở 180 BPM; telemetry chỉ cập nhật mỗi 200 ms.
- **DONE** 12 unit tests, 2 e2e API/multiplayer/club; có kiểm tra server từ chối khách không giữ bàn DJ và metadata ngoài giới hạn. Typecheck toàn workspace đạt.
- **DONE** Kiểm tra luồng audio bằng WAV im lặng kỹ thuật 4 giây: không autoplay, phát sau khi cho phép, pause và bỏ file được. Fixture đã xóa, không phải nhạc game.
- Build và trạng thái server cuối cùng được ghi cùng kết quả ở `docs/reports/CLUB_LIGHTING_REPORT.md`.

Bằng chứng: `test-results/club-premium-qa.json`, `test-results/club-audio-bloom-qa.json`, `assets/processed/club-blender-validation.json`.

## PARTIAL / BLOCKED

- **PARTIAL** Các clip tải được là sway, medium dance, twist, party và robot. Không đổi tên chúng thành Hip Sway, Body Wave, Rumba, Elegant Turn, Slide Step hay Spin; chưa tải các điệu ưu tiên đó.
- **BLOCKED** URL Rokoko “13 free dance animations” trả 404. Đã dùng trang 6 điệu chính thức thay thế. Club Motion Asset Pack cũng đã kiểm tra; không tải trùng khi đã đủ clip.
- **BLOCKED** Mixamo yêu cầu Adobe ID; không đăng nhập tài khoản hoặc chấp nhận điều khoản thay người dùng. Nếu muốn bổ sung điệu riêng: cung cấp FBX Binary, rig Mixamo, 30 FPS, ưu tiên In Place / Without Skin, kèm tên và link nguồn/giấy phép. Không cần thêm file để chạy bản test hiện tại.
- **PARTIAL** Đã có MP3 chung, phân tích local được BPM ước lượng 140, offset 0.269 giây và 14 cue năng lượng. Beat/clip lặp theo track, mixer giữ pose ra khi đổi clip/lặp bài. Còn chờ người dùng cho phép để nghe, kiểm thử playback/visual và biên tập mốc bằng tay. Xem `docs/reports/CLUB_MUSIC_PROJECTION_REPORT.md`.
- **PARTIAL** Đồng bộ đã kiểm tra trên cùng máy local. Chưa hiệu chỉnh clock offset giữa các máy hoặc latency âm thanh của thiết bị khác nhau.
- **BLOCKED** Blender MCP không kết nối addon. Import/kiểm tra đã thực hiện bằng Blender CLI; không đánh dấu MCP thành công.
- **PARTIAL** Quyền phân phối đầy đủ của WINE/POP! vẫn chờ giấy phép nguồn, như manifest nhân vật trước đó. Kiểm thử local theo file bạn cung cấp.

## Cách dùng và tái tạo

1. Chạy `npm run dev` từ root; đến cửa DENMU và nhấn E.
2. Mở **DENMU · Điều khiển show**. Khách vào đầu tiên giữ bàn DJ; quyền chuyển cho khách kế tiếp khi người đó rời phòng.
3. Chọn cue/BPM/offset rồi **Áp dụng / bắt đầu lại** để đổi show chung. Quality/giảm nhấp nháy là lựa chọn riêng từng máy.
4. `music.mp3` đã được chọn chung từ server local: bấm **Cho phép phát nhạc**, không cần chọn file lại. DJ bấm **Đồng bộ theo bài nhạc** để dùng metadata và bắt đầu lại. Audio không qua Colyseus.
5. **Lưu metadata track** xuất tên, thời lượng, BPM, beat offset và cue đầu tiên. Gửi file nhạc có quyền sử dụng cùng metadata hoặc mốc intro/drop/breakdown để tiếp tục biên tập.

Thư mục nhạc: `assets/source/audio/club/`, `apps/web/public/assets/audio/club/`. `music.mp3` là track chung mặc định; vẫn có nghe thử file riêng từng máy, chưa có playlist nhiều bài.

Lệnh tái tạo: `node scripts/prepare-club-motion.mjs`, `python scripts/write-club-manifest.py`. Bài Playwright: `scripts/playtest-club-premium.js`, chạy qua Playwright MCP trên server đang hoạt động.

Code chính: `retargetClubMotion.ts`, `ClubDancer.tsx`, `BeatSyncController.ts`, `ClubShowControls.tsx`; metadata room ở `club-show.ts`, `city.state.ts`, `club.room.ts`, `useCityConnection.ts`. Không thêm dependency và không sửa Sequelize.
