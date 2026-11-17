# Neon Sakura Architecture — Release Notes

## Release v2.3 — Blood Moon, Weather, Loading Screen & City Expansion

Date: 2026-11-09

### Tính năng mới và Nâng cấp
- **Bầu trời Trăng Máu (Blood Moon Sky):** Đĩa trăng máu kích thước lớn phong cách Anime Cyberpunk đặt giữa góc trời cuối đường Sakura, quầng hào quang phát sáng đa lớp và dải mây đêm trôi ngang.
- **Chu kỳ Thời tiết 5 phút mưa / 5 phút tạnh:** Hệ thống thời tiết chu kỳ 10 phút (300s mưa / 300s tạnh), sương mù u ám tối xám `#07060f`, hơn 2.200 hạt mưa GPU InstancedMesh rơi nghiêng theo gió.
- **Đèn đường & lồng đèn chập chờn khi mưa:** Đèn đường cao áp và đèn lồng đỏ tự động nhấp nháy, sụt áp rò điện (flickering & micro-dropouts) tạo bầu không khí ma mị, u ám dưới mưa.
- **Màn hình Loading tài nguyên đồ họa:** Giữ cơ chế bypass guest login; sau khi nhấn Vào game hiển thị màn hình loading với ảnh nền tùy biến (`/assets/ui/loading-bg.jpg`) và thanh tiến trình thời gian thực 0% -> 100% nạp toàn bộ kiến trúc, 11 nhân vật, nội thất và GPU Texture Warmup.
- **Tầng 2 Cyber Love Hotel:** Phòng nghỉ phong cách đèn đỏ sexy (giường tròn King-size, bồn tắm sục Jacuzzi, sofa đôi, minibar, 4 mood màu ánh sáng), thang bộ ngoài trời và trong nhà có chiếu nghỉ, biển hiệu 2F.
- **Cửa ra vào & Bước qua cửa tự động:** Cánh cửa mở ra vào chân thực, xóa toàn bộ vòng tròn dưới sàn và chữ chú thích lơ lửng, người chơi bước sát qua ngưỡng cửa tự động chuyển phòng liền mạch không cần bấm phím E.
- **Reika Hostess Lounge & Order Nhạc:** 3 Hostess NPC (Yuzu, Bunny, Zankou), chức năng "Đi với anh nhé" đào đi theo sau qua các phòng và nhảy cùng trong Club; playlist order nhạc Reika Lounge.
- **Dáng đi DJ Denmu:** Chuẩn hóa dáng đi Dwarf Walk từ common khi rời bàn mixer xuống gặp khách.

### Kiểm thử và Độ ổn định
- `@metaverse/web`: 64/64 unit tests passed.
- `@metaverse/world-server`: 13/13 unit tests passed.
- `@metaverse/game-protocol`: 8/8 unit tests passed.
- `turbo run typecheck`: 6/6 packages passed.

---

## Release v2.0 — Architecture v2

Date: 2026-11-04

## Fixed compared to previous starter

- Split monolithic World.tsx into Scene, Avatar, Input, Camera, Network and HUD modules.
- Implemented server-authoritative Colyseus room state with shared validated input types and basic collision.
- Implemented local guest onboarding with NestJS use case + repository port + Sequelize adapter and JWT issuer port.
- Implemented auth token verification before room join; room chat with throttling and no persistent storage.
- Aligned Docker credentials, DATABASE_URL and optional local Redis usage.
- Added unit tests, PowerShell .env generator, architecture docs, QA checklist, upgrade prompt.

## Verification evidence (artifact build environment)

- TypeScript source files parsed without syntax errors.
- Shared game-protocol compiled with global TypeScript 5.8.3; movement and collision assertions passed.
- JSON package manifests and ZIP archive were validated.
- **Not verified:** package installation, actual Next/NestJS/Colyseus builds, PostgreSQL migration, browser multiplayer, production load tests. Outbound npm registry access timed out and Docker is not installed in build environment.

## Support boundary

The deliverable is a refactored, functional-intent **development starter**, not a production-ready or fully implemented adult platform. Read README.md and docs/SECURITY-NOTES.md before any Internet deployment.
