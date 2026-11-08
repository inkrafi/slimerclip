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
import klik_render

TOPIC_PREFIX = "topic_"
TOPIC_ID_RE = re.compile(r"^topic_[0-9a-f]{12}$")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/130.0 Safari/537.36", "Accept-Language": "id-ID,id;q=0.9,en;q=0.6"}
FEED_TTL = 30 * 60           # RSS di-cache 30 menit
ARTICLE_MAX_BYTES = 3 * 1024 * 1024
ARTICLE_CHARS = 5000         # isi artikel yang dikirim ke Gemini (per sumber)
MAX_SOURCES = 5
NEWS_DAYS = 8
# Niche channel Klik Digital ID: teknologi, karier, dan uang. Dipisah dari niche akun, yang dipakai menyaring momen podcast klien.
CHANNEL_NICHE = ("teknologi", "karier", "keuangan")
# Berita ramai umum (Google Trends) sengaja tidak dipakai di sini, karena kebanyakan di luar niche
CHANNEL_QUERIES = ("AI pekerjaan teknologi", "aplikasi teknologi Indonesia", "PHK lowongan kerja", "gaji pekerja UMP",
                   "keuangan pribadi tabungan", "paylater pinjol utang", "harga kebutuhan inflasi")
FITS = ("short", "long", "both")
PILLARS = {"teknologi": "Teknologi", "karier": "Karier", "uang": "Uang"}

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


def _recent(date: str) -> bool:
    """Berita 7 hari terakhir, ditambah satu hari untuk selisih zona waktu. Tanpa tanggal tetap dipakai."""
    if not date:
        return True
    return date >= time.strftime("%Y-%m-%d", time.gmtime(time.time() - NEWS_DAYS * 86400))


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
            "q": query, "format": "rss", "setlang": "id", "cc": "ID"})
        res.raise_for_status()
        out = []
        for item in re.findall(r"<item>(.*?)</item>", res.text, re.S):
            link = _tag(item, "link")
            url = safe_url(urllib.parse.parse_qs(urllib.parse.urlparse(link).query).get("url", [link])[0])
            date = _date(_tag(item, "pubDate"))
            # Saring di sini: filter tanggal di URL Bing (qft) kini mengembalikan hasil kosong
            if url and _recent(date):
                out.append({"title": _tag(item, "title"), "url": url, "source": _tag(item, "News:Source"),
                            "date": date, "snippet": _tag(item, "description")[:300]})
        return out[:limit]
    return _cached(f"news|{query.lower()}|{limit}", fetch)


def gather_headlines(query: str, niche_topics: list) -> list:
    """Bahan ide: berita untuk kata kunci (atau tiap topik niche) + Google Trends, tanpa duplikat."""
    channel = not query and tuple(niche_topics) == CHANNEL_NICHE
    searches = [query] if query else list(CHANNEL_QUERIES) if channel else [NICHE_QUERIES[t] for t in niche_topics if t in NICHE_QUERIES][:5]
    if not searches:
        searches = ["bisnis", "investasi", "teknologi AI", "ekonomi Indonesia"]
    jobs = [(search_news, q) for q in searches] + ([] if query or channel else [(lambda _: google_trends(), None)])
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
Kamu produser konten edukasi "faceless" untuk audiens Indonesia (YouTube, TikTok, Reels).
Dari daftar berita terbaru di bawah, usulkan 8 ide video yang paling berpotensi ditonton,
untuk channel tentang teknologi, karier, dan uang pribadi. Fokus kata kunci: {NICHE}.
Lewati berita yang tidak menyentuh pekerjaan, penghasilan, pengeluaran, atau teknologi yang dipakai sehari-hari,
seperti olahraga, kriminal, politik, dan selebriti. Lebih baik 4 ide yang pas daripada 8 ide yang dipaksakan.

