// Kiểm tra MP3 nguyên vẹn, metadata, MIME và byte-range qua HTTP; không mở trình duyệt hoặc phát âm thanh.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
(async () => {
  const metadata = JSON.parse(await fs.readFile(path.join(root, 'packages/game-protocol/src/club-track.json'), 'utf8'));
  const source = await fs.readFile(path.join(root, 'assets/source/audio/club/music.mp3'));
  const runtime = await fs.readFile(path.join(root, 'apps/web/public/assets/audio/club/music.mp3'));
  assert.equal(hash(source), metadata.sha256); assert.equal(hash(runtime), metadata.sha256);
  const url = 'http://localhost:3000' + metadata.url;
  const head = await fetch(url, { method: 'HEAD' });
  assert.equal(head.status, 200); assert.match(head.headers.get('content-type'), /audio\/mpeg/);
  assert.equal(Number(head.headers.get('content-length')), source.length);
  const partial = await fetch(url, { headers: { Range: 'bytes=0-1023' } });
  assert.equal(partial.status, 206);
  assert.deepEqual(Buffer.from(await partial.arrayBuffer()), source.subarray(0, 1024));
  const result = { status: 'PASS', bytes: source.length, sha256: metadata.sha256, durationSeconds: metadata.durationSeconds, bpmEstimate: metadata.bpm, beatOffsetEstimate: metadata.beatOffsetSeconds, automaticCues: metadata.cues.length, headStatus: head.status, mime: head.headers.get('content-type'), rangeStatus: partial.status, browserPlayback: 'SKIPPED — người dùng chưa cho phép Playwright' };
  await fs.writeFile(path.join(root, 'test-results/club-music-http.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
