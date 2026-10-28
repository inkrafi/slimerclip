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
    assert graph.count("loudnorm") == 1 and "dynaudnorm" in graph   # suara asli selalu dinormalisasi
    # Tanpa musik & efek: suara asli tetap diratakan levelnya & dinormalisasi
    plain = clip_effects.audio_graph(music, None, [], 30, True, "aout")
    assert "dynaudnorm" in plain and "loudnorm=I=-14" in plain and plain.endswith("[aout]")
    # Tanpa audio sama sekali: tidak ada graph
    assert clip_effects.audio_graph(music, None, [], 30, False, "aout") is None
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
    assert hook["style"] == "spotlight" and hook["font"] == "montserrat" and hook["anim"] == "cut"
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


def test_hook_shade_fades_with_hook():
    edit = clip_effects.sanitize_edit({"hook": {"enabled": True, "text": "Kenapa dia *nolak*?", "duration": 4}}, 0, 30)
    hook = edit["hook"]
    assert hook["shade"] == 85 and hook["anim"] == "cut"
    assert clip_effects.hook_shade(hook) == {"shape": "bottom", "strength": 85, "height": clip_effects.HOOK_SHADE_HEIGHT}
    assert r"\fad(0,500)" in clip_effects.hook_ass(hook, 30, "Montserrat Black")
    graph = clip_effects.hook_shade_filter(2, "vshade", "vhookshade", clip_effects.hook_end(hook, 30), 30)
    assert "fade=t=out:st=3.50:d=0.5:alpha=1" in graph and graph.endswith("[vhookshade]")
    # Hook sepanjang klip → bayangan tidak memudar; shade 0 → tanpa bayangan
    assert "t=out" not in clip_effects.hook_shade_filter(2, "a", "b", 30, 30)
    assert clip_effects.hook_shade({**hook, "shade": 0}) is None


def test_thumbnail_text_and_size():
    import thumbnail
    assert thumbnail.clean_text("a\n\nb\nc\nd {x}") == "a\nb\nc"
    # Kata pendek → teks lebih besar; batas 130-260
    assert thumbnail.text_size("*NGAKU*") == 260 and thumbnail.text_size("Gaji 2 juta bisa beli rumah?") == 153
    assert thumbnail.text_size("Ditolak\n1 MILIAR") > thumbnail.text_size("Ditolak 1 MILIAR")


def test_duo_caption_emphasis():
    from caption_styles import emphasis_index, sanitize_caption_style
    assert emphasis_index(["Ini", "penting"]) == 1
    assert emphasis_index(["banget", "yang"]) == 0      # kata sambung tidak ditonjolkan
    assert emphasis_index(["dan", "yang"]) == 1
    style = sanitize_caption_style({"mode": "duo", "accent_font": "dmserif"})
    assert style["mode"] == "duo" and style["accent_font"] == "dmserif"
    assert sanitize_caption_style({"mode": "x", "accent_font": "comic"})["mode"] == "karaoke"


def test_duo_reveal_and_stack(tmp_path):
    from caption_service import CaptionService
    segs = [{"words": [{"start": 0, "end": .5, "word": "Ini"}, {"start": .6, "end": 1.2, "word": "penting"}]}]
    path = tmp_path / "c.ass"
    CaptionService.__new__(CaptionService).generate_ass(
        segs, str(path), {"mode": "duo", "words_per_line": 2, "reveal": True, "stack": True, "outline_width": 0})
    events = [l for l in path.read_text(encoding="utf-8").splitlines() if l.startswith("Dialogue")]
    # Satu event per kata; kata yang belum diucapkan disembunyikan, lalu memudar masuk
    assert len(events) == 2 and r"\1a&HFF&" in events[0] and r"\t(0,100,\1a&H00&" in events[1]
    assert r"INI\N{" in events[0]  # kata utama di baris sendiri
    assert CaptionService.duo_lines(["a", "b", "c"], 1, True) == [[0], [1], [2]]
    assert CaptionService.duo_lines(["a", "b"], 0, False) == [[0, 1]]


def test_upload_kit_from_analysis_and_fallback():
    import upload_kit
    kit = upload_kit.build({"title_options": ["Dulu Sopir *Angkot*, Sekarang Kaya! 🔥", "Kenapa Dia Nolak 1 Miliar?"],
                            "upload_description": "Kisah jatuh bangun sebelum sukses. #bisnis",
                            "hashtags": ["Bisnis", "#cerita sukses", "#bisnis", "#kaya"]},
                           "Dulu Sopir Angkot, Sekarang Kaya!", [])
    assert kit["titles"] == ["Dulu Sopir Angkot, Sekarang Kaya!", "Kenapa Dia Nolak 1 Miliar?"]
    assert kit["hashtags"] == ["#bisnis", "#ceritasukses", "#kaya"]
    assert kit["description_full"] == "Kisah jatuh bangun sebelum sukses.\n\n#bisnis #ceritasukses #kaya"

    # Analisis lama: judul + ide hook, topik + kutipan, hashtag dari caption / sudut konten
    old = upload_kit.build({"speaker_quote": "Waktu itu nggak bisa dibeli", "content_angle": "INSPIRASI",
                            "caption_suggestion": "Waktu itu mahal #motivasi"},
                           "Musuh terbesar manusia", ["Musuhmu *bukan* elit global", "musuh terbesar manusia"],
                           "Pembicara membahas waktu sebagai aset utama")
    assert old["titles"] == ["Musuh terbesar manusia", "Musuhmu bukan elit global"]
    assert old["description"] == "Pembicara membahas waktu sebagai aset utama. “Waktu itu nggak bisa dibeli”"
    assert old["hashtags"] == ["#motivasi", "#inspirasi", "#podcast"]


def test_prompt_segment_range_and_categories():
    import niche
    from prompt_templates import clip_analysis_schema, get_clip_analysis_prompt
    prompt = get_clip_analysis_prompt(12)
    assert "maksimal 12 momen (minimal 3)" in prompt and "{" + "MIN}" not in prompt and "{TYPE_BLOCK}" not in prompt
    assert "30-65 detik" in prompt and "bahasa Indonesia" in prompt
    assert clip_analysis_schema(12)["properties"]["segments"]["minItems"] == 3
    assert clip_analysis_schema(2)["properties"]["segments"]["minItems"] == 2
    # Profil: tipe & bahasa ditentukan admin
    custom = get_clip_analysis_prompt(5, {"video_type": "gaming", "source_language": "en", "output_language": "same",
                                          "duration": "short"})
    assert "STREAMING GAME" in custom and "PODCAST" not in custom and "15-35 detik" in custom
    assert "berbahasa Inggris" in custom and "BAHASA YANG SAMA" in custom
    auto = get_clip_analysis_prompt(5)
    assert "STREAMING GAME" in auto and "PODCAST" in auto      # otomatis: semua panduan tipe disertakan
    assert "category" in clip_analysis_schema(5)["properties"]["segments"]["items"]["required"]
    assert niche.normalize_category(" Investasi ") == "investasi" and niche.normalize_category("gosip") == "lainnya"