ATURAN
- Setiap ide berangkat dari isu nyata di daftar berita; sebutkan nomor berita sumbernya di "source_ids" (1-4 nomor).
- Sudut pandang (angle) harus memberi nilai: menjelaskan "kenapa ini terjadi", "apa dampaknya ke kamu",
  atau "pelajaran yang bisa diambil" — bukan sekadar membacakan berita.
- title: judul YouTube maks 70 karakter, gaya rasa penasaran, tanpa emoji, tanpa clickbait palsu.
- angle: 1-2 kalimat sudut pandang/isi video.
- why: 1 kalimat kenapa topik ini sedang ramai / relevan sekarang.
- pillar: "teknologi", "karier", atau "uang". Pakai "lainnya" kalau tidak benar-benar masuk salah satunya.
- fit: format yang paling cocok, salah satu dari:
  "short" = satu ide, satu angka, atau satu kejutan yang tuntas dalam 60 detik, tanpa perlu banyak konteks.
  "long" = butuh penjelasan sebab-akibat, beberapa sumber atau data, dan masih relevan berbulan-bulan (5-12 menit).
  "both" = pembahasan utuhnya layak jadi video panjang, dan ada satu bagian yang berdiri sendiri sebagai video pendek.
  Usahakan minimal 2 ide "short" dan 2 ide "long". Jangan semua "both".
- fit_reason: 1 kalimat pendek alasan format itu.
- Hindari gosip pribadi, SARA, dan tuduhan kriminal terhadap orang tertentu.

Kembalikan HANYA JSON: {"ideas": [{"title": "...", "angle": "...", "why": "...", "pillar": "uang", "fit": "short", "fit_reason": "...", "source_ids": [1, 2]}]}
"""


def ideas_schema() -> dict:
    text = {"type": "string"}
    idea = {"type": "object",
            "properties": {"title": text, "angle": text, "why": text, "fit": {"type": "string", "enum": list(FITS)}, "fit_reason": text,
                           "pillar": {"type": "string", "enum": [*PILLARS, "lainnya"]},
                           "source_ids": {"type": "array", "items": {"type": "integer"}}},
            "required": ["title", "angle", "why", "pillar", "fit", "fit_reason", "source_ids"]}
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
        if title and sources and idea.get("pillar") != "lainnya":
            ideas.append({"title": title, "angle": longform._clean(idea.get("angle"), 400),
                          "why": longform._clean(idea.get("why"), 300), "fit": idea.get("fit") if idea.get("fit") in FITS else "both",
                          "fit_reason": longform._clean(idea.get("fit_reason"), 160),
                          "pillar": PILLARS.get(idea.get("pillar"), ""), "sources": sources})
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


SHORT_SCRIPT_PROMPT = """
Kamu penulis naskah video pendek "faceless" untuk TikTok, YouTube Shorts, dan Reels, audiens Indonesia.
Tulis naskah {SECONDS} detik tentang topik di bawah. {BASIS}

PANJANG (WAJIB): 6-9 adegan, total maksimal {WORDS} kata. Hitung jumlah katanya sebelum menjawab. Satu video hanya untuk satu ide.

STRUKTUR
- Adegan 1 = hook: kalimat pertama langsung ke angka, kejutan, atau pertanyaan paling tajam. Tanpa salam, tanpa nama channel.
- Tengah = bangun rasa penasaran, lalu bayar janji hook dengan fakta dan dampaknya ke penonton.
- Adegan terakhir = satu pertanyaan spesifik yang memancing komentar, diakhiri tanda tanya.
- Sambungkan adegan dengan "tapi" atau "makanya", bukan "terus". Tiap fakta harus memicu fakta berikutnya.
- Sekali di tengah, lempar pertanyaan dan tunda jawabannya satu adegan, supaya penonton ikut menebak.
- Campur kalimat sangat pendek dengan kalimat yang lebih panjang supaya tidak monoton.
- DILARANG memberi tanda video akan selesai: "sekian", "terima kasih sudah menonton", ajakan like, follow, atau subscribe.

