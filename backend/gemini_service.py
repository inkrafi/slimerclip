import json
import os
import re

import yt_dlp
from dotenv import load_dotenv
from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from prompt_templates import clip_analysis_schema, get_clip_analysis_prompt, target_segment_count
from scoring import score_segments
from transcript_service import TranscriptUnavailable, get_transcript_lines
from youtube_utils import YTDLP_JS_RUNTIMES, extract_video_id, is_youtube_url

load_dotenv()

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
GEMINI_TIMEOUT_MS = int(os.getenv("GEMINI_TIMEOUT_SECONDS", "180")) * 1000

_client = None


def _get_client(api_key: str | None = None) -> genai.Client:
    """
    Client Gemini. Tanpa api_key: client milik server (dibuat saat pertama dipakai, agar backend
    tetap bisa start tanpa GEMINI_API_KEY). Dengan api_key: client sekali pakai untuk key pengguna.
    """
    global _client
    if api_key:
        return genai.Client(api_key=api_key, http_options=types.HttpOptions(timeout=GEMINI_TIMEOUT_MS))
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY belum diisi")
        _client = genai.Client(api_key=api_key, http_options=types.HttpOptions(timeout=GEMINI_TIMEOUT_MS))
    return _client


def _extract_info(youtube_url: str) -> dict | None:
    """Info mentah yt-dlp (tanpa download video); dipakai untuk metadata dan daftar subtitle."""
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
            return ydl.extract_info(youtube_url, download=False) or {}
    except Exception as e:
        print(f"[Metadata] Gagal mengambil metadata: {e}")
    return None


def get_video_metadata(info: dict | None) -> dict:
    """Metadata ringkas dari info yt-dlp."""
    if not info:
        return {}
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


def _format_transcript(lines: list) -> str:
    """Format transkrip menjadi baris '[MM:SS - MM:SS] teks' (menit bisa > 59 untuk video panjang)."""
    out = []
    for start_sec, end_sec, text in lines:
        start, end = int(start_sec), int(end_sec)
        out.append(f"[{start // 60:02d}:{start % 60:02d} - {end // 60:02d}:{end % 60:02d}] {text}")
    return "\n".join(out)


def validate_api_key(api_key: str) -> str | None:
    """Cek API key Gemini pengguna dengan request ringan. Return pesan error, atau None jika valid."""
    try:
        _get_client(api_key).models.get(model=GEMINI_MODEL)
        return None
    except genai_errors.APIError as e:
        if e.code in (400, 401, 403):
            return "API key ditolak Google. Pastikan key disalin utuh dari Google AI Studio."
        if e.code == 429:
            return None  # key valid, hanya sedang kena limit
        return _gemini_error_message(e)
    except Exception as e:
        return f"API key tidak bisa dicek: {e}"


def _looser_schema(schema: dict) -> dict | None:
    """minItems > 5 → 5; sudah 5 atau kurang → tanpa skema."""
    segments = schema["properties"]["segments"]
    if segments.get("minItems", 0) > 5:
        print(f"[Gemini] Skema ditolak model {GEMINI_MODEL}, mencoba dengan minimal 5 momen")
        return {**schema, "properties": {**schema["properties"], "segments": {**segments, "minItems": 5}}}
    print(f"[Gemini] Skema ditolak model {GEMINI_MODEL}, mencoba tanpa skema")
    return None


def _call_gemini(system_prompt: str, user_text: str, max_attempts: int = 3, api_key: str | None = None,
                 schema: dict | None = None) -> dict:
    """Panggil Gemini (mode output JSON, opsional dengan skema) dan parse hasilnya. Retry jika JSON tidak valid."""
    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        response_mime_type="application/json",
        response_json_schema=schema,
    )
    last_error = None
    for attempt in range(1, max_attempts + 1):
        try:
            response = _get_client(api_key).models.generate_content(model=GEMINI_MODEL, contents=user_text, config=config)
        except genai_errors.ClientError as e:
            # Skema terlalu rumit untuk model ini (400 INVALID_ARGUMENT tanpa keterangan) → longgarkan
            # minItems, lalu tanpa skema sama sekali. Error API key tetap diteruskan.
            if schema is not None and e.code == 400 and "api key" not in str(e).lower():
                return _call_gemini(system_prompt, user_text, max_attempts, api_key, schema=_looser_schema(schema))
            raise
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


