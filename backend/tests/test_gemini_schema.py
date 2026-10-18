from gemini_service import _looser_schema
from prompt_templates import clip_analysis_schema, target_segment_count


def test_target_count_follows_video_length():
    assert target_segment_count(776) == 9        # video 13 menit
    assert target_segment_count(4294) == 12      # video 71 menit (batas skema)
    assert target_segment_count(120) == 5
    assert target_segment_count(0) == 10


def test_rejected_schema_is_loosened_then_dropped():
    schema = clip_analysis_schema(12)
    looser = _looser_schema(schema)
    assert looser["properties"]["segments"]["minItems"] == 5
    assert schema["properties"]["segments"]["minItems"] == 12   # skema asli tidak diubah
    assert _looser_schema(looser) is None
