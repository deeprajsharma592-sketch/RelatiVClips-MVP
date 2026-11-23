from backend.routers.editor_router import CaptionStylePayload, ClipRemakeRequest, WordEdit, _edit_timeline


def request(*words: WordEdit) -> ClipRemakeRequest:
    return ClipRemakeRequest(
        start=2.0,
        end=8.0,
        caption_style=CaptionStylePayload(),
        words=list(words),
        layout="auto_face",
    )


def test_deleted_words_are_removed_from_media_and_caption_timeline():
    kept, words, duration = _edit_timeline(request(
        WordEdit(w="keep", start=2.0, end=3.0),
        WordEdit(w="cut", start=3.0, end=4.0, deleted=True),
        WordEdit(w="shift", start=4.0, end=5.0),
    ))
    assert kept == [(2.0, 3.0), (4.0, 8.0)]
    assert duration == 5.0
    assert [word["w"] for word in words] == ["keep", "shift"]
    assert words[1]["start"] == 1.0


def test_adjacent_deleted_words_form_one_clean_cut():
    kept, _, duration = _edit_timeline(request(
        WordEdit(w="a", start=3.0, end=3.5, deleted=True),
        WordEdit(w="b", start=3.51, end=4.0, deleted=True),
    ))
    assert kept == [(2.0, 3.0), (4.0, 8.0)]
    assert duration == 5.0
