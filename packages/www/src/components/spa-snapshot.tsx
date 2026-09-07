import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { usePrefersDark } from "#/hooks/use-prefers-dark";
import type { SpaSnapshotFile, SpaSnapshotVariant } from "#/lib/spa-snapshot";

const adoptedSheets = new Map<string, CSSStyleSheet>();

function sheetFor(key: string, cssText: string) {
  const existing = adoptedSheets.get(key);
  if (existing) return existing;
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(cssText);
  adoptedSheets.set(key, sheet);
  return sheet;
}

const escapeAttribute = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const attributes = (source: Record<string, string>, id: string) =>
  [
    `id="snapshot-${id}"`,
    `data-snapshot-${id}=""`,
    ...Object.entries(source)
      .filter(([name]) => name !== "id")
      .map(([name, value]) => `${name}="${escapeAttribute(value)}"`),
  ].join(" ");

/** The captured element carried the page's own height; pin it to the frame. */
const frameCss = (variant: SpaSnapshotVariant) => `
  :host { display: block; }
  #snapshot-html {
    width: ${variant.rootWidth}px;
    height: ${variant.rootHeight}px;
    overflow: hidden;
    color-scheme: inherit;
  }
  #snapshot-body { width: 100%; height: 100%; margin: 0; }
  #snapshot-body > * {
    width: ${variant.rootWidth}px !important;
    height: ${variant.rootHeight}px !important;
  }
`;

function documentFor(variant: SpaSnapshotVariant) {
  return [
    `<style>${frameCss(variant)}</style>`,
    `<style>${variant.css}</style>`,
    `<div ${attributes(variant.htmlAttrs, "html")}>`,
    `<div ${attributes(variant.bodyAttrs, "body")}>`,
    variant.html,
    "</div></div>",
  ].join("");
}

function hydrateShadowTrees(
  root: ShadowRoot | Element,
  variant: SpaSnapshotVariant
) {
  for (const element of root.querySelectorAll("*")) {
    const shadow = element.shadowRoot;
    if (!shadow) continue;
    const sheets: Array<CSSStyleSheet> = [];
    for (const key of element
      .getAttribute("data-snapshot-sheets")
      ?.split(" ") ?? []) {
      const cssText = variant.shadowSheets[key];
      if (cssText) sheets.push(sheetFor(key, cssText));
    }
    shadow.adoptedStyleSheets = sheets;
    hydrateShadowTrees(shadow, variant);
  }
}

function restoreScroll(root: ShadowRoot | Element) {
  for (const element of root.querySelectorAll<HTMLElement>("*")) {
    const { snapshotScrollTop, snapshotScrollLeft } = element.dataset;
    if (snapshotScrollTop) element.scrollTop = Number(snapshotScrollTop);
    if (snapshotScrollLeft) element.scrollLeft = Number(snapshotScrollLeft);
    if (element.shadowRoot) restoreScroll(element.shadowRoot);
  }
}

const NEARBY_PX = 600;
const THROTTLE_MS = 100;

/** Sections further down the page fetch their snapshot as they come into range. */
function useNearViewport(ref: React.RefObject<Element | null>, eager: boolean) {
  const [near, setNear] = useState(eager);

  useEffect(() => {
    if (near) return;
    const element = ref.current;
    if (!element) return;

    let checkedAt = 0;
    const check = () => {
      const box = element.getBoundingClientRect();
      if (box.top < innerHeight + NEARBY_PX && box.bottom > -NEARBY_PX) {
        setNear(true);
      }
    };
    const onScroll = () => {
      const now = performance.now();
      if (now - checkedAt < THROTTLE_MS) return;
      checkedAt = now;
      check();
    };

    check();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll, { passive: true });
    return () => {
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
    };
  }, [near, ref]);

  return near;
}

function useSnapshot(src: string, enabled: boolean) {
  const [snapshot, setSnapshot] = useState<SpaSnapshotFile | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(src, { signal: controller.signal });
        if (response.ok)
          setSnapshot((await response.json()) as SpaSnapshotFile);
      } catch {
        // A missing snapshot just leaves the placeholder in place.
      }
    })();
    return () => controller.abort();
  }, [src, enabled]);

  return snapshot;
}

export function SpaSnapshot({
  src,
  label,
  width,
  height,
  eager = false,
  className = "",
}: {
  src: string;
  label: string;
  width: number;
  height: number;
  /** Set on the hero: it is on screen at load, so it should not wait. */
  eager?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  const near = useNearViewport(containerRef, eager);
  const snapshot = useSnapshot(src, near);
  const prefersDark = usePrefersDark();
  const variant = snapshot?.variants[prefersDark ? "dark" : "light"] ?? null;

  const frame = variant?.focus ?? {
    left: 0,
    top: 0,
    width: variant?.rootWidth ?? width,
    height: variant?.rootHeight ?? height,
  };

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / frame.width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [frame.width]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || !variant) return;
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    // Declarative shadow roots inside the snapshot only come alive through
    // setHTMLUnsafe — innerHTML would leave the diff panes as inert templates.
    if (typeof shadow.setHTMLUnsafe !== "function") return;
    shadow.setHTMLUnsafe(documentFor(variant));
    hydrateShadowTrees(shadow, variant);
    restoreScroll(shadow);
  }, [variant]);

  useEffect(() => {
    if (!variant?.fontCss) return;
    const style = document.createElement("style");
    style.textContent = variant.fontCss;
    document.head.append(style);
    return () => style.remove();
  }, [variant]);

  const mounted = variant !== null && scale > 0;

  return (
    <div
      aria-label={label}
      className={`relative overflow-hidden ${className}`}
      ref={containerRef}
      role="img"
      style={{ aspectRatio: `${frame.width} / ${frame.height}` }}
    >
      {/* `inert` keeps focus out; `pointer-events-none` keeps the app's own
          scroll containers from swallowing the page's wheel events. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute origin-top-left"
        inert
        ref={hostRef}
        style={{
          width: `${variant?.rootWidth ?? width}px`,
          height: `${variant?.rootHeight ?? height}px`,
          left: `${-frame.left * scale}px`,
          top: `${-frame.top * scale}px`,
          transform: `scale(${scale})`,
          visibility: mounted ? "visible" : "hidden",
        }}
      />
      {mounted ? null : (
        <div className="size-full animate-pulse bg-neutral-100 dark:bg-neutral-900" />
      )}
    </div>
  );
}
