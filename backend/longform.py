"""
Video panjang tanpa wajah (16:9) dari satu podcast.

1. Naskah: Gemini menulis narasi per adegan dari transkrip (dibagi per bab), disisipi kutipan asli podcast.
2. Suara: Gemini TTS per adegan, atau rekaman suara sendiri per adegan.
3. Visual: video stok Pixabay/Pexels per adegan (kata kunci dari naskah); adegan kutipan memakai potongan podcast.
4. Render: tiap adegan dirender 1920x1080 dengan subtitle & judul bab, lalu disambung jadi satu video,
   lengkap dengan daftar bab (timestamp) dan kredit untuk deskripsi YouTube.

Proyek disimpan per pengguna per video di <folder klip>/longform/project.json.
"""

import base64
import hashlib
import json
import os
import re
import subprocess
import threading
import time
import uuid
import wave

import requests

from caption_styles import FONTS
from render_pipeline import _fonts_dir_for, _remove_quietly, _run_ffmpeg

W, H, FPS = 1920, 1080, 30
TTS_MODEL = os.getenv("GEMINI_TTS_MODEL", "gemini-3.8-flash-tts")
# Video stok: Pixabay (utama) atau Pexels, mana yang key-nya diisi
PIXABAY_API_KEY = os.getenv("PIXABAY_API_KEY", "").strip()
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY", "").strip()
STOCK_NAMES = {"pixabay": "Pixabay", "pexels": "Pexels"}
STOCK_HOSTS = {"pixabay": "pixabay.com", "pexels": "pexels.com"}
STOCK_CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache", "stock")

DURATIONS = (5, 8, 12)          # pilihan durasi video (menit)
WORDS_PER_MINUTE = 115          # tempo Gemini TTS bahasa Indonesia (terukur ±105-115 kata/menit)
WORDS_PER_SCENE = 24            # rata-rata kata per adegan narasi hasil Gemini
# Struktur naskah per durasi: (jumlah bab, adegan narasi per bab, jumlah kutipan). Gemini mengabaikan target
# jumlah kata, tapi patuh pada jumlah adegan yang konkret.
SCRIPT_SHAPE = {5: (4, 5, 3), 8: (5, 7, 4), 12: (6, 8, 5)}
MAX_SCENES = 80
TEXT_MAX = 600
QUOTE_MIN, QUOTE_MAX = 4.0, 25.0
SCENE_ID_RE = re.compile(r"^s[0-9a-z]{1,12}$")
MEDIA_FILE_RE = re.compile(r"^[a-z0-9_.-]{1,80}\.(wav|mp4|jpg)$")

# Suara bawaan Gemini TTS (nama → karakter)
VOICES = {
    "Charon": "Informatif", "Sadaltager": "Berwawasan", "Rasalgethi": "Informatif", "Iapetus": "Jernih",
    "Erinome": "Jernih", "Kore": "Tegas", "Orus": "Tegas", "Alnilam": "Tegas", "Schedar": "Stabil",
    "Gacrux": "Dewasa", "Algenib": "Serak", "Sulafat": "Hangat", "Achird": "Ramah", "Zubenelgenubi": "Santai",
    "Umbriel": "Santai", "Callirrhoe": "Santai", "Algieba": "Halus", "Despina": "Halus", "Vindemiatrix": "Lembut",
    "Achernar": "Lembut", "Enceladus": "Berbisik", "Puck": "Ceria", "Laomedeia": "Ceria", "Sadachbia": "Hidup",
    "Fenrir": "Bersemangat", "Zephyr": "Cerah", "Autonoe": "Cerah", "Aoede": "Ringan", "Leda": "Muda",
    "Pulcherrima": "Lugas",
}
DEFAULT_VOICE = "Charon"
DEFAULT_STYLE = "narator video edukasi yang tenang, jelas, dan meyakinkan"

_project_lock = threading.Lock()
# Baca-ubah-simpan proyek oleh request yang berjalan bersamaan (mis. suara beberapa adegan sekaligus)
edit_lock = threading.Lock()


# ── Proyek ───────────────────────────────────────────────────

def project_dir(clips_dir: str) -> str:
    return os.path.join(clips_dir, "longform")


def load_project(folder: str) -> dict | None:
    try:
        with open(os.path.join(folder, "project.json"), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def save_project(folder: str, project: dict):
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, "project.json")
    with _project_lock:
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(project, f, ensure_ascii=False, indent=2)
        os.replace(tmp, path)


def new_scene_id() -> str:
    return "s" + uuid.uuid4().hex[:8]


def _clean(value, limit: int) -> str:
    text = re.sub(r"[\x00-\x08\x0b-\x1f{}\\]", " ", str(value or ""))
    return re.sub(r"[ \t]+", " ", text).strip()[:limit]


def _num(value, lo: float, hi: float) -> float | None:
    try:
        v = float(value)
    except (TypeError, ValueError):
        return None
    return v if lo <= v <= hi else None


def _host_url(value, host: str) -> str:
    url = str(value or "")
    return url if re.match(rf"^https://([a-z0-9-]+\.)*{re.escape(host)}/", url) and len(url) < 1000 else ""


