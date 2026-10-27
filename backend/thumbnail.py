"""
Thumbnail klip (cover Shorts/TikTok/Reels, 1080x1920):
  - best_frame_time → frame dengan wajah paling jelas (besar, tajam, tidak di tengah gerakan/pergantian shot)
  - thumbnail_hook  → teks besar 1-3 kata, gayanya mengikuti hook klip
Gambarnya dirender oleh RenderPipeline.render_thumbnail dari video sumber (tata letak sama dengan klip).
"""
import subprocess

import cv2
import numpy as np

from speaker_layout import ensure_model

TEXT_MAX = 40
SAMPLE_FPS = 2
SAMPLE_W, SAMPLE_H = 288, 512
EDGE_SECONDS = 0.5           # hindari frame paling awal/akhir (sering transisi)
SHADE = {"shape": "bottom", "strength": 90, "height": 75}


def clean_text(value) -> str:
    """Teks thumbnail: satu baris atau beberapa (maks 3), *kata* = warna aksen; tag ASS dibuang."""
    import re
    lines = [re.sub(r"[{}\\\r]", "", line).strip() for line in str(value or "").split("\n")]
    return "\n".join([line for line in lines if line][:3])[:TEXT_MAX]


def best_frame_time(clip_path: str, duration: float) -> float:
    """
    Detik terbaik (relatif awal file klip 9:16) untuk thumbnail.
    Skor = luas wajah terbesar × keyakinan deteksi × ketajaman wajah × kestabilan (tidak sedang bergerak/ganti shot).
    Tanpa wajah sama sekali → frame paling tajam.
    """
    cmd = ["ffmpeg", "-v", "error", "-i", clip_path, "-an",
           "-vf", f"fps={SAMPLE_FPS},scale={SAMPLE_W}:{SAMPLE_H}", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    size = SAMPLE_W * SAMPLE_H * 3
    frames = [np.frombuffer(raw[i:i + size], np.uint8).reshape(SAMPLE_H, SAMPLE_W, 3)
              for i in range(0, len(raw) - size + 1, size)]
    if not frames:
        return min(1.0, duration / 2)

    detector = cv2.FaceDetectorYN.create(ensure_model(), "", (SAMPLE_W, SAMPLE_H), 0.6, 0.3, 50)
    grays = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY) for f in frames]
    best, best_score, best_sharp, sharpest = None, 0.0, -1.0, 0
    for i, (frame, gray) in enumerate(zip(frames, grays)):
        t = i / SAMPLE_FPS
        if len(frames) > 4 and (t < EDGE_SECONDS or t > duration - EDGE_SECONDS):
            continue
        sharp = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        if sharp > best_sharp:
            best_sharp, sharpest = sharp, i
        _, faces = detector.detect(frame)
        if faces is None:
            continue
        x, y, w, h, *_, conf = max(faces, key=lambda f: f[2] * f[3])
        x0, y0 = max(0, int(x)), max(0, int(y))
        face = gray[y0:y0 + max(1, int(h)), x0:x0 + max(1, int(w))]
        if face.size == 0:
            continue
        face_sharp = float(cv2.Laplacian(face, cv2.CV_64F).var())
        # Beda dengan frame tetangga besar → gerakan cepat / pergantian shot (frame cenderung buram)
        moves = [float(np.mean(cv2.absdiff(gray, grays[j]))) for j in (i - 1, i + 1) if 0 <= j < len(grays)]
        stability = 1 / (1 + max(moves or [0]) / 12)
        score = (w * h) / (SAMPLE_W * SAMPLE_H) * float(conf) * min(1.0, face_sharp / 120) * stability
        if score > best_score:
            best, best_score = i, score
    return round((best if best is not None else sharpest) / SAMPLE_FPS, 2)


TEXT_WIDTH = 900             # px dari 1080 (margin kiri-kanan hook)
CHAR_EM = 0.42               # lebar rata-rata huruf font tebal di libass, × ukuran font (diukur dari hasil render)
WRAP_CHARS = 14              # baris lebih panjang dari ini dipecah libass → ukuran dihitung dari 14 huruf


def text_size(text: str) -> int:
    """Ukuran teks sebesar mungkin: baris terpanjang kira-kira selebar area teks (130-260 px)."""
    longest = max((len(line.replace("*", "")) for line in text.split("\n")), default=1)
    return int(max(130, min(260, TEXT_WIDTH / (min(max(longest, 1), WRAP_CHARS) * CHAR_EM))))


def thumbnail_hook(hook: dict, text: str) -> dict:
    """
    Hook versi thumbnail: gaya/aksen/font dari hook klip, tanpa animasi, teks sebesar mungkin
    dan diletakkan di bawah wajah (wajah di klip 9:16 umumnya di sepertiga atas).
    """
    return {**hook, "enabled": True, "text": text, "label": "", "anim": "cut", "duration": 0,
            "size": text_size(text), "position_y": 52}
