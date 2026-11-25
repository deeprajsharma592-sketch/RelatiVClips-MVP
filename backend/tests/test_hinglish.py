import pytest
from pathlib import Path

from backend.captioning.hinglish import (
    has_devanagari,
    transliterate_devanagari_word,
    convert_words_to_hinglish,
)
from backend.captioning.ass_builder import build_ass, normalize_words


def test_has_devanagari():
    assert has_devanagari("नमस्ते")
    assert has_devanagari("action वैसे you gave us")
    assert not has_devanagari("Hello world 123!")


def test_loanwords_converted_to_english_spelling():
    assert transliterate_devanagari_word("ेक्शन").lower() == "action"
    assert transliterate_devanagari_word("एक्शन").lower() == "action"
    assert transliterate_devanagari_word("रेस्टोरेंट").lower() == "restaurant"
    assert transliterate_devanagari_word("टेस्ट").lower() == "test"
    assert transliterate_devanagari_word("आइडिया").lower() == "idea"
    assert transliterate_devanagari_word("गाइस").lower() == "guys"
    assert transliterate_devanagari_word("चाइनीज").lower() == "chinese"


def test_conversational_hindi_transliteration():
    assert transliterate_devanagari_word("आज").lower() == "aaj"
    assert transliterate_devanagari_word("हम").lower() == "hum"
    assert transliterate_devanagari_word("करने").lower() == "karne"
    assert transliterate_devanagari_word("वाले").lower() == "wale"
    assert transliterate_devanagari_word("है").lower() == "hai"
    assert transliterate_devanagari_word("के").lower() == "ke"
    assert transliterate_devanagari_word("खाने").lower() == "khane"
    assert transliterate_devanagari_word("की").lower() == "ki"
    assert transliterate_devanagari_word("वैसे").lower() == "vaise"
    assert transliterate_devanagari_word("जाता").lower() == "jaata"


def test_hard_hindi_words_preserved_in_devanagari():
    assert transliterate_devanagari_word("धर्मसंकट") == "धर्मसंकट"
    assert transliterate_devanagari_word("आत्मनिर्भरता") == "आत्मनिर्भरता"


def test_convert_words_to_hinglish_preserves_timing():
    words = [
        {"w": "ेक्शन", "start": 0.5, "end": 0.8, "emph": 1},
        {"w": "वैसे", "start": 0.8, "end": 1.1, "emph": 0},
        {"w": "you", "start": 1.1, "end": 1.3, "emph": 0},
        {"w": "gave", "start": 1.3, "end": 1.5, "emph": 0},
        {"w": "us", "start": 1.5, "end": 1.7, "emph": 0},
        {"w": "आइडिया", "start": 1.7, "end": 2.2, "emph": 2},
    ]
    converted = convert_words_to_hinglish(words)
    assert len(converted) == len(words)
    assert converted[0]["w"].lower() == "action"
    assert converted[0]["start"] == 0.5
    assert converted[0]["end"] == 0.8
    assert converted[0]["emph"] == 1

    assert converted[1]["w"].lower() == "vaise"
    assert converted[1]["start"] == 0.8

    assert converted[5]["w"].lower() == "idea"
    assert converted[5]["start"] == 1.7
    assert converted[5]["emph"] == 2


def test_build_ass_renders_hinglish_in_viral_punch(tmp_path: Path):
    clip = {
        "start": 0,
        "end": 3,
        "words": [
            {"w": "सो", "start": 0.2, "end": 0.5},
            {"w": "हेलो", "start": 0.5, "end": 0.8},
            {"w": "गाइस", "start": 0.8, "end": 1.1},
            {"w": "आज", "start": 1.1, "end": 1.4},
            {"w": "हम", "start": 1.4, "end": 1.7},
            {"w": "रेस्टोरेंट", "start": 1.7, "end": 2.2},
            {"w": "टेस्ट", "start": 2.2, "end": 2.6},
        ],
    }
    out_ass = tmp_path / "hinglish_punch.ass"
    res = build_ass(clip, out_ass, {"preset": "viral_punch"})

    assert res["path"] and Path(res["path"]).exists()
    content = Path(res["path"]).read_text(encoding="utf-8")

    # Content should have Romanized words, not Devanagari
    assert "RESTAURANT" in content.upper()
    assert "GUYS" in content.upper()
    assert "TEST" in content.upper()
    assert "AAJ" in content.upper()
    assert "HUM" in content.upper()

    # Viral punch motion pop tags should be present
    assert "\\fscx88\\fscy88\\blur3.5" in content
