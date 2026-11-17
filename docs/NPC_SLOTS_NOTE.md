# Ghi chú các vị trí cần cấp nhân vật (NPC Slots)

Tài liệu này liệt kê các vị trí đã dựng sẵn mốc chờ NPC trong game. Khi bạn có file nhân vật (`.vrm`, `.blend`, `.fbx` hoặc `.unitypackage`) và điệu nhảy/chuyển động (`.fbx`), chỉ cần đặt vào `assets/source/characters/` và báo tên vị trí bên dưới để gắn vào cảnh.

---

## 1. Reika Hostess Lounge (`zone: 'lounge'` — Đã gắn đủ 3 NPC VRM)
- **Cửa vào ngoài phố:** Vòng sáng vàng `REIKA · E` tại tọa độ `(-4.2, -7)`.
- **Các NPC đã tích hợp (`LOUNGE_NPC_SLOTS`):**

| Mã vị trí (`id`) | Tên hiển thị | Nguồn Model | Vai trò & Khu vực đứng | Tọa độ `(x, z)` | Hướng nhìn (`yaw`) | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`yuzu`** | **Yuzu** | `reika-import/yuzu.vrm` (VRM 1.0) | Luxury Hostess · Đón khách tại sảnh thảm chính | `(0, -1.8)` | `0 rad` (nhìn ra cửa đón khách) | ✅ Đã gắn & chạy IK vẫy chào |
| **`bunny`** | **Bunny** | `reika-import/bunny.vrm` (VRM 1.0) | Sommelier · Đứng tại quầy Champagne Bar bên trái | `(-4.4, -1.2)` | `1.57 rad` (nhìn ra sảnh) | ✅ Đã gắn & chạy IK quầy bar |
| **`zankou`** | **Zankou** | `reika-import/zankou.vrm` (VRM 0.x) | VIP Hostess · Đứng cạnh khu bàn Sofa VIP cuối phòng | `(2.4, -3.6)` | `-0.4 rad` (hướng về bàn khách) | ✅ Đã gắn & chạy IK khu VIP |

---

## 2. Các tòa nhà tiếp theo trên phố (Dự kiến khi mở rộng)

| Tòa nhà | Mã vị trí dự kiến | Tên NPC & Vai trò | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Kurenai Oiran Lounge** (`x: 8.8, z: -7`) | `ayame`, `madam_kurenai` | **Ayame** (Oiran chính), **Madam Kurenai** (Chủ lầu) | Cần model trang phục kimono/oiran truyền thống |
| **Gekka Cabaret** (`x: -8.8, z: 1`) | `yuna`, `kaede` | **Yuna**, **Kaede** (Ca sĩ / Vũ công Cabaret) | Cần model đầm dạ hội + clip biểu diễn sân khấu |
| **Kohaku VIP** (`x: -8.8, z: -15`) | `hana` | **Hana** (VIP Concierge) | Tiếp đón phòng riêng VIP |
| **Izakaya / Quán trà / Atelier** | `rika`, `emi` | **Rika** (Chủ quán Izakaya), **Emi** (Thợ may Atelier) | Đứng quầy phục vụ |

