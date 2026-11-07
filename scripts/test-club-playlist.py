"""Kiểm tra pipeline nhập nhạc bằng WAV tạm, không thay catalog hoặc nhạc của người dùng."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
import wave

spec = importlib.util.spec_from_file_location('club_playlist', Path(__file__).with_name('import-club-playlist.py'))
playlist = importlib.util.module_from_spec(spec)
spec.loader.exec_module(playlist)


class PlaylistTest(unittest.TestCase):
    def test_import_and_preserve_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory)
            path = source / 'Nhạc thử.wav'
            with wave.open(str(path), 'wb') as audio:
                audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(8000); audio.writeframes(b'\0\0' * 8000)
            tracks, copies = playlist.collect(source, [])
            self.assertEqual(len(tracks), 1)
            song = tracks[0]
            self.assertAlmostEqual(song['durationSeconds'], 1)
            self.assertEqual(song['title'], 'Nhạc thử')
            self.assertTrue(song['url'].isascii())
            self.assertEqual(copies[0][0], path)
            song.update(title='Tên đã sửa', bpm=128, beatOffsetSeconds=.2)
            updated, _ = playlist.collect(source, [song])
            self.assertEqual(updated[0]['title'], 'Tên đã sửa')
            self.assertEqual(updated[0]['bpm'], 128)
            self.assertEqual(updated[0]['id'], song['id'])
            song['cues'] = [{'atSeconds': 2, 'cue': 'peak'}]
            with self.assertRaises(ValueError):
                playlist.collect(source, [song])

    def test_invalid_audio_does_not_make_catalog(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory); (source / 'broken.mp3').write_bytes(b'not audio')
            with self.assertRaises(Exception):
                playlist.collect(source, [])


if __name__ == '__main__':
    unittest.main()
