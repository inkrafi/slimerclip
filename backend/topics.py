"""
Video panjang dari topik/isu yang sedang ramai (bukan dari podcast).

1. Bahan: Google Trends Indonesia (pencarian yang sedang naik) + berita 7 hari terakhir dari Bing News
   per kata kunci niche. Keduanya RSS publik tanpa API key, dan link beritanya langsung ke situs media.
2. Ide: Gemini memilih & merumuskan ide video dari judul-judul berita itu; setiap ide menyebut berita sumbernya
   (nomor dari daftar), jadi sumber yang tampil adalah link asli, bukan karangan AI.
3. Naskah: isi artikel sumber dibaca, lalu Gemini menulis naskah yang fakta/angkanya hanya dari artikel itu.
   Hasilnya proyek video panjang biasa (adegan narasi tanpa kutipan podcast).
"""

import html
import ipaddress
import re
import socket
import time
import urllib.parse
import uuid
from concurrent.futures import ThreadPoolExecutor
from email.utils import parsedate_to_datetime

import requests

import longform

TOPIC_PREFIX = "topic_"
TOPIC_ID_RE = re.compile(r"^topic_[0-9a-f]{12}$")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/130.0 Safari/537.36", "Accept-Language": "id-ID,id;q=0.9,en;q=0.6"}
FEED_TTL = 30 * 60           # RSS di-cache 30 menit
ARTICLE_MAX_BYTES = 3 * 1024 * 1024
ARTICLE_CHARS = 5000         # isi artikel yang dikirim ke Gemini (per sumber)
MAX_SOURCES = 5

# Kata kunci pencarian berita per kategori niche (backend/niche.py)
NICHE_QUERIES = {
    "bisnis": "bisnis UMKM startup", "investasi": "investasi saham IHSG", "keuangan": "keuangan pribadi gaji utang",
    "marketing": "digital marketing media sosial", "karier": "karier dunia kerja PHK", "teknologi": "teknologi AI",
    "pendidikan": "pendidikan", "mindset": "kisah sukses pengusaha", "kesehatan": "kesehatan gaya hidup",
    "hubungan": "keluarga pernikahan", "sosial": "isu sosial kebijakan pemerintah", "hiburan": "selebriti viral",
}


def new_topic_id() -> str:
    return TOPIC_PREFIX + uuid.uuid4().hex[:12]


def is_topic_id(value) -> bool:
    return isinstance(value, str) and bool(TOPIC_ID_RE.match(value))


# ── Ambil URL dengan aman ────────────────────────────────────

def _public_host(host: str) -> bool:
    """Tolak alamat lokal/privat (mencegah server diarahkan ke jaringan internal lewat URL dari luar)."""
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError:
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            return False
    return True


def safe_url(url) -> str:
    url = str(url or "").strip()
    parts = urllib.parse.urlparse(url)
    return url if parts.scheme in ("http", "https") and parts.hostname and len(url) < 2000 else ""


def _get(url: str, timeout: float = 12, max_bytes: int = ARTICLE_MAX_BYTES) -> requests.Response | None:
    """GET dengan redirect yang dicek satu per satu (maks 4) dan batas ukuran."""
    for _ in range(5):
        if not safe_url(url) or not _public_host(urllib.parse.urlparse(url).hostname):
            return None
        res = requests.get(url, headers=UA, timeout=timeout, allow_redirects=False, stream=True)
        if res.is_redirect or res.status_code in (301, 302, 303, 307, 308):
            url = urllib.parse.urljoin(url, res.headers.get("Location", ""))
            res.close()
            continue
        if res.status_code != 200:
            res.close()
            return None
        body = b""
        for chunk in res.iter_content(65536):
            body += chunk
            if len(body) > max_bytes:
                break
        res._content = body
        return res
    return None


# ── Feed tren & berita ───────────────────────────────────────

_feed_cache: dict[str, tuple[float, list]] = {}


def _cached(key: str, fn):
    hit = _feed_cache.get(key)
    if hit and time.time() - hit[0] < FEED_TTL:
        return hit[1]
    value = fn()
    if len(_feed_cache) > 200:
        _feed_cache.clear()
    _feed_cache[key] = (time.time(), value)
    return value


