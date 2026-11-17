# Thiết kế: "Bàn Hổ Phách" (Kohaku Bluff) — bài nói dối và súng

Ngày: 2026-11-12 · Trạng thái: chờ duyệt

## 1. Ý tưởng và lý do

Một trò chơi lừa bịp ngồi bàn cho 2–4 người thật, đặt ở bàn tròn nỉ xanh tầng 1 tòa Kohaku. Người chơi úp bài, luôn tuyên bố "đây là lá chuẩn", người kế tiếp tin hoặc hô "NÓI DỐI!". Ai sai phải tự cầm súng của mình chĩa vào thái dương và bóp cò. Người cuối cùng còn sống thắng.

Bàn tròn và NPC dealer Shinku đã có sẵn nhưng hiện chỉ để trang trí. Trò chơi này cho chúng một chức năng.

Đây là game cùng thể loại lừa bịp có súng, **không phải bản dựng lại Liar's Bar**: không dùng tên, nhân vật, bối cảnh quán bar hay hình ảnh của game đó. Nhân vật là 11 mẫu người chơi của Neon Sakura City, bối cảnh là Kohaku, dealer là Shinku, model súng và bài được dựng mới theo phong cách riêng.

## 2. Mục tiêu, ngoài phạm vi, điều tuyệt đối tránh

**Mục tiêu**
- Một chế độ chơi duy nhất, chơi trọn ván từ lúc ngồi xuống tới khi có người thắng, với 2–4 người thật qua multiplayer.
- Khoảnh khắc bóp cò phải hồi hộp và ai ở trong phòng Kohaku cũng xem được.
- Server quyết định mọi thứ: chia bài, kiểm tra lời tuyên bố, vị trí viên đạn.

**Ngoài phạm vi (bản này)**
- Bot hoặc NPC ngồi chơi thay.
- Ba chế độ còn lại: xúc xắc với thuốc độc, poker cược đạn, máy slot.
- Cược tiền hoặc vật phẩm, phần thưởng, bảng xếp hạng, lưu lịch sử vào database.
- Voice chat.

**Điều tuyệt đối tránh**
- Trình duyệt biết được bài của người khác, hoặc biết viên đạn nằm ở ngăn nào, trước khi server công bố.
- Kết quả bóp cò lộ ra trong state trước khi màn hồi hộp kết thúc. Đọc network không được thấy trước.
- Cảnh bạo lực ghê rợn. *(Cập nhật 2026-11-12 theo yêu cầu người dùng: khi "đoàng" có tia máu văng và vũng máu lan trên bàn, không có vết thương chi tiết.)*
- Bất cứ thứ gì trông giống tên, nhân vật hay giao diện của Liar's Bar.
- Một người treo máy làm kẹt cả bàn.

## 3. Luật chơi (đã chốt với người dùng)

**Chuẩn bị**
- Bộ bài 20 lá: 6 K, 6 Q, 6 A, 2 Joker. Joker luôn tính là "thật".
- Mỗi người được chia 5 lá, chỉ mình thấy. Với 4 người thì toàn bộ 20 lá được chia hết.
- Mỗi vòng, Shinku rút ngẫu nhiên lá chuẩn là K, Q hoặc A.
- Mỗi người có súng riêng, ổ 6 ngăn, 1 viên đạn ở ngăn ngẫu nhiên. Vị trí đạn được chọn **một lần lúc bắt đầu ván** và giữ qua mọi vòng, nên mỗi lần sống sót thì xác suất lần sau tăng lên: 1/6, 1/5, … Lần bóp thứ 6 chắc chắn nổ.

**Lượt chơi**
1. Đến lượt, người chơi úp 1–3 lá và luôn được tính là tuyên bố "toàn là lá chuẩn".
2. Người quyết định tiếp theo là người còn sống kế tiếp theo thứ tự ghế mà **còn bài**. Người đó chọn:
   - **Tin**: đến lượt họ úp bài.
   - **Hô "NÓI DỐI!"**: lật các lá của lần úp gần nhất.
3. Kết quả lật bài:
   - Có lá không phải lá chuẩn và không phải Joker: người úp bóp cò.
   - Ngược lại: người hô bóp cò.

**Bóp cò**
- "Cạch": người đó sống, ổ đạn tiến một ngăn.
- "Đoàng": người đó bị loại, gục xuống bàn, vài giây sau đứng dậy rời ghế và thành người xem.
- Sau mỗi lần bóp cò: thu bài, chia lại 5 lá cho người còn sống, rút lá chuẩn mới. Người đi trước là người vừa bóp cò nếu còn sống, nếu không thì người còn sống kế tiếp theo thứ tự ghế.

