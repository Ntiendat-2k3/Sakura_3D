/** Bố cục và cổng các địa điểm nội thất (Denmu Night Club, Reika Hostess Lounge, Cyber Love Hotel, Kohaku VIP Club) dùng chung cho client và server. */
import djLayout from './club-dj-layout.json';
import { GEKKA_EXIT, GEKKA_PORTAL, GEKKA_ROOM_NAME, GEKKA_SEATS } from './gekka';
import { STREET_SEATS } from './street-social';
export type WorldZone = 'street' | 'club' | 'lounge' | 'hotel' | 'kohaku' | 'gekka';
export const CLUB_ROOM_NAME = 'sakura-club' as const;
export const LOUNGE_ROOM_NAME = 'sakura-lounge' as const;
export const HOTEL_ROOM_NAME = 'sakura-hotel' as const;
export const KOHAKU_ROOM_NAME = 'sakura-kohaku' as const;
export const CLUB_PORTAL = { x: 4.2, z: 1, radius: 2.1 } as const;
export const CLUB_EXIT = { x: 0, z: 6.4, radius: 1.9 } as const;
export const LOUNGE_PORTAL = { x: -4.2, z: -7, radius: 2.1 } as const;
export const LOUNGE_EXIT = { x: 0, z: 5.8, radius: 1.9 } as const;
/** Cửa phòng riêng VIP 201 trên chiếu nghỉ tầng 2 Reika Lounge dẫn vào Cyber Love Hotel */
export const LOUNGE_HOTEL_PORTAL = { x: 5.3, z: 5.6, radius: 2.2 } as const;
/** Cổng cầu thang ngoài trời toà Reika trên phố Sakura dẫn lên tầng 2 Love Hotel */
export const HOTEL_PORTAL = { x: -4.2, z: -9.6, radius: 2.1 } as const;
export const HOTEL_EXIT = { x: 0, z: 4.8, radius: 1.9 } as const;
/** Cổng vào Câu Lạc Bộ VIP 琥珀 (Kohaku) trên phố Sakura Street */
export const KOHAKU_PORTAL = { x: -4.2, z: -15, radius: 2.1 } as const;
export const KOHAKU_EXIT = { x: 0, z: 7.1, radius: 1.9 } as const;
export const CLUB_STAGE = { xMin: -5.5, xMax: 5.5, zMin: -7.8, zMax: -3.5 } as const;
export const CLUB_COLLIDERS = [
  CLUB_STAGE,
  { xMin: -7.8, xMax: -5.4, zMin: -3.2, zMax: 3.2 },   // Quầy bar + 5 ghế bar (x -5.75)
  { xMin: 6.1, xMax: 7.8, zMin: -3.2, zMax: 3.2 },
  { xMin: djLayout.stairs[0].x - djLayout.stairs[0].width / 2, xMax: djLayout.stairs[0].x + djLayout.stairs[0].width / 2, zMin: -3.5, zMax: -2.6 },
  { xMin: -6.8, xMax: -5.8, zMin: 4.1, zMax: 5.1 },     // Bàn cocktail đứng góc trước trái
  { xMin: -5.1, xMax: -4.1, zMin: 5.4, zMax: 6.4 },     // Bàn cocktail đứng thứ hai
  { xMin: 4.8, xMax: 7.8, zMin: 4.1, zMax: 7.3 },       // Booth tròn VIP góc trước phải
] as const;

/** Vùng chặn nội thất Reika Hostess Lounge: quầy lễ tân, quầy champagne bar, cụm sofa và lan can an toàn mép thang bộ tầng 2. */
export const LOUNGE_COLLIDERS = [
  { xMin: -4.4, xMax: -2.0, zMin: 3.25, zMax: 4.35 },
  { xMin: -7.0, xMax: -5.0, zMin: -3.7, zMax: 1.3 },
  { xMin: 5.15, xMax: 7.0, zMin: -3.2, zMax: -1.0 },
  { xMin: 5.15, xMax: 7.0, zMin: -0.7, zMax: 1.5 },
  { xMin: -3.8, xMax: 3.8, zMin: -7.0, zMax: -4.5 },
  { xMin: 3.8, xMax: 4.25, zMin: 2.5, zMax: 6.6 },
] as const;

