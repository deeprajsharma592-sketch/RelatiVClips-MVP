"""Block library: params schemas, fragments, anims, catalog, renderer."""

from . import registry
from .registry import (
    BLOCKS_DIR,
    BLOCK_TYPES,
    ALIASES,
    BlockResult,
    RenderContext,
    canonical_type,
    catalog_text,
    clamp_params,
    default_params,
    load_anim,
    load_fragment,
    load_params_schema,
    normalize_words,
    render_block,
    validate_params,
)

__all__ = [
    "ALIASES",
    "BLOCKS_DIR",
    "BLOCK_TYPES",
    "BlockResult",
    "RenderContext",
    "canonical_type",
    "catalog_text",
    "clamp_params",
    "default_params",
    "load_anim",
    "load_fragment",
    "load_params_schema",
    "normalize_words",
    "registry",
    "render_block",
    "validate_params",
]
