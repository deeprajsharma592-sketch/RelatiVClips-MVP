"""
Transcription provider abstraction.

Two providers:
  1. LocalWhisperProvider  — runs faster-whisper on the local GPU (RTX 5050)
  2. RunPodWhisperProvider — POSTs to a RunPod serverless Whisper endpoint

Selection rule (set via TRANSCRIPTION_PROVIDER env var):
  - "runpod"  → use RunPod (requires RUNPOD_API_KEY + RUNPOD_WHISPER_ENDPOINT_ID)
  - "local"   → use local faster-whisper
  - "auto"    → use RunPod if configured, else local (default)

Usage:
    from backend.services.transcription import transcribe
    segments = transcribe("/path/to/segment.m4a", task_id="t1")
"""
import base64
import logging
import os
import time
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Callable, Optional

import httpx

from ..pipeline import transcription as local_transcription
from ..utils import config  # noqa: F401 — ensures load_dotenv() ran

log = logging.getLogger(__name__)

ProgressCallback = Optional[Callable[[str], None]]


# --- ABC ---

class TranscriptionProvider(ABC):
    name: str = "base"

    @abstractmethod
    def available(self) -> bool: ...

    @abstractmethod
    def transcribe(
        self,
        audio_path: str,
        task_id: str,
        progress: ProgressCallback = None,
    ) -> dict: ...


# --- Local faster-whisper ---

class LocalWhisperProvider(TranscriptionProvider):
    """Runs the local faster-whisper model. Uses the RTX 5050 when present."""
    name = "local"

    def available(self) -> bool:
        return True  # always available; falls back to CPU if no GPU

    def transcribe(
        self,
        audio_path: str,
        task_id: str,
        progress: ProgressCallback = None,
    ) -> dict:
        return local_transcription.transcribe_audio(
            audio_path, task_id=task_id, progress_callback=progress,
        )


# --- RunPod serverless Whisper ---

class RunPodWhisperProvider(TranscriptionProvider):
    """POSTs audio to a RunPod serverless endpoint and polls for the result.

    The endpoint is expected to be a Whisper-family worker (insanely-fast-whisper
    or faster-whisper) that accepts JSON input with the audio (base64 or URL)
    and returns the transcript segments.

    Request body shape (matches the example you gave):
        {
            "input": {
                "audio": "<base64 or url>",
                "model": "turbo" | "base" | "small" | ...,
                "transcription": "plain text" | "srt" | "vtt",
                "translate": false,
                "temperature": 0,
                "best_of": 5,
                "beam_size": 5,
                "suppress_tokens": "-1",
                "condition_on_previous_text": false,
                "temperature_increment_on_fallback": 0.2,
                "compression_ratio_threshold": 2.4,
                "logprob_threshold": -1,
                "no_speech_threshold": 0.6
            }
        }
    """
    name = "runpod"

    # RunPod serverless URLs
    RUN_BASE = "https://api.runpod.ai/v2/{endpoint_id}"
    RUN_PATH = "/run"
    STATUS_PATH = "/status"

    def __init__(
        self,
        api_key: str,
        endpoint_id: str,
        model: str = "turbo",
        transcription_format: str = "plain text",
        beam_size: int = 5,
        best_of: int = 5,
        translate: bool = False,
        timeout_s: int = 300,
        poll_interval_s: float = 1.0,
    ):
        self.api_key = api_key
        self.endpoint_id = endpoint_id
        self.model = model
        self.transcription_format = transcription_format
        self.beam_size = beam_size
        self.best_of = best_of
        self.translate = translate
        self.timeout_s = timeout_s
        self.poll_interval_s = poll_interval_s

    def available(self) -> bool:
        return bool(self.api_key) and bool(self.endpoint_id)

    # --- HTTP helpers ---

    def _run_url(self) -> str:
        base = self.RUN_BASE.format(endpoint_id=self.endpoint_id)
        return base + self.RUN_PATH

    def _status_url(self, job_id: str) -> str:
        base = self.RUN_BASE.format(endpoint_id=self.endpoint_id)
        return f"{base}{self.STATUS_PATH}/{job_id}"

    def _headers(self) -> dict:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

    # --- Core: encode + send + poll ---

    def _encode_audio_b64(self, audio_path: str) -> str:
        p = Path(audio_path)
        if not p.exists():
            raise FileNotFoundError(f"Audio not found: {audio_path}")
        return base64.b64encode(p.read_bytes()).decode("ascii")

    def _build_input(self, audio_b64: str) -> dict:
        return {
            "input": {
                "audio": audio_b64,
                "model": self.model,
                "transcription": self.transcription_format,
                "translate": self.translate,
                "temperature": 0,
                "best_of": self.best_of,
                "beam_size": self.beam_size,
                "suppress_tokens": "-1",
                "condition_on_previous_text": False,
                "temperature_increment_on_fallback": 0.2,
                "compression_ratio_threshold": 2.4,
                "logprob_threshold": -1,
                "no_speech_threshold": 0.6,
            }
        }

    def _kickoff(self, payload: dict) -> str:
        """POST the job; return RunPod job_id."""
        with httpx.Client(timeout=60) as client:
            r = client.post(self._run_url(), json=payload, headers=self._headers())
        if r.status_code != 200:
            raise RuntimeError(
                f"RunPod /run returned {r.status_code}: {r.text[:300]}"
            )
        body = r.json()
        job_id = body.get("id")
        if not job_id:
            raise RuntimeError(f"RunPod /run returned no job id: {body}")
        return job_id

    def _poll(self, job_id: str) -> dict:
        """Poll until the job is COMPLETED/FAILED. Return the full response body."""
        deadline = time.monotonic() + self.timeout_s
        url = self._status_url(job_id)
        last_status = None
        with httpx.Client(timeout=30) as client:
            while time.monotonic() < deadline:
                r = client.get(url, headers=self._headers())
                if r.status_code != 200:
                    raise RuntimeError(
                        f"RunPod /status returned {r.status_code}: {r.text[:200]}"
                    )
                body = r.json()
                status = body.get("status", "").upper()
                if status != last_status:
                    log.info(f"RunPod job {job_id} status: {status}")
                    last_status = status
                if status in ("COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"):
                    return body
                time.sleep(self.poll_interval_s)
        raise TimeoutError(
            f"RunPod job {job_id} did not complete in {self.timeout_s}s"
        )

    def _result_to_transcript(self, runpod_result: dict, task_id: str) -> dict:
        """Normalize whatever shape the RunPod worker returns into our standard
        transcript dict: {segments, language, duration_s, task_id, source}.

        Worker output shapes vary by handler. We try the common patterns:
          - {"output": {"text": "..."}}
          - {"output": {"segments": [...]}}
          - {"output": "..."} (raw text)
          - {"output": {"transcription": "...", "segments": [...]}}
        """
        output = runpod_result.get("output", {})
        segments: list[dict] = []
        text: str = ""

        if isinstance(output, str):
            text = output
        elif isinstance(output, dict):
            # segments-first
            if "segments" in output and isinstance(output["segments"], list):
                for i, s in enumerate(output["segments"]):
                    if not isinstance(s, dict):
                        continue
                    seg = {
                        "start": float(s.get("start", 0)),
                        "end": float(s.get("end", s.get("start", 0))),
                        "text": (s.get("text", "")).strip(),
                    }
                    if seg["text"]:
                        segments.append(seg)
            # plain text fallback
            text = (
                output.get("text")
                or output.get("transcription")
                or output.get("transcript")
                or ""
            )
            if isinstance(text, list):
                text = " ".join(str(t) for t in text)
        # If we have text but no segments, synthesize one segment per line
        if text and not segments:
            for line in (ln.strip() for ln in text.splitlines() if ln.strip()):
                segments.append({"start": 0.0, "end": 0.0, "text": line})

        duration = max((s["end"] for s in segments), default=0.0)
        return {
            "language": runpod_result.get("language", "en"),
            "duration_s": round(duration, 2),
            "segments": segments,
            "task_id": task_id,
            "source": "runpod",
        }

    def transcribe(
        self,
        audio_path: str,
        task_id: str,
        progress: ProgressCallback = None,
    ) -> dict:
        if not self.available():
            raise RuntimeError(
                "RunPod provider not configured. Set RUNPOD_API_KEY and "
                "RUNPOD_WHISPER_ENDPOINT_ID in .env"
            )
        if progress:
            progress(f"Encoding audio for RunPod: {audio_path}")
        audio_b64 = self._encode_audio_b64(audio_path)
        payload = self._build_input(audio_b64)

        if progress:
            progress(f"POSTing to RunPod endpoint {self.endpoint_id} (model={self.model})")
        job_id = self._kickoff(payload)
        if progress:
            progress(f"RunPod job {job_id} queued, polling...")

        body = self._poll(job_id)
        status = body.get("status", "").upper()
        if status != "COMPLETED":
            raise RuntimeError(
                f"RunPod job {job_id} ended with status={status}: "
                f"{str(body)[:300]}"
            )

        transcript = self._result_to_transcript(body, task_id)
        if progress:
            progress(
                f"RunPod transcription done: {len(transcript['segments'])} segments, "
                f"{transcript['duration_s']}s"
            )
        return transcript


