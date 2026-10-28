"""
Pelacakan performa klip yang sudah diunggah klien + laporan bulanan per klien.

Sumber link: link unggahan yang ditempel klien di halaman review (reviews.py). Angka diambil dari:
  - YouTube Data API v3 (resmi) jika YOUTUBE_API_KEY diisi — views, likes, komentar, subscriber channel
  - yt-dlp (tanpa key) — YouTube & TikTok; Instagram sering butuh login, jadi bisa gagal (ditandai di laporan)
Angka disimpan sebagai snapshot di clips/<pemilik>/_performance.json dan diperbarui saat laporan dibuka atau
saat operator menekan "Perbarui angka" (snapshot > STALE_HOURS jam). Tidak ada proses latar.
"""
import hashlib
import json
import os
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import requests

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "").strip()
STALE_HOURS = 12
TRACK_DAYS = 90            # link yang lebih tua dari ini tidak diperbarui lagi (angkanya sudah stabil)
REFRESH_LIMIT = 40         # maksimal link per sekali perbarui
MAX_SNAPSHOTS = 60
_lock = threading.Lock()

YT_ID_RE = re.compile(r"(?:youtube\.com/(?:shorts/|watch\?v=|live/)|youtu\.be/)([A-Za-z0-9_-]{11})")


def path(owner_root: str) -> str:
    return os.path.join(owner_root, "_performance.json")


