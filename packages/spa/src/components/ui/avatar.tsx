import { cn } from "@/lib/utils"

/**
 * Initials avatar. The tint is derived from the name, so the same person keeps
 * the same colour everywhere without a stored preference.
 */
const TINTS = [
  "bg-brand-100 text-brand-800 dark:bg-brand-500/20 dark:text-brand-200",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
  "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
  "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
  "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
]

const tintFor = (name: string) => {
  let sum = 0
  for (const char of name) sum += char.codePointAt(0) ?? 0
  return TINTS[sum % TINTS.length]
}

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
  ...props
}: React.ComponentProps<"span"> & { name: string; letters?: number }) {
  return (
    <span
      data-slot="avatar"
      aria-hidden
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-semibold outline-1 -outline-offset-1 outline-black/5 dark:outline-white/10",
        tintFor(name),
        className
      )}
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
