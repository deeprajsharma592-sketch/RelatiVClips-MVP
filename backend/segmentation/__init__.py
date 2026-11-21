"""
Segmentation package: narrative units, boundary refinement, length policy, dedup/ranking, check-pass.
"""
from .units import (
    NarrativeUnit,
    WordTiming,
    build_narrative_units,
)
from .refinement import (
    snap_to_narrative_units,
    check_dangling_reference,
    check_mid_thought_end,
    trim_dead_air,
    refine_clip_candidate,
)
from .length_policy import (
    apply_length_policy,
)
from .dedup_rank import (
    compute_composite_score,
    calculate_overlap_ratio,
    deduplicate_preserving_order,
    merge_near_adjacent_candidates,
    dedup_and_rank_candidates,
)
from .check_pass import (
    run_clip_check_pass,
)

__all__ = [
    "NarrativeUnit",
    "WordTiming",
    "build_narrative_units",
    "snap_to_narrative_units",
    "check_dangling_reference",
    "check_mid_thought_end",
    "trim_dead_air",
    "refine_clip_candidate",
    "apply_length_policy",
    "compute_composite_score",
    "calculate_overlap_ratio",
    "deduplicate_preserving_order",
    "merge_near_adjacent_candidates",
    "dedup_and_rank_candidates",
    "run_clip_check_pass",
]
