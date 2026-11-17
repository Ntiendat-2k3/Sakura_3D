# Nhân vật 月華楼 Gekkarō — nguồn và điều khoản

Người dùng cung cấp 4 file VRM 0.x. Điều khoản bên dưới lấy nguyên văn từ metadata `VRM.meta` trong từng file (giấy phép VRoid Hub `version=1`).

| File | Vai trong game | Tên model / tác giả | Thương mại | Sửa đổi | Phân phối lại | Ghi công | Bạo lực |
|---|---|---|---|---|---|---|---|
| `Aos.vrm` | Bà chủ Aos (đón khách) | Aostylish / siroihakumai | Cho phép | Cho phép | Cho phép | Không bắt buộc | Cho phép |
| `Espeon.vrm` | Dealer Tsukimi | EspeonModel / Reira | **Cấm** | Cho phép | **Cấm** | **Bắt buộc** | Cho phép |
| `Lindsay.vrm` | Đao phủ Onizuka | [OC] Lindsay / Mariele | **Cấm** (doanh nghiệp), cá nhân có lãi được | Cho phép | **Cấm** | **Bắt buộc** | Cho phép |
| `Rina.vrm` | Rina, quầy rượu | [OC] Unnamed Character 2 / Reira / Peony | **Cấm** (doanh nghiệp), cá nhân có lãi được | Cho phép | **Cấm** | **Bắt buộc** | Cho phép |

Hệ quả cho repo:

- Dự án chạy local, không thương mại, nên dùng được. Ba model cấm phân phối lại, vì vậy cả VRM gốc ở đây và bản nén ở `apps/web/public/assets/characters/gekka/` đều nằm trong `.gitignore`, giống `club-local/`. Không commit, không đẩy lên Git công khai.
- Phải ghi công: Reira, Mariele, Peony (và siroihakumai cho Aos, dù không bắt buộc).
- Bản nén meshopt chỉ đổi cách lưu hình học, không sửa model. Bản gốc trước khi nén nằm ở `assets/processed/meshopt-raw/` (cũng đã ignore).
- Tên hiển thị trong game (Tsukimi, Onizuka, Aos, Rina) là vai diễn đặt cho sòng, không đổi tên tác giả hay tên model gốc.

Clip chuyển động (`assets/source/animations/gekka/*.fbx`) tải từ Mixamo (Adobe): Cross Punch, Taking Punch, Reaction Hit, Big Hit To Head, Dizzy Idle. Chúng được chuyển sang JSON trong `apps/web/public/assets/animations/club/` bằng `node scripts/prepare-club-motion.mjs --mixamo --file=<tên>.fbx`.
