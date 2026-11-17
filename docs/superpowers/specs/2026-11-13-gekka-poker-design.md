# Thiết kế: 月華楼 Gekkarō — sòng Poker Taishō và căn hầm trừng phạt

Ngày: 2026-11-13 · Trạng thái: chờ duyệt (đã qua vòng kiểm tra của người làm)

## 1. Ý tưởng và lý do

Một tòa nhà chủ đề người lớn (cờ bạc, bạo lực có dàn cảnh) mới ở Neon Sakura City: tầng trên là sòng bạc sang trọng kiểu **Taishō Roman** (Nhật thập niên 1920 pha phương Tây), dưới đất là một **căn hầm** bẩn thỉu, sập xệ. Người chơi ngồi bàn **Texas Hold'em** bằng chip ảo do sòng cấp. Ai **thua sạch chip** bị lôi xuống hầm, trói treo lên cột và bị NPC đao phủ đấm, nhân vật kêu la. Xong thì người đó chọn **rời bàn** hoặc **vay chip của sòng** để quay lại.

Lý do (lời người dùng): thứ làm Kohaku Bluff cuốn hút là **luật chơi hay** cộng với **khẩu súng gây kích thích**. Tòa nhà này giữ đúng công thức đó: một trò đấu trí có chiều sâu (poker) và một cái giá phải trả nặng nề, có dàn cảnh, mà ai trong phòng cũng xem được.

Không khí (lời người dùng): tầng trên **trang trọng, lịch sử, cảnh vật đẹp**; hầm **u ám, bẩn thỉu, sập xệ, đèn thỉnh thoảng chập chờn nháy**. Sự tương phản giữa hào nhoáng phía trên và mục nát phía dưới là câu chuyện của tòa nhà.

Đây là sòng bạc nguyên bản của Neon Sakura City, không dựng lại bất kỳ game, phim hay địa danh có thật nào (tên 月華楼 là tên tự đặt).

## 2. Mục tiêu, ngoài phạm vi, điều tuyệt đối tránh

**Mục tiêu**
- Chơi trọn một ván Hold'em No-Limit với 2–6 người thật qua multiplayer, server quyết định mọi thứ.
- Khoảnh khắc thua sạch → bị lôi xuống hầm → bị đấm phải có dàn cảnh đủ kịch tính để người khác muốn xem.
- Người chơi khác có thể **đi xuống hầm đứng xem** (và cà khịa), người trên bàn vẫn chơi tiếp.
- Vay chip có cái giá tăng dần, để mỗi lần all-in nặng ký hơn.

**Ngoài phạm vi (bản này)**
- NPC/bot ngồi chơi lấp ghế trống (người dùng: *không cần*).
- Người xem tự tay đấm (người dùng: *chỉ đứng xem*).
- Tiền thật, quy đổi, lưu chip/nợ vào database, bảng xếp hạng. Chip và nợ chỉ sống trong một ván, trên bộ nhớ room.
- Các biến thể poker khác (Omaha, side game), nhiều bàn.
- Voice chat.

**Điều tuyệt đối tránh**
- Trình duyệt biết bài tẩy của người khác hoặc thứ tự bộ bài trước khi server công bố (đọc network cũng không thấy).
- Một người treo máy làm kẹt bàn, hoặc một người đang ở hầm làm kẹt ván.
- Cảnh tra tấn ghê rợn: không máu me, không vết thương chi tiết, không xương gãy. Chỉ có cú đấm, rung camera, biểu cảm đau và tiếng kêu.
- Bất kỳ thứ gì có vẻ là tiền thật hoặc có thể mua bán.
- Nội dung tình dục dưới bất kỳ hình thức nào. "18+" ở đây là chủ đề cờ bạc và bạo lực có dàn cảnh, cùng mức với cảnh súng và máu ở Kohaku.
- Màn hình hỏi tuổi hoặc cổng "xác nhận 18+": AGENTS.md cấm luồng nội dung giới hạn tuổi không xác minh. *(Quyết định của tôi: không có cổng tuổi, giữ nội dung ở mức hiện tại của game.)*
- Mọi NPC mới (dealer, đao phủ) là người trưởng thành, ghi rõ trong data. Người chơi bị trói là avatar của chính họ trong roster hiện có, giống như ở Kohaku họ tự bóp cò. *(Quyết định của tôi.)*

## 3. Luật chơi

