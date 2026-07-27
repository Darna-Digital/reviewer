const STORAGE_KEY = "byconvo-picker-placement"

export const PLACEMENTS = [
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
] as const

export type Placement = (typeof PLACEMENTS)[number]["value"]

export const DEFAULT_PLACEMENT: Placement = "bottom-left"

const isPlacement = (value: string | null): value is Placement =>
  PLACEMENTS.some((p) => p.value === value)

export const loadPlacement = (): Placement => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isPlacement(stored) ? stored : DEFAULT_PLACEMENT
  } catch {
    return DEFAULT_PLACEMENT
  }
}

export const savePlacement = (placement: Placement) => {
  try {
    localStorage.setItem(STORAGE_KEY, placement)
  } catch {
    /* a page with storage disabled just loses the preference */
  }
}
