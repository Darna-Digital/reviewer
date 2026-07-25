import { createComment, deleteComment, listComments } from "./client.ts"
import { describe, resolveSelector, sourceLocationOf } from "./element.ts"
import {
  PLACEMENTS,
  loadPlacement,
  savePlacement,
  type Placement,
} from "./placement.ts"
import { styles } from "./styles.ts"
import type { PickedElement, VisualComment } from "./types.ts"

const GEAR_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`

const HOST_ID = "byconvo-visual-picker"
const BADGE_GAP = 8
const EDGE = 12

type Mode = "idle" | "picking" | "composing"

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  if (className !== undefined) node.className = className
  return node
}

const place = (
  panel: HTMLElement,
  anchor: DOMRect,
  { preferBelow = false } = {}
) => {
  const { width, height } = panel.getBoundingClientRect()
  const above = anchor.top - height - BADGE_GAP
  const below = anchor.bottom + BADGE_GAP
  const fitsAbove = above >= EDGE
  const fitsBelow = below + height <= window.innerHeight - EDGE
  const top =
    preferBelow && fitsBelow
      ? below
      : fitsAbove
        ? above
        : fitsBelow
          ? below
          : EDGE
  const left = Math.min(
    Math.max(anchor.left, EDGE),
    window.innerWidth - width - EDGE
  )
  panel.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`
}

export class Picker {
  private readonly root: ShadowRoot
  private readonly highlight = el("div", "highlight")
  private readonly badge = el("div", "badge")
  private readonly composer = el("div", "composer")
  private readonly textarea = el("textarea")
  private readonly saveButton = el("button")
  private readonly launcher = el("div", "launcher")
  private readonly launcherCount = el("span", "count")
  private readonly settings = el("div", "settings")
  private readonly pinLayer = el("div")
  private readonly card = el("div", "card")
  private placement: Placement = loadPlacement()

  private mode: Mode = "idle"
  private hovered: Element | null = null
  private picked: PickedElement | null = null
  private comments: Array<VisualComment> = []
  private readonly pins = new Map<string, HTMLElement>()
  private openCardId: string | null = null
  private syncQueued = false

  constructor(private readonly host: HTMLElement) {
    this.root = host.attachShadow({ mode: "open" })
    const sheet = document.createElement("style")
    sheet.textContent = styles
    this.root.append(
      sheet,
      this.pinLayer,
      this.highlight,
      this.badge,
      this.composer,
      this.card,
      this.buildLauncher()
    )
    this.buildComposer()
    this.setMode("idle")
    this.card.hidden = true
    this.bindGlobalEvents()
    void this.refresh()
  }

  private buildLauncher() {
    const dot = el("span", "dot")
    const label = el("span")
    label.textContent = "byconvo"
    const hint = el("kbd")
    hint.textContent = "⌥C"

    const toggle = el("button", "toggle")
    toggle.append(dot, label, this.launcherCount, hint)
    toggle.setAttribute("aria-label", "Toggle byconvo picker")
    toggle.addEventListener("click", () => {
      this.setMode(this.mode === "picking" ? "idle" : "picking")
    })

    const gear = el("button", "gear")
    gear.innerHTML = GEAR_ICON
    gear.setAttribute("aria-label", "Picker settings")
    gear.addEventListener("click", (event) => {
      event.stopPropagation()
      this.settings.hidden = !this.settings.hidden
    })

    this.buildSettings()
    this.launcher.append(toggle, gear, this.settings)
    this.applyPlacement()
    return this.launcher
  }

  private buildSettings() {
    const heading = el("p", "settings-heading")
    heading.textContent = "Placement"
    this.settings.append(heading)

    for (const option of PLACEMENTS) {
      const button = el("button", "settings-option")
      button.textContent = option.label
      button.dataset["placement"] = option.value
      button.addEventListener("click", (event) => {
        event.stopPropagation()
        this.placement = option.value
        savePlacement(option.value)
        this.applyPlacement()
        this.settings.hidden = true
      })
      this.settings.append(button)
    }
    this.settings.hidden = true
  }

  private applyPlacement() {
    this.launcher.dataset["placement"] = this.placement
    for (const option of this.settings.querySelectorAll(".settings-option")) {
      const value = (option as HTMLElement).dataset["placement"]
      ;(option as HTMLElement).dataset["active"] = String(
        value === this.placement
      )
    }
  }

