"""
Data akun: profil, kuota analisis gratis, API key Gemini pengguna, pustaka video, dan pemakaian.

Mode supabase: disimpan di Postgres Supabase lewat REST API (PostgREST) memakai secret key
server. Tabel & fungsinya ada di supabase/migrations/. RLS aktif tanpa policy, jadi tabel
hanya bisa diakses backend ini, bukan langsung dari browser.

Mode lokal: tidak ada database; admin lokal tanpa kuota, pustaka = semua video di cache.
"""
import os
from datetime import datetime, timezone

import requests
from cryptography.fernet import Fernet, InvalidToken

from auth import AUTH_ENABLED, SUPABASE_URL, User, fernet_key

FREE_ANALYSES = int(os.getenv("FREE_ANALYSES", "3"))
RENDER_DAILY_LIMIT = int(os.getenv("RENDER_DAILY_LIMIT", "3"))
# Batas harian analisis yang memakai API key milik server (semua pengguna gratis digabung),
# pengaman jika ada yang membuat banyak akun Google untuk menghabiskan kuota.
SERVER_KEY_DAILY_CAP = int(os.getenv("SERVER_KEY_DAILY_CAP", "40"))

_fernet = Fernet(fernet_key("gemini-key"))


class AccountsError(Exception):
    """Database akun tidak bisa dihubungi atau membalas error."""


def encrypt_key(api_key: str) -> str:
    return _fernet.encrypt(api_key.encode()).decode()


def decrypt_key(token: str | None) -> str | None:
    if not token:
        return None
    try:
        return _fernet.decrypt(token.encode()).decode()
    except InvalidToken:
        print("[Accounts] API key tersimpan tidak bisa didekripsi (APP_SECRET berubah?)")
        return None


def _today_start_iso() -> str:
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()


