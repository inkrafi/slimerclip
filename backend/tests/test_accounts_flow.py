import io
import time
import uuid

import cv2
import jwt
import numpy as np
import pytest

import accounts as accounts_module
import app as A


class FakeAccounts:
    """Pengganti SupabaseAccounts di memori, dengan aturan yang sama."""

    def __init__(self):
        self.profiles, self.videos, self.usage = {}, {}, []

    def profile(self, user):
        return self.profiles.setdefault(user.id, {"free_analyses_used": 0, "gemini_key_enc": None, "gemini_key_hint": None})

    def reserve_free_analysis(self, user_id):
        p = self.profiles[user_id]
        if p["free_analyses_used"] >= accounts_module.FREE_ANALYSES:
            return False
        p["free_analyses_used"] += 1
        return True

    def refund_free_analysis(self, user_id):
        p = self.profiles[user_id]
        p["free_analyses_used"] = max(0, p["free_analyses_used"] - 1)

    def set_gemini_key(self, user_id, api_key):
        p = self.profiles[user_id]
        p["gemini_key_enc"] = accounts_module.encrypt_key(api_key) if api_key else None
        p["gemini_key_hint"] = api_key[-4:] if api_key else None

    def add_video(self, user_id, video_id):
        self.videos.setdefault(user_id, {}).setdefault(video_id, time.time())

    def video_ids(self, user_id):
        return sorted(((v, str(t)) for v, t in self.videos.get(user_id, {}).items()), key=lambda x: x[1], reverse=True)

    def owns_video(self, user_id, video_id):
        return video_id in self.videos.get(user_id, {})

    def remove_video(self, user_id, video_id):
        self.videos.get(user_id, {}).pop(video_id, None)

    def record_usage(self, user_id, kind, server_key=False, count=1):
        self.usage += [(user_id, kind, server_key)] * count

    def usage_today(self, kind, user_id=None, server_key=None):
        return sum(1 for u, k, s in self.usage
                   if k == kind and (user_id is None or u == user_id) and (server_key is None or s == server_key))

    def delete_user(self, user_id):
        self.profiles.pop(user_id, None)


VIDEO_ID = "abcdefghijk"
URL = f"https://www.youtube.com/watch?v={VIDEO_ID}"


def fake_result(duration=10):
    return {
        "segments": [{"segment_number": 1, "start_time": "00:01", "end_time": "00:05", "viral_score": 80}],
        "video_metadata": {"title": "Tes", "duration": duration},
    }


@pytest.fixture
def env(tmp_path, monkeypatch):
    fake = FakeAccounts()
    monkeypatch.setattr(A, "accounts", fake)
    monkeypatch.setattr(A, "CLIPS_ROOT", str(tmp_path / "clips"))
    monkeypatch.setattr(A, "TEMPLATES_ROOT", str(tmp_path / "templates"))
    monkeypatch.setattr(A, "UPLOADS_DIR", str(tmp_path / "uploads"))
    monkeypatch.setattr(A, "ANALYSIS_CACHE_FILE", str(tmp_path / "analysis_cache.json"))
    calls = []

    def fake_analyze(url, api_key=None, media_path=None, allow_download=False):
        calls.append({"url": url, "api_key": api_key, "media_path": media_path, "allow_download": allow_download})
        return fake_result()

    monkeypatch.setattr(A, "analyze_youtube_video", fake_analyze)
    monkeypatch.setattr(A, "validate_api_key", lambda key: None if key.startswith("AIza") else "ditolak")
    monkeypatch.setattr(A, "_run_render_job", lambda *args: None)
    monkeypatch.setattr(A, "jobs", A.JobManager())
    return {"client": A.app.test_client(), "accounts": fake, "calls": calls, "tmp": tmp_path}


def token(email="user@example.com", sub=None, secret="test-jwt-secret-yang-cukup-panjang-untuk-hs256", method="oauth"):
    claims = {
        "sub": sub or str(uuid.uuid5(uuid.NAMESPACE_DNS, email)),
        "email": email,
        "aud": "authenticated",
        "iss": "https://test-project.supabase.co/auth/v1",
        "exp": int(time.time()) + 3600,
        "user_metadata": {"full_name": email.split("@")[0], "email_verified": True},
        "app_metadata": {"provider": "google" if method == "oauth" else "email",
                         "providers": ["google"] if method == "oauth" else ["email"]},
        "amr": [{"method": method, "timestamp": int(time.time())}],
    }
    return {"Authorization": f"Bearer {jwt.encode(claims, secret, algorithm='HS256')}"}


