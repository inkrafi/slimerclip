import clip_effects
import cinematic
import cinematic_scenes as cs

LAYOUT = "[0:v]crop=608:1080:x='100':y=0,scale=@W@:@H@[vlayout]"


def beat(start, end, kind="phrase", main="kata"):
    return {"start": start, "end": end, "lead": "", "main": main, "kind": kind}


def test_sanitize_keeps_new_looks_and_drops_old_or_invalid():
    scenes = cs.sanitize([
        {"start": 1, "end": 3, "look": "landscape", "background": "black"},     # bentuk lama
        {"start": 5, "end": 8, "look": "zoom", "transition": "flash", "sfx": "whoosh"},
        {"start": 6, "end": 9, "look": "zoom"},                                  # tumpang tindih
        {"start": 10, "end": 10.2, "look": "zoom"},                              # terlalu pendek
        {"start": 13, "end": 15, "look": "broll"},                               # tanpa kata pencarian atau video
        {"start": 16, "end": 18, "look": "broll", "query": "city {\\night}", "transition": "aneh", "sfx": "aneh"},
        {"start": 20, "end": 24, "look": "motion", "motion": {"template": "number", "label": "Gaji", "value": 500}},
        {"start": 26, "end": 28, "look": "motion", "motion": {"template": "kinetic", "words": ["x"]}},  # bukan pilihan klip
        "bukan objek",
    ])
    assert [s["look"] for s in scenes] == ["zoom", "broll", "motion"]
    assert scenes[0]["transition"] == "flash" and scenes[0]["sfx"] == "whoosh"
    assert scenes[1]["transition"] == "" and scenes[1]["sfx"] == "" and "{" not in scenes[1]["query"]
    assert scenes[2]["motion"]["value"] == 500


def test_visual_from_unknown_host_is_rejected():
    scene = {"start": 1, "end": 4, "look": "broll", "query": "city",
             "visual": {"provider": "pixabay", "id": 1, "link": "https://evil.example/x.mp4"}}
    assert "visual" not in cs.sanitize([scene])[0]


def test_relative_trims_to_clip_range():
    scenes = [{"start": 100, "end": 103, "look": "zoom"}, {"start": 109.5, "end": 112, "look": "zoom"}]
    assert cs.relative(scenes, 98, 10) == [{"start": 2, "end": 5, "look": "zoom"}]


def test_plan_puts_motion_first_then_broll_then_zoom_in_empty_parts():
    beats = [beat(0.5, 2), beat(4, 6), beat(7, 9), beat(13, 15), beat(25, 27), beat(38, 40)]
    motion = {"template": "number", "label": "L", "value": 5}
    scenes = cs.plan(beats, 0, 45, {3: "city night"}, None, {1: motion})
    assert [s["look"] for s in scenes][:2] == ["motion", "broll"] and {s["look"] for s in scenes} == {"motion", "broll", "zoom"}
    assert scenes[0]["end"] - scenes[0]["start"] >= 3 and scenes[0]["transition"] == "flash"
    assert all(s["start"] >= 1.5 for s in scenes)
    for a, b in zip(scenes, scenes[1:]):
        assert b["start"] - a["end"] >= 1


def test_plan_uses_clip_start_for_the_opening():
    scenes = cs.plan([beat(1000.5, 1002), beat(1010, 1012)], 1000, 1030, {0: "kota", 1: "laut"})
    assert [s["start"] for s in scenes if s["look"] == "broll"] == [1010]


def test_motion_picks_must_be_spoken_and_limited(monkeypatch):
    import gemini_service
    beats = [beat(1, 2), beat(3, 4), beat(5, 6)]
    number = {"template": "number", "label": "L", "value": 500000, "prefix": "Rp"}
    monkeypatch.setattr(gemini_service, "_call_gemini", lambda *a, **k: {"picks": [
        {"beat": 0, "motion": {"template": "number", "label": "Karangan", "value": 999}},
        {"beat": 1, "motion": number},
        {"beat": 2, "motion": {"template": "kinetic", "words": ["x"]}},
        {"beat": 9, "motion": number},
    ]})
    assert cs.pick_motion(beats, 30, None, "sisanya 500 ribu doang") == {1: cs.motion_scenes.sanitize(number)}
    assert cs.pick_motion(beats, 30, None, "") == {}


def test_layers_keep_broll_in_frame_and_motion_full_screen():
    scenes = [{"start": 2, "end": 4, "look": "broll"}, {"start": 6, "end": 8, "look": "zoom"}, {"start": 10, "end": 14, "look": "motion"}]
    graph, label, inputs = cs.build_layers(scenes, {0: "stok.mp4"}, {2: "anim.mp4"}, "vin", 1080, 1920, 2, {"ratio": "landscape", "background": "black"})
    assert label == "smo0" and len(inputs) == 2
    assert "[2:v]scale=1080:606" in graph and "pad=1080:1920:0:657:black" in graph
    assert "[3:v]scale=1080:1920" in graph and "setpts=PTS-STARTPTS+10.000/TB" in graph and "between(t,10.000,14.000)" in graph
    assert "pad=" not in cs.build_layers(scenes, {0: "stok.mp4"}, {}, "vin", 1080, 1920, 2)[0]


