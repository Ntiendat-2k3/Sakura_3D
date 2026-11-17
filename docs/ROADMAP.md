# Roadmap — features by dependency order

The final product vision is a social 3D anime nightlife world, NOT real-world adult service matchmaking.

## Delivered in this archive — Architecture v2

- [x] Monorepo, separated apps and shared pure protocol package
- [x] Basic procedural anime world, split renderer/camera/avatar/input/network
- [x] Colyseus room with server-authoritative movement, validation and chat
- [x] Basic JWT demo guest onboarding on PostgreSQL
- [x] Clean Architecture module example for auth and zone listing
- [x] Sequelize models, SQL migration framework, demo seed
- [x] Unit tests for isolated logic

## Milestone A — before public beta

- [ ] Account registration, identity verification where required, age assurance, ban/mute systems
- [ ] Persistent inventory and immutable wallet ledger with row locks + idempotency keys
- [ ] API input DTO validation, CSRF/token strategy, global rate limit, security headers
- [ ] Chat moderation and report center, role-based admin audit log
- [ ] e2e tests (API, Postgres, 2-player sync), automated WebGL smoke screenshots

Progress: `pnpm test:e2e` now checks API/database health and two-client Colyseus behavior. Automated WebGL screenshots and direct database assertions remain open.

## Milestone B — full game features

- [x] Ngoại cảnh GLB CC0, atlas vật liệu/biển hiệu, instancing đạo cụ và collider dùng chung đã kiểm tra.
- [x] Chọn 11 mẫu trước khi vào game qua guest local tự động: 8 mẫu nhập từ nguồn và ba bản dựng trên rig Yui. GLB có đứng/đi/chạy/ngồi/nhảy/chớp mắt, lựa chọn và kiểu nhảy được server kiểm tra và đồng bộ.
- [x] Bầu trời Trăng Máu (Blood Moon) Anime Cyberpunk, chu kỳ thời tiết 5 phút mưa / 5 phút tạnh, hiệu ứng sương mù u ám và đèn đường cao áp nhấp nháy chập chờn khi mưa.
- [x] Màn hình Loading game sau đăng nhập bypass: hình nền tùy biến (`loading-bg.jpg`) và thanh loading thời gian thực nạp 100% tài nguyên đồ họa (đường phố, 11 avatars, 3 không gian nội thất, 7 NPCs, GPU Texture Warmup) trước khi vào game.
- [x] Không gian nội thất đa địa điểm: Denmu Night Club (DJ Rio, sân khấu ánh sáng, order nhạc), Reika Hostess Lounge (3 Hostess Yuzu/Bunny/Zankou, chức năng "Đi với anh nhé", order nhạc), Cyber Love Hotel tầng 2 (thang bộ dốc, giường tròn King-size, bồn tắm sục Jacuzzi, 4 mood màu).
- [x] Không gian Câu Lạc Bộ Thượng Lưu 琥珀 (Kohaku Private Members Club) Tầng 1: Quy hoạch 3 tầng với cầu thang đá cẩm thạch đen nẹp đồng nẹp LED dẫn lên Tầng 2 & 3, bàn tròn Poker / Casino bọc nỉ xanh ngọc bích viền da cognac ở trung tâm cho 4 người chơi + slot NPC Dealer (chia bài), quầy Whisky & Cigar Reserve cổ điển, sofa da Chesterfield, bàn cờ vua và vách lò sưởi gia huy Kohaku.
- [x] Cửa ra vào chân thực và cơ chế bước qua ngưỡng cửa tự động chuyển phòng liền mạch, xóa bỏ hoàn toàn vòng tròn sàn và chữ chỉ dẫn lơ lửng.
- [ ] Physics/navmesh nâng cao, proximity chat, private VIP rooms with permission checks
- [ ] Friends and messages, notifications, events calendar
- [ ] Voice chat (opt-in microphone) with consent, mute and abuse reporting
- [ ] Shop, non-redeemable demo coins, cosmetics, VIP memberships (without payment for local demo)
- [ ] Admin panel, events, moderation and observability

## Milestone C — scalable online deployment

- [ ] Multiple room instances per zone, matchmaking groups, party travel
- [ ] Redis driver/presence for multi-process Colyseus
- [ ] CDN-backed GLBs, GLTF compression, texture compression, LOD
- [ ] Database connection sizing, backups, load benchmarks, observability
- [ ] Production security/privacy/legal review for each intended jurisdiction
