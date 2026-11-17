# Báo cáo Kohaku Bluff (Bàn Hổ Phách)

Ngày: 2026-11-12. Thiết kế gốc: [spec](../superpowers/specs/2026-11-12-kohaku-bluff-design.md).

Trò chơi bài lừa bịp 2–4 người thật tại bàn tròn tầng 1 tòa Kohaku. Server quyết định mọi thứ. Đây không phải bản dựng lại Liar's Bar: không dùng tên, nhân vật hay hình ảnh của game đó.

## Luật tóm tắt

- Bộ bài 20 lá: 6 K, 6 Q, 6 A, 2 Joker (Joker luôn tính là thật). Mỗi người 5 lá, chỉ mình thấy.
- Mỗi vòng Shinku rút lá chuẩn K, Q hoặc A. Đến lượt, người chơi úp 1–3 lá và luôn tuyên bố "toàn là lá chuẩn".
- Người còn sống kế tiếp (còn bài) chọn **Tin** (đến lượt họ úp) hoặc **NÓI DỐI!** (lật lần úp gần nhất).
- Lật ra có lá sai (không phải lá chuẩn, không phải Joker): người úp bóp cò. Ngược lại: người hô bóp cò.
- Mỗi người có súng riêng 6 ngăn, đạn đặt ngẫu nhiên một lần mỗi ván và giữ qua các vòng. Lần bóp thứ 6 chắc chắn nổ. "Cạch" là sống, "Đoàng" là bị loại (gục rồi rời ghế). Sau mỗi lần bóp cò: chia lại bài, rút lá chuẩn mới.
- Hết bài thì bị bỏ qua lượt. Nếu không còn ai khác để quyết định thì lần úp tự động bị lật (nói thật: không ai bóp cò, chia vòng mới).
- Giờ lượt 30 giây: hết giờ server tự úp 1 lá ngẫu nhiên. Đứng dậy hoặc mất kết nối giữa ván tính là bị loại. Còn 1 người thì người đó thắng.
- Ở lobby, khi có ít nhất 2 người ngồi và 1 người sẵn sàng thì đếm ngược 20 giây; người chưa sẵn sàng bị mời đứng dậy. Tất cả sẵn sàng thì bắt đầu ngay. Trong ván ghế trống bị khóa.

## Cách chơi

1. Vào phố, đi tới cổng Kohaku (vòng sáng phía tây-bắc) và chuyển phòng.
2. Đến gần bàn tròn nỉ xanh, nhấn Enter ở một trong 4 ghế `kohaku-player-1..4` để ngồi.
3. Bấm **Sẵn sàng**. Khi đủ người ván bắt đầu và bài hiện ở dưới màn hình.
4. Chọn 1–3 lá, bấm **Úp bài**. Khi tới lượt quyết định thì chọn úp tiếp hoặc **NÓI DỐI!**.
5. Cảnh bóp cò: camera mọi người trong phòng chuyển cận cảnh người bóp cò. Người đứng xem thấy mọi thứ công khai trừ bài trên tay.

## Kiến trúc (file chính)

- `packages/game-protocol/src/kohaku-bluff.ts`: kiểu dữ liệu, hằng số luật/thời gian, tên message, `normalizeBluffPlay`.
- `apps/world-server/src/systems/kohakuBluff.ts`: engine luật thuần (RNG và đồng hồ truyền vào), không import `@colyseus/*`.
- `apps/world-server/src/systems/syncBluffSchema.ts` và `apps/world-server/src/rooms/kohaku.room.ts`: đẩy trạng thái công khai vào Schema `state.bluff`, gửi `bluff-hand` riêng từng client, khóa ghế giữa ván, xử lý rời bàn/mất kết nối.
- Web: `game/systems/kohakuBluffView.ts`, `useBluffEffects.ts`, `bluffPose.ts` (tư thế chĩa súng/gục bằng điều khiển xương trong code, không sửa GLB), `bluffSfx.ts`, `game/entities/KohakuBluffTable.tsx`, `game/ui/KohakuBluffHud.tsx`, hàm gửi message trong `useCityConnection.ts`.
- Bí mật: bài trên tay và vị trí đạn chỉ nằm trong bộ nhớ server; `shotResult` rỗng trong pha `shooting`; `revealed` chỉ có từ pha `reveal`.

## Đã kiểm chứng (2026-11-12, môi trường local đang chạy `npm run dev`)

| Lệnh | Kết quả |
| --- | --- |
| `corepack.cmd pnpm test` | 6/6 task thành công. game-protocol 13, world-server 39, web 80, api 2 test, 0 fail |
| `corepack.cmd pnpm typecheck` | 6/6 task thành công |
| `node --test test/kohaku-bluff.e2e.cjs` (web) | PASS, khoảng 22 giây |

E2E `apps/web/test/kohaku-bluff.e2e.cjs` (3 guest thật qua API + Colyseus) xác nhận:

