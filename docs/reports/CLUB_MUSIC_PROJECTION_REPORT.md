# Nhạc chung và đèn disco xoay theo ảnh mẫu

Trạng thái: **PARTIAL** — đã tích hợp, có kiểm tra terminal; chưa nghe/nhìn/FPS trong browser theo yêu cầu không mở Playwright.

## Nhạc

- Dùng đúng `assets/source/audio/club/music.mp3`, sao chép nguyên vẹn sang `apps/web/public/assets/audio/club/music.mp3`. SHA-256: `a230aacb00f6e1a352dfdb71672211f0f9d3871bfd5e299b77ea009162361b47`.
- Giải mã toàn bộ bằng thư viện audio/numpy có sẵn trong Blender CLI: 244.062 giây, stereo 44.1 kHz. Không tải, mua hoặc thay bằng bài khác.
- Phân tích spectral flux, tinh chỉnh tempo theo độ nhất quán pha: BPM ước lượng **140**, beat offset ước lượng **0.269 giây**, 14 cue năng lượng theo đoạn 32 beat. Đây là kết quả tự động, chưa nghe và biên tập bằng tay.
- Metadata dùng chung trong `packages/game-protocol/src/club-track.json`; BPM/offset/cue mặc định của room lấy từ đó. DJ có thể chỉnh hoặc bấm **Đồng bộ theo bài nhạc**.
- Mọi khách tải cùng MP3 qua HTTP và lấy vị trí phát theo epoch room. E/click vào cửa yêu cầu phát nhạc ngay trong thao tác người chơi, có âm lượng/pause riêng và nút phát dự phòng khi trình duyệt chặn. Không gửi byte audio qua Colyseus.
- Beat và animation quay về đầu cùng bài nhạc; đồng hồ của projection vẫn tăng nên đèn không dừng/đảo chiều lúc audio lặp. Mixer giữ pose đang biểu diễn khi đổi clip/lặp track để tránh nhảy sang cuối clip không liên quan.
- Vẫn hỗ trợ nghe thử MP3/WAV/OGG khác chỉ trên máy mình; có nút quay lại nhạc chung.

## Cập nhật phát nhạc khi vào club

- Theo yêu cầu mới, phím E/click vào cửa gọi `play()` ngay trong thao tác người chơi. Khi chuyển vào phòng, mở âm lượng và đồng bộ vị trí theo epoch chung. Không cần chọn lại `music.mp3`.
- Audio element được giữ cùng World, không hủy rồi tải lại mỗi lần đổi phòng. Khi ra ngoài, nhạc dừng; vào lại tiếp tục timeline chung.
- Nút **Cho phép phát nhạc** vẫn là dự phòng khi chính sách trình duyệt chặn. Chưa xác minh autoplay thực tế vì chưa được phép mở browser. Hướng dẫn bấm nút ở bản báo cáo trước được thay bằng hành vi vào cửa này.
- Chi tiết NPC và cache: `docs/reports/CLUB_GREETER_LOADING_REPORT.md`.

## Hiệu ứng theo ảnh mẫu

- Giữ nguyên model disco ball và các fixture GLB, giữ hai đèn trắng ấm chiếu sáng sân khấu.
- Thêm các đốm/cánh sao nhiều màu chiếu giả lập lên bề mặt gần nhất của sàn, sân khấu và tường. Phép chiếu chừa lỗ cửa EXIT, có depth test để vật thể ở trước che bớt vệt sáng.
- Ba vòng cầu vồng giao nhau xoay liên tục trên sàn, cùng quầng sáng ở vị trí disco ball. Dùng thời gian tuyệt đối, quay một chiều thay vì lắc qua lại bằng sin.
- Low/Medium/High dùng 168/288/420 đốm. Toàn bộ hiệu ứng thêm khoảng ba draw calls bằng instancing; không tạo từng ấy PointLight. Giảm nhấp nháy vẫn bật mặc định, giảm tốc độ/cường độ nhưng không tắt chuyển động.
- Đây là decal/glow bề mặt được dựng bằng shader, không phải projector có shadow map cho mọi đạo cụ và nhân vật. Chưa xác minh mức giống ảnh, độ sáng cuối hoặc FPS thực tế của bản mới.

## Kiểm tra

- **PASS** MP3 nguồn/runtime cùng SHA-256; decoder đọc được toàn bộ bài.
- **PASS** HTTP HEAD 200, MIME `audio/mpeg`, Content-Length 9,762,481 byte; byte-range 206 trả đúng 1,024 byte đầu. Bằng chứng: `test-results/club-music-http.json`.
- **PASS** Unit tests projection: ray hữu hạn, chuẩn đơn vị, đúng sàn/tường/sân khấu, không chiếu lơ lửng ở cửa, quay đủ 360°.
- **PASS** Unit tests timing: loop cùng epoch/cue, đồng hồ quay không reset theo loop nhạc; manual preset được giữ.
- **PASS** Unit test AnimationMixer với dữ liệu clip thật: crossfade giữ pose ra, hips offset không tích lũy.
- **PASS** Typecheck toàn workspace. Các unit test backend/protocol trước đó cũng đạt; bộ test Web mới đã gắn vào `pnpm test`, tái sử dụng tsx trong monorepo, không thêm dependency production.
- **PASS** Build toàn monorepo 5/5, 17 unit tests và 2 e2e Node API/multiplayer/club. E2e xác nhận metadata BPM/offset/cue mặc định và epoch được đồng bộ giữa hai khách. Không đánh dấu trình duyệt đã đạt dựa trên HTTP/build.
- **PASS** Sau build, Web 3000/API 4000/World 2567 chạy lại, PostgreSQL healthy, kiểm tra MIME/hash/range MP3 đạt lần nữa. Bằng chứng: `test-results/logs/club-music-build.log`, `test-results/club-music-http.json`.
- **SKIPPED** Playwright, tự mở browser, nghe playback, WebGL/shader link trong GPU, screenshot và đo FPS: người dùng yêu cầu chỉ chạy khi cho phép rõ ràng. Không dùng công cụ khác để thay thế việc mở browser.

## File chính

`prepare-club-audio.py`, `club-track.json`, `club-music.ts`, `club-show.ts`, `city.state.ts`, `BeatSyncController.ts`, `ClubShowControls.tsx`, `clubProjection.ts`, `DiscoProjectionSystem.tsx`, `ClubEffectsController.tsx`, các unit/e2e tests và manifest. Không thay Sequelize/database schema, không thêm cloud service.

## Sử dụng

Sau khi tải lại game, đến cửa Denmu và nhấn **E** hoặc click vào cửa: hệ thống yêu cầu phát `music.mp3` và đồng bộ khi vào phòng. Nếu trình duyệt chặn, mở **DENMU · Điều khiển show** → **Cho phép phát nhạc**. Không cần chọn lại file MP3. Muốn cả phòng bắt đầu bài từ đầu: khách giữ bàn DJ bấm **Đồng bộ theo bài nhạc**.

Tái tạo metadata: `blender --background --python scripts/prepare-club-audio.py`; kiểm tra file/HTTP bằng `node scripts/verify-club-music.cjs`; kiểm tra logic bằng `pnpm test`.
