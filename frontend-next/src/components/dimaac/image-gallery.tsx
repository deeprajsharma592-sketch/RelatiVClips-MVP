"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") gsap.registerPlugin(Draggable, InertiaPlugin, MotionPathPlugin, useGSAP);

// A ring of photos you can spin. Every photo sits on an invisible circle (MotionPath puts it there
// and turns it to follow the curve), and the whole ring is one element, so spinning it is a single
// rotation. Drag it and let go: InertiaPlugin throws it and it slows down by itself. It also turns
// with the arrow keys, with a sideways trackpad swipe, and slowly on its own while nobody touches it.

export type GalleryImage = {
  /** The image address. */
  src: string;
  /** What the picture shows, for screen readers. */
  alt: string;
};

export type ImageGalleryProps = {
  /** The photos, placed around the ring in this order. Six to twelve look best. */
  images: GalleryImage[];
  /** How big the ring is, as a percentage of the smaller side of the box. */
  ringSize?: number;
  /** How big the photos are. 1 is as big as they can be without touching, above 1 they overlap like a fan. */
  tileScale?: number;
  /** The shape of each photo: square, portrait (4:5) or landscape (4:3). */
  tileShape?: "square" | "portrait" | "landscape";
  /** Corner radius of each photo, in pixels. */
  radius?: number;
  /** "ring" turns every photo with the ring, heads outward. "upright" keeps each photo level while the ring turns. */
  tileMode?: "ring" | "upright";
  /** Idle spin in degrees per second. 0 keeps the ring still until touched. Negative spins the other way. */
  autoSpin?: number;
  /** Stop the idle spin while a mouse pointer is over one of the photos. */
  pauseOnHover?: boolean;
  /** What the mouse wheel does: "horizontal" turns on a sideways swipe only (the page still scrolls), "always" turns on any wheel movement and traps the page scroll, "off" ignores the wheel. */
  wheel?: "horizontal" | "always" | "off";
  /** After a drag or a key press, come to rest with a photo exactly at the top. */
  snap?: boolean;
  /** On touch screens, let an up or down swipe scroll the page. Turn off if the gallery is the whole screen. */
  touchScroll?: boolean;
  /** Spin the ring in when it appears. */
  intro?: boolean;
  /** The size in pixels the image tags are given as width and height. Set it to the real size of your files. */
  imageSize?: number;
  /** The size of the drawing area of the circle the photos are placed on. Only its shape matters, so leave it at 400. */
  circleSize?: number;
  /** The accessible name of the gallery. */
  label?: string;
  /** Extra classes for the outer box. Give it a size (it fills it). */
  className?: string;
};

// How much taller than wide each shape is
const SHAPES = { square: 1, portrait: 1.25, landscape: 0.75 } as const;

// Width of one photo as a percentage of the ring's box. At a tileScale of 1 the photos just touch
// their neighbours at their inner edge (the inner edge is the tight side: the circle is smaller
// there). A bigger scale lets them overlap like a fan. It is shrunk if a photo would poke out
// past the edge of the box.
function tileWidth(count: number, ringSize: number, tileScale: number, ratio: number, upright: boolean) {
  // The gap between two neighbours on a circle of radius 1 is 2 * sin(PI / count)
  const around = count < 3 ? 0.5 : Math.min(Math.sin(Math.PI / count), 0.55);
  const fit = upright ? ringSize * around * 0.78 : (ringSize * around * 0.96) / (1 + around * ratio);
  let width = fit * tileScale;
  const reach = upright ? Math.hypot(width, width * ratio) / 2 : (width * ratio) / 2;
  const available = 49 - ringSize / 2;
  // Never shrink below 55% of the wanted size, so the photo size control always does something
  if (reach > available) width *= Math.max(available / reach, 0.55);
  return Math.max(width, 3);
}

