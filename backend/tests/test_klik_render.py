import pytest

import klik_render as kr
import motion_scenes as ms
import topics


def narration(text="Kalimat.", **extra):
    return {"id": "s1", "kind": "narration", "text": text, "chapter": "", **extra}


def test_plan_changes_backdrop_by_content():
    assert kr.plan_scene(narration("Mana yang paling susah?"), 5, True, True)["template"] == "question"
    assert kr.plan_scene(narration("Bukan pertanyaan."), 5, True, False)["template"] == "statement"
    assert kr.plan_scene(narration(motion={"template": "data", "values": [1, 2]}), 1, False, True)["backdrop"] == "grid"
    # Latar merah tetap memperlihatkan video stok bila ada, dan merah polos bila tidak ada
    assert kr.plan_scene(narration(motion={"template": "number", "tone": "bad"}), 1, False, True)["backdrop"] == "redvideo"
    assert kr.plan_scene(narration(motion={"template": "number", "tone": "bad"}), 1, False, False)["backdrop"] == "red"
    # Bentuk "pilihan" tidak dipakai lagi
    assert kr.plan_scene(narration(motion={"template": "choice", "title": "T", "options": ["A", "B"]}), 1, False, True) == {"template": "plain", "backdrop": "video"}
    assert kr.plan_scene(narration(motion={"template": "ledger"}), 1, False, True, "short")["backdrop"] == "video"
    assert kr.plan_scene(narration(motion={"template": "ledger"}), 1, False, True, "long")["backdrop"] == "paper"
    assert kr.plan_scene(narration(), 1, False, True) == {"template": "plain", "backdrop": "video"}


def test_same_flat_backdrop_never_repeats():
    scenes = [{"template": "statement", "backdrop": "paper"}, {"template": "statement", "backdrop": "paper"}, {"template": "statement", "backdrop": "paper"}]
    kr._vary_backdrops(scenes)
    assert [s["backdrop"] for s in scenes] == ["paper", "grid", "paper"]


def test_rows_appear_when_their_label_is_spoken():
    timed = [{"w": w, "s": float(i)} for i, w in enumerate(["Kos", "tiga", "juta,", "makan", "dua"])]
    assert kr.label_cues(["Kos", "Makan"], timed, 0, 5) == [0.0, 3.0]
    fallback = kr.label_cues(["Kos", "Transport"], timed, 0, 5)
    assert fallback[0] == 0.0 and 0 < fallback[1] < 5


def test_audio_is_standard_format_and_many_cuts_share_one_effect():
    args = " ".join(kr.mix_args("p.mp4", "v.wav", [3.0, 6.0, 9.0], 12.0, "m.m4a", "o.mp4"))
    assert "-ar 48000 -ac 2" in args and "channel_layouts=stereo,apad[out]" in args
    assert args.count("-f lavfi") == 1 and "asplit=3" in args and "adelay=6000:all=1" in args and "sidechaincompress" in args
    assert "sidechaincompress" not in " ".join(kr.mix_args("p.mp4", "v.wav", [], 3, None, "o.mp4"))
    joined = " ".join(kr.join_voice_args(["a.wav", "b.wav"], [1.5, 2.0], "v.wav"))
    assert "concat=n=2" in joined and "atrim=0:2.000" in joined


@pytest.mark.parametrize("raw", [
    {"template": "ledger", "title": "Struk", "rows": [{"label": "Kos", "value": 3000000}, {"label": "Makan", "value": "2500000"}], "start": 10000000, "prefix": "Rp"},
    {"template": "number", "label": "Sisa", "value": 500000, "prefix": "Rp", "tone": "bad"},
    {"template": "share", "label": "Tiga pos", "percent": 70},
    {"template": "verdict", "question": "Gaji kurang?", "answer": "BELUM TENTU"},
    {"template": "picture", "name": "tire", "title": "Ban bocor"},
])
def test_new_templates_are_kept(raw):
    assert ms.sanitize(raw)["template"] == raw["template"]


def test_incomplete_new_templates_are_rejected():
    assert ms.sanitize({"template": "ledger", "title": "T", "rows": [{"label": "a", "value": 1}]}) is None
    assert ms.sanitize({"template": "share", "label": "L", "percent": 170}) is None
    assert ms.sanitize({"template": "picture", "name": "naga", "title": "T"}) is None
    assert ms.sanitize({"template": "choice", "title": "T", "options": ["A", "B"], "pick": 1}) is None


