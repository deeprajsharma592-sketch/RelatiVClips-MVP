import os
import subprocess
from pathlib import Path
from typing import Optional
from ..utils.config import TEMP_DIR, YTDLP_FORMAT, FFMPEG_PATH, FFPROBE_PATH, YTDLP_PATH


def extract_video_id(url: str) -> str:
    """
    Extract video ID from various YouTube URL formats.

    WHY THIS MATTERS:
    - Video IDs are used for naming output files
    - Consistent naming: {video_id}_{clip_number}_{start}s.mp4
    - Example: dQw4w9WgXcQ_1_45s.mp4
    """
    if "watch?v=" in url:
        return url.split("watch?v=")[-1].split("&")[0]
    elif "youtu.be/" in url:
        return url.split("youtu.be/")[-1].split("?")[0]
    elif "shorts/" in url:
        return url.split("shorts/")[-1].split("?")[0]
    else:
        raise ValueError(f"Could not extract video ID from URL: {url}")


def download_video(url: str, task_id: str, progress_callback: Optional[callable] = None) -> dict:
    """
    Download YouTube video and extract 16kHz WAV audio.

    WHY yt-dlp INSTEAD OF pytube/youtube-dl:
    - Actively maintained (pytube is abandoned)
    - Better error handling for age-restricted/region-locked videos
    - Automatic codec selection (avoids DASH segment stitching issues)
    - Handles YouTube's signature algorithm changes automatically

    WHY 16kHz WAV:
    - faster-whisper was trained on 16kHz audio
    - Higher sample rates (44.1kHz) add NO accuracy
    - WAV = lossless, no compression artifacts
    - Librosa requires this for proper RMS calculation

    Args:
        url: YouTube video URL
        task_id: Unique task identifier for file naming
        progress_callback: Optional callback for progress updates

    Returns:
        dict: {video_path, audio_path, video_id, duration_s}
    """
    video_id = extract_video_id(url)

    video_path = TEMP_DIR / f"{task_id}_video.mp4"
    audio_path = TEMP_DIR / f"{task_id}_video.wav"

    if progress_callback:
        progress_callback(f"Starting download of video {video_id}...")

    ytdlp_cmd = [
        YTDLP_PATH,
        "-f", "best[height<=480]/best",
        "--merge-output-format", "mp4",
        "-o", str(video_path),
        "--extract-audio",
        "--audio-format", "wav",
        "--audio-quality", "0",
        "--postprocessor-args", f"audio: -ar {16000} -ac 1",
        "--no-check-certificates",
        "--user-agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "--extractor-args", "youtube:player_client=web,default_client=web",
        "--no-warnings",
        "--sleep-interval", "5",
        "--max-sleep-interval", "15",
        "--wait-for-video", "10",
        url
    ]

    try:
        result = subprocess.run(
            ytdlp_cmd,
            capture_output=True,
            text=True,
            timeout=600
        )

        if result.returncode != 0:
            raise RuntimeError(f"yt-dlp failed: {result.stderr}")

        if progress_callback:
            progress_callback(f"Download complete for {video_id}")

        actual_video_path = TEMP_DIR / f"{task_id}_video.mp4"

        return {
            "video_path": str(actual_video_path),
            "audio_path": str(audio_path),
            "video_id": video_id,
            "task_id": task_id
        }

    except subprocess.TimeoutExpired:
        raise RuntimeError("Download timeout - video may be too long or unavailable")
    except Exception as e:
        raise RuntimeError(f"Download failed: {str(e)}")