def make_video(path, seconds):
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), 10, (64, 64))
    for _ in range(int(seconds * 10)):
        writer.write(np.zeros((64, 64, 3), dtype=np.uint8))
    writer.release()
    return path


def upload(client, headers, path, video_id=VIDEO_ID):
    with open(path, "rb") as f:
        return client.post("/upload-video", headers=headers,
                           data={"video": (f, path.name), "video_id": video_id}, content_type="multipart/form-data")


# ── Login ────────────────────────────────────────────────────

def test_requires_login(env):
    c = env["client"]
    assert c.get("/").status_code == 200
    res = c.get("/me")
    assert res.status_code == 401 and res.json["code"] == "auth_required"
    assert c.get("/me", headers=token(secret="kunci-palsu-yang-salah-dan-cukup-panjang")).status_code == 401


def test_roles(env):
    c = env["client"]
    user = c.get("/me", headers=token()).json
    assert user["is_admin"] is False and user["free_analyses_left"] == 3 and user["render_daily_limit"] == 3
    admin = c.get("/me", headers=token("admin@example.com")).json
    assert admin["is_admin"] is True and admin["free_analyses_left"] is None
    # Daftar dengan email admin + kata sandi tidak menjadikan admin
    assert c.get("/me", headers=token("admin@example.com", method="password")).json["is_admin"] is False


def test_cache_endpoints_admin_only(env):
    c = env["client"]
    assert c.get("/cache", headers=token()).status_code == 403
    assert c.get("/cache", headers=token("admin@example.com")).status_code == 200


# ── Kuota analisis ───────────────────────────────────────────

def test_free_quota_then_exhausted(env):
    c, h = env["client"], token()
    for i in range(3):
        res = c.post("/analyze", headers=h, json={"youtube_url": f"https://youtu.be/vid{i:08d}"})
        assert res.status_code == 200, res.json
    assert c.get("/me", headers=h).json["free_analyses_left"] == 0
    res = c.post("/analyze", headers=h, json={"youtube_url": "https://youtu.be/vid99999999"})
    assert res.status_code == 402 and res.json["code"] == "quota_exhausted"
    assert all(call["api_key"] is None and call["allow_download"] is False for call in env["calls"])


def test_cached_video_is_free_and_joins_library(env):
    c = env["client"]
    assert c.post("/analyze", headers=token("a@example.com"), json={"youtube_url": URL}).status_code == 200
    h = token("b@example.com")
    assert c.get(f"/videos/{VIDEO_ID}", headers=h).json["analysis"] is None  # belum di pustaka B
    res = c.post("/analyze", headers=h, json={"youtube_url": URL})
    assert res.status_code == 200 and res.json["from_cache"] is True
    assert c.get("/me", headers=h).json["free_analyses_left"] == 3
    assert [v["video_id"] for v in c.get("/videos", headers=h).json["items"]] == [VIDEO_ID]
    assert c.get("/videos", headers=token("c@example.com")).json["items"] == []
    assert len(env["calls"]) == 1


def test_failed_analysis_refunds(env, monkeypatch):
    c, h = env["client"], token()
    monkeypatch.setattr(A, "analyze_youtube_video", lambda *a, **k: {"error": "gagal", "code": "transcript_unavailable"})
    res = c.post("/analyze", headers=h, json={"youtube_url": URL})
    assert res.status_code == 422 and res.json["code"] == "transcript_unavailable"
    assert c.get("/me", headers=h).json["free_analyses_left"] == 3


def test_own_key_skips_quota(env):
    c, h = env["client"], token()
    assert c.put("/me/gemini-key", headers=h, json={"api_key": "bukan key"}).status_code == 400
    assert c.put("/me/gemini-key", headers=h, json={"api_key": "XYZ" + "a" * 30}).status_code == 400
    me = c.put("/me/gemini-key", headers=h, json={"api_key": "AIza" + "b" * 35}).json
    assert me["has_gemini_key"] is True and me["gemini_key_hint"] == "bbbb"
    assert "AIza" not in str(me)
    assert c.post("/analyze", headers=h, json={"youtube_url": URL}).status_code == 200
    assert env["calls"][-1]["api_key"] == "AIza" + "b" * 35
    assert c.get("/me", headers=h).json["free_analyses_left"] == 3
    assert c.delete("/me/gemini-key", headers=h).json["has_gemini_key"] is False


def test_server_daily_cap(env, monkeypatch):
    monkeypatch.setattr(A, "SERVER_KEY_DAILY_CAP", 1)
    c = env["client"]
    assert c.post("/analyze", headers=token("a@example.com"), json={"youtube_url": URL}).status_code == 200
    res = c.post("/analyze", headers=token("b@example.com"), json={"youtube_url": "https://youtu.be/zzzzzzzzzzz"})
    assert res.status_code == 503 and res.json["code"] == "server_quota"