class SupabaseAccounts:
    def __init__(self, url: str, secret_key: str):
        self.rest = f"{url}/rest/v1"
        self.auth_admin = f"{url}/auth/v1/admin"
        self.headers = {"apikey": secret_key, "Content-Type": "application/json"}
        # Kunci lama (service_role) berupa JWT dan juga dikirim sebagai Bearer;
        # secret key baru (sb_secret_...) cukup di header apikey.
        if secret_key.startswith("eyJ"):
            self.headers["Authorization"] = f"Bearer {secret_key}"

    def _req(self, method: str, url: str, *, prefer: str | None = None, **kwargs) -> requests.Response:
        headers = dict(self.headers)
        if prefer:
            headers["Prefer"] = prefer
        try:
            res = requests.request(method, url, headers=headers, timeout=10, **kwargs)
        except requests.RequestException as e:
            raise AccountsError(f"Database akun tidak bisa dihubungi: {e}") from e
        if res.status_code >= 400:
            raise AccountsError(f"Database akun membalas {res.status_code}: {res.text[:300]}")
        return res

    def _rpc(self, fn: str, **params):
        return self._req("POST", f"{self.rest}/rpc/{fn}", json=params).json()

    # ── Profil ──
    def profile(self, user: User) -> dict:
        """Profil pengguna (dibuat otomatis saat pertama kali dipakai)."""
        self._req("POST", f"{self.rest}/profiles?on_conflict=id",
                  prefer="resolution=ignore-duplicates,return=minimal",
                  json={"id": user.id, "email": user.email})
        rows = self._req("GET", f"{self.rest}/profiles",
                         params={"id": f"eq.{user.id}",
                                 "select": "free_analyses_used,gemini_key_enc,gemini_key_hint"}).json()
        return rows[0] if rows else {"free_analyses_used": 0, "gemini_key_enc": None, "gemini_key_hint": None}

    def reserve_free_analysis(self, user_id: str) -> bool:
        """Ambil satu jatah analisis gratis secara atomik. False jika jatah habis."""
        return bool(self._rpc("reserve_free_analysis", p_user=user_id, p_limit=FREE_ANALYSES))

    def refund_free_analysis(self, user_id: str):
        self._rpc("refund_free_analysis", p_user=user_id)

    def set_gemini_key(self, user_id: str, api_key: str | None):
        hint = api_key[-4:] if api_key else None
        self._req("PATCH", f"{self.rest}/profiles", params={"id": f"eq.{user_id}"}, prefer="return=minimal",
                  json={"gemini_key_enc": encrypt_key(api_key) if api_key else None, "gemini_key_hint": hint})

    # ── Pustaka video ──
    def add_video(self, user_id: str, video_id: str):
        self._req("POST", f"{self.rest}/user_videos?on_conflict=user_id,video_id",
                  prefer="resolution=ignore-duplicates,return=minimal",
                  json={"user_id": user_id, "video_id": video_id})

    def video_ids(self, user_id: str) -> list[tuple[str, str]]:
        """[(video_id, ditambahkan_pada)] terbaru dulu."""
        rows = self._req("GET", f"{self.rest}/user_videos",
                         params={"user_id": f"eq.{user_id}", "select": "video_id,created_at",
                                 "order": "created_at.desc"}).json()
        return [(r["video_id"], r["created_at"]) for r in rows]

    def owns_video(self, user_id: str, video_id: str) -> bool:
        rows = self._req("GET", f"{self.rest}/user_videos",
                         params={"user_id": f"eq.{user_id}", "video_id": f"eq.{video_id}", "select": "video_id"}).json()
        return bool(rows)

    def remove_video(self, user_id: str, video_id: str):
        self._req("DELETE", f"{self.rest}/user_videos",
                  params={"user_id": f"eq.{user_id}", "video_id": f"eq.{video_id}"}, prefer="return=minimal")

    # ── Pemakaian ──
    def record_usage(self, user_id: str, kind: str, server_key: bool = False, count: int = 1):
        if count > 0:
            self._req("POST", f"{self.rest}/usage_events", prefer="return=minimal",
                      json=[{"user_id": user_id, "kind": kind, "server_key": server_key}] * count)

    def usage_today(self, kind: str, user_id: str | None = None, server_key: bool | None = None) -> int:
        params = {"kind": f"eq.{kind}", "created_at": f"gte.{_today_start_iso()}", "select": "id", "limit": "1"}
        if user_id:
            params["user_id"] = f"eq.{user_id}"
        if server_key is not None:
            params["server_key"] = f"eq.{str(server_key).lower()}"
        res = self._req("GET", f"{self.rest}/usage_events", params=params, prefer="count=exact")
        # Content-Range: "0-0/17" atau "*/0"
        return int(res.headers.get("Content-Range", "*/0").rsplit("/", 1)[-1] or 0)

    # ── Hapus akun ──
    def delete_user(self, user_id: str):
        """Hapus pengguna dari Supabase Auth; profil & data lain ikut terhapus (on delete cascade)."""
        self._req("DELETE", f"{self.auth_admin}/users/{user_id}")


class LocalAccounts:
    """Mode lokal: satu admin tanpa kuota dan tanpa database."""

    def profile(self, user: User) -> dict:
        return {"free_analyses_used": 0, "gemini_key_enc": None, "gemini_key_hint": None}

    def reserve_free_analysis(self, user_id): return True
    def refund_free_analysis(self, user_id): pass
    def set_gemini_key(self, user_id, api_key): raise AccountsError("API key pengguna hanya tersedia saat login aktif.")
    def add_video(self, user_id, video_id): pass
    def video_ids(self, user_id): return None  # None = semua video di cache
    def owns_video(self, user_id, video_id): return True
    def remove_video(self, user_id, video_id): pass
    def record_usage(self, user_id, kind, server_key=False, count=1): pass
    def usage_today(self, kind, user_id=None, server_key=None): return 0
    def delete_user(self, user_id): raise AccountsError("Tidak ada akun di mode lokal.")


def _make_accounts():
    if not AUTH_ENABLED:
        return LocalAccounts()
    secret = os.getenv("SUPABASE_SECRET_KEY", "").strip()
    if not secret:
        raise RuntimeError("SUPABASE_SECRET_KEY wajib diisi di .env saat SUPABASE_URL dipakai")
    return SupabaseAccounts(SUPABASE_URL, secret)


accounts = _make_accounts()
