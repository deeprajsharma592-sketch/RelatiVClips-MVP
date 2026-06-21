import os
import subprocess
import tempfile
from pathlib import Path
from typing import Optional
import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse

app = FastAPI(title="RelatiV Residential Downloader")
COOKIES_PATH = r"C:\Users\Deepraj sharma\Documents\youtube_cookies.txt"
TEMP_DIR = Path(os.environ.get("TEMP", tempfile.gettempdir()))
YT_DLP_CMD = "yt-dlp"


def download_video(url, output_path, start=None, end=None):
    cmd = [YT_DLP_CMD, "-f", "worst[height>=360]/worst", "--no-playlist", "-o", str(output_path)]
    if COOKIES_PATH and os.path.exists(COOKIES_PATH):
        cmd.extend(["--cookies", COOKIES_PATH])
    if start is not None or end is not None:
        cmd.extend(["--download-sections", f"*{start or 0}_{end or ''}"])
    cmd.append(url)
    print(f"[yt-dlp] Downloading: {url}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError("yt-dlp failed:\n" + result.stderr)
    if not output_path.exists():
        raise RuntimeError("No file produced")
    print(f"[yt-dlp] Done: {output_path.stat().st_size // 1024} KB")
    return output_path


@app.get("/health")
async def health():
    return {"status": "ok", "cookies": COOKIES_PATH if (os.path.exists(COOKIES_PATH)) else "NOT FOUND", "temp": str(TEMP_DIR)}


@app.get("/download")
async def download_video_endpoint(url=Query(...), format_spec=Query("worst[height>=360]/worst")):
    if not url.startswith("http"):
        raise HTTPException(400, "Invalid URL")
    out_path = TEMP_DIR / f"relativ_{os.getpid()}_{abs(hash(url))}.mp4"
    try:
        download_video(url, out_path)
        return FileResponse(path=out_path, filename="video.mp4", media_type="video/mp4", headers={"Content-Length": str(out_path.stat().st_size)})
    finally:
        if out_path.exists():
            out_path.unlink(missing_ok=True)


@app.post("/segment")
async def download_segment_endpoint(url, start=None, end=None):
    out_path = TEMP_DIR / f"relativ_seg_{abs(hash(url))}_{start or 0}_{end or 'end'}.mp4"
    try:
        download_video(url, out_path, start, end)
        def iter_file():
            with open(out_path, "rb") as f:
                while chunk := f.read(1048576):
                    yield chunk
        return StreamingResponse(iter_file(), media_type="video/mp4")
    finally:
        if out_path.exists():
            out_path.unlink(missing_ok=True)


@app.get("/subtitles")
async def subtitles_endpoint(url=Query(...), lang=Query("en")):
    if not url.startswith("http"):
        raise HTTPException(400, "Invalid URL")
    print(f"[subtitles] Fetching '{lang}' for: {url}")
    try:
        tmp_base = TEMP_DIR / f"relativ_subs_{abs(hash(url + lang))}"
        cmd = [YT_DLP_CMD, "--write-auto-subs", "--sub-lang", lang, "--sub-format", "vtt", "--skip-download", "--no-warnings", "--no-check-certificates", "-o", str(tmp_base)]
        if COOKIES_PATH and os.path.exists(COOKIES_PATH):
            cmd.extend(["--cookies", COOKIES_PATH])
        cmd.append(url)
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        print(f"[subtitles] fast method rc={result.returncode}")
        if result.returncode == 0:
            vtt_files = list(TEMP_DIR.glob("*.vtt"))
            vtt_files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
            for vf in vtt_files:
                try:
                    with open(vf, encoding="utf-8") as f:
                        content = f.read()
                    if content and len(content) > 50:
                        print(f"[subtitles] Got VTT: {len(content)} bytes")
                        vf.unlink(missing_ok=True)
                        for f in TEMP_DIR.glob("relativ_subs_*"):
                            f.unlink(missing_ok=True)
                        return {"vtt": content}
                except Exception:
                    pass
        print("[subtitles] Trying video download for subtitle extraction...")
        tmp_video = TEMP_DIR / f"relativ_video_{abs(hash(url))}.mp4"
        cmd = [YT_DLP_CMD, "-f", "worst[height>=360]/worst", "--no-playlist", "--write-auto-subs", "--sub-lang", lang, "--sub-format", "vtt", "-o", str(tmp_video)]
        if COOKIES_PATH and os.path.exists(COOKIES_PATH):
            cmd.extend(["--cookies", COOKIES_PATH])
        cmd.append(url)
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        print(f"[subtitles] video dl rc={result.returncode}")
        if result.returncode == 0:
            vtt_files = list(TEMP_DIR.glob(f"{tmp_video.stem}.vtt"))
            if vtt_files:
                with open(vtt_files[0], encoding="utf-8") as f:
                    content = f.read()
                vtt_files[0].unlink(missing_ok=True)
                tmp_video.unlink(missing_ok=True)
                return {"vtt": content}
        print(f"[subtitles] No subtitles: {result.stderr[:200]}")
        return {"error": "No subtitles available for this video"}, 404
    except subprocess.TimeoutExpired:
        return {"error": "Subtitle download timed out"}, 504
    except Exception as e:
        print(f"[subtitles] Error: {e}")
        return {"error": str(e)}, 500


if __name__ == "__main__":
    print("RelatiV Download Server starting on http://0.0.0.0:8765")
    print(f"  Temp: {TEMP_DIR}  |  Cookies: {COOKIES_PATH}")
    print("  Endpoints: /health  /download  /segment  /subtitles")
    uvicorn.run(app, host="0.0.0.0", port=8765, log_level="warning")
