import { Room, matchMaker, type Client } from '@colyseus/core';
import { CLUB_PORTAL, CLUB_ROOM_NAME, LOUNGE_PORTAL, LOUNGE_ROOM_NAME, HOTEL_PORTAL, HOTEL_ROOM_NAME, KOHAKU_PORTAL, KOHAKU_ROOM_NAME, GEKKA_ROOM_NAME, getZoneSeats, SEAT_REACH, canUsePortal, DEFAULT_PLAYER_CHARACTER, GAME_PATCH_MS, GAME_TICK_MS, isPlayerCharacterId, PLAYER_CHARACTERS, normalizeDanceInput, normalizeMoveInput, VOICE_MESSAGES, STREET_SOCIAL_MESSAGES, isWalkable, type ChatMessage, type MoveInput, type WorldZone } from '@metaverse/game-protocol';
import { CityState, PlayerState } from '../state/city.state';
import { applyMovement } from '../simulation/movement';
import { verifyDemoToken, type PlayerIdentity } from '../security/verify-demo-token';
import { verifyRoomTransfer } from '../security/verify-room-transfer';
import { VoiceRelay } from '../systems/voiceRelay';
import { createStreetSocial } from '../systems/streetSocial';

export class SakuraRoom extends Room<CityState> {
  protected zone: WorldZone = 'street';
  maxClients = 24;
  state = new CityState();
  private inputs = new Map<string, MoveInput>();
  private lastInput = new Map<string, number>();
  private lastChat = new Map<string, number>();
  /** Signaling voice dùng chung cho mọi zone: các phòng con đều kế thừa SakuraRoom. */
  private voice?: VoiceRelay;
  /** Chỉ có ở phòng phố: hôn trên ghế đá, đấm người đứng gần. */
  private social?: ReturnType<typeof createStreetSocial>;

