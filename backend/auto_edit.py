"""
Edit otomatis: resep edit awal untuk klip yang belum pernah diedit, supaya pengguna tinggal menyesuaikan.

  - hook     : ide hook pertama dari analisis momen, tampil 4 detik dengan animasi pop
  - musik    : sesuai suasana momen (emosi & kategori dari analysis); musik upload pengguna yang namanya
               mengandung kata suasana ("santai", "epic", "lucu", …) diutamakan, kalau tidak pakai musik bawaan
  - efek suara: sesuai suasana — transisi saat hook muncul, penekanan di kalimat terkuat (hook_line; untuk momen
               lucu "ba-dum-tss" setelah kalimatnya selesai), ka-ching di nominal uang, ding di angka. Maksimal 4
               dan berjarak, agar tidak berlebihan. SFX upload pengguna (file kecil) yang namanya mengandung kata
               kuncinya (mis. "vine_boom.mp3") menggantikan bunyi bawaan sejenis.
  - suara    : penjernih aktif; video: filter HD aktif; vignette bawah tipis agar caption terbaca
"""
import re

from clip_effects import MUSIC_LIBRARY

MOOD_KEYWORDS = {
    "santai": ("santai", "chill", "lofi", "lo-fi", "relax", "calm", "soft"),
    "semangat": ("semangat", "motivasi", "epic", "upbeat", "inspir", "energetic", "hype"),
    "tegang": ("tegang", "serius", "tense", "dark", "suspense", "misteri", "mystery", "thriller"),
    "lucu": ("lucu", "funny", "ceria", "happy", "comedy", "playful", "fun"),
    "dramatis": ("dramatis", "sedih", "sad", "emotional", "haru", "cinematic", "piano"),
}
MOODS = tuple(MOOD_KEYWORDS) + ("umum",)   # "umum" = musik pengguna yang cocok untuk suasana apa pun
MOOD_ACCENT = {"santai": "cyan", "semangat": "yellow", "tegang": "pink", "lucu": "lime", "dramatis": "white"}
MUSIC_VOLUME = 18          # % — musik di bawah suara (ducking juga aktif)
HOOK_SECONDS = 4
MAX_SFX = 4
SFX_GAP = 7.0              # detik minimal antar efek suara
NUMBER_RE = re.compile(r"\d|juta|miliar|milyar|triliun|ribu|persen|million|billion|thousand|percent", re.I)
MONEY_RE = re.compile(r"juta|miliar|milyar|triliun|ribu|rupiah|rp|dolar|dollar|\$|million|billion|thousand", re.I)
SENTENCE_END = ".?!"
USER_SFX_MAX_MB = 1.5      # audio upload sekecil ini dianggap efek suara, yang lebih besar musik

# Bunyi per suasana: (transisi saat hook muncul, penekanan di kalimat terkuat)
MOOD_SFX = {
    "santai": ("lib_whoosh.wav", "lib_pop.wav"),
    "semangat": ("lib_whoosh_deep.wav", "lib_bass_drop.wav"),
    "tegang": ("lib_whoosh_deep.wav", "lib_dun_dun.wav"),
    "lucu": ("lib_swipe.wav", "lib_rimshot.wav"),
    "dramatis": ("lib_reverse.wav", "lib_impact.wav"),
}
# Kata kunci nama file SFX upload pengguna yang menggantikan bunyi bawaan
SFX_KEYWORDS = {
    "lib_whoosh.wav": ("whoosh", "swoosh"), "lib_whoosh_deep.wav": ("whoosh", "swoosh"), "lib_swipe.wav": ("swipe", "swoosh"),
    "lib_reverse.wav": ("reverse",), "lib_pop.wav": ("pop",), "lib_bass_drop.wav": ("bass", "drop"),
    "lib_dun_dun.wav": ("dun", "dramatic", "dramatis"), "lib_rimshot.wav": ("rimshot", "badum", "ba-dum", "tss"),
    "lib_impact.wav": ("impact", "boom", "hit"), "lib_boom.wav": ("boom",), "lib_ding.wav": ("ding",),
    "lib_ka_ching.wav": ("kaching", "ka-ching", "ka_ching", "cash", "money", "uang"),
}


def mood_for(segment: dict) -> str:
    emotion = str(segment.get("emotion_trigger") or "").upper()
    category = str(segment.get("category") or "").lower()
    if category == "komedi" or "TAWA" in emotion:
        return "lucu"
    if "KONTROVERSI" in emotion or "KAGET" in emotion:
        return "tegang"
    if "INSPIRASI" in emotion:
        return "dramatis" if category in ("hubungan", "kesehatan") else "semangat"
    return "santai"


def guess_mood(name: str) -> str | None:
    """Suasana dari nama file musik (mis. "lofi_chill.mp3" → santai); None jika tidak ada kata kuncinya."""
    lower = name.lower()
    return next((mood for mood, keys in MOOD_KEYWORDS.items() if any(k in lower for k in keys)), None)


def pick_music(mood: str, user_music: list, seed: int = 0) -> str:
    """
    Musik untuk suasana ini: musik pengguna bersuasana sama (tanda dari editor, atau ditebak dari nama file),
    lalu musik pengguna bertanda "umum", lalu musik bawaan. Beberapa kandidat → bergantian per klip (seed),
    agar tidak semua klip memakai lagu yang sama. user_music: [{name, mood?}] atau nama saja.
    """
    items = [m if isinstance(m, dict) else {"name": m} for m in user_music]

    def fits(m, wanted):
        if m.get("mood"):   # tanda dari editor menang atas nama file
            return m["mood"] == wanted
        return wanted in MOOD_KEYWORDS and any(k in m["name"].lower() for k in MOOD_KEYWORDS[wanted])

    for wanted in (mood, "umum"):
        names = sorted(m["name"] for m in items if fits(m, wanted))
        if names:
            return names[seed % len(names)]
    return f"bgm_{mood}.m4a"


