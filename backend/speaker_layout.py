"""
Tata letak vertikal yang mengikuti pembicara.

Alur:
  1. Ambil frame rentang klip 10x per detik (FFmpeg → pipe), deteksi wajah dengan YuNet
     (OpenCV). YuNet tetap menemukan wajah kecil/menyamping di shot lebar podcast.
  2. Deteksi pergantian shot (kamera pindah) agar pelacakan wajah dimulai ulang per shot.
  3. Lacak tiap orang di dalam shot dan ukur aktivitas mulutnya (perubahan piksel di area
     mulut antar frame, dikurangi gerakan kepala) — sinyal siapa yang sedang bicara.
  4. Tentukan tata letak per waktu:
       - close-up satu orang        → crop penuh 9:16 mengikuti wajahnya ("full")
       - shot lebar, satu orang bicara → zoom 9:16 ke orang itu ("zoom")
       - shot lebar, dua orang bergantian bicara → layar dibagi dua: orang kiri di atas,
         orang kanan di bawah ("split")
       - tidak ada wajah            → crop tengah
  5. Bangun satu filter graph FFmpeg dengan posisi crop berbasis waktu, sehingga klip
     tetap dirender dalam satu kali encode.
"""
import os
import subprocess
import urllib.request

import cv2
import numpy as np

MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
YUNET_PATH = os.path.join(MODELS_DIR, "face_detection_yunet_2023mar.onnx")
YUNET_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"

SAMPLE_FPS = 10
DETECT_WIDTH = 960
MIN_FACE_FRAC = 0.04       # wajah lebih kecil dari 4% tinggi frame diabaikan (penonton/latar)
SHOT_CUT_DIFF = 28.0       # beda rata-rata thumbnail grayscale antar sampel = pergantian shot
MIN_RUN_SECONDS = 1.5      # tata letak minimal bertahan selama ini (anti kedip)
MIN_SWITCH_SECONDS = 1.0   # perpindahan kamera minimal berjarak selama ini, juga antar-shot sumber
ACTIVITY_WINDOW = 1.2      # detik: perataan aktivitas mulut
DOMINANCE_RATIO = 1.6      # satu orang dianggap dominan jika aktivitasnya ≥ 1.6x yang lain
QUIET_LEVEL = 4.0          # di bawah ini dianggap tidak ada yang bicara

# Templat graph memakai penanda ukuran; sized() mengisinya. Lanczos: hasil scale (terutama upscale) lebih tajam.
SCALE_FULL = "scale=@W@:@H@:flags=lanczos,setsar=1"
SCALE_TOP = "scale=@W@:@HT@:flags=lanczos,setsar=1"
SCALE_BOTTOM = "scale=@W@:@HB@:flags=lanczos,setsar=1"
# Streaming game: gameplay di atas (60%), facecam di bawah (40%)
GAME_SHARE = 0.6
SCALE_GAME = "scale=@W@:@HG@:flags=lanczos,setsar=1"
SCALE_CAM = "scale=@W@:@HC@:flags=lanczos,setsar=1"
FACECAM_MIN_PRESENCE = 0.3   # wajah facecam harus terlihat di ≥30% sampel, kalau tidak dianggap tanpa facecam
FACECAM_SPAN = 3.2           # tinggi crop facecam = 3,2x tinggi wajah (wajah + bahu, kira-kira jendela kameranya)


def sized(template: str, out_w: int, out_h: int) -> str:
    """Isi ukuran output (out_w x out_h) ke templat graph dari plan()/center_graph()."""
    top = _even(out_h / 2)
    game = _even(out_h * GAME_SHARE)
    return (template.replace("@W@", str(out_w)).replace("@HT@", str(top))
            .replace("@HB@", str(out_h - top)).replace("@HG@", str(game)).replace("@HC@", str(out_h - game))
            .replace("@H@", str(out_h)))


def ensure_model() -> str:
    """Unduh model YuNet (±230 KB) saat pertama kali dipakai."""
    if not os.path.isfile(YUNET_PATH):
        os.makedirs(MODELS_DIR, exist_ok=True)
        tmp = YUNET_PATH + ".part"
        urllib.request.urlretrieve(YUNET_URL, tmp)
        os.replace(tmp, YUNET_PATH)
    return YUNET_PATH


