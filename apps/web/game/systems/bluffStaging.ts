/**
 * Dàn cảnh lúc bóp cò ở bàn Kohaku: đèn tối, tim đập, camera đẩy sát. Hàm thuần để test được;
 * chỉ dựa trên dữ liệu đã công khai (pha, shooterSeat, pulls, shotResult), không lộ vị trí đạn.
 */
import { BLUFF_CHAMBERS, type BluffTableView } from '@metaverse/game-protocol';

/** Hệ số đèn phòng khi có người cầm súng; spotlight riêng giữ người đó nổi bật. */
export const STAGING_DIM = 0.25;
const HEARTBEAT_BASE_BPM = 70;
const HEARTBEAT_STEP_BPM = 18;
/** Phần khoảng cách closeup được rút ngắn khi đẩy sát hết cỡ. */
export const CLOSEUP_PUSH_RATIO = 0.15;

/** Tim đập nhanh dần theo số lần đã bóp (pulls trước lần này): 70 → 160 BPM. */
export function heartbeatBpm(pulls: number): number {
  const clamped = Math.min(Math.max(pulls, 0), BLUFF_CHAMBERS - 1);
  return HEARTBEAT_BASE_BPM + HEARTBEAT_STEP_BPM * clamped;
}

/** Chỉ trong nhịp chờ trước khi ra kết quả; lật bài lúc hết bài (không ai bắn) thì không có. */
export function heartbeatActive(table: BluffTableView): boolean {
  return table.phase === 'shooting' && table.shotResult === '' && table.shooterSeat !== '';
}

export function stagingDim(table: BluffTableView): number {
  return (table.phase === 'shooting' || table.phase === 'result') && table.shooterSeat !== '' ? STAGING_DIM : 1;
}

/** 0 → 1 tuyến tính trong suspenseMs kể từ lúc vào pha shooting. */
export function closeupPush(phaseStartMs: number, nowMs: number, suspenseMs: number): number {
  if (suspenseMs <= 0) return 1;
  return Math.min(1, Math.max(0, (nowMs - phaseStartMs) / suspenseMs));
}