**Trường hợp đặc biệt**
- Người hết bài được bỏ qua lượt.
- Nếu sau một lần úp không còn ai khác có bài để quyết định, lần úp đó **tự động bị lật**:
  - Nói dối thì người úp bóp cò.
  - Nói thật thì không ai bóp cò, chia lại vòng mới. *(Quyết định của tôi: luật đã chốt chỉ nói "tự động lật", không nói ai chịu khi nói thật.)*
- Người cuối cùng còn sống thắng.

**Bắt đầu và rời bàn**
- Bàn có 4 ghế `kohaku-player-1..4` sẵn có. Ván bắt đầu khi có ít nhất 2 người ngồi và **tất cả người đang ngồi** đã bấm "Sẵn sàng".
- Thứ tự lượt theo số ghế 1→2→3→4 và vòng lại. Người đi đầu ván được chọn ngẫu nhiên.
- Trong lúc ván diễn ra, ghế trống bị khóa và báo "Ván đang diễn ra".
- Đứng dậy hoặc mất kết nối giữa ván tính là bị loại.
  - Nếu còn ít nhất 2 người: hủy lần úp đang chờ, chia lại vòng mới.
  - Nếu chỉ còn 1 người: người đó thắng.
- **Hết giờ lượt** *(quyết định của tôi, để chống treo máy)*: mỗi lượt có 30 giây. Hết giờ thì server tự úp 1 lá ngẫu nhiên cho người đó. Trường hợp người đó đang ở lượt quyết định thì coi như chọn "Tin" rồi úp 1 lá ngẫu nhiên.
- Hết ván: hiện người thắng vài giây, rồi bàn về trạng thái chờ. Người còn ngồi bấm "Sẵn sàng" lại để chơi ván mới.
- **Chống giữ bàn ở trạng thái chờ** *(quyết định của tôi)*:
  - Khi có ít nhất 2 người ngồi và ít nhất 1 người đã sẵn sàng, server đếm ngược 20 giây (hiện trên HUD).
  - Hết giờ, người chưa sẵn sàng tự động được đứng dậy khỏi ghế. Nếu vẫn còn ít nhất 2 người sẵn sàng thì ván bắt đầu.
  - Tất cả cùng sẵn sàng thì bắt đầu ngay, không chờ hết giờ.

## 4. Trình bày (đã chốt với người dùng)

- **Cảnh bóp cò:** Shinku đẩy khẩu súng của người thua trượt qua mặt bàn tới chỗ người đó. Người thua cầm súng chĩa vào thái dương, dừng khoảng 1–2 giây, rồi:
  - "Cạch": tiếng cò rỗng, hạ súng xuống.
  - "Đoàng": tiếng nổ, chớp sáng đầu nòng, máu văng ra thái dương bên kia, nhân vật gục áp má xuống thành bàn, vũng máu lan xuống mặt nỉ; màn hình của chính người đó tối nhẹ.
- **Camera:** camera của mọi người trong phòng Kohaku, cả người đứng xem, chuyển sang góc gần người bóp cò trong suốt cảnh này, sau đó trả về như cũ.
- **HUD người chơi:**
  - Dưới màn hình là bài trên tay, chỉ mình thấy. Bấm chọn 1–3 lá rồi bấm "Úp bài". Khi đến lượt quyết định thì có thêm nút "NÓI DỐI!".
  - Góc trên hiện lá chuẩn, người đang đến lượt kèm đồng hồ đếm ngược, và số lần đã bóp cò của mỗi người dạng "2/6".
  - Ở trạng thái chờ có nút "Sẵn sàng".
- **Trên bàn 3D:** các lá vừa úp hiện thành chồng bài úp trước ghế người úp. Khi bị tố, các lá đó lật ngửa cho cả phòng thấy khoảng 2–3 giây.
- **Shinku:** xướng lá chuẩn và kết quả bằng bong bóng chữ.
- **Người đứng xem:** thấy mọi thứ công khai (bàn, lá lật, cảnh bóp cò, HUD trạng thái). Không thấy bài trên tay ai.

## 5. Ràng buộc kỹ thuật

