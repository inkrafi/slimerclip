"""
Video channel dari proyek topik: pendek 9:16 (maksimal 60 detik) dan panjang 16:9, keduanya gaya Klik Digital ID.

Naskah, suara per adegan, dan isi animasi disimpan di proyek yang sama dengan editor. Gambarnya digambar penuh oleh
Revideo (motion/klik-auto.ts) dengan latar yang berganti, lalu suara, musik, dan efek dicampur di sini.
Proyek dari podcast tetap memakai render lama di longform.py.
"""
import json
import os
import re
import shutil
import subprocess
import uuid

import longform
import motion_scenes

SHORT = "short"
LONG = "long"
MAX_SECONDS = 60
MIN_SECONDS = 45
SECONDS_CHOICES = (60,)
WORDS_PER_SECOND = 2.2      # tempo bicara santai, terukur ±2,4 kata per detik pada contoh channel
SIZES = {SHORT: (1080, 1920), LONG: (1920, 1080)}
FPS = 30
TAIL_SECONDS = 0.8          # ruang napas setelah kata terakhir
SCENE_GAP = 0.08            # adegan rapat; jeda bicara sudah ada di rekamannya
STOCK_CLIP_SECONDS = 40     # batas potongan video stok per adegan
MUSIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "music")
MUSIC = {SHORT: "bgm_semangat.m4a", LONG: "bgm_santai.m4a"}
ASSET_ROOT = os.path.join(motion_scenes.MOTION_DIR, "public", "klik", "auto")
WHOOSH = "anoisesrc=d=0.38:c=pink:a=0.5,highpass=f=700,lowpass=f=5500,afade=t=in:d=0.14,afade=t=out:st=0.14:d=0.24"
VIDEO_ARGS = ["-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p", "-r", str(FPS)]


def uses_klik(project: dict | None) -> bool:
    return bool(project) and project.get("format") in SIZES


def is_short(project: dict | None) -> bool:
    return bool(project) and project.get("format") == SHORT


RED_OVER_VIDEO = 0.68   # latar merah di atas video stok: videonya masih terlihat


def target_words(seconds: int) -> int:
    return int(seconds * WORDS_PER_SECOND)


def scene_seconds(path: str) -> float:
    return longform.snap_frames(longform.wav_duration(path) + SCENE_GAP)


def recorded_seconds(project: dict, folder: str) -> float:
    return sum(scene_seconds(os.path.join(folder, s["audio"]["file"]))
               for s in project["scenes"] if s["kind"] == "narration" and s.get("audio"))


def plan_scene(scene: dict, index: int, last: bool, has_video: bool, fmt: str = SHORT) -> dict:
    """Latar dan bentuk tiap adegan. Aturannya tetap, jadi hasilnya selalu berganti tanpa perlu AI."""
    motion = scene.get("motion") or {}
    template = motion.get("template")
    flip = "paper" if index % 2 else "grid"
    if template == "choice":
        template = None   # bentuk "pilihan" sudah tidak dipakai; adegan lama tampil sebagai adegan biasa
    if last and scene["text"].rstrip().endswith("?"):
        return {"template": "question", "backdrop": "green"}
    if not template:
        return {"template": "plain", "backdrop": "video"} if has_video else {"template": "statement", "backdrop": flip}
    if template == "number":
        bad = motion.get("tone") == "bad"
        backdrop = ("redvideo" if has_video and fmt == SHORT else "red") if bad else "grid"
    elif template == "ledger":
        backdrop = "video" if has_video and fmt == SHORT else "paper"
    elif template in ("share", "verdict"):
        backdrop = "paper"
    elif template in ("kinetic", "choice"):
        backdrop = "video" if has_video else flip
    elif template == "data":
        backdrop = "grid"
    else:
        backdrop = flip
    return {"template": template, "backdrop": backdrop, "motion": motion}


def _vary_backdrops(scenes: list):
    """Dua adegan berurutan tidak memakai latar kertas atau kisi yang sama."""
    swap = {"paper": "grid", "grid": "paper"}
    for before, scene in zip(scenes, scenes[1:]):
        if scene["backdrop"] == before["backdrop"] and scene["backdrop"] in swap and scene["template"] not in ("verdict", "share", "data"):
            scene["backdrop"] = swap[scene["backdrop"]]


def _plain(word: str) -> str:
    return re.sub(r"[^\w]", "", word.lower())


def label_cues(labels: list, timed: list, start: float, end: float) -> list:
    """Kapan tiap label diucapkan, supaya baris muncul tepat saat disebut. Yang tidak ketemu dibagi rata."""
    cues, cursor = [], 0
    for i, label in enumerate(labels):
        first = _plain(str(label).split()[0]) if str(label).split() else ""
        found = next((j for j in range(cursor, len(timed)) if first and _plain(timed[j]["w"]).startswith(first)), None)
        if found is None:
            cues.append(None)
        else:
            cues.append(timed[found]["s"])
            cursor = found + 1
    room = max(0.2, end - start - 0.4)
    return [round(c if c is not None else start + 0.2 + room * i / max(1, len(labels)), 3) for i, c in enumerate(cues)]