def test_admin_unlimited_and_may_download(env):
    c, h = env["client"], token("admin@example.com")
    for i in range(5):
        assert c.post("/analyze", headers=h, json={"youtube_url": f"https://youtu.be/adm{i:08d}"}).status_code == 200
    assert env["calls"][-1]["allow_download"] is True


# ── Upload & render ──────────────────────────────────────────

def test_upload_rules_and_isolation(env, monkeypatch):
    c, h = env["client"], token()
    tmp = env["tmp"]
    c.post("/analyze", headers=h, json={"youtube_url": URL})  # durasi video YouTube = 10 detik

    res = upload(c, h, make_video(tmp / "beda.mp4", 30))
    assert res.status_code == 400 and res.json["code"] == "duration_mismatch"

    monkeypatch.setattr(A, "USER_UPLOAD_MAX_MINUTES", 0)
    res = upload(c, h, make_video(tmp / "panjang.mp4", 10))
    assert res.status_code == 400 and res.json["code"] == "file_too_long"
    monkeypatch.setattr(A, "USER_UPLOAD_MAX_MINUTES", 90)

    res = upload(c, h, make_video(tmp / "pas.mp4", 10))
    assert res.status_code == 200, res.json
    ref = res.json["local_video_path"]

    # Pengguna lain tidak bisa memakai file upload ini
    other = token("lain@example.com")
    res = c.post("/generate", headers=other, json={
        "local_video_path": ref, "video_id": VIDEO_ID,
        "segments": [{"segment_number": 1, "start_time": "00:01", "end_time": "00:05"}]})
    assert res.status_code == 400
    assert c.get(f"/videos/{VIDEO_ID}", headers=other).json["upload"] is None


def test_render_requires_upload_for_users(env):
    c = env["client"]
    body = {"youtube_url": URL, "segments": [{"segment_number": 1, "start_time": "00:01", "end_time": "00:05"}]}
    res = c.post("/generate", headers=token(), json=body)
    assert res.status_code == 403 and res.json["code"] == "upload_required"
    assert c.post("/generate", headers=token("admin@example.com"), json=body).status_code == 202


def test_preview_daily_quota(env, monkeypatch):
    monkeypatch.setattr(A, "PREVIEW_DAILY_LIMIT", 3)
    c, h = env["client"], token()
    ref = upload(c, h, make_video(env["tmp"] / "v.mp4", 10)).json["local_video_path"]
    segs = [{"segment_number": i, "start_time": f"00:0{i}", "end_time": f"00:0{i + 1}"} for i in range(1, 5)]
    res = c.post("/generate", headers=h, json={"local_video_path": ref, "video_id": VIDEO_ID, "segments": segs})
    assert res.status_code == 429 and res.json["code"] == "preview_quota"
    res = c.post("/generate", headers=h, json={"local_video_path": ref, "video_id": VIDEO_ID, "segments": segs[:3]})
    assert res.status_code == 202 and res.json["job"]["mode"] == "preview"
    # 3 momen masih antre → jatah hari ini habis
    res = c.post("/generate", headers=h, json={"local_video_path": ref, "video_id": VIDEO_ID, "segments": segs[3:]})
    assert res.status_code == 429
    # Job hanya terlihat oleh pemiliknya
    assert len(c.get("/jobs", headers=h).json["jobs"]) == 1
    assert c.get("/jobs", headers=token("lain@example.com")).json["jobs"] == []


def test_clip_urls_are_signed_per_owner(env):
    c, h = env["client"], token()
    sub =str(uuid.uuid5(uuid.NAMESPACE_DNS, "user@example.com"))
    folder = env["tmp"] / "clips" / f"u_{sub}" / VIDEO_ID
    folder.mkdir(parents=True)
    make_video(folder / "klip.mp4", 2)

    clips = c.get(f"/videos/{VIDEO_ID}/clips", headers=h).json["clips"]
    assert len(clips) == 1
    url = clips[0]["url"].split("localhost", 1)[1]
    assert c.get(url).status_code == 200                       # tanpa header login, cukup token di URL
    assert c.get(url.split("&t=")[0]).status_code == 404      # tanpa token
    assert c.get(url.replace("klip.mp4", "lain.mp4")).status_code == 404
    assert c.get(f"/videos/{VIDEO_ID}/clips", headers=token("lain@example.com")).json["clips"] == []


# ── Editor klip (admin) ──────────────────────────────────────

