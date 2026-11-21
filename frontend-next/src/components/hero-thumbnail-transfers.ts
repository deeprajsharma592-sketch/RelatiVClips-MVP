export function animateHeroThumbnails(hero: HTMLElement, flightClass: string) {
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const layer = hero.querySelector<HTMLElement>("[data-thumbnail-layer]");
  if (!layer) return;
  const sources = Array.from(hero.querySelectorAll<HTMLImageElement>("[data-orbit-thumbnail]"));
  const flights = new Map<HTMLElement, () => void>();
  const slots = ["headline", "speed"];
  let cycle = 0;
  let interval: number | undefined;
  let stagger: number | undefined;

  function fly(name: string, hold: number) {
    const slot = hero.querySelector<HTMLElement>(`[data-thumbnail-slot="${name}"]`);
    if (!slot || flights.has(slot) || flights.size >= 2 || motion.matches || document.hidden) return;

    const destination = slot.getBoundingClientRect();
    if (!destination.width || !destination.height) return;
    const nearby = sources
      .filter((card) => !card.hasAttribute("data-in-flight") && card.complete && card.naturalWidth > 0)
      .map((card) => {
        const bounds = card.getBoundingClientRect();
        const distance = Math.hypot(
          bounds.left + bounds.width / 2 - destination.left - destination.width / 2,
          bounds.top + bounds.height / 2 - destination.top - destination.height / 2,
        );
        return { card, bounds, distance };
      })
      .sort((a, b) => a.distance - b.distance);
    const source = nearby[0];
    if (!source || !layer) return;

    const { card, bounds } = source;
    const thumb = document.createElement("img");
    const root = layer.getBoundingClientRect();
    const ringStyle = getComputedStyle(card);
    thumb.src = card.currentSrc;
    thumb.alt = "";
    thumb.className = flightClass;
    Object.assign(thumb.style, {
      left: `${destination.left - root.left}px`,
      top: `${destination.top - root.top}px`,
      width: `${destination.width}px`,
      height: `${destination.height}px`,
    });
    const featured = { transform: "rotate(-6deg)", filter: "blur(0px) brightness(1)", opacity: 1 };
    const wheelFrame = (rect: DOMRect) => ({
      transform: `translate(${rect.left - destination.left}px, ${rect.top - destination.top}px) scale(${rect.width / destination.width}, ${rect.height / destination.height})`,
      filter: ringStyle.filter,
      opacity: ringStyle.opacity,
    });

    layer.append(thumb);
    let holdTimer: number | undefined;
    let animation = thumb.animate([wheelFrame(bounds), featured], {
      duration: 620, easing: "cubic-bezier(.22,.78,.24,1)", fill: "forwards",
    });
    card.setAttribute("data-in-flight", "");
    const restore = () => {
      window.clearTimeout(holdTimer);
      animation.cancel();
      thumb.remove();
      card.removeAttribute("data-in-flight");
      flights.delete(slot);
    };
    flights.set(slot, restore);
    animation.onfinish = () => {
      holdTimer = window.setTimeout(() => {
        const destinationFrame = wheelFrame(card.getBoundingClientRect());
        animation = thumb.animate([featured, destinationFrame], {
          duration: 360, easing: "ease-in-out", fill: "forwards",
        });
        animation.onfinish = restore;
      }, hold);
    };
  }

  function featureNext() {
    const index = cycle++ % slots.length;
    fly(slots[index], 1450);
    if (cycle % 3 === 0) {
      stagger = window.setTimeout(() => fly(slots[1 - index], 1100), 250);
    }
  }

  function restoreAll() {
    window.clearTimeout(stagger);
    for (const restore of flights.values()) restore();
  }

  function schedule() {
    window.clearInterval(interval);
    restoreAll();
    if (!motion.matches && !document.hidden) {
      interval = window.setInterval(featureNext, 3200);
    }
  }

  const shatter = () => fly("shatter", 270);
  schedule();
  hero.addEventListener("hero-phrase-shatter", shatter);
  motion.addEventListener("change", schedule);
  document.addEventListener("visibilitychange", schedule);
  window.addEventListener("resize", restoreAll);
  return () => {
    window.clearInterval(interval);
    restoreAll();
    hero.removeEventListener("hero-phrase-shatter", shatter);
    motion.removeEventListener("change", schedule);
    document.removeEventListener("visibilitychange", schedule);
    window.removeEventListener("resize", restoreAll);
  };
}
