'use client';
import { Suspense, useCallback, useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { warmCharacterTextures, warmSceneTextures } from './characterAssets';
import layout from '../scenes/club-lighting-layout.json';
import { CLUB_DJ_LAYOUT as djLayout } from '@metaverse/game-protocol';
import { PLAYER_CHARACTERS } from '@metaverse/game-protocol';

export const CLUB_PRELOAD_URLS = [...Object.values(PLAYER_CHARACTERS).map(player => player.url), '/assets/buildings/denmu-club.glb',
  ...[...new Set([...layout.map(entry => entry.id), djLayout.booth.id, '34111', '34112'])].map(id => `/assets/props/club/${id}.glb`)];
const npcs = ['wine', 'pop', 'galaxy', 'rosetta'] as const;

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
export function ClubAssetWarmup({ onReady, onError }: { onReady: () => void; onError: () => void }) {
  const { gl } = useThree();
  const completed = useRef(new Set<string>());
  const done = useCallback((id: string) => {
    completed.current.add(id);
    if (completed.current.size === CLUB_PRELOAD_URLS.length + npcs.length) onReady();
  }, [onReady]);
  useEffect(() => {
    let cancelled = false;
    for (const id of npcs) void warmCharacterTextures(id, gl).then(() => { if (!cancelled) done(id); }).catch(() => { if (!cancelled) onError(); });
    return () => { cancelled = true; };
  }, [gl, done, onError]);
  return <>{CLUB_PRELOAD_URLS.map(url => <Suspense key={url} fallback={null}><WarmModel url={url} done={done} onError={onError}/></Suspense>)}</>;
}