def _preview_clip(env, email, key_start="00:01", key_end="00:05"):
    """Klip pratinjau (manifest + file) milik pengguna, seperti hasil /generate."""
    folder = env["tmp"] / "clips" / f"u_{uuid.uuid5(uuid.NAMESPACE_DNS, email)}" / VIDEO_ID
    folder.mkdir(parents=True, exist_ok=True)
    name = f"{VIDEO_ID}_1-5.preview.mp4"
    make_video(folder / name, 1)
    A._record_clip(str(folder), {"start_time": key_start, "end_time": key_end, "topic": "T", "segment_number": 1},
                   str(folder / name), {"resolution": "720", "caption_enabled": True, "range": [1.0, 5.0], "mode": "preview"})
    return folder


def test_editor_for_users_needs_upload_and_quota(env, monkeypatch):
    c = env["client"]
    monkeypatch.setattr(A.clip_effects, "ASSETS_ROOT", str(env["tmp"] / "assets"))
    user = token()
    assert c.get("/assets", headers=user).status_code == 200
    _preview_clip(env, "user@example.com")

    clips = c.get(f"/videos/{VIDEO_ID}/clips", headers=user).json["clips"]
    # Pratinjau belum bisa diunduh: hanya preview_url
    assert clips[0]["status"] == "preview" and clips[0]["url"] is None and clips[0]["preview_url"]

    data = c.get(f"/videos/{VIDEO_ID}/editor?key=00:01-00:05", headers=user).json
    assert data["clean_preview"] is True and data["final_left"] == 3 and data["source_ready"] is False
    assert any(s["name"] == "lib_pop.wav" for s in data["sfx_library"])
    # Pengguna biasa tidak bisa render final dari YouTube, harus upload
    res = c.post(f"/videos/{VIDEO_ID}/editor", headers=user, json={"key": "00:01-00:05"})
    assert res.status_code == 400 and res.json["code"] == "no_source"

    upload(c, user, make_video(env["tmp"] / "v.mp4", 10))
    res = c.post(f"/videos/{VIDEO_ID}/editor", headers=user, json={"key": "00:01-00:05"})
    assert res.status_code == 202 and res.json["job"]["mode"] == "final"
    # Sedang dirender → ditolak; jatah final ikut menghitung yang masih antre
    assert c.post(f"/videos/{VIDEO_ID}/editor", headers=user, json={"key": "00:01-00:05"}).status_code == 409
    monkeypatch.setattr(A, "RENDER_DAILY_LIMIT", 1)
    _preview_clip(env, "user@example.com", "00:06", "00:09")
    res = c.post(f"/videos/{VIDEO_ID}/editor", headers=user, json={"key": "00:06-00:09"})
    assert res.status_code == 429 and res.json["code"] == "render_quota"


def test_sfx_library_is_public(env):
    c = env["client"]
    assert c.get("/sfx/lib_pop.wav").status_code == 200
    assert c.get("/sfx/manifest.json").status_code == 404  # hanya file pustaka


def test_editor_flow(env, monkeypatch):
    c = env["client"]
    monkeypatch.setattr(A.clip_effects, "ASSETS_ROOT", str(env["tmp"] / "assets"))
    admin = token("admin@example.com")
    assert c.post("/analyze", headers=admin, json={"youtube_url": URL}).status_code == 200

    # Klip hasil render (manifest + file) milik admin
    folder = env["tmp"] / "clips" / f"u_{uuid.uuid5(uuid.NAMESPACE_DNS, 'admin@example.com')}" / VIDEO_ID
    folder.mkdir(parents=True)
    make_video(folder / "clip.mp4", 1)
    A._record_clip(str(folder), {"start_time": "00:01", "end_time": "00:05", "topic": "T", "segment_number": 1},
                   str(folder / "clip.mp4"), {"resolution": "720", "caption_enabled": True, "range": [1.0, 5.0]})

    assert c.get(f"/videos/{VIDEO_ID}/editor?key=99:00-99:05", headers=admin).status_code == 404
    data = c.get(f"/videos/{VIDEO_ID}/editor?key=00:01-00:05", headers=admin).json
    assert data["edit"]["start"] == 1.0 and data["options"]["resolution"] == "720" and data["transcript"] is None

    # Upload logo: gambar asli diterima, file palsu ditolak
    ok, png = cv2.imencode(".png", np.full((20, 40, 3), 255, dtype=np.uint8))
    res = c.post("/assets", headers=admin, content_type="multipart/form-data",
                 data={"file": (io.BytesIO(png.tobytes()), "logo saya.png")})
    assert res.status_code == 201 and res.json["asset"]["kind"] == "image"
    logo = res.json["asset"]["name"]
    bad = c.post("/assets", headers=admin, content_type="multipart/form-data",
                 data={"file": (io.BytesIO(b"bukan gambar"), "x.png")})
    assert bad.status_code == 400

    res = c.post(f"/videos/{VIDEO_ID}/editor", headers=admin, json={
        "key": "00:01-00:05",
        "edit": {"start": 0.5, "end": 6, "vignette": {"shape": "bottom", "strength": 40},
                 "marks": {"logo": {"enabled": True, "asset": logo}}},
        "options": {"resolution": "720"},
    })
    assert res.status_code == 202
    job = res.json["job"]
    assert list(job["segments"].values())[0]["key"] == "00:01-00:05"