def _tag(xml: str, name: str) -> str:
    m = re.search(rf"<{name}[^>]*>(.*?)</{name}>", xml, re.S)
    text = m.group(1) if m else ""
    text = re.sub(r"^<!\[CDATA\[(.*)\]\]>$", r"\1", text.strip(), flags=re.S)
    return html.unescape(re.sub(r"<[^>]+>", " ", text)).strip()


def _date(value: str) -> str:
    try:
        return parsedate_to_datetime(value).strftime("%Y-%m-%d")
    except (TypeError, ValueError):
        return ""


def google_trends() -> list:
    """Pencarian yang sedang naik di Indonesia, masing-masing dengan berita terkaitnya."""
    def fetch():
        res = requests.get("https://trends.google.com/trending/rss?geo=ID", headers=UA, timeout=15)
        res.raise_for_status()
        out = []
        for item in re.findall(r"<item>(.*?)</item>", res.text, re.S):
            news = []
            for n in re.findall(r"<ht:news_item>(.*?)</ht:news_item>", item, re.S):
                url = safe_url(_tag(n, "ht:news_item_url"))
                if url:
                    news.append({"title": _tag(n, "ht:news_item_title"), "url": url,
                                 "source": _tag(n, "ht:news_item_source"), "date": _date(_tag(item, "pubDate")),
                                 "trend": _tag(item, "title")})
            out.extend(news[:2])
        return out
    return _cached("trends", fetch)


def search_news(query: str, limit: int = 8) -> list:
    """Berita 7 hari terakhir (Bing News RSS, link langsung ke media)."""
    query = re.sub(r"\s+", " ", str(query or "")).strip()[:100]
    if not query:
        return []

    def fetch():
        res = requests.get("https://www.bing.com/news/search", headers=UA, timeout=15, params={
            "q": query, "format": "rss", "setlang": "id", "cc": "ID", "qft": 'interval="8"'})
        res.raise_for_status()
        out = []
        for item in re.findall(r"<item>(.*?)</item>", res.text, re.S):
            link = _tag(item, "link")
            url = safe_url(urllib.parse.parse_qs(urllib.parse.urlparse(link).query).get("url", [link])[0])
            if url:
                out.append({"title": _tag(item, "title"), "url": url, "source": _tag(item, "News:Source"),
                            "date": _date(_tag(item, "pubDate")), "snippet": _tag(item, "description")[:300]})
        return out[:limit]
    return _cached(f"news|{query.lower()}|{limit}", fetch)


def gather_headlines(query: str, niche_topics: list) -> list:
    """Bahan ide: berita untuk kata kunci (atau tiap topik niche) + Google Trends, tanpa duplikat."""
    searches = [query] if query else [NICHE_QUERIES[t] for t in niche_topics if t in NICHE_QUERIES][:5]
    if not searches:
        searches = ["bisnis", "investasi", "teknologi AI", "ekonomi Indonesia"]
    jobs = [(search_news, q) for q in searches] + ([] if query else [(lambda _: google_trends(), None)])
    with ThreadPoolExecutor(max_workers=6) as pool:
        batches = list(pool.map(lambda job: _quiet(job[0], job[1]), jobs))
    seen, out = set(), []
    for item in (i for batch in batches for i in batch):
        key = re.sub(r"\W+", " ", item["title"].lower()).strip()[:80]
        if key and key not in seen and item["url"] not in seen:
            seen.update((key, item["url"]))
            out.append(item)
    return out[:50]


def _quiet(fn, arg) -> list:
    try:
        return fn(arg)
    except (requests.RequestException, ValueError) as e:
        print(f"[Topik] Feed gagal ({arg}): {e!r}")
        return []


# ── Ide (Gemini) ─────────────────────────────────────────────

IDEAS_PROMPT = """
Kamu produser konten YouTube edukasi "faceless" untuk audiens Indonesia.
Dari daftar berita terbaru di bawah, usulkan 6 ide video panjang (5-12 menit) yang paling berpotensi ditonton,
cocok untuk niche: {NICHE}.

ATURAN
- Setiap ide berangkat dari isu nyata di daftar berita; sebutkan nomor berita sumbernya di "source_ids" (1-4 nomor).
- Sudut pandang (angle) harus memberi nilai: menjelaskan "kenapa ini terjadi", "apa dampaknya ke kamu",
  atau "pelajaran yang bisa diambil" — bukan sekadar membacakan berita.
- title: judul YouTube maks 70 karakter, gaya rasa penasaran, tanpa emoji, tanpa clickbait palsu.
- angle: 1-2 kalimat sudut pandang/isi video.
- why: 1 kalimat kenapa topik ini sedang ramai / relevan sekarang.
- Hindari gosip pribadi, SARA, dan tuduhan kriminal terhadap orang tertentu.

Kembalikan HANYA JSON: {"ideas": [{"title": "...", "angle": "...", "why": "...", "source_ids": [1, 2]}]}
"""


