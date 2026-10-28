"""
Link review per klien (tanpa login): operator mengirim satu link berisi klip final; klien memutar, menyetujui atau
minta revisi per klip, mengunduh, menyalin paket upload, dan menempelkan link setelah klip diunggah.

Data review disimpan per pemilik di clips/<pemilik>/_reviews/<id>.json. Link = token bertanda tangan
[pemilik, id] yang berlaku REVIEW_DAYS hari; menghapus review mencabut link-nya.
"""
import json
import os
import re
import threading
import time
import uuid
from urllib.parse import urlparse

REVIEW_DAYS = 90
MAX_ITEMS = 60
REVIEW_ID_RE = re.compile(r"^[a-f0-9]{16}$")
DECISIONS = ("pending", "approved", "revision")
REVISION_REASONS = ("momen", "kutipan", "gaya", "musik", "lainnya")
PUBLISH_HOSTS = {
    "youtube.com": "youtube", "youtu.be": "youtube", "m.youtube.com": "youtube",
    "tiktok.com": "tiktok", "vm.tiktok.com": "tiktok", "vt.tiktok.com": "tiktok",
    "instagram.com": "instagram",
}
MAX_PUBLISH_LINKS = 3
NOTE_MAX = 500

_lock = threading.Lock()


def folder(owner_root: str) -> str:
    return os.path.join(owner_root, "_reviews")


def new_id() -> str:
    return uuid.uuid4().hex[:16]


def item_key(video_id: str, key: str) -> str:
    return f"{video_id}|{key}"


def load(owner_root: str, review_id: str) -> dict | None:
    if not REVIEW_ID_RE.match(review_id or ""):
        return None
    try:
        with open(os.path.join(folder(owner_root), f"{review_id}.json"), encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else None
    except (OSError, ValueError):
        return None


def save(owner_root: str, review: dict):
    path = os.path.join(folder(owner_root), f"{review['id']}.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with _lock:
        with open(path + ".tmp", "w", encoding="utf-8") as f:
            json.dump(review, f, ensure_ascii=False, indent=2)
        os.replace(path + ".tmp", path)


def list_all(owner_root: str) -> list:
    base = folder(owner_root)
    out = []
    for name in os.listdir(base) if os.path.isdir(base) else []:
        review = load(owner_root, name.removesuffix(".json")) if name.endswith(".json") else None
        if review:
            out.append(review)
    return sorted(out, key=lambda r: r.get("created_at", 0), reverse=True)


def delete(owner_root: str, review_id: str) -> bool:
    if not REVIEW_ID_RE.match(review_id or ""):
        return False
    path = os.path.join(folder(owner_root), f"{review_id}.json")
    if os.path.isfile(path):
        os.remove(path)
        return True
    return False


def clean_text(value, limit: int) -> str:
    text = re.sub(r"[\x00-\x08\x0b-\x1f<>]", " ", str(value or ""))
    return re.sub(r"[ \t]+", " ", text).strip()[:limit]


def create(client_name: str, title: str, note: str, items: list, preset_id: str = "") -> dict:
    now = time.time()
    return {
        "id": new_id(),
        "client_name": clean_text(client_name, 60),
        "title": clean_text(title, 100),
        "note": clean_text(note, NOTE_MAX),
        "preset_id": preset_id if re.match(r"^[a-f0-9]{12}$", preset_id or "") else "",
        "items": items,
        "decisions": {},
        "publish": {},
        "created_at": now,
        "expires_at": now + REVIEW_DAYS * 86400,
        "opened": [],
    }


def expired(review: dict) -> bool:
    return time.time() > review.get("expires_at", 0)


def summary(review: dict) -> dict:
    counts = {"total": len(review.get("items") or []), "approved": 0, "revision": 0, "published": 0}
    for item in review.get("items") or []:
        k = item_key(item["video_id"], item["key"])
        status = (review.get("decisions", {}).get(k) or {}).get("status")
        if status in ("approved", "revision"):
            counts[status] += 1
        if review.get("publish", {}).get(k):
            counts["published"] += 1
    counts["pending"] = counts["total"] - counts["approved"] - counts["revision"]
    counts["opened"] = len(review.get("opened") or [])
    counts["last_opened"] = (review.get("opened") or [None])[-1]
    return counts


def decide(review: dict, video_id: str, key: str, status, reason, note) -> dict:
    """Simpan keputusan klien untuk satu klip. ValueError jika tidak valid."""
    k = item_key(video_id, key)
    if not any(item_key(i["video_id"], i["key"]) == k for i in review.get("items") or []):
        raise ValueError("Klip tidak ada di link ini.")
    if status not in DECISIONS:
        raise ValueError("Keputusan tidak valid.")
    decision = {"status": status, "at": time.time()}
    if status == "revision":
        decision["reason"] = reason if reason in REVISION_REASONS else "lainnya"
        decision["note"] = clean_text(note, NOTE_MAX)
    history = review.setdefault("history", [])
    history.append({"item": k, **decision})
    del history[:-200]
    review.setdefault("decisions", {})[k] = decision
    return decision


def publish_platform(url: str) -> str | None:
    """Platform dari link unggahan (YouTube/TikTok/Instagram, https saja); None jika bukan link yang dikenal."""
    try:
        parsed = urlparse(str(url or "").strip())
    except ValueError:
        return None
    host = (parsed.hostname or "").lower().removeprefix("www.")
    if parsed.scheme != "https" or len(url) > 300:
        return None
    return PUBLISH_HOSTS.get(host)


def add_publish(review: dict, video_id: str, key: str, url: str) -> list:
    k = item_key(video_id, key)
    if not any(item_key(i["video_id"], i["key"]) == k for i in review.get("items") or []):
        raise ValueError("Klip tidak ada di link ini.")
    platform = publish_platform(url)
    if not platform:
        raise ValueError("Tempel link YouTube Shorts, TikTok, atau Instagram Reels (diawali https://).")
    links = review.setdefault("publish", {}).setdefault(k, [])
    links[:] = [l for l in links if l["platform"] != platform]   # satu link per platform
    links.append({"url": url.strip(), "platform": platform, "at": time.time()})
    del links[:-MAX_PUBLISH_LINKS]
    return links
