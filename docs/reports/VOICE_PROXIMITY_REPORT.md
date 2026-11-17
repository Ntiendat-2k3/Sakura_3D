# Voice chat theo khoảng cách (Proximity Voice) qua Tailscale

Người chơi đứng gần nhau trong cùng một zone nói chuyện bằng micro. Càng xa nghe càng nhỏ, và âm thanh có hướng trái/phải theo vị trí avatar. Tính năng này dùng để hai máy ở hai nơi khác nhau chơi chung qua Internet bằng **Tailscale**, một mạng riêng ảo miễn phí.

## 1. Cách hoạt động

```
Trình duyệt A  ──WebRTC P2P (âm thanh)──  Trình duyệt B        ← không qua server, không ghi âm
      │                                          │
      └──wss── Colyseus room (signaling) ────────┘                ← chỉ chuyển offer/answer/ICE
```

- **Âm thanh:** đi thẳng giữa hai trình duyệt (WebRTC mesh). Mỗi người kết nối tối đa `VOICE_MAX_PEERS = 8` người gần nhất.
- **Signaling:** dùng luôn room Colyseus của zone hiện tại (`voice-state`, `voice-signal`, `voice-report`). Server chỉ chuyển tín hiệu khi hai người **cùng phòng, cùng bật voice và ở gần nhau theo vị trí của server**, không tin vị trí do client gửi. Payload được kiểm tra hình dạng và kích thước, và mỗi người có giới hạn tốc độ (token bucket 60 gói, hồi 15 gói/giây).
- **Khoảng cách** (`packages/game-protocol/src/voice.ts`, `VOICE_RANGE`): nghe to đủ trong 3 m, nhỏ dần về 0 ở 12 m. Client mở kết nối khi người kia vào trong 12 m và ngắt khi ra ngoài 14 m (khoảng chênh này tránh bật tắt liên tục ở mép). Server cho chuyển tín hiệu tới 16 m vì vị trí hiển thị trên client trễ khoảng 200 ms. Khoảng cách tính theo 3D nên người ở tầng khác của Kohaku/Gekkarō không nghe thấy nhau.
- **Âm thanh 3D:** mỗi luồng đi qua `PannerNode` (HRTF, mô hình linear). Vị trí nguồn âm cập nhật mỗi khung hình theo avatar đã nội suy, còn tai nghe đặt ở avatar của bạn và quay theo camera.
- **Chuyển zone:** toàn bộ kết nối của phòng cũ bị đóng. Khi vào phòng mới, client tự báo lại trạng thái voice và kết nối lại với người ở gần.

## 2. Điều khiển và an toàn

| Chức năng | Cách dùng |
| --- | --- |
| Bật voice | Bảng **🎙 Voice** ở góc phải: bấm *Bật voice chat*, đọc thông báo đồng ý, bấm *Đồng ý và bật micro*. Trình duyệt chỉ hỏi quyền micro sau bước này. Voice **tắt mặc định**. |
| Push-to-talk (mặc định) | **Giữ phím `B`**, hoặc giữ nút trên bảng. Phím không có tác dụng khi đang gõ chat hoặc ô nhập. **Phím V vẫn là đổi góc nhìn camera**, nên push-to-talk dùng B. |
| Mở mic liên tục | Bấm nút chế độ để chuyển *Giữ B để nói* ↔ *Mở mic liên tục*. Lựa chọn được lưu trong trình duyệt. |
| Tự tắt mic | Nút *Tắt mic*. |
| Tắt tiếng một người | Nút *Tắt tiếng* cạnh tên. Vẫn giữ kết nối, chỉ không phát ra loa. |
| Chặn | Nút *Chặn*: ngắt ngay và không bao giờ kết nối lại. Offer từ người đó bị từ chối. Danh sách lưu trong `localStorage` nếu trình duyệt cho phép. Xem và bỏ chặn qua nút *Đã chặn (n)*. |
| Báo cáo | Nút *Báo cáo*, kèm lý do (không bắt buộc). Dự án local chưa có hệ thống kiểm duyệt, nên báo cáo được **ghi vào log của tiến trình world-server** (dòng `[voice-report] {...}`, gồm thời gian, zone, id và tên người báo cáo, người bị báo cáo, lý do). Mỗi người gửi tối đa 1 báo cáo mỗi 10 giây. |
| Chỉ báo | Chấm xanh trên bảng tên avatar là người đó đang nói. Chấm đỏ là đã bị tắt tiếng hoặc chặn, hoặc là chính bạn đang tắt mic. |
| Lỗi | HUD báo riêng từng trường hợp: bị từ chối quyền micro, không có micro, micro bị ứng dụng khác chiếm, trang không phải HTTPS, trình duyệt không hỗ trợ. |