ISI YANG BELUM BANYAK DIKETAHUI
- Tiap video wajib memberi minimal satu hal yang kebanyakan orang belum tahu: mekanisme di balik layar, angka yang mengejutkan, atau anggapan umum yang ternyata keliru.
- Hindari tips umum yang sudah sering didengar, seperti "kurangi jajan" atau "buat anggaran".
- Hook menjanjikan hal baru itu, dan isi video wajib membayarnya.

AKURASI (PALING PENTING)
{ACCURACY}
- Jangan menuduh orang tertentu melakukan kejahatan.
- Untuk topik investasi, jangan mengajak membeli atau menjual.

GAYA BICARA
- Bicara ke satu orang dengan "lu" dan "gue", bahasa Jakarta yang santai tapi tidak kasar. Kalimat pendek dan padat.
- DILARANG frasa klise AI: "mari kita bahas", "di era digital ini", "perlu diingat bahwa", "kesimpulannya", "menariknya".

ADEGAN (semua kind "narration", chapter "", start_time "", end_time "")
- text: 1-2 kalimat lisan, 12-22 kata. Tulis angka dengan digit persis seperti di sumber (38 klub, 2026, Rp2,5 juta), jangan dieja.
- query: 2-4 kata kunci BAHASA INGGRIS untuk video stok yang cocok, tanpa nama orang atau merek.