/** Vùng chặn nội thất Cyberpunk Neon Love Hotel: bục giường King-size, bồn tắm Jacuzzi, quầy Minibar và ghế đôi Loveseat. */
export const HOTEL_COLLIDERS = [
  { xMin: -2.4, xMax: 2.4, zMin: -5.8, zMax: -2.2 },
  { xMin: -5.8, xMax: -2.9, zMin: -2.6, zMax: 1.0 },
  { xMin: 3.6, xMax: 5.8, zMin: -3.4, zMax: -0.2 },
  { xMin: 3.4, xMax: 5.8, zMin: 0.8, zMax: 3.4 },
] as const;

/** Vùng chặn nội thất Tầng 1 của Kohaku Private Members Club (không chặn mặt cầu thang để người chơi leo lên tầng 2 & 3). */
export const KOHAKU_COLLIDERS = [
  { xMin: -1.75, xMax: 1.75, zMin: -2.1, zMax: 1.6 },   // Bàn tròn Poker trung tâm
  { xMin: -7.2, xMax: -4.5, zMin: -3.8, zMax: 1.8 },    // Quầy Bar Whisky & 3 ghế bar (lùi +0.35m nhường lối đứng cho Bartender NPC)
  { xMin: 4.75, xMax: 7.2, zMin: 2.1, zMax: 5.1 },      // Sofa Chesterfield Tầng 1
  { xMin: 3.25, xMax: 4.35, zMin: 2.8, zMax: 4.4 },     // Bàn trà cờ vua
  { xMin: -3.5, xMax: 3.5, zMin: -7.4, zMax: -6.6 },    // Lò sưởi & Vách gia huy
  { xMin: 4.35, xMax: 5.05, zMin: -7.2, zMax: -1.6 },   // Vách gầm & khoảng đệm lan can cầu thang 1->2
  { xMin: -7.25, xMax: -6.35, zMin: 3.4, zMax: 5.8 },   // Tủ kính Rượu Quý góc Trước Trái
  { xMin: -4.75, xMax: -3.65, zMin: 4.05, zMax: 5.15 }, // Bàn tròn Cocktail đứng góc Trước Trái
  { xMin: -2.95, xMax: -2.15, zMin: 6.2, zMax: 7.2 },   // Đôn cây Bonsai cửa vào trái
  { xMin: 2.15, xMax: 2.95, zMin: 6.2, zMax: 7.2 },     // Đôn cây Bonsai cửa vào phải
  { xMin: -7.25, xMax: -6.2, zMin: -7.2, zMax: -6.15 }, // Đồng hồ Quả lắc cổ góc Sau Trái
  { xMin: -1.65, xMax: -1.25, zMin: 4.05, zMax: 6.15 }, // Dải dây nhung VIP đón sảnh trái
  { xMin: 1.25, xMax: 1.65, zMin: 4.05, zMax: 6.15 },   // Dải dây nhung VIP đón sảnh phải
  { xMin: -7.2, xMax: -6.2, zMin: -5.75, zMax: -4.3 },  // Tháp thùng sake komodaru góc sau trái
  { xMin: -4.3, xMax: -3.7, zMin: -7.25, zMax: -6.65 }, // Bệ bình ikebana trái lò sưởi
  { xMin: 3.7, xMax: 4.3, zMin: -7.25, zMax: -6.65 },   // Bệ bình ikebana phải lò sưởi
  { xMin: 4.15, xMax: 7.2, zMin: 5.35, zMax: 7.2 },     // Góc trà tatami góc trước phải
] as const;

