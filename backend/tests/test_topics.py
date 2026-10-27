import topics


def test_safe_url_and_private_hosts_rejected():
    assert topics.safe_url("https://katadata.co.id/a") == "https://katadata.co.id/a"
    assert topics.safe_url("javascript:alert(1)") == "" and topics.safe_url("file:///etc/passwd") == ""
    assert topics._public_host("localhost") is False and topics._public_host("127.0.0.1") is False
    assert topics._get("http://127.0.0.1:5000/me") is None


def test_sanitize_sources_drops_bad_items():
    sources = topics.sanitize_sources([
        {"title": "Judul", "url": "https://media.id/a", "source": "Media", "date": "2026-10-27"},
        {"title": "Tanpa URL"}, {"title": "Skema aneh", "url": "ftp://x/y"}, "bukan dict",
    ])
    assert sources == [{"title": "Judul", "url": "https://media.id/a", "source": "Media", "date": "2026-10-27"}]


def test_gather_headlines_dedupes(monkeypatch):
    item = lambda t, u: {"title": t, "url": u, "source": "S", "date": "2026-10-27"}
    monkeypatch.setattr(topics, "search_news", lambda q, limit=8: [item("IHSG Melemah Hari Ini", "https://a.id/1"),
                                                                    item("IHSG melemah hari ini!", "https://b.id/2")])
    monkeypatch.setattr(topics, "google_trends", lambda: [item("Tren baru", "https://a.id/1"), item("Tren lain", "https://c.id/3")])
    titles = [h["title"] for h in topics.gather_headlines("", ["investasi", "bisnis"])]
    assert titles == ["IHSG Melemah Hari Ini", "Tren lain"]                 # judul sama / URL sama dibuang
    assert len(topics.gather_headlines("saham", [])) == 1                    # kata kunci: tanpa Google Trends


def test_generate_ideas_maps_sources_from_headline_numbers(monkeypatch):
    import gemini_service
    headlines = [{"title": f"Berita {i}", "url": f"https://m.id/{i}", "source": "M", "date": "2026-10-27"} for i in range(1, 4)]
    monkeypatch.setattr(gemini_service, "_call_gemini", lambda *a, **k: {"ideas": [
        {"title": "Ide A", "angle": "Sudut", "why": "Ramai", "source_ids": [2, 2, 9]},     # 9 di luar daftar
        {"title": "Ide tanpa sumber", "angle": "", "why": "", "source_ids": [0]},
    ]})
    ideas = topics.generate_ideas(headlines, "Investasi")
    assert len(ideas) == 1 and [s["url"] for s in ideas[0]["sources"]] == ["https://m.id/2"]


def test_article_text_extracts_paragraphs(monkeypatch):
    class Res:
        headers = {"Content-Type": "text/html; charset=utf-8"}
        encoding = "utf-8"
        content = ("<html><script>var x='<p>bukan isi</p>'</script><nav><p>Menu menu menu menu menu menu menu menu menu menu menu</p></nav>"
                   + "".join(f"<p>Paragraf isi berita nomor {i} yang cukup panjang untuk dianggap konten utama artikel.</p>" for i in range(6))
                   + "<p>Baca juga: berita lain yang tidak relevan dengan isi artikel ini sama sekali</p></html>").encode()

    monkeypatch.setattr(topics, "_get", lambda url: Res())
    text = topics.article_text("https://media.id/a")
    assert text.count("Paragraf isi berita") == 6 and "Menu" not in text and "Baca juga" not in text and "bukan isi" not in text
