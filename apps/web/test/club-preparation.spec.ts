import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { createClubAudioBuffer } from '../game/systems/clubAudioBuffer';
import { createPlayerDanceShortcuts } from '../game/systems/playerDanceShortcuts';
import { CLUB_PRELOAD_URLS } from '../game/systems/ClubAssetWarmup';
import { DEFAULT_PLAYER_CHARACTER, isPlayerCharacterId, PLAYER_CHARACTERS, type PlayerCharacterId } from '@metaverse/game-protocol';
import { readPlayerChoice, savePlayerChoice } from '../game/systems/playerChoice';

test('N+1–7 chọn đúng kiểu, không kích hoạt nhảy thường trước tổ hợp và không lặp khi giữ phím', () => {
  const styles: string[] = [], keys = createPlayerDanceShortcuts(style => styles.push(style));
  keys.down('2', false); assert.deepEqual(styles, []);
  keys.down('n', false); assert.deepEqual(styles, []);
  keys.down('2', false); keys.down('2', true); keys.up('n');
  assert.deepEqual(styles, ['guitar']);
  keys.down('n', false); keys.down('1', false); keys.up('n');
  assert.deepEqual(styles, ['guitar', 'normal']);
  keys.down('n', false); keys.reset(); keys.up('n');
  assert.equal(styles.length, 2, 'Đổi focus/ẩn tab không được kích hoạt nhảy');
  keys.down('n', false); keys.up('n'); assert.equal(styles.length, 3, 'Giữ tương thích phím N đơn');
  keys.down('n', false); keys.down('3', false); keys.down('3', true); keys.up('n');
  assert.deepEqual(styles, ['guitar', 'normal', 'normal', 'flair']);
  assert.equal(keys.down('4', false), false);
  keys.down('n', false); keys.down('4', false); keys.down('4', true); keys.up('n');
  assert.deepEqual(styles, ['guitar', 'normal', 'normal', 'flair', 'hiphop']);
  keys.down('n', false); keys.down('4', false); keys.up('n');
  assert.equal(styles.at(-1), 'hiphop', 'Nhấn lại N+4 gửi cùng kiểu để bật/tắt');
  for (const [key, expected] of [['5', 'maraschino'], ['6', 'swing'], ['7', 'snakehiphop']]) {
    const before: number = styles.length;
    assert.equal(keys.down(key, false), false);
    keys.down('n', false); keys.down(key, false); keys.down(key, true); keys.up('n');
    assert.deepEqual(styles.slice(before), [expected]);
  }
  assert.equal(keys.down('8', false), false);
});

test('MP3 tải đầy đủ một lần, dùng lại cùng blob, giải phóng khi World đóng', async () => {
  const nativeFetch = globalThis.fetch;
  let downloads = 0;
  globalThis.fetch = async () => { downloads++; return new Response(new Blob(['complete-mp3'], { type: 'audio/mpeg' })); };
  const buffer = createClubAudioBuffer();
  try {
    const a = buffer.load(), b = buffer.load(); assert.equal(a, b);
    const url = await a;
    assert.equal(await (await nativeFetch(url)).text(), 'complete-mp3');
    assert.equal(await buffer.load(), url); assert.equal(downloads, 1);
    buffer.dispose(); await assert.rejects(nativeFetch(url)); await assert.rejects(buffer.load());
  } finally { buffer.dispose(); globalThis.fetch = nativeFetch; }
});

test('lỗi tải nhạc cho phép thử lại; đóng phiên hủy tải đang chạy', async () => {
  const nativeFetch = globalThis.fetch;
  const buffer = createClubAudioBuffer();
  let count = 0;
  globalThis.fetch = async () => ++count === 1 ? new Response('', { status: 503 }) : new Response(new Blob(['mp3']));
  try {
    await assert.rejects(buffer.load()); await buffer.load(); assert.equal(count, 2);
    buffer.dispose();
    globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
    const closing = createClubAudioBuffer(), pending = closing.load();
    closing.dispose(); await assert.rejects(pending, /aborted/);
  } finally { buffer.dispose(); globalThis.fetch = nativeFetch; }
});

test('danh sách tải trước có model người chơi, phòng club và toàn bộ file GLB hợp lệ', async () => {
  assert.equal(new Set(CLUB_PRELOAD_URLS).size, CLUB_PRELOAD_URLS.length);
  assert.ok(CLUB_PRELOAD_URLS.includes('/assets/buildings/denmu-club.glb'));
  assert.ok(CLUB_PRELOAD_URLS.includes('/assets/characters/player/bocchi.glb'));
  for (const url of CLUB_PRELOAD_URLS) {
    const bytes = await readFile(resolve(__dirname, '../public', url.slice(1)));
    assert.equal(bytes.subarray(0, 4).toString(), 'glTF', url);
  }
  for (const model of Object.values(PLAYER_CHARACTERS)) assert.ok(CLUB_PRELOAD_URLS.includes(model.url));
});

test('lựa chọn được ghi nhớ; dữ liệu lạ và storage bị khóa trở về mặc định mà không chặn game', () => {
  let value = '';
  const storage = { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } };
  for (const id of Object.keys(PLAYER_CHARACTERS) as PlayerCharacterId[]) {
    savePlayerChoice(storage, id); assert.equal(readPlayerChoice(storage), id);
  }
  for (const invalid of ['__proto__', 'constructor', 'invalid', '/fake.glb']) {
    assert.equal(isPlayerCharacterId(invalid), false); value = invalid;
    assert.equal(readPlayerChoice(storage), DEFAULT_PLAYER_CHARACTER);
  }
  const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(readPlayerChoice(blocked), DEFAULT_PLAYER_CHARACTER);
  assert.doesNotThrow(() => savePlayerChoice(blocked, 'kita'));
});
