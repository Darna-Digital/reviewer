import type { CSSProperties } from "react"
import { cn } from "@/lib/utils"

/**
 * Initials on a solid colour picked from the name, so nobody has to store a
 * picture and the same person keeps the same avatar everywhere.
 *
 * The palette is one fixed lightness and chroma swept across ten hues. OKLCH
 * is perceptually uniform, so unlike an HSL ramp every hue lands at the same
 * visual weight — no washed-out yellows beside heavy blues — and every one of
 * them clears 4.5:1 against the white initials at any size.
 */
const LIGHTNESS = 0.48
const CHROMA = 0.15

const HUES = [18, 48, 92, 145, 178, 212, 248, 278, 308, 342]

/** FNV-1a — names sharing letters still land on different colours. */
const hash = (name: string) => {
  let value = 0x811c9dc5
  for (let index = 0; index < name.length; index++) {
    value ^= name.charCodeAt(index)
    value = Math.imul(value, 0x01000193)
  }
  return value >>> 0
}

const colorFor = (name: string) =>
  `oklch(${LIGHTNESS} ${CHROMA} ${HUES[hash(name) % HUES.length]})`

const initials = (name: string, letters: number) =>
  name
    .split(/\s+/)
    .slice(0, letters)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("")

function Avatar({
  name,
  letters = 2,
  className,
  style,
  ...props
}: React.ComponentProps<"span"> & { name: string; letters?: number }) {
  return (
    <span
      data-slot="avatar"
      aria-hidden
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full bg-(--avatar) text-[0.6875rem] font-semibold text-white outline-1 -outline-offset-1 outline-black/10 dark:outline-white/15",
        className
      )}
      style={{ "--avatar": colorFor(name), ...style } as CSSProperties}
      {...props}
    >
      {initials(name, letters)}
    </span>
  )
}

/** Overlapping avatars, ringed in the page background so they read as a stack. */
function AvatarStack({
  names,
  max = 3,
  className,
}: {
  names: ReadonlyArray<string>
  max?: number
  className?: string
}) {
  const shown = names.slice(0, max)
  const hidden = names.length - shown.length

  return (
    <div className={cn("flex items-center", className)}>
      <span className="sr-only">{names.join(", ")}</span>
      {shown.map((name) => (
        <Avatar
          key={name}
          name={name}
          letters={1}
          className="-ml-1.5 size-6 ring-2 ring-background outline-hidden first:ml-0"
        />
      ))}
      {hidden > 0 && (
        <span className="-ml-1.5 flex size-6 items-center justify-center rounded-full bg-muted text-[0.6875rem] font-semibold text-muted-foreground tabular-nums ring-2 ring-background">
          +{hidden}
        </span>
      )}
    </div>
  )
}

export { Avatar, AvatarStack }
