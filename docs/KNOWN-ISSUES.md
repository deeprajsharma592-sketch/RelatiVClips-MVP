# Known bugs / open issues

A live list of issues discovered during the CTO iteration that need
follow-up. Filed for transparency, not as promises.

## RENDERER-1: Stage 8 renderer uses wrong source for YouTube clips

**Severity:** High — clips aren't being rendered to MP4 for YouTube sources.
**Discovered:** 2026-06-11 during the Rick Astley E2E test (commit bdf360f).
**Status:** Open.

### Symptom
`POST /process/youtube` succeeds through stages 1, 3, 4, 5, 6, 7, 8, 9.
Stage 8 (render) attempts to call FFmpeg with the YouTube URL as
`video_path=source`. FFmpeg can't open the URL because the surgical
segments (stage 4) downloaded the audio-only m4a, not the video. Result:
"Error opening input: Invalid data found when processing input" × 3
attempts, fallback to taste-selector raw output.

### Why it worked on the old Ken Carson proof (commit 2aa83b3)
The old pipeline downloaded the full video + audio in stage 2 (via
`download_video`). Stage 4 then did surgical cuts from that local file.
The new pipeline (commit bdf360f era) skips the full download and
goes straight to surgical audio sections.

### What needs to change
The orchestrator's stage 8 needs to either:
1. **Use the surgical segment's local audio_path** as the input and
   render a video with a static background (e.g., waveform or branded
   still), OR
2. **Download the full video in stage 1.5** (new stage) and use that
   for the render, OR
3. **Update the renderer to compose a video from the audio + a still
   image** (cleaner; doesn't require the full download).

### Workaround until fixed
- Local file uploads (`/process/local`) work because the local file is
  a real video, not an audio section
- The `clips` array in `/status` still has the taste-aware titles and
  captions — the user can see what would have been generated

### Suggested fix
Add a stage between 1 and 4: `1.5_download_full_video` (only for
YouTube sources). Re-use the existing `download_video` from
`pipeline.ingestion`. Then stage 8's `video_path=source` would work
because `source` is replaced with the local full-video path.

## MODEL-1: StatusResponse clips field was too strict [FIXED]

**Severity:** High — /status 500'd for any pipeline that had a render failure.
**Discovered:** Same Rick Astley test.
**Status:** ✅ Fixed in commit bdf360f.

`clips: Optional[List[ClipMetadata]]` rejected the taste-selector's raw
output shape (which uses `ClipCandidate` fields, not `ClipMetadata`).
Changed to `Optional[List[dict]]` so /status never 500s. We already
log the full clip dict in `/logs/{task_id}` for type-safe inspection.

## YOUTUBE-IP-1: Some videos blocked by YouTube IP reputation

**Severity:** Medium — affects some URLs, not all. ~50% hit rate in testing.
**Discovered:** Pre-existing (per memory); partially mitigated by bgutil.

### Symptom
Some YouTube URLs return "Sign in to confirm you're not a bot" from
YouTube even with bgutil + Node runtime. Other URLs work fine on the
same IP.

### What's been tried
- bgutil-ytdlp-pot-provider 1.3.1 (Docker) — being CALLED but not
  sufficient for flagged IPs
- --js-runtimes node — required, working
- cookies.txt (249KB Netscape) — does not help per the user's note

### What's recommended
At deploy time, if Hetzner's IP is also flagged:
- Set `YT_PROXY=socks5://user:pass@home-ip:1080` to tunnel through
  a residential IP. Cost: $0 if you have a home network machine.
- Otherwise, document a manual video-upload workflow as the
  fallback for IP-blocked videos.
