from scoring import drop_overlaps, duration_fit, extend_short, score_segments


def seg(start, end, score):
    return {"start_time": start, "end_time": end, "viral_score": score, "duration_seconds": 0}


def spans(segments):
    return sorted((s["start_time"], s["end_time"]) for s in segments)


def lines_every(seconds, until):
    """Transkrip tiruan: satu kalimat setiap `seconds` detik."""
    return [(float(t), float(t + seconds), "kalimat") for t in range(0, until, seconds)]


def test_overlapping_moment_is_trimmed_not_dropped():
    out = drop_overlaps([seg("10:00", "11:00", 90), seg("10:40", "12:00", 80)])
    assert spans(out) == [("10:00", "11:00"), ("11:00", "12:00")]


def test_trimmed_below_minimum_is_dropped():
    out = drop_overlaps([seg("10:00", "11:00", 90), seg("10:40", "11:20", 80)])  # sisa 20 dtk
    assert spans(out) == [("10:00", "11:00")]


def test_small_overlap_is_tolerated():
    out = drop_overlaps([seg("10:00", "10:50", 90), seg("10:48", "11:40", 80)])
    assert spans(out) == [("10:00", "10:50"), ("10:48", "11:40")]


def test_moment_containing_another_keeps_longer_side():
    out = drop_overlaps([seg("10:30", "10:50", 90), seg("09:30", "11:50", 80)])
    assert spans(out) == [("09:30", "10:30"), ("10:30", "10:50")]


def test_short_moment_extended_to_minimum_at_line_end():
    start, end = extend_short(100.0, 120.0, lines_every(4, 600), 600)
    assert start == 100.0 and end >= 130.0 and end % 4 == 0
    start, end = extend_short(100.0, 120.0, lines_every(4, 600), 600, min_len=45)
    assert end >= 145.0


def test_short_moment_near_video_end_extends_backwards():
    start, end = extend_short(580.0, 600.0, lines_every(4, 600), 600)
    assert end == 600 and end - start >= 30


def test_scored_segments_follow_profile_duration():
    import clip_profile
    raw = [{"start_time": "01:00", "end_time": "01:20", "score_breakdown": {"hook": 20}},
           {"start_time": "05:00", "end_time": "07:00", "score_breakdown": {"hook": 15}}]
    out = score_segments(raw, lines_every(4, 900), [], 900)
    assert len(out) == 2 and all(30 <= s["duration_seconds"] <= 65 for s in out)   # default 30-65 dtk
    short = score_segments(raw, lines_every(4, 900), [], 900, clip_profile.DURATIONS["short"])
    assert all(15 <= s["duration_seconds"] <= 35 for s in short)
    assert duration_fit(40) == 100 and duration_fit(40, clip_profile.DURATIONS["long"]) < 100
