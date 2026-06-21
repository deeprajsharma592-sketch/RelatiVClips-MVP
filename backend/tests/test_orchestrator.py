"""
Smoke test for the 9-stage pipeline orchestrator.

Runs the orchestrator end-to-end with stubbed heavy operations
(energy peaks, transcription, render) so we can verify:
  - The wiring (stage order, output passing) is correct
  - The no-LLM fallback path works
  - Each stage's contract is honored (right keys, right shapes)
  - The LLM path works when an injectable provider is given

This is NOT an integration test. It does not touch ffmpeg, yt-dlp,
whisper, or the network. Those are tested separately when the
implementations land (Day 2+).
"""
import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path

from backend.pipeline.orchestrator import run_new_pipeline


# --- Test fixtures: stub every heavy operation ---

def _stub_energy_peaks(*args, **kwargs):
    # Energy 10.0 normalizes to 1.0. Hook formula: 0.40 + 0.20*lex + 0.25*valley + 0.15 = 0.75+
    # That clears the 0.7 quality floor. Using a single fixed energy to keep
    # this stub independent of the new valley_lift weighting in hooks.py.
    return {
        "peaks": [
            {"timestamp": 10.0, "energy_score": 10.0},
            {"timestamp": 25.0, "energy_score": 10.0},
            {"timestamp": 50.0, "energy_score": 10.0},
        ],
        "duration": 60.0,
    }


def _stub_transcribe(*args, **kwargs):
    return {
        "language": "en",
        "duration_s": 12.0,
        "segments": [
            {"start": 0.0, "end": 5.0, "text": "Hello world"},
            {"start": 5.0, "end": 12.0, "text": "This is a test"},
        ],
    }


def _stub_render(*args, **kwargs):
    # Simulate successful render
    return {
        "clip_id": "test_1_10s",
        "file_path": "/tmp/fake_clip.mp4",
        "file_size_mb": 1.5,
        "duration_s": 15.0,
    }


def _stub_face_batch(video_path, clips, progress_callback=None):
    return [{"x_offset": 0, "face_tracking": None} for _ in clips]


def _stub_ytdlp(url, candidates, task_id, log_fn=None, tmp_path=None):
    results = []
    for i, c in enumerate(candidates):
        path = tmp_path / f"{task_id}_seg{i}.m4a" if tmp_path else Path(f"/tmp/{task_id}_seg{i}.m4a")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"fake audio bytes for testing")
        results.append({
            **c,
            "audio_path": str(path),
            "source_start": c["start"],
            "source_end": c["end"],
        })
    return results


# --- Tests ---

