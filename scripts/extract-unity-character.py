"""Tách model/vật liệu từ unitypackage vào vùng processed, không nạp script hoặc sửa nguồn."""
import argparse
import hashlib
import json
import shutil
import tarfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('package', type=Path)
parser.add_argument('--character', required=True, choices=['yui', 'kuroki'])
args = parser.parse_args()
destination = (ROOT / 'assets/processed/unity' / args.character).resolve()
destination.mkdir(parents=True, exist_ok=True)
allowed = {'.fbx', '.png', '.jpg', '.jpeg', '.tga', '.mat', '.prefab', '.txt', '.md'}
assets = {}
with tarfile.open(args.package, 'r:gz') as archive:
    members = {member.name: member for member in archive.getmembers() if member.isfile()}
    used = set()
    for name, member in members.items():
        if not name.endswith('/pathname'):
            continue
        logical = PurePosixPath(archive.extractfile(member).read().decode('utf-8-sig').strip().replace('\\', '/'))
        if not logical.parts or logical.is_absolute() or '..' in logical.parts or logical.parts[0] != 'Assets' or any(':' in part or '\0' in part for part in logical.parts):
            raise ValueError(f'Đường dẫn gói không hợp lệ: {logical}')
        guid = name.rsplit('/', 1)[0]
        asset = members.get(guid + '/asset')
        if not asset or logical.suffix.lower() not in allowed:
            continue
        target = (destination / str(logical)).resolve()
        if not target.is_relative_to(destination) or str(target).casefold() in used:
            raise ValueError(f'Đường dẫn trùng hoặc vượt vùng đích: {logical}')
        used.add(str(target).casefold())
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('wb') as output:
            shutil.copyfileobj(archive.extractfile(asset), output)
        meta = members.get(guid + '/asset.meta')
        if meta:
            target.with_suffix(target.suffix + '.meta').write_bytes(archive.extractfile(meta).read())
        assets[guid.split('/')[-1]] = str(logical)
report = {'source': str(args.package.relative_to(ROOT) if args.package.is_absolute() else args.package),
          'sourceSha256': hashlib.sha256(args.package.read_bytes()).hexdigest(), 'assets': assets}
(destination / 'package-manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf8')
print(json.dumps({'character': args.character, 'assets': len(assets)}))
