import cv2

import clip_effects
from clip_effects import marks_layout, sanitize_edit, sanitize_transcript


def test_sanitize_edit_defaults_and_clamps():
    edit = sanitize_edit({"start": -5, "end": 99999, "vignette": {"shape": "bottom", "strength": 300, "height": 2},
                          "marks": {"logo": {"enabled": True, "asset": "../.env"}},
                          "music": {"asset": "a1b2c3d4_lagu.mp3", "volume": 150}}, 100, 160, 1200)
    assert edit["start"] == 0 and edit["end"] == clip_effects.MAX_CLIP_SECONDS
    assert edit["vignette"] == {"shape": "bottom", "strength": 100, "height": 10}
    # Logo dengan nama aset tidak aman → mati
    assert edit["marks"]["logo"]["enabled"] is False and edit["marks"]["logo"]["asset"] == ""
    assert edit["music"] == {"asset": "a1b2c3d4_lagu.mp3", "volume": 100, "ducking": True}


def test_sanitize_edit_rejects_too_short_range():
    edit = sanitize_edit({"start": 50, "end": 51}, 100, 160)
    assert (edit["start"], edit["end"]) == (100, 160)


def test_legacy_recipe_is_migrated():
    edit = sanitize_edit({"vignette": 40, "watermark": {"kind": "text", "text": "@akun", "position": "bl"}}, 0, 60)
    assert edit["vignette"]["shape"] == "radial" and edit["vignette"]["strength"] == 40
    assert edit["marks"]["account"] == {"enabled": True, "text": "@akun", "position": "bl", "size": 16, "opacity": 85}


def test_marks_text_strips_ass_tags_and_stacks():
    edit = sanitize_edit({"marks": {
        "logo": {"enabled": True, "asset": "a1b2c3d4_logo.png", "position": "tr", "size": 20},
        "account": {"enabled": True, "text": r"{\b1}@akun", "position": "tr"},
        "source": {"enabled": True, "text": "Sumber: YouTube", "position": "tr"},
    }}, 0, 60)
    assert edit["marks"]["account"]["text"] == "b1@akun"
    layout = marks_layout(edit["marks"], logo_aspect=0.5)
    assert [i["kind"] for i in layout] == ["logo", "account", "source"]
    # Logo 216×108 di tepi; teks akun di bawahnya, teks sumber di bawah teks akun
    assert layout[0]["offset"] == clip_effects.MARGIN_Y
    assert layout[1]["offset"] == clip_effects.MARGIN_Y + 108 + clip_effects.STACK_GAP
    assert layout[2]["offset"] > layout[1]["offset"]
    ass = clip_effects.marks_ass(edit["marks"], layout, 60, "Poppins SemiBold")
    assert ass.count("Dialogue:") == 2 and r"{\b1}" not in ass


def test_shade_png(tmp_path):
    path = str(tmp_path / "shade.png")
    assert clip_effects.write_shade_png({"shape": "bottom", "strength": 100, "height": 50}, 54, 96, path)
    alpha = cv2.imread(path, cv2.IMREAD_UNCHANGED)[:, 0, 3]
    assert alpha[0] == 0 and alpha[40] == 0 and alpha[-1] > 220 and alpha[70] < alpha[90]
    assert not clip_effects.write_shade_png({"shape": "radial", "strength": 50, "height": 50}, 54, 96, path)


def test_sanitize_transcript():
    segs = sanitize_transcript([
        {"words": [{"start": 10.5, "end": 10.9, "word": " halo"}, {"start": 11, "end": 11.2, "word": "semua"}]},
        {"words": [{"start": 5, "end": 6, "word": "   "}]},  # kosong → dibuang
    ])
    assert segs == [{"start": 10.5, "end": 11.2, "text": "halo semua",
                     "words": [{"start": 10.5, "end": 10.9, "word": " halo"}, {"start": 11.0, "end": 11.2, "word": "semua"}]}]
    assert sanitize_transcript("bukan list") is None


