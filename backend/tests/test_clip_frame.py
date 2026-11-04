import clip_effects
import clip_frame

LAYOUT = "[0:v]split=2[s0][s1];[s0]crop=608:1080:x='if(lt(t,3),494,700)':y=0,scale=@W@:@H@[bfull];[bfull]null[vlayout]"


def test_sanitize_defaults_to_full_and_rejects_unknown():
    assert clip_frame.sanitize(None) == {"ratio": "full", "background": "blur"}
    assert clip_frame.sanitize({"ratio": "4:3", "background": "merah"}) == {"ratio": "full", "background": "blur"}
    assert clip_frame.sanitize({"ratio": "square", "background": "black"}) == {"ratio": "square", "background": "black"}
    assert clip_frame.sanitize({"ratio": "portrait"})["ratio"] == "portrait"
    assert not clip_frame.is_framed({"ratio": "full"}) and clip_frame.is_framed({"ratio": "landscape"})


def test_foreground_size_keeps_ratio_and_even_numbers():
    assert clip_frame.foreground_size({"ratio": "portrait"}, 1080) == (1080, 1440)
    assert clip_frame.foreground_size({"ratio": "square"}, 1080) == (1080, 1080)
    assert clip_frame.foreground_size({"ratio": "landscape"}, 1080) == (1080, 606)
    assert clip_frame.foreground_size({"ratio": "landscape"}, 720) == (720, 404)


def test_square_follows_the_speaker_from_layout():
    graph = clip_frame.build_graph({"ratio": "square", "background": "black"}, LAYOUT, 1920, 1080, 1080, 1920)
    assert "crop=1080:1080" in graph and "if(lt(t,3),494,700)" in graph and "clip(" in graph
    assert "color=c=black:s=1080x1920" in graph and "overlay=0:420" in graph and graph.endswith("[vlayout]")


def test_portrait_follows_the_speaker_and_is_centered():
    graph = clip_frame.build_graph({"ratio": "portrait", "background": "blur"}, LAYOUT, 1920, 1080, 1080, 1920)
    assert "crop=810:1080" in graph and "if(lt(t,3),494,700)" in graph
    assert "scale=1080:1440" in graph and "overlay=0:240" in graph


def test_landscape_on_16_9_source_needs_no_horizontal_tracking():
    graph = clip_frame.build_graph({"ratio": "landscape", "background": "blur"}, LAYOUT, 1920, 1080, 1080, 1920)
    assert "crop=1920:1080:x='0'" in graph and "boxblur" in graph and "color=" not in graph
    assert "overlay=0:657" in graph


def test_layout_without_tracking_is_centered():
    graph = clip_frame.build_graph({"ratio": "square", "background": "black"}, "[0:v]crop=608:1080:0:0[vlayout]", 1920, 1080, 1080, 1920)
    assert "x='420'" in graph


def test_vertical_source_crops_height():
    graph = clip_frame.build_graph({"ratio": "landscape", "background": "black"}, LAYOUT, 1080, 1920, 1080, 1920)
    assert "crop=1080:606:x='0':y=657" in graph


def test_zoom_goes_to_the_foreground_only():
    graph = clip_frame.build_graph({"ratio": "square", "background": "blur"}, LAYOUT, 1920, 1080, 1080, 1920, "zoompan=z='1'")
    fg, bg = graph.split(";")[:2]
    assert "zoompan" in fg and "zoompan" not in bg


def test_edit_recipe_and_template_carry_the_frame():
    edit = clip_effects.sanitize_edit({"frame": {"ratio": "square", "background": "black"}}, 0, 60)
    assert edit["frame"] == {"ratio": "square", "background": "black"}
    assert clip_effects.sanitize_edit({}, 0, 60)["frame"]["ratio"] == "full"
    style = clip_effects.template_style(edit)
    assert style["frame"]["ratio"] == "square"
    applied = clip_effects.apply_template(clip_effects.sanitize_edit({}, 0, 60), style, "", lambda name: True, None)
    assert applied["frame"]["ratio"] == "square"
