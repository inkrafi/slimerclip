"""
Edit otomatis: resep edit awal untuk klip yang belum pernah diedit, supaya pengguna tinggal menyesuaikan.

  - hook     : ide hook pertama dari analisis momen, tampil 4 detik dengan animasi pop
  - musik    : sesuai suasana momen (emosi & kategori dari analysis); musik upload pengguna yang namanya
               mengandung kata suasana ("santai", "epic", "lucu", …) diutamakan, kalau tidak pakai musik bawaan
  - efek suara: tidak ada — efek suara hanya dipasang manual oleh pengguna di editor
  - suara    : penjernih aktif; video: filter HD aktif; vignette bawah tipis agar caption terbaca
"""
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
MUSIC_VOLUME = 11          # -19 dB di bawah suara (ducking juga aktif)
HOOK_SECONDS = 4
USER_SFX_MAX_MB = 1.5      # audio upload sekecil ini dianggap efek suara, yang lebih besar musik


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


def split_user_audio(user_audio: list) -> tuple[list, list]:
    """(musik, nama efek suara) dari aset audio pengguna ({name, size_mb, mood?, mood_source?}, atau nama saja)."""
    items = [a if isinstance(a, dict) else {"name": a, "size_mb": USER_SFX_MAX_MB + 1} for a in user_audio]
    # Hanya tanda suasana dari editor yang dihitung (tebakan nama file dicocokkan ulang per suasana di pick_music)
    items = [{**a, "mood": a.get("mood") if a.get("mood_source", "tag") == "tag" else None} for a in items]
    # Bertanda suasana = musik; tanpa tanda: file besar = musik, file kecil = efek suara
    user_music = [a for a in items if a.get("mood") or (a.get("size_mb") or 0) >= USER_SFX_MAX_MB]
    return user_music, [a["name"] for a in items if a not in user_music]


def build(segment: dict, start: float, end: float, hook_ideas: list, user_audio: list) -> tuple[dict, dict]:
    """
    (resep edit belum disanitasi, ringkasan untuk UI). user_audio: aset audio pengguna ({name, size_mb}, atau nama
    saja): file kecil = efek suara (diabaikan), file besar = kandidat musik.
    """
    user_music, _ = split_user_audio(user_audio)
    mood = mood_for(segment)
    music = pick_music(mood, user_music, seed=int(start))
    hook_text = next((h for h in hook_ideas if h), "")
    hook = {"enabled": bool(hook_text), "text": hook_text, "label": "", "duration": HOOK_SECONDS,
            "style": "spotlight", "anim": "pop", "accent": MOOD_ACCENT[mood], "font": "montserrat",
            "size": 104, "position_y": 50, "shade": 85}
    recipe = {
        "start": start,
        "end": end,
        "vignette": {"shape": "bottom", "strength": 45, "height": 40},
        "music": {"asset": music, "volume": MUSIC_VOLUME, "ducking": True},
        "sfx": [],
        "hook": hook,
        "voice": {"volume": 100, "clean": True},
        "enhance": {"video": True},
    }
    summary = {
        "mood": mood,
        "music": MUSIC_LIBRARY[music][0] if music in MUSIC_LIBRARY else music,
        "music_is_user": music not in MUSIC_LIBRARY,
        "hook": hook_text,
    }
    return recipe, summary
