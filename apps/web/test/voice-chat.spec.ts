import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VOICE_MAX_PEERS, VOICE_RANGE, type PositionSnapshot, type VoiceSignalInput } from '@metaverse/game-protocol';
import { canAcceptVoiceOffer, isVoiceInitiator, selectVoicePeers } from '../game/systems/voicePeers';
import { classifyMediaError, isTypingTarget, loadVoiceIds, loadVoiceMode, parseIceServers, saveVoiceIds, shouldTransmit, voiceSupport, VOICE_STORAGE_KEYS } from '../game/systems/voiceControls';
import { resolveServiceUrls } from '../game/networking/serviceUrls';
import { VoiceChatEngine } from '../game/systems/VoiceChatEngine';

const at = (id: string, x: number, voice = true, z = 0): PositionSnapshot => ({ id: `user-${id}`, name: id, x, z, yaw: 0, voice });

test('chọn peer trong tầm kết nối, giữ peer cũ tới ngưỡng ngắt (hysteresis)', () => {
  const players = { a: at('a', 0), b: at('b', VOICE_RANGE.connect - 1), c: at('c', VOICE_RANGE.connect + 1), d: at('d', 1, false) };
  assert.deepEqual([...selectVoicePeers({ selfSessionId: 'a', players, current: new Set(), blocked: new Set() })], ['b']);
  // c nằm giữa connect và disconnect: chỉ giữ nếu đã mở từ trước.
  assert.deepEqual([...selectVoicePeers({ selfSessionId: 'a', players, current: new Set(['c']), blocked: new Set() })].sort(), ['b', 'c']);
  players.c = at('c', VOICE_RANGE.disconnect + 0.5);
  assert.deepEqual([...selectVoicePeers({ selfSessionId: 'a', players, current: new Set(['c']), blocked: new Set() })], ['b']);
  // Mình chưa bật voice thì không kết nối ai; người bị chặn không bao giờ được chọn.
  assert.equal(selectVoicePeers({ selfSessionId: 'a', players: { ...players, a: at('a', 0, false) }, current: new Set(), blocked: new Set() }).size, 0);
  assert.equal(selectVoicePeers({ selfSessionId: 'a', players, current: new Set(['b']), blocked: new Set(['user-b']) }).size, 0);
});

test('giới hạn số peer, ưu tiên người gần và peer đang mở', () => {
  const players: Record<string, PositionSnapshot> = { self: at('self', 0) };
  for (let i = 0; i < VOICE_MAX_PEERS + 4; i++) players[`p${String(i).padStart(2, '0')}`] = at(`p${i}`, 1 + i * 0.5);
  const chosen = selectVoicePeers({ selfSessionId: 'self', players, current: new Set(), blocked: new Set() });
  assert.equal(chosen.size, VOICE_MAX_PEERS);
  assert.ok(chosen.has('p00') && !chosen.has(`p${VOICE_MAX_PEERS + 3}`));
  const capped = selectVoicePeers({ selfSessionId: 'self', players: { self: at('self', 0), near: at('near', 1), far: at('far', 2.5) }, current: new Set(['far']), blocked: new Set(), maxPeers: 1 });
  // far đang mở được trừ biên hysteresis (2 m) nên không bị near (gần hơn 1.5 m) giành chỗ qua lại.
  assert.deepEqual([...capped], ['far']);
});

test('bên gọi xác định duy nhất và bên nhận dùng ngưỡng rộng nhưng vẫn tôn trọng chặn/giới hạn', () => {
  assert.equal(isVoiceInitiator('a', 'b'), true);
  assert.equal(isVoiceInitiator('b', 'a'), false);
  const players = { a: at('a', 0), b: at('b', VOICE_RANGE.disconnect - 0.5), c: at('c', VOICE_RANGE.disconnect + 0.5) };
  const base = { selfSessionId: 'b', players, current: new Set<string>(), blocked: new Set<string>() };
  assert.equal(canAcceptVoiceOffer(base, 'a'), true);
  assert.equal(canAcceptVoiceOffer({ ...base, selfSessionId: 'a' }, 'c'), false);
  assert.equal(canAcceptVoiceOffer({ ...base, blocked: new Set(['user-a']) }, 'a'), false);
  assert.equal(canAcceptVoiceOffer({ ...base, current: new Set(['x']), maxPeers: 1 }, 'a'), false);
  assert.equal(canAcceptVoiceOffer({ ...base, current: new Set(['a']), maxPeers: 1 }, 'a'), true);
});

