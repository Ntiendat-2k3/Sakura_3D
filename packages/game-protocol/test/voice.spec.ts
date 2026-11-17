import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VOICE_LIMITS, VOICE_RANGE, normalizeVoiceReport, normalizeVoiceSignal, normalizeVoiceState, voiceDistance } from '../src';

test('bán kính voice có hysteresis và server relay rộng hơn ngưỡng ngắt', () => {
  assert.ok(VOICE_RANGE.fullVolume < VOICE_RANGE.hear);
  assert.ok(VOICE_RANGE.connect < VOICE_RANGE.disconnect);
  assert.ok(VOICE_RANGE.disconnect < VOICE_RANGE.relay);
});

test('tín hiệu WebRTC hợp lệ chỉ giữ đúng các trường cần chuyển tiếp', () => {
  assert.deepEqual(normalizeVoiceSignal({ to: 'b', kind: 'offer', sdp: 'v=0', from: 'giả mạo', extra: 1 }), { kind: 'offer', to: 'b', sdp: 'v=0' });
  assert.deepEqual(normalizeVoiceSignal({ to: 'b', kind: 'answer', sdp: 'v=0' }), { kind: 'answer', to: 'b', sdp: 'v=0' });
  assert.deepEqual(normalizeVoiceSignal({ to: 'b', kind: 'bye', sdp: 'x' }), { kind: 'bye', to: 'b' });
  assert.deepEqual(normalizeVoiceSignal({ to: 'b', kind: 'ice', candidate: { candidate: 'candidate:1 1 udp 1 100.64.0.2 5000 typ host', sdpMid: '0', sdpMLineIndex: 0 } }),
    { kind: 'ice', to: 'b', candidate: { candidate: 'candidate:1 1 udp 1 100.64.0.2 5000 typ host', sdpMid: '0', sdpMLineIndex: 0 } });
  assert.deepEqual(normalizeVoiceSignal({ to: 'b', kind: 'ice', candidate: { candidate: '' } }), { kind: 'ice', to: 'b', candidate: { candidate: '', sdpMid: null, sdpMLineIndex: null } });
});

test('từ chối tín hiệu sai hình dạng hoặc quá cỡ', () => {
  const bad = [
    null, 'offer', {}, { kind: 'offer', sdp: 'v=0' }, { to: '', kind: 'offer', sdp: 'v=0' }, { to: 'b'.repeat(VOICE_LIMITS.sessionIdChars + 1), kind: 'bye' },
    { to: 'b', kind: 'offer' }, { to: 'b', kind: 'offer', sdp: '' }, { to: 'b', kind: 'offer', sdp: 'x'.repeat(VOICE_LIMITS.sdpChars + 1) },
    { to: 'b', kind: 'hack' }, { to: 'b', kind: 'ice' }, { to: 'b', kind: 'ice', candidate: { candidate: 'x'.repeat(VOICE_LIMITS.candidateChars + 1) } },
    { to: 'b', kind: 'ice', candidate: { candidate: 'c', sdpMid: 5 } }, { to: 'b', kind: 'ice', candidate: { candidate: 'c', sdpMLineIndex: -1 } },
    { to: 'b', kind: 'ice', candidate: { candidate: 'c', sdpMLineIndex: 1.5 } }, { to: 7, kind: 'bye' },
  ];
  for (const input of bad) assert.equal(normalizeVoiceSignal(input), null, JSON.stringify(input));
});

test('trạng thái voice và báo cáo được chuẩn hóa', () => {
  assert.deepEqual(normalizeVoiceState({ enabled: true }), { enabled: true });
  assert.equal(normalizeVoiceState({ enabled: 'yes' }), null);
  assert.equal(normalizeVoiceState(null), null);
  assert.deepEqual(normalizeVoiceReport({ target: 'b', reason: ' la\nhét ' }), { target: 'b', reason: 'la hét' });
  assert.deepEqual(normalizeVoiceReport({ target: 'b' }), { target: 'b', reason: '' });
  assert.equal(normalizeVoiceReport({ target: 'b', reason: 'x'.repeat(500) })?.reason.length, VOICE_LIMITS.reportReasonChars);
  assert.equal(normalizeVoiceReport({ reason: 'x' }), null);
});

test('khoảng cách voice tính cả độ cao tầng', () => {
  assert.equal(voiceDistance({ x: 0, z: 0 }, { x: 3, z: 4 }), 5);
  assert.equal(voiceDistance({ x: 0, y: 0, z: 0 }, { x: 0, y: 12, z: 0 }), 12);
});