def sanitize_visual(raw) -> dict | None:
    """Visual pilihan pengguna (dari hasil pencarian video stok); None = belum dipilih."""
    if not isinstance(raw, dict) or raw.get("provider") not in STOCK_HOSTS:
        return None
    host = STOCK_HOSTS[raw["provider"]]
    try:
        stock_id = int(raw.get("id"))
    except (TypeError, ValueError):
        return None
    link = _host_url(raw.get("link"), host)
    if not link or stock_id <= 0:
        return None
    return {
        "provider": raw["provider"],
        "id": stock_id,
        "link": link,
        "thumb": _host_url(raw.get("thumb"), host),
        "page": _host_url(raw.get("page"), host),
        "credit": _clean(raw.get("credit"), 80),
        "credit_url": _host_url(raw.get("credit_url"), host),
        "duration": _num(raw.get("duration"), 0, 3600) or 0,
    }


def sanitize_scenes(raw, previous: dict | None, source_duration: float | None) -> list:
    """
    Adegan dari editor. Audio milik server (hasil TTS/rekaman) dipertahankan per id adegan;
    adegan baru tanpa id valid diberi id baru. source_duration None = tanpa video sumber (kutipan dibuang).
    """
    old = {s["id"]: s for s in (previous or {}).get("scenes", [])}
    scenes, seen = [], set()
    for item in (raw if isinstance(raw, list) else [])[:MAX_SCENES]:
        if not isinstance(item, dict):
            continue
        sid = item.get("id") if isinstance(item.get("id"), str) and SCENE_ID_RE.match(item["id"]) else None
        if not sid or sid in seen:
            sid = new_scene_id()
        seen.add(sid)
        kind = "quote" if item.get("kind") == "quote" else "narration"
        scene = {"id": sid, "kind": kind, "chapter": _clean(item.get("chapter"), 70)}
        if kind == "quote" and source_duration is None:
            continue
        if kind == "quote":
            start = _num(item.get("start"), 0, source_duration or 10 ** 6)
            end = _num(item.get("end"), 0, source_duration or 10 ** 6)
            if start is None or end is None or not QUOTE_MIN <= end - start <= QUOTE_MAX + 0.01:
                continue
            scene.update({"start": round(start, 2), "end": round(end, 2), "text": _clean(item.get("text"), TEXT_MAX)})
        else:
            text = _clean(item.get("text"), TEXT_MAX)
            if not text:
                continue
            scene.update({"text": text, "query": _clean(item.get("query"), 60), "visual": sanitize_visual(item.get("visual"))})
            if old.get(sid, {}).get("audio"):
                scene["audio"] = old[sid]["audio"]
        scenes.append(scene)
    return scenes


def sanitize_voice(raw) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    return {
        "voice": raw.get("voice") if raw.get("voice") in VOICES else DEFAULT_VOICE,
        "style": _clean(raw.get("style"), 160) or DEFAULT_STYLE,
    }


def tts_hash(text: str, voice: dict) -> str:
    return hashlib.sha1(f"{text}\n{voice['voice']}\n{voice['style']}".encode()).hexdigest()[:16]


def audio_state(scene: dict, voice: dict) -> str:
    """"missing" | "stale" (teks/suara berubah setelah TTS dibuat) | "ready"."""
    audio = scene.get("audio")
    if not audio:
        return "missing"
    if audio.get("source") == "tts" and audio.get("hash") != tts_hash(scene["text"], voice):
        return "stale"
    return "ready"


def chapters(scenes: list, durations: list) -> list:
    """[(detik_mulai, judul)]; bab pertama selalu di 0:00 (syarat bab YouTube)."""
    out, t = [], 0.0
    for scene, dur in zip(scenes, durations):
        if scene.get("chapter") and (not out or out[-1][1] != scene["chapter"]):
            out.append((round(t, 2), scene["chapter"]))
        t += dur
    if not out or out[0][0] > 0:
        out.insert(0, (0.0, "Pembuka"))
    return out


def clock(seconds: float) -> str:
    s = int(seconds)
    return f"{s // 3600}:{s % 3600 // 60:02d}:{s % 60:02d}" if s >= 3600 else f"{s // 60}:{s % 60:02d}"


def description(project: dict, chapter_list: list, channel: str, youtube_url: str) -> str:
    """Deskripsi YouTube: ringkasan, daftar bab, sumber podcast, dan kredit kreator video stok."""
    credits: dict[str, list] = {}
    for scene in project["scenes"]:
        visual = scene.get("visual") or {}
        names = credits.setdefault(visual.get("provider", ""), [])
        if visual.get("credit") and visual["credit"] not in names:
            names.append(visual["credit"])
    parts = [project.get("summary") or ""]
    if len(chapter_list) >= 3:
        parts.append("\n".join(f"{clock(t)} {title}" for t, title in chapter_list))
    if project.get("sources"):
        parts.append("Sumber:\n" + "\n".join(f"- {src['title']} ({src['source']}): {src['url']}"
                                              if src.get("source") else f"- {src['title']}: {src['url']}"
                                              for src in project["sources"]))
    if channel or youtube_url:
        parts.append(f"Sumber podcast: {channel}{' - ' if channel and youtube_url else ''}{youtube_url}")
    for provider, names in credits.items():
        if names and provider in STOCK_NAMES:
            parts.append(f"Video stok dari {STOCK_NAMES[provider]}: " + ", ".join(names[:30]))
    return "\n\n".join(p for p in parts if p)


