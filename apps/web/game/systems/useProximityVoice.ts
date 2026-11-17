'use client';
/**
 * Voice chat theo khoảng cách: tắt mặc định, chỉ xin micro sau khi người chơi đồng ý; push-to-talk mặc định.
 * Tắt tiếng/chặn theo userId (sessionId đổi mỗi lần chuyển phòng), lưu localStorage nếu trình duyệt cho phép.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VOICE_RANGE, voiceDistance, type PositionSnapshot, type VoiceSignalInput, type VoiceSignalRelay } from '@metaverse/game-protocol';
import { VoiceChatEngine, type VoicePeerState } from './VoiceChatEngine';
import { canAcceptVoiceOffer, selectVoicePeers } from './voicePeers';
import {
  VOICE_LEVEL_POLL_MS, VOICE_PUSH_TO_TALK_CODE, VOICE_SPEAKING_RMS, VOICE_STORAGE_KEYS,
  classifyMediaError, isTypingTarget, loadVoiceIds, loadVoiceMode, parseIceServers, saveVoiceIds, saveVoiceMode, shouldTransmit, voiceSupport,
  type StorageLike, type VoiceIndicator, type VoiceMode, type VoiceStatus,
} from './voiceControls';
import { keepIfEqual } from '../networking/stableState';

export type VoicePeerView = { sessionId: string; userId: string; name: string; distance: number; state: VoicePeerState | 'idle'; speaking: boolean; muted: boolean };
type VoiceConnection = {
  setVoiceEnabled: (enabled: boolean) => void;
  sendVoiceSignal: (signal: VoiceSignalInput) => void;
  reportVoice: (target: string, reason: string) => void;
  onVoiceSignal: (listener: (signal: VoiceSignalRelay) => void) => () => void;
};

const ICE_SERVERS = parseIceServers(process.env.NEXT_PUBLIC_VOICE_ICE_SERVERS);

function browserStorage(): StorageLike | undefined {
  try { return typeof window === 'undefined' ? undefined : window.localStorage; } catch { return undefined; }
}

function checkSupport(): VoiceStatus | null {
  return voiceSupport({
    isSecureContext: typeof window === 'undefined' ? undefined : window.isSecureContext,
    hasGetUserMedia: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
    hasPeerConnection: typeof RTCPeerConnection !== 'undefined',
    hasAudioContext: typeof AudioContext !== 'undefined',
  });
}

/** connection phải là object ổn định (useMemo trên các callback của useCityConnection). */
export function useProximityVoice({ sessionId, roomId, online, players, connection, reportAck }: {
  sessionId: string;
  roomId: string;
  online: boolean;
  players: Record<string, PositionSnapshot>;
  connection: VoiceConnection;
  reportAck: { target: string; at: number } | null;
}) {
  const [status, setStatus] = useState<VoiceStatus>('off');
  const [mode, setModeState] = useState<VoiceMode>('push-to-talk');
  const [selfMuted, setSelfMuted] = useState(false);
  const [pttHeld, setPttHeld] = useState(false);
  const [mutedUsers, setMutedUsers] = useState<Set<string>>(() => new Set());
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(() => new Set());
  const [blockedNames, setBlockedNames] = useState<Record<string, string>>({});
  const [peerStates, setPeerStates] = useState<Record<string, VoicePeerState>>({});
  const [levels, setLevels] = useState<Record<string, boolean>>({});
  const engineRef = useRef<VoiceChatEngine | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const consented = useRef(false);
  const enabled = status === 'on';
  // Ref luôn giữ giá trị mới nhất cho callback signaling (đăng ký một lần, không theo từng patch 10 Hz).
  const latest = useRef({ players, sessionId, blockedUsers });
  latest.current = { players, sessionId, blockedUsers };

  useEffect(() => {
    const storage = browserStorage();
    setModeState(loadVoiceMode(storage));
    setMutedUsers(loadVoiceIds(storage, VOICE_STORAGE_KEYS.muted));
    setBlockedUsers(loadVoiceIds(storage, VOICE_STORAGE_KEYS.blocked));
  }, []);

  const release = useCallback(() => {
    engineRef.current?.destroy();
    engineRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    void contextRef.current?.close().catch(() => {});
    contextRef.current = null;
    setPeerStates({});
    setLevels({});
    setPttHeld(false);
  }, []);
  useEffect(() => release, [release]);

  /** Gọi trong sự kiện click để AudioContext được phép phát và trình duyệt hiện hộp thoại quyền micro. */
  const confirmConsent = useCallback(async () => {
    consented.current = true;
    setStatus('requesting');
    const context = new AudioContext();
    void context.resume().catch(() => {});
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      contextRef.current = context;
      streamRef.current = stream;
      const engine = new VoiceChatEngine({
        audioContext: context,
        localStream: stream,
        iceServers: ICE_SERVERS,
        sendSignal: signal => connection.sendVoiceSignal(signal),
        onPeersChanged: () => { if (engineRef.current === engine) setPeerStates(prev => keepIfEqual(prev, engine.peerStates())); },
      });
      engine.setTransmitting(false);
      engineRef.current = engine;
      // Micro bị rút ra hoặc thu hồi quyền giữa chừng: tắt voice và báo trên HUD.
      stream.getAudioTracks().forEach(track => { track.onended = () => { if (engineRef.current === engine) { release(); connection.setVoiceEnabled(false); setStatus('no-mic'); } }; });
      setStatus('on');
    } catch (error) {
      void context.close().catch(() => {});
      setStatus(classifyMediaError(error));
    }
  }, [connection, release]);

  const cancelConsent = useCallback(() => setStatus('off'), []);
  const disable = useCallback(() => {
    release();
    connection.setVoiceEnabled(false);
    setStatus('off');
  }, [connection, release]);
  /** Lần đầu trong phiên luôn hiện thông báo đồng ý; bật lại sau đó thì xin micro ngay. */
  const enable = useCallback(() => {
    const unsupported = checkSupport();
    if (unsupported) setStatus(unsupported);
    else if (consented.current) void confirmConsent();
    else setStatus('consent');
  }, [confirmConsent]);

  // Báo server mỗi khi vào phòng mới (sessionId mới) để người gần biết mình có voice; dọn peer phòng cũ.
  useEffect(() => {
    const engine = engineRef.current;
    if (!enabled || !engine || !online || !roomId || !sessionId) return;
    engine.setSelf(sessionId);
    connection.setVoiceEnabled(true);
  }, [enabled, online, roomId, sessionId, connection]);

  // Nhận tín hiệu WebRTC chuyển tiếp từ server.
  useEffect(() => {
    if (!enabled) return;
    return connection.onVoiceSignal(signal => {
      const engine = engineRef.current;
      if (!engine) return;
      const { players: currentPlayers, sessionId: self, blockedUsers: blocked } = latest.current;
      void engine.handleSignal(signal, from => canAcceptVoiceOffer({ selfSessionId: self, players: currentPlayers, current: new Set(engine.peerIds()), blocked }, from));
    });
  }, [enabled, connection]);

  // Chọn peer theo vị trí server mỗi patch.
  useEffect(() => {
    const engine = engineRef.current;
    if (!enabled || !engine || !sessionId) return;
    engine.sync(selectVoicePeers({ selfSessionId: sessionId, players, current: new Set(engine.peerIds()), blocked: blockedUsers }));
  }, [enabled, players, sessionId, blockedUsers]);

  const transmitting = shouldTransmit({ enabled, mode, pttHeld, selfMuted });
  useEffect(() => { engineRef.current?.setTransmitting(transmitting); }, [transmitting]);

  // Tắt tiếng theo userId; ánh xạ sang sessionId của phòng hiện tại.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    for (const id of Object.keys(peerStates)) engine.setPeerMuted(id, mutedUsers.has(players[id]?.id ?? ''));
  }, [peerStates, mutedUsers, players]);

  // Push-to-talk: giữ phím, nhả khi rời tab để không bị kẹt micro mở.
  useEffect(() => {
    if (!enabled || mode !== 'push-to-talk') { setPttHeld(false); return; }
    const down = (event: KeyboardEvent) => {
      if (event.code !== VOICE_PUSH_TO_TALK_CODE || event.ctrlKey || event.altKey || event.metaKey || isTypingTarget(event.target)) return;
      setPttHeld(true);
    };
    const up = (event: KeyboardEvent) => { if (event.code === VOICE_PUSH_TO_TALK_CODE) setPttHeld(false); };
    const reset = () => setPttHeld(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', reset);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', reset); };
  }, [enabled, mode]);

  // Đo mức âm 10 lần/giây cho chỉ báo đang nói; chỉ cập nhật state khi tập người nói đổi.
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      const engine = engineRef.current;
      if (!engine) return;
      const next: Record<string, boolean> = {};
      for (const [id, level] of engine.levels()) if (level > VOICE_SPEAKING_RMS) next[id] = true;
      setLevels(prev => keepIfEqual(prev, next));
    }, VOICE_LEVEL_POLL_MS);
    return () => clearInterval(timer);
  }, [enabled]);

  const setMode = useCallback((next: VoiceMode) => { setModeState(next); saveVoiceMode(browserStorage(), next); }, []);
  const toggleSelfMute = useCallback(() => setSelfMuted(value => !value), []);
  const toggleMute = useCallback((userId: string) => {
    setMutedUsers(prev => {
      const next = new Set(prev);
      if (!next.delete(userId)) next.add(userId);
      saveVoiceIds(browserStorage(), VOICE_STORAGE_KEYS.muted, next);
      return next;
    });
  }, []);
  const toggleBlock = useCallback((userId: string, name: string) => {
    setBlockedNames(prev => ({ ...prev, [userId]: name }));
    setBlockedUsers(prev => {
      const next = new Set(prev);
      if (!next.delete(userId)) next.add(userId);
      saveVoiceIds(browserStorage(), VOICE_STORAGE_KEYS.blocked, next);
      return next;
    });
  }, []);
  const report = useCallback((targetSessionId: string, reason: string) => connection.reportVoice(targetSessionId, reason), [connection]);
  const setPushToTalk = useCallback((held: boolean) => setPttHeld(held), []);

  // Người bật voice ở gần (kể cả chưa kết nối) để HUD cho phép tắt tiếng/chặn/báo cáo.
  const self = players[sessionId];
  const peers = useMemo<VoicePeerView[]>(() => {
    if (!enabled || !self) return [];
    return Object.entries(players)
      .filter(([id, player]) => id !== sessionId && (player.voice || Object.hasOwn(peerStates, id)) && voiceDistance(self, player) <= VOICE_RANGE.disconnect)
      .map(([id, player]) => ({
        sessionId: id, userId: player.id, name: player.name, distance: voiceDistance(self, player),
        state: peerStates[id] ?? 'idle', speaking: !!levels[id], muted: mutedUsers.has(player.id) || blockedUsers.has(player.id),
      }))
      .sort((a, b) => a.distance - b.distance);
  }, [enabled, self, players, sessionId, peerStates, levels, mutedUsers, blockedUsers]);

  /** Chỉ báo trên đầu avatar theo sessionId. */
  const indicators = useMemo(() => {
    const result: Record<string, VoiceIndicator> = {};
    if (!enabled) return result;
    if (selfMuted) result[sessionId] = 'muted';
    else if (transmitting && levels['']) result[sessionId] = 'speaking';
    for (const peer of peers) {
      if (peer.muted) result[peer.sessionId] = 'muted';
      else if (peer.speaking) result[peer.sessionId] = 'speaking';
    }
    return result;
  }, [enabled, selfMuted, transmitting, levels, sessionId, peers]);

  return {
    status, enable, confirmConsent, cancelConsent, disable, mode, setMode, selfMuted, toggleSelfMute, pttHeld, setPushToTalk, transmitting,
    peers, indicators, mutedUsers, blockedUsers, blockedNames, toggleMute, toggleBlock, report, reportAck, engineRef,
  };
}
export type ProximityVoice = ReturnType<typeof useProximityVoice>;