def load(owner_root: str) -> dict:
    try:
        with open(path(owner_root), encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            data.setdefault("links", {})
            data.setdefault("channels", {})
            return data
    except (OSError, ValueError):
        pass
    return {"links": {}, "channels": {}}


def save(owner_root: str, data: dict):
    os.makedirs(owner_root, exist_ok=True)
    p = path(owner_root)
    with _lock:
        with open(p + ".tmp", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        os.replace(p + ".tmp", p)


def client_key(review: dict) -> str:
    """Satu klien = preset klien (jika ada) atau nama klien yang dinormalkan."""
    if review.get("preset_id"):
        return f"p_{review['preset_id']}"
    slug = re.sub(r"[^a-z0-9]+", "-", (review.get("client_name") or "").lower()).strip("-")
    return f"n_{slug or 'tanpa-nama'}"[:60]


def link_id(url: str) -> str:
    return hashlib.sha1(url.encode("utf-8")).hexdigest()[:16]


# ── Mengambil angka ──────────────────────────────────────────

def _youtube_api(video_id: str) -> dict:
    res = requests.get("https://www.googleapis.com/youtube/v3/videos", timeout=15, params={
        "part": "statistics,snippet", "id": video_id, "key": YOUTUBE_API_KEY})
    res.raise_for_status()
    items = res.json().get("items") or []
    if not items:
        raise LookupError("Video tidak ditemukan (dihapus atau privat)")
    stats, snippet = items[0].get("statistics") or {}, items[0].get("snippet") or {}
    channel_id = snippet.get("channelId")
    subscribers = None
    if channel_id:
        ch = requests.get("https://www.googleapis.com/youtube/v3/channels", timeout=15, params={
            "part": "statistics", "id": channel_id, "key": YOUTUBE_API_KEY}).json().get("items") or []
        if ch and not (ch[0].get("statistics") or {}).get("hiddenSubscriberCount"):
            subscribers = int((ch[0].get("statistics") or {}).get("subscriberCount") or 0) or None
    return {"views": int(stats.get("viewCount") or 0), "likes": int(stats["likeCount"]) if "likeCount" in stats else None,
            "comments": int(stats["commentCount"]) if "commentCount" in stats else None,
            "channel_id": channel_id, "channel": snippet.get("channelTitle"), "subscribers": subscribers,
            "title": snippet.get("title"), "published": (snippet.get("publishedAt") or "")[:10]}


def _ytdlp(url: str) -> dict:
    import yt_dlp
    from youtube_utils import YTDLP_JS_RUNTIMES
    opts = {"quiet": True, "no_warnings": True, "skip_download": True, "socket_timeout": 15,
            "js_runtimes": YTDLP_JS_RUNTIMES, "noplaylist": True}
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False) or {}
    if info.get("view_count") is None:
        raise LookupError("Jumlah views tidak tersedia")
    upload = info.get("upload_date") or ""
    return {"views": int(info.get("view_count") or 0), "likes": info.get("like_count"), "comments": info.get("comment_count"),
            "channel_id": info.get("channel_id") or info.get("uploader_id"), "channel": info.get("channel") or info.get("uploader"),
            "subscribers": info.get("channel_follower_count"), "title": info.get("title"),
            "published": f"{upload[:4]}-{upload[4:6]}-{upload[6:8]}" if len(upload) == 8 else ""}


def fetch(url: str, platform: str) -> dict:
    """Angka terbaru satu link. LookupError/Exception jika tidak bisa dibaca."""
    if platform == "youtube" and YOUTUBE_API_KEY:
        match = YT_ID_RE.search(url)
        if match:
            return _youtube_api(match.group(1))
    return _ytdlp(url)


# ── Snapshot ─────────────────────────────────────────────────

def collect_links(review_list: list) -> list:
    """Semua link unggahan dari review: [{url, platform, review_id, client_key, client_name, video_id, key, at}]."""
    out = []
    for review in review_list:
        for item_k, links in (review.get("publish") or {}).items():
            video_id, _, key = item_k.partition("|")
            for link in links:
                out.append({**link, "review_id": review["id"], "client_key": client_key(review),
                            "client_name": review.get("client_name", ""), "video_id": video_id, "key": key})
    return out


def refresh(owner_root: str, links: list, force: bool = False, on_snapshot=None) -> dict:
    """
    Perbarui angka link yang snapshot terakhirnya > STALE_HOURS jam (atau semua jika force), maksimal REFRESH_LIMIT.
    Return {"updated": n, "failed": n, "skipped": n}.
    """
    data = load(owner_root)
    now = time.time()
    due = []
    for link in links:
        record = data["links"].get(link_id(link["url"])) or {}
        last = (record.get("snapshots") or [{}])[-1].get("at", 0)
        too_old = now - link.get("at", now) > TRACK_DAYS * 86400 and record.get("snapshots")
        if not too_old and (force or now - last > STALE_HOURS * 3600):
            due.append(link)
    due = due[:REFRESH_LIMIT]

    def work(link):
        try:
            return link, fetch(link["url"], link["platform"]), None
        except Exception as e:
            return link, None, str(e)[:200]

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(work, due))

    data = load(owner_root)   # dibaca ulang: bisa saja berubah selama mengambil angka
    updated = failed = 0
    for link, stats, error in results:
        rid = link_id(link["url"])
        record = data["links"].setdefault(rid, {"url": link["url"], "platform": link["platform"], "snapshots": []})
        record.update({k: link[k] for k in ("review_id", "client_key", "client_name", "video_id", "key")})
        record["published_link_at"] = link.get("at")
        record["checked_at"] = now
        if stats is None:
            record["error"] = error
            failed += 1
            continue
        record.pop("error", None)
        record.update({k: stats.get(k) for k in ("title", "channel", "channel_id", "published") if stats.get(k)})
        snap = {"at": round(now), "views": stats["views"], "likes": stats.get("likes"), "comments": stats.get("comments")}
        record["snapshots"].append(snap)
        del record["snapshots"][:-MAX_SNAPSHOTS]
        if stats.get("channel_id") and stats.get("subscribers"):
            channel = data["channels"].setdefault(stats["channel_id"], {"name": stats.get("channel"), "snapshots": []})
            channel["name"] = stats.get("channel") or channel.get("name")
            channel["snapshots"].append({"at": round(now), "subscribers": int(stats["subscribers"])})
            del channel["snapshots"][:-MAX_SNAPSHOTS * 4]
        updated += 1
        if on_snapshot:
            on_snapshot(link, snap)
    save(owner_root, data)
    return {"updated": updated, "failed": failed, "skipped": len(links) - len(due)}


# ── Laporan ──────────────────────────────────────────────────

def period_of(epoch: float) -> str:
    return datetime.fromtimestamp(epoch, timezone.utc).strftime("%Y-%m")


def _period_bounds(period: str) -> tuple[float, float]:
    year, month = (int(x) for x in period.split("-"))
    start = datetime(year, month, 1, tzinfo=timezone.utc).timestamp()
    end = datetime(year + (month == 12), month % 12 + 1, 1, tzinfo=timezone.utc).timestamp()
    return start, end


def previous_period(period: str) -> str:
    year, month = (int(x) for x in period.split("-"))
    return f"{year - (month == 1)}-{(month - 2) % 12 + 1:02d}"


def _views_at(snapshots: list, until: float) -> int | None:
    """Views terakhir yang tercatat sebelum `until`."""
    vals = [s["views"] for s in snapshots if s["at"] <= until]
    return vals[-1] if vals else None