def ideas_schema() -> dict:
    text = {"type": "string"}
    idea = {"type": "object",
            "properties": {"title": text, "angle": text, "why": text, "source_ids": {"type": "array", "items": {"type": "integer"}}},
            "required": ["title", "angle", "why", "source_ids"]}
    return {"type": "object", "properties": {"ideas": {"type": "array", "items": idea, "minItems": 3}}, "required": ["ideas"]}


def _headline_list(items: list) -> str:
    return "\n".join(f"{i + 1}. [{h.get('date', '')}] {h['title']} ({h.get('source', '')})"
                     + (f" — {h['snippet']}" if h.get("snippet") else "") for i, h in enumerate(items))


def generate_ideas(headlines: list, niche_text: str, api_key: str | None = None) -> list:
    from gemini_service import _call_gemini
    if not headlines:
        raise ValueError("Tidak ada berita terbaru yang bisa dijadikan bahan. Coba kata kunci lain.")
    data = _call_gemini(IDEAS_PROMPT.replace("{NICHE}", niche_text or "umum (bisnis, uang, teknologi, isu sosial)"),
                        "BERITA TERBARU:\n" + _headline_list(headlines), api_key=api_key, schema=ideas_schema())
    ideas = []
    for idea in (data or {}).get("ideas") or []:
        if not isinstance(idea, dict):
            continue
        ids = [i for i in idea.get("source_ids") or [] if isinstance(i, int) and 1 <= i <= len(headlines)]
        sources = [_source(headlines[i - 1]) for i in dict.fromkeys(ids)][:MAX_SOURCES]
        title = longform._clean(idea.get("title"), 100)
        if title and sources:
            ideas.append({"title": title, "angle": longform._clean(idea.get("angle"), 400),
                          "why": longform._clean(idea.get("why"), 300), "sources": sources})
    if not ideas:
        raise ValueError("AI tidak menemukan ide yang cocok. Coba kata kunci lain.")
    return ideas[:8]


def _source(item: dict) -> dict:
    return {"title": longform._clean(item.get("title"), 200), "url": safe_url(item.get("url")),
            "source": longform._clean(item.get("source"), 80), "date": longform._clean(item.get("date"), 10)}


def sanitize_sources(raw) -> list:
    out = []
    for item in (raw if isinstance(raw, list) else [])[:MAX_SOURCES]:
        if isinstance(item, dict):
            src = _source(item)
            if src["url"] and src["title"]:
                out.append(src)
    return out


# ── Naskah dari sumber berita ────────────────────────────────

def article_text(url: str) -> str:
    """Isi artikel (paragraf <p>) dari halaman berita; kosong jika gagal/terlalu sedikit."""
    try:
        res = _get(url)
    except requests.RequestException:
        return ""
    if not res or "html" not in res.headers.get("Content-Type", "html"):
        return ""
    page = res.content.decode(res.encoding or "utf-8", errors="ignore")
    page = re.sub(r"<(script|style|noscript|figure|aside|nav|footer)[^>]*>.*?</\1>", " ", page, flags=re.S | re.I)
    paragraphs = []
    for p in re.findall(r"<p[^>]*>(.*?)</p>", page, re.S | re.I):
        text = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", p))).strip()
        if len(text) >= 60 and not re.search(r"(?i)baca juga|simak juga|advertisement|cookie", text):
            paragraphs.append(text)
    text = "\n".join(dict.fromkeys(paragraphs))
    return text[:ARTICLE_CHARS] if len(text) >= 300 else ""