def test_animated_numbers_must_be_spoken_including_scaled_forms():
    ledger = ms.sanitize({"template": "ledger", "title": "T", "rows": [{"label": "Kos", "value": 3000000}, {"label": "Makan", "value": 2500000}], "start": 10000000})
    assert ms.values_in_text(ledger, "Gaji Rp10 juta. Kos 3 juta, makan 2,5 juta.")
    assert not ms.values_in_text(ledger, "Gaji Rp10 juta. Kos 3 juta, makan banyak.")
    assert ms.values_in_text(ms.sanitize({"template": "number", "label": "L", "value": 500000}), "Sisanya 500 ribu doang")
    assert not ms.values_in_text(ms.sanitize({"template": "share", "label": "L", "percent": 70}), "Sebagian besar habis")


def test_dense_plan_allows_adjacent_scenes():
    scenes = [narration("satu"), narration("dua")]
    pick = {"template": "kinetic", "words": ["x"]}
    assert ms.apply_picks(scenes, [{"scene": 0, "motion": pick}, {"scene": 1, "motion": pick}], dense=True) == 2


def _ideas(fit):
    return {"ideas": [{"title": "Judul", "angle": "a", "why": "w", "fit": fit, "fit_reason": "r", "source_ids": [1]}]}


HEAD = [{"title": "Berita", "url": "https://contoh.id/a", "source": "S", "date": ""}]


@pytest.mark.parametrize("given,kept", [("short", "short"), ("long", "long"), ("both", "both"), ("aneh", "both")])
def test_idea_fit_is_sanitized(monkeypatch, given, kept):
    import gemini_service
    monkeypatch.setattr(gemini_service, "_call_gemini", lambda *a, **k: _ideas(given))
    idea = topics.generate_ideas(HEAD, "niche")[0]
    assert idea["fit"] == kept and idea["fit_reason"] == "r"


def test_off_niche_ideas_are_dropped(monkeypatch):
    import gemini_service
    raw = _ideas("short")
    raw["ideas"].append({**raw["ideas"][0], "title": "Sepak bola", "pillar": "lainnya"})
    raw["ideas"][0]["pillar"] = "uang"
    monkeypatch.setattr(gemini_service, "_call_gemini", lambda *a, **k: raw)
    ideas = topics.generate_ideas(HEAD, "niche")
    assert [i["title"] for i in ideas] == ["Judul"] and ideas[0]["pillar"] == "Uang"


def test_channel_headlines_skip_general_trends(monkeypatch):
    seen = []
    monkeypatch.setattr(topics, "search_news", lambda q: seen.append(q) or [])
    monkeypatch.setattr(topics, "google_trends", lambda: pytest.fail("Trends umum tidak boleh dipakai untuk channel"))
    assert topics.gather_headlines("", list(topics.CHANNEL_NICHE)) == []
    assert sorted(seen) == sorted(topics.CHANNEL_QUERIES)


def test_news_filter_keeps_recent_and_undated(monkeypatch):
    monkeypatch.setattr(topics.time, "time", lambda: 1793750400)   # 2026-11-04
    assert topics._recent("2026-11-01") and topics._recent("") and not topics._recent("2026-10-22")


def _script(words, count=4):
    return {"title": "T", "summary": "S", "thumbnail_texts": ["a"], "scenes": [
        {"kind": "narration", "chapter": "Bab", "text": " ".join(["kata"] * words), "query": "q", "start_time": "", "end_time": ""} for _ in range(count)]}


def test_short_script_is_45_to_60_seconds_and_retries_once(monkeypatch):
    import gemini_service
    answers = [_script(40), _script(30)]   # 160 kata kepanjangan, lalu 120 kata pas
    calls, prompts = [], []

    def fake(prompt, text, **kwargs):
        calls.append(text)
        prompts.append(prompt)
        return answers.pop(0)
    monkeypatch.setattr(gemini_service, "_call_gemini", fake)
    monkeypatch.setattr(topics, "article_text", lambda url: "")
    project = topics.generate_script("Topik", "", HEAD, 8, None, "Klik", 60)
    assert project["format"] == "short" and project["seconds"] == 60
    assert all(s["chapter"] == "" for s in project["scenes"]) and "160 kata" in calls[1]
    assert "45-60 detik" in prompts[0] and "belum banyak diketahui".upper() in prompts[0].upper()

    # Selisih sedikit tetap diterima (80 kata), terlalu jauh tetap ditolak (40 kata)
    monkeypatch.setattr(gemini_service, "_call_gemini", lambda *a, **k: _script(20))
    assert topics.generate_script("Topik", "", HEAD, 8, None, "Klik", 60)["scenes"]
    monkeypatch.setattr(gemini_service, "_call_gemini", lambda *a, **k: _script(10))
    with pytest.raises(ValueError, match="45-60 detik"):
        topics.generate_script("Topik", "", HEAD, 8, None, "Klik", 60)


