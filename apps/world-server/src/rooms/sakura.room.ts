import { Room, matchMaker, type Client } from '@colyseus/core';
import { CLUB_PORTAL, CLUB_ROOM_NAME, CLUB_SEATS, SEAT_REACH, canUsePortal, DEFAULT_PLAYER_CHARACTER, GAME_PATCH_MS, GAME_TICK_MS, isPlayerCharacterId, PLAYER_CHARACTERS, normalizeDanceInput, normalizeMoveInput, type ChatMessage, type MoveInput, type WorldZone } from '@metaverse/game-protocol';
import { CityState, PlayerState } from '../state/city.state';
import { applyMovement } from '../simulation/movement';
import { verifyDemoToken, type PlayerIdentity } from '../security/verify-demo-token';
import { verifyRoomTransfer } from '../security/verify-room-transfer';

export class SakuraRoom extends Room<CityState> {
  protected zone: WorldZone = 'street';
  maxClients = 24;
  state = new CityState();
  private inputs = new Map<string, MoveInput>();
  private lastInput = new Map<string, number>();
  private lastChat = new Map<string, number>();

  static async onAuth(token: string | undefined, options: { token?: string; fromRoomId?: string } = {}): Promise<PlayerIdentity> {
    if (options.fromRoomId) return verifyRoomTransfer(token, options, 'street');
    const identity = await verifyDemoToken(token || options?.token);
    // Không cho bỏ fromRoomId để giả làm phiên mới rồi vượt qua kiểm tra cửa EXIT.
    const clubs = await matchMaker.query({ name: CLUB_ROOM_NAME });
    for (const club of clubs) {
      if (await matchMaker.remoteRoomCall(club.roomId, 'containsPlayer', [identity.id])) throw new Error('Leave through the club exit');
    }
    return identity;
  }
  onCreate(): void {
    this.state.zone = this.zone;
    this.state.danceEpoch = Date.now();
    this.setPatchRate(GAME_PATCH_MS);
    this.setSimulationInterval((dt: number) => {
      this.state.players.forEach((player, sessionId) => {
        const input = this.inputs.get(sessionId);
        // Ngừng di chuyển khi client không gửi input, mất kết nối hoặc ẩn tab.
        if (input && Date.now() - (this.lastInput.get(sessionId) ?? 0) < 250) applyMovement(player, input, dt / 1000, this.zone);
      });
      // Mốc mô phỏng luôn đổi để patch vẫn đến khi đứng yên; client không dùng nhịp nhận gói làm nhịp di chuyển.
      this.state.simulationTime += dt;
    }, GAME_TICK_MS);

    this.onMessage('move', (client, payload: unknown) => {
      if (this.state.players.get(client.sessionId)?.seatId) return;
      const input = normalizeMoveInput(payload);
      if (!input) return;
      const now = Date.now();
      if ((input.x !== 0 || input.z !== 0) && now - (this.lastInput.get(client.sessionId) ?? 0) < 30) return;
      this.inputs.set(client.sessionId, input);
      this.lastInput.set(client.sessionId, now);
    });
    this.onMessage('dance', (client, payload: unknown) => {
      const player = this.state.players.get(client.sessionId);
      if (this.zone !== 'club' || !player || player.seatId || !payload || typeof payload !== 'object') return;
      const input = normalizeDanceInput(payload);
      if (!input) return;
      if (input.dancing && input.style === 'guitar' && (!isPlayerCharacterId(player.characterId) || !PLAYER_CHARACTERS[player.characterId].guitar)) return;
      player.dancing = input.dancing;
      player.danceStyle = input.style;
      // Bỏ ý định di chuyển cũ để simulation không lập tức hủy điệu nhảy vừa được nhận.
      this.inputs.delete(client.sessionId);
    });
    this.onMessage('seat', (client, payload: unknown) => {
      const player = this.state.players.get(client.sessionId);
      if (this.zone !== 'club' || !player || !payload || typeof payload !== 'object') return;
      const seatId = (payload as { seatId?: unknown }).seatId;
      if (typeof seatId !== 'string' || seatId.length > 32) return;
      if (seatId === '' && player.seatId) {
        const seat = CLUB_SEATS.find(item => item.id === player.seatId);
        if (!seat) return;
        player.seatId = ''; player.x = seat.standX; player.z = seat.standZ;
        this.inputs.delete(client.sessionId);
        return;
      }
      if (player.seatId) return;
      const seat = CLUB_SEATS.find(item => item.id === seatId);
      if (!seat || Math.hypot(player.x - seat.x, player.z - seat.z) > SEAT_REACH) {
        client.send('interaction-error', { text: 'Hãy đứng sát ghế để ngồi.' }); return;
      }
      if (Array.from(this.state.players.values()).some(other => other.seatId === seatId)) {
        client.send('interaction-error', { text: 'Ghế này đang có người ngồi.' }); return;
      }
      this.inputs.delete(client.sessionId);
      player.dancing = false;
      player.danceStyle = 'normal';
      player.seatId = seat.id; player.x = seat.x; player.z = seat.z; player.yaw = seat.yaw;
    });
    this.onMessage('chat', (client, payload: unknown) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !payload || typeof payload !== 'object') return;
      const text = (payload as { text?: unknown }).text;
      if (typeof text !== 'string') return;
      const clean = text.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 180);
      if (!clean) return;
      const now = Date.now();
      if (now - (this.lastChat.get(client.sessionId) ?? 0) < 1200) return;
      this.lastChat.set(client.sessionId, now);
      const message: ChatMessage = { userId: player.id, name: player.name, text: clean, at: now };
      this.broadcast('chat', message);
    });
  }
  /** RPC nội bộ phục vụ xác thực chuyển phòng; client không được gọi như một message tùy ý. */
  containsPlayer(userId: string): boolean {
    return Array.from(this.state.players.values()).some(player => player.id === userId);
  }
  canTransfer(userId: string, destination: WorldZone): boolean {
    if (destination === this.zone || !['street', 'club'].includes(destination)) return false;
    const entry = Array.from(this.state.players.entries()).find(([, p]) => p.id === userId);
    if (!entry || entry[1].seatId || !canUsePortal(this.zone, entry[1].x, entry[1].z)) return false;
    this.inputs.delete(entry[0]);
    return true;
  }
  /** Danh tính lấy từ JWT; ngoại hình chỉ nhận ID trong catalog, không nhận đường dẫn model do client cung cấp. */
  onJoin(client: Client, options: { fromRoomId?: string; characterId?: unknown }, identity?: PlayerIdentity): void {
    if (!identity) throw new Error('Authentication required');
    const characterId = options?.characterId ?? DEFAULT_PLAYER_CHARACTER;
    if (!isPlayerCharacterId(characterId)) throw new Error('Unknown player character');
    const duplicate = Array.from(this.state.players.values()).some(p => p.id === identity.id);
    if (duplicate) throw new Error('Already connected in this room');
    const player = new PlayerState();
    player.id = identity.id; player.name = identity.name;
    player.characterId = characterId;
    player.x = (this.state.players.size % 3) * 1.4 - 1.4;
    if (this.zone === 'club') player.z = 2.5;
    if (this.zone === 'street' && options?.fromRoomId) { player.x = CLUB_PORTAL.x; player.z = CLUB_PORTAL.z; }
    this.state.players.set(client.sessionId, player);
  }
  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.lastInput.delete(client.sessionId);
    this.lastChat.delete(client.sessionId);
  }
}
