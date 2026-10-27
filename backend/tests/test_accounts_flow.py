import io
import json
import os
import time
import uuid
import zipfile

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

    def niche(self, user_id):
        return self.profiles.get(user_id, {}).get("niche")

    def set_niche(self, user_id, niche):
        self.profiles[user_id]["niche"] = niche

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


def test_render_all_with_template_and_zip(env, monkeypatch):
    c = env["client"]
    monkeypatch.setattr(A.clip_effects, "ASSETS_ROOT", str(env["tmp"] / "assets"))
    started = []
    monkeypatch.setattr(A, "_run_render_job", lambda *args: started.append(args))
    admin = token("admin@example.com")
    assert c.post("/analyze", headers=admin, json={"youtube_url": URL}).status_code == 200
    folder = _preview_clip(env, "admin@example.com")
    _preview_clip(env, "admin@example.com", "00:06", "00:09")
    # Klip kedua sudah punya teks hook sendiri: teksnya dipertahankan, gayanya dari format
    manifest = A._load_manifest(str(folder))
    manifest["clips"]["00:06-00:09"]["edit"] = {"hook": {"enabled": True, "text": "Kenapa *nolak*?", "style": "outline"}}
    (folder / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")

    template = c.post("/edit-templates", headers=admin, json={
        "name": "Podcast", "source_auto": True, "options": {"resolution": "1080"},
        "edit": {"vignette": {"shape": "bottom", "strength": 50}, "hook": {"enabled": True, "style": "tape", "shade": 40},
                 "marks": {"source": {"enabled": True, "text": "lama"}}},
    }).json["template"]
    assert c.post(f"/videos/{VIDEO_ID}/render-all", headers=admin, json={"template_id": "zzz"}).status_code == 404

    res = c.post(f"/videos/{VIDEO_ID}/render-all", headers=admin, json={"template_id": template["id"]})
    assert res.status_code == 202 and len(res.json["job"]["segments"]) == 2
    _, _, _, segments, options, *_ = started[0]
    assert options["resolution"] == "1080" and options["mode"] == "final"
    edits = {s["start_time"]: s["options"]["edit"] for s in segments}
    assert edits["00:06"]["hook"] == {**edits["00:06"]["hook"], "text": "Kenapa *nolak*?", "style": "tape", "shade": 40, "enabled": True}
    assert edits["00:01"]["hook"]["enabled"] is False  # tanpa teks hook / ide hook
    assert edits["00:01"]["vignette"]["strength"] == 50 and edits["00:01"]["marks"]["source"]["text"] == "Sumber: YouTube"
    assert len({s["segment_number"] for s in segments}) == 2
    # Semua sedang antre → tidak bisa dirender lagi
    assert c.post(f"/videos/{VIDEO_ID}/render-all", headers=admin, json={"template_id": template["id"]}).status_code == 409

    # ZIP: muncul setelah ada ≥ 2 klip final, nama file dari judul klip
    assert c.get(f"/videos/{VIDEO_ID}", headers=admin).json["zip_url"] is None
    for start, end, title in (("00:01", "00:05", "Cerita bisnis"), ("00:06", "00:09", "Cerita bisnis")):
        make_video(folder / f"{start[-2:]}.mp4", 1)
        A._record_clip(str(folder), {"start_time": start, "end_time": end, "short_title": title},
                       str(folder / f"{start[-2:]}.mp4"), {"resolution": "1080", "range": [1.0, 5.0]})
    url = c.get(f"/videos/{VIDEO_ID}", headers=admin).json["zip_url"]
    assert c.get(f"/clips-zip/{VIDEO_ID}?t=palsu").status_code == 404
    res = c.get("/" + url.split("://", 1)[1].split("/", 1)[1])
    assert res.status_code == 200 and "Tes.zip" in res.headers["Content-Disposition"]
    with zipfile.ZipFile(io.BytesIO(res.data)) as archive:
        assert sorted(archive.namelist()) == ["Cerita bisnis (2).mp4", "Cerita bisnis.mp4"]
    res.close()


def test_thumbnail_create_and_download(env, monkeypatch):
    c = env["client"]
    admin = token("admin@example.com")
    folder = _preview_clip(env, "admin@example.com")
    calls = []

    def fake_render(video_path, start, end, at, options, output_dir, base_name, hook, use_layout=True):
        calls.append({"at": at, "hook": hook, "use_layout": use_layout})
        path = os.path.join(output_dir, f"{base_name}.thumb.jpg")
        open(path, "wb").write(b"\xff\xd8jpg")
        return path

    monkeypatch.setattr(A.render_pipeline, "render_thumbnail", fake_render)
    monkeypatch.setattr(A.thumbnail, "best_frame_time", lambda path, duration: 2.5)
    res = c.post(f"/videos/{VIDEO_ID}/thumbnail", headers=admin,
                 json={"key": "00:01-00:05", "text": "Ditolak\n*1 MILIAR*{\b0}", "hook": {"style": "poster", "accent": "yellow"}})
    assert res.status_code == 200
    thumb = res.json["thumbnail"]
    assert thumb["text"] == "Ditolak\n*1 MILIAR*\b0".replace("\\", "") and thumb["at"] == 3.5  # 1.0 + 2.5 (otomatis)
    hook = calls[0]["hook"]
    assert hook["style"] == "poster" and hook["accent"] == "yellow" and hook["anim"] == "cut" and hook["size"] >= 130
    # Tanpa video sumber → pratinjau diperbesar
    assert calls[0]["use_layout"] is False
    # Detik pilihan (detik video sumber) → relatif awal pratinjau
    c.post(f"/videos/{VIDEO_ID}/thumbnail", headers=admin, json={"key": "00:01-00:05", "text": "x", "at": 4.0})
    assert calls[1]["at"] == 3.0

    data = c.get(f"/videos/{VIDEO_ID}/editor?key=00:01-00:05", headers=admin).json
    assert data["thumbnail"]["url"] and data["thumbnail"]["text"] == "x"
    path = data["thumbnail"]["url"].split("://", 1)[1].split("/", 1)[1]
    disposition = c.get("/" + path + "&download=1").headers["Content-Disposition"]
    assert ".jpg" in disposition and ".mp4" not in disposition
    listed = c.get(f"/videos/{VIDEO_ID}/clips", headers=admin).json["clips"][0]
    assert listed["thumbnail_url"]
    # Kit upload: judul klip jadi opsi pertama, deskripsi + hashtag siap tempel
    assert listed["upload"]["titles"][0] == listed["title"] and listed["upload"]["hashtags"]
    assert listed["upload"]["description_full"].endswith(" ".join(listed["upload"]["hashtags"]))


def test_niche_setting(env):
    c, h = env["client"], token("niche@example.com")
    assert c.get("/me", headers=h).json["niche"] == {"topics": [], "comedy": True}   # default: semua topik
    res = c.put("/me/niche", headers=h, json={"topics": ["investasi", "bisnis", "komedi", "../x"], "comedy": False})
    assert res.status_code == 200 and res.json["niche"] == {"topics": ["bisnis", "investasi"], "comedy": False}
    assert c.get("/me", headers=h).json["niche"]["topics"] == ["bisnis", "investasi"]


def _wav(path, seconds=1.0, rate=24000):
    import math
    import struct
    import wave
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"".join(struct.pack("<h", int(8000 * math.sin(i / rate * 2 * math.pi * 440)))
                               for i in range(int(seconds * rate))))
    return path


