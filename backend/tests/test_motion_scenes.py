import longform
import motion_scenes as ms


def narration(text="Kalimat narasi.", **extra):
    return {"id": "s1", "kind": "narration", "text": text, "chapter": "", **extra}


def test_sanitize_each_template_and_reject_incomplete():
    assert ms.sanitize(None) is None and ms.sanitize({"template": "aneh"}) is None
    assert ms.sanitize({"template": "kinetic", "words": []}) is None
    kinetic = ms.sanitize({"template": "kinetic", "lead": "a{\\b1}", "words": ["satu", "dua", "tiga", "empat"], "note": "n"})
    assert kinetic["words"] == ["satu", "dua", "tiga"] and "{" not in kinetic["lead"]
    assert ms.sanitize({"template": "data", "title": "T", "values": [1]}) is None
    data = ms.sanitize({"template": "data", "title": "T", "values": [100, "83.5", "x"], "prefix": "Rp"})
    assert data["values"] == [100, 83.5]
    assert ms.sanitize({"template": "compare", "left": {"title": "A", "items": ["x"]}}) is None
    assert ms.sanitize({"template": "flow", "title": "T", "steps": [{"head": "a"}]}) is None
    assert len(ms.sanitize({"template": "flow", "title": "T", "steps": [{"head": str(i)} for i in range(6)]})["steps"]) == 4


def test_chart_numbers_must_be_in_the_narration():
    motion = ms.sanitize({"template": "data", "title": "T", "values": [100, 74]})
    assert ms.values_in_text(motion, "Dari 100 juta tinggal 74 juta.")
    assert not ms.values_in_text(motion, "Dari 100 juta tinggal sedikit.")
    assert ms.values_in_text(ms.sanitize({"template": "data", "title": "T", "values": [3.5, 2]}), "naik dari 2 ke 3,5 persen")


def test_apply_picks_skips_invalid_adjacent_and_quotes():
    scenes = [narration("satu"), {"id": "q", "kind": "quote", "text": "kutipan"}, narration("dua"), narration("tiga 10 dan 20"), narration("empat")]
    pick = {"template": "kinetic", "words": ["kata"]}
    added = ms.apply_picks(scenes, [
        {"scene": 0, "motion": pick},
        {"scene": 1, "motion": pick},                                                     # berurutan dengan adegan 0
        {"scene": 2, "motion": {"template": "data", "title": "T", "values": [10, 99]}},   # 99 tidak diucapkan
        {"scene": 3, "motion": pick},
        {"scene": 9, "motion": pick},
        "bukan objek",
    ])
    assert added == 2 and "motion" in scenes[0] and "motion" not in scenes[1] and "motion" not in scenes[3] and "motion" in scenes[4]


def test_sanitize_scenes_keeps_motion_on_narration_only():
    raw = [{"kind": "narration", "text": "teks", "motion": {"template": "kinetic", "words": ["a"]}},
           {"kind": "narration", "text": "teks", "motion": {"template": "aneh"}},
           {"kind": "quote", "start": 1, "end": 8, "text": "q", "motion": {"template": "kinetic", "words": ["a"]}}]
    scenes = longform.sanitize_scenes(raw, None, 100)
    assert scenes[0]["motion"]["template"] == "kinetic" and scenes[1].get("motion") is None and "motion" not in scenes[2]


def test_overlays_without_template_install_return_nothing(tmp_path, monkeypatch):
    monkeypatch.setattr(ms, "available", lambda: False)
    assert ms.render_overlays([{"id": "a", "motion": {"template": "kinetic", "words": ["a"]}, "seconds": 5}], str(tmp_path)) == {}


def test_transition_plan_skips_scenes_too_short():
    overlaps = longform.transition_overlaps([5.0, 5.0, 0.7, 5.0])
    assert overlaps[0] == longform.TRANSITION_SECONDS
    assert overlaps[1] == 0 and overlaps[2] == 0     # adegan 0,7 detik terlalu pendek untuk transisi
    assert longform.transition_overlaps([5.0]) == []


def test_snap_frames_lands_on_the_frame_grid():
    assert longform.snap_frames(6.35) == 191 / longform.FPS
    assert longform.snap_frames(2.0) == 2.0


def test_script_prompt_treats_podcast_as_research():
    assert "bahan riset" in longform.SCRIPT_PROMPT
    assert longform.SCRIPT_SHAPE[5][2] <= 2 and longform.SCRIPT_SHAPE[12][2] <= 3
