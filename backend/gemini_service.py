import json
import os
import re

import yt_dlp
from dotenv import load_dotenv
from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from requests import Session
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound

from prompt_templates import get_clip_analysis_prompt
from scoring import score_segments
from youtube_utils import YTDLP_JS_RUNTIMES, extract_video_id, is_youtube_url

load_dotenv()

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_TIMEOUT_MS = int(os.getenv("GEMINI_TIMEOUT_SECONDS", "180")) * 1000

_client = None


def _get_client() -> genai.Client:
    """Buat client Gemini saat pertama dipakai (agar backend tetap bisa start tanpa API key)."""
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY belum diisi")
        _client = genai.Client(api_key=api_key, http_options=types.HttpOptions(timeout=GEMINI_TIMEOUT_MS))
    return _client


def get_video_metadata(youtube_url: str) -> dict:
    """Mengambil metadata video YouTube menggunakan yt-dlp (tanpa download video)."""
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'noplaylist': True,
        'skip_download': True,
        'socket_timeout': 15,
        'js_runtimes': YTDLP_JS_RUNTIMES,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=False) or {}
        return {
            "title": info.get("title") or "",
            "channel": info.get("uploader") or "",
            "duration": info.get("duration") or 0,
            "view_count": info.get("view_count") or 0,
            "description": (info.get("description") or "")[:1000],  # Ambil max 1000 karakter
            "tags": info.get("tags") or [],
            "thumbnail": info.get("thumbnail") or "",
            # Grafik "Most replayed" YouTube: intensitas tonton-ulang per potongan waktu (0–1)
            "heatmap": [
                {"start_time": round(p["start_time"], 2), "end_time": round(p["end_time"], 2), "value": round(p["value"], 4)}
                for p in (info.get("heatmap") or [])
                if p.get("start_time") is not None and p.get("end_time") is not None and p.get("value") is not None
            ],
        }
    except Exception as e:
        print(f"[Metadata] Gagal mengambil metadata: {e}")
    return {}


def _fetch_transcript(video_id: str):
    """Ambil transkrip: utamakan Indonesia/Inggris, lalu terjemahan, lalu transkrip apa pun."""
    session = Session()
    # Verifikasi SSL tetap aktif. Hanya jika muncul SSLError (mis. antivirus/proxy yang
    # mengintersep HTTPS), bisa dimatikan sementara dengan TRANSCRIPT_INSECURE_SSL=1 di .env.
    if os.getenv("TRANSCRIPT_INSECURE_SSL", "0") == "1":
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        session.verify = False
        print("[Transcript] PERINGATAN: verifikasi SSL dimatikan (TRANSCRIPT_INSECURE_SSL=1)")

    transcript_list = YouTubeTranscriptApi(http_client=session).list(video_id)

    try:
        return transcript_list.find_transcript(['id', 'en']).fetch()
    except NoTranscriptFound:
        pass

    for t in transcript_list:
        if t.is_translatable:
            for lang in ('id', 'en'):
                try:
                    return t.translate(lang).fetch()
                except Exception:
                    continue

    for t in transcript_list:
        return t.fetch()

    raise NoTranscriptFound(video_id, ['id', 'en'], transcript_list)


def _transcript_lines(raw_transcript) -> list:
    """Transkrip mentah → [(start_detik, end_detik, teks), ...] urut waktu."""
    lines = []
    for item in raw_transcript:
        start_sec = getattr(item, 'start', None)
        text = getattr(item, 'text', None)
        if start_sec is None or not text:
            continue
        lines.append((float(start_sec), float(start_sec + (getattr(item, 'duration', 0) or 0)), text.replace("\n", " ")))
    lines.sort(key=lambda l: l[0])
    return lines


def _format_transcript(lines: list) -> str:
    """Format transkrip menjadi baris '[MM:SS - MM:SS] teks' (menit bisa > 59 untuk video panjang)."""
    out = []
    for start_sec, end_sec, text in lines:
        start, end = int(start_sec), int(end_sec)
        out.append(f"[{start // 60:02d}:{start % 60:02d} - {end // 60:02d}:{end % 60:02d}] {text}")
    return "\n".join(out)


def _call_gemini(system_prompt: str, user_text: str, max_attempts: int = 3) -> dict:
    """Panggil Gemini (mode output JSON) dan parse hasilnya. Retry jika JSON tidak valid."""
    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        response_mime_type="application/json",
    )
    last_error = None
    for attempt in range(1, max_attempts + 1):
        response = _get_client().models.generate_content(model=GEMINI_MODEL, contents=user_text, config=config)
        raw_text = (response.text or "").strip()

        # Jaga-jaga jika model tetap membungkus dengan ```json ... ``` atau menambah teks lain
        raw_text = re.sub(r"^```[a-z]*\n?|\n?```$", "", raw_text).strip()
        json_match = re.search(r"\{[\s\S]*\}", raw_text)
        if json_match:
            raw_text = json_match.group(0)

        try:
            return json.loads(raw_text)
        except json.JSONDecodeError as e:
            last_error = e
            print(f"[Gemini] Attempt {attempt}: JSON parse error ({e}). Retrying...")
    raise last_error


