export function animateHeroThumbnails(hero: HTMLElement, flightClass: string) {
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const layer = hero.querySelector<HTMLElement>("[data-thumbnail-layer]");
  if (!layer) return;
  const sources = Array.from(hero.querySelectorAll<HTMLImageElement>("[data-orbit-thumbnail]"));
  const flights = new Map<HTMLElement, { restore: () => void; returnToRing: (duration: number) => void }>();
  const slots = ["opening", "speed", "headline", "speed"];
  let cycle = 0;
  let interval: number | undefined;
  let stagger: number | undefined;

  function fly(name: string, hold: number) {
    const slot = hero.querySelector<HTMLElement>(`[data-thumbnail-slot="${name}"]`);
    if (!slot || flights.has(slot) || flights.size >= 2 || motion.matches || document.hidden) return;

    if (!slot.getBoundingClientRect().height) return;
    slot.setAttribute("data-open", "");
    const openBounds = slot.getBoundingClientRect();
    const inset = openBounds.width * 0.13;
    const destination = new DOMRect(openBounds.left + inset, openBounds.top, openBounds.width - 2 * inset, openBounds.height);
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
    if (!source || !layer || !destination.width) {
      slot.removeAttribute("data-open");
      return;
    }

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

    const openWidth = getComputedStyle(slot).width;
    let spacing = slot.animate([{ width: "0px" }, { width: openWidth }], {
      duration: 460, delay: 125, easing: "cubic-bezier(.22,.78,.24,1)", fill: "backwards",
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
      spacing.cancel();
      slot.removeAttribute("data-open");
      thumb.remove();
      card.removeAttribute("data-in-flight");
      flights.delete(slot);
    };
    const returnToRing = (duration: number) => {
      window.clearTimeout(holdTimer);
      if (slot.hasAttribute("data-open")) {
        const currentWidth = getComputedStyle(slot).width;
        spacing.cancel();
        slot.removeAttribute("data-open");
        spacing = slot.animate([{ width: currentWidth }, { width: "0px" }], {
          duration, easing: "ease-in-out",
        });
      }
      const style = getComputedStyle(thumb);
      const currentFrame = { transform: style.transform, opacity: style.opacity, filter: style.filter };
      animation.cancel();
      animation = thumb.animate([currentFrame, wheelFrame(card.getBoundingClientRect())], {
        duration, easing: "ease-in-out", fill: "forwards",
      });
      animation.onfinish = restore;
    };
    flights.set(slot, { restore, returnToRing });
    animation.onfinish = () => {
      holdTimer = window.setTimeout(() => returnToRing(360), hold);
    };
  }

  function featureNext() {
    const slot = slots[cycle++ % slots.length];
    fly(slot, 1450);
    if (slot !== "speed" && cycle % slots.length === 3) {
      stagger = window.setTimeout(() => fly("speed", 1100), 250);
    }
  }

  function restoreAll() {
    window.clearTimeout(stagger);
    for (const flight of flights.values()) flight.restore();
  }

  function schedule() {
    window.clearInterval(interval);
    restoreAll();
    if (!motion.matches && !document.hidden) {
      interval = window.setInterval(featureNext, 3200);
    }
  }

  const phraseSlot = hero.querySelector<HTMLElement>('[data-thumbnail-slot="shatter"]');
  const shatter = () => {
    if (phraseSlot) flights.get(phraseSlot)?.returnToRing(180);
  };
  const settled = () => fly("shatter", 1050);
  schedule();
  hero.addEventListener("hero-phrase-shatter", shatter);
  hero.addEventListener("hero-phrase-settled", settled);
  motion.addEventListener("change", schedule);
  document.addEventListener("visibilitychange", schedule);
  window.addEventListener("resize", restoreAll);
  return () => {
    window.clearInterval(interval);
    restoreAll();
    hero.removeEventListener("hero-phrase-shatter", shatter);
    hero.removeEventListener("hero-phrase-settled", settled);
    motion.removeEventListener("change", schedule);
    document.removeEventListener("visibilitychange", schedule);
    window.removeEventListener("resize", restoreAll);
  };
}
