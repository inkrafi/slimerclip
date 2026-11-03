"""
Pencatatan proyek jasa motion video (admin). Disimpan sebagai satu berkas JSON per admin.
Hanya mencatat pekerjaan: klien, paket, status, tenggat, tautan hasil. Produksinya di luar aplikasi.
"""
import json
import os
import re
import time
import uuid
from datetime import date

PACKAGES = ("teaser", "launch", "kit", "custom")
STATUSES = ("konsultasi", "naskah", "animasi", "revisi", "selesai", "batal")
MAX_PROJECTS = 500
ID_RE = re.compile(r"^[a-f0-9]{12}$")


class ProjectError(ValueError):
    """Isian proyek tidak valid; pesannya aman ditampilkan ke admin."""


def _text(value, limit: int) -> str:
    return re.sub(r"[ \t]+", " ", str(value or "")).strip()[:limit]


def sanitize(body: dict) -> dict:
    client = _text(body.get("client"), 80)
    if not client:
        raise ProjectError("Isi nama klien.")
    package = body.get("package")
    if package not in PACKAGES:
        raise ProjectError("Pilih paket proyek.")
    status = body.get("status")
    if status not in STATUSES:
        raise ProjectError("Pilih status proyek.")
    deadline = _text(body.get("deadline"), 10)
    if deadline:
        try:
            date.fromisoformat(deadline)
        except ValueError:
            raise ProjectError("Tenggat harus berupa tanggal yang valid.") from None
    drive_url = _text(body.get("drive_url"), 500)
    # Tautan ini dirender sebagai href, jadi hanya http/https (bukan javascript: dan sejenisnya)
    if drive_url and not re.match(r"^https?://", drive_url, re.IGNORECASE):
        raise ProjectError("Tautan hasil harus diawali https://.")
    return {
        "client": client,
        "product": _text(body.get("product"), 80),
        "package": package,
        "status": status,
        "deadline": deadline,
        "price": _text(body.get("price"), 40),
        "drive_url": drive_url,
        "notes": str(body.get("notes") or "").strip()[:2000],
    }


def load(path: str) -> list:
    try:
        with open(path, encoding="utf-8") as f:
            items = json.load(f)
        return items if isinstance(items, list) else []
    except (OSError, ValueError):
        return []


def save(path: str, items: list) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path + ".tmp", "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False)
    os.replace(path + ".tmp", path)


def create(path: str, body: dict) -> dict:
    fields = sanitize(body)
    items = load(path)
    if len(items) >= MAX_PROJECTS:
        raise ProjectError(f"Maksimal {MAX_PROJECTS} proyek. Hapus proyek lama dulu.")
    now = int(time.time())
    project = {"id": uuid.uuid4().hex[:12], **fields, "created_at": now, "updated_at": now}
    save(path, [project, *items])
    return project


def update(path: str, project_id: str, body: dict) -> dict | None:
    fields = sanitize(body)
    items = load(path)
    for i, item in enumerate(items):
        if item.get("id") == project_id:
            items[i] = {**item, **fields, "updated_at": int(time.time())}
            save(path, items)
            return items[i]
    return None


def delete(path: str, project_id: str) -> bool:
    items = load(path)
    remaining = [p for p in items if p.get("id") != project_id]
    if len(remaining) == len(items):
        return False
    save(path, remaining)
    return True
