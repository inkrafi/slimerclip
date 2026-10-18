import re

from caption_service import CaptionService
from caption_styles import DEFAULT_STYLE, sanitize_caption_style


def words(*items):
    """(teks, mulai, selesai) → hasil Whisper satu segmen."""
    return [{"start": items[0][1], "end": items[-1][2], "text": "",
             "words": [{"word": f" {t}", "start": s, "end": e} for t, s, e in items]}]


def dialogues(tmp_path, segments, style=None):
    path = tmp_path / "c.ass"
    CaptionService().generate_ass(segments, str(path), style or {})
    return [l for l in path.read_text(encoding="utf-8").splitlines() if l.startswith("Dialogue:")]


def visible_text(line):
    return re.sub(r"\{[^}]*\}", "", line.split(",,0,0,0,,", 1)[1]).replace(r"\h", "")


def test_pages_split_by_word_count_pause_and_sentence(tmp_path):
    segs = words(("satu", 0, .3), ("dua", .3, .6), ("tiga", .6, .9), ("empat", .9, 1.2),   # 3 kata/halaman
                 ("lima.", 1.2, 1.5), ("enam", 1.5, 1.8),                                  # titik → halaman baru
                 ("tujuh", 3.0, 3.3))                                                      # jeda > 0.7 dtk
    pages = {visible_text(l) for l in dialogues(tmp_path, segs)}
    assert pages == {"SATU DUA TIGA", "EMPAT LIMA", "ENAM", "TUJUH"}


def test_active_word_is_highlighted(tmp_path):
    lines = dialogues(tmp_path, words(("halo", 0, .4), ("semua", .4, .8)), {"highlight_color": "#FF5FA2"})
    assert "&H00A25FFF" in lines[1].split("SEMUA")[0].rsplit("HALO", 1)[1]   # warna sorotan tepat sebelum kata aktif


def test_sanitize_rejects_bad_values_and_maps_legacy_options():
    style = sanitize_caption_style({"font": "Comic Sans", "size": 999, "color": "red", "position": "top",
                                    "highlight_mode": "none", "words_per_line": "4"})
    assert style["font"] == DEFAULT_STYLE["font"] and style["size"] == 200 and style["color"] == "#FFFFFF"
    assert style["position_y"] == 22 and style["highlight_style"] == "none" and style["words_per_line"] == 4
    assert sanitize_caption_style({"background": True, "highlight_style": "box"})["highlight_style"] == "color"