def test_longform_flow(env, monkeypatch):
    import longform
    c, h = env["client"], token("admin@example.com")
    assert c.post("/analyze", headers=h, json={"youtube_url": URL}).status_code == 200
    info = c.get(f"/videos/{VIDEO_ID}/longform", headers=h).json
    assert info["project"] is None and len(info["voices"]) == 30
    # Khusus admin: pengguna biasa ditolak walau videonya ada di pustakanya
    user = token("lf@example.com")
    assert c.post("/analyze", headers=user, json={"youtube_url": URL}).status_code == 200
    assert c.get(f"/videos/{VIDEO_ID}/longform", headers=user).status_code == 403
    assert c.get("/longform/stock?q=city", headers=user).status_code == 403

    lines = [(0, 5, "kalimat satu"), (5, 10, "kalimat dua")]
    monkeypatch.setattr(A.transcript_service, "_load_cached", lambda vid: lines)
    monkeypatch.setattr(longform, "generate_script", lambda tl, meta, minutes, focus, key, channel="": longform.script_from_ai({
        "title": "Judul Panjang", "summary": "Ringkas.", "scenes": [
            {"kind": "narration", "chapter": "", "text": "Hook pembuka.", "query": "money"},
            {"kind": "narration", "chapter": "Bab satu", "text": "Isi bab satu.", "query": "city"},
            {"kind": "quote", "chapter": "", "text": "kalimat dua", "start_time": "00:02", "end_time": "00:09"},
        ]}, tl))
    res = c.post(f"/videos/{VIDEO_ID}/longform/script", headers=h, json={"minutes": 5, "focus": "investasi"})
    assert res.status_code == 200, res.json
    scenes = res.json["project"]["scenes"]
    assert [s["kind"] for s in scenes] == ["narration", "narration", "quote"]
    assert [s["audio_state"] for s in scenes[:2]] == ["missing", "missing"]
    sid = scenes[0]["id"]

    keys = []
    monkeypatch.setattr(longform, "synthesize", lambda text, voice, out, key: keys.append(key) or longform.wav_duration(_wav(out)))
    res = c.post(f"/videos/{VIDEO_ID}/longform/scenes/{sid}/tts", headers=h)
    assert res.status_code == 200 and keys == [None]                     # key server
    scene = res.json["project"]["scenes"][0]
    assert scene["audio_state"] == "ready" and scene["audio"]["source"] == "tts"
    assert c.get(scene["audio"]["url"].split("localhost", 1)[1]).status_code == 200
    assert c.get(scene["audio"]["url"].split("localhost", 1)[1].split("&t=")[0]).status_code == 404   # tanpa token

    # Rekaman sendiri untuk adegan kedua (dikonversi FFmpeg)
    rec = _wav(env["tmp"] / "rekaman.wav", 1.5, 48000)
    with open(rec, "rb") as f:
        res = c.post(f"/videos/{VIDEO_ID}/longform/scenes/{scenes[1]['id']}/recording", headers=h,
                     data={"audio": (f, "rekaman.wav")}, content_type="multipart/form-data")
    assert res.status_code == 200, res.json
    assert res.json["project"]["scenes"][1]["audio"]["source"] == "record"

    # Teks diubah setelah TTS → suara harus dibuat ulang sebelum render
    edited = res.json["project"]["scenes"]
    edited[0]["text"] = "Hook pembuka yang baru."
    res = c.put(f"/videos/{VIDEO_ID}/longform", headers=h, json={"title": "Judul Baru", "scenes": edited, "voice": {"voice": "Kore"}})
    assert res.status_code == 200 and res.json["project"]["scenes"][0]["audio_state"] == "stale"
    res = c.post(f"/videos/{VIDEO_ID}/longform/render", headers=h)
    assert res.status_code == 400 and res.json["code"] == "audio_missing"
    c.post(f"/videos/{VIDEO_ID}/longform/scenes/{sid}/tts", headers=h)

    # Kutipan butuh file video podcast (admin tanpa file & tanpa link unduhan)
    monkeypatch.setattr(A, "_editor_source", lambda user, vid: (None, ""))
    res = c.post(f"/videos/{VIDEO_ID}/longform/render", headers=h)
    assert res.status_code == 400 and res.json["code"] == "no_source"
    project = c.get(f"/videos/{VIDEO_ID}/longform", headers=h).json["project"]
    c.put(f"/videos/{VIDEO_ID}/longform", headers=h, json={**project, "scenes": project["scenes"][:2]})

    def fake_render(project, folder, source, transcript, label, out_name, cb):
        make_video(os.path.join(folder, out_name), 1)
        return {"filename": out_name, "durations": [3.0, 12.0]}

    monkeypatch.setattr(longform, "render", fake_render)
    res = c.post(f"/videos/{VIDEO_ID}/longform/render", headers=h)
    assert res.status_code == 202
    for _ in range(50):
        if c.get(f"/jobs/{res.json['job']['id']}", headers=h).json["job"]["status"] == "done":
            break
        time.sleep(0.1)
    output = c.get(f"/videos/{VIDEO_ID}/longform", headers=h).json["project"]["output"]
    assert output["chapters"] == [{"at": 0.0, "title": "Pembuka"}, {"at": 3.0, "title": "Bab satu"}]
    assert output["description"].startswith("Ringkas.")
    download = c.get(output["url"].split("localhost", 1)[1] + "&download=1")
    assert download.status_code == 200 and "Judul Baru.mp4" in download.headers["Content-Disposition"]
    assert download.headers["Content-Type"].startswith("video/")


