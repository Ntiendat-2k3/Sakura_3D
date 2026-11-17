import type { PositionSnapshot } from '@metaverse/game-protocol';

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a), keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(key => Object.hasOwn(b, key) && deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}

// Patch 10 Hz dựng object mới mỗi lần; giữ tham chiếu cũ khi nội dung y hệt để React bỏ qua render thừa.
export function keepIfEqual<T>(previous: T, next: T): T {
  return deepEqual(previous, next) ? previous : next;
}

export function reusePlayers(previous: Record<string, PositionSnapshot>, next: Record<string, PositionSnapshot>): Record<string, PositionSnapshot> {
  const ids = Object.keys(next);
  let same = ids.length === Object.keys(previous).length;
  const merged: Record<string, PositionSnapshot> = {};
  for (const id of ids) {
    const kept = Object.hasOwn(previous, id) ? keepIfEqual(previous[id], next[id]) : next[id];
    if (kept !== previous[id]) same = false;
    merged[id] = kept;
  }
  return same ? previous : merged;
}