def _sub_change(channel: dict, start: float, end: float) -> dict | None:
    snaps = channel.get("snapshots") or []
    before = [s["subscribers"] for s in snaps if s["at"] < start]
    inside = [s["subscribers"] for s in snaps if start <= s["at"] < end]
    if not inside:
        return None
    first = before[-1] if before else inside[0]
    return {"name": channel.get("name"), "start": first, "end": inside[-1], "change": inside[-1] - first}


def build_report(review_list: list, perf: dict, key: str, period: str, clip_info) -> dict:
    """
    Laporan satu klien untuk satu bulan (UTC). clip_info(video_id, key) → {title, thumbnail_url, viral_score}.
    Views per klip = views terakhir dalam bulan itu (atau saat ini untuk bulan berjalan).
    """
    start, end = _period_bounds(period)
    now = time.time()
    until = min(end, now)
    mine = [r for r in review_list if client_key(r) == key]
    client_name = next((r.get("client_name") for r in mine if r.get("client_name")), "")

    delivered = [i for r in mine if start <= r.get("created_at", 0) < end for i in r.get("items") or []]
    decisions = [(r.get("decisions") or {}).get(f"{i['video_id']}|{i['key']}") or {}
                 for r in mine if start <= r.get("created_at", 0) < end for i in r.get("items") or []]
    records = [rec for rec in perf.get("links", {}).values() if rec.get("client_key") == key]

    clips, platforms, failed = [], {}, 0
    for rec in records:
        if rec.get("published_link_at", 0) >= end:
            continue
        views = _views_at(rec.get("snapshots") or [], until)
        if views is None:
            failed += 1 if rec.get("error") else 0
            continue
        prev = _views_at(rec.get("snapshots") or [], start)
        gained = views - (prev or 0)
        info = clip_info(rec.get("video_id"), rec.get("key")) or {}
        clips.append({"title": info.get("title") or rec.get("title") or "", "url": rec["url"], "platform": rec["platform"],
                      "thumbnail_url": info.get("thumbnail_url"), "views": views, "views_in_period": gained,
                      "likes": (rec.get("snapshots") or [{}])[-1].get("likes"), "published": rec.get("published"),
                      "viral_score": info.get("viral_score"), "new_in_period": start <= rec.get("published_link_at", 0) < end})
        p = platforms.setdefault(rec["platform"], {"clips": 0, "views": 0})
        p["clips"] += 1
        p["views"] += gained
    clips.sort(key=lambda c: c["views_in_period"], reverse=True)

    views_period = sum(c["views_in_period"] for c in clips)
    new_clips = [c for c in clips if c["new_in_period"]]

    # Bulan sebelumnya, untuk perbandingan
    p_start, p_end = _period_bounds(previous_period(period))
    prev_views = 0
    prev_new = 0
    for rec in records:
        snaps = rec.get("snapshots") or []
        v_end, v_start = _views_at(snaps, p_end), _views_at(snaps, p_start)
        if v_end is not None and rec.get("published_link_at", 0) < p_end:
            prev_views += v_end - (v_start or 0)
            prev_new += 1 if p_start <= rec.get("published_link_at", 0) < p_end else 0
    channel_ids = {rec.get("channel_id") for rec in records if rec.get("channel_id")}
    subscribers = [c for c in (_sub_change(perf.get("channels", {}).get(cid) or {}, start, end) for cid in channel_ids) if c]

    approved = sum(1 for d in decisions if d.get("status") == "approved")
    revised = sum(1 for d in decisions if d.get("status") == "revision")
    return {
        "client_name": client_name,
        "period": period,
        "is_current": start <= now < end,
        "updated_at": max((rec.get("checked_at") or 0 for rec in records), default=None) or None,
        "totals": {
            "delivered": len(delivered), "approved": approved, "revision": revised,
            "published": len(new_clips), "tracked": len(clips), "unreadable": failed,
            "views": views_period, "avg_views_new": round(sum(c["views"] for c in new_clips) / len(new_clips)) if new_clips else None,
        },
        "previous": {"period": previous_period(period), "views": prev_views, "published": prev_new},
        "views_change_pct": round((views_period - prev_views) / prev_views * 100) if prev_views else None,
        "platforms": platforms,
        "subscribers": subscribers,
        "top_clips": clips[:10],
        "periods": sorted({period_of(r["created_at"]) for r in mine if r.get("created_at")} | {period}, reverse=True),
    }