const KOHAKU_FLOOR_2_BOX_COLLIDERS = [
  { xMin: -0.45, xMax: 0.45, zMin: -7.2, zMax: -6.45 },  // Bàn trà ngắm cảnh sát vách sau Tầng 2
  { xMin: 4.30, xMax: 5.05, zMin: -6.22, zMax: -4.40 },  // Lan can kính & trụ góc cua cầu thang 1->2 trên Tầng 2 (buộc vòng qua z < -6.22)
  { xMin: -4.75, xMax: -1.25, zMin: -7.2, zMax: -6.8 },  // Bình phong vàng byobu trái sát tường sau
  { xMin: 1.3, xMax: 3.7, zMin: -7.2, zMax: -6.8 },      // Bình phong vàng byobu phải sát tường sau
] as const;

const KOHAKU_FLOOR_3_BOX_COLLIDERS = [
  { xMin: -1.75, xMax: 1.75, zMin: 5.8, zMax: 7.2 },    // Sofa VIP Tầng 3
  { xMin: -5.05, xMax: -4.30, zMin: 2.50, zMax: 3.12 }, // Trụ góc cua lan can đỉnh cầu thang 2->3 trên Tầng 3
  { xMin: -0.85, xMax: 0.85, zMin: 4.55, zMax: 5.6 },   // Bàn trà VIP Tầng 3
  { xMin: -3.5, xMax: -2.9, zMin: 5.9, zMax: 6.5 },     // Cột đèn trang trí Tầng 3 trái
  { xMin: 2.9, xMax: 3.5, zMin: 5.9, zMax: 6.5 },       // Cột đèn trang trí Tầng 3 phải
  { xMin: 5.45, xMax: 7.2, zMin: -5.15, zMax: -3.25 },  // Góc trà tatami + dù wagasa cuối hành lang phải Tầng 3
] as const;

/** Vị trí ngồi sát mép đệm và điểm đứng dậy khớp sofa trong denmu-club.glb. */
export const CLUB_SEATS = [-2.1, 0, 2.1].map((z, index) => ({
  id: `sofa-${index + 1}`, x: 6.6, z, yaw: -Math.PI / 2,
  standX: 5.3, standZ: z,
}));

/** Vị trí ngồi ghế sofa nhung trong reika-lounge.glb. */
export const LOUNGE_SEATS = [
  { id: 'lounge-sofa-1', x: 5.55, z: -2.1, yaw: -Math.PI / 2, standX: 4.5, standZ: -2.1 },
  { id: 'lounge-sofa-2', x: 5.55, z: 0.4, yaw: -Math.PI / 2, standX: 4.5, standZ: 0.4 },
  { id: 'lounge-vip-1', x: -0.8, z: -5.6, yaw: 0, standX: -0.8, standZ: -4.3 },
  { id: 'lounge-vip-2', x: 0.8, z: -5.6, yaw: 0, standX: 0.8, standZ: -4.3 },
];

/** Vị trí ngồi/tựa trên giường đôi King-size, thành bồn Jacuzzi và ghế đôi Loveseat trong love-hotel.glb. */
export const HOTEL_SEATS = [
  { id: 'hotel-bed-1', x: -0.75, z: -2.1, yaw: 0, standX: -0.75, standZ: -1.2 },
  { id: 'hotel-bed-2', x: 0.75, z: -2.1, yaw: 0, standX: 0.75, standZ: -1.2 },
  { id: 'hotel-jacuzzi-1', x: -2.75, z: -0.8, yaw: Math.PI / 2, standX: -1.9, standZ: -0.8 },
  { id: 'hotel-sofa-1', x: 4.25, z: 1.55, yaw: -Math.PI / 2, standX: 3.1, standZ: 1.55 },
  { id: 'hotel-sofa-2', x: 4.25, z: 2.55, yaw: -Math.PI / 2, standX: 3.1, standZ: 2.55 },
];

