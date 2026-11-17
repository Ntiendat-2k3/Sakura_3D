/**
 * Giọng Kohaku Bluff: Shinku nói theo diễn biến ván, người chơi cà khịa bằng câu soạn sẵn.
 * File MP3 tạo offline bằng VOICEVOX (scripts/generate-bluff-voices.mjs), phát qua chung AudioContext với bluffSfx.
 * Chỉ dựa trên dữ liệu đã công khai của bàn (revealed, shotResult, alive) để giọng không lộ bài hay vị trí đạn.
 */
import { isBluffTruthful, type BluffPhase, type BluffTableView, type BluffTauntKind } from '@metaverse/game-protocol';
import { bluffAudioContext, isEmptyInitialBluff, isNewRound, type BluffSoundState } from './bluffSfx';
import VOICE_LINES from './bluff-voice-lines.json';

export type BluffVoiceGroup =
  | 'welcome' | 'rank-K' | 'rank-Q' | 'rank-A' | 'liar-called' | 'reveal-truth' | 'reveal-lie'
  | 'shooting' | 'click' | 'bang' | 'two-left' | 'winner'
  | 'taunt-flip' | 'taunt-point' | 'taunt-laugh';
type VoiceLine = { id: string; group: BluffVoiceGroup; speaker: 'dealer' | 'taunt'; ja: string; vi: string };
const LINES = VOICE_LINES as VoiceLine[];

export const BLUFF_VOICE_URL = (id: string) => `/assets/audio/kohaku-bluff/${id}.mp3`;
export const BLUFF_VOICE_IDS: readonly string[] = LINES.map(line => line.id);

export type BluffVoiceState = BluffSoundState;

/**
 * Nhóm câu Shinku cần nói cho một lần đổi trạng thái, đúng thứ tự phát (hàm thuần).
 * Chưa seed: trạng thái thật đầu tiên chỉ gieo giá trị trước đó, giống bluffSoundFor, để người vào giữa ván không nghe câu cũ.
 */
export function bluffVoiceFor(prev: BluffVoiceState, table: BluffTableView): { groups: BluffVoiceGroup[]; next: BluffVoiceState } {
  const next: BluffVoiceState = { phase: table.phase, shot: table.shotResult, seeded: prev.seeded, rank: table.tableRank, lastSeat: table.lastPlay.seatId };
  if (!prev.seeded) {
    if (!isEmptyInitialBluff(table)) next.seeded = true;
    return { groups: [], next };
  }
  const groups: BluffVoiceGroup[] = [];
  const entered = table.phase !== prev.phase;
  if (isNewRound(prev, table) && table.tableRank) {
    if (prev.phase === 'lobby') groups.push('welcome');
    groups.push(`rank-${table.tableRank}`);
  } else if (entered && table.phase === 'reveal' && table.tableRank) {
    if (table.accuserSeat) groups.push('liar-called');
    groups.push(isBluffTruthful(table.lastPlay.revealed, table.tableRank) ? 'reveal-truth' : 'reveal-lie');
  } else if (entered && table.phase === 'shooting') {
    groups.push('shooting');
  } else if (entered && table.phase === 'gameOver') {
    groups.push('winner');
  }
  if (table.shotResult !== prev.shot && table.shotResult === 'click') groups.push('click');
  if (table.shotResult !== prev.shot && table.shotResult === 'bang') {
    groups.push('bang');
    // pullTrigger đã đánh dấu người nổ alive=false nên đếm ngay được số người còn lại.
    if (table.seats.filter(seat => seat.inMatch && seat.alive).length === 2) groups.push('two-left');
  }
  return { groups, next };
}

