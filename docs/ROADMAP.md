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

- [x] Ngoại cảnh GLB CC0, atlas vật liệu/biển hiệu, instancing đạo cụ và collider dùng chung đã kiểm tra; art direction anime cao cấp vẫn chưa hoàn tất. Xem `docs/reports/VISUAL_UPGRADE_REPORT.md`.
- [x] Chọn 11 mẫu trước khi vào game qua guest local tự động: 8 mẫu nhập từ nguồn và ba bản dựng gần giống Airi/Annie/Kuroki trên rig Yui, ghi rõ bản dựng trong UI. GLB có đứng/đi/chạy/ngồi/nhảy/chớp mắt, lựa chọn và kiểu nhảy được server kiểm tra và đồng bộ. Mẫu Unity và bản dựng có ngân sách mesh/texture. Chưa có thay đồ/lưu ngoại hình theo tài khoản, chưa kiểm thử browser cho thay đổi này. Xem `docs/reports/PLAYER_CHARACTER_REPORT.md`.
- [ ] Physics/navmesh, asset loading and FPS/asset budgets
- [ ] Clubs, interiors, proximity chat, private rooms with permission checks

Tiến độ club: Denmu đã có nội thất GLB thử nghiệm, cửa E kiểm tra vị trí server, room Colyseus riêng, WINE/POP VRM nhảy theo epoch phòng và kiểm thử hai browser contexts. Các club khác, proximity chat, quyền VIP và hệ thống moderation chưa hoàn thiện. Xem `docs/reports/CLUB_TEST_REPORT.md`.
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