def test_short_script_without_news_uses_general_knowledge(monkeypatch):
    import gemini_service
    seen = {}

    def fake(prompt, text, **kwargs):
        seen.update(prompt=prompt, text=text)
        return _script(30)
    monkeypatch.setattr(gemini_service, "_call_gemini", fake)
    project = topics.generate_script("Kenapa harga tiket pesawat naik turun", "", [], 8, None, "Klik", 60)
    assert project["sources"] == [] and "tidak ada" in seen["text"]
    assert "JANGAN mengarang angka" in seen["prompt"] and "HANYA dari SUMBER BERITA" not in seen["prompt"]


def test_long_klik_script_is_marked_and_stays_within_scene_limit(monkeypatch):
    import gemini_service
    prompts = []
    monkeypatch.setattr(gemini_service, "_call_gemini", lambda prompt, text, **k: prompts.append(prompt) or _script(15, 10))
    monkeypatch.setattr(topics, "article_text", lambda url: "")
    project = topics.generate_script("Topik", "", HEAD, 12, None, "Klik", None, "long")
    assert project["format"] == "long" and "12-24 kata" in prompts[0]
    assert "minutes" in project


def test_description_lists_sources():
    text = kr.short_description({"summary": "Ringkas.", "sources": [{"source": "Katadata", "title": "B", "url": "https://k.id/a"}]}, "Klik Digital ID")
    assert text == "Ringkas.\n\nSumber:\n- Katadata: https://k.id/a\n\nKlik Digital ID"
    assert kr.MIN_SECONDS == 45 and kr.MAX_SECONDS == 60


def test_one_click_prepare_fills_voice_visual_and_thumbnail(monkeypatch, tmp_path):
    import app as app_module
    import longform

    folder = str(tmp_path)
    scenes = [{"id": "s1", "kind": "narration", "chapter": "", "text": "Satu.", "query": "kota", "visual": None, "motion": {"template": "kinetic", "words": ["x"]}},
              {"id": "s2", "kind": "narration", "chapter": "", "text": "Dua.", "query": "kantor", "visual": None, "motion": None}]
    project = {"format": "long", "title": "T", "scenes": scenes, "voice": app_module.CHANNEL_VOICE, "thumbnail_ideas": ["Gaji *Bocor*"]}
    longform.save_project(folder, project)
    monkeypatch.setattr(longform, "stock_enabled", lambda: True)
    monkeypatch.setattr(longform, "search_stock", lambda q: [{"provider": "pixabay", "id": hash(q) % 1000, "q": q}])

    def fake_tts(text, voice, path, key):
        if text == "Dua." and not calls:
            calls.append(1)
            raise RuntimeError("sibuk")
        open(path, "wb").write(b"x")
        return 1.5
    calls = []
    monkeypatch.setattr(longform, "synthesize", fake_tts)
    monkeypatch.setattr(app_module, "_load_brand", lambda user: {"channel": "Klik", "accent": "kuning", "style": "panel"})
    thumbs = []

    def fake_thumb(folder_, project_, text, brand, wanted):
        thumbs.append((text, brand["accent"], brand["style"]))
        return project_
    monkeypatch.setattr(app_module, "_make_thumbnail", fake_thumb)

    app_module._prepare_state["vid"] = {"running": True, "step": "", "done": 0, "total": 0, "errors": []}
    app_module._run_prepare(None, "vid", folder)
    state = app_module._prepare_state["vid"]
    saved = longform.load_project(folder)
    assert state["running"] is False and state["total"] == 2 and state["done"] == 2
    assert all(s["visual"] for s in saved["scenes"])
    assert saved["scenes"][0]["audio"]["source"] == "tts" and "audio" not in saved["scenes"][1]
    assert "1 adegan belum punya suara" in state["errors"][0]
    assert thumbs == [("Gaji *Bocor*", "hijau", "tajuk")]

    # Klik sekali lagi hanya melengkapi yang kurang
    first_audio = saved["scenes"][0]["audio"]["file"]
    app_module._prepare_state["vid"] = {"running": True, "step": "", "done": 0, "total": 0, "errors": []}
    app_module._run_prepare(None, "vid", folder)
    saved = longform.load_project(folder)
    assert app_module._prepare_state["vid"]["total"] == 1 and saved["scenes"][0]["audio"]["file"] == first_audio and saved["scenes"][1]["audio"]


def test_stuck_voice_call_times_out(monkeypatch):
    import threading

    import app as app_module
    import longform
    release = threading.Event()
    monkeypatch.setattr(longform, "synthesize", lambda *a: release.wait(5))
    monkeypatch.setattr(app_module, "TTS_TIMEOUT", 0.05)
    with pytest.raises(TimeoutError, match="tidak selesai"):
        app_module._synthesize_with_timeout("x", {}, "y")
    release.set()


