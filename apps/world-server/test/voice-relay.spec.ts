import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VOICE_MESSAGES, VOICE_RANGE, VOICE_REPORT_MIN_INTERVAL_MS, VOICE_SIGNAL_RATE, type VoiceSignalInput } from '@metaverse/game-protocol';
import { ClubRoom } from '../src/rooms/club.room';
import { PlayerState } from '../src/state/city.state';
import { TokenBucket, VoiceRelay, authorizeVoiceRelay, type VoiceClient, type VoicePlayer, type VoiceReportLog } from '../src/systems/voiceRelay';

const player = (id: string, x: number, z: number, voice = true, y = 0): VoicePlayer => ({ id, name: `Tên ${id}`, x, y, z, voice });
const offer = (to: string): VoiceSignalInput => ({ kind: 'offer', to, sdp: 'v=0' });

function setup(players: Record<string, VoicePlayer>, clock = { now: 0 }) {
  const inbox: Record<string, { type: string; payload: unknown }[]> = {};
  const client = (sessionId: string): VoiceClient => ({ sessionId, send: (type, payload) => { (inbox[sessionId] ??= []).push({ type, payload }); } });
  const reports: VoiceReportLog[] = [];
  const relay = new VoiceRelay({
    zone: 'street',
    getPlayer: id => players[id],
    getClient: id => players[id] ? client(id) : undefined,
    now: () => clock.now,
    logReport: entry => reports.push(entry),
  });
  return { relay, inbox, client, reports, clock };
}

test('chỉ chuyển tín hiệu khi cả hai bật voice và ở trong bán kính relay', () => {
  const a = player('ua', 0, 0);
  assert.equal(authorizeVoiceRelay('a', offer('b'), a, player('ub', VOICE_RANGE.relay - 0.1, 0)), null);
  assert.equal(authorizeVoiceRelay('a', offer('b'), a, player('ub', VOICE_RANGE.relay + 0.1, 0)), 'out-of-range');
  // Khác tầng (Kohaku 3 tầng): khoảng cách tính cả độ cao.
  assert.equal(authorizeVoiceRelay('a', offer('b'), a, player('ub', 12, 0, true, 12)), 'out-of-range');
  assert.equal(authorizeVoiceRelay('a', offer('b'), a, player('ub', 1, 0, false)), 'target-voice-off');
  assert.equal(authorizeVoiceRelay('a', offer('b'), player('ua', 0, 0, false), player('ub', 1, 0)), 'sender-voice-off');
  assert.equal(authorizeVoiceRelay('a', offer('a'), a, a), 'self');
  assert.equal(authorizeVoiceRelay('a', offer('b'), a, undefined), 'no-target');
  assert.equal(authorizeVoiceRelay('a', offer('b'), undefined, a), 'no-sender');
  // bye dọn kết nối kể cả khi đã ra xa hoặc vừa tắt voice.
  assert.equal(authorizeVoiceRelay('a', { kind: 'bye', to: 'b' }, player('ua', 0, 0, false), player('ub', 99, 0, false)), null);
});

test('relay gắn from theo sessionId của server và bỏ trường lạ', () => {
  const { relay, inbox, client } = setup({ a: player('ua', 0, 0), b: player('ub', 2, 0) });
  assert.equal(relay.handleSignal(client('a'), { to: 'b', kind: 'offer', sdp: 'v=0', from: 'c', secret: 1 }), null);
  assert.deepEqual(inbox.b, [{ type: VOICE_MESSAGES.signal, payload: { kind: 'offer', sdp: 'v=0', from: 'a' } }]);
  assert.equal(relay.handleSignal(client('a'), { to: 'b', kind: 'offer', sdp: 42 }), 'invalid');
  assert.equal(relay.handleSignal(client('a'), { to: 'nobody', kind: 'offer', sdp: 'v=0' }), 'no-target');
  assert.equal(inbox.b.length, 1);
});

