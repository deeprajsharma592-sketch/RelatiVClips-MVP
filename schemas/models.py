"""Pydantic contracts for the RelatiV edit engine.

Three contracts, all versioned:

* ``StoryPlan``  - what the clip is supposed to do (from the clip hunter / framing stage).
* ``EDL``        - the motion-graphics edit decisions the editor LLM produces.
* ``JudgeReport``- the vision model's review of a render.

The JSON Schema files in ``schemas/json/`` are generated from these models by
``python -m schemas.compile``. The composer and the editor validate against the
JSON Schema files (not the pydantic classes) so the exact same contract is used
by Python, by the LLM repair loop, and by anything written in another language.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

SCHEMA_VERSION = "1.0.0"

SegmentRole = Literal["hook", "info", "rehook", "cta"]
EffectType = Literal[
    "shake",
    "motion_blur",
    "caption_style",
    "popup",
    "sfx",
    "zoom",
]

# Effects that put pixels on screen; ``sfx`` is audio-only.
VISUAL_EFFECT_TYPES: tuple[str, ...] = ("shake", "motion_blur", "caption_style", "popup", "zoom")
IMPACT_EFFECT_TYPES: tuple[str, ...] = ("shake", "motion_blur", "popup", "zoom")


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", validate_assignment=True)


class Segment(StrictModel):
    start: float = Field(ge=0, description="Segment start in seconds, clip-relative.")
    end: float = Field(gt=0, description="Segment end in seconds, clip-relative.")
    role: SegmentRole
    text: str = Field(min_length=1, description="What happens / what is said in this segment.")

    @model_validator(mode="after")
    def _end_after_start(self) -> "Segment":
        if self.end <= self.start:
            raise ValueError(f"end ({self.end}) must be greater than start ({self.start})")
        return self


class Callback(StrictModel):
    from_ts: float = Field(ge=0)
    to_ts: float = Field(gt=0)
    note: str = Field(min_length=1, description="What pays off or is called back here.")

    @model_validator(mode="after")
    def _range(self) -> "Callback":
        if self.to_ts <= self.from_ts:
            raise ValueError(f"to_ts ({self.to_ts}) must be greater than from_ts ({self.from_ts})")
        return self


class StoryPlan(StrictModel):
    clip_id: str = Field(min_length=1)
    duration_s: float = Field(gt=0)
    segments: List[Segment] = Field(min_length=1)
    callbacks: List[Callback] = Field(default_factory=list)
    schema_version: str = SCHEMA_VERSION

    @model_validator(mode="after")
    def _ordered_non_overlapping(self) -> "StoryPlan":
        prev_end = -1.0
        for i, seg in enumerate(self.segments):
            if seg.start + 1e-6 < prev_end:
                raise ValueError(
                    f"segments[{i}] starts at {seg.start} but segments[{i - 1}] ends at {prev_end} "
                    "(segments must be ordered and non-overlapping)"
                )
            if seg.end > self.duration_s + 1e-6:
                raise ValueError(
                    f"segments[{i}].end ({seg.end}) is past duration_s ({self.duration_s})"
                )
            prev_end = seg.end
        return self

    def segment_at(self, t: float) -> Segment | None:
        for seg in self.segments:
            if seg.start <= t < seg.end:
                return seg
        return None


class Effect(StrictModel):
    id: str = Field(min_length=1, pattern=r"^[a-zA-Z0-9_-]+$")
    type: EffectType
    start: float = Field(ge=0, description="Effect start in seconds, clip-relative.")
    end: float = Field(gt=0, description="Effect end in seconds, clip-relative.")
    params: Dict[str, Any] = Field(default_factory=dict)
    rationale: str = Field(
        min_length=5,
        description="Why this effect lands here, naming the word or moment it hits.",
    )

    @model_validator(mode="after")
    def _end_after_start(self) -> "Effect":
        if self.end <= self.start:
            raise ValueError(f"end ({self.end}) must be greater than start ({self.start})")
        return self


class EDL(StrictModel):
    clip_id: str = Field(min_length=1)
    niche: str = Field(min_length=1)
    effects: List[Effect] = Field(default_factory=list)
    schema_version: str = SCHEMA_VERSION

    @model_validator(mode="after")
    def _unique_ids(self) -> "EDL":
        seen: set[str] = set()
        for i, eff in enumerate(self.effects):
            if eff.id in seen:
                raise ValueError(f"effects[{i}].id '{eff.id}' is duplicated")
            seen.add(eff.id)
        return self

    def effect(self, effect_id: str) -> Effect | None:
        return next((e for e in self.effects if e.id == effect_id), None)


class Scores(StrictModel):
    """1-10, higher is always better (``overload`` 10 means no overload)."""

    hook: int = Field(ge=1, le=10)
    arc: int = Field(ge=1, le=10)
    readability: int = Field(ge=1, le=10)
    overload: int = Field(ge=1, le=10)
    audio: int = Field(ge=1, le=10)

    def as_dict(self) -> Dict[str, int]:
        return {
            "hook": self.hook,
            "arc": self.arc,
            "readability": self.readability,
            "overload": self.overload,
            "audio": self.audio,
        }

    def min_score(self) -> int:
        return min(self.as_dict().values())


def production_ready_rule(scores: Scores | Dict[str, int]) -> bool:
    """Single source of truth for ``production_ready``."""
    d = scores.as_dict() if isinstance(scores, Scores) else scores
    return d["hook"] >= 7 and d["arc"] >= 7 and min(d.values()) >= 5


class JudgeReport(StrictModel):
    clip_id: str = Field(min_length=1)
    scores: Scores
    critique: str = Field(min_length=20, description="Specific timestamps plus a concrete fix.")
    production_ready: bool
    schema_version: str = SCHEMA_VERSION

    @model_validator(mode="after")
    def _ready_rule(self) -> "JudgeReport":
        expected = production_ready_rule(self.scores)
        if self.production_ready != expected:
            raise ValueError(
                "production_ready must be true only when hook >= 7, arc >= 7 and no score < 5 "
                f"(expected {expected} for {self.scores.as_dict()})"
            )
        return self


CONTRACTS = {
    "StoryPlan": StoryPlan,
    "EDL": EDL,
    "JudgeReport": JudgeReport,
}


def model_for(name: str) -> type[StrictModel]:
    """Return the pydantic model for a contract name (case-insensitive aliases)."""
    key = name.strip()
    aliases = {
        "storyplan": "StoryPlan",
        "story_plan": "StoryPlan",
        "edl": "EDL",
        "judge_report": "JudgeReport",
        "judgereport": "JudgeReport",
    }
    key = aliases.get(key.lower(), key)
    if key not in CONTRACTS:
        raise KeyError(f"unknown contract '{name}'; expected one of {sorted(CONTRACTS)}")
    return CONTRACTS[key]
