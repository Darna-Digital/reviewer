/**
 * Pure logic for the browser pane: what the address bar accepts, and the
 * element picker that comment mode runs inside the guest page.
 *
 * `uniqueSelector` and `elementLabel` are stringified into the picker script and
 * evaluated in the guest, so they must stay self-contained — every helper they
 * use is declared inside them, and they close over nothing but page globals.
 * They are ordinary exported functions here so they can be unit-tested against
 * jsdom rather than only through a live webview.
 */
import { STYLE_PROPERTIES } from "@/interactions/visual-comments/functions/visual-style.functions";
import type {
  PickedElement,
  PickedRect,
} from "../interfaces/browser-pane.interfaces";

const WEB_SCHEME = /^https?:\/\//i;
/**
 * A leading `word:` is only a scheme when a port number doesn't follow it —
 * otherwise `localhost:3000`, the single most likely thing to be typed here,
 * reads as the scheme "localhost".
 */
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:(?!\d)/i;

/**
 * What the user typed, as a location to load — `localhost:5173` and
 * `example.com` both mean http. Anything carrying a non-web scheme is refused
 * rather than coerced: `javascript:` and `file:` in an address bar are not an
 * abbreviation of anything, and the guest is untrusted.
 */
export const normalizeUrl = (input: string): string | null => {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  if (WEB_SCHEME.test(trimmed)) return trimmed;
  if (ANY_SCHEME.test(trimmed)) return null;
  return `http://${trimmed}`;
};

