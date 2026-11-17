"""Quét thư mục nhạc, kiểm tra bằng ffprobe rồi sinh catalog dùng chung cho web và server."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/source/audio/club'
CATALOG = ROOT / 'packages/game-protocol/src/club-playlist.json'
PUBLIC = ROOT / 'apps/web/public/assets/audio/club/playlist'
REIKA_SOURCE = ROOT / 'assets/source/audio/reika'
REIKA_CATALOG = ROOT / 'packages/game-protocol/src/reika-playlist.json'
REIKA_PUBLIC = ROOT / 'apps/web/public/assets/audio/reika/playlist'


def probe(path):
    result = subprocess.run(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(path)], capture_output=True, text=True, encoding='utf8', check=True)
    data = json.loads(result.stdout)
    if not any(stream.get('codec_type') == 'audio' for stream in data.get('streams', [])):
        raise ValueError(f'Không có audio: {path.name}')
    duration = float(data['format']['duration'])
    if not math.isfinite(duration) or not 0 < duration <= 86400:
        raise ValueError(f'Thời lượng không hợp lệ: {path.name}')
    tags = {key.lower(): value for key, value in data['format'].get('tags', {}).items()}
    try:
        bpm = float(tags.get('bpm', tags.get('tbpm', 120)))
    except ValueError:
        bpm = 120
    return duration, tags, bpm if math.isfinite(bpm) and 60 <= bpm <= 180 else 120


def collect(source, previous, public_dir=PUBLIC, url_prefix='/assets/audio/club/playlist', id_prefix='track', skip_default=True):
    default = json.loads((ROOT / 'packages/game-protocol/src/club-track.json').read_text(encoding='utf8'))
    existing = {item['id']: item for item in previous}
    tracks, copies = [], []
    if not source.exists():
        return tracks, copies
    for path in sorted(source.rglob('*')):
        if not path.is_file() or path.suffix.lower() not in ('.mp3', '.m4a', '.wav', '.ogg'):
            continue
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if skip_default and digest == default.get('sha256'):
            continue
        relative = path.relative_to(source).as_posix()
        identity = f'{id_prefix}-' + hashlib.sha256(relative.encode('utf8')).hexdigest()[:16]
        duration, tags, bpm = probe(path)
        old = existing.get(identity, {})
        # URL chứa hash nội dung để trình duyệt không dùng nhầm cache khi thay file cùng tên.
        filename = f'{identity}-{digest[:12]}{path.suffix.lower()}'
        track = {'id': identity, 'title': old.get('title', tags.get('title', path.stem))[:160], 'url': f'{url_prefix}/{filename}', 'durationSeconds': duration, 'bpm': old.get('bpm', bpm), 'beatOffsetSeconds': old.get('beatOffsetSeconds', 0), 'cues': old.get('cues', [{'atSeconds': 0, 'cue': 'lounge' if id_prefix == 'reika' else 'groove'}])}
        if old.get('artist', tags.get('artist')):
            track['artist'] = old.get('artist', tags.get('artist'))
        if not track['title'].strip() or not 60 <= track['bpm'] <= 180 or not math.isfinite(track['bpm']) or not math.isfinite(track['beatOffsetSeconds']) or abs(track['beatOffsetSeconds']) > 10:
            raise ValueError(f'Metadata không hợp lệ: {relative}')
        previous_at = -1
        if not track['cues']:
            raise ValueError(f'Thiếu cue: {relative}')
        for cue in track['cues']:
            at = cue['atSeconds']
            if not math.isfinite(at) or not 0 <= at < duration or at < previous_at or cue['cue'] not in ('lounge', 'groove', 'peak'):
                raise ValueError(f'Cue không hợp lệ: {relative}')
            previous_at = at
        tracks.append(track); copies.append((path, public_dir / filename))
    return tracks, copies


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run', action='store_true', help='Chỉ kiểm tra và in danh sách, không ghi file')
    args = parser.parse_args()
    previous = json.loads(CATALOG.read_text(encoding='utf8')) if CATALOG.exists() else []
    previous_reika = json.loads(REIKA_CATALOG.read_text(encoding='utf8')) if REIKA_CATALOG.exists() else []
    try:
        tracks, copies = collect(SOURCE, previous, PUBLIC, '/assets/audio/club/playlist', 'track', True)
        reika_tracks, reika_copies = collect(REIKA_SOURCE, previous_reika, REIKA_PUBLIC, '/assets/audio/reika/playlist', 'reika', False)
    except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError) as error:
        parser.error(f'Không nhập nhạc được; chưa cập nhật catalog. Kiểm tra file/metadata và ffprobe: {error}')
    if args.dry_run:
        print(json.dumps({'club': tracks, 'reika': reika_tracks}, ensure_ascii=True, indent=2)); return
    PUBLIC.mkdir(parents=True, exist_ok=True)
    REIKA_PUBLIC.mkdir(parents=True, exist_ok=True)
    for source, destination in [*copies, *reika_copies]:
        if not destination.exists():
            temporary = destination.with_suffix(destination.suffix + '.tmp')
            shutil.copyfile(source, temporary); temporary.replace(destination)
    for catalog, items in ((CATALOG, tracks), (REIKA_CATALOG, reika_tracks)):
        temporary = catalog.with_suffix('.json.tmp')
        temporary.write_text(json.dumps(items, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
        temporary.replace(catalog)
    print(f'Da nhap {len(tracks)} bai Club + {len(reika_tracks)} bai Reika. Khoi dong lai pnpm dev de cap nhat web/server.')


if __name__ == '__main__':
    main()
