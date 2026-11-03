"""
Buat pustaka efek suara bawaan (backend/sfx/lib_*.wav).

Semua bunyi disintesis dari nol (noise, gelombang sinus, filter) — tidak ada sampel dari pihak
lain, jadi bebas dipakai tanpa lisensi. Jalankan ulang setelah mengubah resep di bawah:

    python tools/make_sfx.py
"""
import os
import wave

import numpy as np

RATE = 44100
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sfx")
rng = np.random.default_rng(7)


def t_axis(seconds: float) -> np.ndarray:
    return np.arange(int(RATE * seconds)) / RATE


def sweep_bandpass(signal: np.ndarray, cutoff: np.ndarray, q: float = 0.5) -> np.ndarray:
    """Filter band-pass (state-variable) dengan frekuensi tengah yang berubah per sampel."""
    out = np.empty_like(signal)
    low = band = 0.0
    coef = 2 * np.sin(np.pi * np.clip(cutoff, 20, RATE / 6) / RATE)
    for i, x in enumerate(signal):
        f = coef[i]
        low += f * band
        high = x - low - q * band
        band += f * high
        out[i] = band
    return out


def sweep_bandpass2(signal, cutoff, q=0.5):
    """Dua kali filter (12 dB/oktaf) agar desis frekuensi tinggi tidak dominan."""
    return sweep_bandpass(sweep_bandpass(signal, cutoff, q), cutoff, q)


def envelope(n: int, attack: float, release: float) -> np.ndarray:
    """Naik dalam `attack` (fraksi panjang), turun halus sampai akhir."""
    x = np.linspace(0, 1, n)
    rise = np.clip(x / max(attack, 1e-6), 0, 1)
    fall = np.clip((1 - x) / max(release, 1e-6), 0, 1)
    return np.minimum(rise, fall) ** 1.5


def whoosh(seconds=0.75, lo=200, hi=2200):
    t = t_axis(seconds)
    shape = np.sin(np.pi * t / seconds)                     # naik lalu turun
    cutoff = lo + (hi - lo) * shape ** 2
    noise = rng.standard_normal(len(t))
    return sweep_bandpass2(noise, cutoff, q=0.7) * envelope(len(t), 0.45, 0.55)


def swipe():
    return whoosh(0.32, 500, 3500)


def pop():
    t = t_axis(0.14)
    freq = 300 + 700 * np.exp(-t * 45)                       # nada turun cepat
    phase = 2 * np.pi * np.cumsum(freq) / RATE
    body = np.sin(phase) * np.exp(-t * 38)
    click = rng.standard_normal(len(t)) * np.exp(-t * 900) * 0.3
    return body + click


def ding():
    t = t_axis(1.6)
    base = 1318.5                                            # E6
    partials = [(1.0, 1.0, 3.0), (2.76, 0.45, 5.0), (5.4, 0.25, 8.0), (8.9, 0.1, 12.0)]
    tone = sum(amp * np.sin(2 * np.pi * base * ratio * t) * np.exp(-t * decay) for ratio, amp, decay in partials)
    return tone * np.clip(t / 0.003, 0, 1)


def boom():
    t = t_axis(1.4)
    freq = 35 + 75 * np.exp(-t * 6)
    phase = 2 * np.pi * np.cumsum(freq) / RATE
    sub = np.sin(phase) * np.exp(-t * 2.6)
    hit = sweep_bandpass(rng.standard_normal(len(t)), np.full(len(t), 180.0), q=1.2) * np.exp(-t * 18) * 0.8
    return np.tanh((sub + hit) * 2.2)                         # saturasi ringan agar tebal


def riser():
    t = t_axis(2.2)
    progress = t / t[-1]
    cutoff = 250 + 3500 * progress ** 2
    air = sweep_bandpass2(rng.standard_normal(len(t)), cutoff, q=0.5)
    freq = 180 + 900 * progress ** 2
    tone = np.sin(2 * np.pi * np.cumsum(freq) / RATE) * 0.25
    return (air + tone) * progress ** 2.2 * np.clip((t[-1] - t) / 0.03, 0, 1)


def click():
    t = t_axis(0.05)
    burst = rng.standard_normal(len(t)) * np.exp(-t * 400)
    return sweep_bandpass(burst, np.full(len(t), 2500.0), q=0.8) + np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 300) * 0.4


def notif():
    out = []
    for freq, length in ((880.0, 0.14), (1318.5, 0.5)):
        t = t_axis(length)
        tone = np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(4 * np.pi * freq * t)
        out.append(tone * np.exp(-t * 7) * np.clip(t / 0.004, 0, 1))
    return np.concatenate(out)


