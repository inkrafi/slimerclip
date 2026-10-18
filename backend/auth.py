"""
Identitas pengguna.

Dua mode, ditentukan oleh SUPABASE_URL di .env:
- lokal (SUPABASE_URL kosong): tanpa login, setiap request = satu admin lokal. Perilaku
  sama seperti sebelum ada akun, cocok untuk dipakai sendiri di komputer.
- supabase: frontend login Google lewat Supabase lalu mengirim access token (JWT) di header
  Authorization. Token diverifikasi di sini; admin = email yang ada di ADMIN_EMAILS.
"""
import base64
import hashlib
import os
import secrets
from dataclasses import dataclass

import jwt
from flask import g, request

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
AUTH_ENABLED = bool(SUPABASE_URL)
ADMIN_EMAILS = {e.strip().lower() for e in os.getenv("ADMIN_EMAILS", "").split(",") if e.strip()}


@dataclass(frozen=True)
class User:
    id: str
    email: str
    name: str
    avatar_url: str
    is_admin: bool

    @property
    def storage_key(self) -> str:
        """Subfolder file milik pengguna. Admin lokal memakai folder lama (tanpa subfolder)."""
        return "" if self.id == LOCAL_USER.id else f"u_{self.id}"


LOCAL_USER = User(id="local", email="", name="Admin lokal", avatar_url="", is_admin=True)


# ── Rahasia aplikasi ─────────────────────────────────────────
# Satu APP_SECRET (string acak panjang) diturunkan menjadi kunci terpisah untuk tiap
# keperluan. Mengganti APP_SECRET membuat API key tersimpan tidak bisa dibuka lagi.
_app_secret = os.getenv("APP_SECRET", "").strip()
if not _app_secret:
    if AUTH_ENABLED:
        raise RuntimeError("APP_SECRET wajib diisi di .env saat SUPABASE_URL dipakai")
    _app_secret = secrets.token_urlsafe(32)  # mode lokal: cukup berlaku selama proses berjalan


def derived_key(purpose: str) -> bytes:
    return hashlib.sha256(f"slimerclip:{purpose}:{_app_secret}".encode()).digest()


def fernet_key(purpose: str) -> bytes:
    return base64.urlsafe_b64encode(derived_key(purpose))


# ── Verifikasi token Supabase ────────────────────────────────
_jwks_client = None


def _signing_key(token: str, alg: str):
    global _jwks_client
    if alg == "HS256":
        # Proyek lama: JWT ditandatangani dengan "JWT secret" (simetris)
        secret = os.getenv("SUPABASE_JWT_SECRET", "").strip()
        if not secret:
            raise jwt.InvalidTokenError("SUPABASE_JWT_SECRET belum diisi")
        return secret
    # Proyek baru: kunci asimetris, kunci publiknya diambil dari JWKS (di-cache)
    if _jwks_client is None:
        _jwks_client = jwt.PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json", lifespan=3600)
    return _jwks_client.get_signing_key_from_jwt(token).key


def _decode(token: str) -> dict:
    alg = jwt.get_unverified_header(token).get("alg")
    if alg not in ("HS256", "ES256", "RS256"):
        raise jwt.InvalidTokenError(f"Algoritma token tidak didukung: {alg}")
    return jwt.decode(
        token,
        _signing_key(token, alg),
        algorithms=[alg],
        audience="authenticated",
        issuer=f"{SUPABASE_URL}/auth/v1",
        options={"require": ["exp", "sub"]},
        leeway=30,
    )


def _user_from_claims(claims: dict) -> User:
    meta = claims.get("user_metadata") or {}
    app_meta = claims.get("app_metadata") or {}
    email = (claims.get("email") or "").strip().lower()
    # Admin hanya untuk sesi yang masuk lewat Google: pendaftaran email/kata sandi terbuka,
    # jadi siapa pun bisa mendaftar memakai alamat email admin dengan kata sandinya sendiri.
    session_methods = {a.get("method") for a in claims.get("amr") or [] if isinstance(a, dict)}
    providers = set(app_meta.get("providers") or [app_meta.get("provider")])
    via_google = "oauth" in session_methods and "google" in providers
    return User(
        id=claims["sub"],
        email=email,
        name=meta.get("full_name") or meta.get("name") or email.split("@")[0],
        avatar_url=meta.get("avatar_url") or meta.get("picture") or "",
        is_admin=via_google and email in ADMIN_EMAILS,
    )


def current_user() -> User | None:
    """Pengguna untuk request ini, atau None jika belum login / token tidak valid."""
    if not AUTH_ENABLED:
        return LOCAL_USER
    if "user" in g:
        return g.user
    user = None
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        try:
            user = _user_from_claims(_decode(header[7:].strip()))
        except Exception as e:
            print(f"[Auth] Token ditolak: {type(e).__name__}: {e}")
    g.user = user
    return user
