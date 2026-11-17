'use client';

// Tải trước toàn bộ mô hình GLB nhân vật, câu lạc bộ, lounge, khách sạn và đưa texture vào GPU VRAM.
import { Suspense, useCallback, useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { warmCharacterTextures, warmSceneTextures } from './characterAssets';
import layout from '../scenes/club-lighting-layout.json';
import { CLUB_DJ_LAYOUT as djLayout } from '@metaverse/game-protocol';
import { PLAYER_CHARACTERS } from '@metaverse/game-protocol';
import originalPlacements from '../../public/assets/props/placements.json';
import { preloadBluffVoices } from './bluffVoice';
import { loadClubMotion } from './retargetClubMotion';
import { GEKKA_STAFF_CLIPS } from './gekkaNpcMotion';
import { GEKKA_RESTRAINT_CLIPS } from './gekkaRestraintPose';
import { allGekkaTextures } from '../scenes/gekkaTextures';

const streetModels = [...new Set(originalPlacements.map(item => item.model))];
const STREET_PRELOAD_URLS = [
  '/assets/buildings/sakura-street.glb',
  '/assets/props/ground.glb',
  '/assets/props/lantern-garlands.glb',
  '/assets/props/street-decor.glb',
  ...streetModels.map(name => `/assets/props/${name}.glb`),
];

export const CLUB_PRELOAD_URLS = [
  ...STREET_PRELOAD_URLS,
  ...Object.values(PLAYER_CHARACTERS).map(player => player.url),
  '/assets/buildings/denmu-club.glb',
  '/assets/buildings/reika-lounge.glb',
  '/assets/buildings/love-hotel.glb',
  '/assets/buildings/kohaku-club.glb',
  '/assets/props/kohaku-bluff/revolver.glb',
  '/assets/props/kohaku-bluff/card.glb',
  ...[...new Set([...layout.map(entry => entry.id), djLayout.booth.id, '34111', '34112'])].map(id => `/assets/props/club/${id}.glb`)
];
const BLUFF_VOICE_PRELOAD_ID = 'kohaku-bluff-voices';
const GEKKA_PRELOAD_ID = 'gekka-props';

/**
 * Sòng Gekkarō dựng bằng code nên không có GLB để useGLTF nạp trước: vẽ sẵn texture canvas, đẩy lên GPU,
 * và tải clip của nhân sự + người bị trói, để lần đầu bước vào sòng không phải chờ.
 */
async function warmGekka(renderer: Parameters<typeof warmSceneTextures>[1]) {
  await Promise.all([...Object.values(GEKKA_STAFF_CLIPS), ...Object.values(GEKKA_RESTRAINT_CLIPS)].map(loadClubMotion));
  for (const texture of allGekkaTextures()) {
    renderer.initTexture(texture);
    // Nhường luồng chính giữa các lần vẽ canvas/upload để thanh tiến trình vẫn chạy mượt.
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}
const npcs = ['wine', 'pop', 'galaxy', 'rosetta', 'yuzu', 'bunny', 'zankou', 'shinku', 'hinata', 'bartender', 'aos', 'espeon', 'lindsay', 'rina'] as const;

/** Sinh nhãn mô tả thân thiện bằng tiếng Việt cho từng tài nguyên đang nạp */
function getAssetFriendlyName(id: string): string {
  if (id.includes('sakura-street')) return 'Kiến trúc đại lộ Neon Sakura…';
  if (id.includes('denmu-club')) return 'Không gian Denmu Night Club…';
  if (id.includes('reika-lounge')) return 'Nội thất Reika Hostess Lounge…';
  if (id.includes('love-hotel')) return 'Phòng nghỉ Cyber Love Hotel 2F…';
  if (id.includes('kohaku-club')) return 'Câu lạc bộ thượng lưu 琥珀 Kohaku Club 1F…';
  if (id.includes('characters/player/')) {
    const filename = id.split('/').pop()?.replace('.glb', '') ?? 'nhân vật';
    return `Mô hình nhân vật (${filename})…`;
  }
  if (id === BLUFF_VOICE_PRELOAD_ID) return 'Giọng thoại Shinku & cà khịa Kohaku Bluff…';
  if (id === GEKKA_PRELOAD_ID) return 'Nội thất & chuyển động sòng 月華楼 Gekkarō…';
  if (id.includes('kohaku-bluff')) return 'Súng ổ xoay & bài hổ phách Kohaku Bluff…';
  if (id.includes('props/club')) return 'Đạo cụ ánh sáng & quầy bar Club…';
  if (id.includes('dj-rio')) return 'Bàn mixer âm thanh DJ Rio…';
  if (['aos', 'espeon', 'lindsay', 'rina'].includes(id)) return `Nhân vật sòng 月華楼 Gekkarō (${id})…`;
  if ((npcs as readonly string[]).includes(id)) {
    return `Chuyển động & Rig của NPC ${id.toUpperCase()}…`;
  }
  return 'Dữ liệu đồ họa & Texture GPU…';
}

/** Mỗi URL dùng cùng khóa useGLTF đơn của renderer, tránh tải lại bởi cache mảng URL khác khóa. */
function WarmModel({ url, done, onError }: { url: string; done: (id: string) => void; onError: () => void }) {
  const { scene } = useGLTF(url);
  const { gl } = useThree();
  useEffect(() => {
    let cancelled = false;
    void warmSceneTextures(scene, gl, () => cancelled).then(() => { if (!cancelled) done(url); }).catch(() => { if (!cancelled) onError(); });
    return () => { cancelled = true; };
  }, [scene, gl, url, done, onError]);
  return null;
}

/** Chuẩn bị ngay khi World mở; báo sẵn sàng sau khi model, animation và texture đã vào cache/GPU. */
export function ClubAssetWarmup({
  onReady,
  onError,
  onProgress,
}: {
  onReady: () => void;
  onError: () => void;
  onProgress?: (progress: number, label: string) => void;
}) {
  const { gl } = useThree();
  const completed = useRef(new Set<string>());
  // +1: gói giọng Kohaku Bluff (decode một lần, dùng suốt phiên như nhạc club); +1: nội thất & clip Gekkarō.
  const total = CLUB_PRELOAD_URLS.length + npcs.length + 2;

  const done = useCallback((id: string) => {
    completed.current.add(id);
    const count = completed.current.size;
    const percent = Math.min(99, Math.floor((count / total) * 100));
    const label = getAssetFriendlyName(id);
    onProgress?.(percent, label);
    if (count === total) {
      onProgress?.(100, 'Đồ họa đã tải hoàn tất 100%!');
      onReady();
    }
  }, [onReady, onProgress, total]);

  useEffect(() => {
    let cancelled = false;
    for (const id of npcs) {
      void warmCharacterTextures(id, gl)
        .then(() => { if (!cancelled) done(id); })
        .catch(() => { if (!cancelled) onError(); });
    }
    return () => { cancelled = true; };
  }, [gl, done, onError]);

  useEffect(() => {
    let cancelled = false;
    void warmGekka(gl).then(() => { if (!cancelled) done(GEKKA_PRELOAD_ID); }).catch(() => { if (!cancelled) onError(); });
    return () => { cancelled = true; };
  }, [gl, done, onError]);

  useEffect(() => {
    let cancelled = false;
    // Giọng chỉ là gia vị: lỗi tải thì vẫn cho vào thế giới (câu thiếu buffer sẽ được bỏ qua khi phát).
    void preloadBluffVoices()
      .catch(error => { console.warn('Không tải được giọng Kohaku Bluff', error); })
      .then(() => { if (!cancelled) done(BLUFF_VOICE_PRELOAD_ID); });
    return () => { cancelled = true; };
  }, [done]);

  return (
    <>
      {CLUB_PRELOAD_URLS.map(url => (
        <Suspense key={url} fallback={null}>
          <WarmModel url={url} done={done} onError={onError} />
        </Suspense>
      ))}
    </>
  );
}
