'use client';

// Giữ room cũ tới khi room mới đã có state của chính người chơi, để lỗi chuyển không làm mất phiên.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Client, type Room } from 'colyseus.js';
import { DEFAULT_DJ_VISIT, type DjVisit, CLUB_ROOM_NAME, LOUNGE_ROOM_NAME, HOTEL_ROOM_NAME, KOHAKU_ROOM_NAME, GEKKA_ROOM_NAME, WORLD_ROOM_NAME, DEFAULT_CLUB_SHOW, DEFAULT_PLAYER_CHARACTER, type ClubShow, type WorldZone, type ChatMessage, type DanceInput, type MoveInput, type PlayerCharacterId, type PlayerDanceStyle, type PositionSnapshot, BLUFF_MESSAGES, createEmptyBluffTable, type BluffCard, type BluffTableView, BLUFF_TAUNTS, type BluffTauntFx, type BluffTauntKind, POKER_MESSAGES, createEmptyPokerTable, type PokerAction, type PokerCard, type PokerTableView, type PokerTauntFx, VOICE_MESSAGES, KOHAKU_JUMP_MESSAGE, STREET_SOCIAL_MESSAGES, type VoiceSignalInput, type VoiceSignalRelay } from '@metaverse/game-protocol';
import { readBluffTable } from '../systems/kohakuBluffView';
import { readPokerTable } from '../systems/gekkaPokerView';
import { keepIfEqual, reusePlayers } from './stableState';
import { browserServiceUrls } from './serviceUrls';

export type VoiceSignalListener = (signal: VoiceSignalRelay) => void;
type StateView = { activeTrackId?: string; dj?: DjVisit; zone?: string; simulationTime?: number; danceEpoch?: number; showBpm?: number; showOffset?: number; showCue?: string; bluff?: unknown; poker?: unknown; players?: { forEach: (cb: (p: PositionSnapshot, id: string) => void) => void } };
export type ConnectionStatus = 'connecting' | 'online' | 'offline' | 'error';

/** a: người hôn/người đấm, b: người được hôn/người bị đấm. */
export type StreetFx = { kind: 'kiss' | 'punch'; a: string; b: string; at: number };
const STREET_FX_KEEP_MS = 5000;