Micro bật sẵn khử tiếng vọng, khử ồn và tự cân âm lượng (`echoCancellation`, `noiseSuppression`, `autoGainControl`). Vẫn nên đeo tai nghe.

> Lưu ý quyền riêng tư: kết nối P2P để lộ địa chỉ IP (IP Tailscale 100.x hoặc IP LAN) cho người được kết nối. Thông báo đồng ý đã nói rõ điều này. Chỉ chơi với người bạn tin cậy.

## 3. Hướng dẫn chơi 2 máy qua Tailscale

Máy **A** (máy chủ) chạy toàn bộ game: Docker/PostgreSQL, API, world server và web. Máy **B** chỉ cần trình duyệt.

### 3.1. Một lần duy nhất

1. Cài Tailscale trên **cả hai máy** từ https://tailscale.com/download, rồi đăng nhập. Hai máy phải cùng một tailnet: dùng chung tài khoản, hoặc máy A mời người dùng B qua *Share* hay *Invite users* trong trang quản trị.
2. Trong trang quản trị Tailscale → **DNS**: bật **MagicDNS** và **HTTPS Certificates**. Đây là điều kiện để có địa chỉ `https://<máy>.<tailnet>.ts.net` với chứng chỉ hợp lệ. Micro chỉ hoạt động trên trang HTTPS.
3. Trên máy A, kiểm tra trong PowerShell:
   ```powershell
   tailscale status
   tailscale ip -4
   ```

### 3.2. Mỗi lần chơi (trên máy A)

1. Chạy game như bình thường:
   ```powershell
   npm run dev
   ```
2. Mở thêm một cửa sổ PowerShell ở thư mục gốc dự án và mở HTTPS cho tailnet:
   ```powershell
   .\scripts\Start-TailscaleServe.ps1
   ```
   Script chạy đúng ba lệnh sau. Bạn cũng có thể gõ tay:
   ```powershell
   tailscale serve --bg --yes --https=443   http://127.0.0.1:3000   # web
   tailscale serve --bg --yes --https=8443  http://127.0.0.1:4000   # API
   tailscale serve --bg --yes --https=10000 http://127.0.0.1:2567   # world server (wss)
   tailscale serve status
   ```
   Script in ra địa chỉ chơi, ví dụ `https://may-a.tail1234.ts.net`.
3. **Lần đầu:** thêm địa chỉ đó vào `CORS_ORIGIN` trong file `.env` ở gốc dự án. Các origin cách nhau bằng dấu phẩy:
   ```
   CORS_ORIGIN=http://localhost:3000,https://may-a.tail1234.ts.net
   ```
   Sau đó dừng (`Ctrl+C`) và chạy lại `npm run dev` để API nhận cấu hình mới.
4. Trên máy A, mở **`https://may-a.tail1234.ts.net`** bằng Chrome hoặc Edge. Nên dùng chính địa chỉ này thay cho localhost để hai bên chạy giống nhau.

Không cần đặt `NEXT_PUBLIC_API_URL` hay `NEXT_PUBLIC_WORLD_URL`. Khi trang mở bằng https, web tự dùng `https://<cùng host>:8443` cho API và `wss://<cùng host>:10000` cho world server (`apps/web/game/networking/serviceUrls.ts`). Nếu các biến này đang trỏ về `localhost`, chúng tự bị bỏ qua khi trang không chạy trên localhost.