def timeline(project: dict, folder: str) -> tuple[list, list, list, float]:
    """Adegan dengan waktu mulai dan selesai, kata untuk subtitle, durasi tiap adegan, dan total durasi."""
    fmt = project.get("format") or SHORT
    scenes, words, durations, clock = [], [], [], 0.0
    narration = [s for s in project["scenes"] if s["kind"] == "narration"]
    for i, scene in enumerate(narration):
        path = os.path.join(folder, scene["audio"]["file"])
        seconds = scene_seconds(path)
        planned = plan_scene(scene, i, i == len(narration) - 1, bool(scene.get("visual")), fmt)
        spans = longform.speech_spans(path, longform.wav_duration(path))
        timed = [{"w": word.rstrip(".,;:?!"), "s": round(clock + start, 3), "e": round(clock + end, 3), "p": word[-1:] in ".,;:?!"}
                 for start, end, word in longform.timed_words(scene["text"], spans)]
        item = {**planned, "id": scene["id"], "text": scene["text"], "chapter": scene.get("chapter", ""),
                "start": round(clock, 3), "end": round(clock + seconds, 3)}
        motion = planned.get("motion") or {}
        if planned["template"] == "ledger":
            item["cues"] = label_cues([r["label"] for r in motion.get("rows", [])], timed, clock, clock + seconds)
        elif planned["template"] == "verdict":
            item["cues"] = label_cues(str(motion.get("answer", "")).split()[:1], timed, clock, clock + seconds)
        scenes.append(item)
        # Video panjang tanpa subtitle, sesuai contoh. Teks yang sudah tampil besar juga tidak perlu subtitle.
        if fmt == SHORT and planned["template"] not in ("statement", "question", "verdict"):
            words.extend(timed)
        durations.append(seconds)
        clock += seconds
    _vary_backdrops(scenes)
    return scenes, words, durations, clock


def _ffmpeg(args: list, what: str, cwd: str | None = None):
    done = subprocess.run(["ffmpeg", "-y", "-v", "error", *args], cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if done.returncode:
        raise ValueError(f"{what}: {done.stderr[-300:]}")


def prepare_stock(narration: list, scenes: list, asset_dir: str, prefix: str, size: tuple):
    """Video stok dipotong sesuai rasio dan ditaruh di folder publik Revideo. Yang gagal diganti latar polos."""
    width, height = size
    for source, scene in zip(narration, scenes):
        if scene["backdrop"] not in ("video", "redvideo"):
            continue
        name = f"{scene['id']}.mp4"
        try:
            stock = longform.download_stock(source["visual"])
            seconds = min(STOCK_CLIP_SECONDS, scene["end"] - scene["start"] + 3)
            _ffmpeg(["-stream_loop", "-1", "-i", stock, "-an", "-t", f"{seconds:.2f}", "-r", str(FPS),
                     "-vf", f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},setsar=1,format=yuv420p",
                     "-c:v", "libx264", "-crf", "22", "-preset", "veryfast", "-g", "15", "-bf", "0",
                     os.path.join(asset_dir, name)], "Video stok gagal diproses")
            if scene["backdrop"] == "redvideo":
                scene["backdrop"] = f"red:/klik/auto/{prefix}/{name}|{RED_OVER_VIDEO}"
            else:
                scene["backdrop"] = f"video:/klik/auto/{prefix}/{name}|{0.62 if scene['template'] == 'kinetic' else 0.38}"
        except Exception as e:
            print(f"[Klik] Video stok adegan {scene['id']} dilewati: {e}")
            scene["backdrop"] = "red" if scene["backdrop"] == "redvideo" else "grid"
            if scene["template"] == "plain":
                scene["template"] = "statement"


def _render_picture(job: dict, workdir: str, seconds: float) -> str:
    if not motion_scenes.available():
        raise ValueError("Template animasi belum terpasang. Jalankan npm install di folder motion.")
    job_path = os.path.join(workdir, "klik_job.json")
    with open(job_path, "w", encoding="utf-8") as f:
        json.dump({"outDir": os.path.abspath(workdir).replace("\\", "/"), "job": job}, f, ensure_ascii=False)
    try:
        done = subprocess.run(["node", motion_scenes.TSX_CLI, "klik-auto.ts", os.path.abspath(job_path)], cwd=motion_scenes.MOTION_DIR,
                              capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300 + seconds * 30)
    except subprocess.TimeoutExpired:
        raise ValueError("Render animasi terlalu lama dan dihentikan.")
    path = os.path.join(workdir, "klik_silent.mp4")
    if done.returncode or not os.path.isfile(path):
        raise ValueError(f"Render animasi gagal: {(done.stdout + done.stderr)[-300:]}")
    return path