def test_elevenlabs_voice_is_kept_and_routed(monkeypatch):
    import elevenlabs_tts as el
    import longform
    assert longform.sanitize_voice({"voice": el.DEFAULT_VOICE})["voice"] == el.DEFAULT_VOICE
    assert longform.sanitize_voice({"voice": "bukan-suara"})["voice"] == longform.DEFAULT_VOICE
    calls = []
    monkeypatch.setattr(el, "synthesize", lambda text, voice, path: calls.append((text, voice)))
    monkeypatch.setattr(longform, "wav_duration", lambda path: 2.5)
    assert longform.synthesize("Halo", {"voice": el.DEFAULT_VOICE, "style": ""}, "x.wav", None) == 2.5
    assert calls == [("Halo", el.DEFAULT_VOICE)]


@pytest.mark.parametrize("status,body,expected", [
    (401, {}, "ditolak"), (402, {"detail": {"code": "paid_plan_required"}}, "paket"), (429, {}, "membatasi"),
    (401, {"detail": {"code": "quota_exceeded"}}, "Kredit"), (500, {}, "kode 500"),
])
def test_elevenlabs_errors_are_readable(status, body, expected):
    import requests

    import elevenlabs_tts as el
    res = requests.Response()
    res.status_code = status
    res._content = __import__("json").dumps(body).encode()
    assert expected in el._error_message(res)


def test_short_voice_uses_free_key_then_falls_back_to_tier1(monkeypatch):
    import longform
    calls = []

    def fake(text, voice, path, key):
        calls.append(key)
        if key == "gratis":
            raise RuntimeError("429 RESOURCE_EXHAUSTED")
        return 2.0
    monkeypatch.setattr(longform, "synthesize", fake)
    monkeypatch.setenv(longform.FREE_KEY_ENV, "gratis")
    assert longform.synthesize_short("Halo", {"voice": "Puck", "style": ""}, "x.wav") == 2.0 and calls == ["gratis", None]
    calls.clear()
    # Suara replikasi tidak ada di project gratis, jadi langsung memakai key Tier 1
    assert longform.synthesize_short("Halo", {"voice": "voice_746ecuqzzudk", "style": ""}, "x.wav") == 2.0 and calls == [None]
    calls.clear()
    monkeypatch.delenv(longform.FREE_KEY_ENV)
    longform.synthesize_short("Halo", {"voice": "Puck", "style": ""}, "x.wav")
    assert calls == [None]


def test_channel_voice_defaults_to_rafi_and_elevenlabs_is_optional(monkeypatch):
    import app as app_module
    import elevenlabs_tts as el
    monkeypatch.setenv("ELEVENLABS_API_KEY", "")
    import longform
    rafi = "voice_746ecuqzzudk"
    assert longform.sanitize_voice({"voice": rafi})["voice"] == rafi and longform.sanitize_voice({})["voice"] == rafi
    assert any(v["id"] == rafi and v["name"] == "Rafi" for v in app_module._voice_options())
    assert app_module._channel_voice()["voice"] == rafi and app_module._channel_voice("Puck")["voice"] == "Puck"
    assert all(v["id"] not in el.VOICES for v in app_module._voice_options())
    monkeypatch.setenv("ELEVENLABS_API_KEY", "abc")
    assert app_module._channel_voice()["voice"] == rafi and app_module._voice_options()[0]["name"] == "ElevenLabs Liam"
    assert app_module._channel_voice(el.DEFAULT_VOICE)["voice"] == el.DEFAULT_VOICE


def test_prepare_stops_after_repeated_voice_failures(monkeypatch, tmp_path):
    import app as app_module
    import elevenlabs_tts as el
    import longform
    folder = str(tmp_path)
    scenes = [{"id": f"s{i}", "kind": "narration", "chapter": "", "text": f"Teks {i}.", "query": "", "visual": None, "motion": {"template": "kinetic", "words": ["x"]}} for i in range(5)]
    longform.save_project(folder, {"format": "short", "title": "T", "scenes": scenes, "voice": {"voice": el.DEFAULT_VOICE, "style": ""}})
    monkeypatch.setattr(longform, "stock_enabled", lambda: False)
    attempts = []

    def fail(*args):
        attempts.append(1)
        raise el.VoiceError("Kredit ElevenLabs habis.")
    monkeypatch.setattr(longform, "synthesize", fail)
    app_module._prepare_state["stop"] = {"running": True, "step": "", "done": 0, "total": 0, "errors": []}
    app_module._run_prepare(None, "stop", folder)
    state = app_module._prepare_state["stop"]
    assert len(attempts) == 2 and state["running"] is False
    assert "Kredit ElevenLabs habis." in state["errors"][0] and "5 adegan belum punya suara" in state["errors"][0]