/** Vị trí ghế ngồi quanh bàn tròn Poker / Casino và sofa trong kohaku-club.glb. */
export const KOHAKU_SEATS = [
  { id: 'kohaku-dealer', x: 0, z: -1.88, yaw: 0, standX: 0, standZ: -2.45, npcOnly: true },
  { id: 'kohaku-player-1', x: -1.82, z: -0.45, yaw: Math.atan2(1.82, 0.45), standX: -2.45, standZ: -0.6 },
  { id: 'kohaku-player-2', x: -1.28, z: 1.32, yaw: Math.atan2(1.28, -1.32), standX: -1.75, standZ: 1.85 },
  { id: 'kohaku-player-3', x: 1.28, z: 1.32, yaw: Math.atan2(-1.28, -1.32), standX: 1.75, standZ: 1.85 },
  { id: 'kohaku-player-4', x: 1.82, z: -0.45, yaw: Math.atan2(-1.82, 0.45), standX: 2.45, standZ: -0.6 },
  { id: 'kohaku-sofa-1', x: 5.2, z: 3.1, yaw: -Math.PI / 2, standX: 4.2, standZ: 3.1 },
  { id: 'kohaku-sofa-2', x: 5.2, z: 4.1, yaw: -Math.PI / 2, standX: 4.2, standZ: 4.1 },
];

/** Cấu hình các NPC trong Reika Hostess Lounge: Yuzu (đón khách), Bunny (quầy bar), Zankou (khu VIP). */
export const LOUNGE_NPC_SLOTS = [
  { id: 'yuzu', name: 'Yuzu', role: 'Luxury Hostess · Đón khách & Trò chuyện', x: 0, z: -1.8, yaw: 0 },
  { id: 'bunny', name: 'Bunny', role: 'Sommelier · Quầy Champagne Bar', x: -4.4, z: -1.2, yaw: Math.PI / 2 },
  { id: 'zankou', name: 'Zankou', role: 'VIP Hostess · Khu Sofa VIP', x: 2.4, z: -3.6, yaw: -0.4 },
] as const;

export const SEAT_REACH = 1.6;

export function getZoneSeats(zone: WorldZone) {
  return zone === 'club'
    ? CLUB_SEATS
    : zone === 'lounge'
      ? LOUNGE_SEATS
      : zone === 'hotel'
        ? HOTEL_SEATS
        : zone === 'kohaku'
          ? KOHAKU_SEATS
          : zone === 'gekka'
            ? GEKKA_SEATS
            : zone === 'street'
              ? STREET_SEATS
              : [];
}

export function nearestClubSeat(x: number, z: number) {
  return CLUB_SEATS.filter(seat => Math.hypot(x - seat.x, z - seat.z) <= SEAT_REACH)
    .sort((a, b) => Math.hypot(x - a.x, z - a.z) - Math.hypot(x - b.x, z - b.z))[0];
}

export function nearestLoungeSeat(x: number, z: number) {
  return LOUNGE_SEATS.filter(seat => Math.hypot(x - seat.x, z - seat.z) <= SEAT_REACH)
    .sort((a, b) => Math.hypot(x - a.x, z - a.z) - Math.hypot(x - b.x, z - b.z))[0];
}

export function nearestHotelSeat(x: number, z: number) {
  return HOTEL_SEATS.filter(seat => Math.hypot(x - seat.x, z - seat.z) <= SEAT_REACH)
    .sort((a, b) => Math.hypot(x - a.x, z - a.z) - Math.hypot(x - b.x, z - b.z))[0];
}

export function nearestKohakuSeat(x: number, z: number, y = 0) {
  if (y > 1.5) return undefined;
  return KOHAKU_SEATS.filter(seat => !('npcOnly' in seat && seat.npcOnly) && Math.hypot(x - seat.x, z - seat.z) <= SEAT_REACH)
    .sort((a, b) => Math.hypot(x - a.x, z - a.z) - Math.hypot(x - b.x, z - b.z))[0];
}

