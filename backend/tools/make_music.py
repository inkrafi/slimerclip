"""
Buat pustaka musik latar bawaan (backend/music/bgm_*.m4a) untuk edit otomatis.

Semua bunyi disintesis dari nol (gelombang sinus/harmonik, noise, envelope) — tidak ada sampel atau lagu
pihak lain, jadi bebas dipakai tanpa lisensi. Lagu viral/populer berhak cipta tidak disertakan; musik milik
sendiri (berlisensi) bisa diupload di editor dan dipilih otomatis sesuai suasana dari nama filenya.

    python tools/make_music.py
"""
import os
import subprocess
import tempfile
import wave

import numpy as np

RATE = 44100
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "music")
rng = np.random.default_rng(11)


def hz(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def t_axis(seconds: float) -> np.ndarray:
    return np.arange(int(RATE * seconds)) / RATE


def adsr(n: int, a: float, d: float, s: float, r: float) -> np.ndarray:
    """Envelope (detik) attack/decay/sustain level/release untuk n sampel."""
    env = np.full(n, s, dtype=np.float64)
    ai, di, ri = int(a * RATE), int(d * RATE), int(r * RATE)
    ai = min(ai, n)
    env[:ai] = np.linspace(0, 1, ai, endpoint=False)
    d_end = min(n, ai + di)
    env[ai:d_end] = np.linspace(1, s, d_end - ai, endpoint=False)
    if ri:
        ri = min(ri, n)
        env[n - ri:] *= np.linspace(1, 0, ri)
    return env


def lowpass(x: np.ndarray, cutoff: float) -> np.ndarray:
    """Low-pass lewat FFT (mulus, cepat untuk sinyal panjang)."""
    spec = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(len(x), 1 / RATE)
    spec *= 1 / np.sqrt(1 + (freqs / cutoff) ** 4)
    return np.fft.irfft(spec, len(x))


def highpass(x: np.ndarray, cutoff: float) -> np.ndarray:
    spec = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(len(x), 1 / RATE)
    spec *= 1 / np.sqrt(1 + (cutoff / np.maximum(freqs, 1)) ** 4)
    return np.fft.irfft(spec, len(x))


def reverb(x: np.ndarray, seconds: float = 1.8, mix: float = 0.25) -> np.ndarray:
    """Reverb: konvolusi dengan noise yang meluruh eksponensial."""
    n = int(seconds * RATE)
    ir = rng.standard_normal(n) * np.exp(-np.linspace(0, 7, n))
    ir = lowpass(ir, 5000)
    ir /= np.sqrt(np.sum(ir ** 2))
    size = len(x) + n
    wet = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:len(x)]
    return x * (1 - mix) + wet * mix


# ── Instrumen ────────────────────────────────────────────────

def epiano(freq, dur):
    t = t_axis(dur)
    tone = (np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(4 * np.pi * freq * t) * np.exp(-t * 3)
            + 0.12 * np.sin(6 * np.pi * freq * t) * np.exp(-t * 6))
    tremolo = 1 + 0.15 * np.sin(2 * np.pi * 4.5 * t)
    return tone * tremolo * adsr(len(t), 0.01, 0.6, 0.45, min(0.4, dur / 2))


def pad(freq, dur):
    t = t_axis(dur)
    tone = sum(np.sin(2 * np.pi * freq * k * (1 + d) * t) / k for k in range(1, 6) for d in (-0.003, 0.003))
    return tone * adsr(len(t), min(0.8, dur / 3), 0.5, 0.8, min(1.0, dur / 3)) * 0.25


def pluck(freq, dur, decay=4.0):
    t = t_axis(dur)
    tone = sum(np.sin(2 * np.pi * freq * k * t) * np.exp(-t * decay * k) / k for k in range(1, 8))
    return tone * adsr(len(t), 0.003, 0.05, 1.0, 0.03)


def bass(freq, dur):
    t = t_axis(dur)
    tone = np.tanh(1.6 * (np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(4 * np.pi * freq * t)))
    return tone * adsr(len(t), 0.005, 0.15, 0.7, 0.05)


def kick(dur=0.45):
    t = t_axis(dur)
    f = 45 + 80 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / RATE) * np.exp(-t * 9)