Theo `CLAUDE.md` và kiến trúc sẵn có:
- **Server quyết định.**
  - Engine luật thuần chạy trong `apps/world-server`, gắn vào `KohakuRoom`, theo mẫu `systems/clubDj.ts` + `ClubRoom`.
  - RNG và đồng hồ được truyền vào engine để unit test được.
  - Client chỉ gửi ý định: sẵn sàng, úp các lá X, tin, hô nói dối. Server kiểm tra mọi message: đúng người, đúng lượt, đúng pha, lá có trên tay, 1–3 lá.
- **Kênh dữ liệu bí mật.**
  - Bài trên tay gửi riêng từng client bằng `client.send`, không bao giờ đặt trong Schema state.
  - Vị trí viên đạn chỉ nằm trong bộ nhớ server.
  - Kết quả bóp cò chỉ ghi vào state khi màn hồi hộp kết thúc.
- **State công khai.** Đặt trong Schema dùng chung của room, theo cách `CityState.dj` đang làm, gồm:
  - pha;
  - ghế tham gia;
  - lá chuẩn;
  - người đang đến lượt và hạn lượt;
  - số lá trên tay mỗi người;
  - lần úp gần nhất (ai úp, mấy lá, và các lá đã lật nếu có);
  - số lần bóp cò mỗi người;
  - ai bị loại, người thắng.
- **Protocol.** Tên message, kiểu dữ liệu, hằng số luật (bộ bài, cỡ tay, số lá tối đa, thời gian các pha) và hàm chuẩn hóa input đặt trong `packages/game-protocol`, không phụ thuộc ORM.
- **Ghế.** Logic ngồi/đứng hiện nằm trong `SakuraRoom.onCreate` (message `seat`). Kohaku cần một điểm móc để khóa ghế trống khi ván đang chạy và xử lý loại người đứng dậy giữa ván. `onLeave` cũng phải xử lý loại người mất kết nối.
- **Web.**
  - Hành vi mới đặt trong `apps/web/game/systems/` (hook/controller), UI trong `game/ui/`, vật thể 3D trong `game/entities/`.
  - Không dồn vào `World.tsx` hay `KohakuScene.tsx` ngoài việc gắn component.
  - Hàm gửi message thêm vào `useCityConnection.ts` theo mẫu `holdDj` hay `selectDjTrack`.
- **Asset.**
  - Model súng ổ xoay và lá bài dựng mới bằng Blender theo pipeline `scripts/*.py`. GLB phục vụ đặt trong `apps/web/public/assets/`, nguồn trong `assets/source/` hoặc `assets/processed/`, ghi vào manifest.
  - Âm thanh "cạch", "đoàng", xáo bài phải có giấy phép rõ (CC0 hoặc tự tạo) và ghi vào manifest.
- **Animation.** Tư thế chĩa súng vào thái dương và gục xuống bàn phải chạy được trên **mọi mẫu trong `packages/game-protocol/src/player-characters.json`** (hiện là 9 mẫu) và khớp với tư thế ngồi hiện có.
  - Làm bằng cách điều khiển xương trong code (cộng thêm trên clip ngồi), **không bake đè vào GLB người chơi**, vì các GLB này đang có thay đổi chưa commit. *(quyết định của tôi)*
- **Kiểm thử.**
  - Unit test cho engine luật (chia bài, lượt, lật bài, ổ đạn, các trường hợp đặc biệt, hết giờ, rời bàn) và cho hàm chuẩn hóa input. File spec mới phải được thêm vào script `test` của package tương ứng.
  - Không chạy Playwright hay mở trình duyệt khi chưa có sự cho phép của người dùng.

## 6. Phần để người làm tự quyết

- Cách chia module cụ thể và tên file.
- Tên message trên wire.
- Dạng Schema cho bài đã lật.
- Chi tiết cách điều khiển xương cho tư thế chĩa súng và gục (IK hay góc xoay cố định theo từng xương), miễn đạt yêu cầu ở mục 5.
- Xử lý khi có người rời bàn đúng lúc đang diễn cảnh lật bài hoặc bóp cò.
- Thời lượng chính xác của các pha lật bài, hồi hộp, gục, kết thúc. Gợi ý 2–3 giây mỗi pha.
- Kiểu dáng súng và lá bài, miễn hợp phong cách Kohaku (hổ phách, vàng kim, gỗ tối) và không giống Liar's Bar.
- Góc camera cận cảnh cụ thể.
- Có bổ sung kiểm thử e2e hai client cho trò chơi hay không. Nên có nếu chi phí hợp lý.