TOPIC_SCRIPT_PROMPT = """
Kamu penulis naskah video YouTube edukasi "faceless" (narasi + visual stok) untuk audiens Indonesia.
Tulis naskah video panjang ±{MINUTES} menit tentang topik di bawah, berdasarkan SUMBER BERITA yang diberikan.

PANJANG (WAJIB DIPATUHI):
- TEPAT {CHAPTERS} bab, masing-masing {PER_CHAPTER} adegan narasi, ditambah 2 adegan pembuka dan 2 adegan penutup.
- Total {NARRATION} adegan narasi (±{WORDS} kata). Jangan mengulang kalimat.

AKURASI (PALING PENTING)
- Fakta terbaru (angka, tanggal, nama, kutipan, kejadian) HANYA dari SUMBER BERITA. Sebut medianya secara lisan
  saat memakai fakta penting, mis. "menurut Katadata, ...".
- Boleh menambah penjelasan konsep umum (mis. apa itu inflasi, cara kerja saham) dari pengetahuan umum,
  tapi JANGAN menambah klaim/angka spesifik yang tidak ada di sumber.
- Jika sumber berbeda pendapat, sampaikan keduanya. Jangan menuduh orang tertentu melakukan kejahatan.
- Untuk topik investasi/keuangan, selipkan di adegan rangkuman pengingat singkat bahwa ini bukan ajakan membeli/menjual.

STRUKTUR
- Isi "chapter" HANYA pada adegan pertama tiap bab (maks 40 karakter); adegan lain chapter "".
  Adegan pembuka tanpa bab; bab pertama dimulai setelahnya.
- Alur: apa yang terjadi → kenapa terjadi → dampaknya ke penonton → apa yang bisa dilakukan/pelajaran.
{VOICE_RULES}
ADEGAN (semua kind "narration")
- text: 2-3 kalimat lisan sehari-hari, 25-40 kata, enak dibacakan.
- query: 2-4 kata kunci BAHASA INGGRIS untuk video stok yang cocok (mis. "stock market screen", "jakarta traffic"),
  tanpa nama orang/merek. start_time & end_time "".

Juga tulis title (maks 70 karakter, rasa penasaran, tanpa emoji) dan summary (2 kalimat, tanpa hashtag).
Kembalikan HANYA JSON:
{"title": "...", "summary": "...", "thumbnail_texts": ["...", "...", "..."], "scenes": [{"kind": "narration", "chapter": "", "text": "...", "query": "...", "start_time": "", "end_time": ""}]}
"""


def generate_script(topic: str, angle: str, sources: list, minutes: int, api_key: str | None = None,
                    channel: str = "") -> dict:
    from gemini_service import _call_gemini
    minutes = minutes if minutes in longform.DURATIONS else 8
    with ThreadPoolExecutor(max_workers=MAX_SOURCES) as pool:
        texts = list(pool.map(lambda s: article_text(s["url"]), sources))
    blocks = []
    for i, (src, text) in enumerate(zip(sources, texts)):
        blocks.append(f"[{i + 1}] {src['title']} — {src['source']} ({src['date']})\n{src['url']}\n"
                      + (text or "(isi artikel tidak bisa dibaca; pakai judulnya saja, jangan mengarang isinya)"))
    if not any(texts):
        print("[Topik] Tidak ada isi artikel yang terbaca, naskah hanya dari judul berita")
    chapters_n, per_chapter, _ = longform.SCRIPT_SHAPE[minutes]
    per_chapter += 1  # tanpa kutipan podcast: durasinya diisi narasi
    narration = chapters_n * per_chapter + 4
    prompt = longform.prompt_for(TOPIC_SCRIPT_PROMPT, channel, {
        "MINUTES": minutes, "CHAPTERS": chapters_n, "PER_CHAPTER": per_chapter, "NARRATION": narration,
        "WORDS": narration * longform.WORDS_PER_SCENE})
    user_text = f"TOPIK: {topic}\n" + (f"SUDUT PANDANG: {angle}\n" if angle else "") + "\nSUMBER BERITA:\n\n" + "\n\n".join(blocks)
    data = _call_gemini(prompt, user_text, api_key=api_key, schema=longform.script_schema())
    if not isinstance(data, dict):
        raise ValueError("Format naskah dari AI tidak sesuai.")
    data["scenes"] = [s for s in data.get("scenes") or [] if isinstance(s, dict) and s.get("kind") != "quote"]
    project = longform.script_from_ai(data, [])
    if len(project["scenes"]) < 3:
        raise ValueError("AI tidak menghasilkan naskah yang cukup. Coba lagi.")
    project.update({"topic": longform._clean(topic, 200), "angle": longform._clean(angle, 400), "sources": sources,
                    "minutes": minutes, "read_sources": sum(1 for t in texts if t), "channel": channel})
    return project