# ── Naskah (Gemini) ──────────────────────────────────────────

# Gaya bicara, pembuka & penutup khas YouTuber faceless. {GREETING}/{SIGNOFF} diisi dari nama channel.
VOICE_RULES = """
GAYA BICARA (harus terdengar seperti YouTuber sungguhan yang ngobrol, bukan teks AI)
- Bicara ke satu orang dengan "kamu". Bahasa lisan santai tapi sopan; boleh "nggak", "gimana", "nah", "jujur aja",
  secukupnya. Variasikan panjang kalimat, selipkan pertanyaan retoris dan reaksi kecil ("Masuk akal, kan?").
- Transisi antarbab yang alami, mis. "Nah, di sinilah masalahnya.", "Tapi tunggu dulu.", "Pertanyaannya sekarang...".
- DILARANG frasa klise AI: "mari kita selami", "mari kita bahas", "di era digital ini", "di dunia yang terus berkembang",
  "pada video kali ini kita akan membahas", "tak hanya itu", "perlu diingat bahwa", "kesimpulannya", "menariknya",
  "sangat penting untuk", "mengungkap rahasia", "pernahkah kamu bertanya-tanya", "tidak dapat dipungkiri".
- Jangan berlebihan atau clickbait palsu; jangan menjanjikan sesuatu yang tidak dibahas.

PEMBUKA (2 adegan pertama, chapter "")
- Adegan 1 = cold open: langsung ke fakta, kejadian, atau pertanyaan paling bikin penasaran dari isi video, 1-2 kalimat. Tanpa salam.
- Adegan 2 = {GREETING} Lalu satu kalimat janji isi video (hal spesifik yang penonton dapat sampai akhir) dan
  satu ajakan halus subscribe untuk penonton baru, tidak memaksa.

PENUTUP (2 adegan terakhir)
- Adegan kedua dari akhir = rangkuman 2-3 poin inti dengan bahasa sehari-hari + pendapat singkat. Boleh chapter "Kesimpulan".
- Adegan terakhir = satu pertanyaan spesifik untuk kolom komentar, ajakan like/subscribe dengan alasan konkret
  (bukan "jangan lupa like, comment, and subscribe"), lalu salam penutup: {SIGNOFF}

THUMBNAIL
- thumbnail_texts: 3 pilihan teks thumbnail yang BERBEDA gaya (pertanyaan, pernyataan tegas, angka/kontras),
  masing-masing 2-5 kata (maks 28 huruf), bahasa sehari-hari, memancing klik tanpa mengulang judul.
  Tandai SATU kata terpenting dengan bintang, mis. "Gaji Naik, Tetap *Bokek*?". Tanpa emoji, tanpa "RAHASIA"/"SHOCKING".
"""


def voice_rules(channel: str) -> str:
    if channel:
        greeting = (f'sapaan channel singkat yang menyebut nama channel "{channel}" persis, mis. "Halo, selamat datang '
                    f'di {channel}." (variasikan, jangan kaku).')
        signoff = f'mis. "Sampai ketemu di video berikutnya di {channel}." (variasikan, sebut nama channel).'
    else:
        greeting = 'sapaan singkat tanpa nama channel, mis. "Halo, apa kabar semuanya."'
        signoff = 'mis. "Sampai ketemu di video berikutnya."'
    return VOICE_RULES.replace("{GREETING}", greeting).replace("{SIGNOFF}", signoff)


SCRIPT_PROMPT = """
Kamu penulis naskah video YouTube edukasi "faceless" (tanpa wajah, narasi + visual stok) untuk audiens Indonesia.
Dari transkrip podcast berikut, tulis naskah video panjang ±{MINUTES} menit yang berdiri sendiri: penonton yang
belum menonton podcastnya langsung paham dan merasa dapat ilmu.

PANJANG (WAJIB DIPATUHI, ini video panjang, bukan ringkasan singkat):
- TEPAT {CHAPTERS} bab, masing-masing {PER_CHAPTER} adegan narasi, ditambah 2 adegan pembuka dan 2 adegan penutup.
- Total {NARRATION} adegan narasi (±{WORDS} kata) + {QUOTES} adegan kutipan. Gali isi transkrip lebih dalam
  (contoh, cerita, alasan, dampaknya) agar setiap bab terisi penuh, tanpa mengulang kalimat.

STRUKTUR
- Isi "chapter" HANYA pada adegan pertama tiap bab (judul bab maks 40 karakter); adegan lain chapter "".
  Adegan pembuka tanpa bab; bab pertama dimulai setelahnya.
{VOICE_RULES}
ADEGAN NARASI (kind "narration")
- text: 2-3 kalimat lisan sehari-hari, 25-40 kata, enak dibacakan (angka ditulis seperti diucapkan bila perlu).
- query: 2-4 kata kunci BAHASA INGGRIS untuk mencari video stok yang cocok secara visual
  (mis. "stock market screen", "young man thinking night", "indonesian city traffic"). Hindari nama orang/merek.
- Narasi menjelaskan & merangkum pemikiran narasumber dengan kata-katamu sendiri, sebut nama narasumber
  bila relevan. DILARANG mengarang fakta, angka, atau klaim yang tidak ada di transkrip.

ADEGAN KUTIPAN (kind "quote")
- {QUOTES} kutipan asli podcast yang paling kuat (dari bagian video yang berbeda-beda), sebagai bukti/penegas narasi sebelumnya.
- start_time & end_time diambil PERSIS dari timestamp transkrip (MM:SS), durasi 6-20 detik.
- text: isi kutipan sesuai transkrip. query "".

Juga tulis:
- title: judul video YouTube maks 70 karakter, gaya cerita/rasa penasaran, tanpa emoji.
- summary: 2 kalimat deskripsi video tanpa hashtag.

Kembalikan HANYA JSON:
{"title": "...", "summary": "...", "thumbnail_texts": ["...", "...", "..."], "scenes": [{"kind": "narration", "chapter": "", "text": "...", "query": "...", "start_time": "", "end_time": ""}]}
"""


