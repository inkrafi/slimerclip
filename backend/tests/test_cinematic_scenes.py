import clip_effects
import cinematic
import cinematic_scenes as cs

LAYOUT = "[0:v]crop=608:1080:x='100':y=0,scale=@W@:@H@[vlayout]"


def beat(start, end, kind="phrase", main="kata"):
    return {"start": start, "end": end, "lead": "", "main": main, "kind": kind}


def test_sanitize_drops_invalid_overlaps_and_broll_without_source():
    scenes = cs.sanitize([
        {"start": 5, "end": 8, "look": "landscape", "background": "black"},
        {"start": 6, "end": 9, "look": "square"},                # tumpang tindih
        {"start": 1, "end": 1.2, "look": "card"},                # terlalu pendek
        {"start": 10, "end": 12, "look": "aneh"},
        {"start": 13, "end": 15, "look": "broll"},               # tanpa kata pencarian atau video
        {"start": 16, "end": 18, "look": "broll", "query": "city {\\night}"},
        "bukan objek",
    ])
    assert [s["look"] for s in scenes] == ["landscape", "broll"]
    assert scenes[0]["background"] == "black" and "{" not in scenes[1]["query"]


def test_visual_from_unknown_host_is_rejected():
    scene = {"start": 1, "end": 4, "look": "broll", "query": "city",
             "visual": {"provider": "pixabay", "id": 1, "link": "https://evil.example/x.mp4"}}
    assert "visual" not in cs.sanitize([scene])[0]


def test_relative_trims_to_clip_range():
    scenes = [{"start": 100, "end": 103, "look": "card", "background": "blur"},
              {"start": 109.5, "end": 112, "look": "card", "background": "blur"}]
    assert cs.relative(scenes, 98, 10) == [{"start": 2, "end": 5, "look": "card", "background": "blur"}]


def test_plan_prefers_numbers_then_broll_and_keeps_distance():
    beats = [beat(0.5, 2), beat(4, 6, "number", "25"), beat(7, 9), beat(13, 15), beat(25, 27), beat(38, 40)]
    scenes = cs.plan(beats, 0, 45, {3: "city night"})
    looks = {s["look"] for s in scenes}
    assert "card" in looks and "broll" in looks
    assert all(s["start"] >= 2.5 for s in scenes)
    for a, b in zip(scenes, scenes[1:]):
        assert b["start"] - a["end"] >= 3


def test_plan_uses_clip_start_for_the_opening():
    beats = [beat(1000.5, 1002, "number", "25"), beat(1010, 1012, "number", "30")]
    scenes = cs.plan(beats, 1000, 1030)
    assert [s["start"] for s in scenes] == [1010]


def test_layers_show_each_look_only_in_its_time():
    scenes = [{"start": 2, "end": 4, "look": "landscape", "background": "blur"},
              {"start": 8, "end": 10, "look": "landscape", "background": "blur"},
              {"start": 12, "end": 14, "look": "card", "background": "blur"},
              {"start": 16, "end": 18, "look": "broll", "background": "blur"}]
    graph, label, inputs = cs.build_layers(scenes, {3: "stok.mp4"}, "vin", LAYOUT, 1920, 1080, 1080, 1920, 20, 2, "kartu.png")
    assert "between(t,2.000,4.000)+between(t,8.000,10.000)" in graph
    assert label == "sbo0" and len(inputs) == 2
    assert "[2:v]overlay=0:0" in graph and "[3:v]scale=1080:1920" in graph
    assert "setpts=PTS-STARTPTS+16.000/TB" in graph


def test_boundaries_glitch_and_sfx():
    scenes = [{"start": 0, "end": 3, "look": "square", "background": "blur"},
              {"start": 6, "end": 9.9, "look": "card", "background": "blur"}]
    assert cs.boundaries(scenes, 10) == [3, 6]
    graph = cs.glitch_graph("vin", "vout", [3, 6], 1080, 1920)
    assert "rgbashift" in graph and graph.endswith("[vout]") and "between(t,2.880,3.120)" in graph
    assert cs.glitch_graph("vin", "vout", [], 1080, 1920) is None
    sounds = cs.transition_sfx(scenes, 10)
    assert len(sounds) == 2 and sounds[0][0] != sounds[1][0]
    assert all(name in clip_effects.SFX_LIBRARY for name in cs.WHOOSH)


def test_text_follows_the_scene_shape():
    scenes = [{"start": 2, "end": 5, "look": "landscape", "background": "blur"}]
    text = cinematic.overlay_ass({}, [beat(0.5, 1.5), beat(2.5, 4)], 10, 1180, None, scenes)
    assert r"\pos(540,1180)" in text and r"\pos(540,1420)" in text


def test_edit_and_template_keep_scenes_with_the_clip():
    raw = {"cinematic": {"enabled": True, "glitch": False, "scenes": [{"start": 1, "end": 4, "look": "card"}]}}
    edit = clip_effects.sanitize_edit(raw, 0, 60)
    assert edit["cinematic"]["scenes"][0]["look"] == "card" and edit["cinematic"]["glitch"] is False
    style = clip_effects.template_style(edit)
    assert style["cinematic"]["scenes"] == [] and style["cinematic"]["glitch"] is False
    assert clip_effects.apply_template(edit, style, "", lambda n: True, None)["cinematic"]["scenes"]
