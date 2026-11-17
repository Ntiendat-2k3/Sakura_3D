import { DEFAULT_REIKA_TRACK, getReikaTrack, type WorldZone } from '@metaverse/game-protocol';
import { SakuraRoom } from './sakura.room';
import { verifyRoomTransfer } from '../security/verify-room-transfer';

/** Phòng Reika Hostess Lounge: kế thừa movement, ghế ngồi, chat và hỗ trợ khách order nhạc phòng Reika. */
export class LoungeRoom extends SakuraRoom {
  protected zone: WorldZone = 'lounge';
  maxClients = 12;
  onCreate(): void {
    super.onCreate();
    // Phòng Reika Lounge ban đầu để không gian yên tĩnh trò chuyện; chỉ phát nhạc khi khách order.
    this.state.activeTrackId = '';
    this.state.showBpm = 0;
    this.state.showOffset = 0;
    this.state.showCue = 'lounge';
    this.state.danceEpoch = 0;
    let lastTrackChange = 0;
    this.onMessage('lounge-track', (client, id: unknown) => {
      if (Date.now() - lastTrackChange < 400) return;
      const track = getReikaTrack(id);
      if (!track) {
        client.send('interaction-error', { text: 'Bài nhạc Reika không hợp lệ.' });
        return;
      }
      lastTrackChange = Date.now();
      this.state.activeTrackId = track.id;
      this.state.showBpm = track.bpm;
      this.state.showOffset = track.beatOffsetSeconds;
      this.state.showCue = 'lounge';
      this.state.danceEpoch = lastTrackChange;
    });
  }
  static async onAuth(token: string | undefined, options: { token?: string; fromRoomId?: string; fromZone?: WorldZone } = {}) {
    return verifyRoomTransfer(token, options, 'lounge');
  }
}

