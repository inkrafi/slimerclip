"""
Penilaian keviralan momen.

Skor akhir digabung dari tiga sumber yang bisa ditelusuri:
  1. Penilaian AI (Gemini) per komponen: hook, emosi, daya tarik, penutup.
  2. Data penonton nyata: grafik "Most replayed" YouTube (heatmap) — seberapa sering
     bagian video itu ditonton ulang dibanding bagian lain video yang sama.
  3. Struktur yang terukur: durasi cocok untuk Shorts/Reels/TikTok dan kepadatan bicara.

Bobot: 50% AI + 35% penonton + 15% struktur. Jika video belum punya data replay
(views masih sedikit), bobot menjadi 80% AI + 20% struktur.
"""
import bisect
import math

import clip_profile

AI_COMPONENTS = {"hook": 30, "emosi": 30, "daya_tarik": 20, "penutup": 20}

WEIGHTS_WITH_AUDIENCE = {"ai": 0.50, "penonton": 0.35, "struktur": 0.15}
WEIGHTS_WITHOUT_AUDIENCE = {"ai": 0.80, "struktur": 0.20}

SNAP_TOLERANCE = 3.0      # detik: jarak maksimum untuk menempel ke batas baris transkrip
MIN_CLIP_SECONDS = 10.0
# Batas durasi mengikuti profil analisis (clip_profile.DURATIONS); default "medium" 30-65 detik
DEFAULT_BOUNDS = clip_profile.DURATIONS[clip_profile.DEFAULT_PROFILE["duration"]]
TARGET_MIN_SECONDS = float(DEFAULT_BOUNDS["min"])
MAX_CLIP_SECONDS = float(DEFAULT_BOUNDS["max"])


def to_seconds(time_str) -> float:
    """'MM:SS' atau 'HH:MM:SS' → detik. Menit boleh > 59 (mis. '75:30')."""
    try:
        parts = [float(p) for p in str(time_str).strip().split(":")]
    except ValueError:
        return 0.0
    if len(parts) == 3:
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    if len(parts) == 2:
        return parts[0] * 60 + parts[1]
    return parts[0] if parts else 0.0


def to_mmss(seconds: float) -> str:
    """Detik → 'MM:SS' (menit tidak dibatasi 59, konsisten dengan format transkrip)."""
    seconds = max(0, int(round(seconds)))
    return f"{seconds // 60:02d}:{seconds % 60:02d}"


def _clamp(value, lo, hi):
    return max(lo, min(hi, value))


def snap_to_sentences(start: float, end: float, lines: list) -> tuple:
    """
    Tempelkan awal/akhir momen ke batas baris transkrip terdekat, agar klip tidak
    dimulai/berakhir di tengah kalimat. lines: [(start, end, text), ...] urut waktu.
    """
    if not lines:
        return start, end
    starts = [l[0] for l in lines]
    ends = [l[1] for l in lines]

    def nearest(values, target):
        i = bisect.bisect_left(values, target)
        candidates = [v for v in values[max(0, i - 1):i + 1]]
        best = min(candidates, key=lambda v: abs(v - target), default=target)
        return best if abs(best - target) <= SNAP_TOLERANCE else target

    new_start = nearest(starts, start)
    new_end = nearest(ends, end)
    if new_end - new_start < MIN_CLIP_SECONDS:
        return start, end
    return new_start, new_end


def extend_short(start: float, end: float, lines: list, video_duration: float,
                 min_len: float = TARGET_MIN_SECONDS, max_len: float = MAX_CLIP_SECONDS) -> tuple:
    """
    Momen terlalu pendek untuk dijadikan Short → perpanjang ke akhir baris transkrip berikutnya
    sampai minimal min_len, agar konteks & payoff ikut masuk.
    """
    if end - start >= min_len:
        return start, end
    target = start + min_len
    new_end = next((l[1] for l in lines if l[1] >= target), target)
    new_end = min(new_end, start + max_len)
    if video_duration:
        new_end = min(new_end, video_duration)
    new_end = max(end, new_end)
    # Dekat akhir video → kekurangannya diambil dari depan (mundur ke awal kalimat)
    if new_end - start < min_len:
        target_start = max(0.0, new_end - min_len)
        start = max((l[0] for l in lines if l[0] <= target_start), default=target_start)
    return start, new_end


