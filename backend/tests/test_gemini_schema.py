from gemini_service import _looser_schema
from prompt_templates import clip_analysis_schema, target_segment_count


def test_target_count_follows_video_length():
    assert target_segment_count(776) == 12       # video 13 menit: ±1 per menit
    assert target_segment_count(480) == 8        # video 8 menit
    assert target_segment_count(4294) == 12      # video 71 menit (batas skema)
    assert target_segment_count(120) == 3        # video 2 menit: minimal 3
    assert target_segment_count(60) == 2         # video 1 menit: hanya muat 2 momen 30 detik
    assert target_segment_count(0) == 10
    # Profil admin: jumlah pilihan, tetap dibatasi yang muat di video
    assert target_segment_count(3600, {"clip_count": 5}) == 5
    assert target_segment_count(300, {"clip_count": 12, "duration": "long"}) == 5


def test_rejected_schema_is_loosened_then_dropped():
    schema = clip_analysis_schema(12)
    assert schema["properties"]["segments"]["minItems"] == 3
    assert _looser_schema(schema) is None                        # minItems ≤5 → tanpa skema
    big = {**schema, "properties": {**schema["properties"],
                                    "segments": {**schema["properties"]["segments"], "minItems": 8}}}
    assert _looser_schema(big)["properties"]["segments"]["minItems"] == 5
    assert big["properties"]["segments"]["minItems"] == 8       # skema asli tidak diubah
