import auto_edit
import clip_effects
import clip_profile
import subtitle_translate


def _transcript(*words):
    return {"segments": [{"words": [{"start": a, "end": b, "word": w} for a, b, w in words]}]}


def test_mood_and_music_pick():
    assert auto_edit.mood_for({"emotion_trigger": "TAWA"}) == "lucu"
    assert auto_edit.mood_for({"emotion_trigger": "KONTROVERSI"}) == "tegang"
    assert auto_edit.mood_for({"emotion_trigger": "INSPIRASI", "category": "bisnis"}) == "semangat"
    assert auto_edit.mood_for({}) == "santai"
    # Musik upload yang namanya cocok suasana diutamakan, kalau tidak pakai musik bawaan
    assert auto_edit.pick_music("semangat", ["a1b2c3d4_Epic Rise.mp3", "x_lofi.mp3"]) == "a1b2c3d4_Epic Rise.mp3"
    assert auto_edit.pick_music("tegang", ["x_lofi.mp3"]) == "bgm_tegang.m4a"


def test_auto_recipe_is_valid_and_tasteful():
    seg = {"emotion_trigger": "KAGET", "hook_start": "01:52"}
    words = _transcript((100.2, 100.6, " Ini"), (104.0, 104.5, " 2"), (104.5, 105.0, " juta"),
                        (111.9, 112.3, " Tapi"), (130.0, 130.4, " 50"), (131.0, 131.4, " persen"))
    recipe, summary = auto_edit.build(seg, 100.0, 140.0, words, ["Kenapa dia *nolak*?"], [])
    edit = clip_effects.sanitize_edit(recipe, 100.0, 140.0)
    assert edit["hook"]["enabled"] and edit["hook"]["text"] == "Kenapa dia *nolak*?" and edit["hook"]["anim"] == "pop"
    assert edit["music"]["asset"] == "bgm_tegang.m4a" and edit["music"]["volume"] == 18
    assert edit["voice"] == {"volume": 100, "clean": True} and edit["enhance"] == {"video": True}
    kinds = [(s["asset"], s["at"]) for s in edit["sfx"]]
    assert kinds[0] == ("lib_whoosh_deep.wav", 100.05)                # transisi saat hook muncul (suasana tegang)
    assert ("lib_dun_dun.wav", 111.78) in kinds                        # tepat sebelum kalimat terkuat
    assert any(a == "lib_ding.wav" and t == 130.0 for a, t in kinds)   # angka penting
    assert not any(a == "lib_ding.wav" and t < 105 for a, t in kinds)  # bukan selama hook tampil
    ats = [t for _, t in kinds]
    assert len(kinds) <= auto_edit.MAX_SFX and all(b - a >= auto_edit.SFX_GAP for a, b in zip(ats[1:], ats[2:]))
    assert summary["music"] == "Tegang / serius" and summary["sfx"] == len(kinds)


def test_speech_chain_voice_options():
    assert "afftdn" not in clip_effects.speech_chain(None)
    chain = clip_effects.speech_chain({"volume": 150, "clean": True})
    assert chain.startswith("highpass") and "volume=1.50" in chain and chain.endswith("alimiter=limit=0.95")
    assert "volume" not in clip_effects.speech_chain({"volume": 100})
    graph = clip_effects.audio_graph({"volume": 18, "ducking": True}, None, [], 30, True, "aout", {"clean": True})
    assert "afftdn" in graph


def test_old_recipes_keep_enhancements_off():
    edit = clip_effects.sanitize_edit({}, 0, 30)
    assert edit["voice"] == {"volume": 100, "clean": False} and edit["enhance"] == {"video": False}
    assert clip_effects.sanitize_edit({"music": {"asset": "bgm_lucu.m4a"}}, 0, 30)["music"]["asset"] == "bgm_lucu.m4a"


def test_subtitle_retime_follows_speech_and_pauses():
    words = [{"start": 0.0, "end": 1.0, "word": " Hello"}, {"start": 3.0, "end": 4.0, "word": " world"}]
    out = subtitle_translate.retime(words, ["Halo", "dunia"])
    assert out[0]["start"] == 0.0 and out[-1]["end"] == 4.0
    assert out[1]["start"] >= 3.0               # token kedua jatuh setelah jeda, bukan di tengah jeda
    three = subtitle_translate.retime(words, ["Halo", "dunia", "semua"])
    assert all(not (1.0 < w["start"] < 3.0) for w in three)    # tidak ada kata yang mulai di dalam jeda