test('push-to-talk, tự tắt mic và không bắt phím khi đang gõ', () => {
  assert.equal(shouldTransmit({ enabled: true, mode: 'push-to-talk', pttHeld: false, selfMuted: false }), false);
  assert.equal(shouldTransmit({ enabled: true, mode: 'push-to-talk', pttHeld: true, selfMuted: false }), true);
  assert.equal(shouldTransmit({ enabled: true, mode: 'open-mic', pttHeld: false, selfMuted: false }), true);
  assert.equal(shouldTransmit({ enabled: true, mode: 'open-mic', pttHeld: true, selfMuted: true }), false);
  assert.equal(shouldTransmit({ enabled: false, mode: 'open-mic', pttHeld: true, selfMuted: false }), false);
  assert.equal(isTypingTarget({ tagName: 'INPUT' }), true);
  assert.equal(isTypingTarget({ tagName: 'TEXTAREA' }), true);
  assert.equal(isTypingTarget({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(isTypingTarget({ tagName: 'CANVAS' }), false);
  assert.equal(isTypingTarget(null), false);
});

test('lỗi micro và môi trường không hỗ trợ được phân loại cho HUD', () => {
  assert.equal(classifyMediaError({ name: 'NotAllowedError' }), 'denied');
  assert.equal(classifyMediaError({ name: 'NotFoundError' }), 'no-mic');
  assert.equal(classifyMediaError({ name: 'NotReadableError' }), 'busy');
  assert.equal(classifyMediaError(new Error('x')), 'error');
  assert.equal(voiceSupport({ isSecureContext: false, hasGetUserMedia: true, hasPeerConnection: true, hasAudioContext: true }), 'insecure');
  assert.equal(voiceSupport({ isSecureContext: true, hasGetUserMedia: false, hasPeerConnection: true, hasAudioContext: true }), 'unsupported');
  assert.equal(voiceSupport({ isSecureContext: true, hasGetUserMedia: true, hasPeerConnection: true, hasAudioContext: true }), null);
});

test('ICE servers mặc định rỗng, chỉ nhận URL stun/turn hợp lệ', () => {
  assert.deepEqual(parseIceServers(undefined), []);
  assert.deepEqual(parseIceServers(''), []);
  assert.deepEqual(parseIceServers('không phải json'), []);
  assert.deepEqual(parseIceServers('{"urls":"stun:x"}'), []);
  assert.deepEqual(parseIceServers('[{"urls":"stun:stun.example.org:3478"},{"urls":["turn:t.example.org"],"username":"u","credential":"p"},{"urls":"http://bad"},5]'),
    [{ urls: 'stun:stun.example.org:3478' }, { urls: ['turn:t.example.org'], username: 'u', credential: 'p' }]);
});

test('danh sách chặn/tắt tiếng chịu được localStorage lỗi', () => {
  const memory = new Map<string, string>();
  const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); } };
  saveVoiceIds(storage, VOICE_STORAGE_KEYS.blocked, new Set(['u1', 'u2']));
  assert.deepEqual([...loadVoiceIds(storage, VOICE_STORAGE_KEYS.blocked)], ['u1', 'u2']);
  const broken = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('QuotaExceeded'); } };
  assert.equal(loadVoiceIds(broken, VOICE_STORAGE_KEYS.blocked).size, 0);
  assert.doesNotThrow(() => saveVoiceIds(broken, VOICE_STORAGE_KEYS.blocked, new Set(['u'])));
  assert.equal(loadVoiceMode(broken), 'push-to-talk');
  memory.set(VOICE_STORAGE_KEYS.blocked, '{"not":"array"}');
  assert.equal(loadVoiceIds(storage, VOICE_STORAGE_KEYS.blocked).size, 0);
});

test('URL dịch vụ: env ưu tiên, trang https qua Tailscale tự dùng https/wss cùng host', () => {
  assert.deepEqual(resolveServiceUrls({}, undefined), { api: 'http://localhost:4000', world: 'ws://localhost:2567' });
  assert.deepEqual(resolveServiceUrls({}, { protocol: 'http:', hostname: '127.0.0.1' }), { api: 'http://127.0.0.1:4000', world: 'ws://127.0.0.1:2567' });
  assert.deepEqual(resolveServiceUrls({}, { protocol: 'https:', hostname: 'may-a.tail1234.ts.net' }), { api: 'https://may-a.tail1234.ts.net:8443', world: 'wss://may-a.tail1234.ts.net:10000' });
  // Env localhost cũ bị bỏ qua khi máy thứ hai mở trang qua tên Tailscale, và http/ws bị bỏ trên trang https (mixed content).
  assert.deepEqual(resolveServiceUrls({ api: 'http://localhost:4000', world: 'ws://localhost:2567' }, { protocol: 'https:', hostname: 'may-a.tail1234.ts.net' }),
    { api: 'https://may-a.tail1234.ts.net:8443', world: 'wss://may-a.tail1234.ts.net:10000' });
  assert.deepEqual(resolveServiceUrls({ api: 'http://localhost:4000/', world: 'ws://localhost:2567' }, { protocol: 'http:', hostname: 'localhost' }), { api: 'http://localhost:4000', world: 'ws://localhost:2567' });
  assert.deepEqual(resolveServiceUrls({ api: 'https://api.example.ts.net', world: 'wss://world.example.ts.net' }, { protocol: 'https:', hostname: 'may-a.tail1234.ts.net' }), { api: 'https://api.example.ts.net', world: 'wss://world.example.ts.net' });
  assert.equal(resolveServiceUrls({}, { protocol: 'http:', hostname: '::1' }).api, 'http://[::1]:4000');
});

