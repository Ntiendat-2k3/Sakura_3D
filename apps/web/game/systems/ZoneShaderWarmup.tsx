'use client';

// Phòng mới mount sẽ biên dịch shader đồng bộ ở frame đầu (mỗi program ~0.5s khi GPU chưa có cache) gây khựng cả trang.
// Dừng vẽ canvas từ lúc đổi zone tới khi compileAsync xong để driver biên dịch song song (KHR_parallel_shader_compile).
import { useEffect, useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';

export function ZoneShaderWarmup<Zone extends string>({ zone, mountedZone, readyZone, prepared, onCompiled }: {
  zone: Zone;
  mountedZone: Zone | null;
  readyZone: Zone | null;
  /** Mọi NPC/asset đã tải; NPC mount muộn (vd. Rosetta ở phố) phải có mặt trước khi biên dịch, nếu không sẽ compile đồng bộ khi xuất hiện. */
  prepared: boolean;
  onCompiled: (zone: Zone) => void;
}) {
  const gl = useThree(state => state.gl);
  const scene = useThree(state => state.scene);
  const camera = useThree(state => state.camera);
  const set = useThree(state => state.set);
  const get = useThree(state => state.get);
  const invalidate = useThree(state => state.invalidate);
  const paused = zone !== readyZone;

  // Layout effect chạy cùng commit với scene mới, trước frame kế tiếp; useEffect để lọt vài frame compile đồng bộ.
  // Không dùng setFrameloop: hàm đó reset clock.elapsedTime về 0, làm lệch các hiệu ứng theo thời gian.
  useLayoutEffect(() => {
    if (!paused) return;
    set({ frameloop: 'never' });
    get().internal.frames = 0; // Bỏ frame đã invalidate trước đó, nếu không loop vẫn vẽ thêm một lần.
    return () => { set({ frameloop: 'always' }); invalidate(); };
  }, [paused, set, get, invalidate]);

  useEffect(() => {
    if (!prepared || mountedZone !== zone || readyZone === zone) return;
    let cancelled = false;
    void gl.compileAsync(scene, camera).then(() => { if (!cancelled) onCompiled(zone); });
    return () => { cancelled = true; };
  }, [zone, mountedZone, readyZone, prepared, gl, scene, camera, onCompiled]);

  return null;
}
