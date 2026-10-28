import re

import clip_profile
import script_fonts
from caption_service import CaptionService
from prompt_templates import clip_analysis_schema, get_clip_analysis_prompt, target_segment_count
from speaker_layout import SpeakerLayoutPlanner, sized


def test_script_detection():
    assert script_fonts.detect("Gaji naik tapi tetap bokek") is None
    assert script_fonts.detect("これは本当に大事な話です") == "ja"       # kana + kanji → Jepang
    assert script_fonts.detect("这是非常重要的事情") == "zh"
    assert script_fonts.detect("이것은 정말 중요합니다") == "ko"
    assert script_fonts.detect("هذا مهم جدا") == "ar"
    assert script_fonts.detect("สวัสดีครับ") == "th"
    assert script_fonts.detect("यह बहुत जरूरी है") == "hi"
    assert script_fonts.detect("OK これ") == "ja"                         # campuran, aksara non-Latin ≥20%


def _words(*items):
    return [{"start": a, "end": b, "word": w} for a, b, w in items]


def test_srt_lines_split_at_sentences_and_pauses(tmp_path):
    segments = [{"words": _words((0.0, 0.4, " Halo"), (0.5, 0.9, " semua."), (1.0, 1.3, " Hari"), (1.4, 1.8, " ini"),
                                 (3.0, 3.4, " kita"), (3.5, 3.9, " bahas"))}]
    path = CaptionService().write_srt(segments, str(tmp_path / "a.srt"))
    text = open(path, encoding="utf-8").read()
    blocks = text.strip().split("\n\n")
    assert len(blocks) == 3                     # pisah di "semua." dan di jeda 1,2 dtk
    assert blocks[0].splitlines() == ["1", "00:00:00,000 --> 00:00:01,000", "Halo semua."]
    assert blocks[2].endswith("kita bahas")
    assert re.match(r"2\n00:00:01,000 --> 00:00:02,100\n", blocks[1])


def test_srt_japanese_has_no_spaces(tmp_path):
    segments = [{"words": _words((0.0, 0.3, "これ"), (0.3, 0.6, "は"), (0.6, 1.0, "大事"), (1.0, 1.4, "です。"))}]
    text = open(CaptionService().write_srt(segments, str(tmp_path / "j.srt")), encoding="utf-8").read()
    assert "これは大事です。" in text


def test_gaming_layout_puts_facecam_below_and_avoids_it():
    # Facecam kiri bawah (wajah tinggi 120 px di 1920x1080)
    graph = sized(SpeakerLayoutPlanner.gaming_graph(1920, 1080, cx=200, cy=850, fh=120), 1080, 1920)
    game, cam = re.findall(r"crop=(\d+):(\d+):(\d+):(\d+)", graph)
    gw, gh, gx, _ = map(int, game)
    cw, ch, cx, cy = map(int, cam)
    assert "scale=1080:1152" in graph and "scale=1080:768" in graph and "vstack=2" in graph
    assert abs(gw / gh - 1080 / 1152) < 0.01 and abs(cw / ch - 1080 / 768) < 0.02
    assert cx <= 200 <= cx + cw and cy <= 850 <= cy + ch      # wajah ada di crop facecam
    assert gx >= cx + cw or gx + gw <= cx                      # gameplay tidak ikut memuat facecam


def test_exact_clip_count_prompt_and_schema():
    profile = {"clip_count": 15}
    assert target_segment_count(3600, profile) == 15
    assert target_segment_count(300, {"clip_count": 20}) == 10        # video 5 menit hanya muat 10x30 dtk
    prompt = get_clip_analysis_prompt(15, profile)
    assert "TEPAT 15 momen" in prompt and "LEBIH BAIK SEDIKIT" not in prompt
    assert "LEBIH BAIK SEDIKIT" in get_clip_analysis_prompt(10)
    assert clip_analysis_schema(15, True)["properties"]["segments"]["minItems"] == 5
    assert clip_profile.ask_count(profile, 3600) == 18 and clip_profile.ask_count({}, 3600) == 12
    assert clip_analysis_schema(15)["properties"]["segments"]["minItems"] == 3
    assert clip_profile.sanitize({"clip_count": 12})["clip_count"] == "auto"   # pilihan lama tidak berlaku lagi
    assert clip_profile.sanitize({"clip_count": 20})["clip_count"] == 20


def test_looser_schema_steps_down_from_large_counts():
    from gemini_service import _looser_schema
    schema = clip_analysis_schema(20, True)
    schema = {**schema, "properties": {**schema["properties"],
                                       "segments": {**schema["properties"]["segments"], "minItems": 20}}}
    step1 = _looser_schema(schema)
    assert step1["properties"]["segments"]["minItems"] == 12
    assert _looser_schema(step1)["properties"]["segments"]["minItems"] == 5


def test_srt_joins_punctuation_tokens():
    assert CaptionService.join_words(["COVID", "-19", "di", "tahun", "2020", ","]) == "COVID-19 di tahun 2020,"
    assert CaptionService.join_words(["これ", "は"], "") == "これは"


def test_caption_glue_tokens_stay_with_previous_word(tmp_path):
    words = [(0.0, 0.4, " Kemudian"), (0.5, 0.9, " juga"), (1.0, 1.4, " COVID"), (1.4, 1.7, "-19"), (1.8, 2.2, " di")]
    segments = [{"words": [{"start": a, "end": b, "word": w} for a, b, w in words]}]
    out = tmp_path / "c.ass"
    CaptionService().generate_ass(segments, str(out), {"words_per_line": 3, "uppercase": False})
    lines = [re.sub(r"\{[^}]*\}", "", line.split(",,", 1)[1]) for line in out.read_text(encoding="utf-8").splitlines()
             if line.startswith("Dialogue")]
    assert any("COVID-19" in line for line in lines)              # menempel, walau melewati batas 3 kata
    assert not any(line.startswith("-19") for line in lines)       # tidak memulai halaman sendiri
