# Sakura_3D

**🌸 Neon Sakura City — Architecture v2**

**Free local development starter** for an anime-style multiplayer 3D social world.
This is the **architecture-hardened playable foundation**, not a complete commercial metaverse.

## Working features (source included)

- Monorepo: pnpm + Turborepo; Next.js 15 / React 19 / R3F / Three.js.
- Khu phố dùng model GLB Kenney CC0, vật liệu atlas, biển Nhật, đèn lồng, camera theo nhân vật và bloom tùy chọn. Xem [báo cáo hình ảnh](docs/reports/VISUAL_UPGRADE_REPORT.md) và [nguồn/giấy phép asset](assets/manifests/ASSET_MANIFEST.json).
- Colyseus 0.16 room (up to 24 clients), synchronized player positions, WS-based room chat.
- Denmu Night Club bản test: đến vòng sáng cửa DENMU, nhấn E để vào phòng club riêng (tối đa 12 người), xem WINE/POP nhảy mocap, điều khiển show/đèn và ra phố qua EXIT. Xem [hướng dẫn test club](docs/reports/CLUB_TEST_REPORT.md). Model nhân vật do người dùng cung cấp chỉ được xác nhận cho test local, quyền phân phối còn chờ giấy phép đầy đủ.
- Kéo chuột trái/phải để xoay camera 360°, cuộn để zoom; WASD theo hướng nhìn. Đến gần sofa trong club và nhấn Enter để ngồi/đứng. Xem [báo cáo camera và ghế](docs/reports/CAMERA_SEATING_REPORT.md).
- Màn chọn có **11 lựa chọn**: Bocchi, Kita, Ryo, Übel, Miorine, Nijika, Serie, Yui và ba **bản dựng lại Airi/Annie/Kuroki**. Tám mẫu đầu được nhập từ nguồn người dùng cung cấp; ba mẫu cuối dựng gần giống theo ảnh trên rig Yui, được ghi rõ “bản dựng” trong game. Chọn mẫu rồi bấm **Vào game** để tạo guest local tự động, không cần tài khoản/mật khẩu; nút **Đổi nhân vật** quay lại màn chọn. Lựa chọn được nhớ trên trình duyệt và đồng bộ cho người khác, giữ khi đổi phòng.
- Các mẫu có đứng, đi/chạy, ngồi, nhảy và chớp mắt tạo bằng Blender. Trong club giữ **N + 1** để nhảy thường; **N + 2** để cầm guitar/bass với Bocchi, Kita hoặc Ryo. Nhấn lại tổ hợp đang chọn, WASD hoặc ngồi để dừng. Xem [báo cáo nhân vật người chơi](docs/reports/PLAYER_CHARACTER_REPORT.md).
- Club, NPC, người chơi, texture và toàn bộ MP3 được chuẩn bị ngay khi mở World; đợi màn chuẩn bị ban đầu hoàn tất rồi mới di chuyển/vào club. Cache và buffer nhạc được giữ qua các lần đổi phòng, không dồn tải model/nhạc vào lúc bước qua cửa.
- Server-authoritative movement, bounded coordinates, simple building collision, input validation, chat throttling.
- NestJS 10, Sequelize v6, PostgreSQL 17; dedicated database package and Umzug migrations.
- Clean Architecture example modules: zones + dev-only guest authentication (domain ports, application use cases, infrastructure adapters, presentation controllers).
- Guest token signed by API using JOSE, verified by World Server (2-hour session; memory-only browser token).
- No paid services required; Postgres is local Docker; Redis *optional*, not needed yet.
- Unit tests for protocol normalization, walkability, zones use case and guest session use case.

## Not implemented / must be done before public release