def join_voice_args(audio_paths: list, durations: list, out: str) -> list:
    inputs, graph = [], []
    for i, (path, seconds) in enumerate(zip(audio_paths, durations)):
        inputs += ["-i", path]
        graph.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo,apad,atrim=0:{seconds:.3f}[n{i}]")
    joined = "".join(f"[n{i}]" for i in range(len(durations)))
    graph.append(f"{joined}concat=n={len(durations)}:v=0:a=1[out]")
    return [*inputs, "-filter_complex", ";".join(graph), "-map", "[out]", "-ar", "48000", out]


def mix_args(picture: str, voice: str, cuts: list, duration: float, music: str | None, out: str) -> list:
    """Narasi di depan, musik mengecil saat ada suara, efek di setiap pergantian adegan."""
    inputs = ["-i", picture, "-i", voice]
    graph, mix, next_input = [], [], 2
    if music:
        inputs += ["-stream_loop", "-1", "-i", music]
        graph.append("[1:a]asplit[voice][key]")
        graph.append(f"[2:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.16,atrim=0:{duration:.3f},"
                     f"afade=t=out:st={max(0, duration - 1):.3f}:d=1[bed]")
        graph.append("[bed][key]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=350[duck]")
        mix.append("[duck]")
        next_input = 3
    else:
        graph.append("[1:a]anull[voice]")
    if cuts:
        inputs += ["-f", "lavfi", "-i", WHOOSH]
        splits = "".join(f"[w{i}]" for i in range(len(cuts)))
        graph.append(f"[{next_input}:a]aresample=48000,aformat=channel_layouts=stereo,asplit={len(cuts)}{splits}")
        for i, at in enumerate(cuts):
            graph.append(f"[w{i}]adelay={int(at * 1000)}:all=1[s{i}]")
            mix.append(f"[s{i}]")
    graph.append(f"[voice]{''.join(mix)}amix=inputs={len(mix) + 1}:duration=first:normalize=0,"
                 "loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad[out]")
    return [*inputs, "-filter_complex", ";".join(graph), "-map", "0:v", "-map", "[out]", *VIDEO_ARGS,
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-t", f"{duration:.3f}", "-movflags", "+faststart", out]


def render(project: dict, folder: str, out_name: str, channel: str, callback=None) -> dict:
    """Gambar video utuh lalu campur suaranya. Return {"filename", "duration", "durations"}."""
    def report(progress: int, message: str):
        if callback:
            callback({"status": "running", "progress": progress, "message": message})

    fmt = project.get("format") or SHORT
    workdir = os.path.join(folder, f"work_{uuid.uuid4().hex[:8]}")
    prefix = uuid.uuid4().hex[:12]
    asset_dir = os.path.join(ASSET_ROOT, prefix)
    os.makedirs(workdir)
    os.makedirs(asset_dir)
    try:
        narration = [s for s in project["scenes"] if s["kind"] == "narration"]
        report(3, "Menyiapkan adegan")
        scenes, words, durations, spoken = timeline(project, folder)
        if fmt == SHORT and spoken > MAX_SECONDS:
            raise ValueError(f"Durasi suara {spoken:.0f} detik, maksimal {MAX_SECONDS} detik.")
        prepare_stock(narration, scenes, asset_dir, prefix, SIZES[fmt])
        duration = spoken + TAIL_SECONDS
        report(10, "Menggambar animasi. Ini ±5 menit per menit video")
        picture = _render_picture({"format": "auto", "layout": fmt, "channel": channel, "scenes": scenes, "words": words, "duration": duration},
                                  workdir, duration)
        report(90, "Mencampur suara dan musik")
        voice = os.path.join(workdir, "voice.wav")
        audio_paths = [os.path.abspath(os.path.join(folder, s["audio"]["file"])) for s in narration]
        _ffmpeg(join_voice_args(audio_paths, durations, voice), "Suara gagal disambung")
        music = os.path.join(MUSIC_DIR, MUSIC[fmt])
        tmp_out = os.path.abspath(os.path.join(folder, out_name + ".rendering.mp4"))
        _ffmpeg(mix_args(picture, voice, [s["start"] for s in scenes[1:]], duration, music if os.path.isfile(music) else None, tmp_out),
                "Suara gagal dicampur")
        os.replace(tmp_out, os.path.join(folder, out_name))
        return {"filename": out_name, "duration": round(duration, 1), "durations": durations}
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
        shutil.rmtree(asset_dir, ignore_errors=True)


def short_description(project: dict, channel: str) -> str:
    """Keterangan unggahan singkat: ringkasan dan sumber berita, supaya muat di TikTok dan Reels."""
    parts = [project.get("summary", "")]
    sources = [f"- {s.get('source') or s['title']}: {s['url']}" for s in project.get("sources") or []]
    if sources:
        parts.append("Sumber:\n" + "\n".join(sources))
    if channel:
        parts.append(channel)
    return "\n\n".join(p for p in parts if p)
