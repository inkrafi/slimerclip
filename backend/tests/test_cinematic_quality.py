import cinematic
import cinematic_scenes
import clip_frame


def beat(main, i=0, kind="phrase", **extra):
    return {"start": float(i), "end": i + 2.0, "main_at": float(i), "lead": "", "main": main, "kind": kind, **extra}


def test_big_words_are_meaningful_and_not_repeated():
    index_of_hero = cinematic.LAYOUTS.index("hero")
    beats = [beat("kata") for _ in range(index_of_hero)] + [beat("pernah", 5)]
    assert cinematic.layouts_for(beats)[index_of_hero] == "stack"
    beats[index_of_hero] = beat("milikin", 5)
    assert cinematic.layouts_for(beats)[index_of_hero] == "hero"
    twice = beats + [beat("x", 6 + i) for i in range(5)] + [beat("milikin", 12)]
    assert cinematic.layouts_for(twice)[-1] != "hero"
    assert cinematic.layouts_for([beat("2022", 0, "number"), beat("2022", 9, "number")]) == ["hero", "hero"]


def test_old_saved_setting_is_ignored_and_all_text_stays_in_front():
    assert "behind" not in cinematic.sanitize({"behind": True})
    beats = [beat("kata", i, tail="ini penutup") for i in range(6)] + [beat("milikin", 7)]
    assert "milikin" in cinematic.overlay_ass({"behind": True}, beats, 20)


def test_repeated_main_text_is_dropped_nearby_but_allowed_later():
    beats = [beat("tidur", 0), beat("tidur", 4), beat("obat", 6), beat("tidur", 20)]
    assert [b["start"] for b in cinematic.drop_repeats(beats)] == [0.0, 6.0, 20.0]


def test_transcript_fixes_must_stay_close_to_original():
    words = [{"start": 0.0, "end": 1.0, "text": t, "stop": False} for t in ["balik", "colaja", "lagi", "ke", "kantor", "jam", "delapan", "pagi", "terus", "pulang", "malam", "banget"]]
    fixed = cinematic.apply_fixes(words, [{"index": 1, "text": "kerja"}, {"index": 99, "text": "x"}, {"index": 2, "text": "lagi"}])
    assert fixed[1]["text"] == "kerja" and fixed[2]["text"] == "lagi"
    assert cinematic.apply_fixes(words, [{"index": 0, "text": "pisang goreng"}])[0]["text"] == "balik"
    assert cinematic.apply_fixes(words, [{"index": 0, "text": "xyzqw"}])[0]["text"] == "balik"
    many = [{"index": i, "text": words[i]["text"] + "x"} for i in range(8)]
    assert cinematic.apply_fixes(words, many) == words


def test_ai_failure_keeps_transcript(monkeypatch):
    import gemini_service
    monkeypatch.setattr(gemini_service, "_call_gemini", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("putus")))
    words = [{"start": 0.0, "end": 1.0, "text": "halo", "stop": False}]
    assert cinematic.correct_words(words) == words


def test_stock_is_chosen_by_ai_and_dropped_when_nothing_fits(monkeypatch):
    import gemini_service
    pending = [{"line": "obat tidur", "query": "sleeping pills", "options": [{"tags": "ocean"}, {"tags": "pills, medicine"}]},
               {"line": "gelombang otak", "query": "brain waves", "options": [{"tags": "cat"}]}]
    monkeypatch.setattr(gemini_service, "_call_gemini", lambda *a, **k: {"choices": [{"item": 0, "option": 1}, {"item": 1, "option": -1}]})
    assert cinematic_scenes.choose_stock(pending) == {0: 1, 1: -1}
    monkeypatch.setattr(gemini_service, "_call_gemini", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("putus")))
    assert cinematic_scenes.choose_stock(pending) == {0: 1, 1: -1}


def test_library_scene_and_ratio_options(tmp_path, monkeypatch):
    assert clip_frame.sanitize({"ratio": "classic"})["ratio"] == "classic"
    scene = cinematic_scenes.sanitize([{"start": 1, "end": 3, "look": "broll", "file": "kota malam.mp4"}])[0]
    assert scene["file"] == "kota malam.mp4"
    for bad in ("../rahasia.mp4", "a/b.mp4", "virus.exe"):
        assert not cinematic_scenes.sanitize([{"start": 1, "end": 3, "look": "broll", "file": bad}])
    monkeypatch.setattr(cinematic_scenes, "BROLL_LIBRARY", str(tmp_path))
    assert cinematic_scenes.library_files() == []
    (tmp_path / "kota malam.mp4").write_bytes(b"x")
    (tmp_path / "catatan.txt").write_bytes(b"x")
    assert cinematic_scenes.library_files() == ["kota malam.mp4"]
    plan = cinematic_scenes.plan([{"start": 5.0, "end": 6.0, "lead": "", "main": "kota", "kind": "phrase"}], 0.0, 20.0, None, {0: "kota malam.mp4"})
    assert plan[0]["file"] == "kota malam.mp4"


def test_words_appear_one_by_one_at_their_spoken_time():
    b = {"start": 1.0, "end": 4.0, "lead": "", "main": "tiga hal", "kind": "phrase", "main_at": 1.0, "times": {"main": [1.0, 1.5]}}
    line = next(l for l in cinematic.overlay_ass({}, [b], 10).splitlines() if l.startswith("Dialogue"))
    assert line.count(r"\alpha&HFF&") == 2 and r"\t(0,110," in line and r"\t(500,610," in line
    assert "tiga" in line and "hal" in line


def test_edited_text_still_appears_word_by_word():
    b = {"start": 1.0, "end": 4.0, "lead": "", "main": "tiga hal penting", "kind": "phrase", "main_at": 1.0, "times": {"main": [1.0, 1.5]}}
    line = next(l for l in cinematic.overlay_ass({}, [b], 10).splitlines() if l.startswith("Dialogue"))
    assert line.count(r"\alpha&HFF&") == 3 and r"\t(440,550," in line


def test_highlight_color_is_validated_and_used():
    assert cinematic.ass_color("#F57C1A") == "&H1A7CF5&"
    assert cinematic.sanitize({"highlight": "#ff0000"})["highlight"] == "#FF0000"
    assert cinematic.sanitize({"highlight": "merah"})["highlight"] == cinematic.DEFAULT["highlight"]
    b = {"start": 1.0, "end": 4.0, "lead": "", "main": "kata", "kind": "phrase"}
    assert "&H0000FF&" in cinematic.overlay_ass({"highlight": "#FF0000"}, [b], 10)
    settings = cinematic.sanitize({"zoom": True, "glitch": True, "sfx": True})
    assert not {"zoom", "glitch", "sfx"} & set(settings)


def test_word_times_are_kept_and_shifted():
    words = [{"start": float(i), "end": i + 0.8, "text": t, "stop": False} for i, t in enumerate(["cuman", "tiga", "hal", "yang", "lu", "lakuin"])]
    b = cinematic._make_beat(words, 0, 1, 2, 5)
    assert b["times"] == {"lead": [0.0], "main": [1.0, 2.0], "tail": [3.0, 4.0, 5.0]}
    assert cinematic.relative_beats([b], 1.0, 30)[0]["times"]["main"] == [0.0, 1.0]
    assert cinematic.sanitize({"beats": [b]})["beats"][0]["times"]["tail"] == [3.0, 4.0, 5.0]
