from pathlib import Path

from backend.captioning.ass_builder import build_ass
from backend.captioning.placement import choose_layout
from backend.captioning.registry import get_registry, validate_fonts


def test_registry_fonts_exist():
    assert validate_fonts(strict=False) == []
    assert set(get_registry()["presets"]) == {"impact", "stack", "hookcard"}


def test_word_events_are_contiguous_and_stable(tmp_path: Path):
    result = build_ass(
        {
            "start": 0,
            "end": 3,
            "words": [
                {"w": "THE", "start": 0.2, "end": 0.5, "emph": 0},
                {"w": "CHEAT", "start": 0.5, "end": 0.9, "emph": 1},
                {"w": "CODE", "start": 0.9, "end": 1.3, "emph": 2},
            ],
        },
        tmp_path / "captions.ass",
        {"preset": "impact", "overrides": {}},
    )
    events = [line for line in Path(result["path"]).read_text().splitlines() if line.startswith("Dialogue:")]
    assert len(events) == 3
    assert events[0].split(",")[2] == events[1].split(",")[1]
    assert events[1].split(",")[2] == events[2].split(",")[1]
    assert all("\\pos(540,1190)" in event for event in events)


def test_subject_face_disqualifies_low_slot():
    groups = [{"start": 0, "end": 1, "block_size": (800, 200)}]
    track = [{"t": 0.5, "face_box": [200, 1040, 880, 1350], "person_box": [120, 700, 960, 1800]}]
    layout = choose_layout(groups, track, "impact")
    assert layout[0]["slot"] != "low"
    assert layout[0]["face_overlap"] <= 0.02
