# Giọng thoại Kohaku Bluff (VOICEVOX)

File phục vụ: `apps/web/public/assets/audio/kohaku-bluff/*.mp3` (30 câu), danh sách câu ở
`apps/web/game/systems/bluff-voice-lines.json`, tạo bằng `scripts/generate-bluff-voices.mjs` (`pnpm voices:bluff`).

- Engine: Docker image `voicevox/voicevox_engine:cpu-0.26.0` (engine báo `"0.26.0"`), chạy cục bộ, ngày tạo 2026-11-12.
- Đầu ra WAV của engine được ffmpeg đổi sang MP3 mono 96 kbps.

## Giọng và điều khoản (đọc ngày 2026-11-12)

| Vai | Giọng | Ghi nguồn bắt buộc | Điều khoản |
| --- | --- | --- | --- |
| Shinku (dealer) | 冥鳴ひまり · ノーマル | `VOICEVOX:冥鳴ひまり` | https://www.meimeihimari.com/terms-of-use |
| Câu cà khịa của người chơi | 四国めたん · ツンツン | `VOICEVOX:四国めたん` | https://zunko.jp/con_ongen_kiyaku.html |

Hai giọng đều cho dùng thương mại và phi thương mại miễn phí, với điều kiện phải ghi nguồn. Dòng ghi nguồn hiển thị trong game,
ở mục "Ghi nguồn giọng" của luật Bàn Hổ Phách (`apps/web/game/ui/kohakuGameRules.ts`).

**Phần cấm đã kiểm:**
- 冥鳴ひまり cấm:
  - Hành vi trái thuần phong mỹ tục.
  - Gây bất lợi hoặc thiệt hại cho bên thứ ba.
  - Hành vi gắn với một tư tưởng hoặc tổ chức cụ thể.
  - Điều mà chủ giọng thấy không phù hợp.
- Quy định chung của SSS (四国めたん) cấm:
  - Trái thuần phong mỹ tục.
  - Hoạt động chính trị hoặc tôn giáo, và việc chỉ trích hay ủng hộ cá nhân hoặc tổ chức cụ thể.
  - Dùng cho infoproduct (情報商材), tạo hoặc lan truyền thông tin giả.
  - Kinh doanh thuộc diện 風俗営業.
  - Dùng cho thế lực phản xã hội.
- Không điều khoản nào cấm dùng trong game. Các câu là lời trêu đùa hư cấu trong game, không nhắm tới cá nhân hay tổ chức có thật.

**Giọng đã loại:** 春日部つむぎ, được gợi ý trong spec. Trang điều khoản của giọng này (https://tsumugi-official.studio.site/rule) chỉ hiển thị bằng JavaScript nên không đọc được để xác minh. Theo quy tắc "không commit giấy phép chưa rõ", mình đã đổi sang 四国めたん.