export function nearestZoneSeat(zone: WorldZone, x: number, z: number, y = 0) {
  return zone === 'club'
    ? nearestClubSeat(x, z)
    : zone === 'lounge'
      ? nearestLoungeSeat(x, z)
      : zone === 'hotel'
        ? nearestHotelSeat(x, z)
        : zone === 'kohaku'
          ? nearestKohakuSeat(x, z, y)
        : zone === 'gekka' && y > -1
          ? GEKKA_SEATS.filter(seat => !seat.npcOnly && Math.hypot(x - seat.x, z - seat.z) <= SEAT_REACH)
            .sort((a, b) => Math.hypot(x - a.x, z - a.z) - Math.hypot(x - b.x, z - b.z))[0]
          : zone === 'street'
            ? STREET_SEATS.filter(seat => Math.hypot(x - seat.x, z - seat.z) <= SEAT_REACH)
              .sort((a, b) => Math.hypot(x - a.x, z - a.z) - Math.hypot(x - b.x, z - b.z))[0]
            : undefined;
}

export function isClubWalkable(x: number, z: number): boolean {
  return Number.isFinite(x) && Number.isFinite(z) && Math.abs(x) < 7.7 && z > -7.7 && z < 7.2
    && !CLUB_COLLIDERS.some(b => x >= b.xMin && x <= b.xMax && z >= b.zMin && z <= b.zMax);
}

export function isLoungeWalkable(x: number, z: number): boolean {
  return Number.isFinite(x) && Number.isFinite(z) && Math.abs(x) < 6.75 && z > -6.75 && z < 6.55
    && !LOUNGE_COLLIDERS.some(b => x >= b.xMin && x <= b.xMax && z >= b.zMin && z <= b.zMax);
}

export function isHotelWalkable(x: number, z: number): boolean {
  return Number.isFinite(x) && Number.isFinite(z) && Math.abs(x) < 5.75 && z > -5.75 && z < 5.55
    && !HOTEL_COLLIDERS.some(b => x >= b.xMin && x <= b.xMax && z >= b.zMin && z <= b.zMax);
}

function getKohakuCandidateSurfaces(x: number, z: number): number[] {
  const candidates: number[] = [];

  // 1. Kiểm tra mặt sàn Tầng 1 (y = 0)
  // Dừng phần sàn tầng 1 ở z > -1.38 trước chân cầu thang 1->2 để bàn chân bám trọn lên mép mũi bậc đầu tiên
  const blockedFloor1 = KOHAKU_COLLIDERS.some(b => x >= b.xMin && x <= b.xMax && z >= b.zMin && z <= b.zMax)
    || (x >= 5.05 && x <= 7.2 && z >= -7.2 && z < -1.38);
  if (!blockedFloor1) {
    candidates.push(0);
  }

  // 2. Cầu thang 1 -> 2 (x: 5.05..7.15, z: -6.0..-1.38)
  // Đường bao dốc khớp đúng đường nối đỉnh các mũi bậc (24 bậc, dy = 0.15m) nên chân không bao giờ ngập đá
  if (x >= 5.05 && x <= 7.15 && z > -6.0 && z <= -1.38) {
    const ratio = Math.max(0, Math.min(1, (-1.38 - z) / 4.4));
    candidates.push(ratio * 3.6);
  }

  // 3. Mặt sàn Tầng 2 (y = 3.6) - chừa khoảng đệm lan can giếng trời an toàn
  const inLanding2 = x >= 5.05 && x <= 7.15 && z >= -7.15 && z <= -6.0;
  const inBack2 = x >= -7.15 && x < 5.05 && z >= -7.15 && z <= -4.75;
  const inLeft2 = x >= -7.15 && x <= -4.75 && z > -4.75 && z <= -1.82;
  if ((inLanding2 || inBack2 || inLeft2) && !KOHAKU_FLOOR_2_BOX_COLLIDERS.some(b => x >= b.xMin && x <= b.xMax && z >= b.zMin && z <= b.zMax)) {
    candidates.push(3.6);
  }

  // 4. Cầu thang 2 -> 3 (x: -7.15..-5.05, z: -1.82..+2.8)
  if (x >= -7.15 && x <= -5.05 && z > -1.82 && z < 2.8) {
    const ratio = Math.max(0, Math.min(1, (z - (-1.82)) / 4.4));
    candidates.push(3.6 + ratio * 3.6);
  }

  // 5. Mặt sàn Tầng 3 (y = 7.2) - chừa khoảng đệm lan can giếng trời, thông thoáng tại cửa cầu thang
  const inFront3 = (x >= -7.15 && x <= 7.15 && z >= 3.12 && z <= 7.05) || (x >= -7.15 && x <= -5.05 && z >= 2.8 && z < 3.12);
  const inRight3 = x >= 4.75 && x <= 7.15 && z >= -5.15 && z < 3.12;
  if ((inFront3 || inRight3) && !KOHAKU_FLOOR_3_BOX_COLLIDERS.some(b => x >= b.xMin && x <= b.xMax && z >= b.zMin && z <= b.zMax)) {
    candidates.push(7.2);
  }

  return candidates;
}

