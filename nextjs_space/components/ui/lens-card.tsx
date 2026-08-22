"use client";

import * as React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/* Lens Card — from Motiq (https://motiq.dev/components/lens-card).
   MIT licensed. */

const MOTIQ_TOKENS =
  '@layer motiq{:root{--motiq-accent:#315fea;--motiq-accent-text:#244fd1;--motiq-bg:#f7f9fc;--motiq-border:#dce4ef;--motiq-border-strong:#c5d1e1;--motiq-fg:#101828;--motiq-fg-secondary:#344054;--motiq-muted:#667085;--motiq-secondary-accent:#009fb3;--motiq-surface:#ffffff;--motiq-surface-2:#f8fafd}}@layer motiq{.dark,[data-theme="dark"]{--motiq-accent:#4f7cff;--motiq-accent-text:#7f9fff;--motiq-bg:#080c14;--motiq-border:#263449;--motiq-border-strong:#354863;--motiq-fg:#f8fafc;--motiq-fg-secondary:#cbd5e1;--motiq-muted:#9caabd;--motiq-secondary-accent:#22c7d9;--motiq-surface:#111827;--motiq-surface-2:#192337}}';

function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

function useVisibilityPause<T extends Element>(
  ref: React.RefObject<T | null>,
  { threshold = 0.1 }: { threshold?: number } = {}
): boolean {
  const [onScreen, setOnScreen] = React.useState(true);
  const [tabVisible, setTabVisible] = React.useState(true);

  React.useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => setOnScreen(entries.some((entry) => entry.isIntersecting)),
      { threshold }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, threshold]);

  React.useEffect(() => {
    const onVisibilityChange = () =>
      setTabVisible(document.visibilityState !== "hidden");
    onVisibilityChange();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  return onScreen && tabVisible;
}

export interface LensLag {
  stiffness: number;
  damping: number;
}

export interface LensCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  radius?: number;
  magnification?: number;
  chromatic?: number;
  lag?: LensLag;
  gridBend?: boolean;
  idleDrift?: boolean;
  showRing?: boolean;
  seed?: number;
  pauseWhenHidden?: boolean;
  reducedMotion?: boolean;
}

interface Spring {
  x: number;
  v: number;
}

const makeSpring = (x = 0): Spring => ({ x, v: 0 });

function moveSpring(
  value: Spring,
  target: number,
  stiffness: number,
  damping: number,
  delta: number
): number {
  const substeps = delta > 0.012 ? Math.ceil(delta / 0.008) : 1;
  const step = delta / substeps;
  for (let index = 0; index < substeps; index++) {
    value.v +=
      (-stiffness * (value.x - target) - damping * value.v) * step;
    value.x += value.v * step;
  }
  return value.x;
}

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

