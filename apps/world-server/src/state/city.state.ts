import { MapSchema, Schema, type } from '@colyseus/schema';
import { DEFAULT_CLUB_SHOW, DEFAULT_CLUB_TRACK, DEFAULT_PLAYER_CHARACTER, type DjPhase } from '@metaverse/game-protocol';
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
  @type('number') z = 5;
  @type('number') yaw = 0;
  @type('string') seatId = '';
  @type('boolean') dancing = false;
  @type('string') danceStyle = 'normal';
  @type('string') characterId = DEFAULT_PLAYER_CHARACTER;
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
}