def script_schema() -> dict:
    text = {"type": "string"}
    scene = {
        "type": "object",
        "properties": {"kind": text, "chapter": text, "text": text, "query": text, "start_time": text, "end_time": text},
        "required": ["kind", "chapter", "text", "query", "start_time", "end_time"],
    }
    return {
        "type": "object",
        "properties": {"title": text, "summary": text, "thumbnail_texts": {"type": "array", "items": text},
                       "scenes": {"type": "array", "items": scene, "minItems": 8}},
        "required": ["title", "summary", "thumbnail_texts", "scenes"],
    }


def _to_seconds(value) -> float | None:
    parts = str(value or "").strip().split(":")
    try:
        nums = [float(p) for p in parts]
    except ValueError:
        return None
    if len(nums) == 2:
        return nums[0] * 60 + nums[1]
    if len(nums) == 3:
        return nums[0] * 3600 + nums[1] * 60 + nums[2]
    return None


def script_from_ai(data: dict, transcript_lines: list) -> dict:
    """Rapikan keluaran Gemini menjadi proyek: kutipan di luar transkrip / terlalu panjang dipotong atau dibuang."""
    duration = transcript_lines[-1][1] if transcript_lines else 0
    raw = []
    for item in data.get("scenes") or []:
        if not isinstance(item, dict):
            continue
        if item.get("kind") == "quote":
            start, end = _to_seconds(item.get("start_time")), _to_seconds(item.get("end_time"))
            if start is None or end is None or end <= start or start >= duration:
                continue
            end = min(end, start + QUOTE_MAX, duration)
            if end - start < QUOTE_MIN:
                continue
            raw.append({**item, "start": start, "end": end})
        else:
            raw.append(item)
    scenes = sanitize_scenes(raw, None, duration)
    # Judul bab hanya di adegan pertama bab (AI kadang mengulangnya di adegan berikutnya)
    seen = set()
    for scene in scenes:
        key = scene["chapter"].lower()
        if key in seen:
            scene["chapter"] = ""
        elif key:
            seen.add(key)
    return {
        "version": 1,
        "title": _clean(data.get("title"), 100),
        "summary": _clean(data.get("summary"), 400),
        "thumbnail_ideas": thumbnail_ideas(data.get("thumbnail_texts")),
        "scenes": scenes,
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    }


def thumbnail_ideas(raw) -> list:
    from longform_thumb import clean_text
    out = []
    for item in raw if isinstance(raw, list) else []:
        text = clean_text(item)
        if text and text.lower() not in (t.lower() for t in out):
            out.append(text)
    return out[:3]


def prompt_for(template: str, channel: str, values: dict) -> str:
    prompt = template.replace("{VOICE_RULES}", voice_rules(channel))
    for key, value in values.items():
        prompt = prompt.replace("{" + key + "}", str(value))
    return prompt


def generate_script(transcript_lines: list, metadata: dict, minutes: int, focus: str, api_key: str | None,
                    channel: str = "") -> dict:
    from gemini_service import _call_gemini, _format_transcript
    minutes = minutes if minutes in DURATIONS else 8
    chapters_n, per_chapter, quotes = SCRIPT_SHAPE[minutes]
    narration = chapters_n * per_chapter + 4
    prompt = prompt_for(SCRIPT_PROMPT, channel, {})
    for key, value in {"MINUTES": minutes, "CHAPTERS": chapters_n, "PER_CHAPTER": per_chapter, "NARRATION": narration,
                       "WORDS": narration * WORDS_PER_SCENE, "QUOTES": quotes}.items():
        prompt = prompt.replace("{" + key + "}", str(value))
    user_text = (
        f"Judul podcast: {metadata.get('title', '')}\nChannel: {metadata.get('channel', '')}\n"
        + (f"Fokus/sudut pandang yang diminta pembuat video: {focus}\n" if focus else "")
        + f"\nTRANSKRIP:\n{_format_transcript(transcript_lines)}"
    )
    data = _call_gemini(prompt, user_text, api_key=api_key, schema=script_schema())
    if not isinstance(data, dict):
        raise ValueError("Format naskah dari AI tidak sesuai.")
    project = script_from_ai(data, transcript_lines)
    if sum(1 for s in project["scenes"] if s["kind"] == "narration") < 3:
        raise ValueError("AI tidak menghasilkan naskah yang cukup. Coba lagi.")
    project["channel"] = channel
    return project