# --- Factory ---

_PROVIDERS = {
    "local": LocalWhisperProvider,
    "runpod": RunPodWhisperProvider,
}


def _build_runpod() -> RunPodWhisperProvider:
    return RunPodWhisperProvider(
        api_key=os.environ.get("RUNPOD_API_KEY", ""),
        endpoint_id=os.environ.get("RUNPOD_WHISPER_ENDPOINT_ID", ""),
        model=os.environ.get("RUNPOD_WHISPER_MODEL", "turbo"),
    )


def select_transcription_provider() -> TranscriptionProvider:
    """Pick a provider based on TRANSCRIPTION_PROVIDER env var.

    Modes:
      - "auto"   (default): RunPod if configured, else local
      - "runpod"          : force RunPod (raises if not configured)
      - "local"           : force local
    """
    mode = os.environ.get("TRANSCRIPTION_PROVIDER", "auto").lower().strip()

    if mode == "local":
        log.info("Transcription: local (TRANSCRIPTION_PROVIDER=local)")
        return LocalWhisperProvider()

    if mode == "runpod":
        p = _build_runpod()
        if not p.available():
            raise RuntimeError(
                "TRANSCRIPTION_PROVIDER=runpod but RUNPOD_API_KEY or "
                "RUNPOD_WHISPER_ENDPOINT_ID is missing in .env"
            )
        log.info(f"Transcription: runpod (endpoint={p.endpoint_id}, model={p.model})")
        return p

    # auto
    runpod = _build_runpod()
    if runpod.available():
        log.info(f"Transcription: runpod (auto-selected, model={runpod.model})")
        return runpod
    log.info("Transcription: local (auto-selected, no RunPod creds)")
    return LocalWhisperProvider()


# --- Convenience facade ---

def transcribe(
    audio_path: str,
    task_id: str,
    progress: ProgressCallback = None,
) -> dict:
    """One-shot transcription using the auto-selected provider."""
    return select_transcription_provider().transcribe(
        audio_path, task_id=task_id, progress=progress,
    )