def ai_score(segment: dict) -> tuple:
    """Total skor AI dari komponen (0–100). Fallback ke viral_score lama jika komponen tidak ada."""
    raw = segment.get("score_breakdown") or {}
    if isinstance(raw.get("ai"), dict):   # sudah pernah dinilai → ambil komponen AI aslinya
        raw = raw["ai"]
    parts = {}
    for key, maximum in AI_COMPONENTS.items():
        try:
            parts[key] = int(_clamp(round(float(raw.get(key, 0))), 0, maximum))
        except (TypeError, ValueError):
            parts[key] = 0
    total = sum(parts.values())
    if total == 0:
        try:
            total = int(_clamp(round(float(segment.get("viral_score", 0))), 0, 100))
        except (TypeError, ValueError):
            total = 0
        parts = {}
    return total, parts


def audience_score(start: float, end: float, heatmap: list) -> float | None:
    """
    Persentil intensitas "Most replayed" pada rentang momen dibanding seluruh video (0–100).
    100 = bagian yang paling sering ditonton ulang di video itu. None jika tidak ada data.
    """
    if not heatmap:
        return None
    total_weight = 0.0
    weighted = 0.0
    for point in heatmap:
        overlap = min(end, point["end_time"]) - max(start, point["start_time"])
        if overlap > 0:
            weighted += point["value"] * overlap
            total_weight += overlap
    if total_weight == 0:
        return None
    segment_value = weighted / total_weight
    # Persentil mid-rank: nilai yang setara dihitung separuh, dengan toleransi pembulatan
    eps = 1e-6
    less = sum(1 for p in heatmap if p["value"] < segment_value - eps)
    equal = sum(1 for p in heatmap if abs(p["value"] - segment_value) <= eps)
    return round(100 * (less + 0.5 * equal) / len(heatmap), 1)


def trim_long(start: float, end: float, lines: list, max_len: float) -> tuple:
    """Momen melebihi batas → akhiri di ujung baris transkrip terakhir yang masih muat."""
    if end - start <= max_len:
        return start, end
    limit = start + max_len
    fitting = [l[1] for l in lines if start < l[1] <= limit]
    return start, max(fitting) if fitting else limit


def duration_fit(seconds: float, bounds: dict | None = None) -> float:
    """100 di rentang ideal profil, turun linear sampai 60 di batas minimal/maksimal, 30 di luar itu."""
    bounds = bounds or DEFAULT_BOUNDS
    lo, hi = bounds["ideal"]
    if lo <= seconds <= hi:
        return 100.0
    if bounds["min"] <= seconds < lo:
        return 60 + (seconds - bounds["min"]) * 40 / max(1, lo - bounds["min"])
    if hi < seconds <= bounds["max"]:
        return 100 - (seconds - hi) * 40 / max(1, bounds["max"] - hi)
    return 30.0


def speech_density(start: float, end: float, lines: list) -> float | None:
    """Kata per detik yang diucapkan dalam rentang momen (dari transkrip)."""
    if not lines or end <= start:
        return None
    words = 0.0
    for l_start, l_end, text in lines:
        overlap = min(end, l_end) - max(start, l_start)
        if overlap > 0 and l_end > l_start:
            words += len(text.split()) * overlap / (l_end - l_start)
    return words / (end - start)


def density_fit(words_per_second: float | None) -> float:
    """Bicara padat (≈1,8–3,5 kata/detik) menahan penonton; terlalu jarang = banyak jeda."""
    if words_per_second is None:
        return 70.0
    if 1.8 <= words_per_second <= 3.5:
        return 100.0
    if words_per_second < 1.8:
        return _clamp(40 + (words_per_second / 1.8) * 60, 40, 100)
    return _clamp(100 - (words_per_second - 3.5) * 20, 60, 100)