class TestOrchestratorSmoke:
    """The pipeline runs in order with no LLM and produces a result."""

    def test_full_pipeline_no_llm_fallback(self, tmp_path):
        # Patch every heavy operation
        with patch("backend.pipeline.orchestrator.audio_analysis.analyze_audio_peaks", _stub_energy_peaks), \
             patch("backend.pipeline.orchestrator.transcription_module.transcribe_audio", _stub_transcribe), \
             patch("backend.pipeline.orchestrator.face_stage.get_batch_face_data", _stub_face_batch), \
             patch("backend.pipeline.orchestrator.renderer_module.render_clip", _stub_render), \
             patch("backend.pipeline.orchestrator.surgical_stage.surgical_download_youtube",
                   lambda *a, **kw: _stub_ytdlp(*a, tmp_path=tmp_path, **kw)):

            # Make the fake audio_path "exist" so the orchestrator proceeds
            fake_audio = tmp_path / "fake.m4a"
            fake_audio.write_bytes(b"fake")

            events = []
            result = run_new_pipeline(
                source="https://youtube.com/watch?v=abc123def45",
                creator_id=None,  # no creator history
                audio_path=str(fake_audio),
                progress=lambda stage, msg: events.append((stage, msg)),
            )

        # 1. All 9 stages ran
        assert result["stages_run"] == [1, 2, 3, 4, 5, 6, 7, 8, 9], \
            f"Stages: {result['stages_run']}"

        # 2. Stage 1 produced metadata
        assert result["video_meta"]["source_type"] == "youtube"
        assert result["video_meta"]["video_id"] == "abc123def45"

        # 3. Stage 3 produced hook candidates
        assert len(result["hooks"]) >= 1
        for h in result["hooks"]:
            assert "start" in h
            assert "hook_score" in h

        # 4. Stage 6 produced final clips (fallback path)
        assert len(result["clips"]) >= 1
        for c in result["clips"]:
            assert "start" in c
            assert "end" in c
            assert c["end"] > c["start"]

        # 5. Stage 8 rendered and added file_path (was output_path pre-fix)
        for c in result["clips"]:
            assert c.get("file_path") == "/tmp/fake_clip.mp4", \
                f"clip file_path wrong: {c}"

        # 6. Progress events fired for every stage
        stages_emitted = {e[0] for e in events}
        assert "analyze" in stages_emitted
        assert "energy" in stages_emitted
        assert "hooks" in stages_emitted
        assert "surgical" in stages_emitted
        assert "transcribe" in stages_emitted
        assert "taste" in stages_emitted
        assert "render" in stages_emitted
        assert "done" in stages_emitted

    def test_partial_stages_skip_correctly(self, tmp_path):
        """Test that we can run only stages 1-3 (analysis + energy + hooks)."""
        with patch("backend.pipeline.orchestrator.audio_analysis.analyze_audio_peaks", _stub_energy_peaks):
            fake_audio = tmp_path / "fake.m4a"
            fake_audio.write_bytes(b"fake")
            result = run_new_pipeline(
                source="https://youtube.com/watch?v=xyz",
                audio_path=str(fake_audio),
                stages=[1, 2, 3],  # only the cheap stages
                progress=lambda s, m: None,
            )
        assert result["stages_run"] == [1, 2, 3]
        assert "hooks" in result
        assert result["clips"] == []  # no stages 6+ ran

    def test_llm_path_uses_provider(self, tmp_path):
        """When an LLM callable is given, the prompt is sent to it and parsed."""
        # The LLM "responds" with one of the two candidates
        def fake_llm(prompt: str) -> str:
            # The new archetype-aware prompt uses "Candidates", the legacy
            # build_prompt uses "Hook candidates". Accept either.
            assert ("Hook candidates" in prompt or "Candidates" in prompt), \
                f"prompt missing candidates section"
            assert "JSON" in prompt
            return '[{"candidate_index": 1, "edit_reason": "Strong opening", "trim_start_offset": -2, "trim_end_offset": 13}]'

        with patch("backend.pipeline.orchestrator.audio_analysis.analyze_audio_peaks", _stub_energy_peaks), \
             patch("backend.pipeline.orchestrator.transcription_module.transcribe_audio", _stub_transcribe), \
             patch("backend.pipeline.orchestrator.face_stage.get_batch_face_data", _stub_face_batch), \
             patch("backend.pipeline.orchestrator.renderer_module.render_clip", _stub_render), \
             patch("backend.pipeline.orchestrator.surgical_stage.surgical_download_youtube",
                   lambda *a, **kw: _stub_ytdlp(*a, tmp_path=tmp_path, **kw)):

            fake_audio = tmp_path / "fake.m4a"
            fake_audio.write_bytes(b"fake")
            result = run_new_pipeline(
                source="https://youtube.com/watch?v=llmtest",
                audio_path=str(fake_audio),
                llm_callable=fake_llm,
                progress=lambda s, m: None,
            )

        # LLM response was honored (we got at least one clip)
        assert len(result["clips"]) >= 1
        # The clip has the LLM's edit_reason
        assert any("Strong opening" in c.get("edit_reason", "") for c in result["clips"])

    def test_source_type_youtube_vs_local(self):
        """Stage 1 distinguishes YouTube from local correctly."""
        with patch("backend.pipeline.orchestrator.audio_analysis.analyze_audio_peaks", _stub_energy_peaks):
            # YouTube URL
            r1 = run_new_pipeline(
                source="https://www.youtube.com/watch?v=foo",
                stages=[1], progress=lambda s, m: None,
            )
            assert r1["video_meta"]["source_type"] == "youtube"
            assert r1["video_meta"]["video_id"] == "foo"

            # youtu.be short URL
            r2 = run_new_pipeline(
                source="https://youtu.be/abc",
                stages=[1], progress=lambda s, m: None,
            )
            assert r2["video_meta"]["source_type"] == "youtube"

            # Local file
            r3 = run_new_pipeline(
                source="/home/user/video.mp4",
                stages=[1], progress=lambda s, m: None,
            )
            assert r3["video_meta"]["source_type"] == "local"
            assert r3["video_meta"]["video_id"] is None

    def test_no_audio_path_skips_energy_hooks_surgical(self):
        """If audio_path is None, stages 2-5 skip gracefully."""
        result = run_new_pipeline(
            source="https://youtube.com/watch?v=skipped",
            audio_path=None,
            progress=lambda s, m: None,
        )
        # Stage 1 ran; stages that need audio were skipped
        assert 1 in result["stages_run"]
        assert 2 not in result["stages_run"]
        assert 3 not in result["stages_run"]
        assert 4 not in result["stages_run"]
        # No clips produced
        assert result["clips"] == []

    def test_creator_id_loads_history(self, tmp_path, monkeypatch):
        """If a creator has history, the ICL prompt is built with examples."""
        from datetime import datetime
        from backend.taste.icl import CreatorClipHistory

        # Set up fake history
        monkeypatch.setattr("backend.taste.store.HISTORY_DIR", tmp_path)
        history_entry = CreatorClipHistory(
            clip_id="c1", video_title="Old viral",
            hook_start=10.0, hook_end=25.0, edit_reason="Great hook",
            published_at=datetime(2026, 1, 1), views=10000, retention_pct=75.0,
        )
        from backend.taste.store import append_history
        append_history("creator_vip", history_entry)

        # The LLM captures the prompt so we can inspect it
        captured_prompts = []
        def capturing_llm(prompt: str) -> str:
            captured_prompts.append(prompt)
            return '[]'  # no picks

        with patch("backend.pipeline.orchestrator.audio_analysis.analyze_audio_peaks", _stub_energy_peaks), \
             patch("backend.pipeline.orchestrator.transcription_module.transcribe_audio", _stub_transcribe), \
             patch("backend.pipeline.orchestrator.face_stage.get_batch_face_data", _stub_face_batch), \
             patch("backend.pipeline.orchestrator.renderer_module.render_clip", _stub_render), \
             patch("backend.pipeline.orchestrator.surgical_stage.surgical_download_youtube",
                   lambda *a, **kw: _stub_ytdlp(*a, tmp_path=tmp_path, **kw)):

            fake_audio = tmp_path / "fake.m4a"
            fake_audio.write_bytes(b"fake")
            run_new_pipeline(
                source="https://youtube.com/watch?v=icl",
                creator_id="creator_vip",
                audio_path=str(fake_audio),
                llm_callable=capturing_llm,
                progress=lambda s, m: None,
            )

        assert len(captured_prompts) == 1
        prompt = captured_prompts[0]
        # ICL signal: the creator's history was included as a few-shot example
        assert "Old viral" in prompt
        assert "10000" in prompt  # views mentioned

    def test_render_failure_doesnt_crash(self, tmp_path):
        """If render fails for a clip, the pipeline continues for the others."""
        render_calls = [0]
        def flaky_render(*args, **kwargs):
            render_calls[0] += 1
            if render_calls[0] == 1:
                return None  # first clip fails
            return _stub_render(*args, **kwargs)

        with patch("backend.pipeline.orchestrator.audio_analysis.analyze_audio_peaks", _stub_energy_peaks), \
             patch("backend.pipeline.orchestrator.transcription_module.transcribe_audio", _stub_transcribe), \
             patch("backend.pipeline.orchestrator.face_stage.get_batch_face_data", _stub_face_batch), \
             patch("backend.pipeline.orchestrator.renderer_module.render_clip", flaky_render), \
             patch("backend.pipeline.orchestrator.surgical_stage.surgical_download_youtube",
                   lambda *a, **kw: _stub_ytdlp(*a, tmp_path=tmp_path, **kw)):

            fake_audio = tmp_path / "fake.m4a"
            fake_audio.write_bytes(b"fake")
            events = []
            result = run_new_pipeline(
                source="https://youtube.com/watch?v=flaky",
                audio_path=str(fake_audio),
                progress=lambda s, m: events.append((s, m)),
            )

        # Render was attempted at least once
        assert render_calls[0] >= 1
        # Pipeline didn't crash and reached the end
        assert result["stages_run"][-1] == 9
        assert any(e[0] == "done" for e in events)
