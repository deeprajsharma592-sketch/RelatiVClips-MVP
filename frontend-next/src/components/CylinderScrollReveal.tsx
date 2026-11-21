"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";

const EDGE_ANGLE = Math.PI / 5;

// Project onto the front arc. Ease the depth to a limit outside the
// viewport so long panels stay legible.
function project(y: number, axis: number, radius: number, halfHeight: number) {
  const distance = y - axis;
  const arcDistance = Math.max(-halfHeight, Math.min(halfHeight, distance));
  const angle = arcDistance / radius;
  const extension = distance - arcDistance;
  const boundedExtension = Math.sign(extension) * halfHeight * (1 - Math.exp(-Math.abs(extension) / halfHeight));
  return {
    y: radius * Math.sin(angle) + extension + boundedExtension * (Math.cos(angle) - 1),
    z: radius * (Math.cos(angle) - 1) - boundedExtension * Math.sin(angle),
  };
}

export function CylinderScrollScene() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    const panels = Array.from(document.querySelectorAll<HTMLElement>("[data-cylinder-panel]"));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    function clear(panel: HTMLElement) {
      panel.style.removeProperty("perspective");
      panel.style.removeProperty("perspective-origin");
      panel.querySelector<HTMLElement>(":scope > [data-cylinder-face]")?.style.removeProperty("transform");
    }

    function render() {
      frame = 0;
      const height = document.documentElement.clientHeight;
      if (reducedMotion.matches || !height) {
        panels.forEach(clear);
        return;
      }

      const halfHeight = height / 2;
      const radius = halfHeight / EDGE_ANGLE;
      const boxes = panels.map((panel) => panel.getBoundingClientRect());

      panels.forEach((panel, index) => {
        const box = boxes[index];
        const face = panel.firstElementChild as HTMLElement | null;
        if (!face || !box.height || box.bottom < -halfHeight || box.top > height + halfHeight) {
          clear(panel);
          return;
        }

        // Map both edges to the same cylinder. Adjacent sections therefore
        // meet at the same point as they roll through the shared perspective.
        const top = project(box.top, halfHeight, radius, halfHeight);
        const bottom = project(box.bottom, halfHeight, radius, halfHeight);
        const rise = bottom.y - top.y;
        const depth = bottom.z - top.z;
        const angle = Math.atan2(depth, rise);
        const scale = Math.hypot(rise, depth) / box.height;
        const y = halfHeight + (top.y + bottom.y) / 2 - (box.top + box.bottom) / 2;
        const z = (top.z + bottom.z) / 2;

        panel.style.perspective = `${height * 1.7}px`;
        panel.style.perspectiveOrigin = `50% ${halfHeight - box.top}px`;
        face.style.transform = `translate3d(0, ${y}px, ${z}px) rotateX(${angle}rad) scaleY(${scale})`;
      });
    }

    function scheduleRender() {
      if (!frame) frame = requestAnimationFrame(render);
    }

    const resize = new ResizeObserver(scheduleRender);
    panels.forEach((panel) => resize.observe(panel));
    window.addEventListener("scroll", scheduleRender, { passive: true });
    window.addEventListener("resize", scheduleRender);
    reducedMotion.addEventListener("change", scheduleRender);
    scheduleRender();

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener("scroll", scheduleRender);
      window.removeEventListener("resize", scheduleRender);
      reducedMotion.removeEventListener("change", scheduleRender);
      panels.forEach(clear);
    };
  }, [pathname]);

  return null;
}

export default function CylinderScrollReveal({ children }: { children: ReactNode }) {
  return (
    <div data-cylinder-panel className="relative">
      <div data-cylinder-face className="relative">{children}</div>
    </div>
  );
}
