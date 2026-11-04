"""
Suara ElevenLabs lewat API. Hasilnya WAV, sama dengan rekaman dan Gemini TTS, jadi alur render tidak berubah.

Paket free hanya boleh memakai suara bawaan akun lewat API dan tidak punya lisensi komersial, jadi hasilnya belum boleh
dipakai untuk video yang dimonetisasi. Daftar suara ditulis di sini karena key yang izinnya dibatasi tidak bisa membacanya.
"""
import os
import subprocess

import requests

API_URL = "https://api.elevenlabs.io/v1/text-to-speech/"
MODEL = "eleven_multilingual_v2"
TIMEOUT = 90
VOICES = {
    "TX3LPaxmHKxFdv7VOQHJ": "Liam",
    "iP95p4xoKVk53GoZ742B": "Chris",
    "nPczCjzI2devNBz1zQrb": "Brian",
    "cjVigY5qzO86Huf0OWal": "Eric",
    "bIHbv24MWmeRgasZH58o": "Will",
}
DEFAULT_VOICE = "TX3LPaxmHKxFdv7VOQHJ"
SETTINGS = {"stability": 0.45, "similarity_boost": 0.75, "style": 0.2, "use_speaker_boost": True}


class VoiceError(Exception):
    """Pesan yang aman ditampilkan ke pengguna."""


def api_key() -> str:
    return os.getenv("ELEVENLABS_API_KEY", "").strip()


def available() -> bool:
    return bool(api_key())


def is_voice(voice_id) -> bool:
    return voice_id in VOICES


def _error_message(res: requests.Response) -> str:
    try:
        detail = res.json().get("detail") or {}
    except ValueError:
        detail = {}
    code = detail.get("code") or detail.get("status") or "" if isinstance(detail, dict) else ""
    if code == "quota_exceeded":
        return "Kredit ElevenLabs habis. Tunggu kuota bulan depan, naikkan paket, atau pakai suara lain."
    if res.status_code == 401:
        return "API key ElevenLabs ditolak, atau izin Text to Speech belum aktif."
    if res.status_code == 402:
        return "Suara ini tidak tersedia di paket ElevenLabs kamu. Pilih suara lain."
    if res.status_code == 429:
        return "ElevenLabs sedang membatasi permintaan. Coba lagi sebentar lagi."
    return f"ElevenLabs gagal membuat suara (kode {res.status_code})."


def synthesize(text: str, voice_id: str, out_path: str) -> None:
    """Tulis WAV mono ke out_path."""
    try:
        res = requests.post(API_URL + voice_id, params={"output_format": "mp3_44100_128"}, headers={"xi-api-key": api_key()},
                            json={"text": text, "model_id": MODEL, "voice_settings": SETTINGS}, timeout=TIMEOUT)
    except requests.RequestException as e:
        raise VoiceError("ElevenLabs tidak bisa dihubungi. Coba lagi sebentar lagi.") from e
    if not res.ok:
        raise VoiceError(_error_message(res))
    mp3_path = out_path + ".mp3"
    tmp_path = out_path + ".tmp.wav"
    try:
        with open(mp3_path, "wb") as f:
            f.write(res.content)
        done = subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", mp3_path, "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le", tmp_path],
                              capture_output=True, text=True, encoding="utf-8", errors="replace")
        if done.returncode:
            raise VoiceError("Suara dari ElevenLabs tidak bisa dibaca. Coba lagi.")
        os.replace(tmp_path, out_path)
    finally:
        for path in (mp3_path, tmp_path):
            if os.path.exists(path):
                os.remove(path)
