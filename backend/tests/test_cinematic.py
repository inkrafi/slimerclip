import cinematic
import clip_effects


def word(text, start):
    return {"word": " " + text, "start": start, "end": start + 0.3}


WORDS = cinematic.flat_words([{"words": [word(t, i * 0.4) for i, t in enumerate(
    "entah itu pivot pendidikan saat usia 25 tahun.".split())]}])


def test_sanitize_drops_invalid_and_strips_ass_tags():
    clean = cinematic.sanitize({"enabled": True, "grade": 500, "name": "A{\\b1}B", "beats": [
        {"start": 2, "end": 3, "main": "dua", "kind": "aneh"},
        {"start": 1, "end": 2, "main": "x{\\fs200}y"},
        {"start": 5, "end": 4, "main": "mundur"},
        {"start": 6, "end": 7, "main": "  "},
        "bukan objek",
    ]})
    assert clean["grade"] == 100 and clean["name"] == "A b1 B".replace(" b1 ", " b1 ")
    assert "{" not in clean["name"] and "\\" not in clean["name"]
    assert [b["main"] for b in clean["beats"]] == ["x fs200 y", "dua"]   # urut waktu, yang tidak valid dibuang
    assert clean["beats"][1]["kind"] == "phrase"


def test_ai_indexes_keep_text_verbatim_and_reject_invalid():
    beats = cinematic.beats_from_indexes([
        {"start_word": 0, "main_word": 2, "end_word": 3},
        {"start_word": 1, "main_word": 1, "end_word": 2},     # tumpang tindih
        {"start_word": 4, "main_word": 5, "end_word": 99},    # di luar transkrip
        {"start_word": 4, "main_word": 3, "end_word": 5},     # urutan salah
        {"start_word": 4, "main_word": 6, "end_word": 7},
    ], WORDS)
    assert [(b["lead"], b["main"], b["kind"]) for b in beats] == [
        ("entah itu", "pivot pendidikan", "phrase"), ("saat usia", "25 tahun", "number")]


def test_local_beats_prefer_numbers_and_skip_filler():
    beats = cinematic.local_beats(WORDS)
    assert any(b["kind"] == "number" and b["main"].startswith("25") for b in beats)
    only_filler = cinematic.flat_words([{"words": [word("yang", 0), word("dan", 0.4)]}])
    assert cinematic.local_beats(only_filler) == []


def test_beats_do_not_overlap():
    beats = cinematic.local_beats(WORDS)
    for a, b in zip(beats, beats[1:]):
        assert a["end"] <= b["start"]


def test_filters_and_overlay():
    assert cinematic.grade_filter(0) is None and "colorbalance" in cinematic.grade_filter(70)
    beats = [{"start": i * 2.0, "end": i * 2.0 + 1.5, "lead": "", "main": "kata", "kind": "phrase"} for i in range(6)]
    chain = cinematic.zoom_filter([{"start": 2.0, "end": 4.0, "look": "zoom"}], 12, 1080, 1920)
    assert "zoompan" in chain and "s=1080x1920" in chain
    text = cinematic.overlay_ass({"name": "Budi", "role": "Founder"}, beats, 12)
    assert "Instrument Serif" in text and "Budi" in text and "Founder" in text
    assert cinematic.overlay_ass({}, [], 12) is None
    assert cinematic.number_text("20 sampai 25") == "20 — 25" and cinematic.number_text("25 tahun") == "25 tahun"


def test_relative_beats_follow_clip_range():
    beats = [{"start": 100, "end": 102, "lead": "", "main": "a", "kind": "phrase"},
             {"start": 150, "end": 152, "lead": "", "main": "b", "kind": "phrase"}]
    assert [b["main"] for b in cinematic.relative_beats(beats, 99, 10)] == ["a"]
    assert cinematic.relative_beats(beats, 99, 10)[0]["start"] == 1


def test_edit_recipe_and_template_keep_clip_text_separate():
    beat = {"start": 1, "end": 2, "lead": "", "main": "kata", "kind": "phrase"}
    edit = clip_effects.sanitize_edit({"cinematic": {"enabled": True, "name": "Budi", "beats": [beat]}}, 0, 60)
    assert edit["cinematic"]["enabled"] and edit["cinematic"]["beats"][0]["main"] == "kata"
    style = clip_effects.template_style(edit)
    assert style["cinematic"]["enabled"] and style["cinematic"]["beats"] == [] and style["cinematic"]["name"] == ""
    other = clip_effects.sanitize_edit({"cinematic": {"name": "Sari", "beats": [beat]}}, 0, 60)
    applied = clip_effects.apply_template(other, style, "", lambda name: True, None)
    assert applied["cinematic"]["enabled"] and applied["cinematic"]["name"] == "Sari" and applied["cinematic"]["beats"]
    # Resep lama tanpa field ini tetap aman dan mati
    assert clip_effects.sanitize_edit({}, 0, 60)["cinematic"]["enabled"] is False


