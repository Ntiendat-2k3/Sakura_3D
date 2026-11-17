# Làm lại khu phố Sakura: anh đào, cột điện, cổng, đèn đá

## Thay đổi
- **Lớp trang trí mới** `apps/web/public/assets/props/street-decor.glb` (1.8 MB, 23 mesh, gộp theo vật liệu), dựng bằng `blender -b -P scripts/build-street-decor.py` từ bố cục `packages/game-protocol/src/street-decor.json`. Gồm:
  - 40 cây anh đào: hai quảng trường đầu phố và hai công viên có thảm cỏ, lối sỏi sau dãy nhà;
  - 8 đèn đá kasuga tōrō;
  - 6 cột điện bê tông kiểu Nhật: 2 xà, sứ cách điện, biến áp, dây võng nối cột, dây vượt đường, dây nhánh vào nhà;
  - cổng thương phố phía bắc: trụ sơn son, mái cong, bảng hiệu sáng, lồng đèn;
  - chậu tre, ghế gỗ, xe đạp, cánh hoa rụng trên vỉa hè.
- **Bỏ khỏi `placements.json` và `build-sakura-street.py`:** cột điện Kenney (xà rộng 7.5 m tạo vòm đen thô), ống dây điện và cây sồi. File GLB gốc vẫn giữ nguyên.
- **`StreetAssets.tsx`:** tải lớp trang trí. Vật liệu tên chứa "decor glow" (đèn đá, lồng đèn cổng) sáng theo ngày/đêm như lồng đèn giấy, bảng hiệu cổng dịu theo neon. Thêm chữ "SAKURA DORI" hai mặt bảng hiệu.
- **`systems/SakuraPetals.tsx`:** 260 cánh hoa rơi theo gió, một InstancedMesh.
- **Collider:** `STREET_PROP_COLLIDERS` (game-protocol) suy ra từ cùng JSON cho thân cây, đèn đá, chậu, ghế, xe đạp, cột điện và trụ cổng. `isWalkable` dùng chung cho server và client.

## Kiểm chứng
- Test mới:
  - mọi đồ trang trí có collider;
  - giữa cổng bắc và cổng torii đi qua được;
  - trước cửa 5 tòa có portal và lối tới cửa thông;
  - lòng đường thông suốt z -23..23;
  - cánh hoa không thủng đất hay trôi khỏi vùng;
  - GLB có trong danh sách tải trước.
- Toàn bộ test: game-protocol 37/37, world-server 102/102, web 183/183. Typecheck web và world-server sạch. Khronos glTF Validator báo 0 lỗi, 0 cảnh báo cho `street-decor.glb`.
- Ảnh trước/sau (render Blender, ánh sáng ban ngày, không có đèn/torii/mưa runtime) nằm trong `test-results/screenshots/street-restyle/`.
- **Chưa kiểm**: xem trong trình duyệt (đêm, mưa, bloom) và FPS thực tế.

## Ghế đá, hôn và đấm ngoài phố
- **Ghế đá:** 6 ghế (12 chỗ ngồi) dọc lối sỏi hai công viên, nằm trong `street-decor.json` mục `stoneBenches`. Mặt ngồi cao 0.74 m để khớp tư thế Sit. `STREET_SEATS` dùng chung cho `getZoneSeats('street')` và `nearestZoneSeat`, ngồi bằng Enter như các zone khác.
- **Hôn (K):** chỉ khi đang ngồi và người ngồi cạnh trên cùng ghế cũng đang ngồi. Không cần người kia đồng ý (theo lựa chọn của chủ dự án). Server có giới hạn tần suất 5 s và không chồng cú hôn. Client chồng thân trên của `Kiss_player` lên tư thế ngồi. Chân và hông giữ hướng ngồi, chỉ cột sống xoắn 65% góc tới bạn và nghiêng ngang 0.42 rad, hông nhích 0.14 m. Bản đầu xoay cả người nên đùi hai người đâm xuyên nhau (gối chỉ cách 0.02 m). Đo trên 3 cặp nhân vật: tâm hai đầu cách 0.17–0.22 m, đùi/gối cách tối thiểu 0.29 m, có test hồi quy giữ ngưỡng này.
- **Đấm (Q):** server tự chọn người đứng gần nhất trong 1.5 m (bỏ qua người đang ngồi), quay người đấm về phía mục tiêu, sau 0.5 s đẩy mục tiêu lùi 0.55 m và dừng trước vật cản. Không cần đồng ý, chỉ có hiệu ứng, không có máu. Client phát `Cross Punch` (nắm tay duỗi thẳng đúng lúc trúng) và `Reaction Hit`.
- **Code:**
  - `packages/game-protocol/src/street-social.ts` (luật thuần dùng chung);
  - `apps/world-server/src/systems/streetSocial.ts` (chỉ đăng ký ở phòng phố);
  - `apps/web/game/systems/{playerActionMotion,streetSocialCues}.ts`;
  - `apps/web/game/ui/StreetSocialPrompt.tsx`.
- **Kiểm chứng:** game-protocol 40/40, world-server 105/105, web 187/187. Typecheck sạch, `street-decor.glb` 0 lỗi validator.
- **Chưa kiểm:** chơi thử nhiều người trong trình duyệt.
- **Rủi ro:** hôn và đấm không cần đồng ý, và chưa có chặn hay tắt tương tác với từng người. Người bị làm phiền chỉ có cách đứng dậy hoặc đi chỗ khác.