def _gemini_error_message(e: Exception) -> str:
    """Terjemahkan error Gemini menjadi pesan yang jelas untuk user."""
    msg = str(e)
    if isinstance(e, RuntimeError) and "GEMINI_API_KEY" in msg:
        return "GEMINI_API_KEY belum diisi. Cek file backend/.env."
    if isinstance(e, genai_errors.APIError):
        if e.code in (401, 403) or "API_KEY" in msg or "API key" in msg:
            return "API Key Gemini tidak valid. Cek GEMINI_API_KEY di file backend/.env."
        if e.code == 402:
            return "Kredit Gemini API habis. Isi ulang billing di https://ai.studio/projects lalu coba lagi."
        if e.code == 429:
            return "Kuota/limit Gemini API habis. Tunggu beberapa saat atau coba lagi besok."
        if e.code == 404:
            return f"Model Gemini '{GEMINI_MODEL}' tidak ditemukan. Cek GEMINI_MODEL di .env."
        if e.code and e.code >= 500:
            return "Server Gemini sedang sibuk/bermasalah. Coba lagi beberapa saat lagi."
    if "timeout" in msg.lower() or "timed out" in msg.lower():
        return "Gemini terlalu lama merespons (timeout). Coba lagi."
    return f"Terjadi kesalahan saat memanggil Gemini: {msg}"


def analyze_youtube_video(youtube_url: str) -> dict:
    """
    Ambil transkrip + metadata video YouTube lalu kirim ke Gemini untuk dianalisis.

    Return:
    - dict berisi hasil analisis jika berhasil
    - dict dengan key "error" jika gagal
    """
    if not is_youtube_url(youtube_url):
        return {"error": "URL tidak valid. Masukkan link YouTube yang benar."}

    video_id = extract_video_id(youtube_url)
    if not video_id:
        return {"error": "Tidak bisa menemukan ID Video dari URL tersebut."}

    # Ambil transkrip
    try:
        transcript_lines = _transcript_lines(_fetch_transcript(video_id))
        formatted_transcript = _format_transcript(transcript_lines)
        if not formatted_transcript:
            raise NoTranscriptFound(video_id, ['id', 'en'], None)
    except TranscriptsDisabled:
        return {"error": "Subtitles/Transcript dinonaktifkan untuk video ini. AI tidak bisa menganalisis tanpa teks percakapan."}
    except NoTranscriptFound:
        return {"error": "Tidak ada transkrip Bahasa Indonesia atau Inggris yang ditemukan di video ini."}
    except Exception as e:
        err_msg = str(e)
        # Pesan error XML parser 'no element found' yang umum
        if "no element found" in err_msg.lower() or "expat" in err_msg.lower():
            return {"error": "Gagal mengambil transkrip video karena format data kosong/tidak didukung dari YouTube. Pastikan video memiliki subtitle publik."}
        return {"error": f"Gagal mengambil transkrip video: {err_msg}"}

    # Ambil metadata
    metadata = get_video_metadata(youtube_url)
    metadata_text = "METADATA VIDEO TIDAK TERSEDIA"
    if metadata:
        metadata_text = f"""
METADATA VIDEO:
Judul: {metadata.get('title')}
Channel: {metadata.get('channel')}
Views: {metadata.get('view_count')}
Tags: {', '.join(metadata.get('tags', []))}
Deskripsi Singkat: {metadata.get('description')}
"""

    user_text = (
        f"Analisis video YouTube berikut ini: {youtube_url}\n\n"
        f"{metadata_text}\n\n"
        f"TRANSKRIP VIDEO:\n{formatted_transcript}"
    )

    try:
        result_data = _call_gemini(get_clip_analysis_prompt(), user_text)
    except json.JSONDecodeError:
        return {"error": "AI tidak mengembalikan format JSON yang valid setelah 3 percobaan. Coba video lain atau coba lagi."}
    except Exception as e:
        print(f"[Gemini] Error: {e!r}")
        return {"error": _gemini_error_message(e)}

    if not isinstance(result_data, dict) or not isinstance(result_data.get("segments"), list):
        return {"error": "Format hasil analisis AI tidak sesuai (tidak ada daftar segments). Coba lagi."}

    # Skor akhir: gabungan penilaian AI, data "Most replayed" YouTube, dan struktur momen
    video_duration = metadata.get("duration") or (transcript_lines[-1][1] if transcript_lines else 0)
    result_data["segments"] = score_segments(
        result_data["segments"], transcript_lines, metadata.get("heatmap") or [], video_duration
    )
    if not result_data["segments"]:
        return {"error": "AI tidak menemukan momen dengan timestamp yang valid. Coba analisis ulang."}
    result_data["scoring_version"] = 2

    if metadata:
        result_data["video_metadata"] = metadata
    return result_data
