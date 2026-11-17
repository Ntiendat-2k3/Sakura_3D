'use client';
/** Bảng điều khiển voice: đồng ý dùng micro, push-to-talk/mở mic, tự tắt mic, và tắt tiếng/chặn/báo cáo từng người gần. */
import { useState } from 'react';
import { VOICE_RANGE } from '@metaverse/game-protocol';
import type { ProximityVoice } from '../systems/useProximityVoice';
import { VOICE_PUSH_TO_TALK_LABEL, type VoiceStatus } from '../systems/voiceControls';

const STATUS_TEXT: Partial<Record<VoiceStatus, string>> = {
  requesting: 'Đang chờ trình duyệt cấp quyền micro…',
  denied: 'Trình duyệt đã từ chối quyền micro. Bấm biểu tượng ổ khóa cạnh thanh địa chỉ để cho phép, rồi bật lại.',
  'no-mic': 'Không tìm thấy micro. Hãy cắm micro/tai nghe rồi thử lại.',
  busy: 'Micro đang bị ứng dụng khác chiếm dụng. Đóng ứng dụng đó rồi thử lại.',
  insecure: 'Voice cần trang HTTPS (hoặc localhost). Hãy mở game qua địa chỉ https://…ts.net của Tailscale.',
  unsupported: 'Trình duyệt này không hỗ trợ voice (WebRTC/Web Audio). Hãy dùng Chrome, Edge hoặc Firefox mới.',
  error: 'Không bật được micro. Hãy thử lại.',
};

