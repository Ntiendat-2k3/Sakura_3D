/**
 * Mesh WebRTC cho voice theo khoảng cách. Engine chỉ quản lý kết nối và đồ thị Web Audio;
 * việc chọn ai được kết nối nằm ở voicePeers.ts, còn React/HUD ở useProximityVoice.
 * Các hàm tạo RTCPeerConnection/<audio> được truyền vào để thay bằng bản giả khi test trong Node.
 */
import { VOICE_RANGE, type VoiceIceCandidate, type VoiceSignalInput, type VoiceSignalRelay } from '@metaverse/game-protocol';
import { VOICE_CONNECT_TIMEOUT_MS, VOICE_RETRY_BACKOFF_MS, rms, type IceServerConfig } from './voiceControls';
import { isVoiceInitiator } from './voicePeers';

export type VoicePeerState = 'connecting' | 'connected' | 'failed';
export type VoiceEngineDeps = {
  audioContext: AudioContext;
  localStream: MediaStream;
  iceServers: IceServerConfig[];
  sendSignal: (signal: VoiceSignalInput) => void;
  /** Báo khi tập peer hoặc trạng thái kết nối đổi, để HUD cập nhật. */
  onPeersChanged?: () => void;
  createPeerConnection?: (config: RTCConfiguration) => RTCPeerConnection;
  createAudioElement?: () => HTMLAudioElement;
  now?: () => number;
};

type Peer = {
  pc: RTCPeerConnection;
  initiator: boolean;
  createdAt: number;
  state: VoicePeerState;
  remoteDescribed: boolean;
  pendingIce: VoiceIceCandidate[];
  gain: GainNode;
  panner: PannerNode;
  analyser: AnalyserNode;
  source?: MediaStreamAudioSourceNode;
  audio?: HTMLAudioElement;
};

export class VoiceChatEngine {
  private readonly peers = new Map<string, Peer>();
  /** sessionId -> thời điểm được gọi lại; tránh gọi dồn dập khi đối phương từ chối, chặn hoặc mạng lỗi. */
  private readonly retryAt = new Map<string, number>();
  private readonly muted = new Set<string>();
  private readonly master: GainNode;
  private readonly localAnalyser: AnalyserNode;
  private readonly localSource: MediaStreamAudioSourceNode;
  private readonly samples = new Float32Array(512);
  private readonly now: () => number;
  private selfSessionId = '';
  private destroyed = false;

  constructor(private readonly deps: VoiceEngineDeps) {
    this.now = deps.now ?? (() => performance.now());
    const ctx = deps.audioContext;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    // Chỉ đo mức micro của chính mình để hiện chỉ báo đang nói; không nối ra loa để khỏi nghe lại giọng mình.
    this.localSource = ctx.createMediaStreamSource(deps.localStream);
    this.localAnalyser = this.createAnalyser();
    this.localSource.connect(this.localAnalyser);
  }

  setSelf(sessionId: string): void {
    if (sessionId === this.selfSessionId) return;
    // Đổi phòng thì sessionId đổi: mọi peer của phòng cũ đã vô nghĩa.
    this.closeAll(false);
    this.selfSessionId = sessionId;
  }

  peerIds(): IterableIterator<string> {
    return this.peers.keys();
  }

  peerStates(): Record<string, VoicePeerState> {
    return Object.fromEntries([...this.peers].map(([id, peer]) => [id, peer.state]));
  }

  /** Bật/tắt phát bằng track.enabled: gửi im lặng, không cần thương lượng lại SDP. */
  setTransmitting(on: boolean): void {
    for (const track of this.deps.localStream.getAudioTracks()) track.enabled = on;
  }

  setPeerMuted(sessionId: string, muted: boolean): void {
    if (muted) this.muted.add(sessionId); else this.muted.delete(sessionId);
    const peer = this.peers.get(sessionId);
    if (peer) peer.gain.gain.value = muted ? 0 : 1;
  }

  /** Đồng bộ với tập peer mong muốn: mở peer mới (nếu mình là bên gọi), đóng peer thừa hoặc kẹt quá lâu. */
  sync(desired: ReadonlySet<string>): void {
    if (this.destroyed || !this.selfSessionId) return;
    const now = this.now();
    let changed = false;
    for (const [id, peer] of this.peers) {
      const stuck = peer.state !== 'connected' && now - peer.createdAt > VOICE_CONNECT_TIMEOUT_MS;
      if (!desired.has(id) || stuck || peer.state === 'failed') {
        this.closePeer(id, true);
        if (stuck || peer.state === 'failed') this.retryAt.set(id, now + VOICE_RETRY_BACKOFF_MS);
        changed = true;
      }
    }
    for (const id of desired) {
      if (this.peers.has(id) || !isVoiceInitiator(this.selfSessionId, id) || (this.retryAt.get(id) ?? 0) > now) continue;
      void this.call(id);
      changed = true;
    }
    for (const id of [...this.retryAt.keys()]) if (!desired.has(id)) this.retryAt.delete(id);
    if (changed) this.deps.onPeersChanged?.();
  }