def applause(seconds=2.6):
    n = int(RATE * seconds)
    out = np.zeros(n)
    clap_len = int(RATE * 0.03)
    clap_t = np.arange(clap_len) / RATE
    for _ in range(int(seconds * 140)):                       # ±140 tepukan per detik dari banyak orang
        start = rng.integers(0, n - clap_len)
        clap = rng.standard_normal(clap_len) * np.exp(-clap_t * rng.uniform(120, 260))
        out[start:start + clap_len] += clap * rng.uniform(0.2, 1.0)
    out = sweep_bandpass(out, np.full(n, 1700.0), q=0.35)
    return out * envelope(n, 0.12, 0.45)




# ── Tambahan: bantuan cepat (filter FFT, frekuensi tetap) ─────────────────

def band(signal: np.ndarray, lo: float, hi: float) -> np.ndarray:
    spec = np.fft.rfft(signal)
    f = np.fft.rfftfreq(len(signal), 1 / RATE)
    spec[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(spec, len(signal))


def tone(freq, seconds, harmonics=((1, 1.0),), decay=0.0):
    """Nada dengan frekuensi tetap atau array (glide), harmonik opsional, peluruhan eksponensial."""
    t = t_axis(seconds)
    f = np.broadcast_to(np.asarray(freq, dtype=float), t.shape)
    phase = 2 * np.pi * np.cumsum(f) / RATE
    out = sum(a * np.sin(k * phase) for k, a in harmonics)
    return out * (np.exp(-t * decay) if decay else 1)


def attack(x, ms=3):
    n = min(len(x), int(RATE * ms / 1000))
    x[:n] *= np.linspace(0, 1, n)
    return x


def silence(seconds):
    return np.zeros(int(RATE * seconds))


def place(total, parts):
    """Gabungkan [(detik_mulai, sinyal, gain)] ke satu buffer."""
    out = np.zeros(int(RATE * total))
    for at, sig, gain in parts:
        i = int(at * RATE)
        end = min(len(out), i + len(sig))
        out[i:end] += sig[:end - i] * gain
    return out


def simple_reverb(x, seconds=1.2, mix=0.3):
    n = int(seconds * RATE)
    ir = rng.standard_normal(n) * np.exp(-np.linspace(0, 6, n))
    size = len(x) + n
    wet = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir / np.sqrt(np.sum(ir ** 2)), size), size)
    return np.concatenate([x, np.zeros(n)]) * (1 - mix) + wet * mix


# ── Transisi ──────────────────────────────────────────────────

def whoosh_deep():
    return whoosh(1.1, 90, 900)


def glitch():
    parts, t0 = [], 0.0
    for _ in range(9):
        seg = rng.uniform(0.02, 0.07)
        kind = rng.integers(3)
        if kind == 0:
            sig = band(rng.standard_normal(int(seg * RATE)), 1500, 9000)
        elif kind == 1:
            sig = np.sign(np.sin(2 * np.pi * rng.uniform(200, 1400) * t_axis(seg))) * 0.6
        else:
            sig = silence(seg)
        parts.append((t0, sig, 1.0))
        t0 += seg
    return place(t0 + 0.02, parts)


def reverse_swell():
    t = t_axis(1.6)
    shimmer = band(rng.standard_normal(len(t)), 3000, 12000) * np.exp(-t * 3)
    return attack(simple_reverb(shimmer, 0.6, 0.4)[::-1][-len(t):] * 1.0, 1)


def tape_stop():
    t = t_axis(0.9)
    freq = 420 * (1 - t / t[-1]) ** 2 + 30
    return tone(freq, 0.9, ((1, 1.0), (2, 0.5), (3, 0.25))) * (1 - t / t[-1])


def zoom_in():
    t = t_axis(0.7)
    rise = band(rng.standard_normal(len(t)), 400, 6000) * (t / t[-1]) ** 2
    return np.concatenate([rise, impact()[:int(0.5 * RATE)] * 0.8])


# ── Penekanan / dramatis ──────────────────────────────────────

def bass_drop():
    t = t_axis(1.8)
    freq = 30 + 140 * np.exp(-t * 2.2)
    return np.tanh(2.5 * tone(freq, 1.8, ((1, 1.0), (2, 0.3)), decay=1.4))


def impact():
    t = t_axis(1.8)
    low = tone(40 + 60 * np.exp(-t * 8), 1.8, decay=2.5)
    crack = band(rng.standard_normal(len(t)), 800, 8000) * np.exp(-t * 25)
    return simple_reverb(np.tanh(1.8 * (low + crack)), 1.4, 0.35)[:int(2.4 * RATE)]


