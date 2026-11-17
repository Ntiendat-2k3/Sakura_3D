/** Âm thanh Kohaku Bluff tổng hợp bằng WebAudio (nhiễu + envelope), không dùng file nên không vướng giấy phép. */
export type BluffSfxKind = 'shuffle' | 'play' | 'click' | 'bang' | 'slam';

let context: AudioContext | null = null;

/** Context dùng chung cho SFX, giọng và tim đập. resume=false khi chỉ cần decode lúc tải sẵn (chưa có cử chỉ người dùng). */
export function bluffAudioContext(resume = true): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  // Người chơi đã bấm Sẵn sàng nên trình duyệt cho phép resume.
  if (resume && context.state === 'suspended') void context.resume();
  return context;
}

/** Một đoạn nhiễu trắng qua bộ lọc, biên độ theo envelope gồm các mốc [giây, gain] tuyến tính. */
function noiseBurst(ctx: AudioContext, start: number, duration: number, filter: BiquadFilterType, frequency: number, envelope: [number, number][], out: AudioNode = ctx.destination) {
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * duration)), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource(); source.buffer = buffer;
  const biquad = ctx.createBiquadFilter(); biquad.type = filter; biquad.frequency.value = frequency;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, start);
  for (const [t, g] of envelope) gain.gain.linearRampToValueAtTime(g, start + t);
  source.connect(biquad).connect(gain).connect(out);
  source.start(start); source.stop(start + duration);
}

/** Tiếng thịch trầm: sóng sin tụt cao độ nhanh, cho cảm giác lực đập mà nhiễu lọc thấp không tạo ra được. */
function thump(ctx: AudioContext, start: number, from: number, to: number, duration: number, peak: number, out: AudioNode) {
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain).connect(out);
  osc.start(start); osc.stop(start + duration);
}

export function playBluffSfx(kind: BluffSfxKind): void {
  const ctx = bluffAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  if (kind === 'shuffle') {
    // Chuỗi tiếng xì xào ngắn của lá bài lướt qua nhau.
    for (let i = 0; i < 7; i++) noiseBurst(ctx, now + i * 0.07, 0.06, 'highpass', 3500, [[0.005, 0.18], [0.06, 0]]);
  } else if (kind === 'click') {
    // Tách khô của búa đập vào ổ rỗng.
    noiseBurst(ctx, now, 0.05, 'bandpass', 2200, [[0.002, 0.5], [0.05, 0]]);
    noiseBurst(ctx, now + 0.09, 0.04, 'bandpass', 1400, [[0.002, 0.3], [0.04, 0]]);
  } else if (kind === 'play') {
    // Úp bài: tiếng "xẹt" lá bài trượt trên mặt nỉ rồi chạm bàn.
    noiseBurst(ctx, now, 0.16, 'bandpass', 4200, [[0.02, 0.55], [0.11, 0.35], [0.16, 0]]);
    noiseBurst(ctx, now + 0.14, 0.05, 'lowpass', 900, [[0.003, 0.45], [0.05, 0]]);
  } else if (kind === 'slam') {
    // Đập bàn hai lần thật mạnh: thịch trầm (sin) + tiếng gỗ + lách cách chén/phỉnh nảy trên mặt bàn.
    // Các lớp cộng lại vượt 1.0: qua compressor + makeup gain để nghe to, đậm mà không bị vỡ tiếng (clip).
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -14; compressor.knee.value = 6; compressor.ratio.value = 8;
    compressor.attack.value = 0.001; compressor.release.value = 0.2;
    const makeup = ctx.createGain(); makeup.gain.value = 1.6;
    compressor.connect(makeup).connect(ctx.destination);
    for (const [offset, level] of [[0, 1], [0.2, 0.85]] as const) {
      const at = now + offset;
      thump(ctx, at, 140, 45, 0.35, 1.0 * level, compressor);
      noiseBurst(ctx, at, 0.3, 'lowpass', 380, [[0.003, 1.0 * level], [0.3, 0]], compressor);
      noiseBurst(ctx, at + 0.01, 0.12, 'bandpass', 1500, [[0.002, 0.55 * level], [0.12, 0]], compressor);
      noiseBurst(ctx, at + 0.04, 0.14, 'bandpass', 3600, [[0.002, 0.3 * level], [0.14, 0]], compressor);
    }
  } else {
    // Tiếng nổ: nhiễu thấp tần dài hơi kèm tiếng nứt cao tần ở đầu.
    noiseBurst(ctx, now, 0.6, 'lowpass', 900, [[0.005, 1], [0.6, 0]]);
    noiseBurst(ctx, now, 0.08, 'highpass', 2500, [[0.002, 0.7], [0.08, 0]]);
  }
}

