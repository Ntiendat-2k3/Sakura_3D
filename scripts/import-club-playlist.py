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


def collect(source, previous):
    default = json.loads((ROOT / 'packages/game-protocol/src/club-track.json').read_text(encoding='utf8'))
    existing = {item['id']: item for item in previous}
    tracks, copies = [], []
    for path in sorted(source.rglob('*')):
        if not path.is_file() or path.suffix.lower() not in ('.mp3', '.wav', '.ogg'):
            continue
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest == default.get('sha256'):
            continue
        relative = path.relative_to(source).as_posix()
        identity = 'track-' + hashlib.sha256(relative.encode('utf8')).hexdigest()[:16]
        duration, tags, bpm = probe(path)
        old = existing.get(identity, {})
        # URL chứa hash nội dung để trình duyệt không dùng nhầm cache khi thay file cùng tên.
        filename = f'{identity}-{digest[:12]}{path.suffix.lower()}'
        track = {'id': identity, 'title': old.get('title', tags.get('title', path.stem))[:160], 'url': f'/assets/audio/club/playlist/{filename}', 'durationSeconds': duration, 'bpm': old.get('bpm', bpm), 'beatOffsetSeconds': old.get('beatOffsetSeconds', 0), 'cues': old.get('cues', [{'atSeconds': 0, 'cue': 'groove'}])}
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
        tracks.append(track); copies.append((path, PUBLIC / filename))
    return tracks, copies


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run', action='store_true', help='Chỉ kiểm tra và in danh sách, không ghi file')
    args = parser.parse_args()
    previous = json.loads(CATALOG.read_text(encoding='utf8')) if CATALOG.exists() else []
    try:
        tracks, copies = collect(SOURCE, previous)
    except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError) as error:
        parser.error(f'Không nhập nhạc được; chưa cập nhật catalog. Kiểm tra file/metadata và ffprobe: {error}')
    if args.dry_run:
        print(json.dumps(tracks, ensure_ascii=True, indent=2)); return
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for source, destination in copies:
        if not destination.exists():
            temporary = destination.with_suffix(destination.suffix + '.tmp')
            shutil.copyfile(source, temporary); temporary.replace(destination)
    temporary = CATALOG.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(tracks, ensure_ascii=False, indent=2) + '\n', encoding='utf8'); temporary.replace(CATALOG)
    print(f'Da nhap {len(tracks)} bai moi + 1 bai mac dinh. Khoi dong lai pnpm dev de cap nhat web/server.')


if __name__ == '__main__':
    main()