export function VoicePanel({ voice, online }: { voice: ProximityVoice; online: boolean }) {
  const [reporting, setReporting] = useState<{ sessionId: string; name: string } | null>(null);
  const [reason, setReason] = useState('');
  const [showBlocked, setShowBlocked] = useState(false);
  const enabled = voice.status === 'on';
  const blocked = [...voice.blockedUsers];

  if (voice.status === 'consent') {
    return <div className="voice-consent" role="dialog" aria-modal="true" aria-labelledby="voice-consent-title">
      <h2 id="voice-consent-title">Bật voice chat?</h2>
      <ul>
        <li>Trình duyệt sẽ xin quyền dùng micro. Giọng nói đi thẳng tới máy những người chơi đang ở gần bạn (trong khoảng {VOICE_RANGE.hear} m), không qua máy chủ và không được ghi âm.</li>
        <li>Mặc định là bấm giữ <kbd>{VOICE_PUSH_TO_TALK_LABEL}</kbd> để nói. Bạn có thể tự tắt mic, tắt tiếng, chặn hoặc báo cáo bất kỳ ai.</li>
        <li>Kết nối P2P để lộ địa chỉ mạng (IP) của bạn cho người chơi được kết nối. Chỉ bật khi chơi với người bạn tin cậy.</li>
      </ul>
      <div className="voice-row">
        <button type="button" className="graphics-toggle is-primary" onClick={() => void voice.confirmConsent()}>Đồng ý và bật micro</button>
        <button type="button" className="graphics-toggle" onClick={voice.cancelConsent}>Để sau</button>
      </div>
    </div>;
  }

  return <section className="hud voice-panel" aria-label="Voice chat">
    <div className="voice-row">
      <strong>🎙 Voice</strong>
      {enabled
        ? <button type="button" className="graphics-toggle" onClick={voice.disable}>Tắt voice</button>
        : <button type="button" className="graphics-toggle" disabled={!online || voice.status === 'requesting'} onClick={voice.enable}>Bật voice chat</button>}
    </div>
    {STATUS_TEXT[voice.status] && <p className="voice-status" role={voice.status === 'requesting' ? 'status' : 'alert'}>{STATUS_TEXT[voice.status]}</p>}
    {enabled && <>
      <div className="voice-row">
        <button type="button" className="graphics-toggle" aria-pressed={voice.mode === 'push-to-talk'} onClick={() => voice.setMode(voice.mode === 'push-to-talk' ? 'open-mic' : 'push-to-talk')}>
          {voice.mode === 'push-to-talk' ? `Giữ ${VOICE_PUSH_TO_TALK_LABEL} để nói` : 'Mở mic liên tục'}
        </button>
        <button type="button" className="graphics-toggle" aria-pressed={voice.selfMuted} onClick={voice.toggleSelfMute}>{voice.selfMuted ? '🔇 Mic đang tắt' : 'Tắt mic'}</button>
      </div>
      {voice.mode === 'push-to-talk' && !voice.selfMuted && (
        <button
          type="button"
          className={`graphics-toggle voice-ptt${voice.pttHeld ? ' is-live' : ''}`}
          onPointerDown={() => voice.setPushToTalk(true)}
          onPointerUp={() => voice.setPushToTalk(false)}
          onPointerLeave={() => voice.setPushToTalk(false)}
          onPointerCancel={() => voice.setPushToTalk(false)}
        >{voice.pttHeld ? '● Đang phát' : `Giữ nút này hoặc phím ${VOICE_PUSH_TO_TALK_LABEL}`}</button>
      )}
      {voice.mode === 'open-mic' && !voice.selfMuted && <p className="voice-status">● Mic đang mở cho người ở gần</p>}
      <ul className="voice-peers" aria-label="Người ở gần đang bật voice">
        {voice.peers.length === 0 && <li className="empty">Chưa có ai bật voice trong khoảng {VOICE_RANGE.hear} m.</li>}
        {voice.peers.map(peer => <li key={peer.sessionId}>
          <span className={`voice-dot${peer.speaking && !peer.muted ? ' is-speaking' : ''}`} aria-hidden="true"/>
          <span className="voice-name" title={`${peer.distance.toFixed(1)} m`}>{peer.name}</span>
          <small>{voice.blockedUsers.has(peer.userId) ? 'đã chặn' : peer.state === 'connected' ? `${peer.distance.toFixed(0)} m` : peer.state === 'failed' ? 'lỗi kết nối' : 'đang nối…'}</small>
          <button type="button" className="graphics-toggle" aria-pressed={voice.mutedUsers.has(peer.userId)} onClick={() => voice.toggleMute(peer.userId)}>{voice.mutedUsers.has(peer.userId) ? 'Bật tiếng' : 'Tắt tiếng'}</button>
          <button type="button" className="graphics-toggle" aria-pressed={voice.blockedUsers.has(peer.userId)} onClick={() => voice.toggleBlock(peer.userId, peer.name)}>{voice.blockedUsers.has(peer.userId) ? 'Bỏ chặn' : 'Chặn'}</button>
          <button type="button" className="graphics-toggle" onClick={() => { setReporting({ sessionId: peer.sessionId, name: peer.name }); setReason(''); }}>Báo cáo</button>
        </li>)}
      </ul>
    </>}
    {blocked.length > 0 && <button type="button" className="graphics-toggle" aria-expanded={showBlocked} onClick={() => setShowBlocked(value => !value)}>Đã chặn ({blocked.length})</button>}
    {showBlocked && <ul className="voice-peers">{blocked.map(userId => <li key={userId}>
      <span className="voice-name">{voice.blockedNames[userId] ?? userId.slice(0, 8)}</span>
      <button type="button" className="graphics-toggle" onClick={() => voice.toggleBlock(userId, voice.blockedNames[userId] ?? '')}>Bỏ chặn</button>
    </li>)}</ul>}
    {reporting && <form className="voice-report" onSubmit={event => { event.preventDefault(); voice.report(reporting.sessionId, reason); setReporting(null); }}>
      <label>Báo cáo {reporting.name} (ghi vào log máy chủ):
        <input value={reason} onChange={event => setReason(event.target.value)} maxLength={200} placeholder="Lý do (không bắt buộc)" autoFocus/>
      </label>
      <div className="voice-row">
        <button type="submit" className="graphics-toggle is-primary">Gửi báo cáo</button>
        <button type="button" className="graphics-toggle" onClick={() => setReporting(null)}>Hủy</button>
      </div>
    </form>}
    {voice.reportAck && Date.now() - voice.reportAck.at < 8000 && <p className="voice-status" role="status">Đã ghi nhận báo cáo. Bạn có thể chặn người này để không nghe nữa.</p>}
  </section>;
}
