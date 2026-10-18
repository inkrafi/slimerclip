from speaker_layout import SAMPLE_FPS, SpeakerLayoutPlanner

FACE = 100  # tinggi wajah (px) untuk data posisi


def run(start_s, end_s, kind, data=None):
    """Run tata letak dari detik ke detik (indeks sampel inklusif)."""
    return [int(start_s * SAMPLE_FPS), int(end_s * SAMPLE_FPS) - 1, kind, data]


def durations(runs):
    return [(r[2], (r[1] - r[0] + 1) / SAMPLE_FPS) for r in runs]


def test_short_runs_follow_previous_layout():
    p = SpeakerLayoutPlanner()
    runs = [
        run(0, 3, "zoom", (300, 200, FACE)),
        run(3, 3.4, "split", [(300, 200, FACE), (900, 200, FACE)]),   # 0.4 dtk → glitch
        run(3.4, 6, "zoom", (900, 200, FACE)),
    ]
    out = p._stabilize(runs)
    assert durations(out) == [("zoom", 3.4), ("zoom", 2.6)]


def test_short_first_run_joins_next():
    p = SpeakerLayoutPlanner()
    out = p._stabilize([run(0, 0.5, "center"), run(0.5, 4, "single", (500, 300, FACE))])
    assert durations(out) == [("single", 4.0)]


def test_same_framing_across_shot_cut_is_merged():
    p = SpeakerLayoutPlanner()
    runs = [run(0, 2, "single", (500, 300, FACE)), run(2, 5, "single", (520, 310, FACE))]
    assert durations(p._stabilize(runs)) == [("single", 5.0)]
    moved = [run(0, 2, "single", (500, 300, FACE)), run(2, 5, "single", (900, 300, FACE))]
    assert len(p._stabilize(moved)) == 2


def test_every_layout_lasts_at_least_one_second():
    p = SpeakerLayoutPlanner()
    kinds = ["zoom", "split", "zoom", "single", "split", "zoom"]
    data = {"zoom": (300, 200, FACE), "single": (700, 200, FACE),
            "split": [(300, 200, FACE), (900, 200, FACE)]}
    runs, t = [], 0.0
    for i, kind in enumerate(kinds * 3):
        length = 0.3 if i % 2 else 1.6
        runs.append(run(t, t + length, kind, data[kind]))
        t += length
    out = p._stabilize(runs)
    assert all(d >= 1.0 for _, d in durations(out))
    assert out[0][0] == 0 and out[-1][1] == runs[-1][1]           # tetap menutup seluruh klip
    assert all(a[1] + 1 == b[0] for a, b in zip(out, out[1:]))    # tanpa celah antar-run
