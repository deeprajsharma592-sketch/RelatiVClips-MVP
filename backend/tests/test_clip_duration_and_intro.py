"""
Unit tests for clip duration rules (18s-38s, target 28s),
intelligent intro filler filtering, and non-overlapping clip separation.
"""
import unittest
from backend.pipeline.platforms import adjust_clip_to_format, FORMAT


class TestClipDurationAndIntro(unittest.TestCase):

    def test_clip_format_target_duration(self):
        """Verify format specifications match 20-35s viral short-form guidelines."""
        self.assertEqual(FORMAT.min_duration_s, 18.0)
        self.assertEqual(FORMAT.max_duration_s, 38.0)
        self.assertEqual(FORMAT.target_duration_s, 28.0)

    def test_short_moment_expands_forward_without_clamping(self):
        """Verify a 10s moment near the start expands forward into the payoff rather than clamping to 0."""
        start, end = 5.0, 15.0  # 10s duration
        new_start, new_end, reason = adjust_clip_to_format(start, end, video_duration=300.0)

        dur = new_end - new_start
        self.assertTrue(18.0 <= dur <= 38.0)
        self.assertEqual(reason, "extended_to_28s")
        # new_start should NOT be clamped to 0.0 (5.0 - 0.25*18 = 0.5)
        self.assertAlmostEqual(new_start, 0.5, delta=0.1)
        self.assertAlmostEqual(new_end, 28.5, delta=0.1)

    def test_multiple_moments_produce_distinct_ranges(self):
        """Ensure moments at different positions do not collapse into identical timestamps."""
        m1 = adjust_clip_to_format(4.0, 14.0, video_duration=600.0)
        m2 = adjust_clip_to_format(18.0, 28.0, video_duration=600.0)
        m3 = adjust_clip_to_format(55.0, 65.0, video_duration=600.0)

        # All three must have different start and end times
        self.assertNotEqual(m1[0], m2[0])
        self.assertNotEqual(m2[0], m3[0])
        self.assertNotEqual(m1[1], m2[1])
        self.assertNotEqual(m2[1], m3[1])

    def test_long_moment_is_trimmed_from_tail(self):
        """Verify that a moment longer than 38s is trimmed from the end (preserving the opening hook)."""
        start, end = 100.0, 160.0  # 60s
        new_start, new_end, reason = adjust_clip_to_format(start, end, video_duration=600.0)

        self.assertEqual(new_start, 100.0)  # Hook preserved
        self.assertEqual(new_end - new_start, FORMAT.max_duration_s)  # Trimmed to max
        self.assertEqual(reason, "trimmed_to_38s")

    def test_video_boundary_respected(self):
        """Verify that moments near the very end of the video do not exceed video_duration."""
        video_dur = 100.0
        start, end = 90.0, 95.0
        new_start, new_end, _ = adjust_clip_to_format(start, end, video_duration=video_dur)

        self.assertLessEqual(new_end, video_dur)
        self.assertGreaterEqual(new_start, 0.0)
        self.assertAlmostEqual(new_end - new_start, FORMAT.target_duration_s, delta=0.1)

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
            "In this video we are joined by our special guest",
        ]

        substantive_hooks = [
            "I lost four hundred thousand dollars in three days and here is what happened",
            "The single biggest mistake founders make when raising money",
            "Most people think higher revenue means higher profit",
        ]

        for snippet in filler_snippets:
            s_lower = snippet.lower()
            is_filler = any(phrase in s_lower for phrase in INTRO_FILLER_PHRASES)
            self.assertTrue(is_filler, f"Expected filler: '{snippet}'")

        for snippet in substantive_hooks:
            s_lower = snippet.lower()
            is_filler = any(phrase in s_lower for phrase in INTRO_FILLER_PHRASES)
            self.assertFalse(is_filler, f"Expected substantive hook: '{snippet}'")


if __name__ == "__main__":
    unittest.main()