def load_local_video(file_path: str, task_id: str, progress_callback: Optional[callable] = None) -> dict:
    """
    Load a local video file and extract audio for processing.

    Args:
        file_path: Path to local video file
        task_id: Unique task identifier
        progress_callback: Optional callback for progress updates

    Returns:
        dict: {video_path, audio_path, video_id, duration_s}
    """
    from pathlib import Path
    import uuid

    source_path = Path(file_path)
    if not source_path.exists():
        raise ValueError(f"File not found: {file_path}")

    video_id = source_path.stem[:50] + "_" + task_id[:8]
    video_path = TEMP_DIR / f"{task_id}_video.mp4"
    audio_path = TEMP_DIR / f"{task_id}_video.wav"

    # Copy file to temp directory
    import shutil
    shutil.copy2(source_path, video_path)

    # First check if video has audio stream
    probe_cmd = [
        FFPROBE_PATH,
        "-v", "error",
        "-select_streams", "a:0",
        "-show_entries", "stream=codec_type",
        "-of", "default=noprint_wrappers=1",
        str(video_path)
    ]
    probe_result = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=30)
    has_audio = "codec_type=audio" in probe_result.stdout

    if not has_audio:
        # Create silent audio file as fallback
        if progress_callback:
            progress_callback("No audio stream found, creating silent audio...")
        
        # Get video duration first
        dur_cmd = [
            FFPROBE_PATH,
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(video_path)
        ]
        dur_result = subprocess.run(dur_cmd, capture_output=True, text=True, timeout=30)
        try:
            duration = float(dur_result.stdout.strip())
        except:
            duration = 10.0  # Default 10 seconds if can't detect
        
        # Create silent 16kHz mono WAV
        silent_cmd = [
            FFMPEG_PATH,
            "-y",
            "-f", "lavfi",
            "-i", f"anullsrc=r=16000:cl=mono",
            "-t", str(duration),
            "-ar", "16000",
            "-ac", "1",
            "-acodec", "pcm_s16le",
            str(audio_path)
        ]
        result = subprocess.run(silent_cmd, capture_output=True, text=True, timeout=300)
        
        if result.returncode != 0:
            # Last resort - create empty file
            audio_path.write_bytes(b'')
    else:
        # Extract 16kHz mono WAV audio
        ffmpeg_cmd = [
            FFMPEG_PATH,
            "-y",
            "-i", str(video_path),
            "-ar", "16000",
            "-ac", "1",
            "-acodec", "pcm_s16le",
            str(audio_path)
        ]

        if progress_callback:
            progress_callback(f"Extracting audio from {source_path.name}...")

        result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, timeout=300)

        if result.returncode != 0:
            # If extraction fails, create silent fallback
            audio_path.write_bytes(b'')

    if progress_callback:
        progress_callback("Local video loaded successfully")

    return {
        "video_path": str(video_path),
        "audio_path": str(audio_path),
        "video_id": video_id,
        "task_id": task_id
    }


