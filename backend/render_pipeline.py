import json
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor

from caption_service import get_caption_service
import clip_effects
from caption_styles import FONTS, FONTS_DIR
from speaker_layout import SpeakerLayoutPlanner, _probe, sized

CLIPS_DIR = os.path.join(os.path.dirname(__file__), "clips")
os.makedirs(CLIPS_DIR, exist_ok=True)
PREVIEW_W = 540  # lebar video pratinjau (9:16 → 540x960)
# Batas bitrate final (Mbps) per lebar video: cukup longgar agar CRF 18 tidak dipotong di adegan ramai
MAX_RATE = {720: 8, 1080: 16, 2160: 45}


def _video_args(preview: bool, width: int) -> list:
    """
    Opsi encode H.264. Pratinjau: cepat & kecil. Final: kualitas tinggi untuk diupload ulang ke
    TikTok/Shorts (platform meng-encode ulang, jadi sumber yang bersih = hasil yang lebih tajam):
    High profile, yuv420p, frame rate konstan, warna BT.709 ditandai agar tidak pucat di aplikasi.
    """
    if preview:
        return ["-c:v", "libx264", "-preset", "veryfast", "-crf", "27", "-pix_fmt", "yuv420p"]
    rate = MAX_RATE.get(width, 16)
    return ["-c:v", "libx264", "-preset", "fast" if width > 1080 else "medium", "-crf", "18",
            "-profile:v", "high", "-pix_fmt", "yuv420p", "-maxrate", f"{rate}M", "-bufsize", f"{rate * 2}M",
            "-fps_mode", "cfr", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709"]


def _ffmpeg_error(e: subprocess.CalledProcessError) -> str:
    """Ambil beberapa baris terakhir stderr FFmpeg (bagian awal hanya banner/info stream)."""
    lines = [l.strip() for l in e.stderr.decode('utf-8', errors='ignore').splitlines() if l.strip()]
    return " | ".join(lines[-3:])


def _fonts_dir_for(cwd: str) -> str:
    """Path folder font untuk filter ass, relatif terhadap cwd FFmpeg (tanpa ':' drive Windows)."""
    try:
        return os.path.relpath(FONTS_DIR, cwd).replace("\\", "/")
    except ValueError:  # beda drive di Windows → path absolut: dikutip (level graph) + ':' di-escape (level opsi)
        return "'" + FONTS_DIR.replace("\\", "/").replace(":", r"\:") + "'"


def _run_ffmpeg(cmd: list, error_prefix: str, cwd: str = None):
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=cwd)
    except subprocess.CalledProcessError as e:
        raise Exception(f"{error_prefix}: {_ffmpeg_error(e)}")


def _even_int(v: float) -> int:
    return int(v) - int(v) % 2


def _has_audio(path: str) -> bool:
    try:
        import av
        with av.open(path) as container:
            return bool(container.streams.audio)
    except Exception:
        return True  # tidak bisa dicek: anggap ada


def _remove_quietly(path: str):
    try:
        if os.path.exists(path):
            os.remove(path)
    except OSError as e:
        print(f"Gagal menghapus file sementara {path}: {e}")