def heartbeat():
    def thump(f, g):
        t = t_axis(0.18)
        return tone(f * (1 + np.exp(-t * 40)), 0.18, decay=22) * g
    beat = place(0.9, [(0.0, thump(55, 1.0), 1.0), (0.22, thump(50, 0.7), 1.0)])
    return np.concatenate([beat, beat])


def dun_dun():
    hit = lambda: attack(tone(55, 0.9, ((1, 1), (2, 0.6), (3, 0.4), (4, 0.25), (5, 0.15)), decay=3.5))
    return simple_reverb(place(1.4, [(0.0, hit(), 1.0), (0.45, hit(), 1.0)]), 1.6, 0.3)


def suspense():
    t = t_axis(2.4)
    chord = sum(tone(f * (1 + 0.004 * np.sin(2 * np.pi * 5 * t)), 2.4, ((1, 1), (2, 0.3))) for f in (220, 233.1, 311.1))
    return chord * (t / t[-1]) ** 1.5 * np.clip((t[-1] - t) / 0.05, 0, 1)


def camera_shutter():
    c1 = band(rng.standard_normal(int(0.03 * RATE)), 1500, 9000) * np.exp(-t_axis(0.03) * 120)
    c2 = band(rng.standard_normal(int(0.05 * RATE)), 800, 6000) * np.exp(-t_axis(0.05) * 90)
    return place(0.2, [(0.0, c1, 1.0), (0.09, c2, 0.8)])


def tick_tock():
    tick = lambda f: attack(tone(f, 0.05, ((1, 1), (3, 0.4)), decay=90))
    return place(2.0, [(i * 0.5, tick(2400 if i % 2 == 0 else 1800), 1.0) for i in range(4)])


def drum_roll():
    t = t_axis(2.0)
    parts = [(i / 28, band(rng.standard_normal(int(0.08 * RATE)), 900, 7000) * np.exp(-t_axis(0.08) * 40), 0.4 + 0.6 * i / 56)
             for i in range(56)]
    roll = place(2.0, parts)
    crash = band(rng.standard_normal(int(1.2 * RATE)), 3000, 14000) * np.exp(-t_axis(1.2) * 3)
    return np.concatenate([roll, crash * 0.9])


# ── Lucu ──────────────────────────────────────────────────────

def boing():
    t = t_axis(0.7)
    freq = 180 + 120 * np.sin(2 * np.pi * 9 * t) * np.exp(-t * 3) + 160 * t
    return tone(freq, 0.7, ((1, 1), (2, 0.3)), decay=4)


def rimshot():
    snare = lambda: band(rng.standard_normal(int(0.15 * RATE)), 900, 8000) * np.exp(-t_axis(0.15) * 25) \
        + tone(190, 0.15, decay=30) * 0.5
    tom = lambda f: tone(f * (1 + 0.3 * np.exp(-t_axis(0.25) * 20)), 0.25, decay=14)
    cymbal = band(rng.standard_normal(int(1.2 * RATE)), 5000, 15000) * np.exp(-t_axis(1.2) * 3.5)
    return place(1.8, [(0.0, snare(), 0.8), (0.0, tom(160), 0.6), (0.18, tom(120), 0.7), (0.45, snare(), 0.8), (0.45, cymbal, 0.7)])


def slide_down():
    t = t_axis(0.9)
    return tone(1600 * (1 - 0.75 * t / t[-1]), 0.9, ((1, 1.0), (2, 0.05))) * np.clip((t[-1] - t) / 0.08, 0, 1)


def sad_trombone():
    notes = [(311.1, 0.35), (293.7, 0.35), (277.2, 0.35), (261.6, 1.1)]
    parts, at = [], 0.0
    for f, d in notes:
        t = t_axis(d)
        vib = 1 + (0.012 * np.sin(2 * np.pi * 5.5 * t) if d > 1 else 0)
        sig = tone(f * vib, d, ((1, 1), (2, 0.6), (3, 0.45), (4, 0.3), (5, 0.2))) * np.clip(t / 0.03, 0, 1) * np.clip((d - t) / 0.08, 0, 1)
        parts.append((at, band(sig, 100, 2500), 1.0))
        at += d
    return place(at, parts)


def bubble_pop():
    t = t_axis(0.12)
    return tone(400 + 1600 * (t / t[-1]), 0.12, decay=30)