# ── Suara ────────────────────────────────────────────────────

def wav_duration(path: str) -> float:
    with wave.open(path) as w:
        return w.getnframes() / float(w.getframerate())


def synthesize(text: str, voice: dict, out_path: str, api_key: str | None) -> float:
    """Gemini TTS satu adegan → WAV (24 kHz mono). Return durasi (detik)."""
    from gemini_service import _get_client
    last = None
    for attempt in range(2):
        try:
            result = _get_client(api_key).interactions.create(
                model=TTS_MODEL,
                input=[{"type": "user_input", "content": [{
                    "type": "text", "text": text,
                    "annotations": [{"type": "speech_metadata", "style": voice["style"]}],
                }]}],
                response_format={"type": "audio"},
                generation_config={"speech_config": [{"voice": voice["voice"]}]},
            )
            data = result.output_audio.data
            audio = base64.b64decode(data) if isinstance(data, str) else data
            if not audio:
                raise ValueError("Gemini tidak mengembalikan audio.")
            tmp = out_path + ".tmp"
            with open(tmp, "wb") as f:
                f.write(audio)
            os.replace(tmp, out_path)
            return wav_duration(out_path)
        except Exception as e:  # satu kali coba lagi (server sibuk / respons kosong)
            last = e
            if attempt == 0:
                time.sleep(1.5)
    raise last


def convert_recording(src: str, out_path: str) -> float:
    """Rekaman (webm/ogg/mp3/m4a/wav) → WAV mono 48 kHz, hening di awal & akhir dipangkas."""
    trim = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15"
    _run_ffmpeg(["ffmpeg", "-y", "-i", src, "-vn", "-ac", "1", "-ar", "48000",
                 "-af", f"{trim},areverse,{trim},areverse", out_path], "Rekaman tidak bisa dibaca")
    duration = wav_duration(out_path)
    if duration < 0.5:
        _remove_quietly(out_path)
        raise ValueError("Rekaman terlalu pendek atau tidak ada suara.")
    return duration


# ── Video stok ───────────────────────────────────────────────

_search_cache: dict[str, tuple[float, list]] = {}
SEARCH_TTL = 24 * 3600  # syarat API Pixabay: hasil pencarian di-cache 24 jam


def stock_provider() -> str | None:
    return "pixabay" if PIXABAY_API_KEY else "pexels" if PEXELS_API_KEY else None


def _best_file(files: list) -> dict | None:
    """File video landscape terbaik untuk 1080p: lebar ≥1920 terkecil, atau yang terbesar bila tidak ada."""
    usable = [f for f in files if f.get("link") and f.get("width") and f.get("height") and f["width"] >= f["height"]]
    if not usable:
        return None
    full = [f for f in usable if f["width"] >= W]
    return min(full, key=lambda f: f["width"]) if full else max(usable, key=lambda f: f["width"])


def _search_pixabay(query: str, per_page: int) -> list:
    res = requests.get("https://pixabay.com/api/videos/", timeout=15, params={
        "key": PIXABAY_API_KEY, "q": query, "video_type": "film", "safesearch": "true", "per_page": max(3, per_page)})
    if res.status_code == 429:
        raise RuntimeError("Batas pencarian Pixabay tercapai (100 per menit). Coba lagi sebentar lagi.")
    res.raise_for_status()
    results = []
    for hit in res.json().get("hits") or []:
        sizes = [v for v in (hit.get("videos") or {}).values() if isinstance(v, dict) and v.get("size")]
        best = _best_file([{**v, "link": v.get("url")} for v in sizes])
        if not best:
            continue
        thumb = next((v.get("thumbnail") for v in sizes if v.get("thumbnail")), "")
        user, user_id = hit.get("user") or "", hit.get("user_id")
        results.append(sanitize_visual({
            "provider": "pixabay", "id": hit.get("id"), "link": best["link"], "thumb": thumb, "page": hit.get("pageURL"),
            "credit": user, "credit_url": f"https://pixabay.com/users/{user}-{user_id}/" if user and user_id else "",
            "duration": hit.get("duration"),
        }))
    return results


def _search_pexels(query: str, per_page: int) -> list:
    res = requests.get("https://api.pexels.com/v1/videos/search", timeout=15,
                       headers={"Authorization": PEXELS_API_KEY},
                       params={"query": query, "orientation": "landscape", "size": "medium", "per_page": per_page})
    if res.status_code == 429:
        raise RuntimeError("Batas pencarian Pexels tercapai (200 per jam). Coba lagi nanti.")
    res.raise_for_status()
    results = []
    for video in res.json().get("videos") or []:
        best = _best_file(video.get("video_files") or [])
        if best:
            results.append(sanitize_visual({
                "provider": "pexels", "id": video.get("id"), "link": best["link"], "thumb": video.get("image"),
                "page": video.get("url"), "credit": (video.get("user") or {}).get("name"),
                "credit_url": (video.get("user") or {}).get("url"), "duration": video.get("duration"),
            }))
    return results


