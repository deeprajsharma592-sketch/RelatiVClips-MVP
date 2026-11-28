// sfx — no visual animation. Timing, gain and fades are declarative attributes
// on the <audio> element; the file itself is loudness-normalised at compose time.
window.HF_BLOCKS = window.HF_BLOCKS || {};
window.HF_BLOCKS.sfx = function (tl, id, p, meta) {
  // Intentionally empty: the mix reads data-start / data-duration / data-volume.
  return;
};