  private buildComposer() {
    const target = el("span", "target")
    const actions = el("div", "actions")
    const hint = el("span", "hint")
    hint.textContent = "⌘↵ to save · Esc to cancel"
    this.saveButton.textContent = "Comment"
    actions.append(hint, this.saveButton)

    this.textarea.placeholder = "Describe the change you want here…"
    this.composer.append(target, this.textarea, actions)

    this.saveButton.addEventListener("click", () => void this.save())
    this.textarea.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        void this.save()
      }
      if (event.key === "Escape") {
        event.preventDefault()
        this.setMode("picking")
      }
      event.stopPropagation()
    })
  }

  private bindGlobalEvents() {
    document.addEventListener("keydown", this.onKeyDown, true)
    document.addEventListener("mousemove", this.onMouseMove, true)
    document.addEventListener("click", this.onClick, true)
    window.addEventListener("scroll", this.queueSync, true)
    window.addEventListener("resize", this.queueSync)
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.altKey && (event.key === "c" || event.code === "KeyC")) {
      event.preventDefault()
      this.setMode(this.mode === "idle" ? "picking" : "idle")
      return
    }
    if (event.key === "Escape" && this.mode !== "idle") {
      event.preventDefault()
      this.setMode("idle")
    }
  }

  private readonly onMouseMove = (event: MouseEvent) => {
    if (this.mode !== "picking") return
    const target = event.target
    if (!(target instanceof Element) || target === this.host) return
    if (target === this.hovered) return
    this.hovered = target
    this.renderHover(target)
  }

  private readonly onClick = (event: MouseEvent) => {
    const clickedOutsideOverlay = event.target !== this.host
    if (clickedOutsideOverlay) this.settings.hidden = true
    if (this.mode !== "picking") return
    const target = event.target
    if (!(target instanceof Element) || target === this.host) return
    event.preventDefault()
    event.stopPropagation()
    this.picked = describe(target)
    this.hovered = target
    this.setMode("composing")
  }

  private renderHover(element: Element) {
    const rect = element.getBoundingClientRect()
    this.highlight.hidden = false
    this.highlight.style.transform = `translate(${rect.left}px, ${rect.top}px)`
    this.highlight.style.width = `${rect.width}px`
    this.highlight.style.height = `${rect.height}px`
    this.renderBadge(element, rect)
  }

  private renderBadge(element: Element, rect: DOMRect) {
    const node = el("span", "node")
    const tag = el("span", "tag")
    tag.textContent = element.tagName.toLowerCase()
    node.append(tag)
    if (element.id.length > 0) {
      const id = el("span", "id")
      id.textContent = `#${element.id}`
      node.append(id)
    }
    const classes = Array.from(element.classList).slice(0, 3)
    if (classes.length > 0) {
      const cls = el("span", "cls")
      cls.textContent = classes.map((c) => `.${c}`).join("")
      node.append(cls)
    }

    const size = el("span", "dim")
    size.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`

    this.badge.replaceChildren(node, el("span", "sep"), size)

    const { sourceFile, sourceLine, componentName } = sourceLocationOf(element)
    if (componentName !== undefined) {
      const component = el("span", "quoted")
      component.textContent = `<${componentName}>`
      this.badge.append(el("span", "sep"), component)
    }
    if (sourceFile !== undefined) {
      const src = el("span", "src")
      const file = sourceFile.split("/").slice(-2).join("/")
      src.textContent =
        sourceLine === undefined ? file : `${file}:${sourceLine}`
      this.badge.append(el("span", "sep"), src)
    }

    this.badge.hidden = false
    place(this.badge, rect)
  }

  private setMode(mode: Mode) {
    this.mode = mode
    this.launcher.dataset["active"] = String(mode !== "idle")
    document.documentElement.style.cursor =
      mode === "picking" ? "crosshair" : ""

    if (mode === "idle") {
      this.hovered = null
      this.picked = null
      this.highlight.hidden = true
      this.badge.hidden = true
      this.composer.hidden = true
      this.highlight.dataset["locked"] = "false"
      return
    }

    if (mode === "picking") {
      this.picked = null
      this.composer.hidden = true
      this.highlight.dataset["locked"] = "false"
      this.closeCard()
      return
    }

    this.badge.hidden = true
    this.highlight.dataset["locked"] = "true"
    this.openComposer()
  }

  private openComposer() {
    if (this.picked === null || this.hovered === null) return
    const target = this.composer.querySelector(".target")
    if (target !== null) target.textContent = this.picked.label
    this.textarea.value = ""
    this.composer.hidden = false
    place(this.composer, this.hovered.getBoundingClientRect(), {
      preferBelow: true,
    })
    this.textarea.focus()
  }

  private async save() {
    const body = this.textarea.value.trim()
    if (body.length === 0 || this.picked === null) return
    this.saveButton.disabled = true
    try {
      await createComment({
        body,
        pageUrl: location.href,
        pageTitle: document.title,
        route: location.pathname,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        ...this.picked,
      })
      this.setMode("picking")
      await this.refresh()
      this.toast("Comment saved to byconvo")
    } catch (error) {
      this.toast(
        error instanceof Error ? error.message : "Could not reach byconvo"
      )
    } finally {
      this.saveButton.disabled = false
    }
  }

  async refresh() {
    try {
      this.comments = await listComments()
    } catch {
      this.comments = []
    }
    this.renderPins()
  }

  private commentsHere() {
    return this.comments.filter((c) => c.route === location.pathname)
  }

  private renderPins() {
    const here = this.commentsHere()
    this.launcherCount.textContent = String(here.length)
    this.launcherCount.hidden = here.length === 0

    const live = new Set(here.map((c) => c.id))
    for (const [id, pin] of this.pins) {
      if (!live.has(id)) {
        pin.remove()
        this.pins.delete(id)
      }
    }

    here.forEach((comment, index) => {
      let pin = this.pins.get(comment.id)
      if (pin === undefined) {
        pin = el("div", "pin")
        pin.addEventListener("click", (event) => {
          event.stopPropagation()
          this.toggleCard(comment)
        })
        this.pins.set(comment.id, pin)
        this.pinLayer.append(pin)
      }
      pin.textContent = String(index + 1)
      pin.title = comment.body
    })

    this.syncPins()
  }

  private readonly queueSync = () => {
    if (this.syncQueued) return
    this.syncQueued = true
    requestAnimationFrame(() => {
      this.syncQueued = false
      this.syncPins()
      if (this.mode === "picking" && this.hovered !== null) {
        this.renderHover(this.hovered)
      }
    })
  }

  private syncPins() {
    for (const comment of this.commentsHere()) {
      const pin = this.pins.get(comment.id)
      if (pin === undefined) continue
      const element = resolveSelector(comment.selector)
      if (element === null) {
        pin.dataset["orphan"] = "true"
        pin.style.transform = `translate(${comment.rect.x - window.scrollX}px, ${
          comment.rect.y - window.scrollY
        }px)`
        continue
      }
      const rect = element.getBoundingClientRect()
      pin.dataset["orphan"] = "false"
      pin.style.transform = `translate(${Math.round(rect.left - 8)}px, ${Math.round(
        rect.top - 8
      )}px)`
    }
    if (this.openCardId !== null) {
      const comment = this.comments.find((c) => c.id === this.openCardId)
      const anchor =
        comment === undefined ? null : resolveSelector(comment.selector)
      if (anchor !== null) {
        place(this.card, anchor.getBoundingClientRect(), { preferBelow: true })
      }
    }
  }

  private toggleCard(comment: VisualComment) {
    if (this.openCardId === comment.id) {
      this.closeCard()
      return
    }
    this.openCardId = comment.id

    const meta = el("div", "meta")
    const element = resolveSelector(comment.selector)
    meta.textContent =
      element === null ? `${comment.label} (element not found)` : comment.label

    const body = el("div", "body")
    body.textContent = comment.body

    const actions = el("div", "actions")
    const remove = el("button", "ghost")
    remove.textContent = "Resolve"
    remove.addEventListener("click", () => void this.resolve(comment.id))
    actions.append(remove)

    this.card.replaceChildren(meta, body, actions)
    this.card.hidden = false
    const anchor = element ?? this.pins.get(comment.id)
    if (anchor != null) {
      place(this.card, anchor.getBoundingClientRect(), { preferBelow: true })
    }
  }

  private closeCard() {
    this.openCardId = null
    this.card.hidden = true
  }

  private async resolve(id: string) {
    try {
      await deleteComment(id)
      this.closeCard()
      await this.refresh()
    } catch {
      this.toast("Could not reach byconvo")
    }
  }

  private toast(message: string) {
    const node = el("div", "toast")
    node.textContent = message
    this.root.append(node)
    setTimeout(() => node.remove(), 2600)
  }
}

export const mount = () => {
  if (document.getElementById(HOST_ID) !== null) return
  const host = el("div")
  host.id = HOST_ID
  document.body.append(host)
  const picker = new Picker(host)

  const onNavigate = () => void picker.refresh()
  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method]
    history[method] = function patched(this: History, ...args: Array<any>) {
      const result = original.apply(this, args as never)
      onNavigate()
      return result
    } as never
  }
  window.addEventListener("popstate", onNavigate)
}
