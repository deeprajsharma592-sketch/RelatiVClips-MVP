"""
End-to-End RelatiVClips Pipeline Execution on YouTube Video.
Flow:
1. Transcribe audio with word-level timestamps (faster-whisper).
2. Detect moments & score viral hook candidates using RelatiVSauce taste criteria.
3. Cut top landscape clip (clip_cutter).
4. Run RelatiV Dynamic Framing (spec-0.1):
   - S1 Normalization
   - S2 Shot Detection
   - S3 Face Tracking & MAR
   - S4 Silero VAD + Speaker Attribution
   - S5 Turn Analysis
   - S6 Layout Planning (SINGLE / STACK / FIT_BLUR)
   - S7 Camera Paths (Gaussian smoothing, dead-zone, velocity clamping)
   - S8 Cosine Eased Punch-In Zooms on Impact Words
   - S9 Subpixel Affine Render (1080x1920)
   - S10 QA Metrics Report (qa.json)
"""

import json
import os
import subprocess
import time
from pathlib import Path
from faster_whisper import WhisperModel

from framing.run import run_pipeline


def step_1_transcribe(wav_path: str, model_size: str = "base") -> dict:
    print(f"\n[E2E Step 1] Transcribing {wav_path} with faster-whisper ({model_size})...")
    t0 = time.time()
    # Run on CPU with int8 quantization for high speed
    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    segments, info = model.transcribe(wav_path, word_timestamps=True, beam_size=1)

    all_segments = []
    all_words = []
    for s in segments:
        seg_dict = {
            "start": round(s.start, 3),
            "end": round(s.end, 3),
            "text": s.text.strip(),
            "words": []
        }
        if s.words:
            for w in s.words:
                w_dict = {
                    "word": w.word.strip(),
                    "start": round(w.start, 3),
                    "end": round(w.end, 3),
                    "probability": round(w.probability, 3)
                }
                seg_dict["words"].append(w_dict)
                all_words.append(w_dict)
        all_segments.append(seg_dict)

    elapsed = time.time() - t0
    print(f"[E2E Step 1] Transcribed {len(all_segments)} segments ({len(all_words)} words) in {elapsed:.1f}s. Detected language: {info.language}")
    return {"segments": all_segments, "words": all_words, "language": info.language}


def step_2_find_viral_hook(transcript_data: dict, duration_s: float) -> dict:
    print("\n[E2E Step 2] Scoring candidate moments using RelatiVSauce taste criteria...")
    # Look for opening power hook / high emotional stakes / numbers (e.g. ₹25 Lakhs, business loss)
    # The title of video is "i lost ₹25,00,000 at 21 trying to build a business"
    # The opening 0-35s typically delivers the primary thesis and problem statement.
    segments = transcript_data.get("segments", [])

    candidates = []
    # Search for moments around ₹25 lakhs / business / loss or opening hook
    for idx, seg in enumerate(segments):
        txt = seg["text"].lower()
        start = seg["start"]
        end = min(duration_s, start + 25.0)

        # Look ahead 25s of text
        window_words = []
        for s in segments:
            if s["start"] >= start and s["end"] <= end + 1.0:
                window_words.extend(s.get("words", []))

        text_window = " ".join(s["text"] for s in segments if s["start"] >= start and s["end"] <= end)
        score = 5.0
        # High impact keywords from RelatiVSauce rubric
        if any(k in text_window.lower() for k in ["25", "lakh", "lost", "business", "money", "mistake", "started", "never"]):
            score += 3.0
        if start < 30.0:  # Opening hook bonus
            score += 2.0

        candidates.append({
            "start": start,
            "end": end,
            "text": text_window,
            "words": window_words,
            "score": score
        })

    # Pick the highest scoring candidate (prioritize the strong opening hook)
    candidates.sort(key=lambda c: (c["score"], -c["start"]), reverse=True)
    best = candidates[0] if candidates else {"start": 0.0, "end": 25.0, "words": []}

    # Ensure clip duration is between 15s and 28s
    clip_dur = best["end"] - best["start"]
    if clip_dur > 26.0:
        best["end"] = best["start"] + 25.0

    print(f"[E2E Step 2] Picked winning moment: {best['start']:.1f}s -> {best['end']:.1f}s (duration: {best['end']-best['start']:.1f}s)")
    print(f"[E2E Step 2] Hook snippet: \"{best.get('text', '')[:100]}...\"")
    return best