def snare(dur=0.25, brush=False):
    t = t_axis(dur)
    noise = highpass(rng.standard_normal(len(t)), 1800 if brush else 1200)
    body = 0 if brush else 0.5 * np.sin(2 * np.pi * 185 * t) * np.exp(-t * 25)
    return (noise * (0.35 if brush else 0.6) + body) * np.exp(-t * (14 if brush else 20))


def hat(dur=0.06):
    t = t_axis(dur)
    return highpass(rng.standard_normal(len(t)), 7000) * np.exp(-t * 70) * 0.35


def boom(dur=1.6):
    t = t_axis(dur)
    return np.sin(2 * np.pi * (38 + 20 * np.exp(-t * 4)) * t) * np.exp(-t * 2.2)


# ── Aransemen ────────────────────────────────────────────────

class Track:
    def __init__(self, bpm: float, bars: int):
        self.beat = 60 / bpm
        self.buf = np.zeros(int(RATE * self.beat * 4 * bars) + RATE * 2)

    def put(self, sound: np.ndarray, beat: float, gain: float = 1.0):
        i = int(beat * self.beat * RATE)
        end = min(len(self.buf), i + len(sound))
        self.buf[i:end] += sound[:end - i] * gain

    def render(self, rev=0.25, rev_s=1.8) -> np.ndarray:
        x = reverb(self.buf, rev_s, rev)
        x = np.tanh(x / (np.max(np.abs(x)) + 1e-9) * 1.4)        # kompresi lembut
        x *= 0.89 / np.max(np.abs(x))                              # ±-1 dBFS
        n = int(self.beat * 4 * RATE * (len(self.buf) // int(self.beat * 4 * RATE)))
        x = x[:n]
        fade = int(0.02 * RATE)
        x[:fade] *= np.linspace(0, 1, fade)
        x[-fade:] *= np.linspace(1, 0, fade)
        return x


def chord_notes(root: int, kind: str) -> list:
    shapes = {"maj7": [0, 4, 7, 11], "m7": [0, 3, 7, 10], "maj": [0, 4, 7], "min": [0, 3, 7], "6": [0, 4, 7, 9]}
    return [root + i for i in shapes[kind]]


def santai():
    """Lo-fi santai: e-piano jazzy, kick & snare lembut, hi-hat swing, desis piringan hitam."""
    tr = Track(78, 16)
    prog = [(65, "maj7"), (64, "m7"), (62, "m7"), (60, "maj7")]
    for bar in range(16):
        root, kind = prog[bar % 4]
        for n in chord_notes(root - 12, kind):
            tr.put(epiano(hz(n), tr.beat * 3.8), bar * 4, 0.16)
        tr.put(bass(hz(root - 36), tr.beat * 1.8), bar * 4, 0.35)
        tr.put(bass(hz(root - 36 + 7), tr.beat * 0.9), bar * 4 + 2.5, 0.22)
        if bar >= 2:
            tr.put(kick(), bar * 4, 0.6)
            tr.put(kick(), bar * 4 + 2.5, 0.45)
            for b in (1, 3):
                tr.put(snare(brush=True), bar * 4 + b, 0.5)
            for e in range(8):
                tr.put(hat(), bar * 4 + e * 0.5 + (0.08 if e % 2 else 0), 0.35 if e % 2 else 0.5)
    tr.buf[:len(tr.buf)] += lowpass(rng.standard_normal(len(tr.buf)), 3000) * 0.006   # desis vinyl
    return tr.render(0.2, 1.5)


def tegang():
    """Tegang/serius: pad minor gelap, bas berdenyut 1/8, detak hi-hat, boom tiap 2 bar."""
    tr = Track(92, 16)
    prog = [(57, "min"), (53, "maj"), (50, "min"), (52, "maj")]
    for bar in range(16):
        root, kind = prog[bar % 4]
        for n in chord_notes(root - 12, kind):
            tr.put(pad(hz(n), tr.beat * 4), bar * 4, 0.12)
        for e in range(8):
            tr.put(bass(hz(root - 24), tr.beat * 0.45), bar * 4 + e * 0.5, 0.28 if e % 2 else 0.36)
        if bar >= 4:
            for s in range(16):
                tr.put(hat(0.04), bar * 4 + s * 0.25, 0.18 if s % 4 else 0.3)
        if bar % 2 == 0:
            tr.put(boom(), bar * 4, 0.5)
    tr.buf = lowpass(tr.buf, 6000)
    return tr.render(0.3, 2.2)


def semangat():
    """Semangat/inspiratif: arpeggio pluck, pad mayor, kick 4/4, clap di 2 & 4."""
    tr = Track(112, 16)
    prog = [(60, "maj"), (55, "maj"), (57, "min"), (53, "maj")]
    for bar in range(16):
        root, kind = prog[bar % 4]
        notes = chord_notes(root, kind)
        for n in chord_notes(root - 12, kind):
            tr.put(pad(hz(n), tr.beat * 4), bar * 4, 0.08)
        arp = notes + [notes[0] + 12, notes[1] + 12, notes[2], notes[1], notes[0] + 12]
        for e, n in enumerate(arp[:8]):
            tr.put(pluck(hz(n), tr.beat * 0.5, 5), bar * 4 + e * 0.5, 0.16)
        tr.put(bass(hz(root - 24), tr.beat * 0.9), bar * 4, 0.32)
        tr.put(bass(hz(root - 24), tr.beat * 0.9), bar * 4 + 2, 0.32)
        if bar >= 4:
            for b in range(4):
                tr.put(kick(), bar * 4 + b, 0.55)
                tr.put(hat(), bar * 4 + b + 0.5, 0.45)
            for b in (1, 3):
                tr.put(snare(), bar * 4 + b, 0.35)
    return tr.render(0.22, 1.6)


def lucu():
    """Lucu/ceria: pluck staccato memantul (akar-kuint-oktaf), bas berjalan, snare ringan."""
    tr = Track(124, 16)
    prog = [65, 70, 72, 65]
    for bar in range(16):
        root = prog[bar % 4]
        pattern = [0, 7, 12, 7, 0, 7, 16, 12]
        for e, step in enumerate(pattern):
            tr.put(pluck(hz(root + step), tr.beat * 0.3, 9), bar * 4 + e * 0.5, 0.2)
        for b, step in enumerate([0, 4, 7, 4]):
            tr.put(bass(hz(root - 24 + step), tr.beat * 0.4), bar * 4 + b, 0.3)
        if bar >= 2:
            tr.put(kick(0.3), bar * 4, 0.45)
            tr.put(kick(0.3), bar * 4 + 2, 0.45)
            for b in (1, 3):
                tr.put(snare(0.15), bar * 4 + b, 0.3)
    return tr.render(0.12, 1.0)


def dramatis():
    """Dramatis/emosional: arpeggio piano lambat, pad senar, timpani lembut tiap 4 bar."""
    tr = Track(68, 12)
    prog = [(57, "min"), (53, "maj"), (60, "maj"), (55, "maj")]
    for bar in range(12):
        root, kind = prog[bar % 4]
        notes = chord_notes(root, kind)
        for n in chord_notes(root - 12, kind):
            tr.put(pad(hz(n), tr.beat * 4), bar * 4, 0.1)
        for e, n in enumerate([notes[0], notes[1], notes[2], notes[0] + 12, notes[2], notes[1]]):
            tr.put(pluck(hz(n), tr.beat * 2, 1.4), bar * 4 + e * (4 / 6), 0.17)
        tr.put(bass(hz(root - 24), tr.beat * 3.8), bar * 4, 0.22)
        if bar % 4 == 0:
            tr.put(boom(2.4), bar * 4, 0.45)
    return tr.render(0.35, 2.8)


TRACKS = {"santai": santai, "tegang": tegang, "semangat": semangat, "lucu": lucu, "dramatis": dramatis}


def save(name: str, x: np.ndarray):
    os.makedirs(OUT_DIR, exist_ok=True)
    fd, wav_path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    with wave.open(wav_path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes((x * 32767).astype("<i2").tobytes())
    out = os.path.join(OUT_DIR, f"bgm_{name}.m4a")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", wav_path, "-c:a", "aac", "-b:a", "128k", "-ac", "2", out], check=True)
    os.remove(wav_path)
    print(f"{out} ({len(x) / RATE:.0f} dtk)")


if __name__ == "__main__":
    for track_name, make in TRACKS.items():
        save(track_name, make())
