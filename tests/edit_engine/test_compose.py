"""Composer: happy path, clamping, and every safety rule as a testable error."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from composer import compose
from composer.safety import check_edl


def _effects(edl):
    return {e["id"]: e for e in edl["effects"]}


def test_all_five_block_types_compose(tmp_path, all_blocks_edl, transcript, sample_clip):
    result = compose(
        all_blocks_edl, sample_clip, transcript, out_dir=tmp_path / "proj"
    )
    assert result.ok, result.errors
    assert result.warnings == []
    types = {b["type"] for b in result.blocks}
    assert types == {"shake", "caption_style", "popup", "sfx", "zoom"}

    html = Path(result.html_path).read_text()
    # one timed element per visual effect, plus caption groups and the source
    assert html.count('class="clip') >= 6
    assert 'id="a-roll"' in html
    assert 'data-has-audio="true"' in html
    assert "assets/source.mp4" in html
    assert "gsap.timeline" in html
    assert "window.__timelines" in html
    assert "%%" not in html, "unresolved fragment token"
    assert str(tmp_path) not in html, "absolute path leaked into the composition"
    assert "data-motion-blur" in html  # the shake asked for a blur ramp
    # captions were filled from the transcript, not from the LLM
    assert "OKAY" in html.upper()


def test_compose_is_byte_identical_across_runs(tmp_path, all_blocks_edl, transcript, sample_clip):
    a = compose(all_blocks_edl, sample_clip, transcript, out_dir=tmp_path / "a")
    b = compose(all_blocks_edl, sample_clip, transcript, out_dir=tmp_path / "b")
    assert a.ok and b.ok
    assert Path(a.html_path).read_bytes() == Path(b.html_path).read_bytes()


def test_out_of_range_params_are_clamped_with_warnings(tmp_path, all_blocks_edl, transcript, sample_clip):
    edl = json.loads(json.dumps(all_blocks_edl))
    _effects(edl)["shake_lost"]["params"]["intensity"] = 2.5
    _effects(edl)["shake_lost"]["params"]["frequency"] = 0.1

    result = compose(edl, sample_clip, transcript, out_dir=tmp_path / "clamped")
    assert result.ok, result.errors
    joined = "\n".join(result.warnings)
    assert "clamped to 1" in joined
    assert "clamped to 0.5" in joined
    clamp = _effects(result.edl)["shake_lost"]["params"]
    assert clamp["intensity"] == 1
    assert clamp["frequency"] == 0.5


def test_unknown_block_type_is_rejected(tmp_path, all_blocks_edl, transcript, sample_clip):
    edl = json.loads(json.dumps(all_blocks_edl))
    _effects(edl)["zoom_hook"]["type"] = "teleport"
    result = compose(edl, sample_clip, transcript, out_dir=tmp_path / "bad")
    assert not result.ok
    assert any("teleport" in e for e in result.errors)


def test_overlapping_effects_and_camera_conflict_are_rejected(
    tmp_path, all_blocks_edl, transcript, sample_clip
):
    edl = json.loads(json.dumps(all_blocks_edl))
    # two impacts starting 200ms apart, and two camera moves overlapping
    _effects(edl)["pop_reaction"]["start"] = 1.70
    _effects(edl)["pop_reaction"]["end"] = 2.9
    _effects(edl)["shake_lost"]["start"] = 1.8
    _effects(edl)["shake_lost"]["end"] = 2.6
    _effects(edl)["zoom_hook"]["start"] = 1.75
    _effects(edl)["zoom_hook"]["end"] = 3.0

    result = compose(edl, sample_clip, transcript, out_dir=tmp_path / "overlap")
    assert not result.ok
    joined = "\n".join(result.errors)
    assert "within 300ms" in joined
    assert "only one camera move" in joined


def test_density_and_hook_caps(transcript):
    def edl(starts):
        return {
            "clip_id": "c",
            "niche": "n",
            "effects": [
                {
                    "id": f"z{i}",
                    "type": "zoom",
                    "start": s,
                    "end": s + 0.6,
                    "params": {},
                    "rationale": "punches in on the word",
                }
                for i, s in enumerate(starts)
            ],
        }

    dense = check_edl(edl([0.1, 2.2, 3.0, 4.2]), duration_s=5.0)
    assert any("10s window" in e for e in dense)

    hook = check_edl(edl([0.1, 0.6, 1.2]), duration_s=5.0)
    assert any("hook window" in e for e in hook)

    assert check_edl(edl([0.2, 1.2]), duration_s=5.0) == []


def test_popup_cannot_cover_captions(transcript):
    edl = {
        "clip_id": "c",
        "niche": "n",
        "effects": [
            {
                "id": "caps",
                "type": "caption_style",
                "start": 0,
                "end": 3,
                "params": {"style": "irl_stream"},
                "rationale": "captions across the setup",
            },
            {
                "id": "pop",
                "type": "popup",
                "start": 1,
                "end": 2,
                "params": {"asset_id": "reaction_box", "position": "bottom-right"},
                "rationale": "reaction on the punchline",
            },
        ],
    }
    errors = check_edl(edl, duration_s=5.0)
    assert any("overlaps captions" in e for e in errors)


def test_effect_past_the_end_is_rejected(tmp_path, all_blocks_edl, transcript, sample_clip):
    edl = json.loads(json.dumps(all_blocks_edl))
    _effects(edl)["shake_lost"]["end"] = 9.0
    result = compose(edl, sample_clip, transcript, out_dir=tmp_path / "long")
    assert not result.ok
    assert any("past the clip duration" in e for e in result.errors)


def test_missing_asset_is_a_clear_error(tmp_path, all_blocks_edl, transcript, sample_clip):
    edl = json.loads(json.dumps(all_blocks_edl))
    _effects(edl)["pop_reaction"]["params"]["asset_id"] = "not_real"
    result = compose(edl, sample_clip, transcript, out_dir=tmp_path / "asset")
    assert not result.ok
    assert any("not_real" in e for e in result.errors)


def test_caption_without_words_warns_but_still_composes(tmp_path, all_blocks_edl, sample_clip):
    edl = {
        "clip_id": "c",
        "niche": "n",
        "schema_version": "1.0.0",
        "effects": [
            {
                "id": "caps",
                "type": "caption_style",
                "start": 0,
                "end": 5,
                "params": {"style": "podcast"},
                "rationale": "captions for the whole clip",
            }
        ],
    }
    result = compose(edl, sample_clip, None, out_dir=tmp_path / "nowords")
    assert result.ok, result.errors
    assert any("no transcript words" in w for w in result.warnings)


def test_motion_blur_alias_renders_through_shake(tmp_path, sample_clip, transcript):
    edl = {
        "clip_id": "c",
        "niche": "n",
        "schema_version": "1.0.0",
        "effects": [
            {
                "id": "mb",
                "type": "motion_blur",
                "start": 0.4,
                "end": 1.2,
                "params": {"intensity": 0.2, "motion_blur": 0.8},
                "rationale": "smear on the whip pan",
            }
        ],
    }
    result = compose(edl, sample_clip, transcript, out_dir=tmp_path / "alias")
    assert result.ok, result.errors
    assert result.blocks[0]["block"] == "shake"
    assert "data-motion-blur" in Path(result.html_path).read_text()