def _seconds(mmss) -> float | None:
    parts = str(mmss or "").strip().split(":")
    try:
        nums = [float(p) for p in parts]
    except ValueError:
        return None
    if len(nums) == 2:
        return nums[0] * 60 + nums[1]
    if len(nums) == 3:
        return nums[0] * 3600 + nums[1] * 60 + nums[2]
    return None


def _words(transcript: dict | None, start: float, end: float) -> list:
    out = []
    for seg in (transcript or {}).get("segments") or []:
        for w in seg.get("words") or []:
            if start <= w["start"] < end:
                out.append(w)
    return out


def user_sfx_for(builtin: str, user_sfx: list) -> str:
    """SFX upload pengguna yang namanya cocok dengan bunyi bawaan ini, atau bunyi bawaannya."""
    for name in user_sfx:
        lower = name.lower()
        if any(k in lower for k in SFX_KEYWORDS.get(builtin, ())):
            return name
    return builtin


def place_sfx(segment: dict, words: list, start: float, end: float, mood: str = "santai", user_sfx: list = ()) -> list:
    entrance, punch = MOOD_SFX[mood]
    sfx = [{"asset": entrance, "at": round(start + 0.05, 2), "volume": 55}]

    def free(t):
        return start + HOOK_SECONDS + 0.5 <= t <= end - 1.5 and all(abs(t - s["at"]) >= SFX_GAP for s in sfx)

    # Penekanan di kalimat terkuat (hook_line dari analisis), ditempel ke awal kata terdekat.
    # Momen lucu: "ba-dum-tss" setelah kalimat itu selesai (punchline dulu, baru bunyinya)
    hook_at = _seconds(segment.get("hook_start"))
    if hook_at is not None:
        near = min(words, key=lambda w: abs(w["start"] - hook_at), default=None)
        t = (near["start"] if near and abs(near["start"] - hook_at) <= 2.5 else hook_at) - 0.12
        if mood == "lucu":
            after = [w for w in words if w["start"] >= t]
            done = next((w for w in after if w["word"].strip()[-1:] in SENTENCE_END), after[-1] if after else None)
            t = done["end"] + 0.15 if done else t
        if free(t):
            sfx.append({"asset": punch, "at": round(t, 2), "volume": 45})
    # Ka-ching pada nominal uang, ding pada angka lain
    for i, w in enumerate(words):
        if len(sfx) >= MAX_SFX:
            break
        if NUMBER_RE.search(w["word"]) and free(w["start"]):
            context = " ".join(x["word"] for x in words[i:i + 3])
            sfx.append({"asset": "lib_ka_ching.wav" if MONEY_RE.search(context) else "lib_ding.wav",
                        "at": round(w["start"], 2), "volume": 40})
    for item in sfx:
        item["asset"] = user_sfx_for(item["asset"], user_sfx)
    return sorted(sfx, key=lambda s: s["at"])


def build(segment: dict, start: float, end: float, transcript: dict | None, hook_ideas: list,
          user_audio: list) -> tuple[dict, dict]:
    """
    (resep edit belum disanitasi, ringkasan untuk UI). user_audio: aset audio pengguna ({name, size_mb}, atau nama
    saja): file kecil = kandidat efek suara, file besar = kandidat musik.
    """
    items = [a if isinstance(a, dict) else {"name": a, "size_mb": USER_SFX_MAX_MB + 1} for a in user_audio]
    # Hanya tanda suasana dari editor yang dihitung (tebakan nama file dicocokkan ulang per suasana di pick_music)
    items = [{**a, "mood": a.get("mood") if a.get("mood_source", "tag") == "tag" else None} for a in items]
    # Bertanda suasana = musik; tanpa tanda: file besar = musik, file kecil = efek suara
    user_music = [a for a in items if a.get("mood") or (a.get("size_mb") or 0) >= USER_SFX_MAX_MB]
    user_sfx = [a["name"] for a in items if a not in user_music]
    mood = mood_for(segment)
    music = pick_music(mood, user_music, seed=int(start))
    hook_text = next((h for h in hook_ideas if h), "")
    sfx = place_sfx(segment, _words(transcript, start, end), start, end, mood, user_sfx)
    recipe = {
        "start": start,
        "end": end,
        "vignette": {"shape": "bottom", "strength": 45, "height": 40},
        "music": {"asset": music, "volume": MUSIC_VOLUME, "ducking": True},
        "sfx": sfx,
        "hook": {"enabled": bool(hook_text), "text": hook_text, "label": "", "duration": HOOK_SECONDS,
                 "style": "spotlight", "anim": "pop", "accent": MOOD_ACCENT[mood], "font": "montserrat",
                 "size": 104, "position_y": 50, "shade": 85},
        "voice": {"volume": 100, "clean": True},
        "enhance": {"video": True},
    }
    summary = {
        "mood": mood,
        "music": MUSIC_LIBRARY[music][0] if music in MUSIC_LIBRARY else music,
        "music_is_user": music not in MUSIC_LIBRARY,
        "sfx": len(sfx),
        "hook": hook_text,
    }
    return recipe, summary