  static async onAuth(token: string | undefined, options: { token?: string; fromRoomId?: string; fromZone?: WorldZone } = {}): Promise<PlayerIdentity> {
    if (options.fromRoomId) {
      const loungeRooms = await matchMaker.query({ name: LOUNGE_ROOM_NAME });
      if (loungeRooms.some(room => room.roomId === options.fromRoomId)) options.fromZone = 'lounge';
      const hotelRooms = await matchMaker.query({ name: HOTEL_ROOM_NAME });
      if (hotelRooms.some(room => room.roomId === options.fromRoomId)) options.fromZone = 'hotel';
      const kohakuRooms = await matchMaker.query({ name: KOHAKU_ROOM_NAME });
      if (kohakuRooms.some(room => room.roomId === options.fromRoomId)) options.fromZone = 'kohaku';
      const gekkaRooms = await matchMaker.query({ name: GEKKA_ROOM_NAME });
      if (gekkaRooms.some(room => room.roomId === options.fromRoomId)) options.fromZone = 'gekka';
      return verifyRoomTransfer(token, options, 'street');
    }
    const identity = await verifyDemoToken(token || options?.token);
    // Không cho bỏ fromRoomId để giả làm phiên mới rồi vượt qua kiểm tra cửa EXIT.
    const interiors = [
      ...(await matchMaker.query({ name: CLUB_ROOM_NAME })),
      ...(await matchMaker.query({ name: LOUNGE_ROOM_NAME })),
      ...(await matchMaker.query({ name: HOTEL_ROOM_NAME })),
      ...(await matchMaker.query({ name: KOHAKU_ROOM_NAME })),
      ...(await matchMaker.query({ name: GEKKA_ROOM_NAME })),
    ];
    for (const interior of interiors) {
      if (await matchMaker.remoteRoomCall(interior.roomId, 'containsPlayer', [identity.id])) throw new Error('Leave through the club exit');
    }
    return identity;
  }
  /** Hook cho phòng con: trả chuỗi lỗi để từ chối cho ngồi; mặc định cho phép mọi ghế. */
  protected canTakeSeat(_seatId: string): string | null { return null; }
  /** Phòng con chặn thao tác tự đứng dậy khi máy chủ đang giữ người chơi ở ghế hoặc cột. */
  protected canReleaseSeat(_sessionId: string): boolean { return true; }
  /** Hook cho phòng con: người đang bị NPC dắt đi (vd. đao phủ Gekkarō) không tự đi, ngồi hay qua cổng được. */
  protected isInputLocked(_sessionId: string): boolean { return false; }
  protected clearPlayerInput(sessionId: string): void { this.inputs.delete(sessionId); this.lastInput.delete(sessionId); }
  /** Hook cho phòng con: gọi khi người chơi đứng dậy hoặc rời phòng, TRƯỚC khi seatId/player bị xóa. */
  protected onSeatReleased(_sessionId: string): void {}
  onCreate(): void {
    this.state.zone = this.zone;
    this.state.danceEpoch = Date.now();
    this.setPatchRate(GAME_PATCH_MS);
    this.setSimulationInterval((dt: number) => {
      this.state.players.forEach((player, sessionId) => {
        const input = this.inputs.get(sessionId);
        // Ngừng di chuyển khi client không gửi input, mất kết nối hoặc ẩn tab (timeout an toàn 600ms chống drop do giật nhịp mạng).
        if (input && Date.now() - (this.lastInput.get(sessionId) ?? 0) < 600) applyMovement(player, input, dt / 1000, this.zone);
      });
      // Mốc mô phỏng luôn đổi để patch vẫn đến khi đứng yên; client không dùng nhịp nhận gói làm nhịp di chuyển.
      this.state.simulationTime += dt;
    }, GAME_TICK_MS);

    this.onMessage('move', (client, payload: unknown) => {
      if (this.state.players.get(client.sessionId)?.seatId || this.isInputLocked(client.sessionId)) return;
      const input = normalizeMoveInput(payload);
      if (!input) return;
      const now = Date.now();
      // Cho phép cập nhật hướng đi nhạy bén (tối thiểu 15ms), tránh drop packet khi người chơi đổi phím rẽ hoặc đi chéo
      if ((input.x !== 0 || input.z !== 0) && now - (this.lastInput.get(client.sessionId) ?? 0) < 15) return;
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
      const seats = getZoneSeats(this.zone);
      if (!seats.length || !player || !payload || typeof payload !== 'object') return;
      const seatId = (payload as { seatId?: unknown }).seatId;
      if (typeof seatId !== 'string' || seatId.length > 32) return;
      if (seatId === '' && player.seatId) {
        const seat = seats.find(item => item.id === player.seatId);
        if (!seat) return;
        if (!this.canReleaseSeat(client.sessionId)) {
          client.send('interaction-error', { text: 'Bạn đang bị giữ ở hầm, không thể tự đứng dậy.' }); return;
        }
        // Phải báo trước khi xóa seatId: engine nhận diện người chơi qua ghế đang ngồi.
        this.onSeatReleased(client.sessionId);
        player.seatId = ''; player.x = seat.standX; player.z = seat.standZ;
        this.inputs.delete(client.sessionId);
        return;
      }
      if (player.seatId || this.isInputLocked(client.sessionId)) return;
      const seat = seats.find(item => item.id === seatId);
      if (seat && 'npcOnly' in seat && seat.npcOnly) {
        client.send('interaction-error', { text: 'Ghế này dành riêng cho Dealer NPC.' }); return;
      }
      if (!seat || Math.hypot(player.x - seat.x, player.z - seat.z) > SEAT_REACH || (this.zone === 'kohaku' && player.y > 1.5) || (this.zone === 'gekka' && player.y < -1)) {
        client.send('interaction-error', { text: 'Hãy đứng sát ghế để ngồi.' }); return;
      }
      if (Array.from(this.state.players.values()).some(other => other.seatId === seatId)) {
        client.send('interaction-error', { text: 'Ghế này đang có người ngồi.' }); return;
      }
      const seatError = this.canTakeSeat(seat.id);
      if (seatError) { client.send('interaction-error', { text: seatError }); return; }
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
    this.voice = new VoiceRelay({
      zone: this.zone,
      getPlayer: sessionId => this.state.players.get(sessionId),
      getClient: sessionId => this.clients.getById(sessionId),
    });
    if (this.zone === 'street') {
      const social = createStreetSocial({
        players: () => this.state.players.entries(),
        broadcast: (type, payload) => this.broadcast(type, payload),
        schedule: (ms, run) => { this.clock.setTimeout(run, ms); },
        walkable: isWalkable,
      });
      this.social = social;
      const reply = (client: Client, error: string | null) => { if (error) client.send('interaction-error', { text: error }); };
      this.onMessage(STREET_SOCIAL_MESSAGES.kiss, client => reply(client, social.kiss(client.sessionId, Date.now())));
      this.onMessage(STREET_SOCIAL_MESSAGES.punch, client => {
        reply(client, social.punch(client.sessionId, Date.now()));
        // Đứng lại ra đòn: bỏ ý định đi tiếp để cú đấm không trượt khỏi mục tiêu.
        this.inputs.delete(client.sessionId);
      });
    }
    this.onMessage(VOICE_MESSAGES.state, (client, payload: unknown) => { this.voice?.handleState(client, payload); });
    this.onMessage(VOICE_MESSAGES.signal, (client, payload: unknown) => { this.voice?.handleSignal(client, payload); });
    this.onMessage(VOICE_MESSAGES.report, (client, payload: unknown) => { this.voice?.handleReport(client, payload); });
  }
  /** RPC nội bộ phục vụ xác thực chuyển phòng; client không được gọi như một message tùy ý. */
  containsPlayer(userId: string): boolean {
    return Array.from(this.state.players.values()).some(player => player.id === userId);
  }
  canTransfer(userId: string, destination: WorldZone): boolean {
    if (destination === this.zone || !['street', 'club', 'lounge', 'hotel', 'kohaku', 'gekka'].includes(destination)) return false;
    // Cho phép chuyển giữa phố và nội thất, hoặc trực tiếp giữa tầng 1 Reika Lounge và tầng 2 Love Hotel qua cầu thang bộ.
    if (this.zone !== 'street' && destination !== 'street' && !(this.zone === 'lounge' && destination === 'hotel') && !(this.zone === 'hotel' && destination === 'lounge')) return false;
    const entry = Array.from(this.state.players.entries()).find(([, p]) => p.id === userId);
    if (!entry || entry[1].seatId || this.isInputLocked(entry[0]) || !canUsePortal(this.zone, entry[1].x, entry[1].z, destination, entry[1].y)) return false;
    this.inputs.delete(entry[0]);
    return true;
  }
  /** Danh tính lấy từ JWT; ngoại hình chỉ nhận ID trong catalog, không nhận đường dẫn model do client cung cấp. */
  onJoin(client: Client, options: { fromRoomId?: string; fromZone?: WorldZone; characterId?: unknown }, identity?: PlayerIdentity): void {
    if (!identity) throw new Error('Authentication required');
    const characterId = options?.characterId ?? DEFAULT_PLAYER_CHARACTER;
    if (!isPlayerCharacterId(characterId)) throw new Error('Unknown player character');
    const duplicate = Array.from(this.state.players.values()).some(p => p.id === identity.id);
    if (duplicate) throw new Error('Already connected in this room');
    const player = new PlayerState();
    player.id = identity.id; player.name = identity.name;
    player.characterId = characterId;
    player.x = (this.state.players.size % 3) * 1.4 - 1.4;
    if (this.zone === 'club') {
      player.z = 2.5;
      player.yaw = 0;
    }
    if (this.zone === 'lounge') {
      if (options?.fromZone === 'hotel') {
        // Đi từ phòng 201 Love Hotel ra: xuất hiện trên chiếu nghỉ tầng 2, quay mặt nhìn về phía cầu thang
        player.x = 5.3;
        player.y = 2.32;
        player.z = 5.0;
        player.yaw = Math.PI;
      } else {
        player.z = 2.2;
        player.yaw = 0;
      }
    }
    if (this.zone === 'hotel') {
      player.x = (this.state.players.size % 3) * 0.8 - 0.4;
      player.z = 2.4;
      player.yaw = 0;
    }
    if (this.zone === 'kohaku') {
      player.x = (this.state.players.size % 3) * 0.8 - 0.4;
      player.z = 5.6;
      player.yaw = Math.PI;
    }
    if (this.zone === 'gekka') {
      player.x = (this.state.players.size % 3) * 0.8 - 0.4;
      player.z = 5.6;
      player.yaw = Math.PI;
    }
    if (this.zone === 'street' && options?.fromRoomId) {
      if (options.fromZone === 'club') {
        player.x = 2.8; player.z = 1.0; player.yaw = -Math.PI / 2;
      } else if (options.fromZone === 'lounge') {
        player.x = -2.8; player.z = -7.0; player.yaw = Math.PI / 2;
      } else if (options.fromZone === 'hotel') {
        player.x = -2.8; player.z = -9.6; player.yaw = Math.PI / 2;
      } else if (options.fromZone === 'kohaku') {
        player.x = -2.8; player.z = -15.0; player.yaw = Math.PI / 2;
      } else if (options.fromZone === 'gekka') {
        player.x = 2.8; player.z = -15.0; player.yaw = -Math.PI / 2;
      }
    }
    this.state.players.set(client.sessionId, player);
  }
  onLeave(client: Client): void {
    // Báo trước khi xóa player để hook còn đọc được seatId của người rời.
    this.onSeatReleased(client.sessionId);
    this.state.players.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.lastInput.delete(client.sessionId);
    this.lastChat.delete(client.sessionId);
    this.voice?.forget(client.sessionId);
    this.social?.forget(client.sessionId);
  }
}