Juga tulis title (maks 60 karakter, tanpa emoji), summary (1-2 kalimat, tanpa hashtag), dan thumbnail_texts (2-3 pilihan teks sampul, maks 28 huruf).
Kembalikan HANYA JSON:
{"title": "...", "summary": "...", "thumbnail_texts": ["...", "..."], "scenes": [{"kind": "narration", "chapter": "", "text": "...", "query": "...", "start_time": "", "end_time": ""}]}
"""


def _word_count(project: dict) -> int:
    return sum(len(s["text"].split()) for s in project["scenes"])


SHORT_BASIS_NEWS = "Pakai SUMBER BERITA yang diberikan sebagai dasar fakta."
SHORT_BASIS_OWN = "Tidak ada sumber berita: tulis dari pengetahuan umum yang mapan dan bisa dicek."
SHORT_ACCURACY_NEWS = """- Fakta terbaru (angka, tanggal, nama, kejadian) HANYA dari SUMBER BERITA. Sebut medianya secara lisan untuk fakta penting.
- JANGAN menambah klaim atau angka spesifik yang tidak ada di sumber."""
SHORT_ACCURACY_OWN = """- Pakai hanya fakta yang mapan dan mudah dicek, misalnya cara kerja suatu sistem, aturan yang berlaku umum, atau sejarah yang terdokumentasi.
- JANGAN mengarang angka, tanggal, nama, atau kejadian terbaru. Kalau angka tidak pasti, pakai kata seperti "sekitar" atau hilangkan angkanya.
- Jangan menyebut media atau laporan tertentu sebagai sumber."""


def _short_script(topic: str, angle: str, user_text: str, seconds: int, api_key: str | None, has_sources: bool = True) -> dict:
    """Naskah yang kepanjangan diminta ulang sekali, karena batas 60 detik adalah syarat format ini."""
    from gemini_service import _call_gemini
    words = klik_render.target_words(klik_render.MAX_SECONDS)
    least = klik_render.target_words(klik_render.MIN_SECONDS)
    prompt = (SHORT_SCRIPT_PROMPT.replace("{SECONDS}", f"{klik_render.MIN_SECONDS}-{klik_render.MAX_SECONDS}").replace("{WORDS}", str(words))
              .replace("{BASIS}", SHORT_BASIS_NEWS if has_sources else SHORT_BASIS_OWN)
              .replace("{ACCURACY}", SHORT_ACCURACY_NEWS if has_sources else SHORT_ACCURACY_OWN))
    prompt = prompt.replace("total maksimal {WORDS} kata".replace("{WORDS}", str(words)), f"total {least}-{words} kata")
    note = ""
    best = None
    for attempt in range(3):
        data = _call_gemini(prompt, user_text + note, api_key=api_key, schema=longform.script_schema(4))
        if not isinstance(data, dict):
            raise ValueError("Format naskah dari AI tidak sesuai.")
        data["scenes"] = [s for s in data.get("scenes") or [] if isinstance(s, dict) and s.get("kind") != "quote"]
        project = longform.script_from_ai(data, [])
        count = _word_count(project)
        for scene in project["scenes"]:
            scene["chapter"] = ""
        if len(project["scenes"]) >= 3 and least * 0.85 <= count <= words * 1.15:
            return project
        # Simpan yang paling dekat dengan rentang, supaya tidak gagal hanya karena selisih beberapa kata
        miss = least - count if count < least else count - words
        if len(project["scenes"]) >= 3 and (best is None or miss < best[0]):
            best = (miss, project, count)
        note = f"\n\nNaskah sebelumnya {count} kata. Tulis ulang dengan total {least}-{words} kata, 6-9 adegan."
    if best and least * 0.7 <= best[2] <= words * 1.25:
        print(f"[Topik] Naskah video pendek {best[2]} kata, sedikit di luar target {least}-{words}")
        return best[1]
    raise ValueError("Panjang naskah dari AI belum pas untuk video 45-60 detik. Coba lagi.")


def generate_script(topic: str, angle: str, sources: list, minutes: int, api_key: str | None = None,
                    channel: str = "", seconds: int | None = None, video_format: str | None = None) -> dict:
    from gemini_service import _call_gemini
    minutes = minutes if minutes in longform.DURATIONS else 8
    with ThreadPoolExecutor(max_workers=MAX_SOURCES) as pool:
        texts = list(pool.map(lambda s: article_text(s["url"]), sources))
    blocks = []
    for i, (src, text) in enumerate(zip(sources, texts)):
        blocks.append(f"[{i + 1}] {src['title']} — {src['source']} ({src['date']})\n{src['url']}\n"
                      + (text or "(isi artikel tidak bisa dibaca; pakai judulnya saja, jangan mengarang isinya)"))
    if sources and not any(texts):
        print("[Topik] Tidak ada isi artikel yang terbaca, naskah hanya dari judul berita")
    if seconds:
        user_text = f"TOPIK: {topic}\n" + (f"SUDUT PANDANG: {angle}\n" if angle else "")
        user_text += ("\nSUMBER BERITA:\n\n" + "\n\n".join(blocks)) if sources else "\nSUMBER BERITA: tidak ada, topik pilihan sendiri."
        project = _short_script(topic, angle, user_text, seconds, api_key, bool(sources))
        project.update({"format": klik_render.SHORT, "seconds": seconds, "topic": longform._clean(topic, 200), "angle": longform._clean(angle, 400),
                        "sources": sources, "read_sources": sum(1 for t in texts if t), "channel": channel})
        return project
    chapters_n, per_chapter, _ = longform.SCRIPT_SHAPE[minutes]
    per_chapter += 1  # tanpa kutipan podcast: durasinya diisi narasi
    klik = video_format == klik_render.LONG
    if klik:  # adegan lebih pendek: gambar berganti lebih sering, durasi tetap
        per_chapter = min(int(per_chapter * 1.5), (longform.MAX_SCENES - 4) // chapters_n)
    narration = chapters_n * per_chapter + 4
    template = TOPIC_SCRIPT_PROMPT
    if klik:
        template = template.replace("- text: 2-3 kalimat lisan sehari-hari, 25-40 kata, enak dibacakan.",
                                    "- text: 1-2 kalimat lisan sehari-hari, 12-24 kata, enak dibacakan. Tulis angka dengan digit persis seperti di sumber (38 klub, 2026, Rp2,5 juta), jangan dieja.")
    prompt = longform.prompt_for(template, channel, {
        "MINUTES": minutes, "CHAPTERS": chapters_n, "PER_CHAPTER": per_chapter, "NARRATION": narration,
        "WORDS": narration * (16 if klik else longform.WORDS_PER_SCENE)})
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
    if klik:
        project["format"] = klik_render.LONG
    return project