def test_audio_graph():
    music = {"volume": 50, "ducking": True}
    graph = clip_effects.audio_graph(music, 2, [(3, 4.5, 80)], 30, True, "aout")
    assert "[2:a]" in graph and "sidechaincompress" in graph and "adelay=4500|4500" in graph
    assert "amix=inputs=3" in graph and graph.endswith("[aout]")
    # Tanpa musik & efek: tidak perlu dicampur
    assert clip_effects.audio_graph(music, None, [], 30, True, "aout") is None
    # Video tanpa audio: alas hening + efek suara
    assert "anullsrc" in clip_effects.audio_graph(music, None, [(1, 0, 100)], 30, False, "aout")


def test_sfx_sanitized_and_sorted():
    edit = sanitize_edit({"sfx": [{"asset": "a1b2c3d4_b.wav", "at": 20, "volume": 50},
                                  {"asset": "a1b2c3d4_a.mp3", "at": 12},
                                  {"asset": "logo.png", "at": 1}]}, 0, 60)
    assert [s["at"] for s in edit["sfx"]] == [12, 20] and edit["sfx"][0]["volume"] == 80


def test_hook_sanitized_and_rendered():
    edit = sanitize_edit({"hook": {"enabled": True, "text": "Baris {satu}\nbaris dua\n\nbaris tiga\nempat", "duration": 99,
                                   "style": "x", "font": "comic-sans"}}, 0, 30)
    hook = edit["hook"]
    assert hook["text"] == "Baris satu\nbaris dua\nbaris tiga" and hook["duration"] == 60
    assert hook["style"] == "spotlight" and hook["font"] == "montserrat" and hook["anim"] == "pop"
    ass = clip_effects.hook_ass(hook, 30, "Montserrat Black")
    assert r"Baris satu\Nbaris dua\Nbaris tiga" in ass and ",0:00:30.00,Hook," in ass  # durasi dipotong ke panjang klip
    assert clip_effects.hook_ass({**hook, "enabled": False}, 30, "Montserrat Black") is None


def test_hook_emphasis_label_and_styles():
    hook = sanitize_edit({"hook": {"enabled": True, "text": "Kenapa *selalu kalah*?", "label": "pov {x}\n*",
                                   "style": "poster", "anim": "type", "accent": "lime"}}, 0, 30)["hook"]
    assert hook["label"] == "pov x" and hook["accent"] == "lime"
    assert clip_effects.hook_tokens(hook["text"], True) == [[("KENAPA", False), ("SELALU", True), ("KALAH?", True)]]
    ass = clip_effects.hook_ass(hook, 30, "Montserrat Black")
    # Label sebagai pil terpisah di atas teks; kata penekanan diberi warna putih (gaya poster)
    assert ",HookLabel,,0,0,0,," in ass and "POV X" in ass
    assert r"\c&H00FFFFFF" in ass and "SELALU" in ass and r"\t(0,60," in ass
    label_y, main_y = clip_effects.hook_block_top(hook)
    assert label_y < main_y
    for style in clip_effects.HOOK_STYLES:
        assert clip_effects.hook_ass({**hook, "style": style}, 30, "Montserrat Black")


def test_template_style_keeps_look_only():
    style = clip_effects.template_style({
        "start": 10, "end": 50, "sfx": [{"asset": "lib_pop.wav", "at": 12, "volume": 80}],
        "vignette": {"shape": "top", "strength": 55},
        "hook": {"enabled": True, "text": "teks khas klip", "style": "tape", "label": "POV"},
    })
    assert set(style) == {"vignette", "marks", "music", "hook"}
    assert style["vignette"]["shape"] == "top" and style["vignette"]["strength"] == 55
    assert style["hook"]["enabled"] is True and style["hook"]["text"] == "" and style["hook"]["style"] == "tape"


def test_layout_template_sizes():
    from speaker_layout import SpeakerLayoutPlanner, sized
    graph = sized(SpeakerLayoutPlanner.center_graph(1920, 1080), 2160, 3840)
    assert "scale=2160:3840:flags=lanczos" in graph and "@" not in graph
