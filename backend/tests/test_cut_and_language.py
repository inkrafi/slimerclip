import math
import struct
import subprocess
import wave

import render_pipeline
import transcript_service


def _speech_like(path, spans, total=20.0, rate=16000):
    """WAV tiruan: nada (\"bicara\") di rentang spans, hening di luar itu."""
    frames = bytearray()
    for i in range(int(total * rate)):
        t = i / rate
        loud = any(a <= t < b for a, b in spans)
        frames += struct.pack("<h", int(12000 * math.sin(2 * math.pi * 220 * t)) if loud else 0)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(bytes(frames))
    mp4 = str(path).replace(".wav", ".m4a")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(path), "-c:a", "aac", mp4], check=True)
    return mp4


def test_cut_moves_to_nearest_pause(tmp_path):
    # Kalimat: 2.0-6.8, 7.1-11.9 (jeda 0,3 dtk), 12.2-17.0
    media = _speech_like(tmp_path / "a.wav", [(2.0, 6.8), (7.1, 11.9), (12.2, 17.0)])
    start, end = render_pipeline.refine_cut(media, 7.6, 11.5)      # AI memotong di tengah kata
    assert 6.8 <= start <= 7.1      # awal pindah ke jeda sebelum kalimat kedua
    assert 11.9 <= end <= 12.2      # akhir pindah ke jeda setelah kalimat kedua


def test_cut_unchanged_without_pause(tmp_path):
    media = _speech_like(tmp_path / "b.wav", [(0.0, 20.0)])
    assert render_pipeline.refine_cut(media, 5.0, 15.0) == (5.0, 15.0)


def test_caption_track_prefers_profile_language():
    info = {"language": "en",
            "subtitles": {"id": [{"ext": "json3", "url": "id-manual"}]},
            "automatic_captions": {"en-orig": [{"ext": "json3", "url": "en-orig"}],
                                   "ja": [{"ext": "json3", "url": "ja-auto"}]}}
    assert transcript_service._pick_caption_track(info) == ("id", "id-manual")
    assert transcript_service._pick_caption_track(info, "en") == ("en-orig", "en-orig")
    assert transcript_service._pick_caption_track(info, "ja") == ("ja", "ja-auto")
