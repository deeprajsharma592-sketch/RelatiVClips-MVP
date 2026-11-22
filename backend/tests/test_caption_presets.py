from pathlib import Path

from backend.pipeline.captions import CAPTION_PRESETS, _sanitize_text, generate_viral_ass_subtitles


def test_signal_tags_are_not_rendered_as_spoken_captions():
    assert _sanitize_text("hello [PAUSE] [LOUD] world") == "HELLO WORLD"


def test_all_caption_presets_generate_the_selected_font(tmp_path: Path):
    for preset_id, preset in CAPTION_PRESETS.items():
        output = tmp_path / f"{preset_id}.ass"
        result = generate_viral_ass_subtitles(
            {
                "start": 0,
                "end": 3,
                "caption": "Build clips people remember",
                "caption_font": preset_id,
            },
            output,
        )
        assert result
        assert f"Style: Default,{preset['font_name']}," in output.read_text()