def search_stock(query: str, per_page: int = 12) -> list:
    """Cari video stok landscape (hasil di-cache 24 jam agar hemat kuota API)."""
    provider = stock_provider()
    if not provider:
        raise RuntimeError("Isi PIXABAY_API_KEY (atau PEXELS_API_KEY) di backend/.env.")
    query = _clean(query, 60)
    if not query:
        return []
    key = f"{provider}|{query.lower()}|{per_page}"
    cached = _search_cache.get(key)
    if cached and time.time() - cached[0] < SEARCH_TTL:
        return cached[1]
    found = (_search_pixabay if provider == "pixabay" else _search_pexels)(query, per_page)
    results = [r for r in found if r][:per_page]
    if len(_search_cache) > 500:
        _search_cache.clear()
    _search_cache[key] = (time.time(), results)
    return results


def download_stock(visual: dict) -> str:
    """Unduh video stok ke cache bersama (sekali per video)."""
    os.makedirs(STOCK_CACHE, exist_ok=True)
    path = os.path.join(STOCK_CACHE, f"{visual['provider']}_{visual['id']}.mp4")
    if os.path.isfile(path) and os.path.getsize(path) > 0:
        return path
    tmp = path + f".{uuid.uuid4().hex[:6]}.part"
    try:
        with requests.get(visual["link"], stream=True, timeout=30) as res:
            res.raise_for_status()
            size = 0
            with open(tmp, "wb") as f:
                for chunk in res.iter_content(1 << 20):
                    size += len(chunk)
                    if size > 400 * 1024 * 1024:
                        raise ValueError("Video stok terlalu besar.")
                    f.write(chunk)
        os.replace(tmp, path)
    finally:
        _remove_quietly(tmp)
    return path


# ── Subtitle ─────────────────────────────────────────────────

def speech_spans(audio_path: str, duration: float) -> list:
    """Bagian berisi suara [(mulai, selesai)] dari deteksi hening FFmpeg (jeda ≥0,2 detik)."""
    try:
        res = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", audio_path, "-af",
                              "silencedetect=noise=-35dB:d=0.2", "-f", "null", "-"],
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60)
        log = res.stderr.decode("utf-8", errors="ignore")
    except (OSError, subprocess.TimeoutExpired):
        return [(0.0, duration)]
    starts = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", log)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
    spans, t = [], 0.0
    for i, s0 in enumerate(starts):
        if s0 > t + 0.05:
            spans.append((t, s0))
        t = ends[i] if i < len(ends) else duration
    if t < duration - 0.05:
        spans.append((t, duration))
    return spans or [(0.0, duration)]


def timed_words(text: str, spans: list) -> list:
    """
    Waktu tiap kata naskah tanpa transkripsi: tiap akhir kalimat dipasang ke jeda hening terdekat, lalu kata
    di dalam kalimat dibagi menurut panjangnya ke bagian yang berisi suara saja (jeda dilewati).
    """
    words = text.split()
    speech = sum(e - s for s, e in spans)
    if not words or speech <= 0:
        return []
    weights = [len(w) + 1 for w in words]
    total = sum(weights)

    def at(position: float, after_gap: bool = False) -> float:  # detik suara ke-n → detik sebenarnya
        for s0, e0 in spans:
            if position < e0 - s0 or (position == e0 - s0 and not after_gap):
                return s0 + position
            position -= e0 - s0
        return spans[-1][1]

    # Posisi suara (detik) tiap batas kata menurut panjang kata
    marks = [0.0]
    for weight in weights:
        marks.append(marks[-1] + speech * weight / total)
    # Akhir kalimat → geser ke jeda terdekat (berurutan), kata di antaranya ditata ulang secara proporsional
    gaps = [sum(e - s for s, e in spans[:i + 1]) for i in range(len(spans) - 1)]
    ends = [i + 1 for i, w in enumerate(words[:-1]) if w[-1:] in ".?!"]
    anchors, used = {0: 0.0, len(words): speech}, -1
    for k, idx in enumerate(ends):
        room = len(gaps) - (len(ends) - k - 1)  # sisakan jeda untuk kalimat berikutnya
        options = range(used + 1, room)
        if not options:
            break
        used = min(options, key=lambda g: abs(gaps[g] - marks[idx]))
        anchors[idx] = gaps[used]
    keys = sorted(anchors)
    for a, b in zip(keys, keys[1:]):
        span = marks[b] - marks[a]
        for i in range(a + 1, b):
            marks[i] = anchors[a] + (anchors[b] - anchors[a]) * (marks[i] - marks[a]) / span if span else anchors[a]
        marks[b] = anchors[b]
    marks[0] = 0.0
    snapped = set(anchors)
    return [(at(marks[i], after_gap=i in snapped), at(marks[i + 1]), w) for i, w in enumerate(words)]


