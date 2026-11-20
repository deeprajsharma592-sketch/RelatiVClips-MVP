import numpy as np

from framing.s9_render import render_scene_panel, warp_crop_affine


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
