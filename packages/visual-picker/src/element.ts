import type { PickedElement, Rect } from "./types.ts"

const MAX_HTML = 600
const MAX_TEXT = 160
const MAX_LABEL_TEXT = 40

const isUnique = (selector: string, target: Element) => {
  try {
    const matches = document.querySelectorAll(selector)
    return matches.length === 1 && matches[0] === target
  } catch {
    return false
  }
}

const cssEscape = (value: string) =>
  typeof CSS !== "undefined" && typeof CSS.escape === "function"
    ? CSS.escape(value)
    : value.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`)

const isStableClass = (name: string) =>
  name.length > 0 &&
  !/^(ng-|v-|svelte-|css-[a-z0-9]{5,}|jsx-\d+)/.test(name) &&
  !/^[a-z]+_[a-zA-Z0-9]{5,}$/.test(name) &&
  !/^(is-|has-)?(active|open|hover|focus|selected|disabled)$/.test(name)

const classesOf = (element: Element) =>
  Array.from(element.classList).filter(isStableClass)

const nthOfType = (element: Element) => {
  const parent = element.parentElement
  if (parent === null) return 1
  const siblings = Array.from(parent.children).filter(
    (child) => child.tagName === element.tagName
  )
  return siblings.indexOf(element) + 1
}

export const selectorFor = (element: Element): string => {
  const segments: Array<string> = []
  let current: Element | null = element

  while (current !== null && current !== document.documentElement) {
    const tag = current.tagName.toLowerCase()

    if (
      current.id.length > 0 &&
      isUnique(`#${cssEscape(current.id)}`, current)
    ) {
      segments.unshift(`#${cssEscape(current.id)}`)
      break
    }

    const testId =
      current.getAttribute("data-testid") ??
      current.getAttribute("data-test-id")
    if (testId !== null && testId.length > 0) {
      const attr = `[data-testid="${testId}"]`
      if (isUnique(attr, current)) {
        segments.unshift(attr)
        break
      }
    }

    segments.unshift(`${tag}:nth-of-type(${nthOfType(current)})`)

    const candidate = segments.join(" > ")
    if (isUnique(candidate, element)) return candidate

    current = current.parentElement
  }

  return segments.join(" > ")
}

export const resolveSelector = (selector: string): Element | null => {
  try {
    return document.querySelector(selector)
  } catch {
    return null
  }
}

const reactFiber = (element: Element): Record<string, any> | null => {
  const key = Object.keys(element).find(
    (k) =>
      k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$")
  )
  return key === undefined
    ? null
    : ((element as unknown as Record<string, any>)[key] ?? null)
}

export interface SourceLocation {
  sourceFile?: string
  sourceLine?: number
  componentName?: string
}

const reactInspectorLocation = (element: Element): SourceLocation | null => {
  const file = element.getAttribute("data-inspector-relative-path")
  const line = element.getAttribute("data-inspector-line")
  if (file === null || file.length === 0) return null
  return {
    sourceFile: file,
    ...(line === null ? {} : { sourceLine: Number(line) }),
  }
}

/** `vite-plugin-vue-inspector` packs the location into one `file:line:column`. */
const vueInspectorLocation = (element: Element): SourceLocation | null => {
  const packed = element.getAttribute("data-v-inspector")
  if (packed === null || packed.length === 0) return null
  const [file, line] = packed.split(":")
  if (file === undefined) return null
  return {
    sourceFile: file,
    ...(line === undefined ? {} : { sourceLine: Number(line) }),
  }
}

export const sourceLocationOf = (element: Element): SourceLocation => {
  const fromInspector =
    reactInspectorLocation(element) ?? vueInspectorLocation(element)
  if (fromInspector !== null) return fromInspector

  let fiber = reactFiber(element)
  let componentName: string | undefined
  let depth = 0
  while (fiber !== null && depth < 12) {
    const type = fiber["type"]
    if (componentName === undefined && typeof type === "function") {
      const name: unknown = type.displayName ?? type.name
      if (typeof name === "string" && name.length > 0) componentName = name
    }

    const debugSource =
      fiber["_debugSource"] ??
      fiber["memoizedProps"]?.["__source"] ??
      fiber["pendingProps"]?.["__source"]
    if (
      debugSource !== undefined &&
      debugSource !== null &&
      typeof debugSource["fileName"] === "string"
    ) {
      return {
        sourceFile: debugSource["fileName"],
        sourceLine:
          typeof debugSource["lineNumber"] === "number"
            ? debugSource["lineNumber"]
            : undefined,
        ...(componentName === undefined ? {} : { componentName }),
      }
    }

    fiber = fiber["_debugOwner"] ?? fiber["return"] ?? null
    depth += 1
  }

  return componentName === undefined ? {} : { componentName }
}

const textOf = (element: Element) =>
  (element.textContent ?? "").replace(/\s+/g, " ").trim()

const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max)}…` : value

export const labelFor = (element: Element, componentName?: string): string => {
  const tag = element.tagName.toLowerCase()
  const id = element.id.length > 0 ? `#${element.id}` : ""
  const classes = classesOf(element)
    .slice(0, 2)
    .map((c) => `.${c}`)
    .join("")
  const text = textOf(element)
  const quoted = text.length > 0 ? ` "${truncate(text, MAX_LABEL_TEXT)}"` : ""
  const component = componentName === undefined ? "" : `<${componentName}> `
  return `${component}${tag}${id}${classes}${quoted}`
}

export const rectOf = (element: Element): Rect => {
  const box = element.getBoundingClientRect()
  return {
    x: Math.round(box.left + window.scrollX),
    y: Math.round(box.top + window.scrollY),
    width: Math.round(box.width),
    height: Math.round(box.height),
  }
}

export const describe = (element: Element): PickedElement => {
  const { sourceFile, sourceLine, componentName } = sourceLocationOf(element)
  return {
    selector: selectorFor(element),
    label: labelFor(element, componentName),
    tagName: element.tagName.toLowerCase(),
    elementText: truncate(textOf(element), MAX_TEXT),
    elementHtml: truncate(element.outerHTML, MAX_HTML),
    rect: rectOf(element),
    ...(sourceFile === undefined ? {} : { sourceFile }),
    ...(sourceLine === undefined ? {} : { sourceLine }),
  }
}