const lastPicked = new Map<BluffVoiceGroup, string>();
/** Chọn ngẫu nhiên một câu trong nhóm, tránh lặp đúng câu vừa nói của nhóm đó. */
export function pickVoiceLine(group: BluffVoiceGroup, rng: () => number = Math.random): string {
  const pool = LINES.filter(line => line.group === group).map(line => line.id);
  const options = pool.length > 1 ? pool.filter(id => id !== lastPicked.get(group)) : pool;
  const id = options[Math.min(options.length - 1, Math.floor(rng() * options.length))];
  lastPicked.set(group, id);
  return id;
}

/** Âm của một lần cà khịa; pha shooting giữ im lặng để chỉ còn tiếng tim đập. */
export function tauntSound(kind: BluffTauntKind, phase: BluffPhase): { voice?: BluffVoiceGroup; sfx?: 'slam' } | null {
  if (phase === 'shooting') return null;
  if (kind === 'slam') return { sfx: 'slam' };
  return { voice: `taunt-${kind}` };
}

/** Số câu tối đa được chờ sau câu đang nói; dồn quá thì bỏ câu cũ nhất vì nó đã lỗi thời. */
const MAX_WAITING = 3;

/** Một kênh giọng: phát nối tiếp, không cắt ngang. `play` trả hàm dừng; clear() dừng ngay và bỏ hàng chờ. */
export function createVoiceQueue(play: (id: string, onEnd: () => void) => () => void) {
  let waiting: string[] = [];
  let stop: (() => void) | null = null;
  let token = 0;
  const next = () => {
    stop = null;
    const id = waiting.shift();
    if (!id) return;
    const mine = ++token;
    // onEnd của câu đã bị clear() có thể tới muộn: so token để không phát tiếp sai lúc.
    stop = play(id, () => { if (mine === token) next(); });
  };
  return {
    push(ids: string[]) {
      waiting.push(...ids);
      if (waiting.length > MAX_WAITING) waiting = waiting.slice(-MAX_WAITING);
      if (!stop) next();
    },
    clear() {
      waiting = [];
      token++;
      const current = stop;
      stop = null;
      current?.();
    },
  };
}

/** Câu cà khịa phát ngay và có thể chồng nhau, nhưng vẫn phải dừng được hết khi rời zone. */
export function createOneShots(play: (id: string, onEnd: () => void) => () => void) {
  const playing = new Set<() => void>();
  return {
    play(id: string) {
      const entry = { stop: () => {} };
      const done = () => { playing.delete(entry.stop); };
      entry.stop = play(id, done);
      playing.add(entry.stop);
    },
    stopAll() {
      const all = [...playing];
      playing.clear();
      for (const stop of all) stop();
    },
  };
}

const buffers = new Map<string, AudioBuffer>();
let preloading: Promise<void> | null = null;

/** Tải và decode mọi câu một lần cho cả phiên (gọi lúc World mở, cùng bước tải sẵn của club). */
export function preloadBluffVoices(): Promise<void> {
  preloading ??= (async () => {
    const ctx = bluffAudioContext(false);
    if (!ctx) return;
    await Promise.all(BLUFF_VOICE_IDS.map(async id => {
      const response = await fetch(BLUFF_VOICE_URL(id));
      if (!response.ok) throw new Error(`Không tải được giọng ${id}`);
      buffers.set(id, await ctx.decodeAudioData(await response.arrayBuffer()));
    }));
  })().catch(error => { preloading = null; throw error; });
  return preloading;
}

const VOICE_GAIN = { dealer: 0.9, taunt: 0.75 } as const;

/** Phát một câu đã tải; chưa có buffer thì coi như nói xong ngay để hàng đợi không bị kẹt. */
export function playBluffVoice(id: string, onEnd: () => void): () => void {
  const ctx = bluffAudioContext();
  const buffer = buffers.get(id);
  if (!ctx || !buffer) { const timer = setTimeout(onEnd, 0); return () => clearTimeout(timer); }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = VOICE_GAIN[LINES.find(line => line.id === id)?.speaker ?? 'dealer'];
  source.connect(gain).connect(ctx.destination);
  source.onended = onEnd;
  source.start();
  return () => { source.onended = null; source.stop(); };
}