def record_scratch():
    t = t_axis(0.6)
    speed = np.abs(np.sin(2 * np.pi * 3.2 * t))
    scratch = band(rng.standard_normal(len(t)), 300, 4000) * speed
    pitch = tone(200 + 900 * speed, 0.6) * 0.25
    return (scratch + pitch) * np.clip((t[-1] - t) / 0.05, 0, 1)


def honk():
    sig = tone(420, 0.35, ((1, 1), (2, 0.8), (3, 0.6), (4, 0.4), (5, 0.3)))
    return place(0.85, [(0.0, sig, 1.0), (0.45, sig, 1.0)])


def crickets():
    out = np.zeros(int(2.5 * RATE))
    for start in np.arange(0.1, 2.3, 0.45):
        chirp = tone(4500, 0.12) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 45 * t_axis(0.12))))
        i = int(start * RATE)
        out[i:i + len(chirp)] += chirp * 0.6
    return out


# ── Notifikasi / UI ───────────────────────────────────────────

def ka_ching():
    bell = sum(tone(f, 1.2, decay=d) * a for f, a, d in ((2093, 1.0, 4), (2637, 0.6, 5), (4186, 0.3, 7)))
    coins = place(0.5, [(rng.uniform(0, 0.35), tone(rng.uniform(4000, 7000), 0.08, decay=50), 0.3) for _ in range(10)])
    drawer = band(rng.standard_normal(int(0.08 * RATE)), 300, 2500) * np.exp(-t_axis(0.08) * 40)
    return place(1.5, [(0.0, drawer, 0.7), (0.06, bell, 1.0), (0.1, coins, 1.0)])


def correct():
    note = lambda f: attack(tone(f, 0.5, ((1, 1), (2, 0.25)), decay=6))
    return place(0.8, [(0.0, note(1046.5), 0.9), (0.12, note(1568), 1.0)])


def wrong():
    t = t_axis(0.6)
    buzz = np.sign(np.sin(2 * np.pi * 110 * t)) * 0.5 + np.sign(np.sin(2 * np.pi * 116 * t)) * 0.5
    return band(buzz, 80, 2500) * np.clip((t[-1] - t) / 0.03, 0, 1)


def censor_beep():
    t = t_axis(0.5)
    return tone(1000, 0.5) * np.clip(t / 0.005, 0, 1) * np.clip((t[-1] - t) / 0.005, 0, 1)


def typing():
    key = lambda: band(rng.standard_normal(int(0.03 * RATE)), 1500, 7000) * np.exp(-t_axis(0.03) * 150)
    times = np.cumsum(rng.uniform(0.07, 0.16, 14))
    return place(times[-1] + 0.1, [(t, key(), rng.uniform(0.5, 1.0)) for t in times])


def level_up():
    note = lambda f: attack(tone(f, 0.25, ((1, 1), (3, 0.3)), decay=8))
    return place(0.9, [(i * 0.09, note(f), 1.0) for i, f in enumerate((523.3, 659.3, 784, 1046.5, 1318.5))])


def sparkle():
    return place(1.3, [(rng.uniform(0, 0.8), tone(rng.uniform(2500, 6000), 0.4, decay=10), rng.uniform(0.2, 0.6)) for _ in range(18)])


# ── Suasana ───────────────────────────────────────────────────

def thunder():
    t = t_axis(3.0)
    rumble = band(rng.standard_normal(len(t)), 25, 300) * (np.exp(-t * 1.2) + 0.5 * np.exp(-((t - 0.8) ** 2) * 6))
    crack = band(rng.standard_normal(len(t)), 500, 5000) * np.exp(-t * 12)
    return np.tanh(2 * (rumble * 3 + crack * 0.8))


def wind():
    t = t_axis(3.0)
    cutoff = 300 + 500 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.4 * t))
    return sweep_bandpass(rng.standard_normal(len(t)), cutoff, q=0.25) * envelope(len(t), 0.25, 0.3)


def gong():
    partials = ((1, 1.0, 0.8), (2.1, 0.6, 1.1), (2.9, 0.4, 1.4), (4.2, 0.3, 2.0), (5.4, 0.2, 2.6))
    return attack(sum(a * tone(90 * r, 3.0, decay=d) for r, a, d in partials), 5)


# ── Pustaka variasi: whoosh / tekstur / riser / hit, beberapa variasi per jenis ──
# Variasi sejenis beda panjang & tempo agar perencana bisa memilih yang paling pas untuk gerakannya.

def arc(n: int, peak: float = 0.5, sharp: float = 2.0) -> np.ndarray:
    """Naik ke puncak di `peak` (fraksi panjang) lalu turun; 0 di kedua ujung."""
    x = np.linspace(0, 1, n)
    rise = np.clip(x / peak, 0, 1)
    fall = np.clip((1 - x) / (1 - peak), 0, 1)
    return np.sin(np.pi / 2 * np.minimum(rise, fall)) ** sharp


