#!/usr/bin/env node
/**
 * Tạo giọng thoại Kohaku Bluff (Shinku + câu cà khịa) bằng VOICEVOX Engine chạy cục bộ, xuất MP3 tĩnh để commit.
 * Chơi game không cần VOICEVOX; chỉ chạy lại khi sửa bluff-voice-lines.json.
 *
 * Engine ghim phiên bản (xem assets/source/audio/kohaku-bluff-voices/LICENSE.md):
 *   docker run --rm -d -p 127.0.0.1:50021:50021 --name voicevox voicevox/voicevox_engine:cpu-0.26.0
 * Chạy: node scripts/generate-bluff-voices.mjs [--force]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE = process.env.VOICEVOX_URL ?? 'http://127.0.0.1:50021';
const LINES = join(ROOT, 'apps/web/game/systems/bluff-voice-lines.json');
const OUT = join(ROOT, 'apps/web/public/assets/audio/kohaku-bluff');
const TMP = join(ROOT, 'test-results/tmp/voices');
/** Giọng theo vai: Shinku điềm tĩnh, câu cà khịa tinh nghịch. Đổi ở đây nếu điều khoản không phù hợp. */
const SPEAKERS = {
  dealer: { name: '冥鳴ひまり', style: 'ノーマル', speedScale: 0.95, pitchScale: -0.02, intonationScale: 1.0 },
  taunt: { name: '四国めたん', style: 'ツンツン', speedScale: 1.05, pitchScale: 0, intonationScale: 1.3 },
};
const force = process.argv.includes('--force');

async function engine(path, init) {
  let response;
  try { response = await fetch(`${ENGINE}${path}`, init); }
  catch { throw new Error(`Không kết nối được VOICEVOX Engine ở ${ENGINE}. Chạy: docker run --rm -d -p 127.0.0.1:50021:50021 --name voicevox voicevox/voicevox_engine:cpu-0.26.0`); }
  if (!response.ok) throw new Error(`${path} → HTTP ${response.status}: ${await response.text()}`);
  return response;
}

async function styleIds() {
  const speakers = await (await engine('/speakers')).json();
  return Object.fromEntries(Object.entries(SPEAKERS).map(([role, want]) => {
    const style = speakers.find(s => s.name === want.name)?.styles.find(s => s.name === want.style);
    if (!style) throw new Error(`Không thấy giọng ${want.name} (${want.style}) trong engine`);
    return [role, style.id];
  }));
}

const lines = JSON.parse(readFileSync(LINES, 'utf8'));
const ids = await styleIds();
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });
let made = 0;
for (const line of lines) {
  const mp3 = join(OUT, `${line.id}.mp3`);
  if (!force && existsSync(mp3)) continue;
  const speaker = ids[line.speaker];
  const query = await (await engine(`/audio_query?speaker=${speaker}&text=${encodeURIComponent(line.ja)}`, { method: 'POST' })).json();
  const tune = SPEAKERS[line.speaker];
  Object.assign(query, { speedScale: tune.speedScale, pitchScale: tune.pitchScale, intonationScale: tune.intonationScale, prePhonemeLength: 0.05, postPhonemeLength: 0.1 });
  const wav = Buffer.from(await (await engine(`/synthesis?speaker=${speaker}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query) })).arrayBuffer());
  const wavPath = join(TMP, `${line.id}.wav`);
  writeFileSync(wavPath, wav);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wavPath, '-ac', '1', '-b:a', '96k', mp3]);
  made++;
  console.log(`✓ ${line.id}  ${line.ja}`);
}
rmSync(TMP, { recursive: true, force: true });
console.log(`Xong: ${made} file mới, tổng ${lines.length} câu trong ${OUT}`);
