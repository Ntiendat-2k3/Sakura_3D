# Nhảy từ ban công tầng 2/3 xuống tầng 1 Kohaku

## Cách chơi
Đứng sát lan can ở một trong 5 điểm nhảy (2 ở hành lang sau tầng 2, 2 ở sảnh trước tầng 3, 1 ở hành lang phải tầng 3) để hiện nút **"Space · Nhảy từ Tầng N xuống tầng 1"**, rồi bấm Space hoặc bấm nút. Tầng 2 mất ~2.4 s, tầng 3 ~2.75 s, thay cho 1–2 dãy cầu thang 24 bậc.

## Thiết kế
- `packages/game-protocol/src/kohaku-jump.ts`:
  - điểm nhảy và điểm tiếp đất, được chọn để tránh collider, đèn lồng và đèn chùm;
  - hàm thuần `sampleKohakuJump`: lấy đà 0.4 s, bay theo parabol (bật cao 1.1 m để chân vượt lan can 0.95 m, ngang đi theo smoothstep), tiếp đất 0.75 s.
- Server (`apps/world-server/src/systems/kohakuJump.ts`, `kohaku.room.ts`):
  - message `kohaku-jump` không mang payload; server tự suy điểm nhảy từ vị trí authoritative;
  - mỗi tick server đặt vị trí theo quỹ đạo, khóa đi lại, ngồi và qua cổng (`isInputLocked`) đến khi tiếp đất;
  - `PlayerState.jumpSpot` cho mọi client biết ai đang nhảy.
- Web:
  - `Avatar.tsx` chiếu đúng quỹ đạo theo đồng hồ cục bộ nên mượt hơn patch 10 Hz;
  - `playerJumpMotion.ts` ghép 3 clip Mixamo: Jumping Down (nhún, bật) → Falling Idle (rơi, lặp) → Falling To Landing (khớp lúc chạm sàn);
  - khi lấy đà, model được hạ cho ngón chân chạm sàn.
- `playerMotionOverlay.ts` tách cơ chế chồng clip sau mixer khỏi `playerKissMotion.ts`. Kiss dùng chung, hành vi không đổi.
- Clip nguồn nằm trong `assets/source/animations/kohaku/`, đã chuyển sang `apps/web/public/assets/animations/club/*.json` bằng `node scripts/prepare-club-motion.mjs --mixamo --file="<tên>.fbx"`.

## Kiểm chứng
- Test mới:
  - protocol: điểm đứng và điểm tiếp đất đi được, chân vượt lan can trên mọi điểm, thời lượng;
  - server: chọn điểm, khóa, tiếp đất, từ chối khi sai tầng, ở xa hoặc đang ngồi;
  - web: tổng trọng số timeline luôn bằng 1, retarget được lên cả 9 nhân vật, xương trả về đúng tư thế nền.
- Toàn bộ test: game-protocol 36/36, world-server 102/102, web 181/181. Typecheck web và world-server sạch.
- Đo bằng script tạm: lúc tiếp đất ngón chân lệch sàn ±2 cm; lúc lấy đà luôn có một chân chạm sàn.
- **Chưa kiểm**: chơi thử trong trình duyệt, và `pnpm test:e2e` (cần `npm run dev`).