/** Belirlenimci rastgelelik: SSR sırasında Math.random kullanılmaz. */
function makeRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value =
      (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const GRID_GAP = 36;
const GRID_SEGMENT = 14;
const BEND_SIGMA = 60;
const BEND_AMPLITUDE = 16;
const RING_BOX = 208;

interface PointerState {
  x: number;
  y: number;
  inside: boolean;
}

function LensCardBase({
  children,
  radius = 104,
  magnification = 1.35,
  chromatic = 2.2,
  lag = { stiffness: 300, damping: 27 },
  gridBend = true,
  idleDrift = true,
  showRing = true,
  seed = 1,
  pauseWhenHidden = true,
  reducedMotion,
  className,
  style,
  ...props
}: LensCardProps) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const magnifiedRef = React.useRef<HTMLDivElement | null>(null);
  const magnifiedInnerRef = React.useRef<HTMLDivElement | null>(null);
  const chromaticRef = React.useRef<HTMLDivElement | null>(null);
  const chromaticInnerRef = React.useRef<HTMLDivElement | null>(null);
  const ringRef = React.useRef<HTMLDivElement | null>(null);
  const probeRef = React.useRef<HTMLSpanElement | null>(null);
  const pointerRef = React.useRef<PointerState>({
    x: -10000,
    y: -10000,
    inside: false,
  });

  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const instanceClass = `mk-lens-${uid}`;
  const systemReduced = useReducedMotion();
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => setHydrated(true), []);

  const staticMode = reducedMotion === true || (hydrated && systemReduced);
  const onScreen = useVisibilityPause(rootRef, { threshold: 0.06 });
  const paused = pauseWhenHidden && !onScreen;
  const animate = !staticMode && !paused;

  const params = React.useRef({
    radius,
    magnification,
    chromatic,
    lag,
    gridBend,
    idleDrift,
  });
  params.current = {
    radius,
    magnification,
    chromatic,
    lag,
    gridBend,
    idleDrift,
  };

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const canvas = canvasRef.current;
    const context = canvas ? canvas.getContext("2d") : null;
    let width = 1;
    let height = 1;

    const measure = () => {
      width = root.clientWidth || 1;
      height = root.clientHeight || 1;
      if (!canvas || !context) return;
      const dpr = Math.min(
        2,
        typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
      );
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    measure();

    const probeColor = (index: number): string => {
      const probe = probeRef.current;
      if (!probe || typeof window === "undefined") return "#888";
      const child = probe.children[index];
      return child ? window.getComputedStyle(child).color : "#888";
    };

    const place = (x: number, y: number, lensRadius: number) => {
      const { magnification: scale, chromatic: fringe } = params.current;
      const fringeScale = scale + 0.03;

      if (magnifiedRef.current) {
        magnifiedRef.current.style.clipPath = `circle(${lensRadius.toFixed(
          1
        )}px at ${x.toFixed(1)}px ${y.toFixed(1)}px)`;
      }
      if (magnifiedInnerRef.current) {
        magnifiedInnerRef.current.style.transform = `translate3d(${(
          (1 - scale) * x
        ).toFixed(2)}px,${((1 - scale) * y).toFixed(
          2
        )}px,0) scale(${scale})`;
      }
      if (chromaticRef.current) {
        chromaticRef.current.style.clipPath = `circle(${(
          lensRadius + 3
        ).toFixed(1)}px at ${x.toFixed(1)}px ${y.toFixed(1)}px)`;
      }
      if (chromaticInnerRef.current) {
        chromaticInnerRef.current.style.transform = `translate3d(${(
          (1 - fringeScale) * x +
          fringe
        ).toFixed(2)}px,${(
          (1 - fringeScale) * y +
          fringe * 0.64
        ).toFixed(2)}px,0) scale(${fringeScale})`;
      }
      if (ringRef.current) {
        const ringScale = (lensRadius * 2) / RING_BOX;
        ringRef.current.style.transform = `translate3d(${(
          x -
          RING_BOX / 2
        ).toFixed(1)}px,${(y - RING_BOX / 2).toFixed(
          1
        )}px,0) scale(${ringScale.toFixed(3)})`;
      }
    };

    const point: [number, number] = [0, 0];
    const drawGrid = (x: number, y: number, lensRadius: number) => {
      if (!context) return;
      context.clearRect(0, 0, width, height);
      if (!params.current.gridBend) return;
      const reach = lensRadius * 1.9;

      const warp = (pointX: number, pointY: number) => {
        const deltaX = pointX - x;
        const deltaY = pointY - y;
        const distance = Math.hypot(deltaX, deltaY);
        if (distance > reach || distance < 0.5) {
          point[0] = pointX;
          point[1] = pointY;
          return;
        }
        const edgeDistance = distance - lensRadius;
        let push =
          BEND_AMPLITUDE *
          Math.exp(
            -(edgeDistance * edgeDistance) /
              (2 * BEND_SIGMA * BEND_SIGMA)
          );
        if (distance < lensRadius) push *= distance / lensRadius;
        point[0] = pointX + (deltaX / distance) * push;
        point[1] = pointY + (deltaY / distance) * push;
      };

      const drawPass = (color: string, alpha: number, clipRadius: number) => {
        context.save();
        if (clipRadius) {
          context.beginPath();
          context.arc(x, y, clipRadius, 0, Math.PI * 2);
          context.clip();
        }
        context.strokeStyle = color;
        context.globalAlpha = alpha;
        context.lineWidth = 1;
        context.beginPath();
        for (
          let gridX = GRID_GAP / 2;
          gridX < width;
          gridX += GRID_GAP
        ) {
          for (
            let index = 0;
            index <= height;
            index += GRID_SEGMENT
          ) {
            warp(gridX, index);
            if (index === 0) context.moveTo(point[0], point[1]);
            else context.lineTo(point[0], point[1]);
          }
        }
        for (
          let gridY = GRID_GAP / 2;
          gridY < height;
          gridY += GRID_GAP
        ) {
          for (
            let index = 0;
            index <= width;
            index += GRID_SEGMENT
          ) {
            warp(index, gridY);
            if (index === 0) context.moveTo(point[0], point[1]);
            else context.lineTo(point[0], point[1]);
          }
        }
        context.stroke();
        context.restore();
        context.globalAlpha = 1;
      };

      drawPass(probeColor(0), 0.85, 0);
      drawPass(probeColor(1), 0.5, lensRadius * 1.7);
    };

    const lensX = makeSpring(-200);
    const lensY = makeSpring(-200);
    const presence = makeSpring(0);
    const rng = makeRng(seed);
    let idleTime = rng() * 30;
    let animationFrame = 0;
    let lastFrame = 0;

    const frame = (now: number) => {
      animationFrame = requestAnimationFrame(frame);
      let delta = (now - lastFrame) / 1000;
      lastFrame = now;
      if (!(delta > 0) || delta > 0.05) delta = 0.016;
      idleTime += delta;

      const configuration = params.current;
      const pointer = pointerRef.current;
      let targetX: number;
      let targetY: number;
      if (pointer.inside) {
        targetX = pointer.x;
        targetY = pointer.y;
      } else if (configuration.idleDrift) {
        targetX = width * (0.5 + 0.3 * Math.sin(idleTime * 0.33));
        targetY =
          height * (0.5 + 0.26 * Math.sin(idleTime * 0.47 + 1.2));
      } else {
        targetX = width / 2;
        targetY = height / 2;
      }

      moveSpring(
        lensX,
        targetX,
        configuration.lag.stiffness,
        configuration.lag.damping,
        delta
      );
      moveSpring(
        lensY,
        targetY,
        configuration.lag.stiffness,
        configuration.lag.damping,
        delta
      );
      moveSpring(presence, 1, 200, 18, delta);
      const lensRadius = Math.max(
        1,
        configuration.radius * clamp(presence.x, 0, 1.2)
      );
      place(lensX.x, lensY.x, lensRadius);
      drawGrid(lensX.x, lensY.x, lensRadius);
    };

    const renderStatic = () => {
      const x = width / 2;
      const y = height / 2;
      place(x, y, params.current.radius);
      drawGrid(x, y, params.current.radius);
    };

    if (animate) {
      lastFrame =
        typeof performance !== "undefined" ? performance.now() : 0;
      animationFrame = requestAnimationFrame(frame);
    } else {
      renderStatic();
    }

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            measure();
            if (!animate) renderStatic();
          })
        : null;
    resizeObserver?.observe(root);

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
    };
  }, [animate, seed]);

  const track = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const root = rootRef.current;
      if (!root) return;
      const bounds = root.getBoundingClientRect();
      pointerRef.current = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
        inside: true,
      };
    },
    []
  );

  const release = React.useCallback(() => {
    pointerRef.current = { x: -10000, y: -10000, inside: false };
  }, []);

  const instanceCss = `
.${instanceClass}-chroma { opacity: .18; mix-blend-mode: multiply; }
.dark .${instanceClass}-chroma, [data-theme="dark"] .${instanceClass}-chroma { opacity: .45; mix-blend-mode: screen; }`.trim();

  return (
    <div
      ref={rootRef}
      data-motion={staticMode ? "static" : "animated"}
      data-paused={paused ? "true" : "false"}
      className={cn("relative isolate w-full overflow-hidden", className)}
      style={{
        touchAction: "pan-y",
        cursor: staticMode ? undefined : "none",
        ...style,
      }}
      onPointerMove={track}
      onPointerDown={track}
      onPointerLeave={release}
      onPointerCancel={release}
      {...props}
    >
      <style dangerouslySetInnerHTML={{ __html: instanceCss }} />

      {gridBend ? (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[1] block h-full w-full"
        />
      ) : null}

      <div className="relative z-[2]">{children}</div>

      {chromatic > 0 ? (
        <div
          ref={chromaticRef}
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 z-[3]",
            `${instanceClass}-chroma`
          )}
          style={{
            clipPath: "circle(0px at -200px -200px)",
            filter: "hue-rotate(150deg) saturate(1.6)",
          }}
        >
          <div
            ref={chromaticInnerRef}
            className="absolute inset-0"
            style={{ transformOrigin: "0 0", willChange: "transform" }}
          >
            {children}
          </div>
        </div>
      ) : null}

      <div
        ref={magnifiedRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[4]"
        style={{
          clipPath: "circle(0px at -200px -200px)",
          background: "var(--motiq-bg, #080c14)",
        }}
      >
        <div
          ref={magnifiedInnerRef}
          className="absolute inset-0"
          style={{ transformOrigin: "0 0", willChange: "transform" }}
        >
          {children}
        </div>
      </div>

      {showRing ? (
        <div
          ref={ringRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 z-[5] h-[208px] w-[208px] rounded-full"
          style={{
            transform: "translate3d(-999px,-999px,0)",
            willChange: "transform",
            border:
              "1px solid color-mix(in oklab, var(--motiq-accent, #4f7cff) 60%, transparent)",
            boxShadow: [
              "inset 0 0 0 1.5px color-mix(in oklab, var(--motiq-secondary-accent, #22c7d9) 35%, transparent)",
              "inset 0 0 26px color-mix(in oklab, var(--motiq-accent, #4f7cff) 22%, transparent)",
              "0 0 34px color-mix(in oklab, var(--motiq-accent, #4f7cff) 30%, transparent)",
            ].join(", "),
            backgroundImage:
              "radial-gradient(circle at 32% 28%, color-mix(in oklab, var(--motiq-fg, #f8fafc) 14%, transparent), transparent 42%)",
          }}
        />
      ) : null}

      <span
        ref={probeRef}
        aria-hidden="true"
        className="pointer-events-none absolute h-0 w-0 overflow-hidden"
      >
        <span style={{ color: "var(--motiq-border, #263449)" }} />
        <span style={{ color: "var(--motiq-accent, #4f7cff)" }} />
      </span>
    </div>
  );
}

export function LensCard(props: LensCardProps) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: MOTIQ_TOKENS }} />
      <LensCardBase {...props} />
    </>
  );
}

LensCard.displayName = "LensCard";

export default LensCard;