// --- Engine với RTCPeerConnection/Web Audio giả: kiểm tra luồng signaling, không có âm thanh thật. ---
class FakeNode {
  gain = { value: 1 };
  connect<T>(next: T): T { return next; }
  disconnect(): void {}
}
class FakePeer {
  static all: FakePeer[] = [];
  localDescription: { type: string; sdp: string } | null = null;
  remote: { type: string; sdp: string } | null = null;
  added: unknown[] = [];
  closed = false;
  tracks = 0;
  connectionState = 'new';
  onicecandidate: ((event: { candidate: unknown }) => void) | null = null;
  ontrack: unknown = null;
  onconnectionstatechange: (() => void) | null = null;
  constructor() { FakePeer.all.push(this); }
  addTrack() { this.tracks++; }
  async createOffer() { return { type: 'offer', sdp: 'offer-sdp' }; }
  async createAnswer() { return { type: 'answer', sdp: 'answer-sdp' }; }
  async setLocalDescription(description: { type: string; sdp: string }) { this.localDescription = description; }
  async setRemoteDescription(description: { type: string; sdp: string }) { this.remote = description; }
  async addIceCandidate(candidate: unknown) { this.added.push(candidate); }
  close() { this.closed = true; }
}
function createEngine(selfId: string) {
  FakePeer.all = [];
  const sent: VoiceSignalInput[] = [];
  const track = { enabled: true };
  const audioContext = {
    destination: {}, currentTime: 0, listener: {},
    createGain: () => new FakeNode(), createPanner: () => new FakeNode(), createAnalyser: () => Object.assign(new FakeNode(), { getFloatTimeDomainData: () => {} }),
    createMediaStreamSource: () => new FakeNode(),
  } as unknown as AudioContext;
  const localStream = { getAudioTracks: () => [track] } as unknown as MediaStream;
  const engine = new VoiceChatEngine({
    audioContext, localStream, iceServers: [], sendSignal: signal => sent.push(signal),
    createPeerConnection: () => new FakePeer() as unknown as RTCPeerConnection, now: () => 0,
  });
  engine.setSelf(selfId);
  return { engine, sent, track };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('engine: chỉ bên có sessionId nhỏ hơn gửi offer, peer ra khỏi tập thì gửi bye', async () => {
  const { engine, sent, track } = createEngine('a');
  engine.setTransmitting(false);
  assert.equal(track.enabled, false);
  engine.sync(new Set(['b', '0']));
  await flush();
  assert.deepEqual(sent, [{ kind: 'offer', to: 'b', sdp: 'offer-sdp' }]);
  assert.equal(FakePeer.all.length, 1);
  assert.equal(FakePeer.all[0].tracks, 1);
  // ICE đến trước answer được xếp hàng, áp dụng sau khi có remote description.
  await engine.handleSignal({ kind: 'ice', from: 'b', candidate: { candidate: 'c1', sdpMid: '0', sdpMLineIndex: 0 } }, () => true);
  assert.equal(FakePeer.all[0].added.length, 0);
  await engine.handleSignal({ kind: 'answer', from: 'b', sdp: 'answer-sdp' }, () => true);
  assert.equal(FakePeer.all[0].remote?.type, 'answer');
  assert.equal(FakePeer.all[0].added.length, 1);
  engine.sync(new Set());
  assert.deepEqual(sent.at(-1), { kind: 'bye', to: 'b' });
  assert.equal(FakePeer.all[0].closed, true);
  assert.deepEqual(Object.keys(engine.peerStates()), []);
});

test('engine: bên nhận trả answer, từ chối offer bị chặn bằng bye và bỏ offer sai vai', async () => {
  const { engine, sent } = createEngine('m');
  await engine.handleSignal({ kind: 'offer', from: 'a', sdp: 'offer-sdp' }, () => false);
  assert.deepEqual(sent, [{ kind: 'bye', to: 'a' }]);
  assert.equal(FakePeer.all.length, 0);
  await engine.handleSignal({ kind: 'offer', from: 'z', sdp: 'offer-sdp' }, () => true);
  assert.equal(FakePeer.all.length, 0, 'z lớn hơn m nên m mới là bên gọi');
  await engine.handleSignal({ kind: 'offer', from: 'a', sdp: 'offer-sdp' }, () => true);
  assert.deepEqual(sent.at(-1), { kind: 'answer', to: 'a', sdp: 'answer-sdp' });
  assert.deepEqual(Object.keys(engine.peerStates()), ['a']);
  // Peer đã nhận được giữ khi vẫn nằm trong tập mong muốn; bye từ đối phương đóng peer mà không gửi lại bye.
  engine.sync(new Set(['a']));
  assert.equal(FakePeer.all[0].closed, false);
  const before = sent.length;
  await engine.handleSignal({ kind: 'bye', from: 'a' }, () => true);
  assert.equal(FakePeer.all[0].closed, true);
  assert.equal(sent.length, before);
  engine.setSelf('other-room');
  engine.destroy();
});