test('giới hạn tốc độ signaling theo từng người gửi rồi hồi dần', () => {
  const { relay, client, clock } = setup({ a: player('ua', 0, 0), b: player('ub', 2, 0) });
  for (let i = 0; i < VOICE_SIGNAL_RATE.burst; i++) assert.equal(relay.handleSignal(client('a'), offer('b')), null);
  assert.equal(relay.handleSignal(client('a'), offer('b')), 'rate-limited');
  // Người khác không bị ảnh hưởng.
  assert.equal(relay.handleSignal(client('b'), offer('a')), null);
  clock.now += 1000;
  for (let i = 0; i < VOICE_SIGNAL_RATE.perSecond; i++) assert.equal(relay.handleSignal(client('a'), offer('b')), null);
  assert.equal(relay.handleSignal(client('a'), offer('b')), 'rate-limited');
  const bucket = new TokenBucket(2, 1, 0);
  assert.equal(bucket.take(0), true); assert.equal(bucket.take(0), true); assert.equal(bucket.take(0), false);
  assert.equal(bucket.take(1000), true);
});

test('bật/tắt voice có giới hạn tần suất và payload phải đúng kiểu', () => {
  const players = { a: player('ua', 0, 0, false) };
  const { relay, client, clock } = setup(players, { now: 10_000 });
  assert.equal(relay.handleState(client('a'), { enabled: 'true' }), false);
  assert.equal(relay.handleState(client('a'), { enabled: true }), true);
  assert.equal(players.a.voice, true);
  assert.equal(relay.handleState(client('a'), { enabled: false }), false);
  clock.now += 600;
  assert.equal(relay.handleState(client('a'), { enabled: false }), true);
  assert.equal(players.a.voice, false);
});

test('báo cáo được ghi log server kèm danh tính do server biết, có cooldown', () => {
  const { relay, client, inbox, reports, clock } = setup({ a: player('ua', 0, 0), b: player('ub', 50, 0) }, { now: 1_000_000 });
  assert.equal(relay.handleReport(client('a'), { target: 'a', reason: 'tự báo' }), false);
  assert.equal(relay.handleReport(client('a'), { target: 'zzz', reason: 'x' }), false);
  assert.equal(relay.handleReport(client('a'), { target: 'b', reason: 'chửi bậy' }), true);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].reporterId, 'ua');
  assert.equal(reports[0].targetId, 'ub');
  assert.equal(reports[0].reason, 'chửi bậy');
  assert.equal(inbox.a.at(-1)?.type, VOICE_MESSAGES.reportAck);
  assert.equal(relay.handleReport(client('a'), { target: 'b', reason: 'lần nữa' }), false);
  clock.now += VOICE_REPORT_MIN_INTERVAL_MS;
  assert.equal(relay.handleReport(client('a'), { target: 'b', reason: 'lần nữa' }), true);
});

test('phòng con (Club) kế thừa signaling voice dùng vị trí trong state', () => {
  const room = new ClubRoom();
  const messages = new Map<string, (client: VoiceClient, payload: unknown) => void>();
  (room as unknown as { onMessage: (type: string, handler: (client: VoiceClient, payload: unknown) => void) => void }).onMessage =
    (type, handler) => { messages.set(type, handler); };
  room.onCreate();
  const received: unknown[] = [];
  const a = new PlayerState(); a.id = 'ua'; a.x = 0; a.z = 0;
  const b = new PlayerState(); b.id = 'ub'; b.x = 3; b.z = 0;
  room.state.players.set('a', a); room.state.players.set('b', b);
  const clientA: VoiceClient = { sessionId: 'a', send: () => {} };
  const clientB = { sessionId: 'b', send: (_type: string, payload: unknown) => { received.push(payload); } };
  (room.clients as unknown as VoiceClient[]).push(clientA, clientB);
  messages.get(VOICE_MESSAGES.state)!(clientA, { enabled: true });
  messages.get(VOICE_MESSAGES.signal)!(clientA, offer('b'));
  assert.equal(a.voice, true);
  assert.equal(received.length, 0, 'người nhận chưa bật voice');
  messages.get(VOICE_MESSAGES.state)!(clientB, { enabled: true });
  messages.get(VOICE_MESSAGES.signal)!(clientA, offer('b'));
  assert.deepEqual(received, [{ kind: 'offer', sdp: 'v=0', from: 'a' }]);
  b.x = VOICE_RANGE.relay + 1;
  messages.get(VOICE_MESSAGES.signal)!(clientA, offer('b'));
  assert.equal(received.length, 1, 'ra ngoài tầm thì không chuyển');
  room.setSimulationInterval(undefined);
  room.setPatchRate(null);
  room.clock.clear();
  room.clock.stop();
});