def test_transitions_at_scene_edges_zoom_only_on_entry():
    scenes = [{"start": 2, "end": 4, "look": "broll", "transition": "glitch"}, {"start": 6, "end": 8, "look": "zoom", "transition": "glitch"},
              {"start": 10, "end": 12, "look": "motion", "transition": "flash"}, {"start": 14, "end": 16, "look": "broll", "transition": ""}]
    assert cs.transition_points(scenes, "glitch", 20) == [2, 4, 6]
    assert cs.transition_points(scenes, "flash", 20) == [10, 12]
    graph = cs.glitch_graph("vin", "vout", [3, 6], 1080, 1920)
    assert "rgbashift" in graph and graph.endswith("[vout]") and "between(t,2.880,3.120)" in graph
    assert cs.glitch_graph("vin", "vout", [], 1080, 1920) is None and cs.flash_filter([]) is None
    flash = cs.flash_filter([10])
    assert "white@0.9" in flash and "white@0.4" in flash and "between(t,9.970,10.040)" in flash


def test_each_scene_chooses_its_own_sound_on_entry_only():
    scenes = [{"start": 2, "end": 4, "look": "broll", "sfx": "whoosh"}, {"start": 6, "end": 8, "look": "zoom", "sfx": "flash"},
              {"start": 10, "end": 12, "look": "motion", "sfx": "glitch"}, {"start": 14, "end": 16, "look": "broll", "sfx": ""}]
    assert cs.transition_sfx(scenes, 20) == [("lib_wh_short_1.wav", 1.95), ("lib_shutter.wav", 5.95), ("lib_glitch.wav", 9.95)]
    assert all(name in clip_effects.SFX_LIBRARY for name in cs.SFX_ASSETS.values())


def test_text_is_hidden_during_full_screen_animation():
    scenes = [{"start": 2, "end": 5, "look": "motion"}]
    text = cinematic.overlay_ass({}, [beat(0.5, 1.5, main="satu"), beat(2.5, 4, main="dua")], 10, 1180, None, scenes)
    assert "satu" in text and "dua" not in text
    # Teks yang mulai sebelum animasi berhenti tepat saat animasi mulai
    running = cinematic.overlay_ass({}, [beat(1, 4, main="tiga")], 10, 1180, None, scenes)
    assert running.splitlines()[-1].split(",")[2] == "0:00:02.00"


def test_zoom_comes_from_scenes():
    assert cinematic.zoom_filter([{"start": 1, "end": 3, "look": "broll"}], 10, 1080, 1920) is None
    assert "zoompan" in cinematic.zoom_filter([{"start": 1, "end": 3, "look": "zoom"}], 10, 1080, 1920)


def test_edit_and_template_keep_scenes_with_the_clip():
    raw = {"cinematic": {"enabled": True, "highlight": "#ff0000", "scenes": [{"start": 1, "end": 4, "look": "zoom", "sfx": "whoosh"}]}}
    edit = clip_effects.sanitize_edit(raw, 0, 60)
    assert edit["cinematic"]["scenes"][0]["sfx"] == "whoosh" and edit["cinematic"]["highlight"] == "#FF0000"
    style = clip_effects.template_style(edit)
    assert style["cinematic"]["scenes"] == [] and style["cinematic"]["highlight"] == "#FF0000"
    assert clip_effects.apply_template(edit, style, "", lambda n: True, None)["cinematic"]["scenes"]


def test_motion_leftovers_are_cleaned_and_only_results_are_used(monkeypatch, tmp_path):
    class Done:
        stdout = "OK clipmotion_0"
    monkeypatch.setattr(cs.motion_scenes, "available", lambda: True)

    def fake_run(args, **kwargs):
        for name in ("clipmotion_0.mp4", "clipmotion_0-0.mp4", "clipmotion_0-audio.wav", "clipmotion_0-visuals.mp4", "lain.mp4"):
            (tmp_path / name).write_bytes(b"x")
        return Done()
    monkeypatch.setattr(cs.subprocess, "run", fake_run)
    scenes = [{"start": 1, "end": 4, "look": "motion", "motion": {"template": "number", "label": "L", "value": 5}},
              {"start": 6, "end": 9, "look": "motion", "motion": {"template": "number", "label": "L", "value": 6}}]
    paths = cs.render_motions(scenes, str(tmp_path), "#F57C1A")
    assert list(paths) == [0]
    assert sorted(p.name for p in tmp_path.iterdir()) == ["clipmotion_0.mp4", "lain.mp4"]