- Real signup/login, persistent auth sessions, age assurance, privacy policy, verification, user bans.
- Nội thất các địa điểm khác, roster NPC đầy đủ, collision/physics nâng cao, navmesh. Đã có chọn mẫu người chơi; chưa có thay đồ/chỉnh ngoại hình hoặc lưu avatar theo tài khoản.
- Friend system, saved chats, moderation queue, safe voice chat, VIP, inventories, payments.
- Payment security, user-generated content review, production rate limiting and persistent audit logs.
- Horizontal Colyseus scaling (needs Redis presence/driver and load tests), deployment and load testing.

**For local demonstration only.** Demo guest signup is **disabled** when `NODE_ENV=production`.
Do not expose to the public Internet or use it as an adult-content service without legal, safety, privacy and age-control work.

## Requirements (Windows 10/11)

- Node.js 22 LTS (or >=20.19), pnpm 9, Git, Docker Desktop with Linux containers.
- Local ports 3000, 4000, 2567 and 5434 available.
- PowerShell 5.1+ and Git. All local tools are free; Docker Desktop's licensing may differ for larger commercial organizations.

## Install & run (PowerShell)

Open the source directory in VS Code, then run:

```powershell
npm run dev
```

Lệnh này tự bật container PostgreSQL và đợi database healthy (tối đa 90 giây), build các package dùng chung, rồi khởi động Web, API và World Server. Cần mở Docker Desktop trước khi chạy; nếu bước bật database thất bại, các server sẽ không được khởi động. Nhấn Ctrl+C để dừng các server; PostgreSQL tiếp tục chạy nền.

It works from the root in an existing PowerShell or VS Code terminal: the root scripts use Corepack and prepend the project pnpm shim only for the dev process. Dependencies still use pnpm. Stop any separately started app dev processes first; each port can have only one server.

For first-time setup, run these commands before `npm run dev`:

```powershell
.\scripts\Init-Local.ps1
pnpm install --frozen-lockfile
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm test
```

Outside VS Code, prepend `scripts\bin` to that terminal's PATH before using bare `pnpm`; the machine's older nvm shim points to a missing Node version. If Corepack is absent, install pnpm 9 with `npm install -g pnpm@9.15.4`. `Init-Local.ps1` creates random local JWT and database passwords only when `.env` does not exist.
Port 5433 is used by an existing Windows PostgreSQL service on this machine, so this project uses 5434. If 5434 becomes unavailable, change both `docker-compose.yml` port and `DATABASE_URL` in `.env`.

Open:

- Web: http://localhost:3000 hoặc http://127.0.0.1:3000 (đều hỗ trợ khi chạy development).
- API health: http://localhost:4000/api/v1/health
- API zones: http://localhost:4000/api/v1/zones
- World server: ws://localhost:2567 (Colyseus matchmaking + WebSocket, not an ordinary web page)

Open two browser tabs on the Web URL. Each tab gets a separate dev-only guest identity and joins the same Colyseus room. Move using WASD/arrow keys. See the other avatar move and send chat messages to the room.

With `pnpm dev` running, use another PowerShell terminal to repeat the API and multiplayer integration check:

```powershell
$env:PATH = "$env:APPDATA\npm;$env:PATH"
corepack.cmd pnpm test:e2e
```

This test creates two demo guest users. It checks API/database health, token rejection, two-client room synchronization, movement, chat, invalid movement input, and disconnect cleanup. Browser rendering still needs the Playwright visual check.

**Important:** The browser needs the API and World Server running; if 3D loads but says `OFFLINE`, check the API and World Server terminals before changing frontend code.

## Database

- `pnpm db:migrate`: apply migration with Umzug.
- `pnpm db:seed`: idempotent demo zones.
- `pnpm db:status`: pending migrations.
- `pnpm db:undo`: undo last migration (development only).
- No `sequelize.sync({ alter: true })` in application runtime. Use migrations.
- `packages/database/src/models` contains Sequelize model classes; these never leak into Domain or Application layers.

## Project structure

