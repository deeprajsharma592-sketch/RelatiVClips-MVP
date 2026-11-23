from backend.routers.youtube_router import _cacheable_render_settings


def eligible(font="impact", style=None, *, remake=False, tail=3.0, outro=4.0):
    return _cacheable_render_settings(
        font,
        style or {"preset": font, "overrides": {}},
        is_remake=remake,
        tail_buffer_seconds=tail,
        thumbnail_outro_seconds=outro,
    )


def test_normalized_default_studio_render_is_cacheable():
    assert eligible("impact", {"preset": "impact", "overrides": {"colorway": "yellow", "position_mode": "auto"}})


def test_custom_render_variants_bypass_canonical_cache():
    assert not eligible(style={"preset": "impact", "overrides": {"colorway": "red"}})
    assert not eligible(font="stack")
    assert not eligible(remake=True)
    assert not eligible(tail=0.0)
    assert not eligible(outro=0.0)
