const posters = [
  { title: "Our Work", color: "#f183a7", intro: "See what a long recording can become.", items: ["Find the standout moments", "Frame them for vertical video", "Export clips with captions"], href: "/blog", link: "Explore examples" },
  { title: "Services", color: "#91dbd7", intro: "Turn source footage into clips ready for your next post.", items: ["AI clip selection", "Automatic reframing", "Editable captions"], href: "/services", link: "Explore the engine" },
  { title: "Pricing", color: "#badb64", intro: "Choose a plan for the amount of footage you work with.", items: ["RelatiV Go", "Pro Studio", "RelatiV Max"], href: "/plans", link: "View plans" },
  { title: "Think Big", color: "#badb64", intro: "Build a repeatable workflow for the clips you want to share.", items: ["Start with your footage", "Review your clips in Studio", "Share the cuts you like"], href: "/about", link: "About RelatiV" },
];

export function mountTowerPosters(root, canvas, signal, onClose, interactiveLinks) {
  const panel = document.createElement("dialog");
  panel.className = "tower-poster-panel";
  panel.innerHTML = '<img class="tower-poster-skin" alt=""><div class="tower-poster-copy"><button type="button" aria-label="Return to tower">×</button><p>RelatiV</p><h2></h2><p></p><ul></ul><a></a></div>';
  root.append(panel);
  const skin = panel.querySelector("img");
  const copy = panel.querySelector(".tower-poster-copy");
  const close = copy.querySelector("button");
  const heading = copy.querySelector("h2");
  heading.id = "studio-tower-poster-heading";
  panel.setAttribute("aria-labelledby", heading.id);
  const intro = copy.querySelector("h2 + p");
  const list = copy.querySelector("ul");
  const link = copy.querySelector("a");
  link.hidden = !interactiveLinks;
  let animations = [];
  let active = false;
  let returning = false;

  async function dismiss() {
    if (!active || returning) return;
    returning = true;
    animations.forEach((animation) => animation.reverse());
    await Promise.allSettled(animations.map((animation) => animation.finished));
    if (signal.aborted) return;
    animations.forEach((animation) => animation.cancel());
    panel.close();
    active = false;
    returning = false;
    onClose();
    canvas.focus({ preventScroll: true });
  }

  close.addEventListener("click", dismiss, { signal });
  panel.addEventListener("cancel", (event) => {
    event.preventDefault();
    void dismiss();
  }, { signal });
  panel.addEventListener("click", (event) => {
    if (event.target !== panel) return;
    const bounds = panel.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) void dismiss();
  }, { signal });
  signal.addEventListener("abort", () => {
    animations.forEach((animation) => animation.cancel());
    panel.remove();
  }, { once: true });

  return {
    get active() { return active; },
    get cameraProgress() {
      const time = animations[0]?.currentTime ?? 0;
      const progress = Math.max(0, Math.min(1, (time - 85) / 630));
      return progress * progress * (3 - 2 * progress);
    },
    open(index, source, texture, reducedMotion) {
      if (active) return;
      const item = posters[index];
      active = true;
      heading.textContent = item.title;
      intro.textContent = item.intro;
      list.replaceChildren(...item.items.map((text) => {
        const li = document.createElement("li");
        li.textContent = text;
        return li;
      }));
      link.href = item.href;
      link.textContent = item.link;
      skin.src = "data:image/jpeg;base64," + texture;
      panel.style.setProperty("--poster-color", item.color);
      const host = root.getBoundingClientRect();
      const viewport = document.documentElement;
      const width = Math.min(host.width * .86, viewport.clientWidth - 24, 680);
      const height = Math.min(host.height * .8, viewport.clientHeight - 24, 510);
      const left = Math.max(12, Math.min(viewport.clientWidth - width - 12, host.left + host.width * .56 - width / 2));
      const top = Math.max(12, Math.min(viewport.clientHeight - height - 12, host.top + (host.height - height) / 2));
      Object.assign(panel.style, { left: left + "px", top: top + "px", width: width + "px", height: height + "px" });
      panel.showModal();
      const transform = (x, y, sx, sy, turn, bank = 0) =>
        `translate(${x}px,${y}px) perspective(720px) rotateY(${turn}deg) rotate(${bank}deg) scale(${sx},${sy})`;
      const x = source.left - left, y = source.top - top;
      const sx = source.width / width, sy = source.height / height;
      const timing = { duration: reducedMotion ? 1 : 940, fill: "both" };
      animations = [
        panel.animate([
          { transform: transform(x, y, sx, sy, source.tilt), offset: 0, easing: "ease-out" },
          { transform: transform(x + 20, y - 42, sx * 1.12, sy * 1.12, 12, -7), offset: .22 },
          { transform: transform(width * .37, height * .23, sx, sy, 165), offset: .46 },
          { transform: transform(width * .31, height * .22, sx, sy, 360), offset: .6, easing: "cubic-bezier(.17,.8,.24,1)" },
          { transform: transform(0, 0, 1, 1, 360), offset: 1 },
        ], timing),
        skin.animate([{ opacity: 1 }, { opacity: 1, offset: .28 }, { opacity: 0, offset: .46 }, { opacity: 0 }], timing),
        copy.animate([{ opacity: 0 }, { opacity: 0, offset: .72 }, { opacity: 1 }], timing),
      ];
      close.focus({ preventScroll: true });
    },
  };
}
