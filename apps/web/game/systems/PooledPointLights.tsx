'use client';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { PointLight } from 'three';
import { pickNearestLights, selectLights, type LightPreset } from './lightPool';

/** Chu kỳ chọn lại preset gần người chơi (giây). */
const RESELECT_SECONDS = 0.25;
/** Thời gian đèn mới sáng dần từ 0 để đổi preset không bị chớp. */
const RAMP_SECONDS = 0.4;
/** Thời gian đèn cũ tắt dần về 0 trước khi chuyển sang preset mới. */
const FADE_OUT_SECONDS = 0.2;
const ORIGIN = { x: 0, y: 0, z: 0 };

/**
 * Đúng `count` pointLight cố định đi theo các preset gần người chơi nhất.
 * Số đèn không bao giờ đổi (không mount/unmount, không toggle visible) vì đổi số đèn làm three.js biên dịch lại mọi shader.
 * Đổi preset hai pha: đèn cũ tắt dần về 0 (giữ nguyên vị trí), rồi mới dời sang preset mới và sáng dần; selectLights có hysteresis chống đổi qua lại.
 * Intensity cuối = preset × ramp × `parent.userData.stagingFactor` (BluffStagingLights ghi hệ số này) nên mỗi đèn chỉ có một nơi ghi.
 */
export function PooledPointLights({ presets, count, player }: { presets: LightPreset[]; count: number; player?: { x: number; y?: number; z: number } }) {
  const lights = useRef<(PointLight | null)[]>([]);
  const playerRef = useRef(player);
  playerRef.current = player;
  const size = Math.min(count, presets.length);
  const initial = useMemo(() => pickNearestLights(presets, ORIGIN, size), [presets, size]);
  const slots = useRef<number[]>(initial);
  const ramps = useRef<number[]>(initial.map(() => 1));
  /** Preset đang chờ áp vào slot sau khi đèn cũ tắt hẳn; -1 là không có. */
  const pending = useRef<number[]>(initial.map(() => -1));
  const clock = useRef(0);

  const apply = (slot: number, preset: LightPreset) => {
    const light = lights.current[slot];
    if (!light) return;
    light.position.set(...preset.position);
    light.color.set(preset.color);
    light.distance = preset.distance;
  };

  useFrame((_, delta) => {
    const parent = lights.current[0]?.parent;
    clock.current += delta;
    if (clock.current >= RESELECT_SECONDS) {
      clock.current = 0;
      const at = playerRef.current;
      // Hysteresis tính trên preset "hiệu lực" (đang chờ nếu có) để không hủy/đặt lại liên tục.
      const effective = slots.current.map((preset, slot) => (pending.current[slot] >= 0 ? pending.current[slot] : preset));
      const next = selectLights(presets, at ? { x: at.x, y: at.y ?? 0, z: at.z } : ORIGIN, effective);
      next.forEach((preset, slot) => {
        pending.current[slot] = preset === slots.current[slot] ? -1 : preset;
      });
    }
    const staging: number = parent?.userData.stagingFactor ?? 1;
    slots.current.forEach((_, slot) => {
      const light = lights.current[slot];
      if (!light) return;
      if (pending.current[slot] >= 0) {
        ramps.current[slot] = Math.max(0, ramps.current[slot] - delta / FADE_OUT_SECONDS);
        if (ramps.current[slot] === 0) {
          slots.current[slot] = pending.current[slot];
          pending.current[slot] = -1;
          apply(slot, presets[slots.current[slot]]);
        }
      } else {
        ramps.current[slot] = Math.min(1, ramps.current[slot] + delta / RAMP_SECONDS);
      }
      light.intensity = presets[slots.current[slot]].intensity * ramps.current[slot] * staging;
    });
  });

  return <>
    {initial.map((preset, slot) => {
      const { position, color, distance, intensity } = presets[preset];
      return <pointLight key={slot} ref={node => { lights.current[slot] = node; if (node) node.userData.pooled = true; }} position={position} color={color} distance={distance} intensity={intensity} />;
    })}
  </>;
}