def test_longform_topic_flow(env, monkeypatch):
    import longform
    import topics
    c, h = env["client"], token("admin@example.com")
    news = [{"title": "IHSG melemah", "url": "https://media.id/ihsg", "source": "Media", "date": "2026-10-27"}]
    monkeypatch.setattr(topics, "search_news", lambda q, limit=8: news)
    seen = []

    def fake_script(title, angle, sources, minutes, key, channel=""):
        seen.append((title, angle, sources, minutes, channel))
        project = longform.script_from_ai({"title": f"Video {title}", "summary": "Ringkas.", "scenes": [
            {"kind": "narration", "chapter": "", "text": "Hook.", "query": "stock"},
            {"kind": "narration", "chapter": "Bab A", "text": "Isi.", "query": "city"},
            {"kind": "narration", "chapter": "", "text": "Penutup.", "query": "sunset"}]}, [])
        project.update({"topic": title, "angle": angle, "sources": sources})
        return project

    monkeypatch.setattr(topics, "generate_script", fake_script)
    # Pengguna biasa ditolak
    user = token("biasa@example.com")
    assert c.post("/longform/topics", headers=user, json={"title": "IHSG"}).status_code == 403
    assert c.post("/longform/ideas", headers=user, json={}).status_code == 403

    # Topik sendiri tanpa sumber → berita dicari otomatis
    res = c.post("/longform/topics", headers=h, json={"title": "IHSG anjlok", "angle": "dampak ke tabungan", "minutes": 5,
                                                       "channel": "Klik Digital"})
    assert res.status_code == 201, res.json
    key = res.json["id"]
    assert topics.is_topic_id(key) and res.json["kind"] == "topic" and res.json["source_ready"] is False
    assert seen[0] == ("IHSG anjlok", "dampak ke tabungan", news, 5, "Klik Digital")
    assert res.json["brand"]["channel"] == "Klik Digital"   # nama channel diingat untuk proyek berikutnya
    assert res.json["project"]["sources"] == news

    listed = c.get("/longform/topics", headers=h).json["projects"]
    assert [p["id"] for p in listed] == [key] and listed[0]["title"] == "Video IHSG anjlok"
    assert c.get(f"/longform/topics/{key}", headers=h).json["project"]["topic"] == "IHSG anjlok"

    # Proyek topik tidak punya video sumber → adegan kutipan dibuang saat disimpan
    project = c.get(f"/longform/topics/{key}", headers=h).json["project"]
    scenes = project["scenes"] + [{"kind": "quote", "chapter": "", "text": "q", "start": 1, "end": 9}]
    res = c.put(f"/longform/topics/{key}", headers=h, json={**project, "scenes": scenes})
    assert [s["kind"] for s in res.json["project"]["scenes"]] == ["narration"] * 3

    # Thumbnail: tanpa video stok → latar polos; gaya & warna jadi brand channel
    assert c.post(f"/longform/topics/{key}/thumbnail", headers=h, json={"text": "  "}).status_code == 400
    res = c.post(f"/longform/topics/{key}/thumbnail", headers=h,
                 json={"text": "IHSG *Anjlok*, Panik?", "style": "panel", "accent": "merah"})
    assert res.status_code == 200, res.json
    thumb = res.json["project"]["thumbnail"]
    assert thumb["text"] == "IHSG *Anjlok*, Panik?" and thumb["style"] == "panel" and thumb["scene_id"] is None
    assert res.json["brand"] == {"channel": "Klik Digital", "accent": "merah", "style": "panel"}
    img = c.get(thumb["url"].split("localhost", 1)[1])
    assert img.status_code == 200 and img.data[:2] == bytes([0xFF, 0xD8])
    assert c.put("/longform/brand", headers=user, json={"channel": "x"}).status_code == 403
    assert c.put("/longform/brand", headers=h, json={"style": "editorial"}).json["brand"]["channel"] == "Klik Digital"

    # Buat ulang naskah memakai topik & sumber yang tersimpan (thumbnail lama tetap ada)
    assert c.post(f"/longform/topics/{key}/script", headers=h, json={"minutes": 8}).status_code == 200
    assert seen[-1][0] == "IHSG anjlok" and seen[-1][2] == news and seen[-1][3] == 8 and seen[-1][4] == "Klik Digital"
    assert c.get(f"/longform/topics/{key}", headers=h).json["project"]["thumbnail"]["filename"] == thumb["filename"]

    # Deskripsi hasil render mencantumkan berita sumber (tanpa link podcast)
    monkeypatch.setattr(longform, "synthesize", lambda text, voice, out, k: longform.wav_duration(_wav(out)))
    for scene in c.get(f"/longform/topics/{key}", headers=h).json["project"]["scenes"]:
        c.post(f"/longform/topics/{key}/scenes/{scene['id']}/tts", headers=h)

    def fake_render(project, folder, source, transcript, label, out_name, cb):
        assert source is None and transcript == []
        make_video(os.path.join(folder, out_name), 1)
        return {"filename": out_name, "durations": [3.0, 12.0, 5.0]}

    monkeypatch.setattr(longform, "render", fake_render)
    job = c.post(f"/longform/topics/{key}/render", headers=h).json["job"]
    for _ in range(50):
        if c.get(f"/jobs/{job['id']}", headers=h).json["job"]["status"] == "done":
            break
        time.sleep(0.1)
    output = c.get(f"/longform/topics/{key}", headers=h).json["project"]["output"]
    assert "Sumber:\n- IHSG melemah (Media): https://media.id/ihsg" in output["description"]
    assert "Sumber podcast" not in output["description"]
    assert c.get(output["url"].split("localhost", 1)[1]).status_code == 200

    assert c.delete(f"/longform/topics/{key}", headers=h).status_code == 200
    assert c.get(f"/longform/topics/{key}", headers=h).status_code == 404
    assert c.get("/longform/topics", headers=h).json["projects"] == []


