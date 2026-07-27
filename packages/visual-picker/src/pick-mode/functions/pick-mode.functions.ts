import type {
  ClickIntent,
  ClickIntentInput,
  Mode,
  ModeEvent,
  PickModeDependencies,
  PickModeFunctions,
} from "../entity/pick-mode.interfaces.ts"

const OVERLAY_TRIGGER_SELECTOR = [
  "[aria-haspopup]",
  '[data-slot$="-trigger"]',
  "summary",
  "select",
].join(",")

export const reduceMode = (mode: Mode, event: ModeEvent): Mode => {
  if (event === "toggle") {
    if (mode === "idle") return "picking"
    return "idle"
  }

  if (event === "escape") {
    if (mode === "composing") return "picking"
    if (mode === "picking") return "idle"
    return "idle"
  }

  if (event === "pick") {
    if (mode !== "picking") return mode
    return "composing"
  }

  if (event === "saved") return "picking"

  return mode
}

export const resolveClickIntent = (input: ClickIntentInput): ClickIntent => {
  if (input.mode !== "picking") return "ignore"
  if (input.isHost) return "ignore"
  if (input.shiftKey) return "pick"
  if (input.isOverlayTrigger) return "pass"
  return "pick"
}

export const isOverlayTrigger = (element: Element): boolean =>
  element.closest(OVERLAY_TRIGGER_SELECTOR) !== null

export const launcherLabel = (mode: Mode): string => {
  if (mode === "idle") return "Comment"
  return "Stop"
}

export const launcherHint = (mode: Mode): string => {
  if (mode === "idle") return "⌥C"
  return "Esc"
}

export const createPickModeFunctions = (
  _d: PickModeDependencies
): PickModeFunctions => ({
  reduceMode,
  resolveClickIntent,
  isOverlayTrigger,
  launcherLabel,
  launcherHint,
})
