import os
import glob
import threading
import yt_dlp
import uuid

from youtube_utils import YTDLP_JS_RUNTIMES

# Base directory for downloads
DOWNLOADS_DIR = os.path.join(os.path.dirname(__file__), "downloads")
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

# Satu lock per video agar dua request untuk video yang sama tidak men-download bersamaan
_download_locks: dict[str, threading.Lock] = {}
_download_locks_guard = threading.Lock()


def _get_lock(video_id: str) -> threading.Lock:
    with _download_locks_guard:
        return _download_locks.setdefault(video_id, threading.Lock())


def find_cached_video(video_id: str) -> str | None:
    """Cari video YouTube yang sudah pernah di-download (termasuk format nama lama <uuid>_<id>.mp4)."""
    candidates = [os.path.join(DOWNLOADS_DIR, f"yt_{video_id}.mp4")]
    candidates += sorted(glob.glob(os.path.join(DOWNLOADS_DIR, f"*_{glob.escape(video_id)}.mp4")))
    for path in candidates:
        if os.path.isfile(path) and os.path.getsize(path) > 0:
            return path
    return None

class DownloadProgressHook:
    def __init__(self, callback=None):
        self.callback = callback

    def __call__(self, d):
        if d['status'] == 'downloading':
            # Hitung persentase
            percent_str = d.get('_percent_str', '0%').replace('%', '').strip()
            # Bersihkan escape characters warna dari yt-dlp
            import re
            percent_str = re.sub(r'\x1b\[[0-9;]*m', '', percent_str)
            try:
                percent = float(percent_str)
            except ValueError:
                percent = 0.0

            if self.callback:
                self.callback({
                    'status': 'downloading',
                    'progress': percent,
                    'speed': d.get('_speed_str', 'N/A'),
                    'eta': d.get('_eta_str', 'N/A')
                })
        elif d['status'] == 'finished':
            if self.callback:
                self.callback({
                    'status': 'finished',
                    'progress': 100.0
                })

def download_video(youtube_url: str, callback=None, video_id: str = None) -> str:
    """
    Download video YouTube dalam kualitas HD (max 1080p).
    Jika video_id diberikan dan video sudah pernah di-download, file lama dipakai ulang.
    Mengembalikan path absolut ke file yang telah di-download.
    """
    if not video_id:
        return _download(youtube_url, callback, f"{str(uuid.uuid4())[:8]}_%(id)s.%(ext)s")

    with _get_lock(video_id):
        cached = find_cached_video(video_id)
        if cached:
            print(f"[Download] Memakai video yang sudah ada: {cached}")
            if callback:
                callback({'status': 'finished', 'progress': 100.0, 'message': 'Memakai video yang sudah di-download'})
            return cached
        return _download(youtube_url, callback, f"yt_{video_id}.%(ext)s")


def _download(youtube_url: str, callback, filename_template: str) -> str:
    output_template = os.path.join(DOWNLOADS_DIR, filename_template)

    ydl_opts = {
        # Utamakan H.264 (avc1): AV1/VP9 jauh lebih berat di-decode CPU saat tracking & render
        'format': ('bestvideo[height<=1080][vcodec^=avc1]+bestaudio[ext=m4a]/'
                   'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/'
                   'best[height<=1080][ext=mp4]/best'),
        'outtmpl': output_template,
        'merge_output_format': 'mp4',
        'noplaylist': True,
        'quiet': True,
        'no_warnings': True,
        'progress_hooks': [DownloadProgressHook(callback)],
        'js_runtimes': YTDLP_JS_RUNTIMES,
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info_dict = ydl.extract_info(youtube_url, download=True)
            # Dapatkan nama file yang sebenarnya dari dictionary info
            # Format filename biasanya menggunakan path yang di-prepare yt-dlp
            filepath = ydl.prepare_filename(info_dict)
            
            # Karena merge_output_format 'mp4', ekstensi mungkin berubah jadi mp4
            base, ext = os.path.splitext(filepath)
            expected_filepath = f"{base}.mp4"
            
            if os.path.exists(expected_filepath):
                return expected_filepath
            elif os.path.exists(filepath):
                return filepath
            else:
                raise Exception("File video tidak ditemukan setelah proses download selesai.")
                
        except Exception as e:
            if callback:
                callback({
                    'status': 'error',
                    'error_message': str(e)
                })
            raise e

def cleanup_downloaded_video(filepath: str):
    """Menghapus file video yang sudah didownload jika sudah tidak dipakai."""
    try:
        if os.path.exists(filepath):
            os.remove(filepath)
    except Exception as e:
        print(f"Gagal menghapus file {filepath}: {e}")
