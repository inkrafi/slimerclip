"""
Job render di belakang layar.

Setiap permintaan render menjadi satu job yang statusnya disimpan di memori server.
Frontend cukup menanyakan status job (polling), jadi render tetap berjalan dan
progresnya bisa dilihat lagi walau halaman ditutup atau berpindah.

Catatan: status job hilang jika backend di-restart (klip yang sudah selesai tetap
tersimpan di folder klip pengguna dan manifest-nya).
"""
import copy
import threading
import time
import uuid

ACTIVE_STATUSES = {"queued", "downloading", "running"}
KEEP_FINISHED_SECONDS = 15 * 60   # job selesai tetap terlihat 15 menit agar hasilnya sempat dilihat
MAX_JOBS = 100


class JobManager:
    def __init__(self):
        self._jobs: dict[str, dict] = {}
        self._lock = threading.Lock()

    def create(self, owner: str, video_id: str, title: str, segments: list) -> dict:
        job = {
            "id": uuid.uuid4().hex[:12],
            "owner": owner,
            "video_id": video_id,
            "title": title,
            "status": "queued",
            "message": None,
            "created_at": time.time(),
            "finished_at": None,
            "download": {"status": "pending", "progress": 0},
            "segments": {
                str(s["segment_number"]): {
                    "segment_number": s["segment_number"],
                    "key": f"{s['start_time']}-{s['end_time']}",
                    "start_time": s["start_time"],
                    "end_time": s["end_time"],
                    "topic": s.get("topic", ""),
                    "status": "queued",
                    "progress": 0,
                    "message": None,
                    "url": None,
                }
                for s in segments
            },
        }
        with self._lock:
            self._prune()
            self._jobs[job["id"]] = job
            return copy.deepcopy(job)

    def update(self, job_id: str, **fields):
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            job.update(fields)
            if fields.get("status") in ("done", "error") and not job["finished_at"]:
                job["finished_at"] = time.time()

    def update_download(self, job_id: str, **fields):
        with self._lock:
            job = self._jobs.get(job_id)
            if job:
                job["download"].update(fields)

    def update_segment(self, job_id: str, segment_number, **fields):
        with self._lock:
            job = self._jobs.get(job_id)
            if job and str(segment_number) in job["segments"]:
                job["segments"][str(segment_number)].update(fields)

    def get(self, job_id: str, owner: str | None = None) -> dict | None:
        """Job berdasarkan ID; jika owner diisi, hanya job milik pengguna tersebut."""
        with self._lock:
            job = self._jobs.get(job_id)
            if not job or (owner is not None and job["owner"] != owner):
                return None
            return copy.deepcopy(job)

    def list(self, owner: str, video_id: str | None = None) -> list:
        """Job aktif + job yang baru selesai milik pengguna, terbaru dulu."""
        with self._lock:
            self._prune()
            jobs = [j for j in self._jobs.values()
                    if j["owner"] == owner and (video_id is None or j["video_id"] == video_id)]
            return copy.deepcopy(sorted(jobs, key=lambda j: j["created_at"], reverse=True))

    def active_keys(self, owner: str, video_id: str | None = None) -> set:
        """Momen (video_id, start-end) milik pengguna yang sedang antre/dirender."""
        with self._lock:
            keys = set()
            for job in self._jobs.values():
                if (job["owner"] != owner or job["status"] not in ACTIVE_STATUSES
                        or (video_id is not None and job["video_id"] != video_id)):
                    continue
                for seg in job["segments"].values():
                    if seg["status"] not in ("done", "error"):
                        keys.add((job["video_id"], seg["key"]))
            return keys

    def _prune(self):
        now = time.time()
        for job_id in [
            jid for jid, j in self._jobs.items()
            if j["finished_at"] and now - j["finished_at"] > KEEP_FINISHED_SECONDS
        ]:
            del self._jobs[job_id]
        if len(self._jobs) > MAX_JOBS:
            finished = sorted((j for j in self._jobs.values() if j["finished_at"]), key=lambda j: j["finished_at"])
            for job in finished[: len(self._jobs) - MAX_JOBS]:
                del self._jobs[job["id"]]
