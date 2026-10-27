import longform


def test_timed_words_skip_silence():
    # Dua bagian suara (0-1 dtk dan 2-3 dtk) dengan jeda hening di tengah
    timed = longform.timed_words("aaa bbb. ccc ddd", [(0.0, 1.0), (2.0, 3.0)])
    assert [w for _, _, w in timed] == ["aaa", "bbb.", "ccc", "ddd"]
    assert timed[0][0] == 0.0 and abs(timed[-1][1] - 3.0) < 1e-9
    assert timed[1][1] <= 1.0 + 1e-9 and timed[2][0] >= 2.0 - 1e-9     # kalimat kedua mulai setelah jeda
    assert longform.timed_words("", [(0, 1)]) == []


def test_speech_spans_from_silence(tmp_path):
    import math
    import struct
    import wave
    path = tmp_path / "jeda.wav"
    rate = 16000
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        tone = [int(8000 * math.sin(i / rate * 2 * math.pi * 300)) for i in range(rate)]
        w.writeframes(struct.pack(f"<{rate}h", *tone) + b"\0\0" * rate + struct.pack(f"<{rate}h", *tone))
    spans = longform.speech_spans(str(path), 3.0)
    assert len(spans) == 2 and spans[0][1] < 1.2 and spans[1][0] > 1.8


def test_subtitle_lines_break_at_sentence_end():
    timed = [(i, i + 1, w) for i, w in enumerate("Ini kalimat pertama. Lalu kalimat kedua yang lebih panjang sekali ya".split())]
    lines = longform.subtitle_lines(timed, max_words=6)
    assert lines[0] == (0, 3, "Ini kalimat pertama.")
    assert all(len(text.split()) <= 6 for _, _, text in lines)


def test_sanitize_scenes_keeps_server_audio_and_rejects_bad_input():
    previous = {"scenes": [{"id": "s1", "kind": "narration", "text": "lama", "audio": {"file": "s1.tts.a.wav", "source": "tts"}}]}
    scenes = longform.sanitize_scenes([
        {"id": "s1", "kind": "narration", "text": " Teks baru ", "query": "city", "audio": {"file": "../../.env"},
         "visual": {"provider": "pixabay", "id": 7, "link": "https://cdn.pixabay.com/video/7/a.mp4", "thumb": "https://evil.com/x.jpg"}},
        {"id": "../x", "kind": "narration", "text": "adegan baru",
         "visual": {"provider": "pixabay", "id": 1, "link": "https://videos.pexels.com/a.mp4"}},          # host salah
        {"kind": "narration", "text": "   "},                                   # kosong → dibuang
        {"kind": "quote", "start": 10, "end": 12},                              # terlalu pendek → dibuang
        {"kind": "quote", "start": 10, "end": 20, "chapter": "Bab {\b1}"},
    ], previous, 600)
    assert [s["kind"] for s in scenes] == ["narration", "narration", "quote"]
    assert scenes[0]["audio"] == {"file": "s1.tts.a.wav", "source": "tts"}   # audio dari server, bukan dari klien
    assert scenes[0]["text"] == "Teks baru" and scenes[0]["visual"]["thumb"] == ""
    assert scenes[1]["id"] != "../x" and longform.SCENE_ID_RE.match(scenes[1]["id"]) and scenes[1]["visual"] is None
    assert "{" not in scenes[2]["chapter"] and "\\" not in scenes[2]["chapter"]


def test_audio_state_and_chapters():
    voice = longform.sanitize_voice({"voice": "Kore"})
    scene = {"text": "Halo", "audio": {"source": "tts", "hash": longform.tts_hash("Halo", voice)}}
    assert longform.audio_state(scene, voice) == "ready"
    assert longform.audio_state({**scene, "text": "Halo!"}, voice) == "stale"
    assert longform.audio_state({**scene, "text": "Halo!", "audio": {"source": "record"}}, voice) == "ready"
    assert longform.audio_state({"text": "x"}, voice) == "missing"
    assert longform.sanitize_voice({"voice": "Bukan"})["voice"] == longform.DEFAULT_VOICE

    scenes = [{"chapter": ""}, {"chapter": "Bab A"}, {"chapter": ""}, {"chapter": "Bab B"}]
    assert longform.chapters(scenes, [5, 20, 30, 40]) == [(0.0, "Pembuka"), (5.0, "Bab A"), (55.0, "Bab B")]
    assert longform.clock(3725) == "1:02:05" and longform.clock(65) == "1:05"


def test_script_from_ai_clamps_quotes_to_transcript():
    lines = [(0, 60, "a"), (60, 120, "b")]
    project = longform.script_from_ai({"title": "Judul", "summary": "S", "scenes": [
        {"kind": "narration", "chapter": "", "text": "Hook.", "query": "money"},
        {"kind": "narration", "chapter": "Bab A", "text": "Satu.", "query": "x"},
        {"kind": "narration", "chapter": "Bab A", "text": "Dua.", "query": "x"},           # judul bab diulang
        {"kind": "quote", "text": "q", "start_time": "01:50", "end_time": "02:40"},   # dipotong di akhir transkrip
        {"kind": "quote", "text": "q", "start_time": "05:00", "end_time": "05:10"},   # di luar transkrip
        {"kind": "quote", "text": "q", "start_time": "00:10", "end_time": "01:30"},   # dipotong ke 25 detik
    ]}, lines)
    assert [s["chapter"] for s in project["scenes"][:3]] == ["", "Bab A", ""]
    quotes = [s for s in project["scenes"] if s["kind"] == "quote"]
    assert [(q["start"], q["end"]) for q in quotes] == [(110.0, 120.0), (10.0, 35.0)]


