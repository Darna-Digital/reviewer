export type Mode = "idle" | "picking" | "composing"

export type ModeEvent = "toggle" | "escape" | "pick" | "saved"

export type ClickIntent = "ignore" | "pass" | "pick"

export interface ClickIntentInput {
  mode: Mode
  isHost: boolean
  shiftKey: boolean
  isOverlayTrigger: boolean
}

export interface PickModeDependencies {
  data: Record<string, never>
  sideEffects: Record<string, never>
}

export interface PickModeFunctions {
  reduceMode: (mode: Mode, event: ModeEvent) => Mode
  resolveClickIntent: (input: ClickIntentInput) => ClickIntent
  isOverlayTrigger: (element: Element) => boolean
  launcherLabel: (mode: Mode) => string
  launcherHint: (mode: Mode) => string
}
