import { isWalkable, isClubWalkable, MOVE_SPEED, normalizeMoveInput, type WorldZone } from '@metaverse/game-protocol';
import type { PlayerState } from '../state/city.state';
export { normalizeMoveInput };
/** Chỉ cập nhật vị trí do server tính toán; nếu đi chéo bị chặn thì trượt theo trục còn hợp lệ. */
export function applyMovement(player: PlayerState, input: { x: number; z: number }, deltaSeconds: number, zone: WorldZone = 'street'): void {
  if (player.seatId) return;
  const walkable = zone === 'club' ? isClubWalkable : isWalkable;
  const dt = Math.min(Math.max(deltaSeconds, 0), 0.1);
  if (input.x === 0 && input.z === 0) return;
  player.dancing = false;
  player.danceStyle = 'normal';
  const dx = input.x * MOVE_SPEED * dt;
  const dz = input.z * MOVE_SPEED * dt;
  if (walkable(player.x + dx, player.z + dz)) { player.x += dx; player.z += dz; }
  else {
    if (walkable(player.x + dx, player.z)) player.x += dx;
    if (walkable(player.x, player.z + dz)) player.z += dz;
  }
  player.yaw = Math.atan2(input.x, input.z);
}
