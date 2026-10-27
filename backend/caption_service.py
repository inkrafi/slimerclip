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

    def transcribe_plain(self, media_path: str) -> list:
        """Transkrip cepat tanpa timestamp per kata (untuk analisis video utuh)."""
        self._load_model()
        segments, info = self.model.transcribe(
            media_path,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500)
        )
        print(f"Terdeteksi bahasa: {info.language} dengan probabilitas {info.language_probability}")
        return [{'start': seg.start, 'end': seg.end, 'text': seg.text} for seg in segments]

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

    # Halaman caption berganti saat pembicara berhenti selama ini (detik) atau kalimat selesai
    PAGE_GAP_SECONDS = 0.7

    @staticmethod
    def _caption_words(segments: list, uppercase: bool) -> list:
        """Semua kata (dengan waktu) dari hasil Whisper; tanda baca ringan di akhir kata dibuang."""
        words = []
        for segment in segments:
            for w in segment.get('words') or []:
                text = CaptionService._escape_ass(w['word'].strip())
                ends_sentence = text[-1:] in '.?!'
                text = text.rstrip('.,;:')
                if not text:
                    continue
                words.append({'start': float(w['start']), 'end': float(w['end']),
                              'text': text.upper() if uppercase else text, 'stop': ends_sentence})
        return words

    def _pages(self, words: list, per_page: int) -> list:
        pages, page = [], []
        for w in words:
            if page and (len(page) >= per_page or page[-1]['stop']
                         or w['start'] - page[-1]['end'] > self.PAGE_GAP_SECONDS):
                pages.append(page)
                page = []
            page.append(w)
        if page:
            pages.append(page)
        return pages

    def generate_ass(self, segments: list, output_path: str, style_config: dict = None):
        """
        Generate file .ass: kata dikelompokkan per halaman (1–6 kata), kata yang sedang diucapkan
        disorot (warna/kotak) dengan efek pop. style_config sudah divalidasi sanitize_caption_style.
        """
        from caption_styles import FONTS, sanitize_caption_style
        style = sanitize_caption_style(style_config)
        c = self.hex_to_ass_color
        base, highlight, outline = c(style['color']), c(style['highlight_color']), c(style['outline_color'])
        size, ow, shadow = style['size'], style['outline_width'], style['shadow']
        y = int(1920 * style['position_y'] / 100)

        if style['background']:
            # BorderStyle 3: kotak transparan di belakang baris (warna = OutlineColour, padding = Outline)
            border_style, line_outline, outline_colour, back_colour = 3, max(10, size // 5), '&H38000000', '&H00000000'
            ow, shadow = 0, 0
        else:
            border_style, line_outline, outline_colour, back_colour = 1, ow, outline, '&H80000000'

        # Tag ASS untuk kata aktif, dan untuk mengembalikan gaya normal sesudahnya.
        # Kotak sorotan = garis tepi tebal berwarna di sekitar kata (libass menggambarnya di bawah teks).
        pop = style['animation'] == 'pop'
        grow = r'\fscx100\fscy100\t(0,90,\fscx110\fscy110)' if pop else ''
        if style['highlight_style'] == 'box':
            pad = max(10, int(size * 0.2))
            active = '{' + rf'\3c{highlight}\bord{pad}\shad0' + grow + '}'
        elif style['highlight_style'] == 'color':
            active = '{' + rf'\c{highlight}' + grow + '}'
        else:
            active = '{' + grow + '}' if grow else ''
        # Kotak sorotan butuh ruang ekstra agar tidak menempel ke kata di sebelahnya (\h = spasi tetap)
        gap = r'\h' if style['highlight_style'] == 'box' else ''
        normal = ('{' + rf'\c{base}\3c{outline_colour}\bord{line_outline}\shad{shadow}\fscx100\fscy100' + '}'
                  if active else '')

        header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{FONTS[style['font']]},{size},{base},{base},{outline_colour},{back_colour},0,0,0,0,100,100,0,0,{border_style},{line_outline},{shadow},5,80,80,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
        events = []
        pages = self._pages(self._caption_words(segments, style['uppercase']), style['words_per_line'])
        if style['mode'] == 'duo':
            events = self._duo_events(pages, style, y)
            pages = []  # sudah ditangani
        for p_idx, page in enumerate(pages):
            next_start = pages[p_idx + 1][0]['start'] if p_idx + 1 < len(pages) else None
            page_end = page[-1]['end'] + 0.3
            if next_start is not None:
                page_end = max(page[-1]['end'], min(page_end, next_start))
            for i, w in enumerate(page):
                ev_start = page[0]['start'] if i == 0 else w['start']
                ev_end = page[i + 1]['start'] if i + 1 < len(page) else page_end
                if ev_end - ev_start < 0.04:
                    continue
                prefix = '{' + rf'\an5\pos(540,{y})' + (r'\fad(80,0)' if pop and i == 0 else '') + '}'
                text = ' '.join(f'{gap}{active}{x["text"]}{normal}{gap}' if j == i and active else x['text']
                                for j, x in enumerate(page))
                events.append(f"Dialogue: 0,{self.format_time_ass(ev_start)},{self.format_time_ass(ev_end)}"
                              f",Default,,0,0,0,,{prefix}{text}")

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(header + "\n".join(events) + "\n")

        print(f"File ASS berhasil dibuat: {output_path} ({len(events)} event caption)")
        return output_path

    @staticmethod
    def duo_lines(words: list, emph: int, stack: bool) -> list:
        """Baris tampilan: satu baris, atau (stack) kata sebelum kata utama / kata utama / kata sesudahnya."""
        if not stack:
            return [list(range(len(words)))]
        return [ix for ix in (list(range(emph)), [emph], list(range(emph + 1, len(words)))) if ix]

    def _duo_events(self, pages: list, style: dict, y: int) -> list:
        """
        Tipografi dua font: kata utama tiap halaman (emphasis_index) memakai font serif miring, 1,5x lebih
        besar, berwarna sorotan. Tanpa garis tepi → pendar gelap lembut agar tetap terbaca.
        - reveal: kata yang belum diucapkan disembunyikan (tetap memegang tempatnya, jadi teks tidak bergeser)
          lalu memudar masuk saat diucapkan; tanpa reveal satu halaman tampil utuh.
        - stack: kata utama di baris sendiri.
        """
        from caption_styles import ACCENT_FONTS, EMPHASIS_SCALE, FONTS, emphasis_index
        c = self.hex_to_ass_color
        size = style['size']
        base_font, accent_font = FONTS[style['font']], ACCENT_FONTS[style['accent_font']]
        to_emph = rf"\fn{accent_font}\i1\fs{round(size * EMPHASIS_SCALE)}\c{c(style['highlight_color'])}"
        to_base = rf"\fn{base_font}\i0\fs{size}\c{c(style['color'])}"
        glowing = not style['background'] and style['outline_width'] == 0 and style['shadow'] == 0
        glow = rf"\bord{max(3, size // 24)}\3c&H000000&\3a&H90&\blur{max(4, size // 12)}" if glowing else ""
        line_alpha = "&H90&" if glowing else "&H00&"
        hide = r"\1a&HFF&\3a&HFF&\4a&HFF&"
        show = rf"\1a&HFF&\3a&HFF&\4a&HFF&\t(0,100,\1a&H00&\3a{line_alpha}\4a&H80&)"
        pop = r"\fad(80,0)\fscx92\fscy92\t(0,140,\fscx100\fscy100)" if style['animation'] == 'pop' else ""
        events = []
        for p_idx, page in enumerate(pages):
            next_start = pages[p_idx + 1][0]['start'] if p_idx + 1 < len(pages) else None
            page_end = page[-1]['end'] + 0.3
            if next_start is not None:
                page_end = max(page[-1]['end'], min(page_end, next_start))
            emph = emphasis_index([w['text'] for w in page])
            lines = self.duo_lines(page, emph, style['stack'])
            # reveal: satu event per kata (kata 0..i terlihat); tanpa reveal: satu event per halaman
            steps = range(len(page)) if style['reveal'] else [len(page) - 1]
            for i in steps:
                start = page[0]['start'] if i == 0 or not style['reveal'] else page[i]['start']
                end = page[i + 1]['start'] if style['reveal'] and i + 1 < len(page) else page_end
                if end - start < 0.04:
                    continue

                def word(j):
                    tags = to_emph if j == emph else ""
                    if style['reveal'] and j == i and i > 0:
                        tags += show
                    elif style['reveal'] and j > i:
                        tags += hide
                    return ('{' + tags + '}' if tags else '') + page[j]['text'] + ('{' + to_base + '}' if j == emph else '')

                text = r"\N".join(' '.join(word(j) for j in ix) for ix in lines)
                intro = pop if i == 0 else ""
                events.append(f"Dialogue: 0,{self.format_time_ass(start)},{self.format_time_ass(end)}"
                              f",Default,,0,0,0,,{{\\an5\\pos(540,{y}){glow}{intro}}}{text}")
        return events


_shared = None
_shared_lock = threading.Lock()


def get_caption_service() -> CaptionService:
    """Satu instance untuk seluruh backend, agar model Whisper hanya dimuat sekali."""
    global _shared
    with _shared_lock:
        if _shared is None:
            _shared = CaptionService()
    return _shared