/**
 * Kiểm tra bước di chuyển 3 tầng trong Kohaku Club (hỗ trợ leo cầu thang tầng 1 -> tầng 2 -> tầng 3 và bảo vệ giếng trời).
 * Giới hạn chênh lệch độ cao mỗi bước tối đa 0.65m để tránh rơi xuống giếng trời hoặc nhảy xuyên hông cầu thang.
 */
export function resolveKohakuStep(
  fromX: number,
  fromY: number,
  fromZ: number,
  toX: number,
  toZ: number,
): { allowed: boolean; y: number } {
  if (!Number.isFinite(fromX) || !Number.isFinite(fromY) || !Number.isFinite(fromZ) || !Number.isFinite(toX) || !Number.isFinite(toZ)) {
    return { allowed: false, y: fromY };
  }
  if (Math.abs(toX) >= 7.15 || toZ <= -7.15 || toZ >= 7.05) {
    return { allowed: false, y: fromY };
  }
  // Chặn tuyệt đối đoạn bước đi cắt ngang lan can kính góc cua cầu thang Tầng 2 (x = 4.68, z ∈ [-6.22, -4.40])
  if (
    fromY >= 2.2
    && fromY <= 4.5
    && Math.min(fromX, toX) < 5.05
    && Math.max(fromX, toX) > 4.30
    && Math.max(fromZ, toZ) >= -6.22
    && Math.min(fromZ, toZ) <= -4.40
  ) {
    return { allowed: false, y: fromY };
  }
  const candidates = getKohakuCandidateSurfaces(toX, toZ);
  let bestY: number | undefined;
  let minDiff = Infinity;
  for (const y of candidates) {
    const diff = Math.abs(y - fromY);
    if (diff <= 0.65 && diff < minDiff) {
      minDiff = diff;
      bestY = y;
    }
  }
  if (bestY === undefined) return { allowed: false, y: fromY };
  return { allowed: true, y: bestY };
}

export function getKohakuSurfaceY(x: number, z: number, currentY = 0): number {
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(currentY)) return 0;
  const candidates = getKohakuCandidateSurfaces(x, z);
  if (!candidates.length) return currentY;
  let bestY = candidates[0];
  let minDiff = Math.abs(bestY - currentY);
  for (let i = 1; i < candidates.length; i++) {
    const diff = Math.abs(candidates[i] - currentY);
    if (diff < minDiff) {
      minDiff = diff;
      bestY = candidates[i];
    }
  }
  return bestY;
}

export function isKohakuWalkable(x: number, z: number, y = 0): boolean {
  return resolveKohakuStep(x, y, z, x, z).allowed;
}