  /** canAccept quyết định có nhận offer mới hay không (chặn, đủ peer, quá xa). */
  async handleSignal(signal: VoiceSignalRelay, canAccept: (from: string) => boolean): Promise<void> {
    if (this.destroyed || !this.selfSessionId) return;
    const from = signal.from;
    if (typeof from !== 'string' || !from) return;
    if (signal.kind === 'bye') {
      if (this.peers.has(from)) { this.closePeer(from, false); this.retryAt.set(from, this.now() + VOICE_RETRY_BACKOFF_MS); this.deps.onPeersChanged?.(); }
      return;
    }
    if (signal.kind === 'offer') {
      if (isVoiceInitiator(this.selfSessionId, from) || typeof signal.sdp !== 'string') return;
      if (!canAccept(from)) { this.deps.sendSignal({ kind: 'bye', to: from }); return; }
      // Bên gọi tạo lại kết nối (vd. sau lỗi mạng): bỏ peer cũ, nhận offer mới.
      if (this.peers.has(from)) this.closePeer(from, false);
      const peer = this.createPeer(from, false);
      try {
        await peer.pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
        peer.remoteDescribed = true;
        await this.flushIce(peer);
        await peer.pc.setLocalDescription(await peer.pc.createAnswer());
        if (this.peers.get(from) !== peer) return;
        this.deps.sendSignal({ kind: 'answer', to: from, sdp: peer.pc.localDescription?.sdp ?? '' });
      } catch { this.failPeer(from, peer); }
      return;
    }
    const peer = this.peers.get(from);
    if (!peer) return;
    if (signal.kind === 'answer') {
      if (!peer.initiator || peer.remoteDescribed || typeof signal.sdp !== 'string') return;
      try {
        await peer.pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
        peer.remoteDescribed = true;
        await this.flushIce(peer);
      } catch { this.failPeer(from, peer); }
      return;
    }
    if (signal.kind === 'ice' && signal.candidate && typeof signal.candidate.candidate === 'string') {
      if (!peer.remoteDescribed) { if (peer.pendingIce.length < 64) peer.pendingIce.push(signal.candidate); return; }
      await peer.pc.addIceCandidate(signal.candidate).catch(() => {});
    }
  }

  /** Mức âm (RMS) của từng peer và của chính mình ('' = mình), dùng cho chỉ báo đang nói. */
  levels(): Map<string, number> {
    const result = new Map<string, number>();
    const read = (analyser: AnalyserNode) => { analyser.getFloatTimeDomainData(this.samples); return rms(this.samples); };
    result.set('', read(this.localAnalyser));
    for (const [id, peer] of this.peers) if (peer.source && peer.state === 'connected') result.set(id, read(peer.analyser));
    return result;
  }

  /** Đặt vị trí nguồn âm của peer theo avatar; setTargetAtTime làm mượt bước nhảy giữa các khung hình/patch. */
  positionPeer(sessionId: string, x: number, y: number, z: number): void {
    const peer = this.peers.get(sessionId);
    if (!peer) return;
    const t = this.deps.audioContext.currentTime;
    const p = peer.panner;
    if (p.positionX) { p.positionX.setTargetAtTime(x, t, 0.05); p.positionY.setTargetAtTime(y, t, 0.05); p.positionZ.setTargetAtTime(z, t, 0.05); }
    else p.setPosition(x, y, z);
  }

