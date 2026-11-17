import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';
import { DEFAULT_CLUB_SHOW, DEFAULT_CLUB_TRACK, DEFAULT_PLAYER_CHARACTER, POKER_RULES, type DjPhase } from '@metaverse/game-protocol';
export class DjVisitState extends Schema {
  @type('string') phase: DjPhase = 'idle';
  @type('string') requesterId = '';
  @type('number') startedAt = 0;
  @type('number') playerX = 0;
  @type('number') playerZ = 0;
  @type('number') targetX = 0;
  @type('number') targetZ = -2;
  @type('number') returnDistance = 0;
}
export class PlayerState extends Schema {
  @type('string') id = '';
  @type('string') name = '';
  @type('number') x = 0;
  @type('number') y = 0;
  @type('number') z = 5;
  @type('number') yaw = 0;
  @type('string') seatId = '';
  @type('boolean') dancing = false;
  @type('string') danceStyle = 'normal';
  @type('string') characterId = DEFAULT_PLAYER_CHARACTER;
  /** Đã bật voice chat (đã đồng ý dùng micro); công khai để người gần biết có thể mở kết nối P2P. */
  @type('boolean') voice = false;
  /** Kohaku: id điểm nhảy khi đang nhảy từ ban công xuống tầng 1; rỗng khi không nhảy. */
  @type('string') jumpSpot = '';
}
/** Chỉ dữ liệu công khai của một ghế bàn Bluff; bài trên tay và vị trí đạn tuyệt đối không có ở đây. */
export class BluffSeatSchema extends Schema {
  @type('string') seatId = '';
  @type('string') sessionId = '';
  @type('boolean') ready = false;
  @type('boolean') inMatch = false;
  @type('boolean') alive = false;
  @type('number') cardCount = 0;
  @type('number') pulls = 0;
}
/** lastPlay được làm phẳng (lastPlaySeat/lastPlayCount/revealed) để schema không phải lồng thêm class. */
export class BluffTableSchema extends Schema {
  @type('string') phase = 'lobby';
  @type('string') tableRank = '';
  @type('string') turnSeat = '';
  @type('number') deadline = 0;
  @type('string') lastPlaySeat = '';
  @type('number') lastPlayCount = 0;
  @type(['string']) revealed = new ArraySchema<string>();
  @type('string') accuserSeat = '';
  @type('string') shooterSeat = '';
  @type('string') shotResult = '';
  @type('string') winnerSeat = '';
  @type([BluffSeatSchema]) seats = new ArraySchema<BluffSeatSchema>();
}
/** Trạng thái công khai của ghế Poker; bài tẩy chỉ được gửi riêng qua message. */
export class PokerSeatSchema extends Schema {
  @type('string') seatId = '';
  @type('string') sessionId = '';
  @type('boolean') ready = false;
  @type('boolean') inMatch = false;
  @type('boolean') out = false;
  @type('number') chips = 0;
  @type('number') bet = 0;
  @type('number') committed = 0;
  @type('boolean') folded = false;
  @type('boolean') allIn = false;
  @type('string') captive = 'none';
  @type('number') debt = 0;
  @type('string') lastAction = '';
}
export class PokerShowdownSchema extends Schema {
  @type('string') seatId = '';
  @type(['string']) cards = new ArraySchema<string>();
  @type('string') label = '';
  @type('number') won = 0;
}
export class DungeonSchema extends Schema {
  @type('string') phase = 'idle';
  @type('string') seatId = '';
  @type('number') punchesTotal = 0;
  @type('number') punchesDone = 0;
  @type('number') deadline = 0;
  @type('boolean') canBorrow = false;
}
/** Đao phủ đang lôi người thua sạch xuống hầm; lộ trình suy ra từ route nên chỉ cần gửi ghế và mốc bắt đầu. */
export class EscortSchema extends Schema {
  @type(['string']) route = new ArraySchema<string>();
  @type('number') startedAt = 0;
}
export class PokerTableSchema extends Schema {
  @type('string') phase = 'lobby';
  @type('string') street = 'preflop';
  @type('number') handNumber = 0;
  @type('string') buttonSeat = '';
  @type('string') turnSeat = '';
  @type('number') deadline = 0;
  @type(['string']) board = new ArraySchema<string>();
  @type('number') pot = 0;
  @type('number') currentBet = 0;
  @type('number') minRaise: number = POKER_RULES.bigBlind;
  @type('number') smallBlind: number = POKER_RULES.smallBlind;
  @type('number') bigBlind: number = POKER_RULES.bigBlind;
  @type([PokerShowdownSchema]) showdown = new ArraySchema<PokerShowdownSchema>();
  @type('string') winnerSeat = '';
  @type([PokerSeatSchema]) seats = new ArraySchema<PokerSeatSchema>();
  @type(DungeonSchema) dungeon = new DungeonSchema();
  @type(EscortSchema) escort = new EscortSchema();
}
export class CityState extends Schema {
  @type('string') activeTrackId = DEFAULT_CLUB_TRACK.id;
  @type(DjVisitState) dj = new DjVisitState();
  @type('string') zone = 'street';
  @type('number') simulationTime = 0;
  @type('number') danceEpoch = 0;
  @type('number') showBpm = DEFAULT_CLUB_SHOW.bpm;
  @type('number') showOffset = DEFAULT_CLUB_SHOW.offset;
  @type('string') showCue = DEFAULT_CLUB_SHOW.cue;
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type(BluffTableSchema) bluff = new BluffTableSchema();
  @type(PokerTableSchema) poker = new PokerTableSchema();
}