def comb(x: np.ndarray, delay_ms: float, gain: float = 0.7) -> np.ndarray:
    """Resonansi pipa (bunyi "hollow"): umpan balik pendek."""
    d = max(1, int(RATE * delay_ms / 1000))
    out = x.copy()
    for i in range(d, len(out), d):
        out[i:i + d] += gain * out[i - d:i][:len(out[i:i + d])]
    return out


def shaped_whoosh(seconds, lo, hi, peak=0.5, q=0.6, sharp=2.0):
    t = t_axis(seconds)
    env = arc(len(t), peak, sharp)
    noise = rng.standard_normal(len(t))
    return sweep_bandpass2(noise, lo + (hi - lo) * env, q=q) * env


def wh_hollow(seconds):
    return lambda: comb(shaped_whoosh(seconds, 250, 2600, 0.5, 0.5), rng.uniform(2.2, 3.4), 0.55)


def wh_futuristic(seconds):
    def make():
        t = t_axis(seconds)
        env = arc(len(t), 0.5, 1.6)
        air = shaped_whoosh(seconds, 400, 4200, 0.5, 0.7)
        glide = tone(300 + 1400 * env, seconds, ((1, 1.0), (2, 0.35))) * np.sin(2 * np.pi * 38 * t)  # ring mod
        return air + glide * env * 0.12
    return make


def wh_deep_voice(seconds):
    def make():
        t = t_axis(seconds)
        env = arc(len(t), 0.5, 1.8)
        low = shaped_whoosh(seconds, 90, 1100, 0.5, 0.8)
        formant = band(rng.standard_normal(len(t)), 500, 900) * env * 0.35     # rongga "aah" bernada sci-fi
        sub = tone(55 + 70 * env, seconds) * env * 0.35
        return low + formant + sub
    return make


def wh_long(seconds):
    return lambda: shaped_whoosh(seconds, 150, 3800, 0.82, 0.55, 2.4)   # setengah riser: puncak menjelang akhir


def wh_wind(seconds):
    def make():
        t = t_axis(seconds)
        env = arc(len(t), 0.5, 1.2)
        gust = 0.75 + 0.25 * np.sin(2 * np.pi * rng.uniform(1.2, 2.0) * t)
        return sweep_bandpass(rng.standard_normal(len(t)), 220 + 650 * env * gust, q=0.3) * env
    return make


def wh_short(seconds):
    return lambda: shaped_whoosh(seconds, 700, 5200, 0.45, 0.8, 1.4)


def wh_classy():
    return simple_reverb(shaped_whoosh(1.4, 120, 3000, 0.5, 0.4, 1.6), 1.1, 0.35)[:int(1.9 * RATE)]


def wh_synthetic():
    t = t_axis(0.9)
    env = arc(len(t), 0.55, 1.6)
    saw = 2 * ((np.cumsum(120 + 700 * env) / RATE) % 1) - 1
    crushed = np.round(band(saw, 100, 4000) * 6) / 6                          # sedikit "bitcrush"
    return shaped_whoosh(0.9, 300, 5000, 0.55, 0.6) + crushed * env * 0.25


def wh_spacey():
    t = t_axis(1.2)
    env = arc(len(t), 0.5, 1.4)
    air = shaped_whoosh(1.2, 200, 4500, 0.5, 0.5)
    phaser = air * (0.6 + 0.4 * np.sin(2 * np.pi * (0.8 + 3 * env) * t))
    shimmer = tone(1800 + 900 * env, 1.2) * env * 0.06
    return simple_reverb(phaser + shimmer, 1.2, 0.4)[:int(1.8 * RATE)]


def wh_water_drop():
    t = t_axis(0.9)
    env = arc(len(t), 0.45, 1.5)
    drop = tone(500 + 1300 * np.clip((t - 0.3) / 0.15, 0, 1), 0.9) * np.exp(-np.clip(t - 0.4, 0, None) * 14) \
        * np.clip((t - 0.3) / 0.01, 0, 1) * 0.5                               # "plop" di tengah sapuan
    return simple_reverb(shaped_whoosh(0.9, 250, 3000, 0.45, 0.6) * 0.8 + drop * env, 0.8, 0.3)[:int(1.3 * RATE)]


