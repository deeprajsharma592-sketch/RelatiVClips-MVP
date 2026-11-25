import test from "node:test";
import assert from "node:assert/strict";
import { validateAndNormalizeEdl, snapToWordBoundary } from "../src/edl-validator.mjs";

const SAMPLE_WORDS = [
  { word: "Wait", start: 0.0, end: 0.28 },
  { word: "did", start: 0.3, end: 0.52 },
  { word: "you", start: 0.54, end: 0.72 },
  { word: "see", start: 0.74, end: 1.05 },
  { word: "that", start: 1.08, end: 1.45 },
  { word: "subscribe", start: 8.2, end: 8.9 },
  { word: "now", start: 9.0, end: 9.5 },
  { word: "bye", start: 9.6, end: 10.0 },
];

test("rejects unknown component types outside closed vocabulary", () => {
  assert.throws(
    () =>
      validateAndNormalizeEdl({
        duration: 10,
        words: SAMPLE_WORDS,
        story_roles: [{ role: "hook", start: 0, end: 2 }],
        beats: [{ type: "confetti_explosion", start: 0.1, end: 0.5 }],
      }),
    /closed vocabulary/
  );
});

test("snaps beat timestamps to nearest word boundaries", () => {
  assert.equal(snapToWordBoundary(0.29, SAMPLE_WORDS), 0.28);
  const result = validateAndNormalizeEdl({
    duration: 10,
    words: SAMPLE_WORDS,
    story_roles: [{ role: "hook", start: 0, end: 2 }],
    beats: [{ type: "punchy_bounce", start: 0.29, end: 0.73, text: "did you" }],
  });
  assert.equal(result.beats[0].start, 0.28);
  assert.equal(result.beats[0].end, 0.72);
});

test("drops high-intensity beats outside hook and caps at 2 per 5s", () => {
  const result = validateAndNormalizeEdl({
    duration: 10,
    words: SAMPLE_WORDS,
    story_roles: [
      { role: "hook", start: 0, end: 2.0 },
      { role: "info", start: 2.0, end: 8.0 },
      { role: "cta", start: 8.0, end: 10.0 },
    ],
    beats: [
      { type: "zoom_punch", intensity: "high", start: 0.0, end: 0.52 },
      { type: "shake", intensity: "high", start: 0.54, end: 1.05 },
      { type: "whip_transition", start: 1.08, end: 1.45 }, // 3rd high-intensity in 5s -> dropped
      { type: "callback_flash", start: 3.0, end: 3.8 }, // high-intensity outside hook -> dropped
      { type: "lower_third", start: 8.9, end: 9.8 }, // in last 1.5s of CTA (>= 8.5s) -> dropped
    ],
  });

  assert.equal(result.beats.length, 2);
  assert.equal(result.warnings.length, 3);
});
