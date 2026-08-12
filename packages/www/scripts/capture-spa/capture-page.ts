import type {
  CaptureOptions,
  SpaSnapshotVariant,
} from "../../src/lib/spa-snapshot.ts";

interface RuleScope {
  uses: (selectorText: string) => boolean;
  scope: (selectorText: string) => string;
}

/**
 * Runs inside the page: serialised with `Function.prototype.toString` and
 * evaluated over CDP, so it must stay self-contained — type-only imports are
 * erased, but no value may come from module scope.
 */
export async function capturePage(
  options: CaptureOptions
): Promise<SpaSnapshotVariant> {
  const { selector, exclude, width, height, fonts, inlineAssetMaxBytes } =
    options;

  const STATE_PSEUDO =
    /:(?:hover|active|focus|focus-visible|focus-within|visited|target|any-link|link|checked|indeterminate|disabled|enabled|placeholder-shown|autofill|open|popover-open|user-valid|user-invalid|-webkit-[\w-]+|-moz-[\w-]+)\b/g;
  const PSEUDO_ELEMENT = /::[\w-]+(?:\([^)]*\))?/g;
  const VIEWPORT_UNIT =
    /(-?\d*\.?\d+)(dvh|svh|lvh|vh|dvw|svw|lvw|vw|vmin|vmax)\b/g;
  const CSS_URL = /url\(\s*(["']?)([^"')]+)\1\s*\)/g;
  const ROOT_ELEMENT = /(^|[\s>+~,(])(html|body)\b(?![-\w])/g;
  const STYLE_ELEMENT = new Set(["STYLE", "LINK", "SCRIPT", "NOSCRIPT"]);

  const root = document.querySelector(selector);
  if (!root) throw new Error(`No element matches ${selector}`);
  await document.fonts.ready;

  const warnings: Array<string> = [];
  const fontFamilies = new Set<string>();
  const fontFaces: Array<string> = [];
  const assets = new Map<string, string | null>();
  const shadowSheets = new Map<string, string>();
  const probeCache = new Map<string, boolean>();
  const imageTasks: Array<[string, Element]> = [];
  let droppedNodes = 0;

  const viewportBasis: Record<string, number> = {
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

  const message = (error: unknown) =>
    error instanceof Error ? error.message : String(error);

  const outsideStrings = (text: string, transform: (part: string) => string) =>
    text
      .split(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g)
      .map((part, index) => (index % 2 === 1 ? part : transform(part)))
      .join("");

  /** Viewport units would otherwise resolve against the visitor's window. */
  const resolveViewportUnits = (text: string) =>
    text.replace(
      VIEWPORT_UNIT,
      (_match, value: string, unit: string) =>
        `${(Number(value) / 100) * (viewportBasis[unit] ?? 0)}px`
    );

  const absolutizeUrls = (text: string, base: string) =>
    text.replace(CSS_URL, (match, _quote: string, url: string) => {
      if (/^(?:data:|blob:|about:|#)/.test(url)) return match;
      try {
        const absolute = new URL(url, base).href;
        assets.set(absolute, null);
        return `url("${absolute}")`;
      } catch {
        return match;
      }
    });

  /**
   * `html`/`body`/`:root` have no counterpart inside the snapshot's shadow
   * root. The stand-ins are attribute selectors so they weigh the same as
   * `:root` — an id would outrank the `.dark` overrides that follow it.
   */
  const scopeSelector = (selectorText: string) =>
    outsideStrings(selectorText, (part) =>
      part
        .replace(/:root\b/g, "[data-snapshot-html]")
        .replace(
          ROOT_ELEMENT,
          (_match, lead: string, element: string) =>
            `${lead}[data-snapshot-${element}]`
        )
    );

  const documentScopeUses = (selectorText: string) => {
    const probe = selectorText
      .replace(PSEUDO_ELEMENT, "")
      .replace(STATE_PSEUDO, "")
      .trim();
    if (!probe) return true;
    const cached = probeCache.get(probe);
    if (cached !== undefined) return cached;
    let used: boolean;
    try {
      used =
        document.documentElement.matches(probe) ||
        document.body.matches(probe) ||
        root.matches(probe) ||
        root.querySelector(probe) !== null;
    } catch {
      used = true;
    }
    probeCache.set(probe, used);
    return used;
  };

  const DOCUMENT_SCOPE: RuleScope = {
    uses: documentScopeUses,
    scope: scopeSelector,
  };
  const SHADOW_SCOPE: RuleScope = {
    uses: () => true,
    scope: (selectorText) => selectorText,
  };

  const mediaApplies = (condition: string) => {
    try {
      return window.matchMedia(condition).matches;
    } catch {
      return true;
    }
  };

  const supportsApplies = (condition: string) => {
    try {
      return CSS.supports(condition);
    } catch {
      return true;
    }
  };

  const serializeRule = (
    rule: CSSRule,
    base: string,
    context: RuleScope
  ): string => {
    const sheetBase = rule.parentStyleSheet?.href ?? base;
    const declarations = (style: CSSStyleDeclaration) =>
      absolutizeUrls(resolveViewportUnits(style.cssText), sheetBase);
    const children = (grouping: CSSRule) =>
      collectRules((grouping as CSSGroupingRule).cssRules, sheetBase, context);

    switch (rule.constructor.name) {
      case "CSSStyleRule": {
        const styleRule = rule as CSSStyleRule;
        if (!context.uses(styleRule.selectorText)) return "";
        const nested = styleRule.cssRules?.length ? children(styleRule) : "";
        return `${context.scope(styleRule.selectorText)}{${declarations(styleRule.style)}${nested}}`;
      }
      // Media and support conditions resolve here, so the snapshot keeps the
      // layout it was captured at whatever the visitor's viewport is.
      case "CSSMediaRule":
        return mediaApplies((rule as CSSMediaRule).conditionText)
          ? children(rule)
          : "";
      case "CSSSupportsRule":
        return supportsApplies((rule as CSSSupportsRule).conditionText)
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
      case "CSSFontFaceRule": {
        const fontFace = rule as CSSFontFaceRule;
        fontFamilies.add(fontFace.style.getPropertyValue("font-family"));
        if (fonts === "inline") {
          fontFaces.push(`@font-face{${declarations(fontFace.style)}}`);
        }
        return "";
      }
      case "CSSImportRule": {
        const imported = (rule as CSSImportRule).styleSheet;
        return imported
          ? collectRules(imported.cssRules, imported.href ?? sheetBase, context)
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
    context: RuleScope
  ): string {
    let output = "";
    for (const rule of rules) output += serializeRule(rule, base, context);
    return output;
  }

  const collectSheets = (
    sheets: Iterable<CSSStyleSheet>,
    context: RuleScope
  ) => {
    let output = "";
    for (const sheet of sheets) {
      try {
        output += collectRules(
          sheet.cssRules,
          sheet.href ?? document.baseURI,
          context
        );
      } catch {
        warnings.push(`Could not read stylesheet ${sheet.href ?? "(inline)"}`);
      }
    }
    return output;
  };

  const sheetKey = (cssText: string) => {
    let hash = 5381;
    for (let index = 0; index < cssText.length; index += 1) {
      hash = ((hash * 33) ^ cssText.charCodeAt(index)) >>> 0;
    }
    return `s${hash.toString(36)}${cssText.length.toString(36)}`;
  };

  /** Identical component stylesheets are stored once and re-adopted on render. */
  const registerShadowSheets = (shadow: ShadowRoot) => {
    const keys: Array<string> = [];
    for (const sheet of [...shadow.styleSheets, ...shadow.adoptedStyleSheets]) {
      const cssText = collectSheets([sheet], SHADOW_SCOPE);
      if (!cssText) continue;
      const key = sheetKey(cssText);
      if (!shadowSheets.has(key)) shadowSheets.set(key, cssText);
      keys.push(key);
    }
    return keys;
  };

  const shouldDrop = (element: Element) => {
    if (STYLE_ELEMENT.has(element.tagName)) return true;
    return exclude.some((pattern) => {
      try {
        return element.matches(pattern);
      } catch {
        return false;
      }
    });
  };

  const canvasImage = (live: HTMLCanvasElement) => {
    try {
      const image = document.createElement("img");
      image.setAttribute("src", live.toDataURL("image/png"));
      for (const attribute of ["class", "style"]) {
        const value = live.getAttribute(attribute);
        if (value !== null) image.setAttribute(attribute, value);
      }
      return image;
    } catch (error) {
      warnings.push(`Could not snapshot a canvas: ${message(error)}`);
      return null;
    }
  };

  const carryFormState = (live: Element, copy: Element) => {
    if (live instanceof HTMLInputElement) {
      if (live.type === "checkbox" || live.type === "radio") {
        copy.toggleAttribute("checked", live.checked);
      } else {
        copy.setAttribute("value", live.value);
      }
    } else if (live instanceof HTMLTextAreaElement) {
      copy.textContent = live.value;
    } else if (live instanceof HTMLSelectElement) {
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
    if (inlineStyle) {
      copy.setAttribute("style", resolveViewportUnits(inlineStyle));
    }
    if (live.scrollTop > 0) {
      copy.setAttribute(
        "data-snapshot-scroll-top",
        String(Math.round(live.scrollTop))
      );
    }
    if (live.scrollLeft > 0) {
      copy.setAttribute(
        "data-snapshot-scroll-left",
        String(Math.round(live.scrollLeft))
      );
    }
    carryFormState(live, copy);
    if (live instanceof HTMLImageElement) {
      const source = live.currentSrc || live.src;
      copy.removeAttribute("srcset");
      copy.removeAttribute("sizes");
      if (source) {
        copy.setAttribute("src", source);
        assets.set(source, null);
        imageTasks.push([source, copy]);
      }
    }
  };

  const appendChildren = (live: ParentNode, target: ParentNode) => {
    for (const node of live.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        target.append(node.cloneNode(true));
        continue;
      }
      if (!(node instanceof Element)) continue;
      if (shouldDrop(node)) {
        droppedNodes += 1;
        continue;
      }
      const copy = buildClone(node);
      if (copy) target.append(copy);
    }
  };

  function buildClone(live: Element): Element | null {
    if (live instanceof HTMLCanvasElement) return canvasImage(live);
    if (live instanceof HTMLTemplateElement)
      return live.cloneNode(true) as Element;

    const copy = live.cloneNode(false) as Element;
    carryElementState(live, copy);

    if (live.shadowRoot) {
      const keys = registerShadowSheets(live.shadowRoot);
      if (keys.length) {
        copy.setAttribute("data-snapshot-sheets", keys.join(" "));
      }
      const template = document.createElement("template");
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

  let css = collectSheets(
    [...document.styleSheets, ...document.adoptedStyleSheets],
    DOCUMENT_SCOPE
  );
  let fontCss = fontFaces.join("");
  const clone = buildClone(root);
  if (!clone) throw new Error(`Could not clone ${selector}`);

  const toDataUri = async (url: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      if (blob.size > inlineAssetMaxBytes) {
        warnings.push(`Left ${url} as a link (${blob.size} bytes)`);
        return null;
      }
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      warnings.push(`Could not inline ${url}: ${message(error)}`);
      return null;
    }
  };

  await Promise.all(
    [...assets.keys()].map(async (url) => {
      assets.set(url, await toDataUri(url));
    })
  );

  for (const [url, element] of imageTasks) {
    const dataUri = assets.get(url);
    if (dataUri) element.setAttribute("src", dataUri);
  }
  for (const [url, dataUri] of assets) {
    if (!dataUri) continue;
    const inline = (text: string) =>
      text.split(`"${url}"`).join(`"${dataUri}"`);
    css = inline(css);
    fontCss = inline(fontCss);
    for (const [key, cssText] of shadowSheets) {
      shadowSheets.set(key, inline(cssText));
    }
  }

  const attributesOf = (element: Element) =>
    Object.fromEntries(
      [...element.attributes].map(({ name, value }) => [
        name,
        name === "style" ? resolveViewportUnits(value) : value,
      ])
    );

  const countNodes = (node: ParentNode): number =>
    [...node.children].reduce(
      (total, child) =>
        total +
        1 +
        countNodes(child) +
        (child instanceof HTMLTemplateElement ? countNodes(child.content) : 0),
      0
    );

  const rect = root.getBoundingClientRect();

  return {
    html: clone.outerHTML,
    css,
    fontCss,
    shadowSheets: Object.fromEntries(shadowSheets),
    htmlAttrs: attributesOf(document.documentElement),
    bodyAttrs: attributesOf(document.body),
    rootWidth: Math.round(rect.width),
    rootHeight: Math.round(rect.height),
    viewport: { width, height },
    nodes: countNodes(clone) + 1,
    droppedNodes,
    fontFamilies: [...fontFamilies],
    warnings,
  };
}
