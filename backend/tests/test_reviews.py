import time

import reviews


def test_publish_platform_and_expiry():
    assert reviews.publish_platform("https://www.youtube.com/shorts/abc") == "youtube"
    assert reviews.publish_platform("https://vt.tiktok.com/ZS123/") == "tiktok"
    assert reviews.publish_platform("https://www.instagram.com/reel/xyz/") == "instagram"
    assert reviews.publish_platform("https://youtube.com.evil.net/x") is None
    assert reviews.publish_platform("javascript:alert(1)") is None
    review = reviews.create("Klien", "", "", [{"video_id": "v", "key": "k"}])
    assert not reviews.expired(review)
    review["expires_at"] = time.time() - 1
    assert reviews.expired(review)


def test_one_link_per_platform_and_summary():
    review = reviews.create("Klien", "", "", [{"video_id": "v", "key": "k"}])
    reviews.add_publish(review, "v", "k", "https://youtube.com/shorts/a")
    links = reviews.add_publish(review, "v", "k", "https://youtube.com/shorts/b")
    assert [l["url"] for l in links] == ["https://youtube.com/shorts/b"]
    reviews.decide(review, "v", "k", "revision", "aneh", "x" * 900)
    decision = review["decisions"]["v|k"]
    assert decision["reason"] == "lainnya" and len(decision["note"]) == reviews.NOTE_MAX
    assert reviews.summary(review) | {"last_opened": None} == {
        "total": 1, "approved": 0, "revision": 1, "published": 1, "pending": 0, "opened": 0, "last_opened": None}
