from backend.pipeline.renderer import CROP_HEIGHT, CROP_WIDTH, _thumbnail_cta_visual_filter


def test_thumbnail_cta_uses_bounded_contain_frame():
    graph = _thumbnail_cta_visual_filter(4.0, "/tmp/font.ttf")
    card_width = max(280, int(CROP_WIDTH * 0.778) // 2 * 2)
    card_height = max(158, int(card_width * 9 / 16) // 2 * 2)
    assert f"scale={card_width}:{card_height}:force_original_aspect_ratio=decrease" in graph
    assert "force_original_aspect_ratio=decrease" in graph
    assert "scale=900:-2" not in graph


def test_thumbnail_and_copy_have_separate_vertical_zones():
    graph = _thumbnail_cta_visual_filter(4.0, "/tmp/font.ttf")
    assert f"y={round(CROP_HEIGHT * 0.1875)}" in graph
    assert f"y={round(CROP_HEIGHT * 0.255)}" in graph
    assert "H+56-" in graph
    assert "0.5-0.5*cos" in graph
