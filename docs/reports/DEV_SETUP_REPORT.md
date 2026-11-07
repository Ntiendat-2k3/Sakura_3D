# Neon Sakura City — Dev setup report

Ngày kiểm tra: 2026-11-05 (Asia/Bangkok). Workspace: `F:\Code\Project\Mix\webGame3D`.

## Environment

| Thành phần | Trạng thái | Kết quả |
| --- | --- | --- |
| Node.js / npm | PASS | v24.21.0 / 11.12.1 |
| pnpm / Turborepo | PASS | pnpm 9.15.4 đúng `packageManager`; Turbo 2.11.10 |
| Git | PASS | 2.45.1.windows.1 |
| Docker / Compose | PASS | 29.8.2 / v5.6.0; Docker Desktop daemon hoạt động |
| PostgreSQL | PASS | 17.11, container `webgame3d-postgres-1` healthy, `127.0.0.1:5434`; volume hiện có được giữ nguyên |
| Bộ công nghệ | PASS | Next.js 15.5.29, React Three Fiber 9.8.2, Three.js 0.173.0, NestJS 10.4.22, Sequelize 6.37.8, sequelize-typescript 2.1.6, Colyseus 0.16.26 |

## Services

| Dịch vụ | Trạng thái | Bằng chứng |
| --- | --- | --- |
| Web | PASS | `http://localhost:3000` tải được; Canvas WebGL render phố, tòa nhà, đèn và avatar; HUD `ONLINE` |
| API | PASS | `http://localhost:4000/api/v1/health` trả `ok: true`, `database: connected`, `orm: sequelize`; `/api/v1/zones` trả 3 zone |
| World Server | PASS | Colyseus trên `127.0.0.1:2567`; matchmaking trả HTTP 200, hai client đồng bộ cùng room |
| Database | PASS | PostgreSQL healthy; migration đã áp dụng, `db:status` trả `[]`; seed có 3 zone; nhiều guest user được tạo trong các lượt thử browser |

Web, API và World Server đã chạy cùng lúc bằng `npm run dev` trong phiên kiểm thử; phiên này được dừng sau khi xác nhận để người dùng có thể tự chạy lệnh mà không trùng cổng. PostgreSQL chạy trong Docker. Các cổng 3000, 4000, 2567 và 5434 chỉ bind loopback. PostgreSQL Windows có sẵn đang dùng cổng 5433 và không bị dừng hoặc sửa.

## Tests

| Kiểm tra | Trạng thái | Kết quả |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | PASS | 508 package cài thành công theo lockfile; workspace packages liên kết và build được |
| `pnpm typecheck` | PASS | 6/6 Turbo tasks |
| `pnpm test` | PASS | 7/7 unit tests: protocol 2, world 3, API 2 |
| `pnpm test:e2e` | PASS | Bài kiểm tra có thể chạy lại: API/database health, từ chối token thiếu, hai guest cùng phòng, đồng bộ di chuyển hai chiều, chat hai chiều, bỏ qua input vị trí giả và xóa avatar khi ngắt kết nối |
| `pnpm build` | PASS | 5/5 Turbo tasks; Next.js compile, lint và static generation thành công |
| ESLint riêng | SKIPPED | Source chưa có script ESLint riêng; bước lint tích hợp trong `next build` đã đạt |
| Sequelize migration / seed | PASS | `db:migrate`, `db:seed` thành công; `db:status` không còn migration chờ; zones = 3 |
| Playwright MCP — cảnh 3D | PASS | Ảnh [final-online.png](../../test-results/screenshots/final-online.png) xác nhận Canvas, đường phố, tòa nhà, đèn, avatar và HUD; console của lần tải cuối có 0 error |
| Playwright MCP — hiệu năng | PASS | Trên Intel Iris Xe, viewport 1536×720: phép đo 3 giây ban đầu ~53 FPS, p95 frame 33,5 ms; sau tối ưu, giữ W ~60 FPS, p95 17,2 ms. Ảnh [trước](../../test-results/screenshots/perf-before.png) và [sau](../../test-results/screenshots/perf-no-shadows.png). Đây là phép đo ngắn trên máy hiện tại, không bảo đảm cùng FPS trên máy khác. |
| Playwright MCP — di chuyển / camera | PASS | Giữ phím W trên A và D trên B làm avatar đổi vị trí; camera của A theo vị trí mới trong ảnh [A sau W](../../test-results/screenshots/player-a-after-w.png) |
| Playwright MCP — multiplayer | PASS | Hai browser contexts độc lập có hai guest khác nhau, cùng room và cùng thấy 2 avatar; [B thấy A di chuyển](../../test-results/screenshots/player-b-sees-a-move.png), [A thấy B di chuyển](../../test-results/screenshots/player-a-sees-b-move.png); chat truyền hai chiều; đóng B thì A còn `1 người` và avatar B biến mất |
| Context7 MCP | PASS | Truy xuất tài liệu Colyseus để xác nhận thời điểm đồng bộ state sau `joinOrCreate` |
| WebSocket auth / input | PASS | Join room không có token bị từ chối; gói move có tọa độ lớn bất hợp lệ không đổi vị trí server |
| CORS / secrets | PASS | Origin không tin cậy không nhận `Access-Control-Allow-Origin`; `.env` được Git ignore; secret chỉ nằm trong env server, không có biến `NEXT_PUBLIC_` chứa secret |

