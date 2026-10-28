import time

import performance as P


def _review(rid, name, created, publish, preset=""):
    return {"id": rid, "client_name": name, "preset_id": preset, "created_at": created,
            "items": [{"video_id": "vid00000001", "key": k.split("|")[1]} for k in publish] or [{"video_id": "vid00000001", "key": "a"}],
            "decisions": {}, "publish": publish}


def test_client_key_and_links():
    assert P.client_key({"preset_id": "abcdef123456"}) == "p_abcdef123456"
    assert P.client_key({"client_name": "Podcast Pak Budi!"}) == "n_podcast-pak-budi"
    review = _review("r1", "Budi", 0, {"vid00000001|a": [{"url": "https://youtube.com/shorts/x", "platform": "youtube", "at": 5}]})
    links = P.collect_links([review])
    assert links == [{"url": "https://youtube.com/shorts/x", "platform": "youtube", "at": 5, "review_id": "r1",
                      "client_key": "n_budi", "client_name": "Budi", "video_id": "vid00000001", "key": "a"}]


def test_refresh_snapshots_and_staleness(tmp_path, monkeypatch):
    calls = []
    monkeypatch.setattr(P, "fetch", lambda url, platform: calls.append(url) or {
        "views": 100 * len(calls), "likes": 3, "channel_id": "UC1", "channel": "Budi", "subscribers": 500 + len(calls), "title": "T"})
    now = time.time()
    review = _review("r1", "Budi", now, {"vid00000001|a": [{"url": "https://youtube.com/shorts/x", "platform": "youtube", "at": now}]})
    links = P.collect_links([review])
    assert P.refresh(str(tmp_path), links) == {"updated": 1, "failed": 0, "skipped": 0}
    assert P.refresh(str(tmp_path), links)["skipped"] == 1          # snapshot masih baru
    assert P.refresh(str(tmp_path), links, force=True)["updated"] == 1
    data = P.load(str(tmp_path))
    record = next(iter(data["links"].values()))
    assert [s["views"] for s in record["snapshots"]] == [100, 200]
    assert [s["subscribers"] for s in data["channels"]["UC1"]["snapshots"]] == [501, 502]


def test_refresh_records_failures(tmp_path, monkeypatch):
    def boom(url, platform):
        raise LookupError("perlu login")
    monkeypatch.setattr(P, "fetch", boom)
    review = _review("r1", "Budi", time.time(), {"vid00000001|a": [{"url": "https://instagram.com/reel/x", "platform": "instagram", "at": time.time()}]})
    assert P.refresh(str(tmp_path), P.collect_links([review]))["failed"] == 1
    assert next(iter(P.load(str(tmp_path))["links"].values()))["error"] == "perlu login"


def test_monthly_report_compares_periods():
    oct_start, nov_start = P._period_bounds("2025-10")[0], P._period_bounds("2025-11")[0]
    sep = P._period_bounds("2025-09")[0]
    review = _review("r1", "Budi", oct_start + 100, {
        "vid00000001|a": [{"url": "u1", "platform": "youtube", "at": sep + 10}],
        "vid00000001|b": [{"url": "u2", "platform": "tiktok", "at": oct_start + 200}],
    })
    perf = {"links": {
        "1": {"url": "u1", "platform": "youtube", "client_key": "n_budi", "video_id": "vid00000001", "key": "a",
              "published_link_at": sep + 10, "channel_id": "UC1",
              "snapshots": [{"at": sep + 100, "views": 1000}, {"at": oct_start - 10, "views": 4000}, {"at": nov_start - 10, "views": 5000}]},
        "2": {"url": "u2", "platform": "tiktok", "client_key": "n_budi", "video_id": "vid00000001", "key": "b",
              "published_link_at": oct_start + 200, "snapshots": [{"at": oct_start + 900, "views": 300}, {"at": nov_start - 5, "views": 9000}]},
    }, "channels": {"UC1": {"name": "Budi", "snapshots": [{"at": oct_start - 50, "subscribers": 1000}, {"at": nov_start - 20, "subscribers": 1300}]}}}
    info = lambda vid, key: {"title": f"Klip {key}", "thumbnail_url": None, "viral_score": 80}
    report = P.build_report([review], perf, "n_budi", "2025-10", info)
    assert report["totals"]["views"] == 1000 + 9000            # views yang bertambah selama Oktober
    assert report["totals"]["published"] == 1 and report["totals"]["avg_views_new"] == 9000
    assert report["previous"] == {"period": "2025-09", "views": 4000, "published": 1}
    assert report["views_change_pct"] == 150
    assert [c["title"] for c in report["top_clips"]] == ["Klip b", "Klip a"]
    assert report["platforms"] == {"youtube": {"clips": 1, "views": 1000}, "tiktok": {"clips": 1, "views": 9000}}
    assert report["subscribers"] == [{"name": "Budi", "start": 1000, "end": 1300, "change": 300}]
    assert P.previous_period("2026-01") == "2025-12"