def tx_pop(f0, f1):
    def make():
        t = t_axis(0.12)
        body = tone(f0 + (f1 - f0) * np.exp(-t * 50), 0.12) * np.exp(-t * 40)
        return attack(body + rng.standard_normal(len(t)) * np.exp(-t * 1200) * 0.25, 0.5)
    return make


def tx_ui_click(freq):
    def make():
        t = t_axis(0.09)
        blip = tone(freq, 0.09, ((1, 1.0), (2, 0.2))) * np.exp(-t * 55)
        tick = band(rng.standard_normal(len(t)), 2000, 9000) * np.exp(-t * 700) * 0.6
        return attack(blip + tick, 0.5)
    return make


def tx_scifi_click(f0):
    def make():
        t = t_axis(0.22)
        zap = tone(f0 * (0.35 + 0.65 * np.exp(-t * 30)), 0.22, ((1, 1.0), (3, 0.3))) * np.exp(-t * 22)
        tick = band(rng.standard_normal(len(t)), 3000, 12000) * np.exp(-t * 900)
        return attack(zap * 0.8 + tick, 0.5)
    return make


def gear_tick(base):
    t = t_axis(0.06)
    metal = sum(a * tone(base * r, 0.06, decay=d) for r, a, d in ((1, 1.0, 90), (2.43, 0.6, 120), (3.9, 0.4, 160)))
    return attack(metal + band(rng.standard_normal(len(t)), 2500, 9000) * np.exp(-t * 500) * 0.8, 0.3)


def tx_gear(base):
    return lambda: gear_tick(base)


def tx_video_scan():
    # Roda gigi berputar: tik cepat yang makin rapat, dengan dengung pemindai
    times = np.cumsum(np.linspace(0.05, 0.025, 18))
    ticks = place(times[-1] + 0.1, [(t, gear_tick(rng.uniform(1800, 2600)), rng.uniform(0.5, 1.0)) for t in times])
    scan = tone(900 + 400 * np.linspace(0, 1, len(ticks)), len(ticks) / RATE) * 0.08
    return ticks + scan


def tx_mechanism():
    parts = [(0.0, gear_tick(1500), 1.0), (0.11, gear_tick(2100), 0.8), (0.19, gear_tick(1700), 0.9)]
    ratchet = place(0.3, [(i * 0.022, gear_tick(3000), 0.4) for i in range(10)])
    clunk = tone(120 * (1 + np.exp(-t_axis(0.2) * 30)), 0.2, decay=25) * 0.8
    return place(0.75, parts + [(0.3, ratchet, 1.0), (0.55, clunk, 1.0)])


def tx_scifi_impact(base, crack_hi):
    def make():
        t = t_axis(1.4)
        thump = tone(base * (1 + 1.5 * np.exp(-t * 25)), 1.4, decay=6)
        zap = tone(2400 * np.exp(-t * 9) + 300, 1.4, ((1, 1.0), (2, 0.4))) * np.exp(-t * 14) * 0.35
        crack = band(rng.standard_normal(len(t)), 1500, crack_hi) * np.exp(-t * 30) * 0.6
        return simple_reverb(attack(np.tanh(1.6 * (thump + zap + crack)), 0.5), 1.0, 0.3)[:int(1.8 * RATE)]
    return make


def tx_activate():
    # Energi menyala: akor naik 0,8 dtk lalu hantaman kecil (puncak di hantaman)
    t = t_axis(0.8)
    p = t / t[-1]
    chord = sum(tone(f * (0.5 + 0.5 * p), 0.8, ((1, 1.0), (2, 0.3))) for f in (440, 554.4, 659.3)) * p ** 2 * 0.4
    hum = band(rng.standard_normal(len(t)), 300, 3000 + 4000 * p.mean()) * p ** 3 * 0.5
    return np.concatenate([chord + hum, tx_scifi_impact(70, 9000)()[:int(0.9 * RATE)]])


def tx_camera_click():
    beep = tone(2600, 0.05) * np.clip((0.05 - t_axis(0.05)) / 0.005, 0, 1) * 0.4
    shutter = band(rng.standard_normal(int(0.04 * RATE)), 1500, 10000) * np.exp(-t_axis(0.04) * 160)
    return place(0.25, [(0.0, beep, 1.0), (0.09, shutter, 1.0), (0.14, shutter[::-1] * 0.6, 1.0)])


