import { matchMaker } from '@colyseus/core';
import type { WorldZone } from '@metaverse/game-protocol';
import { verifyDemoToken } from './verify-demo-token';

/** Danh tính lấy từ JWT, vị trí/quyền chuyển lấy trực tiếp từ room nguồn, không nhận tọa độ client. */
export async function verifyRoomTransfer(token: string | undefined, options: { token?: string; fromRoomId?: unknown }, destination: WorldZone) {
  const identity = await verifyDemoToken(token || options?.token);
  if (typeof options.fromRoomId !== 'string' || options.fromRoomId.length > 80) throw new Error('Missing source room');
  const allowed = await matchMaker.remoteRoomCall(options.fromRoomId, 'canTransfer', [identity.id, destination]);
  if (allowed !== true) throw new Error('Move closer to the doorway');
  return identity;
}