  positionListener(position: { x: number; y: number; z: number }, forward: { x: number; y: number; z: number }, up: { x: number; y: number; z: number }): void {
    const listener = this.deps.audioContext.listener;
    const t = this.deps.audioContext.currentTime;
    if (listener.positionX) {
      listener.positionX.setTargetAtTime(position.x, t, 0.05); listener.positionY.setTargetAtTime(position.y, t, 0.05); listener.positionZ.setTargetAtTime(position.z, t, 0.05);
      listener.forwardX.setTargetAtTime(forward.x, t, 0.05); listener.forwardY.setTargetAtTime(forward.y, t, 0.05); listener.forwardZ.setTargetAtTime(forward.z, t, 0.05);
      listener.upX.setTargetAtTime(up.x, t, 0.05); listener.upY.setTargetAtTime(up.y, t, 0.05); listener.upZ.setTargetAtTime(up.z, t, 0.05);
    } else {
      // Firefox cũ chưa có AudioParam trên listener.
      listener.setPosition(position.x, position.y, position.z);
      listener.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  }

  closeAll(sendBye: boolean): void {
    for (const id of [...this.peers.keys()]) this.closePeer(id, sendBye);
    this.retryAt.clear();
    this.deps.onPeersChanged?.();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.closeAll(true);
    this.destroyed = true;
    this.localSource.disconnect();
    this.master.disconnect();
  }

  private createAnalyser(): AnalyserNode {
    const analyser = this.deps.audioContext.createAnalyser();
    analyser.fftSize = this.samples.length;
    return analyser;
  }

  private createPeer(sessionId: string, initiator: boolean): Peer {
    const ctx = this.deps.audioContext;
    const config: RTCConfiguration = { iceServers: this.deps.iceServers };
    const pc = this.deps.createPeerConnection ? this.deps.createPeerConnection(config) : new RTCPeerConnection(config);
    const gain = ctx.createGain();
    gain.gain.value = this.muted.has(sessionId) ? 0 : 1;
    // HRTF + linear: to đủ trong fullVolume, nhỏ dần tới 0 ở mép hear, khớp hằng số giao thức.
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'linear';
    panner.refDistance = VOICE_RANGE.fullVolume;
    panner.maxDistance = VOICE_RANGE.hear;
    panner.rolloffFactor = 1;
    gain.connect(panner).connect(this.master);
    const peer: Peer = { pc, initiator, createdAt: this.now(), state: 'connecting', remoteDescribed: false, pendingIce: [], gain, panner, analyser: this.createAnalyser() };
    this.peers.set(sessionId, peer);
    for (const track of this.deps.localStream.getAudioTracks()) pc.addTrack(track, this.deps.localStream);
    pc.onicecandidate = event => {
      if (!event.candidate || this.peers.get(sessionId) !== peer) return;
      const json = event.candidate.toJSON();
      this.deps.sendSignal({ kind: 'ice', to: sessionId, candidate: { candidate: json.candidate ?? '', sdpMid: json.sdpMid ?? null, sdpMLineIndex: json.sdpMLineIndex ?? null } });
    };
    pc.ontrack = event => {
      if (this.peers.get(sessionId) !== peer || peer.source) return;
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      // Chrome chỉ đẩy dữ liệu luồng WebRTC vào Web Audio khi luồng cũng gắn vào một phần tử media; để muted cho khỏi phát đôi.
      const audio = this.deps.createAudioElement ? this.deps.createAudioElement() : new Audio();
      audio.muted = true;
      audio.srcObject = stream;
      void audio.play().catch(() => {});
      peer.audio = audio;
      peer.source = ctx.createMediaStreamSource(stream);
      peer.source.connect(peer.analyser);
      peer.source.connect(gain);
    };
    pc.onconnectionstatechange = () => {
      if (this.peers.get(sessionId) !== peer) return;
      const next: VoicePeerState = pc.connectionState === 'connected' ? 'connected' : pc.connectionState === 'failed' || pc.connectionState === 'closed' ? 'failed' : 'connecting';
      if (next !== peer.state) { peer.state = next; this.deps.onPeersChanged?.(); }
    };
    return peer;
  }

  private async call(sessionId: string): Promise<void> {
    const peer = this.createPeer(sessionId, true);
    try {
      await peer.pc.setLocalDescription(await peer.pc.createOffer());
      if (this.peers.get(sessionId) !== peer) return;
      this.deps.sendSignal({ kind: 'offer', to: sessionId, sdp: peer.pc.localDescription?.sdp ?? '' });
    } catch { this.failPeer(sessionId, peer); }
  }

  private async flushIce(peer: Peer): Promise<void> {
    const pending = peer.pendingIce.splice(0);
    for (const candidate of pending) await peer.pc.addIceCandidate(candidate).catch(() => {});
  }

  private failPeer(sessionId: string, peer: Peer): void {
    if (this.peers.get(sessionId) !== peer) return;
    peer.state = 'failed';
    this.deps.onPeersChanged?.();
  }

  private closePeer(sessionId: string, sendBye: boolean): void {
    const peer = this.peers.get(sessionId);
    if (!peer) return;
    this.peers.delete(sessionId);
    if (sendBye) this.deps.sendSignal({ kind: 'bye', to: sessionId });
    peer.pc.onicecandidate = null; peer.pc.ontrack = null; peer.pc.onconnectionstatechange = null;
    peer.pc.close();
    peer.source?.disconnect();
    peer.gain.disconnect();
    peer.panner.disconnect();
    if (peer.audio) { peer.audio.pause(); peer.audio.srcObject = null; }
  }
}