def tx_choir():
    # "Aah" surgawi: gelombang gergaji per suara, diberi formant vokal a (±700/1200 Hz), masuk perlahan
    t = t_axis(2.6)
    voices = []
    for f in (261.6, 329.6, 392.0, 523.3, 659.3):
        vib = 1 + 0.006 * np.sin(2 * np.pi * rng.uniform(4.5, 5.5) * t)
        saw = 2 * ((np.cumsum(f * vib) / RATE) % 1) - 1
        voices.append(band(saw, 600, 800) + 0.6 * band(saw, 1050, 1300))
    env = np.clip(t / 0.5, 0, 1) * np.clip((t[-1] - t) / 0.9, 0, 1)
    return simple_reverb(sum(voices) * env, 1.6, 0.45)[:int(3.2 * RATE)]


def tx_success():
    note = lambda f: attack(tone(f, 0.6, ((1, 1.0), (2, 0.3), (3, 0.12)), decay=5))
    arp = place(1.3, [(i * 0.08, note(f), 1.0) for i, f in enumerate((659.3, 830.6, 987.8, 1318.5))])
    return simple_reverb(arp + sparkle()[:len(arp)] * 0.25, 0.8, 0.25)[:int(1.6 * RATE)]


def tx_alarm():
    t = t_axis(1.5)
    sq = np.sign(np.sin(2 * np.pi * 150 * t)) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 4 * t)))
    return band(sq, 100, 1800) * np.clip(t / 0.05, 0, 1) * np.clip((t[-1] - t) / 0.1, 0, 1)


def rs_sharp_bass(seconds):
    # Riser bass tajam: sub naik + desis makin terang, berhenti mendadak di puncak (akhir file)
    def make():
        t = t_axis(seconds)
        p = t / t[-1]
        sub = np.tanh(2.2 * tone(38 + 150 * p ** 2, seconds, ((1, 1.0), (2, 0.4), (3, 0.15))))
        air = sweep_bandpass2(rng.standard_normal(len(t)), 300 + 5000 * p ** 2.5, q=0.6)
        return (sub * 0.8 + air * 0.7) * p ** 2.6 * np.clip((t[-1] - t) / 0.012, 0, 1)
    return make


def rs_metallic(seconds):
    # Riser metalik: parsial tak-harmonis naik + kilau, tremolo makin cepat
    def make():
        t = t_axis(seconds)
        p = t / t[-1]
        metal = sum(a * tone(f * (1 + 1.8 * p ** 2), seconds) for f, a in ((310, 1.0), (757, 0.6), (1213, 0.45), (1987, 0.3)))
        trem = 0.6 + 0.4 * np.sin(2 * np.pi * np.cumsum(3 + 22 * p ** 2) / RATE)
        shimmer = band(rng.standard_normal(len(t)), 4000, 14000) * p ** 3 * 0.5
        return (metal * trem * 0.35 + shimmer) * p ** 2.2 * np.clip((t[-1] - t) / 0.012, 0, 1)
    return make


def rs_suck_back(seconds):
    # "Suck-back": hantaman bergema yang dibalik, menyedot ke puncak di akhir
    def make():
        n = int(seconds * RATE)
        hit = sum(a * tone(f, seconds, decay=d) for f, a, d in ((180, 1.0, 2.4), (453, 0.5, 3.1), (1210, 0.3, 4.0)))
        wash = band(rng.standard_normal(n), 2000, 12000) * np.exp(-t_axis(seconds) * 2.6)
        return attack(simple_reverb(hit + wash, 1.0, 0.45)[:n][::-1].copy(), 1) \
            * np.clip((n - 1 - np.arange(n)) / (0.012 * RATE), 0, 1)
    return make


def hit_impact(base, decay, metal):
    def make():
        t = t_axis(1.6)
        sub = tone(base * (1 + 2.5 * np.exp(-t * 30)), 1.6, decay=decay)
        crack = band(rng.standard_normal(len(t)), 600, 9000) * np.exp(-t * 35) * 0.7
        ring = sum(a * tone(f, 1.6, decay=5) for f, a in ((523, 0.3), (1307, 0.2))) * metal
        return simple_reverb(attack(np.tanh(2.0 * (sub + crack + ring)), 0.3), 1.3, 0.3)[:int(2.2 * RATE)]
    return make


