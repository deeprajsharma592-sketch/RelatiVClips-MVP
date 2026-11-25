import fs from "node:fs";
import path from "node:path";
import { validateAndNormalizeEdl } from "./edl-validator.mjs";
import { COMPONENT_VARIANTS } from "./components/variants.mjs";

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Compile a validated EDL into a self-contained 1080x1920 HyperFrames HTML composition.
 * @param {object} rawEdl
 * @param {{ videoSrc?: string, transparent?: boolean, compositionId?: string }} [opts]
 * @returns {{ html: string, edl: object }}
 */
export function buildHyperframesHtml(rawEdl, opts = {}) {
  const edl = validateAndNormalizeEdl(rawEdl);
  const compositionId = opts.compositionId || "main";
  const transparent = opts.transparent ?? false;
  const videoSrc = opts.videoSrc || "";

  const elements = [];
  const tlOps = [];

  edl.beats.forEach((beat, idx) => {
    const id = `beat-${idx}`;
    const v = COMPONENT_VARIANTS[beat.type]?.[beat.variant || "A"];
    const dur = Math.max(0.12, Number((beat.end - beat.start).toFixed(3)));
    const start = beat.start;

    if (beat.type === "punchy_bounce") {
      const style =
        beat.variant === "B"
          ? `background:${v.bg};border:${v.border};padding:14px 28px;border-radius:18px;backdrop-filter:blur(10px);`
          : beat.variant === "C"
            ? `text-shadow:${v.shadow};text-transform:uppercase;`
            : `-webkit-text-stroke:${v.stroke};text-shadow:0 8px 24px rgba(0,0,0,0.65);`;
      elements.push(
        `<div id="${id}" class="clip caption-box" data-start="${start}" data-duration="${dur}" data-track-index="2" style="font-family:${v.font};font-size:${v.fontSize}px;color:${v.color};${style}">${esc(beat.text || "HOOK")}</div>`
      );
      tlOps.push(
        `tl.fromTo("#${id}", ${JSON.stringify({ ...v.from })}, ${JSON.stringify({ ...v.to, duration: v.duration, ease: v.ease })}, ${start});`,
        `tl.to("#${id}", { opacity: 0, duration: 0.08 }, ${Math.max(start, beat.end - 0.08)});`
      );
    } else if (beat.type === "highlight_word") {
      const words = (beat.words || (beat.text ? beat.text.split(/\s+/) : ["HIGHLIGHT"]));
      const activeIdx = Number(beat.activeIndex ?? 0);
      const spans = words
        .map((w, wi) => {
          if (wi !== activeIdx) return `<span style="color:${v.baseColor};margin:0 8px;">${esc(w)}</span>`;
          if (beat.variant === "A") {
            return `<span class="hw-active" style="background:${v.activeBg};color:${v.activeColor};padding:4px 16px;border-radius:12px;margin:0 6px;display:inline-block;">${esc(w)}</span>`;
          }
          if (beat.variant === "B") {
            return `<span class="hw-active" style="color:${v.activeColor};border-bottom:6px solid #4967E8;padding-bottom:4px;margin:0 8px;display:inline-block;">${esc(w)}</span>`;
          }
          return `<span class="hw-active" style="color:${v.activeColor};text-shadow:${v.glow};margin:0 8px;display:inline-block;">${esc(w)}</span>`;
        })
        .join("");
      elements.push(
        `<div id="${id}" class="clip caption-box" data-start="${start}" data-duration="${dur}" data-track-index="2" style="font-family:${v.font};font-size:${v.fontSize}px;">${spans}</div>`
      );
      tlOps.push(
        `tl.fromTo("#${id}", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: ${v.duration}, ease: "${v.ease}" }, ${start});`,
        `tl.fromTo("#${id} .hw-active", { scale: 0.88 }, { scale: 1.08, duration: ${v.duration}, ease: "${v.ease}" }, ${start});`,
        `tl.to("#${id}", { opacity: 0, duration: 0.08 }, ${Math.max(start, beat.end - 0.08)});`
      );
    } else if (beat.type === "zoom_punch") {
      const scale = Number(beat.params?.scale ?? v.scale);
      tlOps.push(
        `tl.to("#stage", { scale: ${scale}, rotation: ${v.rotation}, duration: ${v.inDur}, ease: "${v.easeIn}" }, ${start});`,
        `tl.to("#stage", { scale: 1, rotation: 0, duration: ${v.outDur}, ease: "${v.easeOut}" }, ${Number((start + v.inDur + v.holdDur).toFixed(3))});`
      );
    } else if (beat.type === "shake") {
      const amp = Number(beat.params?.amplitude ?? v.amplitude);
      const steps = 6;
      const stepDur = Number((v.duration / steps).toFixed(3));
      for (let s = 0; s < steps; s++) {
        const decay = 1 - s / steps;
        const dx = Math.round((s % 2 === 0 ? 1 : -1) * amp * decay);
        const dy = v.singleAxis ? 0 : Math.round((s % 3 === 0 ? 1 : -1) * amp * 0.6 * decay);
        const rot = Number(((s % 2 === 0 ? 1 : -1) * v.rotation * decay).toFixed(2));
        tlOps.push(`tl.to("#stage", { x: ${dx}, y: ${dy}, rotation: ${rot}, duration: ${stepDur}, ease: "power1.out" }, ${Number((start + s * stepDur).toFixed(3))});`);
      }
      const resetAt = Number((start + steps * stepDur + 0.002).toFixed(3));
      tlOps.push(`tl.to("#stage", { x: 0, y: 0, rotation: 0, duration: 0.05 }, ${resetAt});`);
    } else if (beat.type === "whip_transition") {
      elements.push(
        `<div id="${id}" class="clip" data-start="${start}" data-duration="${dur}" data-track-index="4" style="position:absolute;inset:0;background:linear-gradient(90deg,transparent,${v.streakColor},transparent);opacity:0;pointer-events:none;"></div>`
      );
      if (v.axis === "flash") {
        tlOps.push(
          `tl.fromTo("#${id}", { opacity: 0 }, { opacity: 0.85, duration: ${v.durationIn}, ease: "power3.in" }, ${start});`,
          `tl.to("#${id}", { opacity: 0, duration: ${v.durationOut}, ease: "power3.out" }, ${Number((start + v.durationIn).toFixed(3))});`
        );
      } else {
        const prop = v.axis === "y" ? "y" : "x";
        tlOps.push(
          `tl.fromTo("#${id}", { opacity: 0.9, ${prop}: -1080 }, { ${prop}: 1080, opacity: 0, duration: ${v.durationIn + v.durationOut}, ease: "power4.inOut" }, ${start});`
        );
      }
    } else if (beat.type === "popup_image" || beat.type === "popup_screenshot") {
      const label = esc(beat.label || (beat.type === "popup_screenshot" ? "LIVE CHAT" : "CLIP ASSET"));
      const border = v.border || v.accentBar || "1px solid rgba(255,204,0,0.45)";
      const bg = v.bg || "rgba(17,19,24,0.85)";
      elements.push(
        `<div id="${id}" class="clip popup-card" data-start="${start}" data-duration="${dur}" data-track-index="3" style="background:${bg};border:${border};border-radius:${v.radius || 18}px;">` +
          (beat.src
            ? `<img src="${esc(beat.src)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:12px;" />`
            : `<div style="padding:28px;color:#fff;font-family:'Inter Bold',sans-serif;font-size:32px;text-align:center;">${label}</div>`) +
          `</div>`
      );
      tlOps.push(
        `tl.fromTo("#${id}", { opacity: 0, scale: 0.7, y: 24, rotation: ${v.rotation || 0} }, { opacity: 1, scale: 1, y: 0, duration: ${v.duration}, ease: "${v.ease}" }, ${start});`,
        `tl.to("#${id}", { opacity: 0, y: -16, duration: 0.14 }, ${Math.max(start, beat.end - 0.14)});`
      );
    } else if (beat.type === "emoji_reaction") {
      const emoji = esc(beat.emoji || "🔥");
      elements.push(
        `<div id="${id}" class="clip emoji-pop" data-start="${start}" data-duration="${dur}" data-track-index="3" style="font-size:${v.size}px;">${emoji}</div>`
      );
      tlOps.push(
        `tl.fromTo("#${id}", { opacity: 0, scale: 0, y: 20 }, { opacity: 1, scale: 1.15, y: -10, duration: ${v.duration}, ease: "${v.ease}" }, ${start});`,
        `tl.to("#${id}", { opacity: 0, y: -36, scale: 0.9, duration: 0.18 }, ${Math.max(start, beat.end - 0.18)});`
      );
    } else if (beat.type === "lower_third") {
      elements.push(
        `<div id="${id}" class="clip lower-third" data-start="${start}" data-duration="${dur}" data-track-index="3" style="background:${v.bg};border-left:5px solid ${v.accent};font-family:${v.font};">` +
          `<div style="font-size:32px;color:#fff;font-weight:800;">${esc(beat.title || "LIVESTREAM MOMENT")}</div>` +
          `<div style="font-size:20px;color:#FFCC00;font-family:monospace;margin-top:4px;">${esc(beat.subtitle || "@relativclips")}</div>` +
          `</div>`
      );
      tlOps.push(
        `tl.fromTo("#${id}", { opacity: 0, x: -48 }, { opacity: 1, x: 0, duration: ${v.duration}, ease: "${v.ease}" }, ${start});`,
        `tl.to("#${id}", { opacity: 0, x: -24, duration: 0.15 }, ${Math.max(start, beat.end - 0.15)});`
      );
    } else if (beat.type === "callback_flash") {
      elements.push(
        `<div id="${id}" class="clip callback-flash" data-start="${start}" data-duration="${dur}" data-track-index="4" style="background:${v.flashColor};">` +
          `<span style="position:absolute;top:110px;right:64px;padding:10px 20px;border-radius:999px;background:#111318;border:2px solid ${v.badgeColor};color:${v.badgeColor};font-family:monospace;font-size:24px;font-weight:700;">${v.badge}</span>` +
          `</div>`
      );
      tlOps.push(
        `tl.fromTo("#${id}", { opacity: 0 }, { opacity: 1, duration: ${v.flashDur}, ease: "power4.out" }, ${start});`,
        `tl.to("#stage", { scale: ${v.scale}, duration: ${v.flashDur}, ease: "power2.out" }, ${start});`,
        `tl.to("#${id}", { opacity: 0, duration: 0.16 }, ${Math.max(start, beat.end - 0.16)});`,
        `tl.to("#stage", { scale: 1, duration: 0.16 }, ${Math.max(start, beat.end - 0.16)});`
      );
    }
  });

  const bgCss = transparent ? "transparent" : "#0C0A09";
  const stageContent = videoSrc
    ? `<video src="${esc(videoSrc)}" data-start="0" data-duration="${edl.duration}" style="width:100%;height:100%;object-fit:cover;"></video>`
    : `<div class="demo-bg"></div>`;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=1080, height=1920" />
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 1080px; height: 1920px; overflow: hidden; background: ${bgCss}; }
    #root { position: relative; width: 1080px; height: 1920px; overflow: hidden; }
    #stage { position: absolute; inset: 0; transform-origin: 50% 42%; }
    .demo-bg {
      width: 100%; height: 100%;
      background: radial-gradient(circle at 50% 35%, rgba(73,103,232,0.28), rgba(17,19,24,0.96) 65%), #0C0A09;
    }
    .caption-box {
      position: absolute; left: 72px; right: 72px; bottom: 340px;
      text-align: center; line-height: 1.15; z-index: 20; opacity: 0;
    }
    .popup-card {
      position: absolute; top: 260px; left: 50%; transform: translateX(-50%);
      width: 680px; min-height: 220px; display: flex; align-items: center; justify-content: center;
      z-index: 15; opacity: 0;
    }
    .emoji-pop { position: absolute; top: 520px; right: 110px; z-index: 25; opacity: 0; }
    .lower-third {
      position: absolute; left: 64px; bottom: 180px; padding: 20px 28px;
      border-radius: 14px; backdrop-filter: blur(12px); z-index: 18; opacity: 0;
    }
    .callback-flash { position: absolute; inset: 0; pointer-events: none; z-index: 30; opacity: 0; }
  </style>
</head>
<body>
  <div id="root" data-composition-id="${compositionId}" data-start="0" data-duration="${edl.duration}" data-width="1080" data-height="1920">
    <div id="stage" class="clip" data-start="0" data-duration="${edl.duration}" data-track-index="0">
      ${stageContent}
    </div>
    ${elements.join("\n    ")}
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    ${tlOps.join("\n    ")}
    window.__timelines = window.__timelines || {};
    window.__timelines["${compositionId}"] = tl;
    tl.seek(0);
  </script>
</body>
</html>`;

  return { html, edl };
}

if (process.argv[1] && process.argv[1].endsWith("builder.mjs") && process.argv[2]) {
  const edlPath = path.resolve(process.argv[2]);
  const outPath = path.resolve(process.argv[3] || "index.html");
  const raw = JSON.parse(fs.readFileSync(edlPath, "utf8"));
  const { html, edl } = buildHyperframesHtml(raw);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html, "utf8");
  console.log(`Built ${outPath} (${edl.beats.length} beats, ${edl.warnings.length} warnings)`);
}
