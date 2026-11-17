# Mưa chân thật và chu kỳ ngày/đêm (phố Sakura)

## Đồng hồ thế giới chung

`apps/web/game/systems/worldClock.ts` tính toàn bộ trạng thái môi trường **thuần từ giờ thật** (`Date.now()`). Mọi máy chơi cùng lúc đều thấy cùng thời tiết và cùng giờ trong ngày mà server không phải gửi gì. Trước đây mỗi máy đếm từ lúc tự mở trang nên hai người có thể thấy thời tiết khác nhau.

| Hằng số | Giá trị | Ý nghĩa |
| --- | --- | --- |
| `DAY_NIGHT_CYCLE_MS` / `DAYTIME_MS` | 60 / 30 phút | 30 phút ngày, rồi 30 phút đêm (ngày ở phút :00–:30 mỗi giờ UTC) |
| `TWILIGHT_MS` | 3 phút | Bình minh/hoàng hôn chuyển tiếp êm |
| `RAIN_PERIOD_MS` / `RAIN_DURATION_MS` | 60 / 10 phút | Mỗi giờ đúng một trận mưa 10 phút |
| `RAIN_RAMP_MS` | 60 giây | Mưa nặng hạt dần / ngớt dần |
| `WET_UP_MS` / `DRY_DOWN_MS` | 90 giây / 5 phút | Đường ướt đẫm sau 90 giây mưa, khô hẳn 5 phút sau khi tạnh |

Phút bắt đầu trận mưa của mỗi giờ lấy từ một hàm hash ổn định theo số thứ tự giờ, nằm trong khoảng 0–50. Nhờ vậy trận mưa luôn gọn trong giờ đó và **lệch pha** với ngày/đêm: có giờ mưa ban ngày, có giờ mưa ban đêm. Ngoài trận mưa, trời khô hẳn (không còn mưa bụi thường trực như trước).

## Thành phần

- `RainWeatherSystem.tsx`: các vệt mưa dài khoảng 32 cm rơi ~9–12 m/s, nghiêng theo gió. Số hạt vẽ và cập nhật tỉ lệ với cường độ mưa (`InstancedMesh.count`). Có tiếng mưa tổng hợp (`rainAudio.ts`, nhiễu lọc hai lớp, không dùng file). Tiếng mưa chỉ bật sau lần bấm phím/chuột đầu tiên, vì trình duyệt chặn tự phát âm thanh.
- `WetAsphaltRoadDetails.tsx`: vũng nước được tách khỏi texture mặt đường thành lớp riêng. Khi khô, `alphaTest` tăng dần nên vũng co từ rìa vào tâm rồi biến mất. Nhựa đường ướt thì tối và bóng, khô thì sáng và nhám. Nước chảy thành vệt cuộn dọc hai rãnh lề đường. Có tóe nước khắp mặt đường và gợn sóng tròn trong vũng nước.
- `RainRippleField.tsx`: một InstancedMesh vòng tròn dùng chung cho tóe nước và gợn sóng. Vòng mờ dần bằng màu instance với blending cộng. Khi trời tạnh và không còn vòng nào thì bỏ qua cập nhật.
- `DayNightSystem.tsx`: nơi **duy nhất** điều khiển nền trời, sương mù, ambient/hemisphere, đèn định hướng (mặt trời ban ngày, ánh trăng ban đêm), đĩa mặt trời, vòm trời gradient, ráng chiều và sao. Khi mưa, trời chuyển sang bảng màu u ám và sương dày hơn.
- Đèn đường, đèn rọi và lồng đèn (`StreetAssets.tsx`) tắt ban ngày, bật lúc chạng vạng; khi mưa tối trời ban ngày thì bật bớt (`streetLightLevel`). Biển hiệu neon và phản quang (`neonLevel`) vẫn sáng khoảng 35% ban ngày.
- Trăng và vòm trời đêm (`BloodMoonSky.tsx`) mờ dần khi trời sáng. Mặt biển (`SakuraIslandEnv.tsx`) đổi sang xanh ban ngày. Khi ẩn chỉ ẩn mesh, không ẩn đèn, để tránh biên dịch lại shader toàn cảnh lúc chuyển ngày/đêm.

Phạm vi chỉ gồm phố Sakura ngoài trời. Club, Lounge, Hotel, Kohaku và Gekka giữ nguyên ánh sáng.

## Kiểm thử

- `apps/web/test/world-clock.spec.ts`: ngày/đêm 30+30 phút liên tục không nhảy cóc; mỗi giờ đúng 10 phút mưa nằm gọn trong giờ; có cả mưa ngày lẫn mưa đêm; độ ướt tăng/khô đúng thời gian, kể cả qua ranh giới giờ; cùng thời điểm cho cùng kết quả; mức đèn ngày/đêm.
- `apps/web/test/weather-system.spec.ts`: nhịp chập chờn đèn và biển hiệu.

## Ghi chú tinh chỉnh

- Màu và cường độ của bảng `NIGHT`, `DAY`, `NIGHT_RAIN`, `DAY_RAIN` nằm ở đầu `DayNightSystem.tsx`. Thành phố vốn được thiết kế cho ban đêm nên ban ngày có thể cần chỉnh thêm sau khi xem trực tiếp.
- Đồng hồ dựa vào giờ hệ thống của từng máy. Máy có đồng bộ giờ (NTP, mặc định trên Windows) sẽ lệch nhau không quá vài giây.
- Muốn xem nhanh một trạng thái khi chỉnh, tạm sửa hằng số chu kỳ trong `worldClock.ts`, ví dụ đặt `DAY_NIGHT_CYCLE_MS` thành 2 phút.
