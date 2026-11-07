'use client';

// Giữ room cũ tới khi room mới đã có state của chính người chơi, để lỗi chuyển không làm mất phiên.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Client, type Room } from 'colyseus.js';
import { DEFAULT_DJ_VISIT, type DjVisit, CLUB_ROOM_NAME, WORLD_ROOM_NAME, DEFAULT_CLUB_SHOW, DEFAULT_PLAYER_CHARACTER, type ClubShow, type WorldZone, type ChatMessage, type DanceInput, type MoveInput, type PlayerCharacterId, type PlayerDanceStyle, type PositionSnapshot } from '@metaverse/game-protocol';

type StateView = { activeTrackId?: string; dj?: DjVisit; zone?: string; simulationTime?: number; danceEpoch?: number; showBpm?: number; showOffset?: number; showCue?: string; players?: { forEach: (cb: (p: PositionSnapshot, id: string) => void) => void } };
export type ConnectionStatus = 'connecting' | 'online' | 'offline' | 'error';

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
  const roomRef = useRef<Room | null>(null);
  const transferRef = useRef<() => Promise<void>>(async () => {});

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
      state.players.forEach((p, id) => { next[id] = { id: p.id, name: p.name, x: p.x, z: p.z, yaw: p.yaw, sampleTime: state.simulationTime, seatId: p.seatId ?? '', dancing: p.dancing ?? false, danceStyle: p.danceStyle ?? 'normal', characterId: p.characterId ?? DEFAULT_PLAYER_CHARACTER }; });
      setPlayers(next);
      const d = state.dj;
      setDj(d ? { phase: d.phase, requesterId: d.requesterId, startedAt: d.startedAt, playerX: d.playerX, playerZ: d.playerZ, targetX: d.targetX, targetZ: d.targetZ, returnDistance: d.returnDistance } : DEFAULT_DJ_VISIT);
      setDanceEpoch(state.danceEpoch ?? 0);
      setShow(current => current.bpm === state.showBpm && current.offset === state.showOffset && current.cue === state.showCue && current.trackId === state.activeTrackId ? current : { trackId: state.activeTrackId, bpm: state.showBpm ?? DEFAULT_CLUB_SHOW.bpm, offset: state.showOffset ?? DEFAULT_CLUB_SHOW.offset, cue: (state.showCue ?? DEFAULT_CLUB_SHOW.cue) as ClubShow['cue'] });
    };
    async function join(destination: WorldZone, fromRoomId?: string) {
      const room = await client.joinOrCreate(destination === 'club' ? CLUB_ROOM_NAME : WORLD_ROOM_NAME, { token, characterId, ...(fromRoomId ? { fromRoomId } : {}) });
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
        setZone(destination); setRoomId(room.roomId); setSessionId(room.sessionId); setChat([]);
        update(room, room.state as StateView);
        setStatus('online'); setMessage(destination === 'club' ? 'Đã vào Denmu Night Club' : 'Đã vào thành phố');
        if (previous) void previous.leave().catch(() => {});
      } catch (error) { await room.leave(); throw error; }
    }
    transferRef.current = async () => {
      if (cancelled || inFlight || !roomRef.current) return;
      inFlight = true; setSwitching(true);
      roomRef.current.send('move', { x: 0, z: 0 });
      try { await join(activeZone === 'street' ? 'club' : 'street', roomRef.current.roomId); }
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
            response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/v1/auth/guest`, { method: 'POST', cache: 'no-store', signal: startupController.signal });
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
        client = new Client(process.env.NEXT_PUBLIC_WORLD_URL ?? 'ws://localhost:2567');
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
  const changeZone = useCallback(() => { void transferRef.current(); }, []);
  const toggleSeat = useCallback((seatId: string) => { roomRef.current?.send('seat', { seatId }); }, []);
  const setDancing = useCallback((dancing: boolean, style: PlayerDanceStyle = 'normal') => { roomRef.current?.send('dance', { dancing, style } satisfies DanceInput); }, []);
  const holdDj = useCallback((held: boolean) => { if (held) roomRef.current?.send('move', { x: 0, z: 0 }); roomRef.current?.send('dj-hold', held); }, []);
  const cancelDj = useCallback(() => { roomRef.current?.send('dj-cancel'); }, []);
  const selectDjTrack = useCallback((id: string) => { roomRef.current?.send('dj-track', id); }, []);
  const setClubShow = useCallback((value: ClubShow) => { roomRef.current?.send('club-show', value); }, []);
  return { dj, holdDj, cancelDj, selectDjTrack, status, message, sessionId, roomId, zone, danceEpoch, show, setClubShow, switching, players, chat, sendMove, sendChat, changeZone, toggleSeat, setDancing };
}
