'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CLUB_PLAYLIST, DEFAULT_CLUB_TRACK, getClubTrack, getClubPlaybackSeconds } from '@metaverse/game-protocol';
import { createClubAudioBuffer } from './clubAudioBuffer';

type PlayableTrack = { name: string; url: string; duration: number; local: boolean };


/** Media element sống cùng World; mở khóa play ngay trong thao tác E/click, giữ buffer qua các lần đổi phòng. */
export function useClubAudio({ active, switching, epoch, trackId }: { active: boolean; switching: boolean; epoch: number; trackId?: string }) {
  const definition = getClubTrack(trackId) ?? DEFAULT_CLUB_TRACK;
  const sharedTrack: PlayableTrack = { name: definition.title, url: definition.url, duration: definition.durationSeconds, local: false };
  const bufferRef = useRef<ReturnType<typeof createClubAudioBuffer> | null>(null);
  const wantsAudio = useRef(false), mode = useRef<'shared' | 'local' | 'off'>('shared');
  const [buffered, setBuffered] = useState<Record<string, 'ready' | 'error'>>({});
  const [track, setTrack] = useState<PlayableTrack | null>(null);
  const sharedSource = useRef<PlayableTrack | null>(null);
  const [ready, setReady] = useState(false);
  const [bufferError, setBufferError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(.5);
  const [error, setError] = useState('');
  const player = useRef<HTMLAudioElement>(null);
  const request = useRef(0);
  const context = useRef({ active, epoch, volume, track });
  context.current = { active, epoch, volume, track };
  const url = track?.url;

  const seek = useCallback(() => {
    const element = player.current, current = context.current;
    if (!element || !Number.isFinite(element.duration) || element.duration <= 0) return;
    const time = getClubPlaybackSeconds(current.epoch, current.track?.duration || element.duration);
    if (Math.abs(element.currentTime - time) > .18) element.currentTime = time;
  }, []);

  const play = useCallback((forEntry: boolean) => {
    const element = player.current;
    if (!element) return;
    wantsAudio.current = true;
    const token = ++request.current;
    element.volume = forEntry && !context.current.active ? 0 : context.current.volume;
    if (!forEntry) seek();
    setError('');
    // Gọi trước mọi await: giữ user activation của sự kiện bàn phím/click cho chính media element này.
    void element.play().then(() => {
      if (token !== request.current) return;
      setPlaying(true);
      if (context.current.active) { element.volume = context.current.volume; seek(); }
    }).catch(() => {
      if (token === request.current) { setPlaying(false); setError('Trình duyệt chưa cho phát nhạc tự động. Bấm Cho phép phát nhạc.'); }
    });
  }, [seek]);

  const prepareEntry = useCallback(() => play(true), [play]);
  const pause = useCallback(() => { wantsAudio.current = false; request.current++; player.current?.pause(); setPlaying(false); }, []);
  const useSharedTrack = useCallback(() => { pause(); mode.current = 'shared'; setError(''); setTrack(sharedSource.current); }, [pause]);
  const clearTrack = useCallback(() => { pause(); mode.current = 'off'; setTrack(null); }, [pause]);
  const selectLocal = useCallback((file: File) => {
    if (!/\.(mp3|wav|ogg)$/i.test(file.name)) { setError('Chọn file MP3, WAV hoặc OGG.'); return; }
    pause(); mode.current = 'local'; setError(''); setTrack({ name: file.name, url: URL.createObjectURL(file), duration: 0, local: true });
  }, [pause]);
  const toggleAudio = useCallback(() => { if (playing) pause(); else play(false); }, [playing, pause, play]);

  useEffect(() => {
    const element = player.current;
    return () => { request.current++; element?.pause(); if (track?.local && url?.startsWith('blob:')) URL.revokeObjectURL(url); };
  }, [url, track?.local]);
  useEffect(() => {
    const buffer = createClubAudioBuffer(); bufferRef.current = buffer;
    setBuffered({});
    void buffer.preload(CLUB_PLAYLIST, (id, loaded) => setBuffered(current => ({ ...current, [id]: loaded ? 'ready' : 'error' })));
    return () => { buffer.dispose(); bufferRef.current = null; };
  }, [retry]);
  useEffect(() => {
    let cancelled = false;
    setReady(false); setBufferError(false); sharedSource.current = null;
    void bufferRef.current!.load(definition).then(url => {
      if (cancelled) return;
      sharedSource.current = { name: definition.title, url, duration: definition.durationSeconds, local: false };
      setBuffered(current => ({ ...current, [definition.id]: 'ready' }));
      if (mode.current === 'shared') setTrack(sharedSource.current);
    }).catch(() => { if (!cancelled) { setBufferError(true); setError('Không tải trước được nhạc club.'); } });
    return () => { cancelled = true; };
  }, [definition, retry]);
  useEffect(() => { if (player.current) player.current.volume = active ? volume : 0; }, [active, volume]);
  useEffect(() => {
    if (active) { seek(); }
    else if (!switching) {
      pause(); mode.current = 'shared'; setTrack(sharedSource.current); setError('');
    }
  }, [active, switching, epoch, pause, seek]);
  useEffect(() => {
    if (!active || !playing) return;
    seek(); const timer = setInterval(seek, 1000); return () => clearInterval(timer);
  }, [active, playing, epoch, url, seek]);

  const element = <audio ref={player} src={url} loop preload="auto" onCanPlay={() => { if (!context.current.track?.local) { setBufferError(false); setReady(true); } if (wantsAudio.current && context.current.active) play(false); }} onLoadedMetadata={() => {
    const duration = player.current?.duration ?? 0;
    if (Number.isFinite(duration) && duration > 0) setTrack(current => current ? { ...current, duration } : current);
    if (context.current.active) seek();
  }} onPause={() => setPlaying(false)} onError={() => { setPlaying(false); setError('Không tải được nhạc club.'); if (!context.current.track?.local) setBufferError(true); }}/>;
  const prepareTrack = useCallback((id: string) => {
    const selected = getClubTrack(id), buffer = bufferRef.current;
    if (!selected || !buffer) return;
    setBuffered(current => { const next = { ...current }; delete next[id]; return next; });
    void buffer.load(selected).then(url => {
      if (bufferRef.current !== buffer) return;
      setBuffered(current => ({ ...current, [id]: 'ready' }));
      if (selected.id === definition.id) {
        sharedSource.current = { name: selected.title, url, duration: selected.durationSeconds, local: false };
        setBufferError(false); setError('');
        if (mode.current === 'shared') setTrack(sharedSource.current);
      }
    }).catch(() => { if (bufferRef.current === buffer) setBuffered(current => ({ ...current, [id]: 'error' })); });
  }, [definition]);
  const chooseShared = useCallback(() => { mode.current = 'shared'; wantsAudio.current = true; if (sharedSource.current) setTrack(sharedSource.current); play(false); }, [play]);
  const retryPreparation = useCallback(() => setRetry(value => value + 1), []);
  return { buffered, prepareTrack, chooseShared, definition, track, playing, volume, error, element, ready, bufferError, retryPreparation, prepareEntry, toggleAudio, selectLocal, clearTrack, useSharedTrack, setVolume, sharedTrack };
}

export type ClubAudioState = ReturnType<typeof useClubAudio>;