def test_tidy_removes_weak_edges_and_stays_in_one_sentence():
    words = cinematic.flat_words([{"words": [word(t, i * 0.4) for i, t in enumerate(
        "saya lihat dia melotot dan . itu hampir musuh atau lawan jadi".split()) if t != "."]}])
    beats = cinematic.beats_from_indexes([{"start_word": 0, "main_word": 3, "end_word": 4},
                                          {"start_word": 5, "main_word": 5, "end_word": 7},
                                          {"start_word": 8, "main_word": 8, "end_word": 10}], words)
    assert [b["main"] for b in beats][0] == "melotot"
    assert "jadi" not in beats[-1]["main"] and beats[-1]["main"].startswith("lawan")
    filler = cinematic.flat_words([{"words": [word("dan", 0), word("itu", 0.4)]}])
    assert cinematic.beats_from_indexes([{"start_word": 0, "main_word": 0, "end_word": 1}], filler) == []


def test_fill_gaps_never_overlaps():
    words = cinematic.flat_words([{"words": [word(t, i * 0.5) for i, t in enumerate(
        "pelatihan hidup membedakan ancaman situasi tenang masa lalu dilatih musuh lawan melotot nada tinggi".split())]}])
    ai = cinematic.beats_from_indexes([{"start_word": 0, "main_word": 0, "end_word": 1},
                                       {"start_word": 12, "main_word": 12, "end_word": 13}], words)
    beats = cinematic.fill_gaps(ai, words)
    assert len(beats) > len(ai)
    for a, b in zip(beats, beats[1:]):
        assert a["end"] <= b["start"]


def _words(*items):
    return [{"start": float(i), "end": i + 0.8, "text": text, "stop": False} for i, text in enumerate(items)]


def test_tail_words_become_small_closing_line_and_reveal_in_order():
    words = _words("cuman", "tiga", "hal", "yang", "lu", "lakuin")
    beat = cinematic._make_beat(words, 0, 1, 2, 5)
    assert (beat["lead"], beat["main"], beat["tail"]) == ("cuman", "tiga hal", "yang lu lakuin")
    assert beat["main_at"] == 1.0 and beat["tail_at"] == 3.0 and beat["end"] == 5.8
    # Satu kata sisa tidak jadi baris sendiri
    short = cinematic._make_beat(_words("tiga", "hal", "ya"), 0, 0, 1, 2)
    assert "tail" not in short and short["end"] == 1.8
    moved = cinematic.relative_beats([beat], 1.0, 30)[0]
    assert moved["main_at"] == 0.0 and moved["tail_at"] == 2.0
    kept = cinematic.sanitize({"beats": [beat]})["beats"][0]
    assert kept["tail"] == "yang lu lakuin" and kept["tail_at"] == 3.0


def test_layouts_change_and_fit_the_text():
    beats = [{"start": 0, "end": 1, "lead": "a", "main": "kata", "kind": "phrase"} for _ in range(6)]
    assert len({cinematic.beat_layout(b, i) for i, b in enumerate(beats)}) >= 4
    assert cinematic.beat_layout({"lead": "", "main": "2022", "kind": "number"}, 0) == "hero"
    assert cinematic.beat_layout({"lead": "", "main": "dua kata", "kind": "phrase"}, 5) == "stack"
    assert cinematic.beat_layout({"lead": "", "main": "kata", "kind": "phrase"}, 2) == "serif"
    assert cinematic.beat_layout({"lead": "", "main": "teks yang sangat panjang", "kind": "phrase"}, 1) == "stack"


def test_each_line_appears_when_spoken_and_stays_in_frame():
    beat = {"start": 1.0, "end": 4.0, "lead": "cuman", "main": "tiga hal", "kind": "phrase", "tail": "yang lu lakuin", "main_at": 1.5, "tail_at": 2.5}
    text = cinematic.overlay_ass({}, [beat], 10)
    lines = [line for line in text.splitlines() if line.startswith("Dialogue")]
    assert len(lines) == 3
    assert ["0:00:01.00", "0:00:01.50", "0:00:02.50"] == [line.split(",")[1] for line in lines]
    assert all(line.split(",")[2] == "0:00:04.00" for line in lines) and all("alpha&HFF&" in line for line in lines)
    for index in range(6):
        tiers = cinematic.beat_tiers(beat, index, 1180, "S", "B", "I", 1)
        assert all(800 < tier["y"] < 1560 for tier in tiers) and [t["at"] for t in tiers] == [1.0, 1.5, 2.5]