export function ImageGallery({
  images,
  ringSize = 74,
  tileScale = 1,
  tileShape = "portrait",
  radius = 10,
  tileMode = "ring",
  autoSpin = 5,
  pauseOnHover = true,
  wheel = "horizontal",
  snap = false,
  touchScroll = true,
  intro = true,
  imageSize = 400,
  circleSize = 400,
  label = "Image gallery",
  className = "",
}: ImageGalleryProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const tileRefs = useRef<(HTMLDivElement | null)[]>([]);
  const count = images.length;
  const upright = tileMode === "upright";
  const ratio = SHAPES[tileShape];
  const width = tileWidth(count, ringSize, tileScale, ratio, upright);

  // Read on every frame or event, so changing them doesn't rebuild anything
  const live = useRef({ autoSpin, pauseOnHover, wheel });
  live.current = { autoSpin, pauseOnHover, wheel };
  // Where the ring is turned to, kept so a control change (which rebuilds the ring) doesn't snap it back to 0
  const savedRotation = useRef(0);

  // 1. Put every photo on the circle. Runs again when the layout changes or the box is resized,
  //    because MotionPath turns the circle into pixel positions.
  useGSAP(
    () => {
      const ring = ringRef.current;
      const path = pathRef.current;
      const tiles = tileRefs.current.slice(0, count).filter((tile): tile is HTMLDivElement => tile !== null);
      if (!ring || !path || tiles.length === 0) return;

      const place = () => {
        tiles.forEach((tile, index) => {
          gsap.set(tile, { x: 0, y: 0 });
          gsap.set(tile, {
            motionPath: {
              path,
              align: path,
              alignOrigin: [0.5, 0.5],
              // The circle starts at 3 o'clock; +0.75 puts the first photo at 12 o'clock
              start: 0,
              end: (index / tiles.length + 0.75) % 1,
              autoRotate: !upright,
            },
            visibility: "visible",
          });
        });
      };
      place();

      let lastWidth = ring.offsetWidth;
      const resize = new ResizeObserver(() => {
        if (Math.abs(ring.offsetWidth - lastWidth) < 0.5) return;
        lastWidth = ring.offsetWidth;
        place();
      });
      resize.observe(ring);
      return () => resize.disconnect();
    },
    { scope: rootRef, dependencies: [count, ringSize, tileScale, tileShape, tileMode, circleSize], revertOnUpdate: true },
  );

  // 2. Make the ring turn: drag with inertia, wheel, arrow keys and the idle spin
  useGSAP(
    () => {
      const root = rootRef.current;
      const ring = ringRef.current;
      const tiles = tileRefs.current.slice(0, count).filter((tile): tile is HTMLDivElement => tile !== null);
      if (!root || !ring || count === 0) return;

      const mm = gsap.matchMedia();
      mm.add({ reduce: "(prefers-reduced-motion: reduce)", normal: "(prefers-reduced-motion: no-preference)" }, (context) => {
        const reduce = Boolean(context.conditions?.reduce);
        const step = 360 / count;
        const setRotation = gsap.quickSetter(ring, "rotation", "deg");
        const setTileRotations = tiles.map((tile) => gsap.quickSetter(tile, "rotation", "deg"));
        // Carry the turn over from before the rebuild
        setRotation(savedRotation.current);

        let pressed = false;
        let hovering = false;
        let onScreen = true;
        let idleSeconds = 0;
        // Where a wheel or key turn is heading, so quick repeats add up instead of restarting
        let heading: number | null = null;
        let lastRotation = Number.NaN;

        const rotationNow = () => Number(gsap.getProperty(ring, "rotation"));

        // In "upright" mode every photo turns the opposite way to the ring, so it stays level
        const keepUpright = () => {
          const rotation = rotationNow();
          savedRotation.current = rotation;
          if (!upright) return;
          if (rotation === lastRotation) return;
          lastRotation = rotation;
          setTileRotations.forEach((set) => set(-rotation));
        };
        keepUpright();

        const turnTo = (rotation: number) => {
          heading = rotation;
          if (reduce) {
            gsap.killTweensOf(ring);
            setRotation(rotation);
            heading = null;
            keepUpright();
            return;
          }
          gsap.to(ring, {
            rotation,
            duration: 0.8,
            ease: "power3.out",
            overwrite: true,
            onUpdate: keepUpright,
            onComplete: () => {
              heading = null;
            },
          });
        };
        const turnBy = (degrees: number) => turnTo((heading ?? rotationNow()) + degrees);

        const drag = Draggable.create(ring, {
          type: "rotation",
          // Dragging works from anywhere in the box, not only on the ring's own square
          trigger: root,
          inertia: !reduce,
          snap: snap ? (value: number) => Math.round(value / step) * step : undefined,
          cursor: "grab",
          activeCursor: "grabbing",
          zIndexBoost: false,
          onPress: () => {
            pressed = true;
            heading = null;
            gsap.killTweensOf(ring);
          },
          onRelease: () => {
            pressed = false;
          },
          onDrag: keepUpright,
          onThrowUpdate: keepUpright,
        })[0];
        if (!drag) return;
        // Draggable switches touch scrolling off for rotation. Hand the up and down swipe back to
        // the page, so only a sideways swipe turns the ring.
        if (touchScroll) root.style.touchAction = "pan-y";

        const onWheel = (event: WheelEvent) => {
          const mode = live.current.wheel;
          if (mode === "off" || pressed) return;
          const sideways = Math.abs(event.deltaX) > Math.abs(event.deltaY);
          // In the default mode a plain vertical wheel is left alone, so the page can scroll past
          if (mode === "horizontal" && !sideways) return;
          event.preventDefault();
          turnBy((sideways ? event.deltaX : event.deltaY) * 0.4);
        };

        const onKeyDown = (event: KeyboardEvent) => {
          const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
          const back = event.key === "ArrowLeft" || event.key === "ArrowUp";
          if (!forward && !back) return;
          event.preventDefault();
          // Always land on a whole step, so the arrow keys move one photo at a time
          const from = heading ?? rotationNow();
          turnTo(Math.round(from / step) * step + (forward ? step : -step));
        };

        // Hovering means a mouse pointer is over one of the photos (not the empty space around them)
        const onOver = (event: PointerEvent) => {
          hovering = event.pointerType !== "touch" && event.target instanceof Element && event.target.closest("[role=listitem]") !== null;
        };
        const onLeave = () => {
          hovering = false;
        };

        root.addEventListener("wheel", onWheel, { passive: false });
        root.addEventListener("keydown", onKeyDown);
        ring.addEventListener("pointerover", onOver);
        root.addEventListener("pointerleave", onLeave);

        const visibility = new IntersectionObserver(([entry]) => {
          onScreen = entry?.isIntersecting ?? true;
        });
        visibility.observe(root);

        // The idle spin. It waits a moment after any touch, then eases up to speed.
        const spin = (_time: number, deltaMs: number) => {
          const seconds = Math.min(deltaMs, 100) / 1000;
          const busy = pressed || drag.isThrowing || heading !== null || !onScreen || (hovering && live.current.pauseOnHover);
          if (busy) {
            idleSeconds = 0;
            return;
          }
          idleSeconds += seconds;
          const speed = live.current.autoSpin;
          if (reduce || speed === 0) return;
          const ramp = Math.min(1, Math.max(0, (idleSeconds - 0.8) / 1.5));
          setRotation(rotationNow() + speed * seconds * ramp * ramp * (3 - 2 * ramp));
          keepUpright();
        };
        gsap.ticker.add(spin);

        return () => {
          gsap.ticker.remove(spin);
          visibility.disconnect();
          root.removeEventListener("wheel", onWheel);
          root.removeEventListener("keydown", onKeyDown);
          ring.removeEventListener("pointerover", onOver);
          root.removeEventListener("pointerleave", onLeave);
          drag.kill();
          gsap.killTweensOf(ring);
        };
      });

      return () => mm.revert();
    },
    { scope: rootRef, dependencies: [count, tileMode, snap, touchScroll], revertOnUpdate: true },
  );

  // 3. The way in: the ring unwinds into place while the photos pop up one by one
  useGSAP(
    () => {
      const ring = ringRef.current;
      const tiles = tileRefs.current.slice(0, count).filter((tile): tile is HTMLDivElement => tile !== null);
      if (!intro || !ring || tiles.length === 0) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(ring, { rotation: -140, duration: 2.4, ease: "expo.out" });
        gsap.from(tiles, { scale: 0.3, opacity: 0, duration: 1.1, stagger: 0.07, ease: "back.out(1.5)" });
      });
      return () => {
        mm.revert();
        // Undoing the intro puts the ring back where it began, so hand it the turn it had
        gsap.set(ring, { rotation: savedRotation.current });
      };
    },
    { scope: rootRef, dependencies: [count, intro], revertOnUpdate: true },
  );

  const half = circleSize / 2;
  const circle = `M${circleSize},${half} A${half},${half} 0 1 1 0,${half} A${half},${half} 0 1 1 ${circleSize},${half}Z`;

  return (
    <div
      ref={rootRef}
      role="group"
      aria-roledescription="rotating gallery"
      aria-label={label}
      aria-keyshortcuts="ArrowLeft ArrowRight"
      tabIndex={0}
      className={`relative h-full w-full overflow-hidden select-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-current ${className}`}
      style={{ containerType: "size", touchAction: touchScroll ? "pan-y" : "none" }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {/* The ring: a square as big as the box allows. Rotating it turns every photo. */}
        <div ref={ringRef} role="list" className="relative shrink-0" style={{ width: "min(100cqw, 100cqh)", height: "min(100cqw, 100cqh)" }}>
          <svg
            viewBox={`0 0 ${circleSize} ${circleSize}`}
            aria-hidden="true"
            className="pointer-events-none absolute opacity-0"
            style={{ width: `${ringSize}%`, height: `${ringSize}%`, left: `${(100 - ringSize) / 2}%`, top: `${(100 - ringSize) / 2}%` }}
          >
            <path ref={pathRef} d={circle} fill="none" stroke="none" />
          </svg>

          {images.map((image, index) => (
            <div
              key={`${index}-${image.src}`}
              ref={(tile) => {
                tileRefs.current[index] = tile;
              }}
              role="listitem"
              className="group absolute top-0 left-0"
              style={{ width: `${width}%`, aspectRatio: `1 / ${ratio}`, visibility: "hidden", willChange: "transform" }}
            >
              <div
                className="h-full w-full overflow-hidden shadow-[0_18px_38px_-18px_rgba(0,0,0,0.45)] outline-1 -outline-offset-1 outline-black/10 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06] dark:outline-white/10"
                style={{ borderRadius: radius }}
              >
                <img
                  src={image.src}
                  alt={image.alt}
                  width={imageSize}
                  height={Math.round(imageSize * ratio)}
                  loading={index < 3 ? "eager" : "lazy"}
                  decoding="async"
                  draggable={false}
                  className="block h-full w-full object-cover object-[50%_25%]"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