def score_segments(segments: list, transcript_lines: list, heatmap: list, video_duration: float,
                   bounds: dict | None = None) -> list:
    """Rapikan batas waktu tiap momen (sesuai batas durasi profil) dan hitung skor viral akhir beserta rinciannya."""
    bounds = bounds or DEFAULT_BOUNDS
    has_audience = bool(heatmap)
    weights = WEIGHTS_WITH_AUDIENCE if has_audience else WEIGHTS_WITHOUT_AUDIENCE
    scored = []

    for seg in segments:
        if not isinstance(seg, dict):
            continue
        start = to_seconds(seg.get("start_time"))
        end = to_seconds(seg.get("end_time"))
        if video_duration:
            start, end = _clamp(start, 0, video_duration), _clamp(end, 0, video_duration)
        if end - start < 5:
            continue  # timestamp tidak masuk akal → buang

        start, end = snap_to_sentences(start, end, transcript_lines)
        start, end = extend_short(start, end, transcript_lines, video_duration, bounds["min"], bounds["max"])
        start, end = trim_long(start, end, transcript_lines, bounds["max"])
        start, end = math.floor(start), math.ceil(end)
        length = end - start

        ai_total, ai_parts = ai_score(seg)
        audience = audience_score(start, end, heatmap)
        wps = speech_density(start, end, transcript_lines)
        structure = round(0.5 * duration_fit(length, bounds) + 0.5 * density_fit(wps), 1)

        final = weights["ai"] * ai_total + weights["struktur"] * structure
        if has_audience:
            # Video punya data replay tapi rentang ini tidak tercakup → anggap rata-rata
            final += weights["penonton"] * (audience if audience is not None else 50.0)

        seg = dict(seg)
        seg["start_time"] = to_mmss(start)
        seg["end_time"] = to_mmss(end)
        seg["duration_seconds"] = length
        seg["viral_score"] = int(round(_clamp(final, 0, 100)))
        seg["score_breakdown"] = {
            "ai": {"total": ai_total, **ai_parts},
            "penonton": audience,
            "struktur": {
                "skor": structure,
                "durasi_detik": length,
                "kata_per_detik": round(wps, 2) if wps is not None else None,
            },
            "bobot": weights,
        }
        scored.append(seg)

    return drop_overlaps(scored, bounds["min"])


OVERLAP_TOLERANCE = 3.0   # detik tumpang tindih yang dibiarkan (sambungan kalimat)


def drop_overlaps(segments: list, min_len: float = TARGET_MIN_SECONDS) -> list:
    """
    Momen yang tumpang tindih dengan momen berskor lebih tinggi dipangkas ke bagian yang tidak
    tumpang tindih. Jika sisanya kurang dari min_len (isinya praktis sama), momen dibuang.
    """
    kept = []
    for seg in sorted(segments, key=lambda s: s["viral_score"], reverse=True):
        orig = (to_seconds(seg["start_time"]), to_seconds(seg["end_time"]))
        s0, s1 = orig
        changed = True
        while changed and s1 > s0:
            changed = False
            for other in kept:
                o0, o1 = to_seconds(other["start_time"]), to_seconds(other["end_time"])
                if min(s1, o1) - max(s0, o0) <= OVERLAP_TOLERANCE:
                    continue
                if o0 <= s0:                  # momen lain menutupi bagian awal → mulai setelahnya
                    s0 = max(s0, o1)
                elif o1 >= s1:                # menutupi bagian akhir → berhenti sebelumnya
                    s1 = min(s1, o0)
                else:                         # momen lain ada di tengah → ambil sisi yang lebih panjang
                    s0, s1 = (s0, o0) if o0 - s0 >= s1 - o1 else (o1, s1)
                changed = True
        trimmed = (s0, s1) != orig
        if trimmed and s1 - s0 < min_len:
            continue
        if trimmed:
            seg = dict(seg, start_time=to_mmss(s0), end_time=to_mmss(s1), duration_seconds=int(s1 - s0))
            if isinstance(seg.get("score_breakdown"), dict) and isinstance(seg["score_breakdown"].get("struktur"), dict):
                seg["score_breakdown"] = {**seg["score_breakdown"],
                                          "struktur": {**seg["score_breakdown"]["struktur"], "durasi_detik": int(s1 - s0)}}
        kept.append(seg)
    return kept
