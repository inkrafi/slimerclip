import time

import pytest

import render_pipeline
from jobs import JobManager


def test_cancel_marks_only_own_active_job():
    jobs = JobManager()
    job = jobs.create("u1", "vid", "Judul", [{"segment_number": 1, "start_time": "0", "end_time": "10"}])
    assert jobs.cancel(job["id"], "u2") is None and not jobs.is_cancelled(job["id"])
    assert jobs.cancel(job["id"], "u1")["cancelled"] and jobs.is_cancelled(job["id"])
    done = jobs.create("u1", "vid", "Judul", [])
    jobs.update(done["id"], status="done")
    assert not jobs.cancel(done["id"], "u1")["cancelled"]          # job selesai tidak bisa dibatalkan


def test_run_ffmpeg_kills_process_on_cancel():
    started = time.time()
    cmd = ["ffmpeg", "-v", "error", "-re", "-f", "lavfi", "-i", "anullsrc", "-t", "60", "-f", "null", "-"]
    with pytest.raises(render_pipeline.RenderCancelled):
        render_pipeline._run_ffmpeg(cmd, "x", cancelled=lambda: time.time() - started > 0.6)
    assert time.time() - started < 5
