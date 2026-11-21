import numpy as np

from framing.run import _caption_safe_subtitle
from framing.s9_render import context_scene_panel_height, render_scene_panel, warp_crop_affine


def test_scene_panel_keeps_complete_landscape_frame():
    frame = np.zeros((360, 640, 3), dtype=np.uint8)
    frame[:, :10] = (0, 0, 255)
    frame[:, -10:] = (0, 255, 0)
    panel = render_scene_panel(frame, 1080, 960)
    assert panel.shape == (960, 1080, 3)
    # Both source edges survive; the full landscape canvas was not cropped.
    assert np.any(panel[:, :, 2] > 200)
    assert np.any(panel[:, :, 1] > 200)


def test_scene_panel_can_join_the_center_seam():
    frame = np.full((360, 640, 3), 255, dtype=np.uint8)
    top_scene = render_scene_panel(frame, 1080, 960, anchor="bottom")
    bottom_scene = render_scene_panel(frame, 1080, 960, anchor="top")
    assert np.mean(top_scene[-1]) > 240
    assert np.mean(bottom_scene[0]) > 240


def test_tracked_half_has_panel_dimensions():
    frame = np.zeros((720, 1280, 3), dtype=np.uint8)
    tracked = warp_crop_affine(frame, 300, 0, 810, 720, 1080, 960)
    assert tracked.shape == (960, 1080, 3)


def test_context_scene_height_has_no_letterbox_for_16_9_source():
    assert context_scene_panel_height(1920, 1080, 1080, 1920) == 608


def test_context_captions_are_pinned_to_panel_seam(tmp_path):
    source = tmp_path / "captions.ass"
    source.write_text(
        "Style: Default,Geist,64,&H00FFFFFF,&H0,&H0,&H0,-1,0,0,0,100,100,0,0,1,4,2,2,40,40,280,1\n"
        "Dialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,HELLO\n",
        encoding="utf-8",
    )
    adjusted = _caption_safe_subtitle(source, tmp_path, "context", "top", 608)
    text = adjusted.read_text(encoding="utf-8")
    assert r"\an5\pos(540,608)" in text