### 3.1 Bàn và chip
- Một bàn hình bầu dục 6 ghế (`gekka-player-1..6`) + ghế dealer cho NPC. Cần **tối thiểu 2 người** đã Sẵn sàng để bắt đầu; luồng ngồi/sẵn sàng/đếm ngược dùng lại cách của Kohaku Bluff.
- Mỗi người vào ván nhận **1.000 chip** cấp sẵn. *(Quyết định của tôi.)*
- Blind khởi điểm **10/20**, **nhân đôi sau mỗi 10 ván bài** để ván có hồi kết. *(Quyết định của tôi.)*

### 3.2 Một ván bài (Texas Hold'em No-Limit chuẩn)
1. Nút dealer xoay vòng; small blind, big blind tự đặt.
2. Mỗi người nhận 2 lá tẩy (chỉ mình thấy).
3. Bốn vòng tố: pre-flop, flop (3 lá chung), turn (1), river (1). Hành động: fold / check / call / bet / raise / all-in. No-Limit: tố tối thiểu bằng mức tố trước, tối đa toàn bộ chip.
4. Showdown: so bài theo thứ hạng Hold'em chuẩn, chia pot và **side pot** đúng luật khi có người all-in.
5. Mỗi lượt có **30 giây** (giống Bluff); hết giờ thì tự check nếu được, không thì tự fold.

### 3.3 Thua sạch → xuống hầm
- Hết ván bài mà một người còn **0 chip** → người đó **bị bắt**: ghế được **giữ chỗ**, nhân vật bị đưa xuống hầm và trói lên cột.
- NPC đao phủ đấm **5 cú** ở lần thua sạch đầu tiên; mỗi khoản nợ đang có cộng thêm **3 cú** (lần 2: 8, lần 3: 11). *(Con số là quyết định của tôi.)*
- Bàn **không chờ** người ở hầm: các ván bài tiếp tục, ghế của người bị bắt bị bỏ qua.
- Hết trận đấm, người chơi chọn trong **20 giây** (hết giờ = rời bàn):
  - **Rời bàn**: được thả, đứng dậy ở cửa hầm, thành người xem.
  - **Vay chip**: nhận lại 1.000 chip, **nợ +1**, quay về ghế cũ và vào lại từ ván bài kế tiếp.
- Rời phòng/mất kết nối khi đang ở hầm = rời bàn.

### 3.4 Kết thúc trận
- Trận kết thúc khi chỉ còn **một người ngồi bàn còn chip** và không còn ai đang ở hầm có thể vay. Người đó thắng.
- Mỗi người được **vay tối đa 2 lần mỗi trận** (người dùng chốt). Thua sạch lần thứ 3: bị đấm 11 cú, không còn nút Vay, bị treo ở hầm tới hết trận rồi mới được thả.
- Sau khi kết thúc: công bố người thắng vài giây (như `gameOver` của Bluff), mọi người đứng dậy, chip/nợ xóa sạch.

## 4. Dàn cảnh

### 4.1 Tầng trên — Taishō Roman
Sàn gỗ bóng, đèn chùm pha lê, cột đá cẩm thạch, rèm nhung đỏ, tranh cổ, bình sứ, piano jazz cổ. Bàn nỉ xanh đậm dưới đèn chùm. NPC dealer mặc vest đuôi tôm (người trưởng thành), chia bài, đọc hành động và thoại bằng giọng như Shinku.

### 4.2 Lối xuống hầm
Một cánh cửa gỗ khuất sau quầy hoặc rèm, dẫn xuống cầu thang đá hẹp. Ai cũng đi xuống được để xem.

### 4.3 Hầm
Tường gạch nứt, nước rỉ, sàn ẩm, xích sắt, một **cột gỗ cũ** ở giữa. **Một bóng đèn treo dây chập chờn**, thỉnh thoảng tắt hẳn vài trăm ms. Khu người xem đứng có ánh sáng yếu.

### 4.4 Cảnh bị bắt và bị đấm
- Bị bắt: tối màn hình ngắn + tiếng bước chân/kéo lê, rồi nhân vật xuất hiện bị trói trên cột. *(Quyết định của tôi: dùng chuyển cảnh thay vì hoạt cảnh lôi kéo để giảm chi phí; NPC đàn em lôi kéo thật có thể làm sau.)*
- Mỗi cú đấm: NPC đao phủ ra đòn → nhân vật giật người, biểu cảm đau, tiếng kêu → âm cú đấm vang trong hầm, rung camera cho người đang xem gần. Nhịp ~1,2 giây/cú, chậm dần ở vài cú cuối.
- Người bị đấm luôn được camera giữ góc thấy NPC và chính mình.
- Cà khịa: **bất kỳ ai trong phòng không đang ngồi bàn** (đứng ở hầm hay ở sảnh) dùng phím cà khịa, nhắm vào **người đang bị trói**; người đang ngồi bàn cà khịa nhau như Kohaku. Cùng cooldown như Kohaku. *(Quyết định của tôi.)*

