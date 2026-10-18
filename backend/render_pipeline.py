import os
import subprocess

from caption_service import CaptionService
from speaker_layout import SpeakerLayoutPlanner

CLIPS_DIR = os.path.join(os.path.dirname(__file__), "clips")
os.makedirs(CLIPS_DIR, exist_ok=True)


def _ffmpeg_error(e: subprocess.CalledProcessError) -> str:
    """Ambil beberapa baris terakhir stderr FFmpeg (bagian awal hanya banner/info stream)."""
    lines = [l.strip() for l in e.stderr.decode('utf-8', errors='ignore').splitlines() if l.strip()]
    return " | ".join(lines[-3:])


def _run_ffmpeg(cmd: list, error_prefix: str, cwd: str = None):
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=cwd)
    except subprocess.CalledProcessError as e:
        raise Exception(f"{error_prefix}: {_ffmpeg_error(e)}")


def _remove_quietly(path: str):
    try:
        if os.path.exists(path):
            os.remove(path)
    except OSError as e:
        print(f"Gagal menghapus file sementara {path}: {e}")


class RenderPipeline:
    def __init__(self):
        self.caption_service = CaptionService()
        self.layout_planner = SpeakerLayoutPlanner()

    def _time_to_seconds(self, time_str: str) -> float:
        """Konversi MM:SS atau HH:MM:SS ke detik (menit boleh > 59, mis. '75:30')."""
        parts = time_str.strip().split(':')
        if len(parts) == 2:
            return float(parts[0]) * 60 + float(parts[1])
        elif len(parts) == 3:
            return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
        raise ValueError(f"Format waktu tidak valid: {time_str}")

    def process_clip(self, video_path: str, segment: dict, options: dict, callback=None) -> dict:
        """
        Render satu klip dengan FFmpeg.

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
        duration = end_sec - start_sec
        if duration <= 0:
            raise Exception(f"Rentang waktu tidak valid: {segment.get('start_time')} – {segment.get('end_time')}")

        # Nama file dari rentang waktu: tetap sama walau nomor momen berubah setelah analisis ulang
        base_name = f"{video_id}_{int(start_sec)}-{int(end_sec)}"
        output_dir = os.path.join(CLIPS_DIR, video_id)
        os.makedirs(output_dir, exist_ok=True)
        final_output_path = os.path.join(output_dir, f"{base_name}.mp4")
        # Render ke file sementara lalu rename, agar file final tidak pernah setengah jadi
        temp_output_path = os.path.join(output_dir, f"{base_name}.rendering.mp4")
        temp_audio_path = os.path.join(output_dir, f"{base_name}.audio.wav")
        graph_path = os.path.join(output_dir, f"{base_name}.filter.txt")

        target_h = int(options.get('resolution', '1080'))
        target_w = int(target_h * 9 / 16)
        target_w -= target_w % 2  # libx264 butuh dimensi genap (720p → 404, bukan 405)

        try:
            # 1. Tata letak 9:16 — selalu di-crop agar video tidak gepeng saat di-scale
            layout_summary = {"mode": "center"}
            if options.get('smart_tracking', True):
                if callback: callback({'status': 'tracking', 'progress': 10})
                try:
                    layout_graph, layout_summary = self.layout_planner.plan(
                        video_path, start_sec, end_sec, target_w, target_h,
                        allow_split=options.get('split_screen', True), callback=callback)
                except Exception as e:
                    print(f"Tata letak pembicara gagal: {e}, fallback ke crop tengah.")
                    layout_graph, layout_summary = self.layout_planner.center_plan(video_path, target_w, target_h)
            else:
                layout_graph, layout_summary = self.layout_planner.center_plan(video_path, target_w, target_h)

            # 2. Auto Caption
            ass_filter = ""
            if options.get('caption_enabled', True):
                if callback: callback({'status': 'transcribing', 'progress': 35})

                # Whisper hanya butuh audio mono 16 kHz — jauh lebih cepat daripada memotong video
                _run_ffmpeg([
                    "ffmpeg", "-y", "-ss", f"{start_sec:.3f}", "-i", video_path, "-t", f"{duration:.3f}",
                    "-vn", "-ac", "1", "-ar", "16000", temp_audio_path
                ], "Gagal mengekstrak audio")

                transcribed = self.caption_service.transcribe(temp_audio_path)
                ass_name = f"{base_name}.ass"
                self.caption_service.generate_ass(transcribed, os.path.join(output_dir, ass_name),
                                                  options.get('caption_style', {}))
                # FFmpeg dijalankan dengan cwd=output_dir, jadi cukup nama file (aman dari
                # masalah escape path Windows "C:\..." di dalam filter)
                ass_filter = f"ass={ass_name}"

            # 3. Final Render (FFmpeg) — satu kali encode langsung dari video sumber
            if callback: callback({'status': 'rendering', 'progress': 60})

            graph = layout_graph + (f";[vlayout]{ass_filter}[vout]" if ass_filter else ";[vlayout]null[vout]")
            with open(graph_path, "w", encoding="utf-8") as f:
                f.write(graph)

            _run_ffmpeg([
                "ffmpeg", "-y",
                # -ss sebelum -i: seek langsung ke posisi (tidak men-decode dari awal video).
                # Karena di-encode ulang, hasil potongan tetap akurat per frame.
                "-ss", f"{start_sec:.3f}", "-i", video_path, "-t", f"{duration:.3f}",
                "-/filter_complex", os.path.basename(graph_path),
                "-map", "[vout]", "-map", "0:a:0?",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                "-c:a", "aac", "-b:a", "128k",
                "-movflags", "+faststart",  # metadata di depan → preview bisa langsung diputar
                temp_output_path
            ], "Gagal render klip final", cwd=output_dir)

            os.replace(temp_output_path, final_output_path)
        finally:
            _remove_quietly(temp_audio_path)
            _remove_quietly(temp_output_path)
            _remove_quietly(graph_path)

        if callback: callback({'status': 'done', 'progress': 100, 'output': final_output_path})

        return {
            'segment_number': seg_num,
            'status': 'success',
            'output_path': final_output_path,
            'layout': layout_summary,
        }
