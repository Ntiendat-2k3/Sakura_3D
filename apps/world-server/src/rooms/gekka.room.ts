/** Phòng Gekkarō nối engine Poker với Colyseus; bài tẩy luôn gửi riêng cho từng client. */
import { type Client } from '@colyseus/core';
import {
  GAME_TICK_MS, GEKKA_BASEMENT_Y, GEKKA_SEATS, POKER_MESSAGES, POKER_SEATS,
  createEmptyPokerTable, type GekkaEscortPose, type PokerCard, type WorldZone,
} from '@metaverse/game-protocol';
import { SakuraRoom } from './sakura.room';
import { verifyRoomTransfer } from '../security/verify-room-transfer';
import { createGekkaPoker } from '../systems/gekkaPoker';
import { syncPokerSchema } from '../systems/syncPokerSchema';

export class GekkaRoom extends SakuraRoom {
  protected zone: WorldZone = 'gekka';
  maxClients = 16;
  private poker?: ReturnType<typeof createGekkaPoker>;
  private syncPoker = () => {};

  static async onAuth(token: string | undefined, options: { token?: string; fromRoomId?: string; fromZone?: WorldZone } = {}) {
    return verifyRoomTransfer(token, options, 'gekka');
  }

  onCreate(): void {
    super.onCreate();
    const view = createEmptyPokerTable();
    const engine = createGekkaPoker(view, {
      seated: () => Array.from(this.state.players.entries())
        .filter(([, player]) => POKER_SEATS.includes(player.seatId))
        .map(([sessionId, player]) => ({ sessionId, seatId: player.seatId })),
      sendHole: (sessionId: string, cards: PokerCard[]) => {
        this.clients.find(client => client.sessionId === sessionId)?.send(POKER_MESSAGES.hole, cards);
      },
      standUp: (sessionId: string) => {
        const player = this.state.players.get(sessionId);
        const seat = GEKKA_SEATS.find(item => item.id === player?.seatId);
        if (!player || !seat) return;
        player.seatId = ''; player.x = seat.standX; player.z = seat.standZ; player.y = seat.y;
        this.clearPlayerInput(sessionId);
      },
      capture: (sessionId: string, slot: string) => {
        const player = this.state.players.get(sessionId);
        const seat = GEKKA_SEATS.find(item => item.id === slot);
        if (!player || !seat) return;
        player.seatId = slot; player.x = seat.x; player.y = GEKKA_BASEMENT_Y;
        player.z = seat.z; player.yaw = seat.yaw;
        this.clearPlayerInput(sessionId);
      },
      escort: (sessionId, pose) => this.applyEscortPose(sessionId, pose),
      release: (sessionId: string, destination: 'table' | 'exit', seatId: string) => {
        const player = this.state.players.get(sessionId);
        const seat = GEKKA_SEATS.find(item => item.id === (destination === 'table' ? seatId : 'gekka-post'));
        if (!player || !seat) return;
        player.seatId = destination === 'table' ? seatId : '';
        player.x = destination === 'table' ? seat.x : seat.standX;
        player.z = destination === 'table' ? seat.z : seat.standZ;
        player.y = destination === 'table' ? 0 : GEKKA_BASEMENT_Y;
        player.yaw = seat.yaw;
        this.clearPlayerInput(sessionId);
      },
    });
    this.poker = engine;
    this.syncPoker = () => syncPokerSchema(this.state.poker, view);
    this.syncPoker();

    this.onMessage(POKER_MESSAGES.ready, (client, payload: unknown) => {
      if (typeof payload !== 'boolean') return;
      engine.ready(client.sessionId, payload, Date.now()); this.syncPoker();
    });
    this.onMessage(POKER_MESSAGES.act, (client, payload: unknown) => {
      if (!payload || typeof payload !== 'object') return;
      engine.act(client.sessionId, payload, Date.now()); this.syncPoker();
    });
    this.onMessage(POKER_MESSAGES.choose, (client, payload: unknown) => {
      if (!payload || typeof payload !== 'object') return;
      engine.choose(client.sessionId, payload, Date.now()); this.syncPoker();
    });
    this.onMessage(POKER_MESSAGES.taunt, (client, payload: unknown) => {
      if (!payload || typeof payload !== 'object') return;
      const senderSeatId = this.state.players.get(client.sessionId)?.seatId ?? '';
      const fx = engine.taunt(client.sessionId, senderSeatId, payload, Date.now());
      if (fx) this.broadcast(POKER_MESSAGES.tauntFx, fx);
    });
    this.clock.setInterval(() => { engine.tick(Date.now()); this.syncPoker(); }, GAME_TICK_MS);
  }

  onJoin(client: Client, options: { fromRoomId?: string; fromZone?: WorldZone; characterId?: unknown }, identity?: Parameters<SakuraRoom['onJoin']>[2]): void {
    super.onJoin(client, options, identity);
    client.send(POKER_MESSAGES.hole, this.poker?.holeOf(client.sessionId) ?? []);
  }

  protected canTakeSeat(seatId: string): string | null {
    return POKER_SEATS.includes(seatId) && this.poker?.isSeatLocked() ? 'Ván đang diễn ra, hãy chờ ván sau.' : null;
  }

  protected canReleaseSeat(sessionId: string): boolean {
    return !this.poker?.isCaptive(sessionId);
  }

  /** Đao phủ dắt người: rời ghế để client nội suy như đang đi bộ; input đã bị khóa vì người này là captive. */
  private applyEscortPose(sessionId: string, pose: GekkaEscortPose): void {
    const player = this.state.players.get(sessionId);
    if (!player) return;
    player.seatId = ''; player.x = pose.x; player.y = pose.y; player.z = pose.z; player.yaw = pose.yaw;
    this.clearPlayerInput(sessionId);
  }

  protected isInputLocked(sessionId: string): boolean {
    return !!this.poker?.isCaptive(sessionId);
  }

  protected onSeatReleased(sessionId: string): void {
    this.poker?.leave(sessionId, Date.now());
    this.syncPoker();
  }
}
