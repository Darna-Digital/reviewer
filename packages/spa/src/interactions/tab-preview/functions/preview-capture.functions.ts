/**
 * Lifting a running page out of the window it was rendered in: its markup, and
 * the rules that draw it.
 *
 * A card used to be an `<iframe srcdoc>` — a document of its own, parsed and
 * laid out and styled from scratch, a dozen of them for one glance at the
 * launchpad. What a picture actually needs is already in the window: the same
 * stylesheet the app is wearing, and a copy of the nodes it is wearing it on.
 * So the page is cloned rather than re-loaded, and the clone is dropped into a
 * shadow root beside the app — one document, no navigation, nothing to parse.
 *
 * Two things have to travel with the markup for it to keep its looks outside
 * the window it grew in, and both are settled here rather than at the card:
 *
 *   - The rules. A shadow root inherits none of the document's stylesheets, so
 *     they are read out and re-scoped: `:root`, `html` and `body` have no
 *     counterpart inside a shadow tree, and stand in as attributes on the two
 *     wrappers the card builds around the clone.
 *   - The window. Media conditions and viewport units answer to whichever
 *     window they are asked in, and the card's window is not the one the page
 *     was laid out for — so both are resolved here, against the preview window,
 *     and what the card holds is the layout as it was actually rendered.
 *
 * This is the same lift the marketing site takes of the app (see
 * `packages/www/scripts/capture-spa`), less everything it only needs because it
 * has to survive the trip to another origin: no assets to inline, no fonts to
 * carry, no second theme to capture. The app is right there.
 */

/** A page as it looked, ready to be re-hung in a shadow root. */
export interface PreviewCapture {
  readonly html: string;
  /** Component stylesheets, by key, for the shadow trees inside `html`. */
  readonly shadowSheets: Record<string, string>;
  readonly rootAttrs: Record<string, string>;
  readonly bodyAttrs: Record<string, string>;
  /** The size the page was laid out at, and so what a card scales down from. */
  readonly width: number;
  readonly height: number;
}

const VIEWPORT_UNIT =
  /(-?\d*\.?\d+)(dvh|svh|lvh|vh|dvw|svw|lvw|vw|vmin|vmax)\b/g;
