"""
Signals package: engagement signal providers + fusion.
"""
from .base import TimeSeries, get_cached_signal, set_cached_signal, run_with_silent_fail
from .youtube_replay import fetch_youtube_replay_signal, extract_youtube_video_id
from .twitch_clips import fetch_twitch_clips_signal, extract_twitch_vod_id
from .twitch_chat import fetch_twitch_chat_signal
from .audio_energy import extract_audio_energy_signal
from .transcript_density import extract_transcript_density_signal
from .fusion import fuse_signals, FusionResult, HeatmapPeak

__all__ = [
    "TimeSeries",
    "get_cached_signal",
    "set_cached_signal",
    "run_with_silent_fail",
    "fetch_youtube_replay_signal",
    "extract_youtube_video_id",
    "fetch_twitch_clips_signal",
    "extract_twitch_vod_id",
    "fetch_twitch_chat_signal",
    "extract_audio_energy_signal",
    "extract_transcript_density_signal",
    "fuse_signals",
    "FusionResult",
    "HeatmapPeak",
]
