"""
Pencatatan event produk (lihat docs/ux-discovery/04-telemetry.md): log append-only per pemilik di
cache/telemetry/<pemilik>.jsonl, tanpa pelacak pihak ketiga dan tanpa IP/cookie pengunjung.
"""
import json
import os
import threading
import time

TELEMETRY_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache", "telemetry")
_lock = threading.Lock()


def log(owner: str, event: str, **props):
    """Catat satu event; gagal menulis tidak boleh mengganggu request."""
    record = {"ts": round(time.time(), 3), "event": event, **props}
    try:
        os.makedirs(TELEMETRY_DIR, exist_ok=True)
        path = os.path.join(TELEMETRY_DIR, f"{owner or 'local'}.jsonl")
        with _lock, open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    except OSError as e:
        print(f"[Telemetry] Gagal mencatat {event}: {e}")


def read(owner: str) -> list:
    path = os.path.join(TELEMETRY_DIR, f"{owner or 'local'}.jsonl")
    try:
        with open(path, encoding="utf-8") as f:
            return [json.loads(line) for line in f if line.strip()]
    except (OSError, ValueError):
        return []
