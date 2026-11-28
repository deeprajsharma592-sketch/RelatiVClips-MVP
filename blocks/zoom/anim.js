// zoom — punch-in on the source footage.
// Quick push, hold, ease back so the effect lands on the word and releases.
window.HF_BLOCKS = window.HF_BLOCKS || {};
window.HF_BLOCKS.zoom = function (tl, id, p, meta) {
  var target = meta.source;
  var start = meta.start;
  var end = meta.start + Math.max(0.2, meta.duration);
  var scale = p.scale == null ? 1.12 : p.scale;
  var ease = p.easing || "power2.out";
  var hold = p.hold == null ? 0.6 : p.hold;
  var origins = {
    center: "50% 50%",
    top: "50% 18%",
    bottom: "50% 82%",
    left: "18% 50%",
    right: "82% 50%"
  };
  var inDur = Math.min(0.34, Math.max(0.12, (end - start) * 0.45));
  var outDur = Math.min(0.32, Math.max(0.1, (end - start) * 0.35));
  var outStart = Math.min(end - outDur, Math.max(start + inDur, start + hold));

  tl.set(target, { transformOrigin: origins[p.origin] || origins.center }, 0);
  tl.fromTo(target, { scale: 1 }, { scale: scale, duration: inDur, ease: ease }, start);
  tl.to(target, { scale: 1, duration: outDur, ease: "power2.inOut" }, Math.max(outStart, start + inDur));
};