def _even(v: float) -> int:
    v = int(round(v))
    return v - (v % 2)


def _probe(video_path: str) -> tuple:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Tidak dapat membuka video: {video_path}")
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()
    return w, h


class _Track:
    __slots__ = ("id", "samples", "last_center", "last_size", "prev_mouth", "prev_face")

    def __init__(self, track_id):
        self.id = track_id
        self.samples = {}          # index sampel → (cx, cy, fh, aktivitas)
        self.last_center = None
        self.last_size = None
        self.prev_mouth = None
        self.prev_face = None


class SpeakerLayoutPlanner:
    def __init__(self):
        self._detector = None

    def _get_detector(self, size):
        if self._detector is None:
            self._detector = cv2.FaceDetectorYN.create(ensure_model(), "", size, 0.6, 0.3, 5000)
        self._detector.setInputSize(size)
        return self._detector

    # ── 1-3: analisis frame ────────────────────────────────────────
    def _analyze(self, video_path, start, duration, src_w, src_h, callback=None):
        det_w = min(DETECT_WIDTH, src_w)
        det_w -= det_w % 2
        det_h = _even(src_h * det_w / src_w)
        scale = src_w / det_w                      # koordinat deteksi → piksel sumber
        frame_bytes = det_w * det_h * 3
        expected = max(1, int(duration * SAMPLE_FPS))
        detector = self._get_detector((det_w, det_h))

        cmd = ["ffmpeg", "-v", "error", "-ss", f"{start:.3f}", "-i", video_path, "-t", f"{duration:.3f}",
               "-an", "-vf", f"fps={SAMPLE_FPS},scale={det_w}:{det_h}", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)

        shots = []                 # [{start: idx, end: idx, tracks: [_Track]}]
        prev_thumb = None
        idx = 0
        try:
            while True:
                buf = proc.stdout.read(frame_bytes)
                if len(buf) < frame_bytes:
                    break
                frame = np.frombuffer(buf, np.uint8).reshape(det_h, det_w, 3)
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

                thumb = cv2.resize(gray, (48, 27), interpolation=cv2.INTER_AREA).astype(np.float32)
                if prev_thumb is None or float(np.mean(np.abs(thumb - prev_thumb))) > SHOT_CUT_DIFF:
                    shots.append({"start": idx, "end": idx, "tracks": []})
                prev_thumb = thumb
                shot = shots[-1]
                shot["end"] = idx

                _, faces = detector.detect(frame)
                faces = [] if faces is None else [f for f in faces if f[3] >= det_h * MIN_FACE_FRAC]
                for f in faces:
                    self._update_track(shot, idx, f, gray, scale)

                if callback and idx % 20 == 0:
                    callback({'status': 'tracking', 'progress': 10 + min(idx / expected, 1) * 20})
                idx += 1
        finally:
            proc.stdout.close()
            proc.wait()
        return shots, idx

    @staticmethod
    def _update_track(shot, idx, face, gray, scale):
        x, y, w, h = (float(v) for v in face[:4])
        cx, cy = x + w / 2, y + h / 2

        # Cocokkan dengan orang yang sudah dilacak di shot ini (pusat wajah berdekatan)
        best, best_dist = None, None
        for tr in shot["tracks"]:
            if tr.last_center is None or idx in tr.samples:
                continue
            d = np.hypot(cx - tr.last_center[0], cy - tr.last_center[1])
            if d < max(w, tr.last_size) * 0.8 and (best_dist is None or d < best_dist):
                best, best_dist = tr, d
        if best is None:
            best = _Track(len(shot["tracks"]))
            shot["tracks"].append(best)

        # Aktivitas mulut: perubahan area mulut antar sampel, dikurangi gerakan seluruh wajah
        mx0 = int(min(face[10], face[12]) - w * 0.08)
        mx1 = int(max(face[10], face[12]) + w * 0.08)
        my = (face[11] + face[13]) / 2
        mouth = gray[max(0, int(my - h * 0.14)):max(1, int(my + h * 0.18)), max(0, mx0):max(1, mx1)]
        whole = gray[max(0, int(y)):max(1, int(y + h)), max(0, int(x)):max(1, int(x + w))]
        activity = 0.0
        if mouth.size and whole.size:
            mouth = cv2.resize(mouth, (24, 16), interpolation=cv2.INTER_AREA).astype(np.float32)
            whole = cv2.resize(whole, (24, 24), interpolation=cv2.INTER_AREA).astype(np.float32)
            if best.prev_mouth is not None and best.samples.get(idx - 1) is not None:
                m = float(np.mean(np.abs(mouth - best.prev_mouth)))
                g = float(np.mean(np.abs(whole - best.prev_face)))
                activity = max(0.0, m - 0.6 * g)
            best.prev_mouth, best.prev_face = mouth, whole

        best.samples[idx] = (cx * scale, cy * scale, h * scale, activity)
        best.last_center = (cx, cy)
        best.last_size = w

    # ── 4: keputusan tata letak ────────────────────────────────────
    @staticmethod
    def _smoothed_activity(track, start, end):
        n = end - start + 1
        raw = np.array([track.samples.get(i, (0, 0, 0, 0.0))[3] for i in range(start, end + 1)], dtype=np.float32)
        k = max(1, int(ACTIVITY_WINDOW * SAMPLE_FPS))
        kernel = np.ones(k, dtype=np.float32) / k
        return np.convolve(raw, kernel, mode="same") if n >= k else np.full(n, raw.mean() if n else 0)

    @staticmethod
    def _median_pos(track, start, end):
        pts = [track.samples[i] for i in range(start, end + 1) if i in track.samples]
        if not pts:
            return None
        arr = np.array(pts)
        return float(np.median(arr[:, 0])), float(np.median(arr[:, 1])), float(np.median(arr[:, 2]))

    def _decide(self, shots, allow_split):
        """Hasil: list (idx_awal, idx_akhir, jenis, data) per run tata letak."""
        runs = []
        for shot in shots:
            s, e = shot["start"], shot["end"]
            length = e - s + 1
            people = [t for t in shot["tracks"] if len(t.samples) >= max(3, length * 0.3)]
            people.sort(key=lambda t: len(t.samples), reverse=True)

            if not people:
                runs.append([s, e, "center", None])
                continue

            if len(people) == 1:
                pos = self._median_pos(people[0], s, e)
                runs.append([s, e, "single", pos])
                continue

            pair = sorted(people[:2], key=lambda t: self._median_pos(t, s, e)[0])   # kiri, kanan
            act = [self._smoothed_activity(t, s, e) for t in pair]
            pos = [self._median_pos(t, s, e) for t in pair]

            labels = []
            for i in range(length):
                a, b = float(act[0][i]), float(act[1][i])
                if max(a, b) < QUIET_LEVEL:
                    labels.append(labels[-1] if labels else ("split" if allow_split else 0))
                elif a >= b * DOMINANCE_RATIO:
                    labels.append(0)
                elif b >= a * DOMINANCE_RATIO:
                    labels.append(1)
                else:
                    labels.append("split" if allow_split else (0 if a >= b else 1))

            # Gabungkan label berurutan menjadi run, lalu buang run yang terlalu pendek
            seg = []
            for i, lab in enumerate(labels):
                if seg and seg[-1][2] == lab:
                    seg[-1][1] = s + i
                else:
                    seg.append([s + i, s + i, lab])
            min_len = int(MIN_RUN_SECONDS * SAMPLE_FPS)
            merged = []
            for r in seg:
                if merged and (r[1] - r[0] + 1) < min_len:
                    merged[-1][1] = r[1]
                elif merged and merged[-1][2] == r[2]:
                    merged[-1][1] = r[1]
                else:
                    merged.append(r)
            if len(merged) > 1 and (merged[0][1] - merged[0][0] + 1) < min_len:
                merged[1][0] = merged[0][0]
                merged.pop(0)

            for r0, r1, lab in merged:
                if lab == "split":
                    runs.append([r0, r1, "split", pos])
                else:
                    runs.append([r0, r1, "zoom", pos[lab]])
        return self._stabilize(runs)

    @staticmethod
    def _same_framing(a, b) -> bool:
        """Dua run menyorot tempat yang (hampir) sama: pergantiannya tidak perlu terlihat."""
        if a[2] != b[2]:
            return False
        if a[2] == "center":
            return True
        pa, pb = (a[3], b[3]) if a[2] == "split" else ([a[3]], [b[3]])
        return all(abs(x[0] - y[0]) < max(x[2], y[2]) * 0.5 and abs(x[1] - y[1]) < max(x[2], y[2]) * 0.5
                   for x, y in zip(pa, pb))

    def _stabilize(self, runs):
        """
        Batas MIN_RUN_SECONDS hanya berlaku di dalam satu shot. Shot sumber yang pendek
        (atau pergantian shot palsu karena gerakan/cahaya) bisa menghasilkan run sangat pendek
        yang terlihat seperti glitch, jadi run < MIN_SWITCH_SECONDS ikut tata letak sebelumnya,
        dan run berurutan dengan sorotan yang sama digabung.
        """
        min_len = int(round(MIN_SWITCH_SECONDS * SAMPLE_FPS))
        out = []
        for r in runs:
            r = list(r)
            if out and ((r[1] - r[0] + 1) < min_len or self._same_framing(out[-1], r)):
                out[-1][1] = r[1]
            else:
                out.append(r)
        if len(out) > 1 and (out[0][1] - out[0][0] + 1) < min_len:
            out[1][0] = out[0][0]
            out.pop(0)
        return out

    # ── 5: filter graph FFmpeg ─────────────────────────────────────
    @staticmethod
    def _piecewise(points, default):
        """[(t_akhir, nilai), ...] → ekspresi FFmpeg nested if berbasis waktu t."""
        if not points:
            return str(default)
        expr = str(points[-1][1])
        for t_end, value in reversed(points[:-1]):
            expr = f"if(lt(t,{t_end:.2f}),{value},{expr})"
        return expr

    def plan(self, video_path, start, end, allow_split=True, callback=None) -> tuple:
        """
        Hasil: (templat filter_graph, ringkasan). Templat membaca [0:v] dan menghasilkan [vlayout];
        ukuran output diisi dengan sized(), jadi hasil lacak wajah bisa dipakai untuk resolusi apa pun.
        """
        src_w, src_h = _probe(video_path)
        duration = max(0.1, end - start)

        # Video sudah vertikal/sempit → cukup crop tengah
        if src_w / src_h <= 9 / 16 + 0.01:
            return self.center_graph(src_w, src_h), {"mode": "center"}

        shots, n_samples = self._analyze(video_path, start, duration, src_w, src_h, callback)
        if not shots or n_samples == 0:
            return self.center_graph(src_w, src_h), {"mode": "center"}
        runs = self._decide(shots, allow_split)

        def t_of(idx):
            return idx / SAMPLE_FPS

        full_w = _even(min(src_w, src_h * 9 / 16))

        # Ukuran tetap per cabang (crop FFmpeg tidak bisa berubah ukuran di tengah klip)
        zoom_faces = [r[3][2] for r in runs if r[2] == "zoom"] + \
                     [r[3][2] for r in runs if r[2] == "single" and r[3][2] < src_h * 0.10]
        split_faces = [p[2] for r in runs if r[2] == "split" for p in r[3]]
        zoom_h = _even(np.clip(np.median(zoom_faces) * 6, src_h * 0.55, src_h)) if zoom_faces else src_h
        zoom_w = _even(min(src_w, zoom_h * 9 / 16))
        split_h = _even(np.clip(np.median(split_faces) * 3.4, src_h * 0.35, src_h)) if split_faces else src_h // 2
        split_w = _even(min(src_w, split_h * 9 / 8))
        split_h = _even(min(split_h, split_w * 8 / 9))

        def clamp(v, lo, hi):
            return int(max(lo, min(hi, v)))

        full_x, zoom_x, zoom_y, top_x, top_y, bot_x, bot_y = [], [], [], [], [], [], []
        zoom_spans, split_spans = [], []
        summary = {"full": 0.0, "zoom": 0.0, "split": 0.0, "shots": len(shots)}

        for i_run, (r0, r1, kind, data) in enumerate(runs):
            # Run terakhir berlaku sampai klip habis (frame setelah sampel terakhir tidak boleh kosong)
            t_end = t_of(r1 + 1) if i_run < len(runs) - 1 else 1e6
            span = (t_of(r0), t_end)
            seconds = t_of(r1 + 1) - t_of(r0)   # durasi asli, untuk ringkasan
            if kind == "single" and data[2] < src_h * 0.10:
                kind = "zoom"   # orang sendirian tapi kecil di frame → perbesar
            if kind in ("center", "single"):
                cx = src_w / 2 if kind == "center" else data[0]
                full_x.append((t_end, clamp(cx - full_w / 2, 0, src_w - full_w)))
                summary["full"] += seconds
            elif kind == "zoom":
                cx, cy, _ = data
                zoom_x.append((t_end, clamp(cx - zoom_w / 2, 0, src_w - zoom_w)))
                zoom_y.append((t_end, clamp(cy - zoom_h * 0.35, 0, src_h - zoom_h)))
                zoom_spans.append(span)
                summary["zoom"] += seconds
            else:
                (ax, ay, _), (bx, by, _) = data
                top_x.append((t_end, clamp(ax - split_w / 2, 0, src_w - split_w)))
                top_y.append((t_end, clamp(ay - split_h * 0.4, 0, src_h - split_h)))
                bot_x.append((t_end, clamp(bx - split_w / 2, 0, src_w - split_w)))
                bot_y.append((t_end, clamp(by - split_h * 0.4, 0, src_h - split_h)))
                split_spans.append(span)
                summary["split"] += seconds

        # Nilai cabang di luar run-nya tidak terlihat (tertutup overlay), tapi harus valid:
        # pakai nilai run terdekat agar tetap di dalam frame.
        center_full = (src_w - full_w) // 2
        branches = ["full"] + (["zoom"] if zoom_spans else []) + (["split"] if split_spans else [])
        n_split = len(branches) + (1 if split_spans else 0)

        # Rentang setengah terbuka [a, b) dengan perbandingan yang sama seperti ekspresi crop (lt):
        # tanpa celah antar-run, jadi tidak ada frame yang jatuh ke crop dasar saat berpindah
        def enable(spans):
            return "+".join(f"gte(t,{a:.2f})*lt(t,{b:.2f})" for a, b in spans)

        parts = [f"[0:v]split={n_split}" + "".join(f"[s{i}]" for i in range(n_split))]
        parts.append(f"[s0]crop={full_w}:{src_h}:x='{self._piecewise(full_x, center_full)}':y=0,"
                     f"{SCALE_FULL}[bfull]")
        i = 1
        if zoom_spans:
            parts.append(f"[s{i}]crop={zoom_w}:{zoom_h}:x='{self._piecewise(zoom_x, 0)}':y='{self._piecewise(zoom_y, 0)}',"
                         f"{SCALE_FULL}[bzoom]")
            i += 1
        if split_spans:
            parts.append(f"[s{i}]crop={split_w}:{split_h}:x='{self._piecewise(top_x, 0)}':y='{self._piecewise(top_y, 0)}',"
                         f"{SCALE_TOP}[btop]")
            parts.append(f"[s{i + 1}]crop={split_w}:{split_h}:x='{self._piecewise(bot_x, 0)}':y='{self._piecewise(bot_y, 0)}',"
                         f"{SCALE_BOTTOM}[bbot]")
            parts.append("[btop][bbot]vstack=2[bsplit]")

        current = "bfull"
        if zoom_spans:
            parts.append(f"[{current}][bzoom]overlay=0:0:enable='{enable(zoom_spans)}'[ozoom]")
            current = "ozoom"
        if split_spans:
            parts.append(f"[{current}][bsplit]overlay=0:0:enable='{enable(split_spans)}'[osplit]")
            current = "osplit"
        parts.append(f"[{current}]null[vlayout]")

        summary = {k: round(v, 1) if isinstance(v, float) else v for k, v in summary.items()}
        summary["mode"] = "speaker"
        return ";".join(parts), summary

    def plan_gaming(self, video_path, start, end, callback=None) -> tuple:
        """
        Streaming game: gameplay di atas, facecam streamer di bawah. Facecam = overlay kecil di posisi tetap,
        jadi posisinya diambil dari sel grid yang paling sering berisi wajah sepanjang klip (wajah karakter game
        berpindah-pindah, facecam tidak). Tanpa facecam → crop gameplay di tengah (tata letak penuh).
        """
        src_w, src_h = _probe(video_path)
        if src_w / src_h <= 9 / 16 + 0.01:
            return self.center_graph(src_w, src_h), {"mode": "center"}
        shots, n_samples = self._analyze(video_path, start, max(0.1, end - start), src_w, src_h, callback)
        points = [p for shot in shots for track in shot["tracks"] for p in track.samples.values()]
        if not points or n_samples == 0:
            return self.center_graph(src_w, src_h), {"mode": "center"}
        cells: dict = {}
        for cx, cy, fh, _ in points:
            cells.setdefault((int(cx / src_w * 6), int(cy / src_h * 6)), []).append((cx, cy, fh))
        best = max(cells.values(), key=len)
        if len(best) < n_samples * FACECAM_MIN_PRESENCE:
            return self.center_graph(src_w, src_h), {"mode": "center"}
        arr = np.array(best)
        cx, cy, fh = (float(np.median(arr[:, i])) for i in range(3))
        return self.gaming_graph(src_w, src_h, cx, cy, fh), {
            "mode": "gaming", "facecam": [round(cx), round(cy), round(fh)]}

    @staticmethod
    def gaming_graph(src_w, src_h, cx, cy, fh, out_w=1080, out_h=1920) -> str:
        """Templat graph gameplay (atas) + facecam (bawah); perbandingan crop mengikuti ukuran tiap panel."""
        game_h = _even(out_h * GAME_SHARE)
        cam_aspect = out_w / (out_h - game_h)
        game_aspect = out_w / game_h

        ch = _even(min(src_h, max(src_h * 0.15, fh * FACECAM_SPAN)))
        cw = _even(min(src_w, ch * cam_aspect))
        ch = _even(min(ch, cw / cam_aspect))
        cam_x = int(max(0, min(src_w - cw, cx - cw / 2)))
        cam_y = int(max(0, min(src_h - ch, cy - ch * 0.45)))

        gh = _even(min(src_h, src_w / game_aspect))
        gw = _even(min(src_w, gh * game_aspect))
        game_x = (src_w - gw) // 2
        # Facecam ikut terpotong di panel gameplay → geser gameplay menjauh dari facecam bila masih muat
        if cam_x < game_x + gw and cam_x + cw > game_x:
            if cx < src_w / 2 and cam_x + cw + gw <= src_w:
                game_x = cam_x + cw
            elif cx >= src_w / 2 and cam_x - gw >= 0:
                game_x = cam_x - gw
        game_y = (src_h - gh) // 2
        return (f"[0:v]split=2[sg][sc];"
                f"[sg]crop={gw}:{gh}:{game_x}:{game_y},{SCALE_GAME}[bgame];"
                f"[sc]crop={cw}:{ch}:{cam_x}:{cam_y},{SCALE_CAM}[bcam];"
                f"[bgame][bcam]vstack=2[vlayout]")

    @staticmethod
    def center_graph(src_w, src_h) -> str:
        """Crop tengah 9:16 terbesar yang muat di frame."""
        crop_w = _even(min(src_w, src_h * 9 / 16))
        crop_h = _even(min(src_h, src_w * 16 / 9))
        return (f"[0:v]crop={crop_w}:{crop_h}:{(src_w - crop_w) // 2}:{(src_h - crop_h) // 2},"
                f"{SCALE_FULL}[vlayout]")

    def center_plan(self, video_path) -> tuple:
        src_w, src_h = _probe(video_path)
        return self.center_graph(src_w, src_h), {"mode": "center"}
