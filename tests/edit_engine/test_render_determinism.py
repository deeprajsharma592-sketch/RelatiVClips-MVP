"""Determinism and failure handling for the render step.

The determinism test is slow (two real renders). It asserts decoded-frame hashes,
not container bytes, so encoder muxing differences do not matter.
"""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest

from composer import compose, media
from composer.render import lint, render


@pytest.mark.slow
def test_same_composition_renders_identical_frames(
    tmp_path, all_blocks_edl, transcript, sample_clip
):
    result = compose(all_blocks_edl, sample_clip, transcript, out_dir=tmp_path / "proj")
    assert result.ok, result.errors

    first = render(result.project_dir, tmp_path / "first.mp4", quality="draft", workers=1)
    second = render(result.project_dir, tmp_path / "second.mp4", quality="draft", workers=1)
    assert first.ok and second.ok, (first.error, second.error)

    a = media.decoded_frame_hashes(first.mp4_path)
    b = media.decoded_frame_hashes(second.mp4_path)
    assert a.count == b.count and a.count > 0
    assert a.digest == b.digest, "decoded frames differ between two renders"
    assert media.audio_digest(first.mp4_path) == media.audio_digest(second.mp4_path)


@pytest.mark.slow
def test_render_survives_lint_failure(tmp_path, all_blocks_edl, transcript, sample_clip):
    result = compose(all_blocks_edl, sample_clip, transcript, out_dir=tmp_path / "proj")
    assert result.ok

    broken = tmp_path / "broken"
    shutil.copytree(result.project_dir, broken)
    html_path = broken / "index.html"
    html_path.write_text(
        html_path.read_text().replace('data-composition-id="main"', 'data-composition-id=""')
    )

    findings = lint(broken)
    assert findings["errors"]

    outcome = render(broken, tmp_path / "broken.mp4", quality="draft", workers=1)
    assert outcome.ok is False
    assert outcome.lint_errors
    assert outcome.mp4_path == ""
    assert "lint failed" in outcome.error