def test_description_lists_chapters_and_credits():
    project = {"summary": "Ringkas.", "scenes": [{"visual": {"provider": "pixabay", "credit": "Budi"}},
                                                 {"visual": {"provider": "pixabay", "credit": "Budi"}}, {}]}
    text = longform.description(project, [(0, "Pembuka"), (30, "A"), (90, "B")], "C.E.O.", "https://youtu.be/x")
    assert "0:00 Pembuka\n0:30 A\n1:30 B" in text
    assert "Sumber podcast: C.E.O. - https://youtu.be/x" in text and text.endswith("Video stok dari Pixabay: Budi")


def test_quote_lines_do_not_overlap():
    rows = [(9.0, 12.0, "awal"), (11.0, 14.0, "tengah"), (13.5, 20.0, "akhir"), (30, 31, "di luar")]
    assert longform.quote_lines(rows, 10.0, 18.0) == [(0.0, 1.0, "awal"), (1.0, 3.5, "tengah"), (3.5, 8.0, "akhir")]


def test_scene_ass_lines_never_overlap():
    ass = longform.scene_ass([(0.0, 1.0, "satu"), (1.0, 2.0, "dua")], 3.0)
    events = [l for l in ass.splitlines() if l.startswith("Dialogue")]
    assert ",0:00:00.00,0:00:01.00,Sub," in events[0] and ",0:00:01.00,0:00:02.15,Sub," in events[1]


def test_pixabay_search_picks_full_hd_landscape(monkeypatch):
    calls = []

    class Res:
        status_code = 200

        def raise_for_status(self):
            pass

        def json(self):
            video = lambda w, h, size: {"url": f"https://cdn.pixabay.com/video/{w}.mp4", "width": w, "height": h,
                                        "size": size, "thumbnail": "https://cdn.pixabay.com/video/t.jpg"}
            return {"hits": [
                {"id": 11, "pageURL": "https://pixabay.com/videos/kota-11/", "duration": 20, "user": "ana", "user_id": 5,
                 "videos": {"large": video(3840, 2160, 0), "medium": video(1920, 1080, 9), "small": video(1280, 720, 5)}},
                {"id": 12, "pageURL": "https://pixabay.com/videos/potret-12/", "duration": 9, "user": "bo", "user_id": 6,
                 "videos": {"medium": video(1080, 1920, 9)}},                        # potret → dilewati
            ]}

    monkeypatch.setattr(longform, "PIXABAY_API_KEY", "kunci")
    monkeypatch.setattr(longform, "_search_cache", {})
    monkeypatch.setattr(longform.requests, "get", lambda url, **kw: calls.append(kw["params"]) or Res())
    results = longform.search_stock("city night")
    assert calls[0]["q"] == "city night" and longform.stock_provider() == "pixabay"
    assert results == [{"provider": "pixabay", "id": 11, "link": "https://cdn.pixabay.com/video/1920.mp4",
                        "thumb": "https://cdn.pixabay.com/video/t.jpg", "page": "https://pixabay.com/videos/kota-11/",
                        "credit": "ana", "credit_url": "https://pixabay.com/users/ana-5/", "duration": 20}]
    longform.search_stock("City Night")
    assert len(calls) == 1                                                       # hasil di-cache


def test_voice_rules_mention_channel():
    assert '"Klik Digital"' in longform.voice_rules("Klik Digital")
    assert "tanpa nama channel" in longform.voice_rules("")
    prompt = longform.prompt_for(longform.SCRIPT_PROMPT, "Klik Digital", {})
    assert "{VOICE_RULES}" not in prompt and "{GREETING}" not in prompt and "Klik Digital" in prompt


def test_thumbnail_ideas_and_text_parsing():
    import longform_thumb as t
    assert longform.thumbnail_ideas(["Gaji *Naik*?", "gaji *naik*?", "", "A", "B", 5]) == ["Gaji *Naik*?", "A", "B"]
    assert t.parse_words("Gaji Tetap *Bokek*?") == [("Gaji", False), ("Tetap", False), ("Bokek?", True)]
    assert t.parse_words("*Utang Negara* Naik") == [("Utang", True), ("Negara", True), ("Naik", False)]
    assert t.sanitize_brand({"channel": "<b>Klik*</b>", "accent": "ungu", "style": "x"}) ==         {"channel": "bKlik/b", "accent": "kuning", "style": "tajuk"}


def test_thumbnail_renders_every_style(tmp_path):
    import longform_thumb as t
    from PIL import Image
    for style in t.STYLES:
        out = str(tmp_path / f"{style}.jpg")
        t.render("Harga Emas *Naik* Terus, Kenapa?", {"channel": "Klik", "accent": "hijau", "style": style}, out)
        with Image.open(out) as img:
            assert img.size == (1280, 720)
