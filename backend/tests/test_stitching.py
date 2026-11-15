"""
Unit tests for Multi-Segment Jump Cut Stitching.
"""
import unittest
from backend.pipeline.stitching import (
    stitch_transcripts,
    build_ffmpeg_stitch_command,
)


class TestStitching(unittest.TestCase):

    def test_stitch_transcripts_word_timing_shift(self):
        """Verify that timestamps in subsequent stitched segments shift by exact duration of preceding segments."""
        # Segment 0: 0:14 to 0:30 (16 seconds duration)
        tr0 = {
            "segments": [
                {
                    "start": 0.0,
                    "end": 16.0,
                    "text": "We lost $400k in 3 days.",
                    "words": [
                        {"word": "We", "start": 0.0, "end": 0.4},
                        {"word": "lost", "start": 0.4, "end": 0.8},
                        {"word": "$400k", "start": 0.8, "end": 1.5},
                    ],
                }
            ]
        }

        # Segment 1: 0:51 to 0:57 (6 seconds duration)
        tr1 = {
            "segments": [
                {
                    "start": 0.0,
                    "end": 6.0,
                    "text": "Never spend before fixing unit economics.",
                    "words": [
                        {"word": "Never", "start": 0.0, "end": 0.5},
                        {"word": "spend", "start": 0.5, "end": 1.0},
                    ],
                }
            ]
        }

        merged = stitch_transcripts([tr0, tr1], [16.0, 6.0])

        self.assertEqual(merged["total_duration"], 22.0)
        self.assertEqual(len(merged["segments"]), 2)

        # Segment 0 words should remain untouched
        seg0_words = merged["segments"][0]["words"]
        self.assertEqual(seg0_words[0]["start"], 0.0)
        self.assertEqual(seg0_words[2]["start"], 0.8)

        # Segment 1 words must be shifted by 16.0 seconds
        seg1 = merged["segments"][1]
        self.assertEqual(seg1["start"], 16.0)
        self.assertEqual(seg1["end"], 22.0)
        seg1_words = seg1["words"]
        self.assertEqual(seg1_words[0]["start"], 16.0)  # 0.0 + 16.0
        self.assertEqual(seg1_words[1]["start"], 16.5)  # 0.5 + 16.0

    def test_ffmpeg_stitch_command_generation(self):
        """Verify FFmpeg complex filter generation for 2 segments with acrossfade."""
        cmd = build_ffmpeg_stitch_command(
            segment_paths=["part0.mp4", "part1.mp4"],
            output_path="stitched.mp4",
            crossfade_duration_s=0.04,
            punch_in_zoom=True,
        )

        cmd_str = " ".join(cmd)
        self.assertIn("-filter_complex", cmd)
        self.assertIn("acrossfade=d=0.04", cmd_str)
        self.assertIn("scale=iw*1.05", cmd_str)
        self.assertIn("stitched.mp4", cmd)


if __name__ == "__main__":
    unittest.main()