## Changes

- `apps/web/game/networking/useCityConnection.ts`: đợi bản đồng bộ state đầu tiên của Colyseus trước khi đọc `players` và báo `ONLINE`; sửa crash `forEach` trên state chưa sẵn sàng và xóa số người chơi cũ khi mất kết nối.
- `apps/world-server/src/simulation/movement.ts` và `test/movement.spec.ts`: kiểm tra đích di chuyển chéo theo cả X/Z; thêm regression test cho góc tòa nhà.
- `apps/web/app/icon.svg`: thêm icon để tránh request favicon 404 trong lượt tải mới.
- `docker-compose.yml`, `.env.example`, `scripts/Init-Local.ps1`, `.env`: chuyển PostgreSQL của dự án từ cổng 5433 đang bị chiếm sang 5434; sinh mật khẩu database và JWT ngẫu nhiên, xoay mật khẩu role hiện có mà không xóa volume. `.env` không được đưa vào Git.
- `apps/api/src/main.ts`, `apps/world-server/src/main.ts`, `apps/web/package.json`: bind dịch vụ local vào `127.0.0.1`.
- `package.json`: bỏ cờ Turborepo `--parallel` đã deprecated; các tác vụ dev vẫn chạy song song qua `turbo.json`.
- `README.md`: cập nhật lệnh chạy PowerShell, cổng database và cách dùng pnpm trên máy này.
- `pnpm-lock.yaml` và các thư mục `node_modules`: được tạo/cập nhật bởi pnpm 9.15.4. Không tạo project mới, không thêm Prisma, không đổi MCP/Skills hoặc bật dịch vụ cloud.
- `test-results/screenshots/`: lưu ảnh bằng Playwright MCP.
- `apps/web/test/multiplayer.e2e.cjs`, `apps/web/package.json`, `package.json`: thêm bài kiểm tra e2e dùng `node:test` và `colyseus.js` đã có sẵn; chạy bằng `pnpm test:e2e` khi các server local đang bật.
- `apps/web/game/scenes/SakuraScene.tsx`, `apps/web/components/World.tsx`: bỏ 14 point light ở cột đường, tắt shadow map và giới hạn DPR của Canvas ở 1; giảm tải GPU khi di chuyển, đổi lại bóng động không còn và ảnh trên màn hình mật độ cao kém sắc nét hơn.
- `.vscode/settings.json`, `scripts/bin/pnpm.cmd`: ưu tiên Corepack pnpm trong terminal VS Code mới của workspace, tránh nvm shim lỗi và không thay đổi execution policy toàn máy.
- `.gitignore`, `.vscode/settings.json`, `.git/`: tạo Git repo riêng cho `webGame3D`, ẩn repo cha `F:\Code` trong VS Code của workspace và bỏ cache/secret khỏi Changes. Không xóa hoặc sửa các dự án khác; chưa tạo commit.

## Remaining Issues