def test_longform_recommended_ideas_are_cached(env, monkeypatch):
    import topics
    c, h = env["client"], token("admin@example.com")
    calls = []
    monkeypatch.setattr(topics, "gather_headlines", lambda q, n: calls.append(("feed", q, tuple(n))) or [{"title": "x"}])
    monkeypatch.setattr(topics, "generate_ideas", lambda heads, text, key: calls.append(("ai", text)) or [
        {"title": f"Ide {len(calls)}", "angle": "", "why": "", "sources": []}])
    assert c.get("/longform/ideas/recommended", headers=token("biasa@example.com")).status_code == 403

    first = c.get("/longform/ideas/recommended", headers=h).json
    assert first["ideas"][0]["title"] == "Ide 2" and len(calls) == 2
    assert c.get("/longform/ideas/recommended", headers=h).json["ideas"] == first["ideas"]       # dari cache
    assert len(calls) == 2
    # Niche berubah → dibuat ulang untuk niche baru
    c.put("/me/niche", headers=h, json={"topics": ["investasi"], "comedy": True})
    again = c.get("/longform/ideas/recommended", headers=h).json
    assert calls[-2] == ("feed", "", ("investasi",)) and again["niche"] == ["Investasi & saham"]
    # Muat ulang paksa
    c.get("/longform/ideas/recommended?refresh=1", headers=h)
    assert len(calls) == 6
    # File cache tidak muncul sebagai proyek
    assert c.get("/longform/topics", headers=h).json["projects"] == []
