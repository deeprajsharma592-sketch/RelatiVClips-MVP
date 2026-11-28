"""Pick the winner among variants, and the preference pair to learn from.

Order: production_ready first (when required), then weighted judge score, then
fewer effects (restraint wins ties), then hook score.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Sequence

from loop.config import production_ready_required, weighted_score


def effect_count(edl: Mapping[str, Any] | None) -> int:
    return len(list((edl or {}).get("effects") or []))


def rank_key(variant: Any) -> tuple:
    scores = (getattr(variant, "judge", None) and variant.judge.report or {}).get("scores") or {}
    ready = bool(getattr(variant, "production_ready", False))
    return (
        1 if ready else 0,
        float(getattr(variant, "weighted", 0.0)),
        -effect_count(getattr(variant, "edl", None)),
        int(scores.get("hook", 0)),
    )


def rank(variants: Iterable[Any]) -> list[Any]:
    usable = [v for v in variants if getattr(v, "ok", False) and getattr(v, "edl", None)]
    return sorted(usable, key=rank_key, reverse=True)


@dataclass
class Selection:
    winner: Any | None
    worst: Any | None
    reason: str
    ready_count: int
    considered: int

    @property
    def margin(self) -> float:
        if not self.winner or not self.worst:
            return 0.0
        return round(float(self.winner.weighted) - float(self.worst.weighted), 3)


def select(variants: Sequence[Any]) -> Selection:
    usable = rank(variants)
    if not usable:
        return Selection(None, None, "no variant produced a renderable, judged EDL", 0, len(variants))

    ready = [v for v in usable if getattr(v, "production_ready", False)]
    require = production_ready_required()
    pool = ready if (require and ready) else usable
    winner = pool[0]
    worst = usable[-1]

    if require and not ready:
        reason = (
            f"no variant was production_ready (best weighted {winner.weighted}); "
            "selected the highest weighted score anyway - treat as draft"
        )
    elif len(pool) > 1 and winner.weighted == pool[1].weighted:
        same_effects = effect_count(winner.edl) == effect_count(pool[1].edl)
        reason = (
            f"tie at weighted {winner.weighted}; "
            + ("identical effect count - kept the earlier variant"
               if same_effects
               else f"fewer effects wins ({effect_count(winner.edl)} vs {effect_count(pool[1].edl)})")
        )
    else:
        reason = f"highest weighted judge score ({winner.weighted}) among {len(pool)} candidates"
    return Selection(winner=winner, worst=worst, reason=reason, ready_count=len(ready), considered=len(usable))


def preference_pair(selection: Selection) -> tuple[Any, Any] | None:
    if not selection.winner or not selection.worst:
        return None
    if selection.winner is selection.worst:
        return None
    return selection.winner, selection.worst


def score_variant(scores: Mapping[str, Any] | None) -> float:
    return weighted_score(scores)
