// Tiếng mưa tổng hợp bằng WebAudio (nhiễu lọc lặp vòng), không dùng file nên không vướng giấy phép.
// Hai lớp: lớp hạt mưa lách tách (dải cao) và lớp ào ào trầm (dải thấp) chỉ rõ khi mưa to.

/** Âm lượng tối đa của tiếng mưa khi mưa to nhất. */
const RAIN_MAX_GAIN = 0.16;
/** Hằng số thời gian (giây) để âm lượng bám theo cường độ mưa, tránh nhảy bậc. */
const GAIN_SMOOTHING_S = 0.8;

export type RainAudio = {
  /** 0..1; gọi mỗi frame được, chỉ đổi âm lượng khi thay đổi đáng kể. */
  setIntensity(intensity: number): void;
  dispose(): void;
};

function createNoiseLoop(ctx: AudioContext, seconds: number) {
  const buffer = ctx.createBuffer(2, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

/**
 * Trình duyệt chỉ cho phát âm thanh sau cử chỉ người dùng, nên AudioContext được tạo ở lần bấm phím/chuột đầu tiên.
 */
export function createRainAudio(): RainAudio {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let heavy: GainNode | null = null;
  let target = 0;
  let applied = -1;
  let disposed = false;

  const apply = () => {
    if (!ctx || !master || !heavy) return;
    const now = ctx.currentTime;
    master.gain.setTargetAtTime(target * RAIN_MAX_GAIN, now, GAIN_SMOOTHING_S);
    // Lớp ào ào trầm chỉ nổi lên khi mưa nặng hạt
    heavy.gain.setTargetAtTime(Math.max(0, target - 0.4) / 0.6, now, GAIN_SMOOTHING_S);
    applied = target;
  };

  const start = () => {
    removeListeners();
    if (disposed || typeof window === 'undefined') return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    const patter = createNoiseLoop(ctx, 3);
    const patterHigh = ctx.createBiquadFilter();
    patterHigh.type = 'highpass';
    patterHigh.frequency.value = 900;
    const patterLow = ctx.createBiquadFilter();
    patterLow.type = 'lowpass';
    patterLow.frequency.value = 7000;
    patter.connect(patterHigh).connect(patterLow).connect(master);

    const rumble = createNoiseLoop(ctx, 4);
    const rumbleLow = ctx.createBiquadFilter();
    rumbleLow.type = 'lowpass';
    rumbleLow.frequency.value = 650;
    heavy = ctx.createGain();
    heavy.gain.value = 0;
    rumble.connect(rumbleLow).connect(heavy).connect(master);

    patter.start();
    rumble.start();
    apply();
  };

  const events = ['pointerdown', 'keydown'] as const;
  const removeListeners = () => { if (typeof window !== 'undefined') events.forEach(e => window.removeEventListener(e, start)); };
  if (typeof window !== 'undefined') events.forEach(e => window.addEventListener(e, start, { once: true }));

  return {
    setIntensity(intensity) {
      target = Math.min(1, Math.max(0, intensity));
      if (Math.abs(target - applied) > 0.02 || (target === 0 && applied !== 0)) apply();
    },
    dispose() {
      disposed = true;
      removeListeners();
      void ctx?.close();
      ctx = null;
      master = null;
      heavy = null;
    },
  };
}
