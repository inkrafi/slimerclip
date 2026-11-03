import auto_edit
import clip_effects
import clip_profile
import subtitle_translate


def test_mood_and_music_pick():
    assert auto_edit.mood_for({"emotion_trigger": "TAWA"}) == "lucu"
    assert auto_edit.mood_for({"emotion_trigger": "KONTROVERSI"}) == "tegang"
    assert auto_edit.mood_for({"emotion_trigger": "INSPIRASI", "category": "bisnis"}) == "semangat"
    assert auto_edit.mood_for({}) == "santai"
    # Musik upload yang namanya cocok suasana diutamakan, kalau tidak pakai musik bawaan
    assert auto_edit.pick_music("semangat", ["a1b2c3d4_Epic Rise.mp3", "x_lofi.mp3"]) == "a1b2c3d4_Epic Rise.mp3"
    assert auto_edit.pick_music("tegang", ["x_lofi.mp3"]) == "bgm_tegang.m4a"


def test_auto_recipe_is_valid_and_has_no_sfx():
    seg = {"emotion_trigger": "KAGET", "hook_start": "01:52"}
    audio = [{"name": "a1b2c3d4_vine_boom.mp3", "size_mb": 0.1}]
    recipe, summary = auto_edit.build(seg, 100.0, 140.0, ["Kenapa dia *nolak*?"], audio)
    edit = clip_effects.sanitize_edit(recipe, 100.0, 140.0)
    assert edit["hook"]["enabled"] and edit["hook"]["text"] == "Kenapa dia *nolak*?" and edit["hook"]["anim"] == "pop"
    assert edit["music"]["asset"] == "bgm_tegang.m4a" and edit["music"]["volume"] == 11     # -19 dB
    assert edit["voice"] == {"volume": 100, "clean": True} and edit["enhance"] == {"video": True}
    assert edit["sfx"] == []                                           # efek suara hanya dipasang manual
    assert summary["music"] == "Tegang / serius"


def test_old_auto_sfx_dropped_manual_sfx_kept():
    edit = clip_effects.sanitize_edit({"sfx": [{"asset": "lib_hit_1.wav", "at": 5, "volume": 40, "track": "hit"},
                                               {"asset": "lib_pop.wav", "at": 6, "volume": 40}]}, 0, 30)
    assert edit["sfx"] == [{"asset": "lib_pop.wav", "at": 6, "volume": 40}]
    graph = clip_effects.audio_graph(None, None, [(1, 1.0, 50)], 30, True, "aout")
    assert graph.endswith("alimiter=limit=0.95:level=0[aout]")


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


def test_user_audio_large_file_is_music():
    seg = {"emotion_trigger": "KONTROVERSI", "hook_start": "00:20"}
    audio = [{"name": "a1b2c3d4_vine_boom.mp3", "size_mb": 0.1}, {"name": "y_epic_tense_theme.mp3", "size_mb": 4.0}]
    recipe, _ = auto_edit.build(seg, 10.0, 45.0, ["Hook"], audio)
    assert recipe["music"]["asset"] == "y_epic_tense_theme.mp3"         # file besar = musik
    assert recipe["sfx"] == []


def test_sfx_library_grouped_and_files_exist():
    import os
    assert len(clip_effects.SFX_LIBRARY) >= 40
    assert set(clip_effects.SFX_GROUP_OF.values()) == {"Transisi", "Penekanan", "Lucu", "Notifikasi", "Suasana",
                                                       "Whoosh (gerakan)", "Tekstur (kejadian)", "Riser & hit"}
    for name in clip_effects.SFX_LIBRARY:
        assert os.path.isfile(os.path.join(clip_effects.SFX_DIR, name)), name


def test_music_rotation_tags_and_guess():
    tracks = [{"name": "a_song1.mp3", "mood": "lucu", "mood_source": "tag", "size_mb": 3},
              {"name": "b_song2.mp3", "mood": "lucu", "mood_source": "tag", "size_mb": 3},
              {"name": "c_all.mp3", "mood": "umum", "mood_source": "tag", "size_mb": 3},
              {"name": "d_funny_boing.mp3", "mood": "lucu", "mood_source": "name", "size_mb": 0.1}]
    picks = {auto_edit.build({"emotion_trigger": "TAWA"}, s, s + 40, [], tracks)[0]["music"]["asset"] for s in (10, 11)}
    assert picks == {"a_song1.mp3", "b_song2.mp3"}                    # bergantian antar klip
    tense = auto_edit.build({"emotion_trigger": "KONTROVERSI"}, 10, 50, [], tracks)[0]["music"]["asset"]
    assert tense == "c_all.mp3"                                        # tidak ada yang tegang → "umum"
    # Tebakan nama tidak menjadikan file SFX kecil sebagai musik
    assert auto_edit.build({"emotion_trigger": "TAWA"}, 12, 52, [], tracks[3:])[0]["music"]["asset"] == "bgm_lucu.m4a"
    assert auto_edit.guess_mood("x_lofi_chill.mp3") == "santai" and auto_edit.guess_mood("x_track.mp3") is None
