// popup — image/meme popup with enter and exit motion.
window.HF_BLOCKS = window.HF_BLOCKS || {};
window.HF_BLOCKS.popup = function (tl, id, p, meta) {
  var inner = "#" + id + "-in";
  var start = meta.start;
  var end = meta.start + Math.max(0.2, meta.duration);
  var enter = p.enter || "pop";
  var exit = p.exit || "fade";
  var inDur = Math.min(0.28, (end - start) * 0.35);
  var outDur = Math.min(0.22, (end - start) * 0.3);

  if (enter === "pop") {
    tl.fromTo(
      inner,
      { scale: 0.25, opacity: 0, rotation: -7 },
      { scale: 1, opacity: 1, rotation: 0, duration: inDur, ease: "back.out(2.4)" },
      start
    );
  } else if (enter === "slide") {
    tl.fromTo(
      inner,
      { y: 110, opacity: 0 },
      { y: 0, opacity: 1, duration: inDur, ease: "power3.out" },
      start
    );
  } else {
    tl.fromTo(inner, { opacity: 0 }, { opacity: 1, duration: inDur, ease: "power1.out" }, start);
  }

  var outAt = Math.max(start + inDur, end - outDur);
  if (exit === "pop") {
    tl.to(inner, { scale: 0.4, opacity: 0, duration: outDur, ease: "back.in(1.7)" }, outAt);
  } else if (exit === "slide") {
    tl.to(inner, { y: 90, opacity: 0, duration: outDur, ease: "power2.in" }, outAt);
  } else {
    tl.to(inner, { opacity: 0, duration: outDur, ease: "none" }, outAt);
  }
};
