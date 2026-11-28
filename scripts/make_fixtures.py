#!/usr/bin/env python3
"""Create the deterministic fixtures the engine tests and demos use.

Idempotent: existing files are left alone unless --force is passed.

    python scripts/make_fixtures.py [--force]

Everything is synthesised locally with FFmpeg, so there are no licensing
questions about the sample media.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = ROOT / "data" / "fixtures"
ASSETS = ROOT / "data" / "assets"


def run(cmd: list[str]) -> None:
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise SystemExit(f"failed: {' '.join(cmd[:6])}\n{proc.stderr[-1500:]}")


def make_clip(path: Path, *, source: str, seconds: int = 5, tone: int = 440) -> None:
    if path.exists():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "lavfi", "-i", f"{source}=size=1080x1920:rate=30:duration={seconds}",
            "-f", "lavfi", "-i", f"sine=frequency={tone}:duration={seconds}",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-g", "30", "-keyint_min", "30", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k", "-shortest",
            str(path),
        ]
    )


def make_sfx(path: Path, cmd: list[str]) -> None:
    if path.exists():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    run(["ffmpeg", "-y", "-loglevel", "error", *cmd, "-ar", "48000", "-ac", "2", str(path)])


def make_popup(path: Path, *, colour: str, accent: str) -> None:
    if path.exists():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "lavfi", "-i", "color=c=0x101014:s=600x600:d=1",
            "-vf",
            f"drawbox=x=36:y=36:w=528:h=528:color={colour}:t=14,"
            f"drawbox=x=120:y=250:w=360:h=110:color={accent}:t=fill,"
            "drawbox=x=120:y=120:w=360:h=24:color=0xFFFFFF:t=fill",
            "-frames:v", "1",
            str(path),
        ]
    )


STORIES = {
    "demo_01": {
        "duration_s": 5.0,
        "segments": [
            {"start": 0.0, "end": 1.4, "role": "hook", "text": "I found the one clip everyone reposts."},
            {"start": 1.4, "end": 3.1, "role": "info", "text": "He explains why the joke lands, then the room loses it."},
            {"start": 3.1, "end": 4.1, "role": "rehook", "text": "But the second punchline is the real one."},
            {"start": 4.1, "end": 5.0, "role": "cta", "text": "Follow for the next one."},
        ],
        "callbacks": [{"from_ts": 1.6, "to_ts": 3.9, "note": "the earlier setup pays off here"}],
    },
    "demo_02": {
        "duration_s": 5.0,
        "segments": [
            {"start": 0.0, "end": 1.2, "role": "hook", "text": "He says the thing nobody expects."},
            {"start": 1.2, "end": 2.8, "role": "info", "text": "Setup: the bet, the crowd, the silence."},
            {"start": 2.8, "end": 4.2, "role": "rehook", "text": "Payoff lands and the streamer breaks."},
            {"start": 4.2, "end": 5.0, "role": "cta", "text": "Save this one."},
        ],
        "callbacks": [{"from_ts": 0.4, "to_ts": 3.2, "note": "cold open repeated at the payoff"}],
    },
    "demo_03": {
        "duration_s": 5.0,
        "segments": [
            {"start": 0.0, "end": 1.6, "role": "hook", "text": "This is the clip that ended the stream."},
            {"start": 1.6, "end": 3.4, "role": "info", "text": "Context in one line, then the argument."},
            {"start": 3.4, "end": 4.4, "role": "rehook", "text": "He doubles down instead of apologising."},
            {"start": 4.4, "end": 5.0, "role": "cta", "text": "Comment your take."},
        ],
        "callbacks": [],
    },
}

WORDS = [
    ("okay", 0.10, 0.34), ("so", 0.36, 0.52), ("nobody", 0.56, 0.92),
    ("told", 0.94, 1.14), ("me", 1.16, 1.30), ("this", 1.34, 1.58),
    ("would", 1.60, 1.86), ("work", 1.88, 2.20), ("and", 2.30, 2.46),
    ("then", 2.48, 2.66), ("the", 2.70, 2.82), ("whole", 2.84, 3.10),
    ("room", 3.12, 3.38), ("just", 3.40, 3.58), ("lost", 3.60, 3.86),
    ("it", 3.88, 4.02), ("follow", 4.10, 4.40), ("for", 4.42, 4.56),
    ("more", 4.58, 4.90),
]


def write_json(path: Path, payload: dict, *, force: bool = False) -> None:
    if path.exists() and not force:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    make_clip(FIXTURES / "sample_5s.mp4", source="testsrc2", tone=440)
    make_clip(FIXTURES / "sample_b.mp4", source="smptebars", tone=330)
    make_clip(FIXTURES / "sample_c.mp4", source="rgbtestsrc", tone=550)

    words = [{"w": w, "start": s, "end": e} for w, s, e in WORDS]
    write_json(
        FIXTURES / "transcript_sample.json",
        {
            "clip_id": "demo_01",
            "text": " ".join(w for w, _, _ in WORDS),
            "words": words,
            "source": "hand-aligned fixture",
        },
        force=args.force,
    )
    for clip_id, plan in STORIES.items():
        write_json(
            FIXTURES / f"story_plan_{clip_id}.json",
            {"clip_id": clip_id, "schema_version": "1.0.0", **plan},
            force=args.force,
        )

    write_json(
        FIXTURES / "clips.json",
        {
            "demo_01": {
                "source": "sample_5s.mp4",
                "story_plan": "story_plan_demo_01.json",
                "transcript": "transcript_sample.json",
                "niche": "livestream_comedy",
            },
            "demo_02": {
                "source": "sample_b.mp4",
                "story_plan": "story_plan_demo_02.json",
                "transcript": "transcript_sample.json",
                "niche": "livestream_comedy",
            },
            "demo_03": {
                "source": "sample_c.mp4",
                "story_plan": "story_plan_demo_03.json",
                "transcript": "transcript_sample.json",
                "niche": "livestream_comedy",
            },
        },
        force=args.force,
    )

    make_sfx(
        ASSETS / "sfx" / "whoosh_soft.wav",
        ["-f", "lavfi", "-i", "anoisesrc=d=0.7:c=pink:a=0.4",
         "-af", "highpass=f=400,lowpass=f=6500,afade=t=in:st=0:d=0.08,afade=t=out:st=0.4:d=0.3,volume=1.4"],
    )
    make_sfx(
        ASSETS / "sfx" / "impact_boom.wav",
        ["-f", "lavfi", "-i", "sine=frequency=62:duration=0.7:sample_rate=48000",
         "-af", "afade=t=out:st=0.12:d=0.58,volume=2.0"],
    )
    make_sfx(
        ASSETS / "sfx" / "pop_tick.wav",
        ["-f", "lavfi", "-i", "sine=frequency=1200:duration=0.16:sample_rate=48000",
         "-af", "afade=t=out:st=0.02:d=0.14"],
    )

    make_popup(ASSETS / "popups" / "reaction_box.png", colour="0xFFE45E", accent="0xFF5A5F")
    make_popup(ASSETS / "popups" / "meme_frame.png", colour="0x6FE3C1", accent="0x3B4CFF")

    manifest = {
        "version": 1,
        "notes": "Synthesised placeholders. Swap for licensed assets; keep the ids stable.",
        "assets": [
            {"id": "whoosh_soft", "type": "sfx", "file": "sfx/whoosh_soft.wav",
             "tags": ["transition", "hook"], "license": "synthesised placeholder (CC0-equivalent)",
             "description": "Soft noise sweep, good under a whip or a cut."},
            {"id": "impact_boom", "type": "sfx", "file": "sfx/impact_boom.wav",
             "tags": ["impact", "hook"], "license": "synthesised placeholder (CC0-equivalent)",
             "description": "Low thump for a punchline hit."},
            {"id": "pop_tick", "type": "sfx", "file": "sfx/pop_tick.wav",
             "tags": ["popup", "ui"], "license": "synthesised placeholder (CC0-equivalent)",
             "description": "Short tick for a popup."},
            {"id": "reaction_box", "type": "popup", "file": "popups/reaction_box.png",
             "tags": ["reaction", "meme"], "license": "synthesised placeholder (CC0-equivalent)",
             "description": "Neutral reaction box placeholder."},
            {"id": "meme_frame", "type": "popup", "file": "popups/meme_frame.png",
             "tags": ["meme", "frame"], "license": "synthesised placeholder (CC0-equivalent)",
             "description": "Framed meme placeholder."}
        ],
    }
    write_json(ASSETS / "manifest.json", manifest, force=args.force)

    print("fixtures ready:")
    for path in sorted(FIXTURES.glob("*")):
        print(f"  {path.relative_to(ROOT)}")
    for path in sorted(ASSETS.rglob("*")):
        if path.is_file():
            print(f"  {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
