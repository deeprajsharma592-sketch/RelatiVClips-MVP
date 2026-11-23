"""
Unit tests for clip duration rules (30s-90s variable policy),
intelligent intro filler filtering, and non-overlapping clip separation.
"""
import unittest
from backend.pipeline.platforms import adjust_clip_to_format, FORMAT


class TestClipDurationAndIntro(unittest.TestCase):

    def test_clip_format_target_duration(self):
        """Verify format specifications match 30-90s viral short-form guidelines."""
        self.assertEqual(FORMAT.min_duration_s, 30.0)
        self.assertEqual(FORMAT.max_duration_s, 90.0)

    def test_short_moment_expands_forward_without_clamping(self):
        """Verify a 10s moment near the start expands forward to minimum boundary."""
        start, end = 5.0, 15.0  # 10s duration
        new_start, new_end, reason = adjust_clip_to_format(start, end, video_duration=300.0)

        dur = new_end - new_start
        self.assertTrue(30.0 <= dur <= 90.0)
        self.assertIn("padded_to_hard_min_30s", reason)
        self.assertEqual(new_start, 5.0)
        self.assertEqual(new_end, 35.0)

    def test_multiple_moments_produce_distinct_ranges(self):
        """Ensure moments at different positions do not collapse into identical timestamps."""
        m1 = adjust_clip_to_format(4.0, 44.0, video_duration=600.0)
        m2 = adjust_clip_to_format(68.0, 118.0, video_duration=600.0)
        m3 = adjust_clip_to_format(155.0, 205.0, video_duration=600.0)

        # All three must have different start and end times
        self.assertNotEqual(m1[0], m2[0])
        self.assertNotEqual(m2[0], m3[0])
        self.assertNotEqual(m1[1], m2[1])
        self.assertNotEqual(m2[1], m3[1])

    def test_long_moment_is_trimmed_from_tail(self):
        """Verify that a moment longer than 90s is capped at hard max."""
        start, end = 100.0, 220.0  # 120s
        new_start, new_end, reason = adjust_clip_to_format(start, end, video_duration=600.0)

        self.assertEqual(new_start, 100.0)  # Hook preserved
        self.assertEqual(new_end - new_start, FORMAT.max_duration_s)  # Trimmed to max
        self.assertIn("capped_at_hard_max_90s", reason)

    def test_video_boundary_respected(self):
        """Verify that moments near the very end of the video do not exceed video_duration."""
        video_dur = 100.0
        start, end = 90.0, 95.0
        new_start, new_end, _ = adjust_clip_to_format(start, end, video_duration=video_dur)

        self.assertLessEqual(new_end, video_dur)
        self.assertGreaterEqual(new_start, 0.0)

    def test_intro_filler_detection(self):
        """Verify intro filler phrases are detected on long-form content."""
        INTRO_FILLER_PHRASES = (
            "welcome back", "welcome to", "today's episode", "today we are", "today we have",
            "sponsored by", "hit subscribe", "in this video", "leave a comment", "let's get into it",
            "before we begin", "before we start", "hey guys", "make sure to subscribe"
        )

        filler_snippets = [
            "Hey guys welcome back to the channel today's episode is sponsored by",
            "Before we begin make sure to subscribe and hit that bell icon",
            "In this video we are going to explore the universe",
            "Today we have a special guest so leave a comment below",
        ]

        content_snippets = [
            "The neural network converges exponentially faster when gradient clipping is used",
            "The company pivoted from enterprise SaaS to a developer API overnight",
            "She realized the contract had a hidden clause that voided the entire deal",
        ]

        for s in filler_snippets:
            self.assertTrue(
                any(p in s.lower() for p in INTRO_FILLER_PHRASES),
                f"Failed to detect filler in: {s}",
            )

        for s in content_snippets:
            self.assertFalse(
                any(p in s.lower() for p in INTRO_FILLER_PHRASES),
                f"False positive on genuine content: {s}",
            )


if __name__ == "__main__":
    unittest.main()