/** The address bar's own text for a location — the full URL, minus the noise. */
export const displayUrl = (url: string): string =>
  url.replace(/^https?:\/\//i, "").replace(/\/$/, "");

export function uniqueSelector(element: Element): string {
  const escape = (value: string): string =>
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(value)
      : value.replace(/[^\w-]/g, "\\$&");

  const candidates = (node: Element): Array<string> => {
    const tag = node.tagName.toLowerCase();
    const found: Array<string> = [];
    if (node.id !== "") found.push(`#${escape(node.id)}`);
    const testId = node.getAttribute("data-testid");
    if (testId !== null && testId !== "") {
      found.push(`[data-testid="${testId.replace(/"/g, '\\"')}"]`);
    }
    const name = node.getAttribute("name");
    if (name !== null && name !== "") {
      found.push(`${tag}[name="${name.replace(/"/g, '\\"')}"]`);
    }
    return found;
  };

  const position = (node: Element): string => {
    const tag = node.tagName.toLowerCase();
    const parent = node.parentElement;
    if (parent === null) return tag;
    const twins = Array.prototype.filter.call(
      parent.children,
      (child: Element) => child.tagName === node.tagName
    ) as Array<Element>;
    if (twins.length < 2) return tag;
    return `${tag}:nth-of-type(${twins.indexOf(node) + 1})`;
  };

  const build = (node: Element): string => {
    for (const candidate of candidates(node)) {
      if (node.ownerDocument.querySelectorAll(candidate).length === 1) {
        return candidate;
      }
    }
    const parent = node.parentElement;
    if (parent === null) return position(node);
    return `${build(parent)} > ${position(node)}`;
  };

  return build(element);
}

export function elementLabel(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const id = element.id !== "" ? `#${element.id}` : "";
  const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();
  if (text.length === 0) return `${tag}${id}`;
  const clipped = text.length > 60 ? `${text.slice(0, 60)}…` : text;
  return `${tag}${id} "${clipped}"`;
}

/** Cancels a picker already running in the guest, from the host side. */
export const PICKER_CANCEL_HOOK = "__reviewerCancelPick";

/**
 * Where the guest keeps the element under inspection between the pick and the
 * comment: the node itself, the inline declarations it had before any edit, and
 * the outline drawn over it. Held on `window` because each `executeJavaScript`
 * is a fresh script with nothing else in common with the last.
 */
const INSPECT_STATE = "__reviewerInspect";

const inspectedElementScript = `
  const state = window.${INSPECT_STATE};
  const element = state && state.element && state.element.isConnected
    ? state.element
    : null;
`;

/**
 * Takes an element under inspection: reads what the panel opens on and keeps
 * the node, with the inline declarations it had, for the edits to come. Shared
 * by the picker and by re-opening a saved comment, so both read the same things.
 * A pick over an unfinished inspection replaces it, outline and all — otherwise
 * the old outline would go on following its element forever.
 */
const inspectSnippet = `
  const uniqueSelector = ${String(uniqueSelector)};
  const elementLabel = ${String(elementLabel)};
  const styleProperties = ${JSON.stringify(STYLE_PROPERTIES)};
  const inspect = (element) => {
    const rect = element.getBoundingClientRect();
    const computed = getComputedStyle(element);
    const styles = {};
    const originals = {};
    for (const property of styleProperties) {
      styles[property] = computed.getPropertyValue(property);
      originals[property] = [
        element.style.getPropertyValue(property),
        element.style.getPropertyPriority(property),
      ];
    }
    const previous = window.${INSPECT_STATE};
    if (previous && previous.outline) previous.outline.remove();
    window.${INSPECT_STATE} = { element, originals, outline: null };
    return {
      selector: uniqueSelector(element),
      label: elementLabel(element),
      rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      url: location.href,
      viewport: { width: innerWidth, height: innerHeight },
      styles,
    };
  };
`;

/**
 * Re-opens a saved comment's element by the selector it was stored under.
 * Resolves to the same shape as a pick, minus the click, or to null when the
 * page no longer has such an element.
 */
export const inspectSelectorScript = (selector: string): string => `
(() => {
  ${inspectSnippet}
  const element = document.querySelector(${JSON.stringify(selector)});
  return element === null ? null : inspect(element);
})()
`;

/**
 * Where each saved comment's element is right now, keyed by selector, so the
 * host can keep a dot on every one. One round trip for all of them.
 */
export const locateSelectorsScript = (
  selectors: ReadonlyArray<string>
): string => `
(() => {
  const found = {};
  for (const selector of ${JSON.stringify(selectors)}) {
    let element = null;
    try { element = document.querySelector(selector); } catch {}
    if (element === null) { found[selector] = null; continue; }
    const rect = element.getBoundingClientRect();
    found[selector] = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
  }
  return found;
})()
`;

/**
 * An expression evaluated in the guest page that resolves to the element the
 * user clicks, or to null when they press Escape or the host cancels.
 * `executeJavaScript` awaits a returned promise, which is the whole channel —
 * no preload runs in the guest, so there is nothing else to talk to.
 */
export const elementPickerScript = (): string => `
(() => new Promise((resolve) => {
  ${inspectSnippet}
  const overlay = document.createElement("div");
  Object.assign(overlay.style, {
    position: "fixed",
    zIndex: "2147483647",
    pointerEvents: "none",
    display: "none",
    borderRadius: "3px",
    outline: "2px solid rgb(56 189 248)",
    background: "rgb(56 189 248 / 0.16)",
  });
  const root = document.documentElement;
  const previousCursor = root.style.cursor;
  root.style.cursor = "crosshair";
  root.appendChild(overlay);

  let hovered = null;

  const track = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    hovered = target;
    const rect = target.getBoundingClientRect();
    Object.assign(overlay.style, {
      display: "block",
      left: rect.left + "px",
      top: rect.top + "px",
      width: rect.width + "px",
      height: rect.height + "px",
    });
  };

  const finish = (value) => {
    document.removeEventListener("mousemove", track, true);
    document.removeEventListener("mousedown", swallow, true);
    document.removeEventListener("mouseup", swallow, true);
    document.removeEventListener("click", pick, true);
    document.removeEventListener("keydown", cancelOnEscape, true);
    overlay.remove();
    root.style.cursor = previousCursor;
    delete window.${PICKER_CANCEL_HOOK};
    resolve(value);
  };

  const swallow = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const pick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    // The click's own target, when the pointer never moved first — a click
    // straight after the picker opened, or one that was not from a mouse.
    if (event.target instanceof Element) hovered = event.target;
    if (hovered === null) return finish(null);
    finish({
      ...inspect(hovered),
      point: { x: event.clientX, y: event.clientY },
    });
  };

  const cancelOnEscape = (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    finish(null);
  };

  window.${PICKER_CANCEL_HOOK} = () => finish(null);
  document.addEventListener("mousemove", track, true);
  document.addEventListener("mousedown", swallow, true);
  document.addEventListener("mouseup", swallow, true);
  document.addEventListener("click", pick, true);
  document.addEventListener("keydown", cancelOnEscape, true);
}))()
`;

/**
 * Draws a persistent outline over the inspected element for as long as the
 * comment is being written, redrawn every frame so it follows the page as it
 * scrolls or reflows under a style edit.
 */
export const outlineInspectedScript = (): string => `
(() => {
  ${inspectedElementScript}
  if (element === null || state.outline !== null) return;
  const outline = document.createElement("div");
  Object.assign(outline.style, {
    position: "fixed",
    zIndex: "2147483647",
    pointerEvents: "none",
    borderRadius: "3px",
    outline: "2px solid rgb(56 189 248)",
    outlineOffset: "1px",
  });
  document.documentElement.appendChild(outline);
  let frame = 0;
  const follow = () => {
    const rect = element.getBoundingClientRect();
    Object.assign(outline.style, {
      left: rect.left + "px",
      top: rect.top + "px",
      width: rect.width + "px",
      height: rect.height + "px",
    });
    frame = requestAnimationFrame(follow);
  };
  follow();
  state.outline = { remove: () => { cancelAnimationFrame(frame); outline.remove(); } };
})()
`;

/** Where the inspected element is right now, so the host's dot can keep up. */
export const inspectedRectScript = (): string => `
(() => {
  ${inspectedElementScript}
  if (element === null) return null;
  const rect = element.getBoundingClientRect();
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
})()
`;

/**
 * A live edit: written inline with `!important` so it wins over whatever the
 * page's own stylesheets say, which is the point of trying it on.
 */
export const applyStyleScript = (property: string, value: string): string => `
(() => {
  ${inspectedElementScript}
  if (element === null) return false;
  element.style.setProperty(
    ${JSON.stringify(property)},
    ${JSON.stringify(value)},
    "important"
  );
  return true;
})()
`;

/**
 * Puts one property back to the inline declaration it had before the pick —
 * usually none at all, in which case the stylesheet value shows through again.
 */
export const restoreStyleScript = (property: string): string => `
(() => {
  ${inspectedElementScript}
  if (element === null) return false;
  const original = state.originals[${JSON.stringify(property)}] || ["", ""];
  if (original[0] === "") element.style.removeProperty(${JSON.stringify(property)});
  else element.style.setProperty(${JSON.stringify(property)}, original[0], original[1]);
  return true;
})()
`;

/**
 * Ends the inspection: the outline goes, and with `revert` so do the edits.
 * A saved comment keeps its edits on the page, so several notes can be tried
 * together; a cancelled one leaves no trace.
 */
export const endInspectionScript = (revert: boolean): string => `
(() => {
  ${inspectedElementScript}
  if (state && state.outline) state.outline.remove();
  if (element !== null && ${revert}) {
    for (const [property, original] of Object.entries(state.originals)) {
      if (original[0] === "") element.style.removeProperty(property);
      else element.style.setProperty(property, original[0], original[1]);
    }
  }
  delete window.${INSPECT_STATE};
})()
`;

/** Screenshot bounds for a pick — integral, clamped to the visible viewport. */
export const captureRect = (picked: PickedElement): PickedRect | null => {
  const left = Math.max(0, Math.floor(picked.rect.x));
  const top = Math.max(0, Math.floor(picked.rect.y));
  const right = Math.min(
    picked.viewport.width,
    Math.ceil(picked.rect.x + picked.rect.width)
  );
  const bottom = Math.min(
    picked.viewport.height,
    Math.ceil(picked.rect.y + picked.rect.height)
  );
  if (right <= left || bottom <= top) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
};
