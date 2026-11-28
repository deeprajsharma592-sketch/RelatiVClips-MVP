// shake — screen shake on the source footage, with a motion-blur smear ramp.
// Deterministic: the jitter is a seeded LCG, never Math.random().
// The smear is two things working together: the framework's shutter pass
// (root data-motion-blur, set by compose.py from the same param) and a small
// scale squash that ramps with the shake intensity.
window.HF_BLOCKS = window.HF_BLOCKS || {};
window.HF_BLOCKS.shake = function (tl, id, p, meta) {
  var target = meta.source;
  var dur = Math.max(0.08, meta.duration);
  var intensity = p.intensity == null ? 0.5 : p.intensity;
  var freq = p.frequency == null ? 6 : p.frequency;
  var decay = p.decay == null ? 0.6 : p.decay;
  var rot = p.rotation == null ? 0.6 : p.rotation;
  var smear = p.motion_blur == null ? 0 : p.motion_blur;

  // Seeded LCG so two renders of the same EDL jitter identically.
  var seed = 2166136261;
  for (var c = 0; c < id.length; c++) seed = (seed ^ id.charCodeAt(c)) * 16777619 >>> 0;
  function rnd() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967295;
  }

  var steps = Math.max(2, Math.round(dur * freq * 2));
  var keyframes = [];
  for (var i = 0; i < steps; i++) {
    var t = i / steps;
    var falloff = Math.pow(1 - t, Math.max(0.05, decay * 2));
    var ampX = intensity * 34 * falloff;
    var ampY = intensity * 26 * falloff;
    keyframes.push({
      x: (rnd() * 2 - 1) * ampX,
      y: (rnd() * 2 - 1) * ampY,
      rotation: (rnd() * 2 - 1) * rot * intensity * falloff,
      scaleX: 1 + smear * 0.05 * falloff,
      scaleY: 1 - smear * 0.012 * falloff,
      duration: dur / steps,
      ease: "none"
    });
  }
  keyframes.push({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, duration: 0.001, ease: "none" });

  tl.set(target, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, transformOrigin: "50% 50%" }, 0);
  tl.to(target, { keyframes: keyframes }, meta.start);
};