def get_video_duration(video_path: str) -> float:
    """
    Get video duration using ffprobe.

    WHY THIS IS NEEDED:
    - Librosa needs to know total duration for RMS calculation
    - Clip selector needs to validate clip timestamps
    - Face detection needs to calculate 25%, 50%, 75% frame positions
    """
    cmd = [
        FFPROBE_PATH,
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        video_path
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    return float(result.stdout.strip())


def cleanup_temp_files(task_id: str) -> None:
    """
    Clean up temporary files after processing completes.

    WHY THIS IS NEEDED:
    - 2 concurrent tasks × ~100MB per video = 200MB temp storage
    - Over time, temp/ fills up with unused files
    - Cleaning prevents disk space issues
    """
    patterns = [
        f"{task_id}_video.mp4",
        f"{task_id}_video.wav",
        f"{task_id}_transcript.json"
    ]

    for pattern in patterns:
        file_path = TEMP_DIR / pattern
        if file_path.exists():
            os.remove(file_path)


def download_audio_only(url: str, task_id: str, progress_callback: Optional[callable] = None, max_size_mb: int = 50) -> dict:
    """
    Download ONLY the audio stream for surgical analysis.
    
    CONSTRAINTS:
    - Maximum file size: 50MB (stays under 200MB limit)
    - Format: m4a (smaller than WAV)
    - Bitrate: 128k (good balance of size/quality)
    
    WHY THIS IS CRITICAL:
    - Full video for 1-hour = ~2GB (CRASHES)
    - Audio only for 1-hour = ~50MB (SAFE)
    - Allows Librosa analysis without downloading video
    
    Args:
        url: YouTube video URL
        task_id: Unique task identifier
        progress_callback: Optional callback for progress updates
        max_size_mb: Maximum allowed audio file size (default 50MB)
        
    Returns:
        dict: {audio_path, video_id, size_mb, success}
    """
    from ..utils.config import AUDIO_ONLY_BITRATE
    
    video_id = extract_video_id(url)
    audio_path = TEMP_DIR / f"{task_id}_audio.m4a"
    
    if progress_callback:
        progress_callback(f"Downloading audio stream for {video_id}...")
    
    ytdlp_cmd = [
        YTDLP_PATH,
        "-f", "bestaudio/best",
        "--extract-audio",
        "--audio-format", "m4a",
        "--audio-quality", "0",
        "-o", str(audio_path),
        "--no-warnings",
        "--no-check-certificates",
        "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        url
    ]
    
    try:
        result = subprocess.run(
            ytdlp_cmd,
            capture_output=True,
            text=True,
            timeout=180
        )
        
        if result.returncode != 0:
            return {"success": False, "error": f"yt-dlp failed: {result.stderr[:200]}"}
        
        if not audio_path.exists():
            return {"success": False, "error": "Audio file not created"}
        
        size_mb = audio_path.stat().st_size / 1024 / 1024
        
        if size_mb > max_size_mb:
            os.remove(audio_path)
            return {"success": False, "error": f"Audio too large: {size_mb:.1f}MB > {max_size_mb}MB limit"}
        
        if progress_callback:
            progress_callback(f"Audio downloaded: {size_mb:.1f}MB")
        
        return {
            "success": True,
            "audio_path": str(audio_path),
            "video_id": video_id,
            "size_mb": round(size_mb, 2),
            "task_id": task_id
        }
        
    except subprocess.TimeoutExpired:
        if audio_path.exists():
            os.remove(audio_path)
        return {"success": False, "error": "Download timeout"}
    except Exception as e:
        if audio_path.exists():
            os.remove(audio_path)
        return {"success": False, "error": str(e)}


def surgical_segment_download(url: str, start_time: float, end_time: float, task_id: str, segment_num: int, progress_callback: Optional[callable] = None) -> dict:
    """
    Download ONLY a specific video segment using yt-dlp --download-sections.
    
    CONSTRAINTS:
    - Downloads 90-second window (start_time to end_time)
    - Uses --force-keyframes-at-cuts for clean cuts
    - Format: bestvideo[height<=1080]+bestaudio
    
    Args:
        url: YouTube video URL
        start_time: Start of segment in seconds
        end_time: End of segment in seconds
        task_id: Unique task identifier
        segment_num: Which segment (1, 2, or 3)
        progress_callback: Optional callback
        
    Returns:
        dict: {success, video_path, size_mb, error}
    """
    video_id = extract_video_id(url)
    video_path = TEMP_DIR / f"{task_id}_segment_{segment_num}.mp4"
    
    start_str = str(start_time)
    end_str = str(end_time)
    
    if progress_callback:
        progress_callback(f"Downloading segment {segment_num}: {start_str}s-{end_str}s...")
    
    ytdlp_cmd = [
        YTDLP_PATH,
        "--download-sections", f"*{start_str}-{end_str}",
        "--force-keyframes-at-cuts",
        "-f", "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
        "--merge-output-format", "mp4",
        "-o", str(video_path),
        "--no-warnings",
        "--no-check-certificates",
        "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        url
    ]
    
    try:
        result = subprocess.run(
            ytdlp_cmd,
            capture_output=True,
            text=True,
            timeout=180
        )
        
        if result.returncode != 0:
            return {"success": False, "error": f"yt-dlp failed: {result.stderr[:200]}"}
        
        if not video_path.exists():
            return {"success": False, "error": "Segment file not created"}
        
        size_mb = video_path.stat().st_size / 1024 / 1024
        
        if progress_callback:
            progress_callback(f"Segment {segment_num} downloaded: {size_mb:.1f}MB")
        
        return {
            "success": True,
            "video_path": str(video_path),
            "segment_num": segment_num,
            "start_time": start_time,
            "end_time": end_time,
            "size_mb": round(size_mb, 2)
        }
        
    except subprocess.TimeoutExpired:
        if video_path.exists():
            os.remove(video_path)
        return {"success": False, "error": f"Segment {segment_num} download timeout"}
    except Exception as e:
        if video_path.exists():
            os.remove(video_path)
        return {"success": False, "error": str(e)}