def test_edit_templates(env):
    c = env["client"]
    user = token("tpl@example.com")
    other = token("other@example.com")
    assert c.get("/edit-templates", headers=user).json["templates"] == []
    assert c.post("/edit-templates", headers=user, json={"name": "  "}).status_code == 400

    res = c.post("/edit-templates", headers=user, json={
        "name": "Gaya channel", "source_auto": True,
        "edit": {"start": 3, "hook": {"enabled": True, "text": "rahasia", "style": "poster"}, "vignette": {"strength": 30}},
        "options": {"resolution": "2160", "caption_style": {"preset": "nonexistent"}},
    })
    assert res.status_code == 201
    tpl = res.json["template"]
    assert tpl["options"]["resolution"] == "2160" and tpl["source_auto"] is True
    assert tpl["edit"]["hook"]["text"] == "" and tpl["edit"]["hook"]["style"] == "poster" and "start" not in tpl["edit"]

    # Nama sama (beda huruf besar) menimpa, bukan menambah
    again = c.post("/edit-templates", headers=user, json={"name": "gaya CHANNEL", "edit": {}, "options": {}}).json["template"]
    assert again["id"] == tpl["id"]
    assert len(c.get("/edit-templates", headers=user).json["templates"]) == 1
    # Milik masing-masing pengguna
    assert c.get("/edit-templates", headers=other).json["templates"] == []
    assert c.delete(f"/edit-templates/{tpl['id']}", headers=other).status_code == 200
    assert len(c.get("/edit-templates", headers=user).json["templates"]) == 1

    assert c.delete("/edit-templates/../x", headers=user).status_code in (400, 404)
    assert c.delete(f"/edit-templates/{tpl['id']}", headers=user).status_code == 200
    assert c.get("/edit-templates", headers=user).json["templates"] == []


def test_clip_title_and_download_name(env):
    c = env["client"]
    admin = token("admin@example.com")
    folder = env["tmp"] / "clips" / f"u_{uuid.uuid5(uuid.NAMESPACE_DNS, 'admin@example.com')}" / VIDEO_ID
    folder.mkdir(parents=True)
    make_video(folder / f"{VIDEO_ID}_1-5.mp4", 1)
    A._record_clip(str(folder), {"start_time": "00:01", "end_time": "00:05", "segment_number": 1,
                                 "topic": "Hesti bercerita soal bisnis bareng suami — dan konfliknya."},
                   str(folder / f"{VIDEO_ID}_1-5.mp4"), {"resolution": "1080", "range": [1.0, 5.0]})

    clip = c.get(f"/videos/{VIDEO_ID}/editor?key=00:01-00:05", headers=admin).json["clip"]
    assert clip["title"] == "Hesti bercerita soal bisnis bareng suami"  # analisis lama: topik dipendekkan

    res = c.post(f"/videos/{VIDEO_ID}/clip-title", headers=admin,
                 json={"key": "00:01-00:05", "title": "Cerita Hesti: bisnis bareng suami?"})
    assert res.status_code == 200 and res.json["title"] == "Cerita Hesti: bisnis bareng suami?"

    url = c.get(f"/videos/{VIDEO_ID}/editor?key=00:01-00:05", headers=admin).json["clip"]["url"]
    path = url.split("://", 1)[1].split("/", 1)[1]
    disposition = c.get("/" + path + "&download=1").headers["Content-Disposition"]
    assert "Cerita%20Hesti%20bisnis%20bareng%20suami.mp4" in disposition or "Cerita Hesti bisnis bareng suami.mp4" in disposition

    # Render final dari editor (tanpa short_title) tidak menghapus judul
    A._record_clip(str(folder), {"start_time": "00:01", "end_time": "00:05", "topic": "x"},
                   str(folder / f"{VIDEO_ID}_1-5.mp4"), {"resolution": "1080", "range": [1.0, 5.0]})
    assert c.get(f"/videos/{VIDEO_ID}/editor?key=00:01-00:05", headers=admin).json["clip"]["title"].startswith("Cerita Hesti")
