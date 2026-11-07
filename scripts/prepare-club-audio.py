"""Phân tích MP3 người dùng bằng decoder của Blender; không tải nhạc hoặc thêm dependency game."""
import aud
import hashlib
import json
import shutil
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'assets/source/audio/club/music.mp3'
sound = aud.Sound.file(str(source))
rate, channels = sound.specs
samples = np.asarray(sound.data(), dtype=np.float32)
if samples.ndim > 1:
    samples = samples.mean(axis=1)
duration = len(samples) / rate
if duration <= 1 or not np.isfinite(samples).all():
    raise RuntimeError('Không giải mã được MP3 hợp lệ')

# Spectral flux tìm nhịp gõ; tempo/offset là ước lượng, không coi là beat grid đã biên tập thủ công.
step = max(1, int(rate / 11025))
signal = samples[::step]
analysis_rate = rate / step
window_size, hop = 1024, 256
windows = np.lib.stride_tricks.sliding_window_view(signal, window_size)[::hop]
spectra = np.abs(np.fft.rfft(windows * np.hanning(window_size), axis=1))
frequencies = np.fft.rfftfreq(window_size, 1 / analysis_rate)
spectra = np.log1p(spectra[:, (frequencies >= 60) & (frequencies <= 5000)])
flux = np.maximum(0, np.diff(spectra, axis=0)).sum(axis=1)
baseline = np.convolve(flux, np.ones(43) / 43, mode='same')
onsets = np.maximum(0, flux - baseline)
onsets /= max(float(onsets.max()), 1e-9)
frame_seconds = hop / analysis_rate
candidates = np.arange(80, 161, .25)
scores = []
for bpm in candidates:
    period = 60 / bpm / frame_seconds
    score = 0.0
    for multiplier, weight in [(1, 1), (2, .55), (3, .3), (.5, .15)]:
        lag = int(round(period * multiplier))
        if 0 < lag < len(onsets):
            score += weight * float(np.dot(onsets[:-lag], onsets[lag:])) / (len(onsets) - lag)
    scores.append(score)
best = int(np.argmax(scores))
bpm = float(candidates[best])
times = (np.arange(len(onsets)) + 1) * frame_seconds + window_size / (2 * analysis_rate)
# Tinh chỉnh liên tục để tránh lượng tử hóa lag FFT làm lệch nhịp khi bài dài vài phút.
refined = np.arange(bpm - 2, bpm + 2.001, .01)
coherence = []
for candidate in refined:
    phase = 2 * np.pi * times * candidate / 60
    coherence.append(abs(np.dot(onsets, np.exp(-1j * phase))) + .3 * abs(np.dot(onsets, np.exp(-2j * phase))))
bpm = round(float(refined[int(np.argmax(coherence))]), 2)
period_seconds = 60 / bpm
phases = np.linspace(0, period_seconds, 180, endpoint=False)
phase_scores = []
for phase in phases:
    phase_distance = np.abs((times - phase + period_seconds / 2) % period_seconds - period_seconds / 2)
    phase_scores.append(float(np.sum(onsets * np.exp(-.5 * (phase_distance / .035) ** 2))))
offset = float(phases[int(np.argmax(phase_scores))])
frame_energy = np.sqrt(np.mean(windows ** 2, axis=1))
energy_times = np.arange(len(frame_energy)) * frame_seconds
phrase_seconds = 32 * 60 / bpm
segments = []
for at in np.arange(0, duration, phrase_seconds):
    values = frame_energy[(energy_times >= at) & (energy_times < at + phrase_seconds)]
    segments.append((float(at), float(values.mean()) if len(values) else 0))
levels = np.array([value for _, value in segments])
low, high = np.quantile(levels, [.25, .7])
cues = []
for at, energy in segments:
    cue = 'lounge' if energy < low else 'peak' if energy >= high else 'groove'
    if not cues or cue != cues[-1]['cue']:
        cues.append({'atSeconds': round(at, 3), 'cue': cue})

metadata = {
    'id': 'club-music', 'title': 'music.mp3', 'url': '/assets/audio/club/music.mp3',
    'durationSeconds': round(duration, 6), 'bpm': bpm, 'beatOffsetSeconds': round(offset, 4),
    'cues': cues, 'analysis': 'Spectral-flux tempo/phase and phrase RMS cues; estimated, not manually verified',
    'sampleRate': rate, 'channels': channels, 'bytes': source.stat().st_size,
    'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'license': 'User supplied for this local project; redistribution rights not independently verified',
}
target = ROOT / 'apps/web/public/assets/audio/club/music.mp3'
target.parent.mkdir(parents=True, exist_ok=True)
if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() != metadata['sha256']:
    backup = ROOT / 'assets/processed/audio/club' / ('music.previous-' + hashlib.sha256(target.read_bytes()).hexdigest()[:12] + '.mp3')
    backup.parent.mkdir(parents=True, exist_ok=True)
    if not backup.exists(): shutil.copy2(target, backup)
if not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest() != metadata['sha256']:
    shutil.copy2(source, target)
output = ROOT / 'packages/game-protocol/src/club-track.json'
output.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf8')
(ROOT / 'assets/processed/club-audio-analysis.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf8')
print(json.dumps({'durationSeconds': duration, 'bpmEstimate': bpm, 'offsetEstimate': offset, 'cues': len(cues), 'sampleRate': rate, 'channels': channels}))