def subtitle_lines(timed: list, max_words: int = 8, max_chars: int = 44) -> list:
    """Kelompokkan kata menjadi baris subtitle; baris diputus di akhir kalimat/koma bila memungkinkan."""
    lines, cur = [], []
    for item in timed:
        cur.append(item)
        text = " ".join(w for _, _, w in cur)
        end_punct = item[2][-1:] in ".?!"
        if len(cur) >= max_words or len(text) >= max_chars or end_punct or (item[2][-1:] in ",;:" and len(cur) >= 4):
            lines.append(cur)
            cur = []
    if cur:
        lines.append(cur)
    return [(ln[0][0], ln[-1][1], " ".join(w for _, _, w in ln)) for ln in lines]


def _ass_time(t: float) -> str:
    cs = max(0, int(round(t * 100)))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def _ass_text(text: str) -> str:
    return text.replace("\\", "").replace("{", "(").replace("}", ")").replace("\n", " ")


def scene_ass(lines: list, duration: float, chapter: str = "", source_label: str = "") -> str:
    """ASS 1920x1080: subtitle di bawah, kartu judul bab di awal adegan, label sumber untuk kutipan."""
    font = FONTS["poppins-semibold"]
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,{font},56,&H00FFFFFF,&H00FFFFFF,&H00000000,&H90000000,0,0,0,0,100,100,0,0,1,3,2,2,160,160,72,1
Style: Chapter,{FONTS["poppins"]},92,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,160,160,0,1
Style: Kicker,{font},40,&H00C4A0FF,&H00C4A0FF,&H00000000,&H00000000,0,0,0,0,100,100,2,0,1,0,0,5,160,160,0,1
Style: Source,{font},30,&H00FFFFFF,&H00FFFFFF,&H70000000,&H70000000,0,0,0,0,100,100,0,0,3,14,0,7,60,60,50,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    sub_from = 0.0
    if chapter:
        card = min(2.6, max(1.2, duration - 0.2))
        shade = r"{\an7\pos(0,0)\1c&H000000&\1a&H60&\bord0\shad0\fad(200,300)\p1}" + f"m 0 0 l {W} 0 {W} {H} 0 {H}"
        events.append(f"Dialogue: 2,{_ass_time(0)},{_ass_time(card)},Chapter,,0,0,0,,{shade}")
        events.append(f"Dialogue: 3,{_ass_time(0)},{_ass_time(card)},Kicker,,0,0,0,,"
                      + r"{\pos(960,470)\fad(200,300)}BAB")
        events.append(f"Dialogue: 3,{_ass_time(0)},{_ass_time(card)},Chapter,,0,0,0,,"
                      + r"{\pos(960,560)\fad(200,300)\blur0.6}" + _ass_text(chapter))
        sub_from = card
    if source_label:
        events.append(f"Dialogue: 1,{_ass_time(0)},{_ass_time(duration)},Source,,0,0,0,,{_ass_text(source_label)}")
    for i, (start, end, text) in enumerate(lines):
        # Sedikit diperpanjang agar tidak hilang terlalu cepat, tapi tidak menumpuk dengan baris berikutnya
        limit = lines[i + 1][0] if i + 1 < len(lines) else duration
        start, end = max(start, sub_from), min(max(end, min(end + 0.15, limit)), duration)
        if end - start >= 0.2:
            events.append(f"Dialogue: 0,{_ass_time(start)},{_ass_time(end)},Sub,,0,0,0,,{_ass_text(text)}")
    return head + "\n".join(events) + "\n"


def quote_lines(transcript_lines: list, start: float, end: float) -> list:
    """
    Subtitle kutipan dari baris transkrip di rentangnya (waktu relatif ke awal kutipan). Baris subtitle otomatis
    YouTube saling tumpang tindih → tiap baris diakhiri saat baris berikutnya mulai, agar tidak bertumpuk.
    """
    rows = sorted((s, e, t) for s, e, t in transcript_lines if e > start and s < end and str(t).strip())
    out = []
    for i, (s, e, t) in enumerate(rows):
        if i + 1 < len(rows):
            e = min(e, rows[i + 1][0])
        if e - s >= 0.2:
            out.append((max(s, start) - start, min(e, end) - start, str(t).strip()))
    return out


# ── Render ───────────────────────────────────────────────────

# veryfast: ±3x lebih cepat dari medium; YouTube tetap meng-encode ulang, jadi selisih kualitasnya tak terlihat
VIDEO_ARGS = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-r", str(FPS),
              "-profile:v", "high", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709"]
AUDIO_ARGS = ["-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2"]
LOUDNORM = "loudnorm=I=-16:TP=-1.5:LRA=11"
COVER = f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1,fps={FPS}"