| Mục | Trạng thái | Ghi chú |
| --- | --- | --- |
| Chức năng production | SKIPPED | Đây là bản demo local: guest login bị vô hiệu trong `NODE_ENV=production`; chưa có đăng ký thật, age assurance, moderation, rate limit production, hay kiểm thử tải. Không triển khai công khai khi chưa hoàn thiện. |
| Font nhãn 3D offline | SKIPPED | `@react-three/drei` tải font resolver từ jsDelivr; các request đã trả 200 trong lần thử. Muốn chạy hoàn toàn offline cần đóng gói font local. |
| WebGL smoke tự động | SKIPPED | Đã kiểm tra ảnh bằng Playwright MCP nhưng chưa có script screenshot tự chạy trong CI. |
| Rapier | SKIPPED | Bản Architecture v2 hiện dùng collider đơn giản do server kiểm tra; Rapier chưa được tích hợp. Không thêm dependency chưa dùng chỉ để đủ tên công nghệ. |
| pnpm shim từ nvm | PASS | `pnpm.exe` cũ trong PATH của máy không dùng được. `npm run dev` dùng Corepack ở `predev` và ưu tiên `scripts/bin/pnpm.cmd` trong riêng tiến trình Turbo; đã kiểm thử với PATH Windows mặc định. Không sửa PATH hay execution policy toàn máy. |
| Docker CLI trong sandbox | PASS | Một số lệnh chỉ đọc `C:\Users\ASUS\.docker\config.json` bị cảnh báo quyền trong sandbox; các thao tác Docker cần thiết đã chạy và PostgreSQL healthy. |
| Git riêng của dự án | PASS | `git status` tại `webGame3D` chỉ liệt kê file của Neon Sakura City. Repo mới chưa có commit, nên toàn bộ source vẫn hiện là untracked; không thay đổi cấu hình Git toàn máy. |

## Lệnh kiểm tra và chạy lại

Trong terminal VS Code **mới** tại workspace:

```powershell
docker compose up -d postgres
pnpm db:status
npm run dev
```

Ở terminal khác, kiểm tra `http://localhost:3000`, `http://localhost:4000/api/v1/health`, rồi mở hai cửa sổ browser để thử multiplayer. Khi đã dừng dev server, có thể chạy `pnpm typecheck`, `pnpm test` và `pnpm build`.

## S?a l?i Failed to fetch ? k?t n?i local

- PASS: ?? t?i hi?n request guest b? ERR_CONNECTION_REFUSED; API c?ng 4000 kh?ng ch?y d? watcher Nest c?n s?ng. Kh?i ??ng l?i ??ng c?y dev c?a workspace khi PostgreSQL healthy ?? ph?c h?i API.
- PASS: localhost:3000 k?t n?i ???c nh?ng 127.0.0.1:3000 b? CORS ch?n. S?a bootstrap API ?? cho ph?p hai origin loopback trong development, gi? origin ???c c?u h?nh trong production; kh?ng d?ng wildcard.
- PASS: Frontend t? th? l?i l?i m?ng khi API ?ang kh?i ??ng, t?i ?a 8 l?n trong development, c?ch 1.5 gi?y. Kh?ng retry l?i HTTP; h?y fetch/timer khi unmount. L?i cu?i ???c hi?n th? b?ng th?ng b?o API/PostgreSQL thay v? Failed to fetch chung chung.
- PASS: Typecheck API v? Web, 2 e2e API/multiplayer/club, Playwright cho c? hai URL, ph?c h?i sau 2 l?i m?ng m? ph?ng, kh?ng retry HTTP 503 v? kh?ng c?p CORS cho origin ngo?i danh s?ch.
- B?ng ch?ng: test-results/connection-fix-qa.json; script t?i ki?m tra scripts/playtest-connection.js qua Playwright MCP.
- File s?a: apps/api/src/main.ts, apps/web/game/networking/useCityConnection.ts, README.md; th?m script v? k?t qu? ki?m th?. Kh?ng s?a database, secret, source game 3D ho?c c?u h?nh c?ng.
- B??c predev ??i PostgreSQL healthy ?? c? trong package.json v? ???c gi? nguy?n. C?c server v?n ch?y sau ki?m tra.
- Production build kh?ng ch?y l?i trong l??t s?a l?i n?y; x?c minh qua typecheck, Nest/Next dev th?c t?, integration tests v? tr?nh duy?t.