Gỡ cấu hình sau khi chơi xong:
```powershell
.\scripts\Start-TailscaleServe.ps1 -Reset    # tương đương: tailscale serve reset
```

### 3.3. Máy B làm gì

1. Cài Tailscale, đăng nhập cùng tailnet (bước 3.1). Kiểm tra bằng `tailscale status`: máy A phải có trong danh sách.
2. Mở Chrome hoặc Edge tới địa chỉ máy A, ví dụ `https://may-a.tail1234.ts.net`. Máy B không cần cài Node, Docker hay mã nguồn.
3. Chọn nhân vật, vào game, bấm **Bật voice chat** → **Đồng ý và bật micro** → cho phép micro khi trình duyệt hỏi.
4. Đi lại gần nhân vật của máy A (dưới 12 m), giữ **B** rồi nói.

### 3.4. Kiểm thử thủ công 2 máy (chưa được kiểm tự động)

- [ ] Cả hai máy cùng thấy nhau trong game, trạng thái ONLINE.
- [ ] Bật voice ở cả hai máy. Khi đứng gần, tên người kia hiện trong bảng Voice với trạng thái khoảng cách (không còn "đang nối…").
- [ ] Giữ B nói thì máy kia nghe thấy và thấy chấm xanh trên đầu avatar. Nhả B thì im.
- [ ] Đi xa dần: tiếng nhỏ dần, hết hẳn quanh 12 m. Quá 14 m thì người kia biến khỏi danh sách kết nối.
- [ ] Đứng bên trái hoặc bên phải người kia (đeo tai nghe): nghe rõ hướng.
- [ ] Gõ chữ "b" trong ô chat: không phát tiếng.
- [ ] *Tắt tiếng*, *Chặn*, *Bỏ chặn*, *Tắt mic*, *Mở mic liên tục* hoạt động đúng.
- [ ] *Báo cáo*: cửa sổ chạy `npm run dev` của máy A hiện dòng `[voice-report]`.
- [ ] Cùng vào club: voice kết nối lại trong phòng mới. Một người ở phố, một người trong club: không nghe nhau.
- [ ] Từ chối quyền micro, hoặc rút micro: HUD báo lỗi tương ứng.

## 4. Xử lý sự cố

| Triệu chứng | Nguyên nhân và cách xử lý |
| --- | --- |
| Không mở được `https://…ts.net` | Kiểm tra `tailscale status` trên cả hai máy. Đã bật MagicDNS + HTTPS Certificates chưa? Lần truy cập đầu tiên Tailscale cấp chứng chỉ, có thể mất vài chục giây. |
| Trang mở được nhưng OFFLINE, "Không kết nối được API" | Chưa thêm origin vào `CORS_ORIGIN`, hoặc chưa khởi động lại `npm run dev`. Chạy `tailscale serve status` để kiểm tra có đủ ba cổng 443/8443/10000. Thử mở `https://<máy-A>…ts.net:8443/api/v1/health` trên máy B. |
| Vào được game nhưng không vào được room | Cổng 10000 chưa được serve, hoặc world server chưa chạy. Xem log `npm run dev`. |
| HUD báo "Voice cần trang HTTPS" | Đang mở bằng `http://<IP>:3000`. Hãy dùng địa chỉ `https://…ts.net`. Chỉ `localhost` mới được dùng micro mà không cần HTTPS. |
| "Trình duyệt đã từ chối quyền micro" | Bấm biểu tượng ổ khóa cạnh thanh địa chỉ → Microphone → Allow, rồi bật voice lại. Kiểm tra cả Windows Settings → Privacy → Microphone. |
| Bảng Voice kẹt ở "đang nối…" hoặc "lỗi kết nối" | Đảm bảo **cả hai** đã bật voice và đồng ý quyền micro. Chrome chỉ lộ IP thật cho WebRTC sau khi được cấp quyền micro. Mở `chrome://webrtc-internals` để xem ICE candidate (phải thấy IP `100.x` của Tailscale). Tường lửa Windows hoặc phần mềm diệt virus có thể chặn UDP. Tạm thời có thể thử thêm máy STUN của bạn vào `NEXT_PUBLIC_VOICE_ICE_SERVERS` (mục 5). |
| Nghe tiếng vọng hoặc hú | Đeo tai nghe. Dùng push-to-talk thay vì mở mic liên tục. |
| Không nghe gì dù đã kết nối | Bấm vào trang một lần (trình duyệt cần thao tác người dùng để phát âm thanh). Kiểm tra người kia không bị *Tắt tiếng* hoặc *Chặn*, và đang ở dưới 12 m. |
| Next báo "Blocked cross-origin request" | `apps/web/next.config.ts` đã cho phép `**.ts.net` và `127.0.0.1`. Nếu dùng tên miền khác, thêm vào `DEV_ALLOWED_ORIGINS`. |

