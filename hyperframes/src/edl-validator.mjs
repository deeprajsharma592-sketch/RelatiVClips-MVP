/**
 * Closed-vocabulary EDL validator and normalizer for HyperFrames v1 (livestream).
 */

export const STORY_ROLES = new Set(["hook", "info", "rehook", "cta"]);

export const COMPONENT_CATEGORIES = Object.freeze({
  punchy_bounce: "captions",
  highlight_word: "captions",
  zoom_punch: "motion",
  shake: "motion",
  whip_transition: "motion",
  popup_image: "overlays",
  popup_screenshot: "overlays",
  emoji_reaction: "overlays",
  lower_third: "overlays",
  callback_flash: "story",
});

export const VALID_COMPONENTS = new Set(Object.keys(COMPONENT_CATEGORIES));
export const VALID_VARIANTS = new Set(["A", "B", "C"]);

const ALWAYS_HIGH_INTENSITY = new Set(["whip_transition", "callback_flash"]);

/**
 * Determine whether a beat is high-intensity based on explicit flag, type, or params.
 * @param {object} beat
 * @returns {boolean}
 */
export function isHighIntensityBeat(beat) {
  if (beat.intensity === "high") return true;
  if (ALWAYS_HIGH_INTENSITY.has(beat.type)) return true;
  if (beat.type === "zoom_punch" && Number(beat.params?.scale ?? 1.1) > 1.12) return true;
  if (beat.type === "shake" && Number(beat.params?.amplitude ?? 6) > 6) return true;
  return false;
}

/**
 * Snap a timestamp to the closest word boundary (start or end).
 * @param {number} ts
 * @param {Array<{start: number, end: number}>} words
 * @returns {number}
 */
export function snapToWordBoundary(ts, words) {
  if (!Array.isArray(words) || words.length === 0) return ts;
  let best = ts;
  let minDist = Infinity;
  for (const w of words) {
    for (const edge of [w.start, w.end]) {
      const dist = Math.abs(ts - edge);
      if (dist < minDist) {
        minDist = dist;
        best = edge;
      }
    }
  }
  return Number(best.toFixed(3));
}

/**
 * Validate and normalize an EDL JSON object against v1 rules.
 * Throws on schema/vocabulary violations; enforces snapping, hook-only high intensity,
 * max 2 high-intensity beats per 5s, and 0 beats in the last 1.5s of CTA.
 *
 * @param {object} edl
 * @param {{ strict?: boolean }} [options]
 * @returns {object} Normalized EDL
 */
export function validateAndNormalizeEdl(edl, options = {}) {
  const { strict = false } = options;
  if (!edl || typeof edl !== "object") {
    throw new Error("EDL must be an object.");
  }

  const duration = Number(edl.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("EDL.duration must be a positive number.");
  }

  const words = Array.isArray(edl.words) ? edl.words : [];
  const storyRoles = Array.isArray(edl.story_roles) ? edl.story_roles : [];
  for (const seg of storyRoles) {
    if (!STORY_ROLES.has(seg.role)) {
      throw new Error(`Invalid story_role "${seg.role}". Allowed: hook, info, rehook, cta.`);
    }
  }

  const hookSeg = storyRoles.find((s) => s.role === "hook");
  const hookEnd = hookSeg ? Math.min(2.0, Number(hookSeg.end)) : 2.0;

  const ctaSeg = storyRoles.find((s) => s.role === "cta");
  const ctaLockStart = ctaSeg ? Math.max(0, Number(ctaSeg.end) - 1.5) : null;

  const rawBeats = Array.isArray(edl.beats) ? edl.beats : [];
  const errors = [];
  const accepted = [];

  for (let i = 0; i < rawBeats.length; i++) {
    const beat = rawBeats[i];
    if (!VALID_COMPONENTS.has(beat.type)) {
      throw new Error(`Beat[${i}] has unknown component "${beat.type}" outside closed vocabulary.`);
    }
    const variant = beat.variant ?? "A";
    if (!VALID_VARIANTS.has(variant)) {
      throw new Error(`Beat[${i}] has invalid variant "${variant}". Allowed: A, B, C.`);
    }

    const start = snapToWordBoundary(Number(beat.start), words);
    let end = snapToWordBoundary(Number(beat.end ?? start + 0.35), words);
    if (end <= start) {
      end = Number((start + 0.25).toFixed(3));
    }

    // Rule 3: No beats in the last 1.5s of CTA
    if (ctaLockStart !== null && start >= ctaLockStart) {
      errors.push(`Beat[${i}] (${beat.type} @ ${start}s) falls in final 1.5s of CTA (>= ${ctaLockStart}s).`);
      continue;
    }

    const high = isHighIntensityBeat(beat);

    // Rule 1: Strongest/high-intensity effects only in the hook (first 1-2s)
    if (high && start > hookEnd) {
      errors.push(`Beat[${i}] (${beat.type} @ ${start}s) is high-intensity outside hook (0–${hookEnd}s).`);
      continue;
    }

    // Rule 2: Max 2 high-intensity beats per sliding 5s window
    if (high) {
      const windowCount = accepted.filter(
        (b) => b.intensity === "high" && Math.abs(b.start - start) <= 5.0
      ).length;
      if (windowCount >= 2) {
        errors.push(`Beat[${i}] (${beat.type} @ ${start}s) exceeds max 2 high-intensity beats per 5s.`);
        continue;
      }
    }

    accepted.push({
      ...beat,
      variant,
      start,
      end,
      intensity: high ? "high" : beat.intensity ?? "normal",
    });
  }

  if (strict && errors.length > 0) {
    throw new Error(`EDL rule violations:\n- ${errors.join("\n- ")}`);
  }

  return {
    ...edl,
    duration,
    words,
    story_roles: storyRoles,
    beats: accepted,
    warnings: errors,
  };
}
