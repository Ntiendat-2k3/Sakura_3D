export type LightPreset = { position: [number, number, number]; intensity: number; distance: number; color: string };

/** Số pointLight cố định của Kohaku: đổi số đèn lúc chạy sẽ biên dịch lại mọi shader (giật hình). */
export const KOHAKU_LIGHT_POOL_SIZE = 6;

/** Đèn khác tầng không rọi sang được (sàn chặn), nên lệch trục y bị tính nặng hơn để đèn cùng tầng được ưu tiên. */
const VERTICAL_WEIGHT = 2;

/** Preset mới chỉ thay preset đang gán khi gần hơn ít nhất chừng này (mét, theo khoảng cách có trọng số): chống đổi qua lại ở ranh giới hạng 6/7. */
export const LIGHT_SWAP_MARGIN = 0.5;

type Point = { x: number; y: number; z: number };

/** Khoảng cách (mét) từ `from` tới preset, trục y nhân VERTICAL_WEIGHT. */
export function weightedDistance(preset: LightPreset, from: Point): number {
  const [x, y, z] = preset.position;
  return Math.sqrt((x - from.x) ** 2 + ((y - from.y) * VERTICAL_WEIGHT) ** 2 + (z - from.z) ** 2);
}

/** Chỉ số các preset gần `from` nhất (khoảng cách 3D, trục y nhân VERTICAL_WEIGHT); bằng nhau thì chỉ số nhỏ trước để không nhảy qua lại. */
export function pickNearestLights(presets: LightPreset[], from: Point, count: number): number[] {
  return presets
    .map((preset, index) => ({ index, d: weightedDistance(preset, from) }))
    .sort((a, b) => a.d - b.d || a.index - b.index)
    .slice(0, Math.min(count, presets.length))
    .map(item => item.index);
}

/**
 * Gán preset cho từng slot (giữ nguyên chỉ số slot): preset mới nằm trong top-`count` chỉ thay preset đang gán
 * (đã rơi khỏi top) khi gần hơn ít nhất `margin`; ngược lại slot giữ preset cũ.
 */
export function selectLights(presets: LightPreset[], from: Point, current: number[], margin = LIGHT_SWAP_MARGIN): number[] {
  const wanted = pickNearestLights(presets, from, current.length);
  const keep = new Set(wanted);
  const next = current.slice();
  const evictable = current
    .map((preset, slot) => ({ slot, d: weightedDistance(presets[preset], from) }))
    .filter(item => !keep.has(current[item.slot]))
    .sort((a, b) => b.d - a.d || a.slot - b.slot);
  const held = new Set(current);
  for (const candidate of wanted) {
    if (held.has(candidate)) continue;
    const victim = evictable[0];
    if (!victim || victim.d - weightedDistance(presets[candidate], from) <= margin) break;
    next[victim.slot] = candidate;
    evictable.shift();
  }
  return next;
}

/** Giữ preset còn được chọn ở slot cũ (đèn đang sáng không bị tắt/bật lại); preset mới điền vào slot trống. */
export function assignSlots(previous: number[], wanted: number[]): number[] {
  const keep = new Set(wanted);
  const next = previous.map(index => (keep.has(index) ? index : -1));
  const placed = new Set(next);
  const fresh = wanted.filter(index => !placed.has(index));
  return next.map(index => (index === -1 ? fresh.shift() ?? -1 : index));
}