export function useCityConnection(characterId: PlayerCharacterId = DEFAULT_PLAYER_CHARACTER) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [message, setMessage] = useState('Đang kết nối với thành phố...');
  const [sessionId, setSessionId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [zone, setZone] = useState<WorldZone>('street');
  const [danceEpoch, setDanceEpoch] = useState(0);
  const [dj, setDj] = useState<DjVisit>(DEFAULT_DJ_VISIT);
  const [show, setShow] = useState<ClubShow>(DEFAULT_CLUB_SHOW);
  const [switching, setSwitching] = useState(false);
  const [players, setPlayers] = useState<Record<string, PositionSnapshot>>({});
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [bluff, setBluff] = useState<BluffTableView>(createEmptyBluffTable);
  const [bluffHand, setBluffHand] = useState<BluffCard[]>([]);
  // Sự kiện cà khịa thoáng qua; at là performance.now() lúc nhận để mỗi avatar tự hết hạn theo durationMs.
  const [bluffTaunts, setBluffTaunts] = useState<{ fx: BluffTauntFx; at: number }[]>([]);
  /** Hiệu ứng hôn/đấm ngoài phố gần đây; at theo performance.now để Avatar canh khung clip. */
  const [streetFx, setStreetFx] = useState<StreetFx[]>([]);
  const [poker, setPoker] = useState<PokerTableView>(createEmptyPokerTable);
  const [pokerHole, setPokerHole] = useState<PokerCard[]>([]);
  const [pokerTaunts, setPokerTaunts] = useState<{ fx: PokerTauntFx; at: number }[]>([]);
  const roomRef = useRef<Room | null>(null);
  const transferRef = useRef<(targetZone?: WorldZone) => Promise<void>>(async () => {});
  // Tín hiệu voice đi thẳng tới engine WebRTC qua listener, không qua React state để tránh render 10–60 lần/giây.
  const voiceListeners = useRef(new Set<VoiceSignalListener>());
  const [voiceReportAck, setVoiceReportAck] = useState<{ target: string; at: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const startupController = new AbortController();
    let startupRetry: ReturnType<typeof setTimeout> | undefined;
    let releaseStartupRetry: (() => void) | undefined;
    let inFlight = false;
    let activeZone: WorldZone = 'street';
    let client: Client;
    let token: string;
    const rooms = new Set<Room>();
    const update = (room: Room, state: StateView) => {
      if (cancelled || roomRef.current !== room || !state.players) return;
      const next: Record<string, PositionSnapshot> = {};
      // Cố ý giữ sampleTime = simulationTime: mỗi snapshot luôn mới để buffer nội suy có mẫu tươi, kể cả người đứng yên.
      state.players.forEach((p, id) => { next[id] = { id: p.id, name: p.name, x: p.x, y: p.y ?? 0, z: p.z, yaw: p.yaw, sampleTime: state.simulationTime, seatId: p.seatId ?? '', dancing: p.dancing ?? false, danceStyle: p.danceStyle ?? 'normal', characterId: p.characterId ?? DEFAULT_PLAYER_CHARACTER, voice: p.voice ?? false, jumpSpot: p.jumpSpot ?? '' }; });
      setPlayers(prev => reusePlayers(prev, next));
      const d = state.dj;
      const nextDj = d ? { phase: d.phase, requesterId: d.requesterId, startedAt: d.startedAt, playerX: d.playerX, playerZ: d.playerZ, targetX: d.targetX, targetZ: d.targetZ, returnDistance: d.returnDistance } : DEFAULT_DJ_VISIT;
      setDj(prev => keepIfEqual(prev, nextDj));
      setDanceEpoch(state.danceEpoch ?? 0);
      const nextBluff = readBluffTable(state.bluff);
      setBluff(prev => keepIfEqual(prev, nextBluff));
      const nextPoker = readPokerTable(state.poker);
      setPoker(prev => keepIfEqual(prev, nextPoker));
      setShow(current => current.bpm === state.showBpm && current.offset === state.showOffset && current.cue === state.showCue && current.trackId === state.activeTrackId ? current : { trackId: state.activeTrackId, bpm: state.showBpm ?? DEFAULT_CLUB_SHOW.bpm, offset: state.showOffset ?? DEFAULT_CLUB_SHOW.offset, cue: (state.showCue ?? DEFAULT_CLUB_SHOW.cue) as ClubShow['cue'] });
    };
    async function join(destination: WorldZone, fromRoomId?: string) {
      const roomName = destination === 'club'
        ? CLUB_ROOM_NAME
        : destination === 'lounge'
          ? LOUNGE_ROOM_NAME
          : destination === 'hotel'
            ? HOTEL_ROOM_NAME
            : destination === 'kohaku'
              ? KOHAKU_ROOM_NAME
              : destination === 'gekka'
                ? GEKKA_ROOM_NAME
                : WORLD_ROOM_NAME;
      const room = await client.joinOrCreate(roomName, { token, characterId, ...(fromRoomId ? { fromRoomId, fromZone: activeZone } : {}) });
      if (cancelled) { await room.leave(); return; }
      rooms.add(room);
      let signalReady: (() => void) | undefined;
      const hasSelf = (state: StateView) => {
        let found = false;
        state.players?.forEach((_, id) => { if (id === room.sessionId) found = true; });
        return found;
      };
      room.onStateChange(state => {
        if (hasSelf(state as StateView)) signalReady?.();
        update(room, state as StateView);
      });
      // Bài trên tay chỉ gửi riêng cho người chơi, không nằm trong state nên phải nhận bằng message.
      room.onMessage(BLUFF_MESSAGES.hand, (cards: BluffCard[]) => {
        if (!cancelled && roomRef.current === room) setBluffHand(Array.isArray(cards) ? cards : []);
      });
      const pushStreetFx = (fx: Omit<StreetFx, 'at'>) => {
        if (cancelled || roomRef.current !== room) return;
        const at = performance.now();
        setStreetFx(current => [...current.filter(item => at - item.at < STREET_FX_KEEP_MS), { ...fx, at }]);
      };
      room.onMessage(STREET_SOCIAL_MESSAGES.kissFx, (fx: { a: string; b: string }) => pushStreetFx({ kind: 'kiss', a: fx.a, b: fx.b }));
      room.onMessage(STREET_SOCIAL_MESSAGES.punchFx, (fx: { attacker: string; target: string }) => pushStreetFx({ kind: 'punch', a: fx.attacker, b: fx.target }));
      room.onMessage(BLUFF_MESSAGES.tauntFx, (fx: BluffTauntFx) => {
        if (cancelled || roomRef.current !== room || !fx || !Object.hasOwn(BLUFF_TAUNTS, fx.kind)) return;
        const at = performance.now();
        setBluffTaunts(current => [...current.filter(item => at - item.at < BLUFF_TAUNTS[item.fx.kind].durationMs), { fx, at }]);
      });
      // Bài tẩy Poker cũng chỉ đi qua message riêng của từng client.
      room.onMessage(POKER_MESSAGES.hole, (cards: PokerCard[]) => {
        if (!cancelled && roomRef.current === room) setPokerHole(Array.isArray(cards) ? cards : []);
      });
      room.onMessage(POKER_MESSAGES.tauntFx, (fx: PokerTauntFx) => {
        if (cancelled || roomRef.current !== room || !fx || !Object.hasOwn(BLUFF_TAUNTS, fx.kind)) return;
        const at = performance.now();
        setPokerTaunts(current => [...current.filter(item => at - item.at < BLUFF_TAUNTS[item.fx.kind].durationMs), { fx, at }]);
      });
      room.onMessage(VOICE_MESSAGES.signal, (signal: VoiceSignalRelay) => {
        if (cancelled || roomRef.current !== room || !signal || typeof signal !== 'object') return;
        voiceListeners.current.forEach(listener => listener(signal));
      });
      room.onMessage(VOICE_MESSAGES.reportAck, (ack: { target?: unknown }) => {
        if (!cancelled && roomRef.current === room && typeof ack?.target === 'string') setVoiceReportAck({ target: ack.target, at: Date.now() });
      });
      room.onMessage('chat', (incoming: ChatMessage) => {
        if (!cancelled && roomRef.current === room) setChat(current => [...current.slice(-39), incoming]);
      });
      room.onMessage('interaction-error', (incoming: { text: string }) => {
        if (!cancelled && roomRef.current === room) setMessage(incoming.text);
      });
      room.onLeave(() => {
        rooms.delete(room);
        if (!cancelled && roomRef.current === room) {
          roomRef.current = null; setPlayers({}); setStatus('offline'); setMessage('Đã ngắt kết nối');
        }
      });
      room.onError(() => {
        if (!cancelled && roomRef.current === room) setMessage('Kết nối phòng gặp lỗi. Hãy tải lại trang nếu đã mất kết nối.');
      });
      try {
        if (!hasSelf(room.state as StateView)) await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Không nhận được state phòng')), 7000);
          signalReady = () => { clearTimeout(timer); resolve(); };
        });
        if (cancelled) { await room.leave(); return; }
        const previous = roomRef.current;
        roomRef.current = room;
        activeZone = destination;
        setZone(destination); setRoomId(room.roomId); setSessionId(room.sessionId); setChat([]); setBluffHand([]); setBluffTaunts([]); setStreetFx([]); setPokerHole([]); setPokerTaunts([]);
        update(room, room.state as StateView);
        setStatus('online');
        setMessage(
          destination === 'club'
            ? 'Đã vào Denmu Night Club'
            : destination === 'lounge'
              ? 'Đã vào Reika Hostess Lounge'
              : destination === 'hotel'
                ? 'Đã vào Cyber Love Hotel'
                : destination === 'kohaku'
                  ? 'Đã vào 琥珀 Kohaku Private Members Club'
                  : destination === 'gekka'
                    ? 'Đã vào sòng 月華楼 Gekkarō'
                    : 'Đã vào thành phố',
        );
        if (previous) void previous.leave().catch(() => {});
      } catch (error) { await room.leave(); throw error; }
    }
    transferRef.current = async (targetZone?: WorldZone) => {
      if (cancelled || inFlight || !roomRef.current) return;
      inFlight = true; setSwitching(true);
      roomRef.current.send('move', { x: 0, z: 0 });
      const nextZone: WorldZone = targetZone ?? (activeZone === 'street' ? 'club' : 'street');
      try { await join(nextZone, roomRef.current.roomId); }
      catch { if (!cancelled) setMessage('Chưa chuyển phòng được. Hãy đứng gần cửa và thử lại; phòng có thể đã đầy.'); }
      finally { inFlight = false; if (!cancelled) setSwitching(false); }
    };
    async function connect() {
      try {
        let response: Response | undefined;
        const attempts = process.env.NODE_ENV === 'development' ? 8 : 1;
        // Web có thể sẵn sàng trước Nest; chỉ thử lại lỗi mạng, không lặp yêu cầu đã trả lỗi HTTP.
        for (let attempt = 0; attempt < attempts; attempt++) {
          if (cancelled) return;
          try {
            response = await fetch(`${browserServiceUrls().api}/api/v1/auth/guest`, { method: 'POST', cache: 'no-store', signal: startupController.signal });
            break;
          } catch (error) {
            if (cancelled) return;
            if (!(error instanceof TypeError)) throw error;
            if (attempt === attempts - 1) throw new Error('Không kết nối được API. Kiểm tra server cổng 4000 và PostgreSQL, rồi tải lại trang.');
            setMessage('Đang đợi API khởi động…');
            await new Promise<void>(resolve => {
              releaseStartupRetry = resolve;
              startupRetry = setTimeout(resolve, 1500);
            });
          }
        }
        if (cancelled) return;
        if (!response?.ok) throw new Error('Không tạo được phiên guest. Kiểm tra API / PostgreSQL.');
        const identity = await response.json() as { token: string };
        if (cancelled) return;
        token = identity.token;
        client = new Client(browserServiceUrls().world);
        client.auth.token = token;
        await join('street');
      } catch (error) {
        if (!cancelled) { setStatus('error'); setMessage(error instanceof Error ? error.message : 'Lỗi kết nối'); }
      }
    }
    void connect();
    return () => {
      cancelled = true; startupController.abort();
      clearTimeout(startupRetry); releaseStartupRetry?.();
      transferRef.current = async () => {}; roomRef.current = null;
      for (const room of rooms) void room.leave().catch(() => {});
    };
  }, [characterId]);

  const sendMove = useCallback((input: MoveInput) => { roomRef.current?.send('move', input); }, []);
  const sendChat = useCallback((text: string) => { if (text.trim()) roomRef.current?.send('chat', { text: text.trim().slice(0, 180) }); }, []);
  const changeZone = useCallback((targetZone?: WorldZone) => { void transferRef.current(targetZone); }, []);
  const toggleSeat = useCallback((seatId: string) => { roomRef.current?.send('seat', { seatId }); }, []);
  const jumpDown = useCallback(() => { roomRef.current?.send(KOHAKU_JUMP_MESSAGE); }, []);
  const streetKiss = useCallback(() => { roomRef.current?.send(STREET_SOCIAL_MESSAGES.kiss); }, []);
  const streetPunch = useCallback(() => { roomRef.current?.send(STREET_SOCIAL_MESSAGES.punch); }, []);
  const setDancing = useCallback((dancing: boolean, style: PlayerDanceStyle = 'normal') => { roomRef.current?.send('dance', { dancing, style } satisfies DanceInput); }, []);
  const holdDj = useCallback((held: boolean) => { if (held) roomRef.current?.send('move', { x: 0, z: 0 }); roomRef.current?.send('dj-hold', held); }, []);
  const cancelDj = useCallback(() => { roomRef.current?.send('dj-cancel'); }, []);
  const selectDjTrack = useCallback((id: string) => { roomRef.current?.send('dj-track', id); }, []);
  const selectLoungeTrack = useCallback((id: string) => { roomRef.current?.send('lounge-track', id); }, []);
  const setClubShow = useCallback((value: ClubShow) => { roomRef.current?.send('club-show', value); }, []);
  const bluffReady = useCallback((value: boolean) => { roomRef.current?.send(BLUFF_MESSAGES.ready, value); }, []);
  const bluffPlay = useCallback((cardIds: string[]) => { roomRef.current?.send(BLUFF_MESSAGES.play, { cardIds }); }, []);
  const bluffLiar = useCallback(() => { roomRef.current?.send(BLUFF_MESSAGES.liar); }, []);
  const bluffTaunt = useCallback((kind: BluffTauntKind, targetSeat: string) => { roomRef.current?.send(BLUFF_MESSAGES.taunt, { kind, targetSeat }); }, []);
  const pokerReady = useCallback((value: boolean) => { roomRef.current?.send(POKER_MESSAGES.ready, value); }, []);
  const pokerAct = useCallback((action: PokerAction, amount?: number) => { roomRef.current?.send(POKER_MESSAGES.act, action === 'raise' ? { action, amount } : { action }); }, []);
  const pokerChoose = useCallback((choice: 'borrow' | 'leave') => { roomRef.current?.send(POKER_MESSAGES.choose, { choice }); }, []);
  const pokerTaunt = useCallback((kind: BluffTauntKind, target: string) => { roomRef.current?.send(POKER_MESSAGES.taunt, { kind, target }); }, []);
  const setVoiceEnabled = useCallback((enabled: boolean) => { roomRef.current?.send(VOICE_MESSAGES.state, { enabled }); }, []);
  const sendVoiceSignal = useCallback((signal: VoiceSignalInput) => { roomRef.current?.send(VOICE_MESSAGES.signal, signal); }, []);
  const reportVoice = useCallback((target: string, reason: string) => { roomRef.current?.send(VOICE_MESSAGES.report, { target, reason }); }, []);
  const onVoiceSignal = useCallback((listener: VoiceSignalListener) => {
    voiceListeners.current.add(listener);
    return () => { voiceListeners.current.delete(listener); };
  }, []);

  return { setVoiceEnabled, sendVoiceSignal, reportVoice, onVoiceSignal, voiceReportAck, poker, pokerHole, pokerReady, pokerAct, pokerChoose, pokerTaunt, pokerTaunts, bluff, bluffHand, bluffReady, bluffPlay, bluffLiar, bluffTaunt, bluffTaunts, dj, holdDj, cancelDj, selectDjTrack, selectLoungeTrack, status, message, sessionId, roomId, zone, danceEpoch, show, setClubShow, switching, players, chat, sendMove, sendChat, changeZone, toggleSeat, jumpDown, streetFx, streetKiss, streetPunch, setDancing };
}