def test_subtitle_target():
    assert clip_profile.subtitle_target({"subtitle_language": "id"}, "en") == "id"
    assert clip_profile.subtitle_target({"subtitle_language": "id"}, "id") is None
    assert clip_profile.subtitle_target({"subtitle_language": "same"}, "en") is None
    assert [l["id"] for l in clip_profile.options()["languages"]] == ["id", "en"]


def test_template_without_music_keeps_clip_music():
    style = clip_effects.template_style({})
    edit = clip_effects.sanitize_edit({"music": {"asset": "bgm_santai.m4a", "volume": 18}}, 0, 30)
    out = clip_effects.apply_template(edit, style, "Hook", lambda n: True, None)
    assert out["music"]["asset"] == "bgm_santai.m4a"


def test_funny_moment_gets_rimshot_after_punchline_and_money_gets_kaching():
    seg = {"emotion_trigger": "TAWA", "hook_start": "00:20"}
    words = _transcript((20.0, 20.4, " Terus"), (20.5, 21.0, " dia"), (21.1, 21.6, " jatuh."), (22.0, 22.3, " Haha"),
                        (30.0, 30.3, " 5"), (30.3, 30.8, " juta"))
    recipe, _ = auto_edit.build(seg, 10.0, 45.0, words, ["Endingnya *nggak* nyangka"], [])
    kinds = {s["asset"]: s["at"] for s in recipe["sfx"]}
    assert recipe["sfx"][0]["asset"] == "lib_swipe.wav"
    assert kinds["lib_rimshot.wav"] == 21.75                            # setelah "jatuh." selesai
    assert kinds["lib_ka_ching.wav"] == 30.0                            # nominal uang


def test_user_sfx_replaces_builtin_by_name():
    seg = {"emotion_trigger": "KONTROVERSI", "hook_start": "00:20"}
    words = _transcript((20.0, 20.5, " Ini"))
    audio = [{"name": "a1b2c3d4_vine_boom.mp3", "size_mb": 0.1}, {"name": "x_dramatic_dun.mp3", "size_mb": 0.2},
             {"name": "y_epic_tense_theme.mp3", "size_mb": 4.0}]
    recipe, summary = auto_edit.build(seg, 10.0, 45.0, words, ["Hook"], audio)
    assets = [s["asset"] for s in recipe["sfx"]]
    assert "x_dramatic_dun.mp3" in assets                               # pengganti "dun dun"
    assert recipe["music"]["asset"] == "y_epic_tense_theme.mp3"         # file besar = musik
    assert "vine_boom" not in recipe["music"]["asset"]


def test_sfx_library_grouped_and_files_exist():
    import os
    assert len(clip_effects.SFX_LIBRARY) >= 40
    assert set(clip_effects.SFX_GROUP_OF.values()) == {"Transisi", "Penekanan", "Lucu", "Notifikasi", "Suasana"}
    for name in clip_effects.SFX_LIBRARY:
        assert os.path.isfile(os.path.join(clip_effects.SFX_DIR, name)), name
    for whoosh, punch in auto_edit.MOOD_SFX.values():
        assert whoosh in clip_effects.SFX_LIBRARY and punch in clip_effects.SFX_LIBRARY


def test_music_rotation_tags_and_guess():
    tracks = [{"name": "a_song1.mp3", "mood": "lucu", "mood_source": "tag", "size_mb": 3},
              {"name": "b_song2.mp3", "mood": "lucu", "mood_source": "tag", "size_mb": 3},
              {"name": "c_all.mp3", "mood": "umum", "mood_source": "tag", "size_mb": 3},
              {"name": "d_funny_boing.mp3", "mood": "lucu", "mood_source": "name", "size_mb": 0.1}]
    picks = {auto_edit.build({"emotion_trigger": "TAWA"}, s, s + 40, None, [], tracks)[0]["music"]["asset"] for s in (10, 11)}
    assert picks == {"a_song1.mp3", "b_song2.mp3"}                    # bergantian antar klip
    tense = auto_edit.build({"emotion_trigger": "KONTROVERSI"}, 10, 50, None, [], tracks)[0]["music"]["asset"]
    assert tense == "c_all.mp3"                                        # tidak ada yang tegang → "umum"
    # Tebakan nama tidak menjadikan file SFX kecil sebagai musik
    assert auto_edit.build({"emotion_trigger": "TAWA"}, 12, 52, None, [], tracks[3:])[0]["music"]["asset"] == "bgm_lucu.m4a"
    assert auto_edit.guess_mood("x_lofi_chill.mp3") == "santai" and auto_edit.guess_mood("x_track.mp3") is None
