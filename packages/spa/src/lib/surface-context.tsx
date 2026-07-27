/**
 * Substrate context for the surface ladder — the Fluid Functionalism
 * "Surfaces" system (fluidfunctionalism.com/docs/surfaces).
 *
 * A container publishes the level it painted itself at; anything opening on
 * top of it lifts a fixed number of steps from there. That is what keeps a
 * submenu readable over its parent menu, and a dropdown readable inside a
 * dialog, without either side knowing how deeply it was nested — which is the
 * failure mode of fixed `bg-popover` surfaces in dark mode, where every layer
 * lands on the same value.
 */
import { createContext, useContext, type ReactNode } from "react"

import {
  BASE_SURFACE,
  TOP_SURFACE,
  clampLevel,
  surfaceBackground,
  surfaceClasses,
} from "@/lib/surface-classes"

/** Steps a popup lifts above its substrate. */
const ELEVATION = {
  menu: 2,
  tooltip: 3,
  dialog: 4,
} as const

/**
 * Popups keep one constant shadow weight regardless of nesting: only the
 * background tracks the substrate, so a submenu doesn't stack a heavier and
 * heavier drop the further in it opens.
 */
const POPUP_SHADOW = 3

const SurfaceContext = createContext<number>(BASE_SURFACE)

function useSurface(): number {
  return useContext(SurfaceContext)
}

/** Background class of the surface the caller is currently sitting on. */
function useSurfaceBackground(): string {
  return surfaceBackground(useSurface())
}

interface Elevation {
  /** Absolute level to re-publish to descendants. */
  level: number
  /** Background + shadow classes for the lifted element. */
  className: string
}

function useElevation(offset: number, shadowLevel?: number): Elevation {
  const level = Math.min(useSurface() + offset, TOP_SURFACE)
  return { level, className: surfaceClasses(level, shadowLevel ?? level) }
}

function SurfaceProvider({
  value,
  children,
}: {
  value: number
  children: ReactNode
}) {
  return (
    <SurfaceContext.Provider value={clampLevel(value)}>
      {children}
    </SurfaceContext.Provider>
  )
}

export {
  ELEVATION,
  POPUP_SHADOW,
  SurfaceProvider,
  useElevation,
  useSurface,
  useSurfaceBackground,
}