def step_3_cut_clip(input_mp4: str, start_s: float, end_s: float, out_mp4: str):
    print(f"\n[E2E Step 3] Cutting landscape video segment [{start_s:.2f}s -> {end_s:.2f}s] to {out_mp4}...")
    dur = end_s - start_s
    ffmpeg_bin = "/Users/deeprajsharma/Downloads/RelatiVClips/.venv_framing/bin/ffmpeg"
    cmd = [
        ffmpeg_bin, "-y",
        "-ss", str(start_s),
        "-i", input_mp4,
        "-t", str(dur),
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "18",
        "-c:a", "aac",
        "-b:a", "160k",
        out_mp4
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    print(f"[E2E Step 3] Clip successfully cut ({Path(out_mp4).stat().st_size / 1024 / 1024:.2f} MB).")


def main():
    print("=" * 70)
    print("RELATIVCLIPS END-TO-END PIPELINE: YOUTUBE -> VIRAL DYNAMIC SHORT")
    print("=" * 70)

    workdir = Path("./e2e_youtube_run").resolve()
    workdir.mkdir(parents=True, exist_ok=True)

    input_full_mp4 = "./temp/input_full.mp4"
    input_full_wav = "./temp/input_full.wav"

    # 1. Transcribe audio
    transcript_file = workdir / "transcript_full.json"
    if transcript_file.exists():
        with open(transcript_file) as f:
            transcript = json.load(f)
    else:
        transcript = step_1_transcribe(input_full_wav, model_size="base")
        with open(transcript_file, "w") as f:
            json.dump(transcript, f, indent=2)

    # 2. Score & pick winning moment
    winning_moment = step_2_find_viral_hook(transcript, duration_s=472.0)
    start_s = winning_moment["start"]
    end_s = winning_moment["end"]

    # 3. Cut landscape segment
    cut_clip_path = workdir / "cut_landscape_segment.mp4"
    step_3_cut_clip(input_full_mp4, start_s, end_s, str(cut_clip_path))

    # Rebase word timestamps relative to clip start (t=0)
    clip_words = []
    for w in transcript.get("words", []):
        if start_s <= w["start"] <= end_s:
            clip_words.append({
                "word": w["word"],
                "start": round(w["start"] - start_s, 3),
                "end": round(w["end"] - start_s, 3),
            })
    words_file = workdir / "words.json"
    with open(words_file, "w") as f:
        json.dump(clip_words, f, indent=2)

    # Identify impact words (e.g. numbers, key emotional punch words)
    impact_candidates = []
    for w in clip_words:
        cleaned = w["word"].strip(".,!?:;\"'").lower()
        if cleaned in ["lost", "lakhs", "business", "never", "started", "broke", "biggest", "money", "zero"]:
            impact_candidates.append({
                "word": cleaned,
                "t": (w["start"] + w["end"]) / 2.0,
                "strength": 0.95
            })
    impact_file = workdir / "impact.json"
    with open(impact_file, "w") as f:
        json.dump(impact_candidates, f, indent=2)
    print(f"[E2E Setup] Identified {len(impact_candidates)} impact punch words: {[c['word'] for c in impact_candidates]}")

    # 4. Run RelatiV Dynamic Framing (spec-0.1)
    print("\n[E2E Step 4] Running RelatiV Dynamic Framing Pipeline (spec-0.1)...")
    out_vertical_mp4 = workdir / "viral_short_1080x1920.mp4"
    qa_artifact = run_pipeline(
        clip_path=cut_clip_path,
        output_path=out_vertical_mp4,
        workdir=workdir,
        words_path=words_file,
        impact_path=impact_file,
        debug_overlay=False,
    )

    print("\n" + "=" * 70)
    print("PIPELINE EXECUTION COMPLETE!")
    print(f"Output Video: {out_vertical_mp4}")
    print(f"QA Status:    {qa_artifact.get('status')}")
    print(f"Throughput:   {qa_artifact.get('realtime_factor')}x realtime")
    print(f"Metrics:")
    for k, v in qa_artifact.get("metrics", {}).items():
        print(f"  - {k}: {v}")
    print("=" * 70)


if __name__ == "__main__":
    main()