export function nearestStreetPortal(x: number, z: number) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return undefined;
  const portals = [
    { destination: 'club' as const, roomName: CLUB_ROOM_NAME, label: 'Night Club', ...CLUB_PORTAL },
    { destination: 'lounge' as const, roomName: LOUNGE_ROOM_NAME, label: 'Reika Lounge (1F)', ...LOUNGE_PORTAL },
    { destination: 'hotel' as const, roomName: HOTEL_ROOM_NAME, label: 'Thang bộ Tầng 2 · Cyber Love Hotel', ...HOTEL_PORTAL },
    { destination: 'kohaku' as const, roomName: KOHAKU_ROOM_NAME, label: '琥珀 · Kohaku Private Members Club', ...KOHAKU_PORTAL },
    { destination: 'gekka' as const, roomName: GEKKA_ROOM_NAME, label: '月華楼 · Gekkarō', ...GEKKA_PORTAL },
  ];
  return portals
    .filter(portal => Math.hypot(x - portal.x, z - portal.z) <= portal.radius)
    .sort((a, b) => Math.hypot(x - a.x, z - a.z) - Math.hypot(x - b.x, z - b.z))[0];
}

export function nearestLoungePortal(x: number, z: number) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return undefined;
  if (Math.hypot(x - LOUNGE_HOTEL_PORTAL.x, z - LOUNGE_HOTEL_PORTAL.z) <= LOUNGE_HOTEL_PORTAL.radius) {
    return { destination: 'hotel' as const, roomName: HOTEL_ROOM_NAME, label: 'Mở cửa phòng 201 · Cyber Love Hotel', ...LOUNGE_HOTEL_PORTAL };
  }
  if (Math.hypot(x - LOUNGE_EXIT.x, z - LOUNGE_EXIT.z) <= LOUNGE_EXIT.radius) {
    return { destination: 'street' as const, roomName: '', label: 'Cửa ra Phố Sakura', ...LOUNGE_EXIT };
  }
  return undefined;
}

/**
 * Tính toán độ cao sàn/bậc thang (Y) trong Reika Lounge:
 * - Sàn chính tầng 1: y = 0
 * - Bậc thang bộ bên phải (x từ 4.25 đến 6.75, z từ 2.45 đến 4.4): dốc đều từ 0 lên 2.32m
 * - Sàn chiếu nghỉ tầng 2 (z >= 4.4): y = 2.32m
 */
export function getLoungeSurfaceY(x: number, z: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;
  if (x >= 4.25 && x <= 6.75 && z >= 2.45) {
    if (z >= 4.4) return 2.32;
    return ((z - 2.45) / (4.4 - 2.45)) * 2.32;
  }
  return 0;
}

export function canUsePortal(zone: WorldZone, x: number, z: number, destination?: WorldZone, y = 0): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  if (zone === 'street') {
    if (destination === 'club') return Math.hypot(x - CLUB_PORTAL.x, z - CLUB_PORTAL.z) <= CLUB_PORTAL.radius;
    if (destination === 'lounge') return Math.hypot(x - LOUNGE_PORTAL.x, z - LOUNGE_PORTAL.z) <= LOUNGE_PORTAL.radius;
    if (destination === 'hotel') return Math.hypot(x - HOTEL_PORTAL.x, z - HOTEL_PORTAL.z) <= HOTEL_PORTAL.radius;
    if (destination === 'kohaku') return Math.hypot(x - KOHAKU_PORTAL.x, z - KOHAKU_PORTAL.z) <= KOHAKU_PORTAL.radius;
    if (destination === 'gekka') return Math.hypot(x - GEKKA_PORTAL.x, z - GEKKA_PORTAL.z) <= GEKKA_PORTAL.radius;
    return !!nearestStreetPortal(x, z);
  }
  if (zone === 'lounge') {
    if (destination === 'hotel') return Math.hypot(x - LOUNGE_HOTEL_PORTAL.x, z - LOUNGE_HOTEL_PORTAL.z) <= LOUNGE_HOTEL_PORTAL.radius;
    if (destination === 'street') return Math.hypot(x - LOUNGE_EXIT.x, z - LOUNGE_EXIT.z) <= LOUNGE_EXIT.radius;
    return Math.hypot(x - LOUNGE_EXIT.x, z - LOUNGE_EXIT.z) <= LOUNGE_EXIT.radius
      || Math.hypot(x - LOUNGE_HOTEL_PORTAL.x, z - LOUNGE_HOTEL_PORTAL.z) <= LOUNGE_HOTEL_PORTAL.radius;
  }
  if (zone === 'kohaku') {
    return y <= 1.5 && Math.hypot(x - KOHAKU_EXIT.x, z - KOHAKU_EXIT.z) <= KOHAKU_EXIT.radius;
  }
  if (zone === 'gekka') {
    return y > -1 && Math.hypot(x - GEKKA_EXIT.x, z - GEKKA_EXIT.z) <= GEKKA_EXIT.radius;
  }
  const exit = zone === 'club' ? CLUB_EXIT : HOTEL_EXIT;
  return Math.hypot(x - exit.x, z - exit.z) <= exit.radius;
}