/** rank/lastSeat: lá chủ và người úp gần nhất ở lần trước, để nhận ra chia lại ngay trong pha turn. */
export type BluffSoundState = { phase: string; shot: string; seeded: boolean; rank: string; lastSeat: string };
type BluffTableLike = { phase: string; shotResult: string; tableRank: string; lastPlay: { seatId: string }; seats: { sessionId: string }[] };

/**
 * Vừa chia vòng mới: vào turn từ pha khác, hoặc chia lại ngay trong turn (người rời ghế giữa lượt: server dealRound
 * mà pha không đổi) — khi đó lá chủ đổi hoặc lần úp trên bàn bị xóa.
 */
export function isNewRound(prev: { phase: string; rank: string; lastSeat: string }, table: BluffTableLike): boolean {
  if (table.phase !== 'turn') return false;
  return prev.phase !== 'turn' || table.tableRank !== prev.rank || (prev.lastSeat !== '' && table.lastPlay.seatId === '');
}

/** Bàn khởi tạo (lobby, chưa ai ngồi, chưa có kết quả) chưa phải trạng thái thật từ server nên không dùng để seed. */
export function isEmptyInitialBluff(table: BluffTableLike) {
  return table.phase === 'lobby' && table.shotResult === '' && table.seats.every(seat => !seat.sessionId);
}

/**
 * Quyết định âm thanh cho một lần đổi trạng thái bàn (hàm thuần, dễ test).
 * Chưa seed: trạng thái thật đầu tiên chỉ gieo giá trị trước đó, không phát (người vào giữa ván không nghe lại âm cũ).
 */
export function bluffSoundFor(prev: BluffSoundState, table: BluffTableLike): { sound: BluffSfxKind | null; next: BluffSoundState } {
  const next: BluffSoundState = { phase: table.phase, shot: table.shotResult, seeded: prev.seeded, rank: table.tableRank, lastSeat: table.lastPlay.seatId };
  if (!prev.seeded) {
    if (!isEmptyInitialBluff(table)) next.seeded = true;
    return { sound: null, next };
  }
  let sound: BluffSfxKind | null = null;
  if (isNewRound(prev, table)) sound = 'shuffle';
  // Lượt mới úp bài: chồng bài trên bàn đổi chủ (mỗi lượt là một ghế khác nên seatId luôn đổi).
  else if (table.phase === 'turn' && table.lastPlay.seatId !== '' && table.lastPlay.seatId !== prev.lastSeat) sound = 'play';
  else if (table.shotResult !== prev.shot && (table.shotResult === 'click' || table.shotResult === 'bang')) sound = table.shotResult;
  return { sound, next };
}

/** Tim đập "thịch-thịch" lặp theo BPM cho tới khi gọi hàm dừng trả về (rời zone hoặc có kết quả bắn). */
export function startHeartbeat(bpm: number): () => void {
  const beat = () => {
    const ctx = bluffAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    noiseBurst(ctx, now, 0.14, 'lowpass', 120, [[0.01, 0.9], [0.14, 0]]);
    noiseBurst(ctx, now + 0.18, 0.12, 'lowpass', 110, [[0.01, 0.6], [0.12, 0]]);
  };
  beat();
  const timer = setInterval(beat, 60000 / bpm);
  return () => clearInterval(timer);
}
