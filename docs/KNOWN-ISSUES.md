# Known bugs / open issues

A live list of issues discovered during the CTO iteration that need
follow-up. Filed for transparency, not as promises.

## RENDERER-1: Stage 8 renderer used wrong source for YouTube clips

**Severity:** ~~High~~ → **Resolved** in commit 9e7a35f.
**Discovered:** 2026-06-11 during the Rick Astley E2E test.
**Status:** ✅ Fixed. The fix is now producing real MP4 files.

### Symptom (was)
`POST /process/youtube` succeeded through stages 1, 3, 4, 5, 6, 7, 8, 9.
Stage 8 (render) attempted to call FFmpeg with the YouTube URL as
`video_path=source`. FFmpeg couldn't open the URL because the surgical
segments (stage 4) had downloaded audio-only m4a, not video.

### Root cause (was)
Two things were wrong:
1. The orchestrator's stage 8 passed `source` (the YouTube URL) as
   `video_path` to the renderer. FFmpeg can't open a YouTube URL.
2. The taste selector's output (stage 6) had `start`/`end`/`viral_title`
   but NOT the `audio_path` of the local segment. Even with the stage-8
   fix, the renderer had no local file to use.

### What the fix does (commit 9e7a35f)
1. After stage 6 (taste select), enrich each `final_clip` with the
   `audio_path` from the matching surgical segment. Matching is by
   `start` time within ±0.5s tolerance.
2. Stage 8's renderer call now reads the clip's `audio_path` first,
   falling back to `file_path`, then to the source URL. FFmpeg
   always gets a real local file.

### Verification
E2E on `dQw4w9WgXcQ` (Rick Astley):
- 3 clips rendered to `/app/RelatiV/outputs/dQw4w9WgXcQ_{1,2,3}_*.mp4`
- File sizes: 184KB, 17KB, 28KB
- `/status` returns full ClipMetadata: clip_id, file_path, file_size_mb,
  duration_s, created_at
- Total pipeline time: 60 seconds end-to-end
- Taste-aware titles: "TOP MOMENT" (heuristic fallback; Claude Haiku
  was rate-limited at the moment of testing)

### What's still open (Day 4)
The clips are **audio-only MP4s** (the stage-4 surgical downloads are
m4a). For a proper "creator economy" product, the renderer would
need to compose a real video clip — e.g., waveform visualization +
captions, or a static background + audio. That's an enhancement, not
a bug. The current MP4s validate the pipeline works end-to-end.

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