def _render_narration(scene: dict, audio_path: str, stock_path: str | None, workdir: str, index: int) -> tuple[str, float]:
    duration = wav_duration(audio_path) + 0.35
    lines = subtitle_lines(timed_words(scene["text"], speech_spans(audio_path, duration - 0.35)))
    ass_name = f"scene_{index:03d}.ass"
    with open(os.path.join(workdir, ass_name), "w", encoding="utf-8") as f:
        f.write(scene_ass(lines, duration, scene.get("chapter", "")))
    out = os.path.join(workdir, f"scene_{index:03d}.mp4")
    if stock_path:
        video_in = ["-stream_loop", "-1", "-i", stock_path]
        look = f"{COVER},eq=brightness=-0.05:saturation=0.92"
    else:  # tanpa visual stok: latar gelap polos
        video_in = ["-f", "lavfi", "-i", f"color=c=0x16131f:s={W}x{H}:r={FPS}"]
        look = "setsar=1"
    graph = (f"[0:v]{look},ass={ass_name}:fontsdir={_fonts_dir_for(workdir)}[v];"
             f"[1:a]aresample=48000,aformat=channel_layouts=stereo,apad,{LOUDNORM}[a]")
    _run_ffmpeg(["ffmpeg", "-y", *video_in, "-i", audio_path, "-filter_complex", graph, "-map", "[v]", "-map", "[a]",
                 "-t", f"{duration:.3f}", *VIDEO_ARGS, *AUDIO_ARGS, os.path.basename(out)],
                f"Adegan {index + 1} gagal dirender", cwd=workdir)
    return out, duration


def _render_quote(scene: dict, source_path: str, transcript_lines: list, label: str, workdir: str, index: int) -> tuple[str, float]:
    start, end = scene["start"], scene["end"]
    duration = end - start
    lines = quote_lines(transcript_lines, start, end)
    ass_name = f"scene_{index:03d}.ass"
    with open(os.path.join(workdir, ass_name), "w", encoding="utf-8") as f:
        f.write(scene_ass(lines, duration, scene.get("chapter", ""), label))
    out = os.path.join(workdir, f"scene_{index:03d}.mp4")
    graph = (f"[0:v]split[a][b];[a]{COVER},boxblur=24:2,eq=brightness=-0.18[bg];"
             f"[b]scale={W}:{H}:force_original_aspect_ratio=decrease,setsar=1[fg];"
             f"[bg][fg]overlay=(W-w)/2:(H-h)/2,fps={FPS},ass={ass_name}:fontsdir={_fonts_dir_for(workdir)}[v];"
             f"[0:a]aresample=48000,aformat=channel_layouts=stereo,afade=t=in:d=0.15,"
             f"afade=t=out:st={max(0.0, duration - 0.25):.3f}:d=0.25,{LOUDNORM}[a]")
    _run_ffmpeg(["ffmpeg", "-y", "-ss", f"{start:.3f}", "-t", f"{duration:.3f}", "-i", source_path,
                 "-filter_complex", graph, "-map", "[v]", "-map", "[a]", "-t", f"{duration:.3f}",
                 *VIDEO_ARGS, *AUDIO_ARGS, os.path.basename(out)],
                f"Kutipan di adegan {index + 1} gagal dirender", cwd=workdir)
    return out, duration


def render(project: dict, folder: str, source_path: str | None, transcript_lines: list, label: str,
           out_name: str, callback=None) -> dict:
    """Render semua adegan lalu sambung. Return {"filename", "durations"}."""
    workdir = os.path.join(folder, f"work_{uuid.uuid4().hex[:8]}")
    os.makedirs(workdir)
    try:
        parts, durations = [], []
        scenes = project["scenes"]
        for i, scene in enumerate(scenes):
            if callback:
                callback({"status": "running", "progress": int(90 * i / max(1, len(scenes))),
                          "message": f"Adegan {i + 1} dari {len(scenes)}"})
            if scene["kind"] == "quote":
                if not source_path:
                    raise ValueError("Adegan kutipan butuh file video podcast. Upload videonya dulu atau hapus kutipannya.")
                part, dur = _render_quote(scene, source_path, transcript_lines, label, workdir, i)
            else:
                stock = None
                if scene.get("visual"):
                    try:
                        stock = download_stock(scene["visual"])
                    except Exception as e:
                        print(f"[Longform] Video stok gagal diunduh, pakai latar polos: {e}")
                part, dur = _render_narration(scene, os.path.join(folder, scene["audio"]["file"]), stock, workdir, i)
            parts.append(part)
            durations.append(dur)
        if callback:
            callback({"status": "running", "progress": 92, "message": "Menyambung adegan"})
        list_path = os.path.join(workdir, "parts.txt")
        with open(list_path, "w", encoding="utf-8") as f:
            f.writelines(f"file '{os.path.basename(p)}'\n" for p in parts)
        tmp_out = os.path.join(folder, out_name + ".rendering.mp4")
        _run_ffmpeg(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", "parts.txt", "-c", "copy",
                     "-movflags", "+faststart", os.path.abspath(tmp_out)], "Gagal menyambung adegan", cwd=workdir)
        os.replace(tmp_out, os.path.join(folder, out_name))
        return {"filename": out_name, "durations": durations}
    finally:
        for name in os.listdir(workdir):
            _remove_quietly(os.path.join(workdir, name))
        try:
            os.rmdir(workdir)
        except OSError:
            pass


def stock_enabled() -> bool:
    return stock_provider() is not None


def media_file_ok(name: str) -> bool:
    return bool(MEDIA_FILE_RE.match(name or ""))