```text
apps/
  web/app                      Next.js route
  web/components               World screen composition
  web/game/{scenes,entities,systems,networking,ui}
  api/src/database             Sequelize connection provider
  api/src/modules/auth         Guest domain, use case, adapters, controller
  api/src/modules/zones        Zone domain, use case, adapter, controller
  world-server/src/{rooms,state,simulation,security}
packages/
  database/src/{models,migrations}   Sequelize + Umzug
  game-protocol/src                 Shared wire messages + movement rules
assets/
  source/                          Model, texture, animation và giấy phép nguồn
  processed/                       File Blender và dữ liệu trung gian của pipeline
  manifests/                       Manifest tổng hợp nguồn và giấy phép asset
docs/
  reports/                         Báo cáo kỹ thuật và kết quả các đợt nâng cấp
  KE_HOACH_HOAN_THIEN.md            Kế hoạch hoàn thiện
  RELEASE_NOTES.md                  Ghi chú phát hành
scripts/                           Công cụ setup, xử lý asset và kiểm tra
test-results/
  logs/                            Log build, unit và integration test
  screenshots/                     Ảnh kiểm tra đã lưu
  *.json                           Kết quả kiểm tra có cấu trúc
AGENTS.md                           Project instructions for Codex
```

Tra cứu tài liệu và quy ước lưu file tại [docs/README.md](docs/README.md). Sau khi xác nhận nội dung giải nén đầy đủ và trùng khớp, xóa file nén tải về; giữ model nguồn, giấy phép và file cần để dựng lại asset.

## Principles

- Domain and Application cannot import ORM, NestJS or Colyseus.
- Dependency inversion: application depends on ports; infrastructure implements them.
- All persistent writes go via NestJS API + repositories. Network movement remains in server memory.
- Client sends **input** only. Server controls positions/collision and broadcasts state snapshots.
- Demo JWT secret is shared only between API and World Server via server env; never NEXT_PUBLIC_ the secret.
- A browser displays status if login, API or multiplayer is unavailable; no offline fallback that pretends online.
- Single instance first. Redis is only needed for multi-process room discovery.

## Troubleshooting

- `pnpm db:migrate` fails: make sure `docker compose ps` reports healthy PostgreSQL and DATABASE_URL matches Docker credentials.
- `Cannot find module @metaverse/database`: run `pnpm --filter @metaverse/database build` (or `pnpm dev` which builds it first).
- `WORLD` connection fails: confirm `.env` exists and API + World Server use the **same** `DEMO_JWT_SECRET`.
- `ECONNREFUSED` on 5434: check Docker Desktop and other PostgreSQL instances.
- Headless Playwright may not render WebGL on all Windows/CI systems; test on a real GPU/browser too.
- `pnpm test`: unit tests do not prove browser/WebSocket/database integration; run the manual two-tab scenario as well.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/QA-CHECKLIST.md`](docs/QA-CHECKLIST.md), and [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Nâng cấp dance / lighting Denmu

Đã tích hợp đèn GLB CC0, bốn clip Rokoko mỗi NPC, crossfade theo beat và bảng điều khiển show. Xem [dance](docs/reports/CLUB_DANCE_REPORT.md), [lighting](docs/reports/CLUB_LIGHTING_REPORT.md), [nguồn và giấy phép](assets/manifests/CLUB_ASSET_MANIFEST.json). Mặc định Low, giảm nhấp nháy và bloom tắt; nhạc do bạn chọn và chỉ phát sau khi cho phép.

`music.mp3` đã được tích hợp làm nhạc chung: vào club, mở **DENMU · Điều khiển show** và bấm **Cho phép phát nhạc**, không cần chọn file lại. DJ dùng **Đồng bộ theo bài nhạc** để bắt đầu lại theo BPM/cue ước lượng. Có đốm/vòng disco xoay liên tục theo ảnh tham khảo; bản mới chưa kiểm thử browser khi chưa được người dùng cho phép. Xem [báo cáo nhạc/projection](docs/reports/CLUB_MUSIC_PROJECTION_REPORT.md).