1. Hai client đi tới cổng Kohaku, chuyển phòng, ngồi ghế 1 và 2, cùng `bluff-ready`.
2. Mỗi client nhận `bluff-hand` đúng 5 lá, hai tay bài không trùng id, không id lá nào xuất hiện trong state mà client thấy; `phase === 'turn'`.
3. Người đến lượt úp 1 lá, người kia `bluff-liar`: các pha đi theo thứ tự `reveal`, `shooting` (`shotResult === ''`), `result`.
4. Client thứ ba vào phòng giữa ván thấy đúng pha và lá chuẩn, ngồi `kohaku-player-3` thì nhận `interaction-error` và không ngồi được.
5. Dọn dẹp: rời mọi room cuối test.

Lưu ý: `pnpm --filter @metaverse/web test:e2e` đã thêm file e2e mới. Trong lần chạy đó `club.e2e.cjs` fail ở dòng 105 (vị trí x khi quay về phố khác 4.2). Nguyên nhân nằm ở thay đổi logic cổng/phố chưa commit từ trước, không thuộc Kohaku Bluff; `multiplayer.e2e.cjs` và `kohaku-bluff.e2e.cjs` PASS.

## Cập nhật 2026-11-12: tay cầm súng, gục, máu, luật ở quầy bar

- **Tay cầm súng** (`game/systems/bluffPose.ts`): trước đây súng dài 0.39 m tính từ cổ tay trong khi tay các mẫu anime chỉ với 0.37–0.52 m, nên tay duỗi thẳng ra ngang, cổ tay gập ~150° và báng súng lơ lửng trên bàn tay (bàn tay nằm ngang, ngón duỗi). Sửa: súng cỡ `BLUFF_GUN_SCALE` 0.72 (mẫu tay ngắn như yui tự thu nhỏ theo tầm với), bàn tay xoay theo đủ hai trục để ngón trỏ ở trên, ngón út ở dưới báng, các ngón cuộn ôm báng, cổ tay đặt sau gáy báng. Cổ tay còn gập 94–111° trên 9 mẫu. Súng trên bàn dùng cùng tỉ lệ.
- **Gục**: hệ số gập lưng/cổ được dò theo từng rig để gốc sọ hạ xuống `SLUMP_HEAD_HEIGHT` 1.1 m (má áp lên thành bàn), đầu nghiêng sang một bên.
- **Máu** (`game/entities/BluffBloodEffect.tsx`): chỉ trong pha `result` của lần "đoàng": 40 giọt văng ra thái dương bên trái, vết máu trên thành bàn dưới đầu, rồi vũng máu lan xuống mặt nỉ trong ~3 giây. Bàn sạch khi chia vòng mới.
- **Luật ở quầy bar**: nói chuyện với Bartender Caca (F), chọn tab "Luật: Bàn Hổ Phách". Nội dung ở `game/ui/kohakuGameRules.ts`, số liệu lấy từ hằng số luật trong game-protocol; trò mới chỉ cần thêm một mục.
- Kiểm chứng: typecheck web đạt, `pnpm --filter @metaverse/web test` 91/91 pass (có test mới: ngón trỏ trên ngón út, ngón giữa cuộn quanh báng, cổ tay bẻ < 125°, đầu gục < 1.16 m, luật khớp hằng số). Chưa xem lại trên trình duyệt.

## Chưa kiểm chứng

- Kiểm trên Chrome (2026-11-12, Bocchi ở ghế 1 + bot Node ở ghế 2, 5 lần bóp cò đều "cạch"):
  - Đạt: vào Kohaku, ngồi ghế, Sẵn sàng, đếm ngược 20 giây đẩy người chưa sẵn sàng đứng dậy, HUD (lá chuẩn, lượt, đồng hồ, số lá, x/6), chọn và úp bài, NÓI DỐI!, tự úp khi hết 30 giây, lá lật ngửa trên bàn, súng trên bàn ẩn khi bóp cò, camera chuyển cận cảnh người bóp cò cho cả phòng.
  - Lỗi thấy được: khung "F · Trò chuyện với Shinku" đè lên nút "Úp bài"/"NÓI DỐI!"; trong pha kết quả "cạch" không thấy tay chĩa súng và không thấy súng trên tay; khung cận cảnh người ở ghế 2 bị cắt mất đầu.
  - Chưa xem được: cảnh "đoàng" (gục, chớp sáng, màn tối), kết thúc ván, âm thanh (trình duyệt tự động không nghe được), các mẫu nhân vật khác ngoài Bocchi và Kita.
- Chưa chạy ván nhiều người (3–4) và các tình huống rời bàn giữa pha shooting trên server thật; các trường hợp này chỉ được phủ bằng unit test engine.
- Âm thanh/asset: chưa rà lại giấy phép sau cùng.
