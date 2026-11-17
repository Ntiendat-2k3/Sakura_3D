/**
 * Phòng Câu Lạc Bộ VIP 琥珀 (Kohaku Private Members Club) Tầng 1:
 * Không gian riêng tư, bàn tròn poker/casino trung tâm cho 4 người chơi + NPC chia bài, quầy whisky và sofa sang trọng.
 * Bàn tròn chạy Kohaku Bluff: luật nằm ở systems/kohakuBluff, room chỉ nối message, ghế và schema.
 */
import { type Client } from '@colyseus/core';
import { BLUFF_MESSAGES, BLUFF_SEATS, GAME_TICK_MS, KOHAKU_JUMP_MESSAGE, createEmptyBluffTable, getZoneSeats, type BluffCard, type WorldZone } from '@metaverse/game-protocol';
import { SakuraRoom } from './sakura.room';
import { verifyRoomTransfer } from '../security/verify-room-transfer';
import { createKohakuBluff } from '../systems/kohakuBluff';
import { createKohakuJumps } from '../systems/kohakuJump';
import { syncBluffSchema } from '../systems/syncBluffSchema';

export class KohakuRoom extends SakuraRoom {
  protected zone: WorldZone = 'kohaku';
  maxClients = 16;
  private bluff?: ReturnType<typeof createKohakuBluff>;
  private syncBluff = () => {};
  private jumps = createKohakuJumps(sessionId => this.state.players.get(sessionId));

  static async onAuth(token: string | undefined, options: { token?: string; fromRoomId?: string; fromZone?: WorldZone } = {}) {
    return verifyRoomTransfer(token, options, 'kohaku');
  }

  onCreate(): void {
    super.onCreate();
    const view = createEmptyBluffTable();
    const engine = createKohakuBluff(view, {
      seated: () => Array.from(this.state.players.entries())
        .filter(([, p]) => BLUFF_SEATS.includes(p.seatId))
        .map(([sessionId, p]) => ({ sessionId, seatId: p.seatId })),
      // Bài chỉ gửi riêng cho đúng client, không bao giờ đi qua schema.
      sendHand: (sessionId: string, cards: BluffCard[]) => {
        this.clients.find(c => c.sessionId === sessionId)?.send(BLUFF_MESSAGES.hand, cards);
      },
      // Không gọi onSeatReleased: engine đã biết người này rời ghế và tự chặn gọi lặp.
      standUp: (sessionId: string) => {
        const player = this.state.players.get(sessionId);
        const seat = getZoneSeats(this.zone).find(s => s.id === player?.seatId);
        if (!player || !seat) return;
        player.seatId = ''; player.x = seat.standX; player.z = seat.standZ;
      },
    });
    this.bluff = engine;
    this.syncBluff = () => syncBluffSchema(this.state.bluff, view);
    this.syncBluff();

    // Engine tự kiểm tra payload; ở đây chỉ chặn kiểu sai ngay từ cửa vào.
    this.onMessage(BLUFF_MESSAGES.ready, (client, payload: unknown) => {
      if (typeof payload !== 'boolean') return;
      engine.ready(client.sessionId, payload, Date.now()); this.syncBluff();
    });
    this.onMessage(BLUFF_MESSAGES.play, (client, payload: unknown) => {
      if (!payload || typeof payload !== 'object') return;
      engine.play(client.sessionId, payload, Date.now()); this.syncBluff();
    });
    this.onMessage(BLUFF_MESSAGES.liar, (client) => {
      engine.callLiar(client.sessionId, Date.now()); this.syncBluff();
    });
    // Cà khịa không đổi bàn nên không cần syncBluff; người vào sau cũng không cần thấy lại.
    this.onMessage(BLUFF_MESSAGES.taunt, (client, payload: unknown) => {
      if (!payload || typeof payload !== 'object') return;
      const fx = engine.taunt(client.sessionId, payload, Date.now());
      if (fx) this.broadcast(BLUFF_MESSAGES.tauntFx, fx);
    });
    this.clock.setInterval(() => { engine.tick(Date.now()); this.syncBluff(); }, GAME_TICK_MS);

    // Không nhận payload: điểm nhảy do server suy ra từ vị trí authoritative.
    this.onMessage(KOHAKU_JUMP_MESSAGE, client => {
      const error = this.jumps.start(client.sessionId, Date.now());
      if (error) { client.send('interaction-error', { text: error }); return; }
      if (this.jumps.isJumping(client.sessionId)) this.clearPlayerInput(client.sessionId);
    });
    this.clock.setInterval(() => this.jumps.tick(Date.now()), GAME_TICK_MS);
  }

  /** Đang bay thì không đi, ngồi hay qua cổng được (canTransfer và message seat đều hỏi hook này). */
  protected isInputLocked(sessionId: string): boolean { return this.jumps.isJumping(sessionId); }

  onLeave(client: Client): void {
    this.jumps.forget(client.sessionId);
    super.onLeave(client);
  }

  /** Người vào phòng không thể đang ngồi ghế nên bài rỗng; ghế bị khóa khi ván đang chạy chặn họ chen vào. */
  onJoin(client: Client, options: { fromRoomId?: string; fromZone?: WorldZone; characterId?: unknown }, identity?: Parameters<SakuraRoom['onJoin']>[2]): void {
    super.onJoin(client, options, identity);
    client.send(BLUFF_MESSAGES.hand, this.bluff?.handOf(client.sessionId) ?? []);
  }

  protected canTakeSeat(seatId: string): string | null {
    return BLUFF_SEATS.includes(seatId) && this.bluff?.isSeatLocked() ? 'Ván đang diễn ra, hãy chờ ván sau.' : null;
  }

  // Engine nhận diện người chơi qua seatId nên hook này được gọi trước khi seatId bị xóa.
  protected onSeatReleased(sessionId: string): void {
    this.bluff?.leave(sessionId, Date.now());
    this.syncBluff();
  }
}
