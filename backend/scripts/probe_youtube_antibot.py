"""
YouTube anti-bot startup probe.

Runs once at backend startup to confirm that this host's IP can fetch
YouTube successfully — i.e. we are NOT currently flagged by YouTube's
IP reputation layer. The bgutil PO token system solves the *protocol*
side of the anti-bot wall; this probe solves the *reputation* side.

PROBE TARGET: jNQXAC9IVRw ("Me at the zoo", 19 seconds, public, NEVER
flagged, oldest YouTube video). If this URL fails, the entire IP is
likely flagged and we should surface a clear warning to operators.

USAGE
-----
    # From the host with the .env loaded:
    python -m backend.scripts.probe_youtube_antibot

    # Or as a one-off (no .env):
    python -m backend.scripts.probe_youtube_antibot \\
        --bgutil-url http://127.0.0.1:4416

EXIT CODES
----------
    0 = probe passed, YouTube is reachable
    1 = probe failed, YouTube anti-bot is blocking this IP
    2 = bgutil is unreachable (separate problem, fix first)

NON-FATAL: This script is designed to be a *check*, not a gate. The
backend should log a warning if it fails but continue starting (so we
can still serve cached clips and show a clear error to users).
"""
import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

# Allow running as a script
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.utils.config import BGUTIL_POT_BASE_URL, YTDLP_PATH  # noqa: E402

PROBE_URL = "https://www.youtube.com/watch?v=jNQXAC9IVRw"
PROBE_TIMEOUT_S = 30


def probe_bgutil(bgutil_url: str) -> bool:
    """Verify bgutil is reachable before attempting YouTube fetch."""
    try:
        import urllib.request
        with urllib.request.urlopen(f"{bgutil_url}/ping", timeout=5) as r:
            body = json.loads(r.read().decode())
        return "version" in body
    except Exception as e:
        print(f"  bgutil ping failed: {e}", file=sys.stderr)
        return False


def probe_youtube(bgutil_url: str) -> dict:
    """
    Fetch metadata for the probe URL via yt-dlp + bgutil.

    We only need METADATA (no download), so this is fast (~3-5s) and
    bandwidth-cheap. Returns dict with: {success, error?, timing_ms}.
    """
    cmd = [
        YTDLP_PATH,
        "--skip-download",
        "--print-json",
        "--no-warnings",
        "--no-check-certificates",
        "--user-agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "--extractor-args", f"youtubepot-bgutilhttp:base_url={bgutil_url}",
        "--js-runtimes", "node",
        PROBE_URL,
    ]
    start = time.monotonic()
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=PROBE_TIMEOUT_S
        )
        elapsed_ms = int((time.monotonic() - start) * 1000)
        if result.returncode != 0:
            return {"success": False, "error": result.stderr[:500], "timing_ms": elapsed_ms}
        # Parse first line of stdout as JSON (defensive: stdout can be None)
        stdout = (result.stdout or "").strip()
        if not stdout:
            return {"success": False, "error": "empty stdout (yt-dlp returned no output)", "timing_ms": elapsed_ms}
        first_line = stdout.split("\n", 1)[0]
        meta = json.loads(first_line)
        if "title" not in meta or "id" not in meta:
            return {"success": False, "error": "no title/id in metadata", "timing_ms": elapsed_ms}
        return {
            "success": True,
            "title": meta.get("title"),
            "id": meta.get("id"),
            "timing_ms": elapsed_ms,
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": f"timeout after {PROBE_TIMEOUT_S}s"}
    except Exception as e:
        return {"success": False, "error": str(e)[:500]}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument(
        "--bgutil-url", default=BGUTIL_POT_BASE_URL,
        help=f"bgutil base URL (default: {BGUTIL_POT_BASE_URL})",
    )
    args = parser.parse_args()

    print(f"[probe] bgutil URL: {args.bgutil_url}")
    print(f"[probe] target:     {PROBE_URL}")

    # Step 1: bgutil reachable?
    if not probe_bgutil(args.bgutil_url):
        print("[probe] FAIL: bgutil container is not reachable", file=sys.stderr)
        print("        Start it: docker run -d --name bgutil-provider "
              "-p 4416:4416 brainicism/bgutil-ytdlp-pot-provider", file=sys.stderr)
        return 2

    print("[probe] bgutil OK, attempting YouTube fetch...")

    # Step 2: YouTube fetchable from this IP?
    result = probe_youtube(args.bgutil_url)
    if not result["success"]:
        print(f"[probe] FAIL: YouTube anti-bot is blocking this IP")
        print(f"        error: {result.get('error', 'unknown')[:200]}")
        print()
        print("        Fallback options:")
        print("        1. Set YT_PROXY=socks5://... in .env (residential IP tunnel)")
        print("        2. Add a Webshare residential paid-tier proxy")
        print("        3. Spin up a second worker in a different datacenter /24")
        return 1

    print(f"[probe] PASS: fetched '{result['title']}' in {result['timing_ms']}ms")
    return 0


if __name__ == "__main__":
    sys.exit(main())
