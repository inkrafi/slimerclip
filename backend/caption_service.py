import os
import threading
from faster_whisper import WhisperModel

class CaptionService:
    def __init__(self):
        # Inisialisasi model hanya sekali saat service pertama kali dipanggil (lazy load)
        self.model = None
        self._load_lock = threading.Lock()

    def _load_model(self):
        # Lock: dua thread yang memanggil bersamaan tidak memuat model dua kali
        with self._load_lock:
            if self.model is not None:
                return
            print("Memuat model Whisper (small, int8) ke memori...")
            # Menggunakan CPU dengan kuantisasi int8 untuk performa maksimal di i5
            self.model = WhisperModel("small", device="cpu", compute_type="int8")
            print("Model Whisper berhasil dimuat.")
            
    def transcribe(self, audio_path: str, callback=None) -> list:
        """
        Transkrip audio menggunakan faster-whisper dengan word-level timestamps.
        """
        self._load_model()
        
        if callback:
            callback({'status': 'transcribing', 'progress': 10})
            
        print(f"Memulai transkripsi untuk: {audio_path}")
        
        # Word timestamps = True sangat penting untuk efek karaoke (Style B)
        segments, info = self.model.transcribe(
            audio_path, 
            word_timestamps=True,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500)
        )
        
        print(f"Terdeteksi bahasa: {info.language} dengan probabilitas {info.language_probability}")
        
        transcribed_segments = []
        for segment in segments:
            words = []
            if segment.words:
                for w in segment.words:
                    words.append({
                        'start': w.start,
                        'end': w.end,
                        'word': w.word
                    })
            
            transcribed_segments.append({
                'start': segment.start,
                'end': segment.end,
                'text': segment.text,
                'words': words
            })
            
        if callback:
            callback({'status': 'transcribing', 'progress': 100})
            
        return transcribed_segments

    def format_time_ass(self, seconds: float) -> str:
        """Format detik ke format waktu ASS: H:MM:SS.CS"""
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        cs = int(round((seconds - int(seconds)) * 100))
        # Jika cs == 100 karena pembulatan
        if cs == 100:
            s += 1
            cs = 0
            if s == 60:
                s = 0
                m += 1
                if m == 60:
                    m = 0
                    h += 1
        return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

    def hex_to_ass_color(self, hex_color: str) -> str:
        """Konversi HEX (#RRGGBB) ke format warna ASS (&HAABBGGRR)"""
        if not hex_color:
            return "&H00FFFFFF" # Default Putih
            
        hex_color = hex_color.lstrip('#')
        if len(hex_color) == 6:
            r = hex_color[0:2]
            g = hex_color[2:4]
            b = hex_color[4:6]
            return f"&H00{b}{g}{r}"
        return "&H00FFFFFF"

    @staticmethod
    def _escape_ass(text: str) -> str:
        """Hapus karakter yang dianggap tag/escape oleh ASS ({ } \\) dari teks transkrip."""
        return text.replace('{', '(').replace('}', ')').replace('\\', '/').replace('\n', ' ')

    def generate_ass(self, segments: list, output_path: str, style_config: dict = None):
        """
        Generate file .ass dari hasil transkrip dengan word-by-word karaoke style.
        """
        if style_config is None:
            style_config = {}
            
        # Default config (Style B: Karaoke Word-by-Word)
        # Ukuran dalam satuan PlayRes (1080x1920), jadi 72 ≈ 3.75% tinggi layar
        font = (style_config.get('font') or 'Arial').strip()
        # Bold diatur lewat flag style, bukan nama font ("Arial Bold" tidak dikenali libass)
        if font.lower().endswith(' bold'):
            font = font[:-5].strip()
        size = style_config.get('size', 72)
        color = self.hex_to_ass_color(style_config.get('color', '#FFFFFF'))
        outline_color = self.hex_to_ass_color(style_config.get('outline_color', '#000000'))
        outline_width = style_config.get('outline_width', 4)
        highlight_color = self.hex_to_ass_color(style_config.get('highlight_color', '#FFFF00')) # Kuning
        karaoke = style_config.get('highlight_mode', 'word') == 'word'

        # Pada tag \k, kata yang belum diucapkan memakai SecondaryColour dan berubah
        # ke PrimaryColour saat diucapkan. Jadi untuk karaoke: Primary = highlight.
        primary, secondary = (highlight_color, color) if karaoke else (color, highlight_color)

        # Posisi: 2 (Bawah), 5 (Tengah), 8 (Atas)
        pos = style_config.get('position', 'bottom')
        alignment = 2
        if pos == 'center': alignment = 5
        elif pos == 'top': alignment = 8
        
        # ASS Header (Resolusi PlayRes disetel untuk video 9:16)
        ass_content = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 1

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font},{size},{primary},{secondary},{outline_color},&H80000000,-1,0,0,0,100,100,0,0,1,{outline_width},0,{alignment},60,60,220,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
        # Generate Dialogues dengan karaoke tags ({\k})
        for segment in segments:
            words = [w for w in segment['words'] if self._escape_ass(w['word'].strip())]

            # Jika menggunakan word-by-word highlight (Style B)
            if karaoke and words:
                # Dialog dimulai tepat saat kata pertama diucapkan
                d_start = words[0]['start']
                d_end = max(segment['end'], words[-1]['end'])

                # Durasi \k (centisecond) dihitung dari selisih waktu mulai kata berikutnya,
                # sehingga jeda antar kata ikut terhitung dan highlight tidak makin telat.
                # Dihitung kumulatif dari d_start agar error pembulatan tidak menumpuk.
                offsets = [int(round((w['start'] - d_start) * 100)) for w in words]
                offsets.append(int(round((words[-1]['end'] - d_start) * 100)))

                parts = []
                for i, w in enumerate(words):
                    dur_cs = max(offsets[i + 1] - offsets[i], 1)
                    parts.append(f"{{\\k{dur_cs}}}{self._escape_ass(w['word'].strip())}")
                dialogue_text = " ".join(parts)

                ass_content += (f"Dialogue: 0,{self.format_time_ass(d_start)},{self.format_time_ass(d_end)}"
                                f",Default,,0,0,0,,{dialogue_text}\n")
            else:
                # Standard line-by-line (tanpa efek)
                clean_text = self._escape_ass(segment['text'].strip())
                if not clean_text:
                    continue
                ass_content += (f"Dialogue: 0,{self.format_time_ass(segment['start'])},{self.format_time_ass(segment['end'])}"
                                f",Default,,0,0,0,,{clean_text}\n")

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(ass_content)
            
        print(f"File ASS berhasil dibuat: {output_path}")
        return output_path