## 5. Cấu hình

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `CORS_ORIGIN` (`.env` gốc, API đọc) | `http://localhost:3000` | Nhiều origin cách nhau bởi dấu phẩy. |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WORLD_URL` | không đặt → tự suy ra | Chỉ cần khi API hoặc world server nằm ở host khác. |
| `NEXT_PUBLIC_VOICE_ICE_SERVERS` | rỗng `[]` | Mảng JSON `RTCIceServer`, ví dụ `[{"urls":"stun:stun.example.org:3478"}]`. Không có STUN bên thứ ba nào được ghi cứng. Qua Tailscale hoặc LAN thì không cần. Next không nạp `.env` gốc, nên đặt biến này trong `apps/web/.env.local`. |

Hằng số giao thức nằm trong `packages/game-protocol/src/voice.ts`: `VOICE_RANGE`, `VOICE_MAX_PEERS`, `VOICE_LIMITS`, `VOICE_SIGNAL_RATE`. Phím push-to-talk là `VOICE_PUSH_TO_TALK_CODE` trong `apps/web/game/systems/voiceControls.ts`.

## 6. Tệp liên quan

- `packages/game-protocol/src/voice.ts`: hằng số, tên message, chuẩn hóa payload (test: `packages/game-protocol/test/voice.spec.ts`).
- `apps/world-server/src/systems/voiceRelay.ts`: kiểm tra quyền chuyển tín hiệu, rate limit, ghi log báo cáo. Được gắn một lần trong `SakuraRoom`, nên mọi zone đều dùng (test: `apps/world-server/test/voice-relay.spec.ts`).
- `apps/web/game/systems/voicePeers.ts` (chọn peer có hysteresis và giới hạn số lượng), `voiceControls.ts` (push-to-talk, lỗi micro, ICE, danh sách chặn), `VoiceChatEngine.ts` (WebRTC + Web Audio), `useProximityVoice.ts` (hook React), `VoiceSpatialAudio.tsx` (cập nhật vị trí âm thanh mỗi khung hình), `voiceAvatarRegistry.ts`.
- `apps/web/game/ui/VoicePanel.tsx`: bảng điều khiển và thông báo đồng ý.
- `apps/web/game/networking/serviceUrls.ts`: suy ra URL API và world server theo trang (test chung: `apps/web/test/voice-chat.spec.ts`).
- `scripts/Start-TailscaleServe.ps1`: mở HTTPS qua `tailscale serve`.

## 7. Giới hạn đã biết

- Chưa kiểm thử âm thanh thật giữa hai máy. Các test tự động chỉ kiểm logic thuần (relay, rate limit, chọn peer, push-to-talk, URL) và luồng signaling của engine với WebRTC giả.
- Mesh P2P phù hợp nhóm nhỏ. Nhiều người đứng sát nhau sẽ bị giới hạn 8 peer gần nhất.
- Báo cáo mới chỉ ghi log server. Chưa có công cụ kiểm duyệt, cấm (ban) hay lưu báo cáo bền vững.
- Danh sách chặn theo id người chơi guest. Nếu id guest đổi sau mỗi lần tải trang, danh sách chặn cũ không còn tác dụng với người đó.