class RenderPipeline:
    def __init__(self):
        self.caption_service = get_caption_service()
        self.layout_planner = SpeakerLayoutPlanner()

    def _time_to_seconds(self, time_str: str) -> float:
        """Konversi MM:SS atau HH:MM:SS ke detik (menit boleh > 59, mis. '75:30')."""
        parts = time_str.strip().split(':')
        if len(parts) == 2:
            return float(parts[0]) * 60 + float(parts[1])
        elif len(parts) == 3:
            return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
        raise ValueError(f"Format waktu tidak valid: {time_str}")

    @staticmethod
    def _asset_path(assets_dir: str, name) -> str | None:
        return clip_effects.asset_path(assets_dir, name)

    def _layout_for(self, video_path, start_sec, end_sec, target_w, target_h, options, layout_path, callback):
        """
        Tata letak 9:16 (filter graph [0:v] → [vlayout] berukuran target). Hasil "ikuti pembicara" disimpan
        per klip sebagai templat tanpa ukuran, jadi render final setelah pratinjau (rentang sama, resolusi
        apa pun termasuk 4K) tidak perlu melacak wajah lagi.
        """
        graph, summary = self._layout_template(video_path, start_sec, end_sec, options, layout_path, callback)
        return sized(graph, target_w, target_h), summary

    def _layout_template(self, video_path, start_sec, end_sec, options, layout_path, callback):
        tracking, split = options.get('smart_tracking', True), options.get('split_screen', True)
        key = f"v2-{start_sec:.2f}-{end_sec:.2f}-{int(tracking)}{int(split)}"
        try:
            with open(layout_path, encoding="utf-8") as f:
                cached = json.load(f)
            if cached.get("key") == key:
                return cached["graph"], cached["summary"]
        except (OSError, ValueError, KeyError, AttributeError):
            pass

        if tracking:
            if callback: callback({'status': 'tracking', 'progress': 10})
            try:
                graph, summary = self.layout_planner.plan(
                    video_path, start_sec, end_sec, allow_split=split, callback=callback)
            except Exception as e:
                print(f"Tata letak pembicara gagal: {e}, fallback ke crop tengah.")
                return self.layout_planner.center_plan(video_path)
        else:
            graph, summary = self.layout_planner.center_plan(video_path)
        try:
            with open(layout_path, "w", encoding="utf-8") as f:
                json.dump({"key": key, "graph": graph, "summary": summary}, f)
        except OSError:
            pass
        return graph, summary

    @staticmethod
    def _image_aspect(path: str | None) -> float | None:
        """Tinggi ÷ lebar gambar (untuk menumpuk watermark di bawah/atas logo)."""
        if not path:
            return None
        import cv2
        image = cv2.imread(path, cv2.IMREAD_UNCHANGED)
        return image.shape[0] / image.shape[1] if image is not None and image.shape[1] else None

    @staticmethod
    def load_transcript(words_path: str) -> dict | None:
        """Transkrip caption tersimpan: {"range": [awal, akhir], "segments": [...]} (detik video sumber)."""
        try:
            with open(words_path, encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data.get("segments"), list) and len(data.get("range") or []) == 2:
                return data
        except (OSError, ValueError, AttributeError):
            pass
        return None

    @staticmethod
    def save_transcript(words_path: str, start: float, end: float, segments: list):
        tmp = words_path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump({"range": [round(start, 3), round(end, 3)], "segments": segments}, f, ensure_ascii=False)
        os.replace(tmp, words_path)

    def _transcript_for(self, video_path, start_sec, end_sec, words_path, temp_audio_path) -> list:
        """
        Transkrip (dengan waktu per kata) untuk rentang klip, relatif terhadap awal klip.

        Transkrip disimpan per klip dalam detik video sumber, jadi render ulang (mis. ganti gaya
        caption atau teks yang sudah diedit di editor) tidak perlu Whisper lagi. Jika rentang klip
        diperpanjang, hanya hasil Whisper di luar rentang lama yang ditambahkan; teks hasil edit tetap.
        """
        stored = self.load_transcript(words_path)
        if stored and stored["range"][0] <= start_sec + 0.05 and stored["range"][1] >= end_sec - 0.05:
            segments = stored["segments"]
        else:
            # Whisper hanya butuh audio mono 16 kHz — jauh lebih cepat daripada memotong video
            _run_ffmpeg([
                "ffmpeg", "-y", "-ss", f"{start_sec:.3f}", "-i", video_path, "-t", f"{end_sec - start_sec:.3f}",
                "-vn", "-ac", "1", "-ar", "16000", temp_audio_path
            ], "Gagal mengekstrak audio")
            segments = []
            for seg in self.caption_service.transcribe(temp_audio_path):
                words = [{"start": round(start_sec + w["start"], 3), "end": round(start_sec + w["end"], 3),
                          "word": w["word"]} for w in seg.get("words") or []]
                if words:
                    segments.append({"start": words[0]["start"], "end": words[-1]["end"],
                                     "text": seg["text"].strip(), "words": words})
            lo, hi = start_sec, end_sec
            if stored and stored["range"][0] < end_sec and stored["range"][1] > start_sec:
                # Tumpang tindih dengan rentang lama: di dalamnya pakai transkrip lama (mungkin sudah diedit)
                r0, r1 = stored["range"]
                inside = lambda s: r0 <= (s["start"] + s["end"]) / 2 <= r1
                segments = sorted([s for s in segments if not inside(s)] + [s for s in stored["segments"] if inside(s)],
                                  key=lambda s: s["start"])
                lo, hi = min(r0, start_sec), max(r1, end_sec)
            self.save_transcript(words_path, lo, hi, segments)

        relative = []
        for seg in segments:
            words = [{"start": w["start"] - start_sec, "end": w["end"] - start_sec, "word": w["word"]}
                     for w in seg["words"] if w["start"] >= start_sec - 0.05 and w["end"] <= end_sec + 0.05]
            if words:
                relative.append({"start": words[0]["start"], "end": words[-1]["end"], "words": words})
        return relative

    def process_clip(self, video_path: str, segment: dict, options: dict, callback=None) -> dict:
        """
        Render satu klip dengan FFmpeg.

        options['mode']:
          - "preview" → klip pratinjau (<nama>.preview.mp4): tata letak saja, tanpa caption & efek.
                        Transkrip disimpan, lalu caption/hook/efek ditampilkan langsung di editor.
          - "final"   → klip jadi (<nama>.mp4) dengan caption, hook, efek, dan audio dari resep edit.

        Semua tahap membaca langsung rentang klip dari video sumber (tanpa file klip
        sementara), sehingga video hanya di-encode satu kali:
          1. Tata letak      → ikuti pembicara: crop/zoom ke yang bicara, split atas-bawah
                               saat dua orang bergantian bicara (lihat speaker_layout.py)
          2. Auto caption    → ekstrak audio rentang klip (WAV kecil) lalu Whisper
          3. Final render    → -ss sebelum -i (seek cepat) + filter tata letak + caption
        """
        video_id = options.get('video_id', 'unknown')
        seg_num = segment.get('segment_number', 1)

        start_sec = self._time_to_seconds(segment.get('start_time', '00:00'))
        end_sec = self._time_to_seconds(segment.get('end_time', '00:00'))
        # Nama file dari rentang momen asli: tetap sama walau nomor momen berubah setelah analisis
        # ulang, dan walau rentangnya digeser di editor (klip hasil edit menimpa klip momen itu)
        base_name = f"{video_id}_{int(start_sec)}-{int(end_sec)}"
        edit = options.get('edit')
        if edit:
            start_sec, end_sec = edit['start'], edit['end']
        duration = end_sec - start_sec
        if duration <= 0:
            raise Exception(f"Rentang waktu tidak valid: {segment.get('start_time')} – {segment.get('end_time')}")
        # Folder output per pengguna diisi oleh app.py; default untuk pemakaian langsung
        output_dir = options.get('output_dir') or os.path.join(CLIPS_DIR, video_id)
        os.makedirs(output_dir, exist_ok=True)
        preview = options.get('mode') == 'preview'
        final_output_path = os.path.join(output_dir, f"{base_name}.preview.mp4" if preview else f"{base_name}.mp4")
        # Render ke file sementara lalu rename, agar file final tidak pernah setengah jadi
        temp_output_path = os.path.join(output_dir, f"{base_name}.{'preview.' if preview else ''}rendering.mp4")
        temp_audio_path = os.path.join(output_dir, f"{base_name}.audio.wav")
        graph_path = os.path.join(output_dir, f"{base_name}.filter.txt")
        words_path = os.path.join(output_dir, f"{base_name}.words.json")
        shade_path = os.path.join(output_dir, f"{base_name}.shade.png")
        layout_path = os.path.join(output_dir, f"{base_name}.layout.json")
        assets_dir = options.get('assets_dir') or ''

        # Resolusi = sisi pendek video 9:16 ("1080" → 1080x1920, "2160" → 4K 2160x3840).
        # Pratinjau selalu 540x960: overlay editor relatif terhadap lebar video, encode jauh lebih cepat.
        target_w = PREVIEW_W if preview else int(options.get('resolution', '1080'))
        target_h = _even_int(target_w * 16 / 9)

        try:
            # 1+2. Tata letak 9:16 (lacak wajah) dan transkrip (Whisper) dikerjakan bersamaan: keduanya
            # berat di CPU tapi saling lepas. Transkrip selalu disiapkan saat pratinjau, untuk caption di editor.
            need_transcript = preview or options.get('caption_enabled', True)
            with ThreadPoolExecutor(max_workers=1) as pool:
                transcript_job = pool.submit(self._transcript_for, video_path, start_sec, end_sec,
                                             words_path, temp_audio_path) if need_transcript else None
                layout_graph, layout_summary = self._layout_for(
                    video_path, start_sec, end_sec, target_w, target_h, options, layout_path, callback)
                if transcript_job:
                    if callback and not transcript_job.done():
                        callback({'status': 'transcribing', 'progress': 35})
                    transcribed = transcript_job.result()

            # Caption ASS (final saja)
            ass_filter = ""
            if not preview and options.get('caption_enabled', True):
                ass_name = f"{base_name}.ass"
                self.caption_service.generate_ass(transcribed, os.path.join(output_dir, ass_name),
                                                  options.get('caption_style', {}))
                # FFmpeg dijalankan dengan cwd=output_dir, jadi cukup nama file (aman dari
                # masalah escape path Windows "C:\..." di dalam filter). Font caption dibundel
                # di backend/fonts dan dirujuk dengan path relatif karena alasan yang sama.
                ass_filter = f"ass={ass_name}:fontsdir={_fonts_dir_for(output_dir)}"

            # 3. Final Render (FFmpeg) — satu kali encode langsung dari video sumber
            if callback: callback({'status': 'rendering', 'progress': 60})

            # Efek dari editor: vignette → caption → hook → watermark teks (ASS) → logo (overlay);
            # audio dicampur terpisah. Pratinjau tanpa efek apa pun.
            edit = {} if preview else (edit or {})
            marks = edit.get('marks') or {}
            extra_inputs = []  # input FFmpeg tambahan (index 1, 2, …)
            graph, label = layout_graph, "vlayout"
            if not preview:
                # Sumber 1080p di-crop 9:16 hanya ±600 px lebar; saat di-upscale, sedikit penajaman
                # (sebelum caption, agar teks tidak ikut ditajamkan) membuat hasil tidak lembek
                src_h = _probe(video_path)[1]
                if target_w > src_h * 9 / 16 * 1.3:
                    graph += f";[{label}]unsharp=5:5:0.6:5:5:0[vsharp]"
                    label = "vsharp"

            vignette = edit.get('vignette') or {"shape": "radial", "strength": 0}
            if clip_effects.write_shade_png(vignette, target_w, target_h, shade_path):
                extra_inputs.append(["-i", shade_path])
                graph += f";[{label}][{len(extra_inputs)}:v]overlay=format=auto[vshade]"
                label = "vshade"

            logo_path = self._asset_path(assets_dir, (marks.get('logo') or {}).get('asset'))
            layout = clip_effects.marks_layout(marks, self._image_aspect(logo_path))
            steps = [f for f in (clip_effects.vignette_filter(vignette), ass_filter) if f]
            hook = edit.get('hook') or {}
            hook_text = clip_effects.hook_ass(hook, duration, FONTS.get(hook.get('font'), FONTS["montserrat"])) if hook else None
            if hook_text:
                hook_name = f"{base_name}.hook.ass"
                with open(os.path.join(output_dir, hook_name), "w", encoding="utf-8") as f:
                    f.write(hook_text)
                steps.append(f"ass={hook_name}:fontsdir={_fonts_dir_for(output_dir)}")
            marks_text = clip_effects.marks_ass(marks, layout, duration, FONTS["poppins-semibold"])
            if marks_text:
                mark_name = f"{base_name}.mark.ass"
                with open(os.path.join(output_dir, mark_name), "w", encoding="utf-8") as f:
                    f.write(marks_text)
                steps.append(f"ass={mark_name}:fontsdir={_fonts_dir_for(output_dir)}")
            graph += f";[{label}]{','.join(steps) or 'null'}[vfx]"

            logo_item = next((item for item in layout if item["kind"] == "logo"), None)
            if logo_item:
                extra_inputs.append(["-i", logo_path])
                graph += ";" + clip_effects.logo_graph(marks["logo"], logo_item, len(extra_inputs),
                                                       target_w, target_h, "vfx", "vout")
            else:
                graph += ";[vfx]null[vout]"

            music = edit.get('music') or {}
            music_path = self._asset_path(assets_dir, music.get('asset'))
            music_index = None
            if music_path and music.get('volume', 0) > 0:
                extra_inputs.append(["-stream_loop", "-1", "-i", music_path])  # diulang jika lebih pendek dari klip
                music_index = len(extra_inputs)
            sfx_inputs = []
            for item in edit.get('sfx') or []:
                path, offset = self._asset_path(assets_dir, item['asset']), item['at'] - start_sec
                if path and 0 <= offset < duration and item['volume'] > 0:
                    extra_inputs.append(["-i", path])
                    sfx_inputs.append((len(extra_inputs), offset, item['volume']))
            audio = clip_effects.audio_graph(music, music_index, sfx_inputs, duration, _has_audio(video_path), "aout")
            audio_map = ["-map", "0:a:0?"]
            if audio:
                graph += ";" + audio
                audio_map = ["-map", "[aout]"]

            with open(graph_path, "w", encoding="utf-8") as f:
                f.write(graph)

            _run_ffmpeg([
                "ffmpeg", "-y",
                # -ss sebelum -i: seek langsung ke posisi (tidak men-decode dari awal video).
                # Karena di-encode ulang, hasil potongan tetap akurat per frame.
                "-ss", f"{start_sec:.3f}", "-i", video_path, "-t", f"{duration:.3f}",
                *[arg for item in extra_inputs for arg in item],
                "-/filter_complex", os.path.basename(graph_path),
                "-map", "[vout]", *audio_map,
                "-t", f"{duration:.3f}",
                *_video_args(preview, target_w),
                "-c:a", "aac", "-b:a", "128k" if preview else "192k", "-ar", "48000",
                "-movflags", "+faststart",  # metadata di depan → preview bisa langsung diputar
                temp_output_path
            ], "Gagal render klip final", cwd=output_dir)

            os.replace(temp_output_path, final_output_path)
        finally:
            _remove_quietly(temp_audio_path)
            _remove_quietly(temp_output_path)
            _remove_quietly(graph_path)
            _remove_quietly(shade_path)

        if callback: callback({'status': 'done', 'progress': 100, 'output': final_output_path})

        return {
            'segment_number': seg_num,
            'range': [round(start_sec, 2), round(end_sec, 2)],
            'status': 'success',
            'output_path': final_output_path,
            'mode': 'preview' if preview else 'final',
            'layout': layout_summary,
        }