/**
 * Phát hiện khi người chơi đi bộ tiến sát và bước xuyên qua ngưỡng cửa:
 * Tự động chuyển phòng liền mạch mà không cần bấm phím E.
 */
export function getWalkThroughTarget(zone: WorldZone, x: number, z: number, y = 0): WorldZone | undefined {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return undefined;
  if (zone === 'street') {
    // Bước vào cửa Denmu Club (x=4.2, z=1.0)
    if (Math.hypot(x - CLUB_PORTAL.x, z - CLUB_PORTAL.z) <= 0.95 || (x >= 4.25 && Math.abs(z - 1.0) <= 1.15)) return 'club';
    // Bước vào cửa Reika Lounge tầng 1 (x=-4.2, z=-7.0)
    if (Math.hypot(x - LOUNGE_PORTAL.x, z - LOUNGE_PORTAL.z) <= 0.95 || (x <= -4.25 && Math.abs(z - (-7.0)) <= 1.15)) return 'lounge';
    // Bước vào thang bộ ngoài trời toà Reika dẫn lên Love Hotel (x=-4.2, z=-9.6)
    if (Math.hypot(x - HOTEL_PORTAL.x, z - HOTEL_PORTAL.z) <= 0.95 || (x <= -4.25 && Math.abs(z - (-9.6)) <= 1.15)) return 'hotel';
    // Bước vào cửa Kohaku Private Members Club (x=-4.2, z=-15.0)
    if (Math.hypot(x - KOHAKU_PORTAL.x, z - KOHAKU_PORTAL.z) <= 0.95 || (x <= -4.25 && Math.abs(z - (-15.0)) <= 1.15)) return 'kohaku';
    if (Math.hypot(x - GEKKA_PORTAL.x, z - GEKKA_PORTAL.z) <= 0.95 || (x >= 4.25 && Math.abs(z + 15) <= 1.15)) return 'gekka';
    return undefined;
  }
  if (zone === 'lounge') {
    // Bước qua cửa phòng 201 trên chiếu nghỉ tầng 2 vào Cyber Love Hotel (x=5.3, z=6.55)
    if (x >= 4.3 && x <= 6.3 && z >= 5.75) return 'hotel';
    // Bước qua cửa chính tầng 1 ra phố Sakura (x=0, z=5.8)
    if (Math.abs(x) <= 1.2 && z >= 5.5) return 'street';
    return undefined;
  }
  if (zone === 'club') {
    // Bước qua cửa thoát hiểm ra phố Sakura (x=0, z=6.4)
    if (Math.abs(x) <= 1.2 && z >= 6.1) return 'street';
    return undefined;
  }
  if (zone === 'hotel') {
    // Bước qua cửa phòng ra chiếu nghỉ tầng 2 Reika Lounge (x=0, z=4.8)
    if (Math.abs(x) <= 1.2 && z >= 4.5) return 'lounge';
    return undefined;
  }
  if (zone === 'kohaku') {
    // Bước qua cửa sảnh tầng 1 ra phố Sakura (chỉ áp dụng khi đứng tại tầng 1 y <= 1.5)
    if (y <= 1.5 && Math.abs(x) <= 1.2 && z >= 6.8) return 'street';
    return undefined;
  }
  if (zone === 'gekka') {
    if (y > -1 && Math.abs(x) <= 1.2 && z >= 6.3) return 'street';
    return undefined;
  }
  return undefined;
}
