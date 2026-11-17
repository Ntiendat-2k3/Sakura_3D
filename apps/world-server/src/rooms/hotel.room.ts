import { getReikaTrack, type WorldZone } from '@metaverse/game-protocol';
import { SakuraRoom } from './sakura.room';
import { verifyRoomTransfer } from '../security/verify-room-transfer';

/** Phòng Cyberpunk Neon Love Hotel 20+: kế thừa movement, giường/bồn tắm Jacuzzi/ghế đôi, chat và hỗ trợ bật nhạc riêng tư theo yêu cầu. */
export class HotelRoom extends SakuraRoom {
  protected zone: WorldZone = 'hotel';
  maxClients = 8;
  onCreate(): void {
    super.onCreate();
    // Mặc định phòng Love Hotel giữ không gian riêng tư yên tĩnh; chỉ phát nhạc khi khách chọn bài.
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
        client.send('interaction-error', { text: 'Bài nhạc phòng nghỉ không hợp lệ.' });
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
    return verifyRoomTransfer(token, options, 'hotel');
  }
}