const CSS_URL = /url\(\s*(["']?)([^"')]+)\1\s*\)/g;
const ROOT_ELEMENT = /(^|[\s>+~,(])(html|body)\b(?![-\w])/g;

/** Nothing that only exists to load or run something is worth copying. */
const DEAD_WEIGHT = new Set(["STYLE", "LINK", "SCRIPT", "NOSCRIPT"]);

/** Attributes the card's wrappers answer `html` and `body` selectors with. */
export const ROOT_STAND_IN = "data-snapshot-html";
export const BODY_STAND_IN = "data-snapshot-body";
export const SHEET_KEYS_ATTRIBUTE = "data-snapshot-sheets";
export const SCROLL_TOP_ATTRIBUTE = "data-snapshot-scroll-top";
export const SCROLL_LEFT_ATTRIBUTE = "data-snapshot-scroll-left";

/**
 * Every sheet a tree is wearing, written and adopted alike — and asked for in a
 * way that survives an engine having only the one kind.
 */
const sheetsOf = (source: {
  readonly styleSheets?: StyleSheetList;
  readonly adoptedStyleSheets?: ReadonlyArray<CSSStyleSheet>;
}): Array<CSSStyleSheet> => [
  ...Array.from(source.styleSheets ?? []),
  ...(source.adoptedStyleSheets ?? []),
];

/** Rewrite the parts of `text` that are not inside a CSS string literal. */
const outsideStrings = (text: string, transform: (part: string) => string) =>
  text
    .split(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g)
    .map((part, index) => (index % 2 === 1 ? part : transform(part)))
    .join("");

/**
 * A frame carries its own copies of the DOM classes: nothing inside it is an
 * instance of this window's `HTMLInputElement`, so every test has to be made
 * against the frame's own. TypeScript hangs those constructors off the global
 * rather than off `Window`, which a `contentWindow` is typed as — it has them
 * all the same.
 */
const realmOf = (view: Window) => view as Window & typeof globalThis;

/**
 * A reader bound to one preview window: everything below answers to that
 * window's size, its media conditions and its stylesheets.
 */
function reader(view: Window) {
  const realm = realmOf(view);
  const page = view.document;
  const width = view.innerWidth;
  const height = view.innerHeight;
  const basis: Record<string, number> = {
    vh: height,
    svh: height,
    dvh: height,
    lvh: height,
    vw: width,
    svw: width,
    dvw: width,
    lvw: width,
    vmin: Math.min(width, height),
    vmax: Math.max(width, height),
  };

  const resolveViewportUnits = (text: string) =>
    text.replace(
      VIEWPORT_UNIT,
      (_match, value: string, unit: string) =>
        `${(Number(value) / 100) * (basis[unit] ?? 0)}px`
    );

  const absolutizeUrls = (text: string, base: string) =>
    text.replace(CSS_URL, (match, _quote: string, url: string) => {
      if (/^(?:data:|blob:|about:|#)/.test(url)) return match;
      try {
        return `url("${new URL(url, base).href}")`;
      } catch {
        return match;
      }
    });

  const scopeSelector = (selectorText: string) =>
    outsideStrings(selectorText, (part) =>
      part
        .replace(/:root\b/g, `[${ROOT_STAND_IN}]`)
        .replace(
          ROOT_ELEMENT,
          (_match, lead: string, element: string) =>
            `${lead}[data-snapshot-${element}]`
        )
    );

  const applies = (test: (condition: string) => boolean, condition: string) => {
    try {
      return test(condition);
    } catch {
      return true;
    }
  };

  /** Selectors are left alone inside a shadow tree — there is no root to stand in for. */
  const asIs = (selectorText: string) => selectorText;

  const serializeRule = (
    rule: CSSRule,
    base: string,
    scope: (selectorText: string) => string
  ): string => {
    const sheetBase = rule.parentStyleSheet?.href ?? base;
    const declarations = (style: CSSStyleDeclaration) =>
      absolutizeUrls(resolveViewportUnits(style.cssText), sheetBase);
    const children = (grouping: CSSRule) =>
      collectRules((grouping as CSSGroupingRule).cssRules, sheetBase, scope);

    switch (rule.constructor.name) {
      case "CSSStyleRule": {
        const styleRule = rule as CSSStyleRule;
        const nested = styleRule.cssRules?.length ? children(styleRule) : "";
        return `${scope(styleRule.selectorText)}{${declarations(styleRule.style)}${nested}}`;
      }
      // Resolved here, against the window the page was laid out in, so a card
      // shows that layout however wide the window looking at it happens to be.
      case "CSSMediaRule":
        return applies(
          (condition) => view.matchMedia(condition).matches,
          (rule as CSSMediaRule).conditionText
        )
          ? children(rule)
          : "";
      case "CSSSupportsRule":
        return applies(
          (condition) => realm.CSS.supports(condition),
          (rule as CSSSupportsRule).conditionText
        )
          ? children(rule)
          : "";
      case "CSSLayerBlockRule": {
        const body = children(rule);
        return body
          ? `@layer ${(rule as CSSLayerBlockRule).name ?? ""}{${body}}`
          : "";
      }
      case "CSSContainerRule": {
        const body = children(rule);
        return body
          ? `@container ${(rule as CSSContainerRule).conditionText}{${body}}`
          : "";
      }
      case "CSSScopeRule":
      case "CSSStartingStyleRule": {
        const body = children(rule);
        return body ? rule.cssText.replace(/\{[\s\S]*\}$/, `{${body}}`) : "";
      }
      // Font faces are the window's own and already loaded; a card asking for
      // them again would be asking for what it is standing in.
      case "CSSFontFaceRule":
        return "";
      case "CSSImportRule": {
        const imported = (rule as CSSImportRule).styleSheet;
        return imported
          ? collectRules(imported.cssRules, imported.href ?? sheetBase, scope)
          : "";
      }
      case "CSSLayerStatementRule":
      case "CSSKeyframesRule":
      case "CSSPropertyRule":
        return rule.cssText;
      default:
        return outsideStrings(rule.cssText, resolveViewportUnits);
    }
  };

  function collectRules(
    rules: CSSRuleList,
    base: string,
    scope: (selectorText: string) => string
  ): string {
    let output = "";
    for (const rule of rules) output += serializeRule(rule, base, scope);
    return output;
  }

  const collectSheets = (
    sheets: Iterable<CSSStyleSheet>,
    scope: (selectorText: string) => string
  ) => {
    let output = "";
    for (const sheet of sheets) {
      try {
        output += collectRules(
          sheet.cssRules,
          sheet.href ?? page.baseURI,
          scope
        );
      } catch {
        // A sheet that will not be read is one the card goes without.
      }
    }
    return output;
  };

  return {
    page,
    width,
    height,
    resolveViewportUnits,
    collectSheets,
    scopeSelector,
    asIs,
  };
}

/**
 * Every rule the preview window is drawing with, re-scoped for a shadow tree.
 *
 * The app wears one stylesheet whatever page it is showing, so this is read
 * once and shared by every card rather than carried by each picture.
 */
export function capturePreviewStyles(view: Window): string {
  const { page, collectSheets, scopeSelector } = reader(view);
  return collectSheets(sheetsOf(page), scopeSelector);
}

/**
 * The page under `selector` as markup: a deep copy carrying the state the DOM
 * holds outside its attributes — what is scrolled where, what a field has been
 * typed into, what a canvas has drawn — and nothing that would run.
 */
export function capturePreviewPage(
  view: Window,
  selector: string
): PreviewCapture | null {
  const { page, resolveViewportUnits, collectSheets, asIs } = reader(view);
  const realm = realmOf(view);
  const root = page.querySelector(selector);
  if (root === null) return null;

  const shadowSheets = new Map<string, string>();

  const sheetKey = (cssText: string) => {
    let hash = 5381;
    for (let index = 0; index < cssText.length; index += 1) {
      hash = ((hash * 33) ^ cssText.charCodeAt(index)) >>> 0;
    }
    return `s${hash.toString(36)}${cssText.length.toString(36)}`;
  };

  /** Identical component stylesheets are kept once and re-adopted per card. */
  const registerShadowSheets = (shadow: ShadowRoot) => {
    const keys: Array<string> = [];
    for (const sheet of sheetsOf(shadow)) {
      const cssText = collectSheets([sheet], asIs);
      if (cssText === "") continue;
      const key = sheetKey(cssText);
      if (!shadowSheets.has(key)) shadowSheets.set(key, cssText);
      keys.push(key);
    }
    return keys;
  };

  const canvasImage = (live: HTMLCanvasElement) => {
    try {
      const image = page.createElement("img");
      image.setAttribute("src", live.toDataURL("image/png"));
      for (const attribute of ["class", "style"]) {
        const value = live.getAttribute(attribute);
        if (value !== null) image.setAttribute(attribute, value);
      }
      return image;
    } catch {
      // A canvas that will not be read — a WebGL terminal, say — leaves a hole
      // in the picture rather than taking the rest of it down.
      return null;
    }
  };

  const carryFormState = (live: Element, copy: Element) => {
    if (live instanceof realm.HTMLInputElement) {
      if (live.type === "checkbox" || live.type === "radio") {
        copy.toggleAttribute("checked", live.checked);
      } else {
        copy.setAttribute("value", live.value);
      }
    } else if (live instanceof realm.HTMLTextAreaElement) {
      copy.textContent = live.value;
    } else if (live instanceof realm.HTMLSelectElement) {
      [...(copy as HTMLSelectElement).options].forEach((option, index) => {
        option.toggleAttribute(
          "selected",
          Boolean(live.options[index]?.selected)
        );
      });
    }
  };

  const carryElementState = (live: Element, copy: Element) => {
    for (const { name } of [...copy.attributes]) {
      if (name.startsWith("on")) copy.removeAttribute(name);
    }
    const inlineStyle = copy.getAttribute("style");
    if (inlineStyle !== null) {
      copy.setAttribute("style", resolveViewportUnits(inlineStyle));
    }
    // Scroll is a live property rather than an attribute, so a list left
    // halfway down would otherwise come back at the top.
    if (live.scrollTop > 0) {
      copy.setAttribute(
        SCROLL_TOP_ATTRIBUTE,
        String(Math.round(live.scrollTop))
      );
    }
    if (live.scrollLeft > 0) {
      copy.setAttribute(
        SCROLL_LEFT_ATTRIBUTE,
        String(Math.round(live.scrollLeft))
      );
    }
    carryFormState(live, copy);
    if (live instanceof realm.HTMLImageElement) {
      const source = live.currentSrc || live.src;
      copy.removeAttribute("srcset");
      copy.removeAttribute("sizes");
      if (source !== "") copy.setAttribute("src", source);
    }
  };

  const appendChildren = (live: ParentNode, target: ParentNode) => {
    for (const node of live.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        target.append(node.cloneNode(true));
        continue;
      }
      if (!(node instanceof realm.Element)) continue;
      if (DEAD_WEIGHT.has(node.tagName)) continue;
      const copy = buildClone(node);
      if (copy !== null) target.append(copy);
    }
  };

  function buildClone(live: Element): Element | null {
    if (live instanceof realm.HTMLCanvasElement) return canvasImage(live);
    if (live instanceof realm.HTMLTemplateElement) {
      return live.cloneNode(true) as Element;
    }

    const copy = live.cloneNode(false) as Element;
    carryElementState(live, copy);

    // A shadow tree travels as the markup that builds one: the card hangs it
    // back up with `setHTMLUnsafe`, which is what makes these come alive.
    if (live.shadowRoot !== null) {
      const keys = registerShadowSheets(live.shadowRoot);
      if (keys.length > 0) {
        copy.setAttribute(SHEET_KEYS_ATTRIBUTE, keys.join(" "));
      }
      const template = page.createElement("template");
      template.setAttribute("shadowrootmode", "open");
      if (live.shadowRoot.delegatesFocus) {
        template.setAttribute("shadowrootdelegatesfocus", "");
      }
      appendChildren(live.shadowRoot, template.content);
      copy.append(template);
    }

    appendChildren(live, copy);
    return copy;
  }

  const clone = buildClone(root);
  if (clone === null || clone.childElementCount === 0) return null;

  const attributesOf = (element: Element) =>
    Object.fromEntries(
      [...element.attributes].map(({ name, value }) => [
        name,
        name === "style" ? resolveViewportUnits(value) : value,
      ])
    );

  const box = root.getBoundingClientRect();
  return {
    html: clone.outerHTML,
    shadowSheets: Object.fromEntries(shadowSheets),
    rootAttrs: attributesOf(page.documentElement),
    bodyAttrs: attributesOf(page.body),
    width: Math.round(box.width),
    height: Math.round(box.height),
  };
}