### 4.5 Âm thanh
- Thoại dealer và đao phủ: giọng có giấy phép như cách Kohaku dùng VOICEVOX, ghi nguồn trong luật chơi.
- Tiếng kêu khi bị đấm cho **9 nhân vật người chơi** (roster trong `player-characters.json`) phải **nghe đau và chân thật** (người dùng chốt). Vì vậy không dùng âm tổng hợp bằng code hay giọng TTS.
  *(Quyết định của tôi:)* dùng **bản thu giọng người thật có giấy phép mở** (CC0 hoặc CC-BY, ví dụ các gói tiếng kêu đau giọng nữ trên Freesound/OpenGameArt). Mỗi nhân vật có 4–6 tiếng (rên, hự, kêu to cho cú mạnh), phân bổ từ vài giọng gốc và đổi cao độ nhẹ để mỗi nhân vật nghe khác nhau. Tiếng to dần theo số cú. File gốc và giấy phép lưu ở `assets/source/`, ghi nguồn trong luật chơi nếu giấy phép yêu cầu.
- Tiếng cú đấm, chip, xáo bài: tổng hợp WebAudio như `bluffSfx` hoặc file có giấy phép.

## 5. Kiến trúc (theo cách Kohaku đang làm)

- **Zone/room mới** `gekka`: room Colyseus riêng kế thừa `SakuraRoom`, đăng ký trong `world-server/src/main.ts`, nối cổng từ phố Sakura. Tầng trên và hầm nằm trong **cùng một room** (hầm là tầng y âm, như các tầng của Kohaku).
- **Luật poker** là module thuần trong `world-server/src/systems/` (giống `kohakuBluff.ts`): room chỉ nối message, ghế và schema. Engine nhận `now` để test được bằng đồng hồ giả.
- **Bài tẩy** gửi riêng từng client bằng message, không bao giờ vào schema. Bộ bài và thứ tự chỉ ở server. Lá chung chỉ vào schema khi tới vòng lật.
- **Vị trí nhân vật ở hầm** do server đặt (trói lên cột, thả ra cửa hầm), không do client.
- **Protocol** (`packages/game-protocol`): kiểu bàn, pha, message, ghế, hằng số thời gian và chip, đặt chung một file như `kohaku-bluff.ts`.
- **Web**: scene mới trong `game/scenes/`, logic vào `game/systems/`, HUD poker trong `game/ui/`, NPC trong `game/entities/`. Không nhét vào `World.tsx`. Asset tải sẵn qua `ClubAssetWarmup`.
- **Asset**: tòa nhà và hầm dựng bằng pipeline Blender sẵn có (`scripts/*.py`), xuất GLB vào `apps/web/public/assets/`. Nguồn/giấy phép vào `assets/source/`.

## 6. Bảo mật và công bằng
- Xáo bài bằng nguồn ngẫu nhiên phía server (crypto), test được bằng RNG giả.
- Chặn mọi hành động sai lượt, sai số chip, tố dưới mức tối thiểu, ngay ở engine.
- Một client không thể tự đưa mình hoặc người khác ra khỏi hầm.

## 7. Kiểm thử
- Engine poker: thứ hạng bài (gồm hòa, kicker, straight A-5), side pot nhiều tầng, blind tăng, hết giờ tự fold/check, người rời giữa ván.
- Luồng hầm: bị bắt, số cú đấm theo nợ, hết giờ chọn = rời bàn, vay quay lại đúng ghế, kết thúc trận.
- Không rò rỉ: schema không chứa bài tẩy hay bộ bài.
- Một bài e2e 2 client như `pnpm test:e2e` hiện có.

## 8. Phần để người làm tự quyết
Bố cục chi tiết phòng, tên NPC, câu thoại, màu sắc, góc camera, thời lượng từng pha nhỏ, cách chia file bên trong mỗi tầng.

## 9. Câu hỏi còn mở
Không còn.
