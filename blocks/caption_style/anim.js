// caption_style — word-level captions from transcript timings.
// Every group is a timed .clip; only its inner wrapper is tweened (contract rule 5).
window.HF_BLOCKS = window.HF_BLOCKS || {};
window.HF_BLOCKS.caption_style = function (tl, id, p, meta) {
  var groups = meta.groups || [];
  var base = "#F5F5F5";
  var hot = p.highlight_color || "#FFE45E";
  var inDur = 0.16;
  var outDur = 0.1;

  groups.forEach(function (g) {
    var inner = "#" + g.id + "-in";
    var start = g.start;
    var end = g.start + g.duration;
    var slide = p.style === "podcast" ? 10 : 22;

    tl.fromTo(
      inner,
      { opacity: 0, y: slide, scale: p.style === "podcast" ? 1 : 0.92 },
      { opacity: 1, y: 0, scale: 1, duration: inDur, ease: "back.out(1.7)" },
      start
    );
    tl.to(inner, { opacity: 0, duration: outDur, ease: "none" }, Math.max(start + inDur, end - outDur));

    (g.words || []).forEach(function (w) {
      var sel = "#" + w.id;
      tl.fromTo(sel, { color: base }, { color: hot, duration: 0.06, ease: "none" }, w.start);
      tl.to(sel, { color: base, duration: 0.06, ease: "none" }, Math.max(w.start + 0.06, w.end - 0.06));
    });
  });
};