SOUND_DESIGN = {
    # Whoosh (gerakan): puncak di tengah, kecuali "long" (menjelang akhir)
    "wh_hollow_1": wh_hollow(0.6), "wh_hollow_2": wh_hollow(0.8), "wh_hollow_3": wh_hollow(1.0),
    "wh_futuristic_1": wh_futuristic(0.5), "wh_futuristic_2": wh_futuristic(0.7), "wh_futuristic_3": wh_futuristic(0.9),
    "wh_deep_1": wh_deep_voice(0.7), "wh_deep_2": wh_deep_voice(0.9), "wh_deep_3": wh_deep_voice(1.2),
    "wh_long_1": wh_long(1.6), "wh_long_2": wh_long(2.3),
    "wh_wind_1": wh_wind(1.4), "wh_wind_2": wh_wind(1.9),
    "wh_short_1": wh_short(0.2), "wh_short_2": wh_short(0.26), "wh_short_3": wh_short(0.32),
    "wh_classy": wh_classy, "wh_synthetic": wh_synthetic, "wh_spacey": wh_spacey, "wh_water_drop": wh_water_drop,
    # Tekstur (kejadian tanpa geser): transien di awal file
    "tx_pop_1": tx_pop(900, 320), "tx_pop_2": tx_pop(1200, 420), "tx_pop_3": tx_pop(700, 260),
    "tx_ui_click_1": tx_ui_click(1500), "tx_ui_click_2": tx_ui_click(2100), "tx_ui_click_3": tx_ui_click(2800),
    "tx_scifi_click_1": tx_scifi_click(3200), "tx_scifi_click_2": tx_scifi_click(4200), "tx_scifi_click_3": tx_scifi_click(2500),
    "tx_gear_1": tx_gear(1900), "tx_gear_2": tx_gear(2400), "tx_gear_3": tx_gear(1500),
    "tx_video_scan": tx_video_scan, "tx_mechanism": tx_mechanism,
    "tx_scifi_impact_1": tx_scifi_impact(60, 9000), "tx_scifi_impact_2": tx_scifi_impact(80, 12000),
    "tx_scifi_impact_3": tx_scifi_impact(50, 6000),
    "tx_activate": tx_activate, "tx_camera_click": tx_camera_click, "tx_choir": tx_choir,
    "tx_success": tx_success, "tx_alarm": tx_alarm,
    # Riser (antisipasi): puncak tepat di akhir file
    "rs_sharp_bass_1": rs_sharp_bass(1.5), "rs_sharp_bass_2": rs_sharp_bass(2.5), "rs_sharp_bass_3": rs_sharp_bass(3.5),
    "rs_metallic_1": rs_metallic(1.5), "rs_metallic_2": rs_metallic(2.5), "rs_metallic_3": rs_metallic(3.5),
    "rs_suck_back_1": rs_suck_back(1.8), "rs_suck_back_2": rs_suck_back(2.8),
    # Hit (pelepas riser): transien di awal file
    "hit_1": hit_impact(45, 3.0, 0.0), "hit_2": hit_impact(60, 4.5, 0.5), "hit_3": hit_impact(38, 2.2, 1.0),
}


SOUNDS = {
    "whoosh": whoosh, "swipe": swipe, "pop": pop, "ding": ding, "boom": boom,
    "riser": riser, "click": click, "notif": notif, "applause": applause,
    # transisi
    "whoosh_deep": whoosh_deep, "glitch": glitch, "reverse": reverse_swell, "tape_stop": tape_stop, "zoom_in": zoom_in,
    # penekanan / dramatis
    "bass_drop": bass_drop, "impact": impact, "heartbeat": heartbeat, "dun_dun": dun_dun, "suspense": suspense,
    "shutter": camera_shutter, "tick_tock": tick_tock, "drum_roll": drum_roll,
    # lucu
    "boing": boing, "rimshot": rimshot, "slide_down": slide_down, "sad_trombone": sad_trombone, "bubble": bubble_pop,
    "scratch": record_scratch, "honk": honk, "crickets": crickets,
    # notifikasi / UI
    "ka_ching": ka_ching, "correct": correct, "wrong": wrong, "beep": censor_beep, "typing": typing,
    "level_up": level_up, "sparkle": sparkle,
    # suasana
    "thunder": thunder, "wind": wind, "gong": gong,
    **SOUND_DESIGN,
}


def write(name: str, samples: np.ndarray):
    samples = samples / (np.max(np.abs(samples)) or 1) * 0.7  # puncak ≈ -3 dBFS
    fade = min(len(samples), int(RATE * 0.005))
    samples[-fade:] *= np.linspace(1, 0, fade)                # tanpa letupan di akhir
    path = os.path.join(OUT_DIR, f"lib_{name}.wav")
    with wave.open(path, "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes((samples * 32767).astype("<i2").tobytes())
    print(f"{path} ({len(samples) / RATE:.2f} dtk)")


if __name__ == "__main__":
    import sys
    os.makedirs(OUT_DIR, exist_ok=True)
    only = set(sys.argv[1:])   # mis. `python tools/make_sfx.py boing rimshot` hanya membuat bunyi itu
    for name, make in SOUNDS.items():
        if not only or name in only:
            write(name, make())
