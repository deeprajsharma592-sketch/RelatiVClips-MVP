"""Vision-capable client for the judge: same OpenAI-compatible wrapper, judge config."""

from __future__ import annotations

import engine_config
from editor.llm import LLMClient


class VisionClient(LLMClient):
    """Sends image parts (``image_url`` data URLs) to a vision model."""

    def __init__(self, config: engine_config.LLMConfig | None = None, *, max_retries: int = 3):
        super().__init__(config or engine_config.llm_config("judge"), max_retries=max_retries)
