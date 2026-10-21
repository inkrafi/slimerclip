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


SOUNDS = {
    "whoosh": whoosh, "swipe": swipe, "pop": pop, "ding": ding, "boom": boom,
    "riser": riser, "click": click, "notif": notif, "applause": applause,
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
    os.makedirs(OUT_DIR, exist_ok=True)
    for name, make in SOUNDS.items():
        write(name, make())
