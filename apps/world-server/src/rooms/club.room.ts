import { GAME_TICK_MS, validateClubShow, type WorldZone } from '@metaverse/game-protocol';
import { createClubDj } from '../systems/clubDj';
import { SakuraRoom } from './sakura.room';
import { verifyRoomTransfer } from '../security/verify-room-transfer';

/** Dùng lại movement/chat/lifecycle, tách room club và kiểm tra cửa trước khi nhận khách. */
export class ClubRoom extends SakuraRoom {
  protected zone: WorldZone = 'club';
  maxClients = 12;
  onCreate(): void {
    super.onCreate();
    const dj = createClubDj(this.state.dj, this.state.players, (track, now) => {
      this.state.activeTrackId = track.id;
      this.state.showBpm = track.bpm; this.state.showOffset = track.beatOffsetSeconds; this.state.showCue = 'auto';
      this.state.danceEpoch = now;
    });
    this.onMessage('dj-hold', (client, held: unknown) => dj.hold(client.sessionId, held, Date.now()));
    this.onMessage('dj-cancel', client => dj.cancel(client.sessionId, Date.now()));
    this.onMessage('dj-track', (client, id: unknown) => {
      if (!dj.select(client.sessionId, id, Date.now())) client.send('interaction-error', { text: 'Hãy chờ DJ đến gặp bạn rồi chọn bài trong danh sách.' });
    });
    this.clock.setInterval(() => dj.tick(Date.now()), GAME_TICK_MS);
    let lastChange = 0;
    this.onMessage('club-show', (client, payload: unknown) => {
      // Khách vào đầu tiên giữ bàn DJ của bản test; quyền tự chuyển khi khách đó rời phòng.
      if (this.clients[0]?.sessionId !== client.sessionId || Date.now() - lastChange < 1000) return;
      const show = validateClubShow(payload);
      if (!show) return;
      lastChange = Date.now();
      this.state.showBpm = show.bpm; this.state.showOffset = show.offset; this.state.showCue = show.cue;
      this.state.danceEpoch = Date.now();
    });
  }
  static async onAuth(token: string | undefined, options: { token?: string; fromRoomId?: string } = {}) {
    return verifyRoomTransfer(token, options, 'club');
  }
}