def _gemini_error_message(e: Exception, own_key: bool = False) -> str:
    """Terjemahkan error Gemini menjadi pesan yang jelas untuk user."""
    msg = str(e)
    if own_key and isinstance(e, genai_errors.APIError):
        if e.code in (400, 401, 403) and ("API_KEY" in msg or "API key" in msg or e.code != 400):
            return "API key Gemini milikmu ditolak Google. Perbarui key di halaman Pengaturan."
        if e.code in (402, 429):
            return "Kuota API key Gemini milikmu sedang habis. Tunggu beberapa saat, atau cek limitnya di Google AI Studio."
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


def analyze_youtube_video(youtube_url: str, api_key: str | None = None, media_path: str | None = None,
                          allow_download: bool = False) -> dict:
    """
    Ambil transkrip + metadata video YouTube lalu kirim ke Gemini untuk dianalisis.

    - api_key: key Gemini milik pengguna (None = key server)
    - media_path / allow_download: sumber transkripsi Whisper jika YouTube tidak memberi transkrip

    Return:
    - dict berisi hasil analisis jika berhasil
    - dict dengan key "error" jika gagal
    """
    if not is_youtube_url(youtube_url):
        return {"error": "URL tidak valid. Masukkan link YouTube yang benar."}

    video_id = extract_video_id(youtube_url)
    if not video_id:
        return {"error": "Tidak bisa menemukan ID Video dari URL tersebut."}

    # Metadata dulu: info yt-dlp yang sama dipakai untuk mencari subtitle cadangan
    info = _extract_info(youtube_url)
    metadata = get_video_metadata(info)

    # Transkrip (cache → youtube-transcript-api → subtitle yt-dlp → Whisper lokal)
    try:
        transcript_lines, transcript_source = get_transcript_lines(video_id, youtube_url, info,
                                                                 media_path=media_path, allow_download=allow_download)
    except TranscriptUnavailable as e:
        return {"error": str(e), "code": "transcript_unavailable"}
    formatted_transcript = _format_transcript(transcript_lines)
    if not formatted_transcript:
        return {"error": "Transkrip video kosong, tidak ada percakapan yang bisa dianalisis."}

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
        count = target_segment_count(metadata.get("duration") or (transcript_lines[-1][1] if transcript_lines else 0))
        result_data = _call_gemini(get_clip_analysis_prompt(count), user_text, api_key=api_key,
                                   schema=clip_analysis_schema(count))
    except json.JSONDecodeError:
        return {"error": "AI tidak mengembalikan format JSON yang valid setelah 3 percobaan. Coba video lain atau coba lagi."}
    except Exception as e:
        print(f"[Gemini] Error: {e!r}")
        return {"error": _gemini_error_message(e, own_key=bool(api_key))}

    if not isinstance(result_data, dict) or not isinstance(result_data.get("segments"), list):
        return {"error": "Format hasil analisis AI tidak sesuai (tidak ada daftar segments). Coba lagi."}

    # Skor akhir: gabungan penilaian AI, data "Most replayed" YouTube, dan struktur momen
    video_duration = metadata.get("duration") or (transcript_lines[-1][1] if transcript_lines else 0)
    from_ai = len(result_data["segments"])
    result_data["segments"] = score_segments(
        result_data["segments"], transcript_lines, metadata.get("heatmap") or [], video_duration
    )
    print(f"[Analisis] {video_id}: diminta {count} momen, Gemini memberi {from_ai}, "
          f"tersisa {len(result_data['segments'])} setelah dirapikan")
    result_data["total_clip_recommendations"] = len(result_data["segments"])
    if not result_data["segments"]:
        return {"error": "AI tidak menemukan momen dengan timestamp yang valid. Coba analisis ulang."}
    result_data["scoring_version"] = 2
    result_data["transcript_source"] = transcript_source

    if metadata:
        result_data["video_metadata"] = metadata
    return result_data
